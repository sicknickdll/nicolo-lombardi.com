// Seeded random numbers (mulberry32). The generator state is a single 32-bit integer, so it can
// live inside the plain, serialisable game state and a whole run is reproducible from its seed.
export function nextRng(s) {
  // returns [value in [0,1), newState]
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}
// A small stateful wrapper for code outside the rules (rendering, menus).
export function makeRng(seed) {
  let s = seed >>> 0;
  const rng = () => {
    const [v, n] = nextRng(s);
    s = n;
    return v;
  };
  rng.int = (n) => Math.floor(rng() * n);
  rng.pick = (a) => a[Math.floor(rng() * a.length)];
  rng.range = (a, b) => a + rng() * (b - a);
  rng.get = () => s;
  return rng;
}
