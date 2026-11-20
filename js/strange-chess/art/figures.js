// The bosses as small dithered grayscale figures (like the riders and wanderers in the
// references): each is painted at low resolution with soft shapes lit from the left, then
// reduced to four grays with an ordered (Bayer) dither and scaled up without smoothing. Pure red
// in the painting becomes the muted crimson cloth, pure yellow a warm lamp.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const GRAYS = [
  [14, 15, 22],
  [62, 64, 78],
  [140, 142, 156],
  [226, 228, 236],
];
const CRIMSON = [
  [40, 10, 16],
  [122, 31, 43],
  [176, 60, 70],
];
const GOLD = [
  [90, 60, 16],
  [217, 184, 74],
  [255, 236, 170],
];

// Painting helpers on a small canvas: a body part lit from the left.
function part(x, path, light = 0.7, dark = 0.12) {
  const b = path.bounds;
  const g = x.createLinearGradient(b[0], 0, b[2], 0);
  g.addColorStop(0, `rgb(${255 * light | 0},${255 * light | 0},${255 * light | 0})`);
  g.addColorStop(1, `rgb(${255 * dark | 0},${255 * dark | 0},${255 * dark | 0})`);
  x.fillStyle = g;
  x.fill(path.p);
}
function P(fn, bounds) {
  const p = new Path2D();
  fn(p);
  return { p, bounds };
}
const ellipse = (cx, cy, rx, ry) => P((p) => p.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2), [cx - rx, cy - ry, cx + rx, cy + ry]);
const poly = (pts) =>
  P(
    (p) => {
      pts.forEach(([a, b], i) => (i ? p.lineTo(a, b) : p.moveTo(a, b)));
      p.closePath();
    },
    [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))],
  );

// Each painter draws on a 40 × 64 canvas, feet at the bottom centre (20, 62).
const PAINTERS = {
  // The Trapper: a wide-brimmed hat, a long coat, a jaw trap hanging from one hand.
  trapper(x) {
    part(x, poly([[11, 62], [13, 30], [27, 30], [30, 62]]), 0.55, 0.08); // coat
    part(x, poly([[13, 30], [27, 30], [29, 40], [11, 40]]), 0.66, 0.1); // shoulders
    part(x, ellipse(20, 24, 4.5, 5), 0.85, 0.3); // face
    part(x, poly([[7, 20], [33, 20], [30, 22], [10, 22]]), 0.5, 0.05); // brim
    part(x, poly([[14, 20], [26, 20], [24, 12], [16, 12]]), 0.6, 0.08); // crown
    x.fillStyle = "#f00"; // crimson scarf
    x.fill(poly([[15, 29], [25, 29], [24, 33], [16, 33]]).p);
    x.fillRect(22, 33, 3, 9);
    part(x, poly([[28, 40], [31, 40], [31, 50], [28, 50]]), 0.5, 0.2); // arm
    x.strokeStyle = "#999";
    x.lineWidth = 0.8;
    x.beginPath();
    x.moveTo(30, 50);
    x.lineTo(31, 54);
    x.stroke();
    part(x, poly([[26, 54], [36, 54], [37, 58], [25, 58]]), 0.9, 0.3); // the trap
    x.fillStyle = "#ddd";
    for (let i = 0; i < 5; i++) x.fillRect(26 + i * 2.2, 52.5, 1, 1.8);
  },
  // The Angler: a rain hood, a rod over the shoulder with the line hanging down.
  angler(x) {
    part(x, poly([[12, 62], [14, 32], [26, 32], [29, 62]]), 0.6, 0.08);
    part(x, ellipse(20, 26, 6.5, 8), 0.7, 0.1); // hood
    part(x, ellipse(19.5, 27, 3.6, 4.2), 0.25, 0.05); // the dark inside of the hood
    x.fillStyle = "#fff";
    x.fillRect(18, 27, 1, 1);
    x.fillRect(21, 27, 1, 1);
    x.fillStyle = "#f00";
    x.fillRect(14, 44, 12, 3); // crimson belt
    x.strokeStyle = "#bbb";
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(25, 40);
    x.lineTo(38, 4);
    x.stroke();
    x.strokeStyle = "#888";
    x.lineWidth = 0.5;
    x.beginPath();
    x.moveTo(38, 4);
    x.quadraticCurveTo(39.5, 22, 38, 36);
    x.stroke();
  },
  // The Prospector: a helmet with a lamp, a pickaxe on the shoulder, a heavy beard.
  prospector(x) {
    part(x, poly([[10, 62], [12, 33], [28, 33], [31, 62]]), 0.6, 0.1);
    part(x, ellipse(20, 27, 5, 5.5), 0.85, 0.3);
    part(x, poly([[15, 29], [25, 29], [23, 37], [17, 37]]), 0.8, 0.4); // beard
    part(x, P((p) => p.ellipse(20, 22, 7, 5, 0, Math.PI, 0), [13, 17, 27, 22]), 0.75, 0.15); // helmet
    x.fillStyle = "#ff0"; // lamp
    x.fillRect(18.5, 17.5, 3, 2.5);
    x.strokeStyle = "#aaa";
    x.lineWidth = 1.2;
    x.beginPath();
    x.moveTo(8, 46);
    x.lineTo(30, 30);
    x.stroke();
    x.lineWidth = 1.6;
    x.beginPath();
    x.moveTo(27, 25);
    x.quadraticCurveTo(33, 30, 34, 37);
    x.stroke();
    x.fillStyle = "#f00";
    x.fillRect(13, 40, 3, 9);
  },
  // The Woodcarver: tall, thin, a carved mask, a knife.
  woodcarver(x) {
    part(x, poly([[13, 62], [15, 24], [25, 24], [28, 62]]), 0.5, 0.06);
    part(x, poly([[11, 26], [29, 26], [27, 36], [13, 36]]), 0.55, 0.08);
    part(x, ellipse(20, 16, 5.5, 7.5), 0.95, 0.4); // the mask
    x.fillStyle = "#111";
    x.fillRect(17, 14, 2, 3);
    x.fillRect(22, 14, 2, 3);
    x.fillRect(18.5, 20, 4, 1);
    x.fillStyle = "#f00";
    x.fill(poly([[15, 36], [26, 36], [24, 58], [17, 58]]).p); // crimson apron
    x.strokeStyle = "#eee";
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(29, 42);
    x.lineTo(33, 50);
    x.stroke();
  },
};

