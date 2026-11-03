// Archive landing clock, after quynh.moe: the visitor's own time in large digits. Each second a
// droplet leaves the lower dot of the colon and falls onto the bottom of an invisible circle
// around the clock, and every droplet already there moves one step to the left along that
// circle. After 60 seconds the ring is closed; at the next minute the droplets dissolve (with a
// soft sound) and it starts again.
import { play } from "./sound.js";

const FALL_S = 0.5; // a droplet takes this long to fall
const SHIFT_RATE = 9; // how fast droplets slide to their next place

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
  const spawn = (age, born, landed) => ({ age, shown: age, born, landed });
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
    for (const d of drops) d.age += 1;
    drops.push(spawn(0, now, reduce));
  };

  let raf = 0,
    last = performance.now();
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
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
    const k = 1 - Math.exp(-dt * SHIFT_RATE);
    for (const d of drops) {
      d.shown += (d.age - d.shown) * k;
      const u = reduce ? 1 : Math.min(1, (now - d.born) / 1000 / FALL_S);
      const [x, y] = place((d.shown * 2 * Math.PI) / 60, R);
      if (u < 1) {
        // It starts behind the colon's lower dot (the digits are drawn above this canvas, so it is
        // hidden), swells out of it on a thin neck like a drip, then lets go and speeds up.
        const y = dotY + (R - dotY) * u ** 2.4;
        ctx.fillStyle = "#fff";
        if (u < 0.35) ctx.fillRect(-(dotR * 1.5 * (1 - u / 0.35)) / 2, dotY, dotR * 1.5 * (1 - u / 0.35), y - dotY);
        ctx.beginPath();
        ctx.arc(0, y, dotR + (3 - dotR) * u, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        d.landed = true;
        ctx.fillStyle = `rgba(255,255,255,${(1 - d.age * 0.009).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
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
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener("resize", resize);
  };
}
