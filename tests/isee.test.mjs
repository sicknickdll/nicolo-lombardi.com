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

test("a far cursor brings the painting closer: it is enlarged until the eyes are near", () => {
  // looking right from the left third of the picture; the cursor at the far right edge
  const p = { id: "big", w: 2400, h: 1800, eye: [0.2, 0.4], dir: [1, 0], size: 0.06 };
  const at = place(p, 1440, 900, 1400, 360);
  assert.ok(at && at.err < 1, `err ${at?.err}`);
  check(p, at, 1440, 900, 1400, 360);
  assert.ok(at.w > 1440 * 1.3, "enlarged");
  assert.ok(at.dist <= at.face * 8.5, `eyes ${(at.dist / at.face).toFixed(1)} eye-widths away`);
});

test("a small image is never blown up past what it can take", () => {
  const p = { ...looksRight, w: 500, h: 600 };
  assert.equal(place(p, 2560, 1440, 2000, 400), null);
});

test("pick skips recent paintings when others fit", () => {
  const twin = { ...looksRight, id: "r2" };
  const got = pick([looksRight, twin], 1440, 900, 1100, 300, ["r"], () => 0);
  assert.equal(got.p.id, "r2");
});

// Everywhere on the screen some painting looks at the cursor, from close by (a few eye-widths, so a
// small error in a gaze can't show), and sharp. A tall phone's bottom middle needs sitters looking
// almost straight down, which are rare (and it sits under the label anyway): a little more slack.
test("the collection covers the whole screen", () => {
  assert.ok(PAINTINGS.length >= 100, `${PAINTINGS.length} paintings`);
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const [vw, vh, tol] of [
    [1440, 900, 2],
    [1920, 1080, 2],
    [2560, 1440, 3],
    [768, 1024, 2],
    [390, 844, 6],
  ]) {
    let miss = 0,
      n = 0;
    for (let x = 0.05; x < 1; x += 0.1)
      for (let y = 0.05; y < 1; y += 0.1) {
        n++;
        const hit = pick(PAINTINGS, vw, vh, x * vw, y * vh, [], rand);
        if (!hit || hit.at.err > tol) {
          miss++;
          continue;
        }
        check(hit.p, hit.at, vw, vh, x * vw, y * vh);
        assert.ok(hit.at.dist <= hit.at.face * 8.8, `${vw}×${vh}: eyes ${(hit.at.dist / hit.at.face).toFixed(1)} eye-widths away`);
        assert.ok(hit.at.scale <= 2.4, `${vw}×${vh}: ${hit.p.id} enlarged ${hit.at.scale.toFixed(2)}×`);
      }
    assert.ok(miss / n <= 0.05, `${vw}×${vh}: ${miss}/${n} spots without a good look`);
  }
});

test("every painting is complete", () => {
  for (const p of PAINTINGS) {
    for (const k of ["id", "src", "title", "artist", "museum", "link"]) assert.ok(p[k], `${p.id}: ${k}`);
    assert.ok(Math.abs(Math.hypot(...p.dir) - 1) < 0.01, `${p.id}: dir`);
    assert.ok(p.eye.every((v) => v > 0 && v < 1), `${p.id}: eye`);
  }
});
