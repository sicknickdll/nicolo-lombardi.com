// The fortune teller's eyes: the only part of her you normally see. Two glowing almonds with
// slit pupils, drawn on a small canvas every frame and shown with additive blending, so black
// (the pupils, the lids) is simply the dark of the room.
//
// States (setState): idle, watching, curious, suspicious, amused, serious, dramatic, soft, dim,
// disappear. Blinks come at irregular intervals (sometimes twice), the gaze wanders in small
// saccades unless she is serious, and lookAt() points the pupils at something on screen.
import { Mesh, PlaneGeometry, MeshBasicMaterial, CanvasTexture, AdditiveBlending, SRGBColorSpace, Group } from "../vendor/three.js";
import { approach, clamp } from "./tween.js";
import { glowTexture } from "./textures.js";

const STATES = {
  idle: { open: 0.82, narrow: 0.12, glow: 0.8, asym: 0, dilate: 0.5, warm: 0 },
  watching: { open: 0.92, narrow: 0.06, glow: 0.85, asym: 0, dilate: 0.55, warm: 0 },
  curious: { open: 1.12, narrow: 0, glow: 0.95, asym: 0, dilate: 0.8, warm: 0 },
  suspicious: { open: 0.42, narrow: 0.5, glow: 0.75, asym: 0.08, dilate: 0.3, warm: 0 },
  amused: { open: 0.68, narrow: 0.38, glow: 0.9, asym: 0.32, dilate: 0.55, warm: 0.2 },
  serious: { open: 0.84, narrow: 0.16, glow: 0.8, asym: 0, dilate: 0.25, warm: 0, still: true },
  dramatic: { open: 1.2, narrow: 0, glow: 1.6, asym: 0, dilate: 0.2, warm: 0.1 },
  soft: { open: 0.66, narrow: 0.3, glow: 0.72, asym: 0.04, dilate: 0.75, warm: 0.6 },
  dim: { open: 0.7, narrow: 0.2, glow: 0.28, asym: 0, dilate: 0.9, warm: 0 },
  disappear: { open: 0.3, narrow: 0.2, glow: 0, asym: 0, dilate: 0.5, warm: 0 },
};
const W = 256,
  H = 96;

