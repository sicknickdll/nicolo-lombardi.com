// The tank's backdrop: blocky rock terraces at three depths (far, mid, near), coral domes, seaweed,
// the sand floor. Built once per size / light into canvases; js/aquarium/tank.js slides them for
// parallax and draws the fish between them.

// slots, as in tank.js: 0 water/rock · 1 sand · 2–7 tints · 8 gold · 9 heart · 10 food
const SAND = 1,
  LILAC = 3,
  MINT = 5,
  HEART = 9;

const FACE = ".,:;'-=+";
const hash = (x, y, z = 0) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
const rng = (seed) => () => ((seed = (seed + 0x6d2b79f5) | 0), (((seed ^ (seed >>> 15)) * (seed | 1)) >>> 0) / 4294967296);

export function grid(cols, rows) {
  return { cols, rows, ch: new Uint16Array(cols * rows), lv: new Uint8Array(cols * rows), sl: new Uint8Array(cols * rows) };
}
export function gput(g, c, r, ch, lv, sl) {
  if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return;
  const i = r * g.cols + c;
  g.ch[i] = typeof ch === "number" ? ch : ch.charCodeAt(0);
  g.lv[i] = lv < 0 ? 0 : lv > 9 ? 9 : Math.round(lv);
  g.sl[i] = sl;
}

// Paint a grid, one colour at a time.
const buckets = Array.from({ length: 110 }, () => []);
export function paint(ctx, g, { cw, lh, fs, font, palette, ox = 0 }) {
  for (const b of buckets) b.length = 0;
  for (let i = 0; i < g.ch.length; i++) if (g.ch[i]) buckets[g.sl[i] * 10 + g.lv[i]].push(i);
  ctx.font = `${fs}px ${font}`;
  ctx.textBaseline = "top";
  const oy = (lh - fs) / 2;
  for (let k = 0; k < buckets.length; k++) {
    const b = buckets[k];
    if (!b.length) continue;
    ctx.fillStyle = palette[(k / 10) | 0][k % 10];
    for (const i of b) ctx.fillText(String.fromCharCode(g.ch[i]), ox + (i % g.cols) * cw, ((i / g.cols) | 0) * lh + oy);
  }
}

function terraces(n, rnd, { lo, hi, minW, maxW, gap = 0, only = null }) {
  const T = new Int16Array(n).fill(32767);
  let c = 0,
    h = lo + rnd() * (hi - lo);
  while (c < n) {
    const w = minW + ((rnd() * (maxW - minW)) | 0),
      empty = rnd() < gap;
    h = Math.max(lo, Math.min(hi, h + (rnd() - 0.5) * (hi - lo) * 1.1));
    for (let i = 0; i < w && c < n; i++, c++) if (!empty && (!only || only(c))) T[c] = Math.round(h);
  }
  return T;
}

function rock(g, T, o) {
  const { bright, sparse, depth, seed, rnd, coral, weed } = o;
  const n = g.cols;
  for (let c = 0; c < n; c++) {
    const t = T[c];
    if (t >= g.rows) continue;
    const L = c > 0 ? T[c - 1] : t,
      R = c < n - 1 ? T[c + 1] : t;
    for (let r = t; r < g.rows; r++) {
      const d = r - t,
        hv = hash(c, r, seed);
      if (d === 0) {
        const ch = L > t ? "/" : R > t ? "\\" : hv < 0.7 ? "=" : "_";
        gput(g, c, r, ch, 9 * bright, SAND);
        continue;
      }
      // the side of a step catches the light
      if ((L > r && L > t) || (R > r && R > t)) {
        gput(g, c, r, hv < 0.8 ? "|" : "!", (7 - d * 0.25) * bright, 0);
        continue;
      }
      if (hv < sparse * (0.6 + d / depth)) continue;
      if (r % 5 === (seed & 3) && hash(c >> 2, r, seed) < 0.45) {
        gput(g, c, r, "-", 4 * bright, 0);
        continue;
      }
      const lit = Math.max(0.05, 1 - d / depth) * (0.7 + 0.5 * hash(c >> 3, r >> 1, seed));
      gput(g, c, r, FACE[Math.min(FACE.length - 1, (lit * FACE.length) | 0)], (1 + lit * 5) * bright, 0);
    }
    if (hash(c, t, seed + 5) < 0.18) gput(g, c, t - 1, hash(c, t, seed + 6) < 0.5 ? "." : ",", 5 * bright, SAND);
  }
  // coral domes and seaweed on the ledges
  let c = 0;
  while (c < n) {
    const t = T[c];
    let e = c;
    while (e < n && T[e] === t) e++;
    const w = e - c;
    if (t < g.rows && w >= 7 && rnd() < coral) {
      const wd = Math.min(w * 0.8, 6 + rnd() * 12),
        hd = 2 + ((rnd() * 3) | 0),
        cx = c + w / 2 + (rnd() - 0.5) * (w - wd) * 0.6,
        slot = rnd() < 0.6 ? HEART : LILAC;
      for (let dy = 1; dy <= hd; dy++)
        for (let dx = -wd / 2; dx <= wd / 2; dx++) {
          const q = (dx / (wd / 2)) ** 2 + ((dy - 0.5) / hd) ** 2;
          if (q > 1) continue;
          const col = Math.round(cx + dx),
            top = 1 - dy / (hd + 1);
          if (hash(col, dy, seed + 9) < 0.12 + q * 0.3) continue;
          gput(g, col, t - dy, "*%o@&8#*o"[(hash(col, t - dy, seed) * 9) | 0], (3 + (1 - top) * 5 - q * 2) * bright, slot);
        }
    }
    if (t < g.rows)
      for (let k = c; k < e; k++)
        if (hash(k, t, seed + 3) < weed) {
          const hgt = 2 + ((hash(k, 1, seed) * 5) | 0);
          for (let j = 1; j <= hgt; j++) gput(g, k + (j % 3 === 0 ? 1 : 0), t - j, j % 2 ? ")" : "(", (6 - j * 0.4) * bright, MINT);
        }
    c = e;
  }
}

