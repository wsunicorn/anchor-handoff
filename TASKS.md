# TASKS.md

> **Cổng hiện tại: G2** — cập nhật dòng này ở cuối mỗi phiên. (G0 đóng 2026-09-13; G1 đóng 2026-09-13 trên stack local — xem ghi chú.)
> Quy tắc: chỉ làm task trong cổng hiện tại. Đóng cổng bằng "Tiêu chí thoát", không phải bằng cảm giác xong.

Ước lượng dưới đây tính theo ~12 giờ/tuần. Tổng khoảng 13 tuần đến khi nộp store.

---

## G0 — Nền móng (tuần 1)

- [x] G0.1 Khởi tạo Expo + TypeScript strict + Expo Router + alias `@/`
- [x] G0.2 Cài NativeWind v4, nạp token từ `docs/DESIGN.md` vào `src/theme/tokens.ts` và `tailwind.config.js`
- [x] G0.3 Nạp font Be Vietnam Pro + Source Serif 4, kiểm tra dấu tiếng Việt ở mọi weight sẽ dùng
- [x] G0.4 Dựng i18n (`i18next` + `expo-localization`), viết script `check-i18n` phát hiện khoá thiếu một ngôn ngữ
- [x] G0.5 Tạo dự án Supabase, bật `pgvector`, migration `0001_init.sql` theo SPEC §4 — *hosted `hxwyavivnlypdxgquovz` (Singapore)*
- [x] G0.6 Auth: email magic link + Sign in with Apple (bắt buộc nếu có đăng nhập mạng xã hội) — *v1 không có social login nên chưa cần Apple; xem câu hỏi #2*
- [x] G0.7 Bật RLS cho mọi bảng, viết test khẳng định user A không đọc được tài liệu của user B
- [x] G0.8 Sentry + PostHog, gắn `user_id` giả danh (không gắn email) — *DSN + key thật, event thử đã bắn*
- [x] G0.9 GitHub Actions: typecheck + lint + unit test + `check-i18n` — *CI xanh trên GitHub (check + rls)*

**Tiêu chí thoát G0:** `pnpm typecheck && pnpm test && pnpm check-i18n` xanh trên CI; build dev client chạy được trên máy Android thật; test RLS chứng minh cách ly dữ liệu giữa hai tài khoản.

---

## G1 — Nạp tài liệu và đọc (tuần 2–3)

- [x] G1.1 Dựng `services/ingest` FastAPI: nhận PDF → PyMuPDF trích text theo block kèm `(page, x0, y0, x1, y1)`
- [x] G1.2 Render mỗi trang thành PNG ~1600px, đẩy lên Supabase Storage
- [x] G1.3 Phát hiện PDF scan (text rỗng) → chạy OCR (Tesseract `vie+eng`), giữ nguyên toạ độ
- [x] G1.4 Chunking theo SPEC §5: cửa sổ ~700 token, chồng lấn 15%, không cắt giữa câu, mỗi chunk giữ danh sách bbox
- [x] G1.5 Sinh embedding, ghi vào `chunks` với chỉ mục HNSW; cache theo `sha256` file — file trùng không xử lý lại
- [x] G1.6 Màn hình Thư viện: chọn file (`expo-document-picker`), theo dõi tiến trình nạp, trạng thái lỗi rõ ràng
- [x] G1.7 Màn hình Đọc: xem ảnh trang, cuộn mượt bằng FlashList, zoom bằng gesture
- [x] G1.8 Vẽ lớp phủ highlight từ bbox lên ảnh trang (đây là nền để trích dẫn nhảy đúng chỗ ở G2)
- [x] G1.9 Màn hình đồng ý AI: nêu rõ mô hình bên thứ ba nào nhận dữ liệu, dữ liệu gì, cách tắt. Chặn mọi lời gọi LLM cho tới khi người dùng đồng ý
- [x] G1.10 Giới hạn nạp: 1 tài liệu, tối đa 80 trang cho người chưa trả tiền (kiểm ở server, không kiểm ở client)

**Tiêu chí thoát G1:** nạp 5 tài liệu thật (2 PDF text tiếng Việt, 1 slide, 1 PDF scan, 1 tiếng Anh) — cả 5 ra chunk có toạ độ; chạm vào một chunk bất kỳ thì Reader nhảy đúng trang và highlight đúng vùng; lời gọi LLM bị chặn khi chưa đồng ý.

---

## G2 — Hỏi đáp có trích dẫn (tuần 4–5)

