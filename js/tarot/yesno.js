// ─────────────────────────────────────────────────────────────────────────────
// THE TAROT READER, yes or no: pick a question, draw one card, the card answers.
// Up to five questions a sitting (the five places of the cross hold the answers).
//
// VERDICT: what each card says when it lands upright. Upside down it turns:
//   yes → not yet, no → not the way you fear (maybe), maybe → no.
// The reason she gives is the card's everyday line for the question's topic (life.js), or its
// upside-down line (tones.js). The font has no colon or semicolon.
// ─────────────────────────────────────────────────────────────────────────────
import { LIFE } from "./life.js";
import { REVERSED } from "./tones.js";
import { POSITIONS, choose } from "./engine.js";
import { card } from "./cards.js";

export const QUESTION_POOL = [
  { q: "Will it work out with them?", topic: "love" },
  { q: "Should I send that message?", topic: "love" },
  { q: "Do they think about me?", topic: "love" },
  { q: "Is this person good for me?", topic: "love" },
  { q: "Will the money come through?", topic: "money" },
  { q: "Should I buy it?", topic: "money" },
  { q: "Is it time to ask for more?", topic: "money" },
  { q: "Should I take the job?", topic: "work" },
  { q: "Will I get the promotion?", topic: "work" },
  { q: "Am I on the right path?", topic: "work" },
  { q: "Is this the right time to move?", topic: "family" },
  { q: "Should I call them first?", topic: "family" },
  { q: "Will things get better at home?", topic: "family" },
];

export const VERDICT = {
  fool: "yes",
  magician: "yes",
  "high-priestess": "maybe",
  empress: "yes",
  emperor: "yes",
  hierophant: "maybe",
  lovers: "yes",
  chariot: "yes",
  strength: "yes",
  hermit: "no",
  "wheel-of-fortune": "yes",
  justice: "maybe",
  "hanged-man": "no",
  death: "no",
  temperance: "yes",
  devil: "no",
  tower: "no",
  star: "yes",
  moon: "no",
  sun: "yes",
  judgement: "yes",
  world: "yes",
};
const TURNED = { yes: "notyet", no: "maybe", maybe: "no" };
export const SAYS = {
  yes: ["Yes.", "Yes. Clearly.", "The card says yes."],
  no: ["No.", "No. I'm sorry.", "The card says no."],
  maybe: ["Maybe. It depends on you.", "Neither yes nor no. Not yet decided.", "It could go either way."],
  notyet: ["Yes. But not yet.", "Yes, later than you'd like.", "Eventually. Be patient."],
};
const TURNED_NOTE = {
  notyet: "Upside down, a yes slows down. It's coming, it's late.",
  maybe: "Upside down, a no loosens. Not the way you fear.",
  no: "Upside down, the maybe tips over. It's a no for now.",
};

export const MAX_QUESTIONS = POSITIONS.length;

// Four questions to choose from, ones not asked yet.
export function questionChoices(r, round) {
  const asked = new Set((r.asked || []).map((a) => a.q));
  const left = QUESTION_POOL.filter((x) => !asked.has(x.q));
  return left
    .map((x) => ({ x, k: choose([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], r.seed, `yq${round}:${x.q}`) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, 4)
    .map((o) => o.x);
}
// Draw the answer card for a question. No guiding card in this mode.
export function drawAnswer(r, id, question) {
  if (!r.deck.includes(id)) throw new Error(`Not in the deck: ${id}`);
  if (r.picks.length >= MAX_QUESTIONS) throw new Error("No more questions tonight.");
  const position = POSITIONS[r.picks.length].key;
  return {
    ...r,
    deck: r.deck.filter((x) => x !== id),
    picks: [...r.picks, { id, position }],
    asked: [...(r.asked || []), { q: question.q, topic: question.topic, id }],
  };
}
// What the card answers, and why.
export function verdictOf(r, i) {
  const a = r.asked[i],
    c = card(a.id),
    down = (r.reversed || []).includes(a.id);
  const base = VERDICT[c.id];
  const v = down ? TURNED[base] : base;
  const s = `${r.seed}:yn${i}`;
  const lines = [
    { t: `${c.name}${down ? ", upside down" : ""}.`, eyes: down ? "suspicious" : c.react.eyes, react: c.id, pause: c.react.pause || 0 },
    { t: choose(SAYS[v], s, "say"), eyes: v === "yes" ? "amused" : v === "no" ? "serious" : "curious" },
    { t: down ? REVERSED[c.id][a.topic] : LIFE[c.id][a.topic], eyes: "watching" },
  ];
  if (down) lines.push({ t: TURNED_NOTE[v], eyes: "watching" });
  return { verdict: v, lines, question: a.q };
}
