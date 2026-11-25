#!/usr/bin/env python3
"""I see u, step 2: find the faces in each painting and where they look.

For each candidate of fetch_meta.py, downloads the small image and runs MediaPipe's Face
Landmarker (478 points, irises included, plus the head's 3D pose). The gaze seen on the
picture plane is the head's facing direction plus how far the irises sit off the middle of
the eyes. Writes every face found, with:
  eye   the point between the eyes, as a fraction of the image (x, y)
  dir   the gaze direction on the picture (unit vector, y down)
  str   how clearly the face looks away from the viewer (0 = straight at you)
  size  the eye-to-eye distance, as a fraction of the image's short side

    python3 tools/isee/detect.py work/meta.json work/faces.json face_landmarker.task
(needs: pip install mediapipe pillow numpy requests; the model is
 storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task)
"""
import io
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor

import mediapipe as mp
import numpy as np
import requests
from PIL import Image

meta_path, out_path, model = sys.argv[1:4]
S = requests.Session()
S.headers["User-Agent"] = "isee-archive/1.0 (portfolio art project)"

opts = mp.tasks.vision.FaceLandmarkerOptions(
    base_options=mp.tasks.BaseOptions(model_asset_path=model),
    num_faces=5,
    min_face_detection_confidence=0.35,
    min_face_presence_confidence=0.35,
    output_facial_transformation_matrixes=True,
)
landmarker = mp.tasks.vision.FaceLandmarker.create_from_options(opts)

# subject's right eye (left on the picture) and left eye: outer corner, inner corner, top lid,
# bottom lid, iris centre
EYES = ((33, 133, 159, 145, 468), (263, 362, 386, 374, 473))
IRIS_GAIN = 1.6  # how much an iris pushed to the corner turns the gaze, against the head


def fetch(url):
    for _ in range(3):
        try:
            r = S.get(url, timeout=60)
            if r.status_code == 200:
                return Image.open(io.BytesIO(r.content)).convert("RGB")
        except Exception:
            pass
    return None


def faces_in(img):
    w, h = img.size
    res = landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(img)))
    out = []
    for i, lm in enumerate(res.face_landmarks):
        p = np.array([[q.x * w, q.y * h] for q in lm])
        m = np.array(res.facial_transformation_matrixes[i])
        fwd = m[:3, 2]  # the face's forward axis, camera space (y up)
        head = np.array([fwd[0], -fwd[1]])
        iris, opens = [], []
        for outer, inner, top, bot, c in EYES:
            a, b = p[outer], p[inner]
            mid, half = (a + b) / 2, np.linalg.norm(b - a) / 2
            if half < 1:
                continue
            ax = (b - a) / (2 * half)
            ay = np.array([-ax[1], ax[0]])
            if ay[1] < 0:
                ay = -ay
            d = p[c] - mid
            lid_mid = (p[top] + p[bot]) / 2
            # horizontal: along the eye; vertical: against the middle of the lids
            iris.append(np.dot(d, ax) / half * ax + np.dot(p[c] - lid_mid, ay) / half * 1.4 * ay)
            opens.append(np.linalg.norm(p[top] - p[bot]) / (2 * half))
        if len(iris) < 2:
            continue
        g = head + IRIS_GAIN * np.mean(iris, axis=0)
        eye = (p[468] + p[473]) / 2
        span = np.linalg.norm(p[33] - p[263])
        out.append({
            "eye": [round(eye[0] / w, 4), round(eye[1] / h, 4)],
            "dir": [round(float(g[0] / (np.linalg.norm(g) + 1e-9)), 4), round(float(g[1] / (np.linalg.norm(g) + 1e-9)), 4)],
            "str": round(float(np.linalg.norm(g)), 3),
            "head": [round(float(head[0]), 3), round(float(head[1]), 3)],
            "iris": [round(float(v), 3) for v in np.mean(iris, axis=0)],
            "open": round(float(np.mean(opens)), 3),
            "size": round(float(span / min(w, h)), 4),
        })
    return out


rows = json.load(open(meta_path))
done = {}
if os.path.exists(out_path):
    done = {r["id"]: r for r in json.load(open(out_path))}
todo = [r for r in rows if r["id"] not in done]
print(f"{len(todo)} to scan, {len(done)} done", file=sys.stderr)
with ThreadPoolExecutor(8) as ex:
    for n, (r, img) in enumerate(zip(todo, ex.map(lambda r: fetch(r["small"]), todo))):
        if img is not None:
            if max(img.size) > 1200:
                img.thumbnail((1200, 1200))
            done[r["id"]] = {**r, "w": img.size[0], "h": img.size[1], "faces": faces_in(img)}
        if n % 100 == 99:
            json.dump(list(done.values()), open(out_path, "w"), ensure_ascii=False)
            print(f"{n + 1}/{len(todo)}", file=sys.stderr)
json.dump(list(done.values()), open(out_path, "w"), ensure_ascii=False)
print(f"{sum(1 for r in done.values() if r['faces'])} paintings with faces", file=sys.stderr)
