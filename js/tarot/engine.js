// ─────────────────────────────────────────────────────────────────────────────
// THE TAROT READER: the rules of the ritual and the reading. Pure functions, no DOM:
// the scene only shows what this decides (tests: tests/tarot.test.mjs).
//
// A ritual is a plain object (it is saved as it is in localStorage):
//   seed       32-bit number: picks the variants of what she says, so a reading never changes
//   deck       card ids still in the deck, TOP first. After the guiding card is revealed it is
//              the 20 cards you choose from; each pick takes one out.
//   shuffles   how many times it was shuffled; cutIndex: where it was cut
//   guiding    the id of the guiding card (the bottom card after the cut), or null
//   picks      [{ id, position }] in the order chosen: past, present, future, shadow, potential
//
// The reading is built in five layers:
//   1 the card (cards.js: light / shade)   2 its place in the cross (pos)
//   3 the guiding card's lens               4 links between cards (lines.js: PAIRS, AXES)
//   5 the closing synthesis
// ─────────────────────────────────────────────────────────────────────────────
import { DECK_IDS, card } from "./cards.js";
import {
  PHASE_LINES,
  POSITION_PHRASES,
  STAGE_OPENERS,
  FUTURE_CAVEATS,
  GUIDE_LINKS,
  ECHO_INTROS,
  AXES,
  PAIRS,
  SYNTHESIS,
} from "./lines.js";
import { LIFE, TOPICS, QUESTIONS } from "./life.js";
import { TONES, TONE_OF, TONE_INTRO } from "./tones.js";

// The guiding card's tone (light, shade, storm) decides which version of every card she reads.
export const toneOf = (r) => TONE_OF[r.guiding] || "light";
export function lifeLine(r, id, topic) {
  const tone = toneOf(r);
  return tone === "light" ? LIFE[id][topic] : TONES[id][tone][topic];
}
// Link sentences come from the long-form rules (lines.js): fit them to her voice and font.
const plain = (t) => t.replace(/: (\w)/g, (m, c) => `. ${c.toUpperCase()}`).replace(/; /g, ", ").replace(/:/g, ".");

export const POSITIONS = [
  { key: "past", label: "Past", place: "left", prompt: "Look Into Your Past" },
  { key: "present", label: "Present", place: "centre", prompt: "Face the Present" },
  { key: "future", label: "Future", place: "right", prompt: "Glimpse What Lies Ahead" },
  { key: "shadow", label: "The Shadow", place: "bottom", prompt: "Reach Into the Shadow" },
  { key: "potential", label: "Conscious Potential", place: "top", prompt: "Reach for What You Could Be" },
];
export const positionOf = (key) => POSITIONS.find((p) => p.key === key);

// ── randomness ──
// FNV-1a: turns any string into a 32-bit number.
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
// A small seeded generator (mulberry32): the same seed gives the same numbers. Used for tests
// and for ?seed= readings; real shuffles use the browser's cryptographic source.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}
// The browser's cryptographic source (falls back to Math.random where there is none).
export function secure() {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const buf = new Uint32Array(1);
    return () => (c.getRandomValues(buf), buf[0]);
  }
  return () => Math.floor(Math.random() * 2 ** 32) >>> 0;
}
// A whole number in [0, n), without the bias of a plain modulo (rejection sampling).
export function below(n, next) {
  const limit = Math.floor(2 ** 32 / n) * n;
  let x;
  do x = next();
  while (x >= limit);
  return x % n;
}
// Fisher–Yates: every order equally likely. Returns a new array.
export function fisherYates(list, next = secure()) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = below(i + 1, next);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// One element of a list, the same one every time for the same seed and salt.
export const choose = (list, seed, salt) => list[hash(`${seed}:${salt}`) % list.length];
export const newSeed = (next = secure()) => next();

