// Strange Chess: the rules engine.   npm test   (node --test tests/)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  N,
  ix,
  blankState,
  newFight,
  legalMoves,
  movesFrom,
  applyMove,
  blow,
  cloneState,
  pushPlan,
  previewPush,
  resolvePending,
  applyTrade,
  tradeOptions,
  passStuck,
  bodies,
  moonOf,
  effective,
  isHole,
} from "../js/strange-chess/rules.js";
import { makeRng } from "../js/strange-chess/rng.js";
import { chooseMove, evaluate } from "../js/strange-chess/ai.js";

// A custom position: [type, side, x, y, extras?]
function board(pieces, cfg = {}, boss = "trapper") {
  const s = blankState(cfg, 7);
  s.boss.id = boss;
  let n = 0;
  for (const [t, side, x, y, extra] of pieces) {
    const p = { id: `${side ? "b" : "p"}${n++}`, t, s: side, ...extra };
    if (t === "M") (p.x = x), (p.y = y);
    if (t === "M") for (const c of [ix(x, y), ix(x + 1, y), ix(x, y + 1), ix(x + 1, y + 1)]) s.cells[c] = p;
    else s.cells[ix(x, y)] = p;
  }
  return s;
}
const at = (s, x, y) => s.cells[ix(x, y)];
const dests = (s, x, y, kind) =>
  movesFrom(s, ix(x, y))
    .filter((m) => !kind || m.kind === kind)
    .map((m) => [m.to % N, (m.to / N) | 0].join(","))
    .sort();
const play = (s, fx, fy, tx, ty, kind) => {
  const m = movesFrom(s, ix(fx, fy)).find((m) => m.to === ix(tx, ty) && (!kind || m.kind === kind));
  assert.ok(m, `no move ${fx},${fy} → ${tx},${ty}`);
  return applyMove(s, m);
};
// a kings-only skeleton so that nobody wins by accident
const K0 = ["K", 0, 0, 5];
const K1 = ["K", 1, 5, 0];

test("new fight: 6×6, full armies, player moves first, every square starts at 4", () => {
  const s = newFight({ boss: "prospector", seed: 3 });
  assert.equal(s.turn, 0);
  assert.equal(bodies(s, 0).length, 12);
  assert.equal(bodies(s, 1).length, 12);
  assert.ok(s.integ.every((v) => v === 4));
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((x) => at(s, x, 5).t),
    ["R", "N", "Q", "B", "K", "R"],
  );
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((x) => at(s, x, 0).t),
    ["R", "K", "B", "Q", "N", "R"],
  );
});

test("opening: nothing wins or scores for free on move one (the Glitch trade is guarded)", () => {
  const s = newFight({ boss: "trapper", seed: 1 });
  const first = legalMoves(s).filter((m) => m.kind === "capture" || m.kind === "push");
  // the only thing the player can take is the boss's Glitch, and the boss can take it back
  assert.deepEqual(
    first.map((m) => s.cells[m.to].t),
    ["N"],
  );
  const r = applyMove(s, first[0]);
  assert.equal(r.scale, 3);
  assert.equal(r.pending, null, "no phase change yet");
  const back = legalMoves(r).filter((m) => m.kind === "capture" && m.to === first[0].to);
  assert.ok(back.length >= 1, "the boss can recapture");
  const after = applyMove(r, back[0]);
  assert.equal(after.scale, 0);
  assert.equal(after.pending, null, "retaken: phase 1 is not skipped");
});

test("pawn: one step, diagonal captures, no forward capture, promotes to queen", () => {
  let s = board([K0, K1, ["P", 0, 2, 3], ["P", 1, 3, 2], ["P", 1, 2, 2]]);
  assert.deepEqual(dests(s, 2, 3), ["3,2"]); // blocked ahead, captures diagonally
  s = board([K0, K1, ["P", 0, 2, 1]]);
  s = play(s, 2, 1, 2, 0);
  assert.equal(at(s, 2, 0).t, "Q");
  // the boss's pawns march the other way
  s = board([K0, K1, ["P", 1, 2, 2]]);
  s.turn = 1;
  assert.deepEqual(dests(s, 2, 2), ["2,3"]);
});

