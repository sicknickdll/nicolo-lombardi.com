// STRANGE CHESS: the rules engine. Pure and deterministic: no DOM, no Math.random, no clocks.
// The state is a plain serialisable object; every function that changes it returns a new one
// (pieces are immutable and shared between states, so a copy is cheap enough for the AI).
//
// Board: 6×6, index = y*6 + x, y = 0 is the boss's edge (top), y = 5 the player's (bottom).
// Sides: 0 = player (always moves first), 1 = boss, 2 = neutral (gold blocks).
// Piece: { id, t, s, g?: sigils[], bait?, x?, y? }   t: P N B R Q K, G (gold block), M (the Moon, 2×2,
//   its top-left cell is x,y and the same object sits in all four cells).
// Move: { from, to, kind: "move"|"capture"|"push", d?: [dx,dy], path?: cells[], tele? }
//   (for the Moon, from / to are the top-left cells of its footprint).
//
// Every call that changes the state fills state.events with what happened, in order, for the
// renderer to animate; the rules never read them.
import { nextRng } from "./rng.js";

export const N = 6;
export const VALUE = { P: 1, N: 3, B: 3, R: 4, Q: 5, K: 5, G: 0, M: 0 };
export const WIND_DIRS = [
  [0, -1], // 0 north (towards the boss)
  [1, 0], // 1 east
  [0, 1], // 2 south (towards the player)
  [-1, 0], // 3 west
];
export const SIGILS = ["pusher", "rooted", "ghost"];
export const WIND_NAMES = ["north", "east", "south", "west"];
const ORTHO = WIND_DIRS;
const DIAG = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const EIGHT = [...ORTHO, ...DIAG];

export const DEFAULTS = {
  integrity: 4, // every square starts with this much ground
  windEvery: 3, // the wind blows at the end of rounds 3, 6, 9…
  windEdgeKills: false, // see README: true = a piece drifting off the edge is lost (brutal: it deletes whole back ranks)
  roundLimit: 40,
  moonRoundLimit: 60, // the Moon can only be beaten by pushing it, so its fight gets more time
  scaleWin: 5,
  phaseAt: 3,
  trapCount: 3,
  hookEvery: 4,
  pickEvery: 3,
  moonEvery: 2,
  maskSwitchRound: 10,
};
export const BOSS_IDS = ["trapper", "angler", "prospector", "woodcarver"];

export const ix = (x, y) => y * N + x;
export const xOf = (i) => i % N;
export const yOf = (i) => (i / N) | 0;
const inb = (x, y) => x >= 0 && x < N && y >= 0 && y < N;
export const isHole = (s, i) => s.integ[i] <= 0;
const enemyOf = (side) => 1 - side;
const has = (p, g) => !!p.g && p.g.includes(g);

// Cells a body covers (the Moon covers four, everything else one).
export function cellsOf(p, i) {
  if (p.t === "M") return [ix(p.x, p.y), ix(p.x + 1, p.y), ix(p.x, p.y + 1), ix(p.x + 1, p.y + 1)];
  return [i];
}
// A piece that can be captured by landing on it.
const capturable = (q, me) => q.s === enemyOf(me) && q.t !== "M" && q.t !== "G";

// ── state ────────────────────────────────────────────────────────────────────────────────────
export function blankState(cfg = {}, seed = 1) {
  const c = { ...DEFAULTS, ...cfg };
  return {
    cfg: c,
    cells: new Array(N * N).fill(null),
    integ: new Array(N * N).fill(c.integrity),
    round: 1,
    turn: 0,
    scale: 0,
    wind: { warn: null, last: null },
    boss: { id: null, phase: 1, mask: null, hook: null },
    traps: [],
    gone: [],
    skip: [0, 0],
    kingDown: [false, false],
    pending: null,
    tradeUsed: false,
    over: null,
    rng: seed >>> 0,
    nid: 1,
    events: [],
    er: [],
  };
}

export function cloneState(s) {
  return {
    ...s,
    cells: s.cells.slice(),
    integ: s.integ.slice(),
    traps: s.traps.slice(),
    gone: s.gone.slice(),
    skip: s.skip.slice(),
    kingDown: s.kingDown.slice(),
    wind: { ...s.wind },
    boss: { ...s.boss },
    pending: s.pending ? { ...s.pending } : null,
    over: s.over ? { ...s.over } : null,
    events: [],
    er: [],
  };
}

const ev = (s, e) => void (s.quiet || s.events.push(e));
function rand(s) {
  const [v, n] = nextRng(s.rng);
  s.rng = n;
  return v;
}
const rint = (s, n) => Math.floor(rand(s) * n);
const rpick = (s, a) => a[rint(s, a.length)];

