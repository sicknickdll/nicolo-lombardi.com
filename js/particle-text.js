// Text drawn as particles, after React Bits' "Particle Text" (reactbits.dev/text-animations/particle-text,
// MIT + Commons Clause), rewritten without React for this site.
//   · The text is drawn off-screen and sampled every `density` px; each sample becomes a dot.
//   · Intro "gather": the dots start scattered around their place and ease in (easeOutCubic),
//     each a little later than the last.
//   · The pointer pushes dots away; a click blows them out and a spring brings them back.
//   · Dots shift towards the highlight colour (and glow) while they are away from their place.
//   · setText() moves the same dots onto a new text; { glitch: true } makes them snap there
//     almost at once (used for the scrambled frames of the glitch).
// Usage: const pt = mountParticleText(canvas, { text: "ARCHIVE" }); pt.setText("HELLO"); pt.off();

const TONES = 12;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

const DEFAULTS = {
  particleSize: 2,
  density: 4,
  highlightColor: "#ff5a36",
  scatter: 180,
  gatherDuration: 1600,
  stagger: 420,
  burstStrength: 1,
  pointerRepel: 40,
  repelRadius: 120,
  idleDrift: 0.7,
  fontSize: "clamp(3rem, 12vw, 8rem)",
  fontWeight: 800,
  fontFamily: "inherit",
  glow: true,
};

