#!/usr/bin/env bash
# Tiêu chí thoát G5: chấm 10 bài thật, mọi nhận xét hiển thị phải có citation phân giải được (chunk_id
# tồn tại trong tài liệu) và không nhận xét mức 3 nào lọt ra. In bảng + tổng kết, exit 1 nếu vi phạm.
#   bash scripts/grade-eval.sh   (cần stack local + `pnpm eval:seed`)
set -uo pipefail
cd "$(dirname "$0")/.."
SUPA=http://127.0.0.1:54321
ANON=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
JWT=$(curl -s -X POST "$SUPA/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"eval@anchor.local","password":"eval-pass-anchor-1"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
mkdir -p eval/out/essays
for f in eval/essays/*.txt; do
  base=$(basename "$f" .txt)
  case "$base" in
    vi-0[1-5]*) TITLE=vi_decuong_ctu ;;
    vi-0[67]*) TITLE=vi_decuong_hcmute ;;
    en-*) TITLE=en_attention ;;
  esac
  LANG_=${base%%-*}
  DOC=$(curl -s "$SUPA/rest/v1/documents?title=eq.$TITLE&select=id" -H "apikey: $ANON" -H "Authorization: Bearer $JWT" | python -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
  PYTHONUTF8=1 python -c "import json; print(json.dumps({'document_id':'$DOC','body':open('$f',encoding='utf-8').read(),'lang':'$LANG_'}, ensure_ascii=False))" > .grade-req.json
  for attempt in 1 2 3; do
    curl -s -X POST "$SUPA/functions/v1/grade-essay" -H "Authorization: Bearer $JWT" -H "apikey: $ANON" -H "Content-Type: application/json" \
      --data-binary @.grade-req.json > "eval/out/essays/$base.json"
    grep -q '"essay_id"' "eval/out/essays/$base.json" && break
    sleep 15
  done
  echo "$base: $(head -c 80 "eval/out/essays/$base.json")"
  sleep 3
done
PYTHONUTF8=1 python scripts/grade-eval-report.py