- [x] G2.1 Edge Function `ask`: nhận `{document_id, question, lang}`, trả stream
- [x] G2.2 Truy hồi lai: BM25 (`tsvector`, cấu hình `simple` cho tiếng Việt) + vector, hợp nhất bằng RRF
- [ ] G2.3 Rerank top 20 → 6 bằng cross-encoder rẻ hoặc model nhỏ; đo lại chất lượng trước/sau — *đã cài (Gemini flash-lite listwise, cờ `RERANK=off` để so); phần đo chờ key + bộ vàng*
- [x] G2.4 Prompt trả lời: bắt buộc mọi câu khẳng định kèm mã chunk `[c3]`; cấm dùng kiến thức ngoài tài liệu; trả lời theo ngôn ngữ giao diện dù tài liệu khác ngôn ngữ
- [x] G2.5 Parser chuyển `[c3]` thành đối tượng trích dẫn có `page` + `bbox`
- [x] G2.6 UI trả lời: thanh neo dọc bên trái mỗi đoạn (DESIGN §4), chạm trích dẫn → mở Reader đúng trang, highlight
- [x] G2.7 Cache câu trả lời theo `hash(document_id + câu hỏi chuẩn hoá + lang)`
- [x] G2.8 Hạn mức theo tầng, đếm ở server, trả lỗi `quota_exceeded` có cấu trúc
- [x] G2.9 Dựng `eval/golden.jsonl`: 100 cặp hỏi–đáp (50 vi, 50 en) từ tài liệu thật, trong đó **20 câu tài liệu không trả lời được** (bẫy bịa)
- [x] G2.10 Script `pnpm eval:rag` in ra: recall@6, citation precision, tỉ lệ câu không có căn cứ, tỉ lệ từ chối đúng — *script xong, chạy thật cần Gemini key (#5)*

**Tiêu chí thoát G2:** trên bộ vàng — recall@6 ≥ 0.85; citation precision ≥ 0.90; với 20 câu bẫy, tỉ lệ từ chối đúng ≥ 0.80. Chưa đạt thì ở lại G2, chỉnh truy hồi trước, chỉnh prompt sau.

---

## G3 — Lớp kiểm chứng (tuần 6)

Đây là phần khác biệt của sản phẩm. Không rút gọn.

- [x] G3.1 Tách câu trả lời thành mệnh đề; mỗi mệnh đề gắn với chunk nó trích dẫn
- [ ] G3.2 Kiểm tra kéo theo (entailment) từng mệnh đề với chunk đã trích, bằng model rẻ chạy batch một lượt — *đã cài (flash-lite, 1 lời gọi ≤12 mệnh đề); chạy thật chờ key #5*
- [x] G3.3 Quy đổi thành ba mức: **Có căn cứ / Suy luận / Không có trong tài liệu**
- [x] G3.4 Mệnh đề mức 3: không hiển thị như câu trả lời, thay bằng dòng "Tài liệu của bạn không nói điều này" kèm gợi ý phần gần nhất
- [x] G3.5 Thanh neo đổi màu theo mức; chạm vào thanh mở bảng giải thích vì sao ở mức đó
- [x] G3.6 Ghi mỗi lượt verify vào bảng `verifications` để đo trôi chất lượng theo thời gian
- [ ] G3.7 `pnpm eval:gate` trả mã lỗi khác 0 khi vượt ngưỡng SPEC §7; cắm vào CI — *`eval:gate` có; job CI `rag-gate` chờ key + secrets*

**Tiêu chí thoát G3:** tỉ lệ mệnh đề không có căn cứ mà vẫn lọt ra UI ≤ 3% trên bộ vàng; `eval:gate` chạy trong CI và thực sự chặn được một commit cố tình làm hỏng prompt (thử một lần để chứng minh cổng hoạt động).

---

## G4 — Ôn tập chủ động (tuần 7–8)

- [ ] G4.1 Edge Function `generate-quiz`: sinh câu hỏi theo chương/khoảng trang, mỗi câu kèm trích dẫn nguồn và lời giải thích
- [ ] G4.2 Bộ lọc chất lượng: loại câu mơ hồ, câu có đáp án nằm ngay trong đề, câu trùng ý
- [ ] G4.3 Sinh một lần, lưu lại, dùng lại — không gọi LLM mỗi lần người dùng ôn
- [ ] G4.4 Lược đồ SQLite cục bộ + Drizzle; đồng bộ hai chiều với Supabase khi có mạng
- [ ] G4.5 Cài FSRS cho lịch lặp lại ngắt quãng; unit test cho bộ lập lịch
- [ ] G4.6 Màn hình ôn: một thẻ một màn, cử chỉ vuốt, haptic khi chấm, hoạt ảnh lật thẻ
- [ ] G4.7 Chế độ offline hoàn toàn cho phần ôn tập (máy bay vẫn học được)
- [ ] G4.8 Màn hình tiến độ: số thẻ đến hạn, chuỗi ngày, độ phủ theo chương

**Tiêu chí thoát G4:** bật chế độ máy bay, ôn trọn 30 thẻ, bật mạng lại, dữ liệu đồng bộ không mất và không nhân đôi; sinh quiz cho một chương 20 trang cho ra ≥ 15 câu đạt bộ lọc.

---

## G5 — Chấm tự luận (tuần 9)

- [ ] G5.1 Nhập bài: gõ tay hoặc chụp ảnh bài viết tay → OCR
- [ ] G5.2 Rubric mặc định 4 tiêu chí (đúng nội dung / đủ ý / lập luận / diễn đạt), cho phép người dùng sửa trọng số
- [ ] G5.3 Edge Function `grade-essay`: chấm theo rubric, mỗi nhận xét phải trích dẫn về tài liệu nguồn
- [ ] G5.4 Chạy nhận xét qua đúng lớp kiểm chứng của G3
- [ ] G5.5 UI kết quả: nhận xét neo vào từng đoạn của bài viết, không phải một khối văn bản dài
- [ ] G5.6 Ghi rõ trong UI: phản hồi tham khảo, không phải điểm chính thức

**Tiêu chí thoát G5:** chấm 10 bài thật, 10/10 nhận xét đều có trích dẫn hợp lệ về tài liệu; không nhận xét nào bị lớp kiểm chứng đánh mức 3 mà vẫn hiển thị.

---

## G6 — Kiếm tiền và tiết giảm chi phí (tuần 10)

- [ ] G6.1 Tích hợp RevenueCat, ba gói: tháng / năm / trọn đời
- [ ] G6.2 Paywall cứng sau onboarding, kèm dùng thử dài (xem ADR-0001 §5)
- [ ] G6.3 Hạn mức và định tuyến model theo tầng, áp ở Edge Function
- [ ] G6.4 Bảng `usage_costs`: ghi token và chi phí ước tính mỗi lời gọi, theo `user_id`
- [ ] G6.5 Dashboard nội bộ: chi phí trung bình mỗi người dùng hoạt động, biên lợi nhuận gộp theo tầng
- [ ] G6.6 Ngắt mạch: người dùng vượt trần chi phí ngày → hạ xuống model rẻ hơn thay vì chặn hẳn
- [ ] G6.7 Khôi phục mua hàng, xử lý lỗi thanh toán (đây là nguyên nhân lớn của huỷ trên Google Play)

**Tiêu chí thoát G6:** mua thử sandbox thành công trên cả Android và iOS; dashboard cho ra con số chi phí thật của 7 ngày dùng nội bộ; biên gộp ước tính ≥ 70% ở gói năm.

---

## G7 — Đánh bóng và chuẩn bị nộp (tuần 11–12)

- [ ] G7.1 Rà toàn bộ UI theo `docs/DESIGN.md`: không hex rời, không chuỗi hardcode
- [ ] G7.2 Trạng thái rỗng, trạng thái lỗi, trạng thái đang tải cho **mọi** màn hình
- [ ] G7.3 Tiếp cận: kích thước chạm ≥ 44pt, tương phản AA, tôn trọng "giảm chuyển động", VoiceOver/TalkBack cho luồng chính
- [ ] G7.4 Hiệu năng: mở tài liệu 200 trang không nghẽn, danh sách 500 thẻ cuộn 60fps
- [ ] G7.5 Chống rớt hạng theo Guideline 4.2: dùng ít nhất một tính năng nền tảng gốc trong 30 giây đầu (Share Extension nhận PDF từ app khác, Live Activity hiển thị tiến độ nạp, Shortcuts)
- [ ] G7.6 Chính sách riêng tư + điều khoản, có đường xoá tài khoản trong app
- [ ] G7.7 Bộ ảnh chụp màn hình cửa hàng, hai ngôn ngữ, nêu bật lớp trích dẫn
- [ ] G7.8 Video quay màn hình + danh sách dịch vụ bên thứ ba, chuẩn bị sẵn cho yêu cầu bổ sung thông tin của Apple
- [ ] G7.9 Đợt thử nghiệm khép kín 10–20 người thật, thu phản hồi có cấu trúc

**Tiêu chí thoát G7:** không lỗi P0 tồn đọng; 10 người thử dùng được mà không cần hướng dẫn miệng; toàn bộ tài liệu nộp store đã sẵn sàng.

---

## G8 — Phát hành (tuần 13)

- [ ] G8.1 Nộp TestFlight, xử lý phản hồi review
- [ ] G8.2 Nộp Google Play (thử nghiệm nội bộ → mở)
- [ ] G8.3 Bật phát hành theo giai đoạn, theo dõi crash 72 giờ đầu
- [ ] G8.4 Theo dõi phễu: cài → nạp tài liệu đầu tiên → câu hỏi đầu tiên → dùng thử → trả tiền
- [ ] G8.5 Chốt số liệu nền của tuần đầu để so sánh về sau

**Tiêu chí thoát G8:** app sống trên cả hai cửa hàng, crash-free ≥ 99%, phễu đã có số liệu.

---

## Sau v1 — chưa lên lịch

- BYOK cho người dùng nâng cao (xem ADR-0001 §6)
- Chia sẻ bộ thẻ giữa các bạn học
- Nhập từ Google Drive / Notion
- Tóm tắt chương dạng sơ đồ
- Web app dùng chung backend (41% app dẫn đầu có doanh thu qua web)

---

## Nhật ký

| Ngày | Task | File đổi | Ghi chú |
|---|---|---|---|
| 2026-09-12 | G0.0 | `.mcp.json`, `docs/DEVICE-LOOP.md`, `.gitignore` | Vòng lặp thiết bị chạy: mobile-mcp thấy AVD `anchor_pixel10_api37` (Android 17), ảnh `docs/shots/G0.0-loop-smoke.png`. Repo bị thừa một cấp `anchor/`, đã dời lên gốc. `git init` + remote `wsunicorn/anchor-handoff`, chưa commit. |
| 2026-09-12 | G0.1 | `package.json`, `app.json`, `tsconfig.json`, `pnpm-workspace.yaml`, `app/_layout.tsx`, `app/index.tsx`, `assets/` | Expo SDK 57 / RN 0.86 / TS 6, Expo Router + typed routes, `strict` + `noUncheckedIndexedAccess`, alias `@/*`→`src/*` (TS 6 bỏ `baseUrl`, dùng `paths` tương đối). Kiểm: `pnpm typecheck` xanh; dev client cài và chạy trên emulator, snapshot thấy đúng route `index`, ảnh `docs/shots/G0.1-expo-router-alias.png` — màu token đúng. **Bất ngờ 1:** `JAVA_HOME` của máy trỏ tới `…\Javain` thay vì gốc JDK → Gradle từ chối; phải export `JAVA_HOME=D:\StudyDocument\BigData\CK\setup\Java` (JDK 17) — cần sửa biến hệ thống. **Bất ngờ 2:** pnpm 12 không đọc `node-linker` từ `.npmrc`; symlink trong `node_modules` làm CMake/ninja trên Windows fail `build.ninja still dirty` ở `react-native-screens`/`worklets`. Sửa bằng `pnpm-workspace.yaml` → `nodeLinker: hoisted`, xoá `node_modules` + `android/` cài lại: build 3m36s. Package id tạm `com.anchor.app`, chốt lại trước G7. Màn `app/index.tsx` là placeholder hardcode chuỗi, thay ở G1.6 sau khi có i18n (G0.4). |
| 2026-09-12 | G0.2 | `tailwind.config.js`, `global.css`, `babel.config.js`, `metro.config.js`, `nativewind-env.d.ts`, `app/_layout.tsx`, `app/index.tsx`, `package.json` | NativeWind 4.2.6 + Tailwind 3.4.19 + Reanimated 4.5.1/Worklets 0.10.1 (bản `expo install` chọn cho SDK 57). `tokens.ts` đã khớp DESIGN.md nên không sửa; `tailwind.config.js` **nạp thẳng** `tokens.ts` qua `jiti` — không có hex nào trong config. Màu ra CSS variable, `darkMode: 'media'` + `@media (prefers-color-scheme: dark)` trong plugin `addBase` → component chỉ viết `bg-paper`, không cần `dark:`. Bảng màu Tailwind mặc định bị **thay** (không extend) để `bg-red-500` không tồn tại. Class thang chữ `text-screenTitle`… gồm cỡ+giãn dòng+weight; `border-l-rail`, `pl-rail-gap` cho thanh neo. Kiểm: snapshot lề 20pt và rail 2+12pt đúng pixel; ảnh `docs/shots/G0.2-nativewind-light.png` và `-dark.png` (bật Dark theme bằng `adb shell cmd uimode night yes`). **Bất ngờ:** Metro nền giữ khoá file → `pnpm add` "Access is denied", phải tắt Metro trước; đổi phiên bản worklets để lại `.cxx` cũ → ninja thiếu `libworklets.so`, phải xoá `node_modules/*/android/{build,.cxx}` rồi build lại. Màn placeholder chưa dùng safe-area (tiêu đề chạm status bar) — chấp nhận vì thay ở G1.6; font hệ thống vì G0.3 mới nạp font. |
| 2026-09-12 | G0.3 | `assets/fonts/*` (5 TTF + 2 OFL), `app.json` (plugin `expo-font`), `src/theme/tokens.ts` (`font.sans/serif`), `tailwind.config.js`, `app/index.tsx` | Nhúng font **native** qua plugin `expo-font` thay vì `useFonts` runtime: không nháy chữ khi mở app, và một `fontFamily` + `fontWeight` chọn đúng mặt chữ (Android: XML font-family + `ReactFontManager.addCustomFont`; iOS: tên họ trong TTF). Vì thế `font.sans/serif` trong tokens đổi thành tên họ thật `'Be Vietnam Pro'` / `'Source Serif 4'`. Chỉ nhúng weight sẽ dùng: BVP 400/500/600, SS4 400 + 400 Italic (~940 KB). Thang chữ đổi từ `text-<vai>` sang **`type-<vai>`** (gồm family+size+lineHeight+weight) vì RN không kế thừa font, và xoá hẳn `fontSize`/`fontWeight` mặc định của Tailwind → không tồn tại `text-lg`/`font-bold`. Kiểm: ảnh `docs/shots/G0.3-fonts-top.png` (28/20pt, weight 600) và `G0.3-fonts-serif.png` (17/16/15/13pt, weight 400/500, serif + italic): dấu chồng Ố/Ằ/Ễ không cắt, không chạm đuôi g/y dòng trên ở mọi vai. **Bất ngờ:** Source Serif 4 không lên lúc đầu — CSS `font-family: Source Serif 4` không hợp lệ vì `4` là số, NativeWind bỏ khai báo; phải quote tên họ trong tailwind config. iOS chưa kiểm (không có máy ảo trên Windows) — kết luận iOS là suy đoán, kiểm khi có iPhone. |
| 2026-09-12 | G0.4 | `src/lib/i18n/index.ts`, `src/lib/i18n/i18next.d.ts`, `scripts/check-i18n.ts`, `package.json`, `app.json` (plugin `expo-localization`), `app/_layout.tsx`, `app/index.tsx` | i18next 26 + react-i18next 17 + expo-localization. Ngôn ngữ khởi tạo theo máy (`vi` → vi, khác → en), `setAppLanguage()` để màn Cài đặt dùng sau (SPEC §8) — lưu lựa chọn để lại cho màn đó. **Khoá có kiểu** qua `CustomTypeOptions` lấy `vi.ts` làm chuẩn: `t('library.titel')` là lỗi TS (đã thử). `pnpm check-i18n` (chạy bằng `tsx`) so khoá hai chiều + chuỗi rỗng + **placeholder `{{…}}` lệch giữa hai bên**; đã chứng minh chặn: thêm khoá lẻ và đổi `{{page}}`→`{{pg}}` → exit 1 với 2 lỗi, hoàn lại → OK 25 khoá. Kiểm thiết bị bằng snapshot: locale en → "Library / 3 cards due"; đặt `cmd locale set-app-locales com.anchor.app --locales vi-VN` rồi khởi động lại → "Thư viện / 3 thẻ đến hạn". Không cần screenshot vì là câu hỏi văn bản, không phải thị giác. |
| 2026-09-12 | G0.5 (local) | `supabase/config.toml`, `package.json` (`db:start`, `db:reset`, devDep `supabase`), `.gitignore` | `supabase init` + `supabase start` (bỏ logflare/vector/imgproxy/supavisor/realtime cho nhẹ; giữ Studio, Auth, Mailpit cho magic link, Edge Runtime cho G2). Migration `0001_init.sql` chạy sạch: pgvector 0.8.2, pg_trgm, 12 bảng đều `relrowsecurity=t`, 12 policy, HNSW index `chunks_vec_idx`. Migration khớp SPEC §4 (thêm `ai_consent_at`, `error`, `unique(owner,sha256)` — hợp lý, không sửa). **Chưa xong:** project hosted cần `supabase login` bằng tài khoản của bạn → câu hỏi #1. Docker Desktop phải chạy trước `pnpm db:start`. |
| 2026-09-12 | G0.7 | `supabase/tests/rls.test.ts`, `scripts/test-rls.sh`, `vitest.config.mts`, `package.json` (`test`, `test:rls`) | Test RLS bằng Vitest + supabase-js gọi **PostgREST thật** với hai user tạo qua service role (đúng con đường app đi, không phải SQL nội bộ): B đọc 5 bảng → 0 dòng không lỗi; B truy id cụ thể → rỗng; B gọi `search_chunks` trên doc của A → rỗng; B insert doc đứng tên A / chunk vào doc A → `42501`; B update/delete doc A → 0 dòng, A vẫn nguyên; anon → rỗng. 12/12 xanh. **Chứng minh test cắn:** `alter table chunks disable row level security` → 4 test đỏ, bật lại → xanh. `pnpm test` trên CI tự skip test này khi thiếu env (không có Postgres); chạy thật bằng `pnpm test:rls` sau `pnpm db:start`. Cùng migration sẽ `db push` lên hosted nên kết luận giữ nguyên. |
| 2026-09-12 | G0.6 | `src/lib/supabase.ts`, `src/features/auth/session.ts`, `src/components/{Button,TextField}.tsx`, `app/_layout.tsx`, `app/(auth)/sign-in.tsx`, `app/auth/callback.tsx`, `app/index.tsx`, `src/lib/i18n/{vi,en}.ts` (+16 khoá `auth.*`), `supabase/migrations/0002_profiles_on_signup.sql`, `supabase/config.toml`, `supabase/templates/magic_link.html`, `.env.local`, `.env.example` | Magic link **PKCE** (`anchor://auth/callback?code=…` → `exchangeCodeForSession`) **kèm mã OTP 6 số trong cùng email** làm đường dự phòng (app email mở link sang trình duyệt rồi kẹt là chuyện thường). Session: AsyncStorage + Zustand; gate bằng `Stack.Protected`; giữ splash tới khi đọc xong session. Migration 0002: trigger tạo `profiles` khi có user, `locale` lấy từ metadata app gửi lúc đăng ký. Kiểm trên emulator (snapshot): gửi email → Mailpit nhận đúng subject; **đường OTP**: gõ mã → vào app, `profiles` có dòng `locale=en, tier=free`; **đường deep link**: đăng xuất, gửi lại, mở `anchor://auth/callback?code=…` (Location GoTrue trả về) → vào app; force-stop rồi mở lại → vẫn đăng nhập. Ảnh `docs/shots/G0.6-sign-in.png`. **Bất ngờ:** Chrome trên emulator sạch chặn bằng màn first-run nên không đi được trọn link qua trình duyệt — kiểm đoạn trình duyệt→app trên máy Android thật ở cuối G0. Local cần `adb reverse tcp:54321 tcp:54321`. Hosted: phải thêm `anchor://auth/callback` vào Redirect URLs và dán template magic link ở Dashboard (ghi trong config.toml). |
| 2026-09-12 | G0.8 | `src/lib/telemetry.ts`, `src/features/auth/session.ts`, `app/_layout.tsx`, `metro.config.js`, `app.json` (plugin `@sentry/react-native/expo`), `pnpm-workspace.yaml` (`allowBuilds`), `.env.example` | Sentry 7.11 + PostHog RN 4.70 + expo-crypto. Định danh = **SHA-256(`anchor:`+uuid)**: ổn định để đếm, không nối ngược về DB/email nếu chỉ có dashboard; `sendDefaultPii:false`, PostHog không autocapture, tắt geoip. Gắn ở `onAuthStateChange`, `reset()` khi đăng xuất, sự kiện `signed_in`. Thiếu key → cả hai SDK tắt hẳn. Kiểm trên emulator: đăng nhập → log `[telemetry] identify 79ce91ef… sentry=false posthog=false`; build native với Sentry OK. Org/project trong plugin là placeholder `anchor/anchor-mobile` — đổi khi có project thật; upload sourcemap chỉ khi có `SENTRY_AUTH_TOKEN`. **Bất ngờ:** pnpm 12 chặn postinstall → phải `allowBuilds` cho `@sentry/cli` và `esbuild` (runtime của tsx). Chưa thấy sự kiện trên dashboard vì chưa có key (câu hỏi #3). |
| 2026-09-12 | G0.9 | `.github/workflows/ci.yml`, `eslint.config.js`, `.prettierrc`, `package.json` (`lint`, `format`, `packageManager`, `engines`), `scripts/i18n-parity.ts` + `.test.ts`, `supabase/tests/rls.test.ts` | ESLint 9 + `eslint-config-expo` + prettier + simple-import-sort (ESLint 10 chưa tương thích eslint-plugin-react). Lint bắt được lỗi thật: `process.env['X']` không được Expo inline — đã đổi sang `process.env.X` ở supabase.ts/telemetry.ts. Tách logic check-i18n thành `i18n-parity.ts` có 5 unit test (để `pnpm test` có test thật). CI: Node 22, pnpm theo `packageManager`; **thêm job `rls`** chạy Supabase thật bằng `supabase/setup-cli` rồi `pnpm test:rls` — test bảo mật không chỉ tin máy dev; job `rag-gate` gắn `vars.RAG_GATE_ENABLED` vì `eval:gate` chỉ có ở G3.7 (không đổi ý nghĩa cổng, tránh đỏ 6 tuần). Local: `typecheck`, `lint`, `test` (5 pass, 12 RLS skip khi thiếu env), `check-i18n` đều xanh. Chưa có lần chạy CI thật vì repo chưa commit/push. |
| 2026-09-12 | G0.9 (CI) | `pnpm-workspace.yaml`, `.gitignore`, `expo-env.d.ts`, `.gitattributes` | Push lần đầu lên `wsunicorn/anchor-handoff`. Hai lỗi chỉ lộ trên CI: (1) pnpm với `CI=true` coi gói có postinstall chưa duyệt (`unrs-resolver`) là lỗi → khai `allowBuilds` đủ true/false; (2) `expo-env.d.ts` bị gitignore nên TS 6 không có khai báo module `*.css` → commit file này. Kết quả run `34701144666`: `check` ✓ 23s, `rls` ✓ 1m58s (Supabase thật trong CI, 12 test), `rag-gate` skip theo cờ. `.gitattributes` ép LF vì git máy dev bật autocrlf. |
| 2026-09-12 | G0.5 (hosted) | `supabase/config.toml` (`[remotes.production]`, bỏ khai báo pooler/storage.analytics/mfa/twilio), `.env.local` | Bạn tạo org + project `anchor` (Singapore), `supabase link`, `db push` áp 0001+0002 sạch. Auth config đẩy bằng `supabase config push` sau khi review `config diff`: chỉ 4 thuộc tính (redirect `anchor://auth/callback`, tắt confirm-email, OTP 6 số, site_url) — bỏ các khai báo template của `supabase init` khỏi config.toml để không ghi đè mặc định hosted; `[remotes.production]` giữ `max_frequency` 1 phút. **Bất ngờ:** free tier + SMTP mặc định **không cho sửa email template** → hosted hiện gửi template mặc định (chỉ link, không có mã OTP) → câu hỏi #4. Kiểm end-to-end với server thật: emulator gửi email → Gmail nhận "Your sign-in link" → mở deep link → vào app; `profiles` hosted có dòng `tier=free`. Chuyển `.env.local` sang hosted, giữ local trong comment. |
| 2026-09-13 | G0 (máy thật) + G0.8 | `app.json` (Sentry org `anchor-wsunicorn`/`anchor-mobile`), `package.json` (`expo-file-system` khai báo tường minh cho PostHog), `.env.local` (Sentry DSN), hosted: template magic link đã push sau khi bật Custom SMTP | Build arm64 cho OPPO CPH2651 (Android 16, ColorOS) 3m22s. **Ba bẫy ColorOS:** (1) `INSTALL_FAILED_VERIFICATION_FAILURE` → `adb shell settings put global verifier_verify_adb_installs 0` rồi `adb install` tay; (2) **mobile-mcp giết app**: `mobilecli.so` gắn JVMTI agent vào tiến trình debuggable → SIGSEGV trên Android 16 → trên máy này chỉ dùng `adb exec-out screencap` + `input tap/text`, KHÔNG gọi snapshot/screenshot của mobile-mcp vào app; (3) `uiautomator dump` bị chặn im lặng. App chạy trên máy thật: tiếng Việt theo máy, font đúng (`docs/shots/G0-device-1.png`). **Chưa xong:** gửi magic link từ máy thật thất bại — curl vào hosted trả `500 Error sending magic link email` → SMTP Brevo chưa hoạt động (câu hỏi #4 cập nhật). Tiêu chí "build dev client chạy được trên máy Android thật" đã đạt; luồng Gmail→app chờ SMTP. PostHog: key `phs_` là secret, cần `phc_` (câu hỏi #3). |
| 2026-09-13 | **Đóng G0** | `app/index.tsx`, `src/lib/telemetry.ts` (nút + `captureTestError` chỉ `__DEV__`), `.env.local` (PostHog `phc_`) | SMTP Brevo hoạt động sau khi sửa Username (`b910d1001@smtp-brevo.com`; trước đó ô này chứa chữ mẫu "login Brevo" → `535 5.7.8 Authentication failed`). Email vào Inbox Gmail, đúng template song ngữ + mã OTP. **Luồng thật trên OPPO:** app gửi → mở Gmail app → bấm link → trình duyệt → GoTrue → `anchor://auth/callback` → đăng nhập (`docs/shots/G0-device-4/5.png`). Telemetry: `sentry=true posthog=true` trên cả emulator lẫn máy thật, exception thử + event `telemetry_smoke_test` đã bắn (chờ bạn xác nhận trên dashboard). **Tiêu chí thoát G0 đủ:** CI xanh (check + rls), dev client chạy trên máy thật, RLS chứng minh. Việc để lại cho G7: (a) sender Gmail qua Brevo thiếu DKIM/DMARC → cần domain riêng trước beta; (b) supabase-js cảnh báo `WebCrypto API is not supported` → PKCE dùng `plain` thay vì S256 trên RN — cân nhắc polyfill `crypto.subtle` bằng expo-crypto; (c) Metro trên Windows đôi khi không thấy file đổi → reload app hoặc `expo start --clear`. |
| 2026-09-13 | G1.1–G1.5, G1.10 (server) | `services/ingest/**` (FastAPI, PyMuPDF, chunking, embeddings, pipeline, Dockerfile, tests), `supabase/migrations/0003_storage_documents.sql`, `.github/workflows/ci.yml` (job `ingest`) | **Quyết định:** app gọi thẳng service bằng JWT user (service xác minh qua GoTrue rồi ghi bằng service role) — không thêm Edge Function ở giữa; bbox lưu theo **pixel ảnh trang 1600px**, chunk không vắt qua trang; embedding **Gemini `gemini-embedding-001` @768** (multilingual, free tier dev); không dùng SDK `supabase` Python (bản yanked/hỏng) mà gọi REST bằng httpx. Chunking thuần có 8 unit test (NFC, tách câu giữ bbox nhiều dòng, ≤700 token không cắt giữa câu, chồng lấn ≤15%, ưu tiên ranh giới đoạn, câu quá dài cắt cứng). OCR: PyMuPDF + Tesseract `vie+eng`, tessdata tải vào `services/ingest/tessdata` (Program Files không ghi được); test scan tiếng Việt qua. Fixture sinh bằng `scripts/make_fixtures.py` (vi/en/slide/scan). Smoke local: 4 fixture → `ready`, lang vi/en đúng, 12 trang PNG lên Storage, 12 chunk vector 768; cùng sha256 ở user khác → **tái dùng chunk không gọi embedding**; free user nạp file thứ 2 → `403 document_limit`; nạp lại cùng file → `reused:true`; không token → 401. `EMBEDDING_PROVIDER=fake` cho dev/CI khi chưa có khoá Gemini (câu hỏi #5). Railway deploy chờ tài khoản (câu hỏi #6). |
| 2026-09-13 | G1.6–G1.10 (app) | `app/_layout.tsx` (QueryClient, GestureHandlerRootView, route tree), `app/(tabs)/{_layout,index,study,me}.tsx`, `app/consent.tsx`, `app/documents/[id]/{index,chunks}.tsx`, `src/features/{library,consent,reader}/api.ts`, `src/features/reader/PageView.tsx`, `src/lib/ingest.ts`, `src/lib/database.types.ts` (+`pnpm db:types`), `src/theme/useThemeColors.ts`, `supabase/tests/rls.test.ts` (+test Storage), i18n +41 khoá, `services/ingest` (consent server-side, body PDF thô) | Thanh tab 3 mục (DESIGN §5). Thư viện: TanStack Query poll 2s khi còn tài liệu đang xử lý, tiến độ "Đang đọc trang x/y" đếm từ bảng `pages`, lỗi dịch từ mã server. Đồng ý AI: mở **trước lần nạp đầu** (embedding gửi nội dung tới Gemini), server `403 consent_required` khi `ai_consent_at` rỗng; rút đồng ý ở tab Tôi. Reader: FlashList + `ResumableZoom` mỗi trang, ảnh qua signed URL 10 phút; highlight = View tuyệt đối theo bbox × (bề rộng màn / `pages.width`), nằm trong khối zoom nên phóng to vẫn trùng dòng. Màn "Xem theo đoạn" → `router.dismissTo` về Reader với `page`+`chunk`. Kiểm emulator: nạp vi_text qua picker → ready; chạm chunk trang 3 → "Page 3/3" + highlight trùm đúng 6 dòng (`docs/shots/G1.8-highlight.png`); free user nạp file 2 → câu "Gói miễn phí chỉ nạp được 1 tài liệu…"; scan.pdf qua app → OCR ready ~3s. **Bất ngờ:** (1) `FormData` toàn cục là của RN còn `fetch` là của Expo SDK 57 → phần file multipart hỏng (`Unsupported FormDataPart implementation`) → đổi sang gửi PDF thô làm body với `File` của expo-file-system; (2) dev-client nhiều lúc chạy bundle cũ dù Metro phục vụ code mới → `expo start --clear` là cách chắc; (3) nút Tools của dev client đè lên icon góc phải header — chỉ bản dev, test qua deep link. Zoom bằng pinch chưa kiểm được trên emulator (mobile-mcp không đa chạm) → kiểm trên OPPO ở cuối cổng. |
| 2026-09-13 | **Đóng G1** | `docs/samples/{README.md,fetch.sh}`, `services/ingest/{Dockerfile,scripts/get-tessdata.sh}` (tessdata_best), `app/documents/[id]/index.tsx` (`extraData`) | **Tiêu chí thoát:** 6 tài liệu thật công khai (2 đề cương vi, 1 bài báo vi, 1 arXiv en 2 cột, 1 slide MIT ngang, 1 sách scan vi thật cắt 12 trang) → cả 6 `ready`, chunk ≤704 token có bbox, lang đúng; chạm chunk → Reader nhảy đúng trang + highlight đúng vùng (fixture vi trang 3 và arXiv thật trang 3, ảnh `docs/shots/G1-real-arxiv-highlight.png`); LLM/embedding bị chặn khi chưa đồng ý (server `403 consent_required` + màn đồng ý trước lần nạp đầu). OCR chuyển sang **tessdata_best** (sửa đúng dấu "Do đâu/trở lại/nhiều" trên sách 1980s, ~4,6 s/trang, chấp nhận vì chạy nền một lần). **Bất ngờ:** FlashList memo hoá item → highlight tới sau khi trang vẽ không hiện, cần `extraData`; deep link qua `adb shell` phải quote vì `&` bị shell thiết bị nuốt. **Điều kiện còn treo, không thuộc tiêu chí thoát nhưng cần trước G2 thật:** embedding đang `fake` (chờ Gemini key #5), service chưa lên Railway (#6); zoom pinch chưa kiểm được trên emulator — kiểm trên OPPO khi tiện. OCR sách cũ dính chữ ("Đểtim", "sựphức") — ghi nhận cho G2 khi đo recall. |
| 2026-09-13 | G2.1–G2.2, G2.4–G2.8 (+G2.3 phần cài) | `supabase/migrations/0004_answer_cache_and_quota.sql`, `supabase/functions/{ask/index.ts,_shared/{prompts,citations,gemini,http}.ts}`, `_shared/citations.test.ts` (9 test), `src/lib/askClient.ts`, `src/features/ask/{types,fixtures,AnswerView}.ts(x)`, `app/documents/[id]/ask.tsx`, `scripts/ask-smoke.sh`, tsconfig/vitest alias `@shared/*`, i18n +6 | **Quyết định:** Edge Function `ask` trả SSE (`meta` → `delta`… → `done`/`error`); thứ tự consent → sở hữu → cache → hạn mức → embed → `search_chunks` (RRF có sẵn từ 0001) → rerank listwise `gemini-2.5-flash-lite` một lời gọi cho 20 đoạn (hệ Gemini không có API rerank riêng; parse hỏng thì giữ thứ tự RRF) → `gemini-2.5-flash` stream. Cache khoá `sha256(doc|câu hỏi chuẩn hoá NFC/lowercase/bỏ dấu câu|lang)`, cache hit không tính hạn mức. Hạn mức đếm bằng `question_quota(uuid)` (chỉ service role) và `my_question_quota()` (client, `auth.uid()`), từ `usage_costs.feature='answer'` theo tháng; 429-tương-đương qua event `error{code:quota_exceeded, used, quota, resets_at}` — đã kiểm: free user với 20 lượt bị chặn. Parser `[cN]` viết tay (không lookbehind, chạy giống nhau Deno/Hermes): mã đứng trước hay sau dấu chấm đều về đúng câu, mã bịa `[c9]` bị bỏ + câu tính `uncited`. **UI (G2.6) chỉ nhận kiểu `VerifiedAnswer`** — màn Hỏi chạy fixture, stream thật nối ở G3 sau verify() (CLAUDE.md quy tắc 2). Thanh neo theo DESIGN §4 kiểm trên emulator (`docs/shots/G2.6-anchor-rail.png`); chạm số trang → Reader mở đúng trang + highlight trên sách scan thật (`G2.6-citation-to-reader.png`). Nhánh model chưa chạy được vì thiếu Gemini key (#5): smoke dừng đúng ở `missing_llm_provider_api_key` sau khi qua consent/sở hữu/cache/hạn mức. |
| 2026-09-13 | G2.9–G2.10 | `eval/build_golden.py` → `eval/golden.jsonl` (100 câu), `eval/run.ts`, `scripts/eval.sh`, `package.json` (`eval:rag/gate/diff`, `typecheck` = app + node), `tsconfig.node.json`, `eslint.config.js`, `ask` nhận `nocache` | Bộ vàng từ 5 tài liệu thật trong `docs/samples`: vi 50 (đề cương CTU/HCMUTE, bài báo VJOL; 10 bẫy), en 50 (arXiv Attention, slide MIT; 10 bẫy). Bẫy theo README: số gần đúng nhưng sai (tuần 8, 213 triệu tham số), khái niệm chỉ nhắc tên (định luật Coulomb, công thức động năng), thứ không có (TPU, tiếng Trung, lệ phí). `expected_pages` tra từ text từng trang bằng PyMuPDF. Runner: tạo user `eval@anchor.local` (pro + consent), nạp tài liệu qua ingest nếu chưa có, gọi `ask` với `nocache`, chấm: recall@6 (trang của 6 chunk ∩ expected_pages), citation precision bán tự động (overlap từ khoá câu↔chunk ≥0,5 và mọi con số trong câu có trong chunk → pass; 0,3–0,5 → in ra chấm tay), refusal trên bẫy, `must_not_say`, gist (tham khảo), TTFT p95; ghi `eval/out/<thời điểm>[_nhãn].json`; `gate` exit 1 theo SPEC §7; `diff` so hai lần gần nhất. Kiểm khung: chạy 1 câu tới đúng lỗi thiếu key. **Chạy thật 100 câu chờ Gemini key** — dự kiến ~250 lời gọi (100 embed + 100 rerank + 100 answer), trong free tier. |
| 2026-09-13 | G3.1, G3.3–G3.6 (+G3.2/G3.7 phần cài) | `supabase/functions/_shared/verify.ts` (+6 test), `supabase/functions/ask/index.ts` (verify sau generate, `verifications`, event `verified`, cache lưu bản đã kiểm), `src/lib/askClient.ts`, `src/features/ask/{useAsk,ExplainSheet,types}.ts(x)`, `app/documents/[id]/ask.tsx` (bỏ fixture, nối `useAsk`), `eval/run.ts` (citation precision trên câu đã kiểm + `unsupported_leak`), tsconfig `allowImportingTsExtensions` | **Quyết định:** verify **một lời gọi** cho ≤12 mệnh đề (ADR chốt chặn 6) → app **không hiển thị delta thô**, chỉ hiện "Đang tìm trong tài liệu…" rồi vẽ `VerifiedAnswer` từ event `verified`; TTFT đo phía server. Mệnh đề = câu có trích dẫn; câu khẳng định không mã, câu ngoài 12 đầu, câu model không chấm → `unsupported` (thà ẩn nhầm còn hơn lọt); tiêu đề/câu hỏi tu từ giữ nguyên. Ngưỡng SPEC §6 (0,75/0,45). Đoạn hết câu thì bỏ; không còn câu có trích dẫn → insufficient + trang gần nhất. Kiểu `VerifiedAnswer` định nghĩa một nơi (`_shared/verify.ts`), app import qua `@shared/*`. Bảng giải thích (G3.5): Modal sheet liệt kê từng câu + nhãn + điểm + trang. Test thuần 15/15 (parser + verify). Kiểm app: hỏi → chờ → lỗi rõ (server thiếu key). **Bài học lớn:** Metro chạy với `CI=1` **tắt watch mode** → app luôn nhận bundle cũ; đây là nguyên nhân mọi vụ "code mới không lên" hôm nay. Chạy đúng: `expo start --dev-client < /dev/null`. |

## Câu hỏi chờ trả lời

| # | Câu hỏi | Chặn task nào | Trạng thái |
|---|---|---|---|
| 1 | Cần tài khoản Supabase của bạn để tạo project hosted: chạy `pnpm exec supabase login` rồi `pnpm exec supabase projects create anchor --org-id <org> --region ap-southeast-1 --db-password <mật khẩu>` và `pnpm exec supabase link --project-ref <ref>`; hoặc đưa tôi `SUPABASE_ACCESS_TOKEN` để tôi làm. Xong thì `supabase db push` áp migration. | G0.5 (hosted) | **Xong 2026-09-12** |
| 2 | Auth v1 tôi chọn **chỉ magic link email**, không social login → không kích hoạt yêu cầu Sign in with Apple, không cần Apple Developer account ở G0. Nếu bạn muốn có Google/Apple login ở v1 thì nói, tôi thêm Apple trước khi đóng G0. | Không chặn | **Đã xác nhận 2026-09-12: chỉ magic link** |
| 5 | Cần **Gemini API key** (Google AI Studio, free tier đủ dev): https://aistudio.google.com/apikey → *Create API key* → dán vào `services/ingest/.env` dòng `LLM_PROVIDER_API_KEY=` và đổi `EMBEDDING_PROVIDER=gemini` (hoặc gửi tôi key). Cùng key này dùng cho Edge Function ở G2 (`supabase secrets set`). | G1.5 chất lượng thật, G2 | **Xong 2026-09-13** — key đặt trong `.env` local (không commit); model ghim: answer `gemini-3.8-flash`, rerank/verify `gemini-3.5-flash-lite`, embedding `gemini-embedding-2`@768 (tra API list, chọn bản mới nhất có version cụ thể, không dùng alias `-latest` để eval tái lập được) |
| 7 | Gemini **free tier**: model `flash` (3.5/3.8) chỉ **20 lời gọi/ngày/model**, `flash-lite` 15 lời gọi/phút. Dev/eval hiện dùng `gemini-3.5-flash-lite` cho cả trả lời. Trước beta cần bật billing trên project Google AI Studio (Tier 1, trả theo dùng, ADR-0001 đã chốt backend tự trả) → khi đó đổi `LLM_MODEL_ANSWER=gemini-3.5-flash`. Bạn quyết định lúc nào bật. | Chất lượng trả lời ở production; không chặn G2/G3 | Chờ |
| 6 | Deploy `services/ingest` lên **Railway** (README chốt): tạo tài khoản railway.app → New Project → *Deploy from GitHub repo* `wsunicorn/anchor-handoff`, Root Directory `services/ingest`, Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (hosted), `LLM_PROVIDER_API_KEY`. Cho tôi URL public để đặt `EXPO_PUBLIC_INGEST_URL`. Dev local vẫn chạy uvicorn nên không chặn G1. | Kiểm G1 trên máy thật với server thật | Chờ |
| 4 | Hosted free tier không cho sửa email template khi dùng SMTP mặc định (giới hạn 2 email/giờ, không có mã OTP trong email). Cần **Custom SMTP** trước beta: gợi ý Brevo (free 300 email/ngày, chỉ cần xác minh địa chỉ gửi, không cần domain). Bạn tạo tài khoản Brevo → SMTP & API → tạo SMTP key → dán host/port/login/key vào Supabase Dashboard → Project Settings → Auth → SMTP Settings. Xong thì tôi chạy `supabase config push` để áp template có mã OTP. | Đường OTP dự phòng trên hosted; số lượng email test | **Xong 2026-09-13** — sai Username, đã sửa; DKIM/DMARC để G7 |
| 3 | G0.8 cần DSN Sentry và API key PostHog từ tài khoản của bạn (free tier đủ). Tạo project ở sentry.io (React Native) và posthog.com, dán vào `.env.local`. Tôi vẫn cài SDK và nối code trước bằng giá trị rỗng (SDK tự tắt khi thiếu key). | G0.8 (phần xác nhận sự kiện lên dashboard) | **Xong 2026-09-13** (nhớ xoá key `phs_` đã lộ trong chat) |
