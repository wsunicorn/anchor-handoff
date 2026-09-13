#!/usr/bin/env bash
# Thăm dò tham số thinkingConfig hợp lệ cho một model Gemini (free tier: 15 RPM → giãn nhịp).
#   bash scripts/probe-thinking.sh gemini-3.5-flash-lite
set -uo pipefail
M=${1:-gemini-3.5-flash-lite}
K=$(grep -m1 '^LLM_PROVIDER_API_KEY=' "$(dirname "$0")/../supabase/functions/.env" | cut -d= -f2)
until [ "$(date +%S)" = "05" ]; do sleep 1; done   # đợi đầu phút để cửa sổ RPM sạch
for cfg in '{"thinkingLevel":"low"}' '{"thinkingBudget":0}' '{"thinkingLevel":"minimal"}' '{"includeThoughts":false}'; do
  R=$(curl -s "https://generativelanguage.googleapis.com/v1beta/models/$M:generateContent" -H "x-goog-api-key: $K" \
    -H "Content-Type: application/json" \
    -d "{\"contents\":[{\"parts\":[{\"text\":\"2+2=?\"}]}],\"generationConfig\":{\"maxOutputTokens\":50,\"thinkingConfig\":$cfg}}")
  echo "$cfg → $(echo "$R" | python -c "
import sys,json; d=json.load(sys.stdin)
if 'error' in d:
  e=d['error']; q=[v for x in e.get('details',[]) if 'QuotaFailure' in x.get('@type','') for v in x['violations']]
  print('ERR', e['code'], [(v.get('quotaId'), v.get('quotaValue')) for v in q] or e['message'][:100])
else:
  parts=d['candidates'][0]['content'].get('parts',[]); u=d.get('usageMetadata',{})
  print([(p.get('thought',False), (p.get('text') or '')[:20]) for p in parts], 'thoughts', u.get('thoughtsTokenCount'), 'out', u.get('candidatesTokenCount'))")"
  sleep 6
done