export function bakeFigure(kind, scale = 2) {
  const w = 40,
    h = 64;
  const src = document.createElement("canvas");
  src.width = w;
  src.height = h;
  const x = src.getContext("2d", { willReadFrequently: true });
  // a soft dark shadow pooled at the feet
  const sg = x.createRadialGradient(22, 62, 0, 22, 62, 14);
  sg.addColorStop(0, "rgba(0,0,0,0.9)");
  sg.addColorStop(1, "rgba(0,0,0,0)");
  (PAINTERS[kind] || PAINTERS.trapper)(x);
  const img = x.getImageData(0, 0, w, h);
  const d = img.data;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = (j * w + i) * 4;
      if (d[k + 3] < 110) {
        d[k + 3] = 0;
        continue;
      }
      const r = d[k],
        g = d[k + 1],
        b = d[k + 2];
      const th = BAYER[(j & 3) * 4 + (i & 3)];
      let pal = GRAYS,
        L = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
      if (r > 200 && g < 60 && b < 60) (pal = CRIMSON), (L = 0.45 + (i / w) * -0.3 + 0.2);
      else if (r > 200 && g > 200 && b < 60) (pal = GOLD), (L = 0.9);
      const lv = Math.min(pal.length - 1, Math.floor(L * (pal.length - 1) + th));
      const c = pal[lv];
      d[k] = c[0];
      d[k + 1] = c[1];
      d[k + 2] = c[2];
      d[k + 3] = 255;
    }
  x.putImageData(img, 0, 0);
  const out = document.createElement("canvas");
  out.width = w * scale;
  out.height = h * scale;
  const o = out.getContext("2d");
  o.imageSmoothingEnabled = false;
  o.globalAlpha = 0.85;
  o.drawImage(src, 0, 0, w * scale, h * scale);
  return { c: out, w: w * scale, h: h * scale, ax: 20 * scale, ay: 62 * scale };
}
