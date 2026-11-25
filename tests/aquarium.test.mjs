// The aquarium's drawing → ASCII rules and its storage format.
import { test } from "node:test";
import assert from "node:assert/strict";
import { blank, rasterize, crop, encode, decode, blend } from "../js/aquarium/ascii.js";

const paint = (bm, fn) => {
  for (let y = 0; y < bm.h; y++) for (let x = 0; x < bm.w; x++) if (fn(x, y)) bm.d[y * bm.w + x] = 255;
  return bm;
};
const glyphs = (r) => new Set(r.chars.filter((c) => c !== " "));

test("an empty drawing is all spaces", () => {
  const r = rasterize(blank(), 20);
  assert.equal(r.cols, 20);
  assert.ok(r.chars.every((c) => c === " "));
});

test("a solid block becomes dense glyphs", () => {
  const r = rasterize(paint(blank(), () => true), 16);
  assert.deepEqual([...glyphs(r)], ["@"]);
});

test("thin strokes become line glyphs by direction", () => {
  const h = rasterize(paint(blank(), (x, y) => Math.abs(y - 48) < 2), 20);
  assert.ok(glyphs(h).has("-") || glyphs(h).has("_"));
  const v = rasterize(paint(blank(), (x) => Math.abs(x - 80) < 2), 20);
  assert.ok(glyphs(v).has("|"));
  const d = rasterize(paint(blank(), (x, y) => Math.abs(x * 0.6 - (96 - y)) < 1.2), 24);
  assert.ok(glyphs(d).has("/"), [...glyphs(d)].join(""));
});

test("flip mirrors the drawing", () => {
  const bm = paint(blank(), (x, y) => x < 40 && y > 30 && y < 60);
  const a = rasterize(bm, 16),
    b = rasterize(bm, 16, 1.9, { flip: true });
  const ink = (r, side) => r.chars.filter((c, i) => c !== " " && (side ? i % r.cols >= r.cols / 2 : i % r.cols < r.cols / 2)).length;
  assert.ok(ink(a, 0) > 0 && ink(a, 1) === 0);
  assert.ok(ink(b, 1) > 0 && ink(b, 0) === 0);
});

test("crop keeps only the ink", () => {
  const c = crop(paint(blank(), (x, y) => x >= 50 && x < 70 && y >= 10 && y < 20), 2);
  assert.equal(c.w, 24);
  assert.equal(c.h, 14);
  assert.equal(crop(blank()), null);
});

test("encode / decode round-trips four tones", () => {
  const bm = blank(13, 7);
  bm.d.forEach((_, i) => (bm.d[i] = [0, 85, 170, 255][i % 4]));
  const back = decode(JSON.parse(JSON.stringify(encode(bm))));
  assert.deepEqual([...back.d], [...bm.d]);
});

test("a baby has ink from both parents", () => {
  const a = paint(blank(40, 20), (x) => x < 20),
    b = paint(blank(40, 20), (x) => x >= 20);
  const kid = blend(a, b, () => 0.5);
  assert.ok(kid.d.some((v, i) => v && i % kid.w < 20) && kid.d.some((v, i) => v && i % kid.w >= 20));
});

test("shading: detailed glyphs, the lit top brighter than the bottom", async () => {
  const { DETAIL } = await import("../js/aquarium/ascii.js");
  const bm = paint(blank(), (x, y) => (x - 80) ** 2 / 60 ** 2 + (y - 48) ** 2 / 36 ** 2 < 1);
  const r = rasterize(bm, 30, 1.9, { detail: true });
  const all = DETAIL.join("") + "-|/\\_";
  assert.ok(r.chars.every((c) => c === " " || all.includes(c)));
  const rowLum = (row) => {
    let s = 0,
      n = 0;
    for (let c = 0; c < r.cols; c++) if (r.chars[row * r.cols + c] !== " ") (s += r.lum[row * r.cols + c]), n++;
    return s / n;
  };
  const filled = [...Array(r.rows).keys()].filter((row) => rowLum(row) > 0);
  assert.ok(rowLum(filled[1]) > rowLum(filled.at(-2)));
});

test("colour drawings: crop, blend, and storage to the palette", async () => {
  const { blankImg, cropImg, encodeImg, decodeImg, blendImg, imgToBm, PAL } = await import("../js/aquarium/ascii.js");
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const img = blankImg(20, 10);
  for (let y = 2; y < 6; y++) for (let x = 4; x < 12; x++) img.px.set([...rgb(x < 8 ? PAL[2] : PAL[11]), 255], (y * 20 + x) * 4);
  const c = cropImg(img, 0);
  assert.equal(c.w, 8);
  assert.equal(c.h, 4);
  const back = decodeImg(JSON.parse(JSON.stringify(encodeImg(c))));
  assert.deepEqual([...back.px], [...c.px]);
  assert.ok(imgToBm(c).d.every((v) => v > 0));
  const other = blankImg(8, 4);
  other.px.set([...rgb(PAL[7]), 255], 0);
  const kid = blendImg(c, other, () => 0.5);
  assert.equal(kid.w, 8);
  assert.ok(kid.px[3] === 255);
});
