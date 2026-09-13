#!/usr/bin/env bash
# Chạy eval trên Supabase local: nạp khoá từ `supabase status`, cần uvicorn (8000) và
# `supabase functions serve --env-file supabase/functions/.env` đang chạy.
#   bash scripts/eval.sh rag|gate|diff|seed
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${SUPABASE_URL:-}" ]; then
  eval "$(pnpm exec supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
  export SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
fi
exec pnpm exec tsx eval/run.ts "${1:-rag}"
