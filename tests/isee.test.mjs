// I see u: the painting chosen for a cursor really looks at it, and stays on screen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { place, pick } from "../js/isee/match.js";
import { PAINTINGS } from "../js/isee/paintings.js";

const looksRight = { id: "r", w: 800, h: 1000, eye: [0.4, 0.3], dir: [1, 0], size: 0.12 };
const looksDownLeft = { id: "dl", w: 1200, h: 900, eye: [0.7, 0.25], dir: [-Math.SQRT1_2, Math.SQRT1_2], size: 0.1 };

function check(p, at, vw, vh, cx, cy) {
  // covers the screen
  assert.ok(at.x <= 0.5 && at.y <= 0.5, "no gap top left");
  assert.ok(at.x + at.w >= vw - 0.5 && at.y + at.h >= vh - 0.5, "no gap bottom right");
  // the eyes are where it says, on screen
  assert.ok(Math.abs(at.x + p.eye[0] * at.w - at.ex) < 0.5 && Math.abs(at.y + p.eye[1] * at.h - at.ey) < 0.5);
  assert.ok(at.ex > 0 && at.ex < vw && at.ey > 0 && at.ey < vh);
  // the gaze points at the cursor, within the reported error
  const vx = cx - at.ex,
    vy = cy - at.ey,
    err = (Math.acos(Math.min(1, (vx * p.dir[0] + vy * p.dir[1]) / Math.hypot(vx, vy) / Math.hypot(...p.dir))) * 180) / Math.PI;
  assert.ok(Math.abs(err - at.err) < 0.01);
}

test("a sitter looking right sees a cursor on the right", () => {
  const at = place(looksRight, 1440, 900, 1100, 300);
  assert.ok(at && at.err < 1, `err ${at?.err}`);
  check(looksRight, at, 1440, 900, 1100, 300);
  assert.ok(at.ex < 1100);
});

test("a cursor behind the gaze can't be seen", () => {
  const at = place(looksRight, 1440, 900, 60, 450);
  assert.ok(!at || at.err > 30);
});

test("diagonal gaze on a phone screen", () => {
  const at = place(looksDownLeft, 390, 844, 40, 400);
  assert.ok(at && at.err < 3, `err ${at?.err}`);
  check(looksDownLeft, at, 390, 844, 40, 400);
});

test("pick skips recent paintings when others fit", () => {
  const twin = { ...looksRight, id: "r2" };
  const got = pick([looksRight, twin], 1440, 900, 1100, 300, ["r"], () => 0);
  assert.equal(got.p.id, "r2");
});

// a laptop is covered within a few degrees; on a tall phone the bottom middle needs sitters
// looking almost straight down, which are rare (and sit under the label anyway)
test("the collection covers the whole screen", () => {
  assert.ok(PAINTINGS.length >= 100, `${PAINTINGS.length} paintings`);
  for (const [vw, vh] of [
    [1440, 900],
    [390, 844],
  ]) {
    let miss = 0,
      n = 0;
    for (let x = 0.05; x < 1; x += 0.1)
      for (let y = 0.05; y < 1; y += 0.1) {
        n++;
        const hit = pick(PAINTINGS, vw, vh, x * vw, y * vh);
        if (!hit || hit.at.err > (vw < 600 ? 10 : 4)) miss++;
        else check(hit.p, hit.at, vw, vh, x * vw, y * vh);
      }
    assert.ok(miss / n < 0.05, `${vw}×${vh}: ${miss}/${n} spots without a good look`);
  }
});

test("every painting is complete", () => {
  for (const p of PAINTINGS) {
    for (const k of ["id", "src", "title", "artist", "museum", "link"]) assert.ok(p[k], `${p.id}: ${k}`);
    assert.ok(Math.abs(Math.hypot(...p.dir) - 1) < 0.01, `${p.id}: dir`);
    assert.ok(p.eye.every((v) => v > 0 && v < 1), `${p.id}: eye`);
  }
});
