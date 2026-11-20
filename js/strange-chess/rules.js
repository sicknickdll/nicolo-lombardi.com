// ─────────────────────────────────────────────────────────────────────────────
// STRANGE CHESS: the rules. Pure and deterministic: every function takes a plain, serialisable
// state object and returns a new one (the input is never changed); all randomness comes from the
// seeded RNG kept in state.rng. The renderer animates state.events (what the last action did),
// and the AI (ai.js) searches with the very same functions, so it knows every special rule.
//
// Board 6 × 6, x 0..5 left to right, y 0..5 from the player's back rank (bottom) to the boss's.
//
// Where the written brief was broken or silent, the rule chosen here (see README):
//   · Layout: R N Q B K R on the player's back rank, the boss's the same rotated 180°, so the
//     Glitch knights mirror onto each other (guarded by their queens) instead of onto a king.
//   · Phase 2 is checked at the end of a round (after the boss's reply and the round's events),
//     so a guarded opening trade does not skip phase 1.
//   · Wind: the board's edge blocks drift by default (config.windOffEdge = true restores the
//     literal "blown off the edge" rule); a hole downwind still swallows the piece.
//   · Rook push: the rook must cross at least one empty square before it hits a piece.
//   · The Moon phase: the scale can no longer win the fight (+5 does nothing), only the Moon's
//     fall can; the boss still wins at −5, and at round 40. The Moon's row attack is announced a
//     round ahead and the Moon cannot move while it charges, so the warned rows are the rows hit.
//   · Pushing your own piece into a hole or off the board scores nothing for either side.
//   · The Woodcarver can't be beaten on the scale: +5 in his phase 1 only raises the Moon.
// ─────────────────────────────────────────────────────────────────────────────
import { rand } from "./rng.js";

export const N = 6;
export const VALUE = { P: 1, N: 3, B: 3, R: 4, Q: 5, K: 5, G: 0, M: 0 };
export const NAMES = { P: "Pawn", N: "Knight", B: "Bishop", R: "Rook", Q: "Queen", K: "King", G: "Gold", M: "The Moon" };
export const WIN_AT = 5;
export const PHASE_AT = 3;
export const MAX_ROUNDS = 40;
export const WIND_EVERY = 3;
export const DIRS = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] }; // N = toward the boss
export const BOSSES = ["trapper", "angler", "prospector", "woodcarver"];
export const SIGILS = ["pusher", "rooted", "ghost"];
// The army: slot → [type, x, y] for the player; the boss's piece in the same slot stands at
// (5 − x, 5 − y).
export const BACK_RANK = ["R", "N", "Q", "B", "K", "R"];
export const SLOTS = [...BACK_RANK.map((t, x) => [t, x, 0]), ...Array.from({ length: 6 }, (_, x) => ["P", x, 1])];

const inB = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
const sq = (x, y) => y * N + x;
const other = (s) => (s === "p" ? "b" : "p");
const fwd = (s) => (s === "p" ? 1 : -1);
const cellsOf = (p) => (p.t === "M" ? [[p.x, p.y], [p.x + 1, p.y], [p.x, p.y + 1], [p.x + 1, p.y + 1]] : [[p.x, p.y]]);
export const valueOf = (p) => (p.bait ? 0 : VALUE[p.t]);
export const hasSig = (p, s) => !!(p.sig && p.sig.includes(s));

