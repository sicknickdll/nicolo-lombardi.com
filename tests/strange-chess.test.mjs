// Strange Chess: the rules engine (js/strange-chess/rules.js).   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import * as R from "../js/strange-chess/rules.js";

// A position from a list of [side, type, x, y, extra]; every other square empty, integrity 4.
// The wind is off unless a test turns it on (config.wind), so it can't move pieces mid-test.
function make(list, opts = {}) {
  const s = R.newFight({ seed: 5, ...opts, config: { wind: false, ...opts.config } });
  s.pieces = [];
  s.traps = [];
  s.events = [];
  for (const [side, t, x, y, extra] of list) s.pieces.push({ id: s.nextId++, t, side, x, y, slot: 0, sig: [], ...extra });
  return s;
}
const at = (s, x, y) => R.pieceAt(s, x, y);
const targets = (s, x, y, kind) =>
  R.movesFor(s, at(s, x, y).id)
    .filter((m) => !kind || m.kind === kind)
    .map((m) => `${m.x},${m.y}`)
    .sort();
const move = (s, fx, fy, tx, ty, kind) => {
  const m = R.movesFor(s, at(s, fx, fy).id).find((m) => m.x === tx && m.y === ty && (!kind || m.kind === kind));
  assert.ok(m, `no move ${fx},${fy} → ${tx},${ty} ${kind || ""}`);
  return R.applyMove(s, m);
};
const pass = (s) => R.applyMove(s, { kind: "pass" });

test("opening layout: R N Q B K R, the boss's rotated 180°; the knights face each other", () => {
  const s = R.newFight({ seed: 1 });
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((x) => at(s, x, 0).t).join(""), "RNQBKR");
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((x) => at(s, x, 5).t).join(""), "RKBQNR");
  assert.ok([0, 1, 2, 3, 4, 5].every((x) => at(s, x, 1).t === "P" && at(s, x, 4).t === "P"));
  // the player's knight mirrors onto the boss's knight (not his king), guarded by his queen
  const caps = R.movesFor(s, at(s, 1, 0).id).filter((m) => m.kind === "cap");
  assert.deepEqual(caps.map((m) => [m.x, m.y, at(s, m.x, m.y).t]), [[4, 5, "N"]]);
  const after = R.applyMove(s, caps[0]);
  assert.ok(R.movesFor(after, at(after, 3, 5).id).some((m) => m.x === 4 && m.y === 5 && m.kind === "cap"));
  // no first move takes a king
  for (const m of R.legalMoves(s)) if (m.kind === "cap") assert.notEqual(at(s, m.x, m.y).t, "K");
});

test("pawn: one step forward, captures diagonally, promotes to a queen", () => {
  let s = make([["p", "P", 2, 1], ["b", "P", 3, 2], ["b", "P", 2, 2], ["p", "K", 0, 0], ["b", "K", 5, 5]]);
  assert.deepEqual(targets(s, 2, 1), ["3,2"]); // blocked ahead, takes diagonally
  s = make([["p", "P", 2, 4], ["p", "K", 0, 0], ["b", "K", 5, 0]]);
  s = move(s, 2, 4, 2, 5);
  assert.equal(at(s, 2, 5).t, "Q");
  const b = make([["b", "P", 3, 4], ["p", "K", 0, 0], ["b", "K", 5, 5]]);
  b.turn = "b";
  assert.deepEqual(targets(b, 3, 4), ["3,3"]); // the boss's pawns go down
});

test("knight · Glitch: teleports to the mirrored square, or one king step", () => {
  let s = make([["p", "N", 1, 1], ["p", "K", 0, 5], ["b", "K", 5, 0]]);
  assert.ok(targets(s, 1, 1).includes("4,4"));
  assert.equal(targets(s, 1, 1).length, 9); // mirror + 8 king steps
  // a friend or a hole on the mirror square makes it illegal; an enemy is captured
  s = make([["p", "N", 1, 1], ["p", "R", 4, 4], ["p", "K", 0, 5], ["b", "K", 5, 0]]);
  assert.ok(!targets(s, 1, 1).includes("4,4"));
  s = make([["p", "N", 1, 1], ["p", "K", 0, 5], ["b", "K", 5, 0]]);
  s.integ[4 * 6 + 4] = 0;
  assert.ok(!targets(s, 1, 1).includes("4,4"));
  s = make([["p", "N", 1, 1], ["b", "Q", 4, 4], ["p", "K", 0, 5], ["b", "K", 5, 0]]);
  s = move(s, 1, 1, 4, 4, "cap");
  assert.equal(at(s, 4, 4).t, "N");
  assert.equal(s.scale, 5);
});

