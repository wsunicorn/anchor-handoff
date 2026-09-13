"""Cấu hình từ biến môi trường. Xem ../.env.example ở gốc repo cho tên biến phía server."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=SERVICE_DIR / ".env", extra="ignore")

    supabase_url: str
    supabase_service_role_key: str

    # Nhà cung cấp LLM/embedding duy nhất ở v1: Google Gemini (ADR-0001, màn đồng ý G1.9).
    llm_provider_api_key: str = ""
    # "gemini" (thật) | "fake" (vector tất định từ hash — CHỈ dev/CI khi chưa có khoá, không đo chất lượng được).
    embedding_provider: str = "gemini"
    embedding_model: str = "gemini-embedding-001"
    embedding_dim: int = 768
    # USD cho mỗi 1M token đầu vào — chỉ để ghi usage_costs, không dùng để chặn.
    embedding_price_per_m_usd: float = 0.15

    # OCR: PyMuPDF gọi Tesseract; local Windows cần đường dẫn tessdata riêng (không ghi được Program Files).
    tessdata_prefix: str = str(SERVICE_DIR / "tessdata")
    ocr_languages: str = "vie+eng"
    ocr_dpi: int = 300
    # Trang có ít hơn ngần này ký tự chữ thì coi là trang scan → OCR.
    scan_min_chars: int = 20

    page_render_width: int = 1600
    chunk_target_tokens: int = 700
    chunk_overlap_ratio: float = 0.15

    # Hạn mức theo tầng (ADR-0001 §5). Kiểm ở đây, không tin client (G1.10).
    free_max_documents: int = 1
    free_max_pages: int = 80
    pro_max_documents: int = 50
    pro_max_pages: int = 500

    storage_bucket: str = "documents"
    # Lưu lại chi tiết lỗi vào documents.error — chỉ thông điệp ngắn, không stack trace.
    log_level: str = "INFO"


settings = Settings()  # type: ignore[call-arg]


def limits_for(tier: str) -> tuple[int, int]:
    """(số tài liệu tối đa, số trang tối đa mỗi tài liệu) theo tầng."""
    if tier == "pro":
        return settings.pro_max_documents, settings.pro_max_pages
    return settings.free_max_documents, settings.free_max_pages
