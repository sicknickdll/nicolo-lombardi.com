"""Pixel-art sprites for the Tarot Reader's HTML overlays, in the palette of the rendered room
(near-black, burgundy, crimson, candle gold, parchment), drawn small and shown scaled up without
smoothing so they match the low-resolution table. Writes assets/archive/tarot/:
  sprite-eyes.png     her eyes (the loading screen): 2 frames, open and half shut
  sprite-matchbox.png the matchbox, striker along the top
  sprite-match.png    one match, head on the left
  sprite-flame.png    a match flame, 3 frames
    python3 tools/make-tarot-sprites.py
"""
import math, os, random
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "archive", "tarot")
random.seed(7)
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def ramp(stops, t):
    t = max(0, min(1, t))
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        if t <= t1:
            return lerp(c0, c1, (t - t0) / (t1 - t0 or 1))
    return stops[-1][1]


def dither(v, x, y, levels=5):
    """Quantise 0..1 with an ordered dither, like the post pass of the room."""
    return max(0, min(1, math.floor(v * levels + BAYER[y % 4][x % 4] / 16) / levels))


def eyes(open_k):
    W, H = 46, 13
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = im.load()
    eye_stops = [(0, (255, 244, 205, 255)), (0.35, (242, 178, 92, 255)), (0.75, (184, 80, 28, 255)), (1, (90, 20, 8, 255))]
    for cx, tilt in ((11, -1), (34, 1)):
        for y in range(H):
            for x in range(W):
                dx, dy = (x - cx) / 10.5, (y - 6 + tilt * (x - cx) * 0.08) / (5.2 * open_k)
                d = dx * dx + dy * dy * (1.0 if dy < 0 else 1.25)
                if d > 1:
                    # a faint halo around the eye
                    if d < 1.9 and open_k > 0.3:
                        a = dither(0.35 * (1.9 - d), x, y, 4)
                        if a > 0:
                            px[x, y] = (150, 50, 20, int(255 * a))
                    continue
                v = dither(math.sqrt(d), x, y, 6)
                c = ramp(eye_stops, v)
                if abs(x - cx) <= 0 and abs(dy) < 0.85:  # slit pupil
                    c = (18, 4, 3, 255)
                px[x, y] = c
    return im


def matchbox():
    W, H = 56, 24
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = im.load()
    for y in range(H):
        for x in range(W):
            if x in (0, W - 1) or y in (0, H - 1):
                px[x, y] = (18, 4, 6, 255)
            elif y <= 3:  # striker: rough dark brown
                px[x, y] = random.choice([(58, 34, 22, 255), (44, 24, 15, 255), (74, 46, 30, 255)])
            elif y == 4:
                px[x, y] = (18, 4, 6, 255)
            else:
                v = dither((y - 4) / (H - 5) * 0.8 + (x / W) * 0.2, x, y, 4)
                px[x, y] = ramp([(0, (122, 30, 34, 255)), (1, (49, 9, 13, 255))], v)
    # gold inner line
    for x in range(3, W - 3):
        px[x, 6] = px[x, H - 3] = (138, 100, 48, 255)
    for y in range(6, H - 2):
        px[3, y] = px[W - 4, y] = (138, 100, 48, 255)
    # an eye in the middle, in gold
    cx, cy = W // 2, 14
    for y in range(-4, 5):
        for x in range(-9, 10):
            d = (x / 9) ** 2 + (y / 3.6) ** 2
            if 0.62 < d <= 1.0:
                px[cx + x, cy + y] = (210, 154, 88, 255)
            elif d <= 0.25:
                px[cx + x, cy + y] = (232, 190, 120, 255)
    px[cx, cy] = px[cx, cy - 1] = px[cx, cy + 1] = (40, 10, 8, 255)
    return im


def match():
    W, H = 40, 5
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = im.load()
    for x in range(5, W):
        px[x, 1] = (226, 200, 150, 255)
        px[x, 2] = (200, 170, 122, 255)
        px[x, 3] = (140, 104, 70, 255)
    px[W - 1, 1] = px[W - 1, 3] = (0, 0, 0, 0)
    for y in range(H):
        for x in range(0, 7):
            d = ((x - 3) / 3.4) ** 2 + ((y - 2) / 2.5) ** 2
            if d <= 1:
                px[x, y] = (184, 64, 42, 255) if (x <= 2 and y <= 1) else (122, 22, 18, 255)
    return im


def flame(f):
    W, H = 9, 15
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = im.load()
    sway = (-0.6, 0.0, 0.6)[f]
    stops = [(0, (255, 248, 224, 255)), (0.3, (255, 210, 120, 255)), (0.65, (240, 120, 40, 255)), (1, (150, 30, 10, 255))]
    for y in range(H):
        for x in range(W):
            t = y / (H - 1)  # 0 top … 1 bottom
            width = 0.6 + 3.6 * math.sin(min(1, t * 1.1) * math.pi * 0.85) ** 0.8
            cx = 4 + sway * (1 - t) * 2
            d = abs(x - cx) / max(0.4, width)
            if d > 1 or (t < 0.08 and d > 0.4):
                continue
            v = dither(min(1, d * 0.8 + (1 - t) * 0.45), x, y, 5)
            px[x, y] = ramp(stops, v)
    return im


def strip(frames):
    w, h = frames[0].size
    out = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        out.paste(f, (i * w, 0))
    return out


os.makedirs(OUT, exist_ok=True)
strip([eyes(1.0), eyes(0.45), eyes(0.12)]).save(os.path.join(OUT, "sprite-eyes.png"))
matchbox().save(os.path.join(OUT, "sprite-matchbox.png"))
match().save(os.path.join(OUT, "sprite-match.png"))
strip([flame(i) for i in range(3)]).save(os.path.join(OUT, "sprite-flame.png"))
print("sprites written")
