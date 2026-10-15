// Landing intro, modelled on voku.studio. The first word rolls in on black in the hero
// name's place while the frames load; project frames then burst out onto a ring that
// keeps spinning around the words as they roll by, ending on the name. The ring is
// pulled back into the name, and the page appears behind it.
// It only runs when the inline script in template.html added `html.intro` (entering
// the site or reloading the landing page, not coming back to it from another page,
// and never with reduced motion). Any click, tap or key skips it.
import { intro } from "./data.js";

const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t ** 3;
const clamp = (t) => Math.min(1, Math.max(0, t));
const lerp = (a, b, t) => a + (b - a) * t;

// Durations in ms; spin speeds in radians per second (negative = anticlockwise,
// so frames cross the top of the ring from right to left as on voku.studio).
const T = {
  firstWord: 700, // the first word shows at least this long while the frames load
  loadCap: 2500, // …and at most this long
  word: 450, // each following word, with the ring turning around it
  name: 700, // the name, ring still turning, before the ring collapses into it
  burst: 950, // frames fly out to the ring
  settle: 1800, // spin slows from its burst speed to cruising speed
  absorb: 820, // frames are pulled into the name
  reveal: 850, // black fades away, page appears
};
const SPIN = { burst: -5.5, cruise: -0.45, absorb: -4 };