// ── the ritual ──
export function newRitual({ seed = newSeed(), deck = DECK_IDS } = {}) {
  return { v: 1, seed: seed >>> 0, deck: deck.slice(), shuffles: 0, cutIndex: null, guiding: null, picks: [], topic: null, answers: [] };
}
export function shuffleDeck(r, next = secure()) {
  if (r.guiding) throw new Error("The deck can't be shuffled once the guiding card is out.");
  return { ...r, deck: fisherYates(r.deck, next), shuffles: r.shuffles + 1 };
}
// Cut at n: the top n cards (pile A) are lifted off, the rest (pile B) goes on top of them.
export function cut(deck, n) {
  if (!Number.isInteger(n) || n < 1 || n >= deck.length) throw new Error(`Cut index out of range: ${n}`);
  return [...deck.slice(n), ...deck.slice(0, n)];
}
export function cutDeck(r, n) {
  if (r.guiding) throw new Error("Already cut.");
  return { ...r, deck: cut(r.deck, n), cutIndex: n };
}
// The guiding card is the bottom card of the cut deck; it leaves the deck for good.
export function revealGuiding(r) {
  if (r.guiding) return r;
  if (r.cutIndex == null) throw new Error("Cut the deck first.");
  return { ...r, guiding: r.deck[r.deck.length - 1], deck: r.deck.slice(0, -1) };
}
export function pickCard(r, id) {
  if (!r.guiding) throw new Error("The guiding card comes first.");
  if (r.picks.length >= POSITIONS.length) throw new Error("The cross is complete.");
  if (!r.deck.includes(id)) throw new Error(`Not in the deck: ${id}`);
  const position = POSITIONS[r.picks.length].key;
  return { ...r, deck: r.deck.filter((x) => x !== id), picks: [...r.picks, { id, position }] };
}
export const isComplete = (r) => r.picks.length === POSITIONS.length;

// A saved ritual is used only if it is consistent: known cards, no card twice, positions in order.
export function validRitual(r) {
  try {
    if (!r || r.v !== 1 || !Array.isArray(r.deck) || !Array.isArray(r.picks)) return false;
    const all = [...r.deck, ...(r.guiding ? [r.guiding] : []), ...r.picks.map((p) => p.id)];
    if (all.some((id) => !card(id))) return false;
    if (new Set(all).size !== all.length) return false;
    if (r.picks.some((p, i) => p.position !== POSITIONS[i]?.key)) return false;
    if (r.picks.length && !r.guiding) return false;
    if (r.topic != null && !TOPICS.some((t) => t.key === r.topic)) return false;
    return Number.isInteger(r.seed);
  } catch {
    return false;
  }
}

// ── words ──
// "The Tower" → "the Tower" in the middle of a sentence ("the Lovers card", which is plural).
export const mid = (c) => c.subject || c.name.replace(/^The /, "the ");
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// {key} → vars.key; {Key} → the same, capitalised.
export function fill(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => {
    if (k in vars) return vars[k];
    const low = k.charAt(0).toLowerCase() + k.slice(1);
    return low in vars ? cap(String(vars[low])) : m;
  });
}
// A line from the phase lines (lines.js), the same variant for the whole reading.
export const phaseLines = (key, seed, salt = "") => choose(PHASE_LINES[key], seed, `phase:${key}:${salt}`);
export const pickLines = (position, seed) => choose(PHASE_LINES.pick[position], seed, `pick:${position}`);

