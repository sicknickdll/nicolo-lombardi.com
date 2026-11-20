// Smooth value noise (2D) and fractal sums, deterministic from a seed. Used for the grass flow
// field, the mist and the wind gusts.
const hash = (x, y, s) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const fade = (t) => t * t * (3 - 2 * t);
export function makeNoise(seed = 1, period = 0) {
  const wrap = (v) => (period ? ((v % period) + period) % period : v);
  const n2 = (x, y) => {
    const x0 = Math.floor(x),
      y0 = Math.floor(y);
    const fx = fade(x - x0),
      fy = fade(y - y0);
    const a = hash(wrap(x0), wrap(y0), seed),
      b = hash(wrap(x0 + 1), wrap(y0), seed),
      c = hash(wrap(x0), wrap(y0 + 1), seed),
      d = hash(wrap(x0 + 1), wrap(y0 + 1), seed);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  const fbm = (x, y, oct = 4) => {
    let v = 0,
      amp = 0.5,
      f = 1,
      tot = 0;
    for (let i = 0; i < oct; i++) {
      v += amp * n2(x * f, y * f);
      tot += amp;
      amp *= 0.5;
      f *= 2;
    }
    return v / tot;
  };
  return { n2, fbm };
}
export const hash2 = hash;
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
