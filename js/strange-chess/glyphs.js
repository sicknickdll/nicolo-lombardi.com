// ASCII sculpture: every object in the game (pieces, trees, rocks, gravestones, the Moon, the
// scale) is a block of small monospace characters. A shape is first drawn as a plain vector
// silhouette, then turned into characters: character weight follows the lighting of a rounded
// surface (cylindrical shading), the colour follows it too, and the edges dissolve into
// the grass instead of ending in an outline.
import { hash2, clamp, smooth } from "./noise.js";

// Light to dense: the heaviest characters sit in the lit parts.
export const RAMP = [" ", ".", ":", "-", "+", "o", "e", "s", "a", "w", "d", "b", "0", "O", "Q", "8", "B", "%", "&", "#", "$", "W", "M", "@"];
export const SHADES = 7;
// extra characters for the interface glyphs (the scale, flames, the fishing line, traps)
export const EXTRA = "|/\\_~[]=<>^()*'`+;,!?xv·";
export const CHARS = RAMP.concat([...EXTRA]);
export const charIndex = (c) => {
  const i = CHARS.indexOf(c);
  return i < 0 ? 1 : i;
};

// Shadow → light. A palette's last colours are used on the lit side.
export const PALETTES = {
  bone: ["#1d2240", "#2a3050", "#4a5384", "#8f97c9", "#a9b0dd", "#c3c8ec", "#eef0ff"], // the player's pieces
  slate: ["#12090f", "#2a0f1a", "#3a1a2c", "#4a456e", "#626a98", "#7e87b2", "#a7aed6"], // boss pieces: darker, crimson in the shadow
  bark: ["#0a0f1c", "#141b2e", "#232c4a", "#3b4570", "#59639a", "#8f97c9", "#c3c8ec"],
  stone: ["#0d1322", "#1a2138", "#2a3050", "#434c78", "#6a74a8", "#8f97c9", "#c3c8ec"],
  gold: ["#2a1d08", "#4a3512", "#7a5a1c", "#b08a2c", "#d9b84a", "#efd480", "#fff3c0"],
  iron: ["#14161c", "#22262e", "#383d48", "#5a6070", "#8a8f9a", "#b4b8c2", "#e0e2e8"],
  moon: ["#252a4a", "#3a4270", "#5d679c", "#8f97c9", "#b8bfe6", "#e8ecf5", "#ffffff"],
  crimson: ["#1f0a10", "#3a1018", "#5a1822", "#7a1f2b", "#a0303e", "#c85060", "#e88090"],
  dust: ["#0a0e1a", "#141a2c", "#222a44", "#38426a", "#566090", "#7a85b5", "#a4aee0"],
  grass: ["#10241f", "#1c3a34", "#2d5c52", "#3e7f4a", "#5fa59a", "#7cc2b5", "#aee6da"],
  white: ["#4a5070", "#6a7090", "#9aa1c8", "#c3c8ec", "#dfe4f8", "#f2f5ff", "#ffffff"],
};
export const PAL_NAMES = Object.keys(PALETTES);

// Pre-rendered characters: one row per (palette, shade), one column per character.
export function createAtlas(fontPx, dpr, family = '"Geist Mono", ui-monospace, Menlo, monospace') {
  const probe = document.createElement("canvas").getContext("2d");
  const font = `${Math.round(fontPx * dpr)}px ${family}`;
  probe.font = font;
  const cw = Math.max(3, Math.round(probe.measureText("M").width));
  const ch = Math.max(4, Math.round(fontPx * dpr * 0.96));
  const canvas = document.createElement("canvas");
  canvas.width = cw * CHARS.length;
  canvas.height = ch * PAL_NAMES.length * SHADES;
  const g = canvas.getContext("2d");
  g.font = font;
  g.textBaseline = "middle";
  g.textAlign = "center";
  PAL_NAMES.forEach((name, pi) => {
    for (let sh = 0; sh < SHADES; sh++) {
      g.fillStyle = PALETTES[name][sh];
      const row = pi * SHADES + sh;
      for (let c = 1; c < CHARS.length; c++) g.fillText(CHARS[c], c * cw + cw / 2, row * ch + ch / 2 + 0.5 * dpr);
    }
  });
  const rowOf = (pal, sh) => PAL_NAMES.indexOf(pal) * SHADES + sh;
  // draw one character (any of CHARS) centred in a cell whose top-left is x, y (device px)
  const put = (ctx, c, pal, sh, x, y) => ctx.drawImage(canvas, charIndex(c) * cw, rowOf(pal, sh) * ch, cw, ch, Math.round(x), Math.round(y), cw, ch);
  // a whole string, left to right
  const text = (ctx, str, pal, sh, x, y) => {
    for (let i = 0; i < str.length; i++) if (str[i] !== " ") put(ctx, str[i], pal, sh, x + i * cw, y);
  };
  return { canvas, cw, ch, font, rowOf, dpr, put, text };
}