// Back rank. The Glitch knight teleports through the board centre, so on b-file it lands on the enemy's e-file
// square. With the textbook order (R N B Q K R on both sides) that square is the enemy KING: the player's
// first move would win the game. So the player's rank is R N Q B K R and the boss's is the same turned
// 180° (R K B Q N R): each Glitch faces the other, and each is guarded by its queen. The opening is a trade
// offer, not a free kill.
const BACK = ["R", "N", "Q", "B", "K", "R"];
const BOSS_BACK = [...BACK].reverse();
// army: the player's pieces for this fight: [{ id, t, x, y, g }] (x, y = home square). Default: the full set.
export function defaultArmy() {
  const a = [];
  BACK.forEach((t, x) => a.push({ id: `p${a.length}`, t, x, y: 5, g: [] }));
  for (let x = 0; x < N; x++) a.push({ id: `p${a.length}`, t: "P", x, y: 4, g: [] });
  return a;
}

export function newFight({ boss, army = defaultArmy(), seed = 1, cfg = {} }) {
  const s = blankState(cfg, seed);
  s.boss.id = boss;
  for (const a of army) s.cells[ix(a.x, a.y)] = { id: a.id, t: a.t, s: 0, g: a.g?.slice() || [] };
  BOSS_BACK.forEach((t, x) => (s.cells[ix(x, 0)] = { id: `b${x}`, t, s: 1 }));
  for (let x = 0; x < N; x++) s.cells[ix(x, 1)] = { id: `b${N + x}`, t: "P", s: 1 };
  if (boss === "woodcarver") {
    s.boss.mask = rpick(s, ["trapper", "angler", "prospector"]);
    ev(s, { k: "mask", mask: s.boss.mask });
  }
  if (effective(s) === "trapper") placeTraps(s);
  s.events = [];
  return s;
}

// The rule set currently in force: the boss itself, or for the Woodcarver the mask he wears
// (phase 1) or the Moon (phase 2).
export function effective(s) {
  if (s.boss.id !== "woodcarver") return s.boss.id;
  return s.boss.phase === 1 ? s.boss.mask : "moon";
}
export const moonMode = (s) => s.boss.id === "woodcarver" && s.boss.phase === 2;

// ── lookup helpers ───────────────────────────────────────────────────────────────────────────
export function bodies(s, side) {
  const out = [];
  for (let i = 0; i < s.cells.length; i++) {
    const p = s.cells[i];
    if (!p || (side != null && p.s !== side)) continue;
    if (p.t === "M" && i !== ix(p.x, p.y)) continue;
    out.push({ p, i });
  }
  return out;
}
export const findPiece = (s, id) => {
  for (let i = 0; i < s.cells.length; i++) if (s.cells[i]?.id === id) return i;
  return -1;
};
export const moonOf = (s) => bodies(s, 1).find((b) => b.p.t === "M")?.p || null;
const emptyCells = (s, rows) => {
  const o = [];
  for (let i = 0; i < s.cells.length; i++) if (!s.cells[i] && !isHole(s, i) && (!rows || rows.includes(yOf(i)))) o.push(i);
  return o;
};

// ── pushing ──────────────────────────────────────────────────────────────────────────────────
// The chain of bodies shoved when something moves into `to` heading d. Returns null when it cannot
// happen (a gold block is in the chain). Each body ends up one square further; one whose new
// footprint touches a hole or leaves the board falls.
export function pushPlan(s, to, d, pusherId) {
  const first = s.cells[to];
  if (!first) return { bodies: [] };
  const seen = new Set();
  const list = [];
  const queue = [{ p: first, i: to }];
  while (queue.length) {
    const { p, i } = queue.shift();
    if (seen.has(p.id)) continue;
    if (p.t === "G") return null; // immovable
    seen.add(p.id);
    const cells = cellsOf(p, i);
    list.push({ p, cells });
    for (const c of cells) {
      const nx = xOf(c) + d[0],
        ny = yOf(c) + d[1];
      if (!inb(nx, ny)) continue;
      const q = s.cells[ix(nx, ny)];
      if (q && !seen.has(q.id) && q.id !== pusherId) queue.push({ p: q, i: ix(nx, ny) });
    }
  }
  for (const b of list) {
    b.next = b.cells.map((c) => [xOf(c) + d[0], yOf(c) + d[1]]);
    b.falls = b.next.some(([x, y]) => !inb(x, y) || isHole(s, ix(x, y)));
  }
  return { bodies: list };
}
// For the interface: where everything ends up if `mv` is played (the mover first).
export function previewPush(s, mv) {
  if (mv.kind !== "push") return [];
  const plan = pushPlan(s, mv.to, mv.d, s.cells[mv.from].id);
  return plan ? plan.bodies.map((b) => ({ id: b.p.id, from: b.cells[0], next: b.next, falls: b.falls, t: b.p.t, s: b.p.s })) : [];
}

