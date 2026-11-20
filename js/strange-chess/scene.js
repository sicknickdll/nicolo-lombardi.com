// The meadow: everything that is not a game object. A night field seen from above:
//   1. thousands of 1px grass strokes steered by a smooth noise flow field (it sways, and it leans
//      the way the wind is about to blow: it IS the wind gauge),
//   2. ASCII scenery (trunks, rocks, gravestones, a pillar) with soft shadows,
//   3. mist, sparkles, falling streaks, film grain, a vignette.
// All drawing is in device pixels. Two entry points: drawBack (grass + scenery + low mist) and
// drawFront (high mist, sparkles, vignette, grain), with the game's objects drawn in between.
import { makeNoise, clamp, lerp, smooth, hash2 } from "./noise.js";
import { makeRng } from "./rng.js";
import { makeScenery } from "./art.js";
import { renderSprite } from "./glyphs.js";

const TEAL = ["#6fb5a8", "#4f9488", "#7cc2b5", "#35756b"];
const GREEN = ["#5fb36a", "#3e7f4a", "#4f9a5a", "#2c6a3c"];
const BUCKET_ALPHA = [0.9, 0.7, 0.8, 0.55];
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mixHex = (a, b, t) => {
  const A = hex(a),
    B = hex(b);
  return A.map((v, i) => Math.round(v + (B[i] - v) * t));
};

export const SCENERY = {
  meadow: { trunks: 3, rocks: 6, tombs: 1, pillars: 0 },
  trapper: { trunks: 3, rocks: 4, tombs: 4, pillars: 0 },
  angler: { trunks: 2, rocks: 7, tombs: 0, pillars: 1 },
  prospector: { trunks: 2, rocks: 9, tombs: 1, pillars: 2 },
  woodcarver: { trunks: 4, rocks: 5, tombs: 2, pillars: 1 },
};
// how each boss tints the grass: mix 0 teal → 1 green; warm (amber), cold (blue), pale (lavender, the Moon)
export const THEMES = {
  title: { mix: 0.0, warm: 0, cold: 0.1, pale: 0 },
  trapper: { mix: 0.12, warm: 0, cold: 0.12, pale: 0 },
  angler: { mix: 0.0, warm: 0, cold: 0.45, pale: 0 },
  prospector: { mix: 0.7, warm: 0.5, cold: 0, pale: 0 },
  woodcarver: { mix: 0.9, warm: 0.05, cold: 0, pale: 0 },
  campfire: { mix: 0.4, warm: 0.7, cold: 0, pale: 0 },
  moon: { mix: 0.15, warm: 0, cold: 0.3, pale: 0.55 },
};