// ── turning a silhouette into characters ─────────────────────────────────────────────────────
const LIGHT = (() => {
  const l = [-0.55, -0.62, 0.56],
    m = Math.hypot(...l);
  return l.map((v) => v / m);
})();

function boxBlur(src, cols, rows, r) {
  // separable box blur, r in cells
  const tmp = new Float32Array(src.length),
    out = new Float32Array(src.length);
  const R = Math.max(1, Math.round(r));
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      let s = 0;
      for (let k = -R; k <= R; k++) s += src[y * cols + clamp(x + k, 0, cols - 1)];
      tmp[y * cols + x] = s / (2 * R + 1);
    }
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      let s = 0;
      for (let k = -R; k <= R; k++) s += tmp[clamp(y + k, 0, rows - 1) * cols + x];
      out[y * cols + x] = s / (2 * R + 1);
    }
  return out;
}

// opts: w,h (css px), cw,ch (css px of one character), draw(ctx, W, H) paints the silhouette in white,
// mode "revolve" (a body of revolution: pieces, trunks, pillars) or "blob" (rocks, the knight's head),
// seed, bite (how much the edges dissolve), grain (brightness noise), gain, vertical (extra streaks), light
export function bakeSprite(o) {
  const cols = Math.max(2, Math.round(o.w / o.cw)),
    rows = Math.max(2, Math.round(o.h / o.ch));
  const SS = 5;
  const m = document.createElement("canvas");
  m.width = cols * SS;
  m.height = rows * SS;
  const g = m.getContext("2d", { willReadFrequently: true });
  g.fillStyle = "#fff";
  g.strokeStyle = "#fff";
  o.draw(g, m.width, m.height);
  const px = g.getImageData(0, 0, m.width, m.height).data;
  const cov = new Float32Array(cols * rows);
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < cols; cx++) {
      let s = 0;
      for (let y = 0; y < SS; y++) for (let x = 0; x < SS; x++) s += px[((cy * SS + y) * m.width + cx * SS + x) * 4 + 3];
      cov[cy * cols + cx] = s / (255 * SS * SS);
    }
  const seed = o.seed || 1;
  const bite = o.bite ?? 0.55,
    grain = o.grain ?? 0.07,
    gain = o.gain ?? 1;
  const L = o.light || LIGHT;
  const bright = new Float32Array(cols * rows);

  if (o.mode === "blob") {
    const r = Math.max(1, Math.min(cols, rows) * (o.round ?? 0.24));
    let hf = boxBlur(cov, cols, rows, r);
    hf = boxBlur(hf, cols, rows, r * 0.7);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (cov[i] < 0.05) continue;
        const gx = (hf[y * cols + Math.min(cols - 1, x + 1)] - hf[y * cols + Math.max(0, x - 1)]) * 0.5,
          gy = (hf[Math.min(rows - 1, y + 1) * cols + x] - hf[Math.max(0, y - 1) * cols + x]) * 0.5;
        const k = o.relief ?? 5.5;
        let nx = -gx * k,
          ny = -gy * k * 0.8,
          nz = 1;
        const nl = Math.hypot(nx, ny, nz);
        nx /= nl;
        ny /= nl;
        nz /= nl;
        bright[i] = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      }
  } else {
    // a body of revolution: per row, the horizontal extent gives the roundness
    const left = new Float32Array(rows).fill(-1),
      right = new Float32Array(rows).fill(-1);
    for (let y = 0; y < rows; y++) {
      let a = -1,
        b = -1;
      for (let x = 0; x < cols; x++)
        if (cov[y * cols + x] > 0.15) {
          if (a < 0) a = x;
          b = x;
        }
      if (a >= 0) {
        left[y] = a + 1 - Math.min(1, cov[y * cols + a] * 1.0);
        right[y] = b + Math.min(1, cov[y * cols + b]);
      }
    }
    // smooth over neighbouring rows so battlements and crowns keep a round body
    const sm = (arr, pick) => {
      const out = new Float32Array(rows);
      for (let y = 0; y < rows; y++) {
        let v = arr[y];
        for (const d of [-2, -1, 1, 2]) {
          const w = arr[clamp(y + d, 0, rows - 1)];
          if (w >= 0 && (v < 0 || pick(w, v))) v = w;
        }
        out[y] = v;
      }
      return out;
    };
    const L2 = sm(left, (w, v) => w < v),
      R2 = sm(right, (w, v) => w > v);
    for (let y = 0; y < rows; y++) {
      if (L2[y] < 0) continue;
      const c = (L2[y] + R2[y]) / 2,
        half = Math.max(0.6, (R2[y] - L2[y]) / 2);
      const hy = (R2[clamp(y + 1, 0, rows - 1)] - L2[clamp(y + 1, 0, rows - 1)] - (R2[clamp(y - 1, 0, rows - 1)] - L2[clamp(y - 1, 0, rows - 1)])) / 4;
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (cov[i] < 0.05) continue;
        const u = clamp((x + 0.5 - c) / half, -1, 1);
        const nz = Math.sqrt(Math.max(0.02, 1 - u * u));
        // the surface leans outwards where the profile widens (towards the base) and tilts back above
        let nx = u,
          ny = -hy * 0.6,
          nn = Math.hypot(nx, ny, nz);
        nx /= nn;
        ny /= nn;
        const nzz = nz / nn;
        bright[i] = Math.max(0, nx * L[0] + ny * L[1] + nzz * L[2]);
      }
    }
  }

  const ch = new Uint8Array(cols * rows),
    sh = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const cv = cov[i];
      if (cv < 0.1) continue;
      const r = hash2(x, y, seed),
        r2 = hash2(x + 91, y - 17, seed + 3);
      // the edges thin out and dissolve
      const keep = smooth(0.1, 0.1 + bite, cv);
      if (r > keep + 0.12) continue;
      let b = 0.05 + 0.95 * bright[i];
      b = (b - 0.5) * (o.contrast ?? 1.4) + 0.5 + (o.shift ?? -0.04);
      b = b * gain + (r2 - 0.5) * grain * 2;
      if (o.streaks) b += (hash2(x, 3, seed + 7) - 0.5) * o.streaks; // vertical bark / stone streaks
      b *= 0.55 + 0.45 * smooth(0.1, 0.9, cv);
      b = clamp(b);
      let ci;
      if (o.charset) {
        // a restricted set of characters (the gold block is all $ and &)
        const k = clamp(Math.floor(b * o.charset.length + (hash2(x, y, seed + 11) - 0.5) * 1.6), 0, o.charset.length - 1);
        ci = RAMP.indexOf(o.charset[k]);
      } else {
        ci = 1 + Math.floor(Math.pow(b, o.gamma || 0.9) * (RAMP.length - 2) + (hash2(x, y, seed + 11) - 0.5) * 2.2);
        ci = clamp(ci, 1, RAMP.length - 1);
      }
      ch[i] = ci;
      sh[i] = clamp(Math.floor(Math.pow(b, 1.15) * SHADES * 1.05), 0, SHADES - 1);
    }
  return { cols, rows, ch, sh, w: cols * o.cw, h: rows * o.ch, cw: o.cw, chh: o.ch, seed };
}

