// Landing page project blocks (markup: listMarkup in js/views.js; styles: "Reveal" in style.css).
// Each project is a tall section holding a pinned white screen. As you scroll, the small window in
// the middle grows (a CSS clip-path driven by --e) until the loop fills the screen. The loops play only
// while they are near the screen. Hovering a window splits the picture into red / blue ghosts.
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (x) => Math.min(1, Math.max(0, x));

export function bindReveal(root) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sections = [...root.querySelectorAll(".reveal")];
  const timers = new Map();
  let frame = 0;

  const update = () => {
    frame = 0;
    const H = innerHeight;
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.bottom < -H || r.top > H * 2) continue;
      // Starts growing a quarter screen before the block is pinned; full after one more screen.
      const e = reduce ? 1 : ease(clamp((H * 0.25 - r.top) / H));
      s.style.setProperty("--e", e.toFixed(4));
      s.classList.toggle("is-full", e > 0.97);
    }
  };
  const request = () => frame || (frame = requestAnimationFrame(update));

  // Play a loop only while its block is on screen; cycle the slideshow the same way.
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const s = en.target,
          v = s.querySelector("video"),
          slides = [...s.querySelectorAll(".reveal-slide")];
        if (en.isIntersecting) {
          v?.play().catch(() => {});
          if (slides.length > 1 && !reduce && !timers.has(s)) {
            let k = 0;
            timers.set(
              s,
              setInterval(() => {
                slides[k].classList.remove("is-on");
                k = (k + 1) % slides.length;
                slides[k].classList.add("is-on");
              }, 1700),
            );
          }
        } else {
          v?.pause();
          clearInterval(timers.get(s));
          timers.delete(s);
        }
      }
    },
    { rootMargin: "20% 0px" },
  );
  sections.forEach((s) => io.observe(s));

  // Chromatic aberration (an SVG filter, #ca in the page): while the pointer is over a window the red and
  // blue channels are pushed apart along the direction the mouse moves; the faster it moves, the wider the
  // split. It eases back to nothing when the pointer leaves or stops.
  const offR = root.querySelector("#ca-r"),
    offB = root.querySelector("#ca-b");
  let stage = null,
    amount = 0,
    dirx = 1,
    diry = 0,
    vx = 0,
    vy = 0,
    lx = 0,
    ly = 0,
    raf = 0;
  const frameCA = () => {
    vx *= 0.88;
    vy *= 0.88;
    const speed = Math.hypot(vx, vy);
    if (speed > 0.6) {
      dirx += (vx / speed - dirx) * 0.25;
      diry += (vy / speed - diry) * 0.25;
    }
    const target = stage ? 2.5 + Math.min(14, speed * 0.6) : 0;
    amount += (target - amount) * 0.14;
    const n = Math.hypot(dirx, diry) || 1;
    const dx = (dirx / n) * amount,
      dy = (diry / n) * amount;
    offR.setAttribute("dx", dx.toFixed(2));
    offR.setAttribute("dy", dy.toFixed(2));
    offB.setAttribute("dx", (-dx).toFixed(2));
    offB.setAttribute("dy", (-dy).toFixed(2));
    if (!stage && amount < 0.05) {
      root.querySelectorAll(".is-ca").forEach((el) => el.classList.remove("is-ca"));
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(frameCA);
  };
  const over = (e) => {
    if (e.pointerType === "touch" || reduce) return;
    vx += (e.clientX - lx) * 0.35;
    vy += (e.clientY - ly) * 0.35;
    lx = e.clientX;
    ly = e.clientY;
    const next = e.target.closest?.(".reveal-open")?.closest(".reveal-stage") || null;
    if (next !== stage) {
      root.querySelectorAll(".is-ca").forEach((el) => el !== next && el.classList.remove("is-ca"));
      stage = next;
      stage?.classList.add("is-ca");
    }
    if (!raf && (stage || amount > 0.05)) raf = requestAnimationFrame(frameCA);
  };
  addEventListener("pointermove", over, { passive: true });
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", request);
  update();
  return () => {
    cancelAnimationFrame(frame);
    cancelAnimationFrame(raf);
    io.disconnect();
    timers.forEach(clearInterval);
    removeEventListener("pointermove", over);
    removeEventListener("scroll", request);
    removeEventListener("resize", request);
  };
}
