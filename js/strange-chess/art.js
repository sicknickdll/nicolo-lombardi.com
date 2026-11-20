// The silhouettes. Each draw function paints a plain white shape in a design box (pieces 100×140),
// glyphs.js turns it into characters. Nothing here is outlined: edges dissolve.
import { bakeSprite } from "./glyphs.js";
import { hash2 } from "./noise.js";

const ell = (c, x, y, rx, ry) => {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
};
const poly = (c, pts) => {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fill();
};
const design = (dw, dh, fn, flip = false) => (c, W, H) => {
  c.save();
  if (flip) {
    c.translate(W, 0);
    c.scale(-1, 1);
  }
  c.scale(W / dw, H / dh);
  fn(c);
  c.restore();
};
// every piece stands on the same turned base
const base = (c, y = 108) => {
  ell(c, 50, y - 2, 26, 6); // collar
  poly(c, [
    [27, y],
    [73, y],
    [78, y + 14],
    [22, y + 14],
  ]);
  ell(c, 50, y + 17, 30, 8);
};
const body = (c, top, w1, w2, bottom = 108) => {
  c.beginPath();
  c.moveTo(50 - w1, top);
  c.quadraticCurveTo(50 - (w1 + w2) / 2 + 2, (top + bottom) / 2 + 6, 50 - w2, bottom);
  c.lineTo(50 + w2, bottom);
  c.quadraticCurveTo(50 + (w1 + w2) / 2 - 2, (top + bottom) / 2 + 6, 50 + w1, top);
  c.closePath();
  c.fill();
};

const PIECES = {
  P: (c) => {
    ell(c, 50, 33, 18, 18);
    ell(c, 50, 55, 22, 5);
    body(c, 54, 8, 26, 106);
    base(c);
  },
  R: (c) => {
    c.fillRect(20, 14, 16, 22);
    c.fillRect(42, 14, 16, 22);
    c.fillRect(64, 14, 16, 22);
    c.fillRect(20, 34, 60, 10);
    body(c, 44, 20, 24, 100);
    ell(c, 50, 102, 30, 6);
    base(c);
  },
  B: (c) => {
    ell(c, 50, 12, 6, 6);
    ell(c, 50, 42, 18, 28);
    ell(c, 50, 70, 24, 5);
    body(c, 68, 10, 24, 106);
    base(c);
    c.save();
    c.globalCompositeOperation = "destination-out";
    c.lineWidth = 4;
    c.strokeStyle = "#000";
    c.beginPath();
    c.moveTo(42, 26);
    c.lineTo(62, 48);
    c.stroke();
    c.restore();
  },
  Q: (c) => {
    for (const [x, y] of [
      [24, 18],
      [37, 12],
      [50, 8],
      [63, 12],
      [76, 18],
    ])
      ell(c, x, y, 5, 5);
    poly(c, [
      [24, 22],
      [76, 22],
      [68, 52],
      [32, 52],
    ]);
    ell(c, 50, 56, 22, 5);
    body(c, 54, 12, 25, 106);
    base(c);
  },
  K: (c) => {
    c.fillRect(46, 2, 8, 30);
    c.fillRect(36, 11, 28, 8);
    ell(c, 50, 42, 21, 14);
    poly(c, [
      [29, 44],
      [71, 44],
      [66, 58],
      [34, 58],
    ]);
    ell(c, 50, 60, 22, 5);
    body(c, 58, 12, 25, 106);
    base(c);
  },
  N: (c) => {
    // a horse's head in profile, facing left: ears, forehead, muzzle, jaw, throat, then the arched mane
    poly(c, [
      [26, 124],
      [27, 108],
      [34, 96],
      [38, 86],
      [28, 84],
      [17, 80],
      [9, 72],
      [10, 62],
      [18, 54],
      [24, 44],
      [25, 30],
      [31, 12],
      [38, 28],
      [45, 22],
      [56, 30],
      [70, 48],
      [79, 72],
      [81, 100],
      [78, 124],
    ]);
    c.save();
    c.globalCompositeOperation = "destination-out";
    c.fillStyle = "rgba(0,0,0,0.7)";
    c.beginPath();
    c.arc(30, 52, 3.2, 0, 6.3);
    c.fill();
    c.beginPath();
    c.arc(13, 68, 2, 0, 6.3);
    c.fill();
    c.restore();
    ell(c, 50, 124, 31, 8);
    poly(c, [
      [24, 118],
      [76, 118],
      [80, 132],
      [20, 132],
    ]);
  },
};
const PIECE_MODE = { P: "revolve", R: "revolve", B: "revolve", Q: "revolve", K: "revolve", N: "blob" };

