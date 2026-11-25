#!/usr/bin/env python3
"""I see u, step 3: keep the paintings whose sitter clearly looks somewhere.

Reads detect.py's faces, settles the gaze of each painting's main face (the largest), and keeps
it when the face is big enough to read and the look is clearly away from the viewer. The
model sees painted heads as tilted down a little and irises as a little high, so both are
measured against the whole collection (the median) and taken off.

Then applies tools/isee/review.json, the human pass over the contact sheets (sheet.py):
  "keep":   ids checked by eye; when present, only these are kept
  "angle":  { id: degrees } a corrected gaze direction (0 = right, 90 = down)

    python3 tools/isee/select.py work/faces.json work/candidates.json [min_strength]
"""
import json
import math
import os
import statistics
import sys

faces_path, out_path = sys.argv[1:3]
MIN_STR = float(sys.argv[3]) if len(sys.argv) > 3 else 0.42
IRIS_GAIN = 1.6
MIN_SIZE = 0.045  # eye-to-eye distance over the image's short side

rows = json.load(open(faces_path))
allf = [f for r in rows for f in r.get("faces", []) if f["size"] > 0.06]
bias_head = statistics.median(f["head"][1] for f in allf)
bias_iris = statistics.median(f["iris"][1] for f in allf)
print(f"{len(allf)} faces; vertical bias head {bias_head:.3f}, iris {bias_iris:.3f}", file=sys.stderr)

review = {}
rp = os.path.join(os.path.dirname(__file__), "review.json")
if os.path.exists(rp):
    review = json.load(open(rp))
keep = set(review.get("keep") or [])
angle = review.get("angle") or {}

out = []
for r in rows:
    fs = sorted(r.get("faces") or [], key=lambda f: -f["size"])
    if not fs:
        continue
    f = fs[0]
    if f["size"] < MIN_SIZE:
        continue
    # a crowd: the main face should stand out, or nobody knows who is looking
    if len(fs) > 1 and fs[1]["size"] > 0.75 * f["size"] and r["id"] not in keep:
        continue
    gx = f["head"][0] + IRIS_GAIN * f["iris"][0]
    gy = (f["head"][1] - bias_head) + IRIS_GAIN * (f["iris"][1] - bias_iris)
    s = math.hypot(gx, gy)
    if r["id"] in angle:
        a = math.radians(angle[r["id"]])
        gx, gy = math.cos(a) * s, math.sin(a) * s
    if keep and r["id"] not in keep:
        continue
    if not keep and s < MIN_STR:
        continue
    out.append({**r, "faces": [{**f, "dir": [round(gx / s, 4), round(gy / s, 4)], "str": round(s, 3)}]})
out.sort(key=lambda r: -r["faces"][0]["str"])
json.dump(out, open(out_path, "w"), indent=1, ensure_ascii=False)
print(f"{len(out)} candidates", file=sys.stderr)
