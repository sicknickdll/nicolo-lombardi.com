// Tiny animation clock for the Tarot Reader. Everything that moves runs on this clock, driven
// by the scene's render loop, so animations can be sped up (a click while she is busy plays
// the rest faster) and stop when the page is hidden.
export const ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  out: (t) => 1 - (1 - t) ** 3,
  in: (t) => t * t * t,
  outBack: (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2,
  sine: (t) => 0.5 - Math.cos(Math.PI * t) / 2,
};

export function createClock() {
  const jobs = new Set();
  const clock = {
    now: 0,
    scale: 1, // >1 while hurrying
    // Runs update(k) with k going 0 → 1 over `duration` ms (eased). Resolves when done.
    tween(duration, update, { ease: e = ease.inOut, delay = 0 } = {}) {
      return new Promise((resolve) => {
        const job = { t: -delay, duration: Math.max(1, duration), update, e, resolve };
        jobs.add(job);
        if (duration <= 0 && delay <= 0) step(job, 0);
      });
    },
    wait(ms) {
      return clock.tween(ms, () => {}, { ease: ease.linear });
    },
    tick(dtMs) {
      const dt = dtMs * clock.scale;
      clock.now += dt;
      for (const job of [...jobs]) step(job, dt);
    },
    // Finishes everything at once (used when leaving the page).
    flush() {
      for (const job of [...jobs]) step(job, Infinity);
    },
    get busy() {
      return jobs.size > 0;
    },
  };
  function step(job, dt) {
    job.t += dt;
    if (job.t < 0) return;
    const k = Math.min(1, job.t / job.duration);
    job.update(job.e(k), k);
    if (k >= 1) {
      jobs.delete(job);
      job.resolve();
    }
  }
  return clock;
}

// Exponential smoothing that doesn't depend on the frame rate: x moves toward `to`.
export const approach = (x, to, speed, dt) => x + (to - x) * (1 - Math.exp(-speed * dt));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
// Smooth 1D noise (sum of sines), for flicker and breathing.
export const wobble = (t, seed = 0) =>
  (Math.sin(t * 1.7 + seed) * 0.5 + Math.sin(t * 2.9 + seed * 1.3) * 0.3 + Math.sin(t * 7.3 + seed * 2.1) * 0.2);
