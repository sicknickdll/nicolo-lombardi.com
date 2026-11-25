// The tank's life, in CSS px. No drawing here: js/aquarium/tank.js renders the world.
import { rasterize, blendImg, imgToBm } from "./ascii.js";
import { fishName } from "./art.js";

export const MAX_FISH = 28;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const GRAWLIX = "#@!%$&*?";

// img: the colour drawing (RGBA, facing right)
export function makeFish(img, o = {}) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  return {
    id: o.id ?? Math.random().toString(36).slice(2, 9),
    name: o.name ?? fishName(),
    img,
    src: imgToBm(img),
    tint: o.tint ?? 0,
    size: o.size ?? 1,
    hunger: o.hunger ?? 0.35,
    p: o.p ?? Math.random(),
    z: o.z ?? rand(0.45, 1),
    x: o.x ?? 0,
    y: o.y ?? 0,
    vx: 0,
    vy: 0,
    dir,
    face: dir, // follows dir slowly: through 0 the fish is edge-on, mid-turn
    tilt: 0,
    beat: rand(0, 6), // burst and glide
    phase: rand(0, 6),
    speed: o.speed ?? rand(38, 72),
    state: "wander",
    tx: o.x ?? 0,
    ty: o.y ?? 0,
    timer: 0,
    cool: rand(15, 40),
    scaleT: rand(12, 30),
    emote: null,
    born: o.born ?? Date.now(),
    spr: null,
  };
}

// Size on screen; farther fish are smaller (z: 0.45 far … 1 near).
export function fishSprite(f, cw, chh, k) {
  const w = Math.max(24, (f.src.w / 160) * 250 * f.size * (0.55 + 0.45 * f.z) * k);
  if (f.spr && f.spr.w === w) return f.spr;
  return (f.spr = { w, h: (w * f.src.h) / f.src.w });
}

export function staticSprite(o, cw, chh, k, width = 150) {
  const cols = Math.max(3, Math.round(((o.src.w / 160) * width * k) / cw));
  if (o.spr && o.spr.cols === cols && o.spr.cw === cw && o.spr.chh === chh) return o.spr;
  const r = rasterize(o.src, cols, chh / cw, { detail: true, seed: 3 });
  return (o.spr = { ...r, cw, chh, w: cols * cw, h: r.rows * chh });
}

export function createWorld() {
  return {
    fish: [],
    plants: [],
    decor: [],
    food: [],
    bubbles: [],
    scales: [],
    eggs: [],
    fx: [],
    ripples: [],
    snow: [],
    aff: new Map(),
    t: 0,
    social: 0,
    W: 800,
    H: 600,
    cw: 8,
    ch: 15,
    k: 1,
    surf: 60,
    sandY: () => 560,
    emit: () => {},
  };
}

const pairKey = (a, b) => (a.id < b.id ? a.id + "|" + b.id : b.id + "|" + a.id);
export const affinity = (w, a, b) => w.aff.get(pairKey(a, b)) ?? 0;

export function fishBounds(w, f) {
  const s = fishSprite(f, w.cw, w.ch, w.k);
  return {
    x0: s.w / 2 + 6,
    x1: w.W - s.w / 2 - 6,
    y0: w.surf + w.ch * 1.5 + s.h / 2,
    y1: Math.max(w.surf + w.ch * 2 + s.h, w.sandY(f.x) - s.h / 2 - w.ch * 0.4),
  };
}

export const fx = (w, x, y, ch, o = {}) =>
  w.fx.length < 400 && w.fx.push({ x, y, ch, vx: o.vx ?? 0, vy: o.vy ?? -20, tint: o.tint ?? 0, lv: o.lv ?? 8, life: o.life ?? 1, t: 0, to: o.to });
export const burst = (w, x, y, chars, n, o = {}) => {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2),
      s = rand(20, o.speed ?? 90);
    fx(w, x, y, chars[(Math.random() * chars.length) | 0], { vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, tint: o.tint, life: rand(0.4, o.life ?? 0.9), lv: o.lv });
  }
};

