// I see u, the opening: one painted pointing hand, small, in the middle of a white page (God's,
// from the Creation of Adam); then other pointing hands, square tiles cut from the paintings
// (js/isee/fingers.js), appear around it, ring after ring, until they fill the screen with a
// mosaic of fingers; then they go out one by one.
// playIntro(canvas) resolves when it is over (at once if the sprite can't load); skip() ends it.
import { FINGERS as TILES } from "./fingers.js";

const FIRST = [0, 520]; // the first hand fades in
const FILL = [700, 2300]; // the others appear (start of the first, start of the last)
const TILE_IN = 240;
const HOLD = 2750; // the full mosaic, then the hands go out
const OUT_SPREAD = 520,
  TILE_OUT = 300;

export function playIntro(canvas) {
  let raf = 0,
    finish = () => {};
  const done = new Promise((resolve) => (finish = resolve));
  const sprite = new Image();
  sprite.src = TILES.src;
  const giveUp = setTimeout(() => end(), 2500);
  function end() {
    clearTimeout(giveUp);
    cancelAnimationFrame(raf);
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    canvas.hidden = true;
    finish();
  }
  (sprite.decode ? sprite.decode() : new Promise((r, j) => ((sprite.onload = r), (sprite.onerror = j))))
    .then(() => {
      clearTimeout(giveUp);
      run();
    })
    .catch(end);

  function run() {
    const dpr = Math.min(2, devicePixelRatio || 1),
      vw = innerWidth,
      vh = innerHeight,
      T = Math.round(Math.min(132, Math.max(56, Math.min(vw, vh) / 6.5))),
      cx = vw / 2,
      cy = vh / 2,
      nx = Math.ceil(cx / T - 0.5),
      ny = Math.ceil(cy / T - 0.5);
    canvas.width = vw * dpr;
    canvas.height = vh * dpr;
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingQuality = "high";
    // every cell of a grid centred on the first hand, nearest first (a little shuffled, so the
    // mosaic grows like a stain rather than in perfect rings)
    const order = [...Array(TILES.count).keys()].filter((i) => i !== TILES.first).sort(() => Math.random() - 0.5);
    const cells = [];
    for (let j = -ny; j <= ny; j++)
      for (let i = -nx; i <= nx; i++) if (i || j) cells.push({ i, j, d: Math.hypot(i, j) + Math.random() * 0.9 });
    cells.sort((a, b) => a.d - b.d);
    cells.forEach((c, k) => {
      c.tile = order[k % order.length];
      c.at = FILL[0] + (FILL[1] - FILL[0]) * Math.pow(k / Math.max(1, cells.length - 1), 0.8);
      c.out = HOLD + Math.random() * OUT_SPREAD;
    });
    cells.unshift({ i: 0, j: 0, tile: TILES.first, at: FIRST[0], first: true, out: HOLD + OUT_SPREAD * 0.5 });
    const t0 = performance.now(),
      endAt = HOLD + OUT_SPREAD + TILE_OUT;
    const frame = (now) => {
      const t = now - t0;
      g.clearRect(0, 0, vw, vh);
      for (const c of cells) {
        const fadeIn = c.first ? FIRST[1] - FIRST[0] : TILE_IN,
          a = Math.min(1, Math.max(0, (t - c.at) / fadeIn)) * (1 - Math.min(1, Math.max(0, (t - c.out) / TILE_OUT)));
        if (a <= 0) continue;
        const grow = c.first ? 0.9 + 0.1 * Math.min(1, (t - c.at) / fadeIn) : 1,
          s = T * grow,
          x = cx + c.i * T - s / 2,
          y = cy + c.j * T - s / 2,
          sx = (c.tile % TILES.cols) * TILES.tile,
          sy = Math.floor(c.tile / TILES.cols) * TILES.tile;
        g.globalAlpha = a;
        g.drawImage(sprite, sx, sy, TILES.tile, TILES.tile, x, y, s, s);
      }
      g.globalAlpha = 1;
      if (t < endAt) raf = requestAnimationFrame(frame);
      else end();
    };
    raf = requestAnimationFrame(frame);
  }
  return { done, skip: end };
}
