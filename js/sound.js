// Small interface sounds (assets/sounds): "hover" on the menu links, "loaded" during an Archive
// collection's loading screen, "timepass" each time the clock completes a minute.
// Played through the Web Audio API so quick repeats never cut a sound off with a click: every play
// fades in and out over a few milliseconds, a sound that is still ringing fades out before the next one
// starts, repeats closer than a minimum gap are skipped, and a limiter keeps overlaps from distorting.
// Browsers only allow sound after the visitor has interacted with the page; until then play() does
// nothing, silently.
const Ctx = window.AudioContext || window.webkitAudioContext;
let ctx, bus;
const buffers = new Map(); // name → decoded AudioBuffer (or the pending promise)
const voices = new Map(); // name → { src, gain } still playing
const lastAt = new Map();
const MIN_GAP = { hover: 90 }; // ms; sounds not listed may repeat freely

function context() {
  if (!Ctx) return null;
  if (!ctx) {
    ctx = new Ctx();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    limiter.connect(ctx.destination);
    bus = limiter;
  }
  return ctx;
}
function load(name) {
  if (!buffers.has(name))
    buffers.set(
      name,
      fetch(`/assets/sounds/${name}.mp3`)
        .then((r) => r.arrayBuffer())
        .then((data) => new Promise((ok, fail) => ctx.decodeAudioData(data, ok, fail)))
        .then((b) => (buffers.set(name, b), b))
        .catch(() => (buffers.delete(name), null)),
    );
  return buffers.get(name);
}
// Fetch and decode a sound ahead of time (call it from a click, so the audio context may start).
export function preload(name) {
  if (context()) {
    ctx.resume().catch(() => {});
    load(name);
  }
}
export function play(name, volume = 0.6) {
  if (document.hidden) return;
  const c = context();
  if (!c) return;
  const now = performance.now();
  if (now - (lastAt.get(name) ?? -1e9) < (MIN_GAP[name] ?? 0)) return;
  lastAt.set(name, now);
  if (c.state === "suspended") c.resume().catch(() => {});
  const buffer = buffers.get(name);
  // Not decoded yet (first use): wait for it, then play.
  if (buffer instanceof AudioBuffer) start(name, buffer, volume);
  else load(name).then((b) => b && start(name, b, volume));
}
function start(name, buffer, volume) {
  const t = ctx.currentTime;
  // The previous copy of this sound fades out quickly instead of being cut.
  const old = voices.get(name);
  if (old) {
    old.gain.gain.cancelScheduledValues(t);
    old.gain.gain.setValueAtTime(old.gain.gain.value, t);
    old.gain.gain.linearRampToValueAtTime(0, t + 0.02);
    old.src.stop(t + 0.03);
  }
  const src = ctx.createBufferSource(),
    gain = ctx.createGain();
  src.buffer = buffer;
  const fadeOut = Math.min(0.04, buffer.duration / 4);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.006);
  gain.gain.setValueAtTime(volume, t + buffer.duration - fadeOut);
  gain.gain.linearRampToValueAtTime(0, t + buffer.duration);
  src.connect(gain).connect(bus);
  src.onended = () => voices.get(name)?.src === src && voices.delete(name);
  voices.set(name, { src, gain });
  src.start(t);
}