test("knight (glitch): teleports through the centre, captures there, illegal on friend or hole; also steps like a king", () => {
  let s = board([K0, K1, ["N", 0, 1, 4]]);
  assert.ok(dests(s, 1, 4).includes("4,1"));
  assert.ok(dests(s, 1, 4).includes("2,3")); // king step so it is never stuck
  s = board([K0, K1, ["N", 0, 1, 4], ["P", 1, 4, 1]]);
  assert.ok(movesFrom(s, ix(1, 4)).some((m) => m.to === ix(4, 1) && m.kind === "capture" && m.tele));
  s = board([K0, K1, ["N", 0, 1, 4], ["P", 0, 4, 1]]);
  assert.ok(!dests(s, 1, 4).includes("4,1"));
  s = board([K0, K1, ["N", 0, 1, 4]]);
  s.integ[ix(4, 1)] = 0;
  assert.ok(!dests(s, 1, 4).includes("4,1"));
  // x → 5−x, y → 5−y for every square
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++) {
      const t = board([["N", 0, x, y]]);
      assert.ok(movesFrom(t, ix(x, y)).some((m) => m.tele && m.to === ix(5 - x, 5 - y)));
    }
});

test("bishop (light ray): slides diagonally and bounces once off an edge", () => {
  let s = board([K0, K1, ["B", 0, 3, 5]]);
  // (3,5) → (4,4) → (5,3) → edge → (4,2) → (3,1) → (2,0), then a second edge: stops
  const d = dests(s, 3, 5);
  for (const c of ["4,4", "5,3", "4,2", "3,1", "2,0"]) assert.ok(d.includes(c), c);
  // can capture after the bounce
  s = board([K0, K1, ["B", 0, 3, 5], ["P", 1, 4, 2]]);
  assert.ok(movesFrom(s, ix(3, 5)).some((m) => m.to === ix(4, 2) && m.kind === "capture"));
  assert.ok(!dests(s, 3, 5).includes("3,1"), "stops at the first enemy");
  // only one bounce: with the other diagonal blocked, the squares past a second edge are out of reach
  s = board([K0, K1, ["B", 0, 4, 5], ["P", 0, 3, 4]]);
  const one = dests(s, 4, 5);
  assert.ok(one.includes("1,0"), "end of the first bounce");
  assert.ok(!one.includes("0,1"), "a second bounce is not allowed");
  // blocked by a friend before the bounce
  s = board([K0, K1, ["B", 0, 3, 5], ["P", 0, 5, 3]]);
  assert.ok(!dests(s, 3, 5).includes("4,2"));
});

test("rook (bulldozer): slides, never captures by landing, needs a square of travel before it pushes", () => {
  let s = board([K0, K1, ["R", 0, 2, 5], ["P", 1, 2, 2]]);
  const m = movesFrom(s, ix(2, 5));
  assert.ok(m.some((x) => x.to === ix(2, 3) && x.kind === "move"));
  assert.ok(m.some((x) => x.to === ix(2, 2) && x.kind === "push"));
  assert.ok(!m.some((x) => x.kind === "capture"));
  // adjacent target: no travel, no push
  s = board([K0, K1, ["R", 0, 2, 3], ["P", 1, 2, 2]]);
  assert.ok(!movesFrom(s, ix(2, 3)).some((x) => x.kind === "push"));
});

test("push chain: every piece behind moves one square further", () => {
  let s = board([K0, K1, ["R", 0, 2, 5], ["P", 1, 2, 2]]);
  // rook at (2,5), one enemy pawn at (2,2) with room behind it
  s = play(s, 2, 5, 2, 2, "push");
  assert.equal(at(s, 2, 2).t, "R");
  assert.equal(at(s, 2, 1).t, "P");
  assert.equal(at(s, 2, 5), null);
  // three in a row, friends included
  s = board([K0, K1, ["R", 0, 2, 5], ["P", 1, 2, 3], ["N", 0, 2, 2], ["B", 1, 2, 1]]);
  const plan = pushPlan(s, ix(2, 3), [0, -1], "p2");
  assert.equal(plan.bodies.length, 3);
  s.cells[ix(2, 4)] = null;
  s = play(s, 2, 5, 2, 3, "push");
  assert.deepEqual([at(s, 2, 3).t, at(s, 2, 2).t, at(s, 2, 1).t, at(s, 2, 0).t], ["R", "P", "N", "B"]);
  assert.equal(s.scale, 0, "nothing fell");
});

