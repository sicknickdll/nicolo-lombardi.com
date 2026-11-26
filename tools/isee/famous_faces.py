#!/usr/bin/env python3
"""I see u: the faces of tools/isee/famous.json, set by eye, into a faces file.

For each famous painting with an "eye", replaces what detect.py found (often nothing: profiles,
small or stylised faces) with that face. Its direction is in review.json's "angle", like every
direction checked by eye.

    python3 tools/isee/famous_faces.py work/faces-famous.json
"""
import json
import os
import sys

famous = {f"wm-{r['id']}": r for r in json.load(open(os.path.join(os.path.dirname(__file__), "famous.json")))}
path = sys.argv[1]
rows = json.load(open(path))
n = 0
for row in rows:
    f = famous.get(row["id"])
    if f and f.get("eye"):
        row["faces"] = [{"eye": f["eye"], "dir": [1, 0], "str": 1, "head": [0, 0], "iris": [0, 0], "open": 0.4, "size": f["ipd"], "manual": True}]
        n += 1
json.dump(rows, open(path, "w"), ensure_ascii=False)
print(n, "faces set by eye", file=sys.stderr)
