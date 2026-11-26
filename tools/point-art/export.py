#!/usr/bin/env python3
"""Point-art: put the pointing paintings on the site.

Reads tools/point-art/pointers.json, the list checked by eye: for each painting where its image comes
from (a Wikimedia Commons file, The Met or The Cleveland Museum of Art), an optional crop, and where
the pointing finger is: tip and base (the knuckle where the index finger leaves the hand), as
fractions of the whole image. Downloads each image (or takes it from a cache folder), crops it,
trims the plain margins some photographs have around the painting, saves it as
assets/archive/point-art/<id>.webp (2400 px on the long side, so it can be enlarged) and writes
js/point-art/paintings.js: what the painting is, where it hangs, where the fingertip is, where it points,
how long the finger is and how famous the painting is (from the number of Wikipedia languages that
have an article on it).

    python3 tools/point-art/export.py [cache folder]

Wikimedia's servers throttle bulk downloads: the script waits as long as they ask (Retry-After),
one file at a time; with a cache folder, every image is only downloaded once.
"""
import hashlib
import io
import json
import math
import os
import sys
import time
import urllib.parse

import numpy as np
import requests
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, "..", "..")
OUT = os.path.join(ROOT, "assets", "archive", "point-art")
LONG, QUALITY = 2400, 64
FAMOUS = 60  # Wikipedia languages for full fame
os.makedirs(OUT, exist_ok=True)
CACHE = sys.argv[1] if len(sys.argv) > 1 else None
S = requests.Session()
S.headers["User-Agent"] = "point-art-archive/1.0 (portfolio art project; static site build)"


def commons_url(name, width=None):
    n = name.replace(" ", "_")
    h = hashlib.md5(n.encode()).hexdigest()
    q = urllib.parse.quote(n)
    if width:
        return f"https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/{width}px-{q}"
    return f"https://upload.wikimedia.org/wikipedia/commons/{h[0]}/{h[:2]}/{q}"


def get(url):
    for i in range(40):
        try:
            r = S.get(url, timeout=180)
        except requests.RequestException:
            time.sleep(20)
            continue
        if r.status_code != 429:
            return r
        time.sleep(max(int(r.headers.get("retry-after") or 30), min(300, 30 * (i + 1))))
    return r


