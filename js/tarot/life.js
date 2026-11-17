// ─────────────────────────────────────────────────────────────────────────────
// THE TAROT READER, everyday edition: what each card says about the thing you came for
// (love, money, family or work), short, plain and a little magic. This is what she says.
//
// LIFE[card id]: one line per topic, plus `advice` (said for the Conscious Potential card) and
// `warning` (said for The Shadow). QUESTIONS: what she asks after the second card to steer the
// reading; an answer can switch the topic for the cards still to come.
// The font has no colon, semicolon or ellipsis: the lines avoid them.
// ─────────────────────────────────────────────────────────────────────────────
export const TOPICS = [
  { key: "love", label: "Love", reply: "Love. Of course it is." },
  { key: "money", label: "Money", reply: "Money. Honest, at least." },
  { key: "family", label: "Family", reply: "Family. Pull up a chair, this could take a while." },
  { key: "work", label: "Work", reply: "Work. Let's see who's really the boss." },
];

export const QUESTIONS = {
  love: {
    q: "Tell me. Is there someone already, or someone you're waiting for?",
    a: [
      { key: "already", label: "Someone already", reply: "Then this is about keeping it.", end: "Keep choosing them, out loud." },
      { key: "waiting", label: "Waiting", reply: "Then this is about making room.", end: "Make room, and someone will walk in." },
      { key: "family", label: "It's not love, really", reply: "Then it's family. It usually is.", to: "family", end: "It was family all along. Start there." },
    ],
  },
  money: {
    q: "Is it the money itself, or someone who depends on it?",
    a: [
      { key: "money", label: "The money", reply: "Then we count.", end: "Look at your numbers every Sunday. They behave when watched." },
      { key: "family", label: "Someone else", reply: "Then it's family. Money usually is.", to: "family", end: "The money was never the point. They are." },
    ],
  },
  family: {
    q: "Is it one person in particular?",
    a: [
      { key: "one", label: "Yes, one", reply: "Then everything I say, say it to them.", end: "Say it to them before the holidays say it for you." },
      { key: "all", label: "All of them", reply: "All of them. Naturally.", end: "You can't fix all of them. Fix your part." },
      { key: "love", label: "It's a partner", reply: "Ah. Then it's love wearing a family coat.", to: "love", end: "Treat them like the person you chose, not the furniture." },
    ],
  },
  work: {
    q: "Do you want to stay where you are?",
    a: [
      { key: "stay", label: "Stay", reply: "Then we make it bearable.", end: "If you stay, stay on purpose." },
      { key: "leave", label: "Leave", reply: "Then we plan the exit.", end: "If you leave, leave with a plan and your head up." },
      { key: "money", label: "It's the pay", reply: "So it's money. Let's talk money.", to: "money", end: "Ask for more. The worst they can say is no." },
    ],
  },
};

