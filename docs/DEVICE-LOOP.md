# DEVICE-LOOP.md — vòng lặp kiểm trên thiết bị

Đọc file này trước khi tick bất kỳ task nào có giao diện. Code chạy không lỗi **không phải**
tiêu chí hoàn thành cho task UI; tiêu chí là nhìn đúng trên thiết bị.

## 1. Công cụ

`mobile-mcp` đã khai báo ở `.mcp.json`. Nó điều khiển emulator/thiết bị qua accessibility
tree, và chỉ rơi về screenshot kèm toạ độ khi cần.

Trước mỗi phiên có việc UI: xác nhận có thiết bị (`adb devices` thấy dòng `device`), rồi
chọn thiết bị qua MCP. Không có thiết bị thì **dừng**, ghi vào `TASKS.md` mục Câu hỏi chờ
trả lời — đừng tick task UI dựa trên suy đoán.

## 2. Chọn đúng công cụ cho đúng câu hỏi

| Câu hỏi | Dùng |
|---|---|
| Nút có tồn tại, nhãn đúng chưa, thứ tự đọc ra sao | accessibility snapshot |
| Luồng có đi đúng màn hình kế tiếp không | snapshot + tap |
| Vùng chạm có đủ 44pt không | snapshot (đọc kích thước) |
| Màu, khoảng cách, dấu tiếng Việt, highlight rơi đúng vùng chưa | **screenshot** |
| Hoạt ảnh mở trích dẫn | quay màn hình |

Mặc định dùng snapshot vì rẻ và xác định. Chỉ chụp ảnh khi câu hỏi thật sự là câu hỏi thị giác.
Không chụp ảnh ba lần liên tiếp cho cùng một màn hình — mỗi ảnh là một lần tốn token đáng kể.

## 3. Quy trình bắt buộc cho task UI

1. Build và chạy app trên thiết bị.
2. Điều hướng tới màn hình vừa làm bằng MCP, không mô tả bằng lời.
3. Lấy bằng chứng: snapshot, hoặc screenshot nếu là câu hỏi thị giác.
4. Đối chiếu với `docs/DESIGN.md` — token màu, thang chữ, lưới 4pt, quy tắc thanh neo.
5. Sai thì sửa, chạy lại từ bước 2. Đúng thì tick task và ghi vào Nhật ký: đã kiểm gì,
   bằng cách nào.

Lưu ảnh vào `docs/shots/<task-id>-<mô-tả>.png`. Thêm `docs/shots/` vào `.gitignore`
(ảnh là bằng chứng tạm thời, không phải tài sản repo).

## 4. Danh sách kiểm cho từng cổng

**G0.3 — font.** Chụp một màn hình có cả tiếng Việt và tiếng Anh, ở mọi weight sẽ dùng
(400/500/600). Kiểm dấu ở chữ hoa có dấu (Ố, Ằ, Ễ) không bị cắt hoặc chạm chân dòng trên.
Đây là lỗi phổ biến nhất của font sans trong app tiếng Việt và nó chỉ lộ ra khi nhìn.

**G1.7–G1.8 — Reader và highlight.** Bắt buộc screenshot. Mở một trích dẫn đã biết trước
đáp án, chụp, kiểm vệt highlight có trùm đúng dòng văn bản không — lệch nửa dòng là hỏng
tính năng lõi. Kiểm trên ít nhất hai tài liệu có kích thước trang khác nhau, vì lỗi hay nằm
ở phép quy đổi toạ độ chứ không ở code vẽ.

**G2.6 — thanh neo.** Screenshot: màu thanh khớp nhãn kiểm chứng, độ dày 2pt, khoảng cách
12pt, gạch chỉ trang nằm đúng cuối thanh.

**G3.4 — từ chối.** Hỏi một câu tài liệu không trả lời được. Chụp. Trên màn hình chỉ được
có dòng từ chối và gợi ý phần gần nhất — nếu còn bất kỳ câu phỏng đoán nào ở dưới, đó là lỗi
chặn phát hành, không phải lỗi giao diện.

**G4.6–G4.7 — ôn tập offline.** Tắt mạng emulator bằng MCP, ôn 30 thẻ, bật lại, chụp màn hình
tiến độ. Kiểm không mất và không nhân đôi thẻ.

**G7.3 — tiếp cận.** Chạy snapshot trên từng màn hình chính: mọi phần tử chạm được đều phải
có nhãn đọc được, không có nhãn rỗng, không có nhãn kiểu "button-2".

## 5. An toàn

- Chỉ chạy trên **emulator hoặc máy phụ dùng tài khoản test**. Không gắn agent có quyền tap
  vào điện thoại chính đang đăng nhập tài khoản thật.
- Không để agent thao tác vào app ngân hàng, email hay cửa hàng ứng dụng trên thiết bị đó.
- Thử mua sandbox ở G6: dùng tài khoản tester riêng, không dùng tài khoản cá nhân.

## 6. iOS

Không có máy ảo iOS trên Windows. Cho tới khi mượn được iPhone hoặc dựng được đường EAS
Build → TestFlight, **mọi kết luận về giao diện iOS đều là suy đoán**. Ghi rõ điều đó khi
tick task, đừng viết "đã kiểm trên cả hai nền tảng".