test("bishop · Light ray: slides diagonally and bounces once off an edge", () => {
  let s = make([["p", "B", 1, 0], ["p", "K", 5, 5], ["b", "K", 5, 3]]);
  const t = targets(s, 1, 0);
  // up-left: 0,1 then bounce off the left edge → 1,2 2,3 3,4 4,5 (no second bounce)
  for (const sq of ["0,1", "1,2", "2,3", "3,4", "4,5"]) assert.ok(t.includes(sq), sq);
  // up-right: 2,1 3,2 4,3 5,4 then bounce off the right edge → 4,5
  for (const sq of ["2,1", "3,2", "4,3", "5,4"]) assert.ok(t.includes(sq), sq);
  // down: it starts on the bottom edge, so it bounces straight back up (same squares)
  assert.ok(!t.includes("1,0"));
  // captures after the bounce
  s = make([["p", "B", 1, 0], ["b", "N", 2, 3], ["p", "K", 5, 5], ["b", "K", 5, 3]]);
  assert.ok(targets(s, 1, 0, "cap").includes("2,3"));
  // a hole stops the ray
  s = make([["p", "B", 1, 0], ["p", "K", 5, 5], ["b", "K", 5, 3]]);
  s.integ[1 * 6 + 2] = 0; // 2,1
  assert.ok(!targets(s, 1, 0).includes("3,2"));
});

test("rook · Bulldozer: never captures by landing, pushes after at least one square", () => {
  let s = make([["p", "R", 0, 2], ["b", "N", 1, 2], ["b", "P", 3, 2], ["p", "K", 0, 0], ["b", "K", 5, 5]]);
  assert.deepEqual(targets(s, 0, 2, "cap"), []);
  assert.ok(!targets(s, 0, 2, "push").includes("1,2"), "no push of an adjacent piece");
  s = make([["p", "R", 0, 2], ["b", "N", 2, 2], ["b", "P", 3, 2], ["p", "K", 0, 0], ["b", "K", 5, 5]]);
  s = move(s, 0, 2, 2, 2, "push");
  assert.equal(at(s, 2, 2).t, "R");
  assert.equal(at(s, 3, 2).t, "N");
  assert.equal(at(s, 4, 2).t, "P");
  assert.equal(s.scale, 0);
});

test("push chains: off the board and into a hole destroy, and score for the pusher", () => {
  let s = make([["p", "R", 1, 3], ["b", "N", 3, 3], ["b", "B", 4, 3], ["b", "Q", 5, 3], ["p", "K", 0, 0], ["b", "K", 5, 5]]);
  s = move(s, 1, 3, 3, 3, "push");
  assert.equal(at(s, 4, 3).t, "N");
  assert.equal(at(s, 5, 3).t, "B");
  assert.ok(!s.pieces.some((p) => p.t === "Q" && p.side === "b"));
  assert.equal(s.scale, 5);
  s = make([["p", "R", 0, 3], ["b", "N", 2, 3], ["p", "K", 0, 0], ["b", "K", 5, 5]]);
  s.integ[3 * 6 + 3] = 0;
  s = move(s, 0, 3, 2, 3, "push");
  assert.ok(!s.pieces.some((p) => p.t === "N"));
  assert.equal(s.scale, 3);
  // pushing your own piece away scores nothing
  s = make([["p", "R", 0, 3], ["p", "N", 2, 3], ["p", "K", 0, 0], ["b", "K", 5, 5]]);
  s.integ[3 * 6 + 3] = 0;
  s = move(s, 0, 3, 2, 3, "push");
  assert.equal(s.scale, 0);
  // gold can't be pushed
  s = make([["p", "R", 0, 3], ["b", "N", 2, 3], [null, "G", 3, 3], ["p", "K", 0, 0], ["b", "K", 5, 5]]);
  assert.ok(!targets(s, 0, 3, "push").includes("2,3"));
});

test("a King pushed off the board or into a hole ends the fight at once", () => {
  let s = make([["p", "R", 0, 5], ["b", "K", 5, 5], ["p", "K", 0, 0], ["b", "P", 3, 3]]);
  s = move(s, 0, 5, 5, 5, "push");
  assert.deepEqual(s.result, { winner: "p", reason: "king" });
});

test("queen and king: classic", () => {
  const s = make([["p", "Q", 2, 2], ["p", "K", 0, 0], ["b", "K", 5, 5], ["b", "P", 2, 4]]);
  const t = targets(s, 2, 2);
  assert.ok(t.includes("2,4") && !t.includes("2,5"));
  assert.equal(targets(s, 0, 0).length, 3);
});

