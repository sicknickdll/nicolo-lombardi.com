// The night meadow: the ground, the grass flow field, the scenery around the clearing, mist,
// sparkles and falling streaks. js/strange-chess/art/view.js puts the board, the pieces and the
// figures in it.
//
// Grass: thousands of 1px strokes. Each blade's angle = a smooth noise flow field (static) + its
// own random scatter + a slow sway + a travelling eddy term + the wind's lean. Without the scatter
// and the eddies the field reads as uniform rain; with them it reads as grass. Blades are binned
// by colour and brightness, so a frame is a few dozen stroke() calls, not thousands.
import { PAL, FONT, rgb, mix, hueShift, bloomSprite, drawGlyph } from "./glyphs.js";
import { sculpt } from "./sculpt.js";
import { rng, fbm, noise2, clamp, smooth, lerp } from "../rng.js";

const LEVELS = 10;
// The meadow's stroke colours (teal by default; refs 1–2), and a blue-grey for the cold patches.
const BLADE_COLORS = [PAL.teal[0], PAL.teal[1], [104, 140, 168], PAL.teal[3], PAL.teal[2]];

export function boardLayout(W, H) {
  const portrait = H > W * 1.15;
  const squash = portrait ? 0.8 : 0.76;
  const top = portrait ? 0.27 : 0.25,
    bottom = portrait ? 0.17 : 0.1;
  const sqW = Math.floor(Math.min((W * (portrait ? 0.94 : 0.6)) / 6, (H * (1 - top - bottom)) / (6 * squash), 118));
  const sqH = Math.round(sqW * squash);
  const bw = sqW * 6,
    bh = sqH * 6;
  const left = Math.round((W - bw) / 2);
  const topY = Math.round(H * top + (H * (1 - top - bottom) - bh) / 2);
  return {
    W,
    H,
    portrait,
    sqW,
    sqH,
    left,
    top: topY,
    bw,
    bh,
    // centre of square (x, y) on screen; y = 0 is the player's back rank (bottom)
    cx: (x) => left + (x + 0.5) * sqW,
    cy: (y) => topY + (5 - y + 0.5) * sqH,
    // square under a screen point, or null
    at(px, py) {
      const x = Math.floor((px - left) / sqW),
        y = 5 - Math.floor((py - topY) / sqH);
      return x >= 0 && x < 6 && y >= 0 && y < 6 ? { x, y } : null;
    },
    pieceCell: Math.max(4, Math.min(6, Math.round(sqW / 19))),
  };
}

