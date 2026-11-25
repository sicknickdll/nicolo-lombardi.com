// I see u: which painting looks at the cursor, and where to put it so that it does.
//
// Each painting knows where its sitter's eyes are (eye: fractions of the image) and the
// direction of the gaze on the picture (dir: unit vector, y down). A painting always covers the
// whole screen; it can be enlarged (cropped) and slid as long as it still covers it. Anywhere
// along the gaze is "looked at", but a gaze is only ever a few degrees exact, so a look across
// the whole screen misses: the eyes are kept a few head-widths from the cursor. When the cursor is
// far from where a painting's eyes can sit, the painting is enlarged until they come close
// enough, up to the point where the image would turn soft (MAX_UP).
// Each painting is scored by how far off its line the cursor stays (degrees), how far the eyes
// are from the ideal distance and how much it had to be enlarged; one of the best few is drawn at
// random, skipping the latest shown. Pure: no DOM, tested in tests/isee.test.mjs.

const MAX_UP = 1.5; // screen px per image px when enlarging, at most (beyond, the paint goes soft)
const LIMIT_UP = 2.4; // even at cover size: a smaller image is left out on that screen
const MAX_ZOOM = 3.2; // times the cover size, at most
const ZOOM_STEP = 1.12;
const NEAR = 2.4; // closest the cursor may be to the eyes, in eye-to-eye distances (just past the head)
const IDEAL = 4.5; // where a look reads best
const FAR = 8; // furthest
const STEPS = 10;

// Places painting p on a vw × vh screen so its gaze hits (cx, cy).
// Returns { err (degrees), score, scale, x, y, w, h, ex, ey, dist, face } or null.
export function place(p, vw, vh, cx, cy) {
  const n = Math.hypot(p.dir[0], p.dir[1]),
    dx = p.dir[0] / n,
    dy = p.dir[1] / n,
    short = Math.min(vw, vh),
    diag = Math.hypot(vw, vh),
    cover = Math.max(vw / p.w, vh / p.h),
    zmax = Math.min(MAX_ZOOM, Math.max(1, MAX_UP / cover));
  if (cover > LIMIT_UP) return null;
  let best = null;
  for (let z = 1; z <= zmax * 1.0001; z = z * ZOOM_STEP > zmax && z < zmax ? zmax : z * ZOOM_STEP) {
    const s = z * cover,
      dw = p.w * s,
      dh = p.h * s,
      face = p.size * Math.min(dw, dh); // eye-to-eye, in screen pixels
    if (face < 12) continue;
    if (face > short * 0.22) break; // closer than a close-up: the face would fill the screen
    // where the eyes can be: the image must cover the screen, and the face stay on it
    const pad = Math.max(short * 0.06, face * 1.5),
      x0 = Math.max(vw - dw + p.eye[0] * dw, pad),
      x1 = Math.min(p.eye[0] * dw, vw - pad),
      y0 = Math.max(vh - dh + p.eye[1] * dh, pad),
      y1 = Math.min(p.eye[1] * dh, vh - pad);
    if (x0 > x1 || y0 > y1) continue;
    const near = face * NEAR,
      far = Math.max(near, Math.min(face * FAR, diag * 0.6)),
      ideal = Math.min(far, face * IDEAL);
    // exact: the stretch of the line back from the cursor (eyes = cursor − t·dir) that lies in
    // the box and the distance range; the eyes go as near the ideal distance as it allows
    let ta = near,
      tb = far;
    for (const [c, d, lo, hi] of [
      [cx, dx, x0, x1],
      [cy, dy, y0, y1],
    ]) {
      if (Math.abs(d) < 1e-9) {
        if (c < lo || c > hi) ta = Infinity;
        continue;
      }
      const u = (c - hi) / d,
        v = (c - lo) / d; // c − t·d = hi  /  = lo
      ta = Math.max(ta, Math.min(u, v));
      tb = Math.min(tb, Math.max(u, v));
    }
    const ts = [];
    if (ta <= tb) ts.push(Math.min(tb, Math.max(ta, ideal)));
    // otherwise the nearest miss: eyes as close to the line as the box lets them
    else for (let i = 0; i <= STEPS; i++) ts.push(near + ((far - near) * i) / STEPS);
    for (const t of ts) {
      const ex = Math.min(x1, Math.max(x0, cx - dx * t)),
        ey = Math.min(y1, Math.max(y0, cy - dy * t)),
        vx = cx - ex,
        vy = cy - ey,
        d = Math.hypot(vx, vy);
      if (d < near * 0.9 || d > far * 1.1) continue;
      const cos = (vx * dx + vy * dy) / d,
        err = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
      // costs: degrees off (most), distance away from the ideal, enlarging, softness
      const score = err * 1.5 + Math.abs(Math.log(d / (face * IDEAL))) * 2.5 + (z - 1) * 1.5 + Math.max(0, s - 1) * 3;
      if (!best || score < best.score)
        best = { score, err, scale: s, x: ex - p.eye[0] * dw, y: ey - p.eye[1] * dh, w: dw, h: dh, ex, ey, dist: d, face };
    }
  }
  return best;
}

// Picks a painting for the cursor. recent: ids shown lately (skipped while others fit).
export function pick(paintings, vw, vh, cx, cy, recent = [], rand = Math.random) {
  const fits = [];
  for (const p of paintings) {
    const at = place(p, vw, vh, cx, cy);
    if (at && at.err < 10) fits.push({ p, at, score: at.score + (recent.includes(p.id) ? 40 + (recent.length - recent.indexOf(p.id)) : 0) });
  }
  if (!fits.length) return null;
  fits.sort((a, b) => a.score - b.score);
  // the good ones: close to the best; one of them at random
  const top = fits.filter((f) => f.score <= fits[0].score + 2.5).slice(0, 8);
  return top[Math.floor(rand() * top.length)];
}