export function dropFood(w, x, y) {
  const n = 3 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n && w.food.length < 80; i++) w.food.push({ x: x + rand(-18, 18), y: y + rand(-6, 6), vy: rand(20, 32), ph: rand(0, 6), t: 0, land: false });
  w.ripples.push({ x, y, t: 0 });
  // a splash scares whoever is right there (they come back for the food)
  for (const f of w.fish) if (f.state !== "held" && Math.hypot(f.x - x, f.y - y) < 80) startle(w, f, x, y, 0.45);
}

export function startle(w, f, x, y, time = 0.8) {
  if (f.state === "held") return;
  f.state = "flee";
  f.fx = x;
  f.fy = y;
  f.timer = time;
  f.emote = { txt: "!", t: 0, life: 0.7 };
}

export function poke(w, f) {
  startle(w, f, f.x - f.dir * 40, f.y, 0.5);
  f.dir *= -1;
  f.spin = 0.5;
  f.emote = { txt: Math.random() < 0.5 ? "!" : "!?", t: 0, life: 0.8 };
  burst(w, f.x, f.y, "o°.", 4, { speed: 50 });
}

export function step(w, dt, ptr) {
  w.t += dt;
  const { fish } = w;
  // ── social: friendships drift, rivals quibble, soulmates court ──
  w.social += dt;
  if (w.social > 0.3) {
    w.social = 0;
    for (let i = 0; i < fish.length; i++)
      for (let j = i + 1; j < fish.length; j++) {
        const a = fish[i],
          b = fish[j],
          d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 160) continue;
        const key = pairKey(a, b),
          compat = clamp(1 - 2.4 * Math.abs(a.p - b.p), -1, 1);
        let v = clamp((w.aff.get(key) ?? 0) + compat * 0.02 + (Math.random() - 0.5) * 0.01, -1, 1);
        w.aff.set(key, v);
        const free = (f) => (f.state === "wander" || f.state === "curious") && f.cool <= 0;
        if (!free(a) || !free(b)) continue;
        if (v < -0.4 && d < 120) {
          for (const [f, o] of [[a, b], [b, a]]) Object.assign(f, { state: "quibble", other: o, timer: 1.8, cool: rand(20, 35) });
          w.emit("grr", a);
        } else if (v > 0.78 && a.hunger < 0.55 && b.hunger < 0.55 && a.size >= 0.9 && b.size >= 0.9 && fish.length + w.eggs.length < MAX_FISH) {
          for (const [f, o] of [[a, b], [b, a]]) Object.assign(f, { state: "love", other: o, timer: 4, cool: rand(70, 110) });
          a.lead = true;
          b.lead = false;
          w.emit("love", a);
        }
      }
  }

  for (const f of fish) stepFish(w, f, dt, ptr);
  fish.sort((a, b) => a.z - b.z);

  // ── food ──
  for (let i = w.food.length - 1; i >= 0; i--) {
    const p = w.food[i];
    p.t += dt;
    if (!p.land) {
      p.y += p.vy * dt;
      p.x += Math.sin(p.t * 2 + p.ph) * 10 * dt;
      if (p.y >= w.sandY(p.x) - w.ch * 0.6) (p.land = true), (p.t = 0);
    } else if (p.t > 14) w.food.splice(i, 1);
  }
  // ── bubbles ──
  for (const d of w.decor) if (d.bubbles && Math.random() < dt * 1.4) w.bubbles.push(bubble(d.x + rand(-6, 6), w.sandY(d.x) - w.ch * 3));
  if (Math.random() < dt * 0.5 && fish.length) {
    const f = fish[(Math.random() * fish.length) | 0];
    w.bubbles.push(bubble(f.x + f.dir * 20, f.y - 6, 0));
  }
  for (let i = w.bubbles.length - 1; i >= 0; i--) {
    const b = w.bubbles[i];
    b.t += dt;
    b.y += b.vy * dt;
    b.x += Math.sin(b.t * 3 + b.ph) * 14 * dt;
    if (b.t > 1.5 && b.size < 2 && Math.random() < dt * 0.15) b.size++;
    if (b.y < w.surf + w.ch) {
      w.bubbles.splice(i, 1);
      fx(w, b.x, w.surf, "*", { vy: -10, life: 0.25, lv: 6 });
    }
  }
  // ── golden scales ──
  for (let i = w.scales.length - 1; i >= 0; i--) {
    const s = w.scales[i];
    s.t += dt;
    if (!s.land) {
      s.y += 22 * dt;
      s.x += Math.sin(s.t * 3) * 22 * dt;
      if (s.y >= w.sandY(s.x) - w.ch * 0.6) (s.land = true), (s.t = 0);
    } else if (s.t > 90) w.scales.splice(i, 1);
  }
  // ── eggs ──
  for (let i = w.eggs.length - 1; i >= 0; i--) {
    const e = w.eggs[i];
    e.t += dt;
    if (!e.land) {
      e.y += 26 * dt;
      if (e.y >= w.sandY(e.x) - w.ch * 0.6) e.land = true;
    }
    if (e.t > 24 && fish.length < MAX_FISH) {
      w.eggs.splice(i, 1);
      const baby = makeFish(e.img, { tint: e.tint, size: 0.5, hunger: 0.5, p: clamp(e.p + rand(-0.15, 0.15), 0, 1), x: e.x, y: e.y - 30 });
      fish.push(baby);
      for (const f of fish) if (e.parents.includes(f.id)) w.aff.set(pairKey(f, baby), 0.9);
      burst(w, e.x, e.y, "*.'`", 10, { speed: 70 });
      w.emit("hatch", baby);
    }
  }
  // ── ripples, sparks, snow ──
  for (let i = w.ripples.length - 1; i >= 0; i--) if ((w.ripples[i].t += dt) > 0.9) w.ripples.splice(i, 1);
  for (let i = w.fx.length - 1; i >= 0; i--) {
    const p = w.fx[i];
    p.t += dt;
    if (p.to) {
      const u = Math.min(1, p.t / p.life),
        e = u * u * (3 - 2 * u);
      p.x = p.from[0] + (p.to[0] - p.from[0]) * e;
      p.y = p.from[1] + (p.to[1] - p.from[1]) * e - Math.sin(u * Math.PI) * 80;
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 2;
    }
    if (p.t > p.life) {
      w.fx.splice(i, 1);
      p.done?.();
    }
  }
  // marine snow, thickest under the surface
  while (w.snow.length < Math.min(260, (w.W * w.H) / 5000)) w.snow.push({ x: rand(0, w.W), y: w.surf + (w.H - w.surf) * Math.random() ** 1.8, vy: rand(3, 9), ph: rand(0, 6) });
  for (const s of w.snow) {
    s.y += s.vy * dt;
    s.x += Math.sin(w.t * 0.4 + s.ph) * 4 * dt;
    if (s.y > w.sandY(s.x) || (s.y > w.surf + (w.H - w.surf) * 0.55 && Math.random() < dt * 0.15)) (s.y = w.surf + w.ch * rand(1, 8)), (s.x = rand(0, w.W));
  }
  // ── plants and decor sway away from the cursor and passing fish ──
  for (const p of w.plants) {
    const s = p.spr;
    if (!s) continue;
    let tgt = 0;
    const top = w.sandY(p.x) - s.h,
      reach = s.w / 2 + 50;
    const push = (x, y, k) => {
      const dx = x - p.x;
      if (Math.abs(dx) < reach && y > top - 20 && y < w.sandY(p.x) + 10) tgt += -Math.sign(dx || 1) * (1 - Math.abs(dx) / reach) * k;
    };
    if (ptr.in) push(ptr.x, ptr.y, ptr.speed > 60 ? 4 : 1.6);
    for (const f of fish) if (Math.abs(f.vx) > 20) push(f.x, f.y, 1.4);
    p.pv = (p.pv ?? 0) + ((tgt - (p.push ?? 0)) * 28 - (p.pv ?? 0) * 5) * dt;
    p.push = (p.push ?? 0) + p.pv * dt;
  }
}

