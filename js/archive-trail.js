// Pixel trail for the Archive landing, after lamalama.com: a grid of square dots follows the
// cursor. Each dot grows with how recently the pointer was near it, so the trail reads as a soft,
// halftone brush that cools off behind the pointer.
//   · The cursor is followed with easing, and dots are stamped along the path since the last
//     frame, so a fast move leaves one continuous trail.
//   · Heat fades with time (not frames), so it looks the same at any frame rate.
//   · While the pointer is over a title the trail steps aside (`suppress`).
// Touch screens and reduced motion get no trail.
const GRID = 4; // dot spacing, in px
const RADIUS = 72; // reach of the brush, in px

export function mountTrail(canvas) {
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine) return { suppress() {}, off() {} };
  const ctx = canvas.getContext("2d");
  let w = 0,
    h = 0,
    cols = 0,
    rows = 0,
    heat = new Float32Array(0);
  const mouse = { x: -999, y: -999 },
    soft = { x: -999, y: -999 };
  let suppressed = false,
    quiet = 0,
    prev = null,
    last = performance.now(),
    raf = 0;

  const resize = () => {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w;
    canvas.height = h;
    cols = Math.ceil(w / GRID);
    rows = Math.ceil(h / GRID);
    heat = new Float32Array(cols * rows);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const stamp = (x, y, radius, amount) => {
    const cx = x / GRID,
      cy = y / GRID,
      rc = radius / GRID;
    for (let j = Math.max(0, Math.floor(cy - rc)); j < Math.min(rows, cy + rc + 1); j++)
      for (let i = Math.max(0, Math.floor(cx - rc)); i < Math.min(cols, cx + rc + 1); i++) {
        const d = Math.hypot(i - cx, j - cy) / rc;
        if (d < 1) heat[j * cols + i] = Math.min(1, heat[j * cols + i] + (1 - d) ** 2 * amount);
      }
  };

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    quiet += ((suppressed ? 1 : 0) - quiet) * (1 - Math.exp(-dt * 10));
    if (mouse.x > -900 && !suppressed) {
      if (soft.x < -900) (soft.x = mouse.x), (soft.y = mouse.y);
      const k = 1 - Math.exp(-dt * 11);
      soft.x += (mouse.x - soft.x) * k;
      soft.y += (mouse.y - soft.y) * k;
      if (prev) {
        const dist = Math.hypot(soft.x - prev.x, soft.y - prev.y),
          steps = Math.max(1, Math.ceil(dist / 10));
        // The faster it moves, the wider and stronger the brush.
        const speed = Math.min(1, dist / 30);
        for (let s = 1; s <= steps; s++)
          stamp(prev.x + ((soft.x - prev.x) * s) / steps, prev.y + ((soft.y - prev.y) * s) / steps, RADIUS * (0.55 + speed * 0.45), (0.1 + speed * 0.25) / Math.sqrt(steps));
      }
      prev = { x: soft.x, y: soft.y };
    } else prev = null;

    ctx.clearRect(0, 0, w, h);
    const cool = Math.exp(-dt * 1.7);
    ctx.fillStyle = `rgba(255,255,255,${(0.92 * (1 - quiet)).toFixed(3)})`;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const idx = j * cols + i,
          v = heat[idx];
        if (v < 0.06) {
          heat[idx] = 0;
          continue;
        }
        // Halftone: the hotter the cell, the bigger the square (whole pixels, so it stays crisp).
        const size = Math.min(GRID - 1, Math.round((v - 0.04) * GRID * 1.5));
        if (size > 0) ctx.fillRect(i * GRID + ((GRID - size) >> 1), j * GRID + ((GRID - size) >> 1), size, size);
        heat[idx] = v * cool;
      }
  };
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  };
  addEventListener("pointermove", onMove, { passive: true });
  raf = requestAnimationFrame(frame);

  return {
    suppress: (on) => (suppressed = on),
    off() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener("pointermove", onMove);
    },
  };
}
