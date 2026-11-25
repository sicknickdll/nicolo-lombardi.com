// /archive/aquarium/: an ASCII tank. Draw a fish, release it, feed it.
// Everything in the water is glyphs on one canvas; panels are HTML in DEVAULT's style.
import { rasterize, crop, blank, encode, decode, PAD_W, PAD_H } from "./ascii.js";
import { TINTS, GOLD, HEART, FOOD, LIGHTS, SANDS, DECOR, STARTERS } from "./art.js";
import { createWorld, makeFish, fishSprite, staticSprite, step, dropFood, poke, startle, burst, fx, MAX_FISH } from "./sim.js";
import { createAudio } from "./audio.js";

const KEY = "nl-aquarium";
const FONT = '"Geist Mono", ui-monospace, Menlo, monospace';
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c) => `rgb(${c.map((v) => Math.round(clamp(v, 0, 255))).join(",")})`;
const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// colour slots: 0 water · 1 sand · 2–7 fish tints · 8 gold · 9 heart · 10 food
const SLOT = { water: 0, sand: 1, gold: 8, heart: 9, food: 10 };
const slotOf = (t) => (typeof t === "number" ? 2 + t : (SLOT[t] ?? 0));

export function mountAquarium(root) {
  const html = document.documentElement;
  html.classList.add("aquarium-page");
  const $ = (s) => root.querySelector(s);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stage = $(".aq-stage"),
    cv = $(".aq-c"),
    g = cv.getContext("2d", { alpha: false }),
    glow = $(".aq-glow"),
    gg = glow.getContext("2d"),
    live = $(".aq-live"),
    tip = $(".aq-tip"),
    panel = $(".aq-panel"),
    bin = $(".aq-bin");
  const audio = createAudio(localStorage.getItem(KEY + "-sound") !== "0");
  const W = createWorld();
  const say = (t) => (live.textContent = t);
  W.emit = (name, f) => {
    audio.play({ eat: "eat", grr: "grr", love: "love", hatch: "hatch", egg: "pop" }[name] || name);
    if (name === "hatch") say(`${f.name} hatched`);
    if (name === "love") say("Two fish fell in love");
  };

  // ── state kept between visits ──
  const S = { scales: 3, owned: ["devault", "plain"], light: "devault", sand: "plain" };
  let palette = [],
    bg = "#07070a";

  // ── grid ──
  let laid = false,
    fs = 13,
    cw = 8,
    lh = 15,
    cols = 0,
    rows = 0,
    dpr = 1,
    surfRow = 4,
    sandH = [],
    chars,
    lvls,
    slots;
  function layout() {
    const w = stage.clientWidth,
      h = stage.clientHeight;
    const oldW = laid ? W.W : 0,
      oldH = W.H;
    laid = true;
    fs = w < 700 ? 10.5 : w < 1200 ? 12 : 13;
    lh = Math.round(fs * 1.2);
    g.font = `${fs}px ${FONT}`;
    cw = g.measureText("M").width || fs * 0.6;
    dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    glow.width = Math.round(w / 3);
    glow.height = Math.round(h / 3);
    cols = Math.ceil(w / cw);
    rows = Math.ceil(h / lh);
    chars = new Uint16Array(cols * rows);
    lvls = new Uint8Array(cols * rows);
    slots = new Uint8Array(cols * rows);
    const bar = $(".aq-bar").getBoundingClientRect().height;
    surfRow = Math.ceil((bar + 10) / lh);
    sandH = Array.from({ length: cols }, (_, c) => {
      const n = Math.sin(c * 0.045 + 1.3) * 1.3 + Math.sin(c * 0.13 + 4) * 0.6 + Math.sin(c * 0.011) * 0.8;
      return clamp(Math.round(4 + n), 2, 7);
    });
    Object.assign(W, { W: w, H: h, cw, ch: lh, k: clamp(w / 1500, 0.5, 1), surf: (surfRow + 0.5) * lh });
    W.sandY = (x) => (rows - sandH[clamp(Math.floor(x / cw), 0, cols - 1)]) * lh;
    if (oldW) for (const o of [...W.fish, ...W.plants, ...W.decor, ...W.eggs]) (o.x *= w / oldW), o.y != null && (o.y *= h / oldH);
  }
  function setLight(name) {
    const L = LIGHTS[name] || LIGHTS.devault;
    S.light = name;
    bg = L.bg;
    root.style.setProperty("--aq-bg", L.bg);
    root.style.setProperty("--aq-ink", L.stops[2]);
    root.style.setProperty("--aq-mid", L.stops[1]);
    root.classList.toggle("aq-scan", !!L.scan);
    const stops = L.stops.map(hex),
      base = (l) => (l < 0.5 ? mix(hex(L.bg), stops[0], l * 2) : l < 0.75 ? mix(stops[0], stops[1], (l - 0.5) * 4) : mix(stops[1], stops[2], (l - 0.75) * 4));
    // 10 levels: 0 faint … 9 brightest
    const lvl = (i) => 0.42 + (i / 9) * 0.58;
    const tints = [null, hex("#c9b38a"), ...TINTS.map(hex), hex(GOLD), hex(HEART), hex(FOOD)];
    palette = tints.map((t, s) =>
      Array.from({ length: 10 }, (_, i) => {
        const b = base(lvl(i));
        if (s === 0) return rgb(b);
        if (s === 1) return rgb(mix(b, mix(hex(L.bg), t, lvl(i)), 0.35));
        const k = s >= 8 ? Math.max(0.65, L.tint) : L.tint;
        return rgb(mix(b, mix(hex(L.bg), t, 0.25 + 0.75 * (i / 9)), k));
      }),
    );
  }

  // ── buffer ──
  const put = (c, r, ch, lv, slot = 0) => {
    if (c < 0 || r < 0 || c >= cols || r >= rows) return;
    const i = r * cols + c;
    chars[i] = typeof ch === "number" ? ch : ch.charCodeAt(0);
    lvls[i] = clamp(Math.round(lv), 0, 9);
    slots[i] = slot;
  };
  const putIfEmpty = (c, r, ch, lv, slot = 0) => c >= 0 && r >= 0 && c < cols && r < rows && !chars[r * cols + c] && put(c, r, ch, lv, slot);
  const text = (c, r, s, lv, slot) => {
    for (let i = 0; i < s.length; i++) s[i] !== " " && put(c + i, r, s[i], lv, slot);
  };
  const sprite = (sp, x0, y0, lvFn, slot, ghost = false) => {
    const c0 = Math.round(x0 / cw),
      r0 = Math.round(y0 / lh);
    for (let r = 0; r < sp.rows; r++)
      for (let c = 0; c < sp.cols; c++) {
        const k = r * sp.cols + c,
          ch = sp.chars[k];
        if (ch !== " ") ghost ? putIfEmpty(c0 + c, r0 + r, ch, lvFn(sp.lum[k]), slot) : put(c0 + c, r0 + r, ch, lvFn(sp.lum[k]), slot);
      }
  };

  // ── draw a frame ──
  const buckets = Array.from({ length: 11 * 10 }, () => []);
  function render() {
    chars.fill(0);
    const t = W.t,
      sandTop = rows - Math.max(...sandH);
    // light falling through the water, in bands
    for (let r = surfRow + 1; r < sandTop + 1; r++) {
      const depth = 1 - (r - surfRow) / (rows - surfRow);
      for (let c = 0; c < cols; c++) {
        if (r >= rows - sandH[c]) continue;
        const u = (c + r * 0.55) * 0.045,
          v = Math.max(0, Math.sin(u + t * 0.12) * Math.sin(u * 0.37 - t * 0.07 + 1.7)) ** 3 * depth;
        if (hash(c, r) < v * 0.5) put(c, r, v > 0.5 && hash(r, c) < 0.3 ? ":" : ".", 1 + v * 3);
      }
    }
    for (const s of W.snow) put(Math.floor(s.x / cw), Math.floor(s.y / lh), ".", 2);
    // surface
    for (let c = 0; c < cols; c++) {
      let h = Math.sin(c * 0.19 + t * 1.4) * 0.6 + Math.sin(c * 0.053 - t * 0.8) * 0.5;
      if (ptr.in && ptr.y < W.surf + lh * 4) h += Math.max(0, 1 - Math.abs(c * cw - ptr.x) / 90) * Math.sin(t * 8) * 1.2;
      put(c, surfRow, h > -0.5 ? "~" : "-", 6 + h * 2.5);
      if (hash(c, Math.floor(t * 2)) < 0.03) put(c, surfRow + 1 + ((hash(t | 0, c) * 3) | 0), "'", 2);
    }
    // sand
    for (let c = 0; c < cols; c++) {
      const top = rows - sandH[c];
      for (let r = top; r < rows; r++) {
        const d = r - top,
          hv = hash(c, r);
        let ch = d === 0 ? (sandH[c - 1] > sandH[c] ? "\\" : sandH[c + 1] > sandH[c] ? "/" : "_") : hv < 0.35 ? "." : hv < 0.55 ? ":" : hv < 0.68 ? "," : hv < 0.75 ? ";" : " ";
        if (S.sand === "ripple" && d > 0 && Math.sin(c * 0.5 + r * 2.4) > 0.75) ch = "~";
        if (S.sand === "pebble" && d > 0 && hv > 0.93) ch = hv > 0.975 ? "O" : "o";
        if (ch !== " ") put(c, r, ch, d === 0 ? 7 : 6 - d * 0.6, 1);
      }
    }
    // ripples from clicks
    if (!reduce)
      for (const rp of W.ripples) {
        const rad = 20 + rp.t * 170,
          n = Math.ceil((rad * 6.3) / cw);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          putIfEmpty(Math.floor((rp.x + Math.cos(a) * rad) / cw), Math.floor((rp.y + Math.sin(a) * rad * 0.7) / lh), rp.t < 0.4 ? "o" : ".", 6 * (1 - rp.t));
        }
      }
    // decor, plants
    for (const d of W.decor) {
      const art = DECOR[d.kind].art,
        w = Math.max(...art.map((l) => l.length)),
        r0 = Math.floor(W.sandY(d.x) / lh) - art.length + 1,
        c0 = Math.round(d.x / cw - w / 2);
      art.forEach((l, i) => text(c0, r0 + i, l, d === drag?.obj ? 9 : 5 + (i / art.length) * 2, 0));
    }
    for (const p of W.plants) {
      const sp = staticSprite(p, cw, lh, W.k, 240),
        c0 = Math.round(p.x / cw - sp.cols / 2),
        r0 = Math.floor(W.sandY(p.x) / lh) - sp.rows + 1;
      for (let r = 0; r < sp.rows; r++) {
        const hf = (sp.rows - 1 - r) / Math.max(1, sp.rows - 1),
          sh = Math.round((reduce ? 0.4 : 1.1) * Math.sin(t * 1.1 + p.ph + r * 0.3) * hf ** 1.2 + (p.push ?? 0) * hf ** 1.5);
        for (let c = 0; c < sp.cols; c++) {
          const k = r * sp.cols + c;
          if (sp.chars[k] !== " ") put(c0 + c + sh, r0 + r, sp.chars[k], 3 + sp.lum[k] * 5, 2 + p.tint);
        }
      }
    }
    // food, eggs, scales
    for (const p of W.food) put(Math.floor(p.x / cw), Math.floor(p.y / lh), p.land ? "," : (p.t * 4 + p.ph) % 2 < 1 ? "*" : "+", p.land ? 5 - p.t / 4 : 9, SLOT.food);
    for (const e of W.eggs) {
      const wob = e.land && e.t > 18 ? Math.round(Math.sin(e.t * 20)) : 0;
      put(Math.floor(e.x / cw) + wob, Math.floor(e.y / lh), e.t > 20 ? "@" : "0", 8, SLOT.heart);
    }
    for (const s of W.scales) {
      if (s.land && s.t > 80 && Math.floor(s.t * 6) % 2) continue;
      put(Math.floor(s.x / cw), Math.floor(s.y / lh), Math.floor(W.t * 3 + s.x) % 5 === 0 ? "*" : "◊", 9, SLOT.gold);
    }
    // fish, back to front
    for (const f of W.fish) {
      const sp = fishSprite(f, cw, lh, W.k),
        fr = sp.frames[Math.floor(f.phase) & 3][f.dir > 0 ? 0 : 1],
        dim = f.state === "held" || f === hover ? 1.15 : f.z * (1 - f.hunger * 0.18);
      sprite(fr, f.x - sp.w / 2, f.y - sp.h / 2, (l) => (3.5 + l * 6) * dim, 2 + f.tint);
      if (f.emote) {
        const e = f.emote.txt;
        text(Math.round(f.x / cw - e.length / 2), Math.round((f.y - sp.h / 2) / lh) - 1, e, 9, slotOf(f.emote.tint ?? "water"));
      }
    }
    // bubbles over everything in the water
    for (const b of W.bubbles) put(Math.floor(b.x / cw), Math.floor(b.y / lh), "°oO"[b.size], 7);
    for (const p of W.fx) put(Math.floor(p.x / cw), Math.floor(p.y / lh), p.ch, p.lv * (1 - (p.to ? 0 : p.t / p.life) * 0.6), slotOf(p.tint));
    // something being placed
    if (placing && ptr.in) {
      if (placing.decor) {
        const art = DECOR[placing.decor].art,
          w = Math.max(...art.map((l) => l.length)),
          r0 = Math.floor(W.sandY(ptr.x) / lh) - art.length + 1;
        art.forEach((l, i) => text(Math.round(ptr.x / cw - w / 2), r0 + i, l, Math.floor(t * 4) % 2 ? 9 : 6, 0));
      } else {
        const sp = staticSprite(placing.plant, cw, lh, W.k, 240);
        sprite(sp, ptr.x - sp.w / 2, W.sandY(ptr.x) - (sp.rows - 1) * lh, (l) => (Math.floor(t * 4) % 2 ? 4 : 7) + l * 2, 2 + placing.plant.tint);
      }
    }

    // paint, one colour at a time
    for (const b of buckets) b.length = 0;
    for (let i = 0; i < chars.length; i++) if (chars[i]) buckets[slots[i] * 10 + lvls[i]].push(i);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = bg;
    g.fillRect(0, 0, W.W, W.H);
    g.font = `${fs}px ${FONT}`;
    g.textBaseline = "top";
    const oy = (lh - fs) / 2;
    buckets.forEach((b, k) => {
      if (!b.length) return;
      g.fillStyle = palette[(k / 10) | 0][k % 10];
      for (const i of b) g.fillText(String.fromCharCode(chars[i]), (i % cols) * cw, ((i / cols) | 0) * lh + oy);
    });
    gg.clearRect(0, 0, glow.width, glow.height);
    gg.drawImage(cv, 0, 0, glow.width, glow.height);
  }

  // ── pointer ──
  const ptr = { x: -999, y: -999, in: false, speed: 0, still: 0, lx: 0, ly: 0, lt: 0 };
  let hover = null,
    drag = null,
    placing = null;
  const local = (e) => {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const fishAt = (x, y) => {
    for (let i = W.fish.length - 1; i >= 0; i--) {
      const f = W.fish[i],
        sp = fishSprite(f, cw, lh, W.k);
      if (Math.abs(x - f.x) > sp.w / 2 + cw || Math.abs(y - f.y) > sp.h / 2 + lh * 0.5) continue;
      const fr = sp.frames[Math.floor(f.phase) & 3][f.dir > 0 ? 0 : 1],
        c = Math.floor((x - (f.x - sp.w / 2)) / cw),
        r = Math.floor((y - (f.y - sp.h / 2)) / lh);
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const cc = c + dc,
            rr = r + dr;
          if (cc >= 0 && rr >= 0 && cc < fr.cols && rr < fr.rows && fr.chars[rr * fr.cols + cc] !== " ") return f;
        }
    }
    return null;
  };
  const objAt = (x, y) => {
    for (const d of [...W.decor].reverse()) {
      const art = DECOR[d.kind].art,
        w = Math.max(...art.map((l) => l.length)) * cw,
        by = W.sandY(d.x);
      if (Math.abs(x - d.x) < w / 2 && y > by - art.length * lh && y < by + lh) return d;
    }
    for (const p of [...W.plants].reverse()) {
      const sp = p.spr,
        by = W.sandY(p.x);
      if (sp && Math.abs(x - p.x) < sp.w / 2 && y > by - sp.h && y < by + lh) return p;
    }
    return null;
  };
  const near = (list, x, y, rx, ry) => list.findIndex((o) => Math.abs(o.x - x) < rx && Math.abs(o.y - y) < ry);

  function onDown(e) {
    if (e.button > 0) return;
    audio.wake();
    stage.setPointerCapture?.(e.pointerId);
    const [x, y] = local(e);
    Object.assign(ptr, { x, y, in: true });
    if (placing) return place(x);
    let i = near(W.scales, x, y, cw * 2, lh * 1.2);
    if (i >= 0) return collect(i);
    i = near(W.bubbles, x, y, cw * 1.6, lh);
    if (i >= 0) {
      const b = W.bubbles.splice(i, 1)[0];
      burst(W, b.x, b.y, "*·.", 5, { speed: 60, life: 0.4 });
      return audio.play("pop");
    }
    const f = fishAt(x, y);
    if (f) return (drag = { fish: f, x0: x, y0: y, moved: false });
    const o = objAt(x, y);
    if (o) return (drag = { obj: o, x0: x, y0: y, dx: o.x - x, moved: false });
    if (y > W.surf - lh && y < W.sandY(x)) {
      dropFood(W, x, Math.max(y, W.surf + lh));
      audio.play("plop");
    }
  }
  function onMove(e) {
    const [x, y] = local(e),
      now = performance.now(),
      dt = Math.max(1, now - ptr.lt) / 1000;
    const v = Math.hypot(x - ptr.lx, y - ptr.ly) / dt;
    ptr.speed = ptr.speed * 0.6 + v * 0.4;
    if (Math.hypot(x - ptr.lx, y - ptr.ly) > 3) ptr.still = 0;
    Object.assign(ptr, { x, y, lx: x, ly: y, lt: now, in: true });
    if (!reduce && ptr.speed > 700 && Math.random() < 0.5 && y > W.surf && y < W.sandY(x)) fx(W, x, y, Math.random() < 0.5 ? "~" : ".", { vy: 0, life: 0.5, lv: 4 });
    if (drag && !drag.moved && Math.hypot(x - drag.x0, y - drag.y0) > 6) {
      drag.moved = true;
      if (drag.fish) {
        drag.fish.state = "held";
        drag.fish.emote = { txt: "!!", t: 0, life: 99 };
      }
      root.classList.add("aq-dragging");
    }
    if (drag?.moved && drag.obj) drag.obj.x = clamp(x + drag.dx, 10, W.W - 10);
    if (drag?.moved) bin.classList.toggle("on", overBin(e));
    hover = drag ? null : fishAt(x, y);
    stage.classList.toggle("aq-hand", !!(hover || drag || objAt(x, y)));
    showTip(e);
  }
  function onUp(e) {
    if (!drag) return;
    const d = drag;
    drag = null;
    root.classList.remove("aq-dragging");
    bin.classList.remove("on");
    if (d.moved && overBin(e)) return remove(d.fish || d.obj);
    if (d.fish) {
      if (d.moved) {
        d.fish.state = "wander";
        d.fish.emote = null;
        d.fish.timer = 0;
        startle(W, d.fish, d.fish.x, d.fish.y - 40, 0.3);
      } else {
        poke(W, d.fish);
        audio.play("poke");
      }
    } else if (!d.moved) {
      if (d.obj.kind === "chest") {
        for (let i = 0; i < 14; i++) W.bubbles.push({ x: d.obj.x + rand(-20, 20), y: W.sandY(d.obj.x) - lh * 3, vy: rand(-60, -110), ph: rand(0, 6), size: (Math.random() * 3) | 0, t: 0 });
        audio.play("splash");
      } else if (d.obj.src) d.obj.pv = (d.obj.pv ?? 0) + (Math.random() < 0.5 ? -30 : 30);
    }
    save();
  }
  const overBin = (e) => {
    const r = bin.getBoundingClientRect();
    return e.clientX > r.left - 20 && e.clientX < r.right + 20 && e.clientY > r.top - 20 && e.clientY < r.bottom + 20;
  };
  function remove(o) {
    for (const list of [W.fish, W.plants, W.decor]) {
      const i = list.indexOf(o);
      if (i >= 0) list.splice(i, 1);
    }
    if (o.kind) S.scales += Math.floor(DECOR[o.kind].cost / 2);
    burst(W, o.x, o.y ?? W.sandY(o.x) - lh * 2, "*.·'", 12, { speed: 100 });
    audio.play("splash");
    updateBar();
    save();
  }
  function collect(i) {
    const s = W.scales.splice(i, 1)[0],
      r = $(".aq-scales").getBoundingClientRect(),
      sr = stage.getBoundingClientRect();
    audio.play("coin");
    const p = { x: s.x, y: s.y, ch: "◊", tint: "gold", lv: 9, life: 0.7, t: 0, from: [s.x, s.y], to: [r.left + 14 - sr.left, r.top + r.height / 2 - sr.top] };
    p.done = () => {
      S.scales++;
      updateBar(true);
      save();
    };
    W.fx.push(p);
  }
  function showTip(e) {
    if (!hover || drag) return (tip.hidden = true);
    const n = Math.round((1 - hover.hunger) * 5);
    tip.innerHTML = `<b>${hover.name}</b><span>${"■".repeat(n)}${"□".repeat(5 - n)}</span>`;
    tip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 16}px)`;
    tip.hidden = false;
  }
  function place(x) {
    if (placing.decor) {
      const c = DECOR[placing.decor].cost;
      if (S.scales < c) return deny();
      S.scales -= c;
      W.decor.push({ kind: placing.decor, x, bubbles: !!DECOR[placing.decor].bubbles });
    } else W.plants.push({ ...placing.plant, x, ph: rand(0, 6) });
    burst(W, x, W.sandY(x) - lh, ".,:'", 10, { speed: 70 });
    audio.play("plop");
    placing = null;
    root.classList.remove("aq-placing");
    updateBar();
    if (!panel.hidden && panel.dataset.kind === "decor") openDecor();
    save();
  }
  const deny = () => {
    const el = $(".aq-scales");
    el.classList.remove("no");
    void el.offsetWidth;
    el.classList.add("no");
    audio.play("poke");
  };

  // ── top bar ──
  function updateBar(bump) {
    $(".aq-count").textContent = `${W.fish.length} fish`;
    const sc = $(".aq-scales b");
    sc.textContent = S.scales;
    if (bump) {
      sc.parentElement.classList.remove("bump");
      void sc.offsetWidth;
      sc.parentElement.classList.add("bump");
    }
  }

  // ── panels ──
  const pre = (sp) => {
    let s = "";
    for (let r = 0; r < sp.rows; r++) s += sp.chars.slice(r * sp.cols, (r + 1) * sp.cols).join("") + "\n";
    return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  };
  const paintBm = (fn) => {
    const c = document.createElement("canvas");
    c.width = PAD_W;
    c.height = PAD_H;
    const x = c.getContext("2d");
    fn(x);
    return toBm(x);
  };
  const toBm = (x) => {
    const id = x.getImageData(0, 0, PAD_W, PAD_H).data,
      bm = blank();
    for (let i = 0; i < bm.d.length; i++) bm.d[i] = (id[i * 4] * id[i * 4 + 3]) / 255;
    return bm;
  };
  function closePanel() {
    panel.hidden = true;
    panel.dataset.kind = "";
    root.classList.remove("aq-drawing");
    pad.off?.();
    for (const b of root.querySelectorAll("[data-act]")) b.classList.remove("on");
  }
  function toggle(kind, open) {
    if (panel.dataset.kind === kind) return closePanel();
    closePanel();
    root.querySelector(`[data-act="${kind}"]`)?.classList.add("on");
    panel.dataset.kind = kind;
    panel.hidden = false;
    open();
  }

  // the drawing pad
  const pad = { kind: "fish", tone: 255, size: 7, tint: 0, ctx: null, undo: [] };
  function openDraw() {
    root.classList.add("aq-drawing");
    const tiles = (kind) =>
      Object.keys(STARTERS[kind])
        .map((n) => `<button type="button" class="aq-tile" data-starter="${n}" aria-label="${n}"><pre>${pre(rasterize(crop(paintBm(STARTERS[kind][n])), 16, 1.9))}</pre></button>`)
        .join("");
    panel.innerHTML = `<div class="aq-sec"><h3>Kind</h3><div class="aq-seg"><button type="button" data-kind="fish">Fish</button><button type="button" data-kind="plant">Plant</button></div></div>
