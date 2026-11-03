// /archive/ landing: a wheel of titles, after kissbranding.co.uk/works (here in black and white).
//   · One title is selected (large, white) and the others fade away above and below it. The wheel
//     loops, so scrolling never runs out. Scroll, swipe or use ↑ / ↓ to move; click a title to
//     bring it up, click the selected one to open it.
//   · Hover the selected title and the letter under the cursor glitches: it flickers through
//     random symbols and jitters (no colour split).
//   · An ASCII field drifts in the background and reacts to the cursor (js/archive-ascii.js).
//   · The eye logo on the left looks at the cursor (the landing page's eye, via js/eye.js).
import { eyeTracking } from "./eye.js";
import { navigateTo } from "./menu.js";
import { mountAscii } from "./archive-ascii.js";

const STEP_PX = 70; // wheel distance for one title
const GLYPHS = "!<>-_\\/[]{}=+*^?#$%&~01";

export function bindLanding(main) {
  const land = main.querySelector(".arch-land");
  if (!land) return () => {};
  const root = document.documentElement;
  root.classList.add("arch-land-page");
  const wheel = land.querySelector(".arch-wheel"),
    items = [...wheel.children],
    n = items.length;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Each title becomes one span per letter, so a single letter can glitch.
  for (const li of items) {
    const label = li.firstElementChild;
    const text = label.textContent;
    label.setAttribute("aria-label", text);
    label.textContent = "";
    for (const ch of text) {
      const s = document.createElement("span");
      s.className = "arch-l";
      s.setAttribute("aria-hidden", "true");
      s.textContent = ch;
      label.append(s);
    }
  }

  // ── the wheel ──
  let pos = 0, // where the wheel is (in titles, unwrapped)
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
      const opacity = Math.max(0, 1 - a * 0.64) ** 1.4 * (items[i].classList.contains("soon") ? 0.55 : 1);
      items[i].style.transform = `translate3d(${(34 * (1 - Math.min(1, a))).toFixed(1)}px, ${(d * line - line / 2).toFixed(1)}px, 0)`;
      items[i].style.opacity = opacity.toFixed(3);
      items[i].classList.toggle("sel", i === selected() && a < 0.5);
    }
  };
  const frame = (now) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    pos += (target - pos) * (1 - Math.exp(-(reduce ? 30 : 8) * dt));
    if (Math.abs(target - pos) < 0.001) pos = target;
    render();
    if (pos !== target) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf) (last = performance.now()), (raf = requestAnimationFrame(frame));
  };
  const measure = () => {
    line = parseFloat(getComputedStyle(items[0]).fontSize) * 1.12;
    render();
  };
  const ro = new ResizeObserver(measure);
  ro.observe(wheel);
  measure();
  // Move by whole titles, at most one every 140 ms so a fast flick does not fly past everything.
  const step = (dir) => {
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

  // ── a letter glitching under the cursor ──
  const running = new WeakSet();
  wheel.addEventListener("pointerover", (e) => {
    const l = e.target.closest?.(".arch-l");
    if (!l || running.has(l) || !l.closest(".sel") || reduce || !l.textContent.trim()) return;
    running.add(l);
    const original = l.textContent;
    l.style.minWidth = l.getBoundingClientRect().width + "px";
    l.classList.add("g");
    let frames = 0;
    const tick = setInterval(() => {
      l.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      if (++frames >= 6) {
        clearInterval(tick);
        l.textContent = original;
        l.classList.remove("g");
        l.style.minWidth = "";
        running.delete(l);
      }
    }, 55);
  });

  // ── the eye ──
  const video = land.querySelector(".arch-logo video");
  video.play().catch(() => {});
  const eyeOff = eyeTracking(video);

  const asciiOff = mountAscii(land.querySelector(".arch-ascii"));

  return () => {
    asciiOff();
    root.classList.remove("arch-land-page");
    cancelAnimationFrame(raf);
    ro.disconnect();
    removeEventListener("keydown", onKey);
    eyeOff();
    video.pause();
  };
}
