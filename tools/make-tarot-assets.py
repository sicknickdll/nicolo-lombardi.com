"""Prepares the Tarot Reader's card images (assets/archive/tarot/) from the original PNGs.

    python3 tools/make-tarot-assets.py path/to/folder-with-the-pngs
    python3 tools/make-tarot-assets.py --og        (only the link-preview image, from the webps)

The folder holds the fronts, named with their arcana number first ("00_Tarot_TheFool_Frontal.png",
"13_Tarot_Death_Frontal.png", ...), and the card back ("BACK.png"). Needs Pillow and numpy.

Writes, for each arcana (slugs below):
  <slug>.webp        720 x 1280, the face used in the 3D scene and in the reading summary
  <slug>-thumb.webp  216 x 384, the floating previews on the Archive desktop folder
and:
  back.webp          the back artwork framed like the fronts: same die-cut silhouette (mirrored, since
                     the notch of a face-down card sits on the other side), same white rim and black line
  back-thumb.webp
  js/tarot/outline.js  the card silhouette as a polygon (0..1, y down), for the 3D card edges
  assets/og/tarot.jpg  the link preview: three cards on the dark, candle-gold title

The fronts are not redrawn: only resized. The Fool and The World have no notch on their face; the
backs all share the notched silhouette, so no card can be told apart from behind.
"""
import json
import math
import os
import re
import sys

import numpy as np
from PIL import Image

W, H = 720, 1280
TW, TH = 216, 384
SLUGS = [
    "fool", "magician", "high-priestess", "empress", "emperor", "hierophant", "lovers", "chariot",
    "strength", "hermit", "wheel-of-fortune", "justice", "hanged-man", "death", "temperance", "devil",
    "tower", "star", "moon", "sun", "judgement", "world",
]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "assets", "archive", "tarot")


def erode(mask, radius):
    """Erodes a boolean mask by a disk of `radius` px (repeated small disks: close to round)."""
    small = [(dx, dy) for dx in range(-3, 4) for dy in range(-3, 4) if dx * dx + dy * dy <= 9]
    out = mask.copy()
    steps, rest = divmod(radius, 3)
    passes = [3] * steps + ([rest] if rest else [])
    for r in passes:
        offs = [(dx, dy) for dx, dy in small if dx * dx + dy * dy <= r * r]
        acc = out.copy()
        padded = np.pad(out, 3, constant_values=False)
        for dx, dy in offs:
            acc &= padded[3 + dy : 3 + dy + out.shape[0], 3 + dx : 3 + dx + out.shape[1]]
        out = acc
    return out


def outline(mask, samples=720):
    """Silhouette as a polygon: a ray from the centre to the edge at every angle, then simplified."""
    h, w = mask.shape
    cx, cy = w / 2, h / 2
    pts = []
    for i in range(samples):
        a = 2 * math.pi * i / samples
        dx, dy = math.cos(a), math.sin(a)
        r = 0.0
        while True:
            x, y = cx + dx * (r + 0.5), cy + dy * (r + 0.5)
            if x < 0 or y < 0 or x >= w or y >= h or not mask[int(y), int(x)]:
                break
            r += 0.5
        pts.append((cx + dx * r, cy + dy * r))
    return simplify(pts + [pts[0]], 1.2)[:-1]


def simplify(pts, tol):
    """Douglas-Peucker."""
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    n = math.hypot(dx, dy) or 1e-9
    best, idx = 0, 0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / n if n > 1e-6 else math.hypot(x - x1, y - y1)
        if d > best:
            best, idx = d, i
    if best <= tol:
        return [pts[0], pts[-1]]
    return simplify(pts[: idx + 1], tol)[:-1] + simplify(pts[idx:], tol)