// ── state ──
export function clone(s) {
  return {
    ...s,
    pieces: s.pieces.map((p) => ({ ...p, sig: p.sig ? p.sig.slice() : [] })),
    integ: s.integ.slice(),
    traps: s.traps.map((t) => ({ ...t })),
    lost: { p: s.lost.p.slice(), b: s.lost.b.slice() },
    skip: { ...s.skip },
    wind: { ...s.wind },
    moon: s.moon ? { ...s.moon, rows: s.moon.rows ? s.moon.rows.slice() : null } : null,
    mask: s.mask ? { ...s.mask, used: s.mask.used.slice() } : null,
    config: s.config,
    events: [],
    result: s.result,
  };
}
export function grid(s) {
  const g = new Array(N * N).fill(null);
  for (const p of s.pieces) for (const [x, y] of cellsOf(p)) if (inB(x, y)) g[sq(x, y)] = p;
  return g;
}
export const pieceAt = (s, x, y) => (inB(x, y) ? grid(s)[sq(x, y)] : null);
export const isHole = (s, x, y) => s.integ[sq(x, y)] <= 0;
export const byId = (s, id) => s.pieces.find((p) => p.id === id);
function random(s) {
  const [v, n] = rand(s.rng);
  s.rng = n;
  return v;
}
function shuffled(s, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A fresh fight. army: the player's surviving slots [{ slot, sig: [] }] (default: all twelve).
// boss: null for a plain game (hot seat / no boss rules), or one of BOSSES.
export function newFight({ seed = 1, boss = null, army = null, config = {} } = {}) {
  const s = {
    v: 1,
    seed,
    rng: seed >>> 0 || 1,
    boss,
    config: { windOffEdge: false, wind: true, ...config },
    pieces: [],
    integ: new Array(N * N).fill(4),
    turn: "p",
    round: 1,
    scale: 0,
    phase: 1,
    traps: [],
    wind: { dir: null, at: WIND_EVERY, last: null },
    lost: { p: [], b: [] },
    skip: { p: 0, b: 0 },
    moon: null,
    mask: null,
    trade: null, // the Trader's offer: null, "open", "done"
    nextId: 1,
    events: [],
    result: null,
  };
  const slots = army || SLOTS.map((_, slot) => ({ slot, sig: [] }));
  for (const a of slots) {
    const [t, x, y] = SLOTS[a.slot];
    s.pieces.push({ id: s.nextId++, t, side: "p", x, y, slot: a.slot, sig: (a.sig || []).slice() });
  }
  SLOTS.forEach(([t, x, y], slot) => s.pieces.push({ id: s.nextId++, t, side: "b", x: N - 1 - x, y: N - 1 - y, slot, sig: [] }));
  if (boss === "woodcarver") {
    const first = shuffled(s, ["trapper", "angler", "prospector"])[0];
    s.mask = { now: first, used: [first] };
  }
  if (rule1(s) === "trapper") placeTraps(s);
  return s;
}
// the phase-1 rule in force (the Woodcarver wears another boss's mask)
export const rule1 = (s) => (s.boss === "woodcarver" ? s.mask && s.mask.now : s.boss);

function placeTraps(s) {
  const g = grid(s);
  const free = [];
  for (let y = 2; y <= 3; y++) for (let x = 0; x < N; x++) if (!g[sq(x, y)] && !isHole(s, x, y) && !s.traps.some((t) => t.x === x && t.y === y)) free.push([x, y]);
  for (const [x, y] of shuffled(s, free).slice(0, 3)) s.traps.push({ x, y });
  s.events.push({ type: "traps", n: Math.min(3, free.length) });
}

// ── move generation ──
// A move: { id, x, y, kind } with kind "move" (to an empty square), "cap" (take the enemy there),
// "push" (move into the piece there and shove it and everything behind it one square along
// dx, dy), or { kind: "pass" } when a side must skip.
export function legalMoves(s, side = s.turn) {
  if (s.result) return [];
  if (s.skip[side] > 0) return [{ kind: "pass" }];
  const g = grid(s);
  const out = [];
  for (const p of s.pieces) if (p.side === side) genPiece(s, g, p, out);
  if (!out.length) out.push({ kind: "pass" });
  return out;
}
export function movesFor(s, id) {
  const p = byId(s, id);
  if (!p || p.side !== s.turn || s.result || s.skip[p.side] > 0) return [];
  const out = [];
  genPiece(s, grid(s), p, out);
  return out;
}
const canCapture = (p, q) => q && q.side && q.side !== p.side && q.t !== "M" && q.t !== "G";
const KING_STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function genPiece(s, g, p, out) {
  if (p.bait || p.t === "G") return;
  const push = (x, y, dx, dy) => {
    const ch = pushChain(s, g, g[sq(x, y)], dx, dy, p);
    if (ch) out.push({ id: p.id, x, y, kind: "push", dx, dy });
  };
  const pusher = hasSig(p, "pusher");
  const step = (x, y, dx, dy) => {
    if (!inB(x, y) || isHole(s, x, y)) return;
    const q = g[sq(x, y)];
    if (!q) out.push({ id: p.id, x, y, kind: "move" });
    else if (q.side !== p.side && q.side) {
      if (canCapture(p, q)) out.push({ id: p.id, x, y, kind: "cap" });
      if (pusher) push(x, y, dx, dy);
    }
  };
  switch (p.t) {
    case "P": {
      const f = fwd(p.side);
      if (inB(p.x, p.y + f) && !isHole(s, p.x, p.y + f) && !g[sq(p.x, p.y + f)]) out.push({ id: p.id, x: p.x, y: p.y + f, kind: "move" });
      for (const dx of [-1, 1]) {
        const x = p.x + dx,
          y = p.y + f;
        if (!inB(x, y) || isHole(s, x, y)) continue;
        const q = g[sq(x, y)];
        if (canCapture(p, q)) out.push({ id: p.id, x, y, kind: "cap" });
        if (pusher && q && q.side && q.side !== p.side) push(x, y, dx, f);
      }
      break;
    }
    case "N": {
      // Glitch: teleport to the square mirrored through the centre (capture an enemy there; a
      // friend, a hole, the Moon or gold make it illegal) — or one king step.
      const mx = N - 1 - p.x,
        my = N - 1 - p.y;
      if (!isHole(s, mx, my)) {
        const q = g[sq(mx, my)];
        if (!q) out.push({ id: p.id, x: mx, y: my, kind: "move", mirror: true });
        else if (canCapture(p, q)) out.push({ id: p.id, x: mx, y: my, kind: "cap", mirror: true });
      }
      for (const [dx, dy] of KING_STEPS) if (!(p.x + dx === mx && p.y + dy === my)) step(p.x + dx, p.y + dy, dx, dy);
      break;
    }
    case "K":
      for (const [dx, dy] of KING_STEPS) step(p.x + dx, p.y + dy, dx, dy);
      break;
    case "B":
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) slide(s, g, p, dx, dy, true, out);
      break;
    case "R":
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) slide(s, g, p, dx, dy, false, out);
      break;
    case "Q":
      for (const [dx, dy] of KING_STEPS) slide(s, g, p, dx, dy, false, out);
      break;
    case "M":
      if (s.moon && s.moon.charging) break; // the Moon is still while it charges its attack
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let ok = true;
        for (const [cx, cy] of cellsOf({ t: "M", x: p.x + dx, y: p.y + dy })) {
          if (!inB(cx, cy) || isHole(s, cx, cy)) ok = false;
          else {
            const q = g[sq(cx, cy)];
            if (q && q !== p) ok = false;
          }
        }
        if (ok) out.push({ id: p.id, x: p.x + dx, y: p.y + dy, kind: "move" });
      }
      break;
  }
  // dedupe (a bishop can reach a square by two paths)
  const seen = new Set();
  for (let i = out.length - 1; i >= 0; i--) {
    const m = out[i];
    if (m.id !== p.id) break;
    const k = m.x + "," + m.y + m.kind + (m.dx ?? "") + (m.dy ?? "");
    if (seen.has(k)) out.splice(i, 1);
    else seen.add(k);
  }
}