test("wind: announced a round ahead, blows every 3 rounds, downwind pieces move first", () => {
  let s = make([["p", "K", 0, 0], ["b", "K", 5, 5], ["p", "P", 2, 2], ["p", "P", 3, 2], ["p", "P", 4, 2]], { config: { wind: true } });
  s = pass(pass(s)); // round 1
  assert.equal(s.wind.dir, null);
  s = pass(pass(s)); // round 2: the warning
  assert.ok(s.events.some((e) => e.type === "windWarn"));
  s.wind.dir = "E";
  s = pass(pass(s)); // round 3: the gust
  // the row of three all moved right (downwind first, so none blocked the others)
  assert.equal(at(s, 3, 2).t, "P");
  assert.equal(at(s, 4, 2).t, "P");
  assert.equal(at(s, 5, 2).t, "P");
  assert.equal(at(s, 2, 2), null);
});

test("wind: the edge holds by default; config.windOffEdge blows pieces off; holes swallow", () => {
  const mk = (cfg) => {
    const s = make([["p", "K", 2, 0], ["b", "K", 2, 5], ["p", "P", 5, 2], ["p", "R", 1, 3], ["b", "N", 3, 4, { sig: ["rooted"] }]], { config: { wind: true, ...cfg } });
    s.wind = { dir: "E", at: 1, last: null };
    return s;
  };
  let s = R.gust(mk({}));
  assert.equal(at(s, 5, 2).t, "P"); // held by the edge
  s = R.gust(mk({ windOffEdge: true }));
  assert.equal(at(s, 5, 2), null); // literal rule: gone
  assert.equal(s.scale, 0); // nobody scores the wind
  s = mk({});
  s.integ[3 * 6 + 2] = 0; // a hole at 2,3, downwind of the rook
  s = R.gust(s);
  assert.ok(!s.pieces.some((p) => p.t === "R"));
  assert.equal(s.scale, 0);
  assert.equal(at(s, 3, 4).t, "N"); // Rooted ignores the wind
});

test("erosion: leaving a square wears it @ → 0 → o → . → hole; nothing enters a hole", () => {
  let s = make([["p", "K", 0, 0], ["b", "K", 5, 5]]);
  for (let i = 0; i < 4; i++) {
    s = move(s, 0, 0, 1, 0);
    s = pass(s);
    if (i < 3) {
      s = move(s, 1, 0, 0, 0);
      s = pass(s);
    }
  }
  assert.equal(s.integ[0], 0); // left four times
  assert.ok(R.isHole(s, 0, 0));
  assert.ok(!targets(s, 1, 0).includes("0,0"));
});

test("scale: +5 wins, −5 loses, a King taken by capture just scores", () => {
  let s = make([["p", "Q", 0, 0], ["b", "Q", 0, 4], ["p", "K", 3, 0], ["b", "K", 5, 5]]);
  s = move(s, 0, 0, 0, 4, "cap");
  assert.deepEqual(s.result, { winner: "p", reason: "scale" });
  s = make([["p", "Q", 0, 0], ["b", "K", 0, 4], ["p", "K", 3, 0], ["b", "P", 5, 5]]);
  s.scale = -2;
  s = move(s, 0, 0, 0, 4, "cap");
  assert.equal(s.result, null);
  assert.equal(s.scale, 3);
});

test("40 rounds: the leader wins; a tie goes to the boss", () => {
  let s = make([["p", "K", 0, 0], ["b", "K", 5, 5]]);
  s.round = 40;
  s = pass(pass(s));
  assert.deepEqual(s.result, { winner: "b", reason: "time" });
  s = make([["p", "K", 0, 0], ["b", "K", 5, 5]]);
  s.round = 40;
  s.scale = 1;
  s = pass(pass(s));
  assert.equal(s.result.winner, "p");
});

test("phase 2 is checked at the end of the round: a guarded knight trade keeps phase 1", () => {
  let s = R.newFight({ seed: 3, boss: "angler" });
  s = move(s, 1, 0, 4, 5, "cap"); // the Glitch knight takes his knight: +3 …
  assert.equal(s.scale, 3);
  assert.equal(s.phase, 1);
  s = move(s, 3, 5, 4, 5, "cap"); // … his queen takes it back: 0
  assert.equal(s.phase, 1);
  // an unanswered +3 at the end of the round does change the phase
  s = make([["p", "Q", 0, 0], ["b", "B", 0, 3], ["p", "K", 3, 0], ["b", "K", 5, 5]], { boss: "angler" });
  s = move(s, 0, 0, 0, 3, "cap");
  assert.equal(s.phase, 1);
  s = pass(s);
  assert.equal(s.phase, 2);
});

