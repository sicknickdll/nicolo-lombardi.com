// ASCII background for the Archive landing, after lamalama.com:
//   · A field of characters drifts slowly across the page at low opacity.
//   · Near the cursor the characters brighten, change faster and thicken, a dotted lattice
//     forms under the pointer, and the heat fades behind it like a trail.
// One 2D canvas, redrawn at 30 fps. Reduced motion gets a still frame and no cursor effect.
const RAMP = " .:-=+*#%@";
const CELL_H = 17;
const RADIUS = 120; // reach of the cursor, in px

export function mountAscii(canvas) {
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  let w = 0,
    h = 0,
    cols = 0,
    rows = 0,
    cellW = 9,
    heat = new Float32Array(0);
  const mouse = { x: -999, y: -999, px: -999, py: -999 };

  const resize = () => {
    const dpr = Math.min(devicePixelRatio, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `${CELL_H - 4}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.textBaseline = "top";
    cellW = ctx.measureText("M").width;
    cols = Math.ceil(w / cellW);
    rows = Math.ceil(h / CELL_H);
    heat = new Float32Array(cols * rows);
  };
  const ro = new ResizeObserver(() => (resize(), draw(performance.now())));
  ro.observe(canvas);

  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  };
  if (fine && !reduce) addEventListener("pointermove", onMove, { passive: true });

  let last = 0,
    raf = 0;
  const draw = (now) => {
    const t = now / 1000;
    // Heat under the pointer, stronger the faster it moves.
    if (mouse.x > -900) {
      const speed = Math.min(1, Math.hypot(mouse.x - mouse.px, mouse.y - mouse.py) / 40);
      const cx = mouse.x / cellW,
        cy = mouse.y / CELL_H,
        rc = RADIUS / CELL_H;
      for (let y = Math.max(0, Math.floor(cy - rc)); y < Math.min(rows, cy + rc + 1); y++)
        for (let x = Math.max(0, Math.floor(cx - rc)); x < Math.min(cols, cx + rc + 1); x++) {
          const d = Math.hypot((x - cx) * (cellW / CELL_H), y - cy) / rc;
          if (d < 1) heat[y * cols + x] = Math.min(1, heat[y * cols + x] + (1 - d) ** 2 * (0.35 + speed * 0.5));
        }
      mouse.px = mouse.x;
      mouse.py = mouse.y;
    }
    ctx.clearRect(0, 0, w, h);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        // A slow, drifting field of three crossing waves, 0…1.
        const base = (Math.sin(x * 0.11 + t * 0.5) + Math.sin(y * 0.16 - t * 0.35) + Math.sin((x + y) * 0.07 + t * 0.25) + 3) / 6;
        const hv = heat[i];
        const v = Math.min(1, base * 0.55 + hv);
        let ch = RAMP[Math.min(RAMP.length - 1, (v * RAMP.length) | 0)];
        // Where the cursor has been, characters keep changing.
        if (hv > 0.25) ch = RAMP[(((x * 7 + y * 13 + (t * 14) | 0) % (RAMP.length - 2)) + 2) | 0];
        if (ch === " ") continue;
        ctx.fillStyle = `rgba(255,255,255,${(0.05 + base * 0.09 + hv * 0.75).toFixed(3)})`;
        ctx.fillText(ch, x * cellW, y * CELL_H);
      }
    // A lattice of dots under the pointer.
    if (mouse.x > -900) {
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const px = Math.round(mouse.x / 9) * 9 + dx * 9,
            py = Math.round(mouse.y / 9) * 9 + dy * 9;
          const d = Math.hypot(px - mouse.x, py - mouse.y);
          if (d < 40) ctx.fillRect(px - 1, py - 1, 2 * (1 - d / 48), 2 * (1 - d / 48));
        }
    }
    for (let i = 0; i < heat.length; i++) heat[i] *= 0.92;
  };
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (now - last < 33 || document.hidden) return;
    last = now;
    draw(now);
  };
  resize();
  draw(performance.now());
  if (!reduce) raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    removeEventListener("pointermove", onMove);
  };
}
