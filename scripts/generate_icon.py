from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)

size = 512
image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((28, 28, 484, 484), radius=132, fill=(10, 15, 25, 255))

gradient = Image.new("RGBA", (size, size), (0, 0, 0, 0))
gradient_draw = ImageDraw.Draw(gradient)
for y in range(46, 466):
    t = (y - 46) / 420
    color = (int(213 + (131 - 213) * t), int(255 + (216 - 255) * t), int(120 + (71 - 120) * t), 255)
    gradient_draw.line((46, y, 466, y), fill=color, width=1)

mask = Image.new("L", (size, size), 0)
ImageDraw.Draw(mask).rounded_rectangle((46, 46, 466, 466), radius=116, fill=255)
image.paste(gradient, (0, 0), mask)
draw = ImageDraw.Draw(image)

def spark(cx, cy, outer, inner):
    points = [(cx, cy - outer), (cx + inner, cy - inner), (cx + outer, cy), (cx + inner, cy + inner), (cx, cy + outer), (cx - inner, cy + inner), (cx - outer, cy), (cx - inner, cy - inner)]
    draw.polygon(points, fill=(11, 19, 9, 255))

spark(256, 215, 108, 25)
spark(369, 368, 57, 13)
image.save(ASSETS / "icon.png", optimize=True)
image.save(ASSETS / "icon.ico", sizes=[(16,16), (24,24), (32,32), (48,48), (64,64), (128,128), (256,256)])
print(ASSETS / "icon.ico")
