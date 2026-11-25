// Drawing → ASCII. A bitmap (intensity 0–255) is cut into character cells; each cell becomes a
// stroke glyph (- | / \ _) when its ink is long and thin, otherwise a density glyph from RAMP.
// Pure: no DOM. Used for the pad, the fish, the plants, the babies.

export const RAMP = " .:-=+*#%@";
// Detailed ramp (after DEVAULT's "Detailed" style): density groups, letters included; the glyph in a
// group is picked by a stable hash so bodies read as text-like texture.
export const DETAIL = [".'`,", ":;~-", "+=<>!i", "*?7tjc", "ovxzrnu", "aeCLJYU", "dbpqhkZX", "O0QmwG", "#%AHKN", "&8B$", "MW@"];
const hash = (x, y, z = 0) => {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
};
export const detailGlyph = (l, x, y, z = 0) => {
  const g = DETAIL[Math.max(0, Math.min(DETAIL.length - 1, Math.floor(l * DETAIL.length)))];
  return g[(hash(x, y, z) * g.length) | 0];
};

// Light on the drawing as if it were a soft relief: blur the ink into a dome, light it from the
// top left, keep the drawn tones. Cached on the bitmap.
export function shadeField(bm) {
  if (bm.shade) return bm.shade;
  const { w, h, d } = bm,
    n = w * h,
    r = Math.max(2, Math.round(Math.min(w, h) * 0.08));
  let a = Float32Array.from(d, (v) => (v > 20 ? 1 : 0)),
    b = new Float32Array(n);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -r; x < w; x++) {
        if (x + r < w) acc += a[y * w + x + r];
        if (x - r - 1 >= 0) acc -= a[y * w + x - r - 1];
        if (x >= 0) b[y * w + x] = acc / (2 * r + 1);
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y < h; y++) {
        if (y + r < h) acc += b[(y + r) * w + x];
        if (y - r - 1 >= 0) acc -= b[(y - r - 1) * w + x];
        if (y >= 0) a[y * w + x] = acc / (2 * r + 1);
      }
    }
  }
  const out = new Float32Array(n),
    k = r * 1.6,
    L = [-0.42, -0.72, 0.55],
    ln = Math.hypot(...L);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] <= 20) continue;
      const gx = (a[i + (x < w - 1 ? 1 : 0)] - a[i - (x > 0 ? 1 : 0)]) * k,
        gy = (a[i + (y < h - 1 ? w : 0)] - a[i - (y > 0 ? w : 0)]) * k,
        nl = Math.hypot(gx, gy, 1),
        dot = Math.max(0, (-gx * L[0] - gy * L[1] + L[2]) / (nl * ln));
      const v = (0.18 + 0.5 * dot + 0.42 * a[i] + 0.35 * dot ** 14) * (0.45 + 0.55 * (d[i] / 255));
      out[i] = v > 1 ? 1 : v;
    }
  return (bm.shade = out);
}
export const PAD_W = 160;
export const PAD_H = 96;
const SX = 4,
  SY = 6; // samples per cell

export const blank = (w = PAD_W, h = PAD_H) => ({ w, h, d: new Uint8Array(w * h) });