// Sliding: the rook (Bulldozer: never captures, pushes after at least one empty square), the
// bishop (Light ray: bounces once off an edge), the queen; Ghost passes through one piece.
function slide(s, g, p, dx, dy, bounce, out) {
  let x = p.x,
    y = p.y,
    steps = 0,
    bounced = !bounce,
    ghost = hasSig(p, "ghost");
  const pusher = hasSig(p, "pusher");
  for (let guard = 0; guard < 24; guard++) {
    let nx = x + dx,
      ny = y + dy;
    if (!inB(nx, ny)) {
      if (bounced) return;
      // reflect the component(s) that would leave the board
      if (nx < 0 || nx >= N) dx = -dx;
      if (ny < 0 || ny >= N) dy = -dy;
      bounced = true;
      nx = x + dx;
      ny = y + dy;
      if (!inB(nx, ny)) return;
    }
    if (isHole(s, nx, ny)) return;
    const q = g[sq(nx, ny)];
    if (q && q !== p) {
      if (p.t === "R") {
        if (steps >= 1 && pushChain(s, g, q, dx, dy, p)) out.push({ id: p.id, x: nx, y: ny, kind: "push", dx, dy });
      } else {
        if (canCapture(p, q)) out.push({ id: p.id, x: nx, y: ny, kind: "cap" });
        if (pusher && q.side && q.side !== p.side && pushChain(s, g, q, dx, dy, p)) out.push({ id: p.id, x: nx, y: ny, kind: "push", dx, dy });
      }
      if (ghost) {
        ghost = false;
        x = nx;
        y = ny;
        steps++;
        continue;
      }
      return;
    }
    if (!(nx === p.x && ny === p.y)) out.push({ id: p.id, x: nx, y: ny, kind: "move" });
    x = nx;
    y = ny;
    steps++;
  }
}

