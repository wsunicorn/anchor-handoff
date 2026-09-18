# Anchor

**Học từ chính tài liệu của bạn — mọi câu trả lời đều neo về đúng trang.**
*Answers that point back to your page.*

Anchor là app di động (iOS + Android) cho phép người học nạp tài liệu của chính mình
(PDF giáo trình, slide, đề cương, ảnh chụp sách) rồi:

1. **Hỏi đáp có trích dẫn** — mỗi câu trả lời gắn với vùng văn bản cụ thể trên trang cụ thể,
   kèm nhãn độ tin cậy. Khi tài liệu không chứa câu trả lời, app nói thẳng là không có
   thay vì bịa.
2. **Ôn tập chủ động** — sinh quiz và flashcard từ tài liệu, lặp lại ngắt quãng (FSRS),
   chạy offline.
3. **Chấm bài tự luận** — chấm theo rubric, phản hồi trích dẫn ngược về tài liệu nguồn.

Điểm khác biệt không nằm ở "có AI", mà ở **lớp kiểm chứng**: mọi câu do mô hình sinh ra
đều được đối chiếu lại với đoạn đã trích dẫn trước khi hiển thị. Đây là lợi thế kỹ thuật
riêng của dự án và là thứ cần bảo vệ trong mọi quyết định sản phẩm.

Song ngữ Việt–Anh ngay từ v1: giao diện, nội dung sinh ra, và metadata cửa hàng.

---

## Tech stack

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| App | React Native + Expo (dev client), TypeScript, Expo Router | Một codebase, dev trên Windows, test trên Android thật |
| UI | NativeWind v4 + design token riêng, Reanimated 3, Gorhom Bottom Sheet, FlashList, Lucide icons | Xem `docs/DESIGN.md` |
| State | Zustand (UI state) + TanStack Query (server state) | Tách rõ hai loại state |
| Local DB | expo-sqlite + Drizzle ORM | Flashcard và lịch ôn tập chạy offline |
| Auth / DB / Storage | Supabase (Postgres + pgvector + RLS) | Một nhà cung cấp, có vector search sẵn |
| Serverless | Supabase Edge Functions (Deno) | Proxy LLM, không bao giờ để API key trong app |
| Ingest worker | FastAPI + PyMuPDF trên Railway | Trích text + toạ độ + render ảnh trang; Python là thế mạnh sẵn có |
| LLM | Định tuyến nhiều model qua proxy — xem `docs/ADR-0001` | Kiểm soát chi phí |
| Thanh toán | RevenueCat | Chuẩn của thị trường subscription |
| Quan trắc | Sentry + PostHog | Crash và funnel |

## Cấu trúc kho

```
anchor/
├─ CLAUDE.md              # Điểm vào của mỗi phiên Claude Code — đọc đầu tiên
├─ TASKS.md               # Danh sách công việc tuần tự, có cổng chặn
├─ README.md
├─ docs/
│  ├─ SPEC.md             # Đặc tả sản phẩm + kỹ thuật (nguồn sự thật)
│  ├─ DESIGN.md           # Hệ thống thiết kế, token, quy tắc UI
│  ├─ PROMPTS.md          # Hợp đồng prompt cho ask / verify / quiz / grade
│  └─ ADR-0001-llm-cost-model.md
├─ app/                   # Expo Router — Claude Code tạo ở G0.1
├─ src/
│  ├─ features/           # qa/ study/ grading/ library/ paywall/
│  ├─ components/         # UI dùng chung
│  ├─ lib/i18n/           # ✓ vi.ts + en.ts đã có sẵn chuỗi lõi
│  └─ theme/tokens.ts     # ✓ đã có sẵn, sinh từ DESIGN.md
├─ supabase/
│  ├─ migrations/0001_init.sql   # ✓ đã có sẵn: bảng + RLS + hàm truy hồi lai
│  └─ functions/          # ask/ generate-quiz/ grade-essay/ verify/
├─ services/ingest/       # FastAPI + PyMuPDF
├─ eval/                  # ✓ README + golden.example.jsonl làm mẫu
└─ .github/workflows/ci.yml      # ✓ đã có sẵn, gồm cả cổng chặn RAG
```

Dấu ✓ là file đã nằm sẵn trong gói. Phần còn lại Claude Code dựng theo `TASKS.md`.

## Chạy lần đầu

```bash
pnpm install
cp .env.example .env.local          # điền khoá Supabase, RevenueCat, Sentry
pnpm supabase start                 # Postgres + pgvector cục bộ
pnpm supabase db reset              # chạy migration + seed
pnpm exec expo run:android          # build dev client, không dùng Expo Go
```

Không dùng Expo Go: dự án có module native (SQLite, RevenueCat, Skia nếu bật).

## Kiểm thử chất lượng

```bash
pnpm eval:seed                 # tạo user eval + nạp 6 PDF docs/samples (chạy fetch.sh trước)
pnpm eval:rag                  # bộ 100 câu hỏi vàng, in bảng chỉ số (EVAL_ONLY, EVAL_PACE_MS, EVAL_RESUME)
pnpm eval:gate                 # như trên, exit 1 nếu vi phạm ngưỡng SPEC §7 — CI chạy ở job rag-gate
bash scripts/grade-eval.sh     # 10 bài tự luận thật (eval/essays) — tiêu chí thoát G5
bash scripts/maestro.sh .maestro/g2-ask.yaml            # luồng UI: hỏi đáp
bash scripts/maestro.sh .maestro/g4-study-offline.yaml -e GENERATE=false   # ôn tập offline
bash scripts/maestro.sh .maestro/g5-essay.yaml          # chấm tự luận
```

`pnpm eval:gate` là điều kiện bắt buộc trước mỗi lần phát hành. Xem ngưỡng ở `docs/SPEC.md`.
Trên free tier Gemini, mỗi lượt gate tốn ~200 lời gọi (500/ngày/model) — tối đa hai lượt một ngày;
job CI `rag-gate` chỉ chạy khi push đụng `supabase/`, `eval/`, `services/ingest/` hoặc chạy tay
(`gh workflow run ci.yml -f only=vi-001,en-003`).

## Trạng thái

Xem `TASKS.md`. Cổng hiện tại được ghi ở đầu file đó.
