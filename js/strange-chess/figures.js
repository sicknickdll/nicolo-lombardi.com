// The living characters: small dithered, pixelated grayscale figures (the boss; a mask for the
// Woodcarver). Drawn as soft shapes on a tiny canvas, then quantised to four greys with an ordered
// (Bayer) dither; accents (the red cloth, a lantern) are added afterwards, pixel-exact.
const W = 44,
  H = 64;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const GREYS = [14, 78, 150, 226];

const grad = (g, y0, y1, a, b) => {
  const k = g.createLinearGradient(0, y0, 0, y1);
  k.addColorStop(0, a);
  k.addColorStop(1, b);
  return k;
};
const ellipse = (g, x, y, rx, ry, fill) => {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
};
const poly = (g, pts, fill) => {
  g.fillStyle = fill;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
};
const line = (g, x0, y0, x1, y1, w, c) => {
  g.strokeStyle = c;
  g.lineWidth = w;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
};

const DRAW = {
  trapper(g, acc) {
    // long coat, wide hat, a bear trap hanging from one hand
    poly(g, [[13, 26], [31, 26], [38, 62], [6, 62]], grad(g, 26, 62, "#8a8a8a", "#202020"));
    ellipse(g, 22, 20, 6.5, 7.5, "#cfcfcf");
    ellipse(g, 22, 14, 15, 3.2, "#2a2a2a");
    poly(g, [[15, 14], [29, 14], [27, 4], [17, 4]], "#3c3c3c");
    ellipse(g, 19.5, 21, 1.1, 1.4, "#111");
    ellipse(g, 24.5, 21, 1.1, 1.4, "#111");
    // the trap: two jaws with teeth
    poly(g, [[31, 44], [43, 44], [43, 49], [31, 49]], "#6a6a6a");
    for (let i = 0; i < 5; i++) poly(g, [[31 + i * 2.5, 49], [32.2 + i * 2.5, 53], [33.5 + i * 2.5, 49]], "#c8c8c8");
    line(g, 28, 36, 36, 44, 1.6, "#555");
    acc.push({ x: 14, y: 25, w: 16, h: 3, c: "#7a1f2b" }, { x: 28, y: 28, w: 3, h: 9, c: "#7a1f2b" });
  },
  angler(g, acc) {
    // a tall hood and a long rod; the line itself is drawn by the game
    poly(g, [[22, 1], [34, 30], [10, 30]], grad(g, 1, 30, "#9a9a9a", "#3a3a3a"));
    poly(g, [[12, 28], [32, 28], [40, 62], [4, 62]], grad(g, 28, 62, "#707070", "#1c1c1c"));
    ellipse(g, 22, 19, 4.5, 6, "#0c0c0c");
    ellipse(g, 20.5, 19, 0.9, 1.2, "#d8d8d8");
    ellipse(g, 24.5, 19, 0.9, 1.2, "#d8d8d8");
    line(g, 30, 40, 43, 3, 1.1, "#cfcfcf");
    line(g, 43, 3, 43, 9, 0.7, "#cfcfcf");
    acc.push({ x: 18, y: 44, w: 3, h: 3, c: "#d9b84a" });
  },
  prospector(g, acc) {
    // a flat hat with a lamp, a big beard, a pickaxe over the shoulder
    poly(g, [[11, 28], [33, 28], [40, 62], [4, 62]], grad(g, 28, 62, "#7a7a7a", "#202020"));
    ellipse(g, 22, 21, 6.5, 7, "#c8c8c8");
    ellipse(g, 22, 28, 6, 6, "#e6e6e6");
    ellipse(g, 22, 13, 12, 2.6, "#262626");
    poly(g, [[15, 13], [29, 13], [27, 7], [17, 7]], "#383838");
    line(g, 5, 61, 35, 17, 1.8, "#9a9a9a");
    poly(g, [[28, 10], [42, 15], [28, 20]], "#d4d4d4");
    ellipse(g, 19.5, 21, 1.1, 1.3, "#111");
    ellipse(g, 24.5, 21, 1.1, 1.3, "#111");
    acc.push({ x: 21, y: 9, w: 2, h: 2, c: "#d9b84a" });
  },
  woodcarver(g, acc, mask) {
    // a hooded figure with a blank pale mask; each mask hints at the boss it borrows
    poly(g, [[22, 2], [34, 28], [12, 28]], grad(g, 2, 28, "#8a8a8a", "#2a2a2a"));
    poly(g, [[11, 26], [33, 26], [41, 62], [3, 62]], grad(g, 26, 62, "#6a6a6a", "#161616"));
    ellipse(g, 22, 18, 6.2, 8, "#e8e8e8");
    ellipse(g, 19.5, 17, 1.2, 2, "#0c0c0c");
    ellipse(g, 24.5, 17, 1.2, 2, "#0c0c0c");
    if (mask === "trapper") for (let i = 0; i < 4; i++) poly(g, [[18 + i * 2.2, 22], [19.1 + i * 2.2, 25], [20.2 + i * 2.2, 22]], "#1a1a1a");
    else if (mask === "angler") {
      line(g, 22, 10, 22, 2, 0.8, "#e0e0e0");
      ellipse(g, 22, 2, 1.4, 1.4, "#f4f4f4");
      ellipse(g, 22, 22, 2.6, 1, "#111");
    } else if (mask === "prospector") {
      ellipse(g, 22, 22.5, 4.5, 1.2, "#333");
      acc.push({ x: 21, y: 10, w: 2, h: 2, c: "#d9b84a" });
    } else ellipse(g, 22, 23, 1.6, 0.8, "#111");
    // a knife and a small block
    line(g, 33, 44, 40, 36, 1.4, "#d8d8d8");
    poly(g, [[30, 52], [38, 52], [38, 58], [30, 58]], "#8c8c8c");
  },
};

// kind: trapper | angler | prospector | woodcarver (mask: which mask the Woodcarver wears)
export function makeFigure(kind, mask = null) {
  const src = document.createElement("canvas");
  src.width = W;
  src.height = H;
  const g = src.getContext("2d", { willReadFrequently: true });
  const acc = [];
  DRAW[kind](g, acc, mask);
  const px = g.getImageData(0, 0, W, H);
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const o = out.getContext("2d");
  const img = o.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const a = px.data[i + 3] / 255;
      const t = BAYER[(y & 3) * 4 + (x & 3)];
      if (a < 0.2 + t * 0.6) continue; // the edge dissolves in a dither
      const l = px.data[i] / 255;
      const lv = Math.max(0, Math.min(3, Math.floor(l * 4 + t - 0.5)));
      const v = GREYS[lv];
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  o.putImageData(img, 0, 0);
  for (const a of acc) {
    o.fillStyle = a.c;
    o.fillRect(a.x, a.y, a.w, a.h);
  }
  return out;
}
export const FIGURE_SIZE = { w: W, h: H };
