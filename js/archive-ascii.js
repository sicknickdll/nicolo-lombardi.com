// ASCII background for the Archive landing, after lamalama.com. It is an Easter egg: the
// characters are not random, they spell my specialties, my clients and my projects, in rows that
// drift slowly in opposite directions.
//   · At low opacity the words are barely there (the "base" canvas).
//   · The cursor is followed with easing; under it a dotted lattice forms, and the letters it
//     passes over light up, so the words can be read, then fade like a trail (the "heat" canvas).
//   · While the pointer is over a title the effect steps aside (`suppress`), so they never clash.
// Everything on the heat canvas runs at the display's frame rate and uses time-based easing, so
// the trail stays smooth. The slow base field is redrawn about 15 times a second.
// Reduced motion gets a still frame and no cursor effect.
import { clients, projects } from "./data.js";

const SPECIALTIES = ["AI Filmmaking", "Art Direction", "Creative Technology", "Virtual Production", "VFX", "Motion & Sound", "Generative AI Video", "Digital Assets", "Film & Visual Production"];
// Three kinds of rows: specialties, clients, projects; each is one long line, repeated.
const LINES = [SPECIALTIES, clients.map((c) => c.name), projects.map((p) => (p.title === p.brand ? p.brand : `${p.brand} ${p.title}`))].map(
  (words) => (words.join("   ·   ") + "   ·   ").toUpperCase(),
);
const CELL_H = 17;
const RADIUS = 130; // reach of the cursor, in px

export function mountAscii(base) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches && !reduce;
  const heatCanvas = document.createElement("canvas");
  heatCanvas.className = base.className;
  heatCanvas.setAttribute("aria-hidden", "true");
  base.after(heatCanvas);
  const bctx = base.getContext("2d"),
    hctx = heatCanvas.getContext("2d");
  let w = 0,
    h = 0,
    cols = 0,
    rows = 0,
    cellW = 9,
    shiftT = 0, // time the rows were last shifted (the base canvas and the heat canvas share it)
    quiet = 0, // 1 while a title is under the pointer: the cursor effect fades out
    heat = new Float32Array(0);
  const mouse = { x: -999, y: -999 }, // where the pointer is
    soft = { x: -999, y: -999 }; // where the effect is: it eases toward the pointer

  const resize = () => {
    const dpr = Math.min(devicePixelRatio, 2);
    w = base.clientWidth;
    h = base.clientHeight;
    for (const [c, ctx] of [
      [base, bctx],
      [heatCanvas, hctx],
    ]) {
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${CELL_H - 4}px ui-monospace, Menlo, Consolas, monospace`;
      ctx.textBaseline = "top";
    }
    cellW = bctx.measureText("M").width;
    cols = Math.ceil(w / cellW);
    rows = Math.ceil(h / CELL_H);
    heat = new Float32Array(cols * rows);
    drawBase(performance.now());
  };

  // The letter at a cell: each row reads one of the lines and slides along it, left or right.
  const letter = (i, j) => {
    const line = LINES[j % 3];
    const speed = (j % 2 ? 1 : -1) * (0.5 + (j % 5) * 0.12);
    const at = Math.floor(i + shiftT * speed + j * 17);
    return line[((at % line.length) + line.length) % line.length];
  };
  // The drifting field: three crossing waves set how visible each letter is.
  const drawBase = (now) => {
    const t = now / 1000;
    shiftT = t;
    bctx.clearRect(0, 0, w, h);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const ch = letter(x, y);
        if (ch === " ") continue;
        const v = (Math.sin(x * 0.11 + t * 0.5) + Math.sin(y * 0.16 - t * 0.35) + Math.sin((x + y) * 0.07 + t * 0.25) + 3) / 6;
        bctx.fillStyle = `rgba(255,255,255,${(0.025 + v * 0.07).toFixed(3)})`;
        bctx.fillText(ch, x * cellW, y * CELL_H);
      }
  };

  // Light up the cells around (x, y); `amount` scales how much.
  const stamp = (x, y, amount) => {
    const cx = x / cellW,
      cy = y / CELL_H,
      rc = RADIUS / CELL_H;
    for (let j = Math.max(0, Math.floor(cy - rc)); j < Math.min(rows, cy + rc + 1); j++)
      for (let i = Math.max(0, Math.floor(cx - rc)); i < Math.min(cols, cx + rc + 1); i++) {
        const d = Math.hypot((i - cx) * (cellW / CELL_H), j - cy) / rc;
        if (d < 1) heat[j * cols + i] = Math.min(1, heat[j * cols + i] + (1 - d) ** 2 * amount);
      }
  };

  let suppressed = false,
    last = performance.now(),
    lastBase = 0,
    raf = 0,
    prev = null;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (now - lastBase > 66) (drawBase(now), (lastBase = now));

    quiet += ((suppressed ? 1 : 0) - quiet) * (1 - Math.exp(-dt * 10));
    if (fine && mouse.x > -900 && !suppressed) {
      if (soft.x < -900) (soft.x = mouse.x), (soft.y = mouse.y);
      const k = 1 - Math.exp(-dt * 12);
      soft.x += (mouse.x - soft.x) * k;
      soft.y += (mouse.y - soft.y) * k;
      // Stamp along the path since last frame, so a fast move leaves a continuous trail.
      if (prev) {
        const dist = Math.hypot(soft.x - prev.x, soft.y - prev.y),
          steps = Math.max(1, Math.ceil(dist / 14));
        for (let s = 1; s <= steps; s++) stamp(prev.x + ((soft.x - prev.x) * s) / steps, prev.y + ((soft.y - prev.y) * s) / steps, 0.22 * dt * 60 / steps + 0.03);
      } else stamp(soft.x, soft.y, 0.2);
      prev = { x: soft.x, y: soft.y };
    }

    // Draw what is lit, then let it cool (time-based, so the fade does not depend on frame rate).
    hctx.clearRect(0, 0, w, h);
    const cool = Math.exp(-dt * 2.4);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const idx = j * cols + i,
          hv = heat[idx];
        if (hv < 0.02) {
          heat[idx] = 0;
          continue;
        }
        hctx.fillStyle = `rgba(255,255,255,${(Math.min(0.9, hv * 0.95) * (1 - quiet)).toFixed(3)})`;
        hctx.fillText(letter(i, j), i * cellW, j * CELL_H);
        heat[idx] = hv * cool;
      }
    // A lattice of dots under the pointer.
    if (fine && soft.x > -900 && quiet < 0.98) {
      const g = 9;
      for (let dy = -5; dy <= 5; dy++)
        for (let dx = -5; dx <= 5; dx++) {
          const px = Math.round(soft.x / g) * g + dx * g,
            py = Math.round(soft.y / g) * g + dy * g;
          const d = Math.hypot(px - soft.x, py - soft.y);
          if (d > 46) continue;
          const size = 2.2 * (1 - d / 50);
          hctx.fillStyle = `rgba(255,255,255,${(0.9 * (1 - d / 50) * (1 - quiet)).toFixed(3)})`;
          hctx.fillRect(px - size / 2, py - size / 2, size, size);
        }
    }
  };

  const onMove = (e) => {
    const r = base.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  };
  if (fine) addEventListener("pointermove", onMove, { passive: true });
  const ro = new ResizeObserver(resize);
  ro.observe(base);
  resize();
  if (!reduce) raf = requestAnimationFrame(frame);

  return {
    suppress: (on) => (suppressed = on),
    off() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener("pointermove", onMove);
      heatCanvas.remove();
    },
  };
}