<div class="aq-sec"><h3>Start from</h3><div class="aq-tiles aq-starters">${tiles(pad.kind)}</div></div>
<div class="aq-sec"><h3>Brush</h3><div class="aq-tiles aq-brush"><button type="button" data-tone="255" aria-label="Solid"><pre>@</pre></button><button type="button" data-tone="150" aria-label="Mid"><pre>+</pre></button><button type="button" data-tone="80" aria-label="Light"><pre>.</pre></button><button type="button" data-tone="0" aria-label="Eraser"><pre>×</pre></button></div>
<label class="aq-range"><span>Size</span><output>${pad.size}</output><input type="range" min="2" max="18" value="${pad.size}"></label></div>
<div class="aq-sec"><h3>Tint</h3><div class="aq-swatches">${TINTS.map((t, i) => `<button type="button" data-tint="${i}" style="--c:${t}" aria-label="Tint ${i + 1}"></button>`).join("")}</div></div>
<div class="aq-foot"><button type="button" data-do="undo">Undo</button><button type="button" data-do="clear">Clear</button><button type="button" class="aq-pri" data-do="release">Release</button></div>`;
    const sync = () => {
      panel.querySelectorAll("[data-kind]").forEach((b) => b.classList.toggle("on", b.dataset.kind === pad.kind));
      panel.querySelectorAll("[data-tone]").forEach((b) => b.classList.toggle("on", +b.dataset.tone === pad.tone));
      panel.querySelectorAll("[data-tint]").forEach((b) => b.classList.toggle("on", +b.dataset.tint === pad.tint));
      padTag.textContent = pad.kind === "fish" ? "fish · head →" : "plant · roots ↓";
    };
    panel.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.kind && b.dataset.kind !== pad.kind) {
        pad.kind = b.dataset.kind;
        panel.querySelector(".aq-starters").innerHTML = tiles(pad.kind);
        snap();
        pad.ctx.clearRect(0, 0, PAD_W, PAD_H);
        drawPad();
      }
      if (b.dataset.tone) pad.tone = +b.dataset.tone;
      if (b.dataset.tint) (pad.tint = +b.dataset.tint), drawPad();
      if (b.dataset.starter) {
        snap();
        pad.ctx.clearRect(0, 0, PAD_W, PAD_H);
        STARTERS[pad.kind][b.dataset.starter](pad.ctx);
        drawPad();
      }
      if (b.dataset.do === "undo" && pad.undo.length) pad.ctx.putImageData(pad.undo.pop(), 0, 0), drawPad();
      if (b.dataset.do === "clear") snap(), pad.ctx.clearRect(0, 0, PAD_W, PAD_H), drawPad();
      if (b.dataset.do === "release") release();
      sync();
    };
    const range = panel.querySelector("input[type=range]");
    range.oninput = () => ((pad.size = +range.value), (range.previousElementSibling.textContent = range.value));
    if (!pad.ctx) {
      const c = document.createElement("canvas");
      c.width = PAD_W;
      c.height = PAD_H;
      pad.ctx = c.getContext("2d", { willReadFrequently: true });
    }
    sync();
    mountPad();
  }
  const padEl = $(".aq-pad"),
    padCv = padEl.querySelector("canvas"),
    padTag = padEl.querySelector(".aq-tag");
  const PCOLS = 48;
  function drawPad() {
    const pg = padCv.getContext("2d"),
      r = padCv.getBoundingClientRect(),
      d = Math.min(2, devicePixelRatio || 1);
    const ar = rasterize(toBm(pad.ctx), PCOLS, 1.8);
    if (padCv.width !== Math.round(r.width * d)) (padCv.width = Math.round(r.width * d)), (padCv.height = Math.round(r.height * d));
    const pcw = r.width / PCOLS,
      plh = r.height / ar.rows,
      pfs = pcw / 0.6;
    pg.setTransform(d, 0, 0, d, 0, 0);
    pg.clearRect(0, 0, r.width, r.height);
    pg.font = `${pfs}px ${FONT}`;
    pg.textBaseline = "middle";
    pg.textAlign = "center";
    const pal = palette[2 + pad.tint];
    for (let rr = 0; rr < ar.rows; rr++)
      for (let c = 0; c < PCOLS; c++) {
        const k = rr * PCOLS + c,
          ch = ar.chars[k];
        const x = (c + 0.5) * pcw,
          y = (rr + 0.5) * plh;
        if (ch === " ") {
          if (c % 3 === 1 && rr % 2 === 1) (pg.fillStyle = "rgba(255,255,255,.09)"), pg.fillText("·", x, y);
          continue;
        }
        pg.fillStyle = pal[clamp(Math.round(2 + ar.lum[k] * 7.5), 0, 9)];
        pg.fillText(ch, x, y);
      }
  }
  const snap = () => (pad.undo.push(pad.ctx.getImageData(0, 0, PAD_W, PAD_H)), pad.undo.length > 30 && pad.undo.shift());
  function mountPad() {
    padEl.hidden = false;
    let last = null;
    const at = (e) => {
      const r = padCv.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * PAD_W, ((e.clientY - r.top) / r.height) * PAD_H];
    };
    const stroke = (a, b) => {
      const x = pad.ctx;
      x.save();
      if (!pad.tone) x.globalCompositeOperation = "destination-out";
      x.strokeStyle = `rgb(${pad.tone || 255},${pad.tone || 255},${pad.tone || 255})`;
      x.lineWidth = pad.size;
      x.lineCap = x.lineJoin = "round";
      x.beginPath();
      x.moveTo(...a);
      x.lineTo(...b);
      x.stroke();
      x.restore();
    };
    const down = (e) => {
      audio.wake();
      padCv.setPointerCapture(e.pointerId);
      snap();
      last = at(e);
      stroke(last, [last[0] + 0.01, last[1]]);
      drawPad();
    };
    const move = (e) => {
      if (!last) return;
      const p = at(e);
      stroke(last, p);
      last = p;
      drawPad();
      if (Math.random() < 0.15) audio.play("tick");
    };
    const up = () => (last = null);
    padCv.addEventListener("pointerdown", down);
    padCv.addEventListener("pointermove", move);
    padCv.addEventListener("pointerup", up);
    padCv.addEventListener("pointercancel", up);
    const ro = new ResizeObserver(drawPad);
    ro.observe(padCv);
    pad.off = () => {
      padEl.hidden = true;
      ro.disconnect();
      padCv.removeEventListener("pointerdown", down);
      padCv.removeEventListener("pointermove", move);
      padCv.removeEventListener("pointerup", up);
      padCv.removeEventListener("pointercancel", up);
      pad.off = null;
    };
    requestAnimationFrame(drawPad);
  }
  function release() {
    const src = crop(toBm(pad.ctx));
    if (!src) {
      padEl.classList.remove("no");
      void padEl.offsetWidth;
      padEl.classList.add("no");
      return audio.play("poke");
    }
    if (pad.kind === "fish") {
      if (W.fish.length >= MAX_FISH) return deny();
      const f = makeFish(src, { tint: pad.tint, x: W.W / 2 + rand(-80, 80), y: W.surf + lh * 3 });
      f.state = "flee";
      f.fx = f.x;
      f.fy = f.y - 100;
      f.timer = 0.6;
      W.fish.push(f);
      burst(W, f.x, W.surf + lh, "~*o°.", 18, { speed: 140 });
      audio.play("splash");
      say(`${f.name} released`);
      closePanel();
    } else {
      placing = { plant: { src, tint: pad.tint } };
      root.classList.add("aq-placing");
      closePanel();
    }
    pad.undo.length = 0;
    pad.ctx.clearRect(0, 0, PAD_W, PAD_H);
    updateBar();
    save();
  }

  // the decor shop
  function openDecor() {
    const ws = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
    panel.innerHTML = `<div class="aq-sec"><h3>Decor</h3><div class="aq-tiles aq-decor">${Object.entries(DECOR)
      .map(([k, d]) => `<button type="button" data-decor="${k}" class="${S.scales < d.cost ? "dim" : ""}"><pre>${ws(d.art.join("\n"))}</pre><i>◊ ${d.cost}</i></button>`)
      .join("")}</div></div>
