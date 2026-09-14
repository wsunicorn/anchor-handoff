#!/usr/bin/env bash
# Kiểm Edge Function `generate-quiz` trên Supabase local với user eval (đã `pnpm eval:seed`).
#   bash scripts/quiz-smoke.sh <title tài liệu, vd en_attention> <from_page> <to_page> [n]
set -euo pipefail
cd "$(dirname "$0")/.."
TITLE=${1:?title}; FROM=${2:?from}; TO=${3:?to}; N=${4:-20}
SUPA=http://127.0.0.1:54321
ANON=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
JWT=$(curl -s -X POST "$SUPA/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"eval@anchor.local","password":"eval-pass-anchor-1"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
DOC=$(curl -s "$SUPA/rest/v1/documents?title=eq.$TITLE&select=id" -H "apikey: $ANON" -H "Authorization: Bearer $JWT" | python -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
echo "doc=$DOC pages $FROM-$TO n=$N"
START=$(date +%s)
curl -s -X POST "$SUPA/functions/v1/generate-quiz" -H "Authorization: Bearer $JWT" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"document_id\":\"$DOC\",\"from_page\":$FROM,\"to_page\":$TO,\"n\":$N}" > .quiz-smoke.json
echo "mất $(( $(date +%s) - START )) s"
PYTHONUTF8=1 python - <<'PY'
import json
d=json.load(open('.quiz-smoke.json',encoding='utf-8'))
if 'code' in d: print('LỖI', d); raise SystemExit(1)
print('quiz', d['quiz_id'], 'sinh', d['generated'], 'giữ', len(d['questions']), 'loại', d['dropped'], 'usage', d['usage'])
for i,q in enumerate(d['questions'],1):
    print(f"\n{i}. {q['stem']}  (tr.{q['citation']['page_no']}, q={q['quality_score']})")
    for k,v in q['options'].items(): print(f"   {'*' if k==q['answer_key'] else ' '}{k}. {v}")
    print('   →', q['explanation'][:160])
PY