test("push chain: pushed off the board or into a hole is destroyed and counts for the pusher", () => {
  // off the board
  let s = board([K0, K1, ["R", 0, 2, 5], ["P", 1, 2, 1], ["N", 1, 2, 0]]);
  s = play(s, 2, 5, 2, 1, "push");
  assert.equal(at(s, 2, 0).t, "P");
  // the knight, last in the chain, was pushed off: scale +3 for the player
  assert.equal(s.scale, 3);
  assert.ok(s.events.some((e) => e.k === "destroy" && e.why === "fall" && e.t === "N"));
  // into a hole
  s = board([K0, K1, ["R", 0, 2, 5], ["P", 1, 2, 2]]);
  s.integ[ix(2, 1)] = 0;
  s = play(s, 2, 5, 2, 2, "push");
  assert.equal(s.scale, 1);
  assert.equal(at(s, 2, 2).t, "R");
  assert.equal(at(s, 2, 1), null);
  // pushing your own piece into the void gives the boss the points
  s = board([K0, K1, ["R", 0, 2, 5], ["P", 0, 2, 2]]);
  s.integ[ix(2, 1)] = 0;
  s = play(s, 2, 5, 2, 2, "push");
  assert.equal(s.scale, -1);
});

test("push: a gold block cannot be pushed; a rook cannot push through one", () => {
  const s = board([K0, K1, ["R", 0, 2, 5], ["G", 2, 2, 2]]);
  assert.ok(!movesFrom(s, ix(2, 5)).some((m) => m.kind === "push" && m.to === ix(2, 2)));
  assert.ok(!dests(s, 2, 5, "move").includes("2,1"), "the block stops the slide");
  assert.equal(pushPlan(s, ix(2, 2), [0, -1], "x"), null);
});

test("queen and king: classic moves, no check rule, a king can be taken", () => {
  let s = board([K0, K1, ["Q", 0, 3, 3]]);
  const d = dests(s, 3, 3);
  assert.ok(d.includes("3,0") && d.includes("0,3") && d.includes("5,5") && d.includes("0,0"));
  assert.equal(dests(s, 0, 5).length, 3);
  s = board([K0, K1, ["Q", 0, 3, 0]]);
  s = play(s, 3, 0, 5, 0, "capture"); // takes the king
  assert.deepEqual(s.over, { winner: 0, reason: "king" });
});

test("holes: nothing can enter them", () => {
  const s = board([K0, K1, ["Q", 0, 3, 3]]);
  s.integ[ix(3, 2)] = 0;
  const d = dests(s, 3, 3);
  assert.ok(!d.includes("3,2") && !d.includes("3,1") && !d.includes("3,0"), "cannot slide over a hole");
});

test("erosion: every departure costs the square one point; at 0 it is a hole", () => {
  let s = board([K0, K1, ["Q", 0, 3, 3]]);
  s = play(s, 3, 3, 3, 2);
  assert.equal(s.integ[ix(3, 3)], 3);
  s.turn = 0;
  s.integ[ix(3, 2)] = 1;
  s = play(s, 3, 2, 3, 1);
  assert.equal(s.integ[ix(3, 2)], 0);
  assert.ok(isHole(s, ix(3, 2)));
  assert.ok(s.events.some((e) => e.k === "hole" && e.at === ix(3, 2)));
});

test("wind: drift one square downwind, resolved from the downwind side; pieces in a line all move", () => {
  const s = board([K0, K1, ["P", 0, 1, 3], ["P", 0, 2, 3], ["P", 1, 3, 3]]);
  blow(s, 1); // east
  assert.deepEqual([at(s, 2, 3)?.s, at(s, 3, 3)?.s, at(s, 4, 3)?.s], [0, 0, 1]);
  assert.equal(at(s, 1, 3), null);
});

test("wind: a piece pressed against the edge stays (default); into a hole it is lost and nobody scores", () => {
  const s = board([K0, K1, ["P", 0, 5, 3], ["P", 0, 2, 3]]);
  blow(s, 1);
  assert.ok(at(s, 5, 3), "edge piece stays");
  assert.equal(at(s, 3, 3).t, "P");
  const t = board([K0, K1, ["P", 0, 2, 3]]);
  t.integ[ix(3, 3)] = 0;
  blow(t, 1);
  assert.equal(at(t, 2, 3), null);
  assert.equal(t.scale, 0);
  // the literal reading of the brief is available as a rule
  const e = board([K0, K1, ["P", 0, 5, 3]], { windEdgeKills: true });
  blow(e, 1);
  assert.equal(at(e, 5, 3), null);
});

