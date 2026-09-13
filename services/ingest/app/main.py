"""services/ingest — nhận PDF từ app, xử lý thành trang + chunk + embedding trong Supabase.

Xác thực: `Authorization: Bearer <JWT của người dùng>` (kiểm qua GoTrue). Mọi ghi vào DB/Storage
dùng service role ở đây; client không bao giờ có quyền ghi chunks.

Lỗi trả dạng `{code, message}` (CLAUDE.md quy ước Edge Function — áp dụng cho service này luôn).
"""

from __future__ import annotations

import logging

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.config import settings
from app.pipeline import LimitError, accept_upload, process_document
from app.supa import supabase

logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("ingest")

app = FastAPI(title="anchor-ingest", docs_url=None, redoc_url=None)

MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # khớp file_size_limit của bucket


def _error(status: int, code: str, message: str, **extra: object) -> JSONResponse:
    return JSONResponse(status_code=status, content={"code": code, "message": message, **extra})


async def current_user(authorization: str = Header(default="")) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, {"code": "unauthorized", "message": "Thiếu token đăng nhập."})
    try:
        return await supabase.user_from_jwt(authorization.removeprefix("Bearer ").strip())
    except PermissionError:
        raise HTTPException(401, {"code": "unauthorized", "message": "Token không hợp lệ hoặc đã hết hạn."})


@app.exception_handler(HTTPException)
async def http_exception_handler(_, exc: HTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "error", "message": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content=detail)


class IngestResponse(BaseModel):
    document_id: str
    status: str
    page_count: int
    reused: bool


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "embedding_model": settings.embedding_model}


@app.post("/documents", response_model=IngestResponse)
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(""),
    user: dict = Depends(current_user),
):
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        return _error(415, "unsupported_type", "Hiện chỉ nhận PDF.")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        return _error(413, "file_too_large", "File lớn hơn 100 MB.")
    if not data.startswith(b"%PDF"):
        return _error(415, "unsupported_type", "File này không phải PDF.")

    try:
        accepted = await accept_upload(user["id"], title or (file.filename or "").removesuffix(".pdf"), data)
    except LimitError as e:
        return _error(403, e.code, "Vượt hạn mức của gói hiện tại.", limit=e.limit)
    except ValueError as e:
        code = str(e)
        message = {
            "pdf_encrypted": "PDF có mật khẩu. Gỡ mật khẩu rồi nạp lại.",
            "pdf_empty": "PDF không có trang nào.",
        }.get(code, "Không đọc được file PDF này.")
        return _error(422, code, message)

    if not accepted.reused:
        background.add_task(process_document, accepted.document_id, user["id"], data)
    return IngestResponse(**accepted.__dict__)


@app.on_event("shutdown")
async def _shutdown() -> None:
    await supabase.aclose()
