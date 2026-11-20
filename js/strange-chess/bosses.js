// The four bosses of a run: who they are, what they say, how they tint the meadow.
// tint: hue shift of the grass in degrees (teal by default); phase: the extra shift in phase 2.
// Every line is short; the boss's name floats over his figure and his words type out under it.
export const RUN = ["trapper", "angler", "prospector", "woodcarver"];
export const BOSS = {
  trapper: {
    name: "The Trapper",
    phase2: "The Trader",
    tint: 8,
    phase: 14,
    intro: ["Mind your step. The grass keeps my secrets.", "Three teeth in the dark. Find them with your feet."],
    phaseLine: "Enough iron. Let us trade instead, you and I.",
    offer: "I kept something of yours. I want something else for it.",
    refused: "Pity. It would have suited you.",
    traded: "A fair trade. They always are, at first.",
    win: "Snap.",
    lose: "The iron goes back in the ground.",
  },
  angler: {
    name: "The Angler",
    tint: 30,
    phase: 16,
    intro: ["Quiet. The meadow is a lake if you wait long enough.", "Every fourth breath, I reel."],
    phaseLine: "Here. Something to bite on.",
    hook: "Hooked.",
    bait: "A pawn alone in the grass. Go on.",
    hooked: "It always bites.",
    win: "Landed.",
    lose: "The line goes slack.",
  },
  prospector: {
    name: "The Prospector",
    tint: -122,
    phase: 10,
    intro: ["Everything under the grass is worth something.", "Hold still. I'll make you precious."],
    phaseLine: "Gold is only rock that gave up. Watch it give way.",
    gold: "Precious.",
    win: "Weighed, and kept.",
    lose: "Dust. All of it.",
  },
  woodcarver: {
    name: "The Woodcarver",
    phase2: "The Moon",
    tint: -48,
    phase: 40,
    intro: ["I carved all of them, you know. Their faces.", "Which one shall I wear for you?"],
    mask: { trapper: "The Trapper's face. It still smells of iron.", angler: "The Angler's face. Damp.", prospector: "The Prospector's face. Heavy." },
    maskSwap: "Another face.",
    phaseLine: "No more masks. Look up.",
    moonWarn: "Hush. It is drawing breath.",
    win: "Back into the wood with you.",
    lose: "It sinks. Of course it sinks.",
    end: "Come back when the wood is dry.",
  },
};
export const TUTORIAL = { wind: "The wind is turning.", hole: "Holes are hungry.", first: "Tap a piece. Tip the scale five toward you." };
