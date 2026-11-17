// ─────────────────────────────────────────────────────────────────────────────
// THE TAROT READER: what the fortune teller says between the cards, and the rules that
// connect cards to each other (Layer 4 of the reading, see js/tarot/engine.js).
//
// A line is a string, or { t, eyes, pause, hand, sfx }: eyes = the state her eyes take
// (idle, watching, curious, suspicious, amused, serious, dramatic, soft, dim, disappear),
// pause = ms of silence before the line, hand = a gesture, sfx = a sound.
// Where a list holds several options ([[…], […]]) one is picked per reading, so two
// readings rarely sound the same, but the same reading always does.
// ─────────────────────────────────────────────────────────────────────────────

export const PHASE_LINES = {
  arrival: [
    [{ t: "At last.", eyes: "idle", pause: 600 }, { t: "Sit. Let's see what's going on with you.", eyes: "amused" }],
    [{ t: "There you are.", eyes: "idle", pause: 600 }, { t: "Sit down. The cards are restless tonight.", eyes: "amused" }],
  ],
  returning: [
    [{ t: "You again.", eyes: "curious", pause: 500 }, { t: "Something new, or the same old thing?", eyes: "amused" }],
  ],
  topic: [[{ t: "So. What keeps you up at night?", eyes: "curious" }]],
  shuffle: [
    [{ t: "Shuffle them. Just touch the deck.", eyes: "watching", hand: "present" }],
    [{ t: "Touch the deck. Mix them up a little.", eyes: "watching", hand: "present" }],
  ],
  shuffleMore: [[{ t: "Again, or is that enough?", eyes: "idle" }]],
  shuffleMany: [[{ t: "They won't get any more lost than that.", eyes: "amused" }]],
  cut: [
    [{ t: "Now cut it. Drag the top half away.", eyes: "watching" }],
    [{ t: "Cut the deck. Pull some off the top, wherever feels right.", eyes: "watching" }],
  ],
  cutDone: [[{ t: "Good.", eyes: "idle" }], [{ t: "There.", eyes: "idle" }]],
  guidingBefore: [[{ t: "Touch the deck. I'll take the card from the bottom.", eyes: "curious" }]],
  guidingSeen: [[{ t: "Ah.", eyes: "curious", pause: 300 }]],
  guidingAfter: [[{ t: "That one stays here, under everything.", eyes: "watching" }]],
  spreadBefore: [
    [{ t: "Five cards. Pick with your hand, not your head.", eyes: "watching" }],
    [{ t: "Now pick five. Don't think too hard, the cards can tell.", eyes: "watching" }],
  ],
  pick: {
    past: [["First, your past."]],
    present: [["Now, where you are."]],
    future: [["Next, where it's going."]],
    shadow: [["Now the part you don't talk about."]],
    potential: [["Last one. What you can do about it."]],
  },
  crossDone: [[{ t: "That's all five. Let me look.", eyes: "watching", pause: 300 }]],
  finalBefore: [[{ t: "Right. Here's how it goes.", eyes: "serious" }]],
  end: [[{ t: "That's it.", eyes: "idle", pause: 700 }, { t: "The rest is up to you.", eyes: "soft" }]],
  resume: [[{ t: "You left in the middle. Shall we finish?", eyes: "curious" }]],
  reviewOffer: [[{ t: "Your last reading is still on the table, if you want it.", eyes: "idle" }]],
  idle: [[{ t: "Any of them. They don't bite.", eyes: "amused" }], [{ t: "Take your time. I'm not going anywhere.", eyes: "amused" }]],
  // poking her in the eye, in order. The fifth time there are no more words.
  poked: [
    [{ t: "Eyes on the cards, please.", eyes: "suspicious" }],
    [{ t: "Don't do that.", eyes: "suspicious" }],
    [{ t: "I said don't.", eyes: "serious" }],
    [{ t: "Once more. I dare you.", eyes: "dramatic" }],
  ],
};

// How she names each place of the cross when a card lands there.
export const POSITION_PHRASES = {
  past: ["in your past", "behind you", "where you came from"],
  present: ["right now", "in the present", "here and now"],
  future: ["in what lies ahead", "on the road ahead", "in what is coming"],
  shadow: ["beneath it all", "in the shadow", "underneath"],
  potential: ["above it all", "at the crown", "in what you could become"],
};

