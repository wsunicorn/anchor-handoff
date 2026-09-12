#!/usr/bin/env bash
# Lấy khoá của Supabase local rồi chạy test RLS. Cần `pnpm db:start` trước.
set -euo pipefail
cd "$(dirname "$0")/.."

eval "$(pnpm exec supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
export SUPABASE_URL="$API_URL"
export SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

exec pnpm exec vitest run supabase/tests/rls.test.ts "$@"
