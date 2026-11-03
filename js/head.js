// About page: Nicoló's 3D head (assets/about/head.glb) on the right half of the screen.
//
//   Look      The eyes and the head follow the cursor wherever it is on the page.
//   Rotate    Drag, or scroll with two fingers on a trackpad (horizontal + vertical), to spin
//             the head; it swings back to face you. Spin it too much and it gets dizzy.
//   Stretch   Press and hold on the face for a moment, then pull: it stretches like Mario's
//             head in Super Mario 64 and wobbles back on release.
//   React     Move the cursor over the head like petting it: it smiles.
//             Tap an eye: both close and the head winces. Tap the nose three times: it grows
//             exponentially, then springs back. Tap the mouth: it puckers. Tap the rest: boop.
//             Leave it alone for a while and it falls asleep (move the mouse to wake it).
//
// The scan has its eyes painted into the texture, so eyes and eyelids are done in the shader
// (the iris is shifted inside the eye opening, skin-coloured lids slide over it); the smile,
// pucker, nose and stretch move the vertices. Three.js comes from js/vendor/three.js
// (see tools/vendor-three.mjs).
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  HemisphereLight,
  DirectionalLight,
  Group,
  Vector2,
  Vector3,
  Vector4,
  Matrix4,
  Plane,
  Raycaster,
  BufferAttribute,
  GLTFLoader,
  MeshoptDecoder,
} from "./vendor/three.js";

const MODEL = "/assets/about/head.glb";
// The scan faces +X; this turns it to face the camera (+Z).
const FACE_TURN = -Math.PI / 2;

// Where the features sit, in head units (the head is 1 tall, centred on the origin, facing +Z).
const FACE = {
  eyes: [
    { x: -0.14, y: -0.038 },
    { x: 0.133, y: -0.037 },
  ],
  lid: { rx: 0.09, ry: 0.042 }, // area the eyelids can cover
  open: { rx: 0.062, ry: 0.019 }, // the visible eye opening (where the iris can move)
  gaze: { x: 0.012, y: 0.004 }, // furthest the iris travels
  skinY: -0.115, // cheek height: eyelids are painted with the skin colour found here
  nose: { x: -0.003, y: -0.195 },
  mouth: { x: -0.001, y: -0.318, cl: -0.115, cr: 0.113 },
};
const LOOK = { yaw: 0.65, pitch: 0.35 }; // furthest the head turns toward the cursor (radians)
const PULL = {
  radius: 0.15, // reach of one pull, as a share of the head's height
  max: 0.6, // furthest the skin can be stretched
  stiffness: 140, // spring back after release …
  damping: 6.5, // … and how quickly the wobble dies out
};
const HOLD_MS = 280; // press this long before a drag pulls the skin instead of spinning
const TAU = Math.PI * 2;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// A damped spring: x moves toward `to`, v is its speed.
const spring = (s, to, k, c, dt) => {
  s.v += ((to - s.x) * k - s.v * c) * dt;
  s.x += s.v * dt;
};

