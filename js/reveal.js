// Landing page project blocks (markup: listMarkup in js/views.js; styles: "Reveal" in style.css).
// Each project is a tall section holding a pinned white screen. As you scroll, the small window in
// the middle grows (a CSS clip-path driven by --e) until the loop fills the screen. The loops play only
// while they are near the screen. A "View" label follows the cursor over the window.
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (x) => Math.min(1, Math.max(0, x));

export function bindReveal(root) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sections = [...root.querySelectorAll(".reveal")];
  const cursor = root.querySelector(".view-cursor");
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

  // The "View" label follows the cursor (eased) while it is over a window.
  let tx = 0,
    ty = 0,
    cx = 0,
    cy = 0,
    on = false,
    raf = 0;
  const move = () => {
    cx += (tx - cx) * 0.2;
    cy += (ty - cy) * 0.2;
    cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
    raf = on || Math.abs(tx - cx) + Math.abs(ty - cy) > 0.5 ? requestAnimationFrame(move) : 0;
  };
  const over = (e) => {
    if (e.pointerType === "touch") return;
    const hit = e.target.closest?.(".reveal-open");
    tx = e.clientX;
    ty = e.clientY;
    if (hit && !on) {
      on = true;
      cx = tx;
      cy = ty;
      cursor.classList.add("is-on");
    } else if (!hit && on) {
      on = false;
      cursor.classList.remove("is-on");
    }
    if (!raf && on) raf = requestAnimationFrame(move);
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
