# ADR-0001 — Mô hình chi phí LLM

Trạng thái: **đã chốt** · Ngày: 2026-09-12 · Thay thế: không

## 1. Vấn đề

App gọi LLM cho ba tính năng. Ai trả tiền cho những lời gọi đó, và tiền đi qua đường nào?
Ba lựa chọn: backend tự trả, BYOK (người dùng nhập khoá riêng), hoặc lai.

## 2. Quyết định

**Backend tự trả, có định tuyến nhiều model và hạn mức cứng ở server. Không BYOK ở v1.**

## 3. Vì sao không BYOK

- Người dùng mục tiêu là sinh viên, không phải lập trình viên. Bắt lấy khoá API là dựng một
  bức tường ngay trước ô chuyển đổi quan trọng nhất.
- Dữ liệu cho thấy paywall cứng chuyển đổi tốt hơn freemium khoảng 5 lần. BYOK là hình thái
  cực đoan nhất của freemium: người dùng không bao giờ chạm vào quyết định trả tiền.
- App chỉ là vỏ bọc quanh khoá của người dùng dễ bị soi theo Guideline 4.2 (chức năng tối thiểu)
   — đúng nhóm bị từ chối hàng loạt trong 2026.
- Không cầm được chi phí thì không đo được biên lợi nhuận, mà biên lợi nhuận là thứ quyết định
  app này có phải một việc kinh doanh hay chỉ là đồ án.

## 4. Kiến trúc chi phí

Mọi lời gọi đi qua Supabase Edge Function. Không có khoá nhà cung cấp nào nằm trong bundle app.

**Định tuyến theo việc, không theo tầng giá:**

| Việc | Loại model | Lý do |
|---|---|---|
| Embedding | Model embedding rẻ nhất đạt chất lượng | Chạy một lần cho mỗi tài liệu |
| Rerank | Cross-encoder nhỏ | Chạy trên 20 đoạn, cực rẻ |
| Trả lời hỏi đáp | Model nhanh tầm trung | Đây là 80% lưu lượng |
| Kiểm chứng | Model rẻ, gọi **batch một lượt** cho mọi mệnh đề | Tuyệt đối không gọi lẻ từng câu |
| Sinh quiz | Model mạnh hơn, chạy **một lần rồi lưu** | Chất lượng câu hỏi quyết định giá trị cảm nhận |
| Chấm tự luận | Model mạnh nhất | Lưu lượng thấp, kỳ vọng cao |

**Sáu chốt chặn chi phí, làm từ đầu chứ không vá sau:**

1. Cache embedding theo `sha256` file — tài liệu trùng không xử lý lại lần hai.
2. Cache câu trả lời theo `hash(tài liệu + câu hỏi chuẩn hoá + ngôn ngữ)`.
3. Quiz sinh một lần, lưu vào DB, ôn bao nhiêu lần cũng không gọi lại LLM.
4. Hạn mức đếm ở Postgres, kiểm **trước** khi gọi model. Không bao giờ tin client.
5. Ghi `tokens_in`, `tokens_out`, `cost_usd` cho từng lời gọi vào `usage_costs`. Không đo thì
   không biết mình lỗ ở đâu.
6. Ngắt mạch: vượt trần chi phí ngày thì hạ xuống model rẻ hơn kèm thông báo trung thực,
   thay vì chặn cứng người đang trả tiền.

**Trần kỹ thuật:** ngữ cảnh tối đa 6 đoạn cho mỗi câu hỏi; câu trả lời tối đa 700 token;
tài liệu tối đa 500 trang; kiểm chứng tối đa 12 mệnh đề mỗi câu trả lời.

## 5. Gói và hạn mức khởi điểm

| | Miễn phí | Pro |
|---|---|---|
| Tài liệu | 1, tối đa 80 trang | 50, mỗi tài liệu 500 trang |
| Câu hỏi | 20 / tháng | 500 / tháng |
| Quiz | 1 bộ | Không giới hạn thực tế |
| Chấm tự luận | 1 bài | 60 / tháng |

Paywall cứng ngay sau onboarding, kèm **dùng thử dài**: dữ liệu benchmark cho thấy thời gian
dùng thử trên 17 ngày chuyển đổi tốt hơn khoảng 70% so với dùng thử ngắn, trong khi xu hướng
chung của thị trường đang rút ngắn xuống 3 ngày. Đi ngược xu hướng đó là có cơ sở. Bắt đầu
với 21 ngày, đo, rồi mới chỉnh.

Giá khởi điểm: gói năm là gói được đẩy mạnh — nhóm Health & Fitness và Education cho thấy
gói năm chiếm tỉ trọng cao nhất trong các tuỳ chọn hiển thị trên paywall. Có gói trọn đời
để thu tiền mặt sớm ở thị trường Việt Nam, nơi tỉ lệ mua trọn đời cao hơn các vùng khác.
Định giá theo vùng: giá Việt Nam thấp hơn đáng kể giá Mỹ, RevenueCat xử lý phần này.

**Mục tiêu:** biên lợi nhuận gộp ≥ 70% ở gói năm. Kiểm lại ở cổng G6 bằng số liệu thật,
không bằng ước tính.

## 6. Khi nào mở BYOK

Sau v1, và chỉ như một lối thoát cho người dùng nặng: người đã trả tiền, muốn dùng khoá riêng
để vượt hạn mức. Không bao giờ là con đường vào của người dùng mới.

## 7. Rủi ro đã biết

- **Người dùng nặng ăn hết biên lợi nhuận.** Giảm nhẹ bằng hạn mức tháng + ngắt mạch ngày.
- **Giá model đổi.** Vì đã tách định tuyến theo việc nên đổi nhà cung cấp cho một việc là
  sửa một chỗ. Đừng để prompt phụ thuộc vào đặc tính riêng của một model.
- **Yêu cầu công bố của Apple.** Phải nêu tên mô hình bên thứ ba nhận dữ liệu cá nhân và lấy
  đồng ý tường minh. Đổi nhà cung cấp là phải cập nhật màn hình đồng ý — ghi thành một mục
  trong quy trình phát hành.
- **App AI có churn cao hơn khoảng 30%.** Đối trọng duy nhất là phần chạy offline: flashcard
  và lịch ôn tập tạo lý do mở app hằng ngày mà không tốn một token nào.