const bubble = (x, y, size = (Math.random() * 2) | 0) => ({ x, y, vy: rand(-48, -70), ph: rand(0, 6), size, t: 0 });

function nearestFood(w, f) {
  let best = null,
    bd = 700;
  for (const p of w.food) {
    const d = Math.hypot(p.x - f.x, p.y - f.y) + (p.land ? 60 : 0);
    if (d < bd) (bd = d), (best = p);
  }
  return best;
}

function stepFish(w, f, dt, ptr) {
  const s = fishSprite(f, w.cw, w.ch, w.k),
    B = fishBounds(w, f);
  f.hunger = Math.min(1, f.hunger + dt / 260);
  f.cool -= dt;
  f.timer -= dt;
  if (f.spin > 0) f.spin -= dt;
  if (f.emote && (f.emote.t += dt) > f.emote.life) f.emote = null;
  // burst and glide: a few strong beats, then coasting
  f.beat += dt * (0.7 + f.p * 0.5);
  const thrust = 0.55 + 0.65 * Math.max(0, Math.sin(f.beat)) ** 2;
  let spd = f.speed * (1.15 - f.hunger * 0.35) * (f.size < 0.8 ? 1.15 : 1) * thrust * (0.35 + 0.65 * Math.abs(f.face));
  let tx = f.tx,
    ty = f.ty,
    face = 0;

  if (f.state === "held") {
    f.x += (ptr.x - f.x) * Math.min(1, dt * 18);
    f.y += (ptr.y - f.y) * Math.min(1, dt * 18);
    f.vx = f.vy = 0;
    f.phase += dt * 30;
    return;
  }
  // cursor rushing past
  if (ptr.in && ptr.speed > 900 && f.state !== "flee" && Math.hypot(ptr.x - f.x, ptr.y - f.y) < 110 + s.w / 3) startle(w, f, ptr.x, ptr.y, 0.7);

  if (f.state === "flee") {
    const dx = f.x - f.fx,
      dy = f.y - f.fy,
      d = Math.hypot(dx, dy) || 1;
    tx = f.x + (dx / d) * 200;
    ty = f.y + (dy / d) * 120;
    spd *= 3.4;
    if (f.timer <= 0) f.state = "wander";
  } else if (f.state === "quibble") {
    const o = f.other;
    face = Math.sign(o.x - f.x) || 1;
    tx = f.x + (Math.random() - 0.5) * 30;
    ty = f.y + (Math.random() - 0.5) * 30;
    spd *= 0.6;
    if (!f.emote || f.emote.t > 0.12) f.emote = { txt: Array.from({ length: 4 }, () => GRAWLIX[(Math.random() * GRAWLIX.length) | 0]).join(""), t: 0, life: 0.13, tint: "heart" };
    if (f.timer <= 0) startle(w, f, o.x, o.y, 0.9);
    if (!w.fish.includes(o)) f.state = "wander";
  } else if (f.state === "love") {
    const o = f.other;
    face = Math.sign(o.x - f.x) || 1;
    tx = o.x - face * (s.w * 0.45);
    ty = o.y + Math.sin(w.t * 2 + f.p * 9) * 10;
    spd *= 0.7;
    if (Math.random() < dt * 4) fx(w, (f.x + o.x) / 2 + rand(-10, 10), Math.min(f.y, o.y) - s.h / 2, "♥", { vy: -26, tint: "heart", life: 1.4 });
    if (f.timer <= 0) {
      f.state = "wander";
      if (f.lead && w.fish.includes(o)) {
        w.eggs.push({ x: (f.x + o.x) / 2, y: (f.y + o.y) / 2, t: 0, land: false, img: blendImg(f.img, o.img), tint: Math.random() < 0.5 ? f.tint : o.tint, p: (f.p + o.p) / 2, parents: [f.id, o.id] });
        w.emit("egg", f);
      }
    }
  } else {
    const food = f.hunger > 0.12 && nearestFood(w, f);
    const pd = Math.hypot(ptr.x - f.x, ptr.y - f.y);
    if (food) {
      f.state = "food";
      tx = food.x - f.dir * s.w * 0.4;
      ty = food.y;
      spd *= 1.7;
      const mx = f.x + f.dir * s.w * 0.42;
      if (Math.abs(mx - food.x) < w.cw * 2.5 + s.w * 0.12 && Math.abs(f.y - food.y) < Math.max(w.ch * 1.2, s.h * 0.35)) {
        w.food.splice(w.food.indexOf(food), 1);
        f.hunger = Math.max(0, f.hunger - 0.3);
        f.size = Math.min(1.4, f.size + (f.size < 1 ? 0.06 : 0.025));
        burst(w, mx, food.y, "*'.", 3, { speed: 40, life: 0.4 });
        w.emit("eat", f);
        if (Math.random() < 0.18) dropScale(w, f.x, f.y);
      }
    } else if (ptr.in && ptr.still > 0.5 && pd < 260 && f.hunger < 0.9) {
      if (f.state !== "curious") f.emote = { txt: "?", t: 0, life: 0.9 };
      f.state = "curious";
      face = Math.sign(ptr.x - f.x) || 1;
      tx = ptr.x - face * (s.w / 2 + 30 + f.p * 90);
      ty = ptr.y + (f.p - 0.5) * 220 + Math.sin(w.t * 1.5 + f.p * 7) * 8;
      spd *= 0.55;
    } else {
      f.state = "wander";
      if (f.timer <= 0 || Math.hypot(f.tx - f.x, f.ty - f.y) < 24) {
        let friend = null;
        if (Math.random() < 0.45)
          for (const o of w.fish)
            if (o !== f && affinity(w, f, o) > 0.4 && (!friend || Math.random() < 0.5)) friend = o;
        if (friend) (f.tx = friend.x + rand(-80, 80)), (f.ty = friend.y + rand(-40, 40));
        else (f.tx = rand(B.x0, B.x1)), (f.ty = rand(B.y0, B.y1) * 0.6 + f.y * 0.4);
        f.timer = rand(3, 9);
      }
      tx = f.tx;
      ty = f.ty;
      if (f.hunger > 0.8 && Math.random() < dt * 0.2) f.emote = { txt: "...", t: 0, life: 1.6 };
    }
  }
  tx = clamp(tx, B.x0, B.x1);
  ty = clamp(ty, B.y0, B.y1);
  // personal space: glyphs on glyphs read as noise
  if (f.state !== "love" && f.state !== "quibble")
    for (const o of w.fish) {
      if (o === f || !o.spr) continue;
      const ox = (f.x - o.x) / ((s.w + o.spr.w) * 0.42),
        oy = (f.y - o.y) / ((s.h + o.spr.h) * 0.5),
        d2 = ox * ox + oy * oy;
      if (d2 < 1) {
        const k = (1 - d2) * 170 * dt;
        f.vx += Math.sign(ox || f.p - 0.5) * k * 0.6;
        f.vy += Math.sign(oy || f.p - 0.5) * k * (f.z > o.z ? 1 : 0.4);
      }
    }
  const dx = tx - f.x,
    dy = ty - f.y,
    d = Math.hypot(dx, dy) || 1,
    k = Math.min(1, d / 50);
  const k2 = Math.min(1, dt * (f.state === "flee" ? 5 : 1.3));
  f.vx += ((dx / d) * spd * k - f.vx) * k2;
  f.vy += ((dy / d) * spd * k * 0.5 - f.vy) * k2;
  f.x = clamp(f.x + f.vx * dt, B.x0, B.x1);
  f.y = clamp(f.y + (f.vy + Math.sin(w.t * 0.9 + f.p * 20) * 3) * dt, B.y0, B.y1);
  if (face) f.dir = face;
  else if (f.vx > 14) f.dir = 1;
  else if (f.vx < -14) f.dir = -1;
  if (f.spin > 0 && Math.random() < dt * 8) f.dir *= -1;
  // turning takes time; the body leans into a climb or a dive
  const turn = (f.state === "flee" ? 6 : 2.6) * dt;
  f.face += clamp(f.dir - f.face, -turn, turn);
  const tilt = clamp(Math.atan2(f.vy, Math.abs(f.vx) + 25), -0.45, 0.45);
  f.tilt += (tilt - f.tilt) * Math.min(1, dt * 3);
  // tail beats follow the thrust
  f.phase += dt * (1.6 + thrust * 2.2 + Math.hypot(f.vx, f.vy) / 18);

  f.scaleT -= dt * (f.hunger < 0.45 ? 1 : 0.2);
  if (f.scaleT <= 0) {
    f.scaleT = rand(25, 50);
    dropScale(w, f.x, f.y);
  }
}

export function dropScale(w, x, y) {
  if (w.scales.length < 24) w.scales.push({ x, y, t: 0, land: false });
}
