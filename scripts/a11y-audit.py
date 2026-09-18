"""G7.3 — snapshot tiếp cận từng màn chính (DEVICE-LOOP §4): mọi phần tử chạm được phải có nhãn đọc được.

Với mỗi flow trong .maestro/a11y/*.yaml (trừ _open): chạy Maestro để tới màn đó, rồi `uiautomator dump`
và kiểm: node clickable → text hoặc content-desc (trực tiếp hoặc ở con cháu) không rỗng và không kiểu
"button-2"; đồng thời vùng chạm ≥ 44dp (bounds, mật độ lấy từ `wm density`). Bỏ thành phần hệ thống.
  PYTHONUTF8=1 python scripts/a11y-audit.py            # cần emulator + Metro + đã đăng nhập (chạy g2-ask trước)
"""

from __future__ import annotations

import glob
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAESTRO = os.path.join(os.environ.get("LOCALAPPDATA", ""), "maestro", "maestro", "bin", "maestro.bat")
ENV = {**os.environ, "MSYS_NO_PATHCONV": "1"}


def sh(*args: str) -> str:
    return subprocess.run(args, capture_output=True, text=True, env=ENV, encoding="utf-8", errors="replace").stdout


density = int(re.search(r"density: (\d+)", sh("adb", "shell", "wm", "density")).group(1))
dp = density / 160.0
MIN_DP = 44

flows = sorted(f for f in glob.glob(os.path.join(ROOT, ".maestro", "a11y", "*.yaml")) if not os.path.basename(f).startswith("_"))
if len(sys.argv) > 1:  # chỉ chạy vài màn: python scripts/a11y-audit.py ask essay
    flows = [f for f in flows if os.path.basename(f)[:-5] in sys.argv[1:]]
problems: list[str] = []
checked = 0


def label(node: ET.Element) -> str:
    t = (node.get("text") or node.get("content-desc") or "").strip()
    if t:
        return t
    for c in node:
        t = label(c)
        if t:
            return t
    return ""


for flow in flows:
    name = os.path.basename(flow)[:-5]
    run = subprocess.run([MAESTRO, "test", flow], capture_output=True, text=True, env=ENV, encoding="utf-8", errors="replace")
    if run.returncode != 0:
        problems.append(f"{name}: flow không tới được màn (xem ~/.maestro/tests)")
        continue
    sh("adb", "shell", "uiautomator", "dump", "/sdcard/ui.xml")
    xml = subprocess.run(["adb", "exec-out", "cat", "/sdcard/ui.xml"], capture_output=True, env=ENV).stdout.decode("utf-8", "replace")
    root = ET.fromstring(xml)
    n = 0
    for node in root.iter("node"):
        pkg = node.get("package") or ""
        rid = node.get("resource-id") or ""
        if pkg != "com.anchor.app" or "devlauncher" in rid or "devmenu" in rid:
            continue
        if node.get("clickable") != "true":
            continue
        lab = label(node)
        # Dev-only: LogBox của Metro (cảnh báo "!" và nút đóng 8dp) không phải UI của app.
        if lab.startswith("!") or "React state update" in lab or "Require cycle" in lab:
            continue
        m0 = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds") or "")
        if m0 and (int(m0.group(3)) - int(m0.group(1))) / dp < 12 and not lab:
            continue
        n += 1
        if not lab or re.fullmatch(r"(button|view|item)[-_ ]?\d*", lab, re.I):
            problems.append(f"{name}: không nhãn — {rid or node.get('class')} {node.get('bounds')}")
        m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds") or "")
        if m:
            w = (int(m.group(3)) - int(m.group(1))) / dp
            h = (int(m.group(4)) - int(m.group(2))) / dp
            if w < MIN_DP - 1 or h < MIN_DP - 1:  # bounds là px nguyên: 44dp @420dpi = 115,5px → 43,8dp
                problems.append(f"{name}: vùng chạm {w:.0f}×{h:.0f}dp < 44 — '{lab[:40]}' {rid}")
    checked += n
    print(f"{name}: {n} phần tử chạm được")

print(f"\na11y-audit: {len(flows)} màn, {checked} phần tử, {len(problems)} vấn đề")
for p in problems:
    print("  " + p)
sys.exit(1 if problems else 0)
