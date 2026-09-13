# Tài liệu thật dùng kiểm cổng G1

PDF không commit (bản quyền bên thứ ba, dung lượng). Tải lại bằng `bash docs/samples/fetch.sh`.

| File | Loại | Nguồn |
|---|---|---|
| `vi_decuong_ctu.pdf` | PDF text tiếng Việt, 8 trang | https://se.ctu.edu.vn/images/upload/daotao/decuong/SP095.pdf |
| `vi_decuong_hcmute.pdf` | PDF text tiếng Việt, 10 trang | https://hcmute.edu.vn/Resources/Docs/SubDomain/fas/Decuongmonhoc/132TC/V%E1%BA%ADt%20l%C3%BD%201.pdf |
| `vi_baibao_vjol.pdf` | Bài báo tiếng Việt, 3 trang | https://vjol.info.vn/index.php/tctbgd/article/download/95003/80274/ |
| `en_attention.pdf` | Bài báo tiếng Anh 2 cột, 15 trang | https://arxiv.org/pdf/1706.03762 |
| `slides_mit.pdf` | Slide ngang, 16 trang (MIT OCW, CC BY-NC-SA) | https://ocw.mit.edu/courses/3-205-thermodynamics-and-kinetics-of-materials-fall-2006/d6fd4e0d7f52dd71563f89514645b830_lecture05_slides.pdf |
| `vi_scan.pdf` | Sách scan tiếng Việt (12 trang cắt từ bản 310 trang, không có lớp chữ) | https://archive.org/details/hethonglienketvanbantiengviet |

Kết quả 2026-09-13 (Supabase local, `EMBEDDING_PROVIDER=fake`): cả 6 `ready`, lang vi/en đúng,
chunk ≤ ~700 token có bbox; scan OCR bằng tessdata_best. Highlight kiểm trên emulator với
`en_attention.pdf` trang 3 (`docs/shots/G1-real-arxiv-highlight.png`).
