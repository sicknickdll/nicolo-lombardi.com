// ─────────────────────────────────────────────────────────────────────────────
// STRANGE CHESS (/archive/strange-chess/): the run around the rules — title, four bosses,
// candles, the campfire, phase changes, the Trader's offer, the win and the loss — plus the
// loop and input. rules.js decides, art/view.js shows, ai.js (in a worker) plays the boss.
//
// Controls: tap / click a piece, then a target (on touch a push is shown before it's confirmed).
// Keyboard: arrows move over the squares, Enter / Space select and move, R restarts the fight,
// Esc pauses, M sound.
// Development: ?hotseat plays both sides by hand; ?seed=123 fixes the run; ?debug exposes
// window.__strangeChess (state, fight(i), phase2(), trade(), moonWarn(), campfire(), win(),
// lose(), title()) so tests can reach every screen.
// ─────────────────────────────────────────────────────────────────────────────
import { createView } from "./art/view.js";
import { createAudio } from "./audio.js";
import { BOSS, RUN, TUTORIAL } from "./bosses.js";
import * as R from "./rules.js";
import { rng } from "./rng.js";

// The AI's worker. In the built site tools/build.mjs bundles it as its own file and injects its
// address here (esbuild define); from the sources it is loaded as a module next to this file.
/* global __SC_WORKER__ */
const WORKER_URL = typeof __SC_WORKER__ !== "undefined" ? __SC_WORKER__ : new URL("./ai-worker.js", import.meta.url).href;
export const DEPTH = { null: 3, trapper: 2, angler: 3, prospector: 3, woodcarver: 3 };
// The win screen's links (placeholders: set them to the contact page and the reel).
export const CONTACT_URL = "CONTACT_URL";
export const REEL_URL = "REEL_URL";
const SIGIL_TEXT = {
  pusher: ["Pusher", "moving into an enemy, it may shove it (and what's behind) instead of taking it"],
  rooted: ["Rooted", "the wind can't move it"],
  ghost: ["Ghost", "while sliding, it passes through one piece"],
};
const SQUARE = (x, y) => "abcdef"[x] + (y + 1);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function mountStrangeChess(root) {
  const params = new URLSearchParams(location.search);
  const debug = params.has("debug");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const low = (navigator.deviceMemory || 8) <= 3 || (navigator.hardwareConcurrency || 8) <= 3;
  const html = document.documentElement;
  html.classList.add("sc-page");
  const stage = root.querySelector(".sc-stage");
  const live = root.querySelector(".sc-live");
  const panel = root.querySelector(".sc-panel");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  stage.appendChild(canvas);
  const V = createView(canvas, { reduce, low, seed: 7 });
  const audio = createAudio();
  let alive = true,
    raf = 0,
    last = performance.now();
  const t0 = last;
  const G = {
    mode: "title", // title | fight | campfire | win | over
    paused: false,
    state: null,
    human: { p: true, b: params.has("hotseat") },
    thinking: false,
    token: 0,
    tradeGive: null,
    resultShown: false,
    queue: [], // boss lines waiting to be said
  };
  const fixedSeed = params.has("seed") ? Number(params.get("seed")) >>> 0 : null;
  const run = { seed: 0, index: 0, candles: 2, army: [], attempt: 0, first: true, seen: {} };
  let rand = rng(1);

  // Adaptive quality: if frames run long, render at a lower pixel ratio, then draw fewer blades.
  // Laptops keep everything; a slow phone settles at 30 fps instead of stuttering.
  let dprCap = 2;
  const perf = { frames: 0, time: 0, settled: 0 };
  const target = matchMedia("(hover: none)").matches ? 1000 / 30 : 1000 / 45;
  function adapt(ms) {
    if (document.hidden) return;
    perf.frames++;
    perf.time += ms;
    if (perf.frames < 90) return;
    const avg = perf.time / perf.frames;
    perf.frames = perf.time = 0;
    if (avg <= target * 1.1 || perf.settled > 6) return;
    perf.settled++;
    const dpr = Math.min(dprCap, devicePixelRatio || 1);
    if (dpr > 1.01) {
      dprCap = dpr > 1.6 ? 1.5 : 1;
      resize();
    } else if (V.meadow.quality > 0.45) V.meadow.quality -= 0.15;
    if (debug) console.info(`Strange Chess: ${avg.toFixed(1)} ms a frame; pixel ratio ${Math.min(dprCap, devicePixelRatio || 1)}, grass ${Math.round(V.meadow.quality * 100)}%`);
  }
  function resize() {
    const r = stage.getBoundingClientRect();
    V.resize(Math.max(320, r.width), Math.max(400, r.height), Math.min(dprCap, devicePixelRatio || 1));
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  const announce = (s) => live && (live.textContent = s);

  // ── the boss's mind, in a worker (or here, if workers are unavailable) ──
  let worker = null,
    reqId = 0;
  const pending = new Map();
  try {
    worker = new Worker(WORKER_URL, { type: "module" });
    worker.onmessage = (e) => {
      const cb = pending.get(e.data.id);
      pending.delete(e.data.id);
      if (cb) cb(e.data);
    };
    worker.onerror = (e) => {
      console.error("Strange Chess: the AI worker failed; thinking on the main thread instead.", e.message || e);
      worker = null;
      for (const cb of pending.values()) cb({ error: "worker" });
      pending.clear();
    };
  } catch (err) {
    console.error("Strange Chess: no AI worker", err);
  }
  function think(state) {
    const opts = { maxDepth: DEPTH[state.boss] || 3, budget: 650 };
    const local = () => import("./ai.js").then((m) => m.chooseMove(state, opts));
    if (!worker) return local();
    return new Promise((resolve) => {
      const id = ++reqId;
      pending.set(id, (d) => (d.error ? (d.error !== "worker" && console.error("Strange Chess AI:", d.error), local().then(resolve)) : resolve(d)));
      worker.postMessage({ id, state, opts });
    });
  }
  function bossTurn() {
    if (G.thinking || G.paused || !G.state || G.state.result || G.state.turn !== "b" || G.human.b || G.mode !== "fight") return;
    G.thinking = true;
    const token = G.token,
      s = G.state;
    const pause = new Promise((r) => setTimeout(r, 400 + Math.random() * 500));
    Promise.all([think(s), pause])
      .then(([res]) => {
        G.thinking = false;
        if (!alive || token !== G.token || G.state !== s) return;
        doMove(res.move);
      })
      .catch((err) => {
        G.thinking = false;
        console.error(err);
      });
  }

  // ── what the boss says ──
  let sayHold = 0;
  const boss = () => (G.state && G.state.boss ? BOSS[G.state.boss] : null);
  function say(line, prio = false) {
    if (!line) return;
    if (prio) {
      // interrupts whatever he was saying
      G.queue = [];
      V.say(line);
      announce(`${V.boss ? V.boss.name : ""}: ${line}`);
      sayHold = 2.2 + line.length * 0.02;
    } else G.queue.push(line);
  }
  // timed on the wall clock (not frame time), so a slow device doesn't keep a line up forever
  let holdUntil = 0;
  function tickDialogue() {
    if (!V.sayDone()) return;
    const now = performance.now();
    if (sayHold > 0) {
      holdUntil = now + sayHold * 1000;
      sayHold = 0;
    }
    if (now < holdUntil) return;
    if (G.queue.length) {
      const line = G.queue.shift();
      V.say(line);
      announce(`${V.boss ? V.boss.name : ""}: ${line}`);
      sayHold = 1.8 + line.length * 0.02;
    } else if (V.sayText && now > holdUntil + 2500) V.say("");
  }

  // ── panels: plain monospace text and links over the meadow (title, campfire, offers, pause) ──
  function showPanel(htmlText, cls = "") {
    V.quietUI = cls === "offer";
    panel.className = "sc-panel on " + cls;
    panel.innerHTML = htmlText;
    panel.hidden = false;
    const first = panel.querySelector("button, a");
    if (first && matchMedia("(hover: hover)").matches) first.focus({ preventScroll: true });
  }
  function hidePanel() {
    V.quietUI = false;
    panel.className = "sc-panel";
    panel.hidden = true;
    panel.innerHTML = "";
  }
  panel.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    e.preventDefault();
    const act = b.dataset.act,
      arg = b.dataset.arg;
    ACTIONS[act] && ACTIONS[act](arg);
  });
  const candleText = () => Array.from({ length: 2 }, (_, i) => (i < run.candles ? "<span class=lit>¡</span>" : "<span>.</span>")).join(" ");

  // ── the run ──
  function showTitle(line = "") {
    G.mode = "title";
    V.hint = null;
    G.token++;
    G.state = null;
    V.hidden = true;
    V.campfire = false;
    V.camera = 0;
    V.meadow.clear = 0;
    V.setBoss(null);
    V.say("");
    V.meadow.tintTarget = 0;
    V.meadow.dim = 0;
    showPanel(
      `${line ? `<p class="sc-line">${line}</p>` : ""}<h2 class="sc-title">STRANGE CHESS</h2><p class="sc-sub">four strangers in a night meadow. chess, with broken physics.<br>two candles. tip the scale five toward you.</p><p class="sc-acts"><button type="button" data-act="begin">[ begin ]</button></p><p class="sc-small">tap a piece, then a square &middot; R restarts a fight &middot; Esc pauses &middot; M sound</p>`,
      "title",
    );
  }
  function begin() {
    run.seed = fixedSeed ?? (Math.random() * 2 ** 31) >>> 0;
    rand = rng(run.seed ^ 0x5bd1e995);
    run.index = 0;
    run.candles = 2;
    run.attempt = 0;
    run.first = true;
    run.seen = {};
    run.army = R.SLOTS.map((_, slot) => ({ slot, sig: [] }));
    startFight();
  }
  function startFight() {
    hidePanel();
    const id = G.human.b ? null : RUN[run.index];
    G.token++;
    G.thinking = false;
    G.resultShown = false;
    G.queue = [];
    G.mode = "fight";
    G.state = R.newFight({ seed: (run.seed + run.index * 7919 + run.attempt * 104729) >>> 0, boss: id, army: run.army });
    V.hidden = false;
    V.campfire = false;
    V.camera = 0;
    V.meadow.clear = 0;
    V.candles = run.candles;
    V.set(G.state);
    select(null);
    const b = id ? BOSS[id] : null;
    V.setBoss(b ? { kind: id, name: b.name } : null);
    V.meadow.tintTarget = b ? b.tint : 0;
    V.meadow.windTarget = { x: 0, y: 0 };
    V.windWarn = null;
    if (b) {
      if (run.attempt === 0) b.intro.forEach((l) => say(l));
      else say(["Again, then.", "Back so soon.", "The candle gutters."][run.attempt % 3]);
      if (id === "woodcarver") say(b.mask[G.state.mask.now]);
    }
    if (run.first && run.attempt === 0) V.showHint(TUTORIAL.first, 6);
    setStatus();
    announce(b ? `${b.name}. Fight ${run.index + 1} of 4.` : "A game.");
  }
  function setStatus() {
    const s = G.state;
    if (!s) return;
    if (s.result) V.status = "";
    else if (G.human.b) V.status = s.turn === "p" ? "pale to move" : "dark to move";
    else if (s.turn === "p") V.status = s.skip.p > 0 ? "the bait holds you, a turn lost" : s.trade === "open" ? "the trader waits" : "your move";
    else V.status = "he is thinking";
  }

  // ── moves ──
  const humanTurn = () => G.mode === "fight" && !G.paused && G.state && !G.state.result && G.human[G.state.turn] && !V.busy() && G.tradeGive === null && G.state.trade !== "open";
  function select(id) {
    V.sel = id;
    V.targets = id != null ? R.movesFor(G.state, id) : [];
    V.pushHover = null;
    if (id != null) audio.play("select");
  }
  function doMove(m) {
    const s = R.applyMove(G.state, m);
    select(null);
    V.play(s);
    G.state = s;
    setStatus();
    const e = s.events.find((e) => e.type === "move");
    if (e) {
      const p = R.byId(s, e.id);
      if (p) announce(`${p.side === "p" ? "Your" : "His"} ${R.NAMES[p.t].toLowerCase()} to ${SQUARE(e.to.x, e.to.y)}. The scale stands at ${s.scale}.`);
    }
  }
  // what each event means for the words and the sound
  V.onEvent = (e, s) => {
    const b = boss();
    switch (e.type) {
      case "move":
        audio.play("move");
        break;
      case "pushed":
        audio.play("push");
        break;
      case "destroy":
        audio.play("capture");
        V.scale = s.scale;
        break;
      case "trap":
        audio.play("trap");
        break;
      case "windWarn":
        if (run.first && !run.seen.wind) (run.seen.wind = true), V.showHint(TUTORIAL.wind);
        announce(`The wind is turning. It blows at the end of next round.`);
        break;
      case "gust":
        audio.play("gust");
        break;
      case "erode":
        if (e.integ === 0 && run.first && !run.seen.hole) (run.seen.hole = true), V.showHint(TUTORIAL.hole);
        break;
      case "hook":
        if (b && b.hook && !e.held) say(b.hook);
        break;
      case "gold":
        if (b && b.gold) say(b.gold);
        break;
      case "bait":
        if (b && b.bait) say(b.bait);
        break;
      case "hooked":
        if (b && b.hooked) say(b.hooked, true);
        break;
      case "mask":
        if (b) say(b.maskSwap), say(b.mask[e.mask]);
        break;
      case "moonWarn":
        if (b && b.moonWarn) say(b.moonWarn);
        announce("The Moon is drawing breath: next round it strikes every piece in its two rows.");
        break;
      case "phase":
        phaseChange(e.boss);
        break;
    }
  };
  // Phase 2: the screen dims, mist rolls in, the boss speaks, the grass shifts hue, then the rule.
  function phaseChange(id) {
    const b = BOSS[id];
    audio.play("phase");
    const start = performance.now();
    const T = reduce ? 1.2 : 3;
    const step = () => {
      if (!alive) return;
      const k = (performance.now() - start) / 1000 / T;
      const up = Math.min(1, k * 3),
        down = k > 0.75 ? Math.max(0, 1 - (k - 0.75) * 4) : 1;
      V.meadow.dim = 0.85 * up * down;
      V.meadow.mistBoost = 1 * up * (k > 0.75 ? 0.4 + 0.6 * down : 1);
      if (k < 1) requestAnimationFrame(step);
      else V.meadow.mistBoost = 0.25;
    };
    step();
    say(b.phaseLine, true);
    V.meadow.tintTarget = b.tint + b.phase;
    if (b.phase2 && id === "trapper") V.setBoss({ kind: id, name: b.phase2 });
    announce(`${b.name}: phase two.`);
  }

  // ── the Trader's offer (the Trapper's phase 2) ──
  function openTrade() {
    const offer = R.tradeOffer(G.state);
    if (!offer) return;
    G.tradeGive = -1;
    select(null);
    say(BOSS.trapper.offer, true);
    showPanel(
      `<p class="sc-who">The Trader</p><p>Your <b>${R.NAMES[offer.back.t].toLowerCase()}</b> back, on the square of a piece you give him. Tap the piece you would give (not your king).</p><p class="sc-acts"><button type="button" data-act="refuse">[ refuse ]</button></p>`,
      "offer",
    );
  }
  function proposeGive(p) {
    const offer = R.tradeOffer(G.state);
    G.tradeGive = p.id;
    V.sel = p.id;
    V.targets = [];
    showPanel(
      `<p class="sc-who">The Trader</p><p>Your ${R.NAMES[p.t].toLowerCase()} on ${SQUARE(p.x, p.y)} for your ${R.NAMES[offer.back.t].toLowerCase()}?</p><p class="sc-acts"><button type="button" data-act="give">[ give it ]</button> <button type="button" data-act="trade">[ another piece ]</button> <button type="button" data-act="refuse">[ refuse ]</button></p>`,
      "offer",
    );
  }
  function closeTrade(giveId) {
    const s = R.trade(G.state, giveId);
    G.tradeGive = null;
    hidePanel();
    select(null);
    V.play(s);
    G.state = s;
    say(giveId == null ? BOSS.trapper.refused : BOSS.trapper.traded, true);
    setStatus();
  }

  // ── the end of a fight ──
  function fightOver() {
    G.resultShown = true;
    const s = G.state;
    const won = s.result.winner === "p";
    const b = boss();
    if (b) say(won ? b.lose : b.win, true);
    if (G.human.b || !b) {
      announce(won ? "Pale wins." : "Dark wins.");
      return setTimeout(() => alive && G.mode === "fight" && G.state === s && showPanel(`<p>${won ? "pale" : "dark"} tips the scale.</p><p class="sc-acts"><button type="button" data-act="again">[ again ]</button></p>`), 1600);
    }
    const why = { scale: won ? "The scale tips your way." : "The scale tips his way.", king: won ? "His king falls." : "Your king falls.", time: "Forty rounds. The scale decides.", army: won ? "He has nothing left." : "You have nothing left.", moon: "The Moon falls." }[s.result.reason];
    announce(why);
    setTimeout(() => {
      if (!alive || G.state !== s) return;
      if (won) {
        run.first = false;
        run.attempt = 0;
        if (s.result.reason === "moon" || run.index === RUN.length - 1) return winRun();
        run.index++;
        campfire();
      } else {
        run.candles--;
        V.candles = run.candles;
        if (run.candles <= 0) return loseRun();
        run.attempt++;
        showPanel(`<p class="sc-line">${why}</p><p>A candle goes out.</p><p class="sc-candles" aria-label="${run.candles} candle left">${candleText()}</p><p class="sc-acts"><button type="button" data-act="retry">[ face ${esc(b.name.toLowerCase())} again ]</button></p>`);
      }
    }, reduce ? 1400 : 2600);
  }
  function loseRun() {
    showTitle(`The Woodcarver: “${BOSS.woodcarver.end}”`);
    announce(`The last candle goes out. The Woodcarver: ${BOSS.woodcarver.end}`);
  }
  function winRun() {
    G.mode = "win";
    V.hint = null;
    V.say("");
    G.queue = [];
    hidePanel();
    const start = performance.now();
    const T = reduce ? 1 : 8;
    const step = () => {
      if (!alive || G.mode !== "win") return;
      const k = Math.min(1, (performance.now() - start) / 1000 / T);
      V.meadow.clear = 0.9 * k;
      V.figureAlpha = 1 - Math.min(1, k * 2);
      V.camera = k;
      if (k < 1) requestAnimationFrame(step);
      else {
        V.hidden = true;
        showPanel(
          `<p class="sc-line">The Moon sinks into the meadow. The grass goes quiet.</p><p>Thank you for playing.</p><p class="sc-acts"><a href="${CONTACT_URL}">[ get in touch ]</a> <a href="${REEL_URL}">[ watch the reel ]</a></p><p class="sc-acts"><button type="button" data-act="again">[ play again ]</button></p>`,
          "win",
        );
      }
    };
    step();
    announce("The Moon sinks into the meadow. You won the run.");
  }

  // ── the campfire: one piece takes a sigil for the rest of the run ──
  function campfire(pickSlot = null, warn = null) {
    G.mode = "campfire";
    V.hint = null;
    G.token++;
    V.hidden = true;
    V.campfire = true;
    V.setBoss(null);
    V.say("");
    G.queue = [];
    V.meadow.tintTarget = 20;
    const next = BOSS[RUN[run.index]];
    const name = (a) => {
      const [t, x, y] = R.SLOTS[a.slot];
      return `${R.NAMES[t].toLowerCase()} ${SQUARE(x, y)}`;
    };
    if (warn) {
      const a = run.army.find((a) => a.slot === warn.slot);
      return showPanel(
        `<p class="sc-who">The campfire</p><p>Your ${name(a)} already carries <b>${SIGIL_TEXT[a.sig[0]][0]}</b>. A second sigil burns it one time in two, and a burnt piece is gone for the rest of the run.</p><p class="sc-acts"><button type="button" data-act="sigil" data-arg="${warn.slot}:${warn.sig}:sure">[ risk it ]</button> <button type="button" data-act="fire">[ choose again ]</button></p>`,
        "fire",
      );
    }
    if (pickSlot != null) {
      const a = run.army.find((a) => a.slot === pickSlot);
      return showPanel(
        `<p class="sc-who">The campfire</p><p>Your ${name(a)}. Which sigil?</p><ul class="sc-list">${R.SIGILS.filter((g) => !a.sig.includes(g))
          .map((g) => `<li><button type="button" data-act="sigil" data-arg="${a.slot}:${g}">[ ${SIGIL_TEXT[g][0].toLowerCase()} ]</button> <span>${SIGIL_TEXT[g][1]}</span></li>`)
          .join("")}</ul><p class="sc-acts"><button type="button" data-act="fire">[ another piece ]</button></p>`,
        "fire",
      );
    }
    showPanel(
      `<p class="sc-who">The campfire</p><p>Rest. Give one of your pieces a sigil; it keeps it for the rest of the run. A piece holds two at most.</p><ul class="sc-army">${run.army
        .map((a) => `<li><button type="button" data-act="pick" data-arg="${a.slot}" ${a.sig.length >= 2 ? "disabled" : ""}>${name(a)}${a.sig.length ? ` <i>${a.sig.map((g) => SIGIL_TEXT[g][0].toLowerCase()).join(", ")}</i>` : ""}</button></li>`)
        .join("")}</ul><p class="sc-candles" aria-label="${run.candles} candles">${candleText()}</p><p class="sc-acts"><button type="button" data-act="walk">[ walk on to ${esc(next.name.toLowerCase())} ]</button></p>`,
      "fire",
    );
  }
  function giveSigil(arg) {
    const [slotS, sig, sure] = arg.split(":");
    const slot = +slotS;
    const a = run.army.find((a) => a.slot === slot);
    if (!a || a.sig.includes(sig) || a.sig.length >= 2) return campfire();
    if (a.sig.length === 1 && !sure) return campfire(null, { slot, sig });
    let outcome;
    if (a.sig.length === 1 && rand() < 0.5) {
      run.army = run.army.filter((x) => x !== a);
      outcome = "It burns. The piece is gone.";
    } else {
      a.sig.push(sig);
      outcome = `It takes ${SIGIL_TEXT[sig][0].toLowerCase()}.`;
    }
    announce(outcome);
    const next = BOSS[RUN[run.index]];
    showPanel(`<p class="sc-who">The campfire</p><p class="sc-line">${outcome}</p><p class="sc-acts"><button type="button" data-act="walk">[ walk on to ${esc(next.name.toLowerCase())} ]</button></p>`, "fire");
  }

  // ── pause ──
  function pause(on = !G.paused) {
    if (G.mode !== "fight") return;
    G.paused = on;
    if (on)
      showPanel(
        `<p class="sc-who">Paused</p><p class="sc-acts sc-col"><button type="button" data-act="resume">[ resume ]</button><button type="button" data-act="restart">[ restart the run ]</button><button type="button" data-act="sound" aria-pressed="${audio.on}">[ sound: ${audio.on ? "on" : "off"} ]</button><a href="/archive/">[ leave ]</a></p>`,
        "pause",
      );
    else hidePanel();
  }
  const ACTIONS = {
    begin,
    again: () => (G.human.b ? startFight() : begin()),
    retry: startFight,
    walk: startFight,
    fire: () => campfire(),
    pick: (slot) => campfire(+slot),
    sigil: giveSigil,
    refuse: () => closeTrade(null),
    trade: () => openTrade(),
    give: () => closeTrade(G.tradeGive),
    resume: () => pause(false),
    restart: () => ((G.paused = false), begin()),
    sound: () => {
      audio.toggle();
      pause(true);
    },
  };

  // ── input: tap a piece, tap a target; on touch a push is previewed before it is confirmed ──
  let down = null,
    previewed = null;
  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  function hoverAt(px, py) {
    const L = V.layout();
    V.hover = G.mode === "fight" ? L.at(px, py) : null;
    const sq = V.hover;
    V.pushHover = sq ? V.targets.find((m) => m.kind === "push" && m.x === sq.x && m.y === sq.y) || null : null;
  }
  function tap(px, py, isTouch) {
    if (!V.sayDone()) V.skipSay();
    const s = G.state;
    if (!s || G.mode !== "fight" || G.paused || V.busy()) return;
    const hit = V.pick(px, py);
    const sq = hit.square;
    // choosing the piece to give the Trader
    if (G.tradeGive !== null) {
      const p = hit.piece != null ? R.byId(s, hit.piece) : sq ? R.pieceAt(s, sq.x, sq.y) : null;
      if (p && p.side === "p" && p.t !== "K") proposeGive(p);
      return;
    }
    if (!humanTurn()) return;
    if (V.sel != null && sq) {
      const ms = V.targets.filter((m) => m.x === sq.x && m.y === sq.y);
      const m = ms.find((m) => m.kind === "cap") || ms.find((m) => m.kind === "push") || ms[0];
      if (m) {
        if (m.kind === "push" && isTouch && previewed !== m) {
          previewed = m;
          V.pushHover = m;
          return;
        }
        previewed = null;
        return doMove(m);
      }
    }
    const p = hit.piece != null ? R.byId(s, hit.piece) : sq ? R.pieceAt(s, sq.x, sq.y) : null;
    if (p && p.side === s.turn && G.human[p.side]) select(p.id === V.sel ? null : p.id);
    else select(null);
  }
  const onMove = (e) => hoverAt(...local(e));
  function onDown(e) {
    const [x, y] = local(e);
    down = { x, y };
    if (e.pointerType !== "mouse") hoverAt(x, y);
  }
  function onUp(e) {
    if (!down) return;
    const [x, y] = local(e);
    if (Math.hypot(x - down.x, y - down.y) < 14) tap(x, y, e.pointerType !== "mouse");
    down = null;
  }
  function onLeave() {
    V.hover = null;
    V.pushHover = null;
  }
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointerleave", onLeave);

  function onKey(e) {
    const k = e.key;
    if (k === "Escape") {
      if (G.tradeGive !== null) return;
      e.preventDefault();
      return pause();
    }
    if (e.target.closest && e.target.closest("button, a, input") && k !== "m" && k !== "M") return;
    if (k === "m" || k === "M") return audio.toggle();
    if (G.mode !== "fight" || G.paused) return;
    if (k === "r" || k === "R") return startFight();
    const L = V.layout();
    const h = V.hover || { x: 2, y: 1 };
    if (k.startsWith("Arrow")) {
      e.preventDefault();
      const nx = Math.max(0, Math.min(5, h.x + (k === "ArrowRight") - (k === "ArrowLeft"))),
        ny = Math.max(0, Math.min(5, h.y + (k === "ArrowUp") - (k === "ArrowDown")));
      hoverAt(L.left + (nx + 0.5) * L.sqW, L.top + (5 - ny + 0.5) * L.sqH);
      const p = R.pieceAt(G.state, nx, ny);
      announce(`${SQUARE(nx, ny)}${p ? `: ${p.side === "p" ? "your" : p.side === "b" ? "his" : ""} ${R.NAMES[p.t].toLowerCase()}` : ""}${R.isHole(G.state, nx, ny) ? ": a hole" : ""}`);
    } else if ((k === "Enter" || k === " ") && V.hover) {
      e.preventDefault();
      const sq = V.hover;
      const p = R.pieceAt(G.state, sq.x, sq.y);
      if (G.tradeGive !== null) return p && p.side === "p" && p.t !== "K" && proposeGive(p);
      if (V.sel != null && V.targets.some((m) => m.x === sq.x && m.y === sq.y)) tap(L.left + (sq.x + 0.5) * L.sqW, L.top + (5 - sq.y + 0.5) * L.sqH, false);
      else if (p && humanTurn() && p.side === G.state.turn && G.human[p.side]) select(p.id === V.sel ? null : p.id);
    }
  }
  addEventListener("keydown", onKey);

  // ── loop ──
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    adapt(now - last);
    last = now;
    try {
      V.frame((now - t0) / 1000, dt);
      tickDialogue();
      const s = G.state;
      if (G.mode === "fight" && s && !G.paused && !V.busy()) {
        if (s.result && !G.resultShown) fightOver();
        else if (!s.result) {
          if (s.turn === "b" && !G.human.b) bossTurn();
          else if (G.human[s.turn] && s.skip[s.turn] > 0) doMove({ kind: "pass" });
          else if (s.turn === "p" && s.trade === "open" && G.tradeGive === null) openTrade();
        }
      }
    } catch (err) {
      console.error(err);
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  if (G.human.b) begin();
  else showTitle();

  if (debug)
    window.__strangeChess = {
      get state() {
        return G.state;
      },
      set state(s) {
        G.state = s;
        V.set(s);
        setStatus();
      },
      get mode() {
        return G.mode;
      },
      run,
      rules: R,
      view: V,
      move: (m) => doMove(m),
      begin,
      // start fight i of the run (0 Trapper … 3 Woodcarver)
      fight(i = 0) {
        if (!run.army.length) begin();
        run.index = i;
        run.attempt = 0;
        startFight();
      },
      // phase 2 at once, played as the game would play it
      phase2() {
        const s = R.enterPhase2({ ...G.state, scale: Math.max(G.state.scale, 3), events: [] });
        V.play(s);
        G.state = s;
        setStatus();
      },
      // the Trader's offer with a lost queen to give back
      trade() {
        const s = R.clone(G.state);
        if (!s.lost.p.length) s.lost.p.push({ t: "Q", slot: 2, sig: [] });
        s.boss = "trapper";
        s.phase = 2;
        s.trade = "open";
        s.turn = "p";
        G.state = s;
        V.set(s);
      },
      moonWarn() {
        const s = R.clone(G.state);
        if (s.moon) {
          s.moon.charging = true;
          const m = s.pieces.find((p) => p.t === "M");
          s.moon.rows = [m.y, m.y + 1];
        }
        G.state = s;
        V.set(s);
      },
      campfire: () => {
        if (!run.army.length) begin();
        run.index = Math.max(1, run.index);
        campfire();
      },
      win: () => {
        if (!run.army.length) begin();
        winRun();
      },
      lose: () => {
        run.candles = 1;
        G.state = { ...G.state, result: { winner: "b", reason: "scale" } };
        fightOver();
      },
      title: () => showTitle(),
      // end the current fight now, as if it had been played out
      result(winner = "p", reason = "scale") {
        G.state = { ...G.state, result: { winner, reason }, events: [] };
      },
    };

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    if (worker) worker.terminate();
    audio.close();
    removeEventListener("keydown", onKey);
    html.classList.remove("sc-page");
    canvas.remove();
    hidePanel();
    if (window.__strangeChess) delete window.__strangeChess;
  };
}
