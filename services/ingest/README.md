# services/ingest

FastAPI + PyMuPDF: nhận PDF → trang (PNG 1600px) + chunk có toạ độ + embedding → Supabase.

```
POST /documents?title=<tuỳ chọn>   body: PDF thô (Content-Type: application/pdf)   Authorization: Bearer <JWT người dùng>
GET  /health
```

Trạng thái `documents.status`: `pending → parsing → embedding → ready | failed(error)`. App theo dõi qua PostgREST.

## Chạy local (Windows)

```
python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt
bash scripts/get-tessdata.sh            # OCR vie/eng vào ./tessdata (Tesseract cài qua winget UB-Mannheim.TesseractOCR)
cp ../../.env.example .env             # điền SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LLM_PROVIDER_API_KEY
PYTHONUTF8=1 .venv/Scripts/python -m uvicorn app.main:app --port 8000
```

Chưa có khoá Gemini: đặt `EMBEDDING_PROVIDER=fake` để chạy pipeline (vector giả, không đo chất lượng được).

Test: `PYTHONUTF8=1 .venv/Scripts/python -m pytest` (chunking thuần + PDF/OCR trên fixture từ `scripts/make_fixtures.py`).
Smoke end-to-end trên Supabase local: `bash scripts/smoke.sh tests/fixtures/*.pdf`.

## Quy ước

- bbox lưu theo pixel của ảnh trang đã render (`pages.width × height`), chunk không vắt qua trang.
- Hạn mức tầng kiểm ở đây (`config.py`), không tin client.
- Cùng `sha256` đã `ready` ở bất kỳ ai → tái dùng chunk + embedding, chỉ render lại ảnh trang cho chủ mới.
