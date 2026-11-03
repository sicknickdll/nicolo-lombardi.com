// Archive landing clock, after quynh.moe: the place, and the time in large digits. Each second
// a droplet falls from the clock onto the bottom of an invisible circle around it, and every
// droplet already there moves one step to the left along that circle. After 60 seconds the ring
// is closed; at the next minute the droplets dissolve and it starts again.
const FALL_S = 0.5; // a droplet takes this long to fall
const SHIFT_RATE = 9; // how fast droplets slide to their next place
const PLACE = "Madrid, Spain";
const ZONE = "Europe/Madrid";

export function mountClock(el) {
  const canvas = el.querySelector("canvas"),
    timeEl = el.querySelector(".arch-clock-time"),
    placeEl = el.querySelector(".arch-clock-place");
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  placeEl.textContent = PLACE;
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
  let R = 140, // radius of the invisible circle
    S = 0, // canvas size
    top = 0; // where droplets leave the clock, from the circle's centre
  const resize = () => {
    const dpr = Math.min(devicePixelRatio, 2);
    R = Math.max(90, Math.min(175, Math.min(innerWidth * 0.11, innerHeight * 0.2)));
    S = Math.ceil(2 * R + 80);
    top = timeEl.offsetHeight / 2 + 4;
    canvas.width = canvas.height = S * dpr;
    canvas.style.cssText = `width:${S}px;height:${S}px;left:${-S / 2}px;top:${-S / 2}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  addEventListener("resize", resize);

  // A droplet: `age` is its place along the ring (0 = the bottom, then to the left); `shown`
  // eases toward it. `born` is when it left the clock; it lands FALL_S later.
  let drops = [],
    dissolving = [],
    ripples = [],
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
        // Falling from the clock to the bottom of the circle, faster and longer as it goes.
        const e = u * u;
        const fy = top + (R - top) * e;
        drawDrop(ctx, 0, fy, 3.4, 0.4 + 1.6 * u, 1);
      } else {
        if (!d.landed) (d.landed = true), ripples.push({ x: 0, y: R, at: now });
        const squash = Math.max(0, 1 - (now - d.born - FALL_S * 1000) / 260);
        ctx.fillStyle = `rgba(255,255,255,${(1 - d.age * 0.009).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 3 + squash * 1.6, 3 - squash * 1.1, 0, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    // Ripple where a droplet lands.
    ripples = ripples.filter((r) => now - r.at < 800);
    for (const r of ripples) {
      const p = (now - r.at) / 800;
      ctx.strokeStyle = `rgba(255,255,255,${(0.35 * (1 - p)).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, 4 + p * 16, 2 + p * 6, 0, 0, 2 * Math.PI);
      ctx.stroke();
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
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener("resize", resize);
  };
}

// A teardrop with its point up (it is falling), `stretch` makes it longer.
function drawDrop(ctx, x, y, r, stretch, alpha) {
  const h = r * (1 + stretch * 1.4);
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.bezierCurveTo(x + r * 0.15, y - h * 0.55, x + r, y - r * 0.9, x + r, y);
  ctx.arc(x, y, r, 0, Math.PI);
  ctx.bezierCurveTo(x - r, y - r * 0.9, x - r * 0.15, y - h * 0.55, x, y - h);
  ctx.fill();
}
