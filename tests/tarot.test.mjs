// The Tarot Reader's rules and reading engine.   npm test   (node --test tests/)
import { test } from "node:test";
import assert from "node:assert/strict";
import { CARDS, DECK_IDS, card } from "../js/tarot/cards.js";
import {
  POSITIONS,
  seeded,
  fisherYates,
  below,
  cut,
  newRitual,
  shuffleDeck,
  cutDeck,
  revealGuiding,
  pickCard,
  commentary,
  guidingLines,
  finalReading,
  synthesis,
  summary,
  validRitual,
  lensLine,
  relation,
  setTopic,
  answer,
  question,
  topicFor,
} from "../js/tarot/engine.js";
import { LIFE, TOPICS, QUESTIONS } from "../js/tarot/life.js";

// A full reading, driven by a seed: shuffle, cut, guiding card, five picks.
function reading(seed, topic = TOPICS[seed % 4].key) {
  const next = seeded(seed);
  let r = setTopic(newRitual({ seed }), topic);
  r = shuffleDeck(r, next);
  r = cutDeck(r, 1 + below(r.deck.length - 1, next));
  r = revealGuiding(r);
  for (let i = 0; i < 5; i++) r = pickCard(r, r.deck[below(r.deck.length, next)]);
  return r;
}
const shortName = (c) => c.name.replace(/^The /, "").replace("High Priestess", "Priestess").replace("Wheel of Fortune", "Wheel");

test("the deck: 21 unique Major Arcana, the Fool left out, every card complete", () => {
  assert.equal(DECK_IDS.length, 21);
  assert.equal(new Set(DECK_IDS).size, 21);
  assert.ok(!DECK_IDS.includes("fool"));
  const fields = ["light", "shade", "lightShort", "shadeShort", "guiding"];
  for (const c of CARDS) {
    for (const f of fields) assert.ok(c[f]?.length > 10, `${c.id}.${f}`);
    for (const p of POSITIONS) {
      assert.ok(c.pos[p.key]?.length > 20, `${c.id}.pos.${p.key}`);
      assert.ok(c.lens[p.key]?.length > 20, `${c.id}.lens.${p.key}`);
    }
    assert.ok(["light", "shade"].includes(c.lens.side));
    assert.ok(c.lens.closing.length > 20);
    assert.ok(c.reveal.length >= 3 && c.guideOpen.length >= 2 && c.keywords.length >= 4);
    assert.match(c.art, /^\/assets\/archive\/tarot\/.+\.webp$/);
  }
});

test("no two cards share an interpretation", () => {
  const seen = new Map();
  for (const c of CARDS)
    for (const t of [c.light, c.shade, c.guiding, ...Object.values(c.pos), ...POSITIONS.map((p) => c.lens[p.key])]) {
      assert.ok(!seen.has(t), `"${t}" is used by ${seen.get(t)} and ${c.id}`);
      seen.set(t, c.id);
    }
});

test("Fisher–Yates: a permutation, and every card can land anywhere (roughly evenly)", () => {
  const next = seeded(42);
  const counts = Array.from({ length: 21 }, () => new Array(21).fill(0));
  const N = 21000;
  for (let n = 0; n < N; n++) {
    const s = fisherYates(DECK_IDS, next);
    assert.equal(s.length, 21);
    s.forEach((id, pos) => counts[DECK_IDS.indexOf(id)][pos]++);
  }
  assert.deepEqual([...fisherYates(DECK_IDS, next)].sort(), [...DECK_IDS].sort());
  // expected 1000 per cell; allow a wide margin
  for (const row of counts) for (const v of row) assert.ok(v > 800 && v < 1200, `cell count ${v}`);
});

test("shuffling really changes the order", () => {
  let r = newRitual({ seed: 7 });
  const before = r.deck.join();
  r = shuffleDeck(r, seeded(7));
  assert.notEqual(r.deck.join(), before);
  assert.equal(r.shuffles, 1);
});

test("cut at N: pile A = first N, pile B = rest, deck = B + A", () => {
  const d = ["a", "b", "c", "d", "e"];
  assert.deepEqual(cut(d, 2), ["c", "d", "e", "a", "b"]);
  assert.deepEqual(cut(d, 4), ["e", "a", "b", "c", "d"]);
  assert.throws(() => cut(d, 0));
  assert.throws(() => cut(d, 5));
});

test("the guiding card is the bottom card of the cut deck, and can't be drawn", () => {
  let r = shuffleDeck(newRitual({ seed: 3 }), seeded(3));
  r = cutDeck(r, 8);
  const bottom = r.deck[r.deck.length - 1];
  r = revealGuiding(r);
  assert.equal(r.guiding, bottom);
  assert.equal(r.deck.length, 20);
  assert.ok(!r.deck.includes(bottom));
  assert.throws(() => pickCard(r, bottom));
});

