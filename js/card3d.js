// Archive viewer: one scanned item as a 3D card.
//   · Move over it and it tilts toward the cursor; a holographic sheen and a glare follow
//     (the effect of React Bits' Holo Card).
//   · Drag (or two-finger scroll) to turn it over and see the back. When you let go it settles
//     face-on, front or back, with a little momentum. Double-click, or the Flip button, turns it.
// The scans are transparent cut-outs, drawn on two thin planes (front and back), so the card
// has exactly the shape of the real napkin or sachet. Three.js comes from js/vendor/three.js.
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
} from "./vendor/three.js";

const SIZE = 1.5; // longest side of the card, in world units
const THICK = 0.012; // gap between the two faces

const VERT = `
uniform float uBulge;
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vec3 p = position;
  // A paper bulge: a sachet is plump in the middle, a napkin barely.
  vec2 c = uv * 2.0 - 1.0;
  p.z += uBulge * (1.0 - c.x * c.x) * (1.0 - c.y * c.y);
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

// The printed scan, plus a rainbow foil that slides with the tilt and a soft glare under the cursor.
const FRAG = `
precision highp float;
uniform sampler2D uMap;
uniform vec2 uPointer;   // cursor in card coordinates (-1…1)
uniform float uHolo;     // 0 at rest, 1 while hovered
uniform vec2 uTilt;
varying vec2 vUv;
varying vec3 vNormal;
vec3 hsv(vec3 c){ vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www); return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }
void main() {
  vec4 tex = texture2D(uMap, vUv);
  if (tex.a < 0.02) discard;
  vec2 c = vUv * 2.0 - 1.0;
  // Foil: bands of colour that move as the card tilts.
  float band = fract(c.x * 0.55 + c.y * 0.35 + uTilt.x * 0.9 - uTilt.y * 0.6);
  vec3 foil = hsv(vec3(band, 0.5, 1.0));
  float sparkle = pow(max(0.0, sin((c.x + uTilt.x) * 90.0) * sin((c.y - uTilt.y) * 90.0)), 8.0);
  vec3 col = tex.rgb * mix(vec3(1.0), foil, 0.27 * uHolo);
  // Glare under the cursor.
  float d = distance(c, uPointer);
  col += vec3(1.0) * exp(-d * d * 3.2) * 0.34 * uHolo;
  col += foil * sparkle * 0.22 * uHolo;
  // Light from above-left, so the face darkens a little as it turns away.
  float shade = 0.94 + 0.06 * clamp(dot(normalize(vNormal), normalize(vec3(-0.3, 0.5, 0.8))), 0.0, 1.0);
  col *= shade;
  gl_FragColor = linearToOutputTexel(vec4(col, tex.a));
}`;

const loader = new TextureLoader();
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function mountCard(stage) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  stage.prepend(canvas);
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 20);
  const pivot = new Group();
  scene.add(pivot);

  let faces = [],
    item = null,
    token = 0;
  // yaw / pitch: the card's turn. `rest` is where it wants to be (0 front, π back).
  const turn = { yaw: 0, pitch: 0, vy: 0, vp: 0, rest: 0 };
  const pointer = new Vector2(0, 0), // -1…1 over the stage
    local = new Vector2(0, 0), // cursor in card coordinates
    hover = { x: 0 };
  let drag = null,
    hovering = false,
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

  const makeFace = (url, w, h, bulge, back) => {
    const geo = new PlaneGeometry(w, h, 24, 24);
    const mat = new ShaderMaterial({
      uniforms: {
        uMap: { value: null },
        uBulge: { value: bulge * (back ? 1 : 1) },
        uPointer: { value: new Vector2() },
        uHolo: { value: 0 },
        uTilt: { value: new Vector2() },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.z = back ? -THICK : THICK;
    if (back) mesh.rotation.y = Math.PI; // its own front faces away; seen from behind it reads correctly
    return mesh;
  };

  // Show another item.
  function setItem(next) {
    const mine = ++token;
    item = next;
    for (const f of faces) (pivot.remove(f), f.geometry.dispose(), f.material.uniforms.uMap.value?.dispose(), f.material.dispose());
    faces = [];
    turn.yaw = turn.rest = 0;
    turn.pitch = turn.vy = turn.vp = 0;
    shown = false;
    const [w, h] = next.ratio >= 1 ? [SIZE, SIZE / next.ratio] : [SIZE * next.ratio, SIZE];
    const front = makeFace(next.front, w, h, next.bulge, false),
      back = makeFace(next.back, w, h, next.bulge, true);
    faces = [front, back];
    pivot.add(front, back);
    stage.classList.remove("ready");
    let loaded = 0;
    [front, back].forEach((mesh, i) => {
      loader.load(i ? next.back : next.front, (tex) => {
        if (mine !== token) return tex.dispose();
        tex.colorSpace = "srgb";
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        mesh.material.uniforms.uMap.value = tex;
        if (++loaded === 2) {
          stage.classList.add("ready");
          entry = 1;
        }
      });
    });
  }

  // Tell the page which side the card is settling on (for the "See back" button).
  let shown = false;
  const emit = () => {
    const back = Math.round(turn.rest / Math.PI) % 2 !== 0;
    if (back !== shown) stage.dispatchEvent(new CustomEvent("face", { detail: { back } }));
    shown = back;
  };
  const toCard = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  const onMove = (e) => {
    toCard(e);
    if (drag && e.pointerId === drag.id) {
      const now = performance.now(),
        dt = Math.max(0.004, (now - drag.t) / 1000);
      const yaw = drag.yaw + (e.clientX - drag.x) * 0.011,
        pitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.007, -0.9, 0.9);
      turn.vy = clamp(((yaw - turn.yaw) / dt) * 0.4 + turn.vy * 0.6, -25, 25);
      turn.vp = clamp(((pitch - turn.pitch) / dt) * 0.4 + turn.vp * 0.6, -25, 25);
      turn.yaw = yaw;
      turn.pitch = pitch;
      drag.t = now;
    }
  };
  const onDown = (e) => {
    if (drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    toCard(e);
    stage.setPointerCapture?.(e.pointerId);
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: turn.yaw, pitch: turn.pitch, t: performance.now() };
    stage.classList.add("grabbing");
  };
  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    stage.classList.remove("grabbing");
    stage.releasePointerCapture?.(e.pointerId);
    // Settle face-on, on the side it is closest to (a flick carries it further).
    turn.rest = Math.round((turn.yaw + turn.vy * 0.12) / Math.PI) * Math.PI;
    emit();
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
    emit();
  };
  const flip = () => {
    turn.rest = Math.round(turn.yaw / Math.PI) * Math.PI + Math.PI;
    emit();
  };
  const onEnter = () => (hovering = true);
  const onLeave = () => ((hovering = false), pointer.set(0, 0));
  addEventListener("pointermove", onMove, { passive: true });
  addEventListener("pointerup", onUp);
  addEventListener("pointercancel", onUp);
  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointerenter", onEnter);
  stage.addEventListener("pointerleave", onLeave);
  stage.addEventListener("wheel", onWheel, { passive: false });
  stage.addEventListener("dblclick", flip);

  let raf = 0,
    last = performance.now(),
    time = 0,
    visible = true;
  const tilt = new Vector2();
  const step = (now) => {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    time += dt;
    const held = drag || now < wheelUntil;
    // Turning: spring toward the face-on position it should rest in.
    if (!held) {
      turn.vy += ((turn.rest - turn.yaw) * 70 - turn.vy * 10.5) * dt;
      turn.vp += ((0 - turn.pitch) * 60 - turn.vp * 10) * dt;
      turn.yaw += turn.vy * dt;
      turn.pitch += turn.vp * dt;
    }
    // Hover tilt toward the cursor (only while the card is face-on and not being turned).
    const calm = !held && Math.abs(turn.yaw - turn.rest) < 0.6;
    const want = calm && hovering ? pointer : { x: 0, y: 0 };
    tilt.x += (want.x - tilt.x) * (1 - Math.exp(-dt * 9));
    tilt.y += (want.y - tilt.y) * (1 - Math.exp(-dt * 9));
    hover.x += ((hovering ? 1 : 0.0) - hover.x) * (1 - Math.exp(-dt * 6));
    entry = Math.max(0, entry - dt * 2.4);
    const ease = 1 - Math.pow(1 - (1 - entry), 3);
    pivot.rotation.set(turn.pitch - tilt.y * 0.32, turn.yaw + tilt.x * 0.36, 0);
    pivot.position.y = (reduce ? 0 : Math.sin(time * 1.3) * 0.015) + (1 - ease) * 0.5;
    pivot.scale.setScalar(0.9 + 0.1 * ease);
    // Which side faces us decides which glare to show.
    const showBack = Math.cos(pivot.rotation.y) < 0;
    for (let i = 0; i < faces.length; i++) {
      const u = faces[i].material.uniforms;
      u.uHolo.value = hover.x * (calm ? 1 : 0.6);
      const flipX = i === 1 ? -1 : 1;
      u.uPointer.value.set(pointer.x * flipX * (showBack === (i === 1) ? 1 : 0), pointer.y);
      u.uTilt.value.set(tilt.x * flipX, tilt.y);
    }
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
    isBack: () => Math.round(turn.rest / Math.PI) % 2 !== 0,
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      removeEventListener("pointercancel", onUp);
      stage.removeEventListener("wheel", onWheel);
      for (const f of faces) (f.geometry.dispose(), f.material.uniforms.uMap.value?.dispose(), f.material.dispose());
      renderer.dispose();
      canvas.remove();
    },
  };
}
