// ─────────────────────────────────────────────────────────────────────────────
// THE TAROT READER (/archive/tarot/): the ritual from arrival to the last word.
//
// One explicit state machine (FLOW) and one ritual object (js/tarot/engine.js) are the single
// source of truth; the scene (stage.js, deck.js) only ever shows them. Phases:
//   INTRO → DECK_PRESENTED → SHUFFLING ⇄ SHUFFLE_COMPLETE → WAITING_FOR_CUT → CUTTING →
//   REASSEMBLING → GUIDING_CARD_REVEAL → GUIDING_CARD_DIALOGUE → CARD_SELECTION → CARD_FLIPPING →
//   CARD_COMMENTARY → NEXT_CARD_SELECTION … → CROSS_COMPLETE → FINAL_READING → END ⇄
//   READING_SUMMARY, and RESTART (gather the cards, shuffle again).
//
// Controls: mouse, touch and keyboard. Click / tap / Enter / Space moves the dialogue on (and
// speeds up an animation in progress). Arrow keys choose in the fan, or move the cut; Escape puts
// an inspected card back; M mutes. Every physical action also has a button.
// The reading in progress is kept in localStorage: reloading offers to continue it.
// Development: ?seed=123 gives a reproducible shuffle; ?debug exposes window.__tarot.
// ─────────────────────────────────────────────────────────────────────────────
import { createStage, CARD_H, CARD_W, CARD_T } from "./stage.js";
import { createDeck } from "./deck.js";
import { createAudio } from "./audio.js";
import { createDialogue } from "./dialogue.js";
import { openSummary, keepReading } from "./summary.js";
import { DECK_IDS, card } from "./cards.js";
import { TOPICS } from "./life.js";
import { PHASE_LINES } from "./lines.js";
import * as E from "./engine.js";
import { Vector3, Quaternion } from "../vendor/three.js";
import { play as playSound, loop as loopSound } from "../sound.js";
import { navigateTo } from "../menu.js";

const SAVE = "nl-tarot-v2";
const FLOW = {
  LOADING: ["INTRO"],
  INTRO: ["DECK_PRESENTED", "CARD_SELECTION", "NEXT_CARD_SELECTION", "CROSS_COMPLETE", "END"],
  DECK_PRESENTED: ["SHUFFLING"],
  SHUFFLING: ["SHUFFLE_COMPLETE"],
  SHUFFLE_COMPLETE: ["SHUFFLING", "WAITING_FOR_CUT"],
  WAITING_FOR_CUT: ["CUTTING"],
  CUTTING: ["REASSEMBLING"],
  REASSEMBLING: ["GUIDING_CARD_REVEAL"],
  GUIDING_CARD_REVEAL: ["GUIDING_CARD_DIALOGUE"],
  GUIDING_CARD_DIALOGUE: ["CARD_SELECTION"],
  CARD_SELECTION: ["CARD_FLIPPING"],
  CARD_FLIPPING: ["CARD_COMMENTARY"],
  CARD_COMMENTARY: ["NEXT_CARD_SELECTION", "CROSS_COMPLETE"],
  NEXT_CARD_SELECTION: ["CARD_FLIPPING"],
  CROSS_COMPLETE: ["FINAL_READING"],
  FINAL_READING: ["END"],
  END: ["READING_SUMMARY"],
  READING_SUMMARY: ["END"],
  RESTART: ["DECK_PRESENTED"],
};
// When a revealed card may be picked up and looked at.
const INSPECTABLE = new Set(["GUIDING_CARD_DIALOGUE", "CARD_SELECTION", "NEXT_CARD_SELECTION", "CARD_COMMENTARY", "CROSS_COMPLETE", "FINAL_READING", "END"]);
const ABORT = Symbol("abort");