// the gold block, a chunky nugget
const goldBlock = (c) => {
  poly(c, [
    [14, 70],
    [30, 46],
    [66, 40],
    [88, 62],
    [84, 100],
    [58, 118],
    [24, 112],
  ]);
  ell(c, 50, 114, 38, 9);
};
const rock = (seed) => (c) => {
  c.beginPath();
  const pts = 14;
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const r = 0.78 + hash2(i, 5, seed) * 0.38;
    const x = 50 + Math.cos(a) * 46 * r,
      y = 62 + Math.sin(a) * 40 * r * 0.92;
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.closePath();
  c.fill();
};
const tomb = (c) => {
  c.beginPath();
  c.moveTo(18, 124);
  c.lineTo(18, 54);
  c.arc(50, 54, 32, Math.PI, 0);
  c.lineTo(82, 124);
  c.closePath();
  c.fill();
  c.save();
  c.globalCompositeOperation = "destination-out";
  c.fillStyle = "rgba(0,0,0,0.55)";
  c.fillRect(46, 40, 8, 40);
  c.fillRect(37, 51, 26, 8);
  c.restore();
};
const trunk = (seed) => (c) => {
  // a tall, slightly wavering column with a root flare, 100 × 400
  c.beginPath();
  const left = [],
    right = [];
  for (let y = 0; y <= 400; y += 10) {
    const w = 29 + hash2(y / 10 | 0, 2, seed) * 4 + (y > 340 ? ((y - 340) / 60) ** 2 * 18 : 0);
    const cx = 50 + Math.sin(y * 0.011 + seed) * 3;
    left.push([cx - w, y]);
    right.push([cx + w, y]);
  }
  left.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  right.reverse().forEach(([x, y]) => c.lineTo(x, y));
  c.closePath();
  c.fill();
};
const pillar = (c) => {
  // broken pillar: base, fluted shaft, a ragged top
  poly(c, [
    [14, 276],
    [86, 276],
    [80, 252],
    [20, 252],
  ]);
  c.fillRect(26, 70, 48, 184);
  poly(c, [
    [26, 70],
    [32, 54],
    [42, 62],
    [52, 46],
    [60, 60],
    [70, 50],
    [74, 70],
  ]);
  ell(c, 50, 254, 36, 8);
};
const moon = (c) => {
  ell(c, 50, 50, 48, 48);
  c.save();
  c.globalCompositeOperation = "destination-out";
  c.fillStyle = "rgba(0,0,0,0.5)";
  for (const [x, y, r] of [
    [34, 36, 12],
    [62, 28, 8],
    [66, 62, 14],
    [38, 70, 9],
    [52, 48, 5],
  ]) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
};

// Sprites for the given sizes (css px). cell = one character.
// Heights, like real chess: the pawn is short, the king is tall.
const HEIGHT = { P: 0.78, R: 0.9, N: 0.96, B: 1.0, Q: 1.07, K: 1.16 };
export function makeArt(cell, cs, pitch = cs * 0.9) {
  const cw = cell.w,
    chh = cell.h;
  // about one row tall: a piece's base sits on its square and its head just reaches the row behind
  const unit = pitch * 1.2;
  const art = { pieces: { 0: {}, 1: {} }, unit };
  for (const t of ["P", "R", "B", "Q", "K", "N"]) {
    const ph = unit * HEIGHT[t],
      pw = ph * 0.98;
    const make = (flip, seed, side) => bakeSprite({ w: pw, h: ph, cw, ch: chh, mode: PIECE_MODE[t], draw: design(100, 140, PIECES[t], flip), seed, bite: 0.5, grain: 0.06, round: 0.2, relief: 6, gain: side ? 1.12 : 1.3, shift: side ? 0.0 : 0.06 });
    art.pieces[0][t] = make(false, 11 + t.charCodeAt(0), 0);
    art.pieces[1][t] = make(true, 31 + t.charCodeAt(0), 1);
  }
  const gh = unit * 0.9;
  art.gold = bakeSprite({ w: gh * 0.95, h: gh, cw, ch: chh, mode: "blob", draw: design(100, 140, goldBlock), seed: 5, charset: ["o", "s", "a", "&", "$", "&", "$", "%"], relief: 5, bite: 0.4, round: 0.2 });
  return art;
}

export function makeScenery(cell, kind, w, h, seed) {
  const o = { w, h, cw: cell.w, ch: cell.h, seed };
  if (kind === "trunk") return bakeSprite({ ...o, mode: "revolve", draw: design(100, 400, trunk(seed)), bite: 0.35, grain: 0.1, streaks: 0.45, gamma: 0.95, light: [-0.3, -0.5, 0.8] });
  if (kind === "rock") return bakeSprite({ ...o, mode: "blob", draw: design(100, 100, rock(seed)), bite: 0.4, relief: 4.5, round: 0.3 });
  if (kind === "tomb") return bakeSprite({ ...o, mode: "blob", draw: design(100, 140, tomb), bite: 0.35, relief: 3, round: 0.18, grain: 0.1 });
  if (kind === "pillar") return bakeSprite({ ...o, mode: "revolve", draw: design(100, 280, pillar), bite: 0.4, grain: 0.1, streaks: 0.3 });
  return null;
}

export function makeMoon(cell, size, seed = 8) {
  return bakeSprite({ w: size, h: size, cw: cell.w, ch: cell.h, mode: "blob", draw: design(100, 100, moon), seed, relief: 4.2, round: 0.3, bite: 0.3, gain: 1.08, contrast: 1.25 });
}
