// Procedural textures for the Tarot Reader's table, drawn on canvases at start-up (no image
// files to load): the wooden table top, the reading cloth, candle flame and glow, dust, her
// silhouette. All original, all low-key: the scene is mostly black.
import { CanvasTexture, SRGBColorSpace, RepeatWrapping } from "../vendor/three.js";

function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const canvas = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
};
const tex = (c, srgb = true) => {
  const t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

// The table top: dark planks running left to right, grain, scratches, old wax and stains.
// `marks` are table positions in 0..1 (u across, v toward the player) where candles stand.
export function woodTexture(marks = []) {
  const W = 1024,
    H = 640;
  const [c, g] = canvas(W, H);
  const r = rand(11);
  g.fillStyle = "#24130d";
  g.fillRect(0, 0, W, H);
  const planks = 5;
  for (let p = 0; p < planks; p++) {
    const y0 = (p * H) / planks,
      ph = H / planks;
    const tone = 0.75 + r() * 0.35;
    g.fillStyle = `rgb(${Math.round(42 * tone)},${Math.round(22 * tone)},${Math.round(15 * tone)})`;
    g.fillRect(0, y0, W, ph);
    // grain: long wavy lines
    for (let i = 0; i < 70; i++) {
      const y = y0 + r() * ph,
        amp = 1 + r() * 4,
        f = 0.004 + r() * 0.01,
        ph2 = r() * 10;
      g.strokeStyle = r() < 0.5 ? `rgba(10,4,2,${0.25 + r() * 0.35})` : `rgba(90,52,30,${0.08 + r() * 0.12})`;
      g.lineWidth = 0.6 + r() * 1.6;
      g.beginPath();
      for (let x = 0; x <= W; x += 8) g.lineTo(x, y + Math.sin(x * f + ph2) * amp + Math.sin(x * f * 3.1) * amp * 0.3);
      g.stroke();
    }
    // a knot or two
    for (let k = 0; k < 2; k++) {
      if (r() < 0.4) continue;
      const kx = r() * W,
        ky = y0 + ph * (0.3 + r() * 0.4);
      for (let ring = 6; ring > 0; ring--) {
        g.strokeStyle = `rgba(12,5,3,${0.18 + ring * 0.04})`;
        g.lineWidth = 1.2;
        g.beginPath();
        g.ellipse(kx, ky, ring * 5 + 4, ring * 2 + 1.5, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
    // seam
    g.fillStyle = "rgba(4,1,1,0.85)";
    g.fillRect(0, y0, W, 2);
    g.fillStyle = "rgba(80,45,28,0.18)";
    g.fillRect(0, y0 + 2, W, 1);
  }
  // scratches
  for (let i = 0; i < 90; i++) {
    const x = r() * W,
      y = r() * H,
      len = 8 + r() * 60,
      a = (r() - 0.5) * 1.2;
    g.strokeStyle = `rgba(150,105,70,${0.05 + r() * 0.12})`;
    g.lineWidth = 0.5 + r() * 0.8;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  // ring stains from old cups
  for (let i = 0; i < 3; i++) {
    const x = r() * W,
      y = r() * H,
      rad = 20 + r() * 18;
    g.strokeStyle = `rgba(8,3,2,${0.25 + r() * 0.2})`;
    g.lineWidth = 2 + r() * 3;
    g.beginPath();
    g.arc(x, y, rad, r() * 2, r() * 2 + 4.5);
    g.stroke();
  }
  // a burn mark
  const bx = W * 0.62,
    by = H * 0.86;
  const burn = g.createRadialGradient(bx, by, 2, bx, by, 26);
  burn.addColorStop(0, "rgba(0,0,0,0.75)");
  burn.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = burn;
  g.fillRect(bx - 30, by - 30, 60, 60);
  // old wax around the candles
  for (const m of marks) {
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2,
        d = 22 + r() * 46;
      const x = m.u * W + Math.cos(a) * d,
        y = m.v * H + Math.sin(a) * d * 0.8,
        s = 1.5 + r() * 4.5;
      g.fillStyle = `rgba(${150 + r() * 30},${125 + r() * 20},${95 + r() * 20},${0.35 + r() * 0.3})`;
      g.beginPath();
      g.ellipse(x, y, s, s * (0.6 + r() * 0.5), r() * 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,245,220,0.12)";
      g.beginPath();
      g.arc(x - s * 0.3, y - s * 0.3, s * 0.35, 0, Math.PI * 2);
      g.fill();
    }
  }
  // vignette toward the edges: years of hands
  const v = g.createRadialGradient(W / 2, H * 0.55, H * 0.2, W / 2, H * 0.55, W * 0.62);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.45)");
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  return tex(c);
}

// The reading cloth: dark crimson velvet, a gold-thread border, a circle and the cross of the
// spread embroidered faintly in the middle, moons in the corners.
export function clothTexture() {
  const S = 512;
  const [c, g] = canvas(S, S);
  const r = rand(5);
  g.fillStyle = "#3a0b11";
  g.fillRect(0, 0, S, S);
  const img = g.getImageData(0, 0, S, S),
    d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 18;
    d[i] = Math.max(0, d[i] + n);
    d[i + 1] = Math.max(0, d[i + 1] + n * 0.3);
    d[i + 2] = Math.max(0, d[i + 2] + n * 0.3);
  }
  g.putImageData(img, 0, 0);
  // velvet sheen
  const sheen = g.createRadialGradient(S * 0.45, S * 0.4, 10, S / 2, S / 2, S * 0.7);
  sheen.addColorStop(0, "rgba(120,30,35,0.25)");
  sheen.addColorStop(1, "rgba(0,0,0,0.35)");
  g.fillStyle = sheen;
  g.fillRect(0, 0, S, S);
  const gold = (a) => `rgba(196,150,82,${a})`;
  g.strokeStyle = gold(0.55);
  g.lineWidth = 3;
  g.strokeRect(18, 18, S - 36, S - 36);
  g.lineWidth = 1;
  g.strokeRect(28, 28, S - 56, S - 56);
  // stitched dashes between the border lines
  g.setLineDash([4, 6]);
  g.strokeStyle = gold(0.35);
  g.strokeRect(23, 23, S - 46, S - 46);
  g.setLineDash([]);
  // the circle and the cross
  g.strokeStyle = gold(0.16);
  g.lineWidth = 2;
  g.beginPath();
  g.arc(S / 2, S / 2, S * 0.36, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 1;
  g.beginPath();
  g.arc(S / 2, S / 2, S * 0.38, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(S / 2, S * 0.1);
  g.lineTo(S / 2, S * 0.9);
  g.moveTo(S * 0.1, S / 2);
  g.lineTo(S * 0.9, S / 2);
  g.stroke();
  // little moons and stars in the corners
  const moon = (x, y, rad, flip) => {
    g.fillStyle = gold(0.45);
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#3a0b11";
    g.beginPath();
    g.arc(x + (flip ? -rad * 0.45 : rad * 0.45), y - rad * 0.15, rad * 0.9, 0, Math.PI * 2);
    g.fill();
  };
  moon(52, 52, 9, false);
  moon(S - 52, 52, 9, true);
  moon(52, S - 52, 9, true);
  moon(S - 52, S - 52, 9, false);
  g.fillStyle = gold(0.4);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2,
      x = S / 2 + Math.cos(a) * S * 0.42,
      y = S / 2 + Math.sin(a) * S * 0.42;
    g.fillRect(x - 1, y - 1, 2, 2);
  }
  const t = tex(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

// Candle flame: a soft teardrop, white at the core.
export function flameTexture() {
  const [c, g] = canvas(64, 128);
  const grd = g.createRadialGradient(32, 92, 2, 32, 80, 60);
  grd.addColorStop(0, "rgba(255,255,235,1)");
  grd.addColorStop(0.18, "rgba(255,226,150,0.95)");
  grd.addColorStop(0.45, "rgba(255,140,50,0.55)");
  grd.addColorStop(1, "rgba(120,20,0,0)");
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(32, 4);
  g.bezierCurveTo(52, 50, 58, 82, 46, 110);
  g.quadraticCurveTo(32, 124, 18, 110);
  g.bezierCurveTo(6, 82, 12, 50, 32, 4);
  g.fill();
  return tex(c);
}

// A round soft glow (candle halos, the eyes' glow, dust motes).
export function glowTexture(inner = "rgba(255,200,130,1)", size = 64) {
  const [c, g] = canvas(size, size);
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return tex(c);
}

// Her silhouette: hood and shoulders, barely lighter than the dark.
export function silhouetteTexture() {
  const W = 256,
    H = 256;
  const [c, g] = canvas(W, H);
  g.filter = "blur(10px)";
  g.fillStyle = "rgba(26,9,13,1)";
  g.beginPath();
  g.moveTo(W * 0.5, H * 0.06);
  g.bezierCurveTo(W * 0.72, H * 0.06, W * 0.76, H * 0.3, W * 0.74, H * 0.46);
  g.bezierCurveTo(W * 0.92, H * 0.55, W * 1.0, H * 0.7, W * 1.0, H);
  g.lineTo(0, H);
  g.bezierCurveTo(0, H * 0.7, W * 0.08, H * 0.55, W * 0.26, H * 0.46);
  g.bezierCurveTo(W * 0.24, H * 0.3, W * 0.28, H * 0.06, W * 0.5, H * 0.06);
  g.fill();
  // the dark inside the hood, where the eyes are
  g.fillStyle = "rgba(3,1,2,1)";
  g.beginPath();
  g.ellipse(W * 0.5, H * 0.33, W * 0.16, H * 0.17, 0, 0, Math.PI * 2);
  g.fill();
  return tex(c);
}