// Eyes, lids and gaze, drawn on top of the scan's texture. `vRest` is the vertex position
// before any stretching, so the masks stay glued to the face while it deforms.
const VERT_HEAD = `attribute vec3 restPos;\nvarying vec3 vRest;`;
const FRAG_HEAD = `varying vec3 vRest;
uniform vec2 uEyeC[2];
uniform vec4 uEyeJ[2];
uniform vec2 uSkinUV[2];
uniform vec2 uGaze[2];
uniform float uLid[2];
uniform float uSquint[2];
uniform vec2 uLidR;
uniform vec2 uOpenR;`;
const FRAG_MAP = `
#ifdef USE_MAP
  vec2 muv = vMapUv;
  float cover = 0.0;
  float lash = 0.0;
  float front = step(0.0, vRest.z);
  vec3 skinCol = mix(texture2D(map, uSkinUV[0]).rgb, texture2D(map, uSkinUV[1]).rgb, step(0.0, vRest.x));
  for (int i = 0; i < 2; i++) {
    vec2 q = vRest.xy - uEyeC[i];
    vec2 d = q / uLidR;
    float inside = (1.0 - smoothstep(0.85, 1.05, length(d))) * front;
    // Gaze: inside the eye opening the iris slides toward uGaze, the lids stay put.
    float gw = (1.0 - smoothstep(0.2, 1.0, abs(q.x) / uOpenR.x))
             * (1.0 - smoothstep(0.5, 1.0, abs(q.y) / uOpenR.y)) * front;
    muv -= uEyeJ[i].xy * (uGaze[i].x * gw) + uEyeJ[i].zw * (uGaze[i].y * gw);
    // Lids: the upper one comes down in an arc, a squint also raises the lower one.
    float arc = max(1.0 - d.x * d.x, 0.0);
    float c = uLid[i];
    float s = uSquint[i];
    float eu = min(mix(1.6, -0.2, c) - 0.3 * c * arc, mix(1.6, 0.3, s));
    float el = mix(-1.6, -0.3, s);
    float cv = max(smoothstep(eu - 0.06, eu + 0.06, d.y), 1.0 - smoothstep(el - 0.06, el + 0.06, d.y)) * inside;
    float lw = smoothstep(0.12, 0.3, max(c, s)) * (1.0 - smoothstep(0.7, 1.0, abs(d.x))) * inside;
    float ln = (1.0 - smoothstep(0.0, 0.16, abs(d.y - eu))) * lw
             + (1.0 - smoothstep(0.0, 0.16, abs(d.y - el))) * lw * step(0.01, s) * 0.6;
    cover = max(cover, cv);
    lash = max(lash, ln);
  }
  vec4 sampledDiffuseColor = texture2D(map, muv);
  vec3 col = mix(sampledDiffuseColor.rgb, skinCol, cover);
  col = mix(col, vec3(0.035, 0.022, 0.018), lash * 0.9);
  diffuseColor *= vec4(col, sampledDiffuseColor.a);
#endif
`;

