#!/usr/bin/env bash
# Tải model OCR tessdata_best (chính xác nhất; chậm hơn fast ~4x nhưng OCR chỉ chạy một lần mỗi tài liệu).
set -euo pipefail
cd "$(dirname "$0")/../tessdata"
for lang in vie eng osd; do
  [ -f "$lang.traineddata" ] || curl -fsSL -o "$lang.traineddata" "https://github.com/tesseract-ocr/tessdata_best/raw/main/$lang.traineddata"
done
ls -la
