// I see u: which painting looks at the cursor, and where to put it so that it does.
//
// Each painting knows where its sitter's eyes are (eye: fractions of the image) and the
// direction of the gaze on the picture (dir: unit vector, y down). A painting is shown covering
// the whole screen, at its cover size or a little larger, and can slide as far as it still
// covers the screen. Anywhere along the gaze is "looked at", so the question is: is there a
// size and a position where the line from the eyes passes through the cursor, with the eyes
// on screen and not too close to the cursor? The answer is scored by how far off the line the
// cursor stays (in degrees) and the best few are drawn at random, skipping the latest shown.
// Pure: no DOM, tested in tests/isee.test.mjs.

const ZOOMS = [1, 1.18, 1.4];
const STEPS = 14;

// Places painting p on a vw × vh screen so its gaze hits (cx, cy).
// Returns { err (degrees), scale, x, y, ex, ey, dist } or null if it can't be placed.
export function place(p, vw, vh, cx, cy) {
  const n = Math.hypot(p.dir[0], p.dir[1]),
    dx = p.dir[0] / n,
    dy = p.dir[1] / n;
  const diag = Math.hypot(vw, vh),
    margin = Math.min(vw, vh) * 0.08;
  let best = null;
  for (const z of ZOOMS) {
    const s = z * Math.max(vw / p.w, vh / p.h),
      dw = p.w * s,
      dh = p.h * s,
      face = p.size * Math.min(dw, dh); // eye-to-eye, in screen pixels
    if (face < 14 || face > Math.min(vw, vh) * 0.35) continue;
    // where the eyes can be: the image must cover the screen, and the face stay on it
    const pad = Math.max(margin, face * 1.6),
      x0 = Math.max(vw - dw + p.eye[0] * dw, pad),
      x1 = Math.min(p.eye[0] * dw, vw - pad),
      y0 = Math.max(vh - dh + p.eye[1] * dh, pad),
      y1 = Math.min(p.eye[1] * dh, vh - pad);
    if (x0 > x1 || y0 > y1) continue;
    // the eyes should sit some way from the cursor, so the look reads as a look
    const near = Math.max(face * 3, diag * 0.16),
      far = diag * 0.85;
    // exact: the stretch of the line back from the cursor (eyes = cursor − t·dir) that lies in
    // the box; then the eyes go at a comfortable distance within it
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
    if (ta <= tb) ts.push(Math.min(tb, Math.max(ta, diag * 0.32)));
    for (let i = 0; i <= STEPS; i++) ts.push(near + ((far - near) * i) / STEPS);
    for (const t of ts) {
      const ex = Math.min(x1, Math.max(x0, cx - dx * t)),
        ey = Math.min(y1, Math.max(y0, cy - dy * t)),
        vx = cx - ex,
        vy = cy - ey,
        d = Math.hypot(vx, vy);
      if (d < near * 0.85) continue;
      const cos = (vx * dx + vy * dy) / d,
        err = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
      // small costs: zooming in, and very long looks (the further, the more a small error shows)
      const score = err + (z - 1) * 4 + (d / diag) * 3;
      if (!best || score < best.score)
        best = { score, err, scale: s, x: ex - p.eye[0] * dw, y: ey - p.eye[1] * dh, ex, ey, dist: d, w: dw, h: dh };
    }
  }
  return best;
}

// Picks a painting for the cursor. recent: ids shown lately (skipped while others fit).
export function pick(paintings, vw, vh, cx, cy, recent = [], rand = Math.random) {
  const fits = [];
  for (const p of paintings) {
    const at = place(p, vw, vh, cx, cy);
    if (at && at.err < 12) fits.push({ p, at, score: at.score + (recent.includes(p.id) ? 40 + (recent.length - recent.indexOf(p.id)) : 0) });
  }
  if (!fits.length) return null;
  fits.sort((a, b) => a.score - b.score);
  // the good ones: within a few degrees of the best; one of them at random
  const top = fits.filter((f) => f.score <= fits[0].score + 3).slice(0, 8);
  return top[Math.floor(rand() * top.length)];
}
