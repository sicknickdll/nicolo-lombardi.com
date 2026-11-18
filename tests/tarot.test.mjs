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
  toneOf,
  answer,
  question,
  topicFor,
} from "../js/tarot/engine.js";
import { LIFE, TOPICS, QUESTIONS } from "../js/tarot/life.js";
import { TONES, TONE_OF, REVERSED, REVERSED_TONE } from "../js/tarot/tones.js";

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
    assert.ok(c.lines.length >= 3 && c.lines.length <= 6);
    assert.ok(c.lines.some((l) => l.t === c.interpretation));
    assert.equal(c.base, LIFE[p.id].money);
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
  assert.equal(commentary(r, 3).base, LIFE[r.picks[3].id].family);
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

test("every card has a careful and a restless version for every topic, and the guiding card picks", () => {
  const seen = new Set(Object.values(LIFE).flatMap((l) => Object.values(l)));
  for (const c of CARDS) {
    assert.ok(TONE_OF[c.id], c.id);
    for (const tone of ["shade", "storm"])
      for (const t of TOPICS) {
        const line = TONES[c.id]?.[tone]?.[t.key];
        assert.ok(line?.length > 10, `${c.id}.${tone}.${t.key}`);
        assert.ok(!/[:;…]/.test(line), `${c.id}.${tone}.${t.key} has a glyph the font lacks`);
        assert.ok(!seen.has(line), `duplicate: ${line}`);
        seen.add(line);
      }
  }
  // the same card in the same place reads differently under a kind, a careful and a restless guide
  const r = { ...reading(12, "love"), reversed: [] };
  const id = r.picks[0].id;
  const under = (g) => commentary({ ...r, guiding: g }, 0).interpretation;
  const tones = { light: "sun", shade: "moon", storm: "tower" };
  const lines = Object.values(tones).filter((g) => g !== id).map(under);
  assert.equal(new Set(lines).size, lines.length);
});

test("links between cards come now and then, at most twice, in her voice", () => {
  let any = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r = reading(seed * 31);
    const n = r.picks.filter((_, i) => commentary(r, i).echo).length;
    assert.ok(n <= 2);
    any += n > 0;
    r.picks.forEach((_, i) => commentary(r, i).lines.forEach((l) => assert.ok(!/[:;]/.test(l.t), l.t)));
  }
  assert.ok(any > 50, `only ${any} readings had a link`);
});

test("about one card in four comes out upside down, and the shuffle decides it", () => {
  let n = 0,
    total = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const r = shuffleDeck(newRitual({ seed }), seeded(seed));
    n += r.reversed.length;
    total += r.deck.length;
    assert.ok(r.reversed.every((id) => r.deck.includes(id)));
  }
  assert.ok(n / total > 0.2 && n / total < 0.3, `share ${n / total}`);
});

test("every card has an upside-down line for every topic", () => {
  for (const c of CARDS)
    for (const t of TOPICS) {
      const l = REVERSED[c.id]?.[t.key];
      assert.ok(l?.length > 10, `${c.id}.${t.key}`);
      assert.ok(!/[:;…]/.test(l), l);
    }
});

test("upside down changes the card, the guide's tone, the links and the ending", () => {
  const r = { ...reading(33, "work"), reversed: [] };
  const id = r.picks[2].id;
  const up = commentary(r, 2),
    down = commentary({ ...r, reversed: [id] }, 2);
  assert.notEqual(up.interpretation, down.interpretation);
  assert.equal(down.interpretation, REVERSED[id].work);
  assert.ok(down.lines[0].t.includes("upside down"));
  // a reversed guiding card turns the tone over
  const g = { ...r, reversed: [r.guiding] };
  const base = TONE_OF[r.guiding];
  assert.equal(toneOf(g), REVERSED_TONE[base]);
  // the ending counts the reversed cards and changes their sentences
  const all = { ...r, reversed: r.picks.map((p) => p.id) };
  const f = finalReading(all);
  assert.ok(f.synthesis.text.includes("All five upside down"));
  assert.ok(f.stages.every((st) => st.lines[0].t.includes("upside down")));
  assert.notEqual(finalReading(r).synthesis.text, f.synthesis.text);
  // a reversed card stands on the opposite pole, so its links with the others change
  const a = card("chariot"),
    b = card("moon");
  assert.equal(relation(a, b, 1).kind, "contrast");
  const flipped = relation(a, b, 1, { flip: new Set(["chariot"]) });
  assert.ok(!flipped || flipped.kind !== "contrast" || flipped.axis !== relation(a, b, 1).axis);
  assert.ok(validRitual(all));
});

test("yes or no: each question is answered by its card, upside down turns the answer", async () => {
  const YN = await import("../js/tarot/yesno.js");
  for (const c of CARDS) assert.ok(["yes", "no", "maybe"].includes(YN.VERDICT[c.id]), c.id);
  let r = cutDeck(shuffleDeck({ ...newRitual({ seed: 5 }), mode: "yesno", asked: [] }, seeded(5)), 6);
  const asked = new Set();
  for (let round = 0; round < YN.MAX_QUESTIONS; round++) {
    const choices = YN.questionChoices(r, round);
    assert.equal(choices.length, 4);
    const other = YN.questionChoices(r, round, new Set(choices.map((c) => c.q)));
    assert.ok(other.every((c) => !choices.some((d) => d.q === c.q)), "Other questions repeats");
    choices.forEach((c) => assert.ok(!asked.has(c.q), "question offered twice"));
    const q = choices[0];
    asked.add(q.q);
    const id = r.deck[round];
    r = YN.drawAnswer(r, id, q);
    const v = YN.verdictOf(r, round);
    const down = r.reversed.includes(id);
    const expected = down ? { yes: "notyet", no: "maybe", maybe: "no" }[YN.VERDICT[id]] : YN.VERDICT[id];
    assert.equal(v.verdict, expected);
    assert.equal(v.lines[2].t, down ? REVERSED[id][q.topic] : LIFE[id][q.topic]);
    v.lines.forEach((l) => assert.ok(!/[:;]/.test(l.t), l.t));
  }
  assert.throws(() => YN.drawAnswer(r, r.deck[0], YN.QUESTION_POOL[0]));
});
