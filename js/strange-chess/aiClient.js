// Asks the boss for a move. The search runs in a Web Worker so drawing never stutters; if a worker
// cannot be made it runs here instead. A short fake "thinking" pause (400–900 ms) is added for feel.
/* global __CHESS_WORKER__ */
export function createAI() {
  let worker = null,
    id = 0;
  const waiting = new Map();
  try {
    const url = typeof __CHESS_WORKER__ !== "undefined" ? __CHESS_WORKER__ : new URL("./ai.worker.js", import.meta.url);
    worker = new Worker(url, typeof __CHESS_WORKER__ !== "undefined" ? undefined : { type: "module" });
    worker.onmessage = (e) => {
      const w = waiting.get(e.data.id);
      if (w) (waiting.delete(e.data.id), w(e.data.move));
    };
    worker.onerror = () => {
      worker = null;
      for (const w of waiting.values()) w(undefined);
      waiting.clear();
    };
  } catch {
    worker = null;
  }
  const local = async (state, opts) => {
    const [{ chooseMove }, { makeRng }] = await Promise.all([import("./ai.js"), import("./rng.js")]);
    return chooseMove(state, { boss: opts.boss, depth: opts.depth, timeMs: opts.timeMs, rng: makeRng(opts.seed) });
  };
  const think = async (state, opts) => {
    const t0 = performance.now();
    const minMs = opts.minMs ?? 400 + Math.random() * 500;
    let move;
    if (worker) {
      move = await new Promise((res) => {
        const n = ++id;
        waiting.set(n, res);
        worker.postMessage({ id: n, state, boss: opts.boss, depth: opts.depth, seed: opts.seed, timeMs: opts.timeMs ?? 900 });
        setTimeout(() => waiting.has(n) && (waiting.delete(n), res(undefined)), 6000);
      });
    }
    if (move === undefined) move = await local(state, opts);
    const rest = minMs - (performance.now() - t0);
    if (rest > 0) await new Promise((r) => setTimeout(r, rest));
    return move;
  };
  return { think, close: () => worker?.terminate() };
}
