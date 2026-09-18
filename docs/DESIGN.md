# DESIGN.md

## 1. Hướng thiết kế

Thế giới của sản phẩm là **trang giấy có lề và bút**: giáo trình, mực, dấu highlight, ghi chú
bên lề. Giao diện chia làm hai lớp và hai lớp này không được lẫn vào nhau:

- **Lớp tài liệu** — chữ của người dùng. Serif, giãn dòng rộng, nền sáng, không trang trí.
- **Lớp máy** — chữ do mô hình sinh. Sans, đặc hơn, luôn có **thanh neo** bên trái.

Người dùng phải nhìn một giây là biết câu nào của giáo trình, câu nào của máy. Đây vừa là
lựa chọn thẩm mỹ vừa là yêu cầu sản phẩm.

**Chỗ duy nhất được phép nổi bật** là vệt highlight trên trang khi trích dẫn được mở.
Mọi thứ còn lại giữ im lặng.

## 2. Token màu

Chỉ dùng qua `src/theme/tokens.ts`. Không hex rời trong component.

### Sáng

| Tên | Hex | Dùng cho |
|---|---|---|
| `ink` | `#17233B` | Chữ chính, mực xanh đen |
| `ink-muted` | `#5A6880` | Chữ phụ, nhãn |
| `paper` | `#F4F6F8` | Nền màn hình |
| `surface` | `#FFFFFF` | Thẻ, sheet, ảnh trang |
| `rule` | `#C9D2DC` | Đường kẻ, viền, lề |
| `verified` | `#1F6B4F` | Nhãn có căn cứ |
| `inferred` | `#8F5B00` | Nhãn suy luận (đổi 2026-09-18 từ #A66A00 để đạt AA 4,5:1 trên paper) |
| `unsupported` | `#9B2F45` | Nhãn không có trong tài liệu, lỗi |
| `highlighter` | `#F6E96B` | Vệt highlight, luôn ở alpha 35% |

### Tối

`ink` → `#E7ECF3`, `paper` → `#0F1622`, `surface` → `#16202E`, `rule` → `#2C3A4D`,
ba màu nhãn nâng sáng: `#3F9E77`, `#D4941F`, `#DC6E88` (đổi 2026-09-18 từ #D4607A, AA trên surface tối). Highlighter giữ nguyên sắc, hạ
alpha xuống 28%.

Ba màu nhãn **chỉ** dùng cho trạng thái kiểm chứng. Không dùng xanh `verified` cho nút
"Lưu" hay nút bất kỳ — màu đó phải giữ nghĩa duy nhất.

## 3. Chữ

Hai họ, vai trò tách bạch:

- **Source Serif 4** — nội dung tài liệu và văn bản trả lời. Có dấu tiếng Việt đầy đủ.
- **Be Vietnam Pro** — mọi thành phần giao diện. Được thiết kế cho tiếng Việt, dấu không
  chạm lên chân chữ dòng trên ở cỡ nhỏ — lý do chọn nó thay vì font sans mặc định.

| Vai | Font | Cỡ / giãn dòng | Weight |
|---|---|---|---|
| Tiêu đề màn hình | Be Vietnam Pro | 28 / 34 | 600 |
| Tiêu đề mục | Be Vietnam Pro | 20 / 28 | 600 |
| Nội dung tài liệu | Source Serif 4 | 17 / 28 | 400 |
| Văn bản trả lời | Source Serif 4 | 16 / 26 | 400 |
| Giao diện | Be Vietnam Pro | 15 / 22 | 400–500 |
| Nhãn phụ | Be Vietnam Pro | 13 / 18 | 500 |

Không dùng chữ in hoa toàn bộ cho nhãn. Không tô một từ khác màu trong tiêu đề. Độ dài
dòng đọc giữ dưới 70 ký tự.

## 4. Thanh neo — dấu hiệu nhận dạng của app

Mỗi khối văn bản do máy sinh có một thanh dọc dày 2pt, cao bằng khối, cách chữ 12pt,
màu theo nhãn kiểm chứng. Ở cuối thanh là một gạch ngang nhỏ 8pt chỉ về phía số trang.
Chạm vào thanh mở bảng giải thích mức tin cậy; chạm vào số trang nhảy tới trang.

Đây là thứ thay cho mọi biểu tượng "AI" thường thấy. Không dùng icon tia sét, không dùng
ngôi sao lấp lánh, không gradient tím.

```
│ Định luật này phát biểu rằng…
│ …giữ nguyên khi hệ kín.
├─ tr. 84
```

## 5. Bố cục

- Lưới 4pt. Lề ngang màn hình 20pt. Khoảng cách giữa các khối 16pt.
- Bo góc: 12pt cho thẻ, 20pt cho sheet, **0pt cho ảnh trang tài liệu** (trang giấy không bo góc).
- Đổ bóng: chỉ một chỗ duy nhất là bottom sheet. Phần còn lại phân tách bằng `rule`, không bằng bóng.
- Điều hướng: thanh dưới ba mục — Thư viện, Ôn tập, Tôi. Màn hình Hỏi đáp mở từ trong tài liệu,
  không phải một tab, vì hỏi đáp luôn thuộc về một tài liệu cụ thể.

## 6. Chuyển động

Một khoảnh khắc được dàn dựng, phần còn lại tĩnh:

**Mở trích dẫn** — câu trả lời trượt lên và mờ đi (180ms), ảnh trang dâng lên từ dưới
(260ms, easing out), vệt highlight nở ra từ giữa vùng trích dẫn (200ms, trễ 120ms), kèm
một nhịp haptic nhẹ. Đó là toàn bộ phần "phô diễn" của app.

Còn lại chỉ dùng chuyển động trả lời thao tác: lật thẻ, mở sheet, đổi trạng thái nút.
Không có hiệu ứng trượt-mờ cho từng section khi vào màn hình. Tôn trọng "giảm chuyển động"
của hệ điều hành: thay mọi chuyển động bằng mờ dần 100ms.

## 7. Viết trong giao diện

- Câu lệnh nói đúng việc sẽ xảy ra: "Thêm tài liệu", không phải "Bắt đầu".
- Một hành động giữ một tên xuyên suốt: nút "Nạp tài liệu" → thông báo "Đã nạp tài liệu".
- Màn hình rỗng là lời mời làm việc: *"Chưa có tài liệu nào. Thêm một PDF để bắt đầu hỏi."*
- Báo lỗi nói chuyện gì và làm gì tiếp: *"File này không đọc được chữ. Thử bản scan rõ hơn,
  hoặc bật nhận dạng ký tự."* Không xin lỗi, không nói chung chung.
- Khi không có căn cứ: *"Tài liệu của bạn không nói điều này."* Không vòng vo, không kèm
  câu trả lời phỏng đoán ở dưới.

## 8. Sàn chất lượng

Vùng chạm ≥ 44pt. Tương phản đạt AA ở cả hai chế độ màu. Có tiêu điểm bàn phím thấy được.
Hoạt động với cỡ chữ hệ thống lớn nhất mà không vỡ bố cục. Toàn bộ luồng hỏi đáp đọc được
bằng trình đọc màn hình.
