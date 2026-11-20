// ASCII sculptures: chess pieces, trees, rocks, tombstones, pillars, the Moon, gold blocks.
//
// Each object is a vector silhouette (drawn in a unit box below), sampled onto a grid of small
// monospace characters. Every cell gets a surface normal (cylindrical across each row of the
// silhouette, or spherical for round things, plus a vertical term from the silhouette's edges),
// is lit by a key light from the upper left, and picks a character whose ink matches its
// brightness (RAMP in glyphs.js). Behind the characters sits a dark backing of the same shape with
// a soft halo, so the object separates from the grass the way the horse does in the references;
// toward the base the characters thin out and fade into the meadow.
import { FONT, RAMP, rgb, ramp } from "./glyphs.js";
import { rng, noise2, clamp, smooth } from "../rng.js";

// ── silhouettes, in a unit box (x 0..1 left to right, y 0..1 top to bottom) ──
const ell = (c, x, y, rx, ry) => c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
function base(c, w = 0.92, top = 0.86) {
  // a turned foot: a flat disc with a lip
  const l = (1 - w) / 2;
  c.moveTo(l, 1);
  c.lineTo(l, top + 0.04);
  c.quadraticCurveTo(l, top, l + 0.06, top);
  c.lineTo(1 - l - 0.06, top);
  c.quadraticCurveTo(1 - l, top, 1 - l, top + 0.04);
  c.lineTo(1 - l, 1);
  c.closePath();
}
export const SHAPES = {
  // Pawn: a ball on a collar on a flared body.
  P(c) {
    c.beginPath();
    ell(c, 0.5, 0.2, 0.2, 0.18);
    c.moveTo(0.26, 0.42);
    c.lineTo(0.74, 0.42);
    c.lineTo(0.74, 0.48);
    c.lineTo(0.26, 0.48);
    c.closePath();
    c.moveTo(0.36, 0.46);
    c.bezierCurveTo(0.36, 0.62, 0.22, 0.74, 0.16, 0.86);
    c.lineTo(0.84, 0.86);
    c.bezierCurveTo(0.78, 0.74, 0.64, 0.62, 0.64, 0.46);
    c.closePath();
    base(c, 0.94, 0.84);
  },
  // Rook: a tower with three merlons.
  R(c) {
    c.beginPath();
    c.moveTo(0.14, 0.02);
    c.lineTo(0.3, 0.02);
    c.lineTo(0.3, 0.12);
    c.lineTo(0.42, 0.12);
    c.lineTo(0.42, 0.02);
    c.lineTo(0.58, 0.02);
    c.lineTo(0.58, 0.12);
    c.lineTo(0.7, 0.12);
    c.lineTo(0.7, 0.02);
    c.lineTo(0.86, 0.02);
    c.lineTo(0.86, 0.26);
    c.lineTo(0.76, 0.32);
    c.lineTo(0.78, 0.72);
    c.lineTo(0.88, 0.84);
    c.lineTo(0.12, 0.84);
    c.lineTo(0.22, 0.72);
    c.lineTo(0.24, 0.32);
    c.lineTo(0.14, 0.26);
    c.closePath();
    base(c, 0.96, 0.82);
  },
  // Bishop: a mitre with a slit, a bead on top.
  B(c) {
    c.beginPath();
    ell(c, 0.5, 0.05, 0.07, 0.05);
    c.moveTo(0.5, 0.08);
    c.bezierCurveTo(0.8, 0.2, 0.78, 0.4, 0.66, 0.48);
    c.lineTo(0.34, 0.48);
    c.bezierCurveTo(0.22, 0.4, 0.2, 0.2, 0.5, 0.08);
    c.closePath();
    c.moveTo(0.28, 0.48);
    c.lineTo(0.72, 0.48);
    c.lineTo(0.72, 0.54);
    c.lineTo(0.28, 0.54);
    c.closePath();
    c.moveTo(0.4, 0.54);
    c.bezierCurveTo(0.4, 0.68, 0.24, 0.76, 0.18, 0.86);
    c.lineTo(0.82, 0.86);
    c.bezierCurveTo(0.76, 0.76, 0.6, 0.68, 0.6, 0.54);
    c.closePath();
    base(c, 0.94, 0.84);
  },
  // Queen: a crown of five beads over a cup, a slim waist, a wide body.
  Q(c) {
    c.beginPath();
    const tips = [0.12, 0.3, 0.5, 0.7, 0.88];
    tips.forEach((x, i) => ell(c, x, i === 2 ? 0.04 : 0.09, 0.055, 0.045));
    c.moveTo(0.12, 0.12);
    c.lineTo(0.24, 0.3);
    c.lineTo(0.3, 0.12);
    c.lineTo(0.4, 0.28);
    c.lineTo(0.5, 0.07);
    c.lineTo(0.6, 0.28);
    c.lineTo(0.7, 0.12);
    c.lineTo(0.76, 0.3);
    c.lineTo(0.88, 0.12);
    c.lineTo(0.76, 0.42);
    c.lineTo(0.24, 0.42);
    c.closePath();
    c.moveTo(0.22, 0.42);
    c.lineTo(0.78, 0.42);
    c.lineTo(0.74, 0.48);
    c.lineTo(0.26, 0.48);
    c.closePath();
    c.moveTo(0.38, 0.48);
    c.bezierCurveTo(0.38, 0.66, 0.2, 0.76, 0.14, 0.87);
    c.lineTo(0.86, 0.87);
    c.bezierCurveTo(0.8, 0.76, 0.62, 0.66, 0.62, 0.48);
    c.closePath();
    base(c, 0.96, 0.85);
  },
  // King: a tall cross over an open crown that flares outward (never a ball, so it can't be
  // mistaken for the pawn), then a slim waist and a wide body.
  K(c) {
    c.beginPath();
    c.rect(0.44, 0.0, 0.12, 0.24);
    c.rect(0.33, 0.05, 0.34, 0.08);
    // crown: a wide rim with two corner points, tapering to the band
    c.moveTo(0.04, 0.17);
    c.lineTo(0.2, 0.25);
    c.lineTo(0.8, 0.25);
    c.lineTo(0.96, 0.17);
    c.lineTo(0.88, 0.3);
    c.lineTo(0.72, 0.45);
    c.lineTo(0.28, 0.45);
    c.lineTo(0.12, 0.3);
    c.closePath();
    c.moveTo(0.24, 0.44);
    c.lineTo(0.76, 0.44);
    c.lineTo(0.74, 0.5);
    c.lineTo(0.26, 0.5);
    c.closePath();
    c.moveTo(0.37, 0.5);
    c.bezierCurveTo(0.37, 0.68, 0.18, 0.77, 0.12, 0.87);
    c.lineTo(0.88, 0.87);
    c.bezierCurveTo(0.82, 0.77, 0.63, 0.68, 0.63, 0.5);
    c.closePath();
    base(c, 0.96, 0.85);
  },
  // Knight: a horse's head in profile, facing left: two ears, a long face down to the muzzle,
  // the jaw, the throat, and the neck arching back with a ragged mane.
  N(c) {
    c.beginPath();
    c.moveTo(0.22, 0.86); // front of the chest at the collar
    c.bezierCurveTo(0.3, 0.76, 0.44, 0.7, 0.46, 0.58); // chest up to the throat
    c.bezierCurveTo(0.4, 0.54, 0.32, 0.55, 0.24, 0.6); // throat notch, under the jaw
    c.bezierCurveTo(0.17, 0.65, 0.07, 0.64, 0.04, 0.58); // chin and lips
    c.bezierCurveTo(0.0, 0.52, 0.02, 0.46, 0.07, 0.43); // muzzle
    c.bezierCurveTo(0.16, 0.34, 0.28, 0.22, 0.38, 0.15); // nose bridge, forehead
    c.lineTo(0.4, 0.01); // front ear
    c.lineTo(0.48, 0.1);
    c.lineTo(0.55, 0.0); // back ear
    c.lineTo(0.6, 0.12);
    // mane: ragged tufts down the back of the neck
    const mane = [
      [0.72, 0.15],
      [0.69, 0.21],
      [0.8, 0.26],
      [0.76, 0.33],
      [0.87, 0.39],
      [0.82, 0.46],
      [0.92, 0.53],
      [0.86, 0.6],
      [0.94, 0.67],
      [0.88, 0.73],
    ];
    mane.forEach(([x, y]) => c.lineTo(x, y));
    c.bezierCurveTo(0.9, 0.8, 0.86, 0.84, 0.84, 0.86);
    c.closePath();
    base(c, 0.96, 0.85);
  },
  // Scenery
  trunk(c) {
    c.beginPath();
    c.moveTo(0.3, 0);
    c.lineTo(0.7, 0);
    c.bezierCurveTo(0.68, 0.5, 0.7, 0.8, 0.82, 0.96);
    c.lineTo(1, 1);
    c.lineTo(0, 1);
    c.lineTo(0.16, 0.96);
    c.bezierCurveTo(0.3, 0.8, 0.32, 0.5, 0.3, 0);
    c.closePath();
  },
  rock(c, seed = 1) {
    c.beginPath();
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI; // top half outline, left to right
      const r = 0.82 + 0.18 * noise2(Math.cos(a) * 2 + seed, Math.sin(a) * 2, seed);
      const x = 0.5 + Math.cos(a) * 0.5 * r,
        y = 0.96 + Math.sin(a) * 0.92 * r;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.lineTo(0.98, 1);
    c.lineTo(0.02, 1);
    c.closePath();
  },
  tomb(c) {
    c.beginPath();
    c.moveTo(0.1, 1);
    c.lineTo(0.12, 0.3);
    c.bezierCurveTo(0.12, -0.08, 0.88, -0.08, 0.88, 0.3);
    c.lineTo(0.9, 1);
    c.closePath();
  },
  pillar(c) {
    c.beginPath();
    c.moveTo(0.18, 0.08);
    c.lineTo(0.4, 0.0);
    c.lineTo(0.52, 0.06);
    c.lineTo(0.66, 0.02);
    c.lineTo(0.82, 0.1);
    c.lineTo(0.84, 0.16);
    c.lineTo(0.74, 0.18);
    c.lineTo(0.74, 0.88);
    c.lineTo(0.9, 0.92);
    c.lineTo(0.92, 1);
    c.lineTo(0.08, 1);
    c.lineTo(0.1, 0.92);
    c.lineTo(0.26, 0.88);
    c.lineTo(0.26, 0.18);
    c.lineTo(0.16, 0.16);
    c.closePath();
  },
  disc(c) {
    c.beginPath();
    ell(c, 0.5, 0.5, 0.5, 0.5);
  },
  gold(c) {
    c.beginPath();
    c.moveTo(0.06, 0.34);
    c.lineTo(0.3, 0.12);
    c.lineTo(0.94, 0.12);
    c.lineTo(0.94, 0.78);
    c.lineTo(0.7, 1);
    c.lineTo(0.06, 1);
    c.closePath();
  },
};
// Holes cut out of a silhouette (the knight's eye and nostril, the bishop's slit).
const CUTS = {
  N(c) {
    c.beginPath();
    ell(c, 0.33, 0.25, 0.06, 0.04);
    ell(c, 0.07, 0.48, 0.025, 0.025);
    c.moveTo(0.05, 0.565);
    c.lineTo(0.18, 0.57);
    c.lineTo(0.18, 0.59);
    c.lineTo(0.05, 0.585);
    c.closePath();
  },
  B(c) {
    c.beginPath();
    c.moveTo(0.52, 0.18);
    c.lineTo(0.64, 0.3);
    c.lineTo(0.6, 0.34);
    c.lineTo(0.48, 0.22);
    c.closePath();
  },
};

