#!/usr/bin/env bash
# Cổng chất lượng RAG trên CI (G3.7): dựng cả stack tại chỗ rồi chạy `pnpm eval:gate`.
# Cần sẵn: Supabase local đã `start`, Python + requirements của services/ingest, tesseract,
# PDF trong docs/samples, và biến LLM_PROVIDER_API_KEY. Không dùng hạ tầng hosted nào.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${LLM_PROVIDER_API_KEY:?thiếu LLM_PROVIDER_API_KEY}"

eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
export SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

# Edge Function `ask` — cùng model/cờ như production, ghi vào env file vì `functions serve` đọc từ đó.
cat > supabase/functions/.env <<ENV
LLM_PROVIDER_API_KEY=$LLM_PROVIDER_API_KEY
LLM_MODEL_ANSWER=${LLM_MODEL_ANSWER:-gemini-3.5-flash-lite}
LLM_MODEL_RERANK=${LLM_MODEL_RERANK:-gemini-3.5-flash-lite}
LLM_MODEL_VERIFY=${LLM_MODEL_VERIFY:-gemini-3.5-flash-lite}
EMBEDDING_MODEL=${EMBEDDING_MODEL:-gemini-embedding-2}
RERANK=${RERANK:-off}
ENV
supabase functions serve --env-file supabase/functions/.env > eval/out/functions.log 2>&1 &
FUNCTIONS_PID=$!

# Dịch vụ nạp tài liệu (embedding thật, OCR tesseract của apt).
(
  cd services/ingest
  SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  LLM_PROVIDER_API_KEY="$LLM_PROVIDER_API_KEY" EMBEDDING_PROVIDER=gemini \
  TESSDATA_PREFIX="${TESSDATA_PREFIX:-/usr/share/tesseract-ocr/5/tessdata}" \
  python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 > ../../eval/out/ingest.log 2>&1
) &
INGEST_PID=$!
trap 'kill $FUNCTIONS_PID $INGEST_PID 2>/dev/null || true' EXIT

for i in $(seq 1 60); do
  curl -sf http://127.0.0.1:8000/health > /dev/null && break
  sleep 2
done
curl -sf http://127.0.0.1:8000/health > /dev/null || { echo "ingest không lên"; cat eval/out/ingest.log; exit 1; }
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SUPABASE_URL/functions/v1/ask" -H "apikey: $SUPABASE_ANON_KEY" || true)
  [ "$code" != "000" ] && [ "$code" != "502" ] && [ "$code" != "503" ] && break
  sleep 2
done
echo "functions serve trả HTTP $code"

# Free tier flash-lite: 15 lời gọi/phút, mỗi câu 2 lời gọi → 10 s/câu (8 s vẫn dính 429 trên CI);
# TTFT của câu bị 429/503 được tách riêng trong eval.
EVAL_PACE_MS="${EVAL_PACE_MS:-10000}" EVAL_LABEL="${EVAL_LABEL:-ci}" pnpm exec tsx eval/run.ts gate
