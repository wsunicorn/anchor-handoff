#!/usr/bin/env bash
# Tải lại bộ tài liệu thật cho kiểm G1 (xem README.md cùng thư mục).
set -euo pipefail
cd "$(dirname "$0")"
UA="Mozilla/5.0"
curl -sL -A "$UA" -o vi_decuong_ctu.pdf "https://se.ctu.edu.vn/images/upload/daotao/decuong/SP095.pdf"
curl -sL -A "$UA" -o vi_decuong_hcmute.pdf "https://hcmute.edu.vn/Resources/Docs/SubDomain/fas/Decuongmonhoc/132TC/V%E1%BA%ADt%20l%C3%BD%201.pdf"
curl -sL -A "$UA" -o vi_baibao_vjol.pdf "https://vjol.info.vn/index.php/tctbgd/article/download/95003/80274/"
curl -sL -A "$UA" -o en_attention.pdf "https://arxiv.org/pdf/1706.03762"
curl -sL -A "$UA" -o slides_mit.pdf "https://ocw.mit.edu/courses/3-205-thermodynamics-and-kinetics-of-materials-fall-2006/d6fd4e0d7f52dd71563f89514645b830_lecture05_slides.pdf"
curl -sL -A "$UA" -o vi_scan_full.pdf "https://archive.org/download/hethonglienketvanbantiengviet/H%E1%BB%87%20th%E1%BB%91ng%20li%C3%AAn%20k%E1%BA%BFt%20v%C4%83n%20b%E1%BA%A3n%20ti%E1%BA%BFng%20Vi%E1%BB%87t%20-%20Tr%E1%BA%A7n%20Ng%E1%BB%8Dc%20Th%C3%AAm.pdf"
# 12 trang nội dung từ sách scan (bỏ bìa), dùng venv của services/ingest
PYTHONUTF8=1 ../../services/ingest/.venv/Scripts/python - <<'PY'
import fitz
d = fitz.open("vi_scan_full.pdf"); d.select(list(range(8, 20))); d.save("vi_scan.pdf", garbage=3, deflate=True)
PY
rm -f vi_scan_full.pdf
ls -la *.pdf
