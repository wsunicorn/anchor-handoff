"""Sinh PDF mẫu để dev/test pipeline khi chưa có tài liệu thật:
  vi_text.pdf   — 3 trang giáo trình tiếng Việt (font Be Vietnam Pro, có dấu)
  en_text.pdf   — 2 trang tiếng Anh
  slides.pdf    — 4 slide ngang, chữ to, ít chữ mỗi trang
  scan.pdf      — vi_text.pdf rasterize (không có lớp chữ) → buộc OCR

Chạy: .venv/Scripts/python scripts/make_fixtures.py  → tests/fixtures/*.pdf
Đây là fixture tạm; tiêu chí thoát G1 vẫn đòi 5 tài liệu thật.
"""

from __future__ import annotations

from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[3]  # gốc repo
OUT = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
FONT_SANS = ROOT / "assets" / "fonts" / "BeVietnamPro_400Regular.ttf"
FONT_SERIF = ROOT / "assets" / "fonts" / "SourceSerif4_400Regular.ttf"

VI_PARAGRAPHS = [
    "Chương 1. Định luật bảo toàn năng lượng. Năng lượng không tự sinh ra và không tự mất đi, "
    "nó chỉ chuyển hoá từ dạng này sang dạng khác hoặc truyền từ vật này sang vật khác. "
    "Tổng năng lượng của một hệ kín là không đổi theo thời gian.",
    "Ví dụ: khi thả một quả bóng từ độ cao h, thế năng của bóng giảm dần trong khi động năng "
    "tăng lên. Nếu bỏ qua ma sát với không khí, tổng cơ năng được bảo toàn. Ở mặt đất, toàn bộ "
    "thế năng đã chuyển thành động năng.",
    "Chương 2. Nguyên lý thứ hai của nhiệt động lực học. Nhiệt không thể tự truyền từ vật lạnh "
    "sang vật nóng hơn. Entropy của một hệ cô lập không bao giờ giảm. Mọi quá trình thực đều "
    "không thuận nghịch ở một mức độ nào đó.",
    "Ứng dụng: động cơ nhiệt lý tưởng Carnot có hiệu suất phụ thuộc vào nhiệt độ nguồn nóng "
    "và nguồn lạnh. Hiệu suất thực tế luôn thấp hơn hiệu suất Carnot vì có ma sát, dẫn nhiệt "
    "và các tổn hao khác.",
]

EN_PARAGRAPHS = [
    "Chapter 1. Conservation of energy. Energy cannot be created or destroyed; it can only be "
    "transformed from one form to another or transferred between objects. The total energy of "
    "an isolated system remains constant over time.",
    "Example: a ball dropped from height h loses potential energy while gaining kinetic energy. "
    "Neglecting air resistance, mechanical energy is conserved. At ground level all potential "
    "energy has become kinetic energy.",
    "Chapter 2. The second law of thermodynamics. Heat does not spontaneously flow from a colder "
    "body to a hotter one. The entropy of an isolated system never decreases.",
]


def _wrap(text: str, fontfile: str, size: float, max_width: float) -> list[str]:
    """Tự xuống dòng theo bề rộng thật của font — mỗi dòng một text object như PDF thật."""
    font = fitz.Font(fontfile=fontfile)
    words = text.split()
    lines: list[str] = []
    cur = ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if font.text_length(trial, fontsize=size) <= max_width:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def _text_pages(path: Path, paragraphs: list[str], font: Path, per_page: int, size: float = 12) -> None:
    doc = fitz.open()
    for i in range(0, len(paragraphs), per_page):
        page = doc.new_page(width=595, height=842)  # A4 điểm
        page.insert_font(fontname="F0", fontfile=str(font))
        y = 72.0
        for para in paragraphs[i : i + per_page]:
            for line in _wrap(para, str(font), size, 483):
                page.insert_text((56, y), line, fontname="F0", fontsize=size)
                y += size * 1.5
            y += size * 1.2  # cách đoạn
    doc.save(str(path))
    doc.close()


def _slides(path: Path) -> None:
    doc = fitz.open()
    titles = ["Năng lượng", "Bảo toàn cơ năng", "Entropy", "Động cơ Carnot"]
    bullets = [
        "Không tự sinh ra, không tự mất đi. Chỉ chuyển hoá.",
        "Thế năng + động năng = hằng số (bỏ qua ma sát).",
        "Entropy hệ cô lập không giảm. Quá trình thực không thuận nghịch.",
        "Hiệu suất phụ thuộc nhiệt độ nguồn nóng và nguồn lạnh.",
    ]
    for title, bullet in zip(titles, bullets):
        page = doc.new_page(width=960, height=540)
        page.insert_font(fontname="F0", fontfile=str(FONT_SANS))
        page.insert_textbox(fitz.Rect(60, 60, 900, 140), title, fontname="F0", fontsize=36)
        page.insert_textbox(fitz.Rect(60, 180, 900, 480), "• " + bullet, fontname="F0", fontsize=24, lineheight=1.4)
    doc.save(str(path))
    doc.close()


def _scan_from(src: Path, path: Path, dpi: int = 150) -> None:
    """Rasterize từng trang thành ảnh JPEG rồi đóng lại thành PDF không có lớp chữ."""
    text_doc = fitz.open(str(src))
    scan = fitz.open()
    for page in text_doc:
        jpeg = page.get_pixmap(dpi=dpi).tobytes("jpeg", jpg_quality=80)
        new_page = scan.new_page(width=page.rect.width, height=page.rect.height)
        new_page.insert_image(new_page.rect, stream=jpeg)
    scan.save(str(path), deflate=True)
    scan.close()
    text_doc.close()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    _text_pages(OUT / "vi_text.pdf", VI_PARAGRAPHS * 2, FONT_SERIF, per_page=3)
    _text_pages(OUT / "en_text.pdf", EN_PARAGRAPHS * 2, FONT_SERIF, per_page=3)
    _slides(OUT / "slides.pdf")
    _scan_from(OUT / "vi_text.pdf", OUT / "scan.pdf")
    for p in sorted(OUT.glob("*.pdf")):
        d = fitz.open(str(p))
        print(f"{p.name}: {d.page_count} trang, {sum(len(pg.get_text()) for pg in d)} ký tự chữ")


if __name__ == "__main__":
    main()
