"""G1.1–G1.3: trích dòng có toạ độ, phát hiện scan, OCR vie+eng, render ảnh trang.
Cần fixtures (scripts/make_fixtures.py) và tessdata (scripts/get-tessdata.sh)."""

from pathlib import Path

import fitz
import pytest

from app.chunking import chunk_page, nfc
from app.config import settings
from app.pdf import extract_page, open_pdf

FIX = Path(__file__).parent / "fixtures"
pytestmark = pytest.mark.skipif(not (FIX / "vi_text.pdf").exists(), reason="chạy scripts/make_fixtures.py")


def _extract(name: str, page_index: int = 0):
    doc = open_pdf((FIX / name).read_bytes())
    page = doc[page_index]
    return extract_page(
        page,
        render_width=settings.page_render_width,
        scan_min_chars=settings.scan_min_chars,
        ocr_languages=settings.ocr_languages,
        ocr_dpi=settings.ocr_dpi,
        tessdata=settings.tessdata_prefix,
    )


def test_pdf_text_tieng_viet_co_dong_va_toa_do():
    ex, png = _extract("vi_text.pdf")
    assert not ex.ocr
    assert ex.width == 1600 and ex.height > ex.width  # A4 dọc
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    assert len(ex.lines) >= 8
    full = " ".join(ln.text for ln in ex.lines)
    assert "Định luật bảo toàn năng lượng" in nfc(full)
    for ln in ex.lines:
        x0, y0, x1, y1 = ln.bbox
        assert 0 <= x0 < x1 <= ex.width and 0 <= y0 < y1 <= ex.height
    # Dòng đọc từ trên xuống: y tăng dần theo thứ tự trong đoạn đầu.
    ys = [ln.bbox[1] for ln in ex.lines if ln.block == ex.lines[0].block]
    assert ys == sorted(ys)


def test_chunk_tu_trang_that_giu_bbox_nhieu_dong():
    ex, _ = _extract("vi_text.pdf")
    chunks = chunk_page(ex.lines)
    assert chunks
    assert all(len(c.bboxes) >= 1 for c in chunks)
    # Một trang A4 ~600 token → một hoặc hai chunk, không cắt giữa câu.
    assert all(c.text.rstrip().endswith((".", "!", "?")) for c in chunks)


def test_slide_ngang():
    ex, _ = _extract("slides.pdf")
    assert ex.width == 1600 and ex.height < ex.width
    assert any("Năng lượng" in nfc(ln.text) for ln in ex.lines)


def test_scan_duoc_phat_hien_va_ocr_tieng_viet():
    ex, _ = _extract("scan.pdf")
    assert ex.ocr, "trang scan phải đi đường OCR"
    assert len(ex.lines) >= 8
    full = nfc(" ".join(ln.text for ln in ex.lines))
    # OCR tessdata_fast không hoàn hảo; kiểm các cụm có dấu đặc trưng thay vì so khớp toàn văn.
    hits = sum(k in full for k in ["bảo toàn", "năng lượng", "Định luật", "chuyển hoá", "thế năng"])
    assert hits >= 3, full[:300]
    for ln in ex.lines:
        x0, y0, x1, y1 = ln.bbox
        assert 0 <= x0 < x1 <= ex.width and 0 <= y0 < y1 <= ex.height


def test_pdf_ma_hoa_bi_tu_choi(tmp_path: Path):
    doc = fitz.open()
    doc.new_page()
    p = tmp_path / "enc.pdf"
    doc.save(str(p), encryption=fitz.PDF_ENCRYPT_AES_256, user_pw="x", owner_pw="y")
    with pytest.raises(ValueError, match="pdf_encrypted"):
        open_pdf(p.read_bytes())
