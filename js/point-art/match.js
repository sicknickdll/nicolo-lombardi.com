// Point-art: which painting points at the cursor, and where to put it so that it does.
//
// Each painting knows where the tip of its pointing finger is (tip: fractions of the image), the
// direction the finger points on the picture (dir: unit vector, y down) and how long the finger is
// (size: from the knuckle to the tip, over the image's short side). A painting always covers the
// whole screen; it can be enlarged (cropped) and slid as long as it still covers it. As on Pointer
// Pointer, the fingertip ends just short of the cursor, pointing right at it: a fraction of a
// finger's length away, never more than a couple of lengths. When the cursor is far from where a
// painting's fingertip can sit, the painting is enlarged until it comes close enough, up to the
// point where the image would turn soft (MAX_UP).
// Each painting is scored by how far off its line the cursor stays (degrees), how far the tip is
// from the ideal gap and how much it had to be enlarged; the most famous paintings win ties (fame:
// 0 to 1). One of the best few is drawn at random, skipping the latest shown.
// Pure: no DOM, tested in tests/point-art.test.mjs.

const MAX_UP = 1.5; // screen px per image px when enlarging, at most (beyond, the paint goes soft)
const LIMIT_UP = 2.4; // even at cover size: a smaller image is left out on that screen
const MAX_ZOOM = 3.2; // times the cover size, at most
const ZOOM_STEP = 1.12;
const NEAR = 0.1; // closest the fingertip may come to the cursor, in finger lengths
const IDEAL = 0.4; // the gap that reads best: almost touching
const FAR = 2.2; // furthest
const MIN_FINGER = 14; // px on screen: smaller, the gesture can't be read
const MAX_FINGER = 0.3; // of the screen's short side: larger, the hand fills the screen
const FAME = 5; // score bonus for the most famous paintings (about 3° of aim)
const STEPS = 10;

// Places painting p on a vw × vh screen so its finger points at (cx, cy).
// Returns { err (degrees), score, scale, x, y, w, h, tx, ty, dist, finger } or null.
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
      finger = p.size * Math.min(dw, dh); // knuckle to tip, in screen pixels
    if (finger < MIN_FINGER) continue;
    if (finger > short * MAX_FINGER) break;
    // where the tip can be: the image must cover the screen, and the tip stay on it
    const pad = Math.max(4, short * 0.015),
      x0 = Math.max(vw - dw + p.tip[0] * dw, pad),
      x1 = Math.min(p.tip[0] * dw, vw - pad),
      y0 = Math.max(vh - dh + p.tip[1] * dh, pad),
      y1 = Math.min(p.tip[1] * dh, vh - pad);
    if (x0 > x1 || y0 > y1) continue;
    const near = finger * NEAR,
      far = Math.max(near, Math.min(finger * FAR, diag * 0.3)),
      ideal = Math.min(far, finger * IDEAL);
    // exact: the stretch of the line back from the cursor (tip = cursor − t·dir) that lies in
    // the box and the distance range; the tip goes as near the ideal gap as it allows
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
    // otherwise the nearest miss: the tip as close to the line as the box lets it
    else for (let i = 0; i <= STEPS; i++) ts.push(near + ((far - near) * i) / STEPS);
    for (const t of ts) {
      const tx = Math.min(x1, Math.max(x0, cx - dx * t)),
        ty = Math.min(y1, Math.max(y0, cy - dy * t)),
        vx = cx - tx,
        vy = cy - ty,
        d = Math.hypot(vx, vy);
      if (d < near * 0.9 || d > far * 1.1) continue;
      const cos = (vx * dx + vy * dy) / d,
        err = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
      // costs: degrees off (most), distance away from the ideal gap, enlarging, softness
      const score = err * 1.5 + Math.abs(Math.log(d / (finger * IDEAL))) * 1.5 + (z - 1) * 1.5 + Math.max(0, s - 1) * 3;
      if (!best || score < best.score)
        best = { score, err, scale: s, x: tx - p.tip[0] * dw, y: ty - p.tip[1] * dh, w: dw, h: dh, tx, ty, dist: d, finger };
    }
  }
  return best;
}

// Picks a painting for the cursor. recent: ids shown lately (skipped while others fit).
export function pick(paintings, vw, vh, cx, cy, recent = [], rand = Math.random) {
  const fits = [];
  for (const p of paintings) {
    const at = place(p, vw, vh, cx, cy);
    if (at && at.err < 8)
      fits.push({
        p,
        at,
        score: at.score - (p.fame || 0) * FAME + (recent.includes(p.id) ? 40 + (recent.length - recent.indexOf(p.id)) : 0),
      });
  }
  if (!fits.length) return null;
  fits.sort((a, b) => a.score - b.score);
  // the good ones: close to the best; one of them at random
  const top = fits.filter((f) => f.score <= fits[0].score + 2).slice(0, 6);
  return top[Math.floor(rand() * top.length)];
}
