#!/usr/bin/env bash
# G7.7 — chụp bộ ảnh cửa hàng thô cho một ngôn ngữ trên emulator/máy thật (bản release, đã đăng nhập eval).
# Ngôn ngữ đặt theo từng app (Android 13+): `cmd locale set-app-locales`, expo-localization đọc được.
#   bash scripts/store-shots.sh vi|en [flow…]      # mặc định: library ask quiz study essay
# Ảnh thô: docs/store/raw/<lang>/NN-<màn>.png → ghép khung bằng `python scripts/store-frame.py`.
set -uo pipefail
cd "$(dirname "$0")/.."
LANG_=${1:?vi|en}; shift || true
FLOWS=${*:-library ask quiz study essay}
MAESTRO="${LOCALAPPDATA:?}/maestro/maestro/bin/maestro.bat"
# JVM trên Windows đọc YAML theo cp1252 → regex EXPECT tiếng Việt hỏng; ép UTF-8.
export JAVA_TOOL_OPTIONS="-Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8"
OUT="docs/store/raw/$LANG_"; mkdir -p "$OUT"
case "$LANG_" in
  vi) LOCALE=vi-VN ;;
  en) LOCALE=en-US ;;
  *) echo "ngôn ngữ: vi|en"; exit 2 ;;
esac
# Tham số (tài liệu, câu hỏi, bài luận) nằm trong .maestro/store/<lang>.yaml — truyền qua `-e` trên Windows làm hỏng dấu tiếng Việt.
adb shell cmd locale set-app-locales com.anchor.app --user 0 --locales "$LOCALE"
adb shell am force-stop com.anchor.app
RC=0
for f in $FLOWS; do
  echo "== $LANG_/$f"
  MSYS_NO_PATHCONV=1 "$MAESTRO" test -e FLOW="$f" ".maestro/store/$LANG_.yaml" > /dev/null 2>&1 || { echo "  FAIL (xem ~/.maestro/tests)"; RC=1; }
  LAST=$(ls -d "$HOME"/.maestro/tests/*/ 2>/dev/null | sort | tail -1)
  [ -n "$LAST" ] && find "$LAST" -name '*.png' -path '*takeScreenshot*' | while read -r p; do
    n=$(basename "$p"); cp "$p" "$OUT/${n%%.png}.png"; echo "  $OUT/$n"
  done
  adb shell am force-stop com.anchor.app
done
exit $RC
