// The Tarot Reader's room: a three.js scene rendered small and scaled up without smoothing
// (an old-console look), then dithered, vignetted and grained in one post pass. The card being
// looked at up close is drawn again on top at full resolution ("hero" layer), so the artwork
// stays crisp while the room stays rough.
//
//   table, reading cloth, two candles (one casts real shadows), an hourglass, coins, petals,
//   dust in the candlelight, her silhouette, her eyes (js/tarot/eyes.js), her hands
//   (js/tarot/hands.js). Camera: fixed first-person shots with breathing, a little mouse
//   parallax and small reactions (shake, nudge, push).
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  OrthographicCamera,
  WebGLRenderTarget,
  Mesh,
  Group,
  PlaneGeometry,
  BoxGeometry,
  CylinderGeometry,
  LatheGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  MeshLambertMaterial,
  MeshBasicMaterial,
  ShaderMaterial,
  PointsMaterial,
  Points,
  PointLight,
  AmbientLight,
  Color,
  Fog,
  Vector2,
  Vector3,
  Raycaster,
  Plane,
  NearestFilter,
  AdditiveBlending,
  DoubleSide,
} from "../vendor/three.js";
import { createClock, approach, clamp, lerp, wobble } from "./tween.js";
import { woodTexture, clothTexture, flameTexture, glowTexture, silhouetteTexture } from "./textures.js";
import { createEyes } from "./eyes.js";
import { createHand, handMaterials } from "./hands.js";

export const HERO = 1; // layer drawn crisp, on top
const BG = 0x040203;
export const CARD_W = 0.16,
  CARD_H = 0.16 / 0.5625,
  CARD_T = 0.0034;

// Where things go on the table, for wide and tall screens. z grows toward the player.
export function layoutFor(aspect) {
  const tall = aspect < 0.82;
  if (!tall) {
    const cz = -0.2,
      sx = 0.2,
      sz = 0.304;
    return {
      tall,
      cz,
      cross: { past: [-sx, cz], present: [0, cz], future: [sx, cz], shadow: [0, cz + sz], potential: [0, cz - sz] },
      guide: { at: [-0.58, cz - 0.02], yaw: 0.07 },
      deck: [0, cz],
      cutAside: [-0.32, cz + 0.02],
      fan: (n) => arc(n, [0, -1.93], 1.1, 0.6),
      shots: {
        wide: { pos: [0, 0.62, 1.25], target: [0, 0.16, -0.95], fov: 48 },
        table: { pos: [0, 0.8, 0.86], target: [0, 0.0, -0.42], fov: 58 },
        cut: { pos: [0, 0.24, 0.4 + cz], target: [0, -0.035, cz - 0.02], fov: 44 },
        final: { pos: [0, 0.78, 0.8], target: [0, 0.0, -0.44], fov: 54 },
      },
    };
  }
  const cz = 0.02,
    sx = 0.19,
    sz = 0.31;
  return {
    tall,
    cz,
    cross: { past: [-sx, cz], present: [0, cz], future: [sx, cz], shadow: [0, cz + sz], potential: [0, cz - sz] },
    guide: { at: [-0.245, cz - sz - 0.01], yaw: 0.1 },
    deck: [0, cz],
    cutAside: [-0.24, cz + 0.05],
    fan: (n) => rows(n, cz),
    shots: {
      wide: { pos: [0, 0.95, 1.5], target: [0, 0.16, -0.8], fov: 66 },
      table: { pos: [0, 1.6, 1.3], target: [0, 0.0, 0.07], fov: 66 },
      cut: { pos: [0, 0.3, 0.52 + cz], target: [0, -0.03, cz - 0.02], fov: 56 },
      final: { pos: [0, 1.6, 1.3], target: [0, 0.0, 0.07], fov: 62 },
    },
  };
}
// A fan: cards on an arc whose centre is on her side of the table.
function arc(n, [cx, cz], r, spread) {
  return Array.from({ length: n }, (_, i) => {
    const a = n > 1 ? lerp(-spread, spread, i / (n - 1)) : 0;
    return { x: cx + Math.sin(a) * r, z: cz + Math.cos(a) * r, yaw: -a, y: i * 0.0016 };
  });
}
// On a tall screen: two overlapping rows.
function rows(n, cz) {
  const per = Math.ceil(n / 2);
  return Array.from({ length: n }, (_, i) => {
    const row = i < per ? 1 : 0,
      k = row ? i : i - per,
      m = row ? per : n - per;
    const x = m > 1 ? lerp(-0.37, 0.37, k / (m - 1)) : 0;
    return { x, z: cz - 0.67 - (row ? 0 : 0.2) + Math.abs(x) * 0.08, yaw: -x * 0.25, y: (row ? 0.02 : 0) + k * 0.0016 };
  });
}