// Colour ramps: brightness 0..1 → colour.
export const LOOKS = {
  player: [
    [0, [36, 41, 70]],
    [0.25, [56, 63, 104]],
    [0.45, [118, 126, 180]],
    [0.62, [170, 177, 224]],
    [0.78, [222, 225, 248]],
    [1, [255, 255, 255]],
  ],
  boss: [
    [0, [40, 10, 20]],
    [0.25, [112, 30, 50]],
    [0.45, [64, 58, 92]],
    [0.65, [80, 88, 128]],
    [0.85, [122, 128, 170]],
    [1, [176, 180, 212]],
  ],
  scenery: [
    [0, [12, 16, 28]],
    [0.3, [34, 42, 70]],
    [0.6, [96, 104, 150]],
    [0.85, [150, 158, 205]],
    [1, [200, 205, 240]],
  ],
  gold: [
    [0, [40, 24, 6]],
    [0.3, [110, 72, 20]],
    [0.6, [200, 150, 52]],
    [0.85, [240, 206, 110]],
    [1, [255, 240, 190]],
  ],
  moon: [
    [0, [30, 34, 56]],
    [0.3, [90, 98, 140]],
    [0.6, [170, 176, 210]],
    [0.85, [222, 226, 246]],
    [1, [255, 255, 255]],
  ],
  iron: [
    [0, [20, 22, 26]],
    [0.4, [80, 86, 96]],
    [0.8, [170, 176, 186]],
    [1, [230, 234, 240]],
  ],
};

