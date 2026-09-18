#!/usr/bin/env bash
# Kiểm Edge Function `ask` trên Supabase local: tạo user, bật consent, nạp một PDF qua services/ingest,
# rồi gọi ask và in các event SSE. Cần: pnpm db:start, uvicorn (8000), supabase functions serve.
#   bash scripts/ask-smoke.sh <pdf> "<câu hỏi>" [vi|en]
set -euo pipefail
cd "$(dirname "$0")/.."

PDF=${1:?pdf}; QUESTION=${2:?câu hỏi}; LANG_=${3:-vi}
SUPA=http://127.0.0.1:54321
ANON=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SERVICE=$(grep -m1 '^SUPABASE_SERVICE_ROLE_KEY=' services/ingest/.env | cut -d= -f2)
EMAIL=${ASK_EMAIL:-"ask-$(date +%s)@test.local"}; PASS="ask-pass-1"

curl -s -X POST "$SUPA/auth/v1/admin/users" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" \
  -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"email_confirm\":true}" >/dev/null || true
JWT=$(curl -s -X POST "$SUPA/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
UID_=$(python -c "import sys,json,base64; t='$JWT'.split('.')[1]; t+='='*(-len(t)%4); print(json.loads(base64.urlsafe_b64decode(t))['sub'])")
curl -s -X PATCH "$SUPA/rest/v1/profiles?id=eq.$UID_" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" \
  -H "Content-Type: application/json" -d "{\"entitlement\":\"${ASK_TIER:-pro}\",\"ai_consent_at\":\"now()\"}" >/dev/null

DOC=$(curl -s -X POST "http://127.0.0.1:8000/documents?title=$(basename "$PDF" .pdf)" -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/pdf" --data-binary "@$PDF" | python -c "import sys,json; print(json.load(sys.stdin)['document_id'])")
for _ in $(seq 1 90); do
  S=$(curl -s "$SUPA/rest/v1/documents?id=eq.$DOC&select=status" -H "apikey: $ANON" -H "Authorization: Bearer $JWT" | python -c "import sys,json; print(json.load(sys.stdin)[0]['status'])")
  [ "$S" = "ready" ] && break; [ "$S" = "failed" ] && { echo "ingest failed"; exit 1; }; sleep 2
done
echo "user=$EMAIL doc=$DOC status=$S"
echo "--- ask: $QUESTION"
curl -s -N -X POST "$SUPA/functions/v1/ask" -H "Authorization: Bearer $JWT" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "$(python -c "import json,sys; print(json.dumps({'document_id':'$DOC','question':sys.argv[1],'lang':'$LANG_'}))" "$QUESTION")"
echo
