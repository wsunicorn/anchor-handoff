#!/usr/bin/env bash
# G7.4 — đo cuộn danh sách 500 thẻ: tới màn qua Maestro, reset gfxinfo, vuốt 20 lần, đọc tỉ lệ khung giật.
# Tiêu chí: Janky frames < 5 % và không khung > 700 ms (≈ 60 fps cảm nhận). Cần ≥ 500 thẻ (seed bằng SQL, xem TASKS).
#   bash scripts/perf-scroll.sh
set -uo pipefail
cd "$(dirname "$0")/.."
"${LOCALAPPDATA:?}/maestro/maestro/bin/maestro.bat" test .maestro/perf/cards.yaml > /dev/null 2>&1 || { echo "không tới được màn thẻ"; exit 1; }
adb shell dumpsys gfxinfo com.anchor.app reset > /dev/null
for i in $(seq 1 20); do adb shell input swipe 540 1900 540 500 120; done
for i in $(seq 1 10); do adb shell input swipe 540 500 540 1900 120; done
adb shell dumpsys gfxinfo com.anchor.app | grep -E "Total frames|Janky frames|90th|95th|99th|Number Frame deadline missed|> 700ms" | head -8