def main(src):
    os.makedirs(OUT, exist_ok=True)
    files = {f.lower(): f for f in os.listdir(src) if f.lower().endswith(".png")}
    fronts = {}
    for low, f in files.items():
        m = re.match(r"^(\d{1,2})_", low)
        if m and int(m.group(1)) < len(SLUGS):
            fronts[SLUGS[int(m.group(1))]] = os.path.join(src, f)
    missing = [s for s in SLUGS if s not in fronts]
    if missing:
        print("missing fronts:", ", ".join(missing))

    standard = None  # the notched silhouette shared by most fronts
    for slug, path in fronts.items():
        im = Image.open(path).convert("RGBA").resize((W, H), Image.LANCZOS)
        im.save(os.path.join(OUT, f"{slug}.webp"), "WEBP", quality=86, method=6)
        im.resize((TW, TH), Image.LANCZOS).save(os.path.join(OUT, f"{slug}-thumb.webp"), "WEBP", quality=78, method=6)
        if slug == "magician":
            standard = im
        print("front", slug)

    back_path = next((os.path.join(src, f) for low, f in files.items() if low.startswith("back")), None)
    if standard is None or back_path is None:
        print("need 01_*.png (for the silhouette) and BACK.png to build the back")
        return

    face = np.asarray(standard)
    mask = face[:, :, 3] > 127
    # Rim and line of the fronts, measured on the 720 px face: white rim to ~18 px, black line to ~22 px.
    rim_in = erode(mask, 18)
    line_in = erode(mask, 22)
    # The back is the same physical card seen from behind: mirror the silhouette and the frame.
    m_mask, m_rim, m_line = mask[:, ::-1], rim_in[:, ::-1], line_in[:, ::-1]
    frame = face[:, ::-1, :3]

    art = Image.open(back_path).convert("RGB")
    ys, xs = np.nonzero(m_line)
    bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    bw, bh = bx1 - bx0, by1 - by0
    scale = max(bw / art.width, bh / art.height)
    aw, ah = math.ceil(art.width * scale), math.ceil(art.height * scale)
    art = art.resize((aw, ah), Image.LANCZOS)
    left, top = (aw - bw) // 2, (ah - bh) // 2
    art = np.asarray(art.crop((left, top, left + bw, top + bh)))

    out = np.zeros((H, W, 4), np.uint8)
    out[..., :3] = frame  # white rim, copied from a front (same stippled edge)
    out[m_rim & ~m_line, :3] = (12, 10, 12)  # the black line
    inner = np.zeros((H, W, 3), np.uint8)
    inner[by0:by1, bx0:bx1] = art
    out[m_line, :3] = inner[m_line]
    out[..., 3] = np.where(m_mask, face[:, ::-1, 3], 0)
    back = Image.fromarray(out, "RGBA")
    back.save(os.path.join(OUT, "back.webp"), "WEBP", quality=86, method=6)
    back.resize((TW, TH), Image.LANCZOS).save(os.path.join(OUT, "back-thumb.webp"), "WEBP", quality=78, method=6)
    print("back")

    poly = outline(mask)
    norm = [[round(x / W, 4), round(y / H, 4)] for x, y in poly]
    with open(os.path.join(ROOT, "js", "tarot", "outline.js"), "w") as f:
        f.write(
            "// GENERATED by tools/make-tarot-assets.py: the card silhouette (the die-cut notch top left),\n"
            "// as a polygon in 0..1 card space, y pointing down. Used for the 3D card edges.\n"
            f"export const OUTLINE = {json.dumps(norm, separators=(',', ':'))};\n"
        )
    print("outline", len(norm), "points")


def og():
    """1200 x 630 link preview: three cards fanned on near-black, the title in Caslon Antique."""
    from PIL import ImageDraw, ImageFilter, ImageFont

    W2, H2 = 1200, 630
    img = Image.new("RGB", (W2, H2), (7, 4, 7))
    glow = Image.new("L", (W2, H2), 0)
    ImageDraw.Draw(glow).ellipse((330, 40, 870, 640), fill=110)
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    img = Image.composite(Image.new("RGB", (W2, H2), (70, 18, 22)), img, glow)
    for slug, angle, x in (("moon", 12, 300), ("star", -12, 600), ("death", 0, 450)):
        c = Image.open(os.path.join(OUT, f"{slug}.webp")).convert("RGBA").resize((236, 420), Image.LANCZOS)
        shadow = Image.new("RGBA", (c.width + 80, c.height + 80), (0, 0, 0, 0))
        shadow.paste((0, 0, 0, 170), (40, 50), c.split()[3])
        shadow = shadow.filter(ImageFilter.GaussianBlur(18)).rotate(angle, expand=True, resample=Image.BICUBIC)
        rc = c.rotate(angle, expand=True, resample=Image.BICUBIC)
        y = 70 if slug == "death" else 100
        img.paste(shadow, (x - 40 + (rc.width - c.width) // 2 - (shadow.width - c.width - 80) // 2, y - 30), shadow)
        img.paste(rc, (x + (c.width - rc.width) // 2, y + (c.height - rc.height) // 2), rc)
    font = ImageFont.truetype(os.path.join(ROOT, "assets", "fonts", "CaslonAntique.ttf"), 54)
    d = ImageDraw.Draw(img)
    text = "The Tarot Reader"
    tw = d.textlength(text, font=font)
    d.text(((W2 - tw) / 2, 540), text, font=font, fill=(222, 170, 100))
    os.makedirs(os.path.join(ROOT, "assets", "og"), exist_ok=True)
    img.save(os.path.join(ROOT, "assets", "og", "tarot.jpg"), quality=86, optimize=True, progressive=True)
    print("og image")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    if sys.argv[1] != "--og":
        main(sys.argv[1])
    og()
