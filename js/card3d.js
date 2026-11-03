// Archive viewer: one scanned item as a 3D card.
//   · Move over it and it tilts toward the cursor, with a soft glare under it (after React
//     Bits' Holo Card, without the rainbow foil).
//   · Drag (or two-finger scroll) to turn it over and see the back. When you let go it settles
//     face-on, front or back, with a little momentum. The F key flips it too.
//   · Click a napkin and it folds in half; click again and it opens. A sachet squeezes instead.
//   · Swipe across it from one side to the other, starting at the edge (or just outside it), and
//     it is cut along your line. Both halves fall away; a few seconds later it fades back in whole.
// The scans are transparent cut-outs drawn on thin planes, so the card has the shape of the real
// napkin or sachet. Each face is drawn twice, once per half of the cut (the halves share one
// shader that discards the other side of the cut line). Three.js comes from js/vendor/three.js.
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Group,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  TextureLoader,
  Vector2,
  Vector3,
  Matrix4,
  Raycaster,
} from "./vendor/three.js";

const SIZE = 1.5; // longest side of the card, in world units
const THICK = 0.012; // gap between the two faces
const FOLD_S = 0.95; // seconds to fold
const FALL_S = 3.3; // seconds the halves take to fall and come back
const FADE_S = 0.9; // fade-in when it comes back

