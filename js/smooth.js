// Smooth scrolling ("inertia scrolling" / "momentum scroll", the effect libraries like Lenis
// popularised). The mouse wheel and trackpad no longer jump the page: each notch moves a
// target, and the page glides toward it, braking gently the same way every time.
// On the landing page, when the wheel stops the page also settles on the nearest project
// (a light flick goes to the next one), replacing the browser's snap, which can't be eased.
// Touch screens, the keyboard and reduced-motion keep the browser's own scrolling.
const EASE = 14; // higher = arrives sooner (the reference page uses 9; this is a bit snappier)

export function smoothScroll() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const root = document.documentElement;
  let target = scrollY,
    current = scrollY,
    raf = 0,
    last = 0,
    written = -1,
    snapTimer = 0,
    startTop = null,
    dir = 0;

  const maxY = () => root.scrollHeight - innerHeight;
  const locked = () => {
    const h = getComputedStyle(root).overflowY,
      b = getComputedStyle(document.body).overflowY;
    return h === "hidden" || h === "clip" || b === "hidden" || b === "clip";
  };
  // Something under the cursor that scrolls by itself and can still move that way.
  const ownScroller = (el, dy) => {
    for (; el && el !== document.body && el !== root; el = el.parentElement) {
      if (el.scrollHeight <= el.clientHeight + 1) continue;
      const oy = getComputedStyle(el).overflowY;
      if (oy !== "auto" && oy !== "scroll") continue;
      if (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
    }
    return false;
  };

  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    target = current = scrollY;
    written = -1;
  };
  const step = (now) => {
    // Something else (the scrollbar, a link) moved the page: let it.
    if (written >= 0 && Math.abs(scrollY - written) > 2) return stop();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    current += (target - current) * (1 - Math.exp(-EASE * dt));
    if (Math.abs(target - current) < 0.5) current = target;
    scrollTo({ top: current, behavior: "instant" });
    written = scrollY;
    if (current !== target) raf = requestAnimationFrame(step);
    else (raf = 0), (written = -1);
  };
  const glide = () => {
    if (!raf) {
      current = scrollY;
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
  };

  // Landing page: settle on a project cover.
  const settle = () => {
    if (!root.classList.contains("snap-pages")) return;
    const tops = [...document.querySelectorAll(".home,.project-section")].map(
      (s) => Math.round(s.getBoundingClientRect().top + scrollY),
    );
    if (tops.length < 2 || target > tops.at(-1) + 4) return;
    let best = 0;
    tops.forEach((t, i) => {
      if (Math.abs(t - target) < Math.abs(tops[best] - target)) best = i;
    });
    // A short flick still moves on to the next project.
    const from = tops.reduce((b, t, i) => (Math.abs(t - startTop) < Math.abs(tops[b] - startTop) ? i : b), 0);
    if (best === from && Math.abs(target - tops[from]) > innerHeight * 0.1) best = clamp(from + dir, 0, tops.length - 1);
    target = tops[best];
    glide();
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const onWheel = (e) => {
    if (e.defaultPrevented || e.ctrlKey || !e.cancelable) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (locked() || maxY() <= 0) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    if (e.target instanceof Element && ownScroller(e.target, dy)) return;
    e.preventDefault();
    if (!raf) (current = scrollY), (target = scrollY);
    if (!snapTimer) startTop = target;
    dir = Math.sign(dy) || dir;
    target = clamp(target + dy, 0, maxY());
    glide();
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => {
      snapTimer = 0;
      settle();
    }, 130);
  };
  // Keys, anchor links and the scrollbar move the page on their own: keep the target in step.
  addEventListener(
    "scroll",
    () => {
      if (!raf) target = current = scrollY;
    },
    { passive: true },
  );
  addEventListener("resize", () => (target = Math.min(target, maxY())), { passive: true });
  addEventListener("wheel", onWheel, { passive: false });
}