def source_urls(src):
    if "commons" in src:
        # the original, or a 3840 px rendering of it when the original is enormous
        both = [commons_url(src["commons"]), commons_url(src["commons"], 3840)]
        return both[::-1] if src.get("huge") else both
    if "met" in src:
        a = get(f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{src['met']}").json()
        return [a["primaryImage"], a["primaryImageSmall"]]
    if "cma" in src:
        a = get(f"https://openaccess-api.clevelandart.org/api/artworks/{src['cma']}").json()["data"]
        img = a["images"]
        return [(img.get("print") or img["web"])["url"], img["web"]["url"]]
    return [src["url"]]


def load(p):
    key = p.get("image") or p["id"]
    path = CACHE and os.path.join(CACHE, key + ".jpg")
    if path and os.path.exists(path):
        return Image.open(path).convert("RGB")
    for url in source_urls(p["source"]):
        r = get(url)
        if r.status_code == 200 and r.headers.get("content-type", "").startswith("image"):
            im = Image.open(io.BytesIO(r.content)).convert("RGB")
            if max(im.size) > 4000:
                im.thumbnail((4000, 4000), Image.LANCZOS)
            if path:
                im.save(path, quality=92)
            return im
        time.sleep(3)
    raise SystemExit(f"{p['id']}: no image")


def margins(im):
    """The painting inside plain margins: (left, top, right, bottom) as fractions of the image."""
    g = im.convert("L")
    g.thumbnail((800, 800))
    g = np.asarray(g, dtype=float)
    h, w = g.shape

    def plain(line):  # flat, or near black / white
        return line.std() < 4 or (line.mean() < 12 and line.std() < 6) or (line.mean() > 243 and line.std() < 6)

    def scan(line, n):
        k = 0
        while k < n * 0.1 and plain(line(k)):
            k += 1
        return k + 1 if k else 0  # one more line: the soft edge

    t, b = scan(lambda k: g[k, :], h), scan(lambda k: g[h - 1 - k, :], h)
    l, r = scan(lambda k: g[:, k], w), scan(lambda k: g[:, w - 1 - k], w)
    return [l / w, t / h, 1 - r / w, 1 - b / h]


pointers = json.load(open(os.path.join(HERE, "pointers.json")))
out, done = [], {}
for p in pointers:
    key = p.get("image") or p["id"]
    if key not in done:
        im = load(p)
        # the finger was found on another rendering of this image: it must be the same picture
        if p.get("ref") and abs(im.width / im.height - p["ref"][0] / p["ref"][1]) > 0.02:
            raise SystemExit(f"{p['id']}: the image is not framed like the one the finger was found on")
        crop = p.get("crop") or [0, 0, 1, 1]
        c = im.crop((round(crop[0] * im.width), round(crop[1] * im.height), round(crop[2] * im.width), round(crop[3] * im.height)))
        m = margins(c)
        box = [crop[0] + m[0] * (crop[2] - crop[0]), crop[1] + m[1] * (crop[3] - crop[1]),
               crop[0] + m[2] * (crop[2] - crop[0]), crop[1] + m[3] * (crop[3] - crop[1])]
        c = im.crop((round(box[0] * im.width), round(box[1] * im.height), round(box[2] * im.width), round(box[3] * im.height)))
        c.thumbnail((LONG, LONG), Image.LANCZOS)
        c.save(os.path.join(OUT, key + ".webp"), "WEBP", quality=QUALITY, method=6)
        done[key] = (box, c.size, im.size)
        print(f"{key}: {c.size[0]}×{c.size[1]}", file=sys.stderr)
    box, size, full = done[key]
    # tip and knuckle, from the whole image into the cropped one
    fx = lambda v: (v - box[0]) / (box[2] - box[0])
    fy = lambda v: (v - box[1]) / (box[3] - box[1])
    tip = [fx(p["tip"][0]), fy(p["tip"][1])]
    base = [fx(p["base"][0]), fy(p["base"][1])]
    assert 0 < tip[0] < 1 and 0 < tip[1] < 1, p["id"]
    vx, vy = (tip[0] - base[0]) * size[0], (tip[1] - base[1]) * size[1]
    n = math.hypot(vx, vy)
    links = p.get("links", 0)
    out.append({
        "id": p["id"],
        "src": f"/assets/archive/point-art/{key}.webp",
        "w": size[0],
        "h": size[1],
        "tip": [round(tip[0], 4), round(tip[1], 4)],
        "dir": [round(vx / n, 4), round(vy / n, 4)],
        "size": round(n / min(size), 4),
        "fame": round(min(1, math.log1p(links) / math.log1p(FAMOUS)), 2),
        "title": p["title"],
        "artist": p["artist"],
        "date": p.get("date", ""),
        "medium": p.get("medium", ""),
        "museum": p.get("museum", ""),
        "accession": p.get("accession", ""),
        "link": p.get("link", ""),
        **({"museumLink": False} if p.get("museumLink") is False else {}),
    })

out.sort(key=lambda p: (-p["fame"], p["id"]))
keep = {os.path.basename(p["src"]) for p in out} | {"icon.webp", "icon-look.webp", "fingers.webp"}
for name in os.listdir(OUT):
    if name not in keep:
        os.remove(os.path.join(OUT, name))
with open(os.path.join(ROOT, "js", "point-art", "paintings.js"), "w") as fh:
    fh.write(
        "// GENERATED by tools/point-art/export.py from tools/point-art/pointers.json: don't edit by hand (see the\n"
        "// README, \"Point-art\"). Public-domain paintings, most famous first. tip: the tip of the pointing\n"
        "// finger, as fractions of the image; dir: where it points (unit vector, y down); size: the\n"
        "// finger's length, knuckle to tip, over the image's short side; fame: 0 to 1.\n"
        "export const PAINTINGS = [\n"
        + "".join("  " + json.dumps(p, ensure_ascii=False) + ",\n" for p in out)
        + "];\n"
    )
total = sum(os.path.getsize(os.path.join(OUT, k + ".webp")) for k in done)
print(f"{len(out)} pointing fingers in {len(done)} paintings, {total / 1e6:.1f} MB", file=sys.stderr)
