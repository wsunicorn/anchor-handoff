#!/usr/bin/env bash
# Chạy test Maestro luồng chính (CLAUDE.md: một test Maestro mỗi cổng từ G2).
# Cần: pnpm db:start, uvicorn (8000), functions serve, Metro (không CI=1), dev client trên emulator,
# và `pnpm eval:seed` một lần để có user eval + tài liệu.
#   bash scripts/maestro.sh [.maestro/<flow>.yaml]
set -uo pipefail
cd "$(dirname "$0")/.."
FLOW=${1:-.maestro/g2-ask.yaml}
if command -v maestro > /dev/null; then
  maestro test "$FLOW"
else
  # Windows: bản zip giải nén vào %LOCALAPPDATA%\maestro (github.com/mobile-dev-inc/maestro/releases)
  "${LOCALAPPDATA:?}/maestro/maestro/bin/maestro.bat" test "$FLOW"
fi
RC=$?
# Maestro 2.x ghi ảnh chụp vào ~/.maestro/tests/<run>/…; chép sang docs/shots làm bằng chứng thiết bị.
LAST=$(ls -d "$HOME"/.maestro/tests/*/ 2>/dev/null | sort | tail -1)
[ -n "$LAST" ] && find "$LAST" -name '*.png' -path '*takeScreenshot*' -exec cp {} docs/shots/ \; && echo "ảnh: docs/shots/"
exit $RC
