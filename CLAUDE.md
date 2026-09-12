# CLAUDE.md — đọc file này đầu tiên ở mỗi phiên

## Quy trình mỗi phiên

1. Đọc `CLAUDE.md` (file này) → `TASKS.md` → mục liên quan trong `docs/SPEC.md`.
2. Tìm **cổng đang mở** ở đầu `TASKS.md`. Chỉ làm task chưa tick **trong cổng đó**.
   Không nhảy sang cổng sau, kể cả khi task ở đó có vẻ dễ hơn.
3. Làm xong một task: tick ô, ghi một dòng vào `## Nhật ký` cuối `TASKS.md`
   (ngày — task — file đã đổi — điều bất ngờ gặp phải).
4. Trước khi đóng cổng: chạy đúng lệnh ghi ở "Tiêu chí thoát" của cổng đó.
   Fail thì dừng, báo lại, **không tự nới tiêu chí**.
5. Cuối phiên: cập nhật dòng "Cổng hiện tại" ở đầu `TASKS.md`.
6. **Task có giao diện: đọc `docs/DEVICE-LOOP.md` trước khi tick.** Chưa có ảnh chụp
   từ emulator/máy thật thì task chưa xong.

Nếu một task hoá ra cần quyết định sản phẩm chưa có trong `SPEC.md`: dừng, viết câu hỏi
vào `## Câu hỏi chờ trả lời` cuối `TASKS.md`, chuyển sang task khác trong cùng cổng.
Không tự quyết định thay.

## Bối cảnh người làm

Một người làm, song song khoá luận và thực tập — quỹ thời gian thật khoảng 10–15 giờ/tuần.
Dev trên **Windows**, test chính trên **Android thật**, chỉ mượn được **iPhone từng đợt ngắn**.
Hệ quả bắt buộc:

- Mọi thứ phải chạy và kiểm được trên Android trước. iOS-only để cuối mỗi cổng.
- Không dựng hạ tầng cần trông coi hằng ngày.
- Ưu tiên giải pháp ít bậc tự do hơn là giải pháp "đúng chuẩn" nhưng tốn 3 ngày dựng.

## Bốn quy tắc không được vi phạm

1. **Không bao giờ để khoá API của nhà cung cấp LLM trong app.** Mọi lời gọi đi qua
   Supabase Edge Function. Vi phạm điều này là lỗi bảo mật, không phải lựa chọn kiến trúc.
2. **Không hiển thị câu do mô hình sinh ra mà chưa qua lớp kiểm chứng.** Đường đi duy nhất
   ra UI là `verify()` (SPEC §6). Không có đường tắt "tạm thời bỏ qua để test UI" —
   dùng fixture thay vì tắt kiểm chứng.
3. **Không chép nội dung tài liệu người dùng sang bên thứ ba ngoài luồng đã khai báo.**
   Apple yêu cầu nêu rõ danh tính mô hình bên thứ ba nhận dữ liệu cá nhân và phải có
   đồng ý tường minh trước khi gửi. Màn hình đồng ý này làm ở cổng G1, không phải lúc nộp app.
4. **Không tuyên bố y tế, học thuật hay điểm số tuyệt đối.** Chấm tự luận là "phản hồi
   tham khảo theo rubric", không phải điểm chính thức.

## Quy ước code

- TypeScript `strict: true`. Không `any`, không `@ts-ignore` nếu chưa hỏi.
- Import theo alias `@/…`, cấu hình sẵn ở `tsconfig.json`.
- Component: function component + hook. Không class.
- Tổ chức theo **feature**, không theo loại file. Logic dùng chung mới lên `src/lib`.
- Màu, khoảng cách, cỡ chữ: **chỉ lấy từ token** trong `src/theme`. Không viết hex rời
  trong component. Vi phạm token là lỗi review, xem `docs/DESIGN.md`.
- Chuỗi hiển thị: **không hardcode**. Mọi chuỗi qua `t('…')`, khai báo ở `src/lib/i18n/{vi,en}.ts`.
  Thêm chuỗi mà thiếu một trong hai ngôn ngữ → CI fail.
- Edge Function: một việc một file, có schema đầu vào bằng `zod`, trả lỗi dạng
  `{ code, message }` chứ không ném chuỗi thô.
- Migration Postgres: một file một thay đổi, đặt tên `NNNN_mo_ta.sql`, không sửa file cũ.

## Kiểm thử

- Logic thuần (SRS, chunking, tính điểm tin cậy): unit test bắt buộc, Vitest.
- Luồng người dùng chính: một test Maestro cho mỗi cổng từ G2 trở đi.
- Chất lượng RAG: `pnpm eval:gate`, ngưỡng ở `SPEC §7`. Đây là cổng chặn thật, không phải
  chỉ số tham khảo.

## Khi bị kẹt

Thử tối đa **hai** hướng cho một lỗi. Hướng thứ ba thì dừng, ghi vào `## Câu hỏi chờ trả lời`
kèm: điều đã thử, thông báo lỗi nguyên văn, giả thuyết hiện tại. Không refactor lan rộng
để né lỗi.

## Những thứ đã chốt, không mở lại

- React Native + Expo (không Flutter, không native riêng).
- Supabase (không tự dựng Postgres).
- Chi phí LLM theo `docs/ADR-0001`. Muốn đổi thì viết ADR mới, không sửa ADR cũ.
- Song ngữ Việt–Anh ngay từ v1, không để "i18n sau".
