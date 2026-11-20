// The boss's mind: minimax with alpha-beta over the same move generator the player uses, so it
// knows every special rule (pushes, bounces, mirror teleports, drift, erosion, traps, the Moon).
// Runs inside a Web Worker (ai.worker.js); this file has no DOM, so the tests can run it too.
import { legalMoves, applyMove, passStuck, bodies, isHole, previewPush, cloneState, ix, xOf, yOf, VALUE, WIND_DIRS, moonOf, moonMode, N } from "./rules.js";

// Each boss plays a little differently. depth: plies searched. The rest weight the evaluation.
export const STYLE = {
  trapper: { depth: 2, material: 1.0, danger: 1.0, hunt: 0.6, advance: 0.5, trapBias: 1 },
  angler: { depth: 3, material: 1.0, danger: 1.0, hunt: 1.0, advance: 0.3, pull: 1 },
  prospector: { depth: 3, material: 1.4, danger: 1.5, hunt: 0.3, advance: -0.4, slow: 1 }, // patient, defensive
  woodcarver: { depth: 3, material: 1.1, danger: 1.2, hunt: 0.8, advance: 0.2, moon: 1 },
};
const MATE = 100000;

const nearestHole = (s, x, y) => {
  let best = 4;
  for (let i = 0; i < N * N; i++) {
    if (!isHole(s, i)) continue;
    const d = Math.max(Math.abs(xOf(i) - x), Math.abs(yOf(i) - y));
    if (d < best) best = d;
  }
  return best;
};
const edgeDist = (x, y) => Math.min(x, y, N - 1 - x, N - 1 - y);

// Higher is better for the boss (side 1).
export function evaluate(s, bossId = s.boss.id) {
  if (s.over) return s.over.winner === 1 ? MATE : -MATE;
  const st = STYLE[bossId] || STYLE.trapper;
  let v = -s.scale * 100;
  const warn = s.wind.warn;
  const wd = warn != null ? WIND_DIRS[warn] : null;
  const moon = moonMode(s) ? moonOf(s) : null;
  for (const { p, i } of bodies(s)) {
    if (p.t === "G") continue;
    const x = xOf(i),
      y = yOf(i);
    const mine = p.s === 1;
    const sign = mine ? 1 : -1;
    const val = p.t === "M" ? 12 : VALUE[p.t];
    v += sign * val * 8 * (mine ? st.material : 1);
    // standing next to a hole is dangerous (a push, a drift) ; edges are dangerous for kings
    const hd = p.t === "M" ? Math.min(nearestHole(s, x, y), nearestHole(s, x + 1, y + 1)) : nearestHole(s, x, y);
    if (hd <= 1) v -= sign * val * (mine ? 2.2 * st.danger : 1.6 * st.hunt);
    if (p.t === "K") v += sign * (Math.min(hd, 3) * 3 + edgeDist(x, y) * 2);
    if (p.t === "M") v += sign * Math.min(hd, 3) * 6;
    // wind: a piece that is about to drift into a hole
    if (wd && p.t !== "M" && p.t !== "G" && !p.g?.includes("rooted")) {
      const nx = x + wd[0],
        ny = y + wd[1];
      if (nx >= 0 && ny >= 0 && nx < N && ny < N && isHole(s, ix(nx, ny))) v -= sign * val * 14;
    }
    // how far a pawn has got
    if (p.t === "P") {
      const adv = mine ? y : N - 1 - y;
      v += sign * adv * st.advance;
    }
    // the Angler wants the player's pieces to hang over holes on its side
    if (st.pull && !mine && y > 0 && isHole(s, ix(x, y - 1))) v += val * 4;
    // the Trapper keeps the player's pieces from the safe rows
    if (st.trapBias && !mine && s.traps.length && s.traps.some((t) => Math.abs(xOf(t) - x) + Math.abs(yOf(t) - y) === 1)) v += 1.5;
    // the Moon's rows
    if (moon && !mine && p.t !== "G" && (y === moon.y || y === moon.y + 1)) v += val * 3;
  }
  return v;
}

function orderKey(s, m) {
  const t = s.cells[m.to];
  if (m.kind === "capture") return 20 + VALUE[t.t] * 2 - (VALUE[s.cells[m.from].t] || 0) * 0.1;
  if (m.kind === "push") {
    let k = 6;
    for (const b of previewPush(s, m)) if (b.falls) k += b.s === s.turn ? -8 : 8 + (VALUE[b.t] || 0);
    return k;
  }
  return 0;
}

class Timeout extends Error {}

export function chooseMove(s0, { depth, boss, rng, timeMs = 900 } = {}) {
  const bossId = boss || s0.boss.id;
  const st = STYLE[bossId] || STYLE.trapper;
  const maxDepth = depth ?? st.depth;
  const root = cloneState(s0);
  root.quiet = true;
  root.pending = null;
  const side = root.turn;
  const moves = legalMoves(root, side);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  const deadline = Date.now() + timeMs;
  let nodes = 0;
  const maxi = side === 1;

  const step = (s, m) => applyMove(s, m, { auto: true });
  function search(s, d, alpha, beta) {
    if (s.over || d === 0) return evaluate(s, bossId) * (1 - 0) - (s.over ? (s.over.winner === 1 ? -d : d) : 0);
    if ((++nodes & 255) === 0 && Date.now() > deadline) throw new Timeout();
    const ms = legalMoves(s, s.turn);
    if (!ms.length) return search(passStuck(s), d - 1, alpha, beta);
    ms.sort((a, b) => orderKey(s, b) - orderKey(s, a));
    if (s.turn === 1) {
      let best = -Infinity;
      for (const m of ms) {
        const r = search(step(s, m), d - 1, alpha, beta);
        if (r > best) best = r;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
      }
      return best;
    }
    let best = Infinity;
    for (const m of ms) {
      const r = search(step(s, m), d - 1, alpha, beta);
      if (r < best) best = r;
      if (best < beta) beta = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  let result = moves[0];
  // a little noise so that two equal moves do not always give the same game
  const jitter = () => (rng ? (rng() - 0.5) * 0.6 : 0);
  moves.sort((a, b) => orderKey(root, b) - orderKey(root, a));
  for (let d = 1; d <= maxDepth; d++) {
    let bestScore = maxi ? -Infinity : Infinity,
      bestMove = null,
      alpha = -Infinity,
      beta = Infinity;
    try {
      for (const m of moves) {
        const r = search(step(root, m), d - 1, alpha, beta) + jitter();
        if (maxi ? r > bestScore : r < bestScore) (bestScore = r), (bestMove = m);
        if (maxi) alpha = Math.max(alpha, bestScore);
        else beta = Math.min(beta, bestScore);
      }
      result = bestMove || result;
      if (Math.abs(bestScore) > MATE / 2) break; // a forced win or loss: no need to look further
    } catch (e) {
      if (e instanceof Timeout) break;
      throw e;
    }
  }
  return result;
}
