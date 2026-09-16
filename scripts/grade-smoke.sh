#!/usr/bin/env bash
# Kiểm Edge Function `grade-essay` trên Supabase local với user eval (đã `pnpm eval:seed`).
#   bash scripts/grade-smoke.sh <title tài liệu> <file bài viết> [vi|en]
set -euo pipefail
cd "$(dirname "$0")/.."
TITLE=${1:?title}; FILE=${2:?file}; LANG_=${3:-vi}
SUPA=http://127.0.0.1:54321
ANON=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
JWT=$(curl -s -X POST "$SUPA/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"eval@anchor.local","password":"eval-pass-anchor-1"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
DOC=$(curl -s "$SUPA/rest/v1/documents?title=eq.$TITLE&select=id" -H "apikey: $ANON" -H "Authorization: Bearer $JWT" | python -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
PYTHONUTF8=1 python -c "import json,sys; print(json.dumps({'document_id':'$DOC','body':open('$FILE',encoding='utf-8').read(),'lang':'$LANG_'}, ensure_ascii=False))" > .grade-req.json
START=$(date +%s)
curl -s -X POST "$SUPA/functions/v1/grade-essay" -H "Authorization: Bearer $JWT" -H "apikey: $ANON" -H "Content-Type: application/json" \
  --data-binary @.grade-req.json > .grade-smoke.json
echo "mất $(( $(date +%s) - START )) s"
PYTHONUTF8=1 python - <<'PY'
import json
d=json.load(open('.grade-smoke.json',encoding='utf-8'))
if 'code' in d: print('LỖI', d); raise SystemExit(1)
fb=d['feedback']
print('essay', d['essay_id'], 'nhận xét thô', d['raw_comments'], 'hiển thị', len(fb['comments']), 'ẩn', fb['omitted'], 'usage', d['usage'])
print('mức:', ', '.join(f"{c['name']}={c['level']}" for c in fb['criteria']))
for i,p in enumerate(d['paragraphs']):
    cs=[c for c in fb['comments'] if c['essay_paragraph']==i]
    print(f"\n[đoạn {i}] {p[:90]}…")
    for c in cs: print(f"   • ({c['criterion']}, {c['verdict']} {c['score']}, tr.{c['citation']['page_no']}) {c['comment']}")
PY
