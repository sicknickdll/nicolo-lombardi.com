// The stage: draws everything the player touches. The meadow (scene.js) is the ground; on it
// stand the board (a clearing: no tiles, only grass density, dirt glyphs and faint corner dots),
// the pieces (ASCII sculptures), the boss (a dithered figure), the scale and the candles.
// All drawing is in device pixels; the layout is in css pixels.
import { createAtlas, renderSprite, RAMP } from "./glyphs.js";
import { makeArt, makeMoon } from "./art.js";
import { createMeadow } from "./scene.js";
import { makeFigure, FIGURE_SIZE } from "./figures.js";
import { makeNoise, clamp, lerp, hash2 } from "./noise.js";
import { previewPush, ix, xOf, yOf } from "./rules.js";

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const DIRT = ["@", "0", "o", "."]; // integrity 4 → 1 as the ground goes: @ 0 o .

export function createStage({ canvas, reduce = false, seed = 7 }) {
  const ctx = canvas.getContext("2d", { alpha: false });
  let W = 0,
    H = 0,
    dpr = 1;
  let atlasS = null,
    atlasP = null,
    art = null,
    meadow = null;
  let L = null; // layout (css px)
  const vis = new Map();
  let fx = [];
  let particles = [];
  const tweens = [];
  let time = 0,
    frame = 0;
  const noise = makeNoise(seed + 3);
  // view state set by the game
  const ui = { selected: -1, targets: [], hover: -1, preview: [], hookWarn: null, moonWarn: null, traps: [], mode: "fight", giveable: [], campfireLit: false, showDots: true, pointer: null };
  let boss = null; // { id, figure canvas, mask }
  let figFade = null;
  let scaleVal = 0,
    scaleShown = 0;
  let candles = 2;
  const candleOut = [0, 0]; // 0 lit .. 1 out (animated)
  let moonSprite = null,
    moonKey = "";
  let winK = 0; // 0..1: the meadow clears and the camera rises
  let shadowSprite = null;
  const integ = new Array(36).fill(4);
  const holeAge = new Array(36).fill(0);

  // ── sizing ────────────────────────────────────────────────────────────────────────────────
  function layout() {
    const portrait = H > W * 1.1;
    const s = H < 620 ? 1.5 : H < 880 || portrait ? 2 : 2.5;
    const figH = FIGURE_SIZE.h * s;
    const bottom = clamp(H * 0.11, 66, 96);
    const top = Math.round(10 + 18 + 46 + figH + 4);
    const avail = H - top - bottom;
    const cs = Math.max(30, Math.min((W - 16) / 6, avail / (6 * 0.9), 128));
    const ch = cs * 0.9;
    const bx = (W - cs * 6) / 2;
    const by = top + Math.max(0, (avail - ch * 6) / 2) + 2;
    L = { W, H, s, figH, cs, ch, bx, by, portrait, figX: W / 2, figFeet: by + 2, nameY: by + 2 - figH - 14, hudY: by + ch * 6 + 10, bottom, top };
  }
  const cellX = (x) => L.bx + x * L.cs;
  const cellY = (y) => L.by + y * L.ch;
  // where a piece's base-centre sits (css px) for a (fractional) grid position
  const baseOf = (gx, gy) => ({ x: L.bx + (gx + 0.5) * L.cs, y: L.by + (gy + 0.9) * L.ch });

  function resize(w, h, ratio) {
    W = w;
    H = h;
    dpr = ratio;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    layout();
    atlasS = createAtlas(clamp(w / 150, 7, 9), ratio);
    atlasP = createAtlas(clamp(L.cs * 0.047, 4.8, 6.2), ratio);
    const cellP = { w: atlasP.cw / ratio, h: atlasP.ch / ratio };
    art = makeArt(cellP, L.cs, L.ch);
    if (!meadow) meadow = createMeadow({ atlas: atlasS, seed, reduce });
    else meadow = createMeadow({ atlas: atlasS, seed, reduce });
    if (boss) meadow.setTheme(boss.theme, true);
    meadow.setScenery(boss?.scenery || "meadow");
    meadow.resize(w, h, ratio, { x: L.bx, y: L.by, cw: L.cs, ch: L.ch });
    meadow.setAllIntegrity(integ, true);
    shadowSprite = makeShadow();
    moonSprite = null;
    for (const v of vis.values()) v.cv = null;
    makeBossFigure();
  }
  function makeShadow() {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 32;
    const g = c.getContext("2d");
    const k = g.createRadialGradient(32, 16, 0, 32, 16, 30);
    k.addColorStop(0, "rgba(1,2,6,0.7)");
    k.addColorStop(0.55, "rgba(1,2,6,0.4)");
    k.addColorStop(1, "rgba(1,2,6,0)");
    g.fillStyle = k;
    g.save();
    g.scale(1, 0.5);
    g.fillRect(0, 0, 64, 64);
    g.restore();
    return c;
  }
  let figCv = null;
  function makeBossFigure() {
    figCv = boss && boss.figure ? makeFigure(boss.figure, boss.mask) : null;
  }

  // ── pieces ────────────────────────────────────────────────────────────────────────────────
  function spriteOf(v) {
    if (v.t === "G") return { sp: art.gold, pal: "gold", atlas: atlasP };
    if (v.t === "M") {
      const size = L.cs * 2.1;
      const key = Math.round(size);
      if (!moonSprite || moonKey !== key) (moonSprite = makeMoon({ w: atlasS.cw / dpr, h: atlasS.ch / dpr }, size)), (moonKey = key);
      return { sp: moonSprite, pal: "moon", atlas: atlasS };
    }
    return { sp: art.pieces[v.side][v.t], pal: v.side ? "slate" : "bone", atlas: atlasP };
  }
  function bake(v) {
    const { sp, pal, atlas } = spriteOf(v);
    v.sprite = sp;
    v.pal = pal;
    v.atlas = atlas;
    v.cv = renderSprite(atlas, sp, pal, { shimmer: 0.05, t: time + v.seed, boost: v.bait ? 1 : 0, bg: v.t === "M" ? "rgba(3,5,12,0.28)" : "rgba(3,5,12,0.5)" });
    v.shimmerAt = time + 0.5 + Math.random() * 0.9;
  }
  function addVis(p, at) {
    const x = p.t === "M" ? p.x : xOf(at),
      y = p.t === "M" ? p.y : yOf(at);
    const v = { id: p.id, t: p.t, side: p.s, bait: !!p.bait, g: p.g || [], gx: x, gy: y, z: 0, a: 1, sc: 1, seed: hash2(p.id.length, p.id.charCodeAt(p.id.length - 1), 4) * 50, cv: null, born: time, glow: 0 };
    vis.set(p.id, v);
    return v;
  }
  // make the drawn pieces match a game state exactly
  function syncVis(state, { instant = true } = {}) {
    const seen = new Set();
    for (let i = 0; i < 36; i++) {
      const p = state.cells[i];
      if (!p) continue;
      if (p.t === "M" && i !== ix(p.x, p.y)) continue;
      seen.add(p.id);
      let v = vis.get(p.id);
      if (!v) v = addVis(p, i);
      if (v.t !== p.t || v.side !== p.s) {
        v.t = p.t;
        v.side = p.s;
        v.cv = null;
      }
      v.g = p.g || [];
      v.bait = !!p.bait;
      if (instant && !v.moving) {
        v.gx = p.t === "M" ? p.x : xOf(i);
        v.gy = p.t === "M" ? p.y : yOf(i);
      }
      v.a = 1;
      v.sc = 1;
      v.z = 0;
    }
    for (const id of [...vis.keys()]) if (!seen.has(id)) vis.delete(id);
    state.integ.forEach((n, i) => {
      integ[i] = n;
      meadow.setIntegrity(i, n, instant);
    });
    ui.traps = state.traps.slice();
  }
  function clearVis() {
    vis.clear();
    fx = [];
    particles = [];
    ui.selected = -1;
    ui.targets = [];
    ui.preview = [];
  }

  // ── tweens and effects ────────────────────────────────────────────────────────────────────
  function tween(dur, fn, ez = ease) {
    if (reduce) dur = Math.min(dur, 0.12);
    return new Promise((res) => tweens.push({ t0: time, dur, fn, ez, res }));
  }
  const wait = (s) => tween(s, () => {});
  // a one-off effect drawn every frame for `dur` seconds: draw(ctx, k 0..1)
  function addFx(dur, draw) {
    return new Promise((res) => fx.push({ t0: time, dur: reduce ? Math.min(dur, 0.3) : dur, draw, res }));
  }

  // the characters of a piece fly apart and become grass strokes or sparkles
  function dissolve(v, { dir = [0.4, -0.2], burst = 1, down = false } = {}) {
    if (!v.cv || !v.sprite) bake(v);
    const sp = v.sprite,
      b = baseOf(v.gx, v.gy);
    const w = sp.cols * atlasOf(v).cw,
      h = sp.rows * atlasOf(v).ch;
    const ox = b.x * dpr - w / 2,
      oy = b.y * dpr - h - v.z * dpr;
    const cw = atlasOf(v).cw,
      chh = atlasOf(v).ch;
    const maxN = reduce ? 40 : 420;
    const step = Math.max(1, Math.round((sp.cols * sp.rows) / maxN));
    let n = 0;
    for (let y = 0; y < sp.rows; y++)
      for (let x = 0; x < sp.cols; x++) {
        const i = y * sp.cols + x;
        if (!sp.ch[i] || (n++ % step && step > 1)) continue;
        const a = Math.random() * 6.283,
          sp0 = (30 + Math.random() * 90) * dpr * burst;
        particles.push({
          x: ox + x * cw,
          y: oy + y * chh,
          vx: Math.cos(a) * sp0 * 0.6 + dir[0] * 60 * dpr,
          vy: Math.sin(a) * sp0 * 0.5 + dir[1] * 60 * dpr - (down ? -90 * dpr : 20 * dpr),
          life: 0,
          max: (down ? 0.7 : 0.9) + Math.random() * 0.9,
          c: sp.ch[i],
          sh: sp.sh[i],
          pal: v.pal,
          atlas: atlasOf(v),
          end: Math.random() < 0.62 ? 0 : 1, // 0 → a grass stroke, 1 → a sparkle
          ang: -0.3 + Math.random() * 0.6,
        });
      }
    vis.delete(v.id);
  }
  const atlasOf = (v) => (v.atlas || (v.t === "M" ? atlasS : atlasP));

  // ── hit testing ───────────────────────────────────────────────────────────────────────────
  function cellAt(px, py) {
    const x = Math.floor((px - L.bx) / L.cs),
      y = Math.floor((py - L.by) / L.ch);
    return x >= 0 && x < 6 && y >= 0 && y < 6 ? y * 6 + x : -1;
  }
  // the piece whose sprite is under the pointer (front-most first)
  function pieceCellAt(px, py) {
    const list = [...vis.values()].filter((v) => v.cv && v.t !== "M").sort((a, b) => b.gy - a.gy);
    for (const v of list) {
      const b = baseOf(v.gx, v.gy);
      const w = v.cv.width / dpr,
        h = v.cv.height / dpr;
      if (Math.abs(px - b.x) < w * 0.36 && py > b.y - h && py < b.y + 4) return Math.round(v.gy) * 6 + Math.round(v.gx);
    }
    for (const v of vis.values()) {
      if (v.t !== "M" || !v.cv) continue;
      const b0 = { x: L.bx + (v.gx + 1) * L.cs, y: L.by + (v.gy + 1) * L.ch };
      if (Math.abs(px - b0.x) < L.cs && Math.abs(py - b0.y) < L.ch) return Math.round(v.gy) * 6 + Math.round(v.gx);
    }
    return -1;
  }

  // ── drawing helpers ───────────────────────────────────────────────────────────────────────
  const D = (v) => v * dpr;
  function glow(x, y, r, color, a) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  function drawBoardGround() {
    const { cs, ch } = L;
    // faint ASCII dots at the corners of the squares; they brighten near the pointer / selection
    const near = [];
    if (ui.hover >= 0) near.push(ui.hover);
    if (ui.selected >= 0) near.push(ui.selected);
    for (let y = 0; y <= 6; y++)
      for (let x = 0; x <= 6; x++) {
        let a = 0.2;
        for (const c of near) {
          const cx = c % 6,
            cy = (c / 6) | 0;
          if (x >= cx && x <= cx + 1 && y >= cy && y <= cy + 1) a = 0.7;
        }
        if (ui.mode !== "fight" && ui.mode !== "campfire" && ui.mode !== "title") a = 0;
        if (!a) continue;
        // not at corners that are surrounded by holes
        ctx.globalAlpha = a * (0.7 + 0.3 * Math.sin(time * 1.3 + x * 1.7 + y * 2.3));
        atlasS.put(ctx, a > 0.5 ? "+" : ".", "bone", a > 0.5 ? 3 : 2, D(L.bx + x * cs) - atlasS.cw / 2, D(L.by + y * ch) - atlasS.ch / 2);
      }
    ctx.globalAlpha = 1;
    // erosion: the ground turns to dirt glyphs, @ → 0 → o → ., then a hole
    for (let i = 0; i < 36; i++) {
      const n = integ[i];
      const x = i % 6,
        y = (i / 6) | 0;
      const ccx = cellX(x) + cs / 2,
        ccy = cellY(y) + ch / 2;
      if (n <= 0.02) {
        drawHole(x, y, ccx, ccy);
        continue;
      }
      if (n >= 3.98) continue;
      const lvl = Math.min(3, Math.floor(4 - n + 0.001)); // 0 → '@' (integrity 3) … 2 → 'o'
      const count = 4 + (4 - n) * 7;
      for (let k = 0; k < count; k++) {
        const hx = hash2(i, k, 9),
          hy = hash2(i, k, 21);
        const px = cellX(x) + 0.08 * cs + hx * cs * 0.84,
          py = cellY(y) + 0.1 * ch + hy * ch * 0.8;
        const chn = DIRT[clamp(Math.floor(3 - n + hash2(k, i, 5) * 1.3), 0, 3)];
        ctx.globalAlpha = 0.35 + 0.4 * hash2(i, k, 33);
        atlasS.put(ctx, chn, "dust", 2 + (hash2(i, k, 44) * 3) | 0, D(px), D(py));
      }
      ctx.globalAlpha = 1;
      void lvl;
    }
  }
  function drawHole(x, y, cx, cy) {
    const { cs, ch } = L;
    holeAge[y * 6 + x] += 1;
    // the darkest thing on screen: pure void with a crumbled rim
    const rx = cs * 0.5,
      ry = ch * 0.5;
    ctx.save();
    ctx.translate(D(cx), D(cy));
    ctx.beginPath();
    const pts = 26;
    for (let k = 0; k <= pts; k++) {
      const a = (k / pts) * 6.2832;
      const r = 0.86 + 0.18 * noise.n2(Math.cos(a) * 2 + x * 5.3, Math.sin(a) * 2 + y * 3.1) - 0.1;
      const px = Math.cos(a) * rx * r * 1.02,
        py = Math.sin(a) * ry * r * 1.02;
      k ? ctx.lineTo(D(px), D(py)) : ctx.moveTo(D(px), D(py));
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, D(rx));
    g.addColorStop(0, "rgba(0,0,1,1)");
    g.addColorStop(0.72, "rgba(1,2,5,0.97)");
    g.addColorStop(1, "rgba(3,5,10,0.7)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    // debris scattered round the edge, drifting
    for (let k = 0; k < 16; k++) {
      const a = hash2(x * 6 + y, k, 3) * 6.2832 + (reduce ? 0 : Math.sin(time * 0.4 + k) * 0.05);
      const rr = 0.78 + hash2(k, x * 6 + y, 8) * 0.42;
      const px = cx + Math.cos(a) * rx * rr,
        py = cy + Math.sin(a) * ry * rr;
      ctx.globalAlpha = 0.25 + 0.5 * hash2(k, 4, x + y);
      atlasS.put(ctx, ".:oo0,"[k % 6], "dust", 1 + (k % 3), D(px) - atlasS.cw / 2, D(py) - atlasS.ch / 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawPiece(v, extra = {}) {
    if (!v.cv || time > v.shimmerAt) bake(v);
    const b = baseOf(v.gx, v.gy);
    const w = v.cv.width,
      h = v.cv.height;
    const a = (extra.alpha ?? 1) * v.a;
    const sc = v.sc * (extra.scale ?? 1);
    const lift = (v.z + (extra.lift || 0)) * dpr;
    const sway = reduce ? 0 : Math.sin(time * 1.1 + v.seed) * 0.6 * dpr;
    const x = D(b.x) - (w * sc) / 2 + sway * 0.3,
      y = D(b.y) - h * sc - lift;
    // shadow on the grass, to the right and down
    if (!extra.noShadow) {
      const sw = (v.t === "M" ? L.cs * 1.7 : L.cs * 0.8) * dpr;
      ctx.globalAlpha = a * (v.t === "M" ? 0.8 : 1) * clamp(1 - lift / (60 * dpr) * 0.5, 0.3, 1);
      ctx.drawImage(shadowSprite, D(b.x) - sw * 0.38, D(b.y) - sw * 0.14, sw, sw * 0.46);
    }
    ctx.globalAlpha = a;
    if (v.glow) glow(D(b.x), D(b.y) - h * 0.5, h * 0.7, v.bait ? "rgba(240,230,190,0.5)" : "rgba(140,160,255,0.35)", 0.35 * v.glow * (0.7 + 0.3 * Math.sin(time * 3)));
    if (extra.tint) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
    }
    ctx.drawImage(v.cv, Math.round(x), Math.round(y), Math.round(w * sc), Math.round(h * sc));
    if (extra.tint) {
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // sigils: a tiny mark by the base
    if (v.g?.length && !extra.noMark) {
      const marks = v.g.map((s) => ({ pusher: ">>", rooted: "#", ghost: "~" })[s]).join("");
      ctx.globalAlpha = 0.85 * a;
      atlasS.text(ctx, marks, "gold", 5, D(b.x) - (marks.length * atlasS.cw) / 2, D(b.y) + 1);
      ctx.globalAlpha = 1;
    }
    // bait glows a little
    if (v.bait && !extra.noGlow) glow(D(b.x), D(b.y) - h * 0.45, h * 0.55, "rgba(240,225,170,0.45)", 0.4 + 0.2 * Math.sin(time * 3));
  }

  function drawSelection() {
    if (ui.selected < 0) return;
    const v = [...vis.values()].find((q) => Math.round(q.gy) * 6 + Math.round(q.gx) === ui.selected && q.t !== "M") || [...vis.values()].find((q) => q.t === "M");
    if (!v || !v.cv) return;
    const b = baseOf(v.gx, v.gy);
    const top = D(b.y) - v.cv.height - D(v.z) - D(10) + (reduce ? 0 : Math.sin(time * 3) * D(1.5));
    // the small gold diamond above the piece
    glow(D(b.x), top, D(14), "rgba(217,184,74,0.6)", 0.8);
    ctx.fillStyle = "#d9b84a";
    ctx.beginPath();
    const r = D(4.2);
    ctx.moveTo(D(b.x), top - r * 1.25);
    ctx.lineTo(D(b.x) + r, top);
    ctx.lineTo(D(b.x), top + r * 1.25);
    ctx.lineTo(D(b.x) - r, top);
    ctx.closePath();
    ctx.fill();
  }

  function drawTargets() {
    if (!ui.targets.length) return;
    const pulse = 0.55 + 0.35 * Math.sin(time * 3.2);
    for (const t of ui.targets) {
      const x = t.to % 6,
        y = (t.to / 6) | 0;
      const cx = D(cellX(x) + L.cs / 2),
        cy = D(cellY(y) + L.ch * 0.55);
      const hot = t.to === ui.hover;
      ctx.globalAlpha = (hot ? 1 : pulse) * 0.9;
      if (t.kind === "move") {
        // faint lavender dots in the grass, in a soft glow
        glow(cx, cy, D(L.cs * 0.42), "rgba(143,151,201,0.5)", hot ? 0.45 : 0.18);
        atlasS.text(ctx, ". : .", "bone", hot ? 6 : 5, cx - atlasS.cw * 2.5, cy - atlasS.ch * 0.8);
        atlasS.text(ctx, " : . ", "bone", hot ? 5 : 4, cx - atlasS.cw * 2.5, cy + atlasS.ch * 0.2);
      } else {
        // a ring of o round an enemy
        const rr = L.cs * 0.34;
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * 6.283 + time * 0.4;
          atlasS.put(ctx, "o", t.kind === "push" ? "gold" : "bone", hot ? 6 : 4, D(cellX(x) + L.cs / 2 + Math.cos(a) * rr) - atlasS.cw / 2, D(cellY(y) + L.ch * 0.62 + Math.sin(a) * rr * 0.45) - atlasS.ch / 2);
        }
        if (t.kind === "push") atlasS.text(ctx, ">>", "gold", 6, cx - atlasS.cw, cy - atlasS.ch * 1.6);
      }
    }
    ctx.globalAlpha = 1;
    // hover: the square's ground as a tiny glyph
  }
  function drawHoverInfo() {
    if (ui.hover < 0 || ui.mode !== "fight") return;
    const n = integ[ui.hover];
    const x = ui.hover % 6,
      y = (ui.hover / 6) | 0;
    const g = n <= 0.02 ? " " : DIRT[clamp(4 - Math.round(n), 0, 3)];
    ctx.globalAlpha = 0.9;
    if (g !== " ") atlasS.put(ctx, g, "bone", 5, D(cellX(x + 1) - 12), D(cellY(y + 1) - 12));
    ctx.globalAlpha = 1;
  }

  function drawPreview() {
    for (const p of ui.preview) {
      const v = vis.get(p.id);
      if (!v) continue;
      const nx = p.next[0][0],
        ny = p.next[0][1];
      const ghost = { ...v, gx: p.falls ? clamp(nx, -0.4, 5.4) : nx, gy: p.falls ? clamp(ny, -0.4, 5.4) : ny, a: p.falls ? 0.3 : 0.38, sc: p.falls ? 0.8 : 1 };
      ghost.cv = v.cv;
      drawPiece(ghost, { noShadow: true, noMark: true, noGlow: true });
      // arrow between
      const a = baseOf(v.gx, v.gy),
        b = baseOf(nx, ny);
      ctx.globalAlpha = 0.7;
      atlasS.put(ctx, p.falls ? "x" : ">", p.falls ? "crimson" : "gold", 5, D((a.x + b.x) / 2) - atlasS.cw / 2, D((a.y + b.y) / 2 - 18) - atlasS.ch / 2);
      ctx.globalAlpha = 1;
    }
  }

  // the ASCII balance, at the edge of the clearing: a post, a beam that tips towards whoever is ahead
  // (your side is the right-hand pan), chains and pans. More weight shows as heaped 0 and o.
  function drawScale() {
    const cw = atlasS.cw,
      chh = atlasS.ch;
    const cx = D(W / 2),
      y0 = D(L.hudY) + chh * 0.2;
    const put = (c, col, row, pal, sh) => atlasS.put(ctx, c, pal, sh, cx + Math.round(col) * cw - cw / 2, y0 + Math.round(row) * chh);
    const t = clamp(scaleShown / 5, -1, 1);
    const half = 10,
      tilt = t * 2.6;
    // post and base
    for (let r = 1; r <= 7; r++) put("|", 0, r, "bone", 4);
    atlasS.text(ctx, "/_____\\", "bone", 4, cx - cw * 3.5, y0 + chh * 8);
    put("^", 0, 0, "bone", 6);
    // the beam
    for (let i = -half; i <= half; i++) {
      const row = 1 + (tilt * i) / half;
      const slope = tilt / half;
      const c = Math.abs(slope) < 0.12 ? "=" : slope > 0 ? "\\" : "/";
      put(i === 0 ? "+" : c, i, row, "bone", i === 0 ? 6 : 5);
    }
    const pan = (col, endRow, mine) => {
      const r = Math.round(endRow);
      put("/", col - 1, r + 1, "bone", 3);
      put("\\", col + 1, r + 1, "bone", 3);
      put(".", col, r + 1, "bone", 3);
      atlasS.text(ctx, "\\___/", mine ? "bone" : "crimson", mine ? 6 : 5, cx + (col - 2) * cw - cw / 2, y0 + (r + 3) * chh);
      return r + 3;
    };
    const left = pan(-half, 1 - tilt, false);
    const right = pan(half, 1 + tilt, true);
    // the weight: what has been taken
    const n = Math.min(5, Math.abs(Math.round(scaleShown)));
    for (let k = 0; k < n; k++) {
      const col = (t >= 0 ? half : -half) - 1 + (k % 3);
      const row = (t >= 0 ? right : left) - 1 - (k >= 3 ? 1 : 0);
      put(k % 2 ? "o" : "0", col, row, t >= 0 ? "bone" : "crimson", 6);
    }
    ctx.font = `${D(10)}px "Geist Mono", monospace`;
    ctx.fillStyle = "rgba(223,227,248,0.8)";
    ctx.textAlign = "center";
    ctx.fillText(scaleVal > 0 ? "+" + scaleVal : String(scaleVal), cx, y0 + chh * 10.6);
    ctx.textAlign = "left";
  }
  function drawCandles() {
    const x0 = D(L.bx + 8),
      y0 = D(L.hudY) + atlasS.ch * 1.5;
    for (let i = 0; i < 2; i++) {
      const cx = x0 + i * atlasS.cw * 5;
      const lit = 1 - candleOut[i];
      for (let r = 0; r < 4; r++) atlasS.put(ctx, r === 0 ? "|" : "#", "bone", 5, cx, y0 + (r + 1) * atlasS.ch * 0.95);
      atlasS.put(ctx, "_", "bone", 4, cx, y0 + 5 * atlasS.ch * 0.95);
      if (lit > 0.05) {
        const f = ["(", ")", "^", "'", "*"][(Math.floor(time * 9 + i * 3) + i) % 5];
        ctx.globalAlpha = lit;
        atlasS.put(ctx, f, "gold", 6, cx, y0);
        atlasS.put(ctx, ",", "gold", 5, cx + (reduce ? 0 : Math.sin(time * 7 + i) * 0.6), y0 + atlasS.ch * 0.4);
        ctx.globalAlpha = 1;
        glow(cx + atlasS.cw / 2, y0 + atlasS.ch * 0.4, D(34), "rgba(255,190,90,0.6)", 0.55 * lit * (0.8 + 0.2 * Math.sin(time * 11 + i)));
      } else {
        for (let k = 0; k < 3; k++) {
          ctx.globalAlpha = 0.45 * (1 - k / 3) * (0.5 + 0.5 * Math.sin(time * 1.4 + i + k));
          atlasS.put(ctx, ".", "bone", 3, cx + Math.sin(time * 1.3 + i + k) * atlasS.cw * 0.5, y0 - k * atlasS.ch * 0.55);
        }
        ctx.globalAlpha = 1;
      }
    }
  }
  function drawFire(cx, cy) {
    const cw = atlasS.cw,
      chh = atlasS.ch;
    const rows = 12;
    glow(cx, cy - chh * 4, D(190), "rgba(255,170,70,0.7)", 0.55 + 0.1 * Math.sin(time * 9));
    for (let r = 0; r < rows; r++) {
      const wd = Math.max(1, Math.round((rows - r) * 0.62 + 1));
      for (let c = -wd; c <= wd; c++) {
        const n = noise.n2(c * 0.9 + time * 0.2, r * 0.7 - time * 2.6);
        if (n < 0.28 + r * 0.04) continue;
        const ch = "@&%8#0o*'^".charAt(clamp(Math.floor(r * 0.75 + n * 2.5), 0, 9));
        atlasS.put(ctx, ch, r > 4 ? "crimson" : "gold", clamp(6 - Math.floor(r * 0.5), 3, 6), cx + c * cw - cw / 2, cy - (rows - r) * chh);
      }
    }
    for (let c = -4; c <= 4; c++) atlasS.put(ctx, c % 2 ? "=" : "_", "bark", 5, cx + c * cw - cw / 2, cy);
  }

  function drawFigure() {
    if (!figCv) return;
    const s = L.s * dpr;
    const bob = reduce ? 0 : Math.round(Math.sin(time * 1.4) * 0.8 * dpr);
    const fx0 = D(L.figX),
      fy = D(L.figFeet);
    ctx.globalAlpha = 1;
    ctx.drawImage(shadowSprite, fx0 - 30 * s * 0.55 + 4 * s, fy - 4 * s, 60 * s * 0.9, 18 * s * 0.9);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = figFade ? 1 - figFade.k : 1;
    ctx.drawImage(figCv, Math.round(fx0 - (FIGURE_SIZE.w * s) / 2), Math.round(fy - FIGURE_SIZE.h * s + bob), FIGURE_SIZE.w * s, FIGURE_SIZE.h * s);
    if (figFade) {
      ctx.globalAlpha = figFade.k;
      ctx.drawImage(figFade.cv, Math.round(fx0 - (FIGURE_SIZE.w * s) / 2), Math.round(fy - FIGURE_SIZE.h * s + bob), FIGURE_SIZE.w * s, FIGURE_SIZE.h * s);
    }
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
  }

  function drawTelegraphs() {
    // the Angler's line hangs over the piece it will hook next
    if (ui.hookWarn) {
      const v = vis.get(ui.hookWarn);
      if (v) {
        const b = baseOf(v.gx, v.gy);
        const topY = D(b.y) - (v.cv?.height || 80);
        drawLine(D(L.figX + FIGURE_SIZE.w * L.s * 0.45), D(L.figFeet - FIGURE_SIZE.h * L.s * 0.95), D(b.x), topY - D(4), 0.6);
      }
    }
    if (ui.moonWarn) {
      const k = 0.5 + 0.5 * Math.sin(time * 4);
      for (const row of ui.moonWarn) {
        const g = ctx.createLinearGradient(0, 0, D(W), 0);
        g.addColorStop(0, "rgba(232,236,245,0)");
        g.addColorStop(0.5, `rgba(232,236,245,${0.1 + 0.12 * k})`);
        g.addColorStop(1, "rgba(232,236,245,0)");
        ctx.fillStyle = g;
        ctx.fillRect(D(L.bx - 20), D(cellY(row) + L.ch * 0.3), D(L.cs * 6 + 40), D(L.ch * 0.5));
      }
    }
    // hidden traps stay hidden; a snapped one is drawn by its effect
  }
  // a fishing line of | and ~ characters from (x0,y0) to (x1,y1)
  function drawLine(x0, y0, x1, y1, alpha = 1, sag = 1) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(2, Math.floor(len / (atlasS.ch * 0.8)));
    ctx.globalAlpha = alpha;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const x = lerp(x0, x1, k) + (reduce ? 0 : Math.sin(time * 2 + k * 6) * 2 * dpr * k * sag);
      const y = lerp(y0, y1, k);
      const end = i > n - 2;
      atlasS.put(ctx, end ? "~" : i % 5 === 4 ? "~" : "|", "white", 4, x - atlasS.cw / 2, y - atlasS.ch / 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawParticles(dt) {
    for (const p of particles) {
      p.life += dt;
      const k = p.life / p.max;
      p.vx += (Math.random() - 0.5) * 8 * dpr * dt + (meadowWindX() * 40 * dpr * dt);
      p.vy += 14 * dpr * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 1.2;
      p.vy *= 1 - dt * 0.9;
      if (k >= 1) continue;
      const fade = 1 - k * k;
      if (k < 0.55) {
        ctx.globalAlpha = fade;
        p.atlas.put(ctx, RAMP[p.c], p.pal, p.sh, p.x, p.y);
      } else if (p.end === 0) {
        // becomes a blade of grass
        ctx.globalAlpha = fade * 0.9;
        ctx.strokeStyle = "#6fb5a8";
        ctx.lineWidth = Math.max(1, dpr * 0.9);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.sin(p.ang) * 9 * dpr, p.y - Math.cos(p.ang) * 9 * dpr);
        ctx.stroke();
      } else {
        // or a sparkle
        ctx.globalAlpha = fade;
        ctx.fillStyle = "#cfe0ff";
        const z = Math.max(1, dpr * (1 + (1 - k)));
        ctx.fillRect(Math.round(p.x), Math.round(p.y), z, z);
      }
    }
    ctx.globalAlpha = 1;
    particles = particles.filter((p) => p.life < p.max);
  }
  let wx = 0;
  const meadowWindX = () => wx;

  // ── frame ─────────────────────────────────────────────────────────────────────────────────
  function draw(now, dt) {
    time += dt;
    frame++;
    // tweens
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      const k = clamp((time - tw.t0) / tw.dur);
      tw.fn(tw.ez(k), k);
      if (k >= 1) (tweens.splice(i, 1), tw.res());
    }
    scaleShown += (scaleVal - scaleShown) * Math.min(1, dt * 3.5);
    for (let i = 0; i < 2; i++) candleOut[i] += ((i >= candles ? 1 : 0) - candleOut[i]) * Math.min(1, dt * 1.6);
    if (figFade) {
      figFade.k += dt * 2;
      if (figFade.k >= 1) ((figCv = figFade.cv), (figFade = null));
    }
    meadow.update(dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    if (winK > 0) {
      // the meadow slides away and the camera drifts up into the stars
      ctx.fillStyle = "#04060e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.globalAlpha = 1 - winK;
      ctx.translate(0, winK * canvas.height * 0.9);
      meadow.drawBack(ctx);
      ctx.restore();
      ctx.globalAlpha = 1;
      drawStars();
      ctx.save();
      ctx.globalAlpha = 1 - winK;
      ctx.translate(0, winK * canvas.height * 0.9);
      drawWorld(dt);
      ctx.restore();
      meadow.drawFront(ctx, frame);
      return;
    }
    meadow.drawBack(ctx);
    drawWorld(dt);
    meadow.drawFront(ctx, frame);
    // the pointer's crosshair is a CSS cursor
  }
  const stars = Array.from({ length: 160 }, (_, i) => ({ x: hash2(i, 1, 9), y: hash2(i, 2, 9), s: hash2(i, 3, 9), p: hash2(i, 4, 9) * 6 }));
  function drawStars() {
    for (const s of stars) {
      const y = (s.y + winK * (0.15 + s.s * 0.5)) % 1;
      const a = winK * (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(time * (0.8 + s.s * 2) + s.p)));
      ctx.globalAlpha = a;
      ctx.fillStyle = s.s > 0.8 ? "#cfe0ff" : "#fff";
      const z = Math.max(1, dpr * (s.s > 0.9 ? 2 : 1));
      ctx.fillRect(Math.round(s.x * canvas.width), Math.round(y * canvas.height), z, z);
      if (s.s > 0.93) glow(s.x * canvas.width, y * canvas.height, D(10), "rgba(160,200,255,0.7)", a * 0.5);
    }
    ctx.globalAlpha = 1;
  }
  function drawWorld(dt) {
    drawBoardGround();
    if (ui.mode === "campfire" || ui.campfireLit) drawFire(D(L.bx + L.cs * 3), D(L.by + L.ch * 3.1));
    drawFigure();
    drawTelegraphs();
    // pieces back to front
    const list = [...vis.values()].sort((a, b) => a.gy + (a.t === "M" ? 1.6 : 0) - (b.gy + (b.t === "M" ? 1.6 : 0)));
    for (const v of list) {
      const extra = {};
      if (ui.giveable.includes(Math.round(v.gy) * 6 + Math.round(v.gx))) v.glow = 1;
      else if (!v.bait && v.t !== "M") v.glow = v.glow > 0.02 ? v.glow * 0.9 : 0;
      if (v.t === "M") {
        v.glow = ui.moonWarn ? 1 : 0.35;
        glow(D(L.bx + (v.gx + 1) * L.cs), D(L.by + (v.gy + 1) * L.ch), D(L.cs * 1.9), "rgba(190,200,255,0.55)", 0.35 + (ui.moonWarn ? 0.25 : 0));
      }
      drawPiece(v, extra);
    }
    drawSelection();
    drawTargets();
    drawPreview();
    drawHoverInfo();
    // effects
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      const k = clamp((time - f.t0) / f.dur);
      f.draw(ctx, k);
      if (k >= 1) (fx.splice(i, 1), f.res());
    }
    drawParticles(dt);
    drawScale();
    drawCandles();
    ctx.globalAlpha = 1;
  }

  // text through the atlas font (labels): handy for effects
  const api = {
    get layout() {
      return L;
    },
    get dpr() {
      return dpr;
    },
    get meadow() {
      return meadow;
    },
    ui,
    vis,
    resize,
    draw,
    tween,
    wait,
    addFx,
    dissolve,
    syncVis,
    clearVis,
    cellAt,
    pieceCellAt,
    baseOf,
    cellX,
    cellY,
    get time() {
      return time;
    },
    get atlas() {
      return atlasS;
    },
    setBoss(b) {
      const prev = figCv;
      boss = b;
      if (b) {
        meadow?.setTheme(b.theme);
        meadow?.setScenery(b.scenery);
      }
      if (prev && b && !reduce) figFade = null;
      makeBossFigure();
    },
    setMask(mask) {
      if (!boss) return;
      boss.mask = mask;
      const next = makeFigure(boss.figure, mask);
      if (reduce || !figCv) figCv = next;
      else figFade = { cv: next, k: 0 };
    },
    setInteg(i, v, instant = false) {
      integ[i] = v;
      meadow.setIntegrity(i, v, instant);
    },
    setScale(v) {
      scaleVal = v;
    },
    setCandles(n) {
      candles = n;
    },
    snapCandles(n) {
      candles = n;
      candleOut[0] = n > 0 ? 0 : 1;
      candleOut[1] = n > 1 ? 0 : 1;
    },
    setWindVec(x) {
      wx = x;
    },
    setWin(k) {
      winK = k;
    },
    get winK() {
      return winK;
    },
    // a flicker of the camera: used for the phase change
    figureCenter() {
      return { x: L.figX, y: L.figFeet - (FIGURE_SIZE.h * L.s) / 2 };
    },
    glow,
    drawLine,
    put: (c, pal, sh, x, y) => atlasS.put(ctx, c, pal, sh, D(x) - atlasS.cw / 2, D(y) - atlasS.ch / 2),
    text: (str, pal, sh, x, y) => atlasS.text(ctx, str, pal, sh, D(x) - (str.length * atlasS.cw) / 2, D(y) - atlasS.ch / 2),
    previewPush,
    D,
    ctxRef: () => ctx,
  };
  return api;
}
