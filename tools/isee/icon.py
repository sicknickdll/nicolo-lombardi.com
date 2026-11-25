#!/usr/bin/env python3
"""I see u: the two faces of its icon on the Archive desktop.

icon.webp is a sitter looking away; icon-look.webp, shown on hover, one looking straight out.
Each is a crop around the face (eyes a third of the way down), 76 × 96 px.

    python3 tools/isee/icon.py work/faces.json <away id> <looking id>
"""
import io
import json
import os
import sys

import requests
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "archive", "isee")
W, H = 76, 96
rows = {r["id"]: r for r in json.load(open(sys.argv[1]))}
for rid, name in ((sys.argv[2], "icon.webp"), (sys.argv[3], "icon-look.webp")):
    r = rows[rid]
    im = Image.open(io.BytesIO(requests.get(r["small"], timeout=60, headers={"User-Agent": "isee-archive/1.0"}).content)).convert("RGB")
    f = max(r["faces"], key=lambda f: f["size"])
    ex, ey = f["eye"][0] * im.width, f["eye"][1] * im.height
    span = f["size"] * min(im.size) * 3.2  # crop width: a little more than the head
    w, h = span, span * H / W
    box = [ex - w / 2, ey - h / 3, ex + w / 2, ey + h * 2 / 3]
    im.crop([round(v) for v in box]).resize((W, H), Image.LANCZOS).save(os.path.join(OUT, name), "WEBP", quality=82)
    print(name, rid, r["title"])