// The pieces a push moves: the one hit and every piece behind it along (dx, dy) (the Moon is
// two cells wide, so it can drag two lines). null if the chain hits immovable gold.
export function pushChain(s, g, first, dx, dy, pusher = null) {
  if (!first) return null;
  const set = [first];
  for (let i = 0; i < set.length; i++) {
    const m = set[i];
    if (m.t === "G") return null;
    for (const [cx, cy] of cellsOf(m)) {
      const nx = cx + dx,
        ny = cy + dy;
      if (!inB(nx, ny)) continue;
      const q = g[sq(nx, ny)];
      if (q && q !== pusher && !set.includes(q)) set.push(q);
    }
  }
  return set;
}

// ── applying a move ──
export function applyMove(s0, m) {
  const s = clone(s0);
  if (s.result) return s;
  const side = s.turn;
  if (m.kind === "pass") {
    if (s.skip[side] > 0) s.skip[side]--;
    s.events.push({ type: "pass", side });
  } else {
    const p = byId(s, m.id);
    if (!p || p.side !== side) throw new Error("not your piece");
    const from = { x: p.x, y: p.y };
    const g = grid(s);
    const target = g[sq(m.x, m.y)];
    if (m.kind === "cap") {
      destroy(s, target, "capture", side, p.id);
      if (target.bait) {
        s.skip[side]++; // the bait costs the next turn
        s.events.push({ type: "hooked", id: p.id });
      }
    }
    const left = cellsOf(p);
    if (m.kind === "push") {
      const chain = pushChain(s, g, target, m.dx, m.dy, p);
      p.x = m.x;
      p.y = m.y;
      s.events.push({ type: "move", id: p.id, from, to: { x: p.x, y: p.y }, mirror: !!m.mirror });
      shove(s, chain, m.dx, m.dy, side, p.id);
    } else {
      // the Moon moves its whole 2 × 2 body
      p.x = m.x;
      p.y = m.y;
      s.events.push({ type: "move", id: p.id, from, to: { x: p.x, y: p.y }, mirror: !!m.mirror });
    }
    // erosion: the squares it left (for the Moon, those it no longer covers)
    const now = cellsOf(p).map(([x, y]) => sq(x, y));
    for (const [x, y] of left) if (!now.includes(sq(x, y))) erode(s, x, y);
    trapCheck(s, p);
    settle(s, side);
    promote(s);
  }
  check(s);
  if (s.result) return s;
  if (side === "b") endRound(s);
  else s.turn = "b";
  return s;
}