test("wind: Rooted ignores it; blows after round 3, warned a round ahead", () => {
  const r = board([K0, K1, ["P", 0, 2, 3, { g: ["rooted"] }]]);
  blow(r, 1);
  assert.ok(at(r, 2, 3));
  let s = newFight({ boss: "prospector", seed: 11 });
  const seen = [];
  const rng = makeRng(5);
  for (let i = 0; i < 12 && !s.over; i++) {
    const ms = legalMoves(s);
    s = applyMove(s, ms[rng.int(ms.length)], { auto: true });
    if (s.over) break;
    const ms2 = legalMoves(s);
    s = applyMove(s, ms2[rng.int(ms2.length)], { auto: true });
    seen.push(...s.events.filter((e) => e.k === "windwarn" || e.k === "windblow").map((e) => `${e.k}@${s.round}`));
  }
  const warn = seen.find((x) => x.startsWith("windwarn"));
  assert.ok(warn, "a warning came");
  assert.ok(seen.some((x) => x.startsWith("windblow")), "then the wind blew");
  // warn happens at the end of round 2 (round counter then reads 3), blow at the end of round 3 (reads 4)
  assert.equal(warn, "windwarn@3");
  assert.equal(seen.find((x) => x.startsWith("windblow")), "windblow@4");
});

test("sigils: Pusher lets any piece shove instead of capture; Ghost slips through one piece", () => {
  let s = board([K0, K1, ["Q", 0, 3, 5, { g: ["pusher"] }], ["P", 1, 3, 3]]);
  const m = movesFrom(s, ix(3, 5));
  assert.ok(m.some((x) => x.to === ix(3, 3) && x.kind === "capture"));
  assert.ok(m.some((x) => x.to === ix(3, 3) && x.kind === "push"));
  s = board([K0, K1, ["R", 0, 3, 5, { g: ["ghost"] }], ["P", 0, 3, 4]]);
  assert.ok(dests(s, 3, 5, "move").includes("3,2"), "passes through its own pawn");
  s = board([K0, K1, ["B", 0, 2, 5, { g: ["ghost"] }], ["P", 0, 3, 4]]);
  assert.ok(dests(s, 2, 5, "move").includes("4,3"));
});

test("scale: values 1 3 3 4 5 5, +5 net wins, boss wins at −5, tie at 40 rounds goes to the boss", () => {
  let s = board([K0, K1, ["Q", 0, 2, 2], ["Q", 1, 2, 0]]);
  s = play(s, 2, 2, 2, 0, "capture"); // queen: +5
  assert.deepEqual(s.over, { winner: 0, reason: "scale" });
  s = board([K0, K1, ["B", 1, 0, 0], ["N", 0, 3, 3]]);
  s.turn = 1;
  s.scale = -2;
  s = play(s, 0, 0, 3, 3, "capture");
  assert.equal(s.scale, -5);
  assert.deepEqual(s.over, { winner: 1, reason: "scale" });
  // 40 rounds
  let t = board([K0, K1, ["P", 0, 0, 4], ["P", 1, 5, 1]], { roundLimit: 2 });
  t.scale = 1;
  t = play(t, 0, 4, 0, 3);
  t = play(t, 5, 1, 5, 2);
  t = play(t, 0, 3, 0, 2);
  t = play(t, 5, 2, 5, 3);
  assert.equal(t.over.reason, "rounds");
  assert.equal(t.over.winner, 0);
  let u = board([K0, K1, ["P", 0, 0, 4], ["P", 1, 5, 1]], { roundLimit: 1 });
  u = play(u, 0, 4, 0, 3);
  u = play(u, 5, 1, 5, 2);
  assert.equal(u.over.winner, 1, "a tie goes to the boss");
});

test("instant win: a king pushed off the board or into a hole", () => {
  let s = board([["K", 0, 0, 5], ["K", 1, 3, 0], ["R", 0, 3, 5]]);
  s = play(s, 3, 5, 3, 0, "push");
  assert.deepEqual(s.over, { winner: 0, reason: "king" });
  s = board([["K", 0, 0, 5], ["K", 1, 3, 1], ["R", 0, 3, 5]]);
  s.integ[ix(3, 0)] = 0;
  s = play(s, 3, 5, 3, 1, "push");
  assert.equal(s.over.winner, 0);
});

