// "Pixel curtain" transition: black and white squares fill the screen in random
// order, `swap()` runs while the screen is fully covered, then the squares
// dissolve in a new random order. Drawn on one <canvas>, so it stays smooth.
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
let running = false;

export function pixelCurtain(swap, { cover = 380, hold = 70, reveal = 420 } = {}) {
  if (running) return;
  if (reduce.matches) return swap();
  running = true;
  const w = innerWidth,
    h = innerHeight;
  const size = Math.max(22, Math.ceil(Math.max(w, h) / 30));
  const cols = Math.ceil(w / size),
    rows = Math.ceil(h / size);
  const cells = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      cells.push({
        x: x * size,
        y: y * size,
        white: Math.random() < 0.45,
        in: Math.random() * cover, // when it appears
        out: Math.random() * reveal, // when it disappears
      });

  const canvas = document.createElement("canvas");
  canvas.className = "pixel-curtain";
  canvas.width = w;
  canvas.height = h;
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");
  const draw = (visible) => {
    ctx.clearRect(0, 0, w, h);
    for (const white of [false, true]) {
      ctx.fillStyle = white ? "#fff" : "#000";
      ctx.beginPath();
      for (const c of cells) if (c.white === white && visible(c)) ctx.rect(c.x, c.y, size, size);
      ctx.fill();
    }
  };

  const start = performance.now();
  let swapped = false;
  const frame = (now) => {
    const t = now - start;
    // Always swap once covered, even if a slow frame skipped the hold window.
    if (t >= cover && !swapped) {
      swapped = true;
      swap();
    }
    if (t < cover) draw((c) => t >= c.in);
    else if (t < cover + hold) draw(() => true);
    else if (t < cover + hold + reveal) {
      const r = t - cover - hold;
      draw((c) => r < c.out);
    } else {
      canvas.remove();
      running = false;
      return;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
