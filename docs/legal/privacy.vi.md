# Chính sách riêng tư — Anchor

*Cập nhật: 18/09/2026. Bản tiếng Anh: privacy.en.md. Khi hai bản khác nhau, bản tiếng Việt là bản chính với người dùng tại Việt Nam.*

Anchor là ứng dụng học tập: bạn nạp tài liệu (PDF), hỏi đáp có trích dẫn, ôn tập bằng thẻ và nhận phản hồi cho bài tự luận. Tài liệu là của bạn. Chính sách này nói rõ dữ liệu nào được xử lý, ở đâu, và bạn kiểm soát ra sao.

## 1. Dữ liệu chúng tôi lưu

| Dữ liệu | Mục đích | Nơi lưu |
|---|---|---|
| Địa chỉ email | Đăng nhập bằng mã một lần (không mật khẩu) | Supabase (Singapore) |
| Tài liệu bạn nạp: file gốc, ảnh trang, văn bản trích và vector nhúng | Hỏi đáp, sinh quiz, chấm bài — chỉ trên tài liệu của bạn | Supabase Storage + Postgres, cách ly theo tài khoản (RLS) |
| Câu hỏi, câu trả lời, kết quả kiểm chứng | Hiển thị lại lịch sử; đo chất lượng trích dẫn | Supabase |
| Thẻ ôn tập, lịch lặp lại | Ôn tập offline và đồng bộ giữa máy | Máy của bạn (SQLite) + Supabase |
| Bài tự luận và nhận xét | Xem lại phản hồi | Supabase |
| Số token và chi phí ước tính mỗi lời gọi AI | Hạn mức, chống lạm dụng, tính giá | Supabase |
| Mã giả danh (SHA-256 của mã tài khoản) và sự kiện dùng app (mở tài liệu, hỏi, ôn) | Sửa lỗi, đo phễu | Sentry, PostHog (Hoa Kỳ) — **không** kèm email hay nội dung tài liệu |

Chúng tôi không thu vị trí, danh bạ, ảnh ngoài ảnh bạn chủ động chụp bài viết tay, và không hiển thị quảng cáo.

## 2. Bên thứ ba nhận dữ liệu và khi nào

- **Google (Gemini API)** — nhận **văn bản tài liệu** và **câu hỏi/bài viết** của bạn để trả lời, sinh quiz, chấm bài, chuyển ảnh chữ viết tay thành văn bản. Chỉ sau khi bạn bấm **Đồng ý** ở màn hình "Trước khi dùng tính năng AI"; bạn tắt được bất cứ lúc nào trong tab **Tôi** — từ đó không có dữ liệu nào rời khỏi máy. Theo điều khoản API trả phí của Google, dữ liệu gửi qua API không dùng để huấn luyện mô hình.
- **Supabase** — cơ sở dữ liệu, lưu trữ file và xác thực; máy chủ tại Singapore.
- **Sentry** (báo lỗi) và **PostHog** (phân tích) — chỉ mã giả danh và sự kiện; không có nội dung tài liệu.
- **RevenueCat** cùng **Google Play / Apple App Store** — xử lý thanh toán; chúng tôi không thấy số thẻ.
- **Brevo** — gửi email mã đăng nhập.

## 3. Quyền của bạn

- **Xem và xoá tài liệu** bất cứ lúc nào trong Thư viện.
- **Xoá tài khoản** trong tab **Tôi → Xoá tài khoản**: mọi dữ liệu ở mục 1 bị xoá ngay; bản sao lưu hệ thống tự xoá trong 30 ngày. Không có nút khôi phục.
- **Tắt tính năng AI** trong tab Tôi.
- Yêu cầu khác (xuất dữ liệu, khiếu nại): email privacy@anchor.app. Trả lời trong 7 ngày.

## 4. Trẻ em

Anchor dành cho người từ 13 tuổi. Nếu bạn biết một trẻ dưới 13 tuổi đã tạo tài khoản, báo cho chúng tôi để xoá.

## 5. Thay đổi

Khi đổi nhà cung cấp AI hoặc thêm dữ liệu thu thập, chúng tôi cập nhật màn hình đồng ý trong app và ngày ở đầu trang này.
