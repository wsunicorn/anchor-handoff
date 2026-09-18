#!/usr/bin/env bash
# G7.8 — quay video cửa hàng: `adb screenrecord` chạy nền trong lúc Maestro đi đúng đường ở
# docs/STORE-SUBMISSION.md §4 (.maestro/store/video.yaml). Cần bản release + đã đăng nhập + quota Gemini.
#   bash scripts/store-video.sh vi|en        → docs/store/video-<lang>.mp4 (≤ 180 s, 1080×2424 → cắt/scale bằng ffmpeg)
set -uo pipefail
cd "$(dirname "$0")/.."
LANG_=${1:?vi|en}
case "$LANG_" in vi) LOCALE=vi-VN ;; en) LOCALE=en-US ;; *) echo "vi|en"; exit 2 ;; esac
export JAVA_TOOL_OPTIONS="-Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8"
MAESTRO="${LOCALAPPDATA:?}/maestro/maestro/bin/maestro.bat"
adb shell cmd locale set-app-locales com.anchor.app --user 0 --locales "$LOCALE"
adb shell am force-stop com.anchor.app
adb shell screenrecord --time-limit 180 --bit-rate 8000000 /sdcard/store-video.mp4 &
REC=$!
sleep 1
MSYS_NO_PATHCONV=1 "$MAESTRO" test -e FLOW=video ".maestro/store/$LANG_.yaml" > /dev/null 2>&1; RC=$?
sleep 2
adb shell pkill -INT screenrecord; wait $REC 2>/dev/null
sleep 2
mkdir -p docs/store
MSYS_NO_PATHCONV=1 adb pull /sdcard/store-video.mp4 "docs/store/video-$LANG_.mp4" > /dev/null && echo "docs/store/video-$LANG_.mp4"
[ $RC -eq 0 ] || echo "Maestro FAIL (video vẫn được lưu — xem ~/.maestro/tests)"
exit $RC