// Layer 4: what two cards say to each other. A named pair first, then an opposition, then a
// shared pole. `contrastOnly` leaves out the shared poles (used during the spread, to keep it
// short). `avoid` holds what was already said in this reading: the same pair of cards, or the
// same sentence pattern, is never used twice.
export function relation(a, b, salt, { contrastOnly = false, avoid = null } = {}) {
  if (!a || !b || a.id === b.id) return null;
  const key = [a.id, b.id].sort().join("|");
  if (avoid?.has(`pair:${key}`)) return null;
  const options = [];
  if (PAIRS_BY_KEY[key]) options.push({ kind: "pair", tpl: `pair:${key}`, text: PAIRS_BY_KEY[key] });
  const contrasts = [],
    shared = [];
  for (const axis of Object.keys(AXES)) {
    const va = a.axes[axis] || 0,
      vb = b.axes[axis] || 0;
    if (va && vb) (va !== vb ? contrasts : shared).push(axis);
  }
  const order = (list, tag) => list.slice().sort((x, y) => hash(`${salt}:${tag}:${key}:${x}`) - hash(`${salt}:${tag}:${key}:${y}`));
  for (const axis of order(contrasts, "c")) {
    const [plus, minus] = a.axes[axis] > 0 ? [a, b] : [b, a];
    AXES[axis].contrast.forEach((tpl, v) =>
      options.push({ kind: "contrast", axis, v, tpl: `${axis}:c:${v}`, text: fill(tpl, { a: mid(plus), b: mid(minus) }) }),
    );
  }
  if (!contrastOnly)
    for (const axis of order(shared, "s")) {
      const pole = a.axes[axis] > 0 ? "plus" : "minus";
      AXES[axis][pole].forEach((tpl, v) => options.push({ kind: "shared", axis, v, tpl: `${axis}:${pole}:${v}`, text: fill(tpl, { a: mid(a), b: mid(b) }) }));
    }
  // Among the variants of one axis, start from a seeded one, so readings differ.
  const shift = hash(`${salt}:v:${key}`);
  options.sort((x, y) => (x.kind === y.kind && x.axis === y.axis ? ((x.v + shift) % 2) - ((y.v + shift) % 2) : 0));
  const found = options.find((o) => !avoid?.has(o.tpl));
  return found ? { ...found, key: `pair:${key}` } : null;
}
const PAIRS_BY_KEY = Object.fromEntries(Object.entries(PAIRS).map(([k, v]) => [k.split("|").sort().join("|"), v]));
const remember = (avoid, rel) => (avoid.add(rel.key), avoid.add(rel.tpl), rel);

// Layer 3: the guiding card's lens on a drawn card at a position.
export function lensLine(g, c, position) {
  return fill(g.lens[position], { light: c.lightShort, shade: c.shadeShort, name: mid(c) });
}

// "Echoes": when a new card links back to one already on the table, she says so. At most two
// in a spread, each with a different opening and a different sentence pattern.
export function echoes(r) {
  const avoid = new Set(),
    out = [];
  let count = 0;
  r.picks.forEach((p, i) => {
    let echo = null;
    if (count < 2) {
      const c = card(p.id);
      for (let k = i - 1; k >= 0 && !echo; k--) {
        const rel = relation(c, card(r.picks[k].id), `${r.seed}:e${i}`, { contrastOnly: true, avoid });
        // named pairs always speak, plain oppositions only about half the time
        if (rel && (rel.kind === "pair" || hash(`${r.seed}:ek${i}`) % 2 === 0))
          echo = { ...remember(avoid, rel), with: r.picks[k].id, intro: ECHO_INTROS[(hash(`${r.seed}:ei`) + count) % ECHO_INTROS.length] };
      }
      if (echo) count++;
    }
    out.push(echo);
  });
  return { list: out, avoid };
}

// ── the everyday reading (js/tarot/life.js) ──
// The topic of the i-th card: the one chosen at the start, unless an answer to her question
// steered the reading elsewhere before that card was drawn.
export function topicFor(r, i = r.picks.length) {
  let t = r.topic || "love";
  for (const a of r.answers || []) if (a.after < i && a.to) t = a.to;
  return t;
}
export function setTopic(r, topic) {
  if (!TOPICS.some((t) => t.key === topic)) throw new Error(`Unknown topic: ${topic}`);
  return { ...r, topic, answers: [] };
}
// Her question after the `after`-th card, answered with `key`.
export function answer(r, after, key) {
  const q = QUESTIONS[topicFor(r, after + 1)];
  const a = q.a.find((x) => x.key === key);
  if (!a) throw new Error(`Unknown answer: ${key}`);
  return { ...r, answers: [...(r.answers || []), { after, key, topic: topicFor(r, after + 1), to: a.to || null }] };
}
export const question = (r, after) => QUESTIONS[topicFor(r, after + 1)];
const answerOf = (x) => QUESTIONS[x.topic].a.find((a) => a.key === x.key);

