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
  return { v: 1, seed: seed >>> 0, deck: deck.slice(), shuffles: 0, cutIndex: null, guiding: null, picks: [] };
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
        if (rel) echo = { ...remember(avoid, rel), with: r.picks[k].id, intro: ECHO_INTROS[(hash(`${r.seed}:ei`) + count) % ECHO_INTROS.length] };
      }
      if (echo) count++;
    }
    out.push(echo);
  });
  return { list: out, avoid };
}

// What she says when the i-th card of the cross is turned over.
export function commentary(r, i) {
  const p = r.picks[i],
    c = card(p.id),
    g = card(r.guiding),
    s = `${r.seed}:${i}`;
  const lines = [
    { t: `${c.name}... ${choose(POSITION_PHRASES[p.position], s, "pp")}.`, eyes: c.react.eyes, pause: c.react.pause || 0, react: c.id },
    { t: choose(c.reveal, s, "rv") },
    { t: c.pos[p.position] },
  ];
  const lens = lensLine(g, c, p.position);
  lines.push({ t: lens, eyes: "watching" });
  const echo = echoes(r).list[i];
  if (echo) {
    lines.push({ t: fill(echo.intro, { prev: mid(card(echo.with)) }), eyes: "curious" });
    lines.push({ t: echo.text });
  }
  return { lines, interpretation: `${c.pos[p.position]} ${lens}`, echo };
}

// The guiding card's reveal: before the flip, her reading of it, and the hand-off to the spread.
export function guidingLines(r) {
  const g = card(r.guiding);
  return {
    before: phaseLines("guidingSeen", r.seed),
    open: g.guideOpen.map((t, i) => (i === 0 ? { t, eyes: g.react.eyes, pause: g.react.pause || 400, react: g.id } : { t })),
    after: phaseLines("guidingAfter", r.seed),
  };
}

// Layers 1–4 again, stage by stage, then the synthesis (Layer 5).
export function finalReading(r) {
  if (!isComplete(r)) throw new Error("The cross isn't complete.");
  const g = card(r.guiding),
    side = g.lens.side,
    at = Object.fromEntries(r.picks.map((p) => [p.position, card(p.id)]));
  const avoid = echoes(r).avoid;
  const partner = {
    past: [g],
    present: [at.past, g],
    future: [at.present, g],
    shadow: [g, at.present],
    potential: [at.shadow, g],
  };
  const stages = POSITIONS.map(({ key }, i) => {
    const c = at[key],
      s = `${r.seed}:st${i}`;
    const face = key === "shadow" ? "shade" : key === "potential" ? "light" : side;
    const lines = [{ t: choose(STAGE_OPENERS[key], s, "op"), eyes: "serious" }];
    if (face === "light") lines.push({ t: c.light, focus: true });
    else lines.push({ t: `${c.name}.`, focus: true }, { t: c.shade });
    let link = null;
    for (const other of partner[key]) if (!link) link = relation(c, other, s, { avoid });
    if (link) remember(avoid, link);
    lines.push({ t: link ? link.text : fill(choose(GUIDE_LINKS[key], s, "gl"), { guide: mid(g) }), eyes: "watching" });
    if (key === "future") lines.push({ t: choose(FUTURE_CAVEATS, s, "fc"), eyes: "soft" });
    return { position: key, id: c.id, lines, reflection: lines.slice(1).map((l) => l.t).join(" ") };
  });
  return { stages, synthesis: synthesis(r, avoid) };
}

// The closing synthesis: 150–250 words that name all six cards.
export function synthesis(r, avoid = echoes(r).avoid) {
  avoid = new Set(avoid);
  const g = card(r.guiding),
    side = g.lens.side,
    s = `${r.seed}:syn`,
    at = Object.fromEntries(r.picks.map((p) => [p.position, card(p.id)]));
  const phrase = (c) => (side === "light" ? c.lightShort : c.shadeShort);
  const parts = [];
  parts.push(g.guiding);
  parts.push(
    fill(choose(SYNTHESIS.arc, s, "arc"), {
      past: mid(at.past),
      present: mid(at.present),
      pastPhrase: phrase(at.past),
      presentPhrase: phrase(at.present),
    }),
  );
  const bridge = relation(at.past, at.present, s, { avoid });
  parts.push(bridge ? remember(avoid, bridge).text : choose(SYNTHESIS.bridge, s, "br"));
  parts.push(
    fill(choose(side === "light" ? SYNTHESIS.futureLight : SYNTHESIS.futureShade, s, "fu"), {
      future: mid(at.future),
      futureLight: at.future.lightShort,
      futureShade: at.future.shadeShort,
    }),
  );
  parts.push(fill(choose(SYNTHESIS.shadow, s, "sh"), { shadow: mid(at.shadow), shadowPhrase: at.shadow.shadeShort }));
  parts.push(fill(choose(SYNTHESIS.potential, s, "po"), { potential: mid(at.potential), potentialPhrase: at.potential.lightShort }));
  const closing = g.lens.closing;
  const words = (list) => list.join(" ").split(/\s+/).filter(Boolean).length;
  // Then the strongest links left among all six cards (named pairs first, then oppositions),
  // while the whole stays under ~250 words: at least one if there is any.
  const six = [g, at.past, at.present, at.future, at.shadow, at.potential];
  const rank = { pair: 0, contrast: 1, shared: 2 };
  for (let added = 0; added < 3; added++) {
    const links = [];
    for (let i = 0; i < six.length; i++)
      for (let j = i + 1; j < six.length; j++) {
        const rel = relation(six[i], six[j], s, { avoid });
        if (rel) links.push(rel);
      }
    if (!links.length) break;
    links.sort((a, b) => rank[a.kind] - rank[b.kind] || hash(`${s}:${a.key}`) - hash(`${s}:${b.key}`));
    const l = links[0];
    if (added > 0 && words([...parts, l.text, closing]) > 250) break;
    parts.push(remember(avoid, l).text);
    if (words([...parts, closing]) >= 175) break;
  }
  parts.push(closing);
  return { text: parts.join(" "), sentences: parts, words: words(parts) };
}

// Everything the summary (and the saved reading) shows.
export function summary(r) {
  const g = card(r.guiding);
  const final = finalReading(r);
  return {
    seed: r.seed,
    guiding: { id: g.id, name: g.name, roman: g.roman, art: g.art, keywords: g.keywords, text: g.guiding },
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
        reflection: final.stages[i].reflection,
      };
    }),
    synthesis: final.synthesis.text,
  };
}