const POST_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FRAG = `
precision highp float;
uniform sampler2D tScene; uniform vec2 uRes; uniform float uTime, uFade, uVig, uGrain, uLevels, uGlitch;
varying vec2 vUv;
float bayer(vec2 p){ p = mod(p, 4.0);
  float b = mod(p.x,2.0)*2.0 + mod(p.y,2.0)*3.0 - 2.0*mod(p.x,2.0)*mod(p.y,2.0);
  float c = floor(p.x/2.0)*2.0 + floor(p.y/2.0)*3.0 - 2.0*floor(p.x/2.0)*floor(p.y/2.0);
  return (b*4.0 + c + 0.5) / 16.0; }
vec3 srgb(vec3 c){ return mix(c*12.92, 1.055*pow(max(c,vec3(0.0)), vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec2 uv = vUv;
  if (uGlitch > 0.0) { // torn rows, shifted colours
    float band = floor(vUv.y * 22.0);
    float r = fract(sin(band * 91.7 + floor(uTime * 24.0) * 3.1) * 43758.5453);
    uv.x += (r - 0.5) * 0.18 * uGlitch * step(0.55, r);
  }
  vec2 px = floor(uv * uRes);
  vec3 c = srgb(texture2D(tScene, (px + 0.5) / uRes).rgb);
  if (uGlitch > 0.0) {
    c.r = srgb(texture2D(tScene, (px + vec2(4.0 * uGlitch, 0.0) + 0.5) / uRes).rgb).r;
    c.b = srgb(texture2D(tScene, (px - vec2(4.0 * uGlitch, 1.0) + 0.5) / uRes).rgb).b;
  }
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c * vec3(1.12, 0.9, 0.92) + vec3(0.006, 0.0, 0.003), c, smoothstep(0.02, 0.4, l)); // crimson in the dark
  c = floor(c * uLevels + bayer(px) ) / uLevels;                                                // dither + few colours
  vec2 q = (vUv - 0.5) * vec2(1.05, 1.2);
  c *= clamp(1.0 - dot(q, q) * uVig, 0.0, 1.0);
  float n = fract(sin(dot(px + floor(uTime * 18.0) * vec2(17.0, 31.0), vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * uGrain;
  c *= 0.975 + 0.025 * sin(gl_FragCoord.y * 3.14159);
  gl_FragColor = vec4(c * uFade, 1.0);
}`;

