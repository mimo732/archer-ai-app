#!/usr/bin/env python3
"""ARCHER AI — build icons for Electron (.ico/.png) and Android (mipmaps)
from the existing PWA icon-512.png."""
from PIL import Image
import os

ROOT = "/home/z/my-project"
SRC = os.path.join(ROOT, "client/public/icon-512.png")
ELEC_DIR = os.path.join(ROOT, "electron/build")
AND_RES = os.path.join(ROOT, "android/app/src/main/res")

os.makedirs(ELEC_DIR, exist_ok=True)
src = Image.open(SRC).convert("RGBA")
print("source:", src.size)

# ---------- Electron ----------
# square PNG 512
src.save(os.path.join(ELEC_DIR, "icon.png"), "PNG")
# multi-size .ico
src.save(
    os.path.join(ELEC_DIR, "icon.ico"),
    format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
print("electron icon.ico + icon.png done")

# ---------- Android mipmaps ----------
# standard launcher sizes per density
LAUNCHER = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
# adaptive foreground: 108dp → 432px @ xxxhdpi (icon must sit in the inner ~66%)
FOREGROUND = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

for dpi, size in LAUNCHER.items():
    d = os.path.join(AND_RES, f"mipmap-{dpi}")
    if not os.path.isdir(d):
        continue
    img = src.resize((size, size), Image.LANCZOS)
    img.save(os.path.join(d, "ic_launcher.png"), "PNG")
    img.save(os.path.join(d, "ic_launcher_round.png"), "PNG")

for dpi, size in FOREGROUND.items():
    d = os.path.join(AND_RES, f"mipmap-{dpi}")
    if not os.path.isdir(d):
        continue
    fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(size * 0.62)  # safe zone for adaptive icons
    scaled = src.resize((inner, inner), Image.LANCZOS)
    off = (size - inner) // 2
    fg.paste(scaled, (off, off), scaled)
    fg.save(os.path.join(d, "ic_launcher_foreground.png"), "PNG")

print("android mipmaps done")