// opts: flip (mirror), wag (tail swing, px), detail (shaded, letter glyphs), seed (glyph choice)
export function rasterize(bm, cols, aspect = 1.9, opts = {}) {
  const { flip = false, wag = 0, detail = false, seed = 0 } = opts;
  const sh = detail ? shadeField(bm) : null;
  const cw = bm.w / cols,
    chh = cw * aspect,
    rows = Math.max(1, Math.ceil(bm.h / chh));
  const chars = new Array(cols * rows),
    lum = new Float32Array(cols * rows);
  const n = SX * SY;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      let m = 0,
        mx = 0,
        my = 0,
        mxx = 0,
        myy = 0,
        mxy = 0,
        lit = 0;
      for (let j = 0; j < SY; j++)
        for (let i = 0; i < SX; i++) {
          const u = (i + 0.5) / SX,
            v = ((j + 0.5) / SY) * aspect;
          let sx = (c + (i + 0.5) / SX) * cw,
            sy = (r + (j + 0.5) / SY) * chh;
          if (wag) {
            // tail = the left part of a fish drawn facing right
            const t = 1 - sx / bm.w - 0.5;
            if (t > 0) sy -= wag * (t / 0.5) ** 1.4;
          }
          if (flip) sx = bm.w - sx;
          const px = sx | 0,
            py = sy | 0;
          const val = px >= 0 && py >= 0 && px < bm.w && py < bm.h ? bm.d[py * bm.w + px] / 255 : 0;
          if (!val) continue;
          if (sh) lit += sh[py * bm.w + px];
          m += val;
          mx += val * u;
          my += val * v;
          mxx += val * u * u;
          myy += val * v * v;
          mxy += val * u * v;
        }
      const k = r * cols + c,
        cov = m / n;
      lum[k] = sh ? Math.min(1, lit / n + 0.05) : cov;
      if (cov < 0.07) {
        chars[k] = " ";
        continue;
      }
      const ax = mx / m,
        ay = my / m,
        cxx = mxx / m - ax * ax,
        cyy = myy / m - ay * ay,
        cxy = mxy / m - ax * ay;
      const tr = cxx + cyy,
        dt = Math.sqrt(((cxx - cyy) / 2) ** 2 + cxy * cxy);
      const aniso = tr > 1e-6 ? (2 * dt) / tr : 0;
      if (aniso > 0.5 && cov < 0.62) {
        const deg = (Math.atan2(2 * cxy, cxx - cyy) * 90) / Math.PI; // principal axis, y down
        const a = Math.abs(deg);
        chars[k] = a < 24 ? (ay > aspect * 0.62 ? "_" : "-") : a > 66 ? "|" : deg > 0 ? "\\" : "/";
      } else if (sh) chars[k] = detailGlyph(Math.min(1, lum[k] ** 1.3 * 1.05), c, r, seed);
      else chars[k] = RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(cov * (RAMP.length - 1)))];
    }
  return { cols, rows, chars, lum };
}

// Tight box around the ink, with a margin.
export function crop(bm, pad = 2) {
  let x0 = bm.w,
    y0 = bm.h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < bm.h; y++)
    for (let x = 0; x < bm.w; x++)
      if (bm.d[y * bm.w + x] > 20) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(bm.w - 1, x1 + pad);
  y1 = Math.min(bm.h - 1, y1 + pad);
  const out = blank(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = 0; y < out.h; y++) out.d.set(bm.d.subarray((y + y0) * bm.w + x0, (y + y0) * bm.w + x0 + out.w), y * out.w);
  return out;
}

export function resize(bm, w, h) {
  const out = blank(w, h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(bm.h - 1, Math.floor(((y + 0.5) * bm.h) / h));
    for (let x = 0; x < w; x++) out.d[y * w + x] = bm.d[sy * bm.w + Math.min(bm.w - 1, Math.floor(((x + 0.5) * bm.w) / w))];
  }
  return out;
}

// Baby: the two parents laid over each other, ink where either has it, tones mixed.
export function blend(a, b, rnd = Math.random) {
  const w = Math.round((a.w + b.w) / 2),
    h = Math.round((a.h + b.h) / 2);
  const A = resize(a, w, h),
    B = resize(b, w, h),
    out = blank(w, h);
  const split = 0.35 + rnd() * 0.3; // front from one parent, tail from the other
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        from = x / w < split ? A.d[i] : B.d[i],
        other = x / w < split ? B.d[i] : A.d[i];
      out.d[i] = Math.max(from, other * 0.55);
    }
  return out;
}

// Storage: 2 bits per pixel (4 tones), base64.
export function encode(bm) {
  const bytes = new Uint8Array(Math.ceil(bm.d.length / 4));
  for (let i = 0; i < bm.d.length; i++) bytes[i >> 2] |= Math.min(3, Math.round((bm.d[i] / 255) * 3)) << ((i & 3) * 2);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return { w: bm.w, h: bm.h, b: btoa(s) };
}
export function decode({ w, h, b }) {
  const s = atob(b),
    bm = blank(w, h);
  for (let i = 0; i < w * h; i++) bm.d[i] = Math.round((((s.charCodeAt(i >> 2) >> ((i & 3) * 2)) & 3) / 3) * 255);
  return bm;
}