test("the Trapper: three hidden traps in the middle rows; stepping on one destroys and scores for him", () => {
  let s = R.newFight({ seed: 9, boss: "trapper" });
  assert.equal(s.traps.length, 3);
  assert.ok(s.traps.every((t) => t.y === 2 || t.y === 3));
  s = make([["p", "K", 0, 0], ["p", "R", 2, 0], ["b", "K", 5, 5]], { boss: "trapper" });
  s.traps = [{ x: 2, y: 3 }];
  s = move(s, 2, 0, 2, 3);
  assert.ok(!s.pieces.some((p) => p.t === "R"));
  assert.equal(s.scale, -4);
  assert.ok(s.events.some((e) => e.type === "trap"));
});

test("the Trader: once, a lost piece back for one on the board", () => {
  let s = make([["p", "K", 0, 0], ["p", "P", 3, 2], ["b", "K", 5, 5]], { boss: "trapper" });
  s.lost.p.push({ t: "Q", slot: 2, sig: [] }, { t: "P", slot: 7, sig: [] });
  s.trade = "open";
  assert.equal(R.tradeOffer(s).back.t, "Q");
  s = R.trade(s, at(s, 3, 2).id);
  assert.equal(at(s, 3, 2).t, "Q");
  assert.equal(s.trade, "done");
  assert.equal(R.tradeOffer(s), null);
});

test("the Angler: every 4 rounds he drags your best piece toward him; his bait costs a turn", () => {
  let s = make([["p", "K", 0, 0], ["p", "Q", 2, 2], ["p", "P", 4, 1], ["b", "K", 5, 5]], { boss: "angler" });
  for (let r = 0; r < 4; r++) s = pass(pass(s));
  assert.equal(at(s, 2, 3).t, "Q");
  assert.ok(s.events.some((e) => e.type === "hook"));
  s = make([["p", "K", 0, 0], ["p", "P", 2, 2], ["b", "P", 3, 3, { bait: true }], ["b", "K", 5, 5]], { boss: "angler" });
  s = move(s, 2, 2, 3, 3, "cap");
  assert.equal(s.scale, 0); // the bait is worth nothing
  s = pass(s); // boss
  assert.deepEqual(R.legalMoves(s), [{ kind: "pass" }]); // your turn is lost
});

test("the Prospector: every 3 rounds your most advanced piece turns to gold; phase 2 cracks it into a hole", () => {
  let s = make([["p", "K", 0, 0], ["p", "P", 2, 3], ["p", "R", 5, 0], ["b", "K", 5, 5]], { boss: "prospector" });
  for (let r = 0; r < 3; r++) s = pass(pass(s));
  const g = at(s, 2, 3);
  assert.equal(g.t, "G");
  assert.equal(g.side, null);
  assert.ok(!R.legalMoves(s).some((m) => m.id === g.id));
  s.scale = 3;
  s = pass(pass(s));
  assert.equal(s.phase, 2);
  assert.ok(R.isHole(s, 2, 3));
  assert.equal(at(s, 2, 3), null);
});

test("the Moon: 2 × 2, steps orthogonally, can't be taken, falls when pushed into a hole", () => {
  let s = make([["p", "K", 0, 0], ["p", "R", 0, 3], ["b", "M", 2, 3], ["b", "P", 5, 5]], { boss: "woodcarver" });
  s.moon = { id: at(s, 2, 3).id, charging: false, rows: null, since: 1 };
  assert.equal(at(s, 3, 4), at(s, 2, 3)); // one piece, four cells
  s.turn = "b";
  assert.deepEqual(targets(s, 2, 3).sort(), ["1,3", "2,2", "2,4", "3,3"]);
  s.pieces.find((p) => p.t === "M").y = 4;
  assert.ok(!targets(s, 2, 4).includes("2,5")); // that would put it off the board
  s.pieces.find((p) => p.t === "M").y = 3;
  s.turn = "p";
  s.integ[3 * 6 + 4] = 0; // a hole at 4,3, right of the Moon
  s = move(s, 0, 3, 2, 3, "push");
  assert.deepEqual(s.result, { winner: "p", reason: "moon" });
  // nothing can capture it
  s = make([["p", "K", 0, 0], ["p", "Q", 2, 1], ["b", "M", 2, 3], ["b", "P", 5, 5]], { boss: "woodcarver" });
  s.moon = { id: at(s, 2, 3).id, charging: false, rows: null, since: 1 };
  assert.ok(!targets(s, 2, 1, "cap").includes("2,3"));
});