test("the Trapper hides three traps in the middle rows; a piece that lands on one dies and the boss scores", () => {
  const s = newFight({ boss: "trapper", seed: 21 });
  assert.equal(s.traps.length, 3);
  assert.ok(s.traps.every((t) => [2, 3].includes(Math.floor(t / N))));
  const t = board([K0, K1, ["R", 0, 2, 5]]);
  t.traps = [ix(2, 3)];
  const r = play(t, 2, 5, 2, 3);
  assert.equal(at(r, 2, 3), null);
  assert.equal(r.scale, -4);
  assert.ok(r.events.some((e) => e.k === "trap"));
  assert.equal(r.traps.length, 0);
});

test("the Angler hooks your best non-king piece towards him every 4 rounds; into a hole it falls", () => {
  let s = board([K0, K1, ["Q", 0, 2, 4], ["P", 0, 1, 4]], {}, "angler");
  s.round = 4;
  s.turn = 1;
  s.boss.hook = null;
  s = applyMoveAny(s);
  assert.ok(s.events.some((e) => e.k === "hook" && !e.slack && e.id === "p2"));
  assert.equal(at(s, 2, 3)?.t, "Q");
  let h = board([K0, K1, ["Q", 0, 2, 4]], {}, "angler");
  h.round = 4;
  h.turn = 1;
  h.integ[ix(2, 3)] = 0;
  h = applyMoveAny(h);
  assert.equal(at(h, 2, 3), null);
  assert.equal(h.scale, -5, "the boss scores the queen it fished up");
  assert.ok(h.events.some((e) => e.k === "hook" && e.falls));
});
// the boss makes any legal move so that the round ends
function applyMoveAny(s) {
  const ms = legalMoves(s);
  return applyMove(s, ms[0], { auto: true });
}

test("the Angler's bait costs the player the next turn when captured", () => {
  let s = board([K0, K1, ["P", 0, 2, 3], ["P", 1, 3, 2, { bait: true }]], {}, "angler");
  assert.ok(!legalMoves(s, 1).some((m) => m.from === ix(3, 2)), "bait never moves");
  s = play(s, 2, 3, 3, 2, "capture");
  assert.equal(s.skip[0], 1);
  assert.ok(s.events.some((e) => e.k === "bait"));
  // the boss moves, the player's next turn is missed, so the boss moves again
  s = applyMoveAny(s);
  assert.equal(s.turn, 1);
  assert.equal(s.skip[0], 0);
  assert.ok(s.events.some((e) => e.k === "skip" && e.side === 0));
});

test("the Prospector turns your most advanced non-king piece into gold; phase 2 cracks every block into a hole", () => {
  let s = board([K0, K1, ["P", 0, 2, 2], ["Q", 0, 3, 4], ["P", 0, 1, 4]], {}, "prospector");
  s.round = 3;
  s.turn = 1;
  s = applyMoveAny(s);
  assert.equal(at(s, 2, 2).t, "G");
  assert.equal(at(s, 2, 2).s, 2);
  s.boss.phase = 1;
  s.pending = { type: "phase2" };
  const r = resolvePending(s);
  assert.equal(at(r, 2, 2), null);
  assert.ok(isHole(r, ix(2, 2)));
  assert.equal(r.boss.phase, 2);
});

test("phase 2 triggers the first time the scale reaches +3", () => {
  let s = board([K0, K1, ["B", 0, 0, 3], ["N", 1, 3, 0]], {}, "prospector");
  s = board([K0, K1, ["B", 0, 3, 5], ["N", 1, 4, 4]], {}, "prospector");
  assert.equal(s.pending, null);
  s = play(s, 3, 5, 4, 4, "capture");
  assert.equal(s.pending, null, "not yet: the boss gets his reply first");
  s = applyMove(s, legalMoves(s)[0]); // the boss replies; the round ends
  assert.deepEqual(s.pending, { type: "phase2" });
});

test("the Trader: once, swap a piece on the board for one you lost", () => {
  let s = board([K0, K1, ["P", 0, 2, 3], ["P", 1, 4, 1]], {}, "trapper");
  s.boss.phase = 2;
  s.gone = [{ id: "pq", t: "Q", g: [] }];
  s.pending = { type: "trade" };
  const o = tradeOptions(s);
  assert.deepEqual(o.give, [ix(2, 3)]);
  s = applyTrade(s, ix(2, 3), 0);
  assert.equal(at(s, 2, 3).t, "Q");
  assert.equal(s.scale, -1);
  assert.equal(s.tradeUsed, true);
  assert.equal(s.pending, null);
});

