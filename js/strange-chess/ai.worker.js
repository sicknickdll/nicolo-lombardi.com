// Web Worker: thinks about the boss's move so that drawing never stutters.
import { chooseMove } from "./ai.js";
import { makeRng } from "./rng.js";
self.onmessage = (e) => {
  const { id, state, boss, depth, seed, timeMs } = e.data;
  let move = null;
  try {
    move = chooseMove(state, { boss, depth, rng: makeRng(seed), timeMs });
  } catch (err) {
    move = null;
  }
  self.postMessage({ id, move });
};
