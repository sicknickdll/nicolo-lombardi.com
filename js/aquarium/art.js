// Starter drawings, decor, lights. Drawings are painted on the pad canvas (160 × 96, facing right).

export const TINTS = ["#f4f4f7", "#cbbcff", "#9b84f0", "#9fe8c8", "#f2c27c", "#ff9b8e"];
export const GOLD = "#f3cf6b";
export const HEART = "#ff8fb1";
export const FOOD = "#e9dcc0";

// After DEVAULT's presets: dark → mid → bright glyph colour, how much a fish keeps its own tint.
export const LIGHTS = {
  devault: { cost: 0, bg: "#07070a", stops: ["#2a2347", "#8f7ad6", "#f4f0ff"], tint: 0.75 },
  mono: { cost: 4, bg: "#070708", stops: ["#2a2a2e", "#9a9aa4", "#f4f4f7"], tint: 0.12 },
  monitor: { cost: 8, bg: "#020604", stops: ["#0c3a1a", "#2fbf5a", "#c8ffd8"], tint: 0.12, scan: true },
  amber: { cost: 8, bg: "#080502", stops: ["#3a2208", "#d98a2b", "#ffe3b0"], tint: 0.12, scan: true },
  ice: { cost: 10, bg: "#03070a", stops: ["#0f2a3d", "#4fa8d8", "#e6f7ff"], tint: 0.35 },
};
export const SANDS = { plain: 0, ripple: 3, pebble: 5 };

const L = (s) => s.replace(/^\n|\n\s*$/g, "").split("\n");
export const DECOR = {
  rock: {
    cost: 3,
    art: L(`
    .-~~~-.
  .'  .:.  '.
 /  .:::::.  \\
(__.:::::::.__)`),
  },
  wood: {
    cost: 5,
    art: L(`
          ___
 ___.--~~'   \`\\
(___..--..___/~-._
        \`--'      \`)`),
  },
  arch: {
    cost: 8,
    art: L(`
    .-""""-.
   / .-""-. \\
  | /      \\ |
  | |      | |
  | |      | |
 _|_|______|_|_`),
  },
  chest: {
    cost: 6,
    bubbles: true,
    art: L(`
  ________
 /_/____/_\\
 |   []   |
 |________|`),
  },
  anchor: {
    cost: 4,
    art: L(`
    _O_
     |
  ---+---
     |
 \\   |   /
  \`--+--'`),
  },
};

// ── starter drawings ──
const ell = (g, x, y, rx, ry, rot = 0) => (g.beginPath(), g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2), g.fill());
const poly = (g, pts) => (g.beginPath(), pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))), g.closePath(), g.fill());
const hole = (g, x, y, r) => {
  g.save();
  g.globalCompositeOperation = "destination-out";
  ell(g, x, y, r, r);
  g.restore();
};
const tone = (g, v) => {
  const c = `rgb(${v},${v},${v})`;
  g.fillStyle = c;
  g.strokeStyle = c;
};
const line = (g, pts, w) => {
  g.lineWidth = w;
  g.lineCap = g.lineJoin = "round";
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
};

export const STARTERS = {
  fish: {
    classic(g) {
      tone(g, 255);
      ell(g, 88, 48, 44, 24);
      poly(g, [[50, 48], [14, 22], [22, 48], [14, 74]]);
      tone(g, 150);
      poly(g, [[70, 28], [96, 10], [104, 30]]);
      line(g, [[104, 34], [98, 48], [104, 62]], 3);
      hole(g, 116, 42, 5);
    },
    angel(g) {
      tone(g, 255);
      poly(g, [[132, 48], [86, 16], [48, 48], [86, 80]]);
      tone(g, 160);
      poly(g, [[86, 18], [60, 2], [70, 30]]);
      poly(g, [[86, 78], [56, 95], [70, 66]]);
      poly(g, [[52, 48], [24, 30], [30, 48], [24, 66]]);
      tone(g, 90);
      line(g, [[96, 26], [96, 70]], 4);
      line(g, [[76, 30], [76, 66]], 4);
      hole(g, 116, 42, 4);
    },
    puffer(g) {
      tone(g, 200);
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) line(g, [[84 + Math.cos(a) * 28, 48 + Math.sin(a) * 28], [84 + Math.cos(a) * 42, 48 + Math.sin(a) * 42]], 3);
      tone(g, 255);
      ell(g, 84, 48, 32, 30);
      poly(g, [[54, 48], [34, 34], [34, 62]]);
      hole(g, 100, 40, 5);
      hole(g, 112, 56, 3);
    },
    eel(g) {
      tone(g, 255);
      const pts = [];
      for (let x = 10; x <= 130; x += 4) pts.push([x, 52 + Math.sin(x / 18) * 12 * (1 - x / 180)]);
      line(g, pts, 16);
      ell(g, 136, 50, 16, 11);
      tone(g, 120);
      line(g, pts.map(([x, y]) => [x, y - 10]), 3);
      hole(g, 142, 46, 3);
    },
    guppy(g) {
      tone(g, 130);
      poly(g, [[70, 48], [12, 14], [22, 48], [12, 82]]);
      tone(g, 230);
      for (let i = 0; i < 5; i++) line(g, [[66, 48], [18, 22 + i * 13]], 2);
      tone(g, 255);
      ell(g, 98, 48, 32, 15);
      hole(g, 118, 44, 4);
    },
    doodle(g) {
      tone(g, 255);
      g.lineWidth = 5;
      g.beginPath();
      g.ellipse(88, 48, 40, 26, 0, 0, Math.PI * 2);
      g.stroke();
      line(g, [[50, 40], [18, 20], [22, 48], [18, 76], [50, 56]], 5);
      line(g, [[108, 60], [118, 64], [126, 58]], 4);
      ell(g, 112, 40, 4, 4);
    },
  },
  plant: {
    kelp(g) {
      tone(g, 255);
      for (const [x0, h, ph] of [[60, 90, 0], [80, 70, 2], [100, 84, 4]]) {
        const pts = [];
        for (let y = 96; y > 96 - h; y -= 4) pts.push([x0 + Math.sin(y / 9 + ph) * 6, y]);
        line(g, pts, 5);
      }
    },
    fern(g) {
      tone(g, 255);
      line(g, [[80, 96], [82, 50], [78, 6]], 4);
      tone(g, 180);
      for (let y = 86; y > 12; y -= 10) {
        const s = 1 - (86 - y) / 100;
        line(g, [[81, y], [81 - 30 * s, y - 14 * s]], 3);
        line(g, [[81, y], [81 + 30 * s, y - 14 * s]], 3);
      }
    },
    coral(g) {
      tone(g, 255);
      const br = (x, y, a, len, w) => {
        if (len < 8) return;
        const x2 = x + Math.cos(a) * len,
          y2 = y + Math.sin(a) * len;
        line(g, [[x, y], [x2, y2]], w);
        br(x2, y2, a - 0.45, len * 0.72, w * 0.75);
        br(x2, y2, a + 0.4, len * 0.68, w * 0.75);
      };
      br(80, 96, -Math.PI / 2, 34, 9);
    },
  },
};

const SYL = ["bo", "mi", "zu", "ka", "pe", "lu", "ri", "ta", "no", "fi", "gu", "si", "do", "ne", "ya", "ko"];
export const fishName = (rnd = Math.random) => {
  const n = SYL[(rnd() * SYL.length) | 0] + SYL[(rnd() * SYL.length) | 0];
  return n[0].toUpperCase() + n.slice(1);
};
