// Fish as DEVAULT's letter tiles: every cell a filled colour tile with a darker glyph on it, thin dark
// seams between, a few bright glyphs sprinkled. The tile grid is fixed to the screen; the fish are
// drawn smoothly underneath (body wave, turn, tilt) into a layer one pixel per tile, so they glide
// through the grid instead of jumping from cell to cell.
import { shadeField, detailGlyph } from "./ascii.js";

const FONT = '"Geist Mono", ui-monospace, Menlo, monospace';
const SPRINKLE = ["#9b7bff", "#5fd38a", "#5b8cff", "#ff6fae", "#f3cf6b", "#4fd1d9"];
const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// The drawing with light on it: lit from the top left, a soft highlight, the drawn colours kept.
export function makeLook(img, bm) {
  const c = document.createElement("canvas");
  c.width = img.w;
  c.height = img.h;
  const x = c.getContext("2d"),
    id = x.createImageData(img.w, img.h),
    sh = shadeField(bm);
  for (let i = 0; i < img.w * img.h; i++) {
    const a = img.px[i * 4 + 3];
    if (!a) continue;
    const s = sh[i],
      f = 0.62 + 0.55 * s,
      hi = Math.max(0, s - 0.8) * 2.2;
    for (let k = 0; k < 3; k++) {
      const v = img.px[i * 4 + k] * f;
      id.data[i * 4 + k] = v + (255 - v) * hi;
    }
    id.data[i * 4 + 3] = a;
  }
  x.putImageData(id, 0, 0);
  return c;
}

// One fish into the tile layer (ctx already scaled 1/T): slices of the drawing ride a wave that
// grows toward the tail; the head barely answers.
export function drawShape(ctx, f, look, size, T) {
  const lw = look.width,
    lh = look.height,
    face = Math.abs(f.face) < 0.06 ? 0.06 * Math.sign(f.face || 1) : f.face,
    n = Math.max(6, Math.round(lw / 5)),
    sw = lw / n,
    amp = lh * (f.state === "held" ? 0.16 : 0.1),
    ph = f.phase * 2.2;
  ctx.setTransform(1 / T, 0, 0, 1 / T, 0, 0);
  ctx.translate(f.x, f.y);
  ctx.rotate(f.tilt * Math.sign(face));
  ctx.scale((face * size.w) / lw, size.h / lh);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n,
      dy = amp * Math.sin(ph - u * 5.5) * (1 - u) ** 1.7 - amp * 0.12 * Math.sin(ph) * u * u;
    ctx.drawImage(look, i * sw, 0, sw, lh, -lw / 2 + i * sw, -lh / 2 + dy, sw + 0.6, lh);
  }
}

// Is (x, y) on the fish? The pointer is taken back into the drawing's own coordinates.
export function hitShape(f, size, x, y, slop = 5) {
  let dx = x - f.x,
    dy = y - f.y;
  const a = -f.tilt * Math.sign(f.face || 1),
    rx = dx * Math.cos(a) - dy * Math.sin(a),
    ry = dx * Math.sin(a) + dy * Math.cos(a);
  const face = Math.abs(f.face) < 0.2 ? 0.2 * Math.sign(f.face || 1) : f.face,
    ix = Math.round(rx / ((face * size.w) / f.img.w) + f.img.w / 2),
    iy = Math.round(ry / (size.h / f.img.h) + f.img.h / 2);
  for (let oy = -slop; oy <= slop; oy += 2)
    for (let ox = -slop; ox <= slop; ox += 2) {
      const px = ix + ox,
        py = iy + oy;
      if (px >= 0 && py >= 0 && px < f.img.w && py < f.img.h && f.img.px[(py * f.img.w + px) * 4 + 3] > 110) return true;
    }
  return false;
}

// Paint a layer of tiles. data: RGBA, one pixel per tile. mute: [r, g, b, k] pulls colours toward
// the light (and the haze, for far fish).
const colors = new Map();
const css = (r, g, b) => {
  const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
  let s = colors.get(key);
  if (!s) colors.set(key, (s = `rgb(${(r >> 3) << 3},${(g >> 3) << 3},${(b >> 3) << 3})`));
  return s;
};
export function paintTiles(g, data, cols, rows, T, { ox = 0, oy = 0, mute = null, dim = 1, glyphs = true } = {}) {
  const gap = T >= 5 ? 1 : 0.5,
    glyphList = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      if (data[i + 3] < 96) continue;
      let r = data[i],
        gg = data[i + 1],
        b = data[i + 2];
      if (mute) {
        const [mr, mg, mb, k] = mute,
          l = (r * 0.3 + gg * 0.59 + b * 0.11) / 255;
        r += (mr * (0.4 + l) - r) * k;
        gg += (mg * (0.4 + l) - gg) * k;
        b += (mb * (0.4 + l) - b) * k;
      }
      r = Math.min(255, r * dim);
      gg = Math.min(255, gg * dim);
      b = Math.min(255, b * dim);
      g.fillStyle = css(r | 0, gg | 0, b | 0);
      const px = ox + x * T,
        py = oy + y * T;
      g.fillRect(px + gap / 2, py + gap / 2, T - gap, T - gap);
      if (!glyphs) continue;
      const l = (r * 0.3 + gg * 0.59 + b * 0.11) / 255,
        h = hash(x, y);
      if (l < 0.12 && h > 0.3) continue;
      const sprinkle = h < 0.055 && l > 0.45,
        k = l > 0.3 ? 0.52 : 2.2;
      glyphList.push(px + T / 2, py + T / 2 + 0.5, detailGlyph(0.35 + l * 0.6, x, y), sprinkle ? SPRINKLE[(hash(y, x) * SPRINKLE.length) | 0] : css(Math.min(255, r * k) | 0, Math.min(255, gg * k) | 0, Math.min(255, b * k) | 0));
    }
  if (!glyphList.length) return;
  g.font = `${Math.round(T * 0.95)}px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let i = 0; i < glyphList.length; i += 4) {
    g.fillStyle = glyphList[i + 3];
    g.fillText(glyphList[i + 2], glyphList[i], glyphList[i + 1]);
  }
  g.textAlign = "start";
  g.textBaseline = "top";
}

// A layer for the fish of one depth band, read back and painted as tiles.
export function createTileLayer() {
  const c = document.createElement("canvas"),
    x = c.getContext("2d", { willReadFrequently: true });
  return {
    draw(g, fish, { W, H, T, look, size, mute, dim }) {
      if (!fish.length) return;
      const cols = Math.ceil(W / T),
        rows = Math.ceil(H / T);
      if (c.width !== cols || c.height !== rows) (c.width = cols), (c.height = rows);
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.clearRect(0, 0, cols, rows);
      for (const f of fish) drawShape(x, f, look(f), size(f), T);
      paintTiles(g, x.getImageData(0, 0, cols, rows).data, cols, rows, T, { mute, dim });
    },
  };
}