export function createStage(container, { reduce = false, low = false } = {}) {
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.autoUpdate = false;
  renderer.autoClear = false;
  container.append(renderer.domElement);
  const clock = createClock();

  const scene = new Scene();
  scene.background = new Color(BG);
  scene.fog = new Fog(BG, 2.0, 3.6);
  const camera = new PerspectiveCamera(50, 1, 0.03, 12);
  camera.layers.enable(0);
  const heroCam = camera.clone();
  heroCam.layers.set(HERO);

  const rt = new WebGLRenderTarget(4, 4, { minFilter: NearestFilter, magFilter: NearestFilter });
  const post = new ShaderMaterial({
    vertexShader: POST_VERT,
    fragmentShader: POST_FRAG,
    uniforms: {
      tScene: { value: rt.texture },
      uRes: { value: new Vector2(4, 4) },
      uTime: { value: 0 },
      uFade: { value: 0 },
      uVig: { value: 1.25 },
      uGrain: { value: 0.055 },
      uLevels: { value: 30 },
      uGlitch: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const postScene = new Scene();
  postScene.add(new Mesh(new PlaneGeometry(2, 2), post));
  const postCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ── lights ──
  const ambient = new AmbientLight(0x5a1a22, 0.55);
  scene.add(ambient);
  const candles = [];
  const flameTex = flameTexture(),
    glowTex = glowTexture("rgba(255,170,90,0.9)");
  const wax = new MeshLambertMaterial({ color: 0xd8c6a0, emissive: 0x2a1406 });
  const brass = new MeshLambertMaterial({ color: 0x8a6430, emissive: 0x120a03 });
  const dark = new MeshLambertMaterial({ color: 0x1a0d08 });
  function candle(x, z, h, shadows) {
    const g = new Group();
    g.position.set(x, 0, z);
    const dish = new Mesh(
      new LatheGeometry([new Vector2(0.0, 0), new Vector2(0.07, 0.004), new Vector2(0.078, 0.014), new Vector2(0.07, 0.016), new Vector2(0.04, 0.018), new Vector2(0.0, 0.02)], 10),
      brass,
    );
    dish.castShadow = dish.receiveShadow = true;
    const body = new Mesh(new CylinderGeometry(0.03, 0.033, h, 9), wax);
    // wax drips: bulge the side a little at random heights
    const p = body.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > h / 2 - 0.002) p.setY(i, y - Math.random() * 0.012);
      const k = 1 + (Math.random() - 0.5) * 0.12;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
    body.geometry.computeVertexNormals();
    body.position.y = 0.02 + h / 2;
    body.castShadow = !shadows;
    body.receiveShadow = true;
    const wick = new Mesh(new CylinderGeometry(0.002, 0.002, 0.016, 4), dark);
    wick.position.y = 0.02 + h + 0.004;
    const flame = new Mesh(new PlaneGeometry(0.032, 0.064), new MeshBasicMaterial({ map: flameTex, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false }));
    flame.position.y = 0.02 + h + 0.03;
    const glow = new Mesh(new PlaneGeometry(0.42, 0.42), new MeshBasicMaterial({ map: glowTex, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0.35, fog: false }));
    glow.position.y = flame.position.y;
    const light = new PointLight(0xffa155, 1, 0, 1.25);
    light.position.y = 0.02 + h + 0.05;
    light.layers.enableAll();
    if (shadows && !low) {
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      light.shadow.camera.near = 0.03;
      light.shadow.camera.far = 4;
      light.shadow.bias = -0.0015;
      light.shadow.normalBias = 0.004;
    }
    g.add(dish, body, wick, glow, flame, light);
    scene.add(g);
    const c = { g, flame, glow, light, base: 1, seed: Math.random() * 10, x, z, bend: 0, top: light.position.y };
    candles.push(c);
    return c;
  }
  // ── table and props ──
  const TABLE = { x0: -1.6, x1: 1.6, z0: -1.15, z1: 0.8 };
  const tw = TABLE.x1 - TABLE.x0,
    td = TABLE.z1 - TABLE.z0;
  const mark = (x, z) => ({ u: (x - TABLE.x0) / tw, v: (z - TABLE.z0) / td });
  const woodTex = woodTexture([mark(-1.0, -0.62), mark(1.02, -0.78)]);
  const woodTop = new MeshLambertMaterial({ map: woodTex });
  const woodSide = new MeshLambertMaterial({ color: 0x1c0e09 });
  const table = new Mesh(new BoxGeometry(tw, 0.08, td), [woodSide, woodSide, woodTop, woodSide, woodSide, woodSide]);
  table.position.set((TABLE.x0 + TABLE.x1) / 2, -0.04, (TABLE.z0 + TABLE.z1) / 2);
  table.receiveShadow = true;
  scene.add(table);
  const clothTex = clothTexture();
  const cloth = new Mesh(new PlaneGeometry(1.0, 1.16), new MeshLambertMaterial({ map: clothTex }));
  cloth.rotation.x = -Math.PI / 2;
  cloth.receiveShadow = true;
  scene.add(cloth);
  candle(-1.0, -0.62, 0.2, true);
  candle(1.02, -0.78, 0.13, false);

  const props = new Group();
  scene.add(props);
  {
    // hourglass, front right
    const hg = new Group();
    hg.position.set(1.08, 0, 0.2);
    hg.rotation.y = 0.4;
    const woodDark = new MeshLambertMaterial({ color: 0x3a2214 });
    for (const y of [0.005, 0.175]) {
      const cap = new Mesh(new CylinderGeometry(0.06, 0.06, 0.012, 8), woodDark);
      cap.position.y = y;
      cap.castShadow = cap.receiveShadow = true;
      hg.add(cap);
    }
    for (let i = 0; i < 3; i++) {
      const post = new Mesh(new CylinderGeometry(0.005, 0.005, 0.17, 5), woodDark);
      const a = (i / 3) * Math.PI * 2;
      post.position.set(Math.cos(a) * 0.05, 0.09, Math.sin(a) * 0.05);
      post.castShadow = true;
      hg.add(post);
    }
    const bulb = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      bulb.push(new Vector2(0.004 + Math.sin(t * Math.PI) * 0.034 + (t > 0.9 ? 0.0 : 0), t * 0.08));
    }
    const glass = new MeshLambertMaterial({ color: 0xcdbb98, transparent: true, opacity: 0.28, emissive: 0x150b04, side: DoubleSide, depthWrite: false });
    const lower = new Mesh(new LatheGeometry(bulb, 9), glass);
    lower.position.y = 0.011;
    const upper = lower.clone();
    upper.rotation.x = Math.PI;
    upper.position.y = 0.169;
    const sandMat = new MeshLambertMaterial({ color: 0xb98a4f });
    const sand = new Mesh(new CylinderGeometry(0.005, 0.03, 0.03, 8), sandMat);
    sand.position.y = 0.026;
    const sandTop = new Mesh(new CylinderGeometry(0.026, 0.005, 0.025, 8), sandMat);
    sandTop.position.y = 0.112;
    hg.add(lower, upper, sand, sandTop);
    props.add(hg);
    // coins, front left
    const coinMat = new MeshLambertMaterial({ color: 0x9d7637, emissive: 0x140b02 });
    for (let i = 0; i < 4; i++) {
      const coin = new Mesh(new CylinderGeometry(0.022, 0.022, 0.004, 10), coinMat);
      coin.position.set(-1.1 + (i === 3 ? 0.06 : (Math.random() - 0.5) * 0.004), 0.002 + (i === 3 ? 0 : i * 0.0042), 0.24 + (i === 3 ? 0.03 : 0));
      coin.castShadow = coin.receiveShadow = true;
      props.add(coin);
    }
    // dried rose petals
    const petal = new MeshLambertMaterial({ color: 0x5e0f16, side: DoubleSide });
    for (let i = 0; i < 6; i++) {
      const pt = new Mesh(new PlaneGeometry(0.018, 0.012), petal);
      pt.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.3, 0, Math.random() * 6);
      pt.position.set(-0.98 + (Math.random() - 0.5) * 0.14, 0.0015, 0.04 + (Math.random() - 0.5) * 0.12);
      props.add(pt);
    }
  }

  // ── her ──
  const silhouette = new Mesh(
    new PlaneGeometry(1.5, 1.5),
    new MeshBasicMaterial({ map: silhouetteTexture(), transparent: true, depthWrite: false, fog: false, opacity: 0.32 }),
  );
  silhouette.position.set(0, 0.2, -1.76);
  silhouette.visible = false; // she is never seen: only her eyes and her hands
  silhouette.scale.setScalar(0.94);
  scene.add(silhouette);
  const eyes = createEyes({ reduce });
  eyes.group.position.set(0, 0.43, -1.68);
  scene.add(eyes.group);
  const hm = handMaterials();
  const hands = {
    right: createHand({ side: -1, shoulder: new Vector3(-0.27, 0.2, -1.66), materials: hm, ring: true }),
    left: createHand({ side: 1, shoulder: new Vector3(0.27, 0.2, -1.66), materials: hm }),
  };
  scene.add(hands.right.root, hands.left.root);

  // ── dust in the candlelight ──
  const DUST = low ? 40 : 110;
  const dustPos = new Float32Array(DUST * 3),
    dustCol = new Float32Array(DUST * 3),
    dustVel = [];
  for (let i = 0; i < DUST; i++) {
    dustPos.set([(Math.random() - 0.5) * 2.6, Math.random() * 0.8, -1.2 + Math.random() * 1.6], i * 3);
    dustVel.push([(Math.random() - 0.5) * 0.01, (Math.random() - 0.3) * 0.006, (Math.random() - 0.5) * 0.01]);
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute("position", new Float32BufferAttribute(dustPos, 3));
  dustGeo.setAttribute("color", new Float32BufferAttribute(dustCol, 3));
  const dust = new Points(
    dustGeo,
    new PointsMaterial({ size: 0.012, map: glowTexture("rgba(255,220,170,1)", 16), vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false }),
  );
  scene.add(dust);

  // ── camera ──
  let layout = layoutFor(1.6);
  const shot = { pos: new Vector3(...layout.shots.wide.pos), target: new Vector3(...layout.shots.wide.target), fov: layout.shots.wide.fov };
  let shotName = "wide";
  const fx = {
    push: 0, // 0..1: lean toward the target
    pushTo: 0,
    shake: 0,
    tilt: 0,
    tiltTo: 0,
    nudge: 0,
    parallax: new Vector2(),
    parallaxTo: new Vector2(),
    // lights
    boost: 1,
    boostTo: 1,
    warm: 0,
    warmTo: 0,
    flicker: 0,
    sway: 0,
    dark: 0, // final reading: the room darkens around the spread
    darkTo: 0,
    level: 0, // all the room's light: 0 before the candles are lit
    levelTo: 0,
    levelSpeed: 1,
    kill: 0, // the neck snaps: the camera rolls and drops
  };
  // a low lamp out of sight above the table, so the spread is never lost in the dark
  const lamp = new PointLight(0xffb878, 0.2, 0, 1.4);
  lamp.position.set(0, 1.0, 0.25);
  lamp.layers.enableAll();
  scene.add(lamp);
  const spreadLight = new PointLight(0xffc48a, 0, 0, 1.6);
  spreadLight.layers.enableAll();
  scene.add(spreadLight);
  const readLight = new PointLight(0xffd9a8, 0, 0, 2); // lights a card held up close
  readLight.layers.enableAll();
  scene.add(readLight);
  let readTo = 0;

  function setShot(name, ms = 1200) {
    const s = layout.shots[name];
    if (!s) return Promise.resolve();
    shotName = name;
    const p0 = shot.pos.clone(),
      t0 = shot.target.clone(),
      f0 = shot.fov;
    const p1 = new Vector3(...s.pos),
      t1 = new Vector3(...s.target);
    if (ms <= 0 || reduce) {
      shot.pos.copy(p1);
      shot.target.copy(t1);
      shot.fov = s.fov;
      return Promise.resolve();
    }
    return clock.tween(ms, (k) => {
      shot.pos.lerpVectors(p0, p1, k);
      shot.target.lerpVectors(t0, t1, k);
      shot.fov = lerp(f0, s.fov, k);
    });
  }

  // ── sizing ──
  let W = 1,
    H = 1,
    dpr = 1;
  function resize() {
    const r = container.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    dpr = Math.min(2, devicePixelRatio || 1);
    renderer.setSize(W * dpr, H * dpr, false);
    renderer.domElement.style.width = W + "px";
    renderer.domElement.style.height = H + "px";
    const px = clamp(Math.min(H, W * 1.6) / 420, 1.4, 3); // CSS pixels per rendered pixel
    const rw = Math.round(W / px),
      rh = Math.round(H / px);
    rt.setSize(rw, rh);
    post.uniforms.uRes.value.set(rw, rh);
    camera.aspect = heroCam.aspect = W / H;
    const was = layout.tall;
    layout = layoutFor(W / H);
    // Frame the table shots for this screen: her eyes just under the top edge, the bottom card of
    // the cross clear of the dialogue box and the buttons.
    const lowEdge = [0, 0, layout.cross.shadow[1] + CARD_H / 2 + 0.02];
    const box = H <= 720 ? 108 : 124;
    layout.shots.table = frameShot(layout.shots.table, [0, 0.52, -1.68], lowEdge, 26, 16 + box + 92);
    layout.shots.final = frameShot(layout.shots.final, [0, 0.52, -1.68], lowEdge, 22, 16 + box + 18);
    const s = layout.shots[shotName];
    if (was !== layout.tall || !setShot.started) (shot.pos.set(...s.pos), shot.target.set(...s.target), (shot.fov = s.fov));
    setShot.started = true;
    cloth.position.set(0, 0.0008, layout.cz + (layout.tall ? -0.02 : 0));
    cloth.scale.setScalar(layout.tall ? 0.95 : 1);
    onResize.forEach((f) => f(layout));
  }
  const onResize = new Set();

  // Solve for the pitch and vertical field of view that put `top` `mTop` px under the top edge
  // and `bottom` `mBot` px above the bottom edge (both points on the centre line, x = 0).
  function frameShot(shot, top, bottom, mTop, mBot) {
    const [px, py, pz] = shot.pos;
    const ang = ([, y, z]) => Math.atan2(py - y, pz - z);
    const aA = ang(top),
      aB = ang(bottom);
    const yA = -1 + (2 * mTop) / H,
      yB = 1 - (2 * mBot) / H;
    let lo = 25,
      hi = 110,
      pitch = 0;
    for (let i = 0; i < 40; i++) {
      const f = (lo + hi) / 2,
        t = Math.tan((f * Math.PI) / 360);
      pitch = aA - Math.atan(yA * t);
      if (Math.tan(aB - pitch) / t > yB) lo = f;
      else hi = f;
    }
    const t = Math.tan((hi * Math.PI) / 360);
    pitch = aA - Math.atan(yA * t);
    const d = py / Math.sin(pitch);
    return { pos: shot.pos, target: [px, py - Math.sin(pitch) * d, pz - Math.cos(pitch) * d], fov: hi };
  }

  // ── picking ──
  const ray = new Raycaster();
  ray.layers.enableAll();
  const ndc = new Vector2();
  function toNdc(x, y) {
    const r = renderer.domElement.getBoundingClientRect();
    return ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }
  function hit(x, y, objects) {
    ray.setFromCamera(toNdc(x, y), camera);
    return ray.intersectObjects(objects, true)[0] || null;
  }
  const plane = new Plane(new Vector3(0, 1, 0), 0);
  function onTable(x, y, height = 0) {
    ray.setFromCamera(toNdc(x, y), camera);
    plane.constant = -height;
    const p = new Vector3();
    return ray.ray.intersectPlane(plane, p) ? p : null;
  }
  // Screen position (CSS px) of a world point.
  function toScreen(v) {
    const p = v.clone().project(camera);
    return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, ndc: p };
  }

  // ── effects ──
  function react(name) {
    if (!name) return;
    if (name === "flare") (fx.boost = 1.9), (fx.boostTo = 1);
    if (name === "warm") (fx.warmTo = 1), setTimeout(() => (fx.warmTo = 0), 4200);
    if (name === "flicker") fx.flicker = 1.6;
    if (name === "dim") (fx.boostTo = 0.55), setTimeout(() => (fx.boostTo = 1), 2400);
    if (name === "shift") fx.sway = 2.4;
  }
  function cameraFx(name) {
    if (reduce || !name) return;
    if (name === "shake") fx.shake = 1;
    if (name === "nudge") fx.nudge = 1;
    if (name === "tilt") (fx.tiltTo = 0.05), setTimeout(() => (fx.tiltTo = 0), 1800);
  }

  // ── loop ──
  let raf = 0,
    last = performance.now(),
    time = 0,
    running = true,
    frozen = false,
    fadeTo = 0;
  const beforeRender = new Set();
  const look = new Vector3(),
    tmp = new Vector3();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!running) return;
    time += dt;
    clock.tick(dt * 1000);
    beforeRender.forEach((f) => f(dt, time));

    // lights: candle flicker, reactions, the darkened room of the final reading
    fx.boost = approach(fx.boost, fx.boostTo, 1.6, dt);
    fx.warm = approach(fx.warm, fx.warmTo, 0.9, dt);
    fx.flicker = Math.max(0, fx.flicker - dt);
    fx.sway = Math.max(0, fx.sway - dt);
    fx.dark = approach(fx.dark, fx.darkTo, 1.2, dt);
    fx.level = approach(fx.level, fx.levelTo, fx.levelSpeed, dt);
    const lit = fx.level;
    for (const c of candles) {
      let near = 0;
      for (const h of [hands.left, hands.right]) near = Math.max(near, 1 - clamp(h.position.distanceTo(c.g.position) / 0.5, 0, 1));
      const f = wobble(time * (2.2 + near * 3), c.seed) * (0.08 + near * 0.12) + (fx.flicker > 0 ? (Math.random() - 0.5) * 0.9 * fx.flicker : 0);
      const lvl = (c === candles[0] ? 1.15 : 0.8) * fx.boost * (1 - fx.dark * (c === candles[0] ? 0.35 : 0.55)) * (1 + f);
      c.light.intensity = Math.max(0.05, lvl) * lit;
      c.light.color.setRGB(1, lerp(0.62, 0.7, fx.warm), lerp(0.33, 0.42, fx.warm));
      c.bend = approach(c.bend, (fx.sway > 0 ? Math.sin(time * 3) * 0.4 : 0) + near * Math.sin(time * 9) * 0.25, 6, dt);
      c.flame.scale.set((1 + f * 0.6) * lit, (1 + f * 1.4 + fx.warm * 0.15) * lit, 1);
      c.flame.visible = lit > 0.02;
      c.flame.rotation.z = c.bend * 0.6;
      c.glow.material.opacity = 0.28 * Math.max(0.2, lvl) * lit;
      c.light.position.x = c.bend * 0.05;
      c.flame.lookAt(camera.position);
      c.flame.rotation.z += c.bend * 0.5;
      c.glow.lookAt(camera.position);
    }
    ambient.intensity = (0.55 + fx.warm * 0.15) * (1 - fx.dark * 0.6) * lit;
    lamp.intensity = 0.2 * lit * (1 - fx.dark * 0.5);
    silhouette.material.opacity = 0.26 * lit;
    wax.emissiveIntensity = lit;
    hands.left.root.visible = hands.right.root.visible = lit > 0.01;
    spreadLight.intensity = approach(spreadLight.intensity, fx.darkTo * 0.22, 1.5, dt);
    spreadLight.position.set(0, 0.55, layout.cz);
    readLight.intensity = approach(readLight.intensity, readTo, 4, dt);

    // camera: the shot, breathing, parallax, reactions
    fx.push = approach(fx.push, fx.pushTo, 1.6, dt);
    fx.shake = Math.max(0, fx.shake - dt * 1.8);
    fx.nudge = Math.max(0, fx.nudge - dt * 1.4);
    fx.tilt = approach(fx.tilt, fx.tiltTo, 2, dt);
    fx.parallax.x = approach(fx.parallax.x, fx.parallaxTo.x, 2.5, dt);
    fx.parallax.y = approach(fx.parallax.y, fx.parallaxTo.y, 2.5, dt);
    const breathe = reduce ? 0 : 1;
    camera.position.copy(shot.pos);
    look.copy(shot.target);
    tmp.subVectors(look, camera.position);
    camera.position.addScaledVector(tmp, fx.push * 0.16 + Math.sin(fx.nudge * Math.PI) * 0.03);
    camera.position.y += Math.sin(time * 1.15) * 0.0045 * breathe;
    camera.position.x += fx.parallax.x * 0.035 * breathe;
    camera.position.y += fx.parallax.y * 0.02 * breathe;
    if (fx.shake > 0) {
      const s = fx.shake * fx.shake * 0.012;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
    }
    camera.position.y -= fx.kill * 0.13;
    camera.position.x += fx.kill * 0.05;
    look.y -= fx.kill * 0.25;
    camera.lookAt(look);
    camera.rotation.z += fx.kill * 1.35;
    camera.rotation.z += fx.tilt + Math.sin(time * 0.6) * 0.002 * breathe;
    camera.fov = shot.fov;
    camera.updateProjectionMatrix();
    heroCam.position.copy(camera.position);
    heroCam.quaternion.copy(camera.quaternion);
    heroCam.fov = camera.fov;
    heroCam.aspect = camera.aspect;
    heroCam.updateProjectionMatrix();

    // her
    hands.left.update(dt);
    hands.right.update(dt);
    eyes.update(dt, camera.position);
    // dust: drifts, glows near the candles
    const pa = dustGeo.attributes.position,
      ca = dustGeo.attributes.color;
    for (let i = 0; i < DUST; i++) {
      const v = dustVel[i];
      let x = pa.getX(i) + v[0] * dt + Math.sin(time * 0.3 + i) * 0.0008,
        y = pa.getY(i) + v[1] * dt,
        z = pa.getZ(i) + v[2] * dt;
      if (y > 0.85) y = 0.02;
      if (y < 0.0) y = 0.8;
      if (x > 1.3) x = -1.3;
      if (x < -1.3) x = 1.3;
      pa.setXYZ(i, x, y, z);
      let b = 0;
      for (const c of candles) b += Math.max(0, 1 - Math.hypot(x - c.x, y - c.top, z - c.z) / 0.7) * c.light.intensity;
      b = Math.min(1, b * 0.9) * (0.6 + 0.4 * Math.sin(time * 2 + i)) * lit;
      ca.setXYZ(i, b, b * 0.75, b * 0.5);
    }
    pa.needsUpdate = ca.needsUpdate = true;

    // draw: the room, small → scaled up and treated → the hero layer, crisp, on top
    post.uniforms.uTime.value = time;
    post.uniforms.uFade.value = approach(post.uniforms.uFade.value, fadeTo, 1.1, dt);
    renderer.shadowMap.needsUpdate = true;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(postScene, postCam);
    renderer.clearDepth();
    const bg = scene.background,
      fog = scene.fog;
    scene.background = null;
    renderer.render(scene, heroCam);
    scene.background = bg;
    scene.fog = fog;
  }
  const onVis = () => {
    running = !document.hidden && !frozen;
    last = performance.now();
  };
  document.addEventListener("visibilitychange", onVis);
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  raf = requestAnimationFrame(frame);

  return {
    renderer,
    scene,
    camera,
    clock,
    eyes,
    hands,
    candles,
    fx,
    get layout() {
      return layout;
    },
    get size() {
      return { W, H };
    },
    get shot() {
      return shotName;
    },
    setShot,
    fade(to) {
      fadeTo = to;
    },
    // The end of a rude visitor: the camera snaps sideways and the picture tears.
    snapNeck() {
      clock.tween(170, (k) => (fx.kill = k), { ease: (t) => 1 - (1 - t) ** 4 });
      clock.tween(900, (k) => (post.uniforms.uGlitch.value = 0.4 + k * 0.8), { ease: (t) => t });
    },
    // Stop drawing: the last frame stays on screen.
    freeze() {
      running = false;
      frozen = true;
    },
    // Light the room (the candles) up to `level` 0..1, over about `seconds`.
    lights(level, seconds = 2) {
      fx.levelTo = level;
      fx.levelSpeed = seconds <= 0 ? 1000 : 2.5 / seconds;
    },
    react,
    cameraFx,
    readLight(on, at) {
      readTo = on ? 0.55 : 0;
      if (at) readLight.position.copy(at);
    },
    push(amount) {
      fx.pushTo = reduce ? 0 : amount;
    },
    darken(on) {
      fx.darkTo = on ? 1 : 0;
    },
    parallax(x, y) {
      fx.parallaxTo.set(x, y);
    },
    hit,
    onTable,
    toScreen,
    onFrame(f) {
      beforeRender.add(f);
      return () => beforeRender.delete(f);
    },
    onLayout(f) {
      onResize.add(f);
      return () => onResize.delete(f);
    },
    dispose() {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      clock.flush();
      eyes.dispose();
      hands.left.dispose();
      hands.right.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => (m.map?.dispose(), m.dispose()));
      });
      rt.dispose();
      post.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    },
  };
}