// ── move generation ──────────────────────────────────────────────────────────────────────────
export function legalMoves(s, side = s.turn) {
  if (s.over) return [];
  const out = [];
  for (const { p, i } of bodies(s, side)) {
    if (p.bait) continue; // the Angler's bait never moves
    genFor(s, i, p, out);
  }
  // one entry per (destination, kind)
  const seen = new Set();
  return out.filter((m) => {
    const key = `${m.from}-${m.to}-${m.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export const hasMoves = (s, side = s.turn) => legalMoves(s, side).length > 0;
export function movesFrom(s, i) {
  const p = s.cells[i];
  if (!p || s.over) return [];
  const out = [];
  if (!p.bait) genFor(s, i, p, out);
  return out;
}

function genFor(s, i, p, out) {
  switch (p.t) {
    case "P":
      return genPawn(s, i, p, out);
    case "N":
      return genKnight(s, i, p, out);
    case "B":
      return genBishop(s, i, p, out);
    case "R":
      return genRook(s, i, p, out);
    case "Q":
      return genSlider(s, i, p, EIGHT, out);
    case "K":
      return genStep(s, i, p, EIGHT, out);
    case "M":
      return genMoon(s, i, p, out);
  }
}

// Moving or capturing into square `ni`, heading d. Adds the "push instead" alternative of the Pusher sigil.
function land(s, i, p, ni, d, path, out, stop) {
  if (isHole(s, ni)) return "hole";
  const q = s.cells[ni];
  if (!q) {
    out.push({ from: i, to: ni, kind: "move", d, path });
    return "empty";
  }
  if (capturable(q, p.s)) out.push({ from: i, to: ni, kind: "capture", d, path });
  if (has(p, "pusher") && q.s === enemyOf(p.s) && pushPlan(s, ni, d, p.id)) out.push({ from: i, to: ni, kind: "push", d, path });
  return "piece";
}

function genStep(s, i, p, dirs, out) {
  const x = xOf(i),
    y = yOf(i);
  for (const d of dirs) {
    const nx = x + d[0],
      ny = y + d[1];
    if (inb(nx, ny)) land(s, i, p, ix(nx, ny), d, [ix(nx, ny)], out);
  }
}

function genPawn(s, i, p, out) {
  const x = xOf(i),
    y = yOf(i),
    dy = p.s === 0 ? -1 : 1;
  if (!inb(x, y + dy)) return;
  const f = ix(x, y + dy);
  if (!isHole(s, f)) {
    const q = s.cells[f];
    if (!q) out.push({ from: i, to: f, kind: "move", d: [0, dy], path: [f] });
    else if (has(p, "pusher") && q.s === enemyOf(p.s) && pushPlan(s, f, [0, dy], p.id)) out.push({ from: i, to: f, kind: "push", d: [0, dy], path: [f] });
  }
  for (const dx of [-1, 1]) {
    const nx = x + dx;
    if (!inb(nx, y + dy)) continue;
    const c = ix(nx, y + dy);
    const q = s.cells[c];
    if (!q || isHole(s, c)) continue;
    if (capturable(q, p.s)) out.push({ from: i, to: c, kind: "capture", d: [dx, dy], path: [c] });
    if (has(p, "pusher") && q.s === enemyOf(p.s) && pushPlan(s, c, [dx, dy], p.id)) out.push({ from: i, to: c, kind: "push", d: [dx, dy], path: [c] });
  }
}

// Glitch: teleports to the mirror square (x → 5−x, y → 5−y), or takes one king step.
function genKnight(s, i, p, out) {
  const t = ix(N - 1 - xOf(i), N - 1 - yOf(i));
  if (!isHole(s, t)) {
    const q = s.cells[t];
    if (!q) out.push({ from: i, to: t, kind: "move", tele: true, path: [t] });
    else if (capturable(q, p.s)) out.push({ from: i, to: t, kind: "capture", tele: true, path: [t] });
  }
  genStep(s, i, p, EIGHT, out);
}

// Slides along dirs. The Ghost sigil lets it pass through one piece.
function genSlider(s, i, p, dirs, out) {
  for (const d of dirs) {
    let x = xOf(i),
      y = yOf(i),
      ghost = has(p, "ghost") ? 1 : 0;
    const path = [];
    for (;;) {
      x += d[0];
      y += d[1];
      if (!inb(x, y)) break;
      const ni = ix(x, y);
      path.push(ni);
      if (ni === i) continue;
      const r = land(s, i, p, ni, d, path.slice(), out);
      if (r === "empty") continue;
      if (r === "piece" && ghost > 0) {
        ghost--;
        continue;
      }
      break;
    }
  }
}

// Light ray: diagonals, bouncing once off an edge onto the reflected diagonal.
function genBishop(s, i, p, out) {
  for (const sd of DIAG) {
    let x = xOf(i),
      y = yOf(i),
      dx = sd[0],
      dy = sd[1],
      bounced = false,
      ghost = has(p, "ghost") ? 1 : 0;
    const path = [];
    for (let step = 0; step < 16; step++) {
      let nx = x + dx,
        ny = y + dy;
      if (!inb(nx, ny)) {
        if (bounced) break;
        bounced = true;
        if (nx < 0 || nx >= N) dx = -dx;
        if (ny < 0 || ny >= N) dy = -dy;
        nx = x + dx;
        ny = y + dy;
        if (!inb(nx, ny)) break;
      }
      x = nx;
      y = ny;
      const ni = ix(x, y);
      path.push(ni);
      if (ni === i) continue; // the ray may cross the square it left
      const r = land(s, i, p, ni, [dx, dy], path.slice(), out);
      if (r === "empty") continue;
      if (r === "piece" && ghost > 0) {
        ghost--;
        continue;
      }
      break;
    }
  }
}

// Bulldozer: slides over empty squares; never captures by landing. Moving into a piece after at
// least one square of travel pushes it and everything behind it one square further.
function genRook(s, i, p, out) {
  for (const d of ORTHO) {
    let x = xOf(i),
      y = yOf(i),
      moved = 0,
      ghost = has(p, "ghost") ? 1 : 0;
    const path = [];
    for (;;) {
      x += d[0];
      y += d[1];
      if (!inb(x, y)) break;
      const ni = ix(x, y);
      if (isHole(s, ni)) break;
      const q = s.cells[ni];
      path.push(ni);
      if (!q) {
        moved++;
        out.push({ from: i, to: ni, kind: "move", d, path: path.slice() });
        continue;
      }
      if (moved >= 1 && pushPlan(s, ni, d, p.id)) out.push({ from: i, to: ni, kind: "push", d, path: path.slice() });
      if (ghost > 0) {
        ghost--;
        moved++;
        continue;
      }
      break;
    }
  }
}

// The Moon: one square orthogonally, onto four free, solid squares.
function genMoon(s, i, p, out) {
  for (const d of ORTHO) {
    const nx = p.x + d[0],
      ny = p.y + d[1];
    if (nx < 0 || ny < 0 || nx + 1 >= N || ny + 1 >= N) continue;
    const cells = [ix(nx, ny), ix(nx + 1, ny), ix(nx, ny + 1), ix(nx + 1, ny + 1)];
    if (cells.every((c) => !isHole(s, c) && (!s.cells[c] || s.cells[c].id === p.id))) out.push({ from: i, to: ix(nx, ny), kind: "move", d, path: [ix(nx, ny)] });
  }
}

// ── executing a move ─────────────────────────────────────────────────────────────────────────
function erode(s, i) {
  s.er.push(i);
}
function flushErosion(s) {
  for (const i of s.er) {
    s.integ[i] = Math.max(0, s.integ[i] - 1);
    if (s.integ[i] <= 0 && s.cells[i]) s.integ[i] = 1; // somebody stands on it: it holds until they leave
    ev(s, { k: "erode", at: i, integ: s.integ[i] });
    if (s.integ[i] <= 0) ev(s, { k: "hole", at: i });
  }
  s.er = [];
}

// Takes the body at `at` off the board. score: the other side gains its value on the scale.
function destroyAt(s, at, why, { score = true } = {}) {
  const p = s.cells[at];
  if (!p) return;
  for (const c of cellsOf(p, at)) s.cells[c] = null;
  ev(s, { k: "destroy", id: p.id, t: p.t, side: p.s, at, cells: cellsOf(p, at), why, bait: !!p.bait });
  if (p.s === 0) s.gone.push({ id: p.id, t: p.t, g: p.g || [] });
  if (score && p.t !== "G" && p.t !== "M") {
    s.scale += p.s === 1 ? VALUE[p.t] : -VALUE[p.t];
    ev(s, { k: "scale", value: s.scale });
  }
  if (p.t === "K") s.kingDown[p.s] = true;
  if (p.t === "M") s.kingDown[1] = true;
}

function arrive(s, p, at) {
  // Hidden traps only ever bite the player.
  if (p.s === 0 && s.traps.includes(at)) {
    s.traps = s.traps.filter((t) => t !== at);
    ev(s, { k: "trap", at });
    destroyAt(s, at, "trap");
  }
}

function place(s, p, to) {
  s.cells[to] = p;
}

export function applyMove(s0, mv, opts = {}) {
  const s = cloneState(s0);
  if (s.over) return s;
  const me = s.turn;
  const p = s.cells[mv.from];
  if (!p || p.s !== me) throw new Error("illegal move: no piece of yours there");
  if (p.t === "M") moveMoon(s, p, mv);
  else if (mv.kind === "push") doPush(s, p, mv);
  else {
    const victim = mv.kind === "capture" ? s.cells[mv.to] : null;
    s.cells[mv.from] = null;
    erode(s, mv.from);
    ev(s, { k: "move", id: p.id, from: mv.from, to: mv.to, path: mv.path || [mv.to], tele: !!mv.tele, capture: !!victim });
    if (victim) {
      destroyAt(s, mv.to, "capture");
      if (victim.bait && me === 0) {
        s.skip[0] += 1;
        ev(s, { k: "bait", at: mv.to });
      }
    }
    let np = p;
    if (p.t === "P" && yOf(mv.to) === (me === 0 ? 0 : N - 1)) {
      np = { ...p, t: "Q" };
      ev(s, { k: "promote", id: p.id, at: mv.to });
    }
    place(s, np, mv.to);
    arrive(s, np, mv.to);
  }
  flushErosion(s);
  afterAction(s, me);
  if (!s.over) {
    passTurn(s);
    settleTurn(s);
  }
  if (opts.auto) autoResolve(s);
  return s;
}

function moveMoon(s, p, mv) {
  const old = cellsOf(p, mv.from);
  const np = { ...p, x: xOf(mv.to), y: yOf(mv.to) };
  for (const c of old) {
    s.cells[c] = null;
  }
  const fresh = cellsOf(np, mv.to);
  for (const c of fresh) s.cells[c] = np;
  for (const c of old) if (!fresh.includes(c)) erode(s, c);
  ev(s, { k: "move", id: p.id, from: mv.from, to: mv.to, path: [mv.to], moon: true });
}

function doPush(s, p, mv) {
  const plan = pushPlan(s, mv.to, mv.d, p.id);
  if (!plan) throw new Error("illegal push");
  const me = p.s;
  // lift everything, then lay it back one square further (or let it fall)
  s.cells[mv.from] = null;
  erode(s, mv.from);
  for (const b of plan.bodies) {
    for (const c of b.cells) {
      s.cells[c] = null;
      erode(s, c);
    }
  }
  ev(s, { k: "move", id: p.id, from: mv.from, to: mv.to, path: mv.path || [mv.to], push: true });
  const landed = [];
  for (const b of plan.bodies) {
    const first = b.cells[0];
    if (b.falls) {
      // put it back for a moment so destroyAt can find it
      for (const c of b.cells) s.cells[c] = b.p;
      ev(s, { k: "push", id: b.p.id, from: first, to: ix(Math.max(0, Math.min(N - 1, b.next[0][0])), Math.max(0, Math.min(N - 1, b.next[0][1]))), falls: true, d: mv.d });
      destroyAt(s, first, "fall", { score: b.p.t !== "M" });
      if (b.p.t === "M") ev(s, { k: "moonfall" });
      continue;
    }
    const np = b.p.t === "M" ? { ...b.p, x: b.next[0][0], y: b.next[0][1] } : b.p;
    const to = b.p.t === "M" ? ix(np.x, np.y) : ix(b.next[0][0], b.next[0][1]);
    ev(s, { k: "push", id: b.p.id, from: first, to, d: mv.d });
    landed.push({ np, cells: b.p.t === "M" ? cellsOf(np, to) : [to], at: to });
  }
  for (const l of landed) for (const c of l.cells) s.cells[c] = l.np;
  // the pusher takes the first square
  let np = p;
  if (p.t === "P" && yOf(mv.to) === (me === 0 ? 0 : N - 1)) {
    np = { ...p, t: "Q" };
    ev(s, { k: "promote", id: p.id, at: mv.to });
  }
  place(s, np, mv.to);
  for (const l of landed) arrive(s, l.np, l.at);
  arrive(s, np, mv.to);
}

// What follows any change to the board: phase check, then who has won.
// (Phase 2 is checked at the end of the round, once the boss has had his reply: a trade he can answer
// does not skip phase 1.)
function afterAction(s, mover) {
  checkOver(s, mover);
}
function checkOver(s, mover = s.turn) {
  if (s.over) return;
  const [pk, bk] = s.kingDown;
  if (pk || bk) {
    const winner = pk && bk ? mover : bk ? 0 : 1;
    s.over = { winner, reason: moonMode(s) && bk && !pk ? "moon" : "king" };
    ev(s, { k: "over", ...s.over });
    return;
  }
  if (moonMode(s)) return; // the scale no longer decides anything: only the Moon does
  if (s.scale >= s.cfg.scaleWin) s.over = { winner: 0, reason: "scale" };
  else if (s.scale <= -s.cfg.scaleWin) s.over = { winner: 1, reason: "scale" };
  if (s.over) ev(s, { k: "over", ...s.over });
}

// ── turns, rounds, wind ──────────────────────────────────────────────────────────────────────
function passTurn(s) {
  if (s.turn === 0) {
    s.turn = 1;
    return;
  }
  roundEnd(s);
  if (s.over) return;
  s.round++;
  s.turn = 0;
  if (effective(s) === "trapper" && s.boss.phase === 2 && !s.tradeUsed && s.gone.length && !s.pending) s.pending = { type: "trade" };
}
// A side that has to skip a turn (the bait) misses it.
function settleTurn(s) {
  let guard = 0;
  while (!s.over && s.skip[s.turn] > 0 && guard++ < 4) {
    s.skip[s.turn]--;
    ev(s, { k: "skip", side: s.turn });
    passTurn(s);
  }
}
// For a side with no legal move at all.
export function passStuck(s0) {
  const s = cloneState(s0);
  ev(s, { k: "skip", side: s.turn, stuck: true });
  passTurn(s);
  settleTurn(s);
  return s;
}

function roundEnd(s) {
  const r = s.round;
  const c = s.cfg;
  // the boss's own rules
  if (s.boss.id === "woodcarver" && s.boss.phase === 1 && r === c.maskSwitchRound) switchMask(s);
  const rule = effective(s);
  if (rule === "angler") hookRule(s, r);
  if (rule === "prospector") pickaxeRule(s, r);
  if (s.boss.id === "angler" && s.boss.phase === 2) baitRule(s, r);
  if (s.boss.id === "woodcarver" && s.boss.phase === 2) moonRule(s, r);
  // wind
  if (s.wind.warn != null && r % c.windEvery === 0) {
    blow(s, s.wind.warn);
    s.wind.last = s.wind.warn;
    s.wind.warn = null;
  }
  if ((r + 1) % c.windEvery === 0 && s.wind.warn == null && !s.over) {
    s.wind.warn = rint(s, 4);
    ev(s, { k: "windwarn", dir: s.wind.warn });
  }
  flushErosion(s);
  checkOver(s, 1);
  if (!s.over && !s.pending && s.boss.phase === 1 && s.scale >= c.phaseAt) s.pending = { type: "phase2" };
  const limit = moonMode(s) ? c.moonRoundLimit : c.roundLimit;
  if (!s.over && r >= limit) {
    s.over = { winner: moonMode(s) ? 1 : s.scale > 0 ? 0 : 1, reason: "rounds" };
    ev(s, { k: "over", ...s.over });
  }
}

// Every piece drifts one square downwind if that square is empty ground. A piece drifting into a hole is lost
// (nobody scores). Resolved from the downwind side so pieces do not block each other that were never in the way.
export function blow(s, dir) {
  const [dx, dy] = WIND_DIRS[dir];
  ev(s, { k: "windblow", dir });
  const order = [];
  for (let i = 0; i < N * N; i++) order.push(i);
  order.sort((a, b) => (xOf(b) - xOf(a)) * dx + (yOf(b) - yOf(a)) * dy);
  for (const i of order) {
    const p = s.cells[i];
    if (!p || p.t === "G" || p.t === "M" || has(p, "rooted")) continue;
    const nx = xOf(i) + dx,
      ny = yOf(i) + dy;
    if (!inb(nx, ny)) {
      if (s.cfg.windEdgeKills) {
        erode(s, i);
        destroyAt(s, i, "edge", { score: false });
      }
      continue;
    }
    const ni = ix(nx, ny);
    if (isHole(s, ni)) {
      erode(s, i);
      ev(s, { k: "drift", id: p.id, from: i, to: ni, falls: true });
      destroyAt(s, i, "wind", { score: false });
    } else if (!s.cells[ni]) {
      s.cells[i] = null;
      s.cells[ni] = p;
      erode(s, i);
      ev(s, { k: "drift", id: p.id, from: i, to: ni });
      arrive(s, p, ni);
    }
  }
}

// ── the bosses ───────────────────────────────────────────────────────────────────────────────
function placeTraps(s) {
  const spots = emptyCells(s, [2, 3]).filter((i) => !s.traps.includes(i));
  for (let n = 0; n < s.cfg.trapCount && spots.length; n++) {
    const k = rint(s, spots.length);
    s.traps.push(spots.splice(k, 1)[0]);
  }
}

function switchMask(s) {
  const others = ["trapper", "angler", "prospector"].filter((m) => m !== s.boss.mask);
  s.boss.mask = rpick(s, others);
  ev(s, { k: "mask", mask: s.boss.mask, switched: true });
  if (s.boss.mask === "trapper") placeTraps(s);
}

// The player's most valuable piece that is not a king (ties: random).
function hookTarget(s) {
  let best = -1,
    list = [];
  for (const { p, i } of bodies(s, 0)) {
    if (p.t === "K" || p.t === "G") continue;
    const v = VALUE[p.t];
    if (v > best) (best = v), (list = [i]);
    else if (v === best) list.push(i);
  }
  return list.length ? list[rint(s, list.length)] : -1;
}
function hookRule(s, r) {
  const every = s.cfg.hookEvery;
  if (r % every === every - 1) {
    const t = hookTarget(s);
    if (t >= 0) {
      s.boss.hook = s.cells[t].id;
      ev(s, { k: "hookwarn", id: s.boss.hook, at: t });
    }
    return;
  }
  if (r % every !== 0) return;
  let at = s.boss.hook != null ? findPiece(s, s.boss.hook) : -1;
  if (at < 0 || s.cells[at].s !== 0) at = hookTarget(s);
  s.boss.hook = null;
  if (at < 0) return;
  const p = s.cells[at];
  const x = xOf(at),
    y = yOf(at) - 1; // towards his side
  if (y < 0) return ev(s, { k: "hook", id: p.id, from: at, to: at, slack: true });
  const to = ix(x, y);
  if (isHole(s, to)) {
    ev(s, { k: "hook", id: p.id, from: at, to, falls: true });
    erode(s, at);
    destroyAt(s, at, "hook");
  } else if (s.cells[to]) ev(s, { k: "hook", id: p.id, from: at, to, slack: true });
  else {
    s.cells[at] = null;
    s.cells[to] = p;
    erode(s, at);
    ev(s, { k: "hook", id: p.id, from: at, to });
    arrive(s, p, to);
  }
}

function baitRule(s, r) {
  if (r % 5 !== 0) return;
  if (bodies(s, 1).some((b) => b.p.bait)) return;
  dropBait(s);
}
function dropBait(s) {
  const spots = emptyCells(s, [2, 3]);
  if (!spots.length) return;
  const at = rpick(s, spots);
  const p = { id: `bait${s.nid++}`, t: "P", s: 1, bait: true };
  s.cells[at] = p;
  ev(s, { k: "bait-drop", id: p.id, at });
}

function pickaxeRule(s, r) {
  if (r % s.cfg.pickEvery !== 0) return;
  let best = N,
    list = [];
  for (const { p, i } of bodies(s, 0)) {
    if (p.t === "K" || p.t === "G") continue;
    const y = yOf(i);
    if (y < best) (best = y), (list = [i]);
    else if (y === best) list.push(i);
  }
  if (!list.length) return;
  const at = list[rint(s, list.length)];
  const p = s.cells[at];
  s.cells[at] = { id: `gold${s.nid++}`, t: "G", s: 2, was: p.t };
  ev(s, { k: "gold", id: p.id, at, to: s.cells[at].id });
}

function crackGold(s) {
  for (const { p, i } of bodies(s, 2)) {
    if (p.t !== "G") continue;
    s.cells[i] = null;
    s.integ[i] = 0;
    ev(s, { k: "crack", at: i, id: p.id });
    ev(s, { k: "hole", at: i });
  }
}

function spawnMoon(s) {
  const k = bodies(s, 1).find((b) => b.p.t === "K");
  let kx = 2,
    ky = 0;
  if (k) {
    kx = xOf(k.i);
    ky = yOf(k.i);
  }
  // pick the 2×2 footprint that includes the king's square, solid ground, fewest player pieces under it
  const cands = [];
  for (const [ox, oy] of [
    [0, 0],
    [-1, 0],
    [0, -1],
    [-1, -1],
  ]) {
    const x = kx + ox,
      y = ky + oy;
    if (x < 0 || y < 0 || x + 1 >= N || y + 1 >= N) continue;
    const cells = [ix(x, y), ix(x + 1, y), ix(x, y + 1), ix(x + 1, y + 1)];
    if (cells.some((c) => isHole(s, c))) continue;
    const cost = cells.reduce((a, c) => a + (s.cells[c] && c !== (k ? k.i : -1) ? (s.cells[c].s === 0 ? 5 : 1) : 0), 0);
    cands.push({ x, y, cells, cost });
  }
  cands.sort((a, b) => a.cost - b.cost || b.y - a.y);
  const c = cands[0] || { x: 2, y: 0, cells: [ix(2, 0), ix(3, 0), ix(2, 1), ix(3, 1)] };
  if (k) {
    s.cells[k.i] = null;
    ev(s, { k: "kingtomoon", id: k.p.id, at: k.i });
  }
  for (const cell of c.cells) if (s.cells[cell]) destroyAt(s, cell, "moon", { score: false });
  const moon = { id: "moon", t: "M", s: 1, x: c.x, y: c.y };
  for (const cell of c.cells) s.cells[cell] = moon;
  ev(s, { k: "moonspawn", at: ix(c.x, c.y) });
}

// The Moon looks down every second round; the round before, it glows.
function moonRule(s, r) {
  const moon = moonOf(s);
  if (!moon) return;
  const every = s.cfg.moonEvery;
  if (r % every === every - 1) return ev(s, { k: "moonwarn", rows: [moon.y, moon.y + 1] });
  if (r % every !== 0) return;
  const killed = [];
  for (const row of [moon.y, moon.y + 1]) {
    for (const [from, step] of [
      [moon.x - 1, -1],
      [moon.x + 2, 1],
    ]) {
      for (let x = from; x >= 0 && x < N; x += step) {
        const i = ix(x, row);
        if (isHole(s, i)) break; // light does not cross a hole
        const q = s.cells[i];
        if (q && q.s === 0) {
          killed.push(i);
        }
      }
    }
  }
  ev(s, { k: "moonstrike", rows: [moon.y, moon.y + 1], at: killed });
  for (const i of killed) destroyAt(s, i, "moon", { score: false });
}

// ── phases, trade ────────────────────────────────────────────────────────────────────────────
export function resolvePending(s0) {
  if (!s0.pending) return s0;
  const s = cloneState(s0);
  const kind = s.pending.type;
  s.pending = null;
  if (kind === "phase2") {
    s.boss.phase = 2;
    ev(s, { k: "phase2", boss: s.boss.id });
    if (s.boss.id === "prospector") crackGold(s);
    if (s.boss.id === "angler") dropBait(s);
    if (s.boss.id === "woodcarver") spawnMoon(s);
    flushErosion(s);
    checkOver(s, 0);
    if (!s.over && s.boss.id === "trapper" && s.turn === 0 && !s.tradeUsed && s.gone.length) s.pending = { type: "trade" };
  }
  return s;
}
// The Trader: swap one of your pieces on the board for one that was lost. The one you give counts
// on the scale as if it had been taken; the one you get back appears in its square.
export function tradeOptions(s) {
  if (s.pending?.type !== "trade") return null;
  const give = bodies(s, 0).filter((b) => b.p.t !== "K" && b.p.t !== "G").map((b) => b.i);
  const get = s.gone.map((g, k) => ({ k, ...g }));
  return { give, get };
}
export function applyTrade(s0, giveAt, goneIndex) {
  const s = cloneState(s0);
  const back = s.gone[goneIndex];
  const given = s.cells[giveAt];
  if (!back || !given || given.s !== 0) throw new Error("illegal trade");
  s.pending = null;
  s.tradeUsed = true;
  s.gone = s.gone.filter((_, k) => k !== goneIndex);
  s.cells[giveAt] = null;
  s.scale -= VALUE[given.t];
  ev(s, { k: "trade", give: given.id, giveAt, get: back.id, t: back.t });
  s.cells[giveAt] = { id: back.id, t: back.t, s: 0, g: back.g || [] };
  checkOver(s, 1);
  return s;
}
export function declineTrade(s0) {
  const s = cloneState(s0);
  s.pending = null;
  s.tradeUsed = true;
  ev(s, { k: "trade-declined" });
  return s;
}
function autoResolve(s) {
  // used by the AI and tests: no interface to wait for. (mutates the fresh state it was handed)
  if (s.pending?.type === "phase2") {
    const r = resolvePending(s);
    Object.assign(s, r);
  }
  if (s.pending?.type === "trade") {
    s.pending = null;
    s.tradeUsed = true;
  }
}

// ── small queries the interface and the AI share ─────────────────────────────────────────────
export const countScale = (s) => s.scale;
export function material(s, side) {
  let v = 0;
  for (const { p } of bodies(s, side)) v += VALUE[p.t] || 0;
  return v;
}
export const winnerText = (s) => (s.over ? (s.over.winner === 0 ? "player" : "boss") : null);
