// Point-art: which painting points at the cursor, and where to put it so that it does.
//
// Each painting knows where the tip of its pointing finger is (tip: fractions of the image), the
// direction the finger points on the picture (dir: unit vector, y down) and how long the finger is
// (size: from the knuckle to the tip, over the image's short side). A painting always covers the
// whole screen; it can be enlarged (cropped) and slid as long as it still covers it. As on Pointer
// Pointer, the fingertip touches the cursor: it sits on the cursor's point, a hair behind it along
// the finger (TOUCH), so the finger points right at it. The knuckle stays on screen, so the hand is
// seen. A painting whose fingertip can't reach the cursor at cover size is enlarged until it can,
// up to the point where the image would turn soft (MAX_UP); a small finger is also enlarged toward
// a size that reads well (IDEAL_FINGER).
// Each painting is scored by how much it had to be enlarged, how soft it gets and how far its
// finger is from a good size; the most famous paintings win ties (fame: 0 to 1). One of the best
// few is drawn at random, skipping the latest shown.
// Pure: no DOM, tested in tests/point-art.test.mjs.

const MAX_UP = 1.5; // screen px per image px when enlarging, at most (beyond, the paint goes soft)
const LIMIT_UP = 2.4; // even at cover size: a smaller image is left out on that screen
const MAX_ZOOM = 3.2; // times the cover size, at most
const ZOOM_STEP = 1.06;
const TOUCH = [1, 2]; // px from the cursor's point to the fingertip: touching (finger length × 0.03, within these)
const MIN_FINGER = 14; // px on screen: smaller, the gesture can't be read
const MAX_FINGER = 0.3; // of the screen's short side: larger, the hand fills the screen
const IDEAL_FINGER = 0.09; // of the screen's short side: a finger that reads well
const FAME = 5; // score bonus for the most famous paintings

// Places painting p on a vw × vh screen so its fingertip touches (cx, cy).
// Returns { err (degrees), score, scale, x, y, w, h, tx, ty, dist, finger } or null.
export function place(p, vw, vh, cx, cy) {
  const n = Math.hypot(p.dir[0], p.dir[1]),
    dx = p.dir[0] / n,
    dy = p.dir[1] / n,
    short = Math.min(vw, vh),
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
    // the fingertip, a hair behind the cursor's point along the finger
    const gap = Math.min(TOUCH[1], Math.max(TOUCH[0], finger * 0.03)),
      tx = cx - dx * gap,
      ty = cy - dy * gap;
    // where the tip can be: the image must cover the screen, and the tip stay on it
    const pad = 2;
    if (tx < Math.max(vw - dw + p.tip[0] * dw, pad) || tx > Math.min(p.tip[0] * dw, vw - pad)) continue;
    if (ty < Math.max(vh - dh + p.tip[1] * dh, pad) || ty > Math.min(p.tip[1] * dh, vh - pad)) continue;
    // the knuckle on screen too: the hand is seen
    const kx = tx - dx * finger,
      ky = ty - dy * finger;
    if (kx < 0 || kx > vw || ky < 0 || ky > vh) continue;
    const score = (z - 1) * 1.5 + Math.max(0, s - 1) * 3 + Math.abs(Math.log(finger / (short * IDEAL_FINGER))) * 1.2;
    if (!best || score < best.score) {
      const vx = cx - tx,
        vy = cy - ty,
        err = (Math.acos(Math.max(-1, Math.min(1, (vx * dx + vy * dy) / Math.hypot(vx, vy)))) * 180) / Math.PI;
      best = { score, err, scale: s, x: tx - p.tip[0] * dw, y: ty - p.tip[1] * dh, w: dw, h: dh, tx, ty, dist: gap, finger };
    }
  }
  return best;
}

// Picks a painting for the cursor. recent: ids shown lately (skipped while others fit).
export function pick(paintings, vw, vh, cx, cy, recent = [], rand = Math.random) {
  const fits = [];
  for (const p of paintings) {
    const at = place(p, vw, vh, cx, cy);
    if (at)
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
