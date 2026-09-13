#!/usr/bin/env bash
# Kiểm end-to-end trên Supabase local: tạo user test, lấy JWT, nạp các fixture, chờ ready, in tóm tắt.
# Cần: pnpm db:start (gốc repo), uvicorn app.main:app --port 8000, tests/fixtures/*.pdf
set -euo pipefail
cd "$(dirname "$0")/.."

SUPA=${SUPABASE_URL:-http://127.0.0.1:54321}
INGEST=${INGEST_URL:-http://127.0.0.1:8000}
ANON=${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0}
SERVICE=$(grep -m1 '^SUPABASE_SERVICE_ROLE_KEY=' .env | cut -d= -f2)
EMAIL="smoke-$(date +%s)@test.local"; PASS="smoke-pass-1"

# 1. user test (service role) + đăng nhập lấy JWT
curl -s -X POST "$SUPA/auth/v1/admin/users" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" \
  -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"email_confirm\":true}" >/dev/null
JWT=$(curl -s -X POST "$SUPA/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
UID_=$(python -c "import sys,json,base64; t='$JWT'.split('.')[1]; t+='='*(-len(t)%4); print(json.loads(base64.urlsafe_b64decode(t))['sub'])")
echo "user $EMAIL ($UID_)"

# Gói pro để nạp được nhiều hơn 1 tài liệu trong smoke test (hạn mức free = 1).
curl -s -X PATCH "$SUPA/rest/v1/profiles?id=eq.$UID_" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" \
  -H "Content-Type: application/json" -d '{"tier":"pro","ai_consent_at":"now()"}' >/dev/null

# 2. nạp từng fixture
for f in "$@"; do
  echo "--- $f"
  curl -s -X POST "$INGEST/documents?title=$(basename "$f" .pdf)" -H "Authorization: Bearer $JWT" -H "Content-Type: application/pdf" --data-binary "@$f"
  echo
done

# 3. chờ tới khi không còn pending/parsing/embedding
for _ in $(seq 1 60); do
  busy=$(curl -s "$SUPA/rest/v1/documents?owner=eq.$UID_&status=in.(pending,parsing,embedding)&select=id" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE")
  [ "$busy" = "[]" ] && break
  sleep 2
done

# 4. tóm tắt (đọc bằng JWT của user → qua RLS, đúng như app sẽ thấy)
curl -s "$SUPA/rest/v1/documents?select=title,lang,page_count,status,error&order=created_at" -H "apikey: $ANON" -H "Authorization: Bearer $JWT"; echo
curl -s "$SUPA/rest/v1/chunks?select=document_id,page_no,ord,token_count&order=document_id,ord" -H "apikey: $ANON" -H "Authorization: Bearer $JWT" \
  | python -c "
import sys,json,collections
rows=json.load(sys.stdin); by=collections.defaultdict(list)
for r in rows: by[r['document_id']].append(r)
for d,rs in by.items(): print(d[:8], 'chunks', len(rs), 'tokens', sum(r['token_count'] for r in rs), 'max', max(r['token_count'] for r in rs))"