// Move every piece of a push chain one square; those that leave the board or land in a hole
// are destroyed (scored for the pusher if they were enemies), the Moon falls.
function shove(s, chain, dx, dy, bySide, byId) {
  const moved = [];
  for (const m of chain) {
    const from = { x: m.x, y: m.y };
    const dest = cellsOf({ t: m.t, x: m.x + dx, y: m.y + dy });
    const falls = dest.some(([x, y]) => !inB(x, y) || isHole(s, x, y));
    const left = cellsOf(m);
    m.x += dx;
    m.y += dy;
    s.events.push({ type: "pushed", id: m.id, from, to: { x: m.x, y: m.y }, falls });
    moved.push({ m, left, falls });
  }
  for (const { m, left, falls } of moved) {
    const now = cellsOf(m).map(([x, y]) => sq(x, y));
    // every square a piece leaves loses integrity, even if the piece behind steps onto it
    for (const [x, y] of left) if (inB(x, y) && !now.includes(sq(x, y))) erode(s, x, y);
    if (falls) fall(s, m, bySide, byId);
  }
  for (const { m, falls } of moved) if (!falls && s.pieces.includes(m)) trapCheck(s, m);
  settle(s, bySide);
}

function erode(s, x, y) {
  const k = sq(x, y);
  if (s.integ[k] <= 0) return;
  s.integ[k]--;
  s.events.push({ type: "erode", x, y, integ: s.integ[k] });
}
// a piece goes into a hole or off the board
function fall(s, p, bySide, byId) {
  if (p.t === "M") {
    remove(s, p);
    s.events.push({ type: "moonFalls", id: p.id });
    s.result = { winner: "p", reason: "moon" };
    return;
  }
  if (p.t === "K") s.kingFell = (s.kingFell || "") + p.side;
  destroy(s, p, "fall", bySide && bySide !== p.side ? bySide : null, byId);
}
// pieces standing on a square that has just become a hole fall in
function settle(s, bySide) {
  for (const p of s.pieces.slice()) if (p.t !== "M" && inB(p.x, p.y) && isHole(s, p.x, p.y)) fall(s, p, bySide, null);
}
function remove(s, p) {
  const i = s.pieces.indexOf(p);
  if (i >= 0) s.pieces.splice(i, 1);
}
// Destroy a piece. by: the side credited on the scale (null: nobody, as for the wind).
function destroy(s, p, cause, by, byId = null) {
  remove(s, p);
  if (p.side === "p" || p.side === "b") s.lost[p.side].push({ t: p.t, slot: p.slot, sig: p.sig || [] });
  let pts = 0;
  if (by && by !== p.side && p.side) {
    pts = valueOf(p);
    s.scale += by === "p" ? pts : -pts;
  }
  s.events.push({ type: "destroy", id: p.id, t: p.t, side: p.side, x: p.x, y: p.y, cause, by, byId, pts });
}
function trapCheck(s, p) {
  if (p.t === "M" || p.t === "G") return;
  const i = s.traps.findIndex((t) => t.x === p.x && t.y === p.y);
  if (i < 0) return;
  s.traps.splice(i, 1);
  s.events.push({ type: "trap", x: p.x, y: p.y, id: p.id });
  // the Trapper's iron: the boss scores your pieces it catches (and you score his)
  destroy(s, p, "trap", other(p.side));
}
function promote(s) {
  for (const p of s.pieces)
    if (p.t === "P" && !p.bait && ((p.side === "p" && p.y === N - 1) || (p.side === "b" && p.y === 0))) {
      p.t = "Q";
      s.events.push({ type: "promote", id: p.id });
    }
}

// Win conditions, checked after every action.
function check(s) {
  if (s.result) return;
  if (s.kingFell) {
    // a King in a hole or off the board ends the fight; both at once is the boss's (as a tie is)
    s.result = { winner: s.kingFell.includes("p") ? "b" : "p", reason: "king" };
    delete s.kingFell;
    return;
  }
  // the final fight can't be won on the scale: the Woodcarver always shows the Moon (at +5 in
  // his phase 1 it rises at the end of the round), and in the Moon phase only its fall wins
  const noScaleWin = s.boss === "woodcarver";
  if (s.scale <= -WIN_AT) s.result = { winner: "b", reason: "scale" };
  else if (s.scale >= WIN_AT && !noScaleWin) s.result = { winner: "p", reason: "scale" };
  else if (!s.pieces.some((p) => p.side === "p")) s.result = { winner: "b", reason: "army" };
  else if (!s.pieces.some((p) => p.side === "b" && !p.bait)) s.result = { winner: "p", reason: "army" };
}