export function mountTarot(root) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const params = new URLSearchParams(location.search);
  const debug = params.has("debug");
  const fixedSeed = params.has("seed") ? Number(params.get("seed")) >>> 0 : null;
  const touch = matchMedia("(hover: none)").matches;
  const low = (navigator.deviceMemory || 8) <= 3 || (navigator.hardwareConcurrency || 8) <= 3;
  const $ = (s) => root.querySelector(s);
  const html = document.documentElement;
  html.classList.add("tarot-page");

  const loading = $(".tr-loading");
  let stage, deck;
  try {
    stage = createStage($(".tr-stage"), { reduce, low });
    deck = createDeck(stage, DECK_IDS, { reduce });
  } catch (e) {
    console.error(e);
    root.classList.add("tr-failed");
    loading.querySelector("p").textContent = "The cards need WebGL, which this browser has turned off. The candles won't light.";
    return () => html.classList.remove("tarot-page");
  }
  const { eyes, hands, clock } = stage;
  const audio = createAudio();
  stage.sfx = (name) => audio.play(name);

  // ── state ──
  let alive = true,
    phase = "LOADING",
    ritual = null,
    active = null, // the card everyone is looking at
    hovered = null,
    kbIndex = -1,
    animating = 0,
    waiter = null,
    endMenu = null;
  const rng = fixedSeed != null ? E.seeded(fixedSeed) : E.secure();
  const seedFor = () => (fixedSeed != null ? fixedSeed : E.newSeed());

  function go(next) {
    const ok = (FLOW[phase] || []).includes(next) || next === "RESTART";
    if (!ok) {
      const msg = `Tarot: ${phase} → ${next} is not a valid transition`;
      if (debug) throw new Error(msg);
      console.warn(msg);
    }
    phase = next;
    root.dataset.phase = next;
  }
  const guard = async (p) => {
    const v = await p;
    if (!alive) throw ABORT;
    return v;
  };
  const anim = async (p) => {
    animating++;
    root.classList.add("tr-busy");
    try {
      return await guard(p);
    } finally {
      if (--animating === 0) root.classList.remove("tr-busy");
    }
  };
  const wait = (ms) => guard(clock.wait(ms));

  // ── saving ──
  function persist(extra = {}) {
    try {
      localStorage.setItem(SAVE, JSON.stringify({ ritual, at: Date.now(), ...extra }));
    } catch {}
  }
  function loadSaved() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE));
      return s && E.validRitual(s.ritual) ? s : null;
    } catch {
      return null;
    }
  }
  let saved = loadSaved();

  // ── dialogue: her lines and their cues ──
  const dialogue = createDialogue(root, {
    reduce,
    onType: () => audio.play("type"),
    onCue(line) {
      if (line.eyes) eyes.setState(line.eyes);
      if (line.hand === "present") deck.restHands();
      if (line.react) roomReacts(card(line.react).react);
    },
  });
  const say = (lines, opts) => guard(dialogue.say(lines, opts));
  function roomReacts(r) {
    if (!r) return;
    if (r.eyes) eyes.setState(r.eyes, r.eyes === "serious" ? { hold: 3, then: "watching" } : {});
    stage.react(r.light);
    stage.cameraFx(r.camera);
    if (r.sfx) audio.play(r.sfx);
    if (r.hand === "point" && active && deck.get(active).rest) deck.pointAt(active);
  }

  // ── waiting for the player ──
  function waitFor(actions) {
    clock.scale = 1;
    return guard(
      new Promise((resolve) => {
        waiter = { accept: new Set(actions), resolve };
        updateAffordances();
      }),
    );
  }
  function act(name, data) {
    if (!waiter?.accept.has(name)) return false;
    const w = waiter;
    waiter = null;
    updateAffordances();
    w.resolve({ a: name, data });
    return true;
  }
  const accepts = (name) => Boolean(waiter?.accept.has(name));
  function updateAffordances() {
    root.classList.toggle("tr-can-pick", accepts("pick"));
    root.classList.toggle("tr-can-cut", accepts("cut"));
    if (!accepts("pick")) setHover(null);
  }

  // ── prompts: the instruction on screen, and a button for every physical action ──
  const prompts = $(".tr-prompts");
  function prompt(items = [], hint = "") {
    prompts.innerHTML = "";
    for (const it of items) {
      const el = document.createElement(it.action ? "button" : "p");
      el.className = "tr-prompt" + (it.primary ? " primary" : "") + (it.action ? "" : " text");
      if (it.action) el.type = "button";
      el.textContent = it.label;
      if (it.action) el.addEventListener("click", (e) => (e.stopPropagation(), audio.unlock(), act(it.action, it.data?.())));
      prompts.append(el);
    }
    if (hint) {
      const h = document.createElement("p");
      h.className = "tr-hint";
      h.textContent = hint;
      prompts.append(h);
    }
    prompts.classList.toggle("on", items.length > 0 || Boolean(hint));
    // keyboard users land on the main action
    if (matchMedia("(hover: hover)").matches) prompts.querySelector("button.primary")?.focus({ preventScroll: true });
  }
  const clearPrompt = () => prompt([]);
  const setHint = (t) => {
    const h = prompts.querySelector(".tr-hint");
    if (h) h.textContent = t;
  };

  // ── the eyes follow what matters ──
  let pointer = { x: 0, y: 0, in: false };
  stage.onFrame(() => {
    const { W, H } = stage.size;
    let target = null;
    const id = hovered || active;
    if (id) target = stage.toScreen(deck.get(id).group.position);
    if (target) eyes.lookAt({ x: (target.x / W) * 2 - 1, y: -((target.y / H) * 2 - 1) * 0.8 });
    else if (pointer.in) eyes.lookAt({ x: ((pointer.x / W) * 2 - 1) * 0.55, y: -((pointer.y / H) * 2 - 1) * 0.4 });
    else eyes.lookAt(null);
  });

  // ── pointer: hover, pick, cut, inspect, advance ──
  const stageEl = $(".tr-stage");
  let down = null,
    cutting = null; // { n, x0, dx }
  const cutState = { n: 0, max: 0 };
  function deckZone(x, y) {
    // the stack, as seen on screen, with a margin: where a cut can be made
    if (!ritual) return null;
    const [cx, cz] = stage.layout.deck;
    const n = ritual.deck.length;
    const near = cz + CARD_H / 2;
    const top = stage.toScreen(new Vector3(cx, n * CARD_T, near)),
      bottom = stage.toScreen(new Vector3(cx, 0, near));
    const left = stage.toScreen(new Vector3(cx - CARD_W / 2, 0, near)),
      right = stage.toScreen(new Vector3(cx + CARD_W / 2, 0, near));
    const back = stage.toScreen(new Vector3(cx, n * CARD_T, cz - CARD_H / 2));
    const m = 40;
    if (x < left.x - m || x > right.x + m || y < back.y - m || y > bottom.y + m) return null;
    const k = (y - top.y) / Math.max(1, bottom.y - top.y);
    return Math.max(1, Math.min(n - 1, Math.round(k * n)));
  }
  function fanCards() {
    return [...deck.cards.values()].filter((c) => c.where === "fan" && !c.busy);
  }
  function fanOrder() {
    // left to right on screen, for the keyboard
    return fanCards().sort((a, b) => stage.toScreen(a.group.position).x - stage.toScreen(b.group.position).x);
  }
  function setHover(id) {
    if (hovered === id) return;
    if (hovered) deck.get(hovered).hoverTo = 0;
    hovered = id;
    if (id) {
      deck.get(id).hoverTo = 1;
      audio.play("hover");
    }
    stageEl.classList.toggle("tr-pointer", Boolean(id));
  }
  const revealedIds = () => (ritual ? [ritual.guiding, ...ritual.picks.map((p) => p.id)].filter(Boolean) : []);
  function cardAt(x, y, filter) {
    const h = stage.hit(x, y, deck.meshes(filter));
    let o = h?.object;
    while (o && !o.userData.cardId) o = o.parent;
    return o?.userData.cardId || null;
  }
  const canInspect = () => INSPECTABLE.has(phase) && !animating && !deck.inspecting;
  function hitEyes(x, y) {
    const p = stage.toScreen(eyes.group.position);
    return Math.abs(x - p.x) < 60 && Math.abs(y - p.y) < 30;
  }

  function onMove(e) {
    pointer = { x: e.clientX, y: e.clientY, in: true };
    const { W, H } = stage.size;
    stage.parallax((e.clientX / W) * 2 - 1, -((e.clientY / H) * 2 - 1));
    if (cutting) {
      const p = stage.onTable(e.clientX, e.clientY, 0.04);
      if (p) {
        cutting.dx = p.x - cutting.x0;
        deck.cutDrag(ritual.deck, cutting.n, cutting.dx, Math.min(0.06, Math.max(-0.03, p.z - cutting.z0)) * 0.5);
      }
      return;
    }
    if (accepts("pick") && (e.pointerType === "mouse" || down)) setHover(cardAt(e.clientX, e.clientY, (c) => c.where === "fan" && !c.busy));
    else if (accepts("cut")) {
      const n = deckZone(e.clientX, e.clientY);
      if (n) previewCut(n);
      stageEl.classList.toggle("tr-pointer", Boolean(n));
    } else if (e.pointerType === "mouse") {
      const over =
        (accepts("deck") && cardAt(e.clientX, e.clientY, (c) => c.where === "deck")) ||
        (canInspect() && cardAt(e.clientX, e.clientY, (c) => revealedIds().includes(c.id) && Boolean(c.rest)));
      stageEl.classList.toggle("tr-pointer", Boolean(over));
    }
  }
  function previewCut(n) {
    cutState.n = n;
    deck.cutPreview(ritual.deck, n);
  }
  function onDown(e) {
    audio.unlock();
    down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    if (accepts("cut")) {
      const n = deckZone(e.clientX, e.clientY);
      if (n) {
        previewCut(n);
        const p = stage.onTable(e.clientX, e.clientY, 0.04);
        cutting = { n, x0: p?.x || 0, z0: p?.z || 0, dx: 0 };
        stageEl.setPointerCapture?.(e.pointerId);
        audio.play("lift");
      }
    }
    if (accepts("pick") && e.pointerType !== "mouse") setHover(cardAt(e.clientX, e.clientY, (c) => c.where === "fan" && !c.busy));
  }
  function onUp(e) {
    const d = down;
    down = null;
    if (cutting) {
      const c = cutting;
      cutting = null;
      const side = Math.abs(c.dx) > 0.05 ? Math.sign(c.dx) : -1;
      act("cut", { n: c.n, side });
      return;
    }
    if (!d) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (accepts("pick") && hovered && (moved < 12 || e.pointerType !== "mouse")) {
      const id = hovered;
      setHover(null);
      return act("pick", id);
    }
    if (moved > 12) return;
    tap(e.clientX, e.clientY);
  }
  // A click or tap that is not a pick or a cut.
  function tap(x, y) {
    if (dying || leaving) return;
    if (matches.active) return matches.tap(x, y);
    if (hitEyes(x, y) && eyes.state !== "disappear" && stage.fx.level > 0.5) return poke();
    if (stage.fx.level > 0.5 && !deck.inspecting) {
      const ci = stage.candleAt(x, y);
      if (ci >= 0 && !(accepts("deck") && cardAt(x, y, (c) => c.where === "deck"))) return blowCandle(ci);
      const prop = stage.propAt(x, y);
      if (prop) return touchProp(prop);
    }
    if (deck.inspecting) return putBack();
    if (accepts("deck") && cardAt(x, y, (c) => c.where === "deck")) return act("deck");
    if (canInspect()) {
      const id = cardAt(x, y, (c) => revealedIds().includes(c.id) && Boolean(c.rest));
      if (id) return inspect(id);
    }
    if (dialogue.advance()) return;
    if (animating) clock.scale = reduce ? 4 : 3;
  }
  stageEl.addEventListener("pointermove", onMove);
  stageEl.addEventListener("pointerdown", onDown);
  stageEl.addEventListener("pointerup", onUp);
  stageEl.addEventListener("pointercancel", () => ((down = null), cutting && ((cutting = null), deck.clearLift(ritual.deck))));
  stageEl.addEventListener("pointerleave", (e) => {
    pointer.in = false;
    if (e.pointerType === "mouse") setHover(null);
  });
  $(".tr-dialogue").addEventListener("click", () => (audio.unlock(), dialogue.advance() || (animating && (clock.scale = 3))));

  function onKey(e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (root.querySelector(".tr-summary")) return;
    const tag = document.activeElement?.tagName;
    const onButton = tag === "BUTTON" || tag === "A";
    audio.unlock();
    if (e.key === "m" || e.key === "M") return toggleSound();
    if (e.key === "Escape" && deck.inspecting) return (e.preventDefault(), putBack());
    if (accepts("pick") && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      const list = fanOrder();
      if (!list.length) return;
      const cur = list.findIndex((c) => c.id === hovered);
      kbIndex = cur < 0 ? (e.key === "ArrowLeft" ? list.length - 1 : 0) : Math.max(0, Math.min(list.length - 1, cur + (e.key === "ArrowLeft" ? -1 : 1)));
      setHover(list[kbIndex].id);
      return;
    }
    if (accepts("cut") && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const n = cutState.n || Math.floor(ritual.deck.length / 2);
      previewCut(Math.max(1, Math.min(ritual.deck.length - 1, n + (e.key === "ArrowUp" ? -1 : 1))));
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      if (onButton) return; // the focused button handles it
      e.preventDefault();
      if (matches.active) return matches.key();
      if (deck.inspecting) return putBack();
      if (dialogue.advance()) return;
      if (accepts("pick") && hovered) return act("pick", hovered);
      if (accepts("cut") && cutState.n) return act("cut", { n: cutState.n, side: -1 });
      if (accepts("deck")) return act("deck");
      if (animating) return void (clock.scale = reduce ? 4 : 3);
      prompts.querySelector("button.primary, button")?.click();
    }
  }
  addEventListener("keydown", onKey);

  // ── inspecting a revealed card ──
  const caption = $(".tr-caption");
  async function inspect(id) {
    const c = card(id);
    const pos = ritual.guiding === id ? "The Guiding Card" : E.positionOf(ritual.picks.find((p) => p.id === id).position).label;
    if (!(await deck.inspect(id))) return;
    caption.innerHTML = `<b class="caslon">${c.name}</b><span>${pos} · ${c.roman}</span>`;
    caption.hidden = false;
    eyes.setState("watching");
  }
  async function putBack() {
    caption.hidden = true;
    await deck.uninspect();
  }

  // Poking her in the eye. Four warnings; the fifth time her hand comes for you.
  let pokes = 0,
    dying = false;
  function poke() {
    audio.play("poke");
    const line = PHASE_LINES.poked[pokes++];
    if (!line) return kill();
    // said aside, over whatever she was saying, without losing her place
    sayAside(line[0].t, line[0].eyes, 1800);
  }
  const aside = document.createElement("p");
  aside.className = "tr-aside";
  aside.setAttribute("aria-live", "assertive");
  root.append(aside);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // A line said aside, over whatever else is happening (her place in the ritual is kept).
  let asideQueue = Promise.resolve();
  function sayAside(t, eyesState, ms = 2200) {
    asideQueue = asideQueue.then(async () => {
      if (dying || leaving) return;
      if (eyesState) eyes.setState(eyesState, { hold: ms / 1000, then: "watching" });
      await dialogue.interject(t, ms); // in her usual line at the bottom, not a second one
    });
    return asideQueue;
  }

  // ── easter eggs ──
  // The candles: touch one and it goes out. Both out, and she hands you matches: strike one on the
  // box, then touch each candle with the flame.
  function blowCandle(i) {
    if (!stage.candles[i].onTo) return;
    audio.play("blow");
    stage.setCandle(i, false);
    if (stage.candlesLit === 1) sayAside("Careful. I need that one.", "suspicious");
    else {
      root.classList.add("tr-dark");
      sayAside("Wonderful. Now neither of us can see a thing.", "suspicious", 2600);
      sayAside("Here. Matches. Strike one on the box.", "watching", 2600).then(() => !dying && !leaving && matches.open());
    }
  }
  const PROP_LINES = {
    hourglass: ["Turn it as much as you like. It won't give you the time back.", "Time isn't your problem. Trust me.", "Again? It's sand, not a reset button."],
    coin: ["Heads or tails. The cards are better at this.", "Keep the change.", "That one's mine, by the way."],
  };
  const propCount = { hourglass: 0, coin: 0 };
  function touchProp(name) {
    if (name === "hourglass") (stage.flipHourglass(), audio.play("sand"));
    else (stage.tossCoin(), audio.play("coin"));
    const list = PROP_LINES[name];
    sayAside(list[propCount[name]++ % list.length], "amused");
  }
  const matches = createMatches();
  function createMatches() {
    const el = document.createElement("div");
    el.className = "tr-matches";
    el.innerHTML = `<div class="trm-box"><span class="trm-strike"></span></div><div class="trm-match" aria-label="A match: drag it across the top of the box"><span class="trm-head"></span></div>`;
    root.append(el);
    const box = el.querySelector(".trm-box"),
      strike = el.querySelector(".trm-strike"),
      match = el.querySelector(".trm-match");
    let lit = false,
      drag = null,
      burnOut = 0,
      rubbed = 0,
      moveFn = null;
    const api = {
      active: false,
      open() {
        api.active = true;
        el.classList.add("on");
        reset();
      },
      close() {
        api.active = false;
        lit = false;
        clearTimeout(burnOut);
        if (moveFn) removeEventListener("pointermove", moveFn);
        moveFn = null;
        root.classList.remove("trm-lit");
        el.classList.remove("on", "lit");
        match.classList.remove("lit", "free");
        match.style.transform = "";
        root.classList.remove("tr-dark");
      },
      tap(x, y) {
        if (!lit) return;
        const i = stage.candleAt(x, y);
        if (i < 0 || stage.candles[i].onTo) return;
        stage.setCandle(i, true);
        audio.play("strike");
        if (stage.candlesLit === 2) {
          api.close();
          sayAside("Better. Don't do that again.", "serious", 2200);
          sayAside("Let's get back to it.", "watching", 1600);
        } else sayAside("One more.", "watching", 1600);
      },
    };
    function reset() {
      lit = false;
      rubbed = 0;
      match.classList.remove("lit", "free");
      match.style.transform = "";
    }
    function follow(x, y) {
      const r = el.getBoundingClientRect();
      match.style.transform = `translate(${x - r.left - 6}px, ${y - r.top - 6}px) rotate(-35deg)`;
    }
    match.addEventListener("pointerdown", (e) => {
      if (lit) return;
      e.preventDefault();
      e.stopPropagation();
      audio.unlock();
      match.setPointerCapture(e.pointerId);
      match.classList.add("free");
      drag = { x: e.clientX };
      follow(e.clientX, e.clientY);
    });
    match.addEventListener("pointermove", (e) => {
      if (!drag || lit) return;
      follow(e.clientX, e.clientY);
      const s = strike.getBoundingClientRect();
      // the head has to be dragged along the striker, not just dropped on it
      if (e.clientX > s.left - 10 && e.clientX < s.right + 10 && e.clientY > s.top - 18 && e.clientY < s.bottom + 18) rubbed += Math.abs(e.clientX - drag.x);
      drag.x = e.clientX;
      if (rubbed > 70) light(e.clientX, e.clientY);
    });
    const end = () => {
      drag = null;
      if (!lit) reset();
    };
    match.addEventListener("pointerup", end);
    match.addEventListener("pointercancel", end);
    function light(x, y) {
      lit = true;
      drag = null;
      audio.play("strike");
      match.classList.add("lit");
      el.classList.add("lit");
      // the burning match follows the pointer; touch the candles with it
      root.classList.add("trm-lit");
      moveFn = (e) => follow(e.clientX, e.clientY);
      addEventListener("pointermove", moveFn);
      follow(x, y);
      burnOut = setTimeout(() => {
        removeEventListener("pointermove", moveFn);
        moveFn = null;
        root.classList.remove("trm-lit");
        if (!api.active) return;
        audio.play("blow");
        el.classList.remove("lit");
        reset();
        sayAside("It burnt out. Strike another.", "amused", 1800);
      }, 22000);
    }
    // keyboard: Enter strikes and lights both
    api.key = () => {
      if (!lit) light(innerWidth / 2, innerHeight / 2);
      [0, 1].forEach((i) => stage.setCandle(i, true));
      api.close();
      sayAside("Better. Don't do that again.", "serious", 2200);
      sayAside("Let's get back to it.", "watching", 1600);
    };
    return api;
  }
  async function kill() {
    dying = true;
    alive = false; // every flow in progress stops here
    waiter = null;
    dialogue.cancel();
    clearPrompt();
    endMenu?.classList.remove("on");
    caption.hidden = true;
    aside.classList.remove("on");
    matches.close();
    root.classList.add("tr-dying");
    stopAmbience(0.4);
    clock.scale = 1;
    eyes.setState("dramatic", { hold: 60 });
    audio.play("dread");
    stage.push(0);
    // her right hand rises out of the dark and comes, slowly, at your face
    const cam = stage.camera;
    const fwd = new Vector3(0, 0, -1).applyQuaternion(cam.quaternion),
      down = new Vector3(0, -1, 0).applyQuaternion(cam.quaternion);
    const reach = cam.position.clone().addScaledVector(fwd, 0.16).addScaledVector(down, 0.035);
    const palmToYou = cam.quaternion.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2));
    hands.left.release();
    hands.left.set({ pos: new Vector3(0.45, 0.02, -1.1), yaw: -0.3, pose: "relaxed", speed: 2 });
    hands.right.release();
    hands.right.set({ pos: new Vector3(-0.15, 0.25, -0.6), quat: palmToYou, pose: "claw", speed: 1.4 });
    await sleep(1300);
    hands.right.set({ pos: reach, quat: palmToYou, pose: "open", speed: 1.15 });
    await sleep(2600);
    // it closes
    hands.right.setPose("grip", 26);
    await sleep(160);
    audio.play("crack");
    stage.snapNeck();
    await sleep(900);
    stage.freeze();
    await sleep(1000);
    try {
      localStorage.removeItem(SAVE);
    } catch {}
    location.assign("/");
  }

  // ── sound: M mutes the synthesised room (the recorded layers follow it) ──
  function toggleSound() {
    audio.unlock();
    audio.setMuted(!audio.muted);
    if (audio.muted) stopAmbience();
    else startAmbience();
  }
  // Recorded layers (assets/sounds): an ambience under the drone, a sound for each decision, and
  // now and then some foley in the dark.
  let stopAmb = null,
    foleyTimer = 0;
  function startAmbience() {
    if (stopAmb || audio.muted || !alive) return;
    try {
      stopAmb = loopSound("tarot-ambience", 0.2, 4);
    } catch {
      stopAmb = () => {}; // never let a sound stop the ritual
    }
    const foley = () => {
      foleyTimer = setTimeout(foley, 35000 + Math.random() * 45000);
      if (alive && !audio.muted && !document.hidden) playSound("tarot-fooley", 0.16);
    };
    foleyTimer = setTimeout(foley, 20000 + Math.random() * 20000);
  }
  function stopAmbience(out = 1.2) {
    stopAmb?.(out);
    stopAmb = null;
    clearTimeout(foleyTimer);
  }
  const decided = () => !audio.muted && playSound("tarot-decision", 0.5);

  // ── leaving: she says goodbye, the candles go out, back to the Archive ──
  let leaving = false;
  $(".tr-back").addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (leaving || dying) return;
    goodbye();
  });
  async function goodbye() {
    leaving = true;
    alive = false; // the ritual stops where it is
    waiter = null;
    dialogue.cancel();
    clearPrompt();
    endMenu?.classList.remove("on");
    caption.hidden = true;
    root.classList.add("tr-leaving");
    matches.close();
    eyes.setState("soft");
    deck.withdrawHands(2);
    dialogue.say([{ t: "Goodbye.", eyes: "soft" }]).catch(() => {});
    await sleep(1300);
    audio.play("blow");
    stage.lights(0, 0.5); // the candles are blown out
    stopAmbience(1.6);
    await sleep(700);
    eyes.setState("disappear");
    dialogue.cancel();
    await sleep(900);
    stage.fade(0);
    await sleep(1000);
    navigateTo("/archive/");
  }

  // ─────────────────────────── the ritual ───────────────────────────
  // Her questions: the answers appear as words under her line; click or tap one (or use Tab + Enter).
  async function ask(lines, options) {
    await say(lines, { hold: true });
    prompt(options.map((o, i) => ({ label: o.label, action: "answer", primary: i === 0, data: () => o.key })));
    const { data } = await waitFor(["answer"]);
    decided();
    clearPrompt();
    dialogue.clear();
    return data;
  }

  async function run() {
    // loading: the back of the cards and the type
    await Promise.all([deck.backReady, document.fonts?.load?.('24px "Heavyweight"').catch(() => {}), new Promise((r) => setTimeout(r, 700))]);
    if (!alive) return;
    // her eyes, alone while it loads, close; the dark stays dark; then the session begins
    loading.classList.add("closing");
    await sleep(reduce ? 150 : 900);
    if (!alive) return;
    loading.classList.add("gone");
    await sleep(reduce ? 0 : 600);
    go("INTRO");
    stage.setShot("wide", 0);
    stage.lights(0, 0);
    stage.fade(1);
    deck.withdrawHands();
    hands.left.snap();
    hands.right.snap();
    const resumable = saved && saved.ritual.guiding;
    if (resumable) return resume(saved);
    eyes.setState("disappear");
    await wait(reduce ? 200 : 1100);
    // two eyes open in the dark
    eyes.setState("suspicious");
    await wait(reduce ? 200 : 900);
    eyes.setState("idle");
    await say(E.phaseLines(saved ? "returning" : "arrival", seedFor(), "a"));
    startAmbience(); // after her first line: the visitor has clicked, sound may play
    // the candles catch, the room appears
    stage.lights(1, reduce ? 0.3 : 2.4);
    audio.play("slide");
    await anim(stage.setShot("table", reduce ? 0 : 2600));
    ritual = E.newRitual({ seed: seedFor() });
    await anim(deck.presentDeck(ritual.deck));
    go("DECK_PRESENTED");
    await chooseTopic();
    await ritualFlow();
  }

  async function chooseTopic() {
    const topic = await ask(E.phaseLines("topic", ritual.seed), TOPICS.map((t) => ({ key: t.key, label: t.label })));
    ritual = E.setTopic(ritual, topic);
    await say([{ t: TOPICS.find((t) => t.key === topic).reply, eyes: "amused" }]);
  }

  async function ritualFlow() {
    await shufflePhase();
    await cutPhase();
    await guidingPhase();
    await spreadPhase();
    await finalPhase();
    await endPhase();
  }

  async function shufflePhase() {
    await say(E.phaseLines("shuffle", ritual.seed), { hold: true });
    await waitFor(["deck"]);
    dialogue.clear();
    for (let count = 0; ; ) {
      go("SHUFFLING");
      eyes.setState("watching");
      ritual = E.shuffleDeck(ritual, rng);
      persist();
      active = ritual.deck[0];
      await anim(deck.shuffle(ritual.deck));
      active = null;
      go("SHUFFLE_COMPLETE");
      count++;
      if (count === 4) await say(E.phaseLines("shuffleMany", ritual.seed));
      // touching the deck shuffles again; she also asks
      await say(E.phaseLines("shuffleMore", ritual.seed), { hold: true });
      prompt([
        { label: "Again", action: "answer", data: () => "again" },
        { label: "That's enough", action: "answer", primary: true, data: () => "enough" },
      ]);
      const { a, data } = await waitFor(["answer", "deck"]);
      if (a === "answer") decided();
      clearPrompt();
      dialogue.clear();
      if (a === "answer" && data === "enough") break;
    }
  }

  async function cutPhase() {
    go("WAITING_FOR_CUT");
    await anim(stage.setShot("cut", reduce ? 0 : 1200));
    await say(E.phaseLines("cut", ritual.seed), { hold: true });
    cutState.n = 0;
    const { data } = await waitFor(["cut"]);
    go("CUTTING");
    const before = ritual.deck;
    ritual = E.cutDeck(ritual, data.n);
    persist();
    go("REASSEMBLING");
    eyes.setState("curious");
    const merged = await anim(deck.finishCut(before, data.n, data.side));
    if (merged.join() !== ritual.deck.join()) console.error("Tarot: the deck on the table doesn't match the cut");
    await anim(stage.setShot("table", reduce ? 0 : 1100));
    await say(E.phaseLines("cutDone", ritual.seed));
  }

  async function guidingPhase() {
    await say(E.phaseLines("guidingBefore", ritual.seed), { hold: true });
    await waitFor(["deck"]);
    dialogue.clear();
    go("GUIDING_CARD_REVEAL");
    ritual = E.revealGuiding(ritual);
    persist();
    active = ritual.guiding;
    eyes.setState("curious");
    stage.push(0.3);
    await anim(deck.revealGuiding(ritual.guiding, ritual.deck));
    stage.react("flare");
    stage.fx.boostTo = 1.25;
    go("GUIDING_CARD_DIALOGUE");
    const gl = E.guidingLines(ritual);
    await say([...gl.before, ...gl.open, ...gl.after]);
    stage.fx.boostTo = 1;
    stage.push(0);
    await anim(deck.placeGuide(ritual.guiding));
    active = null;
  }

  async function spreadPhase(from = 0) {
    if (from === 0) {
      await say(E.phaseLines("spreadBefore", ritual.seed));
      await anim(deck.fanOut(ritual.deck));
    }
    for (let i = ritual.picks.length; i < E.POSITIONS.length; i++) await pickOne(i);
  }
  async function pickOne(i) {
    const P = E.POSITIONS[i];
    go(i === 0 ? "CARD_SELECTION" : "NEXT_CARD_SELECTION");
    eyes.setState("watching");
    deck.restHands();
    dialogue.say(E.pickLines(P.key, ritual.seed), { hold: true }).catch(() => {});
    const idle = setTimeout(() => !dialogue.active && dialogue.say(E.phaseLines("idle", ritual.seed, `idle${i}`), { hold: true }).catch(() => {}), 26000);
    let id;
    try {
      ({ data: id } = await waitFor(["pick"]));
    } finally {
      clearTimeout(idle);
    }
    dialogue.cancel();
    clearPrompt();
    setHover(null);
    go("CARD_FLIPPING");
    ritual = E.pickCard(ritual, id);
    persist();
    active = id;
    eyes.setState("curious");
    await anim(deck.revealPick(id));
    go("CARD_COMMENTARY");
    const com = E.commentary(ritual, i);
    await say([com.lines[0]]);
    const placing = anim(deck.placePick(id, P.key));
    await say(com.lines.slice(1));
    await placing;
    deck.restHands();
    active = null;
    // after the second card she checks she's reading the right thing, and may change course
    if (i === 1 && !(ritual.answers || []).some((a) => a.after === 1)) {
      const q = E.question(ritual, 1);
      const key = await ask([{ t: q.q, eyes: "curious" }], q.a);
      ritual = E.answer(ritual, 1, key);
      persist();
      await say([{ t: q.a.find((a) => a.key === key).reply, eyes: "amused" }]);
    }
  }

  async function finalPhase() {
    go("CROSS_COMPLETE");
    persist({ stage: "final" });
    eyes.setState("watching");
    await say(E.phaseLines("crossDone", ritual.seed));
    go("FINAL_READING");
    const fr = E.finalReading(ritual);
    stage.darken(true);
    deck.highlight([ritual.guiding], 0.34, 0.07);
    await anim(stage.setShot("final", reduce ? 0 : 1600));
    await say(E.phaseLines("finalBefore", ritual.seed));
    for (const st of fr.stages) {
      active = st.id;
      deck.highlight([st.id, ritual.guiding], 0.48, 0.03);
      deck.pointAt(st.id);
      await say(st.lines);
    }
    active = null;
    const six = revealedIds();
    deck.highlight(six, 0.42, 0.03);
    deck.restHands();
    stage.push(0.25);
    await say(fr.synthesis.sentences.map((t) => ({ t, eyes: "soft" })));
    stage.push(0);
    persist({ stage: "done", summary: E.summary(ritual) });
  }
  // Short sentences travel in pairs, long ones alone.
  function groupSentences(parts) {
    const out = [];
    for (const p of parts.flatMap((s) => s.match(/[^.!?]+[.!?]+(\s|$)/g) || [s]).map((s) => s.trim())) {
      const last = out[out.length - 1];
      if (last && last.length + p.length < 120) out[out.length - 1] = `${last} ${p}`;
      else out.push(p);
    }
    return out;
  }

  async function endPhase() {
    go("END");
    stage.darken(false);
    deck.unhighlight();
    eyes.setState("soft");
    await say(E.phaseLines("end", ritual.seed), { hold: true });
    deck.withdrawHands(1.6); // she sits back into the dark
    await endMenuLoop();
  }
  async function endMenuLoop() {
    for (;;) {
      showEnd(true);
      const { a } = await waitFor(["review", "again", "keep"]);
      decided();
      showEnd(false);
      if (a === "again") return restart();
      go("READING_SUMMARY");
      const sum = E.summary(ritual);
      const note = a === "keep" ? (keepReading(sum) ? "Saved on this device. You can also download it as an image, or print it." : "This browser won't let me keep it here. Download it as an image instead.") : "";
      const how = await guard(openSummary(root, sum, { note }));
      go("END");
      if (how === "again") return restart();
    }
  }
  function showEnd(on) {
    if (!endMenu) {
      endMenu = document.createElement("div");
      endMenu.className = "tr-end";
      endMenu.innerHTML = `<button type="button" data-a="review">Review Reading</button><button type="button" data-a="again">Begin Again</button><button type="button" data-a="keep">Save Reading</button>`;
      endMenu.addEventListener("click", (e) => {
        const b = e.target.closest("[data-a]");
        if (b) (e.stopPropagation(), act(b.dataset.a));
      });
      root.append(endMenu);
    }
    endMenu.classList.toggle("on", on);
    endMenu.inert = !on;
    if (on) endMenu.querySelector("button").focus({ preventScroll: true });
  }

  async function restart() {
    go("RESTART");
    dialogue.cancel();
    clearPrompt();
    showEnd(false);
    if (deck.inspecting) await putBack();
    caption.hidden = true;
    stage.darken(false);
    stage.push(0);
    deck.unhighlight();
    active = null;
    try {
      localStorage.removeItem(SAVE);
    } catch {}
    // gather everything into one stack, in the order the cards are picked up
    const order = ritual ? [...ritual.deck, ...ritual.picks.map((p) => p.id).reverse(), ritual.guiding].filter(Boolean) : DECK_IDS.slice();
    ritual = E.newRitual({ seed: seedFor(), deck: order });
    eyes.setState("amused");
    await anim(stage.setShot("table", reduce ? 0 : 900));
    await anim(deck.gather(order));
    go("DECK_PRESENTED");
    await say([{ t: "Again, then.", eyes: "idle" }]);
    await chooseTopic();
    await ritualFlow();
  }

  async function resume(s) {
    ritual = s.ritual;
    root.addEventListener("pointerdown", startAmbience, { once: true });
    deck.restore(ritual);
    stage.lights(1, reduce ? 0 : 1.6);
    await anim(stage.setShot("table", reduce ? 0 : 1800));
    eyes.setState("idle");
    deck.restHands();
    const done = s.stage === "done" && E.isComplete(ritual);
    if (done) {
      await say([...E.phaseLines("returning", ritual.seed, "r"), ...E.phaseLines("reviewOffer", ritual.seed)]);
      go("END");
      deck.unhighlight();
      return endMenuLoop();
    }
    const a = await ask(E.phaseLines("resume", ritual.seed), [
      { key: "resume", label: "Finish it" },
      { key: "anew", label: "Start over" },
    ]);
    if (a === "anew") return restart();
    if (!E.isComplete(ritual)) {
      await spreadPhase(ritual.picks.length);
    }
    await finalPhase();
    await endPhase();
  }

  // relayout when the screen changes shape
  const offLayout = stage.onLayout(() => ritual && deck.relayout(ritual));

  run().catch((e) => {
    if (e !== ABORT) console.error(e);
  });

  if (debug)
    window.__tarot = {
      get phase() {
        return phase;
      },
      get ritual() {
        return ritual;
      },
      get waiting() {
        return waiter ? [...waiter.accept] : [];
      },
      get animating() {
        return animating;
      },
      get dialogueActive() {
        return dialogue.active;
      },
      screenOf: (id) => stage.toScreen(deck.get(id).group.position),
      fanOrder: () => fanOrder().map((c) => c.id),
      where: (id) => deck.get(id).where,
      deckScreen: () => {
        const [cx, cz] = stage.layout.deck;
        return stage.toScreen(new Vector3(cx, ritual.deck.length * CARD_T, cz + CARD_H / 2 - 0.01));
      },
      act,
      stage,
      deck,
    };

  return () => {
    alive = false;
    stopAmbience(0.3);
    waiter = null;
    dialogue.cancel();
    removeEventListener("keydown", onKey);
    offLayout();
    deck.dispose();
    stage.dispose();
    audio.dispose();
    html.classList.remove("tarot-page");
    if (debug) delete window.__tarot;
  };
}