test("the Woodcarver wears a mask, and phase 2 swaps his king for the 2×2 Moon", () => {
  let s = newFight({ boss: "woodcarver", seed: 5 });
  assert.ok(["trapper", "angler", "prospector"].includes(s.boss.mask));
  assert.equal(effective(s), s.boss.mask);
  s.boss.phase = 1;
  s.pending = { type: "phase2" };
  s = resolvePending(s);
  const moon = moonOf(s);
  assert.ok(moon);
  assert.equal(effective(s), "moon");
  assert.equal(bodies(s, 1).filter((b) => b.p.t === "K").length, 0);
  assert.equal([...s.cells].filter((c) => c?.id === "moon").length, 4);
});

test("the Moon: moves one square orthogonally as a 2×2 body, cannot be captured, ignores wind", () => {
  let s = board([K0, ["R", 1, 5, 4], ["P", 0, 3, 3]], {}, "woodcarver");
  const moon = { id: "moon", t: "M", s: 1, x: 2, y: 0 };
  for (const c of [ix(2, 0), ix(3, 0), ix(2, 1), ix(3, 1)]) s.cells[c] = moon;
  s.boss.phase = 2;
  s.turn = 1;
  const m = legalMoves(s, 1).filter((x) => x.from === ix(2, 0));
  assert.deepEqual(m.map((x) => x.to).sort((a, b) => a - b), [ix(1, 0), ix(2, 1), ix(3, 0)].sort((a, b) => a - b)); // not up: off the board
  const r = applyMove(s, m.find((x) => x.to === ix(2, 1)));
  assert.equal(r.cells[ix(2, 2)]?.id, "moon");
  assert.equal(r.cells[ix(2, 0)], null);
  assert.equal(r.integ[ix(2, 0)], 3, "the squares it leaves erode");
  // a queen cannot take it
  const q = board([K0, K1, ["Q", 0, 2, 3]], {}, "woodcarver");
  for (const c of [ix(2, 1), ix(3, 1), ix(2, 2), ix(3, 2)]) q.cells[c] = { id: "moon", t: "M", s: 1, x: 2, y: 1 };
  assert.ok(!movesFrom(q, ix(2, 3)).some((x) => x.kind === "capture" && q.cells[x.to].t === "M"));
  // wind does not move it
  blow(q, 1);
  assert.equal(q.cells[ix(2, 1)].t, "M");
});

test("the Moon falls (and the run is won) when any of its cells is pushed over a hole or off the board", () => {
  const mk = () => {
    const s = board([["K", 0, 0, 5], ["R", 0, 2, 5], ["P", 1, 0, 0]], {}, "woodcarver");
    const moon = { id: "moon", t: "M", s: 1, x: 2, y: 1 };
    for (const c of [ix(2, 1), ix(3, 1), ix(2, 2), ix(3, 2)]) s.cells[c] = moon;
    s.boss.phase = 2;
    return s;
  };
  // into a hole under one of its four cells
  let s = mk();
  s.integ[ix(2, 0)] = 0;
  s = play(s, 2, 5, 2, 2, "push");
  assert.deepEqual(s.over, { winner: 0, reason: "moon" });
  assert.ok(s.events.some((e) => e.k === "moonfall"));
  // off the board
  const t = mk();
  for (const c of [ix(2, 1), ix(3, 1), ix(2, 2), ix(3, 2)]) t.cells[c] = null;
  const moon = { id: "moon", t: "M", s: 1, x: 2, y: 0 };
  for (const c of [ix(2, 0), ix(3, 0), ix(2, 1), ix(3, 1)]) t.cells[c] = moon;
  const r = play(t, 2, 5, 2, 1, "push");
  assert.equal(r.over.winner, 0);
});