// Draws a sprite into a canvas (device pixels) using the atlas. shimmer: 0..1 share of characters nudged.
export function renderSprite(atlas, sprite, pal, { shimmer = 0, t = 0, into = null, boost = 0, bg = "rgba(3,5,12,0.6)" } = {}) {
  const { cw, ch } = atlas;
  const cv = into || document.createElement("canvas");
  cv.width = sprite.cols * cw;
  cv.height = sprite.rows * ch;
  const g = cv.getContext("2d");
  g.clearRect(0, 0, cv.width, cv.height);
  const palName = typeof pal === "string" ? pal : pal;
  for (let y = 0; y < sprite.rows; y++)
    for (let x = 0; x < sprite.cols; x++) {
      const i = y * sprite.cols + x;
      let c = sprite.ch[i];
      if (!c) continue;
      let s = sprite.sh[i];
      if (bg) {
        g.fillStyle = bg;
        g.fillRect(x * cw, y * ch, cw, ch);
      }
      if (shimmer) {
        const r = hash2(x, y, Math.floor(t * 7) + sprite.seed);
        if (r < shimmer) c = clamp(c + (r < shimmer / 2 ? 1 : -1) * (1 + (r * 977) % 2 | 0), 1, RAMP.length - 1);
      }
      s = clamp(s + boost, 0, SHADES - 1);
      g.drawImage(atlas.canvas, c * cw, atlas.rowOf(palName, s) * ch, cw, ch, x * cw, y * ch, cw, ch);
    }
  return cv;
}