const VERT = `
uniform float uBulge;
uniform float uFold;   // 0 flat … 1 folded in half
uniform float uSide;   // +1 on the front face of the card, -1 on the back face
varying vec2 vUv;
varying vec3 vNormal;
varying vec2 vLocal;   // position on the card as seen from the front, for the cut line
void main() {
  vUv = uv;
  vec3 p = position;
  vec3 n = normal;
  // Paper bulge: a sachet swells in the middle, a napkin barely does.
  vec2 c = uv * 2.0 - 1.0;
  p.z += uBulge * (1.0 - c.x * c.x) * (1.0 - c.y * c.y);
  vLocal = vec2(position.x * uSide, position.y);
  // Fold: the top half swings forward about the middle line and lands on the bottom half.
  if (p.y > 0.0) {
    float a = uFold * 3.14159265 * uSide;
    float cs = cos(a), sn = sin(a);
    float y = p.y, z = p.z;
    p.y = y * cs - z * sn;
    p.z = y * sn + z * cs + 0.02 * uFold * uSide;
    n = vec3(n.x, n.y * cs - n.z * sn, n.y * sn + n.z * cs);
  }
  vNormal = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

// The printed scan, a soft glare under the cursor, and the cut: this half keeps one side of the line.
const FRAG = `
precision highp float;
uniform sampler2D uMap;
uniform vec2 uPointer;   // cursor in card coordinates (-1…1)
uniform float uHolo;     // 0 at rest, 1 while hovered
uniform vec2 uCut;       // cut line: y = uCut.x * x + uCut.y
uniform float uKeep;     // +1 keeps what is above the line, -1 what is below
uniform float uAlpha;
varying vec2 vUv;
varying vec3 vNormal;
varying vec2 vLocal;
void main() {
  vec4 tex = texture2D(uMap, vUv);
  if (tex.a < 0.02) discard;
  if ((vLocal.y - (uCut.x * vLocal.x + uCut.y)) * uKeep < 0.0) discard;
  vec2 c = vUv * 2.0 - 1.0;
  vec3 col = tex.rgb;
  float d = distance(c, uPointer);
  col += vec3(1.0) * exp(-d * d * 3.2) * 0.34 * uHolo;
  // Light from above-left, so a face darkens a little as it turns away (and inside a fold).
  float shade = 0.9 + 0.1 * clamp(dot(normalize(vNormal), normalize(vec3(-0.3, 0.5, 0.8))), 0.0, 1.0);
  col *= shade;
  gl_FragColor = linearToOutputTexel(vec4(col, tex.a * uAlpha));
}`;

const loader = new TextureLoader();
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function mountCard(stage) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  stage.prepend(canvas);
  const slice = document.createElement("i"); // the line that follows a swipe
  slice.className = "arch-slice";
  stage.append(slice);
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 20);
  const pivot = new Group(); // turn, tilt, entry
  const body = new Group(); // fold and squeeze
  pivot.add(body);
  scene.add(pivot);

  // Two halves, each with a front and a back face. Uncut, they sit together and look like one.
  const halves = [1, -1].map((keep) => ({ keep, group: new Group(), meshes: [], p: { x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0 } }));
  halves.forEach((h) => body.add(h.group));
  let geos = [],
    token = 0,
    card = { w: 1, h: 1, fold: false };
  const turn = { yaw: 0, pitch: 0, vy: 0, vp: 0, rest: 0 };
  const fold = { t: 0, to: 0 }, // 0…1, eased in the shader
    pulse = { x: 0, v: 0 }; // sachet squeeze
  let fall = -1; // seconds since the cut, -1 when whole
  const pointer = new Vector2(0, 0);
  let drag = null,
    hovering = false,
    hover = 0,
    wheelUntil = 0,
    entry = 1; // 1 → 0: the card drops in when an item opens

  const resize = () => {
    const w = stage.clientWidth,
      h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Fit the card (and room to turn it) in portrait and landscape.
    const dist = 0.95 / Math.tan((camera.fov * Math.PI) / 360) / Math.min(1, camera.aspect * 1.05);
    camera.position.set(0, 0, dist);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  const makeMaterial = (geoBulge, side, keep) =>
    new ShaderMaterial({
      uniforms: {
        uMap: { value: null },
        uBulge: { value: geoBulge },
        uFold: { value: 0 },
        uSide: { value: side },
        uPointer: { value: new Vector2() },
        uHolo: { value: 0 },
        uCut: { value: new Vector2() },
        uKeep: { value: keep },
        uAlpha: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
    });
  const eachMaterial = (fn) => halves.forEach((h) => h.meshes.forEach((m) => fn(m.material.uniforms, m)));

  function clear() {
    for (const h of halves) {
      for (const m of h.meshes) (h.group.remove(m), m.material.uniforms.uMap.value?.dispose(), m.material.dispose());
      h.meshes = [];
    }
    for (const g of geos) g.dispose();
    geos = [];
  }
  // Show another item.
  function setItem(next) {
    const mine = ++token;
    clear();
    turn.yaw = turn.rest = turn.pitch = turn.vy = turn.vp = 0;
    fold.t = fold.to = 0;
    fall = -1;
    halves.forEach((h) => Object.assign(h.p, { x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0 }));
    const [w, h] = next.ratio >= 1 ? [SIZE, SIZE / next.ratio] : [SIZE * next.ratio, SIZE];
    card = { w, h, fold: /napkin/i.test(next.type) };
    const geoFront = new PlaneGeometry(w, h, 24, 24),
      geoBack = new PlaneGeometry(w, h, 24, 24);
    geos = [geoFront, geoBack];
    for (const half of halves) {
      const front = new Mesh(geoFront, makeMaterial(next.bulge, 1, half.keep)),
        back = new Mesh(geoBack, makeMaterial(next.bulge, -1, half.keep));
      front.position.z = THICK;
      back.position.z = -THICK;
      back.rotation.y = Math.PI; // its front faces away, so from behind the back scan reads the right way round
      half.group.add(front, back);
      half.meshes = [front, back];
    }
    stage.classList.remove("ready");
    let loaded = 0;
    [next.front, next.back].forEach((url, i) => {
      loader.load(url, (tex) => {
        if (mine !== token) return tex.dispose();
        tex.colorSpace = "srgb";
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        for (const half of halves) half.meshes[i].material.uniforms.uMap.value = tex;
        if (++loaded === 2) {
          stage.classList.add("ready");
          entry = 1;
        }
      });
    });
  }

  // ── pointer ──
  const ray = new Raycaster(),
    inv = new Matrix4(),
    ndc = new Vector2();
  // Where a pointer event lands on the card's plane, in card units (null if it misses the plane).
  const onCard = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    pivot.updateMatrixWorld(true);
    inv.copy(body.matrixWorld).invert();
    const o = ray.ray.origin.clone().applyMatrix4(inv),
      d = ray.ray.direction.clone().transformDirection(inv);
    if (Math.abs(d.z) < 1e-4) return null;
    const t = -o.z / d.z;
    return t > 0 ? new Vector3().copy(o).addScaledVector(d, t) : null;
  };
  const calm = () => Math.abs(turn.yaw - turn.rest) < 0.35 && Math.abs(turn.pitch) < 0.35 && Math.round(turn.rest / Math.PI) % 2 === 0;
  const showSlice = (a, b) => {
    const r = stage.getBoundingClientRect();
    const x0 = a.x - r.left,
      y0 = a.y - r.top;
    slice.style.cssText = `left:${x0}px;top:${y0}px;width:${Math.hypot(b.x - a.x, b.y - a.y)}px;transform:rotate(${Math.atan2(b.y - a.y, b.x - a.x)}rad)`;
  };
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.mode === "slice") {
      showSlice({ x: drag.x, y: drag.y }, { x: e.clientX, y: e.clientY });
      return;
    }
    const now = performance.now(),
      dt = Math.max(0.004, (now - drag.t) / 1000);
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) drag.moved = true;
    const yaw = drag.yaw + (e.clientX - drag.x) * 0.011,
      pitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.007, -0.9, 0.9);
    turn.vy = clamp(((yaw - turn.yaw) / dt) * 0.4 + turn.vy * 0.6, -25, 25);
    turn.vp = clamp(((pitch - turn.pitch) / dt) * 0.4 + turn.vp * 0.6, -25, 25);
    turn.yaw = yaw;
    turn.pitch = pitch;
    drag.t = now;
  };
  const onDown = (e) => {
    if (drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    stage.setPointerCapture?.(e.pointerId);
    const at = onCard(e);
    // A swipe that starts at either edge of a whole, face-up card (or just outside it) is a cut.
    const edge = at && fall < 0 && fold.to === 0 && calm() && Math.abs(at.x) > card.w * 0.32 && Math.abs(at.y) < card.h / 2 + 0.15;
    drag = { id: e.pointerId, mode: edge ? "slice" : "turn", x: e.clientX, y: e.clientY, at, yaw: turn.yaw, pitch: turn.pitch, t: performance.now(), moved: false };
    if (edge) (slice.classList.remove("go"), showSlice({ x: e.clientX, y: e.clientY }, { x: e.clientX, y: e.clientY }), slice.classList.add("on"));
    else stage.classList.add("grabbing");
  };
  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    stage.classList.remove("grabbing");
    stage.releasePointerCapture?.(e.pointerId);
    if (d.mode === "slice") {
      const end = e.type === "pointerup" ? onCard(e) : null;
      const crossed = end && d.at && Math.sign(end.x) === -Math.sign(d.at.x) && Math.abs(end.x) > card.w * 0.32;
      const dx = crossed ? end.x - d.at.x : 0;
      const a = crossed ? clamp((end.y - d.at.y) / dx, -0.7, 0.7) : 0,
        b = crossed ? d.at.y - ((end.y - d.at.y) / dx) * d.at.x : 0;
      if (crossed && Math.abs(b) < card.h / 2) (slice.classList.add("go"), cut(a, b));
      slice.classList.remove("on");
      return;
    }
    if (!d.moved && performance.now() - d.t < 450 && e.type === "pointerup") return click();
    // Settle face-on, on the side it is closest to (a flick carries it further).
    turn.rest = Math.round((turn.yaw + turn.vy * 0.12) / Math.PI) * Math.PI;
  };
  const onWheel = (e) => {
    if (e.ctrlKey) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : 1;
    turn.yaw -= e.deltaX * unit * 0.008;
    turn.pitch = clamp(turn.pitch - e.deltaY * unit * 0.005, -0.9, 0.9);
    turn.vy = turn.vp = 0;
    wheelUntil = performance.now() + 220;
    turn.rest = Math.round(turn.yaw / Math.PI) * Math.PI;
  };
  const flip = () => {
    turn.rest = Math.round(turn.yaw / Math.PI) * Math.PI + Math.PI;
  };

  // ── reactions ──
  function click() {
    if (fall >= 0) return;
    if (card.fold) fold.to = 1 - fold.to;
    else pulse.v += 9;
  }
  // Both halves fly off the cut line, tumble and fall; later they return, fading in.
  function cut(a, b) {
    eachMaterial((u) => u.uCut.value.set(a, b));
    fall = 0;
    const [top, bottom] = halves;
    Object.assign(top.p, { x: 0, y: 0, r: 0, vx: -0.5 + Math.random() * 0.4, vy: 1.7, vr: -1.1 - Math.random() });
    Object.assign(bottom.p, { x: 0, y: 0, r: 0, vx: 0.5 - Math.random() * 0.4, vy: -0.2, vr: 1 + Math.random() });
  }

  addEventListener("pointermove", onMove, { passive: true });
  addEventListener("pointerup", onUp);
  addEventListener("pointercancel", onUp);
  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointerenter", () => (hovering = true));
  stage.addEventListener("pointerleave", () => ((hovering = false), pointer.set(0, 0)));
  stage.addEventListener("wheel", onWheel, { passive: false });

  // ── animation ──
  let raf = 0,
    last = performance.now(),
    time = 0,
    back = 1, // fade-in progress after the cut
    visible = true;
  const tilt = new Vector2();
  const step = (now) => {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    time += dt;
    const held = drag?.mode === "turn" || now < wheelUntil;
    // Turning: spring toward the face-on position it should rest in.
    if (!held) {
      turn.vy += ((turn.rest - turn.yaw) * 70 - turn.vy * 10.5) * dt;
      turn.vp += ((0 - turn.pitch) * 60 - turn.vp * 10) * dt;
      turn.yaw += turn.vy * dt;
      turn.pitch += turn.vp * dt;
    }
    // Hover tilt toward the cursor (only while the card is face-on and not being turned).
    const faceOn = !held && Math.abs(turn.yaw - turn.rest) < 0.6;
    const want = faceOn && hovering && drag?.mode !== "slice" ? pointer : { x: 0, y: 0 };
    tilt.x += (want.x - tilt.x) * (1 - Math.exp(-dt * 9));
    tilt.y += (want.y - tilt.y) * (1 - Math.exp(-dt * 9));
    hover += ((hovering ? 1 : 0) - hover) * (1 - Math.exp(-dt * 6));
    entry = Math.max(0, entry - dt * 2.4);
    const ease = 1 - Math.pow(1 - (1 - entry), 3);

    // Fold, squeeze.
    fold.t = clamp(fold.t + Math.sign(fold.to - fold.t) * (dt / FOLD_S), 0, 1);
    const f = easeInOut(fold.t);
    pulse.v += (-pulse.x * 220 - pulse.v * 12) * dt;
    pulse.x += pulse.v * dt;
    body.position.y = f * card.h * 0.25; // a folded card is half as tall: keep it centred
    body.scale.set(1 + pulse.x * 0.05, 1 - pulse.x * 0.05, 1);

    // The cut: pieces fall under gravity, then everything comes back whole.
    let alpha = 1;
    if (fall >= 0) {
      fall += dt;
      for (const h of halves) {
        h.p.vy -= 7 * dt;
        h.p.x += h.p.vx * dt;
        h.p.y += h.p.vy * dt;
        h.p.r += h.p.vr * dt;
        h.group.position.set(h.p.x, h.p.y, 0);
        h.group.rotation.z = h.p.r;
      }
      if (fall > FALL_S) {
        fall = -1;
        eachMaterial((u) => (u.uCut.value.set(0, 0), (u.uAlpha.value = 0)));
        for (const h of halves) (h.group.position.set(0, 0, 0), (h.group.rotation.z = 0));
        back = 0;
      }
    }
    if (fall < 0 && back < 1) {
      back = Math.min(1, back + dt / FADE_S);
      alpha = back;
    }
    pivot.rotation.set(turn.pitch - tilt.y * 0.32 + Math.sin(f * Math.PI) * 0.35, turn.yaw + tilt.x * 0.36, 0);
    pivot.position.y = (reduce ? 0 : Math.sin(time * 1.3) * 0.015) + (1 - ease) * 0.5;
    pivot.scale.setScalar(0.9 + 0.1 * ease);
    // Which side faces us decides which glare to show.
    const showBack = Math.cos(pivot.rotation.y) < 0;
    for (const h of halves)
      h.meshes.forEach((m, i) => {
        const u = m.material.uniforms;
        u.uHolo.value = fall < 0 ? hover * (faceOn ? 1 : 0.6) : 0;
        u.uPointer.value.set(pointer.x * (i ? -1 : 1) * (showBack === (i === 1) ? 1 : 0), pointer.y);
        u.uFold.value = f;
        if (fall < 0 && back <= 1) u.uAlpha.value = alpha;
      });
    renderer.render(scene, camera);
    raf = requestAnimationFrame(step);
  };
  const start = () => {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
  };
  const io = new IntersectionObserver(([entry_]) => {
    visible = entry_.isIntersecting;
    if (visible) start();
  });
  io.observe(stage);
  start();

  return {
    setItem,
    flip,
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      removeEventListener("pointercancel", onUp);
      stage.removeEventListener("wheel", onWheel);
      clear();
      slice.remove();
      renderer.dispose();
      canvas.remove();
    },
  };
}
