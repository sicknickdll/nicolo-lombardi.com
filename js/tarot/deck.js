// The 21 physical cards and everything they do on the table: the stack, the shuffle, the cut,
// the guiding card, the fan, the reveal of each pick, the cross, inspection, gathering up.
//
// Every card object is tied to one card id for its whole life, and every animation here takes
// the order from the ritual (js/tarot/engine.js) and moves the cards to match it: what you see
// is always the real state of the deck.
import {
  Group,
  Mesh,
  PlaneGeometry,
  ExtrudeGeometry,
  Shape,
  MeshLambertMaterial,
  MeshBasicMaterial,
  TextureLoader,
  SRGBColorSpace,
  Vector3,
  Quaternion,
  Color,
  Euler,
} from "../vendor/three.js";
import { OUTLINE } from "./outline.js";
import { BACK, card as cardData } from "./cards.js";
import { CARD_W, CARD_H, CARD_T, HERO } from "./stage.js";
import { ease, approach, lerp } from "./tween.js";

const X = new Vector3(1, 0, 0),
  Y = new Vector3(0, 1, 0);
const Q_FLAT = new Quaternion().setFromAxisAngle(X, -Math.PI / 2);
const Q_FLIP = new Quaternion().setFromAxisAngle(Y, Math.PI);
// Lying on the table, top edge away from you, turned by `yaw`; face up or down.
export const flat = (yaw = 0, up = false) => {
  const q = new Quaternion().setFromAxisAngle(Y, yaw).multiply(Q_FLAT);
  return up ? q : q.multiply(Q_FLIP);
};
const yawQ = (a) => new Quaternion().setFromAxisAngle(Y, a);
const jitter = (id, k) => {
  let h = 2166136261;
  for (const ch of id + k) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) / 4294967296 - 0.5) * 2;
};

