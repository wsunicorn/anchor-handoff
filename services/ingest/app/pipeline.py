"""Đường đi của một tài liệu: nhận file → kiểm hạn mức → lưu → (nền) trích/OCR/chunk/embed → ready.

Trạng thái `documents.status`: pending → parsing → embedding → ready | failed (kèm `error`).
Client chỉ đọc trạng thái qua PostgREST (RLS); không có kênh nào khác.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
from dataclasses import dataclass
from typing import Any

from app.chunking import chunk_page
from app.config import limits_for, settings
from app.embeddings import embed_documents
from app.pdf import extract_page, open_pdf
from app.supa import supabase

log = logging.getLogger(__name__)


class LimitError(Exception):
    """Vượt hạn mức tầng. `code` là mã máy trả cho client; `limit` là con số để hiển thị."""

    def __init__(self, code: str, limit: int) -> None:
        super().__init__(code)
        self.code = code
        self.limit = limit


@dataclass
class Accepted:
    document_id: str
    status: str
    page_count: int
    reused: bool  # đã có cùng file của chính người này → không xử lý lại


_VI_MARKS = re.compile(r"[ăâđêôơưĂÂĐÊÔƠƯàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]")


def detect_lang(text: str) -> str:
    """Heuristic rẻ: tỉ lệ ký tự có dấu tiếng Việt. Đủ cho `documents.lang` (SPEC §8)."""
    letters = sum(ch.isalpha() for ch in text)
    if letters == 0:
        return "und"
    return "vi" if len(_VI_MARKS.findall(text)) / letters > 0.03 else "en"


async def _profile(user_id: str) -> dict[str, Any]:
    # Tầng lấy từ effective_tier() (dùng thử/gói trả tiền/hết hạn — 0005_billing), không đọc cột tier.
    rows = await supabase.select("profiles", select="ai_consent_at", id=f"eq.{user_id}")
    tier = await supabase.rpc("effective_tier", {"p_owner": user_id})
    return {"tier": tier if tier == "pro" else "free", "ai_consent_at": rows[0]["ai_consent_at"] if rows else None}


async def accept_upload(user_id: str, title: str, pdf: bytes) -> Accepted:
    """Kiểm hạn mức ở server (G1.10), tạo dòng documents, lưu file gốc. Không xử lý nặng ở đây."""
    sha = hashlib.sha256(pdf).hexdigest()
    profile = await _profile(user_id)
    # SPEC §9 / CLAUDE.md quy tắc 3: nội dung tài liệu đi tới Gemini để embedding → phải có đồng ý trước.
    if not profile.get("ai_consent_at"):
        raise LimitError("consent_required", 0)
    max_docs, max_pages = limits_for(profile["tier"])

    # Cùng người, cùng file: trả về tài liệu đã có (unique(owner, sha256)).
    existing = await supabase.select(
        "documents", select="id,status,page_count", owner=f"eq.{user_id}", sha256=f"eq.{sha}"
    )
    if existing:
        d = existing[0]
        return Accepted(d["id"], d["status"], d["page_count"], reused=True)

    doc = await asyncio.to_thread(open_pdf, pdf)
    page_count = doc.page_count
    doc.close()
    if page_count > max_pages:
        raise LimitError("page_limit", max_pages)

    owned = await supabase.select(
        "documents", select="id", owner=f"eq.{user_id}", status="neq.failed"
    )
    if len(owned) >= max_docs:
        raise LimitError("document_limit", max_docs)

    row = (
        await supabase.insert(
            "documents",
            {
                "owner": user_id,
                "title": title[:200] or "Tài liệu",
                "sha256": sha,
                "page_count": page_count,
                "status": "pending",
            },
        )
    )[0]
    document_id: str = row["id"]
    await supabase.upload(
        settings.storage_bucket, f"{user_id}/{document_id}/source.pdf", pdf, "application/pdf"
    )
    return Accepted(document_id, "pending", page_count, reused=False)


async def _set_status(document_id: str, status: str, **extra: Any) -> None:
    await supabase.update("documents", {"status": status, **extra}, id=f"eq.{document_id}")


async def _find_cached(sha: str, exclude_id: str) -> str | None:
    rows = await supabase.select(
        "documents", select="id", sha256=f"eq.{sha}", status="eq.ready", id=f"neq.{exclude_id}", limit="1"
    )
    return rows[0]["id"] if rows else None


async def process_document(document_id: str, user_id: str, pdf: bytes) -> None:
    """Tác vụ nền. Mọi lỗi đều đưa tài liệu về `failed` với mã ngắn — không để treo ở pending."""
    try:
        await _set_status(document_id, "parsing")
        sha = hashlib.sha256(pdf).hexdigest()
        cached = await _find_cached(sha, document_id)
        doc = await asyncio.to_thread(open_pdf, pdf)

        chunk_rows: list[dict[str, Any]] = []
        texts: list[str] = []
        sample_text: list[str] = []
        ord_no = 0
        for page in doc:
            extract, png = await asyncio.to_thread(
                extract_page,
                page,
                render_width=settings.page_render_width,
                scan_min_chars=settings.scan_min_chars if cached is None else 10**9,  # cache: khỏi OCR
                ocr_languages=settings.ocr_languages,
                ocr_dpi=settings.ocr_dpi,
                tessdata=settings.tessdata_prefix,
            )
            image_path = f"{user_id}/{document_id}/pages/{extract.page_no}.png"
            await supabase.upload(settings.storage_bucket, image_path, png, "image/png")
            await supabase.insert(
                "pages",
                {
                    "document_id": document_id,
                    "page_no": extract.page_no,
                    "image_path": image_path,
                    "width": extract.width,
                    "height": extract.height,
                },
            )
            if cached is not None:
                continue
            for chunk in chunk_page(extract.lines, settings.chunk_target_tokens, settings.chunk_overlap_ratio):
                chunk_rows.append(
                    {
                        "document_id": document_id,
                        "page_no": extract.page_no,
                        "ord": ord_no,
                        "text": chunk.text,
                        "bboxes": [list(b) for b in chunk.bboxes],
                        "token_count": chunk.token_count,
                    }
                )
                texts.append(chunk.text)
                ord_no += 1
            if len(sample_text) < 20:
                sample_text.extend(ln.text for ln in extract.lines[:5])
        doc.close()

        if cached is not None:
            # ADR-0001 chốt chặn 1: cùng sha256 → tái dùng chunk + embedding, không gọi model.
            src = await supabase.select(
                "chunks",
                select="page_no,ord,text,bboxes,token_count,embedding",
                document_id=f"eq.{cached}",
                order="ord.asc",
            )
            for row in src:
                row["document_id"] = document_id
            for i in range(0, len(src), 200):
                await supabase.insert("chunks", src[i : i + 200])
            lang_rows = await supabase.select("documents", select="lang", id=f"eq.{cached}")
            await _set_status(document_id, "ready", lang=lang_rows[0]["lang"] if lang_rows else None)
            log.info("doc %s tái dùng %d chunk từ %s", document_id, len(src), cached)
            return

        if not chunk_rows:
            raise ValueError("no_text_found")

        lang = detect_lang(" ".join(sample_text))
        await _set_status(document_id, "embedding", lang=lang)
        vectors = await embed_documents(texts)
        for row, vec in zip(chunk_rows, vectors):
            row["embedding"] = "[" + ",".join(f"{v:.6f}" for v in vec) + "]"
        for i in range(0, len(chunk_rows), 200):
            await supabase.insert("chunks", chunk_rows[i : i + 200])

        tokens_in = sum(r["token_count"] for r in chunk_rows)
        await supabase.insert(
            "usage_costs",
            {
                "owner": user_id,
                "feature": "embed",
                "model": settings.embedding_model,
                "tokens_in": tokens_in,
                "tokens_out": 0,
                "cost_usd": round(tokens_in / 1_000_000 * settings.embedding_price_per_m_usd, 6),
            },
        )
        await _set_status(document_id, "ready")
        log.info("doc %s ready: %d chunk, %d token", document_id, len(chunk_rows), tokens_in)
    except Exception as e:  # noqa: BLE001 — mọi lỗi đều phải hạ cánh ở `failed`
        code = str(e)[:120] if isinstance(e, ValueError) else type(e).__name__
        log.exception("doc %s failed: %s", document_id, e)
        try:
            await _set_status(document_id, "failed", error=code)
        except Exception:  # noqa: BLE001
            log.exception("không ghi được trạng thái failed cho %s", document_id)
