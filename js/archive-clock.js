// Archive landing clock, after quynh.moe: the visitor's own time in large digits. Each second a
// droplet leaves the lower dot of the colon and falls onto the bottom of an invisible circle
// around the clock, and every droplet already there moves one step to the left along that
// circle. After 60 seconds the ring is closed; at the next minute the droplets dissolve (with a
// soft sound) and it starts again.
import { play, preload } from "./sound.js";

const FALL_S = 0.72; // a droplet takes this long to fall
const SHIFT_S = 0.7; // and this long to slide to its next place on the ring

// CSS-style cubic-bezier easing: (x1, y1, x2, y2) → a function of progress 0…1.
function bezier(x1, y1, x2, y2) {
  const at = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      // Newton's method: find the t whose curve x matches the progress.
      const err = at(t, x1, x2) - x;
      const slope = 3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t;
      if (Math.abs(err) < 1e-5 || !slope) break;
      t -= err / slope;
    }
    return at(t, y1, y2);
  };
}
const fallEase = bezier(0.55, 0.05, 0.85, 0.45), // lets go slowly, then drops
  slideEase = bezier(0.65, 0, 0.25, 1); // eases out of one place and into the next
// A point on a cubic curve through four points (p0 start, p3 end).
const curve = (t, p0, p1, p2, p3) => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3;

export function mountClock(el) {
  const canvas = el.querySelector("canvas"),
    timeEl = el.querySelector(".arch-clock-time");
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }); // the visitor's own time zone
  let R = 140, // radius of the invisible circle
    S = 0, // canvas size
    dotY = 0, // where droplets leave the clock (the colon's lower dot), from the circle's centre
    dotR = 3; // the size of that dot
  const resize = () => {
    const dpr = Math.min(devicePixelRatio, 2);
    R = Math.max(90, Math.min(175, Math.min(innerWidth * 0.11, innerHeight * 0.2)));
    S = Math.ceil(2 * R + 80);
    const fs = parseFloat(getComputedStyle(timeEl).fontSize);
    dotY = fs * 0.293; // measured: the colon's lower dot, from the middle of the digits
    dotR = fs * 0.076;
    canvas.width = canvas.height = S * dpr;
    canvas.style.cssText = `width:${S}px;height:${S}px;left:${-S / 2}px;top:${-S / 2}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  addEventListener("resize", resize);

  // A droplet: `age` is its place along the ring (0 = the bottom, then to the left); `shown`
  // eases toward it. `born` is when it left the clock; it lands FALL_S later.
  let drops = [],
    dissolving = [],
    sec = -1;
  const spawn = (age, born, landed) => ({ age, shown: age, from: age, moved: 0, born, landed });
  const place = (a, r) => [-r * Math.sin(a), r * Math.cos(a)]; // from the bottom, turning left

  const showTime = () => {
    const parts = fmt.formatToParts(new Date());
    const hm = `${parts.find((p) => p.type === "hour").value}:${parts.find((p) => p.type === "minute").value}`;
    if (timeEl.textContent !== hm) timeEl.textContent = hm;
  };
  // The ring for the seconds already gone this minute (first paint, or after a long pause).
  const rebuild = (now, nowSec) => {
    drops = [];
    for (let t = 0; t <= nowSec; t++) drops.push(spawn(nowSec - t, now - 99999, true));
    showTime();
  };
  // A new second: everything moves one place, a new droplet falls; a new minute clears the ring first.
  const tick = (now, nowSec) => {
    showTime();
    if (nowSec === 0 && drops.length) {
      dissolving = drops.map((d) => ({ ...d, at: now }));
      drops = [];
      play("timepass", 0.7);
    }
    for (const d of drops) ((d.from = d.shown), (d.moved = now), (d.age += 1));
    drops.push(spawn(0, now, reduce));
  };

  let raf = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const nowSec = Math.floor(Date.now() / 1000) % 60;
    const key = Math.floor(Date.now() / 1000);
    if (sec < 0 || key - sec > 2) {
      sec = key;
      rebuild(now, nowSec);
    } else if (key !== sec) {
      sec = key;
      tick(now, nowSec);
    }

    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.translate(S / 2, S / 2);
    for (const d of drops) {
      d.shown = reduce ? d.age : d.from + (d.age - d.from) * slideEase(Math.min(1, (now - d.moved) / 1000 / SHIFT_S));
      const u = reduce ? 1 : Math.min(1, (now - d.born) / 1000 / FALL_S);
      const [x, y] = place((d.shown * 2 * Math.PI) / 60, R);
      if (u < 1) {
        // It starts smaller than the colon's lower dot and behind it (the digits are drawn above
        // this canvas), so it is hidden, then slips out and falls along a gentle S-curve, easing
        // in with a bezier.
        const f = fallEase(u);
        const y = curve(f, dotY, dotY + (R - dotY) * 0.12, dotY + (R - dotY) * 0.72, R);
        const x = curve(f, 0, 0, 7, 0); // swings a little to the right of the line, then back
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x, y, dotR * 0.5 + (2.6 - dotR * 0.5) * f, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        d.landed = true;
        ctx.fillStyle = `rgba(255,255,255,${(1 - d.age * 0.009).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    // The old ring dissolves: droplets drift outward, shrink and fade.
    dissolving = dissolving.filter((d) => now - d.at < 1400);
    for (const d of dissolving) {
      const p = (now - d.at) / 1400,
        a = (d.shown * 2 * Math.PI) / 60;
      const [x, y] = place(a, R + p * 36);
      ctx.fillStyle = `rgba(255,255,255,${(0.8 * (1 - p) ** 2).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, 3 * (1 - p * 0.7), 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();
  };
  resize();
  showTime();
  preload("timepass");
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener("resize", resize);
  };
}
