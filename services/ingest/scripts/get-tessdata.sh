#!/usr/bin/env bash
# Tải model OCR (tessdata_fast) vào ./tessdata cho dev local. Docker dùng gói apt thay thế.
set -euo pipefail
cd "$(dirname "$0")/../tessdata"
for lang in vie eng osd; do
  [ -f "$lang.traineddata" ] || curl -fsSL -o "$lang.traineddata" "https://github.com/tesseract-ocr/tessdata_fast/raw/main/$lang.traineddata"
done
ls -la
