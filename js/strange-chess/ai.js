// The boss's mind: minimax with alpha–beta pruning over the very same rules (rules.js), so it
// knows every special move — pushes, the bishop's bounce, the knight's mirror, the wind's drift,
// erosion, the bosses' own rules. Iterative deepening: depth 2 always, 3 when time allows.
// Runs in a Web Worker (ai-worker.js) so the meadow never stutters.
//
// The evaluation, from the boss's side: the scale, the material still on the board, how exposed
// each piece is to holes and to the coming wind, how far each King is from a hole and the edge,
// and a small bias per boss so they play differently.
import * as R from "./rules.js";

const WIN = 100000;
// Per-boss leanings.
//   trapper:    patient, likes your pieces in the middle rows (his traps), keeps his own back
//   angler:     loves your pieces next to holes and close to his side (his line drags them in)
//   prospector: slow and defensive: guards his pieces, rarely advances
//   woodcarver: aggressive; in the Moon phase guards the Moon above all
export const BIAS = {
  null: { scale: 100, material: 22, danger: 1, advance: 4, lure: 0, middle: 0 },
  trapper: { scale: 100, material: 22, danger: 1, advance: 2, lure: 0, middle: 10 },
  angler: { scale: 100, material: 20, danger: 1, advance: 4, lure: 16, middle: 0 },
  prospector: { scale: 90, material: 30, danger: 1.6, advance: -3, lure: 0, middle: 0 },
  woodcarver: { scale: 115, material: 20, danger: 1.1, advance: 7, lure: 6, middle: 0 },
};

const sq = (x, y) => y * 6 + x;
const inB = (x, y) => x >= 0 && y >= 0 && x < 6 && y < 6;
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Score of a state for `side` (positive = good for side).
export function evaluate(s, side = "b", bias = BIAS[s.boss] || BIAS.null) {
  if (s.result) return (s.result.winner === side ? 1 : -1) * WIN;
  const sign = side === "b" ? 1 : -1;
  let v = -s.scale * bias.scale; // from the boss's side: the scale counts against him when positive
  const hole = (x, y) => inB(x, y) && s.integ[sq(x, y)] <= 0;
  const edgeOff = (x, y) => !inB(x, y);
  let wind = s.wind && s.wind.dir && s.wind.at === s.round ? R.DIRS[s.wind.dir] : null;
  for (const p of s.pieces) {
    if (!p.side) continue;
    const own = p.side === "b" ? 1 : -1; // + for the boss's pieces
    const val = p.t === "M" ? 12 : R.valueOf(p);
    v += own * val * bias.material;
    // danger: holes beside it (a push away), weak ground under it, the coming gust
    let danger = 0;
    for (const [dx, dy] of ORTHO) {
      if (hole(p.x + dx, p.y + dy)) danger += 0.5;
      if (p.t === "K" && edgeOff(p.x + dx, p.y + dy)) danger += 0.25;
    }
    const ground = s.integ[sq(p.x, p.y)];
    if (ground === 1) danger += 0.3;
    if (wind && p.t !== "M" && p.t !== "G" && !R.hasSig(p, "rooted")) {
      const nx = p.x + wind[0],
        ny = p.y + wind[1];
      if (hole(nx, ny)) danger += 3;
      else if (!inB(nx, ny) && s.config.windOffEdge) danger += 3;
    }
    if (p.t === "K") danger *= 3; // a King in a hole ends everything
    if (p.t === "M") {
      // the Moon falls if pushed so that any cell meets a hole or the edge
      for (const [dx, dy] of ORTHO) {
        const cells = [[p.x + dx, p.y + dy], [p.x + 1 + dx, p.y + dy], [p.x + dx, p.y + 1 + dy], [p.x + 1 + dx, p.y + 1 + dy]];
        if (cells.some(([x, y]) => !inB(x, y) || hole(x, y))) danger += 2.5;
      }
    }
    v -= own * danger * Math.max(2, val) * 9 * (own > 0 ? bias.danger : 1);
    // advancement (boss pieces moving down the board), and his leanings about your pieces
    if (p.t === "P") v += own * (p.side === "b" ? 5 - p.y : p.y) * bias.advance;
    if (p.side === "p") {
      let near = 0;
      for (const [dx, dy] of ORTHO) if (hole(p.x + dx, p.y + dy)) near++;
      v += near * bias.lure * Math.max(1, val);
      v += (p.y >= 3 ? 1 : 0) * bias.lure * 0.5 * val;
      if (bias.middle && (p.y === 2 || p.y === 3)) v += bias.middle;
    }
  }
  return sign * v;
}

function ordered(s, moves) {
  // captures and pushes first (most valuable victim first), then the rest
  const g = R.grid(s);
  return moves
    .map((m) => {
      let k = 0;
      if (m.kind === "cap") k = 100 + R.valueOf(g[sq(m.x, m.y)]) * 10;
      else if (m.kind === "push") k = 60;
      else if (m.mirror) k = 20;
      return [k, m];
    })
    .sort((a, b) => b[0] - a[0])
    .map((a) => a[1]);
}

// Negamax with alpha–beta: the value of s for the side to move in s. A child where the same side
// is to move again (a skipped turn, or the fight ended on this move) keeps the sign.
function search(s, depth, alpha, beta, bias, ctx) {
  if (++ctx.nodes % 256 === 0 && performance.now() > ctx.deadline) ctx.timeout = true;
  if (ctx.timeout) return 0;
  if (depth === 0 || s.result) return evaluate(s, s.turn, bias);
  let best = -Infinity;
  for (const m of ordered(s, R.legalMoves(s))) {
    const n = R.applyMove(s, m);
    const val = n.turn === s.turn ? search(n, depth - 1, alpha, beta, bias, ctx) : -search(n, depth - 1, -beta, -alpha, bias, ctx);
    if (val > best) best = val;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// The boss's (or any side's) move. opts: { maxDepth = 3, budget = 700 ms }.
export function chooseMove(s, opts = {}) {
  const side = s.turn;
  const bias = BIAS[s.boss] || BIAS.null;
  const moves = ordered(s, R.legalMoves(s));
  if (moves.length === 1) return { move: moves[0], depth: 0, nodes: 0 };
  const ctx = { nodes: 0, deadline: performance.now() + (opts.budget ?? 700), timeout: false };
  let bestMove = moves[0],
    bestDepth = 0;
  // a deterministic jitter so equal moves are not always resolved the same way
  const jitter = (m, i) => (((m.x * 31 + m.y * 17 + (m.id || 0) * 13 + s.round * 7 + i) % 11) - 5) * 0.4;
  for (let depth = 1; depth <= (opts.maxDepth ?? 3); depth++) {
    let alpha = -Infinity,
      best = null,
      bestVal = -Infinity;
    const scored = [];
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      const n = R.applyMove(s, m);
      const val = (n.turn === side ? search(n, depth - 1, alpha, Infinity, bias, ctx) : -search(n, depth - 1, -Infinity, -alpha, bias, ctx)) + jitter(m, i);
      if (ctx.timeout) break;
      scored.push([val, m]);
      if (val > bestVal) {
        bestVal = val;
        best = m;
      }
      if (val > alpha) alpha = val;
    }
    if (ctx.timeout && depth > 2) break;
    if (best) {
      bestMove = best;
      bestDepth = depth;
      // search the best line first next time
      moves.sort((a, b) => (a === best ? -1 : b === best ? 1 : 0));
    }
    if (ctx.timeout) break;
  }
  return { move: bestMove, depth: bestDepth, nodes: ctx.nodes };
}
