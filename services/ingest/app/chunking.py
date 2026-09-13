"""Chunking thuần theo SPEC §5: cửa sổ ~700 token, chồng lấn 15%, ưu tiên ranh giới đoạn,
không cắt giữa câu, mỗi chunk giữ danh sách bbox để highlight nhiều dòng.

Không phụ thuộc PyMuPDF hay mạng — unit test được (CLAUDE.md: logic thuần bắt buộc có test).
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

import tiktoken

BBox = tuple[float, float, float, float]

_enc = tiktoken.get_encoding("o200k_base")


def count_tokens(text: str) -> int:
    return len(_enc.encode(text))


@dataclass(frozen=True)
class Line:
    """Một dòng chữ trên trang, toạ độ theo pixel của ảnh trang đã render."""

    text: str
    bbox: BBox
    block: int  # số thứ tự đoạn (block) — dùng làm ranh giới ưu tiên khi cắt


@dataclass
class Sentence:
    text: str
    bboxes: list[BBox]
    block: int
    tokens: int


@dataclass
class Chunk:
    text: str
    bboxes: list[BBox] = field(default_factory=list)
    token_count: int = 0


def nfc(text: str) -> str:
    """Tiếng Việt có hai cách mã hoá dấu; chuẩn về NFC trước khi chunk và trước khi so khớp."""
    return unicodedata.normalize("NFC", text)


# Kết thúc câu: . ! ? … theo sau là khoảng trắng; hoặc xuống dòng đôi. Không tách sau số thập phân (3.14).
_SENTENCE_END = re.compile(r"(?<=[.!?…])(?<!\d\.)\s+(?=\S)")
_WS = re.compile(r"\s+")


def _clean(text: str) -> str:
    return _WS.sub(" ", nfc(text)).strip()


def lines_to_sentences(lines: list[Line]) -> list[Sentence]:
    """Ghép dòng theo đoạn rồi tách câu; mỗi câu giữ bbox của mọi dòng nó chạm tới."""
    sentences: list[Sentence] = []
    # Gom dòng theo block, giữ thứ tự xuất hiện.
    blocks: dict[int, list[Line]] = {}
    for ln in lines:
        if _clean(ln.text):
            blocks.setdefault(ln.block, []).append(ln)

    for block_no, block_lines in blocks.items():
        # Vị trí ký tự của từng dòng trong đoạn đã ghép.
        parts: list[str] = []
        spans: list[tuple[int, int, BBox]] = []
        pos = 0
        for ln in block_lines:
            t = _clean(ln.text)
            if parts:
                pos += 1  # khoảng trắng nối dòng
            parts.append(t)
            spans.append((pos, pos + len(t), ln.bbox))
            pos += len(t)
        paragraph = " ".join(parts)

        cursor = 0
        for piece in _SENTENCE_END.split(paragraph):
            start = paragraph.find(piece, cursor)
            end = start + len(piece)
            cursor = end
            bboxes = [b for s, e, b in spans if s < end and e > start]
            sentences.append(Sentence(piece, bboxes, block_no, count_tokens(piece)))
    return sentences


def _split_long_sentence(sentence: Sentence, limit: int) -> list[Sentence]:
    """Câu dài hơn cả cửa sổ (bảng, danh sách dính liền): cắt cứng theo token — ngoại lệ có chủ ý."""
    ids = _enc.encode(sentence.text)
    out: list[Sentence] = []
    for i in range(0, len(ids), limit):
        piece = _enc.decode(ids[i : i + limit])
        out.append(Sentence(piece, sentence.bboxes, sentence.block, count_tokens(piece)))
    return out


def chunk_sentences(
    sentences: list[Sentence], target: int = 700, overlap_ratio: float = 0.15
) -> list[Chunk]:
    """Đóng gói câu thành chunk.

    - Không vượt `target` token (trừ khi một câu đã dài hơn — khi đó cắt cứng câu đó).
    - Ưu tiên kết thúc chunk ở ranh giới đoạn khi chunk đã đầy ≥ 60% và đoạn tiếp theo không vừa.
    - Chunk sau mở đầu bằng những câu cuối của chunk trước, tổng ≤ target*overlap_ratio.
    """
    expanded: list[Sentence] = []
    for s in sentences:
        expanded.extend(_split_long_sentence(s, target) if s.tokens > target else [s])

    overlap_budget = int(target * overlap_ratio)
    chunks: list[Chunk] = []
    current: list[Sentence] = []
    current_tokens = 0
    fresh = 0  # số câu thêm vào sau phần chồng lấn — đuôi chỉ ghi khi có câu mới

    def flush() -> None:
        nonlocal current, current_tokens, fresh
        if not current or fresh == 0:
            return
        text = " ".join(s.text for s in current)
        bboxes: list[BBox] = []
        for s in current:
            for b in s.bboxes:
                if b not in bboxes:
                    bboxes.append(b)
        chunks.append(Chunk(text, bboxes, count_tokens(text)))
        # Chồng lấn: giữ lại các câu cuối trong ngân sách overlap để mở chunk kế.
        carry: list[Sentence] = []
        carry_tokens = 0
        for s in reversed(current):
            if carry_tokens + s.tokens > overlap_budget:
                break
            carry.insert(0, s)
            carry_tokens += s.tokens
        current, current_tokens, fresh = carry, carry_tokens, 0

    i = 0
    while i < len(expanded):
        s = expanded[i]
        if current and current_tokens + s.tokens > target:
            flush()
            if current and current_tokens + s.tokens > target:
                # Phần carry vẫn không chứa nổi câu này (câu rất dài) → bỏ carry.
                current, current_tokens, fresh = [], 0, 0
        current.append(s)
        current_tokens += s.tokens
        fresh += 1
        i += 1

        # Ranh giới đoạn: nếu đoạn kế tiếp không vừa và chunk đã đủ đầy, kết thúc ở đây.
        if i < len(expanded) and expanded[i].block != s.block and current_tokens >= target * 0.6:
            next_block_tokens = 0
            for nxt in expanded[i:]:
                if nxt.block != expanded[i].block:
                    break
                next_block_tokens += nxt.tokens
            if current_tokens + next_block_tokens > target:
                flush()

    flush()
    return chunks


def chunk_page(lines: list[Line], target: int = 700, overlap_ratio: float = 0.15) -> list[Chunk]:
    """Đường đi chuẩn cho một trang: dòng → câu → chunk. Chunk không bao giờ vắt qua trang."""
    return chunk_sentences(lines_to_sentences(lines), target, overlap_ratio)
