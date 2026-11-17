// The fortune teller's hands: low-poly, long-fingered, pale, coming out of dark velvet sleeves
// that reach back into the dark to her shoulders (a two-bone arm, so they always look attached
// to someone sitting across the table).
//
// Each hand eases toward a target: a place and orientation on the table (set) or a card it is
// holding (follow), and a pose of the fingers (POSES). The choreography in js/tarot/deck.js tells
// them what to do; here they only know how to move.
import { Group, Object3D, Mesh, BoxGeometry, CylinderGeometry, MeshLambertMaterial, Vector3, Quaternion, Euler } from "../vendor/three.js";
import { approach } from "./tween.js";

// Finger curls, base → tip (radians), index → pinky; thumb: [swing out, fold in, bend, bend].
export const POSES = {
  relaxed: { f: [[0.28, 0.42, 0.28], [0.3, 0.48, 0.3], [0.34, 0.5, 0.32], [0.4, 0.55, 0.35]], spread: 0.06, thumb: [0.5, 0.2, 0.2, 0.2] },
  flat: { f: [[0.04, 0.05, 0.03], [0.03, 0.05, 0.03], [0.04, 0.05, 0.03], [0.06, 0.06, 0.04]], spread: 0.1, thumb: [0.7, 0.0, 0.1, 0.05] },
  grip: { f: [[0.55, 0.65, 0.4], [0.58, 0.7, 0.42], [0.6, 0.7, 0.42], [0.62, 0.72, 0.45]], spread: 0.02, thumb: [0.2, 0.7, 0.4, 0.3] },
  pinch: { f: [[0.62, 0.72, 0.5], [0.95, 1.15, 0.8], [1.1, 1.3, 0.9], [1.2, 1.4, 1.0]], spread: 0.0, thumb: [0.25, 0.85, 0.45, 0.4] },
  point: { f: [[0.0, 0.02, 0.0], [1.25, 1.5, 1.0], [1.3, 1.6, 1.0], [1.35, 1.6, 1.0]], spread: 0.02, thumb: [0.15, 0.9, 0.7, 0.6] },
  open: { f: [[0.1, 0.12, 0.08], [0.08, 0.1, 0.08], [0.1, 0.12, 0.1], [0.14, 0.14, 0.1]], spread: 0.2, thumb: [0.95, 0.0, 0.1, 0.0] },
  claw: { f: [[0.25, 0.95, 0.9], [0.22, 1.0, 0.95], [0.25, 1.0, 0.9], [0.3, 0.95, 0.9]], spread: 0.14, thumb: [0.6, 0.4, 0.6, 0.6] },
};
const FINGERS = [
  // x across the knuckles (toward the thumb = +), segment lengths, width
  { x: 0.025, len: [0.044, 0.029, 0.022], w: 0.0135 },
  { x: 0.008, len: [0.049, 0.032, 0.024], w: 0.014 },
  { x: -0.009, len: [0.045, 0.029, 0.022], w: 0.013 },
  { x: -0.025, len: [0.035, 0.023, 0.018], w: 0.0115 },
];
const UP = new Vector3(0, 1, 0);

// A box that starts at the joint and extends along +Z, slightly tapered.
function segment(len, w, h, mat, taper = 0.85) {
  const geo = new BoxGeometry(w, h, len);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (z > 0) (pos.setX(i, pos.getX(i) * taper), pos.setY(i, pos.getY(i) * taper));
    pos.setZ(i, z + len / 2);
  }
  geo.computeVertexNormals();
  return new Mesh(geo, mat);
}

