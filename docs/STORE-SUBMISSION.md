# Hồ sơ nộp cửa hàng (G7.7–G7.8)

Tài liệu nội bộ: mọi thứ cần có sẵn **trước** khi bấm "Submit" trên App Store Connect / Play Console, và
câu trả lời soạn sẵn cho các yêu cầu bổ sung thông tin thường gặp của Apple. Nguồn sự thật về dữ liệu là
`docs/legal/privacy.{vi,en}.md`; file này chỉ ánh xạ sang biểu mẫu của hai cửa hàng. Cập nhật cả ba khi đổi
nhà cung cấp hay thu thêm dữ liệu.

## 1. Bên thứ ba nhận dữ liệu

| Dịch vụ | Nhận gì | Khi nào | Vùng | Hợp đồng xử lý |
|---|---|---|---|---|
| **Google Gemini API** (`generativelanguage.googleapis.com`) | Văn bản trang tài liệu, câu hỏi, bài luận, ảnh bài viết tay | Chỉ sau khi người dùng bấm *Đồng ý và tiếp tục* ở màn "Trước khi dùng tính năng AI" (`app/consent.tsx`, lưu `profiles.ai_consent_at`); rút lại ở tab Tôi | Google (Mỹ) | Gemini API Additional Terms — gói trả phí không dùng dữ liệu để huấn luyện |
| **Supabase** | Email, tài liệu (file gốc, ảnh trang, văn bản, embedding), lịch sử hỏi đáp, thẻ ôn, bài luận, số token/chi phí | Từ lúc đăng ký | Singapore (`ap-southeast-1`) | DPA chuẩn của Supabase |
| **Brevo** (SMTP) | Địa chỉ email + mã đăng nhập 6 số | Mỗi lần đăng nhập | EU | DPA của Brevo |
| **RevenueCat** | `app_user_id` = uuid Supabase, biên lai của Google Play / App Store | Khi mở paywall / mua | Mỹ | DPA của RevenueCat |
| **Sentry** | Id giả danh (SHA-256 uuid), stack trace, model máy, phiên bản app | Khi app lỗi | Mỹ | DPA của Sentry |
| **PostHog** | Id giả danh, sự kiện sản phẩm (mở tài liệu, hỏi, ôn) — không nội dung | Luôn (không có công tắc riêng — xem mục 5) | Mỹ | DPA của PostHog |
| **Railway** (dịch vụ ingest — TASKS #6, chưa deploy) | File PDF tạm trong lúc xử lý; xoá sau khi ghi vào Supabase | Khi nạp tài liệu | Singapore | DPA của Railway |

Không có SDK quảng cáo, không SDK mạng xã hội, không ATT (không tracking chéo app).

## 2. App Store Connect — App Privacy (câu trả lời)

**Collects data: Yes.** Tất cả *linked to user* trừ mục ghi rõ; không mục nào *used for tracking*.

| Loại | Thu | Mục đích | Liên kết danh tính |
|---|---|---|---|
| Contact Info → Email Address | Có | App Functionality (đăng nhập) | Có |
| User Content → Other User Content (tài liệu, câu hỏi, bài luận, ảnh bài viết tay) | Có | App Functionality | Có |
| User Content → Photos or Videos | Có (chỉ ảnh người dùng chụp bài viết tay) | App Functionality | Có |
| Identifiers → User ID | Có | App Functionality, Analytics | Có |
| Purchases → Purchase History | Có (qua RevenueCat) | App Functionality | Có |
| Usage Data → Product Interaction | Có | Analytics | **Không** (id giả danh) |
| Diagnostics → Crash Data, Performance Data | Có | App Functionality | **Không** |
| Location, Contacts, Health, Financial Info, Browsing/Search History, Sensitive Info | Không | — | — |

Ghi chú khi Apple hỏi "Search History": câu hỏi người dùng gõ được lưu để hiện lịch sử — đã khai ở *Other User Content*, không phải Search History theo định nghĩa của Apple (tìm kiếm trong app).

## 3. Google Play — Data safety (câu trả lời)

- Thu thập và chia sẻ dữ liệu: **Có**. Mã hoá khi truyền: **Có** (TLS). Cho phép yêu cầu xoá: **Có** (trong app: Tôi → Xoá tài khoản; hoặc email privacy@).
- Personal info → Email address: thu, bắt buộc, mục đích *App functionality, Account management*.
- Personal info → User IDs: thu, *Analytics, App functionality*.
- Photos and videos → Photos: thu (tuỳ chọn), *App functionality*; **chia sẻ** với Google Gemini để chuyển chữ.
- Files and docs: thu (tuỳ chọn), *App functionality*; **chia sẻ** với Google Gemini (văn bản trích) — chỉ sau đồng ý.
- Messages → Other in-app messages: câu hỏi/bài luận, *App functionality*; chia sẻ với Google Gemini.
- App activity → App interactions: thu, *Analytics*. Crash logs, Diagnostics: thu, *Analytics*.
- Financial info → Purchase history: thu qua RevenueCat, *App functionality*.
- Không: Location, Contacts, Calendar, Health, Device IDs (không dùng Advertising ID), Web browsing.

## 4. Ghi chú cho người review (dán vào "Notes" / "App access")

```
Anchor lets students import their own PDFs and study them: questions answered with
verified citations, spaced-repetition review (works offline), rubric-based essay feedback.

Demo account (magic-code sign-in): review@anchor.app — the 6-digit code is fixed to 000000
for this account on the production project.  [TODO trước khi nộp: tạo user + cấu hình mã cố định
trong Supabase Auth ("Test OTP" trong Auth → Providers → Email), điền vào đây]

Suggested path (about 2 minutes):
1. Sign in → accept the AI-consent screen (this is the explicit consent before any text is sent
   to Google Gemini; it can be revoked in the Me tab).
2. Library already contains 2 documents. Open "Attention Is All You Need" → Ask →
   type "What is d_model in the base model?" → the answer shows a green anchor bar
   (verified against the document) and a "Page 3" link that opens the highlighted passage.
3. Reader → Quiz → Generate → Start; then turn on Airplane Mode and keep reviewing — the
   session works offline and syncs when back online.
4. Me → Privacy policy / Terms; Me → Delete account (deletes all data immediately).

Native integrations (Guideline 4.2): "Open in Anchor" from Files/Mail for PDFs (Android intent
VIEW; iOS Share Extension), camera capture of handwritten essays.
Payments: subscriptions via StoreKit/Play Billing through RevenueCat; a 21-day trial needs no
card. Restore purchases is on the paywall.
AI disclosure: essay feedback is labelled "reference only, not an official grade" (Guideline 1.4.1 /
5.1.1). Model provider: Google Gemini, disclosed on the consent screen and in the privacy policy.
```

## 5. Câu hỏi bổ sung Apple hay gửi — trả lời sẵn

- **"Does the app share user data with third parties? Which?"** → Bảng mục 1. Nhấn mạnh: chỉ Gemini
  nhận nội dung, sau đồng ý tường minh, có nút rút lại; các bên còn lại chỉ nhận id giả danh hoặc email.
- **"Where is the consent obtained?"** → Ảnh màn `app/consent.tsx` (lấy từ `docs/shots/` hoặc chụp lại);
  ghi rõ tên nhà cung cấp và loại dữ liệu ngay trên màn.
- **"Why does the app need the camera?"** → Chụp bài viết tay để chuyển thành chữ và nhận phản hồi;
  chuỗi xin quyền: `app.json` → `expo-image-picker.cameraPermission`. Không truy cập thư viện ảnh ngầm.
- **Guideline 4.2 (Minimum functionality)** → Share Extension / intent VIEW, camera, offline SQLite + FSRS,
  hoạt động không mạng; không phải "web wrapper".
- **Guideline 3.1.1 (IAP)** → Mọi quyền lợi số mua qua StoreKit; không link ra ngoài để mua; giá hiện
  từ StoreKit qua RevenueCat; có Restore.
- **Guideline 5.1.1(v) (Account deletion)** → Tôi → Xoá tài khoản → hộp thoại xác nhận → Edge Function
  `delete-account` xoá Storage + cascade Postgres + auth user; không cần liên hệ hỗ trợ.
- **Guideline 1.2 (UGC)** → Nội dung chỉ người tạo thấy được (RLS theo tài khoản), không có chia sẻ
  công khai → không cần cơ chế báo cáo/chặn.
- **Analytics không có opt-out riêng (PostHog)** → nếu Apple/Play hỏi: dữ liệu giả danh, không nội dung,
  không tracking chéo app; nếu bị yêu cầu, thêm công tắc ở tab Tôi (một cột `profiles.analytics_opt_out`).

## 6. Video quay màn hình

`bash scripts/store-video.sh <lang>` quay trên emulator/máy thật theo đúng đường đi ở mục 4 (Maestro
`.maestro/store/video.yaml`), xuất `docs/store/video-<lang>.mp4`. App Store preview cần 1080×1920 hoặc
886×1920 (iPhone 6,5"), 15–30 s → cắt bằng `ffmpeg -ss … -t 30`. Play Console nhận link YouTube, không giới hạn.

## 7. Bộ ảnh cửa hàng

- Chụp thô: `bash scripts/store-shots.sh vi` rồi `en` (bản release, đã đăng nhập eval, dữ liệu mẫu có tên
  đẹp — không dùng `slides_mit`/`perf_200p`).
- Ghép khung + tiêu đề: `PYTHONUTF8=1 python scripts/store-frame.py` → `docs/store/out/<lang>/` 1080×1920.
- iPhone 6,7" (1290×2796) và iPad: chụp lại trên máy mượn, chạy `store-frame.py --size=1290x2796`.
- Thứ tự và tiêu đề: `docs/store/copy.json` — ảnh 2–3 nêu bật lớp trích dẫn (yêu cầu G7.7).

## 8. Việc còn thiếu trước khi nộp

| Việc | Chờ |
|---|---|
| URL công khai chính sách/điều khoản (domain thật) + hộp thư privacy@/support@ | TASKS #11 |
| Tài khoản demo với mã OTP cố định trên hosted | làm khi tạo bản nộp (mục 4) |
| Deploy ingest (Railway) — không có thì nạp tài liệu trên hosted không chạy | TASKS #6 |
| Sản phẩm IAP trên Play/App Store + RevenueCat offerings | TASKS #9 |
| `SENTRY_AUTH_TOKEN` để bản nộp có sourcemap | TASKS #13 |
| Ảnh iPhone/iPad, kiểm VoiceOver, Share Extension iOS | đợt mượn iPhone |
