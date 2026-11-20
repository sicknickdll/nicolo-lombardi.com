// STRANGE CHESS: the run. Title → (fight → campfire) × 3 → the Woodcarver → the end.
// This file is the conductor: it owns the run and the fight state (plain objects from rules.js),
// takes the player's input, asks the AI (aiClient.js) for the boss's moves, and plays what the
// rules report as events through the stage (stage.js). Nothing here decides what a move does.
//   /archive/strange-chess/?seed=123  reproducible run     ?boss=2  start at a boss     ?debug  window.__sc
import { newFight, legalMoves, movesFrom, applyMove, resolvePending, applyTrade, declineTrade, passStuck, defaultArmy, previewPush, ix, xOf, yOf, effective, tradeOptions, WIND_NAMES, WIND_DIRS, SIGILS, VALUE, bodies } from "./rules.js";
import * as R from "./rules.js";
import { makeRng } from "./rng.js";
import { createStage } from "./stage.js";
import { createAudio } from "./audio.js";
import { createAI } from "./aiClient.js";
import { BOSSES, ORDER, MASK_NAME, SIGIL_TEXT, PIECE_NAME, RUN_END_LINE, CONTACT_URL, REEL_URL } from "./bosses.js";

const CANCEL = Symbol("cancel");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ARROW = ["↑", "→", "↓", "←"];

