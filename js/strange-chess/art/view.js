// The board in the meadow: pieces, holes, hints, the boss, the scale, the candles, and the
// animation of whatever the rules engine reports in state.events. The view never decides
// anything: it shows a state and plays the events that led to it, then snaps to that state.
import { createMeadow } from "./meadow.js";
import { pieceBaker } from "./pieces.js";
import { bakeFigure } from "./figures.js";
import { FONT, PAL, rgb, mix, drawGlyph, bloomSprite } from "./glyphs.js";
import { rng, clamp, lerp, noise2 } from "../rng.js";
import { pushChain, grid, byId, moonTargets } from "../rules.js";

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const INTEG_GLYPH = [" ", ".", "o", "0", "@"];
const WIND_LEAN = { E: [1, 0], W: [-1, 0], N: [0, 1], S: [0, -1] };
const WIND_NAME = { E: "east", W: "west", N: "toward him", S: "toward you" };
const WIND_ARROW = { E: "→", W: "←", N: "↑", S: "↓" };

export function createView(canvas, { reduce = false, low = false, seed = 7 } = {}) {
  const ctx = canvas.getContext("2d");
  const meadow = createMeadow({ seed, reduce, low });
  const V = {
    meadow,
    hover: null, // { x, y } square under the pointer
    pointer: null, // { x, y } screen
    sel: null, // selected piece id
    targets: [], // legal moves of the selected piece
    pushHover: null, // the push move under the pointer (for its preview)
    scale: 0,
    phaseMoon: false,
    candles: 2,
    maxCandles: 2,
    round: 1,
    maxRounds: 40,
    status: "",
    windWarn: null,
    showBoard: 0, // 0..1 how clearly the grid shows (hover / selection)
    boss: null, // { kind, name }
    figureAlpha: 1,
    hidden: false, // the board is hidden (title, campfire, win)
    sayText: "",
    sayStart: 0,
    camera: 0, // 0..1 drift up into the stars (win screen)
  };
  let L = null,
    dpr = 1,
    bake = null,
    figure = null,
    holeLayer = null,
    holeKey = "",
    now = 0;
  const disp = new Map();
  let integ = new Array(36).fill(4);
  let timeline = [];
  let particles = [];
  let fx = [];
  let state = null;
  let shadowSprite = null;

  // ── layout ──
  V.resize = function (w, h, d) {
    dpr = d;
    canvas.width = Math.round(w * d);
    canvas.height = Math.round(h * d);
    L = meadow.resize(w, h, d);
    meadow.integrity = (x, y) => integ[y * 6 + x];
    bake = pieceBaker(L, d);
    holeKey = "";
    shadowSprite = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const x = c.getContext("2d");
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "rgba(0,0,4,0.85)");
      g.addColorStop(0.6, "rgba(0,0,4,0.45)");
      g.addColorStop(1, "rgba(0,0,4,0)");
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      return c;
    })();
    if (V.boss) figure = bakeFigure(V.boss.kind, L.portrait ? 1.5 : 2);
    return L;
  };
  V.layout = () => L;
  V.setBoss = function (boss) {
    V.boss = boss;
    figure = boss ? bakeFigure(boss.kind, L && L.portrait ? 1.5 : 2) : null;
  };

  // screen anchor (bottom centre) of a piece standing on grid position (x, y)
  const anchor = (x, y, t) => (t === "M" ? [L.left + (x + 1) * L.sqW, L.top + (5 - y + 0.5) * L.sqH + L.sqH * 0.3] : [L.left + (x + 0.5) * L.sqW, L.top + (5 - y + 0.5) * L.sqH + L.sqH * 0.28]);
  V.anchor = anchor;
  const lookOf = (d) => (d.t === "G" ? "gold" : d.side === "p" ? "player" : "boss");

  // ── state and its events ──
  function mkDisp(p) {
    return { id: p.id, t: p.t, side: p.side, bait: !!p.bait, x: p.x, y: p.y, tw: null, alpha: 1, v: (p.id * 7) % 3, swap: Math.random() * 2, glow: 0 };
  }
  // Show a state at once (no animation).
  V.set = function (s) {
    state = s;
    disp.clear();
    for (const p of s.pieces) disp.set(p.id, mkDisp(p));
    integ = s.integ.slice();
    timeline = [];
    fx = [];
    syncUI(s);
  };
  function syncUI(s) {
    V.scale = s.scale;
    V.round = s.round;
    V.phaseMoon = !!s.moon;
  }
  function sync(s) {
    for (const p of s.pieces) {
      const d = disp.get(p.id);
      if (!d) disp.set(p.id, mkDisp(p));
      else Object.assign(d, { t: p.t, side: p.side, bait: !!p.bait, x: p.x, y: p.y, tw: null, alpha: 1 });
    }
    for (const id of [...disp.keys()]) if (!s.pieces.some((p) => p.id === id)) disp.delete(id);
    integ = s.integ.slice();
    syncUI(s);
  }
  const at = (t, fn) => timeline.push({ t, fn });
  function tween(d, from, to, t0, dur, mode = "slide") {
    d.tw = { from, to, t0, dur, mode };
  }
  // Play the events that produced state s, then rest on s. Returns the time it takes.
  V.play = function (s) {
    state = s;
    const ev = s.events || [];
    const T = reduce ? 0.55 : 1;
    let cursor = now;
    let moveEnd = now;
    let roundPhase = false;
    const endOf = new Map(); // id → time its movement ends
    const enterRound = () => {
      if (!roundPhase) {
        roundPhase = true;
        cursor = Math.max(cursor, moveEnd + 0.25 * T);
      }
    };
    for (const e of ev) {
      const d = e.id != null ? disp.get(e.id) : null;
      let when = cursor;
      switch (e.type) {
        case "move": {
          const dur = (e.mirror ? 0.6 : 0.34) * T;
          if (d) at(cursor, (t0) => tween(d, e.from, e.to, t0, dur, e.mirror ? "mirror" : "slide"));
          moveEnd = Math.max(moveEnd, cursor + dur);
          endOf.set(e.id, cursor + dur);
          if (e.mirror) at(cursor, () => glitchBurst(e.from.x, e.from.y));
          break;
        }
        case "pushed": {
          const t0 = cursor + 0.2 * T,
            dur = 0.28 * T;
          if (d) at(t0, (t0) => tween(d, e.from, e.to, t0, dur, "hop"));
          endOf.set(e.id, t0 + dur);
          moveEnd = Math.max(moveEnd, t0 + dur);
          break;
        }
        case "drift": {
          const dur = 0.55 * T;
          if (d) at(cursor, (t0) => tween(d, e.from, e.to, t0, dur, "slide"));
          endOf.set(e.id, cursor + dur);
          break;
        }
        case "destroy": {
          const tEnd = Math.max(endOf.get(e.id) || 0, e.cause === "capture" ? moveEnd - 0.06 : roundPhase ? cursor : moveEnd);
          at(tEnd, () => dissolve(e.id, e.cause));
          when = tEnd;
          break;
        }
        case "erode":
          at(roundPhase ? cursor + 0.3 : moveEnd, () => {
            integ[e.y * 6 + e.x] = e.integ;
            if (e.integ === 0) crumble(e.x, e.y);
          });
          break;
        case "trap":
          at(Math.max(endOf.get(e.id) || moveEnd, cursor), () => addFx({ kind: "trap", x: e.x, y: e.y, life: 2.2 }));
          break;
        case "promote":
          at(endOf.get(e.id) || moveEnd, () => {
            if (d) d.t = "Q";
            if (d) sparkleAt(d.x, d.y, 18);
          });
          break;
        case "windWarn":
          enterRound();
          at(cursor, () => {
            V.windWarn = e.dir;
            const [x, y] = WIND_LEAN[e.dir];
            meadow.windTarget = { x: x * 0.55, y: y * 0.5 };
          });
          break;
        case "gust":
          enterRound();
          at(cursor, () => {
            const [x, y] = WIND_LEAN[e.dir];
            meadow.windTarget = { x: x * 0.9, y: y * 0.8 };
            meadow.gust = 1;
            V.windWarn = null;
          });
          at(cursor + 1.6 * T, () => (meadow.windTarget = { x: meadow.windTarget.x * 0.2, y: meadow.windTarget.y * 0.2 }));
          cursor += 0.15 * T;
          // drifts follow at this cursor (no advance per drift)
          break;
        case "hook":
          enterRound();
          at(cursor, () => addFx({ kind: "line", id: e.id, life: 1.6 * T }));
          if (d && !e.held) {
            at(cursor + 0.6 * T, (t0) => tween(d, e.from, e.to, t0, 0.5 * T, "slide"));
            endOf.set(e.id, cursor + 1.1 * T);
          }
          cursor += 1.2 * T;
          break;
        case "gold":
          enterRound();
          at(cursor, () => addFx({ kind: "pick", x: e.x, y: e.y, life: 0.9 }));
          at(cursor + 0.35 * T, () => {
            if (d) {
              d.t = "G";
              d.side = null;
            }
            sparkleAt(e.x, e.y, 14, "#d9b84a");
          });
          cursor += 0.8 * T;
          break;
        case "crack":
          enterRound();
          for (const c of e.cells)
            at(cursor, () => {
              const g = [...disp.values()].find((q) => q.t === "G" && q.x === c.x && q.y === c.y);
              if (g) dissolve(g.id, "crack");
              integ[c.y * 6 + c.x] = 0;
              crumble(c.x, c.y);
            });
          cursor += 0.8 * T;
          break;
        case "bait":
          enterRound();
          at(cursor, () => {
            const p = byId(s, e.id) || { id: e.id, t: "P", side: "b", bait: true, x: e.x, y: e.y };
            const nd = mkDisp(p);
            nd.alpha = 0;
            nd.tw = { from: { x: e.x, y: e.y + 0.6 }, to: { x: e.x, y: e.y }, t0: now, dur: 0.7 * T, mode: "drop" };
            disp.set(e.id, nd);
          });
          cursor += 0.6 * T;
          break;
        case "moonRises":
          enterRound();
          at(cursor, () => {
            for (const id of e.absorbed) dissolve(id, "moon");
            for (const q of [...disp.values()]) if (q.t === "K" && q.side === "b") dissolve(q.id, "moon");
            const nd = mkDisp({ id: e.id, t: "M", side: "b", x: e.x, y: e.y });
            nd.tw = { from: { x: e.x, y: e.y - 0.4 }, to: { x: e.x, y: e.y }, t0: now, dur: 1.4 * T, mode: "rise" };
            disp.set(e.id, nd);
          });
          cursor += 1.5 * T;
          break;
        case "moonWarn":
          enterRound();
          cursor += 0.2 * T;
          break;
        case "moonAttack":
          enterRound();
          at(cursor, () => addFx({ kind: "beam", rows: e.rows, life: 1.1 }));
          cursor += 0.45 * T;
          break;
        case "moonFalls":
          at(Math.max(endOf.get(e.id) || moveEnd, cursor), () => dissolve(e.id, "fall"));
          break;
        case "trade":
          at(cursor, () => dissolve(e.gave, "trade"));
          at(cursor + 0.5 * T, () => {
            const nd = mkDisp({ id: e.got, t: e.t, side: "p", x: e.x, y: e.y });
            nd.alpha = 0;
            nd.tw = { from: { x: e.x, y: e.y }, to: { x: e.x, y: e.y }, t0: now, dur: 0.6, mode: "fadein" };
            disp.set(e.got, nd);
          });
          cursor += 1.1 * T;
          break;
        case "phase":
          // the boss speaks before the new rule takes effect
          enterRound();
          when = cursor;
          cursor += 3 * T;
          break;
        case "traps":
        case "mask":
        case "pass":
        case "hooked":
        case "tradeRefused":
        default:
          break;
      }
      if (V.onEvent) at(when, () => V.onEvent(e, s));
    }
    const end = Math.max(cursor, moveEnd) + 0.12;
    at(end, () => sync(s));
    return end - now;
  };
  // debugging: pieces whose shown position differs from the state's (should be none at rest)
  V.mismatches = () => (state ? state.pieces.filter((p) => !disp.has(p.id) || disp.get(p.id).x !== p.x || disp.get(p.id).y !== p.y).length + Math.max(0, disp.size - state.pieces.length) : 0);
  V.particleCount = () => particles.length;
  V.busy = () => timeline.length > 0 || [...disp.values()].some((d) => d.tw);

  // ── effects ──
  function addFx(f) {
    f.t0 = now;
    fx.push(f);
  }
  const R = rng(seed + 5);
  function dissolve(id, cause) {
    const d = disp.get(id);
    if (!d) return;
    disp.delete(id);
    // where it ends up (a slide still under way counts as arrived)
    const gp = d.tw ? [d.tw.to.x, d.tw.to.y] : [d.x, d.y];
    d.x = gp[0];
    d.y = gp[1];
    const [sx, sy] = anchor(gp[0], gp[1], d.t);
    if (reduce) {
      fx.push({ kind: "fade", d: { ...d, tw: null }, t0: now, life: 0.5 });
      return;
    }
    const sp = bake(d.t, lookOf(d));
    const cells = sp.cells;
    const step = Math.max(1, Math.floor(cells.length / 160));
    const fallDown = cause === "fall";
    for (let i = 0; i < cells.length; i += step) {
      const c = cells[i];
      const a = R() * Math.PI * 2;
      const sp2 = 20 + R() * 70;
      particles.push({
        x: sx + c.x,
        y: sy + c.y,
        vx: Math.cos(a) * sp2 * 0.7 + (fallDown ? 0 : (c.x / 30) * 20),
        vy: fallDown ? 30 + R() * 50 : Math.sin(a) * sp2 * 0.5 - 30 - R() * 40,
        ch: c.ch,
        col: c.b > 0.7 ? "#e8eaff" : c.b > 0.4 ? rgb(PAL.lav) : rgb(PAL.shadow),
        a: c.a,
        life: 0.9 + R() * 0.9,
        age: -R() * 0.25,
        end: R() < 0.55 ? "blade" : "spark",
        ground: sy + (R() - 0.5) * L.sqH * 0.8,
      });
    }
  }
  function sparkleAt(x, y, n, col = "#cfe0ff") {
    if (reduce) return;
    const [sx, sy] = anchor(x, y);
    for (let i = 0; i < n; i++)
      particles.push({ x: sx + (R() - 0.5) * L.sqW * 0.6, y: sy - R() * L.sqH, vx: (R() - 0.5) * 30, vy: -20 - R() * 40, ch: R() < 0.5 ? "*" : ".", col, a: 1, life: 0.7 + R() * 0.6, age: 0, end: "none", ground: sy });
  }
  function glitchBurst(x, y) {
    if (reduce) return;
    const [sx, sy] = anchor(x, y);
    for (let i = 0; i < 26; i++)
      particles.push({ x: sx + (R() - 0.5) * L.sqW * 0.5, y: sy - R() * L.sqH * 1.1, vx: (R() - 0.5) * 120, vy: (R() - 0.5) * 20, ch: "#%@&$/\\|"[(R() * 9) | 0], col: R() < 0.5 ? "#c3c8ec" : "#8f97c9", a: 1, life: 0.35 + R() * 0.3, age: 0, end: "none", ground: sy });
  }
  function crumble(x, y) {
    holeKey = "";
    if (reduce) return;
    const [sx, sy] = anchor(x, y);
    for (let i = 0; i < 30; i++)
      particles.push({ x: sx + (R() - 0.5) * L.sqW * 0.8, y: sy - L.sqH * 0.3 + (R() - 0.5) * L.sqH * 0.7, vx: (R() - 0.5) * 16, vy: 10 + R() * 30, ch: ".,:;'`o"[(R() * 7) | 0], col: "#6b6380", a: 0.8, life: 0.8 + R() * 0.6, age: 0, end: "none", ground: sy + 20 });
  }

  // ── positions ──
  function pos(d) {
    const tw = d.tw;
    if (!tw) return [d.x, d.y];
    const k = clamp((now - tw.t0) / tw.dur, 0, 1);
    if (k >= 1) {
      d.tw = null;
      d.alpha = 1;
      return [tw.to.x, tw.to.y];
    }
    if (tw.mode === "mirror") {
      d.alpha = Math.abs(1 - 2 * k);
      return k < 0.5 ? [tw.from.x, tw.from.y] : [tw.to.x, tw.to.y];
    }
    if (tw.mode === "fadein" || tw.mode === "drop" || tw.mode === "rise") d.alpha = easeOut(k);
    const e = tw.mode === "hop" ? easeOut(k) : ease(k);
    return [lerp(tw.from.x, tw.to.x, e), lerp(tw.from.y, tw.to.y, e)];
  }

  // ── the hole layer: voids with crumbling edges, and the dirt of worn squares ──
  function buildHoles() {
    const key = integ.join("");
    if (key === holeKey && holeLayer) return;
    holeKey = key;
    if (!holeLayer) holeLayer = document.createElement("canvas");
    holeLayer.width = Math.ceil(L.W * dpr);
    holeLayer.height = Math.ceil(L.H * dpr);
    const x = holeLayer.getContext("2d");
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = rng(seed + 300);
    for (let sy = 0; sy < 6; sy++)
      for (let sx = 0; sx < 6; sx++) {
        const v = integ[sy * 6 + sx];
        const cx = L.left + (sx + 0.5) * L.sqW,
          cy = L.top + (5 - sy + 0.5) * L.sqH;
        if (v === 0) {
          // the void: overlapping ragged blobs, darkest in the middle, the edge crumbling
          x.save();
          for (let k = 0; k < 3; k++) {
            const ox = (r() - 0.5) * L.sqW * 0.18,
              oy = (r() - 0.5) * L.sqH * 0.16,
              sc = 0.82 + r() * 0.2;
            x.beginPath();
            const n = 28;
            for (let i = 0; i <= n; i++) {
              const a = (i / n) * Math.PI * 2;
              const rr = sc * (0.8 + 0.34 * noise2(Math.cos(a) * 2.3 + sx * 3 + k, Math.sin(a) * 2.3 + sy * 3, seed + k));
              const px = cx + ox + Math.cos(a) * L.sqW * 0.5 * rr,
                py = cy + oy + Math.sin(a) * L.sqH * 0.5 * rr;
              i ? x.lineTo(px, py) : x.moveTo(px, py);
            }
            x.closePath();
            x.filter = "blur(1.5px)";
            const g = x.createRadialGradient(cx, cy, 0, cx, cy, L.sqW * 0.56);
            g.addColorStop(0, "rgba(0,0,1,1)");
            g.addColorStop(0.6, "rgba(1,1,4,0.97)");
            g.addColorStop(1, "rgba(4,5,12,0.75)");
            x.fillStyle = g;
            x.fill();
          }
          x.filter = "none";
          x.restore();
          // debris on and around the rim: crumbs, and a few heavier chunks of earth
          x.textAlign = "center";
          x.textBaseline = "middle";
          for (let i = 0; i < 70; i++) {
            const a = r() * Math.PI * 2,
              rr = 0.62 + Math.pow(r(), 0.7) * 0.6;
            const chunk = r() < 0.18;
            x.font = `${chunk ? 9 : 7}px ${FONT}`;
            x.globalAlpha = (chunk ? 0.55 : 0.35) + r() * 0.4;
            x.fillStyle = chunk ? "#8a8399" : r() < 0.5 ? "#6b6380" : "#9a93ab";
            x.fillText(chunk ? "#%&@"[(r() * 4) | 0] : ".,:;'`o-"[(r() * 8) | 0], cx + Math.cos(a) * L.sqW * 0.5 * rr, cy + Math.sin(a) * L.sqH * 0.5 * rr);
          }
          x.globalAlpha = 1;
        } else if (v < 4) {
          // worn ground: dirt in the glyph of its integrity (0, o, .)
          x.font = `${7 + v}px ${FONT}`;
          x.textAlign = "center";
          x.textBaseline = "middle";
          const count = (4 - v) * 9;
          for (let i = 0; i < count; i++) {
            x.globalAlpha = 0.4 + r() * 0.4;
            x.fillStyle = r() < 0.5 ? "#8a8099" : "#6f6684";
            x.fillText(INTEG_GLYPH[v], cx + (r() - 0.5) * L.sqW * 0.8, cy + (r() - 0.5) * L.sqH * 0.75);
          }
          x.globalAlpha = 1;
        }
      }
  }

  // ── drawing ──
  const prof = { on: false, acc: {}, n: 0 };
  V.profile = () => {
    prof.on = true;
    const out = {};
    for (const k in prof.acc) out[k] = +(prof.acc[k] / Math.max(1, prof.n)).toFixed(2);
    prof.acc = {};
    prof.n = 0;
    return out;
  };
  let pt = 0;
  const mark = (k) => {
    if (!prof.on) return;
    const n = performance.now();
    if (k) prof.acc[k] = (prof.acc[k] || 0) + (n - pt);
    pt = n;
  };
  V.frame = function (t, dt) {
    now = t;
    mark();
    if (prof.on) prof.n++;
    // timeline
    if (timeline.length) {
      timeline.sort((a, b) => a.t - b.t);
      while (timeline.length && timeline[0].t <= now) {
        const item = timeline.shift();
        item.fn(item.t);
      }
    }
    meadow.update(dt);
    const showTarget = V.sel != null || V.hover ? 1 : 0;
    V.showBoard += (showTarget - V.showBoard) * Math.min(1, dt * 6);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    if (V.camera > 0) {
      drawSky(t);
      ctx.translate(0, ease(V.camera) * L.H * 0.95);
    }
    meadow.drawGround(ctx);
    mark("ground");
    meadow.drawGrass(ctx, t);
    mark("grass");
    if (!V.hidden) {
      buildHoles();
      ctx.drawImage(holeLayer, 0, 0, L.W, L.H);
      drawHints(t);
    }
    // depth-sorted sprites
    const list = meadow.sceneryDrawables();
    if (!V.hidden) {
      for (const d of disp.values()) {
        const [gx, gy] = pos(d);
        const [sx, sy] = anchor(gx, gy, d.t);
        let lift = 0;
        if (d.tw && d.tw.mode === "hop") lift = Math.sin(clamp((now - d.tw.t0) / d.tw.dur, 0, 1) * Math.PI) * L.sqH * 0.12;
        list.push({ y: sy, draw: () => drawPiece(d, sx, sy - lift, t, dt) });
      }
      for (const f of fx) if (f.kind === "fade") list.push({ y: anchor(f.d.x, f.d.y, f.d.t)[1], draw: () => drawFade(f) });
      // the push preview: ghosts where each pushed piece will end up
      if (V.pushHover && state) drawPushPreview(list);
    }
    if (figure && V.figureAlpha > 0.01) {
      const fxp = L.left + L.bw / 2,
        fyp = L.top - L.sqH * 0.42;
      list.push({ y: fyp, draw: () => drawFigure(fxp, fyp) });
    }
    mark("hints");
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.draw(ctx);
    mark("sprites");
    if (!V.hidden) drawOverlays(t);
    if (V.campfire) drawCampfire(t);
    drawParticles(dt);
    mark("fx");
    meadow.drawMist(ctx, t, dt);
    mark("mist");
    meadow.drawSparkles(ctx, t);
    meadow.drawStreaks(ctx, t, dt);
    mark("sparkles");
    ctx.restore();
    meadow.drawVignette(ctx);
    if (!V.hidden) drawUI(t);
    mark("ui");
    if (V.boss && V.figureAlpha > 0.01) drawLabel(t);
    if (V.hint) drawHint(t);
    fx = fx.filter((f) => now - f.t0 < f.life);
  };

  function drawPiece(d, sx, sy, t, dt) {
    const sp = bake(d.t, lookOf(d));
    if (!reduce) {
      d.swap -= dt;
      if (d.swap <= 0) {
        d.v = (d.v + 1 + ((Math.random() * 2) | 0)) % 3;
        d.swap = 0.35 + Math.random() * 1.6;
      }
    }
    // contact shadow, falling away from the light
    const sw = d.t === "M" ? L.sqW * 1.9 : L.sqW * 0.85;
    ctx.globalAlpha = 0.85 * d.alpha;
    ctx.drawImage(shadowSprite, sx - sw * 0.42, sy - sw * 0.16, sw, sw * 0.32);
    // the bait glows a little
    if (d.bait && !reduce) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.6 + 0.25 * Math.sin(t * 3);
      const b = bloomSprite("rgba(215,130,160,0.7)", 32);
      ctx.drawImage(b, sx - L.sqW * 0.5, sy - L.sqH * 1.2, L.sqW, L.sqH * 1.2);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = d.alpha;
    ctx.drawImage(sp.canvases[d.v % sp.canvases.length], sx - sp.ax, sy - sp.ay, sp.w, sp.h);
    ctx.globalAlpha = 1;
    // the gold diamond over the selected piece (ref 4)
    if (V.sel === d.id) {
      const top = sy - sp.ay + 2 - (reduce ? 0 : Math.sin(t * 3) * 2) - 8;
      diamond(sx, top, 4.5);
    }
  }
  function drawFade(f) {
    const d = f.d;
    const sp = bake(d.t, lookOf(d));
    const [sx, sy] = anchor(d.x, d.y, d.t);
    ctx.globalAlpha = 1 - (now - f.t0) / f.life;
    ctx.drawImage(sp.canvases[0], sx - sp.ax, sy - sp.ay, sp.w, sp.h);
    ctx.globalAlpha = 1;
  }
  function diamond(x, y, r) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.6;
    ctx.drawImage(bloomSprite("rgba(217,184,74,0.7)", 24), x - 14, y - 14, 28, 28);
    ctx.restore();
    ctx.fillStyle = rgb(PAL.gold);
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.3);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r * 1.3);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fill();
  }
  function drawFigure(x, y) {
    ctx.globalAlpha = 0.85 * V.figureAlpha;
    ctx.drawImage(shadowSprite, x - 34, y - 10, 80, 22);
    ctx.globalAlpha = V.figureAlpha;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(figure.c, x - figure.ax, y - figure.ay, figure.w, figure.h);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1;
  }
  V.figureTop = () => (L && figure ? [L.left + L.bw / 2, L.top - L.sqH * 0.42 - figure.ay] : [0, 0]);

  // corner dots of the clearing, valid targets, hover integrity
  function drawHints(t) {
    const show = V.showBoard;
    // faint ASCII dots at the corners of the squares; clearer when hovering or selecting
    for (let y = 0; y <= 6; y++)
      for (let x = 0; x <= 6; x++) {
        const px = L.left + x * L.sqW,
          py = L.top + y * L.sqH;
        let a = 0.14 + 0.22 * show;
        if (V.hover) {
          const dx = x - (V.hover.x + 0.5),
            dy = 6 - y - (V.hover.y + 0.5);
          a += 0.35 * Math.max(0, 1 - Math.hypot(dx, dy) / 1.6);
        }
        ctx.globalAlpha = Math.min(0.8, a);
        drawGlyph(ctx, "+", "#c3c8ec", 7, px, py, dpr);
      }
    ctx.globalAlpha = 1;
    // valid moves: faint lavender dots in the grass
    for (const m of V.targets) {
      const cx = L.left + (m.x + 0.5) * L.sqW,
        cy = L.top + (5 - m.y + 0.5) * L.sqH;
      const hot = V.hover && V.hover.x === m.x && V.hover.y === m.y;
      const pulse = reduce ? 0.8 : 0.65 + 0.35 * Math.sin(t * 3 + m.x + m.y);
      if (m.kind === "move") {
        const pts = [[0, 0], [-0.16, -0.1], [0.16, -0.1], [-0.16, 0.12], [0.16, 0.12], [0, -0.22], [0, 0.22]];
        for (const [ox, oy] of pts) {
          ctx.globalAlpha = (hot ? 1 : 0.7) * pulse;
          drawGlyph(ctx, ox === 0 && oy === 0 ? "o" : ":", "#d6daf6", hot ? 13 : 11, cx + ox * L.sqW, cy + oy * L.sqH, dpr);
        }
      } else if (m.kind === "cap") {
        for (const [ox, oy] of [[-0.32, -0.3], [0.32, -0.3], [-0.32, 0.3], [0.32, 0.3]]) {
          ctx.globalAlpha = (hot ? 1 : 0.7) * pulse;
          drawGlyph(ctx, "x", "#e3a4ad", 10, cx + ox * L.sqW, cy + oy * L.sqH, dpr);
        }
      } else if (m.kind === "push") {
        const arrow = m.dx > 0 ? ">" : m.dx < 0 ? "<" : m.dy > 0 ? "^" : "v";
        for (const k of [-1, 0, 1]) {
          ctx.globalAlpha = (hot ? 1 : 0.65) * pulse;
          drawGlyph(ctx, arrow, "#c3c8ec", 11, cx + (m.dx ? k * 0.14 : (m.dy ? 0.3 : 0)) * L.sqW + (m.dx ? 0 : k * 0.12 * L.sqW), cy + (m.dy ? -k * 0.14 * L.sqH : 0.3 * L.sqH), dpr);
        }
      }
    }
    ctx.globalAlpha = 1;
    // hover: the square's integrity as a tiny glyph
    if (V.hover) {
      const v = integ[V.hover.y * 6 + V.hover.x];
      if (v > 0) {
        ctx.globalAlpha = 0.85;
        drawGlyph(ctx, INTEG_GLYPH[v], "#e8ecf5", 9, L.left + (V.hover.x + 0.86) * L.sqW, L.top + (5 - V.hover.y + 0.82) * L.sqH, dpr);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawPushPreview(list) {
    const m = V.pushHover;
    const s = state;
    const g = grid(s);
    const pusher = byId(s, m.id);
    const chain = pushChain(s, g, g[m.y * 6 + m.x], m.dx, m.dy, pusher);
    if (!chain) return;
    const ghost = (t, side, gx, gy, falls) => {
      const [sx, sy] = anchor(gx, gy, t);
      list.push({
        y: sy + 0.1,
        draw: () => {
          const sp = bake(t, t === "G" ? "gold" : side === "p" ? "player" : "boss");
          ctx.globalAlpha = falls ? 0.3 : 0.45;
          ctx.drawImage(sp.canvases[0], sx - sp.ax, sy - sp.ay, sp.w, sp.h);
          ctx.globalAlpha = 1;
          if (falls) drawGlyph(ctx, "×", "#e3a4ad", 16, sx, sy - L.sqH * 0.3, dpr);
        },
      });
    };
    for (const q of chain) {
      const nx = q.x + m.dx,
        ny = q.y + m.dy;
      const cells = q.t === "M" ? [[nx, ny], [nx + 1, ny], [nx, ny + 1], [nx + 1, ny + 1]] : [[nx, ny]];
      const falls = cells.some(([a, b]) => a < 0 || b < 0 || a > 5 || b > 5 || integ[b * 6 + a] === 0);
      ghost(q.t, q.side, nx, ny, falls);
    }
  }

  function drawOverlays(t) {
    // the Moon's coming attack, a round ahead: its two rows burn crimson out to the first hole,
    // and every piece of yours that will be struck is marked
    if (state && state.moon && state.moon.charging) {
      const m = [...disp.values()].find((d) => d.t === "M");
      if (m) {
        const pulse = reduce ? 0.8 : 0.6 + 0.3 * Math.sin(t * 5);
        for (const ry of [m.y, m.y + 1])
          for (const dir of [-1, 1])
            for (let x = dir < 0 ? m.x - 1 : m.x + 2; x >= 0 && x < 6; x += dir) {
              if (integ[ry * 6 + x] === 0) break;
              const cx = L.left + (x + 0.5) * L.sqW,
                cy = L.top + (5 - ry + 0.5) * L.sqH;
              ctx.globalCompositeOperation = "lighter";
              ctx.globalAlpha = pulse * 0.5;
              ctx.drawImage(bloomSprite("rgba(196,60,80,0.55)", 32), cx - L.sqW * 0.62, cy - L.sqH * 0.5, L.sqW * 1.24, L.sqH);
              ctx.globalCompositeOperation = "source-over";
              for (let k = -3; k <= 3; k++) {
                ctx.globalAlpha = pulse * 0.9;
                drawGlyph(ctx, k % 2 ? "~" : "=", "#ef7a88", 12, cx + k * L.sqW * 0.13, cy + L.sqH * 0.12, dpr);
              }
            }
        ctx.globalAlpha = 1;
      }
      for (const q of moonTargets(state)) {
        const d = disp.get(q.id);
        if (!d) continue;
        const [sx, sy] = anchor(d.x, d.y, d.t);
        const sp = bake(d.t, lookOf(d));
        ctx.globalAlpha = reduce ? 1 : 0.7 + 0.3 * Math.sin(t * 6);
        drawGlyph(ctx, "x", "#ff8f9c", 15, sx, sy - sp.ay + 2, dpr);
      }
      ctx.globalAlpha = 1;
    }
    for (const f of fx) {
      const k = (now - f.t0) / f.life;
      if (f.kind === "trap") {
        // the iron snap: [=] in iron colour, a jolt, then it lingers
        const [sx, sy] = anchor(f.x, f.y);
        const pop = k < 0.12 ? 1 + (0.12 - k) * 6 : 1;
        ctx.globalAlpha = k < 0.12 ? 1 : 1 - (k - 0.12) / 0.88;
        ctx.font = `${Math.round(24 * pop)}px ${FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgb(178,186,198)";
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 6;
        ctx.fillText("[=]", sx, sy - L.sqH * 0.3);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      } else if (f.kind === "line") {
        // the Angler's line: | and ~ from his rod to the hooked piece
        const d = disp.get(f.id);
        if (!d) continue;
        const [px, py] = anchor(...pos(d), d.t);
        const [fx0, fy0] = V.figureTop();
        const x0 = fx0 + 32,
          y0 = fy0 + 8;
        const a = Math.sin(Math.min(1, k * 1.5) * Math.PI * 0.5) * (k > 0.8 ? (1 - k) / 0.2 : 1);
        const n = 26;
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          const lx = lerp(x0, px, u),
            ly = lerp(y0, py - L.sqH * 0.9, u) + Math.sin(u * Math.PI) * 26;
          ctx.globalAlpha = a * 0.85;
          drawGlyph(ctx, i % 3 === 0 ? "~" : "|", "#c3c8ec", 9, lx, ly, dpr);
        }
        ctx.globalAlpha = 1;
      } else if (f.kind === "pick") {
        const [sx, sy] = anchor(f.x, f.y);
        // the pickaxe swings down: \ then | then /
        ctx.globalAlpha = 1 - k * k;
        ctx.font = `28px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillStyle = rgb(PAL.gold);
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 6;
        ctx.fillText(k < 0.33 ? "\\" : k < 0.66 ? "|" : "/", sx + 14, sy - L.sqH * 1.05);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      } else if (f.kind === "beam") {
        for (const ry of f.rows) {
          const cy = L.top + (5 - ry + 0.5) * L.sqH;
          ctx.globalAlpha = (1 - k) * 0.8;
          ctx.fillStyle = "rgba(230,232,250,1)";
          for (let x = 0; x < 6 * 7; x++) drawGlyph(ctx, "=", "#eef0ff", 12, L.left + (x + 0.5) * (L.sqW / 7), cy + (Math.random() - 0.5) * 3, dpr);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawParticles(dt) {
    if (!particles.length) return;
    const keep = [];
    for (const p of particles) {
      p.age += dt;
      if (p.age < 0) {
        keep.push(p);
        continue;
      }
      const k = p.age / p.life;
      if (k >= 1) {
        // the piece becomes grass and sparkles
        if (p.end === "blade" && particles.length < 3000) keep.push({ x: p.x, y: p.ground, blade: true, a: 0.9, age: 0, life: 1.6 + Math.random(), ang: (Math.random() - 0.5) * 0.9, len: 6 + Math.random() * 8 });
        else if (p.end === "spark") keep.push({ x: p.x, y: p.y, spark: true, age: 0, life: 0.8 + Math.random(), a: 1 });
        continue;
      }
      if (p.blade) {
        ctx.globalAlpha = p.a * (1 - k);
        ctx.strokeStyle = "rgb(124,194,181)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.sin(p.ang) * p.len * Math.min(1, k * 4), p.y - Math.cos(p.ang) * p.len * Math.min(1, k * 4));
        ctx.stroke();
        keep.push(p);
        continue;
      }
      if (p.spark) {
        ctx.globalAlpha = Math.sin(k * Math.PI);
        ctx.fillStyle = "#cfe0ff";
        ctx.fillRect(p.x - 0.8, p.y - 0.8, 1.6, 1.6);
        keep.push(p);
        continue;
      }
      p.vy += 60 * dt;
      p.vx *= 1 - dt * 1.5;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y > p.ground) {
        p.y = p.ground;
        p.vy *= -0.2;
      }
      ctx.globalAlpha = p.a * (1 - k * k);
      drawGlyph(ctx, p.ch, p.col, 5 + (1 - k) * 2, p.x, p.y, dpr);
      keep.push(p);
    }
    ctx.globalAlpha = 1;
    particles = keep;
  }

  // ── the boss's name and his typewritten words ──
  V.say = function (text) {
    V.sayText = text || "";
    V.sayStart = now;
  };
  V.sayDone = () => !V.sayText || (now - V.sayStart) * 38 >= V.sayText.length;
  V.skipSay = () => (V.sayStart = now - 999);
  function drawLabel(t) {
    const [x, y] = V.figureTop();
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,0.95)";
    ctx.shadowBlur = 5;
    ctx.globalAlpha = V.figureAlpha;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(V.boss.name, x, y - 10);
    if (V.sayText) {
      // his words type out under his name, beside the figure (like "Senje" in ref 4)
      const shown = reduce ? V.sayText : V.sayText.slice(0, Math.floor((now - V.sayStart) * 38));
      ctx.font = `12px ${FONT}`;
      ctx.fillStyle = "#e8ecf5";
      const narrow = L.W < 640;
      const maxW = narrow ? L.W - 32 : Math.min(340, L.W - x - 60);
      // wrap the whole line first, then reveal it, so words never jump lines while typing
      let left = shown.length;
      const lines = [];
      for (const ln of wrap(V.sayText, maxW)) {
        if (left <= 0) break;
        lines.push(ln.slice(0, left));
        left -= ln.length + 1;
      }
      ctx.textAlign = narrow ? "center" : "left";
      const lx = narrow ? L.W / 2 : x + 44,
        ly = narrow ? y + 8 : y + 14;
      lines.forEach((ln, i) => ctx.fillText(ln, lx, ly + i * 17));
      ctx.textAlign = "center";
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  function wrap(text, max) {
    const words = text.split(" ");
    const lines = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (ctx.measureText(test).width > max && cur) {
        lines.push(cur);
        cur = w;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // ── the scale, the candles, the wind's warning, the round ──
  function drawUI(t) {
    const mono = (px) => (ctx.font = `${px}px ${FONT}`);
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 4;
    // the scale, at the edge of the clearing
    const sx = L.portrait ? L.W - 78 : L.left + L.bw + Math.min(90, (L.W - L.left - L.bw) * 0.45),
      sy = L.portrait ? L.top + L.bh + 58 : L.top + L.bh * 0.55;
    const tilt = clamp(V.scale / 5, -1, 1) * 0.42; // positive: your pan (left) goes down
    mono(13);
    ctx.textAlign = "center";
    ctx.fillStyle = "#c3c8ec";
    for (let i = 0; i < 4; i++) ctx.fillText("|", sx, sy + 8 + i * 12);
    ctx.fillText("_/^\\_", sx, sy + 56);
    ctx.fillText("o", sx, sy - 2);
    const arm = L.portrait ? 40 : 58;
    for (let i = -6; i <= 6; i++) {
      const u = i / 6;
      ctx.fillText(i === 0 ? "+" : "=", sx + u * arm * Math.cos(tilt), sy - 2 - u * arm * Math.sin(tilt));
    }
    for (const side of [-1, 1]) {
      const ex = sx + side * arm * Math.cos(tilt);
      const yy = sy - 2 - side * arm * Math.sin(tilt);
      for (let i = 1; i <= 2; i++) ctx.fillText(":", ex, yy + i * 11);
      const cracked = side < 0 && V.phaseMoon;
      ctx.fillStyle = cracked ? "#7a6f88" : "#c3c8ec";
      ctx.fillText(cracked ? "\\_x_/" : "\\___/", ex, yy + 34);
      ctx.fillStyle = "#c3c8ec";
      const pts = side < 0 ? Math.max(0, V.scale) : Math.max(0, -V.scale);
      ctx.fillStyle = side < 0 ? "#e8ecf5" : "#d07884";
      ctx.fillText("o".repeat(Math.min(5, pts)), ex, yy + 25);
      ctx.fillStyle = "#c3c8ec";
    }
    mono(11);
    ctx.globalAlpha = 0.8;
    const lo = L.portrait ? 0.8 : 1;
    ctx.fillText(`${V.scale > 0 ? "+" : ""}${V.scale}`, sx, sy + 76 * lo);
    ctx.fillText(V.phaseMoon ? "you   the moon" : "you        him", sx, sy + 92 * lo);
    ctx.globalAlpha = 1;
    // candles: lives
    const cx0 = L.portrait ? L.left + 18 : L.left - Math.min(90, L.left * 0.5),
      cy0 = L.portrait ? L.top + L.bh + 74 : L.top + L.bh * 0.62;
    for (let i = 0; i < V.maxCandles; i++) {
      const x = cx0 + i * 26,
        lit = i < V.candles;
      mono(15);
      ctx.fillStyle = lit ? "#e8ecf5" : "#6b6380";
      ctx.fillText("|", x, cy0);
      ctx.fillText("|", x, cy0 + 13);
      ctx.fillText("‾", x, cy0 + 23);
      if (lit) {
        const fl = reduce ? 0 : Math.floor(t * 9 + i * 3) % 4;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.65 + (reduce ? 0 : 0.2 * Math.sin(t * 13 + i));
        ctx.drawImage(bloomSprite("rgba(255,190,90,0.8)", 20), x - 12, cy0 - 26, 24, 24);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#ffd890";
        ctx.fillText(["^", "*", "'", "^"][fl], x, cy0 - 16);
      } else {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = "#9aa0b8";
        ctx.fillText("~", x + (reduce ? 0 : Math.sin(t * 2 + i) * 2), cy0 - 14);
        ctx.globalAlpha = 1;
      }
    }
    // the wind's warning and the round, small, at the edge of the clearing
    mono(11);
    ctx.textAlign = "left";
    ctx.fillStyle = "#c3c8ec";
    const lx = L.left,
      ly = L.top + L.bh + (L.portrait ? 24 : 26);
    ctx.globalAlpha = V.quietUI ? 0 : 0.8;
    ctx.fillText(`round ${V.round}/${V.maxRounds}`, lx, ly);
    if (V.windWarn) {
      ctx.globalAlpha = reduce ? 0.95 : 0.7 + 0.3 * Math.sin(t * 4);
      ctx.fillText(`the wind is turning ${WIND_ARROW[V.windWarn]} ${WIND_NAME[V.windWarn]}`, lx, ly + 16);
    } else if (state && state.moon && state.moon.charging) {
      ctx.globalAlpha = reduce ? 0.95 : 0.7 + 0.3 * Math.sin(t * 4);
      ctx.fillStyle = "#e3a4ad";
      ctx.fillText("the moon is drawing breath ~ its rows will burn", lx, ly + 16);
    }
    if (V.status && !V.quietUI) {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#e8ecf5";
      ctx.textAlign = "right";
      ctx.fillText(V.status, L.left + L.bw, ly);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  // ── the campfire between fights: logs and flame in characters ──
  function drawCampfire(t) {
    const cx = L.W / 2,
      cy = L.portrait ? L.H * 0.56 : L.H * 0.6;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.55 + (reduce ? 0 : 0.12 * Math.sin(t * 7));
    ctx.drawImage(bloomSprite("rgba(255,150,60,0.55)", 64), cx - 220, cy - 240, 440, 360);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(shadowSprite, cx - 90, cy - 6, 180, 30);
    const logs = ["  \\==//  ", " ==//\\== ", "=//    \\="];
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#8a7060";
    logs.forEach((l, i) => ctx.fillText(l, cx, cy - 4 + i * 15));
    const tt = reduce ? 1 : t;
    for (let i = 0; i < 90; i++) {
      const u = ((i * 0.6180339) % 1) - 0.5;
      const life = (tt * (0.8 + (i % 5) * 0.12) + i * 0.37) % 1;
      const x = cx + u * 80 * (1 - life * 0.75) + Math.sin(tt * 3 + i) * 4;
      const y = cy - 14 - life * 120;
      const col = life < 0.3 ? "#fff1c0" : life < 0.6 ? "#ffb85a" : "#c4505f";
      ctx.globalAlpha = (1 - life) * 0.95;
      drawGlyph(ctx, "^*()'^%&"[i % 8], col, 15 - life * 6, x, y, dpr);
    }
    ctx.globalAlpha = 1;
  }
  // ── the win: the camera drifts up into the stars ──
  const sky = [];
  function drawSky(t) {
    if (!sky.length) for (let i = 0; i < 420; i++) sky.push({ x: R() * L.W, y: -R() * L.H, s: R(), p: R() * 7 });
    const off = ease(V.camera) * L.H * 0.95;
    ctx.fillStyle = "#03050b";
    ctx.fillRect(0, 0, L.W, off);
    for (const s of sky) {
      const y = s.y + off;
      if (y < 0 || y > off) continue;
      ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * (0.3 + s.s) + s.p));
      ctx.fillStyle = s.s > 0.8 ? "#cfe0ff" : "#ffffff";
      const z = s.s > 0.92 ? 2 : 1.2;
      ctx.fillRect(s.x, y, z, z);
      if (s.s > 0.96) drawGlyph(ctx, "*", "#cfe0ff", 9, s.x, y, dpr);
    }
    ctx.globalAlpha = 1;
  }
  // ── a short tutorial line, low on the screen, fading out ──
  V.showHint = (text, dur = 4.5) => (V.hint = { text, t0: now, dur });
  function drawHint(t) {
    const h = V.hint;
    const k = (now - h.t0) / h.dur;
    if (k >= 1) return (V.hint = null);
    ctx.font = `${L.W < 440 ? 11 : 13}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,1)";
    ctx.shadowBlur = 8;
    ctx.globalAlpha = Math.min(1, k * 6, (1 - k) * 4);
    ctx.fillText(h.text, L.W / 2, L.portrait ? L.H - 16 : Math.min(L.H - 18, L.top + L.bh + 76));
    ctx.fillStyle = "#e8ecf5";
    ctx.fillText(h.text, L.W / 2, L.portrait ? L.H - 16 : Math.min(L.H - 18, L.top + L.bh + 76));
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // ── input helpers ──
  // the piece under a screen point (its sprite, front-most first), else the square
  V.pick = function (px, py) {
    const items = [...disp.values()]
      .filter((d) => !d.tw)
      .map((d) => {
        const [sx, sy] = anchor(d.x, d.y, d.t);
        return { d, sx, sy };
      })
      .sort((a, b) => b.sy - a.sy);
    for (const { d, sx, sy } of items) {
      const sp = bake(d.t, lookOf(d));
      const w = (sp.w - 12) * 0.5,
        top = sy - sp.ay + 6;
      if (px > sx - w && px < sx + w && py > top && py < sy + 4) {
        // the Moon covers its whole 2 × 2 block, a piece its own square
        return { piece: d.id, square: L.at(px, py) };
      }
    }
    return { piece: null, square: L.at(px, py) };
  };
  return V;
}
