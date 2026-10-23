"""PWA 아이콘(그릇+젓가락) 생성: python3 scripts/make_icons.py"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).parent.parent / "public" / "icons"
BG = (200, 72, 30)
FG = (255, 248, 238)


def draw(size, maskable=False):
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    s = size / 512
    pad = 60 * s if maskable else 0  # maskable 아이콘은 안전 영역 안쪽에 그린다
    scale = (512 - 2 * pad / s) / 512

    def p(x, y):
        return (pad + x * s * scale, pad + y * s * scale)

    # 젓가락
    d.line([p(300, 70), p(210, 250)], fill=FG, width=int(22 * s * scale))
    d.line([p(350, 80), p(250, 250)], fill=FG, width=int(22 * s * scale))
    # 그릇
    d.pieslice([p(96, 150), p(416, 430)], 0, 180, fill=FG)
    d.rectangle([p(86, 268), p(426, 292)], fill=FG)
    d.rounded_rectangle([p(206, 416), p(306, 444)], radius=8 * s, fill=FG)
    return img


OUT.mkdir(parents=True, exist_ok=True)
for n in (192, 512):
    draw(n).save(OUT / f"icon-{n}.png")
draw(512, maskable=True).save(OUT / "icon-maskable-512.png")
draw(180).save(OUT / "apple-touch-icon.png")
print("icons:", sorted(p.name for p in OUT.iterdir()))