export function mountParticleText(canvas, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sampler = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  let width = 0,
    height = 0,
    dpr = 1,
    text = o.text || "",
    particles = [],
    raf = 0,
    last = 0,
    alive = true,
    gathering = false,
    gatherStart = 0,
    snapUntil = 0,
    palette = [],
    glowColor = o.highlightColor;
  const pointer = { active: false, x: -1e4, y: -1e4, sx: -1e4, sy: -1e4 };

  // ── colours: from the canvas's own colour (CSS `color`) to the highlight, in TONES steps ──
  const rgb = (c) => {
    sampler.canvas.width = sampler.canvas.height = 1;
    sampler.fillStyle = "#000";
    sampler.fillStyle = c;
    sampler.fillRect(0, 0, 1, 1);
    return sampler.getImageData(0, 0, 1, 1).data;
  };
  function recolor() {
    const a = rgb(getComputedStyle(canvas).color || "#000"),
      b = rgb(o.highlightColor);
    glowColor = `rgb(${b[0]},${b[1]},${b[2]})`;
    palette = Array.from({ length: TONES }, (_, i) => {
      const t = i / (TONES - 1);
      return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
    });
  }

  // ── sampling: where the dots of a text go ──
  const fontPx = () => {
    if (typeof o.fontSize === "number") return o.fontSize;
    const probe = document.createElement("span");
    probe.style.cssText = `position:absolute;visibility:hidden;font-size:${o.fontSize}`;
    canvas.parentElement.append(probe);
    const px = parseFloat(getComputedStyle(probe).fontSize) || 96;
    probe.remove();
    return px;
  };
  const family = () => (o.fontFamily === "inherit" ? getComputedStyle(canvas).fontFamily : o.fontFamily);
  function sample(str) {
    let size = fontPx();
    const font = (s) => `${o.fontWeight} ${s}px ${family()}`;
    sampler.font = font(size);
    const w = sampler.measureText(str).width;
    if (w > width * 0.92) size *= (width * 0.92) / w; // long phrases shrink to fit
    sampler.font = font(size);
    const tw = Math.ceil(sampler.measureText(str).width) + 8,
      th = Math.ceil(size * 1.4);
    sampler.canvas.width = tw;
    sampler.canvas.height = th;
    sampler.font = font(size);
    sampler.textBaseline = "middle";
    sampler.fillStyle = "#000";
    sampler.fillText(str, 4, th / 2);
    const data = sampler.getImageData(0, 0, tw, th).data,
      step = Math.max(2, o.density),
      ox = (width - tw) / 2,
      oy = (height - th) / 2,
      pts = [];
    // Column by column, so that a dot keeps roughly its place across texts of similar length.
    for (let x = 0; x < tw; x += step)
      for (let y = 0; y < th; y += step) if (data[(y * tw + x) * 4 + 3] > 40) pts.push(ox + x, oy + y);
    const cap = clamp(Math.round((width * height) / 160), 900, 5200);
    if (pts.length / 2 > cap) {
      const keep = [],
        every = pts.length / 2 / cap;
      for (let i = 0; i < cap; i++) {
        const k = Math.floor(i * every) * 2;
        keep.push(pts[k], pts[k + 1]);
      }
      return keep;
    }
    return pts;
  }
  const newParticle = (x, y) => ({ x, y, tx: x, ty: y, sx: x, sy: y, ox: 0, oy: 0, vx: 0, vy: 0, seed: Math.random(), depth: Math.random(), delay: 0 });
  function retarget(str, intro) {
    const pts = sample(str),
      n = pts.length / 2;
    while (particles.length > n) particles.pop();
    for (let i = 0; i < n; i++) {
      let p = particles[i];
      if (!p) {
        // New dots start where an existing one is, so nothing pops out of nowhere.
        const from = particles[Math.floor(Math.random() * Math.max(1, i))];
        p = newParticle(from ? from.x : pts[i * 2], from ? from.y : pts[i * 2 + 1]);
        particles.push(p);
      }
      p.tx = pts[i * 2];
      p.ty = pts[i * 2 + 1];
    }
    if (intro && !reduce) {
      for (const p of particles) {
        const a = p.seed * TAU,
          d = o.scatter * (0.35 + p.depth * 0.75);
        p.sx = p.x = p.tx + Math.cos(a) * d + (p.seed - 0.5) * o.scatter * 0.45;
        p.sy = p.y = p.ty + Math.sin(a) * d + (p.depth - 0.9) * o.scatter * 0.45;
        p.delay = p.seed * o.stagger;
      }
      gathering = true;
      gatherStart = performance.now();
    } else if (reduce) for (const p of particles) (p.x = p.tx), (p.y = p.ty);
    wake();
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    width = r.width;
    height = r.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    retarget(text, false);
  }

  // ── frame ──
  const buckets = Array.from({ length: TONES }, () => []);
  function frame(now) {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    const f = dt * 60; // frames at 60 fps
    const glitch = now < snapUntil;
    const follow = glitch ? 1 - 0.35 ** f : 1 - 0.78 ** f;
    pointer.sx += (pointer.x - pointer.sx) * (1 - 0.82 ** f);
    pointer.sy += (pointer.y - pointer.sy) * (1 - 0.82 ** f);
    const r = o.repelRadius,
      t = now / 1000;
    let busy = gathering || glitch;
    let allIn = true;
    for (const b of buckets) b.length = 0;
    for (const p of particles) {
      // where it wants to be: its place, drifting a little, pushed away from the pointer
      let hx = p.tx + Math.sin(t * 0.9 + p.seed * TAU) * o.idleDrift * p.depth,
        hy = p.ty + Math.cos(t * 0.7 + p.seed * TAU) * o.idleDrift * p.depth;
      if (pointer.active) {
        const dx = hx - pointer.sx,
          dy = hy - pointer.sy,
          d = Math.hypot(dx, dy);
        if (d < r && d > 0.01) {
          const push = (1 - d / r) ** 2 * o.pointerRepel;
          hx += (dx / d) * push;
          hy += (dy / d) * push;
        }
      }
      // burst: a spring pulls the offset back to zero
      if (p.vx || p.vy || p.ox || p.oy) {
        p.vx += (-18 * p.ox - 7.5 * p.vx) * dt;
        p.vy += (-18 * p.oy - 7.5 * p.vy) * dt;
        p.ox += p.vx * dt;
        p.oy += p.vy * dt;
        if (Math.abs(p.ox) + Math.abs(p.oy) + Math.abs(p.vx) + Math.abs(p.vy) < 0.05) p.ox = p.oy = p.vx = p.vy = 0;
        else busy = true;
      }
      if (gathering) {
        const k = clamp((now - gatherStart - p.delay) / o.gatherDuration, 0, 1);
        if (k < 1) allIn = false;
        const e = easeOutCubic(k);
        p.x = p.sx + (hx - p.sx) * e + p.ox;
        p.y = p.sy + (hy - p.sy) * e + p.oy;
      } else {
        p.x += (hx + p.ox - p.x) * follow;
        p.y += (hy + p.oy - p.y) * follow;
      }
      const away = Math.hypot(p.x - p.tx, p.y - p.ty);
      if (away > 0.5) busy = true;
      buckets[Math.round(clamp((away - 3) / 36, 0, 1) * (TONES - 1))].push(p);
    }
    if (gathering && allIn) gathering = false;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const s = o.particleSize / 2;
    buckets.forEach((group, tone) => {
      if (!group.length) return;
      ctx.beginPath();
      for (const p of group) {
        ctx.moveTo(p.x + s, p.y);
        ctx.arc(p.x, p.y, s, 0, TAU);
      }
      ctx.fillStyle = palette[tone];
      if (o.glow && tone > 2) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = (3 + o.particleSize * 1.5) * dpr;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    // Keep drawing while anything moves (and always while the pointer is over it, for the drift).
    if (busy || pointer.active || o.idleDrift) raf = requestAnimationFrame(frame);
  }
  function wake() {
    if (!raf && alive && !document.hidden) (last = 0), (raf = requestAnimationFrame(frame));
  }

  // ── input (listened to on the window: the canvas itself sits under everything) ──
  const onMove = (e) => {
    pointer.x = e.clientX - canvas.getBoundingClientRect().left;
    pointer.y = e.clientY - canvas.getBoundingClientRect().top;
    if (!pointer.active) (pointer.sx = pointer.x), (pointer.sy = pointer.y);
    pointer.active = e.pointerType === "mouse";
    wake();
  };
  const onLeave = () => ((pointer.active = false), (pointer.x = pointer.y = -1e4));
  function burst(clientX, clientY) {
    if (reduce) return;
    const rect = canvas.getBoundingClientRect(),
      x = clientX - rect.left,
      y = clientY - rect.top,
      k = o.burstStrength,
      radius = 90 + 70 * Math.sqrt(k) + o.repelRadius * 0.25;
    for (const p of particles) {
      const dx = p.x - x,
        dy = p.y - y,
        d = Math.hypot(dx, dy);
      if (d > radius) continue;
      const fall = 1 - d / radius,
        power = 950 * k * (0.2 + 0.8 * fall * fall) * (0.65 + p.depth * 0.45),
        a = Math.atan2(dy, dx) + (p.seed - 0.5) * 0.9;
      p.vx += Math.cos(a) * power;
      p.vy += Math.sin(a) * power;
    }
    wake();
  }
  const onVisible = () => !document.hidden && wake();
  addEventListener("pointermove", onMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  document.addEventListener("visibilitychange", onVisible);
  const ro = new ResizeObserver(() => resize());

  recolor();
  const start = () => {
    if (!alive) return;
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    width = r.width;
    height = r.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    retarget(text, true);
    ro.observe(canvas);
  };
  // Wait for the font, or the dots would be sampled from the fallback.
  (document.fonts?.load(`${o.fontWeight} 64px ${family()}`) || Promise.resolve()).catch(() => {}).then(start);

  return {
    get text() {
      return text;
    },
    setText(str, { glitch = false } = {}) {
      text = str;
      if (glitch) snapUntil = performance.now() + 120;
      gathering = false;
      if (width) retarget(str, false);
    },
    burst,
    recolor,
    off() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisible);
    },
  };
}
