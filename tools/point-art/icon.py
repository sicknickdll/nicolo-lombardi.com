#!/usr/bin/env python3
"""Point-art: its icon on the Archive desktop, and the picture shown when the page is shared.

icon.webp is a hand from one painting, icon-look.webp (shown on hover) a finger pointing out of
another: each a crop around the hand, 76 × 96 px. assets/og/point-art.jpg (1200 × 630) is the
first painting, framed on its hand. Run after export.py:

    python3 tools/point-art/icon.py <id at rest> <id on hover> [<id for the shared picture>]
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "assets", "archive", "point-art")
src = open(os.path.join(ROOT, "js", "point-art", "paintings.js")).read()
P = {p["id"]: p for p in (json.loads(l.strip().rstrip(",")) for l in src.splitlines() if l.strip().startswith("{"))}


def framed(p, w, h, span):
    """A w × h crop centred a little behind the fingertip, `span` finger lengths wide."""
    im = Image.open(os.path.join(ROOT, p["src"].lstrip("/"))).convert("RGB")
    f = p["size"] * min(im.size)
    cx = p["tip"][0] * im.width - p["dir"][0] * f * 0.5
    cy = p["tip"][1] * im.height - p["dir"][1] * f * 0.5
    cw = min(f * span, im.width, im.height * w / h)
    ch = cw * h / w
    x = min(max(cx - cw / 2, 0), im.width - cw)
    y = min(max(cy - ch / 2, 0), im.height - ch)
    return im.crop((round(x), round(y), round(x + cw), round(y + ch))).resize((w, h), Image.LANCZOS)


for pid, name in ((sys.argv[1], "icon.webp"), (sys.argv[2], "icon-look.webp")):
    framed(P[pid], 76, 96, 2.6).save(os.path.join(OUT, name), "WEBP", quality=82)
    print(name, pid, P[pid]["title"])
og = P[sys.argv[3] if len(sys.argv) > 3 else sys.argv[2]]
framed(og, 1200, 630, 7).save(os.path.join(ROOT, "assets", "og", "point-art.jpg"), quality=86)
print("og", og["id"], og["title"])
