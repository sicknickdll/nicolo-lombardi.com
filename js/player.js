// Custom video interface for the films on project pages (replaces the browser controls).
//
//   · click the picture to play / pause; small text controls: play, sound, fullscreen
//   · a fine line along the bottom edge shows the length of the film and where you are:
//     click or drag it to jump (arrow keys too)
//   · a horizontal wheel / trackpad swipe (or shift + wheel) scrubs the film forward /
//     backward; vertical scrolling is never touched, so the page always scrolls normally
//   · paused: a title card; playing: the controls fade out after a moment
//
// Each <video controls> sits in <div class="player" data-brand data-title data-type>
// (see views.js / galleries.js). Without JavaScript the native controls stay.
const WHEEL = 0.015; // seconds of film per pixel of sideways wheel
const IDLE = 2400; // ms before the controls fade out while playing

const clock = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

function upgrade(wrap, signal) {
  const video = wrap.querySelector("video");
  if (!video) return;
  video.removeAttribute("controls");
  video.controls = false;
  wrap.classList.add("is-custom");

  const on = (target, type, fn, opts) => target.addEventListener(type, fn, { ...opts, signal });

  // ── interface ──
  const screen = el("div", "pl-screen");
  screen.setAttribute("aria-hidden", "true");
  const { brand, title, type } = wrap.dataset;
  const card = el("div", "pl-card");
  card.setAttribute("aria-hidden", "true");
  if (title) {
    card.append(el("span", "pl-card-brand", brand), el("strong", "pl-card-title", title));
    if (type) card.append(el("span", "pl-card-type", type));
  } else if (brand) card.append(el("strong", "pl-card-title", brand));
  const ui = el("div", "pl-ui");
  const play = el("button", "pl-play", "play");
  const time = el("span", "pl-time", "0:00 / 0:00");
  const sound = el("button", "pl-sound");
  const full = el("button", "pl-full", "fullscreen");
  [play, sound, full].forEach((b) => (b.type = "button"));
  ui.append(play, time, el("span", "pl-spacer"), sound);
  if (wrap.requestFullscreen || video.webkitEnterFullscreen) ui.append(full);
  const line = el("div", "pl-line");
  line.setAttribute("role", "slider");
  line.tabIndex = 0;
  line.setAttribute("aria-label", "Seek");
  const fill = el("i", "pl-fill");
  line.append(el("i", "pl-track"), fill);
  wrap.append(screen, card, ui, line);

  // ── state ──
  let hideTimer = 0;
  let raf = 0;
  let pending = 0;
  let scrubbing = false;

  const progress = () => {
    const d = video.duration;
    const p = d ? Math.min(1, video.currentTime / d) : 0;
    fill.style.transform = `scaleX(${p})`;
    const text = `${clock(video.currentTime)} / ${clock(d)}`;
    if (time.textContent !== text) time.textContent = text;
    line.setAttribute("aria-valuenow", String(Math.round(p * 100)));
    line.setAttribute("aria-valuetext", text);
  };
  const loop = () => {
    progress();
    raf = !video.paused || scrubbing ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => {
    progress();
    if (!raf) raf = requestAnimationFrame(loop);
  };
  const labels = () => {
    const paused = video.paused;
    wrap.classList.toggle("is-paused", paused);
    play.textContent = paused ? "play" : "pause";
    play.setAttribute("aria-label", paused ? "Play" : "Pause");
    sound.textContent = video.muted ? "sound off" : "sound on";
    sound.setAttribute("aria-label", video.muted ? "Turn sound on" : "Turn sound off");
    const fs = document.fullscreenElement === wrap;
    full.textContent = fs ? "exit fullscreen" : "fullscreen";
  };
  const wake = () => {
    wrap.classList.add("is-ui");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!video.paused && !wrap.matches(":focus-within, .is-scrubbing")) wrap.classList.remove("is-ui");
    }, IDLE);
  };
  const toggle = () => {
    if (video.paused) {
      if (video.ended || (video.duration && video.currentTime >= video.duration - 0.05)) video.currentTime = 0;
      video.preload = "auto";
      video.play().catch(() => {});
    } else video.pause();
    wake();
  };

  on(video, "play", () => {
    labels();
    kick();
    wake();
  });
  on(video, "pause", () => {
    labels();
    progress();
    wrap.classList.add("is-ui");
  });
  on(video, "ended", labels);
  on(video, "volumechange", labels);
  ["loadedmetadata", "durationchange", "timeupdate", "seeked"].forEach((t) => on(video, t, progress));
  on(document, "fullscreenchange", labels);
  labels();
  progress();

  on(screen, "click", toggle);
  on(play, "click", toggle);
  on(sound, "click", () => {
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) video.volume = 1;
  });
  on(full, "click", () => {
    if (document.fullscreenElement === wrap) document.exitFullscreen();
    else if (wrap.requestFullscreen) wrap.requestFullscreen().catch(() => {});
    else video.webkitEnterFullscreen?.();
  });
  on(wrap, "pointermove", wake);
  on(wrap, "pointerdown", wake);
  on(wrap, "focusin", () => wrap.classList.add("is-ui"));

  // ── the line: click / drag to seek ──
  const seekTo = (x) => {
    const r = line.getBoundingClientRect();
    if (video.duration) video.currentTime = Math.min(1, Math.max(0, (x - r.left) / r.width)) * (video.duration - 0.05);
    progress();
  };
  on(line, "pointerdown", (e) => {
    if (e.button !== 0) return;
    e.stopPropagation(); // not a carousel drag
    scrubbing = true;
    wrap.classList.add("is-scrubbing", "is-ui");
    line.setPointerCapture(e.pointerId);
    seekTo(e.clientX);
    kick();
  });
  on(line, "pointermove", (e) => scrubbing && seekTo(e.clientX));
  const release = () => {
    scrubbing = false;
    wrap.classList.remove("is-scrubbing");
    wake();
  };
  on(line, "pointerup", release);
  on(line, "pointercancel", release);
  on(line, "click", (e) => e.stopPropagation());
  on(line, "keydown", (e) => {
    const d = video.duration;
    if (!d) return;
    const step = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5 }[e.key];
    if (step != null) video.currentTime = Math.min(d - 0.05, Math.max(0, video.currentTime + step));
    else if (e.key === "Home") video.currentTime = 0;
    else if (e.key === "End") video.currentTime = d - 0.05;
    else return;
    e.preventDefault();
    e.stopPropagation();
    progress();
  });

  // ── wheel: scrub the film while it plays ──
  const apply = () => {
    if (video.seeking) return void (raf2 = requestAnimationFrame(apply)); // one seek at a time
    raf2 = 0;
    const d = video.duration;
    if (!d || !pending) return;
    video.currentTime = Math.min(d - 0.05, Math.max(0, video.currentTime + pending));
    pending = 0;
    progress();
  };
  let raf2 = 0;
  on(
    wrap,
    "wheel",
    (e) => {
      if (e.ctrlKey || !video.duration) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerWidth : 1;
      // Sideways only (shift + wheel counts too): a vertical scroll stays a page scroll.
      const dx = (e.deltaX || (e.shiftKey ? e.deltaY : 0)) * unit;
      if (!dx || (!e.shiftKey && Math.abs(e.deltaX) < Math.abs(e.deltaY))) return;
      // In a carousel a paused film lets the swipe move the carousel; at either end too.
      if (video.paused && wrap.closest(".video-track")) return;
      if (dx > 0 && video.currentTime >= video.duration - 0.2) return;
      if (dx < 0 && video.currentTime <= 0.05) return;
      e.preventDefault();
      pending += dx * WHEEL;
      wake();
      if (!raf2) raf2 = requestAnimationFrame(apply);
    },
    { passive: false },
  );

  signal.addEventListener("abort", () => {
    cancelAnimationFrame(raf);
    cancelAnimationFrame(raf2);
    clearTimeout(hideTimer);
  });
}

// Upgrades every player inside `root`; returns a cleanup for when the page is replaced.
export function bindPlayers(root) {
  const ac = new AbortController();
  root.querySelectorAll(".player").forEach((wrap) => upgrade(wrap, ac.signal));
  return () => ac.abort();
}
