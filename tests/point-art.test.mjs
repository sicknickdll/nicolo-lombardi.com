// Point-art: the painting chosen for a cursor really points at it, and stays on screen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { place, pick } from "../js/point-art/match.js";
import { PAINTINGS } from "../js/point-art/paintings.js";

const pointsRight = { id: "r", w: 2000, h: 1600, tip: [0.4, 0.4], dir: [1, 0], size: 0.08 };
const pointsDownLeft = { id: "dl", w: 1200, h: 900, tip: [0.6, 0.35], dir: [-Math.SQRT1_2, Math.SQRT1_2], size: 0.07 };

function check(p, at, vw, vh, cx, cy) {
  // covers the screen
  assert.ok(at.x <= 0.5 && at.y <= 0.5, "no gap top left");
  assert.ok(at.x + at.w >= vw - 0.5 && at.y + at.h >= vh - 0.5, "no gap bottom right");
  // the fingertip is where it says, on screen
  assert.ok(Math.abs(at.x + p.tip[0] * at.w - at.tx) < 0.5 && Math.abs(at.y + p.tip[1] * at.h - at.ty) < 0.5);
  assert.ok(at.tx > 0 && at.tx < vw && at.ty > 0 && at.ty < vh);
  // the finger points at the cursor, within the reported error
  const vx = cx - at.tx,
    vy = cy - at.ty,
    err = (Math.acos(Math.min(1, (vx * p.dir[0] + vy * p.dir[1]) / Math.hypot(vx, vy) / Math.hypot(...p.dir))) * 180) / Math.PI;
  assert.ok(Math.abs(err - at.err) < 0.01);
}

test("a finger pointing right points at a cursor on the right", () => {
  const at = place(pointsRight, 1440, 900, 700, 380);
  assert.ok(at && at.err < 1, `err ${at?.err}`);
  check(pointsRight, at, 1440, 900, 700, 380);
  assert.ok(at.tx < 700, "the tip stops short of the cursor");
});

test("a cursor behind the finger can't be pointed at", () => {
  const at = place(pointsRight, 1440, 900, 6, 450); // left of where the tip can go
  assert.ok(!at || at.err > 30);
});

test("diagonal finger on a phone screen", () => {
  const at = place(pointsDownLeft, 390, 844, 120, 500);
  assert.ok(at && at.err < 3, `err ${at?.err}`);
  check(pointsDownLeft, at, 390, 844, 120, 500);
});

test("the fingertip ends close to the cursor, as on Pointer Pointer", () => {
  const at = place(pointsRight, 1440, 900, 1000, 300);
  assert.ok(at && at.err < 1, `err ${at?.err}`);
  check(pointsRight, at, 1440, 900, 1000, 300);
  assert.ok(at.dist <= at.finger * 2.3, `tip ${(at.dist / at.finger).toFixed(1)} finger lengths away`);
});

test("a far cursor brings the painting closer: it is enlarged until the finger is near", () => {
  // pointing right from the left of a wide picture; the cursor at the far right of the screen
  const p = { id: "big", w: 2400, h: 1600, tip: [0.35, 0.45], dir: [1, 0], size: 0.03 };
  const at = place(p, 1440, 900, 1380, 400);
  assert.ok(at && at.err < 1, `err ${at?.err}`);
  check(p, at, 1440, 900, 1380, 400);
  assert.ok(at.w > 1440 * 1.3, "enlarged");
});

test("a small image is never blown up past what it can take", () => {
  const p = { ...pointsRight, w: 500, h: 400 };
  assert.equal(place(p, 2560, 1440, 2000, 400), null);
});

test("pick skips recent paintings when others fit", () => {
  const twin = { ...pointsRight, id: "r2" };
  const got = pick([pointsRight, twin], 1440, 900, 700, 380, ["r"], () => 0);
  assert.equal(got.p.id, "r2");
});

test("pick prefers the famous painting when both fit as well", () => {
  const famous = { ...pointsRight, id: "famous", fame: 1 };
  const got = pick([pointsRight, famous], 1440, 900, 700, 380, [], () => 0);
  assert.equal(got.p.id, "famous");
});

// Everywhere on the screen some painting points at the cursor, from close by (a couple of finger
// lengths at most), and sharp. Corners and edges need fingers pointing into them from a hand that
// can sit just inside the screen: a little slack there.
test("the collection covers the whole screen", () => {
  assert.ok(PAINTINGS.length >= 30, `${PAINTINGS.length} paintings`);
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const [vw, vh, tol] of [
    [1440, 900, 3],
    [1920, 1080, 3],
    [2560, 1440, 4],
    [768, 1024, 3],
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
        assert.ok(hit.at.dist <= hit.at.finger * 2.5, `${vw}×${vh}: tip ${(hit.at.dist / hit.at.finger).toFixed(1)} finger lengths away`);
        assert.ok(hit.at.scale <= 2.4, `${vw}×${vh}: ${hit.p.id} enlarged ${hit.at.scale.toFixed(2)}×`);
      }
    assert.ok(miss / n <= 0.08, `${vw}×${vh}: ${miss}/${n} spots without a finger`);
  }
});

test("every painting is complete", () => {
  for (const p of PAINTINGS) {
    for (const k of ["id", "src", "title", "artist", "museum", "link"]) assert.ok(p[k], `${p.id}: ${k}`);
    assert.ok(Math.abs(Math.hypot(...p.dir) - 1) < 0.01, `${p.id}: dir`);
    assert.ok(p.tip.every((v) => v > 0 && v < 1), `${p.id}: tip`);
    assert.ok(p.size > 0 && p.size < 0.5, `${p.id}: size`);
    assert.ok(p.fame >= 0 && p.fame <= 1, `${p.id}: fame`);
  }
});

test("the most famous come first", () => {
  for (let i = 1; i < PAINTINGS.length; i++) assert.ok(PAINTINGS[i - 1].fame >= PAINTINGS[i].fame, PAINTINGS[i].id);
});
