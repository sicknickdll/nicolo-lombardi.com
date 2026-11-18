// ─────────────────────────────────────────────────────────────────────────────
// THE TAROT READER: how the guiding card changes what every other card means.
//
// Each guiding card gives the reading a TONE:
//   light  a kind reading: cards are read for what they offer
//   shade  a careful reading: cards are read for what they hide or cost
//   storm  a restless reading: cards are read for what they are about to change
// LIFE (life.js) holds each card's plain meaning, which is also its "light" version.
// Here are the other two versions, per topic. The font has no colon or semicolon.
// ─────────────────────────────────────────────────────────────────────────────
export const TONE_OF = {
  fool: "storm",
  magician: "light",
  "high-priestess": "shade",
  empress: "light",
  emperor: "light",
  hierophant: "light",
  lovers: "light",
  chariot: "storm",
  strength: "light",
  hermit: "shade",
  "wheel-of-fortune": "storm",
  justice: "shade",
  "hanged-man": "shade",
  death: "storm",
  temperance: "light",
  devil: "shade",
  tower: "storm",
  star: "light",
  moon: "shade",
  sun: "light",
  judgement: "storm",
  world: "light",
};

// What she adds when the guiding card is revealed: how it will colour the rest.
export const TONE_INTRO = {
  light: "It's a kind card. It will soften everything that follows.",
  shade: "It's a careful card. You'll get the truth, not the flattering version.",
  storm: "It's a restless card. Things will move, whether you push or not.",
};