export function createDeck(stage, ids, { reduce = false } = {}) {
  const { clock, hands } = stage;
  const loader = new TextureLoader();
  const loadTex = (url) =>
    new Promise((res, rej) =>
      loader.load(
        url,
        (t) => {
          t.colorSpace = SRGBColorSpace;
          t.anisotropy = 8;
          res(t);
        },
        undefined,
        rej,
      ),
    );

  // shared shapes
  const face = new PlaneGeometry(CARD_W, CARD_H);
  const shape = new Shape(OUTLINE.map(([u, v]) => ({ x: (u - 0.5) * CARD_W, y: (0.5 - v) * CARD_H })));
  const edgeGeo = new ExtrudeGeometry(shape, { depth: CARD_T * 0.94, bevelEnabled: false, curveSegments: 1 });
  edgeGeo.translate(0, 0, (-CARD_T * 0.94) / 2);
  const hidden = new MeshBasicMaterial({ visible: false });
  const edgeMat = new MeshLambertMaterial({ color: 0xe6dcc8, emissive: 0x15100a });
  const backMat = new MeshLambertMaterial({ color: 0x5a1a1a, alphaTest: 0.5 });
  const backReady = loadTex(BACK)
    .then((t) => {
      backMat.map = t;
      backMat.color = new Color(0xffffff);
      backMat.needsUpdate = true;
    })
    .catch(() => {}); // a missing back keeps the plain crimson: nothing breaks

  const cards = new Map();
  // which cards came out upside down (set by the experience from the ritual)
  let isRev = () => false;
  const Z_FLIP = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI);
  const heldFor = (id, h) => (isRev(id) ? { pos: h.pos, quat: h.quat.clone().multiply(Z_FLIP) } : h);
  for (const id of ids) {
    const group = new Group();
    group.userData.cardId = id;
    const frontMat = new MeshLambertMaterial({ color: 0xc8aa7a, alphaTest: 0.5, emissive: 0xffffff, emissiveIntensity: 0 });
    const front = new Mesh(face, frontMat);
    front.position.z = CARD_T / 2 + 0.0003;
    const back = new Mesh(face, backMat);
    back.quaternion.copy(Q_FLIP);
    back.position.z = -CARD_T / 2 - 0.0003;
    const edge = new Mesh(edgeGeo, [hidden, edgeMat]);
    for (const m of [front, back, edge]) (m.castShadow = true), (m.receiveShadow = true), (m.userData.cardId = id);
    group.add(front, back, edge);
    group.position.set(0, -1, -2); // off stage until placed
    stage.scene.add(group);
    const c = {
      id,
      group,
      front,
      frontMat,
      loaded: null,
      hover: 0,
      hoverTo: 0,
      glow: 0.06,
      glowTo: 0.06,
      busy: 0,
      rest: null, // { pos, quat } where it lies when nothing moves it
      lift: new Vector3(),
      liftTo: new Vector3(),
      where: "deck",
    };
    cards.set(id, c);
  }
  const get = (id) => cards.get(id);
  // The face is only loaded when the card is about to be turned over (or restored face up).
  function loadFace(id) {
    const c = get(id);
    if (!c.loaded)
      c.loaded = loadTex(cardData(id).art)
        .then((t) => {
          c.frontMat.map = t;
          c.frontMat.emissiveMap = t;
          c.frontMat.color = new Color(0xffffff);
          c.frontMat.needsUpdate = true;
        })
        .catch(() => {}); // missing art: the card shows plain parchment, the reading goes on
    return c.loaded;
  }
  const setHero = (c, on) => c.group.traverse((o) => o.layers.set(on ? HERO : 0));

  // per frame: hover lift, pile offsets during the cut, highlight
  let t = 0;
  const off = stage.onFrame((dt) => {
    t += dt;
    for (const c of cards.values()) {
      // a card held up floats a little while it waits
      if (c.float && !c.busy) {
        const f = c.float;
        c.group.position.copy(f.pos);
        c.group.position.y += Math.sin(t * 1.4) * 0.004;
        c.group.quaternion.copy(f.quat).multiply(new Quaternion().setFromEuler(new Euler(Math.sin(t * 0.9) * 0.025, Math.sin(t * 0.7) * 0.035, 0)));
      }
      c.hover = approach(c.hover, c.hoverTo, 14, dt);
      c.lift.x = approach(c.lift.x, c.liftTo.x, 16, dt);
      c.lift.y = approach(c.lift.y, c.liftTo.y, 16, dt);
      c.lift.z = approach(c.lift.z, c.liftTo.z, 16, dt);
      c.glow = approach(c.glow, c.glowTo, 4, dt);
      c.frontMat.emissiveIntensity = c.glow;
      if (c.busy || !c.rest) continue;
      const p = c.group.position.copy(c.rest.pos).add(c.lift);
      if (c.hover > 0.001) {
        const toward = new Vector3(0, 0, 1).applyQuaternion(yawQ(c.rest.yaw || 0));
        p.y += 0.03 * c.hover;
        p.addScaledVector(toward, 0.035 * c.hover);
      }
      c.group.quaternion.copy(c.rest.quat);
      if (c.hover > 0.001) c.group.quaternion.premultiply(new Quaternion().setFromAxisAngle(X.clone().applyQuaternion(yawQ(c.rest.yaw || 0)), -0.12 * c.hover));
    }
  });

  // ── moving one card ──
  function move(c, { pos, quat, ms = 600, arc = 0, ease: e = ease.inOut, delay = 0 }) {
    c.busy++;
    const p0 = new Vector3(),
      q0 = new Quaternion();
    let started = false;
    const ctrl = new Vector3();
    return clock
      .tween(
        ms,
        (k) => {
          if (!started) {
            started = true;
            p0.copy(c.group.position);
            q0.copy(c.group.quaternion);
            ctrl.lerpVectors(p0, pos, 0.5);
            ctrl.y = Math.max(p0.y, pos.y) + arc;
          }
          // quadratic Bézier through a raised middle point: an arc, never through the table
          const a = (1 - k) * (1 - k),
            b = 2 * (1 - k) * k,
            d = k * k;
          c.group.position.set(a * p0.x + b * ctrl.x + d * pos.x, a * p0.y + b * ctrl.y + d * pos.y, a * p0.z + b * ctrl.z + d * pos.z);
          c.group.quaternion.slerpQuaternions(q0, quat, k);
        },
        { ease: e, delay },
      )
      .finally(() => c.busy--);
  }
  // Rest a card somewhere (and keep it there).
  function rest(c, pos, quat, yaw = 0) {
    c.rest = { pos: pos.clone(), quat: quat.clone(), yaw };
  }
  async function moveRest(c, pos, quat, opts = {}, yaw = 0) {
    c.rest = null;
    await move(c, { pos, quat, ...opts });
    rest(c, pos, quat, yaw);
  }

  // ── the stack ──
  const L = () => stage.layout;
  // Position of the i-th card from the top in a stack of n at (x, z).
  function stackPose(id, i, n, [x, z], yaw = 0) {
    const pos = new Vector3(x + jitter(id, "x") * 0.0016, (n - 1 - i) * CARD_T + CARD_T / 2 + 0.0005, z + jitter(id, "z") * 0.0016);
    return { pos, quat: flat(yaw + jitter(id, "r") * 0.014, false) };
  }
  function placeStack(order, at = L().deck, yaw = 0) {
    order.forEach((id, i) => {
      const c = get(id);
      const { pos, quat } = stackPose(id, i, order.length, at, yaw);
      c.group.position.copy(pos);
      c.group.quaternion.copy(quat);
      rest(c, pos, quat);
      c.where = "deck";
    });
  }
  async function moveStack(order, at, { ms = 700, stagger = 0, arc = 0.02 } = {}) {
    await Promise.all(
      order.map((id, i) => {
        const { pos, quat } = stackPose(id, i, order.length, at);
        return moveRest(get(id), pos, quat, { ms, arc, delay: (order.length - 1 - i) * stagger });
      }),
    );
  }

  // ── her hands, in the places she keeps them ──
  const restHands = (speed = 4) => {
    const tall = L().tall;
    hands.right.set({ pos: new Vector3(tall ? -0.36 : -0.46, 0.012, -1.08), yaw: 0.35, pitch: 0.05, roll: 0, pose: "relaxed", speed });
    hands.left.set({ pos: new Vector3(tall ? 0.36 : 0.46, 0.012, -1.1), yaw: -0.3, pitch: 0.05, roll: 0, pose: "relaxed", speed });
  };
  const withdrawHands = (speed = 3) => {
    hands.right.set({ pos: new Vector3(-0.5, 0.1, -1.75), yaw: 0.2, pitch: -0.2, pose: "relaxed", speed });
    hands.left.set({ pos: new Vector3(0.5, 0.1, -1.75), yaw: -0.2, pitch: -0.2, pose: "relaxed", speed });
  };
  const handNear = (x) => (x < 0 ? hands.right : hands.left);
  function pointAt(c, hand = handNear(c.group.position.x)) {
    const p = c.group.position;
    const from = new Vector3(p.x * 0.6, 0.07, p.z - 0.26);
    const yaw = Math.atan2(p.x - from.x, p.z - from.z);
    hand.set({ pos: from, yaw, pitch: 0.22, roll: 0, pose: "point", speed: 5 });
  }

  // ── PHASE 0: she slides the deck to the middle of the table ──
  async function presentDeck(order) {
    const far = [0, -0.9];
    placeStack(order, far);
    hands.right.set({ pos: new Vector3(-0.1, 0.03, -1.0), yaw: 0.6, pitch: 0.15, pose: "flat", speed: 5 });
    hands.left.set({ pos: new Vector3(0.1, 0.03, -1.0), yaw: -0.6, pitch: 0.15, pose: "flat", speed: 5 });
    await clock.wait(700);
    const top = get(order[0]);
    hands.right.follow(top.group, new Vector3(-0.05, 0.016, -CARD_H * 0.62), hands.right.orient(0.25, 0.12), "flat");
    hands.left.follow(top.group, new Vector3(0.05, 0.016, -CARD_H * 0.62), hands.left.orient(-0.25, 0.12), "flat");
    await moveStack(order, L().deck, { ms: 1300, arc: 0 });
    restHands();
  }

  // ── PHASE 1: a riffle shuffle that ends in exactly the new order ──
  async function shuffle(order) {
    const n = order.length;
    const [cx, cz] = L().deck;
    const gap = 0.12;
    // The cards fall onto the middle pile bottom first: from the bottom of the new order up.
    // Each is dealt from the left or right half, in short runs, like a real riffle.
    const drops = order.slice().reverse();
    const sideOf = new Map();
    let s = Math.random() < 0.5 ? 0 : 1,
      run = 0;
    drops.forEach((id) => {
      if (run <= 0) (s = 1 - s), (run = 1 + (Math.random() < 0.35 ? 1 : 0));
      sideOf.set(id, s);
      run--;
    });
    const piles = [drops.filter((id) => sideOf.get(id) === 0), drops.filter((id) => sideOf.get(id) === 1)]; // bottom → top
    hands.right.set({ pos: new Vector3(cx - gap - 0.13, 0.04, cz + 0.02), yaw: Math.PI / 2 - 0.2, pitch: 0.25, pose: "grip", speed: 7 });
    hands.left.set({ pos: new Vector3(cx + gap + 0.13, 0.04, cz + 0.02), yaw: -Math.PI / 2 + 0.2, pitch: 0.25, pose: "grip", speed: 7 });
    stage.sfx?.("slide");
    // split
    await Promise.all(
      piles.flatMap((pile, p) =>
        pile.map((id, k) => {
          const pos = new Vector3(cx + (p ? gap : -gap), k * CARD_T + CARD_T / 2 + 0.0005, cz + 0.01);
          return moveRest(get(id), pos, flat((p ? -1 : 1) * 0.18, false), { ms: 360, arc: 0.03, delay: k * 6 });
        }),
      ),
    );
    // bend the piles toward each other, then let the cards fall alternately
    await Promise.all(
      piles.flatMap((pile, p) =>
        pile.map((id) => {
          const c = get(id);
          const tilt = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), (p ? 1 : -1) * 0.22);
          return moveRest(c, c.rest.pos.clone().add(new Vector3(p ? -0.02 : 0.02, 0.012, 0)), tilt.multiply(c.rest.quat), { ms: 220 });
        }),
      ),
    );
    const step = reduce ? 18 : 34;
    await Promise.all(
      drops.map((id, k) => {
        const i = n - 1 - k; // its index from the top in the new order
        const { pos, quat } = stackPose(id, i, n, [cx, cz]);
        pos.y += 0.006;
        if (k % 2 === 0) clock.wait(k * step).then(() => stage.sfx?.("riffle"));
        return moveRest(get(id), pos, quat, { ms: 170, arc: 0.012, delay: k * step, ease: ease.in });
      }),
    );
    // square it up
    hands.right.set({ pos: new Vector3(cx - CARD_W * 0.6 - 0.04, 0.03, cz), yaw: Math.PI / 2, pitch: 0.1, pose: "flat", speed: 9 });
    hands.left.set({ pos: new Vector3(cx + CARD_W * 0.6 + 0.04, 0.03, cz), yaw: -Math.PI / 2, pitch: 0.1, pose: "flat", speed: 9 });
    await moveStack(order, [cx, cz], { ms: 260, arc: 0 });
    stage.sfx?.("tap");
    restHands();
  }

  // ── PHASE 2: the cut ──
  // Preview: the top n cards rise a little, so you can see where it will be cut.
  function cutPreview(order, n) {
    order.forEach((id, i) => get(id).liftTo.set(0, i < n ? 0.012 : 0, 0));
  }
  function cutDrag(order, n, dx, dz = 0) {
    order.forEach((id, i) => get(id).liftTo.set(i < n ? dx : 0, i < n ? 0.03 : 0, i < n ? dz : 0));
  }
  function clearLift(order) {
    order.forEach((id) => get(id).liftTo.set(0, 0, 0));
  }
  // Pile A (the top n) is set down beside; her hand puts pile B on top of it; the deck goes back
  // to the middle. `side` −1 / +1: where you dragged pile A.
  async function finishCut(order, n, side = -1) {
    const [cx, cz] = L().deck;
    const A = order.slice(0, n),
      B = order.slice(n);
    const aside = [cx + side * Math.abs(L().cutAside[0] - cx), L().cutAside[1]];
    // take the current lift into the resting position, so nothing jumps
    for (const id of order) {
      const c = get(id);
      if (c.rest) c.rest.pos.add(c.lift);
      c.lift.set(0, 0, 0);
      c.liftTo.set(0, 0, 0);
    }
    stage.sfx?.("slide");
    await moveStack(A, aside, { ms: 380, arc: 0.03 });
    stage.sfx?.("tap");
    // her hand lifts pile B onto pile A
    const hand = side < 0 ? hands.right : hands.left;
    const top = get(B[0]);
    hand.set({ pos: new Vector3(cx + 0.02 * side, 0.08, cz - 0.12), yaw: 0, pitch: 0.5, pose: "grip", speed: 8 });
    await clock.wait(420);
    hand.follow(top.group, new Vector3(0, 0.035, -CARD_H * 0.3), hand.orient(0, 0.65), "grip");
    const merged = [...B, ...A];
    await Promise.all(
      B.map((id, i) => {
        const { pos, quat } = stackPose(id, i, merged.length, aside);
        return moveRest(get(id), pos, quat, { ms: 620, arc: 0.06 });
      }),
    );
    stage.sfx?.("tap");
    hand.release();
    // and slides the whole deck back to the middle
    hand.set({ pos: new Vector3(aside[0] - side * 0.13, 0.03, aside[1]), yaw: -side * Math.PI / 2, pitch: 0.12, pose: "flat", speed: 8 });
    await clock.wait(300);
    hand.follow(get(merged[0]).group, new Vector3(side * (CARD_W * 0.5 + 0.07), 0.016, 0), hand.orient((-side * Math.PI) / 2, 0.12), "flat");
    stage.sfx?.("slide");
    await moveStack(merged, [cx, cz], { ms: 560, arc: 0 });
    hand.release();
    restHands();
    return merged;
  }

  // ── the guiding card: out from under the deck, up into the light, turned over ──
  const TILT = new Quaternion().setFromAxisAngle(new Vector3(1, 0.6, 0).normalize(), -0.07);
  const held = (dist = 0.52, down = 0.0) => {
    // a place in front of the camera, and the orientation that faces it (a little tilted)
    const cam = stage.camera;
    const fwd = new Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const upv = new Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const pos = cam.position.clone().addScaledVector(fwd, dist).addScaledVector(upv, -down);
    return { pos, quat: cam.quaternion.clone().multiply(TILT) };
  };
  // A hold distance so the card fills about `share` of the screen height.
  const holdDist = (share = 0.62) => CARD_H / (share * 2 * Math.tan(((stage.camera.fov / 2) * Math.PI) / 180));

  async function revealGuiding(id, remaining) {
    const c = get(id);
    const face = loadFace(id);
    const [cx, cz] = L().deck;
    const hand = hands.right;
    hand.set({ pos: new Vector3(cx - 0.2, 0.02, cz - 0.05), yaw: Math.PI / 2 - 0.3, pitch: 0.1, pose: "flat", speed: 6 });
    await clock.wait(500);
    hand.follow(c.group, new Vector3(-CARD_W * 0.5 - 0.06, 0.014, 0), hand.orient(Math.PI / 2, 0.1), "pinch");
    stage.sfx?.("slide");
    // slide out from the bottom, to the left and toward you
    const out = new Vector3(cx - 0.26, CARD_T / 2 + 0.0005, cz + 0.08);
    c.rest = null;
    await move(c, { pos: out, quat: flat(0.25, false), ms: 700, ease: ease.out });
    // the rest of the deck settles down by one card
    remaining.forEach((rid, i) => {
      const s = stackPose(rid, i, remaining.length, [cx, cz]);
      moveRest(get(rid), s.pos, s.quat, { ms: 300 });
    });
    // she lifts it, lets go, and it rises toward you
    await move(c, { pos: out.clone().add(new Vector3(0.06, 0.16, 0.02)), quat: flat(0.1, false).multiply(new Quaternion().setFromAxisAngle(X, -0.5)), ms: 500 });
    hand.release();
    restHands();
    await face;
    const h = heldFor(id, held(holdDist(0.55), 0.01));
    setHero(c, true);
    stage.readLight(true, h.pos.clone().add(new Vector3(0, 0.1, 0.25)));
    await move(c, { pos: h.pos, quat: h.quat.clone().multiply(Q_FLIP), ms: 950, arc: 0.04 });
    c.glowTo = 0.24;
    stage.sfx?.("flip");
    await turnOver(c, h, 1300);
    c.float = h;
    c.where = "guide";
  }
  // Turn a held card over around its vertical axis (a real rotation: the back goes away, the
  // face comes round).
  function turnOver(c, h, ms = 700) {
    c.busy++;
    return clock
      .tween(
        ms,
        (k) => {
          const a = Math.PI * (1 - k);
          c.group.quaternion.copy(h.quat).multiply(new Quaternion().setFromAxisAngle(Y, a));
          c.group.position.copy(h.pos);
          c.group.position.y += Math.sin(k * Math.PI) * 0.02;
        },
        { ease: ease.inOut },
      )
      .finally(() => c.busy--);
  }
  const guidePose = (id) => {
    const g = L().guide;
    const yaw = g.yaw + (id && isRev(id) ? Math.PI : 0);
    return { pos: new Vector3(g.at[0], CARD_T / 2 + 0.0005, g.at[1]), quat: flat(yaw, true), yaw };
  };
  async function placeGuide(id) {
    const c = get(id);
    const { pos, quat, yaw } = guidePose(id);
    const hand = handNear(pos.x);
    c.float = null;
    stage.readLight(false);
    c.glowTo = 0.14;
    const m = moveRest(c, pos, quat, { ms: 900, arc: 0.12 }, yaw);
    await clock.wait(380);
    setHero(c, false);
    hand.set({ pos: pos.clone().add(new Vector3(0.0, 0.05, -0.2)), yaw: 0, pitch: 0.3, pose: "relaxed", speed: 6 });
    await m;
    stage.sfx?.("place");
    pointAt(c, hand);
    await clock.wait(500);
    restHands();
  }

  // ── the fan: the remaining cards spread in an arc, face down ──
  // Slot i (left to right) holds the deck from the bottom up, each card a little above the last.
  function fanPoses(order) {
    const slots = L().fan(order.length);
    const ids = order.slice().reverse();
    return ids.map((id, i) => {
      const s = slots[i];
      return { id, pos: new Vector3(s.x, CARD_T / 2 + 0.0005 + s.y, s.z), quat: flat(s.yaw, false), yaw: s.yaw };
    });
  }
  async function fanOut(order) {
    const poses = fanPoses(order);
    const [cx, cz] = L().deck;
    hands.left.set({ pos: new Vector3(cx + 0.05, 0.03, cz - 0.3), yaw: -0.8, pitch: 0.12, pose: "flat", speed: 6 });
    // gather the deck at the start of the arc, then sweep it open
    const start = poses[0];
    await Promise.all(
      order.map((id, i) => {
        const s = stackPose(id, i, order.length, [start.pos.x, start.pos.z], start.yaw);
        return moveRest(get(id), s.pos, s.quat, { ms: 600, arc: 0.03 });
      }),
    );
    stage.sfx?.("spread");
    const lead = get(poses[poses.length - 1].id);
    hands.left.follow(lead.group, new Vector3(0.02, 0.022, -CARD_H * 0.42), hands.left.orient(-0.2, 0.2), "flat");
    const step = 1100 / poses.length;
    await Promise.all(poses.map((p, i) => moveRest(get(p.id), p.pos, p.quat, { ms: 300 + i * step * 0.6, ease: ease.out, delay: i * step * 0.25 }, p.yaw)));
    order.forEach((id) => (get(id).where = "fan"));
    hands.left.release();
    restHands();
  }
  // Snap the fan to its slots (after a resize or a restore).
  function layFan(order) {
    for (const p of fanPoses(order)) {
      const c = get(p.id);
      c.where = "fan";
      if (c.busy) continue;
      c.group.position.copy(p.pos);
      c.group.quaternion.copy(p.quat);
      rest(c, p.pos, p.quat, p.yaw);
    }
  }

  // ── a pick: it rises, comes to you, turns over, waits, then goes to its place in the cross ──
  async function revealPick(id) {
    const c = get(id);
    const face = loadFace(id);
    c.hoverTo = 0;
    c.rest = null;
    stage.sfx?.("lift");
    const p = c.group.position.clone();
    await move(c, { pos: p.clone().add(new Vector3(0, 0.12, 0.06)), quat: c.group.quaternion.clone().premultiply(new Quaternion().setFromAxisAngle(X, -0.4)), ms: reduce ? 250 : 420, ease: ease.out });
    const h = heldFor(id, held(holdDist(0.6), 0.0));
    setHero(c, true);
    stage.readLight(true, h.pos.clone().add(new Vector3(0, 0.12, 0.25)));
    await Promise.all([move(c, { pos: h.pos, quat: h.quat.clone().multiply(Q_FLIP), ms: reduce ? 400 : 700, arc: 0.05 }), face]);
    stage.sfx?.("flip");
    c.glowTo = 0.24;
    await turnOver(c, h, reduce ? 450 : 680);
    c.float = h;
    c.where = "held";
    return h;
  }
  const slotPose = (position, id) => {
    const [x, z] = L().cross[position];
    const yaw = (Math.random() - 0.5) * 0.06 + (id && isRev(id) ? Math.PI : 0);
    return { pos: new Vector3(x, CARD_T / 2 + 0.0005, z), quat: flat(yaw, true), yaw };
  };
  async function placePick(id, position) {
    const c = get(id);
    const { pos, quat, yaw } = slotPose(position, id);
    const hand = handNear(pos.x === 0 ? (position === "shadow" ? 0.1 : -0.1) : pos.x);
    c.float = null;
    stage.readLight(false);
    c.glowTo = 0.12;
    const m = moveRest(c, pos, quat, { ms: reduce ? 500 : 820, arc: 0.1, ease: ease.inOut }, yaw);
    await clock.wait(reduce ? 120 : 300);
    setHero(c, false);
    // her hand meets it as it lands, settles it, and withdraws a little
    hand.set({ pos: pos.clone().add(new Vector3(-Math.sign(pos.x || 0.01) * 0.02, 0.05, -CARD_H * 0.62)), yaw: 0, pitch: 0.35, pose: "relaxed", speed: 7 });
    await m;
    stage.sfx?.("place");
    stage.cameraFx("nudge");
    hand.set({ pos: pos.clone().add(new Vector3(0, 0.015, -CARD_H * 0.55)), yaw: 0, pitch: 0.2, pose: "flat", speed: 9 });
    await clock.wait(240);
    c.where = position;
  }

  // ── inspection: any revealed card comes close, then goes back ──
  let inspecting = null;
  async function inspect(id) {
    const c = get(id);
    if (inspecting || c.busy || !c.rest) return false;
    inspecting = { c, back: { ...c.rest } };
    c.rest = null;
    const h = heldFor(id, held(holdDist(0.7), 0.0));
    setHero(c, true);
    stage.readLight(true, h.pos.clone().add(new Vector3(0, 0.12, 0.25)));
    c.glowTo = 0.24;
    stage.sfx?.("lift");
    await move(c, { pos: h.pos, quat: h.quat, ms: reduce ? 300 : 560, arc: 0.04, ease: ease.out });
    c.float = h;
    return true;
  }
  async function uninspect() {
    if (!inspecting) return;
    const { c, back } = inspecting;
    inspecting = null;
    c.float = null;
    stage.readLight(false);
    c.glowTo = 0.12;
    const m = moveRest(c, back.pos, back.quat, { ms: reduce ? 300 : 520, arc: 0.06 }, back.yaw);
    await clock.wait(200);
    setHero(c, false);
    await m;
    stage.sfx?.("place");
  }

  // ── restart: everything back into one face-down stack in the middle ──
  async function gather(order) {
    hands.right.set({ pos: new Vector3(-0.25, 0.03, -0.3), yaw: 0.6, pitch: 0.12, pose: "flat", speed: 6 });
    hands.left.set({ pos: new Vector3(0.25, 0.03, -0.3), yaw: -0.6, pitch: 0.12, pose: "flat", speed: 6 });
    stage.sfx?.("spread");
    await Promise.all(
      order.map((id, i) => {
        const c = get(id);
        c.glowTo = 0.06;
        c.hoverTo = 0;
        c.float = null;
        const s = stackPose(id, i, order.length, L().deck);
        return moveRest(c, s.pos, s.quat, { ms: 800, arc: 0.08, delay: i * 25 });
      }),
    );
    order.forEach((id) => (get(id).where = "deck"));
    restHands();
  }

  // Put everything where a saved ritual says it is, without animation.
  function restore(r) {
    const all = [...ids];
    all.forEach((id) => (get(id).rest = null));
    if (!r.guiding) return placeStack(r.deck);
    const g = get(r.guiding);
    const gp = guidePose(r.guiding);
    loadFace(r.guiding);
    g.group.position.copy(gp.pos);
    g.group.quaternion.copy(gp.quat);
    rest(g, gp.pos, gp.quat, gp.yaw);
    g.where = "guide";
    g.glowTo = 0.12;
    r.picks.forEach((p) => {
      const c = get(p.id);
      const s = slotPose(p.position, p.id);
      loadFace(p.id);
      c.group.position.copy(s.pos);
      c.group.quaternion.copy(s.quat);
      rest(c, s.pos, s.quat, s.yaw);
      c.where = p.position;
      c.glowTo = 0.12;
    });
    layFan(r.deck);
  }
  // Keep things in their places when the screen changes shape.
  function relayout(r) {
    if (!r) return;
    if (!r.guiding) return placeStack(r.deck);
    const g = get(r.guiding);
    if (g.rest && g.where === "guide") {
      const gp = guidePose(r.guiding);
      rest(g, gp.pos, gp.quat, gp.yaw);
    }
    r.picks.forEach((p) => {
      const c = get(p.id);
      if (c.rest && c.where === p.position) {
        const s = slotPose(p.position, p.id);
        rest(c, s.pos, s.quat, c.rest.yaw);
      }
    });
    if (r.deck.every((id) => get(id).where === "fan")) layFan(r.deck);
  }

  return {
    cards,
    get,
    backReady,
    loadFace,
    placeStack,
    presentDeck,
    shuffle,
    cutPreview,
    cutDrag,
    clearLift,
    finishCut,
    revealGuiding,
    placeGuide,
    fanOut,
    layFan,
    revealPick,
    placePick,
    inspect,
    uninspect,
    get inspecting() {
      return inspecting?.c.id || null;
    },
    gather,
    restore,
    relayout,
    restHands,
    withdrawHands,
    pointAt: (id) => pointAt(get(id)),
    setReversed(fn) {
      isRev = fn;
    },
    highlight(idsOn, level = 0.42, others = 0.03) {
      for (const c of cards.values()) if (c.where !== "deck" && c.where !== "fan") c.glowTo = idsOn.includes(c.id) ? level : others;
    },
    unhighlight() {
      for (const c of cards.values()) if (c.where !== "deck" && c.where !== "fan") c.glowTo = 0.12;
    },
    // the objects to test the pointer against
    meshes: (filter) => [...cards.values()].filter(filter).map((c) => c.group),
    stackTopY: (n) => n * CARD_T,
    dispose() {
      off();
      face.dispose();
      edgeGeo.dispose();
      for (const c of cards.values()) {
        c.frontMat.map?.dispose();
        c.frontMat.dispose();
        stage.scene.remove(c.group);
      }
      backMat.map?.dispose();
      backMat.dispose();
      edgeMat.dispose();
    },
  };
}
