// The boss thinks here, off the main thread: { state, opts } in, { move, depth, nodes } out.
import { chooseMove } from "./ai.js";
self.onmessage = (e) => {
  const { id, state, opts } = e.data;
  try {
    self.postMessage({ id, ...chooseMove(state, opts) });
  } catch (err) {
    self.postMessage({ id, error: String((err && err.stack) || err) });
  }
};