export function createEyes({ reduce = false } = {}) {
  const cvs = document.createElement("canvas");
  cvs.width = W;
  cvs.height = H;
  const g = cvs.getContext("2d");
  const map = new CanvasTexture(cvs);
  map.colorSpace = SRGBColorSpace;
  const mat = new MeshBasicMaterial({ map, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false });
  const plane = new Mesh(new PlaneGeometry(0.34, (0.34 * H) / W), mat);
  const halo = new Mesh(
    new PlaneGeometry(0.75, 0.42),
    new MeshBasicMaterial({ map: glowTexture("rgba(210,120,60,0.55)"), transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false, opacity: 0.25 }),
  );
  halo.position.z = -0.01;
  const group = new Group();
  group.add(halo, plane);

  const cur = { ...STATES.idle, alpha: 0 };
  let target = STATES.idle,
    state = "idle",
    alphaTo = 0,
    blink = 0, // 0 open … 1 shut
    blinkT = -1,
    nextBlink = 2,
    gaze = { x: 0, y: 0 },
    gazeTo = { x: 0, y: 0 },
    look = null,
    saccade = { x: 0, y: 0 },
    nextSaccade = 1.5,
    stateTimer = 0,
    revert = null,
    time = 0,
    flicker = 0;

  function setState(name, { hold = 0, then = null } = {}) {
    if (!STATES[name]) return;
    state = name;
    target = STATES[name];
    alphaTo = name === "disappear" ? 0 : 1;
    stateTimer = hold;
    revert = then;
    if (name === "dramatic" && !hold) (stateTimer = 1.6), (revert = "watching");
    if (name === "serious") nextBlink = Math.max(nextBlink, 3.5); // she stops blinking for a moment
  }

  function drawEye(cx, cy, w, h, p, side) {
    const open = clamp(p.open * (1 - blink), 0, 1.3);
    if (open < 0.03 || p.glow < 0.01) return;
    const lowNarrow = p.narrow + (side < 0 ? p.asym : -p.asym * 0.3);
    const top = h * open,
      bottom = h * open * clamp(1 - lowNarrow, 0.12, 1);
    const tilt = side * 0.06; // outer corners slightly up: uncanny
    g.save();
    g.translate(cx, cy);
    g.rotate(tilt);
    const almond = () => {
      g.beginPath();
      g.moveTo(-w / 2, 0);
      g.bezierCurveTo(-w * 0.25, -top * 1.25, w * 0.25, -top * 1.25, w / 2, 0);
      g.bezierCurveTo(w * 0.25, bottom * 1.1, -w * 0.25, bottom * 1.1, -w / 2, 0);
      g.closePath();
    };
    const glow = p.glow * cur.alpha * (1 - flicker * 0.5);
    // outer glow
    g.shadowColor = `rgba(255,${170 + p.warm * 30},${90 - p.warm * 30},${0.9 * Math.min(1, glow)})`;
    g.shadowBlur = 14 + glow * 10;
    almond();
    g.fillStyle = `rgba(${Math.round(150 * glow)},${Math.round(80 * glow)},${Math.round(40 * glow)},1)`;
    g.fill();
    g.shadowBlur = 0;
    g.clip();
    // the eye: pale gold, brighter at the centre
    const bright = Math.min(1, glow);
    const sclera = g.createRadialGradient(0, 0, 1, 0, 0, w * 0.55);
    sclera.addColorStop(0, `rgba(255,${238 - p.warm * 20},${190 - p.warm * 60},${bright})`);
    sclera.addColorStop(0.6, `rgba(230,${160 - p.warm * 10},${80},${bright * 0.85})`);
    sclera.addColorStop(1, `rgba(120,40,20,${bright * 0.6})`);
    g.fillStyle = sclera;
    g.fillRect(-w / 2, -h * 1.5, w, h * 3);
    // iris and slit pupil
    const ix = gaze.x * w * 0.24,
      iy = gaze.y * h * 0.35;
    const ir = h * 0.62;
    const iris = g.createRadialGradient(ix, iy, ir * 0.2, ix, iy, ir);
    iris.addColorStop(0, `rgba(255,${200 + p.warm * 30},90,${bright})`);
    iris.addColorStop(0.75, `rgba(214,120,40,${bright})`);
    iris.addColorStop(1, `rgba(60,10,6,${bright})`);
    g.fillStyle = iris;
    g.beginPath();
    g.arc(ix, iy, ir, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#000";
    g.beginPath();
    g.ellipse(ix, iy, ir * (0.12 + p.dilate * 0.22), ir * 0.86, 0, 0, Math.PI * 2);
    g.fill();
    // lids: a soft dark rim along the top
    const lid = g.createLinearGradient(0, -top * 1.1, 0, -top * 0.2);
    lid.addColorStop(0, "rgba(0,0,0,0.85)");
    lid.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = lid;
    g.fillRect(-w / 2, -h * 1.5, w, h * 1.5);
    g.restore();
  }

  function update(dt, cameraPos) {
    time += dt;
    // state timers
    if (stateTimer > 0) {
      stateTimer -= dt;
      if (stateTimer <= 0 && revert) setState(revert);
    }
    for (const k of ["open", "narrow", "glow", "asym", "dilate", "warm"]) cur[k] = approach(cur[k], target[k], k === "glow" ? 3 : 7, dt);
    cur.alpha = approach(cur.alpha, alphaTo, alphaTo > cur.alpha ? 0.9 : 2.2, dt);
    // blinking: irregular, sometimes twice
    nextBlink -= dt;
    if (blinkT < 0 && nextBlink <= 0 && cur.alpha > 0.2) {
      blinkT = 0;
      nextBlink = (target.still ? 5 : 2.2) + Math.random() * 5;
      if (Math.random() < 0.18) nextBlink = 0.28;
    }
    if (blinkT >= 0) {
      blinkT += dt;
      const t = blinkT;
      blink = t < 0.07 ? t / 0.07 : t < 0.12 ? 1 : t < 0.24 ? 1 - (t - 0.12) / 0.12 : 0;
      if (t >= 0.24) blinkT = -1;
    }
    // gaze: where she is looking, plus small saccades
    nextSaccade -= dt;
    if (nextSaccade <= 0) {
      nextSaccade = 0.8 + Math.random() * 2.4;
      saccade = target.still || reduce ? { x: 0, y: 0 } : { x: (Math.random() - 0.5) * 0.35, y: (Math.random() - 0.5) * 0.25 };
    }
    gazeTo.x = clamp((look ? look.x : 0) + saccade.x, -1, 1);
    gazeTo.y = clamp((look ? look.y : 0) + saccade.y, -1, 1);
    const snap = target.still ? 4 : 14; // saccades are quick
    gaze.x = approach(gaze.x, gazeTo.x, snap, dt);
    gaze.y = approach(gaze.y, gazeTo.y, snap, dt);
    flicker = state === "dim" ? Math.max(0, Math.sin(time * 13) * Math.sin(time * 5.3)) : 0;

    g.clearRect(0, 0, W, H);
    drawEye(W * 0.29, H * 0.5, 74, 20, cur, -1);
    drawEye(W * 0.71, H * 0.5, 74, 20, cur, 1);
    map.needsUpdate = true;
    halo.material.opacity = 0.22 * cur.glow * cur.alpha;
    if (cameraPos) group.lookAt(cameraPos);
  }

  return {
    group,
    setState,
    get state() {
      return state;
    },
    // x, y in -1..1: -1 left / down, from her point of view mirrored to the screen
    lookAt(p) {
      look = p;
    },
    update,
    dispose() {
      map.dispose();
      mat.dispose();
      plane.geometry.dispose();
      halo.geometry.dispose();
      halo.material.map.dispose();
      halo.material.dispose();
    },
  };
}
