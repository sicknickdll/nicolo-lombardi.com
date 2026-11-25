#!/usr/bin/env python3
"""I see u, review: contact sheets of the detected gazes, to check them by eye.

Each tile is a painting with the chosen face's gaze drawn as a red line from between the eyes
(other faces in blue), numbered so a bad one can be dropped in work/review.json.

    python3 tools/isee/sheet.py work/faces.json work/sheets [min_strength]
"""
import io
import json
import os
import sys

import requests
from PIL import Image, ImageDraw

faces_path, out_dir = sys.argv[1:3]
min_str = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
os.makedirs(out_dir, exist_ok=True)
rows = [r for r in json.load(open(faces_path)) if r.get("faces")]
rows = [r for r in rows if max(f["str"] for f in r["faces"]) >= min_str]
T, COLS, PER = 300, 5, 20
cache = os.path.join(out_dir, "cache")
os.makedirs(cache, exist_ok=True)


def thumb(r):
    p = os.path.join(cache, r["id"] + ".jpg")
    if not os.path.exists(p):
        b = requests.get(r["small"], timeout=60, headers={"User-Agent": "isee-archive/1.0"}).content
        im = Image.open(io.BytesIO(b)).convert("RGB")
        im.thumbnail((T, T))
        im.save(p, quality=85)
    return Image.open(p)


for s in range(0, len(rows), PER):
    sheet = Image.new("RGB", (COLS * T, ((min(PER, len(rows) - s) + COLS - 1) // COLS) * (T + 16)), "white")
    d = ImageDraw.Draw(sheet)
    for k, r in enumerate(rows[s : s + PER]):
        im = thumb(r)
        x0, y0 = (k % COLS) * T, (k // COLS) * (T + 16)
        ox, oy = x0 + (T - im.width) // 2, y0 + (T - im.height) // 2
        sheet.paste(im, (ox, oy))
        best = max(r["faces"], key=lambda f: f["str"] * f["size"] ** 0.5)
        for f in r["faces"]:
            ex, ey = ox + f["eye"][0] * im.width, oy + f["eye"][1] * im.height
            L = 40 + 120 * min(f["str"], 1.2)
            col = (230, 20, 20) if f is best else (40, 90, 230)
            d.line([ex, ey, ex + f["dir"][0] * L, ey + f["dir"][1] * L], fill=col, width=3)
            d.ellipse([ex - 4, ey - 4, ex + 4, ey + 4], outline=col, width=2)
        d.text((x0 + 4, y0 + T + 1), f"{s + k}  {r['id']}  s={best['str']:.2f}", fill="black")
    sheet.save(os.path.join(out_dir, f"sheet-{s // PER:03d}.jpg"), quality=80)
print(f"{len(rows)} paintings, {(len(rows) + PER - 1) // PER} sheets")