// The final reading, stage by stage.
export const STAGE_OPENERS = {
  past: ["Let's begin where you began.", "First, the past. It always insists on going first."],
  present: ["Now, the present.", "Which brings us here."],
  future: ["Then, what lies ahead.", "And the road from here."],
  shadow: ["Now look beneath.", "And underneath it all..."],
  potential: ["Finally, above.", "And at the crown of the cross..."],
};
export const FUTURE_CAVEATS = [
  "A direction, not a destination.",
  "Nothing here is written in ink.",
  "Call it the way the current is flowing. Currents can be crossed.",
];
// When a card has nothing particular to say to the guiding card, she links them anyway.
export const GUIDE_LINKS = {
  past: ["Seen through {guide}, that is how the past still speaks to you.", "{Guide}, beneath it all, decides how you remember it."],
  present: ["With {guide} underneath, this weighs more than it seems.", "{Guide} is listening to this one closely."],
  future: ["{Guide} will colour that road, whichever way you walk it.", "Read by {guide}, that is a possibility, not a promise."],
  shadow: ["{Guide} knows this shadow; it was lying right beside it.", "Remember that {guide} sat under all of this, in the dark."],
  potential: ["And {guide} is what makes it reachable.", "{Guide} beneath, this above. Between them, you."],
};
// Introduces a link between a new card and one already on the table.
export const ECHO_INTROS = ["Curious. This changes what we've already seen.", "And it answers {prev}.", "Look at it beside {prev}."];

// ── Layer 4: six oppositions. Each card has a place on some of them (axes in cards.js). ──
// contrast: two cards on opposite poles ({a} the + pole, {b} the − pole);
// plus / minus: two cards on the same pole.
export const AXES = {
  flux: {
    contrast: [
      "{A} wants things to move; {b} wants them to hold. Between them is the real question: what needs to change, and what has earned the right to stay?",
      "There is a tug-of-war here, {a} unsettling and {b} steadying. You don't have to pick a winner. You do have to notice who is pulling.",
    ],
    plus: ["{A} and {b} agree on one thing: nothing here is meant to stay as it is."],
    minus: ["{A} and {b} both lean toward what lasts. Some foundations are worth keeping."],
  },
  bond: {
    contrast: [
      "{A} reaches toward other people; {b} withdraws from them. Perhaps you have been swinging between the two, unsure which was safer.",
      "One card asks for company and the other for solitude: {a} and {b}. Both are honest. They simply can't both lead.",
    ],
    plus: ["{A} and {b} both turn toward others. Whatever this is, you are not meant to carry it alone."],
    minus: ["{A} and {b} both keep their distance. There is wisdom in solitude, but count how long you've been alone with this."],
  },
  sight: {
    contrast: [
      "{A} brings light; {b} brings fog. Some of this you see very clearly and some not at all, and the mistake would be to assume the clear part explains the rest.",
      "{A} and {b} disagree about what can be known. Trust what is lit, but keep listening to what isn't.",
    ],
    plus: ["{A} and {b} both insist on seeing plainly. The truth here is not hidden. It may simply be unwelcome."],
    minus: ["{A} and {b} both live in half-light. Not everything here can be known yet, and that is not a failure."],
  },
  realm: {
    contrast: [
      "{A} looks outward and acts; {b} works inside you. One without the other has been the trouble.",
      "{A} faces outward and {b} faces in. The answer is somewhere in the doorway between them.",
    ],
    plus: ["{A} and {b} both point outward, toward action. Thinking has done its part."],
    minus: ["{A} and {b} both turn inward. The real movement here happens where no one can see it."],
  },
  grip: {
    contrast: [
      "{A} grips; {b} lets go. Learning which moment calls for which may be the whole lesson.",
      "{A} would take the reins, {b} would drop them. Neither is wrong. Only the timing can be.",
    ],
    plus: ["{A} and {b} both insist on will. You are not a passenger here."],
    minus: ["{A} and {b} both counsel release. Some things only come when you stop pulling at them."],
  },
  form: {
    contrast: [
      "{A} transforms; {b} resists. You can feel both in yourself: the part that is ready, and the part holding the door shut.",
      "{A} is already changing shape, and {b} is guarding the old one. Ask what exactly is being protected.",
    ],
    plus: ["{A} and {b} both carry the smell of transformation. Something in you is already becoming something else."],
    minus: ["{A} and {b} both hold on. Ask whether you are protecting something, or simply refusing to let it change."],
  },
};

// The closing synthesis (Layer 5). {past} {present} … are card names, the *Phrase slots are
// the cards' short noun phrases (their light or shade, as the guiding card decides).
export const SYNTHESIS = {
  arc: [
    "You come out of {past}, out of {pastPhrase}, and you stand now inside {present}: {presentPhrase}.",
    "Behind you lies {past}, and with it {pastPhrase}. Around you is {present}, and {presentPhrase}.",
  ],
  bridge: [
    "The line between them is not straight, but it is unbroken.",
    "One grew out of the other, whether or not you noticed it happening.",
  ],
  futureLight: [
    "{Future} suggests where this is heading: toward {futureLight}. A direction, not a verdict.",
    "Ahead lies {future}, and the possibility of {futureLight}, if the current keeps flowing the way it flows tonight.",
  ],
  futureShade: [
    "{Future} suggests where this is heading: toward {futureLight}, unless {futureShade} gets there first. A direction, not a verdict.",
    "Ahead lies {future}. It could bring {futureLight}; it could also bring {futureShade}. Which one depends on what you do with the rest of this.",
  ],
  shadow: [
    "Beneath all of it, {shadow} works in the dark: {shadowPhrase}. That is the thing most likely to steer you without asking permission.",
    "And underneath, {shadow} keeps its own counsel. {ShadowPhrase} has been doing more of the deciding than you would like.",
  ],
  potential: [
    "Above, {potential} holds out {potentialPhrase}. It will not arrive on its own. It has to be chosen.",
    "But at the crown sits {potential}, offering {potentialPhrase}: not a prize, a choice.",
  ],
};

