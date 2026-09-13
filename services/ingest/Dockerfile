# services/ingest — chạy trên Railway (hoặc bất kỳ nơi nào có Docker).
FROM python:3.11-slim

# Tesseract + model vie/eng cho PDF scan (PyMuPDF gọi qua libtesseract).
RUN apt-get update && apt-get install -y --no-install-recommends \
      tesseract-ocr tesseract-ocr-vie tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app

ENV PYTHONUTF8=1 PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