// ── the end of a round (after the boss's move): boss rules, wind, telegraphs, phase change ──
function endRound(s) {
  const r = s.round;
  bossRules(s, r);
  if (s.result) return;
  if (s.wind.dir && s.wind.at === r) blow(s);
  if (s.result) return;
  // telegraph the next gust one round ahead
  if (s.config.wind !== false && (r + 1) % WIND_EVERY === 0) {
    const dirs = Object.keys(DIRS);
    const d = dirs[Math.floor(random(s) * dirs.length)];
    s.wind.dir = d;
    s.wind.at = r + 1;
    s.events.push({ type: "windWarn", dir: d, at: r + 1 });
  }
  // phase 2: the first time the scale reaches +3, checked once the round is over
  if (s.boss && s.phase === 1 && s.scale >= PHASE_AT) phase2(s);
  check(s);
  if (s.result) return;
  if (r >= MAX_ROUNDS) {
    s.result = { winner: s.scale > 0 && !s.moon ? "p" : "b", reason: "time" };
    return;
  }
  s.round = r + 1;
  s.turn = "p";
}

// The gust on its own (pure), for tests and tools.
export function gust(s0) {
  const s = clone(s0);
  blow(s);
  return s;
}
function blow(s) {
  const [dx, dy] = DIRS[s.wind.dir];
  s.events.push({ type: "gust", dir: s.wind.dir });
  s.wind.last = s.wind.dir;
  s.wind.dir = null;
  // downwind pieces first, so a column moves together instead of blocking itself
  const order = s.pieces.filter((p) => p.t !== "M" && p.t !== "G" && !hasSig(p, "rooted")).sort((a, b) => b.x * dx + b.y * dy - (a.x * dx + a.y * dy));
  for (const p of order) {
    if (!s.pieces.includes(p)) continue;
    const nx = p.x + dx,
      ny = p.y + dy;
    if (!inB(nx, ny)) {
      if (!s.config.windOffEdge) continue; // the edge holds
      const from = { x: p.x, y: p.y };
      erode(s, p.x, p.y);
      p.x = nx;
      p.y = ny;
      s.events.push({ type: "drift", id: p.id, from, to: { x: nx, y: ny }, falls: true });
      fall(s, p, null, null);
      continue;
    }
    if (pieceAt(s, nx, ny)) continue;
    const from = { x: p.x, y: p.y };
    const hole = isHole(s, nx, ny);
    erode(s, p.x, p.y);
    p.x = nx;
    p.y = ny;
    s.events.push({ type: "drift", id: p.id, from, to: { x: nx, y: ny }, falls: hole });
    if (hole) fall(s, p, null, null);
    else trapCheck(s, p);
  }
  settle(s, null);
  check(s);
}