export function mountHead(stage) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    stage.classList.add("failed");
    return () => {};
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  stage.prepend(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(28, 1, 0.1, 20);
  scene.add(new HemisphereLight(0xffffff, 0x3a3a3a, 2.2));
  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(-1.5, 2, 3);
  scene.add(key);
  const rim = new DirectionalLight(0xffffff, 0.8);
  rim.position.set(2, 1, -2);
  scene.add(rim);

  // pivot: where the head turns; the mesh inside it is what gets deformed.
  const pivot = new Group();
  scene.add(pivot);

  let mesh = null,
    rest = null, // untouched vertex positions
    positions = null, // the ones drawn (rest + deformations)
    radii = new Vector3(0.5, 0.5, 0.5); // head ellipsoid for hover tests
  const nose = { tip: new Vector3(), idx: null, w: null, dx: null };
  const mouth = { idx: null, wl: null, wr: null, wk: null, wc: null };

  // Shader inputs (see FRAG_MAP).
  const U = {
    uEyeC: { value: FACE.eyes.map((e) => new Vector2(e.x, e.y)) },
    uEyeJ: { value: [new Vector4(), new Vector4()] },
    uSkinUV: { value: [new Vector2(), new Vector2()] },
    uGaze: { value: [new Vector2(), new Vector2()] },
    uLid: { value: [0, 0] },
    uSquint: { value: [0, 0] },
    uLidR: { value: new Vector2(FACE.lid.rx, FACE.lid.ry) },
    uOpenR: { value: new Vector2(FACE.open.rx, FACE.open.ry) },
  };

  // ── camera framing ──
  const resize = () => {
    const w = stage.clientWidth,
      h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Fit a head about 1 unit tall with room to stretch, in portrait and landscape.
    const fit = 1.75 / (2 * Math.tan((camera.fov * Math.PI) / 360));
    camera.position.set(0, 0, fit * Math.max(1, 0.85 / camera.aspect));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  const raycaster = new Raycaster(),
    pointer = new Vector2(),
    inverse = new Matrix4();

  // The face surface at (x, y), seen from the front: {point, uv} or null.
  const probe = (x, y) => {
    raycaster.set(new Vector3(x, y, 5), new Vector3(0, 0, -1));
    pivot.updateMatrixWorld(true);
    return raycaster.intersectObject(mesh, false)[0] || null;
  };

  // ── load the head ──
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let disposed = false;
  loader.load(
    MODEL,
    (gltf) => {
      if (disposed) return;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => {
        if (!mesh && o.isMesh) mesh = o;
      });
      if (!mesh) return stage.classList.add("failed");
      const g = mesh.geometry;
      // Plain float positions (the file stores them compressed), with the node's transform
      // baked in, so deforming can work directly in head space.
      for (const name of ["position", "normal"]) {
        const a = g.getAttribute(name);
        if (!a) continue;
        const f = new Float32Array(a.count * 3);
        for (let i = 0; i < a.count; i++) {
          f[i * 3] = a.getX(i);
          f[i * 3 + 1] = a.getY(i);
          f[i * 3 + 2] = a.getZ(i);
        }
        g.setAttribute(name, new BufferAttribute(f, 3));
      }
      g.applyMatrix4(mesh.matrixWorld);
      g.applyMatrix4(new Matrix4().makeRotationY(FACE_TURN));
      g.computeBoundingBox();
      const box = g.boundingBox,
        size = box.getSize(new Vector3()),
        center = box.getCenter(new Vector3());
      const scale = 1 / size.y;
      g.translate(-center.x, -center.y, -center.z);
      g.scale(scale, scale, scale);
      g.computeVertexNormals(); // smooth shading across the simplified scan
      g.computeBoundingBox();
      g.computeBoundingSphere();
      g.boundingBox.getSize(radii).multiplyScalar(0.5 * 0.96);
      mesh.removeFromParent();
      mesh.position.set(0, 0, 0);
      mesh.rotation.set(0, 0, 0);
      mesh.scale.set(1, 1, 1);
      mesh.updateMatrix();
      mesh.frustumCulled = false;
      positions = g.getAttribute("position");
      positions.setUsage(35048); // DYNAMIC_DRAW
      rest = positions.array.slice();
      g.setAttribute("restPos", new BufferAttribute(rest, 3));
      pivot.add(mesh);
      pivot.updateMatrixWorld(true);

      // Texture position of every eye, and how head units map to texture units around it.
      FACE.eyes.forEach((eye, i) => {
        const c = probe(eye.x, eye.y)?.uv,
          px = probe(eye.x + 0.01, eye.y)?.uv,
          py = probe(eye.x, eye.y + 0.01)?.uv,
          sk = probe(eye.x, FACE.skinY)?.uv;
        if (!c || !px || !py || !sk) return;
        U.uEyeJ.value[i].set((px.x - c.x) / 0.01, (px.y - c.y) / 0.01, (py.x - c.x) / 0.01, (py.y - c.y) / 0.01);
        U.uSkinUV.value[i].copy(sk);
      });
      const tip = probe(FACE.nose.x, FACE.nose.y);
      nose.tip.set(FACE.nose.x, FACE.nose.y, tip ? tip.point.z : 0.3);
      buildRegions();

      const mat = mesh.material;
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, U);
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", `#include <common>\n${VERT_HEAD}`)
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = restPos;");
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", `#include <common>\n${FRAG_HEAD}`)
          .replace("#include <map_fragment>", FRAG_MAP);
      };
      mat.needsUpdate = true;
      stage.classList.add("ready");
      start();
    },
    undefined,
    () => stage.classList.add("failed"),
  );

  // Which vertices each expression moves, and by how much (a soft falloff around a point).
  function buildRegions() {
    const n = rest.length / 3,
      ni = [],
      nw = [],
      nd = [],
      mi = [],
      ml = [],
      mr = [],
      mk = [],
      mc = [];
    const m = FACE.mouth;
    for (let i = 0; i < n; i++) {
      const x = rest[i * 3],
        y = rest[i * 3 + 1],
        z = rest[i * 3 + 2];
      if (z < 0.02) continue; // front half of the head
      // Nose: an egg-shaped falloff, longer than wide.
      const dx = x - nose.tip.x,
        dy = y - nose.tip.y,
        dz = z - nose.tip.z;
      const wn = Math.exp(-((dx * dx) / 0.0049 + (dy * dy) / 0.0144 + (dz * dz) / 0.01));
      if (wn > 0.01) {
        ni.push(i);
        nw.push(wn);
        nd.push(dx);
      }
      // Mouth corners, cheeks and the lips themselves.
      const wl = Math.exp(-((x - m.cl) ** 2 + (y - m.y) ** 2) / 0.005),
        wr = Math.exp(-((x - m.cr) ** 2 + (y - m.y) ** 2) / 0.005),
        wk = Math.max(
          Math.exp(-((x + 0.17) ** 2 + (y + 0.22) ** 2) / 0.0162),
          Math.exp(-((x - 0.17) ** 2 + (y + 0.22) ** 2) / 0.0162),
        ),
        wc = Math.exp(-((x - m.x) ** 2 / 0.0144 + (y - m.y) ** 2 / 0.0016));
      if (Math.max(wl, wr, wk, wc) > 0.012) {
        mi.push(i);
        ml.push(wl);
        mr.push(wr);
        mk.push(wk);
        mc.push(wc);
      }
    }
    nose.idx = Uint32Array.from(ni);
    nose.w = Float32Array.from(nw);
    nose.dx = Float32Array.from(nd);
    mouth.idx = Uint32Array.from(mi);
    mouth.wl = Float32Array.from(ml);
    mouth.wr = Float32Array.from(mr);
    mouth.wk = Float32Array.from(mk);
    mouth.wc = Float32Array.from(mc);
  }

  // ── state ──
  const look = { x: 0, y: 0 }, // where the cursor asks the head to look (-1…1)
    turn = { yaw: 0, pitch: 0, vy: 0, vp: 0 }, // head turn toward the cursor + its speed
    rot = { yaw: 0, pitch: 0, vy: 0, vp: 0 }, // turn given by the visitor (drag / trackpad)
    gaze = [new Vector2(), new Vector2()],
    smile = { x: 0, v: 0 }, // -1 grimace … 1 big smile
    pucker = { x: 0, v: 0 },
    squash = { x: 0, v: 0 }, // boop: head squashes then springs back
    pulse = { x: 0, v: 0 }, // small nose twitch on every tap
    shake = { x: 0, v: 0 }; // quick head shake (hurt)
  const grow = { phase: 0, t: 0, n: 0, v: 0, taps: 0, last: 0 }; // nose: 0 rest, 1 growing, 2 holding, 3 back
  const hurt = { t: -1 },
    dizzy = { t: -1, sum: 0 },
    kiss = { t: -1 };
  let lid = 0,
    pet = 0,
    sleepy = 0,
    lastActivity = performance.now(),
    time = 0,
    hovering = false,
    drag = null,
    wheelUntil = 0,
    deformed = false;
  const pulls = [];

  const toNDC = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  // Where the ray under the cursor first touches the head, in head space (or null).
  // The head is treated as an ellipsoid: exact enough for hover and grabbing, and far cheaper
  // than testing 100k triangles on every mouse move.
  const hitHead = () => {
    if (!mesh) return null;
    raycaster.setFromCamera(pointer, camera);
    pivot.updateMatrixWorld();
    inverse.copy(pivot.matrixWorld).invert();
    const o = raycaster.ray.origin.clone().applyMatrix4(inverse).divide(radii),
      d = raycaster.ray.direction.clone().transformDirection(inverse).divide(radii);
    const a = d.dot(d),
      b = 2 * o.dot(d),
      c = o.dot(o) - 1,
      disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t < 0) return null;
    return o.addScaledVector(d, t).multiply(radii);
  };
  // What a tap landed on, found on the real surface: "eye", "nose", "mouth", "head" or null.
  const regionAt = (e) => {
    toNDC(e);
    raycaster.setFromCamera(pointer, camera);
    pivot.updateMatrixWorld(true);
    const hit = raycaster.intersectObject(mesh, false)[0];
    if (!hit) return null;
    const p = mesh.worldToLocal(hit.point.clone());
    if (p.z < 0) return "head";
    const inEllipse = (cx, cy, rx, ry) => ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 < 1;
    if (FACE.eyes.some((eye) => inEllipse(eye.x, eye.y, 0.095, 0.05))) return "eye";
    if (inEllipse(FACE.nose.x, -0.15, 0.085, 0.085)) return "nose";
    if (inEllipse(FACE.mouth.x, FACE.mouth.y, 0.13, 0.045)) return "mouth";
    return "head";
  };

  const wake = (now) => {
    lastActivity = now;
    if (sleepy > 0.35) {
      squash.v += 3.5; // startled awake
      sleepy = 0.3;
    }
  };

  // ── reactions ──
  const boop = (strength = 5) => (squash.v += strength);
  const tap = (e, now) => {
    const region = regionAt(e);
    if (!region) return;
    if (region === "eye") {
      hurt.t = 0;
      boop(4);
      shake.v += 9;
      turn.vp -= 3;
      grow.taps = 0;
    } else if (region === "nose") {
      pulse.v += 4;
      boop(2.5);
      grow.taps = now - grow.last < 1400 ? grow.taps + 1 : 1;
      grow.last = now;
      if (grow.taps >= 3 && grow.phase === 0) {
        grow.taps = 0;
        grow.phase = 1;
        grow.t = 0;
      }
    } else if (region === "mouth") {
      kiss.t = 0;
      boop(2);
    } else boop();
  };

  // ── pointer ──
  const onWindowMove = (e) => {
    const now = performance.now();
    wake(now);
    const r = canvas.getBoundingClientRect(),
      cx = r.left + r.width / 2,
      cy = r.top + r.height * 0.45;
    look.x = Math.tanh((e.clientX - cx) / (innerWidth * 0.3));
    look.y = Math.tanh((e.clientY - cy) / (innerHeight * 0.35));
    if (drag && e.pointerId === drag.id) moveDrag(e, now);
  };
  let lastHover = null;
  const onStageMove = (e) => {
    if (drag || e.pointerType !== "mouse") return;
    toNDC(e);
    const over = Boolean(hitHead());
    if (over !== hovering) stage.classList.toggle("over", (hovering = over));
    // Petting: moving over the head makes it happy.
    if (over && lastHover) pet = Math.min(1.2, pet + Math.min(60, Math.hypot(e.clientX - lastHover.x, e.clientY - lastHover.y)) / 480);
    lastHover = over ? { x: e.clientX, y: e.clientY } : null;
  };
  const onStageLeave = () => {
    if (hovering) stage.classList.remove("over");
    hovering = false;
    lastHover = null;
  };

  const onDown = (e) => {
    if (!mesh || drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    toNDC(e);
    const now = performance.now();
    wake(now);
    stage.setPointerCapture?.(e.pointerId);
    drag = { id: e.pointerId, mode: "pending", x0: e.clientX, y0: e.clientY, t0: now, hit: hitHead(), touch: e.pointerType !== "mouse" };
    e.preventDefault();
  };
  const moveDrag = (e, now) => {
    if (drag.mode === "pending") {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < (drag.touch ? 9 : 5)) return;
      if (drag.hit && now - drag.t0 >= HOLD_MS) {
        // Held first, then pulled: grab the skin. Every vertex near the point follows it.
        const sigma2 = 2 * PULL.radius * PULL.radius,
          cutoff = PULL.radius * 2.6,
          idx = [],
          w = [];
        const hit = drag.hit;
        for (let i = 0, n = rest.length / 3; i < n; i++) {
          const dx = rest[i * 3] - hit.x,
            dy = rest[i * 3 + 1] - hit.y,
            dz = rest[i * 3 + 2] - hit.z;
          if (Math.abs(dx) > cutoff || Math.abs(dy) > cutoff || Math.abs(dz) > cutoff) continue;
          const k = Math.exp(-(dx * dx + dy * dy + dz * dz) / sigma2);
          if (k < 0.015) continue;
          idx.push(i);
          w.push(k);
        }
        const world = pivot.localToWorld(hit.clone());
        drag.pull = {
          idx: Uint32Array.from(idx),
          w: Float32Array.from(w),
          offset: new Vector3(),
          speed: new Vector3(),
          target: new Vector3(),
          grab: hit,
          plane: new Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new Vector3()).negate(), world),
        };
        pulls.push(drag.pull);
        drag.mode = "pull";
      } else {
        // Straight away: spin the head from where it is now.
        drag.mode = "spin";
        drag.ax = e.clientX;
        drag.ay = e.clientY;
        drag.yaw = rot.yaw;
        drag.pitch = rot.pitch;
        drag.last = now;
      }
      stage.classList.add("grabbing");
    }
    if (drag.mode === "spin") {
      const yaw = drag.yaw + (e.clientX - drag.ax) * 0.012,
        pitch = clamp(drag.pitch + (e.clientY - drag.ay) * 0.008, -1.2, 1.2);
      const dt = Math.max(0.004, (now - drag.last) / 1000);
      drag.last = now;
      spun(yaw - rot.yaw, pitch - rot.pitch, dt);
    } else if (drag.mode === "pull") {
      toNDC(e);
      raycaster.setFromCamera(pointer, camera);
      const p = raycaster.ray.intersectPlane(drag.pull.plane, new Vector3());
      if (!p) return;
      pivot.worldToLocal(p).sub(drag.pull.grab);
      if (p.length() > PULL.max) p.setLength(PULL.max);
      drag.pull.target.copy(p);
    }
  };
  // The visitor turned the head by (dyaw, dpitch) over dt seconds: follow, and count the dizziness.
  const spun = (dyaw, dpitch, dt) => {
    rot.yaw += dyaw;
    rot.pitch = clamp(rot.pitch + dpitch, -1.2, 1.2);
    rot.vy = clamp(rot.vy * 0.6 + (dyaw / dt) * 0.4, -30, 30);
    rot.vp = clamp(rot.vp * 0.6 + (dpitch / dt) * 0.4, -30, 30);
    if (dizzy.t < 0) dizzy.sum += Math.abs(dyaw) + Math.abs(dpitch);
  };
  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag,
      now = performance.now();
    drag = null;
    stage.classList.remove("grabbing");
    stage.releasePointerCapture?.(e.pointerId);
    if (d.mode === "pending") {
      if (e.type === "pointerup" && now - d.t0 < 450) tap(e, now);
    } else if (d.mode === "pull") d.pull.released = true;
    else rot.yaw -= TAU * Math.round(rot.yaw / TAU); // swing back the short way round
  };
  // Two-finger scroll (or a wheel) over the head turns it, like a drag.
  const onWheel = (e) => {
    if (!mesh || e.ctrlKey || drag) return;
    toNDC(e);
    if (!hitHead()) return;
    e.preventDefault();
    const now = performance.now(),
      unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    wake(now);
    wheelUntil = now + 220;
    spun(-e.deltaX * unit * 0.011, -e.deltaY * unit * 0.008, 1 / 60);
  };

  addEventListener("pointermove", onWindowMove, { passive: true });
  stage.addEventListener("pointermove", onStageMove, { passive: true });
  stage.addEventListener("pointerleave", onStageLeave);
  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("wheel", onWheel, { passive: false });
  addEventListener("pointerup", onUp);
  addEventListener("pointercancel", onUp);

  // ── animation ──
  let raf = 0,
    visible = true,
    last = performance.now();
  const step = (now) => {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    time += dt;
    const holding = drag && (drag.mode === "spin" || drag.mode === "pull");
    const interacting = holding || now < wheelUntil;

    // Held long enough to grab the skin: say so with the cursor.
    if (drag?.mode === "pending" && drag.hit && now - drag.t0 >= HOLD_MS) stage.classList.add("grabbing");

    // Sleep after a while without a mouse move.
    const idleFor = (now - lastActivity) / 1000;
    sleepy += ((!reduce && idleFor > 14 ? 1 : 0) - sleepy) * (1 - Math.exp(-dt * (idleFor > 14 ? 0.9 : 7)));

    // Petting fades when it stops.
    pet = Math.max(0, pet - dt * (hovering ? 0.3 : 0.9));

    // Timelines.
    if (hurt.t >= 0) {
      hurt.t += dt;
      if (hurt.t > 1.9) hurt.t = -1;
    }
    if (kiss.t >= 0 && (kiss.t += dt) > 1.3) kiss.t = -1;
    if (dizzy.t >= 0) {
      dizzy.t += dt;
      if (dizzy.t > 3.8) dizzy.t = -1;
    } else {
      dizzy.sum = Math.max(0, dizzy.sum - dt * 2.2);
      if (dizzy.sum > 9) {
        dizzy.t = 0;
        dizzy.sum = 0;
      }
    }
    if (grow.phase === 1) {
      grow.t += dt;
      const u = Math.min(1, grow.t / 1.7);
      grow.n = (Math.exp(4 * u) - 1) / (Math.exp(4) - 1); // exponential growth
      if (u >= 1) (grow.phase = 2), (grow.t = 0);
    } else if (grow.phase === 2) {
      grow.t += dt;
      grow.n = 1 + 0.03 * Math.sin(grow.t * 18);
      if (grow.t > 1.1) (grow.phase = 3), (grow.v = 0);
    } else if (grow.phase === 3) {
      grow.v += (-170 * grow.n - 22 * grow.v) * dt;
      grow.n += grow.v * dt;
      if (Math.abs(grow.n) < 0.003 && Math.abs(grow.v) < 0.05) (grow.phase = 0), (grow.n = 0);
    }
    spring(pulse, 0, 320, 18, dt);
    spring(squash, 0, 190, 11, dt);
    spring(shake, 0, 520, 9, dt);

    // What the face wants right now.
    const hurtAmt = hurt.t < 0 ? 0 : smooth(0, 0.05, hurt.t) * (1 - smooth(1.5, 1.9, hurt.t));
    const dizzyAmt = dizzy.t < 0 ? 0 : Math.min(smooth(0, 0.25, dizzy.t), 1 - smooth(3.2, 3.8, dizzy.t));
    const kissAmt = kiss.t < 0 ? 0 : Math.sin(clamp(kiss.t / 1.3, 0, 1) * Math.PI) ** 0.5;
    let smileTo = 0.95 * smooth(0.25, 0.8, pet);
    smileTo = smileTo * (1 - hurtAmt) - 0.9 * hurtAmt;
    smileTo = smileTo * (1 - dizzyAmt) - 0.3 * dizzyAmt + 0.25 * (grow.phase ? 1 : 0);
    smileTo *= 1 - 0.8 * sleepy;
    spring(smile, smileTo, 150, 14, dt);
    spring(pucker, kissAmt, 220, 16, dt);

    // Eyelids: wince, sleep; a happy face squints.
    const lidTo = Math.max(hurtAmt, sleepy * 0.95);
    lid += (lidTo - lid) * (1 - Math.exp(-dt * (lidTo > lid ? 32 : 14)));
    const squint = Math.max(0, smile.x) * 0.7;
    U.uLid.value[0] = U.uLid.value[1] = lid;
    U.uSquint.value[0] = U.uSquint.value[1] = squint;

    // Gaze: the eyes lead the head toward the cursor; cross-eyed with a big nose, circling when dizzy.
    const rollAng = dizzy.t * 11;
    for (let i = 0; i < 2; i++) {
      let gx = look.x * FACE.gaze.x,
        gy = -look.y * FACE.gaze.y;
      if (grow.phase) (gx = (i === 0 ? 1 : -1) * FACE.gaze.x * 0.95), (gy = -FACE.gaze.y * 0.6);
      if (sleepy > 0.5) (gx *= 0.3), (gy = -FACE.gaze.y * 0.8);
      if (dizzyAmt > 0) {
        gx = gx * (1 - dizzyAmt) + Math.cos(rollAng) * FACE.gaze.x * dizzyAmt;
        gy = gy * (1 - dizzyAmt) + Math.sin(rollAng) * FACE.gaze.y * 1.1 * dizzyAmt;
      }
      gx *= 1 - hurtAmt;
      gy *= 1 - hurtAmt;
      gaze[i].x += (gx - gaze[i].x) * (1 - Math.exp(-dt * 18));
      gaze[i].y += (gy - gaze[i].y) * (1 - Math.exp(-dt * 18));
      U.uGaze.value[i].copy(gaze[i]);
    }

    // Head turn toward the cursor: a soft spring (a little overshoot when it swings back).
    const idle = !reduce && idleFor > 2.5 && !interacting && sleepy < 0.2 ? time : 0;
    const wantYaw = look.x * LOOK.yaw + (idle ? Math.sin(idle * 0.6) * 0.12 : 0),
      wantPitch = look.y * LOOK.pitch + (idle ? Math.sin(idle * 0.45) * 0.05 : 0);
    turn.vy += ((wantYaw - turn.yaw) * 55 - turn.vy * 11) * dt;
    turn.vp += ((wantPitch - turn.pitch) * 55 - turn.vp * 11) * dt;
    turn.yaw += turn.vy * dt;
    turn.pitch += turn.vp * dt;

    // The visitor's spin: follows the hand, keeps its momentum when thrown, then swings back.
    if (interacting) {
      if (!holding) {
        // a trackpad scroll arrives in bursts: let the last push fade
        rot.vy *= Math.exp(-dt * 6);
        rot.vp *= Math.exp(-dt * 6);
      }
    } else {
      rot.vy += (-rot.yaw * 9 - rot.vy * 2.6) * dt;
      rot.vp += (-rot.pitch * 9 - rot.vp * 2.6) * dt;
      rot.yaw += rot.vy * dt;
      rot.pitch += rot.vp * dt;
    }

    // While stretching, the head leans a little toward the pull.
    const lean = drag?.mode === "pull" ? drag.pull.offset : null;
    pivot.rotation.set(
      turn.pitch + rot.pitch + sleepy * 0.32 + (lean ? -lean.y * 0.35 : 0),
      turn.yaw + rot.yaw + shake.x * 0.1 + dizzyAmt * Math.sin(dizzy.t * 3.1) * 0.2 + (lean ? lean.x * 0.45 : 0),
      (lean ? -lean.x * 0.1 : 0) - 0.07 * smooth(0.3, 0.9, pet) * (1 - hurtAmt) + dizzyAmt * Math.sin(dizzy.t * 5) * 0.13 + sleepy * 0.05,
    );
    const s = squash.x * 0.045;
    const breathe = reduce ? 0 : Math.sin(time * (sleepy > 0.3 ? 1.3 : 2.2)) * (sleepy > 0.3 ? 0.012 : 0.004);
    pivot.scale.set(1 + s * 0.6 + breathe, 1 - s - breathe, 1 + s * 0.6 + breathe);
    pivot.position.y = reduce ? 0 : Math.sin(time * 0.7) * 0.008 - sleepy * 0.02;

    // Pulls: follow the cursor while held, then wobble back to rest.
    for (const p of pulls) {
      if (!p.released) {
        p.speed.subVectors(p.target, p.offset).multiplyScalar((1 / Math.max(dt, 1e-3)) * 0.4);
        p.offset.lerp(p.target, 0.4);
      } else {
        p.speed.addScaledVector(p.offset, -PULL.stiffness * dt).multiplyScalar(Math.exp(-PULL.damping * dt));
        p.offset.addScaledVector(p.speed, dt);
      }
    }

    // Rebuild the vertices that something is moving.
    const noseAmt = grow.n + pulse.x * 0.1;
    const active = pulls.length > 0 || Math.abs(noseAmt) > 1e-3 || Math.abs(smile.x) > 2e-3 || Math.abs(pucker.x) > 2e-3;
    if (active || deformed) {
      deform(noseAmt);
      deformed = active;
      // Forget pulls that have settled.
      for (let i = pulls.length - 1; i >= 0; i--) {
        const p = pulls[i];
        if (p.released && p.offset.lengthSq() < 1e-8 && p.speed.lengthSq() < 1e-6) pulls.splice(i, 1);
      }
    }

    renderer.render(scene, camera);
    raf = requestAnimationFrame(step);
  };

  function deform(noseAmt) {
    const arr = positions.array;
    const put = (idx) => {
      for (let j = 0; j < idx.length; j++) {
        const i = idx[j] * 3;
        arr[i] = rest[i];
        arr[i + 1] = rest[i + 1];
        arr[i + 2] = rest[i + 2];
      }
    };
    put(nose.idx);
    put(mouth.idx);
    for (const p of pulls) put(p.idx);

    const s = smile.x,
      k = pucker.x,
      m = FACE.mouth;
    if (Math.abs(s) > 2e-3 || Math.abs(k) > 2e-3) {
      const { idx, wl, wr, wk, wc } = mouth;
      for (let j = 0; j < idx.length; j++) {
        const i = idx[j] * 3;
        arr[i] += s * 0.022 * (wr[j] - wl[j]);
        arr[i + 1] += s * (0.045 * (wl[j] + wr[j]) + 0.016 * wk[j]);
        arr[i + 2] += s * 0.012 * wk[j] + k * 0.03 * wc[j];
        arr[i] = arr[i] + (m.x - arr[i]) * 0.5 * k * wc[j];
      }
    }
    if (Math.abs(noseAmt) > 1e-3) {
      // The nose grows forward and droops a little under its own weight.
      const { idx, w, dx } = nose;
      const droop = 0.015 + 0.05 * Math.min(Math.max(noseAmt, 0), 1.2);
      for (let j = 0; j < idx.length; j++) {
        const i = idx[j] * 3,
          a = noseAmt * w[j];
        arr[i] += dx[j] * 0.45 * a;
        arr[i + 1] -= droop * a;
        arr[i + 2] += 0.42 * a;
      }
    }
    for (const p of pulls)
      for (let j = 0; j < p.idx.length; j++) {
        const i = p.idx[j] * 3,
          k2 = p.w[j];
        arr[i] += p.offset.x * k2;
        arr[i + 1] += p.offset.y * k2;
        arr[i + 2] += p.offset.z * k2;
      }
    positions.needsUpdate = true;
  }

  const start = () => {
    if (raf || !mesh) return;
    last = performance.now();
    raf = requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((entries) => {
    visible = entries.at(-1).isIntersecting; // the latest entry: several can arrive at once
    if (visible) start();
  });
  io.observe(stage);
  const onVisibility = () => !document.hidden && start();
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    removeEventListener("pointermove", onWindowMove);
    removeEventListener("pointerup", onUp);
    removeEventListener("pointercancel", onUp);
    stage.removeEventListener("wheel", onWheel);
    document.removeEventListener("visibilitychange", onVisibility);
    mesh?.geometry.dispose();
    mesh?.material.map?.dispose();
    mesh?.material.dispose();
    renderer.dispose();
    canvas.remove();
  };
}
