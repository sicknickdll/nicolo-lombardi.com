// Who they are, what they say. The rules each boss changes live in rules.js; the way each plays
// (how deep it looks, what it values) is in ai.js.
export const BOSSES = {
  trapper: {
    id: "trapper",
    name: "The Trapper",
    phase2Name: "The Trader",
    figure: "trapper",
    theme: "trapper",
    scenery: "trapper",
    intro: ["Mind the grass. It bites.", "I set them while you slept."],
    idle: ["Careful where you step.", "Every meadow has teeth.", "Three of them. Can you count them?", "Nothing here is as flat as it looks."],
    trap: ["Snap. Did you hear it?", "There. Right where I said."],
    capture: ["Take it. It was never mine.", "Hm. You bite back."],
    phase2: "Enough. Let us trade, you and I.",
    offer: "I can return what the meadow took. For one of yours. A fair trade.",
    declined: "No? The offer stands, in spirit.",
    traded: "A pleasure. Do not look under your feet.",
    win: "Another one for the field.",
    lose: "The trap was always you.",
  },
  angler: {
    id: "angler",
    name: "The Angler",
    figure: "angler",
    theme: "angler",
    scenery: "angler",
    intro: ["Quiet now. You will scare the fish.", "The grass is only water that forgot."],
    idle: ["Patience. Everything bites eventually.", "I only ever ask for the biggest.", "Do you feel the line?"],
    hook: ["Something is biting.", "Come here, little one."],
    capture: ["Hm. That one got away.", "Ha. A fighter."],
    phase2: "Lovely. Let me throw you something shiny.",
    bait: "Go on. Take it. It looks lonely.",
    win: "Dinner.",
    lose: "You are not what I fish for.",
  },
  prospector: {
    id: "prospector",
    name: "The Prospector",
    figure: "prospector",
    theme: "prospector",
    scenery: "prospector",
    intro: ["Gold in these hills. Gold in you, too.", "Take your time. I have all of it."],
    idle: ["Slow work. Honest work.", "Everything shines when you strike it right.", "Hold still. You look valuable."],
    pick: ["Hold still. You look valuable.", "Strike. Clean. Gold."],
    capture: ["Hm. Worth less than it looked.", "Careful. That one rings hollow."],
    phase2: "Everything glitters until it cracks.",
    win: "Struck it rich.",
    lose: "The vein ran dry.",
  },
  woodcarver: {
    id: "woodcarver",
    name: "The Woodcarver",
    phase2Name: "The Moon",
    figure: "woodcarver",
    theme: "woodcarver",
    scenery: "woodcarver",
    intro: ["I am making you. Hold still.", "Every face I wear, I whittled."],
    idle: ["Almost smooth.", "Shavings everywhere. Do not mind them.", "I carve what is left."],
    mask: ["Let me try a different face.", "That one never fit."],
    capture: ["A chip off the block.", "Hm. A splinter."],
    phase2: "Look up. The moon has been watching.",
    moon: "She never blinks.",
    win: "Finished. And so are you.",
    lose: "You are almost done. So am I.",
  },
};
export const ORDER = ["trapper", "angler", "prospector", "woodcarver"];
export const MASK_NAME = { trapper: "the Trapper", angler: "the Angler", prospector: "the Prospector" };
export const SIGIL_TEXT = {
  pusher: { name: "pusher", text: "moves into an enemy like a rook: shoves it instead of taking it", mark: ">>" },
  rooted: { name: "rooted", text: "the wind cannot move it", mark: "#" },
  ghost: { name: "ghost", text: "slides through one piece", mark: "~" },
};
export const PIECE_NAME = { P: "pawn", N: "glitch", B: "ray", R: "bulldozer", Q: "queen", K: "king" };
export const RUN_END_LINE = "Come back when the grass remembers you.";
// placeholders: replace with the real links
export const CONTACT_URL = "mailto:hello.nicolombardi@gmail.com?subject=Project%20enquiry";
export const REEL_URL = "/#work";