// What she says when the i-th card of the cross is turned over: three short lines.
export function commentary(r, i) {
  const p = r.picks[i],
    c = card(p.id),
    s = `${r.seed}:${i}`,
    topic = topicFor(r, i);
  const life = lifeLine(r, c.id, topic);
  const lines = [
    { t: `${c.name}, ${choose(POSITION_PHRASES[p.position], s, "pp")}.`, eyes: c.react.eyes, pause: c.react.pause || 0, react: c.id },
    { t: choose(c.reveal, s, "rv") },
    { t: life, eyes: "watching" },
  ];
  // now and then (a strong pair, or two cards pulling opposite ways) she links it to one on the table
  const echo = echoes(r).list[i];
  if (echo) lines.push({ t: plain(fill(echo.intro, { prev: mid(card(echo.with)) })), eyes: "curious" }, { t: plain(echo.text) });
  return { lines, interpretation: life, base: LIFE[c.id][topic], echo: echo ? plain(echo.text) : null, topic };
}

// The guiding card's reveal: her first look, what it means for your topic, the hand-off.
export function guidingLines(r) {
  const g = card(r.guiding);
  const topic = r.topic || "love";
  return {
    before: phaseLines("guidingSeen", r.seed),
    open: [{ t: `${g.name}.`, eyes: g.react.eyes, pause: g.react.pause || 400, react: g.id }, { t: LIFE[g.id][topic] }, { t: TONE_INTRO[toneOf(r)], eyes: "watching" }],
    after: phaseLines("guidingAfter", r.seed),
  };
}

// The final reading: one line per card, the warning, the advice, and how it ends.
export function finalReading(r) {
  if (!isComplete(r)) throw new Error("The cross isn't complete.");
  const g = card(r.guiding),
    at = Object.fromEntries(r.picks.map((p) => [p.position, card(p.id)])),
    s = `${r.seed}:fin`;
  const say = {
    past: choose([`It started with ${mid(at.past)}.`, `Behind you, ${mid(at.past)}.`], s, "pa"),
    present: choose([`Now it's ${mid(at.present)}.`, `Today, ${mid(at.present)}.`], s, "pr"),
    future: choose([`Next comes ${mid(at.future)}, if nothing changes.`, `Then ${mid(at.future)}. Unless you change course.`], s, "fu"),
    shadow: `Careful with ${mid(at.shadow)}. ${LIFE[at.shadow.id].warning}`,
    potential: `${at.potential.name} says this. ${LIFE[at.potential.id].advice}`,
  };
  const stages = POSITIONS.map(({ key }) => ({ position: key, id: at[key].id, lines: [{ t: say[key], focus: true, eyes: "watching" }], reflection: say[key] }));
  return { stages, synthesis: synthesis(r) };
}

// The closing words (and the whole reading, written down).
export function synthesis(r) {
  const g = card(r.guiding),
    fr = POSITIONS.map(({ key }) => card(r.picks.find((p) => p.position === key).id));
  const ends = (r.answers || []).map((x) => answerOf(x)?.end).filter(Boolean);
  const parts = [
    `${g.name} sat under all of it.`,
    lifeLine(r, fr[0].id, topicFor(r, 0)),
    lifeLine(r, fr[1].id, topicFor(r, 1)),
    lifeLine(r, fr[2].id, topicFor(r, 2)),
    `Careful with ${mid(fr[3])}. ${LIFE[fr[3].id].warning}`,
    LIFE[fr[4].id].advice,
    ...ends,
    g.lens.closing,
  ];
  const words = parts.join(" ").split(/\s+/).length;
  return { text: parts.join(" "), sentences: [...ends, g.lens.closing], words };
}

// Everything the summary (and the saved reading) shows.
export function summary(r) {
  const g = card(r.guiding);
  const final = finalReading(r);
  return {
    seed: r.seed,
    topic: r.topic,
    guiding: { id: g.id, name: g.name, roman: g.roman, art: g.art, keywords: g.keywords, text: LIFE[g.id][r.topic || "love"] },
    cards: r.picks.map((p, i) => {
      const c = card(p.id);
      return {
        position: p.position,
        label: positionOf(p.position).label,
        id: c.id,
        name: c.name,
        roman: c.roman,
        art: c.art,
        keywords: c.keywords,
        interpretation: commentary(r, i).interpretation,
        base: commentary(r, i).base,
        reflection: final.stages[i].reflection,
      };
    }),
    synthesis: final.synthesis.text,
  };
}
