#!/usr/bin/env python3
"""I see u, step 4: put the chosen paintings on the site.

For each candidate of select.py, downloads the museum's large image, trims the plain margins some
museum photographs have around the painting (black or flat grey: they would show once the page
crops and slides the painting), saves it as assets/archive/isee/<id>.webp (2400 px on the long side,
so it can be enlarged) and writes js/isee/paintings.js: what the painting is, where it hangs, where
the eyes are and where they look. The trims are remembered next to the candidates file.

    python3 tools/isee/export.py work/candidates.json
"""
import io
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import requests
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "assets", "archive", "isee")
LONG, QUALITY = 2400, 62
os.makedirs(OUT, exist_ok=True)
S = requests.Session()
S.headers["User-Agent"] = "isee-archive/1.0 (portfolio art project)"

rows = json.load(open(sys.argv[1]))
TRIM_PATH = os.path.splitext(sys.argv[1])[0] + ".trim.json"
trims = json.load(open(TRIM_PATH)) if os.path.exists(TRIM_PATH) else {}


def margins(im):
    """The painting inside plain margins: (left, top, right, bottom) as fractions of the image."""
    g = im.convert("L")
    g.thumbnail((800, 800))
    g = np.asarray(g, dtype=float)
    h, w = g.shape

    def plain(line):  # flat grey, or near black
        return line.std() < 4 or (line.mean() < 9 and line.std() < 5)

    def scan(line, n):
        k = 0
        while k < n * 0.1 and plain(line(k)):
            k += 1
        return k + 1 if k else 0  # one more line: the soft edge

    t, b = scan(lambda k: g[k, :], h), scan(lambda k: g[h - 1 - k, :], h)
    l, r = scan(lambda k: g[:, k], w), scan(lambda k: g[:, w - 1 - k], w)
    return [l / w, t / h, 1 - r / w, 1 - b / h]


def save(r):
    path = os.path.join(OUT, r["id"] + ".webp")
    if not os.path.exists(path) or r["id"] not in trims:
        im = None
        # a copy already on disk (ISEE_LOCAL=folder with <id>.jpg): for hosts that throttle downloads
        local = os.path.join(os.environ.get("ISEE_LOCAL", "-"), r["id"] + ".jpg")
        if os.path.exists(local):
            im = Image.open(local).convert("RGB")
        for url in () if im else (r["big"], r["small"]):
            try:
                res = S.get(url, timeout=180)
                if res.status_code == 200:
                    im = Image.open(io.BytesIO(res.content)).convert("RGB")
                    break
            except Exception:
                pass
        if im is None:
            return None
        # the face was found on the small image: the large one must be the same picture
        if abs(im.width / im.height - r["w"] / r["h"]) > 0.02:
            print(f"{r['id']}: large image is cropped differently, using the small one", file=sys.stderr)
            im = Image.open(io.BytesIO(S.get(r["small"], timeout=60).content)).convert("RGB")
        box = r.get("crop") or margins(im)  # a detail of a large scene, or the picture inside its margins
        ex, ey = r["faces"][0]["eye"]
        if not (box[0] < ex < box[2] and box[1] < ey < box[3]):
            box = [0, 0, 1, 1]
        trims[r["id"]] = [round(v, 5) for v in box]
        if box != [0, 0, 1, 1]:
            im = im.crop((round(box[0] * im.width), round(box[1] * im.height), round(box[2] * im.width), round(box[3] * im.height)))
        im.thumbnail((LONG, LONG), Image.LANCZOS)
        im.save(path, "WEBP", quality=QUALITY, method=6)
    with Image.open(path) as im:
        return im.size


with ThreadPoolExecutor(6) as ex:
    sizes = list(ex.map(save, rows))
json.dump(trims, open(TRIM_PATH, "w"), indent=0)

out = []
for r, size in zip(rows, sizes):
    if not size:
        print(f"{r['id']}: no image", file=sys.stderr)
        continue
    f = r["faces"][0]
    # eyes and size measured on the untrimmed picture: move them into the trimmed one
    l, t, rr, b = trims.get(r["id"], [0, 0, 1, 1])
    eye = [round((f["eye"][0] - l) / (rr - l), 4), round((f["eye"][1] - t) / (b - t), 4)]
    fsize = round(f["size"] * min(r["w"], r["h"]) / min(r["w"] * (rr - l), r["h"] * (b - t)), 4)
    out.append({
        "id": r["id"],
        "src": f"/assets/archive/isee/{r['id']}.webp",
        "w": size[0],
        "h": size[1],
        "eye": eye,
        "dir": f["dir"],
        "size": fsize,
        "title": r["title"],
        "artist": r["artist"],
        "date": r["date"],
        "medium": r["medium"],
        "museum": r["museum"],
        "accession": r["accession"],
        "link": r["link"],
    })
out.sort(key=lambda p: p["id"])
keep = {p["id"] + ".webp" for p in out} | {"icon.webp", "icon-look.webp", "eyes.webp"}
for name in os.listdir(OUT):
    if name not in keep:
        os.remove(os.path.join(OUT, name))
with open(os.path.join(ROOT, "js", "isee", "paintings.js"), "w") as fh:
    fh.write(
        "// GENERATED by tools/isee/export.py: don't edit by hand (see the README, \"I see u\").\n"
        "// Public-domain paintings from The Cleveland Museum of Art (CC0) and The Metropolitan Museum of\n"
        "// Art (Open Access). eye: between the eyes, as fractions of the image; dir: where they look\n"
        "// (unit vector, y down); size: eye-to-eye distance over the image's short side.\n"
        "export const PAINTINGS = [\n"
        + "".join("  " + json.dumps(p, ensure_ascii=False) + ",\n" for p in out)
        + "];\n"
    )
total = sum(os.path.getsize(os.path.join(OUT, p["id"] + ".webp")) for p in out)
print(f"{len(out)} paintings, {total / 1e6:.1f} MB", file=sys.stderr)
