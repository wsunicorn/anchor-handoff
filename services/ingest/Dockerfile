# services/ingest — chạy trên Railway (hoặc bất kỳ nơi nào có Docker).
FROM python:3.11-slim

# Tesseract cho PDF scan (PyMuPDF gọi qua libtesseract). Model lấy từ tessdata_best:
# chính xác dấu tiếng Việt hơn hẳn gói apt/fast; OCR chỉ chạy một lần mỗi tài liệu.
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /srv/tessdata \
    && for l in vie eng osd; do \
         curl -fsSL -o /srv/tessdata/$l.traineddata \
           https://github.com/tesseract-ocr/tessdata_best/raw/main/$l.traineddata; \
       done
ENV TESSDATA_PREFIX=/srv/tessdata

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app

ENV PYTHONUTF8=1 PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
