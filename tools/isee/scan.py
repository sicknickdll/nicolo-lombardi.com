#!/usr/bin/env python3
"""I see u: find pointing hands in the museums' open collections.

For each painting listed by fetch_meta.py, MediaPipe's hand landmarks on the whole picture and on
overlapping parts of it (painted hands are small). A hand points when its index finger is straight
and reaches out while at least two of the other three fingers fold back toward the palm. Writes,
for each painting, the pointing hands found: tip and base (the index knuckle) as fractions of the
image, the finger's length and the palm's over the short side. These are candidates only: check
each by eye before adding it to pointers.json. Re-running continues where it stopped.

    python3 tools/isee/scan.py work/meta.json work/hands.json hand_landmarker.task
"""

import sys, io, json, os, threading
from concurrent.futures import ThreadPoolExecutor
import numpy as np, requests, mediapipe as mp
from PIL import Image
from mediapipe.tasks.python import vision, BaseOptions
Image.MAX_IMAGE_PIXELS = None
rows = json.load(open(sys.argv[1])); OUTP = sys.argv[2]; MODEL = sys.argv[3]
done = json.load(open(OUTP)) if os.path.exists(OUTP) else {}
S = requests.Session(); S.headers["User-Agent"] = "isee-archive/1.0 (portfolio art project)"
local = threading.local()
def det():
    if not hasattr(local, "d"):
        local.d = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=MODEL), num_hands=4,
            min_hand_detection_confidence=0.35, min_hand_presence_confidence=0.35))
    return local.d
def pointing(P):
    P = np.array(P); w = P[0]
    d = lambda a: np.linalg.norm(P[a] - w)
    palm = np.linalg.norm(P[9] - P[0])
    if palm < 8: return None
    idx = d(8) / max(d(6), 1e-6)
    folded = [d(t) / max(d(p), 1e-6) for t, p in ((12, 10), (16, 14), (20, 18))]
    v1, v2, v3 = P[6] - P[5], P[7] - P[6], P[8] - P[7]
    cos = lambda a, b: float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))
    straight = min(cos(v1, v2), cos(v2, v3))
    reach = np.linalg.norm(P[8] - P[5]) / palm
    if idx < 1.15 or straight < 0.75 or reach < 0.55 or sum(f < 1.0 for f in folded) < 2: return None
    dv = P[8] - P[5]
    return {"tip": P[8].tolist(), "base": P[5].tolist(), "len": float(np.linalg.norm(dv)), "palm": float(palm),
            "idx": round(float(idx), 2), "folded": [round(float(f), 2) for f in folded], "straight": round(straight, 2)}
def run(im):
    a = np.ascontiguousarray(np.asarray(im.convert("RGB")))
    r = det().detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=a))
    return [([(l.x * im.width, l.y * im.height) for l in h], s[0].score) for h, s in zip(r.hand_landmarks, r.handedness)]
def scan(r):
    if r["id"] in done: return None
    try:
        im = (Image.open(r["small"]) if r["small"].startswith("/") else Image.open(io.BytesIO(S.get(r["small"], timeout=60).content))).convert("RGB")
    except Exception as e:
        return r["id"], {"err": str(e)}
    W, H = im.size; hits = []
    tiles = [(0, 0, W, H)]
    if max(W, H) > 700:
        tiles += [(0, 0, W * 0.6, H * 0.6), (W * 0.4, 0, W, H * 0.6), (0, H * 0.4, W * 0.6, H), (W * 0.4, H * 0.4, W, H), (W * .2, H * .2, W * .8, H * .8)]
    for x0, y0, x1, y1 in tiles:
        t = im.crop((int(x0), int(y0), int(x1), int(y1)))
        k = 1.0
        if max(t.size) < 900: k = 900 / max(t.size); t = t.resize((round(t.width * k), round(t.height * k)), Image.LANCZOS)
        for L, sc in run(t):
            p = pointing([(x0 + x / k, y0 + y / k) for x, y in L])
            if p:
                p["score"] = round(sc, 2); p["tip"] = [p["tip"][0] / W, p["tip"][1] / H]; p["base"] = [p["base"][0] / W, p["base"][1] / H]
                p["len"] /= min(W, H); p["palm"] /= min(W, H)
                if not any(abs(h["tip"][0] - p["tip"][0]) < 0.02 and abs(h["tip"][1] - p["tip"][1]) < 0.02 for h in hits): hits.append(p)
    return r["id"], {"w": W, "h": H, "hands": hits}
n = 0
with ThreadPoolExecutor(6) as ex:
    for res in ex.map(scan, rows):
        if not res: continue
        done[res[0]] = res[1]; n += 1
        if n % 100 == 0:
            json.dump(done, open(OUTP, "w")); print(n, sum(1 for v in done.values() if v.get("hands")), flush=True)
json.dump(done, open(OUTP, "w")); print("done", n, sum(1 for v in done.values() if v.get("hands")))
