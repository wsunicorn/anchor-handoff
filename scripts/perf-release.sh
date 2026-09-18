#!/usr/bin/env bash
# G7.4 — đo hiệu năng trên MÁY THẬT với bản release (bundle nhúng, không Metro, Hermes tối ưu).
# Số đo trên emulator x86 + debug + Metro không có giá trị (GPU phần mềm, JS dev mode).
#   bash scripts/perf-release.sh <serial>        # vd VSE6AUBEBUTS6TZH (OPPO)
# Sau khi cài: đăng nhập tay (OTP) rồi chạy các bước đo bằng adb ở dưới (không cần Maestro).
set -euo pipefail
cd "$(dirname "$0")/.."
SERIAL=${1:?serial adb}
export JAVA_HOME=${JAVA_HOME:-"D:\StudyDocument\BigData\CK\setup\Java"}
# Bản release ký bằng debug keystore (android/app/build.gradle) — đủ để cài kiểm, không phải bản nộp store.
# Không tải sourcemap lên Sentry ở bản kiểm local (cần SENTRY_AUTH_TOKEN cho bản nộp store — TASKS #13).
SENTRY_DISABLE_AUTO_UPLOAD=true pnpm expo run:android --variant release --device "$SERIAL" --no-bundler
echo
echo "== Cách đo (sau khi đăng nhập và mở màn tương ứng) =="
echo "1) Reader 200 trang: mở tài liệu perf_200p, rồi:"
echo "   adb -s $SERIAL shell dumpsys gfxinfo com.anchor.app reset; (cuộn tay 10 s); adb -s $SERIAL shell dumpsys gfxinfo com.anchor.app | grep -E 'Janky|90th|95th'"
echo "2) Danh sách 500 thẻ: Ôn tập → Xem tất cả thẻ, rồi đo như trên."
echo "Đạt: Janky frames < 5 %, 95th percentile ≤ 16 ms (60 fps)."