test("five unique picks, in the order past, present, future, shadow, potential", () => {
  const r = reading(11);
  assert.deepEqual(r.picks.map((p) => p.position), ["past", "present", "future", "shadow", "potential"]);
  assert.equal(new Set(r.picks.map((p) => p.id)).size, 5);
  assert.equal(r.deck.length, 15);
  assert.throws(() => pickCard(r, r.deck[0]));
  assert.throws(() => pickCard({ ...r, picks: r.picks.slice(0, 4) }, r.picks[0].id));
  assert.ok(validRitual(r));
  assert.ok(!validRitual({ ...r, picks: [...r.picks.slice(0, 4), { id: r.guiding, position: "potential" }] }));
});

test("the same seed always gives the same reading", () => {
  assert.deepEqual(summary(reading(99)), summary(reading(99)));
  assert.notDeepEqual(summary(reading(99)).cards, summary(reading(100)).cards);
});

test("commentary names the card and its place, and speaks to the topic", () => {
  const r = reading(5, "money");
  r.picks.forEach((p, i) => {
    const c = commentary(r, i);
    assert.ok(c.lines[0].t.startsWith(card(p.id).name));
    assert.equal(c.lines.length, 3);
    assert.ok(c.lines.some((l) => l.t === LIFE[p.id].money));
  });
  assert.ok(guidingLines(r).open.some((l) => l.t === LIFE[r.guiding].money));
});

test("every card has an everyday line for every topic, an advice and a warning", () => {
  const seen = new Set();
  for (const c of CARDS) {
    const l = LIFE[c.id];
    assert.ok(l, c.id);
    for (const k of [...TOPICS.map((t) => t.key), "advice", "warning"]) {
      assert.ok(l[k]?.length > 10, `${c.id}.${k}`);
      assert.ok(!/[:;…]/.test(l[k]), `${c.id}.${k} has a glyph the font lacks`);
      assert.ok(!seen.has(l[k]), `duplicate: ${l[k]}`);
      seen.add(l[k]);
    }
  }
});

test("her question can steer the reading to another topic", () => {
  let r = reading(8, "money");
  assert.ok(question(r, 1).q.length > 10);
  r = answer({ ...r, answers: [] }, 1, "family");
  assert.equal(topicFor(r, 1), "money");
  assert.equal(topicFor(r, 2), "family");
  assert.ok(commentary(r, 3).lines.some((l) => l.t === LIFE[r.picks[3].id].family));
  for (const [t, q] of Object.entries(QUESTIONS)) for (const a of q.a) assert.ok(!a.to || QUESTIONS[a.to], `${t}.${a.key}`);
});

test("the guiding card and the topic change the reading", () => {
  const r = reading(21, "love");
  const other = card(r.deck[0]);
  const r2 = { ...r, guiding: other.id, deck: [r.guiding, ...r.deck.slice(1)] };
  assert.ok(validRitual(r2));
  assert.notEqual(synthesis(r).text, synthesis(r2).text);
  assert.notEqual(synthesis(r).text, synthesis({ ...r, topic: "work" }).text);
});

test("card relationships: named pairs first, then oppositions", () => {
  assert.equal(relation(card("tower"), card("star"), 1).kind, "pair");
  assert.equal(relation(card("chariot"), card("moon"), 1).kind, "contrast");
});

test("the final reading names all five cards, the ending stays short (500 readings)", () => {
  let max = 0;
  for (let seed = 1; seed <= 500; seed++) {
    let r = reading(seed * 7919);
    if (seed % 2) r = answer(r, 1, question(r, 1).a[seed % question(r, 1).a.length].key);
    const f = finalReading(r);
    f.stages.forEach((st) => assert.ok(st.lines[0].t.toLowerCase().includes(card(st.id).name.replace(/^The /, "").toLowerCase().split(" ")[0])));
    assert.ok(f.synthesis.text.includes(card(r.guiding).name));
    max = Math.max(max, f.synthesis.words);
    assert.ok(!/\{\w+\}/.test(f.synthesis.text));
  }
  assert.ok(max <= 140, `longest ending ${max} words`);
});

test("every user-facing line is English (no Italian or Latin leftovers)", () => {
  const all = JSON.stringify(CARDS) + JSON.stringify(LIFE) + JSON.stringify(summary(reading(1)));
  for (const w of [" della ", " il ", " che ", " sono ", " carta ", " futuro ", " passato ", " ombra ", "Arcanum", " et "])
    assert.ok(!all.includes(w), `found "${w}"`);
});