test("the Moon: its attack is announced a round ahead, it is still while charging, holes shield", () => {
  let s = make([["p", "K", 0, 0], ["p", "P", 0, 3], ["p", "R", 5, 4], ["p", "B", 5, 3], ["b", "M", 2, 3], ["b", "P", 5, 5]], { boss: "woodcarver" });
  s.phase = 2;
  s.moon = { id: at(s, 2, 3).id, charging: false, rows: null, since: 0 };
  s.integ[3 * 6 + 4] = 0; // 4,3 is a hole: it shields the bishop at 5,3
  s.round = 2;
  s = pass(pass(s)); // end of round 2: the warning
  assert.ok(s.moon.charging);
  assert.ok(s.events.some((e) => e.type === "moonWarn"));
  s.turn = "b";
  assert.deepEqual(R.movesFor(s, s.moon.id), []);
  s.turn = "p";
  s = pass(pass(s)); // end of round 3: the attack
  assert.ok(!s.pieces.some((p) => p.t === "P" && p.side === "p")); // 0,3 hit
  assert.ok(!s.pieces.some((p) => p.t === "R")); // 5,4 hit
  assert.ok(s.pieces.some((p) => p.t === "B")); // behind the hole
  assert.equal(s.scale, -5);
});

test("the Moon phase: +5 on the scale no longer wins; −5 still loses", () => {
  let s = make([["p", "K", 0, 0], ["p", "Q", 0, 1], ["b", "R", 0, 4], ["b", "M", 2, 3]], { boss: "woodcarver" });
  s.moon = { id: at(s, 2, 3).id, charging: false, rows: null, since: 1 };
  s.scale = 1;
  s = move(s, 0, 1, 0, 4, "cap");
  assert.equal(s.scale, 5);
  assert.equal(s.result, null);
});

test("the Woodcarver raises the Moon in phase 2, in place of his King", () => {
  let s = R.newFight({ seed: 4, boss: "woodcarver" });
  assert.ok(["trapper", "angler", "prospector"].includes(s.mask.now));
  s.scale = 3;
  s = pass(pass(s));
  assert.equal(s.phase, 2);
  assert.ok(s.moon);
  assert.ok(!s.pieces.some((p) => p.t === "K" && p.side === "b"));
  assert.equal(s.pieces.filter((p) => p.t === "M").length, 1);
});

test("sigils: Pusher shoves instead of capturing, Ghost passes through one piece", () => {
  let s = make([["p", "Q", 0, 2, { sig: ["pusher"] }], ["b", "N", 3, 2], ["p", "K", 0, 0], ["b", "K", 5, 5]]);
  assert.ok(targets(s, 0, 2, "push").includes("3,2"));
  s = move(s, 0, 2, 3, 2, "push");
  assert.equal(at(s, 4, 2).t, "N");
  s = make([["p", "R", 0, 2, { sig: ["ghost"] }], ["b", "N", 2, 2], ["p", "K", 0, 0], ["b", "K", 5, 5]]);
  assert.ok(targets(s, 0, 2, "move").includes("4,2"));
});

test("a run is reproducible from its seed", () => {
  const play = (seed) => {
    let s = R.newFight({ seed, boss: "trapper" });
    for (let i = 0; i < 30 && !s.result; i++) {
      const ms = R.legalMoves(s);
      s = R.applyMove(s, ms[(i * 7) % ms.length]);
    }
    return JSON.stringify({ p: s.pieces, i: s.integ, t: s.traps, w: s.wind });
  };
  assert.equal(play(42), play(42));
  assert.notEqual(play(42), play(43));
});

test("state is plain and serialisable; applyMove never changes its input", () => {
  const s = R.newFight({ seed: 2, boss: "prospector" });
  const before = JSON.stringify(s);
  R.applyMove(s, R.legalMoves(s)[0]);
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test("the Woodcarver can't be beaten on the scale before the Moon: +5 raises it instead", () => {
  let s = make([["p", "K", 0, 0], ["p", "Q", 0, 1], ["b", "Q", 0, 4], ["b", "K", 3, 5], ["b", "P", 5, 5]], { boss: "woodcarver" });
  s.mask = { now: "angler", used: ["angler"] };
  s = move(s, 0, 1, 0, 4, "cap");
  assert.equal(s.scale, 5);
  assert.equal(s.result, null);
  s = pass(s);
  assert.equal(s.phase, 2);
  assert.ok(s.moon);
});
