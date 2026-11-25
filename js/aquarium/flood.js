// Leaving the Archive for the aquarium: the page floods with glyphs from the icon outwards, then the
// tank (js/aquarium/tank.js) decodes out of them. The overlay lives on <body>, so it outlasts the
// page change; it fades when the tank says it has started ("aquarium:intro").
const FONT = '"Geist Mono", ui-monospace, Menlo, monospace';
const SCRAMBLE = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~<>i!lI;:,^.";
const WAVE = "~≈oO°*";

export function flood(x, y, go) {
  const cv = document.createElement("canvas");
  cv.className = "aq-flood";
  cv.setAttribute("aria-hidden", "true");
  document.body.append(cv);
  const g = cv.getContext("2d"),
    W = innerWidth,
    H = innerHeight,
    dpr = Math.min(2, devicePixelRatio || 1),
    fs = 10.5,
    lh = Math.round(fs * 1.22);
  cv.width = W * dpr;
  cv.height = H * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.font = `${fs}px ${FONT}`;
  g.textBaseline = "top";
  const cw = g.measureText("M").width || fs * 0.6,
    cols = Math.ceil(W / cw),
    rows = Math.ceil(H / lh),
    maxR = Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y)) + 80,
    t0 = performance.now(),
    DUR = 0.85;
  let gone = false,
    went = false,
    raf = 0;
  const end = () => {
    if (gone) return;
    gone = true;
    cv.classList.add("out");
    setTimeout(() => (cancelAnimationFrame(raf), cv.remove()), 450);
  };
  addEventListener("aquarium:intro", end, { once: true });
  setTimeout(end, 4000);
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const e = (now - t0) / 1000,
      u = Math.min(1, e / DUR),
      r = maxR * u * u * (3 - 2 * u) * 1.05;
    g.clearRect(0, 0, W, H);
    // the water behind the front
    g.fillStyle = "#07070a";
    g.beginPath();
    g.arc(x, y, Math.max(0, r - 70), 0, Math.PI * 2);
    g.fill();
    for (let rr = 0; rr < rows; rr++)
      for (let c = 0; c < cols; c++) {
        const px = c * cw,
          py = rr * lh,
          d = Math.hypot(px - x, (py - y) * 1.15),
          front = r - d;
        if (front < 0) continue;
        if (front < 70) {
          g.fillStyle = "#07070a";
          g.fillRect(px, py, cw + 0.5, lh + 0.5);
          g.fillStyle = front < 22 ? "#f4f0ff" : front < 45 ? "#cbbcff" : "#8f7ad6";
          g.fillText(front < 30 ? WAVE[(Math.random() * WAVE.length) | 0] : SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0], px, py);
        } else if (Math.random() < 0.06) {
          g.fillStyle = Math.random() < 0.5 ? "#3b2f66" : "#5b4d8f";
          g.fillText(SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0], px, py);
        }
      }
    if (u >= 1 && !went) {
      went = true;
      try {
        sessionStorage.setItem("aq-origin", JSON.stringify({ x: x / W, y: y / H }));
      } catch {}
      go();
    }
  };
  raf = requestAnimationFrame(frame);
}