export function createMeadow({ atlas, seed = 7, reduce = false }) {
  const noise = makeNoise(seed);
  const gust = makeNoise(seed + 5);
  const rng = makeRng(seed);
  let W = 0,
    H = 0,
    dpr = 1;
  // grass
  let n = 0,
    X,
    Y,
    A0,
    LEN,
    PH,
    CB,
    RT,
    GI;
  let buckets = [];
  let bucketCols = [];
  const NB = 8;
  let grassCv = null,
    grassG = null,
    grassClock = 0,
    grassEvery = 1 / 22;
  // density grid under the board
  const GS = 8;
  let gw = 0,
    gh = 0,
    dens = null;
  let board = null; // { x, y, cw, ch } device px
  const cellInteg = new Float32Array(36).fill(4); // animated display value
  const cellTarget = new Float32Array(36).fill(4);
  let densDirty = true;
  // wind
  const wind = { x: 0, y: 0, amt: 0.0, tx: 0, ty: 0, tamt: 0, dirWarn: null, blowing: 0 };
  // theme
  let theme = { ...THEMES.title },
    themeTo = { ...THEMES.title };
  let dim = 0,
    dimTo = 0;
  let mist = 0.45,
    mistTo = 0.45;
  // layers
  let objects = null; // static scenery canvas
  let sceneryKind = "meadow";
  let mistTiles = [];
  let bloom = null,
    vignette = null,
    grain = [];
  let sparkles = [];
  let streaks = [];
  let time = 0;
  const mistOff = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];

  // ── static helpers ────────────────────────────────────────────────────────────────────────
  function makeMistTiles() {
    mistTiles = [];
    for (let k = 0; k < 3; k++) {
      const P = 6;
      const S = 160;
      // periodic fractal noise: the lattice wraps every P·2^o cells, so the tile repeats seamlessly
      const oct = [0, 1, 2, 3].map((o) => makeNoise(seed * 3 + k * 17 + o * 101, P * 2 ** o));
      const cv = document.createElement("canvas");
      cv.width = cv.height = S;
      const g = cv.getContext("2d");
      const img = g.createImageData(S, S);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          let v = 0,
            amp = 0.55,
            tot = 0;
          for (let o = 0; o < 4; o++) {
            const f = 2 ** o;
            v += amp * oct[o].n2((x / S) * P * f, (y / S) * P * f);
            tot += amp;
            amp *= 0.5;
          }
          v /= tot;
          const i = (y * S + x) * 4;
          img.data[i] = 232;
          img.data[i + 1] = 236;
          img.data[i + 2] = 245;
          img.data[i + 3] = Math.round(smooth(0.42, 0.82, v) * 255);
        }
      g.putImageData(img, 0, 0);
      mistTiles.push(cv);
    }
  }
  function makeGrain() {
    grain = [];
    for (let k = 0; k < 3; k++) {
      const S = 160;
      const cv = document.createElement("canvas");
      cv.width = cv.height = S;
      const g = cv.getContext("2d");
      const img = g.createImageData(S, S);
      for (let i = 0; i < S * S; i++) {
        const v = Math.random() < 0.5 ? 255 : 0;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = Math.random() * 50;
      }
      g.putImageData(img, 0, 0);
      grain.push(cv);
    }
  }
  function makeBloom() {
    bloom = document.createElement("canvas");
    bloom.width = bloom.height = 64;
    const g = bloom.getContext("2d");
    const k = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    k.addColorStop(0, "rgba(160,200,255,0.55)");
    k.addColorStop(0.35, "rgba(110,160,255,0.18)");
    k.addColorStop(1, "rgba(80,120,255,0)");
    g.fillStyle = k;
    g.fillRect(0, 0, 64, 64);
  }

  // ── grass ─────────────────────────────────────────────────────────────────────────────────
  function buildGrass() {
    const area = (W * H) / (dpr * dpr);
    const target = Math.min(reduce ? 16000 : 34000, Math.round(area / (W < 700 * dpr ? 44 : 28)));
    X = new Float32Array(target);
    Y = new Float32Array(target);
    A0 = new Float32Array(target);
    LEN = new Float32Array(target);
    PH = new Float32Array(target);
    CB = new Uint8Array(target);
    RT = new Float32Array(target);
    GI = new Int32Array(target);
    gw = Math.ceil(W / GS) + 1;
    gh = Math.ceil(H / GS) + 1;
    dens = new Float32Array(gw * gh).fill(1);
    const r = makeRng(seed * 7);
    let k = 0,
      tries = 0;
    while (k < target && tries < target * 6) {
      tries++;
      const x = r() * W,
        y = r() * H;
      // thick, bright patches and sparse, dark ones
      const patch = noise.fbm((x / dpr) * 0.0042, (y / dpr) * 0.0042, 3);
      const keep = 0.1 + 1.0 * smooth(0.36, 0.66, patch);
      if (r() > keep) continue;
      X[k] = x;
      Y[k] = y;
      const flow = noise.fbm((x / dpr) * 0.0031 + 9, (y / dpr) * 0.0031 + 3, 3);
      const eddy = noise.n2((x / dpr) * 0.021 + 40, (y / dpr) * 0.021 + 11);
      // a smooth flow field, an eddy on top of it and a little per-blade scatter: mostly upright, ±40°
      A0[k] = clamp((flow - 0.5) * 2.6 + (eddy - 0.5) * 1.3 + (r() - 0.5) * 0.5, -0.74, 0.74);
      LEN[k] = (4.5 + r() * 6.5) * dpr * (0.75 + 0.55 * patch);
      PH[k] = (x / dpr) * 0.011 + (y / dpr) * 0.007 + r() * 0.7;
      // brighter strokes in thick patches
      const bright = smooth(0.35, 0.8, patch);
      CB[k] = (r() < bright * 0.8 ? 0 : 2) + (r() < 0.45 ? 1 : 0) + (r() < 0.25 ? 4 : 0);
      RT[k] = r();
      GI[k] = clamp(Math.floor(y / GS), 0, gh - 1) * gw + clamp(Math.floor(x / GS), 0, gw - 1);
      k++;
    }
    n = k;
    buckets = Array.from({ length: NB }, () => []);
    for (let i = 0; i < n; i++) buckets[CB[i]].push(i);
    buckets = buckets.map((b) => Uint32Array.from(b));
    grassCv = document.createElement("canvas");
    grassCv.width = W;
    grassCv.height = H;
    grassG = grassCv.getContext("2d", { alpha: false });
    densDirty = true;
    grassClock = 1;
  }
  function bucketColors() {
    const t = theme;
    return Array.from({ length: NB }, (_, b) => {
      const base = b % 4;
      let c = mixHex(TEAL[base], GREEN[base], t.mix);
      c = c.map((v, i) => v + (mixHex("#b89a48", "#b89a48", 0)[i] - v) * t.warm * 0.4);
      c = c.map((v, i) => v + (hex("#6f8fd0")[i] - v) * t.cold * 0.3);
      c = c.map((v, i) => v + (hex("#aab4e8")[i] - v) * t.pale * 0.45);
      const k = 1 - dim * 0.55;
      const a = BUCKET_ALPHA[base] * (b >= 4 ? 0.6 : 1) * k;
      return `rgba(${c.map((v) => Math.round(v)).join(",")},${a.toFixed(3)})`;
    });
  }
  function updateDensity() {
    if (!board || !dens) return;
    dens.fill(1);
    const { x: bx, y: by, cw, ch } = board;
    const x0 = Math.max(0, Math.floor((bx - cw * 0.6) / GS)),
      x1 = Math.min(gw - 1, Math.ceil((bx + cw * 6.6) / GS));
    const y0 = Math.max(0, Math.floor((by - ch * 0.6) / GS)),
      y1 = Math.min(gh - 1, Math.ceil((by + ch * 6.6) / GS));
    const nodeE = (i, j) => {
      // erosion density of a cell node (outside the board: 1; a hole counts as solid here)
      if (i < 0 || j < 0 || i > 5 || j > 5) return 1;
      const v = cellInteg[j * 6 + i];
      return v <= 0.01 ? 1 : 0.5 + 0.5 * clamp(v / 4);
    };
    const nodeH = (i, j) => {
      if (i < 0 || j < 0 || i > 5 || j > 5) return 0;
      return cellInteg[j * 6 + i] <= 0.01 ? 1 : 0;
    };
    for (let gy = y0; gy <= y1; gy++)
      for (let gx = x0; gx <= x1; gx++) {
        const px = gx * GS + GS / 2,
          py = gy * GS + GS / 2;
        const u = (px - bx) / cw - 0.5,
          v = (py - by) / ch - 0.5; // cell-centre coordinates
        const i0 = Math.floor(u),
          j0 = Math.floor(v);
        const fx = u - i0,
          fy = v - j0;
        const bil = (f) => lerp(lerp(f(i0, j0), f(i0 + 1, j0), fx), lerp(f(i0, j0 + 1), f(i0 + 1, j0 + 1), fx), fy);
        const e = bil(nodeE),
          h = bil(nodeH);
        // the clearing: a touch thinner inside the board, blending out over its border
        const inside = smooth(-0.55, 0.15, Math.min(u + 0.5, 6.5 - (u + 0.5) + 0.0, v + 0.5, 6.5 - (v + 0.5)) - 0.0) * 1;
        const clear = 1 - 0.2 * inside;
        dens[gy * gw + gx] = clear * e * (1 - smooth(0.3, 0.7, h));
      }
    densDirty = false;
  }
  function drawGrass(dt) {
    const g = grassG;
    const bg = g.createRadialGradient(W * 0.5, H * 0.38, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.8);
    bg.addColorStop(0, "#0b1424");
    bg.addColorStop(1, "#05070d");
    g.globalCompositeOperation = "source-over";
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.lineWidth = Math.max(1, dpr * 0.9);
    g.lineCap = "butt";
    const t = time;
    const sway = reduce ? 0 : 0.17;
    const w = wind;
    const lean = w.x * 0.62 * w.amt;
    const stretch = 1 - w.y * 0.3 * w.amt; // north (y<0) stretches the blades, south flattens them
    const tight = 1 - Math.abs(w.y) * 0.45 * w.amt; // and straightens them
    const gk = (w.x * 0.011 + w.y * 0.008) * dpr; // the gust travels with the wind
    for (let b = 0; b < NB; b++) {
      const list = buckets[b];
      if (!list.length) continue;
      g.strokeStyle = bucketCols[b];
      g.beginPath();
      for (let q = 0; q < list.length; q++) {
        const i = list[q];
        if (RT[i] > dens[GI[i]]) continue;
        const x = X[i],
          y = Y[i];
        const wave = Math.sin(t * 0.7 + PH[i]);
        const gu = w.amt > 0.02 ? 0.55 + 0.45 * Math.sin(t * 2.1 - (x * w.x + y * w.y) * gk * 0.5 + PH[i] * 0.3) : 1;
        const a = A0[i] * tight + sway * wave + lean * gu;
        const l = LEN[i] * stretch * (1 - Math.abs(a) * 0.12);
        g.moveTo(x, y);
        g.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l);
      }
      g.stroke();
    }
    void dt;
  }

  // ── scenery ───────────────────────────────────────────────────────────────────────────────
  function buildObjects() {
    objects = document.createElement("canvas");
    objects.width = W;
    objects.height = H;
    const g = objects.getContext("2d");
    const cell = { w: atlas.cw / dpr, h: atlas.ch / dpr };
    const set = SCENERY[sceneryKind] || SCENERY.meadow;
    const r = makeRng(seed * 13 + sceneryKind.length);
    const cssW = W / dpr,
      cssH = H / dpr;
    const items = [];
    // tall trunks at the edges: columns that run off the top of the screen
    const tw = Math.max(cssW < 600 ? 30 : 64, cssW * 0.1);
    const tpos = [0.02, 0.985, 0.15, 0.87, 0.24, 0.77].slice(0, set.trunks);
    tpos.forEach((fx, i) => {
      const w = tw * (0.9 + r() * 0.5) * (i > 1 ? 0.7 : 1);
      items.push({ kind: "trunk", x: fx * cssW, y: cssH * (0.82 + r() * 0.2), w, h: w * 4.6, pal: "bark", z: 0 });
    });
    // things scattered round the board, never on it
    const b = board ? { x: board.x / dpr, y: board.y / dpr, w: (board.cw * 6) / dpr, h: (board.ch * 6) / dpr } : { x: cssW * 0.2, y: cssH * 0.25, w: cssW * 0.6, h: cssH * 0.5 };
    const clear = (x, y, w, h) => !(x + w / 2 > b.x - 14 && x - w / 2 < b.x + b.w + 14 && y > b.y - 10 && y - h < b.y + b.h + 24);
    const place = (kind, count, wmin, wmax, aspect, pal) => {
      let tries = 0;
      while (count > 0 && tries++ < 80) {
        const w = wmin + r() * (wmax - wmin);
        const x = r() * cssW,
          y = cssH * (0.12 + r() * 0.9);
        if (!clear(x, y, w, w * aspect)) continue;
        items.push({ kind, x, y, w, h: w * aspect, pal, z: y });
        count--;
      }
    };
    const unit = Math.min(cssW, cssH);
    place("rock", set.rocks, unit * 0.05, unit * 0.12, 0.8, "stone");
    place("tomb", set.tombs, unit * 0.06, unit * 0.09, 1.4, "stone");
    place("pillar", set.pillars, unit * 0.06, unit * 0.08, 2.8, "stone");
    items.sort((a, c) => a.z - c.z);
    items.forEach((it, i) => {
      const sp = makeScenery(cell, it.kind, it.w, it.h, 3 + i * 5 + sceneryKind.length);
      const cv = renderSprite(atlas, sp, it.pal, { bg: it.kind === "trunk" ? "rgba(3,5,12,0.72)" : "rgba(3,5,12,0.55)" });
      const dx = Math.round(it.x * dpr - cv.width / 2),
        dy = Math.round(it.y * dpr - cv.height);
      // a long soft shadow on the grass, falling right and down
      const sh = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      sh.addColorStop(0, "rgba(2,3,8,0.62)");
      sh.addColorStop(0.6, "rgba(2,3,8,0.32)");
      sh.addColorStop(1, "rgba(2,3,8,0)");
      g.save();
      g.translate(it.x * dpr + it.w * dpr * 0.35, it.y * dpr - it.w * dpr * 0.05);
      g.scale(it.w * dpr * (it.kind === "trunk" ? 0.95 : 0.85), it.w * dpr * (it.kind === "trunk" ? 0.55 : 0.4));
      g.fillStyle = sh;
      g.fillRect(-1.5, -1.5, 3, 3);
      g.restore();
      g.drawImage(cv, dx, dy);
    });
  }

  function makeVignette() {
    vignette = document.createElement("canvas");
    vignette.width = Math.max(2, Math.round(W / 4));
    vignette.height = Math.max(2, Math.round(H / 4));
    const g = vignette.getContext("2d");
    const k = g.createRadialGradient(vignette.width / 2, vignette.height * 0.46, vignette.height * 0.2, vignette.width / 2, vignette.height / 2, Math.max(vignette.width, vignette.height) * 0.72);
    k.addColorStop(0, "rgba(3,5,12,0)");
    k.addColorStop(1, "rgba(3,5,12,0.72)");
    g.fillStyle = k;
    g.fillRect(0, 0, vignette.width, vignette.height);
  }
  function seedSparkles() {
    sparkles = [];
    const c = Math.round(Math.min(90, (W * H) / (dpr * dpr) / 9000));
    for (let i = 0; i < c; i++)
      sparkles.push({ x: rng() * W, y: rng() * H, ph: rng() * 6.28, sp: 0.6 + rng() * 2.4, s: rng() < 0.2 ? 2 : 1, kind: rng() < 0.14 ? 1 : rng() < 0.1 ? 2 : 0, blue: rng() < 0.4 });
  }

  // ── public ────────────────────────────────────────────────────────────────────────────────
  const api = {
    get dpr() {
      return dpr;
    },
    resize(w, h, ratio, boardRect) {
      W = Math.round(w * ratio);
      H = Math.round(h * ratio);
      dpr = ratio;
      board = boardRect ? { x: boardRect.x * ratio, y: boardRect.y * ratio, cw: boardRect.cw * ratio, ch: boardRect.ch * ratio } : null;
      if (!mistTiles.length) makeMistTiles();
      if (!grain.length) makeGrain();
      if (!bloom) makeBloom();
      buildGrass();
      bucketCols = bucketColors();
      buildObjects();
      makeVignette();
      seedSparkles();
      updateDensity();
    },
    setScenery(kind) {
      if (kind === sceneryKind && objects) return;
      sceneryKind = kind;
      if (W) buildObjects();
    },
    // integrity of one square (0 = hole); animated
    setIntegrity(i, v, instant = false) {
      cellTarget[i] = v;
      if (instant) cellInteg[i] = v;
      densDirty = true;
    },
    setAllIntegrity(arr, instant = true) {
      arr.forEach((v, i) => api.setIntegrity(i, v, instant));
    },
    setTheme(name, instant = false) {
      themeTo = { ...(THEMES[name] || THEMES.title) };
      if (instant) theme = { ...themeTo };
      bucketCols = bucketColors();
    },
    setDim(v) {
      dimTo = v;
    },
    setMist(v) {
      mistTo = v;
    },
    // direction: 0..3 | null; blowing 0..1; warn: coming direction | null
    setWind({ dir = null, warn = null, blowing = 0 }) {
      const D = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ];
      const d = dir != null ? D[dir] : warn != null ? D[warn] : [0, 0];
      wind.tx = d[0];
      wind.ty = d[1];
      wind.tamt = dir != null ? 1 * blowing : warn != null ? 0.55 : 0;
    },
    update(dt) {
      time += reduce ? 0 : dt;
      const k = 1 - Math.pow(0.04, dt);
      wind.x += (wind.tx - wind.x) * k * 0.6;
      wind.y += (wind.ty - wind.y) * k * 0.6;
      wind.amt += (wind.tamt - wind.amt) * k * 0.5;
      dim += (dimTo - dim) * k * 0.7;
      mist += (mistTo - mist) * k * 0.4;
      let tchanged = false;
      for (const key of ["mix", "warm", "cold", "pale"]) {
        const d = themeTo[key] - theme[key];
        if (Math.abs(d) > 0.001) {
          theme[key] += d * k * 0.5;
          tchanged = true;
        }
      }
      if (tchanged || Math.abs(dim - dimTo) > 0.003) bucketCols = bucketColors();
      for (let i = 0; i < 36; i++) {
        const d = cellTarget[i] - cellInteg[i];
        if (Math.abs(d) > 0.003) {
          cellInteg[i] += d * Math.min(1, dt * 3.2);
          densDirty = true;
        } else cellInteg[i] = cellTarget[i];
      }
      if (densDirty) updateDensity();
      grassClock += dt;
      if (grassClock >= grassEvery) {
        drawGrass(grassClock);
        grassClock = 0;
      }
      const sp = reduce ? 0 : 1;
      mistOff.forEach((o, i) => {
        const v = (6 + i * 7) * dpr * sp;
        o.x += (wind.x * (1 + wind.amt * 3) + 0.55 + i * 0.1) * v * dt;
        o.y += (wind.y * (1 + wind.amt * 3) - 0.08) * v * dt;
      });
      for (const s of streaks) (s.x += s.vx * dt), (s.y += s.vy * dt), (s.life -= dt);
      streaks = streaks.filter((s) => s.life > 0);
      if (!reduce && Math.random() < dt * 0.22) {
        const a = Math.PI * (0.38 + Math.random() * 0.2) + (wind.x ? wind.x * 0.2 : 0);
        const sp2 = (260 + Math.random() * 220) * dpr;
        streaks.push({ x: Math.random() * W, y: -10, vx: Math.cos(a) * sp2 * 0.5, vy: Math.sin(a) * sp2, life: 0.7 + Math.random() * 0.5, len: (30 + Math.random() * 50) * dpr });
      }
    },
    drawBack(ctx) {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.drawImage(grassCv, 0, 0);
      ctx.drawImage(objects, 0, 0);
      drawMistLayer(ctx, 0, 0.6);
    },
    drawFront(ctx, frame) {
      drawMistLayer(ctx, 1, 0.8);
      drawMistLayer(ctx, 2, 1.0);
      // sparkles
      for (const s of sparkles) {
        const tw = reduce ? 0.6 : 0.5 + 0.5 * Math.sin(time * s.sp + s.ph);
        const a = 0.18 + 0.82 * tw * tw;
        if (s.kind === 1) {
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = a * 0.7;
          const R = 11 * dpr;
          ctx.drawImage(bloom, s.x - R, s.y - R, R * 2, R * 2);
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.globalAlpha = a;
        ctx.fillStyle = s.blue ? "#cfe0ff" : "#ffffff";
        if (s.kind === 2) {
          // a tiny ring, like the o of ref 3
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = Math.max(1, dpr * 0.8);
          ctx.beginPath();
          ctx.arc(s.x, s.y, 2.2 * dpr, 0, 6.3);
          ctx.stroke();
        } else {
          const z = s.s * dpr;
          ctx.fillRect(Math.round(s.x), Math.round(s.y), z, z);
          if (s.kind === 1 && tw > 0.6) {
            ctx.fillRect(Math.round(s.x) - 2 * dpr, Math.round(s.y), 5 * dpr, Math.max(1, dpr * 0.6));
            ctx.fillRect(Math.round(s.x), Math.round(s.y) - 2 * dpr, Math.max(1, dpr * 0.6), 5 * dpr);
          }
        }
      }
      // falling streaks
      ctx.lineCap = "round";
      for (const s of streaks) {
        ctx.globalAlpha = Math.min(1, s.life * 1.6) * 0.5;
        ctx.strokeStyle = "#cfe0ff";
        ctx.lineWidth = Math.max(1, dpr * 0.8);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - (s.vx / Math.hypot(s.vx, s.vy)) * s.len, s.y - (s.vy / Math.hypot(s.vx, s.vy)) * s.len);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // vignette, dimming, grain
      ctx.drawImage(vignette, 0, 0, W, H);
      if (dim > 0.004) {
        ctx.fillStyle = `rgba(3,5,12,${(dim * 0.62).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (reduce) frame = 0; // reduced motion: the grain stays still
      const gi = (frame >> 2) % grain.length;
      const pat = ctx.createPattern(grain[gi], "repeat");
      ctx.save();
      ctx.translate((hash2(frame >> 2, 1, 3) * 160) | 0, (hash2(frame >> 2, 2, 3) * 160) | 0);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = pat;
      ctx.fillRect(-160, -160, W + 320, H + 320);
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  };

  function drawMistLayer(ctx, i, k) {
    const tile = mistTiles[i];
    if (!tile) return;
    const sc = (2.4 + i * 1.1) * dpr;
    const o = mistOff[i];
    ctx.save();
    ctx.globalAlpha = clamp(mist * k * (0.11 + 0.06 * i) * (1 + dim * 0.8), 0, 0.42);
    ctx.setTransform(sc, 0, 0, sc, -((o.x % (tile.width * sc)) + tile.width * sc) % (tile.width * sc), -((o.y % (tile.height * sc)) + tile.height * sc) % (tile.height * sc));
    ctx.fillStyle = ctx.createPattern(tile, "repeat");
    ctx.fillRect(0, 0, (W / sc) * 1 + tile.width * 2, (H / sc) * 1 + tile.height * 2);
    ctx.restore();
  }
  return api;
}
