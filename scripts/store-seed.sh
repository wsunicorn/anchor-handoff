#!/usr/bin/env bash
# G7.7 — tạo user store@anchor.local + hai tài liệu mẫu tên thật (scripts/store-seed.ts). Khoá lấy từ `supabase status`.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${SUPABASE_URL:-}" ]; then
  eval "$(pnpm exec supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
  export SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
fi
exec pnpm exec tsx scripts/store-seed.ts