test("the Moon strikes its rows every second round, except across holes; the scale no longer ends the fight", () => {
  let s = board([K0, ["P", 1, 5, 2], ["P", 0, 4, 3], ["P", 0, 0, 1], ["P", 0, 1, 3]], {}, "woodcarver");
  const moon = { id: "moon", t: "M", s: 1, x: 2, y: 1 };
  for (const c of [ix(2, 1), ix(3, 1), ix(2, 2), ix(3, 2)]) s.cells[c] = moon;
  s.boss.phase = 2;
  s.round = 2;
  s.integ[ix(1, 1)] = 0; // a hole between the moon and the pawn at (0,1)
  s.turn = 1;
  const r = applyMove(s, legalMoves(s, 1).find((m) => m.from === ix(5, 2)));
  assert.ok(r.events.some((e) => e.k === "moonstrike"));
  assert.ok(r.cells[ix(0, 1)], "behind a hole: safe");
  assert.ok(r.cells[ix(4, 3)], "not in its rows");
  // a pawn in its row dies, and the scale (−1) does not end anything
  const t = board([K0, ["P", 1, 5, 1], ["P", 0, 4, 2]], {}, "woodcarver");
  for (const c of [ix(2, 1), ix(3, 1), ix(2, 2), ix(3, 2)]) t.cells[c] = { id: "moon", t: "M", s: 1, x: 2, y: 1 };
  t.boss.phase = 2;
  t.round = 2;
  t.turn = 1;
  t.scale = 4;
  const u = applyMove(t, legalMoves(t, 1).find((m) => m.from === ix(5, 1)));
  assert.equal(u.cells[ix(4, 2)], null);
  assert.equal(u.over, null);
});

test("woodcarver switches mask once, at round 10", () => {
  let s = board([K0, K1, ["P", 0, 0, 4], ["P", 1, 5, 1]], {}, "woodcarver");
  s.boss.mask = "angler";
  s.round = 10;
  s.turn = 1;
  s = applyMoveAny(s);
  assert.notEqual(s.boss.mask, "angler");
  assert.ok(s.events.some((e) => e.k === "mask" && e.switched));
});

test("state is plain data, copies share nothing mutable, and a seed reproduces a fight", () => {
  const a = newFight({ boss: "trapper", seed: 99 });
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(a)));
  const b = cloneState(a);
  b.cells[0] = null;
  b.integ[0] = 1;
  assert.ok(a.cells[0]);
  assert.equal(a.integ[0], 4);
  const run = (seed) => {
    let s = newFight({ boss: "woodcarver", seed });
    const rng = makeRng(seed);
    for (let i = 0; i < 60 && !s.over; i++) {
      const ms = legalMoves(s);
      s = ms.length ? applyMove(s, ms[rng.int(ms.length)], { auto: true }) : passStuck(s);
    }
    return JSON.stringify([s.cells, s.integ, s.scale, s.round, s.over]);
  };
  assert.equal(run(4), run(4));
  assert.notEqual(run(4), run(5));
});

test("random playouts never break the engine (no illegal state, every move applies)", () => {
  for (const boss of ["trapper", "angler", "prospector", "woodcarver"]) {
    for (let seed = 1; seed <= 6; seed++) {
      let s = newFight({ boss, seed });
      const rng = makeRng(seed * 31);
      for (let i = 0; i < 120 && !s.over; i++) {
        if (s.pending?.type === "phase2") s = resolvePending(s);
        if (s.pending?.type === "trade") {
          const o = tradeOptions(s);
          s = o.give.length && rng() < 0.5 ? applyTrade(s, o.give[0], 0) : { ...s, pending: null, tradeUsed: true };
        }
        const ms = legalMoves(s);
        s = ms.length ? applyMove(s, ms[rng.int(ms.length)]) : passStuck(s);
        // invariants
        for (let c = 0; c < N * N; c++) {
          const p = s.cells[c];
          if (p) assert.ok(!isHole(s, c), `piece on a hole at ${c} (${boss} ${seed} step ${i})`);
        }
      }
    }
  }
});

test("AI: always returns a legal move and takes a free queen", () => {
  let s = board([K0, K1, ["B", 1, 0, 0], ["Q", 0, 3, 3], ["P", 0, 0, 4]], {}, "prospector");
  s.turn = 1;
  const mv = chooseMove(s, { depth: 2, boss: "prospector", rng: makeRng(1) });
  assert.ok(legalMoves(s, 1).some((m) => m.from === mv.from && m.to === mv.to && m.kind === mv.kind));
  assert.equal(mv.to, ix(3, 3));
  const f = newFight({ boss: "angler", seed: 2 });
  const m2 = chooseMove(applyMove(f, legalMoves(f)[0]), { depth: 2, boss: "angler", rng: makeRng(2) });
  assert.ok(m2);
  assert.equal(typeof evaluate(f, "angler"), "number");
});