// ── the bosses ──
function bossRules(s, r) {
  if (!s.boss) return;
  // the Woodcarver changes mask once, at round 10
  if (s.boss === "woodcarver" && s.phase === 1 && r === 10 && s.mask.used.length === 1) {
    const next = shuffled(
      s,
      ["trapper", "angler", "prospector"].filter((b) => b !== s.mask.now),
    )[0];
    s.mask.now = next;
    s.mask.used.push(next);
    s.events.push({ type: "mask", mask: next });
    if (next === "trapper") placeTraps(s);
  }
  if (s.phase === 1) {
    const rule = rule1(s);
    if (rule === "angler" && r % 4 === 0) hook(s);
    if (rule === "prospector" && r % 3 === 0) pickaxe(s);
  } else {
    if (s.boss === "angler" && (r - s.phaseRound) % 4 === 0 && !s.pieces.some((p) => p.bait)) dropBait(s);
    if (s.boss === "prospector" && r % 3 === 0) pickaxe(s);
    if (s.boss === "woodcarver" && s.moon) moonTick(s, r);
  }
}
// The Angler hooks your most valuable piece (not the King) and drags it one square toward him.
function hook(s) {
  const mine = s.pieces.filter((p) => p.side === "p" && p.t !== "K");
  if (!mine.length) return;
  mine.sort((a, b) => valueOf(b) - valueOf(a) || b.y - a.y || a.x - b.x);
  const p = mine[0];
  const from = { x: p.x, y: p.y },
    nx = p.x,
    ny = p.y + 1;
  if (!inB(nx, ny) || pieceAt(s, nx, ny)) {
    s.events.push({ type: "hook", id: p.id, from, to: from, held: true });
    return;
  }
  const hole = isHole(s, nx, ny);
  erode(s, p.x, p.y);
  p.x = nx;
  p.y = ny;
  s.events.push({ type: "hook", id: p.id, from, to: { x: nx, y: ny }, falls: hole });
  if (hole) destroy(s, p, "fall", "b");
  else trapCheck(s, p);
  settle(s, "b");
}
// The Prospector turns your most advanced piece (not the King) into a block of gold.
function pickaxe(s) {
  const mine = s.pieces.filter((p) => p.side === "p" && p.t !== "K");
  if (!mine.length) return;
  mine.sort((a, b) => b.y - a.y || valueOf(b) - valueOf(a) || a.x - b.x);
  const p = mine[0];
  s.lost.p.push({ t: p.t, slot: p.slot, sig: p.sig || [] });
  s.events.push({ type: "gold", id: p.id, t: p.t, x: p.x, y: p.y });
  p.t = "G";
  p.side = null;
  p.sig = [];
}
function dropBait(s) {
  const g = grid(s);
  const near = [],
    any = [];
  for (let y = 1; y <= 3; y++)
    for (let x = 0; x < N; x++) {
      if (g[sq(x, y)] || isHole(s, x, y) || s.traps.some((t) => t.x === x && t.y === y)) continue;
      any.push([x, y]);
      // somewhere a piece of yours could take it
      if (s.pieces.some((p) => p.side === "p" && (Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1))) near.push([x, y]);
    }
  const pool = near.length ? near : any;
  if (!pool.length) return;
  const [x, y] = pool[Math.floor(random(s) * pool.length)];
  const b = { id: s.nextId++, t: "P", side: "b", x, y, slot: -1, sig: [], bait: true };
  s.pieces.push(b);
  s.events.push({ type: "bait", id: b.id, x, y });
}

function phase2(s) {
  s.phase = 2;
  s.phaseRound = s.round;
  s.events.push({ type: "phase", boss: s.boss });
  if (s.boss === "trapper") s.trade = s.lost.p.length ? "open" : "done";
  if (s.boss === "angler") dropBait(s);
  if (s.boss === "prospector") {
    const cells = [];
    for (const p of s.pieces.slice())
      if (p.t === "G") {
        cells.push({ x: p.x, y: p.y });
        remove(s, p);
        s.integ[sq(p.x, p.y)] = 0;
      }
    s.events.push({ type: "crack", cells });
  }
  if (s.boss === "woodcarver") raiseMoon(s);
}

