// /archive/ landing: a wheel of titles, after kissbranding.co.uk/works (here in black and white).
//   · One title is selected (large, white) and the others fade away above and below it. The wheel
//     loops, so scrolling never runs out. Scroll, swipe or use ↑ / ↓ to move; click a title to
//     bring it up, click the selected one to open it.
//   · On arrival the wheel spins through the titles and slows down onto the first one, while the
//     titles resolve from ASCII noise into the normal type (js/archive-ascii-text.js).
//   · A pixel trail follows the cursor (js/archive-trail.js). A clock with a droplet for every
//     second is on the right (js/archive-clock.js).
import { navigateTo } from "./menu.js";
import { mountTrail } from "./archive-trail.js";
import { mountClock } from "./archive-clock.js";
import { mountAsciiTitles } from "./archive-ascii-text.js";
import { bezier } from "./ease.js";

const STEP_PX = 70; // wheel distance for one title

export function bindLanding(main) {
  const land = main.querySelector(".arch-land");
  if (!land) return () => {};
  const root = document.documentElement;
  root.classList.add("arch-land-page");
  const wheel = land.querySelector(".arch-wheel"),
    items = [...wheel.children],
    n = items.length;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── the wheel ──
  // On arrival the wheel starts two laps back and spins onto the first title, easing out.
  const INTRO_S = 2.6;
  let intro = reduce ? 0 : 2 * n,
    introT = 0,
    pos = -intro, // where the wheel is (in titles, unwrapped)
    target = 0,
    acc = 0,
    lastStep = 0,
    raf = 0,
    last = performance.now(),
    line = 100;
  const selected = () => ((Math.round(target) % n) + n) % n;
  const render = () => {
    for (let i = 0; i < n; i++) {
      let d = (((i - pos) % n) + n) % n;
      if (d > n / 2) d -= n;
      const a = Math.abs(d);
      const opacity = Math.max(0, 1 - a * 0.64) ** 1.4;
      items[i].style.transform = `translate3d(${(34 * (1 - Math.min(1, a))).toFixed(1)}px, ${(d * line - line / 2).toFixed(1)}px, 0)`;
      items[i].style.opacity = opacity.toFixed(3);
      items[i].classList.toggle("sel", i === selected() && a < 0.5);
    }
  };
  const frame = (now) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (intro) {
      introT += dt;
      const u = Math.min(1, introT / INTRO_S);
      pos = -intro * (1 - u) ** 4; // ease out: fast at first, settling onto the title
      titles.setResolve(resolveEase(u)); // the ASCII noise resolves into the titles
      if (u === 1) (intro = 0), (pos = target), titles.setResolve(1);
    } else {
      pos += (target - pos) * (1 - Math.exp(-(reduce ? 30 : 8) * dt));
      if (Math.abs(target - pos) < 0.001) pos = target;
    }
    render();
    if (intro || pos !== target) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf) (last = performance.now()), (raf = requestAnimationFrame(frame));
  };
  const measure = () => {
    line = parseFloat(getComputedStyle(items[0]).fontSize) * 1.12;
    render();
  };
  const titles = mountAsciiTitles(items, reduce);
  const resolveEase = bezier(0.6, 0, 0.2, 1);
  if (!intro) titles.setResolve(1);
  const ro = new ResizeObserver(measure);
  ro.observe(wheel);
  measure();
  if (intro) kick();
  // Move by whole titles, at most one every 140 ms so a fast flick does not fly past everything.
  const step = (dir) => {
    if (intro) return;
    const now = performance.now();
    if (now - lastStep < 140) return;
    lastStep = now;
    target += dir;
    kick();
  };
  const onWheel = (e) => {
    e.preventDefault();
    const u = e.deltaMode === 1 ? 16 : 1;
    acc += (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * u;
    if (Math.abs(acc) >= STEP_PX) (step(Math.sign(acc)), (acc = 0));
  };
  land.addEventListener("wheel", onWheel, { passive: false });
  let touch = null;
  land.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") touch = e.clientY;
  });
  land.addEventListener("pointermove", (e) => {
    if (touch !== null && Math.abs(e.clientY - touch) > 50) (step(Math.sign(touch - e.clientY)), (touch = e.clientY));
  });
  addEventListener("pointerup", () => (touch = null));
  const onKey = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") step(-1);
  };
  addEventListener("keydown", onKey);

  // Click: bring a title up, or open the selected one.
  wheel.addEventListener("click", (e) => {
    if (intro) return;
    const li = e.target.closest(".arch-item");
    if (!li) return;
    e.preventDefault();
    const i = items.indexOf(li);
    if (i !== selected()) {
      let d = (i - selected() + n) % n;
      if (d > n / 2) d -= n;
      target += d;
      return kick();
    }
    const a = li.querySelector("a");
    if (!a) return;
    wheel.classList.add("leaving");
    setTimeout(() => navigateTo(a.getAttribute("href")), reduce ? 0 : 450);
  });

  const trail = mountTrail(land.querySelector(".arch-trail"));
  // Over a title the trail steps aside, so the two never clash.
  wheel.addEventListener("pointerover", (e) => trail.suppress(Boolean(e.target.closest(".arch-item"))));
  wheel.addEventListener("pointerleave", () => trail.suppress(false));
  // No clock on a phone.
  const clockEl = land.querySelector(".arch-clock");
  let clockOff = () => {};
  if (matchMedia("(max-width: 700px)").matches) clockEl.remove();
  else clockOff = mountClock(clockEl);
  land.classList.add("ready"); // until now the titles and the clock are hidden, so they never show stacked

  return () => {
    trail.off();
    titles.off();
    clockOff();
    root.classList.remove("arch-land-page");
    cancelAnimationFrame(raf);
    ro.disconnect();
    removeEventListener("keydown", onKey);
  };
}