export function playIntro() {
  const root = document.documentElement;
  const heroName = document.querySelector(".home .animated-name");
  const finishNow = () => root.classList.remove("intro");
  if (!heroName) return (finishNow(), Promise.resolve());

  const saveData = navigator.connection?.saveData;
  const blocked = [document.querySelector("#main"), document.querySelector(".header")];
  blocked.forEach((el) => el && (el.inert = true));

  const el = document.createElement("div");
  el.className = "intro-overlay";
  el.innerHTML = `<div class="intro-bg"></div><div class="intro-ring" aria-hidden="true"></div><div class="intro-word" aria-hidden="true"><div class="intro-roll"></div></div><button class="intro-skip" type="button">skip intro</button>`;
  document.body.append(el);
  const ring = el.querySelector(".intro-ring"),
    word = el.querySelector(".intro-word"),
    roll = el.querySelector(".intro-roll");

  // Words, then a copy of the hero name (same letter spans, so the same kerning) that
  // ends exactly on top of the real one.
  const items = intro.words.map((w) => {
    const s = document.createElement("span");
    s.textContent = w;
    return s;
  });
  const name = heroName.cloneNode(true);
  name.removeAttribute("aria-label");
  items.push(name);
  items.forEach((item) => {
    item.classList.add("intro-item");
    roll.append(item);
  });

  // Frames, each with its own random tilt so the ring doesn't look mechanical.
  const loads = [];
  const frames = intro.frames.map((f, i) => {
    const frame = document.createElement("div");
    frame.className = "intro-frame";
    const img = new Image();
    img.decoding = "async";
    img.alt = "";
    loads.push(
      new Promise((done) => {
        img.onload = img.onerror = done;
      }),
    );
    img.src = f.src;
    let media = img;
    if (f.video && !saveData) {
      // Muted + inline + autoplay is what lets phones play it without a tap. It counts
      // as loaded once it can play, so the ring never shows a frozen clip.
      const v = document.createElement("video");
      v.muted = v.loop = v.playsInline = v.autoplay = true;
      v.setAttribute("muted", "");
      v.setAttribute("playsinline", "");
      v.preload = "auto";
      v.poster = f.src;
      v.innerHTML = `<source src="${f.video}" type="video/webm"><source src="${f.video.replace(/\.webm$/, ".mp4")}" type="video/mp4">`;
      loads.push(
        new Promise((done) => {
          v.addEventListener("canplay", done, { once: true });
          v.lastElementChild.addEventListener("error", done, { once: true });
        }),
      );
      media = v;
    }
    frame.append(media);
    ring.append(frame);
    return {
      frame,
      media,
      ratio: f.ratio,
      slot: (i / intro.frames.length) * Math.PI * 2,
      tiltX: (Math.random() * 2 - 1) * 10,
      tiltY: (Math.random() * 2 - 1) * 10,
      tiltZ: (Math.random() * 2 - 1) * 4,
      delay: Math.random() * 0.3,
    };
  });

  // Geometry: the ring is centred on the hero name and sized to the screen.
  let cx = 0,
    cy = 0,
    rx = 0,
    ry = 0,
    lineHeight = 0;
  const layout = () => {
    const r = heroName.getBoundingClientRect(),
      cs = getComputedStyle(heroName);
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    lineHeight = parseFloat(cs.lineHeight) || r.height;
    Object.assign(word.style, {
      top: cy - lineHeight / 2 + "px",
      height: lineHeight + "px",
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontFamily: cs.fontFamily,
      letterSpacing: cs.letterSpacing,
      lineHeight: lineHeight + "px",
      transformOrigin: `${cx}px 50%`,
      transform: cs.transform === "none" ? "" : cs.transform,
    });
    items.forEach((item) => (item.style.height = lineHeight + "px"));
    showWord(current);
    const vw = innerWidth,
      vh = innerHeight,
      base = Math.max(64, Math.min(230, Math.min(vw, vh) * 0.21));
    rx = vw * (vw < vh ? 0.34 : 0.37);
    ry = vh * (vw < vh ? 0.3 : 0.34);
    frames.forEach((f) => {
      f.w = base * Math.sqrt(f.ratio) * 0.78;
      f.h = (base / Math.sqrt(f.ratio)) * 0.78;
      Object.assign(f.frame.style, {
        width: f.w + "px",
        height: f.h + "px",
        marginLeft: -f.w / 2 + "px",
        marginTop: -f.h / 2 + "px",
      });
    });
  };
  let current = -1;
  const showWord = (i) => {
    current = i;
    roll.style.transform = `translateY(${-i * lineHeight}px)`;
  };
  layout();
  addEventListener("resize", layout);

  // One clock for the ring: `radius` 0 → 1 → 0, `spin` integrated every frame.
  let raf = 0,
    last = 0,
    angle = -Math.PI / 2,
    phase = "idle",
    phaseStart = 0,
    clock = 0;
  const startPhase = (p) => {
    phase = p;
    phaseStart = clock;
  };
  const draw = (now) => {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
    last = now;
    clock += dt * 1000;
    const t = clock - phaseStart;
    let radius = 0,
      spin = 0,
      zoom = 1;
    if (phase === "orbit") {
      const k = clamp(t / T.burst);
      radius = easeOut(k);
      spin = lerp(SPIN.burst, SPIN.cruise, easeOut(clamp(t / T.settle)));
      zoom = lerp(1.4, 1, easeOut(k));
    } else if (phase === "absorb") {
      const k = clamp(t / T.absorb);
      radius = 1 - easeIn(k);
      spin = lerp(SPIN.cruise, SPIN.absorb, easeIn(k));
      if (k >= 1) {
        startPhase("done");
        absorbed();
      }
    }
    angle += spin * dt;
    const burstAge = phase === "orbit" ? t / 1000 : 1;
    frames.forEach((f) => {
      const a = angle + f.slot,
        depth = Math.sin(a), // -1 back (top of the ring) … +1 front (bottom)
        shrink = 0.15 + 0.85 * radius ** 0.7,
        scale = shrink * (0.88 + 0.14 * (depth + 1));
      const fade = phase === "orbit" ? clamp((burstAge - f.delay) / 0.18) : clamp(radius / 0.35);
      f.frame.style.opacity = phase === "done" ? 0 : fade;
      f.frame.style.zIndex = Math.round((depth + 1) * 50);
      f.frame.style.transform =
        `translate3d(${cx + Math.cos(a) * rx * radius}px,${cy + depth * ry * radius}px,0)` +
        ` rotateY(${-Math.cos(a) * 18 + f.tiltY}deg) rotateX(${f.tiltX}deg) rotateZ(${f.tiltZ}deg) scale(${scale})`;
      f.media.style.transform = `scale(${zoom})`;
    });
    if (phase !== "done") raf = requestAnimationFrame(draw);
  };

  let resolve;
  const finished = new Promise((r) => (resolve = r));
  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  let ended = false;
  const end = (fast) => {
    if (ended) return;
    ended = true;
    timers.forEach(clearTimeout);
    finishNow();
    blocked.forEach((b) => b && (b.inert = false));
    el.classList.add(fast ? "is-skipped" : "is-revealing");
    setTimeout(
      () => {
        cancelAnimationFrame(raf);
        removeEventListener("resize", layout);
        removeEventListener("keydown", skipKey);
        el.querySelectorAll("video").forEach((v) => v.pause());
        el.remove();
        resolve();
      },
      fast ? 450 : T.reveal + 50,
    );
  };
  const absorbed = () => {
    name.classList.add("intro-pulse");
    at(260, () => end(false));
  };
  const skip = () => end(true);
  const skipKey = (e) => {
    if (!e.metaKey && !e.ctrlKey && !e.altKey) skip();
  };
  el.addEventListener("pointerdown", skip);
  addEventListener("keydown", skipKey);

  // Timeline: first word while the frames load; then the ring bursts out and the
  // other words roll by while it turns; the name; the ring collapses into it.
  at(80, () => showWord(0));
  const minWait = new Promise((r) => setTimeout(r, T.firstWord));
  const capWait = new Promise((r) => setTimeout(r, T.loadCap));
  Promise.race([Promise.all([minWait, ...loads]), capWait]).then(() => {
    if (ended) return;
    el.querySelectorAll("video").forEach((v) => v.play().catch(() => {}));
    startPhase("orbit");
    raf = requestAnimationFrame(draw);
    for (let i = 1; i < items.length; i++) at(T.word * i, () => showWord(i));
    const nameAt = T.word * (items.length - 1);
    at(nameAt + 450, () => word.classList.add("is-settled"));
    at(nameAt + T.name, () => startPhase("absorb"));
  });
  return finished;
}