// The Moon replaces the boss's King: a 2 × 2 piece on the free block nearest the King.
function raiseMoon(s) {
  const king = s.pieces.find((p) => p.side === "b" && p.t === "K");
  const kx = king ? king.x : 2,
    ky = king ? king.y : 4;
  if (king) remove(s, king);
  const g = grid(s);
  let best = null;
  for (let y = 0; y < N - 1; y++)
    for (let x = 0; x < N - 1; x++) {
      const cells = cellsOf({ t: "M", x, y });
      if (cells.some(([cx, cy]) => isHole(s, cx, cy))) continue;
      const occ = cells.map(([cx, cy]) => g[sq(cx, cy)]).filter(Boolean);
      if (occ.some((q) => q.side !== "b" || q.t === "G")) continue;
      const cost = Math.abs(x + 0.5 - kx) + Math.abs(y + 0.5 - ky) + occ.length * 0.6 + (y < 2 ? 4 : 0);
      if (!best || cost < best.cost) best = { x, y, cost, occ };
    }
  if (!best) {
    // nowhere free of your pieces: the Moon still rises behind the boss's lines
    best = { x: 2, y: 4, occ: cellsOf({ t: "M", x: 2, y: 4 }).map(([cx, cy]) => g[sq(cx, cy)]).filter(Boolean) };
    for (const [cx, cy] of cellsOf({ t: "M", x: 2, y: 4 })) s.integ[sq(cx, cy)] = Math.max(1, s.integ[sq(cx, cy)]);
  }
  for (const q of best.occ) remove(s, q); // the boss's own pieces there are taken into the Moon
  const m = { id: s.nextId++, t: "M", side: "b", x: best.x, y: best.y, slot: -1, sig: [] };
  s.pieces.push(m);
  s.moon = { id: m.id, charging: false, rows: null, since: s.round };
  s.events.push({ type: "moonRises", id: m.id, x: m.x, y: m.y, absorbed: best.occ.map((q) => q.id) });
}
// Every two rounds: one round charging (rows announced, the Moon still), then the attack.
function moonTick(s, r) {
  const m = s.pieces.find((p) => p.t === "M");
  if (!m) return;
  if (s.moon.charging) {
    moonAttack(s, m);
    s.moon.charging = false;
    s.moon.rows = null;
  } else if ((r - s.moon.since) % 2 === 0) {
    s.moon.charging = true;
    s.moon.rows = [m.y, m.y + 1];
    s.events.push({ type: "moonWarn", rows: s.moon.rows.slice() });
  }
}
// The Moon's attack: every piece of yours in its two rows, left and right of it, until a hole.
export function moonTargets(s, m = s.pieces.find((p) => p.t === "M")) {
  if (!m) return [];
  const hit = [];
  for (const y of [m.y, m.y + 1])
    for (const dir of [-1, 1]) {
      for (let x = dir < 0 ? m.x - 1 : m.x + 2; x >= 0 && x < N; x += dir) {
        if (isHole(s, x, y)) break;
        const q = pieceAt(s, x, y);
        if (q && q.side === "p") hit.push(q);
      }
    }
  return hit;
}
function moonAttack(s, m) {
  const hit = moonTargets(s, m);
  s.events.push({ type: "moonAttack", rows: [m.y, m.y + 1], ids: hit.map((q) => q.id) });
  for (const q of hit) destroy(s, q, "moon", "b");
}

// The Trader (the Trapper's phase 2), once: give a piece on the board (not the King), get back
// the most valuable piece you have lost, on the same square. giveId null = refuse.
export function tradeOffer(s) {
  if (s.trade !== "open" || !s.lost.p.length) return null;
  const best = s.lost.p.slice().sort((a, b) => VALUE[b.t] - VALUE[a.t])[0];
  return { back: best };
}
export function trade(s0, giveId) {
  const s = clone(s0);
  const offer = tradeOffer(s);
  s.trade = "done";
  if (!offer || giveId == null) {
    s.events.push({ type: "tradeRefused" });
    return s;
  }
  const give = byId(s, giveId);
  if (!give || give.side !== "p" || give.t === "K") throw new Error("the Trader wants a piece of yours, not the King");
  const back = offer.back;
  s.lost.p.splice(s.lost.p.indexOf(back), 1);
  remove(s, give);
  const p = { id: s.nextId++, t: back.t, side: "p", x: give.x, y: give.y, slot: back.slot, sig: back.sig.slice() };
  s.pieces.push(p);
  s.events.push({ type: "trade", gave: give.id, got: p.id, t: p.t, x: p.x, y: p.y });
  promote(s);
  return s;
}

// what the Trapper's traps, the coming wind and the Moon will do (for the AI and the hints)
export const windVector = (d) => DIRS[d];

// Tools and tests: the phase change at once (as at the end of a round with the scale at +3).
export function enterPhase2(s0) {
  const s = clone(s0);
  if (s.boss && s.phase === 1) phase2(s);
  return s;
}