export function buildScene(o) {
  const { cols, rows, cw, lh, fs, font, palette, dpr, surfRow, sandH, margin, sand, haze, seed = 7 } = o;
  const mc = Math.ceil(margin / cw),
    n = cols + mc * 2,
    water = rows - surfRow,
    rnd = rng(seed);
  // each layer keeps only the rows it uses (y0 … bottom): smaller copies every frame
  const make = (r0 = 0) => {
    const c = document.createElement("canvas");
    c.width = Math.ceil(n * cw * dpr);
    c.height = Math.ceil((rows - r0) * lh * dpr);
    c.y0 = r0 * lh;
    const x = c.getContext("2d");
    x.setTransform(dpr, 0, 0, dpr, 0, -r0 * lh * dpr);
    return [c, x];
  };
  const top = (T, extra) => Math.max(0, Math.min(...T) - extra);
  const at = (f) => Math.round(surfRow + water * f);
  const layer = (T, opts, bg) => {
    const g = grid(n, rows),
      [c, x] = make(bg ? 0 : top(T, 7));
    if (bg) {
      const gr = x.createLinearGradient(0, 0, 0, rows * lh);
      for (const [at, col] of bg) gr.addColorStop(at, col);
      x.fillStyle = gr;
      x.fillRect(0, 0, n * cw, rows * lh);
    }
    rock(g, T, { ...opts, rnd });
    paint(x, g, { cw, lh, fs, font, palette });
    return c;
  };
  const far = layer(terraces(n, rnd, { lo: at(0.22), hi: at(0.5), minW: 10, maxW: 30 }), { bright: 0.42, sparse: 0.55, depth: water * 0.55, seed: 11, coral: 0.5, weed: 0.02 }, haze);
  const mid = layer(terraces(n, rnd, { lo: at(0.48), hi: at(0.72), minW: 8, maxW: 22, gap: 0.3 }), { bright: 0.68, sparse: 0.25, depth: water * 0.4, seed: 23, coral: 0.55, weed: 0.05 });
  const edge = Math.max(10, n * 0.14);
  const near = layer(terraces(n, rnd, { lo: at(0.72), hi: at(0.86), minW: 5, maxW: 12, only: (c) => c < edge || c > n - edge }), { bright: 1, sparse: 0.05, depth: water * 0.3, seed: 37, coral: 0.6, weed: 0.12 });
  // the floor, under everything that swims
  const g = grid(n, rows),
    [floor, fx] = make(rows - Math.max(...sandH) - 1);
  for (let c = 0; c < n; c++) {
    const sc = Math.min(cols - 1, Math.max(0, c - mc)),
      top = rows - sandH[sc];
    for (let r = top; r < rows; r++) {
      const d = r - top,
        hv = hash(c, r);
      let ch = d === 0 ? (sandH[sc - 1] > sandH[sc] ? "\\" : sandH[sc + 1] > sandH[sc] ? "/" : "_") : hv < 0.35 ? "." : hv < 0.55 ? ":" : hv < 0.68 ? "," : hv < 0.75 ? ";" : " ";
      if (sand === "ripple" && d > 0 && Math.sin(c * 0.5 + r * 2.4) > 0.75) ch = "~";
      if (sand === "pebble" && d > 0 && hv > 0.93) ch = hv > 0.975 ? "O" : "o";
      if (ch !== " ") gput(g, c, r, ch, d === 0 ? 7 : 6 - d * 0.6, SAND);
    }
  }
  paint(fx, g, { cw, lh, fs, font, palette });
  return { far, mid, near, floor, x0: -mc * cw };
}
