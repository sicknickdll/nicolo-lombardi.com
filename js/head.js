// About page: Nicoló's 3D head (assets/about/head.glb) on the right half of the screen.
//   · The head turns to look at the cursor wherever it is on the page.
//   · Over the head the cursor becomes a hand: grab a point and pull, and the face stretches
//     like Mario's in Super Mario 64; let go and it springs back with a wobble.
//     Several pulls can wobble at once.
//   · Drag anywhere else on the right half to spin the head; it swings back on release.
// The scan has its eyes painted into the texture (no separate eyeballs), so the whole head
// does the looking. Three.js comes from js/vendor/three.js (see tools/vendor-three.mjs).
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  HemisphereLight,
  DirectionalLight,
  Group,
  Vector2,
  Vector3,
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
const PULL = {
  radius: 0.15, // reach of one pull, as a share of the head's height
  max: 0.6, // furthest the skin can be stretched
  stiffness: 140, // spring back after release …
  damping: 6.5, // … and how quickly the wobble dies out
};
const LOOK = { yaw: 0.65, pitch: 0.35 }; // furthest the head turns toward the cursor (radians)

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

  // pivot: where the head turns (look + spin); the mesh inside it is what gets stretched.
  const pivot = new Group();
  scene.add(pivot);

  let mesh = null,
    rest = null, // untouched vertex positions
    positions = null, // the ones drawn (rest + pulls)
    radii = new Vector3(0.5, 0.5, 0.5); // head ellipsoid for hit tests
  const pulls = [];

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
      // baked in, so stretching can work directly in head space.
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
      pivot.add(mesh);
      stage.classList.add("ready");
      start();
    },
    undefined,
    () => stage.classList.add("failed"),
  );

  // ── pointer ──
  const pointer = new Vector2(),
    raycaster = new Raycaster(),
    inverse = new Matrix4(),
    look = { x: 0, y: 0 }, // where the cursor asks the head to look (-1…1)
    turn = { yaw: 0, pitch: 0, vy: 0, vp: 0 }, // current head turn + its speed
    spin = { yaw: 0, pitch: 0 }; // extra turn from dragging next to the head
  let drag = null,
    lastMove = performance.now(),
    hovering = false;

  const toNDC = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  // Where the ray under the cursor first touches the head, in head space (or null).
  // The head is treated as an ellipsoid: exact enough to grab, and far cheaper than
  // testing 100k triangles on every mouse move.
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

  const onWindowMove = (e) => {
    lastMove = performance.now();
    const r = canvas.getBoundingClientRect(),
      cx = r.left + r.width / 2,
      cy = r.top + r.height * 0.45;
    look.x = Math.tanh((e.clientX - cx) / (innerWidth * 0.3));
    look.y = Math.tanh((e.clientY - cy) / (innerHeight * 0.35));
    if (drag) moveDrag(e);
  };
  const onStageMove = (e) => {
    if (drag || e.pointerType !== "mouse") return;
    toNDC(e);
    const over = Boolean(hitHead());
    if (over !== hovering) stage.classList.toggle("over", (hovering = over));
  };
  const onStageLeave = () => {
    if (hovering) stage.classList.remove("over");
    hovering = false;
  };

  const onDown = (e) => {
    if (!mesh || drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    toNDC(e);
    const hit = hitHead();
    stage.setPointerCapture?.(e.pointerId);
    stage.classList.add("grabbing", "played");
    if (hit) {
      // Pull: every vertex near the grabbed point follows it, less the further it is.
      const sigma2 = 2 * PULL.radius * PULL.radius,
        cutoff = PULL.radius * 2.6,
        idx = [],
        w = [];
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
      const pull = {
        idx: Uint32Array.from(idx),
        w: Float32Array.from(w),
        offset: new Vector3(),
        speed: new Vector3(),
        target: new Vector3(),
        grab: hit,
        plane: new Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new Vector3()).negate(), world),
      };
      pulls.push(pull);
      drag = { type: "pull", pull, id: e.pointerId };
    } else {
      drag = { type: "spin", x: e.clientX, y: e.clientY, yaw: spin.yaw, pitch: spin.pitch, id: e.pointerId };
    }
    e.preventDefault();
  };
  const moveDrag = (e) => {
    if (e.pointerId !== drag.id) return;
    if (drag.type === "spin") {
      spin.yaw = drag.yaw + (e.clientX - drag.x) * 0.012;
      spin.pitch = Math.max(-1.1, Math.min(1.1, drag.pitch + (e.clientY - drag.y) * 0.008));
      return;
    }
    toNDC(e);
    raycaster.setFromCamera(pointer, camera);
    const p = raycaster.ray.intersectPlane(drag.pull.plane, new Vector3());
    if (!p) return;
    pivot.worldToLocal(p).sub(drag.pull.grab);
    if (p.length() > PULL.max) p.setLength(PULL.max);
    drag.pull.target.copy(p);
  };
  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.type === "pull") drag.pull.released = true;
    else {
      // Let the spin swing back toward where the cursor is.
      turn.yaw += spin.yaw;
      turn.pitch += spin.pitch;
      spin.yaw = spin.pitch = 0;
    }
    drag = null;
    stage.classList.remove("grabbing");
    stage.releasePointerCapture?.(e.pointerId);
  };

  addEventListener("pointermove", onWindowMove, { passive: true });
  stage.addEventListener("pointermove", onStageMove, { passive: true });
  stage.addEventListener("pointerleave", onStageLeave);
  stage.addEventListener("pointerdown", onDown);
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

    // Head turn: a soft spring toward the cursor (a little overshoot when it swings back).
    const idle = !reduce && now - lastMove > 2500 && !drag ? now / 1000 : 0;
    const wantYaw = look.x * LOOK.yaw + (idle ? Math.sin(idle * 0.6) * 0.12 : 0),
      wantPitch = look.y * LOOK.pitch + (idle ? Math.sin(idle * 0.45) * 0.05 : 0);
    turn.vy += ((wantYaw - turn.yaw) * 55 - turn.vy * 11) * dt;
    turn.vp += ((wantPitch - turn.pitch) * 55 - turn.vp * 11) * dt;
    turn.yaw += turn.vy * dt;
    turn.pitch += turn.vp * dt;
    // While stretching, the head leans a little toward the pull.
    const lean = drag?.type === "pull" ? drag.pull.offset : null;
    pivot.rotation.set(
      turn.pitch + spin.pitch + (lean ? -lean.y * 0.35 : 0),
      turn.yaw + spin.yaw + (lean ? lean.x * 0.45 : 0),
      lean ? -lean.x * 0.1 : 0,
    );
    if (!reduce) pivot.position.y = Math.sin(now / 1400) * 0.008;

    // Pulls: follow the cursor while held, then wobble back to rest.
    if (pulls.length) {
      for (const p of pulls) {
        if (!p.released) {
          p.speed.subVectors(p.target, p.offset).multiplyScalar(1 / Math.max(dt, 1e-3) * 0.4);
          p.offset.lerp(p.target, 0.4);
        } else {
          p.speed.addScaledVector(p.offset, -PULL.stiffness * dt).multiplyScalar(Math.exp(-PULL.damping * dt));
          p.offset.addScaledVector(p.speed, dt);
        }
      }
      const arr = positions.array;
      for (const p of pulls)
        for (let j = 0; j < p.idx.length; j++) {
          const i = p.idx[j] * 3;
          arr[i] = rest[i];
          arr[i + 1] = rest[i + 1];
          arr[i + 2] = rest[i + 2];
        }
      for (const p of pulls)
        for (let j = 0; j < p.idx.length; j++) {
          const i = p.idx[j] * 3,
            k = p.w[j];
          arr[i] += p.offset.x * k;
          arr[i + 1] += p.offset.y * k;
          arr[i + 2] += p.offset.z * k;
        }
      positions.needsUpdate = true;
      // Forget pulls that have settled.
      for (let i = pulls.length - 1; i >= 0; i--) {
        const p = pulls[i];
        if (p.released && p.offset.lengthSq() < 1e-8 && p.speed.lengthSq() < 1e-6) {
          for (const v of p.idx) {
            arr[v * 3] = rest[v * 3];
            arr[v * 3 + 1] = rest[v * 3 + 1];
            arr[v * 3 + 2] = rest[v * 3 + 2];
          }
          pulls.splice(i, 1);
        }
      }
    }

    renderer.render(scene, camera);
    raf = requestAnimationFrame(step);
  };
  const start = () => {
    if (raf || !mesh) return;
    last = performance.now();
    raf = requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
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
    document.removeEventListener("visibilitychange", onVisibility);
    mesh?.geometry.dispose();
    mesh?.material.map?.dispose();
    mesh?.material.dispose();
    renderer.dispose();
    canvas.remove();
  };
}
