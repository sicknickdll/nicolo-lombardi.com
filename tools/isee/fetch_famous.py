#!/usr/bin/env python3
"""I see u, step 1c: famous paintings from Wikimedia Commons.

The best-known pictures mostly hang in museums without an open API (the Sistine Chapel, the
Uffizi, the Louvre, the Prado…). tools/isee/famous.json lists them by hand: what each is and where
it hangs, and its photograph on Wikimedia Commons ("file", checked by eye; else the first hit of
the search "q"). Commons rate-limits: the script asks for the files in batches. All are in the public domain (the
painters died long ago; faithful photographs of them add no copyright of their own). Painters
still under copyright, such as Picasso (until 2043) or Dalí (until 2059), can't be used.

Most of these faces are too small, painted in profile or too stylised for the face model, so
famous.json also holds them, set by eye: "eye" (between the eyes, fractions of the whole picture),
"ipd" (eye-to-eye distance over the picture's short side) and "angle" (where they look, degrees,
0 = right, 90 = down). "crop" (left, top, right, bottom fractions) keeps only a detail of a large
scene; its image is then fetched larger so the detail stays sharp. famous_faces.py turns these
into the faces detect.py would have written.

Writes the same format as fetch_meta.py, with the Commons page as the link.

    python3 tools/isee/fetch_famous.py work/meta-famous.json
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import time

import requests

S = requests.Session()
S.headers["User-Agent"] = "isee-archive/1.0 (portfolio art project)"
API = "https://commons.wikimedia.org/w/api.php"


def api(**params):
    """Commons answers too-fast clients with 429: wait and ask again."""
    for i in range(8):
        r = S.get(API, params={"action": "query", "format": "json", **params}, timeout=60)
        if r.status_code == 200:
            time.sleep(3)
            return r.json()
        time.sleep(15 * (i + 1))
    raise RuntimeError(f"Commons keeps refusing: {r.status_code}")


rows = json.load(open(os.path.join(os.path.dirname(__file__), "famous.json")))
# 0. a painting a museum gives away itself ("met": object id) comes from there, with its record
from fetch_meta import met_object  # noqa: E402

museum = []
for r in rows:
    if r.get("met"):
        m = met_object(r["met"])
        if m:
            museum.append({**m, "id": f"wm-{r['id']}", **({"crop": r["crop"]} if r.get("crop") else {})})
    # a direct image ("url", with its "page"): a detail photographed on its own, from the Web
    # Gallery of Art (wga.hu) where Commons has only the whole wall
    elif r.get("url"):
        museum.append({"src": "wga", "id": f"wm-{r['id']}", "title": r["title"], "artist": r["artist"], "date": r["date"],
                       "medium": r["medium"], "museum": r["museum"], "accession": "", "link": r["page"],
                       "small": r["url"], "big": r["url"], "file": r["url"]})
rows = [r for r in rows if not (r.get("met") or r.get("url"))]
# 1. find the files of the entries that only have a search
for r in rows:
    if not r.get("file"):
        hits = api(list="search", srnamespace=6, srsearch=r["q"] + " filetype:bitmap", srlimit=1).get("query", {}).get("search", [])
        if hits:
            r["file"] = hits[0]["title"]
        else:
            print(f"{r['id']}: nothing found", file=sys.stderr)
rows = [r for r in rows if r.get("file")]
# 2. their image URLs, 40 files per request (Commons rate-limits single requests hard)
info = {1000: {}, 2400: {}}
for width in info:
    for k in range(0, len(rows), 40):
        q = api(titles="|".join(r["file"] for r in rows[k : k + 40]), prop="imageinfo", iiprop="url|size", iiurlwidth=width)
        names = {n["from"]: n["to"] for n in q["query"].get("normalized", [])}
        pages = {pg["title"]: pg for pg in q["query"]["pages"].values()}
        for r in rows[k : k + 40]:
            pg = pages.get(names.get(r["file"], r["file"]))
            if pg and "imageinfo" in pg:
                info[width][r["id"]] = pg["imageinfo"][0]
out = []
for r in rows:
    a, b = info[1000].get(r["id"]), info[2400].get(r["id"])
    if r.get("crop") and a:
        # a detail: ask for enough pixels that the crop alone is about 2400 px across
        c = r["crop"]
        need = min(a["width"], int(2400 / max(c[2] - c[0], c[3] - c[1]) * max(1, a["width"] / max(a["width"], a["height"]))) + 1)
        q = api(titles=r["file"], prop="imageinfo", iiprop="url|size", iiurlwidth=need)
        b = next(iter(q["query"]["pages"].values()))["imageinfo"][0]
    if not (a and b):
        print(f"{r['id']}: no image for {r['file']}", file=sys.stderr)
        continue
    out.append({
        "src": "commons", "id": f"wm-{r['id']}", "title": r["title"], "artist": r["artist"], "date": r["date"],
        "medium": r["medium"], "museum": r["museum"], "accession": "", "link": a["descriptionurl"],
        # originals (resized here): Commons throttles resized thumbnails much harder than originals;
        # only gigantic scans fall back to their thumbnails
        "small": a["url"] if a["size"] < 60e6 else a.get("thumburl") or a["url"],
        "big": a["url"] if a["size"] < 60e6 else b.get("thumburl") or b["url"], "file": r["file"],
        **({"crop": r["crop"]} if r.get("crop") else {}),
    })
out += museum
json.dump(out, open(sys.argv[1], "w"), indent=1, ensure_ascii=False)
print(f"{len(out)} famous paintings", file=sys.stderr)