export function mountStrangeChess(root) {
  const q = (s) => root.querySelector(s);
  const canvas = q(".sc-canvas"),
    elName = q(".sc-name"),
    elSay = q(".sc-say"),
    elWind = q(".sc-wind"),
    elTip = q(".sc-tip"),
    elRound = q(".sc-round"),
    elOver = q(".sc-overlay"),
    elLive = q(".sc-live");
  const params = new URLSearchParams(location.search);
  const debug = params.has("debug");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const html = document.documentElement;
  html.classList.add("chess-page");

  const stage = createStage({ canvas, reduce });
  const audio = createAudio();
  const ai = createAI();
  const offs = [];
  const on = (el, t, fn, o) => (el.addEventListener(t, fn, o), offs.push(() => el.removeEventListener(t, fn, o)));

  let run = null,
    fight = null,
    mode = "loading",
    paused = false,
    destroyed = false;
  let sayToken = 0,
    tipTimer = 0;
  const seed0 = params.has("seed") ? Number(params.get("seed")) >>> 0 : (Math.random() * 4294967296) >>> 0;

  // ── layout ────────────────────────────────────────────────────────────────────────────────
  let dprCap = Math.min(window.devicePixelRatio || 1, matchMedia("(max-width: 720px)").matches ? 1.5 : 2);
  function fit() {
    const w = root.clientWidth || innerWidth,
      h = root.clientHeight || innerHeight;
    stage.resize(w, h, dprCap);
    if (run?.army && mode === "fight") stage.syncVis(fight.s);
    place();
  }
  function place() {
    const L = stage.layout;
    if (!L) return;
    const top = L.figFeet - L.figH;
    elName.style.left = L.figX + "px";
    elName.style.top = top - 66 + "px";
    elSay.style.left = L.figX + "px";
    elSay.style.top = top - 46 + "px";
    elSay.style.width = Math.min(380, L.W - 24) + "px";
    const right = L.W - (L.bx + L.cs * 6);
    root.style.setProperty("--hud-top", L.hudY + "px");
    root.style.setProperty("--hud-right", Math.max(10, right + 6) + "px");
    root.style.setProperty("--band-top", L.by + L.ch * 1.7 + "px");
    root.style.setProperty("--band-w", Math.min(L.W - 20, Math.max(L.cs * 6, 300)) + "px");
  }
  let rzT = 0;
  const onResize = () => {
    clearTimeout(rzT);
    rzT = setTimeout(fit, 140);
  };
  on(window, "resize", onResize);

  // ── words ─────────────────────────────────────────────────────────────────────────────────
  // typewriter dialogue under the boss's name. Resolves once typed and read; a click skips ahead.
  async function say(text, { hold = 900, quick = false } = {}) {
    const tok = ++sayToken;
    elSay.classList.remove("sc-fade");
    elSay.textContent = "";
    if (!text) return;
    elLive.textContent = text;
    const step = reduce || quick ? 0 : 26;
    let skipped = false;
    const skip = () => (skipped = true);
    elSay.addEventListener("pointerdown", skip, { once: true });
    for (let i = 1; i <= text.length; i++) {
      if (tok !== sayToken) return;
      elSay.textContent = text.slice(0, i);
      if (step && !skipped) {
        if (i % 3 === 0) audio.tick();
        await sleep(step);
      }
    }
    if (tok !== sayToken) return;
    if (!skipped) await sleep(reduce ? 400 : hold + text.length * 18);
    if (tok === sayToken) elSay.classList.add("sc-fade");
  }
  const quip = (text) => void say(text, { hold: 1400 });
  const pick = (a) => (Array.isArray(a) ? a[Math.floor(Math.random() * a.length)] : a);
  function tip(text) {
    elTip.textContent = text;
    elTip.classList.add("on");
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => elTip.classList.remove("on"), 4200);
  }
  on(elTip, "pointerdown", () => elTip.classList.remove("on"));
  function setName(t) {
    elName.textContent = t || "";
  }

  // text choices, no panels: resolves with the chosen key
  function choose(options, { prompt = "", cls = "" } = {}) {
    return new Promise((resolve) => {
      elOver.hidden = false;
      elOver.className = "sc-overlay " + cls;
      elOver.innerHTML = (prompt ? `<p class="sc-prompt">${prompt}</p>` : "") + `<ul class="sc-choices">${options.map((o, i) => `<li><button type="button" data-k="${o.key}" ${o.disabled ? "disabled" : ""}>${o.label}${o.note ? `<span>${o.note}</span>` : ""}</button></li>`).join("")}</ul>`;
      const btns = [...elOver.querySelectorAll("button")];
      btns.find((b) => !b.disabled)?.focus({ preventScroll: true });
      elOver.onclick = (e) => {
        const b = e.target.closest("button");
        if (!b || b.disabled) return;
        audio.select();
        elOver.onclick = null;
        elOver.hidden = true;
        elOver.innerHTML = "";
        resolve(b.dataset.k);
      };
    });
  }
  const hideOverlay = () => ((elOver.hidden = true), (elOver.innerHTML = ""), (elOver.onclick = null));

  // ── helpers ───────────────────────────────────────────────────────────────────────────────
  function guard(tok) {
    if (destroyed || (tok != null && fight?.tok !== tok)) throw CANCEL;
  }
  function roundText(s) {
    const lim = s.boss.id === "woodcarver" && s.boss.phase === 2 ? s.cfg.moonRoundLimit : s.cfg.roundLimit;
    const w = s.wind.warn != null ? ` · wind ${WIND_NAMES[s.wind.warn]} ${ARROW[s.wind.warn]} next` : "";
    elRound.textContent = `round ${Math.min(s.round, lim)}/${lim}${w}`;
  }
  function windVisual(s) {
    stage.meadow.setWind({ warn: s.wind.warn });
    elWind.textContent = s.wind.warn != null ? `the wind is turning ${WIND_NAMES[s.wind.warn]}` : "";
    elWind.classList.toggle("on", s.wind.warn != null);
    audio.wind(s.wind.warn != null ? 0.4 : 0.1);
  }

  // ── title ─────────────────────────────────────────────────────────────────────────────────
  async function showTitle(note = "") {
    mode = "title";
    fight = null;
    stage.ui.mode = "title";
    stage.setBoss({ theme: "title", scenery: "meadow", figure: null });
    stage.clearVis();
    const s = newFight({ boss: "trapper", seed: 1 });
    for (let i = 0; i < 12; i++) s.cells[i] = null; // only your army stands in the clearing
    stage.syncVis(s);
    stage.setScale(0);
    stage.snapCandles(2);
    stage.meadow.setMist(0.8);
    stage.meadow.setDim(0.25);
    stage.meadow.setWind({});
    setName("");
    elWind.textContent = "";
    elRound.textContent = "";
    await say("");
    elOver.hidden = false;
    elOver.className = "sc-overlay sc-title";
    elOver.innerHTML = `<h2 class="sc-logo">strange chess</h2><p class="sc-sub">${note || "the same six pieces. broken physics. four bosses."}</p><ul class="sc-choices"><li><button type="button" data-k="begin">begin</button></li><li><button type="button" data-k="sound">sound: ${audio.enabled ? "on" : "off"}</button></li></ul>`;
    elOver.querySelector("button")?.focus({ preventScroll: true });
    const key = await new Promise((res) => {
      elOver.onclick = (e) => {
        const b = e.target.closest("button");
        if (b) res(b.dataset.k);
      };
    });
    if (key === "sound") {
      audio.set(!audio.enabled);
      return showTitle(note);
    }
    hideOverlay();
    startRun();
  }

  // ── run ───────────────────────────────────────────────────────────────────────────────────
  function startRun(startBoss = 0) {
    run = { seed: seed0, army: defaultArmy(), candles: 2, boss: startBoss, attempt: 0, tutorial: { wind: false, hole: false }, rng: makeRng(seed0 ^ 0x9e3779b9) };
    stage.snapCandles(2);
    beginFight();
  }

  async function beginFight() {
    const id = ORDER[run.boss];
    const B = BOSSES[id];
    mode = "fight";
    const s = newFight({ boss: id, army: run.army, seed: (run.seed + run.boss * 7919 + run.attempt * 104729) >>> 0 });
    const tok = (fight?.tok || 0) + 1;
    fight = { s, tok, busy: true, pushMode: false, armed: null, wait: null, B, first: run.boss === 0 && run.attempt === 0, rounds: 0 };
    stage.ui.mode = "fight";
    stage.ui.selected = -1;
    stage.ui.targets = [];
    stage.ui.preview = [];
    stage.ui.giveable = [];
    stage.ui.hookWarn = null;
    stage.ui.moonWarn = null;
    stage.setBoss({ ...B, mask: s.boss.mask });
    stage.meadow.setTheme(B.theme);
    stage.meadow.setScenery(B.scenery);
    stage.meadow.setMist(0.45);
    stage.meadow.setDim(0);
    stage.clearVis();
    stage.syncVis(s);
    stage.setScale(0);
    stage.setCandles(run.candles);
    stage.meadow.setWind({});
    setName(B.name);
    elWind.textContent = "";
    roundText(s);
    hideOverlay();
    elLive.textContent = `${B.name}. ${run.candles} candles left.`;
    try {
      await say(B.intro[run.attempt ? 1 : 0] || B.intro[0], { hold: 700 });
      guard(tok);
      await fightLoop(tok);
    } catch (e) {
      if (e !== CANCEL) throw e;
    }
  }

  async function fightLoop(tok) {
    for (;;) {
      guard(tok);
      let s = fight.s;
      if (s.over) return endFight(tok);
      if (s.pending?.type === "phase2") {
        await phaseTransition(tok);
        continue;
      }
      if (s.pending?.type === "trade") {
        await tradeFlow(tok);
        continue;
      }
      if (!legalMoves(s, s.turn).length) {
        fight.s = passStuck(s);
        await playEvents(fight.s.events, fight.s, tok);
        continue;
      }
      if (s.turn === 0) {
        fight.busy = false;
        const mv = await new Promise((res) => (fight.wait = res));
        fight.busy = true;
        guard(tok);
        await commit(mv, tok);
      } else {
        fight.busy = true;
        await bossMove(tok);
      }
    }
  }

  async function commit(mv, tok) {
    const s = fight.s;
    stage.ui.selected = -1;
    stage.ui.targets = [];
    stage.ui.preview = [];
    const s2 = applyMove(s, mv);
    await playEvents(s2.events, s2, tok);
    fight.s = s2;
    stage.syncVis(s2);
    stage.setScale(s2.scale);
    roundText(s2);
    windVisual(s2);
  }

  async function bossMove(tok) {
    const s = fight.s;
    const bossId = s.boss.id;
    const ideal = effective(s) === "moon" ? "woodcarver" : bossId;
    elRound.classList.add("think");
    const mv = await ai.think(s, { boss: ideal, depth: undefined, seed: (run.seed ^ (s.round * 2654435761)) >>> 0 });
    elRound.classList.remove("think");
    guard(tok);
    if (!mv) {
      fight.s = passStuck(s);
      return;
    }
    await commit(mv, tok);
    fight.rounds++;
    if (fight.rounds % 5 === 0 && Math.random() < 0.7) quip(pick(fight.B.idle));
  }

  // ── playing what happened ─────────────────────────────────────────────────────────────────
  async function playEvents(events, s, tok) {
    const B = fight?.B;
    const handled = new Set();
    for (let i = 0; i < events.length; i++) {
      guard(tok);
      const e = events[i];
      if (handled.has(i)) continue;
      switch (e.k) {
        case "move": {
          const v = stage.vis.get(e.id);
          if (!v) break;
          const pushes = [];
          for (let j = i + 1; j < events.length && events[j].k === "push"; j++) (pushes.push(events[j]), handled.add(j));
          v.moving = true;
          audio.move();
          if (e.tele) {
            // the glitch: dissolves here, reassembles there
            stage.dissolve({ ...v, id: "tmp" + Math.random() }, { burst: 0.7 });
            const to = e.to;
            await stage.tween(0.15, (k) => (v.a = 1 - k));
            v.gx = xOf(to);
            v.gy = yOf(to);
            await stage.tween(0.3, (k) => (v.a = k));
          } else {
            const pts = [e.from, ...(e.path?.length ? e.path : [e.to])].map((c) => [xOf(c), yOf(c)]);
            if (e.moon) pts.splice(0, pts.length, [xOf(e.from), yOf(e.from)], [xOf(e.to), yOf(e.to)]);
            const segs = pts.length - 1;
            const dur = Math.min(0.75, 0.22 + segs * 0.09);
            await stage.tween(dur, (k) => {
              const f = k * segs;
              const a = Math.min(segs - 1, Math.floor(f));
              const t = f - a;
              v.gx = pts[a][0] + (pts[a + 1][0] - pts[a][0]) * t;
              v.gy = pts[a][1] + (pts[a + 1][1] - pts[a][1]) * t;
              v.z = Math.sin(k * Math.PI) * (e.moon ? 2 : 7);
            });
            v.z = 0;
          }
          v.moving = false;
          if (pushes.length) {
            audio.capture();
            await Promise.all(
              pushes.map((p) => {
                const pv = stage.vis.get(p.id);
                if (!pv) return null;
                const fx0 = pv.gx,
                  fy0 = pv.gy;
                const tx = p.falls ? fx0 + p.d[0] : xOf(p.to),
                  ty = p.falls ? fy0 + p.d[1] : yOf(p.to);
                return stage.tween(0.32, (k) => {
                  pv.gx = fx0 + (tx - fx0) * k;
                  pv.gy = fy0 + (ty - fy0) * k;
                  if (p.falls) ((pv.sc = 1 - 0.3 * k), (pv.a = 1 - 0.6 * k));
                });
              }),
            );
          }
          break;
        }
        case "destroy": {
          const v = stage.vis.get(e.id);
          if (v) {
            const down = ["fall", "wind", "edge", "hook"].includes(e.why);
            audio[down ? "fall" : "capture"]();
            stage.dissolve(v, { down, burst: e.why === "moon" ? 1.6 : 1 });
            if (e.side === 1 && !e.bait && Math.random() < 0.25) quip(pick(B.capture));
          }
          if (e.t === "M" || e.why === "fall") await stage.wait(0.12);
          else await stage.wait(0.22);
          break;
        }
        case "erode":
          stage.setInteg(e.at, e.integ);
          break;
        case "hole":
          audio.fall();
          if (!run.tutorial.hole && fight.first) {
            run.tutorial.hole = true;
            tip("Holes are hungry.");
          }
          break;
        case "scale":
          stage.setScale(e.value);
          break;
        case "promote": {
          const v = stage.vis.get(e.id);
          if (v) ((v.t = "Q"), (v.cv = null));
          break;
        }
        case "windwarn": {
          stage.meadow.setWind({ warn: e.dir });
          elWind.textContent = `the wind is turning ${WIND_NAMES[e.dir]}`;
          elWind.classList.add("on");
          if (!run.tutorial.wind && fight.first) {
            run.tutorial.wind = true;
            tip("The wind is turning.");
          }
          break;
        }
        case "windblow": {
          const drifts = [];
          events.forEach((d, j) => {
            if (d.k === "drift" && j > i) (drifts.push(d), handled.add(j));
          });
          stage.meadow.setWind({ dir: e.dir, blowing: 1 });
          stage.setWindVec(WIND_DIRS[e.dir][0]);
          audio.wind(1);
          elWind.textContent = `the wind blows ${WIND_NAMES[e.dir]}`;
          await stage.wait(0.45);
          await Promise.all(
            drifts.map((d) => {
              const v = stage.vis.get(d.id);
              if (!v) return null;
              const fx0 = v.gx,
                fy0 = v.gy,
                tx = xOf(d.to),
                ty = yOf(d.to);
              return stage.tween(0.7, (k) => {
                v.gx = fx0 + (tx - fx0) * k;
                v.gy = fy0 + (ty - fy0) * k;
                v.z = Math.sin(k * Math.PI) * 4;
                if (d.falls) ((v.sc = 1 - 0.25 * k), (v.a = 1 - 0.5 * k));
              });
            }),
          );
          stage.meadow.setWind({ warn: s.wind.warn });
          stage.setWindVec(0);
          elWind.classList.remove("on");
          break;
        }
        case "trap": {
          audio.snap();
          const c = e.at,
            cx = stage.cellX(xOf(c)) + stage.layout.cs / 2,
            cy = stage.cellY(yOf(c)) + stage.layout.ch * 0.6;
          if (B.trap && Math.random() < 0.6) quip(pick(B.trap));
          await stage.addFx(0.9, (ctx, k) => {
            // an iron snap: [ = ] closes to ]=[
            const open = k < 0.35 ? ["[ = ]", "[  =  ]"][0] : k < 0.5 ? "[=]" : "]=[";
            ctx.globalAlpha = k > 0.8 ? (1 - k) * 5 : 1;
            stage.text(open, "iron", k < 0.5 ? 5 : 6, cx, cy);
            ctx.globalAlpha = 1;
            if (k > 0.45 && k < 0.7) stage.glow(stage.D(cx), stage.D(cy), stage.D(34), "rgba(255,255,255,0.9)", 0.5 * (1 - (k - 0.45) / 0.25));
          });
          break;
        }
        case "hookwarn":
          stage.ui.hookWarn = e.id;
          break;
        case "hook": {
          stage.ui.hookWarn = null;
          quip(pick(B.hook));
          const v = stage.vis.get(e.id);
          if (!v) break;
          const L = stage.layout;
          const rx = L.figX + 44 * L.s * 0.46,
            ry = L.figFeet - 64 * L.s * 0.95;
          const fx0 = v.gx,
            fy0 = v.gy,
            tx = xOf(e.to),
            ty = yOf(e.to);
          await stage.addFx(1.3, (ctx, k) => {
            const b = stage.baseOf(v.gx, v.gy);
            const topY = b.y - (v.cv?.height || 80) / stage.dpr;
            const reach = Math.min(1, k / 0.35);
            stage.drawLine(stage.D(rx), stage.D(ry), stage.D(rx + (b.x - rx) * reach), stage.D(ry + (topY - ry) * reach), 0.9);
            if (k > 0.35 && !e.slack) {
              const m = Math.min(1, (k - 0.35) / 0.5);
              v.gx = fx0 + (tx - fx0) * m;
              v.gy = fy0 + (ty - fy0) * m;
              v.z = Math.sin(m * Math.PI) * 6;
            }
          });
          v.z = 0;
          break;
        }
        case "gold": {
          const v = stage.vis.get(e.id);
          if (v) {
            quip(pick(B.pick));
            stage.dissolve({ ...v, pal: "gold", id: "tmp" + Math.random() });
            stage.vis.delete(e.id);
            await stage.wait(0.3);
          }
          break;
        }
        case "crack": {
          const v = stage.vis.get(e.id);
          if (v) stage.dissolve(v, { down: true });
          audio.fall();
          await stage.wait(0.15);
          break;
        }
        case "bait-drop": {
          const p = s.cells[e.at];
          if (p && !stage.vis.has(p.id)) stage.syncVis(s, { instant: false });
          const v = stage.vis.get(e.id);
          if (v) {
            v.a = 0;
            await stage.tween(0.6, (k) => (v.a = k));
          }
          break;
        }
        case "bait":
          quip("Oh dear.");
          break;
        case "skip":
          tip(e.side === 0 ? "you lose a turn" : "he loses a turn");
          break;
        case "mask": {
          stage.setMask(e.mask);
          if (e.switched) {
            quip(pick(B.mask));
            await stage.wait(0.5);
          }
          break;
        }
        case "kingtomoon": {
          const v = stage.vis.get(e.id);
          if (v) stage.dissolve(v, { burst: 1.4 });
          await stage.wait(0.4);
          break;
        }
        case "moonspawn":
          audio.phase();
          quip(B.moon);
          break;
        case "moonwarn":
          stage.ui.moonWarn = e.rows;
          break;
        case "moonstrike": {
          stage.ui.moonWarn = null;
          audio.capture();
          const L = stage.layout;
          const rows = e.rows;
          await stage.addFx(0.9, (ctx, k) => {
            for (const r of rows) {
              const y = stage.cellY(r) + L.ch * 0.55;
              const g = ctx.createLinearGradient(0, 0, stage.D(L.W), 0);
              const a = Math.sin(Math.min(1, k) * Math.PI);
              g.addColorStop(0, "rgba(255,255,255,0)");
              g.addColorStop(0.5, `rgba(240,244,255,${0.75 * a})`);
              g.addColorStop(1, "rgba(255,255,255,0)");
              ctx.fillStyle = g;
              ctx.fillRect(stage.D(L.bx - 30), stage.D(y - 8 * a), stage.D(L.cs * 6 + 60), stage.D(16 * a));
            }
          });
          break;
        }
        case "trade": {
          const g = stage.vis.get(e.give);
          if (g) stage.dissolve(g);
          await stage.wait(0.25);
          stage.syncVis(s, { instant: false });
          const nv = stage.vis.get(e.get);
          if (nv) {
            nv.a = 0;
            await stage.tween(0.5, (k) => (nv.a = k));
          }
          break;
        }
        case "phase2":
          break;
        default:
          break;
      }
    }
  }

  // ── phase 2 ───────────────────────────────────────────────────────────────────────────────
  async function phaseTransition(tok) {
    const B = fight.B;
    fight.busy = true;
    audio.phase();
    stage.meadow.setDim(0.8);
    stage.meadow.setMist(1.1);
    stage.ui.selected = -1;
    stage.ui.targets = [];
    await stage.wait(0.9);
    guard(tok);
    await say(B.phase2, { hold: 900 });
    guard(tok);
    stage.meadow.setTheme(B.id === "woodcarver" ? "moon" : B.theme === "trapper" ? "campfire" : B.theme === "angler" ? "moon" : "woodcarver");
    await stage.wait(0.6);
    if (B.phase2Name) setName(B.phase2Name === "The Moon" ? "The Woodcarver · The Moon" : B.phase2Name);
    const s2 = resolvePending(fight.s);
    await playEvents(s2.events, s2, tok);
    fight.s = s2;
    stage.syncVis(s2);
    if (B.id === "angler") quip(B.bait);
    roundText(s2);
    stage.meadow.setDim(0);
    stage.meadow.setMist(0.55);
    await stage.wait(0.5);
  }

  // The Trader: swap a piece on the board for one you lost, once. You may refuse.
  async function tradeFlow(tok) {
    const B = fight.B;
    fight.busy = true;
    await say(B.offer, { hold: 600 });
    guard(tok);
    const o = tradeOptions(fight.s);
    const opts = fight.s.gone.map((g, k) => ({ key: String(k), label: `${PIECE_NAME[g.t]} (${VALUE[g.t]})`, note: g.g?.length ? g.g.join(" ") : "" }));
    opts.push({ key: "no", label: "no, thank you" });
    const pickKey = await choose(opts, { prompt: "which of the lost comes back?" });
    guard(tok);
    if (pickKey === "no") {
      fight.s = declineTrade(fight.s);
      quip(B.declined);
      return;
    }
    // then click one of your own pieces to give
    stage.ui.giveable = o.give;
    elOver.hidden = false;
    elOver.className = "sc-overlay sc-aside";
    elOver.innerHTML = `<p class="sc-prompt">touch the piece you give. it counts for him on the scale.</p><ul class="sc-choices"><li><button type="button" data-k="no">keep what I have</button></li></ul>`;
    fight.giveWait = null;
    const give = await new Promise((res) => {
      fight.giveWait = res;
      elOver.onclick = (e) => e.target.closest("button") && res(-1);
    });
    fight.giveWait = null;
    stage.ui.giveable = [];
    hideOverlay();
    guard(tok);
    if (give < 0) {
      fight.s = declineTrade(fight.s);
      quip(B.declined);
      return;
    }
    const s2 = applyTrade(fight.s, give, Number(pickKey));
    await playEvents(s2.events, s2, tok);
    fight.s = s2;
    stage.syncVis(s2);
    stage.setScale(s2.scale);
    quip(B.traded);
  }

  // ── end of a fight ────────────────────────────────────────────────────────────────────────
  async function endFight(tok) {
    const s = fight.s;
    const B = fight.B;
    const won = s.over.winner === 0;
    fight.busy = true;
    stage.ui.selected = -1;
    stage.ui.targets = [];
    await stage.wait(0.8);
    guard(tok);
    if (won) {
      audio.win();
      await say(B.lose, { hold: 700 });
      guard(tok);
      if (run.boss >= ORDER.length - 1) return winScreen();
      run.boss++;
      run.attempt = 0;
      return campfire();
    }
    audio.lose();
    run.candles--;
    stage.setCandles(run.candles);
    await say(B.win, { hold: 600 });
    guard(tok);
    if (run.candles <= 0) {
      await stage.wait(1.2);
      return showTitle(RUN_END_LINE);
    }
    await say("A candle goes out. Again.", { hold: 400 });
    run.attempt++;
    return beginFight();
  }

  // ── campfire ──────────────────────────────────────────────────────────────────────────────
  async function campfire() {
    mode = "campfire";
    const tok = ++fight.tok;
    fight.busy = true;
    stage.ui.mode = "campfire";
    stage.setBoss({ theme: "campfire", scenery: "meadow", figure: null });
    stage.meadow.setTheme("campfire");
    stage.meadow.setScenery("meadow");
    stage.meadow.setMist(0.5);
    stage.meadow.setWind({});
    stage.clearVis();
    // your army stands in its home squares round the fire
    const s = newFight({ boss: "trapper", army: run.army, seed: 5 });
    for (let i = 0; i < 12; i++) s.cells[i] = null;
    for (let i = 0; i < 36; i++) s.integ[i] = 4;
    s.traps = [];
    stage.syncVis(s);
    stage.setScale(0);
    setName("");
    elWind.textContent = "";
    elRound.textContent = "campfire";
    let given = false;
    for (;;) {
      guard(tok);
      await say(given ? "The fire keeps what it is given." : "Choose a piece. Give it something to carry.", { hold: 300 });
      const bodiesNow = bodies(s, 0);
      const cell = await pickPiece(bodiesNow.map((b) => b.i), tok);
      guard(tok);
      if (cell === "walk") break;
      const p = run.army.find((a) => ix(a.x, a.y) === cell);
      if (!p) continue;
      const have = p.g || (p.g = []);
      if (have.length >= 2) {
        await say("It cannot carry more.", { hold: 400 });
        continue;
      }
      const risky = have.length === 1;
      const choices = SIGILS.filter((g) => !have.includes(g)).map((g) => ({ key: g, label: SIGIL_TEXT[g].name, note: SIGIL_TEXT[g].text }));
      choices.push({ key: "back", label: "not this one" });
      const k = await choose(choices, { prompt: risky ? `the ${PIECE_NAME[p.t]} already carries a sigil.<br>a second one: <b>1 in 2 the piece burns</b> and is gone for the run.` : `a sigil for the ${PIECE_NAME[p.t]}. it lasts the whole run.` });
      guard(tok);
      if (k === "back") continue;
      if (risky) {
        const sure = await choose([{ key: "yes", label: "light it" }, { key: "no", label: "I'll keep it as it is" }], { prompt: "it may burn. are you sure?" });
        guard(tok);
        if (sure === "no") continue;
        if (run.rng() < 0.5) {
          const v = stage.vis.get(p.id);
          if (v) stage.dissolve(v, { burst: 1.5 });
          run.army = run.army.filter((a) => a !== p);
          s.cells[cell] = null;
          audio.capture();
          await say("It burns. The fire is not sorry.", { hold: 500 });
          given = true;
          continue;
        }
      }
      have.push(k);
      s.cells[cell] = { ...s.cells[cell], g: have.slice() };
      stage.syncVis(s);
      audio.select();
      given = true;
      await say(`The ${PIECE_NAME[p.t]} will carry it.`, { hold: 500 });
      const more = await choose([{ key: "on", label: "walk on" }, { key: "more", label: "another piece" }]);
      guard(tok);
      if (more === "on") break;
    }
    stage.ui.campfireLit = false;
    await say("", {});
    return beginFight();
  }
  // click one of your pieces at the fire (or take the "walk on" text)
  function pickPiece(cells, tok) {
    return new Promise((res) => {
      fight.pickWait = (c) => res(c);
      fight.pickCells = cells;
      elOver.hidden = false;
      elOver.className = "sc-overlay sc-aside";
      elOver.innerHTML = `<ul class="sc-choices"><li><button type="button" data-k="walk">walk on</button></li></ul>`;
      elOver.onclick = (e) => {
        if (e.target.closest("button")) {
          audio.select();
          hideOverlay();
          fight.pickWait = null;
          res("walk");
        }
      };
      void tok;
    }).then((c) => {
      hideOverlay();
      return c;
    });
  }

  // ── the end ───────────────────────────────────────────────────────────────────────────────
  async function winScreen() {
    mode = "win";
    fight.busy = true;
    audio.win();
    stage.meadow.setWind({});
    stage.meadow.setMist(0.2);
    setName("");
    elRound.textContent = "";
    elWind.textContent = "";
    await say("The meadow lets go.", { hold: 900 });
    const dur = reduce ? 1.5 : 9;
    await stage.tween(
      dur,
      (k) => stage.setWin(k),
      (t) => t,
    );
    elOver.hidden = false;
    elOver.className = "sc-overlay sc-end";
    elOver.innerHTML = `<p class="sc-prompt">You carved the moon out of the sky.<br>Whoever made this would like to meet you.</p><ul class="sc-choices"><li><a href="${CONTACT_URL}">contact</a></li><li><a href="${REEL_URL}">reel</a></li><li><button type="button" data-k="again">once more</button></li></ul>`;
    elOver.onclick = (e) => {
      if (e.target.closest("button")) {
        stage.setWin(0);
        hideOverlay();
        showTitle();
      }
    };
  }

  // ── input ─────────────────────────────────────────────────────────────────────────────────
  function localXY(e) {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  function displayedTargets(s, from) {
    const ms = movesFrom(s, from);
    const byTo = new Map();
    for (const m of ms) (byTo.get(m.to) || byTo.set(m.to, []).get(m.to)).push(m);
    const out = [];
    for (const [to, arr] of byTo) {
      const cap = arr.find((m) => m.kind === "capture"),
        push = arr.find((m) => m.kind === "push"),
        mv = arr.find((m) => m.kind === "move");
      let m = mv || cap || push;
      if (cap && push) m = fight.pushMode ? push : cap;
      out.push({ to, kind: m.kind, move: m });
    }
    return out;
  }
  function handleCell(cell, e) {
    const s = fight.s;
    if (cell < 0) return deselect();
    // trade: touch a piece to give
    if (fight.giveWait) {
      if (stage.ui.giveable.includes(cell)) fight.giveWait(cell);
      return;
    }
    if (mode === "campfire") {
      if (fight.pickWait && fight.pickCells?.includes(cell)) {
        fight.pickWait(cell);
      }
      return;
    }
    if (fight.busy || s.turn !== 0 || !fight.wait) return;
    const sel = stage.ui.selected;
    if (sel >= 0) {
      const t = stage.ui.targets.find((x) => x.to === cell);
      if (t) {
        // touch: a push shows its preview first, a second tap commits
        if (e?.pointerType === "touch" && t.kind === "push" && fight.armed !== cell) {
          fight.armed = cell;
          stage.ui.preview = previewPush(s, t.move);
          return;
        }
        fight.armed = null;
        const w = fight.wait;
        fight.wait = null;
        return w(t.move);
      }
    }
    const p = s.cells[cell];
    if (p && p.s === 0 && p.t !== "G") {
      const targets = displayedTargets(s, p.t === "M" ? ix(p.x, p.y) : cell);
      if (targets.length) {
        stage.ui.selected = cell;
        stage.ui.targets = targets;
        stage.ui.preview = [];
        fight.armed = null;
        audio.select();
        return;
      }
    }
    deselect();
  }
  function deselect() {
    stage.ui.selected = -1;
    stage.ui.targets = [];
    stage.ui.preview = [];
    if (fight) fight.armed = null;
  }
  on(canvas, "pointerdown", (e) => {
    if (paused || !fight) return;
    if (audio.enabled) audio.set(true);
    const [x, y] = localXY(e);
    let cell = stage.pieceCellAt(x, y);
    const g = stage.cellAt(x, y);
    // a valid target square under the pointer wins over a piece drawn above it
    if (stage.ui.targets.some((t) => t.to === g)) cell = g;
    else if (cell < 0) cell = g;
    handleCell(cell, e);
  });
  on(canvas, "pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const [x, y] = localXY(e);
    const g = stage.cellAt(x, y);
    stage.ui.hover = g;
    if (fight && stage.ui.selected >= 0) {
      const t = stage.ui.targets.find((q2) => q2.to === g);
      stage.ui.preview = t && t.kind === "push" ? previewPush(fight.s, t.move) : [];
    }
    canvas.classList.toggle("sc-pointer", !!fight && (stage.ui.targets.some((t) => t.to === g) || (fight.s?.cells[g]?.s === 0 && mode === "fight")));
  });
  on(canvas, "pointerleave", () => ((stage.ui.hover = -1), (stage.ui.preview = [])));

  function togglePush() {
    if (!fight) return;
    fight.pushMode = !fight.pushMode;
    if (stage.ui.selected >= 0) {
      const p = fight.s.cells[stage.ui.selected];
      stage.ui.targets = displayedTargets(fight.s, p.t === "M" ? ix(p.x, p.y) : stage.ui.selected);
    }
    tip(fight.pushMode ? "push mode: pieces with the pusher sigil shove instead of taking" : "capture mode");
  }
  function restartFight() {
    if (!run || mode !== "fight") return;
    fight.tok++;
    hideOverlay();
    beginFight();
  }
  function openPause() {
    if (paused) return;
    paused = true;
    elOver.hidden = false;
    elOver.className = "sc-overlay sc-pause";
    const render = () => {
      elOver.innerHTML = `<h2 class="sc-logo small">paused</h2><ul class="sc-choices"><li><button type="button" data-k="resume">resume</button></li><li><button type="button" data-k="fight">restart this fight</button></li><li><button type="button" data-k="run">restart the run</button></li><li><button type="button" data-k="sound">sound: ${audio.enabled ? "on" : "off"}</button></li><li><a href="/archive/">leave</a></li></ul>`;
      elOver.querySelector("button")?.focus({ preventScroll: true });
    };
    render();
    elOver.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const k = b.dataset.k;
      if (k === "sound") {
        audio.set(!audio.enabled);
        return render();
      }
      closePause();
      if (k === "fight") restartFight();
      if (k === "run") {
        if (fight) fight.tok++;
        hideOverlay();
        showTitle();
      }
    };
  }
  function closePause() {
    paused = false;
    // restore whatever the overlay held (choices are re-asked by their flows when needed)
    if (elOver.classList.contains("sc-pause")) hideOverlay();
  }
  on(window, "keydown", (e) => {
    if (e.target.closest?.("input,textarea")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      paused ? closePause() : openPause();
    } else if (paused) return;
    else if (e.key === "r" || e.key === "R") restartFight();
    else if (e.key === "m" || e.key === "M") (audio.set(!audio.enabled), tip(audio.enabled ? "sound on" : "sound off"));
    else if (e.key === "p" || e.key === "P") togglePush();
  });
  on(q(".sc-menu-btn"), "click", () => (paused ? closePause() : openPause()));

  // ── frame loop ────────────────────────────────────────────────────────────────────────────
  let raf = 0,
    last = performance.now(),
    slow = 0,
    fastFrames = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (document.hidden) return;
    stage.draw(now, dt);
    // a little governor: if the machine struggles, draw fewer pixels
    if (dt > 0.034) slow++;
    else slow = Math.max(0, slow - 0.2);
    if (slow > 50 && dprCap > 1) {
      slow = 0;
      dprCap = Math.max(1, dprCap - 0.25);
      fit();
    }
    void fastFrames;
  }

  // ── go ────────────────────────────────────────────────────────────────────────────────────
  (async () => {
    try {
      await document.fonts?.load('8px "Geist Mono"');
    } catch {}
    if (destroyed) return;
    fit();
    root.classList.add("ready");
    raf = requestAnimationFrame(frame);
    if (params.has("boss")) {
      mode = "fight";
      startRun(Math.max(0, Math.min(3, Number(params.get("boss")) | 0)));
    } else showTitle();
    if (debug) window.__sc = { get run() { return run; }, get fight() { return fight; }, stage, get mode() { return mode; }, commit: (m) => fight.wait?.(m), legalMoves: () => legalMoves(fight.s), say, startRun, R, setState: (st) => (fight.s = st, stage.syncVis(st), stage.setScale(st.scale), roundText(st)) };
    elLive.textContent = "Strange Chess. Use the pointer or touch to select a piece and then a square.";
  })();

  return () => {
    destroyed = true;
    cancelAnimationFrame(raf);
    clearTimeout(rzT);
    clearTimeout(tipTimer);
    offs.forEach((f) => f());
    ai.close();
    audio.set(false);
    html.classList.remove("chess-page");
    if (debug) delete window.__sc;
  };
}