// Named pairs: specific meetings that outrank the oppositions above (order doesn't matter).
export const PAIRS = {
  "tower|star": "The Tower and the Star belong to the same night: first the fall, then a sky clear enough to steer by.",
  "death|sun": "Death and the Sun: an ending, and the morning that ending makes room for.",
  "moon|sun": "The Moon and the Sun share this reading. What frightens you at night is often ordinary by day. The trick is remembering that in the dark.",
  "devil|lovers": "The Devil and the Lovers are closer than people think. Both are about what binds you. One you choose; the other chooses you.",
  "hermit|world": "The Hermit and the World: solitude at one end, wholeness at the other. The lantern was always leading somewhere.",
  "emperor|empress": "The Emperor and the Empress, together: structure and abundance. Each is barren without the other.",
  "justice|wheel-of-fortune": "Justice and the Wheel argue about who is in charge, consequence or chance. The answer, irritatingly, is both.",
  "chariot|hanged-man": "The Hanged Man and the Chariot pull in opposite directions: one surrenders, the other drives. You will need both, at different hours.",
  "high-priestess|magician": "The Priestess knows; the Magician does. Between them lies the old gap between understanding something and acting on it.",
  "devil|strength": "Strength and the Devil both hold a beast on a leash. The difference is who is holding whom.",
  "temperance|tower": "Temperance and the Tower: patience beside sudden collapse. Some things are mended slowly because they broke quickly.",
  "death|judgement": "Death and Judgement are a pair of doors. One closes; the other calls you back through it, changed.",
  "high-priestess|moon": "The Moon and the Priestess both speak in riddles. Twice now the cards ask you to trust what you cannot prove.",
  "hermit|star": "The Star and the Hermit both carry a light: one for everyone, one for a single path. Notice which you need.",
  "emperor|tower": "The Tower and the Emperor. Whatever was built to last is being tested by something that doesn't care how long it took.",
  "devil|hierophant": "The Hierophant and the Devil both offer rules. One calls them tradition; the other calls them comfort. Read the fine print of each.",
  "hermit|lovers": "The Lovers and the Hermit: the pull toward another, and the need to be alone long enough to know who is doing the reaching.",
  "wheel-of-fortune|world": "The Wheel turns and the World completes the circle. A cycle is closing, which means another is quietly beginning.",
  "chariot|strength": "The Chariot and Strength: two kinds of power. One rides, the other tames. Force is not the only way through.",
  "death|tower": "Death and the Tower together. Not doom: demolition. Something is being cleared, and quickly.",
  "star|sun": "The Star promises; the Sun delivers. Hope, and then the warmth of what the hope was for.",
  "death|empress": "The Empress and Death: the garden and the compost. Endings feed what grows next.",
  "fool|world": "The Fool and the World: the first card and the last. Whatever this is, it is a whole journey, not a single step.",
  "devil|magician": "The Magician and the Devil both deal in tricks. The question is whose.",
  "hanged-man|justice": "Justice wants a verdict; the Hanged Man wants to see the matter upside down first. Wait before you judge.",
  "devil|temperance": "Temperance and the Devil: measure and excess. Notice where you've been pouring too much, and into what.",
  "moon|star": "The Star and the Moon: two lights in the night. One guides, one deceives. Learn to tell them apart.",
  "hermit|judgement": "The Hermit's long silence ends with Judgement's call. Something you've been turning over alone is ready to be answered.",
  "empress|lovers": "The Empress and the Lovers: love that chooses, and love that tends. Both are needed for anything to last.",
  "hierophant|magician": "The Magician improvises; the Hierophant follows the book. Somewhere between them is a method that is actually yours.",
  "emperor|hermit": "The Emperor builds; the Hermit withdraws. Even a ruler needs a room with no one else in it.",
  "chariot|wheel-of-fortune": "The Chariot steers and the Wheel spins. You can't stop the turning, but you can choose your road on it.",
  "moon|tower": "The Moon and the Tower: a long night of doubt, then lightning. Sometimes clarity arrives all at once, and rudely.",
  "hanged-man|death": "The Hanged Man and Death both ask you to let go. One gently, for a while. The other for good.",
  "judgement|sun": "The Sun and Judgement: daylight and a summons. You are being asked to step into the open.",
  "high-priestess|hierophant": "The Priestess and the Hierophant both guard knowledge: one inner and unspoken, one written down and taught. Which have you trusted more?",
};
