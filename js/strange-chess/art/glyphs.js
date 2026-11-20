// Colours, character ramps and a small cache of pre-rendered glyphs (for particles, debris,
// mist and dots that are drawn every frame: drawImage from a cached canvas is much cheaper than
// fillText).
export const FONT = '"Geist Mono", ui-monospace, Menlo, Consolas, monospace';

export const PAL = {
  void: [5, 7, 13],
  void2: [10, 16, 32],
  teal: [[95, 165, 154], [124, 194, 181], [62, 127, 74], [79, 154, 90]],
  lav: [143, 151, 201],
  pale: [195, 200, 236],
  shadow: [42, 48, 80],
  mist: [232, 236, 245],
  spark: [207, 224, 255],
  crimson: [122, 31, 43],
  gold: [217, 184, 74],
  iron: [150, 158, 170],
};
// Characters by how much ink they carry, darkest first. A shaded surface picks from the bucket
// that matches its brightness, so the shape reads through the density of the characters.
export const RAMP = [".,'`", ":;-~^", "coesxzv", "awbdqpun", "O0Q8B%&", "@MW#$"];

export const rgb = (c, a = 1) => (a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${+a.toFixed(3)})`);
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// Piecewise colour ramp: stops = [[t, colour], ...] with t ascending.
export function ramp(stops, t) {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++)
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1],
        [t1, c1] = stops[i];
      return mix(c0, c1, (t - t0) / (t1 - t0));
    }
  return stops[stops.length - 1][1];
}
// Hue shift of an RGB colour (degrees), used for the bosses' tint of the meadow.
export function hueShift(c, deg, sat = 1) {
  const [r, g, b] = c.map((v) => v / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2;
  let h = 0,
    s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  h = (((h + deg / 360) % 1) + 1) % 1;
  s = Math.min(1, s * sat);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s,
    p = 2 * l - q;
  const f = (t) => {
    t = ((t % 1) + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return s === 0 ? [l * 255, l * 255, l * 255] : [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

// One cached canvas per (character, colour, size): drawn with drawImage, centred on (x, y).
const cache = new Map();
export function glyph(ch, color, px, dpr) {
  const key = ch + "|" + color + "|" + px + "|" + dpr;
  let g = cache.get(key);
  if (g) return g;
  const w = Math.ceil(px * 0.7) + 2,
    h = Math.ceil(px * 1.2) + 2;
  const c = document.createElement("canvas");
  c.width = Math.ceil(w * dpr);
  c.height = Math.ceil(h * dpr);
  const x = c.getContext("2d");
  x.scale(dpr, dpr);
  x.font = `${px}px ${FONT}`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillStyle = color;
  x.fillText(ch, w / 2, h / 2);
  g = { c, w, h };
  if (cache.size > 4000) cache.clear();
  cache.set(key, g);
  return g;
}
export function drawGlyph(ctx, ch, color, px, x, y, dpr) {
  const g = glyph(ch, color, px, dpr);
  ctx.drawImage(g.c, x - g.w / 2, y - g.h / 2, g.w, g.h);
}
// A soft round light, for bloom on sparkles and flames.
const blooms = new Map();
export function bloomSprite(color, r = 16) {
  const key = color + r;
  if (blooms.has(key)) return blooms.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = r * 2;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, r * 2, r * 2);
  blooms.set(key, c);
  return c;
}