<div class="aq-sec"><h3>Light</h3><div class="aq-presets">${Object.entries(LIGHTS)
      .map(
        ([k, L]) =>
          `<button type="button" data-light="${k}" class="${S.light === k ? "on" : ""} ${!S.owned.includes(k) && S.scales < L.cost ? "dim" : ""}" style="--b:${L.bg};--m:${L.stops[1]};--i:${L.stops[2]}"><pre>&gt;&lt;(((°&gt;</pre><span>${k}</span><i>${S.owned.includes(k) ? "" : "◊ " + L.cost}</i></button>`,
      )
      .join("")}</div></div>
<div class="aq-sec"><h3>Sand</h3><div class="aq-seg">${Object.entries(SANDS)
      .map(([k, c]) => `<button type="button" data-sand="${k}" class="${S.sand === k ? "on" : ""}">${k}${S.owned.includes(k) ? "" : ` <i>◊ ${c}</i>`}</button>`)
      .join("")}</div></div>`;
    panel.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.decor) {
        if (S.scales < DECOR[b.dataset.decor].cost) return deny();
        placing = { decor: b.dataset.decor };
        root.classList.add("aq-placing");
        if (matchMedia("(max-width: 720px)").matches) closePanel();
        return;
      }
      const buy = (k, cost) => {
        if (S.owned.includes(k)) return true;
        if (S.scales < cost) return deny(), false;
        S.scales -= cost;
        S.owned.push(k);
        audio.play("coin");
        return true;
      };
      if (b.dataset.light && buy(b.dataset.light, LIGHTS[b.dataset.light].cost)) setLight(b.dataset.light);
      if (b.dataset.sand && buy(b.dataset.sand, SANDS[b.dataset.sand])) S.sand = b.dataset.sand;
      updateBar();
      save();
      openDecor();
    };
  }

  // ── keep ──
  let saveT = 0;
  function save() {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          v: 1,
          at: Date.now(),
          ...S,
          fish: W.fish.map((f) => ({ id: f.id, name: f.name, src: encode(f.src), tint: f.tint, size: +f.size.toFixed(3), hunger: +f.hunger.toFixed(3), p: f.p, z: f.z, speed: f.speed, x: f.x / W.W, y: f.y / W.H, born: f.born })),
          plants: W.plants.map((p) => ({ src: encode(p.src), tint: p.tint, x: p.x / W.W })),
          decor: W.decor.map((d) => ({ kind: d.kind, x: d.x / W.W })),
          eggs: W.eggs.map((e) => ({ src: encode(e.src), tint: e.tint, p: e.p, parents: e.parents, x: e.x / W.W, t: e.t })),
          aff: [...W.aff],
        }),
      );
    } catch {}
  }
  function load() {
    let d = null;
    try {
      d = JSON.parse(localStorage.getItem(KEY));
    } catch {}
    if (d?.v === 1) {
      const away = Math.max(0, (Date.now() - d.at) / 1000);
      Object.assign(S, { scales: d.scales, owned: d.owned, light: d.light, sand: d.sand });
      W.fish = d.fish.map((f) => makeFish(decode(f.src), { ...f, hunger: Math.min(1, f.hunger + away / 260), x: f.x * W.W, y: f.y * W.H }));
      W.plants = d.plants.map((p) => ({ src: decode(p.src), tint: p.tint, x: p.x * W.W, ph: rand(0, 6) }));
      W.decor = d.decor.map((o) => ({ kind: o.kind, x: o.x * W.W, bubbles: !!DECOR[o.kind]?.bubbles })).filter((o) => DECOR[o.kind]);
      W.eggs = (d.eggs || []).map((e) => ({ ...e, src: decode(e.src), x: e.x * W.W, y: W.sandY(e.x * W.W) - lh, land: true }));
      W.aff = new Map(d.aff || []);
      return;
    }
    // a first tank
    const mk = (kind, name, o) => makeFish(crop(paintBm(STARTERS.fish[kind])), { ...o, x: rand(W.W * 0.2, W.W * 0.8), y: rand(W.surf + 120, W.sandY(0) - 120) });
    W.fish = [mk("classic", 0, { tint: 0, size: 0.95 }), mk("angel", 0, { tint: 1, size: 0.85 }), mk("guppy", 0, { tint: 4, size: 0.7 }), mk("puffer", 0, { tint: 3, size: 0.6 })];
    W.plants = [
      { src: crop(paintBm(STARTERS.plant.kelp)), tint: 3, x: W.W * 0.16, ph: 1 },
      { src: crop(paintBm(STARTERS.plant.fern)), tint: 1, x: W.W * 0.78, ph: 3 },
      { src: crop(paintBm(STARTERS.plant.coral)), tint: 5, x: W.W * 0.62, ph: 0 },
    ];
    W.decor = [{ kind: "rock", x: W.W * 0.3 }];
    save();
  }

  // ── run ──
  const on = (el, ev, fn, o) => (el.addEventListener(ev, fn, o), () => el.removeEventListener(ev, fn, o));
  const offs = [
    on(stage, "pointerdown", onDown),
    on(stage, "pointermove", onMove),
    on(stage, "pointerup", onUp),
    on(stage, "pointercancel", onUp),
    on(stage, "pointerleave", (e) => e.pointerType === "mouse" && ((ptr.in = false), (tip.hidden = true), (hover = null))),
    on($(".aq-bar"), "click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      audio.wake();
      if (b.dataset.act === "draw") toggle("draw", openDraw);
      if (b.dataset.act === "decor") toggle("decor", openDecor);
      if (b.dataset.act === "sound") {
        audio.on = !audio.on;
        b.setAttribute("aria-pressed", audio.on);
        localStorage.setItem(KEY + "-sound", audio.on ? "1" : "0");
      }
    }),
    on(window, "keydown", (e) => {
      if (e.target.closest?.("input")) return;
      if (e.key === "Escape") {
        if (placing) (placing = null), root.classList.remove("aq-placing");
        else closePanel();
      } else if (e.key === "d" || e.key === "D") toggle("draw", openDraw);
      else if (e.key === "f" || e.key === "F") (audio.wake(), dropFood(W, rand(W.W * 0.15, W.W * 0.85), W.surf + lh), audio.play("plop"));
      else if (e.key === "m" || e.key === "M") $('[data-act="sound"]').click();
    }),
    on(window, "resize", () => root.classList.contains("ready") && (layout(), render())),
    on(document, "visibilitychange", () => (document.hidden ? save() : (last = performance.now()))),
    on(window, "pagehide", save),
  ];
  $('[data-act="sound"]').setAttribute("aria-pressed", audio.on);

  let raf = 0,
    last = performance.now();
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ptr.still += dt;
    ptr.speed *= 1 - Math.min(1, dt * 6);
    step(W, dt, ptr);
    for (const p of W.plants) staticSprite(p, cw, lh, W.k, 240);
    render();
    if ((saveT += dt) > 6) (saveT = 0), save();
  };
  document.fonts.load(`13px ${FONT}`).finally(() => {
    if (!root.isConnected) return;
    layout();
    setLight(S.light);
    load();
    setLight(S.light);
    updateBar();
    root.classList.add("ready");
    raf = requestAnimationFrame(loop);
  });

  return () => {
    save();
    cancelAnimationFrame(raf);
    offs.forEach((f) => f());
    pad.off?.();
    html.classList.remove("aquarium-page");
  };
}
