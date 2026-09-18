"""G7.7 — ghép ảnh cửa hàng: nền paper, tiêu đề + phụ đề (docs/store/copy.json), ảnh chụp thô bo góc.

Đầu vào: docs/store/raw/<lang>/NN-<màn>.png (scripts/store-shots.sh). Đầu ra: docs/store/out/<lang>/NN-<màn>.png
kích thước 1080×1920 (Google Play: tỉ lệ ≤ 2:1; App Store 6,7" cần 1290×2796 — thêm --size 1290x2796 khi có ảnh iPhone).
Màu và chữ lấy từ token/asset của app (src/theme/tokens.ts, assets/fonts) để đồng nhất với giao diện.
  PYTHONUTF8=1 python scripts/store-frame.py [vi|en …] [--size WxH]
"""

from __future__ import annotations

import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, "assets", "fonts")
# Trùng src/theme/tokens.ts (light). Script không import TS nên chép tay; đổi token thì đổi đây.
INK, INK_MUTED, PAPER, RULE = "#17233B", "#5A6880", "#F4F6F8", "#C9D2DC"

args = [a for a in sys.argv[1:] if not a.startswith("--")]
size = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--size=")), "1080x1920")
W, H = (int(v) for v in size.split("x"))
langs = args or ["vi", "en"]
copy = json.load(open(os.path.join(ROOT, "docs", "store", "copy.json"), encoding="utf-8"))


def font(name: str, px: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(os.path.join(FONT_DIR, name), px)


def wrap(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=f) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    return lines + [cur]


def frame(raw: str, title: str, sub: str, out: str) -> None:
    canvas = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(canvas)
    pad = int(W * 0.07)
    f_title, f_sub = font("BeVietnamPro_600SemiBold.ttf", int(W * 0.062)), font("BeVietnamPro_400Regular.ttf", int(W * 0.034))
    y = int(H * 0.055)
    for line in wrap(d, title, f_title, W - 2 * pad):
        d.text((pad, y), line, font=f_title, fill=INK)
        y += int(f_title.size * 1.25)
    y += int(W * 0.015)
    for line in wrap(d, sub, f_sub, W - 2 * pad):
        d.text((pad, y), line, font=f_sub, fill=INK_MUTED)
        y += int(f_sub.size * 1.4)
    top = y + int(W * 0.05)

    shot = Image.open(raw).convert("RGB")
    # Cắt thanh trạng thái (giờ/pin khác nhau giữa các ảnh) — ~105 px / 2424 ở Pixel 10.
    shot = shot.crop((0, int(shot.height * 0.045), shot.width, shot.height))
    tw = W - 2 * pad
    th = int(shot.height * tw / shot.width)
    shot = shot.resize((tw, th), Image.LANCZOS)
    visible = min(th, H - top)  # phần dưới tràn ra ngoài khung → cảm giác màn hình tiếp tục
    shot = shot.crop((0, 0, tw, visible))
    r = int(W * 0.04)
    mask = Image.new("L", (tw, visible), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, tw - 1, visible - 1 + r), radius=r, fill=255)
    canvas.paste(shot, (pad, top), mask)
    d.rounded_rectangle((pad, top, pad + tw - 1, top + visible - 1 + r), radius=r, outline=RULE, width=2)
    canvas.save(out, optimize=True)


made = 0
for lang in langs:
    raw_dir, out_dir = os.path.join(ROOT, "docs", "store", "raw", lang), os.path.join(ROOT, "docs", "store", "out", lang)
    os.makedirs(out_dir, exist_ok=True)
    for shot in copy["shots"]:
        raw = os.path.join(raw_dir, shot["file"] + ".png")
        if not os.path.exists(raw):
            print(f"  thiếu {lang}/{shot['file']}.png")
            continue
        frame(raw, shot[lang]["title"], shot[lang]["sub"], os.path.join(out_dir, shot["file"] + ".png"))
        made += 1
        print(f"  {lang}/{shot['file']}.png")
print(f"store-frame: {made} ảnh {W}×{H}")
