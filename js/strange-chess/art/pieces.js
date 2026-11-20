// Piece sprites: the size of each piece type and a cache of baked sculptures per layout.
// Heights are in board rows (about 1.2 rows on average, the pawn short, the king tall), widths in
// square widths. Any taller and a back-rank piece hides the pawn behind it; any narrower and the
// silhouettes stop reading. Both sides' knights face the same way (as in printed diagrams), so
// the key light from the left always falls on the horse's face.
import { sculpt } from "./sculpt.js";
import { fbm } from "../rng.js";

export const SPEC = { P: [0.8, 0.5], R: [0.94, 0.6], N: [1.08, 0.76], B: [1.12, 0.54], Q: [1.22, 0.64], K: [1.3, 0.62] };

// The Moon's markings: dark seas, like the disc in reference 3.
const moonPattern = (u, v) => {
  const n = fbm(u * 3.2 + 1.7, v * 3.2, 77, 3);
  return Math.min(0.7, Math.max(0, (n - 0.47) * 3.2));
};

export function pieceBaker(L, dpr) {
  const cache = new Map();
  const ch = L.pieceCell,
    cw = ch * 0.62;
  return function get(type, look) {
    const key = type + "|" + look;
    if (cache.has(key)) return cache.get(key);
    let sp;
    if (type === "M")
      sp = sculpt({ shape: "disc", w: L.sqW * 1.8, h: L.sqW * 1.8 * 0.94, cw: cw * 1.25, chH: ch * 1.25, dpr, look: "moon", normal: "sphere", pattern: moonPattern, variants: 3, seed: 91, halo: 10, melt: 0.04, ambient: 0.62, gain: 0.45, gamma: 0.9, rim: 0 });
    else if (type === "G")
      sp = sculpt({ shape: "gold", w: L.sqW * 0.62, h: L.sqH * 0.78, cw, chH: ch, dpr, look: "gold", variants: 3, seed: 33, halo: 4, chars: "$&$&$S8%", ambient: 0.22 });
    else {
      const [h, w] = SPEC[type];
      sp = sculpt({ shape: type, w: L.sqW * w, h: L.sqH * h, cw, chH: ch, dpr, look, variants: 3, seed: type.charCodeAt(0) * 7 + look.length, halo: 6 });
    }
    cache.set(key, sp);
    return sp;
  };
}