export const TONES = {
  fool: {
    shade: {
      love: "You keep starting over so you never have to stay. Notice that.",
      money: "That impulse buy is a bandage. It won't hold.",
      family: "You left to breathe. Make sure you didn't leave to avoid a conversation.",
      work: "New job, same old you. Bring the lesson, not just the boxes.",
    },
    storm: {
      love: "Someone or something sweeps you off your feet. Pack light.",
      money: "A sudden chance appears. It won't wait for a spreadsheet.",
      family: "Someone at home is about to surprise everyone. Maybe it's you.",
      work: "An offer out of nowhere. Say yes before you're ready.",
    },
  },
  magician: {
    shade: {
      love: "Someone is performing for you. Check what happens when the show ends.",
      money: "A clever deal that's a little too clever. Read it twice.",
      family: "You manage everyone at home so well that nobody sees you're tired.",
      work: "You're very good at looking in control. Are you?",
    },
    storm: {
      love: "One bold move from you changes the whole thing. Make it.",
      money: "An idea turns into money fast. Strike while it's hot.",
      family: "You can fix the thing at home everyone thinks is broken. Start today.",
      work: "Launch it. The tools are ready, and so are you.",
    },
  },
  "high-priestess": {
    shade: {
      love: "They're keeping something back. So are you.",
      money: "There's a cost nobody has mentioned yet. Ask.",
      family: "Someone at home knows more than they're saying.",
      work: "Don't share your plans at work yet. Walls listen.",
    },
    storm: {
      love: "A secret comes out, and it changes the way you see them.",
      money: "Hidden information surfaces. Act on it quietly.",
      family: "An old family secret finally gets said out loud.",
      work: "You find out what's really going on at work. Use it wisely.",
    },
  },
  empress: {
    shade: {
      love: "You're mothering them. They need a partner, not a nurse.",
      money: "Comfort spending. The nice things are filling a gap.",
      family: "You give and give at home. Who gives to you?",
      work: "You're growing someone else's garden. Plant one of your own.",
    },
    storm: {
      love: "Something new is born between you. A home, a plan, maybe more.",
      money: "Things grow fast now. Make room for it.",
      family: "A new arrival or a new beginning changes the house.",
      work: "Your project suddenly takes root and spreads. Hold on.",
    },
  },
  emperor: {
    shade: {
      love: "Someone wants control more than closeness. Maybe both of you do.",
      money: "Rigid rules about money are costing you joy.",
      family: "An old authority at home still decides for you. Stop letting it.",
      work: "A boss who rules by fear. Protect yourself, quietly.",
    },
    storm: {
      love: "Time to set a boundary. It will shake things, and then steady them.",
      money: "Take charge of your money before someone else does.",
      family: "You become the one who decides at home. It's overdue.",
      work: "A change of command at work. Step up when it comes.",
    },
  },
  hierophant: {
    shade: {
      love: "You're following a script about love that someone else wrote.",
      money: "Doing it the safe way is costing you the better way.",
      family: "Tradition is keeping the peace and keeping you small.",
      work: "You're waiting for approval you don't need.",
    },
    storm: {
      love: "You break a rule about how love is supposed to look. Good.",
      money: "Leave the old system. It no longer pays.",
      family: "You do the holidays differently this year. Some will grumble.",
      work: "You outgrow the institution. Time to teach instead of learn.",
    },
  },
  lovers: {
    shade: {
      love: "Torn between two. Or between them and yourself.",
      money: "You want two things and you're paying for both badly.",
      family: "You're stuck in the middle of someone else's argument.",
      work: "A partnership with a crack in it. Look before you sign.",
    },
    storm: {
      love: "A choice arrives fast, and it changes everything after it.",
      money: "Two roads, one decision, this month. Choose.",
      family: "Someone at home forces a choice. Make it with your heart.",
      work: "Two offers, one deadline. Don't let the clock choose.",
    },
  },
  chariot: {
    shade: {
      love: "You're driving so fast they can't keep up. Slow down.",
      money: "Winning at money, losing at sleep.",
      family: "You keep leaving home to avoid what's at home.",
      work: "Ambition is steering. Where's it taking you, exactly?",
    },
    storm: {
      love: "Everything speeds up. A trip, a move, a yes.",
      money: "Money moves fast now. Keep your hands on the wheel.",
      family: "Distance, a move, a door you finally walk through.",
      work: "Full speed ahead. A promotion or a leap.",
    },
  },
  strength: {
    shade: {
      love: "You're being patient with someone who hasn't earned it.",
      money: "Gritting your teeth through it isn't a financial plan.",
      family: "You hold it together for everyone. It's costing you.",
      work: "You're absorbing someone else's temper at work. Stop.",
    },
    storm: {
      love: "A test of nerve. Speak up, gently, and it holds.",
      money: "Face the number you've been avoiding. You can take it.",
      family: "A family fight you can actually win, with kindness.",
      work: "Stand your ground in that meeting. Calmly.",
    },
  },
  hermit: {
    shade: {
      love: "You've been alone so long it feels safe. It isn't the same as happy.",
      money: "Hiding from the bills won't make them smaller.",
      family: "You've gone quiet with them. Silence is also a message.",
      work: "You've disappeared at work. Someone needs to see you.",
    },
    storm: {
      love: "Time alone ends. Someone knocks on the door.",
      money: "A quiet plan made in private is ready to go public.",
      family: "You come back to them changed. They'll notice.",
      work: "The thing you've worked on alone is ready. Show it.",
    },
  },
  "wheel-of-fortune": {
    shade: {
      love: "Up and down, again and again. You're not on a ride, you can get off.",
      money: "You're betting on luck. Luck doesn't do repeat business.",
      family: "The same old cycle at home. It won't break on its own.",
      work: "You're waiting for luck at work. Make some instead.",
    },
    storm: {
      love: "A big turn. Someone leaves or someone arrives.",
      money: "Fortune turns quickly. Save some of the good part.",
      family: "Something shifts at home. Nothing stays the same this season.",
      work: "Restructuring, change, a new chapter. Be on the right side of it.",
    },
  },
  justice: {
    shade: {
      love: "You're keeping score. Love isn't a ledger.",
      money: "Something you signed has a consequence. Check it.",
      family: "An old grudge is still being judged at the dinner table.",
      work: "Someone at work is taking credit. Keep records.",
    },
    storm: {
      love: "A decision gets made about the two of you. Be honest.",
      money: "A verdict on money arrives. Fair, if you were.",
      family: "Something unfair at home finally gets set right.",
      work: "A ruling, a contract, a review. It lands soon.",
    },
  },
  "hanged-man": {
    shade: {
      love: "You're waiting for them to change. They're waiting too.",
      money: "Money stuck in limbo. Stop waiting and ask.",
      family: "You've sacrificed so much for them that you've vanished.",
      work: "On hold forever. Some pauses are really exits.",
    },
    storm: {
      love: "The waiting ends. One of you lets go and everything rearranges.",
      money: "A pause becomes a pivot. Spend it differently.",
      family: "You see your family upside down, and it suddenly makes sense.",
      work: "You stop pushing, and the door opens by itself.",
    },
  },
  death: {
    shade: {
      love: "You're keeping something alive that already ended. Bury it kindly.",
      money: "An old cost keeps draining you. Cut it.",
      family: "A role you play at home has died. You're still acting it.",
      work: "That job ended in your head months ago.",
    },
    storm: {
      love: "An ending, quick and clean. Space for something real.",
      money: "Clear out the old. Something better takes its place fast.",
      family: "A chapter at home closes. Let it.",
      work: "A door closes hard. Another one is already ajar.",
    },
  },
  temperance: {
    shade: {
      love: "Keeping things calm by never saying what you want.",
      money: "Too careful. You're saving for a life you're not living.",
      family: "You water yourself down to keep the peace at home.",
      work: "Balanced, but bored. Add a little fire.",
    },
    storm: {
      love: "Two very different people find the middle. It works.",
      money: "Mix two incomes, two plans. The blend pays.",
      family: "An unexpected reconciliation at home.",
      work: "A merger, a collaboration, a new mix of skills.",
    },
  },
  devil: {
    shade: {
      love: "You know exactly why you can't leave. Say it out loud.",
      money: "A habit is eating your money. You know which one.",
      family: "The family pattern repeats through you. Break one link.",
      work: "The money keeps you, the job owns you.",
    },
    storm: {
      love: "Temptation knocks loudly. Decide who you are before you answer.",
      money: "A tempting deal. Very tempting. Walk away slowly.",
      family: "An old addiction or obsession at home comes into the open.",
      work: "You break the golden handcuffs. Scary, freeing.",
    },
  },
  tower: {
    shade: {
      love: "The cracks were there before. Pretending didn't fill them.",
      money: "Something you built on credit wobbles. Shore it up now.",
      family: "Everyone at home is holding up a wall that's already falling.",
      work: "The company, the plan, the boss. Something here isn't solid.",
    },
    storm: {
      love: "A truth comes out all at once. After the shock, clearer air.",
      money: "A sudden loss or expense. Then you rebuild better.",
      family: "Something shakes the house to its foundations. It needed it.",
      work: "Sudden change at work. What survives is worth keeping.",
    },
  },
  star: {
    shade: {
      love: "You're hoping for them instead of asking them.",
      money: "Wishing the numbers will fix themselves.",
      family: "You keep hoping they'll change. Hope less, talk more.",
      work: "Waiting to be discovered. Go and be found.",
    },
    storm: {
      love: "After a hard time, someone new and kind.",
      money: "Relief arrives sooner than expected.",
      family: "Healing at home, and faster than you'd think.",
      work: "Your name gets noticed. A real opportunity.",
    },
  },
  moon: {
    shade: {
      love: "Jealousy, guessing, scrolling at night. Stop and ask.",
      money: "Someone is hiding something in the numbers.",
      family: "An old fear from childhood is running the show at home.",
      work: "Gossip and half-truths at work. Trust facts only.",
    },
    storm: {
      love: "The confusion clears all at once. You'll know.",
      money: "A misunderstanding about money surfaces. Clear it up.",
      family: "A dream or a memory changes how you see someone at home.",
      work: "What was murky at work suddenly makes sense.",
    },
  },
  sun: {
    shade: {
      love: "Everything looks perfect from outside. Is it, inside?",
      money: "You're spending like it's always summer.",
      family: "Smiling at family dinners while something hurts.",
      work: "All shine, no rest. Burnout looks great on social media.",
    },
    storm: {
      love: "A burst of joy. A trip, a yes, a big laugh together.",
      money: "Good money news, sudden and bright.",
      family: "A celebration at home. Someone has good news.",
      work: "Success arrives, loudly. Enjoy the spotlight.",
    },
  },
  judgement: {
    shade: {
      love: "Replaying an old relationship to find out who was wrong.",
      money: "Old money mistakes still haunt you. Forgive them.",
      family: "Waiting for a family apology that may never come.",
      work: "Judging yourself by an old failure. It's not today's verdict.",
    },
    storm: {
      love: "Someone from the past calls. Answer, then decide.",
      money: "A debt is settled or repaid. Clean slate.",
      family: "A reunion that changes the family story.",
      work: "A calling you ignored comes back. This time, go.",
    },
  },
  world: {
    shade: {
      love: "Comfortable, complete, and a little too still.",
      money: "You've reached the goal. Now what? Don't drift.",
      family: "Everyone is fine. So why do you feel far away?",
      work: "Finished, but you won't let it be finished.",
    },
    storm: {
      love: "A big step together. Moving, travelling, committing.",
      money: "A chapter closes in profit. The next one starts right away.",
      family: "A family milestone. Everyone in one place.",
      work: "The big project wraps. A new world opens straight after.",
    },
  },
};