const LIGHT = (() => {
  const v = [-0.62, 0.5, 0.6],
    m = Math.hypot(...v);
  return v.map((x) => x / m);
})();
const HALF = (() => {
  const v = [LIGHT[0], LIGHT[1], LIGHT[2] + 1],
    m = Math.hypot(...v);
  return v.map((x) => x / m);
})();

// Bake one object into a sprite.
//   shape:   a key of SHAPES (or a function(ctx) drawing in the unit box)
//   w, h:    size of the object in CSS px;   cw, chH: character cell in CSS px (font = chH)
//   look:    a key of LOOKS;   flip: mirror horizontally;   normal: "cyl" | "sphere"
//   variants: how many shimmer variants to bake (each swaps ~10% of the characters)
//   melt:    fraction of the height at the base where characters thin into the grass
//   pattern: optional function (u, v) → 0..1 darkening (the Moon's markings)
//   ambient, gain: lighting;   halo: px of soft dark halo around the backing
export function sculpt(opts) {
  const { shape, w, h, cw, chH, dpr = 1, look = "player", flip = false, normal = "cyl", variants = 1, melt = 0.16, pattern = null, ambient = 0.1, gain = 1, rim = 0.42, gamma = 0.85, halo = 3, seed = 1, backing = 0.92, bloom = true, chars = null, arg } = opts;
  const cols = Math.max(2, Math.round(w / cw)),
    rows = Math.max(2, Math.round(h / chH));
  const S = 4; // supersampling per cell
  const mw = cols * S,
    mh = rows * S;
  const draw = typeof shape === "function" ? shape : SHAPES[shape];
  const cut = typeof shape === "string" ? CUTS[shape] : null;
  // coverage mask
  const m = document.createElement("canvas");
  m.width = mw;
  m.height = mh;
  const mx = m.getContext("2d", { willReadFrequently: true });
  const paint = (ctx, sx, sy, fill) => {
    ctx.save();
    if (flip) {
      ctx.translate(sx, 0);
      ctx.scale(-1, 1);
    }
    ctx.scale(sx, sy);
    ctx.fillStyle = fill;
    draw(ctx, arg);
    ctx.fill("nonzero");
    if (cut) {
      ctx.globalCompositeOperation = "destination-out";
      cut(ctx);
      ctx.fill();
    }
    ctx.restore();
  };
  paint(mx, mw, mh, "#fff");
  const data = mx.getImageData(0, 0, mw, mh).data;
  const C = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++)
    for (let q = 0; q < cols; q++) {
      let s = 0;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) s += data[((r * S + j) * mw + q * S + i) * 4 + 3];
      C[r * cols + q] = s / (S * S * 255);
    }
  const at = (q, r) => (q < 0 || r < 0 || q >= cols || r >= rows ? 0 : C[r * cols + q]);
  // blurred coverage, for the vertical part of the normal and for edge softness
  const B = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++)
    for (let q = 0; q < cols; q++) {
      let s = 0,
        n = 0;
      for (let j = -2; j <= 2; j++)
        for (let i = -1; i <= 1; i++) {
          const wt = 3 - Math.abs(j) - Math.abs(i);
          s += at(q + i, r + j) * wt;
          n += wt;
        }
      B[r * cols + q] = s / n;
    }
  const bat = (q, r) => (q < 0 || r < 0 || q >= cols || r >= rows ? 0 : B[r * cols + q]);

  // shade every covered cell
  const R = rng(seed);
  const cells = [];
  for (let r = 0; r < rows; r++) {
    // spans of this row, for the cylinder
    let q = 0;
    while (q < cols) {
      if (at(q, r) < 0.3) {
        q++;
        continue;
      }
      const a = q;
      while (q < cols && at(q, r) >= 0.3) q++;
      const b = q - 1,
        mid = (a + b + 1) / 2,
        half = Math.max(0.75, (b - a + 1) / 2);
      for (let k = a; k <= b; k++) {
        const cov = at(k, r);
        const u = (k + 0.5) / cols,
          v = (r + 0.5) / rows;
        let nx, ny;
        if (normal === "sphere") {
          nx = (u - 0.5) * 2;
          ny = (0.5 - v) * 2;
        } else {
          nx = (k + 0.5 - mid) / half;
          ny = clamp((bat(k, r + 1) - bat(k, r - 1)) * 1.6, -0.9, 0.9);
          nx *= 0.92;
        }
        const l2 = nx * nx + ny * ny;
        if (l2 > 0.98) {
          const f = Math.sqrt(0.98 / l2);
          nx *= f;
          ny *= f;
        }
        const nz = Math.sqrt(Math.max(0.02, 1 - nx * nx - ny * ny));
        const diff = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
        const spec = Math.pow(Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]), 22);
        let bright = ambient + gain * (0.9 * Math.pow(diff, 1.7) + 0.8 * spec);
        // a cool rim on the far side keeps the silhouette readable against the dark grass
        if (normal !== "sphere" && nx > 0.4) bright += rim * (nx - 0.4) * 1.8;
        // ambient occlusion toward the ground
        bright *= 0.72 + 0.28 * smooth(1, 0.7, v);
        if (pattern) bright *= 1 - pattern(u, v);
        bright = Math.pow(clamp(bright, 0, 1), gamma);
        // the base melts into the grass
        const meltT = melt > 0 ? smooth(1 - melt, 1, v) : 0;
        if (R() < meltT * 0.75) continue;
        let alpha = (1 - meltT * 0.65) * clamp((cov - 0.3) / 0.45, 0.25, 1);
        // ragged edges: border cells are sparser and dimmer
        const edge = cov < 0.85 || at(k - 1, r) < 0.3 || at(k + 1, r) < 0.3 || at(k, r - 1) < 0.3;
        if (edge && R() < 0.22) continue;
        if (edge) alpha *= 0.75;
        if (bright < 0.04 && R() < 0.35) continue; // the darkest cells leave the backing showing
        cells.push({ q: k, r, b: bright, a: alpha, roll: R(), alt: R() });
      }
    }
  }
  const stops = LOOKS[look] || look;
  const pickChar = (b, roll) => {
    if (chars) return chars[Math.floor(roll * chars.length) % chars.length];
    const bucket = RAMP[Math.min(RAMP.length - 1, Math.floor(b * 1.1 * RAMP.length))];
    return bucket[Math.floor(roll * bucket.length) % bucket.length];
  };
  for (const c of cells) {
    c.ch = pickChar(c.b, c.roll);
    c.color = rgb(ramp(stops, c.b));
  }

  // render: backing (soft halo + body), then characters
  const pad = halo + 2;
  const W = cols * cw + pad * 2,
    H = rows * chH + pad * 2;
  const out = [];
  for (let vi = 0; vi < variants; vi++) {
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(W * dpr);
    cv.height = Math.ceil(H * dpr);
    const x = cv.getContext("2d");
    x.scale(dpr, dpr);
    if (backing > 0) {
      x.save();
      x.translate(pad, pad);
      if (halo > 0) {
        x.filter = `blur(${halo}px)`;
        x.globalAlpha = backing * 0.75;
        paintBacking(x, cols * cw, rows * chH);
        x.filter = "none";
      }
      x.globalAlpha = backing;
      paintBacking(x, cols * cw, rows * chH);
      x.restore();
    }
    x.font = `${chH}px ${FONT}`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    const vr = rng(seed * 31 + vi * 977);
    for (const c of cells) {
      let ch = c.ch;
      if (vi > 0 && vr() < 0.12) ch = pickChar(c.b, vr());
      x.globalAlpha = c.a;
      x.fillStyle = c.color;
      if (bloom && c.b > 0.72) {
        x.shadowColor = c.color;
        x.shadowBlur = chH * 0.9 * dpr;
      }
      x.fillText(ch, pad + (c.q + 0.5) * cw, pad + (c.r + 0.55) * chH);
      x.shadowBlur = 0;
    }
    out.push(cv);
  }
  function paintBacking(x, bw, bh) {
    // the silhouette, without its melting base, in near-black
    x.save();
    x.beginPath();
    x.rect(0, 0, bw, bh * (1 - melt * 0.5));
    x.clip();
    paint(x, bw, bh, "#03040a");
    x.restore();
    // the melting base: a fading strip of the silhouette
    const g = x.createLinearGradient(0, bh * (1 - melt * 0.5), 0, bh);
    g.addColorStop(0, "rgba(3,4,10,1)");
    g.addColorStop(1, "rgba(3,4,10,0)");
    const t = document.createElement("canvas");
    t.width = Math.ceil(bw);
    t.height = Math.ceil(bh);
    const tx = t.getContext("2d");
    paint(tx, bw, bh, "#000");
    tx.globalCompositeOperation = "source-in";
    tx.fillStyle = g;
    tx.fillRect(0, 0, bw, bh);
    x.save();
    x.beginPath();
    x.rect(0, bh * (1 - melt * 0.5), bw, bh);
    x.clip();
    x.drawImage(t, 0, 0);
    x.restore();
  }
  return {
    canvases: out,
    w: W,
    h: H,
    // anchor: the bottom centre of the object, in sprite px
    ax: W / 2,
    ay: pad + rows * chH,
    cells: cells.map((c) => ({ x: pad + (c.q + 0.5) * cw - W / 2, y: pad + (c.r + 0.55) * chH - (pad + rows * chH), ch: c.ch, color: c.color, a: c.a, b: c.b })),
  };
}
