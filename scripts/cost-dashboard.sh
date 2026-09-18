#!/usr/bin/env bash
# Dashboard nội bộ G6.5: chi phí LLM theo tầng (từ usage_costs, N ngày gần nhất), chi phí trung bình mỗi
# người dùng hoạt động, ước tính biên lợi nhuận gộp theo gói. Chạy được trên local lẫn hosted
# (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY trong env; thiếu thì lấy của local).
#   bash scripts/cost-dashboard.sh [số ngày, mặc định 7]
set -euo pipefail
cd "$(dirname "$0")/.."
DAYS=${1:-7}
if [ -z "${SUPABASE_URL:-}" ]; then
  eval "$(pnpm exec supabase status -o env 2>/dev/null | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"
  export SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
fi
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/cost_dashboard" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
  -d "{\"p_days\":$DAYS}" > .cost-dashboard.json
DAYS=$DAYS PYTHONUTF8=1 python scripts/cost-dashboard-report.py
