// Touch the clock and its digits shatter: after React Bits' Shatter Type (seen in a screen
// recording, since the component is Pro). The digits are cut into glass shards; under the cursor
// thin cracks show along the shard edges; a click or touch sends the shards flying outward, spinning,
// and they come back together a moment later. Each phase is eased with a bezier.
//   · The shards are a jittered grid split into triangles, kept where the digits are.
//   · During the burst the real text is hidden and a canvas draws the shards from a picture of it.
// Reduced motion: cracks only, no burst.
import { bezier } from "./ease.js";

const OUT_S = 0.85; // shards fly out
const BACK_S = 1.1; // and return
const flyEase = bezier(0.1, 0.7, 0.3, 1); // quick start, long settle
const backEase = bezier(0.65, 0, 0.25, 1);
const CRACK_R = 70; // how far from the cursor cracks show, px

export function mountShatter(timeEl, host) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.createElement("canvas");
  canvas.className = "arch-shatter";
  host.append(canvas);
  const ctx = canvas.getContext("2d");
  let W = 0,
    H = 0,
    bw = 0,
    bh = 0,
    shards = [],
    src = null,
    text = "",
    mouse = null,
    burst = null,
    raf = 0,
    fade = 0;

  // The digits as a picture, and the shards cut from it.
  const build = () => {
    const cs = getComputedStyle(timeEl);
    const r = timeEl.getBoundingClientRect();
    bw = Math.ceil(r.width);
    bh = Math.ceil(r.height);
    const dpr = Math.min(devicePixelRatio, 2);
    W = bw + 640;
    H = bh + 560;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.cssText = `width:${W}px;height:${H}px;left:${-W / 2}px;top:${-H / 2}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    text = timeEl.textContent;
    src = document.createElement("canvas");
    src.width = bw * dpr;
    src.height = bh * dpr;
    const sx = src.getContext("2d");
    sx.scale(dpr, dpr);
    sx.fillStyle = "#fff";
    sx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    sx.letterSpacing = `${-0.04 * parseFloat(cs.fontSize)}px`;
    sx.textBaseline = "middle";
    sx.textAlign = "center";
    sx.fillText(text, bw / 2, bh / 2 + 2);
    const alpha = sx.getImageData(0, 0, src.width, src.height).data;
    const solid = (x, y) => {
      const px = Math.min(src.width - 1, Math.max(0, Math.round(x * dpr))),
        py = Math.min(src.height - 1, Math.max(0, Math.round(y * dpr)));
      return alpha[(py * src.width + px) * 4 + 3] > 20;
    };
    // Jittered grid → triangles.
    const cell = Math.max(9, parseFloat(cs.fontSize) * 0.17);
    const cols = Math.ceil(bw / cell) + 1,
      rows = Math.ceil(bh / cell) + 1;
    const pt = [];
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= cols; i++) {
        const edge = i === 0 || j === 0 || i === cols || j === rows;
        pt.push([i * cell + (edge ? 0 : (Math.random() - 0.5) * cell * 0.8), j * cell + (edge ? 0 : (Math.random() - 0.5) * cell * 0.8)]);
      }
    shards = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const a = pt[j * (cols + 1) + i],
          b = pt[j * (cols + 1) + i + 1],
          c = pt[(j + 1) * (cols + 1) + i],
          d = pt[(j + 1) * (cols + 1) + i + 1];
        const tris = Math.random() < 0.5 ? [[a, b, d], [a, d, c]] : [[a, b, c], [b, d, c]];
        for (const v of tris) {
          const cx = (v[0][0] + v[1][0] + v[2][0]) / 3,
            cy = (v[0][1] + v[1][1] + v[2][1]) / 3;
          if (![...v, [cx, cy]].some(([x, y]) => solid(x, y))) continue;
          shards.push({ v, cx, cy, vx: 0, vy: 0, spin: 0 });
        }
      }
  };
  const path = (v, ox, oy) => {
    ctx.beginPath();
    ctx.moveTo(v[0][0] - ox, v[0][1] - oy);
    ctx.lineTo(v[1][0] - ox, v[1][1] - oy);
    ctx.lineTo(v[2][0] - ox, v[2][1] - oy);
    ctx.closePath();
  };

  const draw = (now) => {
    raf = 0;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2 - bw / 2, H / 2 - bh / 2); // the digits' box, top-left
    let again = false;
    if (burst) {
      const t = (now - burst.at) / 1000;
      const k = t < OUT_S ? flyEase(t / OUT_S) : 1 - backEase(Math.min(1, (t - OUT_S) / BACK_S));
      for (const s of shards) {
        ctx.save();
        ctx.translate(s.cx + s.vx * k, s.cy + s.vy * k);
        ctx.rotate(s.spin * k);
        path(s.v, s.cx, s.cy);
        ctx.clip();
        ctx.drawImage(src, -s.cx, -s.cy, bw, bh);
        ctx.restore();
      }
      if (t < OUT_S + BACK_S) again = true;
      else {
        burst = null;
        timeEl.style.visibility = "";
        ctx.clearRect(-W, -H, W * 2, H * 2);
      }
    } else if (mouse && fade > 0.01) {
      // Cracks: the shard edges near the cursor, thin and dark.
      ctx.lineWidth = 1;
      for (const s of shards) {
        const d = Math.hypot(s.cx - mouse.x, s.cy - mouse.y);
        if (d > CRACK_R) continue;
        ctx.strokeStyle = `rgba(0,0,0,${((1 - d / CRACK_R) * 0.75 * fade).toFixed(3)})`;
        path(s.v, 0, 0);
        ctx.stroke();
      }
      again = true;
    }
    ctx.restore();
    if (!burst) fade += ((mouse ? 1 : 0) - fade) * 0.18;
    if (again || fade > 0.01) raf = requestAnimationFrame(draw);
  };
  const kick = () => raf || (raf = requestAnimationFrame(draw));

  const local = (e) => {
    const r = timeEl.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onMove = (e) => {
    if (reduce || burst) return;
    if (!shards.length || text !== timeEl.textContent) build();
    mouse = local(e);
    kick();
  };
  const onLeave = () => {
    mouse = null;
    kick();
  };
  const onDown = (e) => {
    if (reduce || burst) return;
    if (!shards.length || text !== timeEl.textContent) build();
    const p = local(e);
    // Shards leave the touch point: away from it, faster the nearer they were.
    for (const s of shards) {
      const dx = s.cx - p.x,
        dy = s.cy - p.y,
        d = Math.hypot(dx, dy) || 1;
      const push = 160 + Math.random() * 260 + 3200 / (d + 40);
      s.vx = (dx / d) * push + (Math.random() - 0.5) * 120;
      s.vy = (dy / d) * push + (Math.random() - 0.5) * 120 - 40;
      s.spin = (Math.random() - 0.5) * 9;
    }
    burst = { at: performance.now() };
    mouse = null;
    timeEl.style.visibility = "hidden";
    kick();
  };
  timeEl.addEventListener("pointermove", onMove);
  timeEl.addEventListener("pointerleave", onLeave);
  timeEl.addEventListener("pointerdown", onDown);

  return () => {
    cancelAnimationFrame(raf);
    timeEl.style.visibility = "";
    canvas.remove();
    timeEl.removeEventListener("pointermove", onMove);
    timeEl.removeEventListener("pointerleave", onLeave);
    timeEl.removeEventListener("pointerdown", onDown);
  };
}
