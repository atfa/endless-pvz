#!/usr/bin/env python3
"""Montage tool: build a labelled contact sheet for a list of gif/png urls.

usage: python3 tools/montage.py NAME url1 url2 ...
writes .cache/sheets/NAME.png
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_assets as F
from PIL import Image, ImageDraw

def montage(name, urls, thumb=76, cols=12):
    tiles = []
    for u in urls:
        p = F.fetch(u)
        fr = F.gif_frames(p)
        tag = u.split("/")[-1].replace(".gif", "").replace(".png", "")
        for i, f in enumerate(fr):
            tiles.append((tag, i, f))
    if not tiles:
        print("no frames")
        return
    w = max(t[2].width for t in tiles)
    h = max(t[2].height for t in tiles)
    sc = min(1.0, thumb / max(w, h))
    tw, th = int(w * sc), int(h * sc)
    rows = (len(tiles) + cols - 1) // cols
    pad = 14
    sheet = Image.new("RGBA", (cols * (tw + 3), rows * (th + pad)), (22, 22, 28, 255))
    d = ImageDraw.Draw(sheet)
    for n, (tag, i, f) in enumerate(tiles):
        c, r = n % cols, n // cols
        x, y = c * (tw + 3), r * (th + pad)
        sheet.paste(f.resize((tw, th)), (x, y))
        d.text((x + 1, y + th + 1), "%s:%d" % (tag[:9], i), fill=(255, 255, 0, 255))
    out = os.path.join(F.SHEETS, name + ".png")
    os.makedirs(F.SHEETS, exist_ok=True)
    sheet.save(out)
    print(out, len(tiles), "tiles", sheet.size)


if __name__ == "__main__":
    montage(sys.argv[1], sys.argv[2:])
