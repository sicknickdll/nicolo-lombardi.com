// ASCII titles for the Archive wheel, after React Bits' ASCII Text: each title is drawn as
// characters picked by how bright the letter shapes are underneath, with a wave running through
// them. Hovering a title slows the wave.
//   · The real text stays in the page (transparent) for layout, clicks and screen readers; a canvas
//     over it draws the ASCII.
//   · `setResolve(r)`: 0 is a coarse, noisy, heavily waving field of characters; 1 is the clean
//     title. The landing drives it with a bezier when the page loads, so the titles start as ASCII
//     noise and resolve into letters.
// Reduced motion: still, clean ASCII.
const RAMP = " .:-=+*#%@";
const PAD = 14;
const CH = 7; // cell height, px

export function mountAsciiTitles(items, reduce) {
  const fonts = "ui-monospace, Menlo, Consolas, monospace";
  const titles = [];
  let resolve = reduce ? 1 : 0;

  for (const li of items) {
    const label = li.firstElementChild;
    const text = label.textContent;
    const cs = getComputedStyle(label);
    const w = Math.ceil(label.getBoundingClientRect().width),
      h = Math.ceil(label.getBoundingClientRect().height);
    const canvas = document.createElement("canvas");
    canvas.className = "arch-ascii-title";
    canvas.setAttribute("aria-hidden", "true");
    const W = w + PAD * 2,
      H = h + PAD * 2;
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.cssText = `width:${W}px;height:${H}px;left:${-PAD}px;top:${-PAD}px`;
    label.append(canvas);

    // The letter shapes, drawn once, then read back one value per character cell.
    const src = document.createElement("canvas");
    src.width = W;
    src.height = H;
    const sx = src.getContext("2d");
    sx.fillStyle = "#fff";
    sx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    sx.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
    sx.textBaseline = "middle";
    sx.fillText(text, PAD, PAD + h / 2);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.font = `${CH}px ${fonts}`;
    ctx.textBaseline = "top";
    const cw = ctx.measureText("M").width;
    const cols = Math.ceil(W / cw),
      rows = Math.ceil(H / CH);
    const small = document.createElement("canvas");
    small.width = cols;
    small.height = rows;
    const smx = small.getContext("2d");
    smx.drawImage(src, 0, 0, cols, rows);
    const data = smx.getImageData(0, 0, cols, rows).data;
    const lum = new Float32Array(cols * rows);
    for (let i = 0; i < lum.length; i++) lum[i] = Math.min(1, (data[i * 4 + 3] / 255) * 1.6);

    const t = { li, canvas, ctx, cols, rows, cw, lum, speed: 1, want: 1, phase: Math.random() * 10, clock: 0 };
    // Hovering a title slows its wave.
    li.addEventListener("pointerenter", () => (t.want = 0.2));
    li.addEventListener("pointerleave", () => (t.want = 1));
    titles.push(t);
  }

  const sample = (t, x, y) => {
    x = Math.round(x);
    return x < 0 || x >= t.cols || y < 0 || y >= t.rows ? 0 : t.lum[y * t.cols + x];
  };
  let last = performance.now(),
    raf = 0;
  const draw = (t, dt) => {
    t.speed += (t.want - t.speed) * (1 - Math.exp(-dt * 6));
    t.clock += dt * t.speed; // the wave's own time, so slowing it never makes it jump
    const { ctx, cols, rows, cw } = t;
    ctx.clearRect(0, 0, cols * cw, rows * CH);
    const r = resolve,
      amp = (reduce ? 0.6 : 1.1 + 12 * (1 - r) ** 2) * 1; // how far the wave pushes a cell sideways
    for (let y = 0; y < rows; y++) {
      const wave = Math.sin(y * 0.55 + (t.clock + t.phase) * 2.4) * amp + Math.sin(y * 0.19 - t.clock * 1.3) * amp * 0.5;
      for (let x = 0; x < cols; x++) {
        let v = sample(t, x + wave, y);
        // Unresolved: noise flickers in, and what is there is dimmer.
        if (r < 1) {
          const n = Math.sin(x * 12.9898 + y * 78.233 + Math.floor(t.clock * 14) * 3.7) * 43758.5453;
          const rnd = n - Math.floor(n);
          if (rnd < 0.35 * (1 - r) ** 2) v = Math.max(v, 0.25 + rnd);
          v *= 0.25 + 0.75 * r;
        }
        if (v < 0.08) continue;
        const ch = RAMP[Math.min(RAMP.length - 1, (v * RAMP.length) | 0)];
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, 0.35 + v).toFixed(2)})`;
        ctx.fillText(ch, x * cw, y * CH);
      }
    }
  };
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const t of titles) if (parseFloat(t.li.style.opacity || 1) > 0.02) draw(t, reduce ? 0 : dt);
  };
  raf = requestAnimationFrame(frame);

  return {
    setResolve: (r) => (resolve = r),
    off() {
      cancelAnimationFrame(raf);
      for (const t of titles) t.canvas.remove();
    },
  };
}
