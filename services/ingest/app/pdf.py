"""Đọc PDF bằng PyMuPDF: trích dòng chữ kèm toạ độ, phát hiện trang scan → OCR, render ảnh trang.

Quy ước toạ độ (SPEC §5, migration 0001): bbox lưu theo **pixel của ảnh trang đã render**
(`pages.width` × `pages.height`). Client chỉ cần nhân theo tỉ lệ hiển thị, không cần biết
kích thước gốc của trang PDF.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import fitz  # PyMuPDF

from app.chunking import Line

log = logging.getLogger(__name__)


@dataclass
class PageExtract:
    page_no: int  # 1-based
    width: int  # pixel ảnh đã render
    height: int
    lines: list[Line]  # bbox theo pixel ảnh
    ocr: bool  # trang này lấy chữ bằng OCR


def open_pdf(data: bytes) -> fitz.Document:
    doc = fitz.open(stream=data, filetype="pdf")
    if doc.needs_pass:
        raise ValueError("pdf_encrypted")
    if doc.page_count == 0:
        raise ValueError("pdf_empty")
    return doc


def _zoom_for(page: fitz.Page, target_width: int) -> float:
    # page.rect đã tính xoay trang; ảnh render sẽ có cùng tỉ lệ.
    return target_width / page.rect.width


def render_page_png(page: fitz.Page, target_width: int) -> tuple[bytes, int, int]:
    zoom = _zoom_for(page, target_width)
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    return pix.tobytes("png"), pix.width, pix.height


def _lines_from_textpage(page: fitz.Page, textpage: fitz.TextPage | None, zoom: float) -> list[Line]:
    """Chuyển cấu trúc dict của PyMuPDF (block → line → span) thành Line theo pixel ảnh."""
    data = page.get_text("dict", textpage=textpage)
    # Toạ độ trích xuất thuộc hệ trang chưa xoay; nhân rotation_matrix để khớp với ảnh render.
    rot = page.rotation_matrix
    lines: list[Line] = []
    for block_no, block in enumerate(data.get("blocks", [])):
        if block.get("type") != 0:  # 1 = ảnh
            continue
        for line in block.get("lines", []):
            text = "".join(span.get("text", "") for span in line.get("spans", []))
            # Một số font/OCR trả NBSP hoặc tab thay dấu cách; chuẩn về một dấu cách để so khớp được.
            text = " ".join(text.split())
            if not text:
                continue
            rect = fitz.Rect(line["bbox"]) * rot
            bbox = (
                round(rect.x0 * zoom, 1),
                round(rect.y0 * zoom, 1),
                round(rect.x1 * zoom, 1),
                round(rect.y1 * zoom, 1),
            )
            lines.append(Line(text, bbox, block_no))
    return lines


def _looks_scanned(page: fitz.Page, min_chars: int) -> bool:
    """Trang gần như không có chữ trích được nhưng có ảnh → coi là scan."""
    chars = len(page.get_text("text").strip())
    if chars >= min_chars:
        return False
    return len(page.get_images(full=False)) > 0 or chars == 0


def extract_page(
    page: fitz.Page,
    *,
    render_width: int,
    scan_min_chars: int,
    ocr_languages: str,
    ocr_dpi: int,
    tessdata: str | None,
) -> tuple[PageExtract, bytes]:
    """Trả về (dữ liệu trang, PNG đã render). OCR chỉ khi trang là scan."""
    zoom = _zoom_for(page, render_width)
    png, width, height = render_page_png(page, render_width)

    ocr = _looks_scanned(page, scan_min_chars)
    textpage: fitz.TextPage | None = None
    if ocr:
        # full=True: OCR toàn trang như ảnh (không chỉ vùng ảnh) — đúng cho PDF scan.
        textpage = page.get_textpage_ocr(
            language=ocr_languages, dpi=ocr_dpi, full=True, tessdata=tessdata
        )
    lines = _lines_from_textpage(page, textpage, zoom)
    return PageExtract(page.number + 1, width, height, lines, ocr), png