export const LIFE = {
  fool: {
    love: "Someone new, or you acting new. Either way, don't overthink the first date.",
    money: "You want to spend on a whim. Small whims are fine. Check the big one twice.",
    family: "You're the one who left, or wants to. They'll survive it. So will you.",
    work: "A fresh start, maybe a new job, and no idea what you're doing yet. Good.",
    advice: "Say yes to the small strange thing.",
    warning: "Running away is not the same as moving on.",
  },
  magician: {
    love: "You know exactly how to charm them. Try being honest instead. It works better.",
    money: "There's money in something you already know how to do. Start charging for it.",
    family: "You're the one who fixes everything at home. Somebody should fix something for you.",
    work: "You have the skills. You keep waiting for permission you don't need.",
    advice: "Use what's already on your table.",
    warning: "Looking busy is not the same as getting things done.",
  },
  "high-priestess": {
    love: "There's something unsaid between you two. You both know what it is.",
    money: "Your gut already said no to that deal. Listen to it.",
    family: "A family secret, or just the thing nobody mentions at dinner.",
    work: "Keep your plans quiet for now. Not everyone at work is on your side.",
    advice: "Trust the feeling you keep explaining away.",
    warning: "The silence that protects you can also lock you in.",
  },
  empress: {
    love: "Comfort, good food, touch. Someone wants to take care of you. Let them.",
    money: "Money comes in and goes out on nice things. Maybe save one nice thing.",
    family: "A mother, or someone who acts like one. Call her.",
    work: "Something you started is finally growing. Water it, don't dig it up.",
    advice: "Look after your body. It's been doing all the work.",
    warning: "Taking care of everyone else is a clever way to avoid yourself.",
  },
  emperor: {
    love: "Someone steady, maybe too steady. Rules in love are fine until they're all that's left.",
    money: "Make a budget. I know. Make it anyway.",
    family: "A father, or whoever runs the house. You still follow their rules.",
    work: "A boss, a contract, a structure. Play it straight and it will protect you.",
    advice: "Decide, and stick to it.",
    warning: "Control feels like safety. It isn't.",
  },
  hierophant: {
    love: "Marriage, or the question of it. Or what your family expects of it.",
    money: "Do it the boring, proper way. Banks, papers, signatures.",
    family: "Traditions, holidays, the way things have always been done at home.",
    work: "A mentor, a course, a certificate. Learn from someone who's done it.",
    advice: "Ask someone older. Then decide for yourself.",
    warning: "Doing what's expected can quietly become your whole life.",
  },
  lovers: {
    love: "Yes, it's about them. And about whether you actually choose them.",
    money: "A choice between two things you want. You can't have both this month.",
    family: "Someone at home will have to pick a side. It might be you.",
    work: "A partnership, a collaboration, or two offers on the table.",
    advice: "Choose. Not choosing is also a choice.",
    warning: "Wanting everything is how you end up with nothing.",
  },
  chariot: {
    love: "You're moving fast. Make sure they're in the car.",
    money: "Push for the raise. Push for the payment. You'll get it.",
    family: "Getting away from home. A move, a trip, a little distance.",
    work: "Momentum. Keep going and don't look sideways.",
    advice: "Pick a direction and drive.",
    warning: "Speed is not a plan.",
  },
  strength: {
    love: "Patience with them, patience with yourself. It's working, slowly.",
    money: "Don't panic-spend. Don't panic-save. Breathe.",
    family: "Someone at home tests your temper. Gentleness wins this one.",
    work: "A difficult person at work. You can handle them without a fight.",
    advice: "Be gentle, and don't back down.",
    warning: "Swallowing your anger is not the same as letting it go.",
  },
  hermit: {
    love: "You need some time alone before you're good company. That's allowed.",
    money: "Spend less, go out less, think more. It's a quiet season.",
    family: "You've pulled away from them lately. They noticed.",
    work: "Work alone for a while. The answer comes when the office is empty.",
    advice: "Turn your phone off for an evening.",
    warning: "Being alone can quietly turn into hiding.",
  },
  "wheel-of-fortune": {
    love: "Things are about to change between you. For the better, I think.",
    money: "Your luck is turning. Don't bet the house on it.",
    family: "The same argument comes round every year. This year it can end differently.",
    work: "A lucky break. Be ready when the phone rings.",
    advice: "Be ready when your moment comes round.",
    warning: "Blaming luck is easier than changing.",
  },
  justice: {
    love: "Who does more, who gives more. Time to say it out loud.",
    money: "Paperwork, taxes, a debt to settle. Settle it.",
    family: "An old unfairness at home wants to be talked about.",
    work: "A contract, a decision, a review. It will be fair, if you are honest.",
    advice: "Tell the truth, even the boring parts.",
    warning: "You judge yourself harder than anyone else ever would.",
  },
  "hanged-man": {
    love: "Everything is on hold. Stop pushing and look at it from their side.",
    money: "Wait before you buy it. In a week you won't want it.",
    family: "You keep giving things up for them. Ask for something back.",
    work: "Stuck. It won't last. Use the pause to rethink the whole thing.",
    advice: "Wait. Then look again.",
    warning: "Sacrificing yourself and waiting to be thanked rarely works.",
  },
  death: {
    love: "Something ends. A relationship, or the old way you were in one.",
    money: "Cancel the subscriptions. Close the old account. Clear it out.",
    family: "A goodbye of some kind, or a role at home you've outgrown.",
    work: "A job ends, or should. Something better needs the space.",
    advice: "Let one thing go this week.",
    warning: "Keeping dead things around doesn't keep them alive.",
  },
  temperance: {
    love: "Meet in the middle and you'll be fine.",
    money: "Not too much, not too little. A little each month adds up.",
    family: "You're the peacekeeper at home. It's tiring, and it's working.",
    work: "Slow and steady. Mix the two jobs, the two ideas, the two lives.",
    advice: "A little of everything, too much of nothing.",
    warning: "Keeping the peace can mean never saying what you want.",
  },
  devil: {
    love: "Desire, jealousy, the person you know is bad for you. Yes, that one.",
    money: "Debt, shopping, a habit that costs more than you admit.",
    family: "An old family pattern you keep repeating without meaning to.",
    work: "Golden handcuffs. Good money, bad feeling.",
    advice: "Name the habit out loud. It shrinks.",
    warning: "The chain is looser than you think. You just like it.",
  },
  tower: {
    love: "A big argument, or a truth that comes out. It clears the air.",
    money: "An unexpected expense. Annoying, but survivable.",
    family: "Something shakes the house. The walls were cracked anyway.",
    work: "A sudden change at work. What falls wasn't built well.",
    advice: "Knock it down yourself before it falls on you.",
    warning: "Holding up a broken thing only wears you out.",
  },
  star: {
    love: "Hope. Someone kind, or the return of your own good mood.",
    money: "It gets better, slowly. You can breathe again.",
    family: "Some healing at home. An apology, or a softer winter.",
    work: "Recognition is coming. Keep making the thing you love.",
    advice: "Hope a little. It's not stupid.",
    warning: "Wishing isn't doing.",
  },
  moon: {
    love: "Mixed signals. Don't read their messages at two in the morning.",
    money: "Read the small print. Someone isn't telling you everything.",
    family: "Old memories, old fears, a dream about someone at home.",
    work: "Rumours at work. Don't believe half of them.",
    advice: "Sleep on it before you decide.",
    warning: "Your fear is louder than the facts.",
  },
  sun: {
    love: "Warmth, laughter, a good summer together.",
    money: "Good news about money. Enjoy it, you've earned it.",
    family: "Children, or the child in you. Good days at home.",
    work: "Success, and the credit that comes with it.",
    advice: "Go outside. Say yes to the party.",
    warning: "Pretending everything's fine is also a kind of hiding.",
  },
  judgement: {
    love: "An ex comes back, or a second chance with someone.",
    money: "Old money comes back. A refund, a payment, a debt repaid.",
    family: "A reunion, or the call you've been avoiding. Make it.",
    work: "The job you actually wanted, knocking again.",
    advice: "Answer the call you keep ignoring.",
    warning: "Replaying the past won't change the verdict.",
  },
  world: {
    love: "Things come together. Moving in, a trip, a full circle.",
    money: "A project pays off. A chapter closes in the black.",
    family: "Everyone around one table. It happens less than you think. Enjoy it.",
    work: "You finish something big. Take the bow before the next one.",
    advice: "Finish what you started, then celebrate it.",
    warning: "Never finishing is a way of never being judged.",
  },
};