export function createMeadow({ seed = 7, dpr = 1, reduce = false, low = false } = {}) {
  const M = {
    L: null,
    dpr,
    tint: 0, // hue shift in degrees (bosses)
    tintTarget: 0,
    sat: 1,
    wind: { x: 0, y: 0 }, // current lean, eased toward windTarget
    windTarget: { x: 0, y: 0 },
    gust: 0, // a short strong push when the wind blows
    dim: 0, // 0..1 darkening (phase changes)
    mistBoost: 0, // 0..1 extra mist (phase changes)
    clear: 0, // 0..1 the meadow clearing away (win screen)
    quality: 1, // 0..1 share of the grass drawn (lowered on slow devices)
    integrity: null, // function(x, y) → 0..4, for erosion and holes
    scenery: [],
    reduce,
  };
  let blades = null,
    groundCanvas = null,
    vignette = null,
    clouds = [],
    sparkles = [],
    streaks = [],
    colorTable = null,
    lastTint = null;

  function buildColorTable() {
    colorTable = BLADE_COLORS.map((c) => {
      const base = hueShift(c, M.tint, M.sat);
      return Array.from({ length: LEVELS }, (_, l) => {
        const k = 0.14 + (l / (LEVELS - 1)) * 0.95;
        // bright blades lift toward a pale mint, dark ones sink into the navy
        const col = k > 0.85 ? mix(base, [220, 240, 236], (k - 0.85) * 1.4) : mix(PAL.void2, base, k / 0.85);
        return rgb(col);
      });
    });
    lastTint = M.tint;
  }

  M.resize = function (W, H, dprNew) {
    M.dpr = dprNew;
    M.L = boardLayout(W, H);
    layoutScenery();
    buildGround();
    buildBlades();
    buildClouds();
    buildSparkles();
    buildColorTable();
    return M.L;
  };

  // ── scenery: trees, rocks, tombstones and a pillar around the clearing ──
  function layoutScenery() {
    const { W, H, left, top, bw, bh, portrait } = M.L;
    const R = rng(seed * 13 + 5);
    const ch = 8,
      cw = 5;
    const list = [];
    const add = (kind, x, y, w, h, o = {}) => list.push({ kind, x, y, w, h, ...o });
    const marginL = left,
      marginR = W - left - bw;
    if (!portrait) {
      // trunks on both sides, rising off the top of the screen (ref 2); nothing in the middle of
      // the side margins, where the candles (left) and the scale (right) stand
      if (marginL > 90) {
        add("trunk", left * 0.3, top + bh * 0.3, Math.min(110, marginL * 0.42), top + bh * 0.3 + 40);
        add("trunk", left * 0.78, top - 30, Math.min(80, marginL * 0.3), top + 10);
        add("tomb", left * 0.26, H - 46, 64, 86);
        add("tomb", left * 0.52, H - 14, 56, 74);
      }
      if (marginR > 90) {
        const rx = left + bw;
        add("trunk", rx + marginR * 0.74, top + bh * 0.24, Math.min(120, marginR * 0.45), top + bh * 0.24 + 60);
        add("trunk", rx + marginR * 0.26, top - 10, Math.min(70, marginR * 0.28), top + 30);
        add("pillar", rx + marginR * 0.8, H - 20, 60, 150);
        add("rock", rx + marginR * 0.4, H - 16, 150, 70, { seed: 9 });
      }
    } else {
      add("trunk", W * 0.08, top - 34, 60, top + 10);
      add("trunk", W * 0.93, top - 14, 52, top + 30);
      add("rock", W * 0.16, H - 24, 80, 40, { seed: 3 });
      add("tomb", W * 0.84, H - 30, 36, 46);
    }
    for (const s of list) {
      s.sprite = sculpt({
        shape: s.kind,
        arg: s.seed,
        w: s.w,
        h: s.h,
        cw,
        chH: ch,
        dpr: M.dpr,
        look: "scenery",
        normal: s.kind === "rock" ? "sphere" : "cyl",
        melt: s.kind === "trunk" ? 0.1 : 0.2,
        seed: Math.round(s.x + s.y),
        ambient: 0.07,
        gain: s.kind === "trunk" ? 0.85 : 1,
        halo: 6,
        variants: 1,
      });
      // the shadow each object casts, falling away from the light (down and to the right)
      s.shadow = { x: s.x + s.w * 0.35, y: s.y + 4, rx: s.w * (s.kind === "trunk" ? 1.3 : 0.9), ry: Math.max(14, s.w * 0.35) };
    }
    M.scenery = list;
  }
  // how much light reaches the grass at (x, y): object shadows and the canopy's dark bands
  function shade(x, y) {
    let s = 1;
    for (const o of M.scenery) {
      const sh = o.shadow,
        dx = (x - sh.x) / sh.rx,
        dy = (y - sh.y) / sh.ry;
      const d = dx * dx + dy * dy;
      if (d < 1) s *= lerp(0.18, 1, smooth(0.15, 1, d));
      // the trunk itself rises above its base: no grass behind it
      if (o.kind === "trunk" && Math.abs(x - o.x) < o.w * 0.42 && y < o.y && y > o.y - o.h) s *= 0.05;
    }
    // canopy: soft dark bands across the meadow (refs 1–2)
    const c = fbm(x * 0.0022 + 4.1, y * 0.0016, seed + 3, 3);
    s *= lerp(0.38, 1.08, smooth(0.32, 0.62, c));
    return s;
  }

  function buildGround() {
    const { W, H } = M.L,
      d = M.dpr;
    const c = document.createElement("canvas");
    c.width = Math.ceil(W * d);
    c.height = Math.ceil(H * d);
    const x = c.getContext("2d");
    x.scale(d, d);
    x.fillStyle = rgb(PAL.void);
    x.fillRect(0, 0, W, H);
    // faint blue-black patches so the void is never flat
    const R = rng(seed + 2);
    for (let i = 0; i < 18; i++) {
      const px = R() * W,
        py = R() * H,
        r = 80 + R() * 260;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(16,28,44,${0.25 + R() * 0.25})`);
      g.addColorStop(1, "rgba(10,16,32,0)");
      x.fillStyle = g;
      x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    // object shadows on the ground
    for (const o of M.scenery) {
      const s = o.shadow;
      x.save();
      x.translate(s.x, s.y);
      x.scale(1, s.ry / s.rx);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, s.rx);
      g.addColorStop(0, "rgba(0,0,4,0.85)");
      g.addColorStop(1, "rgba(0,0,4,0)");
      x.fillStyle = g;
      x.fillRect(-s.rx, -s.rx, s.rx * 2, s.rx * 2);
      x.restore();
    }
    groundCanvas = c;
    // vignette
    const v = document.createElement("canvas");
    v.width = Math.ceil(W / 2);
    v.height = Math.ceil(H / 2);
    const vx = v.getContext("2d");
    const g = vx.createRadialGradient(v.width / 2, v.height * 0.48, Math.min(v.width, v.height) * 0.25, v.width / 2, v.height / 2, Math.hypot(v.width, v.height) * 0.6);
    g.addColorStop(0, "rgba(2,3,8,0)");
    g.addColorStop(1, "rgba(2,3,8,0.78)");
    vx.fillStyle = g;
    vx.fillRect(0, 0, v.width, v.height);
    vignette = v;
  }

  function buildBlades() {
    const { W, H, left, top, sqW, sqH } = M.L;
    const R = rng(seed);
    // blades and their spacing follow the size of the board, so a phone's small clearing gets
    // finer grass rather than the same strokes at a coarser scale
    const scale = clamp(sqW / 100, 0.62, 1);
    const cell = (low ? 7 : 5.8) * Math.max(0.78, scale);
    const cols = Math.ceil(W / cell) + 2,
      rows = Math.ceil((H + 30) / cell) + 2;
    const max = cols * rows;
    const b = {
      n: 0,
      x: new Float32Array(max),
      y: new Float32Array(max),
      len: new Float32Array(max),
      ang: new Float32Array(max),
      bri: new Float32Array(max),
      col: new Uint8Array(max),
      sq: new Int8Array(max),
      keep: new Float32Array(max),
      fx: new Float32Array(max),
      fy: new Float32Array(max),
      q: new Float32Array(max),
    };
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = (i - 1 + R()) * cell,
          y = (j - 1 + R()) * cell;
        // density: thick bright patches and sparse dark ones
        const dn = fbm(x * 0.006, y * 0.008, seed + 11, 3);
        const dens = smooth(0.22, 0.62, dn);
        if (R() > 0.35 + 0.65 * dens) continue;
        const k = b.n++;
        b.x[k] = x;
        b.y[k] = y;
        b.len[k] = (6 + R() * R() * 9 + R() * 3) * scale;
        // static flow field: mostly upright, ±40°
        const flow = (fbm(x * 0.0035 + 9, y * 0.0035, seed + 21, 3) - 0.5) * 1.7;
        b.ang[k] = clamp(flow, -0.7, 0.7) + (R() - 0.5) * (R() < 0.2 ? 1.6 : 0.95); // + per-blade scatter (a few strays)
        const sh = shade(x, y);
        const lit = fbm(x * 0.01 + 3, y * 0.012, seed + 5, 2);
        // moonlight pools on the clearing and fades toward the edges of the screen
        const ex = (x - (left + M.L.bw / 2)) / (M.L.bw * 0.62),
          ey = (y - (top + M.L.bh / 2)) / (M.L.bh * 0.7);
        const pool = lerp(0.62, 1.18, smooth(1.6, 0.5, Math.sqrt(ex * ex + ey * ey)));
        b.bri[k] = clamp(sh * pool * (0.2 + 0.95 * Math.pow(smooth(0.26, 0.72, lit), 1.1)) * (0.72 + R() * 0.42), 0, 1);
        // colour family: teal mostly, blue-grey in the cold patches, some deeper green
        const hue = noise2(x * 0.004, y * 0.004, seed + 8);
        b.col[k] = hue < 0.22 && R() < 0.6 ? 2 : hue > 0.7 ? (R() < 0.5 ? 3 : 4) : R() < 0.55 ? 0 : 1;
        // which board square it grows in (for erosion and holes), with a crumbly edge
        const sx = Math.floor((x - left) / sqW),
          sy = 5 - Math.floor((y - top) / sqH);
        b.sq[k] = sx >= 0 && sx < 6 && sy >= 0 && sy < 6 ? sy * 6 + sx : -1;
        b.fx[k] = (x - left) / sqW - sx; // 0..1 across the square, left to right
        b.fy[k] = (y - top) / sqH - (5 - sy); // 0..1 down the square
        // the clearing: shorter, sparser, calmer grass, so the pieces read. Its edge is a noisy
        // fade, never a rectangle; inside, each square differs a little (density and light),
        // never a grid line.
        const ox = Math.max(left - x, x - (left + M.L.bw), 0) / sqW,
          oy = Math.max(top - y, y - (top + M.L.bh), 0) / sqH;
        const edge = Math.hypot(ox, oy) + (noise2(x * 0.02, y * 0.02, seed + 61) - 0.5) * 0.9;
        const c = smooth(0.55, -0.1, edge);
        if (c > 0) {
          const v = b.sq[k] >= 0 ? noise2(sx * 3.7, sy * 5.1, seed + 40) : 0.5;
          if (R() < 0.3 * c) {
            b.n--;
            continue;
          }
          b.len[k] *= lerp(1, 0.72, c);
          b.bri[k] *= lerp(1, 0.6 + 0.24 * v, c);
        }
        b.keep[k] = R();
        b.q[k] = R();
      }
    blades = b;
    M.bladeCount = b.n;
    buf = new Float32Array(b.n * 4);
  }
  let buf = null;
  const keepFor = [0, 0.32, 0.55, 0.78, 1];

  M.drawGround = function (ctx) {
    ctx.drawImage(groundCanvas, 0, 0, M.L.W, M.L.H);
  };

  M.drawGrass = function (ctx, t) {
    if (lastTint !== M.tint) buildColorTable();
    const b = blades,
      n = b.n;
    const tt = M.reduce ? 0 : t;
    const wx = M.wind.x,
      wy = M.wind.y,
      gust = M.gust;
    const fade = 1 - M.dim * 0.55;
    const clear = M.clear;
    const integ = M.integrity;
    const sqKeep = new Float32Array(36);
    for (let s = 0; s < 36; s++) sqKeep[s] = integ ? keepFor[integ(s % 6, (s / 6) | 0)] : 1;
    // per-bucket segment lists
    const B = BLADE_COLORS.length * LEVELS;
    const counts = new Int32Array(B);
    const idx = new Int32Array(n);
    const bucketOf = new Int16Array(n);
    let kept = 0;
    // squares next to a hole: their grass thins toward the shared edge (the rim crumbles)
    const holeN = new Uint8Array(36);
    if (integ)
      for (let s = 0; s < 36; s++) {
        const x = s % 6,
          y = (s / 6) | 0;
        const h = (a, c) => a >= 0 && a < 6 && c >= 0 && c < 6 && integ(a, c) === 0;
        holeN[s] = (h(x - 1, y) ? 1 : 0) | (h(x + 1, y) ? 2 : 0) | (h(x, y + 1) ? 4 : 0) | (h(x, y - 1) ? 8 : 0);
      }
    const quality = M.quality;
    for (let i = 0; i < n; i++) {
      if (b.q[i] > quality) continue; // adaptive quality: fewer blades on a slow device
      const s = b.sq[i];
      if (s >= 0 && b.keep[i] > sqKeep[s]) continue;
      if (s >= 0 && holeN[s]) {
        const hm = holeN[s],
          fx = b.fx[i],
          fy = b.fy[i];
        const d = Math.min(hm & 1 ? fx : 9, hm & 2 ? 1 - fx : 9, hm & 4 ? fy : 9, hm & 8 ? 1 - fy : 9);
        if (d < 0.35 && b.keep[i] > d / 0.35) continue;
      }
      if (clear > 0 && b.keep[i] < clear) continue;
      const x = b.x[i],
        y = b.y[i];
      // sway + eddy + wind
      const sway = 0.1 * Math.sin(tt * 0.7 + x * 0.006 + y * 0.004) + 0.05 * Math.sin(tt * 1.6 + x * 0.013 - y * 0.007);
      const eddy = 0.26 * Math.sin(x * 0.021 + tt * 0.5 + 2.2 * Math.sin(y * 0.017 - tt * 0.33)) * Math.cos(y * 0.019 + tt * 0.37 + 1.7 * Math.cos(x * 0.011 + tt * 0.29));
      const a = b.ang[i] + sway + eddy * (1 - Math.min(1, Math.abs(wx) + Math.abs(wy)) * 0.5) + wx * (0.75 + gust * 0.5);
      let len = b.len[i] * (1 + wy * 0.28 + gust * 0.15);
      const sa = Math.sin(a),
        ca = Math.cos(a);
      const o = kept * 4;
      buf[o] = x;
      buf[o + 1] = y;
      buf[o + 2] = x + sa * len;
      buf[o + 3] = y - ca * len * (wy < 0 ? 1 + wy * 0.45 : 1);
      // brightness: static light, blades leaning into the wind catch a little more
      let br = b.bri[i] * fade * (1 + 0.15 * Math.sin(tt * 0.9 + x * 0.01 + i));
      const lv = Math.max(0, Math.min(LEVELS - 1, (br * LEVELS) | 0));
      const bk = b.col[i] * LEVELS + lv;
      bucketOf[kept] = bk;
      counts[bk]++;
      idx[kept] = kept;
      kept++;
    }
    // order segments by bucket (counting sort)
    const start = new Int32Array(B + 1);
    for (let k = 0; k < B; k++) start[k + 1] = start[k] + counts[k];
    const pos = start.slice(0, B);
    const order = new Int32Array(kept);
    for (let k = 0; k < kept; k++) order[pos[bucketOf[k]]++] = k;
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    for (let k = 0; k < B; k++) {
      if (!counts[k]) continue;
      ctx.strokeStyle = colorTable[(k / LEVELS) | 0][k % LEVELS];
      ctx.beginPath();
      for (let p = start[k]; p < start[k + 1]; p++) {
        const o = order[p] * 4;
        ctx.moveTo(buf[o], buf[o + 1]);
        ctx.lineTo(buf[o + 2], buf[o + 3]);
      }
      ctx.stroke();
    }
    M.drawnBlades = kept;
  };

  // ── scenery sprites, for the depth-sorted pass in view.js ──
  M.sceneryDrawables = function () {
    return M.scenery.map((s) => ({
      y: s.y,
      draw(ctx) {
        const sp = s.sprite;
        ctx.globalAlpha = 1 - M.clear;
        ctx.drawImage(sp.canvases[0], s.x - sp.ax, s.y - sp.ay, sp.w, sp.h);
        ctx.globalAlpha = 1;
      },
    }));
  };

  // ── mist: soft clouds with characters drifting in them (ref 5) ──
  function buildClouds() {
    const { W, H } = M.L;
    const R = rng(seed + 77);
    clouds = [];
    const n = low ? 4 : 7;
    for (let i = 0; i < n; i++) {
      const w = 260 + R() * 320,
        h = w * (0.35 + R() * 0.2);
      const c = document.createElement("canvas");
      const d = Math.min(M.dpr, 1.5);
      c.width = Math.ceil(w * d);
      c.height = Math.ceil(h * d);
      const x = c.getContext("2d");
      x.scale(d, d);
      for (let k = 0; k < 9; k++) {
        const px = w * (0.2 + R() * 0.6),
          py = h * (0.35 + R() * 0.3),
          r = h * (0.25 + R() * 0.3);
        const g = x.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, "rgba(232,236,245,0.33)");
        g.addColorStop(1, "rgba(232,236,245,0)");
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
      }
      x.font = `9px ${FONT}`;
      x.textAlign = "center";
      x.textBaseline = "middle";
      for (let gy = 4; gy < h; gy += 9)
        for (let gx = 3; gx < w; gx += 6) {
          const u = gx / w - 0.5,
            v = gy / h - 0.5;
          const dd = 1 - (u * u * 3.2 + v * v * 4.5);
          const nn = fbm(gx * 0.03 + i * 10, gy * 0.04, seed + i, 2);
          const dens = dd * 1.2 + (nn - 0.5) * 1.3;
          if (dens < 0.35 || R() > dens) continue;
          x.globalAlpha = clamp(dens * 0.7, 0.1, 0.8);
          x.fillStyle = dens > 0.75 ? "#eef1fa" : "#b9c0da";
          x.fillText("oo@8ec*.oO0"[(R() * 11) | 0], gx, gy);
        }
      clouds.push({ c, w, h, x: R() * (W + w) - w, y: R() * H * 0.95, v: (4 + R() * 9) * (R() < 0.5 ? 1 : 0.6), a: 0.35 + R() * 0.5 });
    }
  }
  M.drawMist = function (ctx, t, dt) {
    const { W } = M.L;
    const boost = M.mistBoost;
    for (const c of clouds) {
      if (!M.reduce) c.x += c.v * dt * (1 + boost * 2.5) + M.wind.x * dt * 18;
      if (c.x > W + 40) c.x = -c.w - 40;
      if (c.x < -c.w - 60) c.x = W + 20;
      ctx.globalAlpha = clamp((c.a * (0.42 + boost * 0.9)) * (1 - M.clear), 0, 1);
      ctx.drawImage(c.c, c.x, c.y, c.w, c.h);
    }
    if (boost > 0.01) {
      ctx.globalAlpha = boost * 0.18;
      ctx.fillStyle = rgb(PAL.mist);
      ctx.fillRect(0, 0, W, M.L.H);
    }
    ctx.globalAlpha = 1;
  };

  // ── sparkles: white and pale blue points, some with a blue bloom; some are * and o (ref 5) ──
  function buildSparkles() {
    const { W, H } = M.L;
    const R = rng(seed + 99);
    sparkles = [];
    const n = low ? 90 : 190;
    for (let i = 0; i < n; i++) {
      const kind = R();
      sparkles.push({
        x: R() * W,
        y: R() * H,
        p: R() * 7,
        s: 0.4 + R() * 1.4,
        kind: kind < 0.72 ? "dot" : kind < 0.86 ? "*" : "o",
        bloom: R() < 0.4,
        col: R() < 0.5 ? "#ffffff" : "#cfe0ff",
        size: 1 + R() * 1.2,
      });
    }
  }
  M.drawSparkles = function (ctx, t) {
    const tt = M.reduce ? 3 : t;
    for (const s of sparkles) {
      let a = Math.sin(tt * s.s + s.p);
      a = a > 0 ? a * a * a : 0;
      a = Math.max(a, M.reduce ? 0.35 : 0.05) * (1 - M.clear * 0.5);
      if (a < 0.03) continue;
      if (s.bloom) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = a * 0.8;
        const bl = bloomSprite("rgba(90,130,255,0.7)", 16);
        ctx.drawImage(bl, s.x - 13, s.y - 13, 26, 26);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.globalAlpha = a;
      if (s.kind === "dot") {
        ctx.fillStyle = s.col;
        ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
      } else drawGlyph(ctx, s.kind, s.col, 9, s.x, s.y, M.dpr);
    }
    ctx.globalAlpha = 1;
  };

  // ── falling streaks ──
  M.drawStreaks = function (ctx, t, dt) {
    if (M.reduce) return;
    const { W, H } = M.L;
    if (Math.random() < dt * 0.35) streaks.push({ x: Math.random() * W, y: -20, v: 500 + Math.random() * 400, life: 1, len: 30 + Math.random() * 50 });
    ctx.lineWidth = 1;
    for (const s of streaks) {
      s.y += s.v * dt;
      s.x += s.v * dt * 0.12;
      s.life -= dt * 0.8;
      ctx.strokeStyle = `rgba(220,230,255,${Math.max(0, s.life * 0.35)})`;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.len * 0.12, s.y - s.len);
      ctx.stroke();
    }
    streaks = streaks.filter((s) => s.life > 0 && s.y < H + 60);
  };

  M.drawVignette = function (ctx) {
    ctx.drawImage(vignette, 0, 0, M.L.W, M.L.H);
    if (M.dim > 0.005) {
      ctx.fillStyle = `rgba(2,3,8,${M.dim * 0.55})`;
      ctx.fillRect(0, 0, M.L.W, M.L.H);
    }
  };

  // ease the wind lean, gust and tint toward their targets
  M.update = function (dt) {
    const k = M.reduce ? 1 : 1 - Math.exp(-dt * 1.4);
    M.wind.x += (M.windTarget.x - M.wind.x) * k;
    M.wind.y += (M.windTarget.y - M.wind.y) * k;
    M.gust = Math.max(0, M.gust - dt * 0.8);
    const tk = M.reduce ? 1 : 1 - Math.exp(-dt * 0.8);
    const nt = M.tint + (M.tintTarget - M.tint) * tk;
    M.tint = Math.abs(nt - M.tintTarget) < 0.5 ? M.tintTarget : Math.round(nt * 2) / 2;
  };
  return M;
}