export function createHand({ side, shoulder, materials, ring = false }) {
  // side: -1 for her right hand (on the left of the screen), +1 for her left. The thumb faces
  // her centre line.
  const thumbSide = -side;
  const { skin, nail, sleeve, cuff, gold } = materials;
  const root = new Group();
  const hand = new Group(); // origin at the wrist, +Z = toward the fingertips, +Y = back of the hand
  root.add(hand);
  const cast = (m) => ((m.castShadow = true), m);

  const palm = cast(segment(0.088, 0.072, 0.022, skin, 0.95));
  palm.position.z = 0.0;
  hand.add(palm);
  const wristBlock = cast(segment(0.03, 0.058, 0.026, skin, 1.05));
  wristBlock.position.z = -0.026;
  hand.add(wristBlock);

  const joints = []; // [finger][segment] → Object3D
  FINGERS.forEach((f, fi) => {
    let parent = new Object3D();
    parent.position.set(f.x * thumbSide, 0.001, 0.084 - Math.abs(f.x) * 0.25);
    hand.add(parent);
    const chain = [];
    f.len.forEach((len, si) => {
      const joint = si === 0 ? parent : new Object3D();
      if (si > 0) {
        joint.position.z = f.len[si - 1];
        chain[si - 1].add(joint);
      }
      const w = f.w * 0.88 ** si;
      const m = cast(segment(len, w, w * 0.82, skin));
      joint.add(m);
      if (si === f.len.length - 1) {
        const n = new Mesh(new BoxGeometry(w * 0.8, 0.002, len * 0.55), nail);
        n.position.set(0, w * 0.41, len * 0.62);
        joint.add(n);
      }
      if (ring && fi === 2 && si === 0) {
        const r = new Mesh(new CylinderGeometry(w * 0.68, w * 0.68, 0.007, 8, 1, true), gold);
        r.rotation.x = Math.PI / 2;
        r.position.z = len * 0.45;
        joint.add(r);
      }
      chain.push(joint);
    });
    joints.push(chain);
  });
  // thumb: a swivelling base, then two bending segments
  const tBase = new Object3D();
  tBase.position.set(0.03 * thumbSide, -0.004, 0.012);
  hand.add(tBase);
  const tMeta = cast(segment(0.034, 0.017, 0.015, skin));
  tBase.add(tMeta);
  const t1 = new Object3D();
  t1.position.z = 0.034;
  tBase.add(t1);
  t1.add(cast(segment(0.03, 0.0145, 0.012, skin)));
  const t2 = new Object3D();
  t2.position.z = 0.03;
  t1.add(t2);
  t2.add(cast(segment(0.022, 0.0125, 0.0105, skin)));
  const tn = new Mesh(new BoxGeometry(0.01, 0.002, 0.012), nail);
  tn.position.set(0, 0.0055, 0.014);
  t2.add(tn);

  // the cuff and the two halves of the sleeve
  const cuffMesh = new Mesh(new CylinderGeometry(0.036, 0.04, 0.03, 9, 1, true), cuff);
  cuffMesh.rotation.x = Math.PI / 2;
  cuffMesh.position.z = -0.045;
  hand.add(cuffMesh);
  const armGeo = (r0, r1) => {
    const g = new CylinderGeometry(r1, r0, 1, 9, 1, true);
    g.translate(0, 0.5, 0);
    return g;
  };
  const upper = cast(new Mesh(armGeo(0.075, 0.058), sleeve));
  const fore = cast(new Mesh(armGeo(0.058, 0.04), sleeve));
  // the sleeves stay in the dark: only the hands are ever seen
  upper.visible = fore.visible = false;
  root.add(upper, fore);

  // state
  const S = shoulder.clone();
  const L1 = 0.78,
    L2 = 0.74;
  const pos = new Vector3(S.x, 0.15, -1.7),
    quat = new Quaternion();
  const tPos = pos.clone(),
    tQuat = new Quaternion();
  let speed = 5,
    followObj = null,
    followOff = null,
    followRot = null;
  const pose = JSON.parse(JSON.stringify(POSES.relaxed)),
    poseTo = POSES.relaxed;
  let poseTarget = poseTo,
    poseSpeed = 8;
  const tmp = new Vector3(),
    tmpQ = new Quaternion(),
    elbow = new Vector3(),
    pole = new Vector3();

  // Orientation from yaw (direction the fingers point, around the vertical), pitch (fingers
  // down +) and roll (thumb up +).
  function orient(yaw = 0, pitch = 0, roll = 0) {
    return new Quaternion().setFromEuler(new Euler(pitch, yaw, roll * side, "YXZ"));
  }

  function set({ pos: p, yaw, pitch, roll, quat: q, pose: pz, speed: sp } = {}) {
    followObj = null;
    if (p) tPos.copy(p);
    if (q) tQuat.copy(q);
    else if (yaw !== undefined || pitch !== undefined || roll !== undefined) tQuat.copy(orient(yaw, pitch, roll));
    if (pz) setPose(pz);
    if (sp) speed = sp;
  }
  function setPose(name, sp = 8) {
    poseTarget = typeof name === "string" ? POSES[name] : name;
    poseSpeed = sp;
  }
  // Stay with an object as it moves: the hand sits at `offset` from it (world axes), turned
  // to the orientation `rot` (see orient()).
  function follow(obj, offset, rot, pz = "pinch") {
    followObj = obj;
    followOff = offset.clone();
    followRot = rot.clone();
    setPose(pz, 14);
  }

  function solveArm() {
    // two-bone IK from the shoulder to the wrist, elbow pushed outward and down
    const wrist = tmp.set(0, 0, -0.06).applyQuaternion(quat).add(pos);
    const d = Math.min(wrist.distanceTo(S), L1 + L2 - 0.001);
    const dir = wrist.clone().sub(S).normalize();
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    pole.set(side * 1, -0.9, 0.1);
    pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    elbow.copy(S).addScaledVector(dir, a).addScaledVector(pole, h);
    place(upper, S, elbow);
    place(fore, elbow, S.clone().addScaledVector(dir, d));
  }
  function place(mesh, from, to) {
    const v = to.clone().sub(from);
    mesh.position.copy(from);
    mesh.scale.set(1, v.length(), 1);
    mesh.quaternion.setFromUnitVectors(UP, v.normalize());
  }

  function update(dt) {
    if (followObj) {
      followObj.getWorldPosition(tPos).add(followOff);
      tQuat.copy(followRot);
    }
    const sp = followObj ? 30 : speed;
    pos.x = approach(pos.x, tPos.x, sp, dt);
    pos.y = approach(pos.y, tPos.y, sp, dt);
    pos.z = approach(pos.z, tPos.z, sp, dt);
    quat.slerp(tQuat, 1 - Math.exp(-sp * 0.9 * dt));
    hand.position.copy(pos);
    hand.quaternion.copy(quat);
    // fingers
    const k = poseSpeed;
    for (let fi = 0; fi < 4; fi++)
      for (let si = 0; si < 3; si++) {
        pose.f[fi][si] = approach(pose.f[fi][si], poseTarget.f[fi][si], k, dt);
        joints[fi][si].rotation.x = pose.f[fi][si];
      }
    pose.spread = approach(pose.spread, poseTarget.spread, k, dt);
    joints.forEach((chain, fi) => (chain[0].rotation.y = (1.5 - fi) * pose.spread * thumbSide));
    for (let i = 0; i < 4; i++) pose.thumb[i] = approach(pose.thumb[i], poseTarget.thumb[i], k, dt);
    tBase.rotation.set(0.25 + pose.thumb[1] * 0.6, thumbSide * (0.35 + pose.thumb[0] * 0.7 - pose.thumb[1] * 0.5), -thumbSide * (0.5 + pose.thumb[1] * 0.4));
    t1.rotation.x = pose.thumb[2];
    t2.rotation.x = pose.thumb[3];
    solveArm();
  }

  return {
    root,
    hand,
    side,
    set,
    setPose,
    follow,
    orient,
    get position() {
      return pos;
    },
    get following() {
      return followObj;
    },
    release() {
      followObj = null;
    },
    // jump straight to the target (no easing), e.g. after a restore
    snap() {
      pos.copy(tPos);
      quat.copy(tQuat);
      update(0);
    },
    update,
    dispose() {
      root.traverse((o) => o.geometry?.dispose());
    },
  };
}

export function handMaterials() {
  return {
    skin: new MeshLambertMaterial({ color: 0xc8b2a2, emissive: 0x1a0805 }),
    nail: new MeshLambertMaterial({ color: 0x2a0a0c }),
    sleeve: new MeshLambertMaterial({ color: 0x240910 }),
    cuff: new MeshLambertMaterial({ color: 0x7b5a32, emissive: 0x0d0703 }),
    gold: new MeshLambertMaterial({ color: 0xb8893e, emissive: 0x1c1004 }),
  };
}
