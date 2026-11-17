// Letters that slide into place, after React Bits' "Shuffle" (reactbits.dev/text-animations/shuffle,
// MIT + Commons Clause), rewritten without React or GSAP for this site. Defaults as there:
// direction "right", 0.35 s per letter, ease power3.out, odd letters first then even ones
// ("evenodd"), each letter rolling once.
//   · Every letter gets a window one letter wide; inside it a strip [letter, copies…] slides
//     until the letter sits in the window.
//   · Works on plain text (it splits it into letters) or on an element whose letters are
//     already spans (pass them as `letters`, e.g. the hero name's .name-letter spans).
//   · When it is done the original markup is put back, so nothing changes for the layout.
// Usage: shuffleIn(el, { stagger: 0.03 }) → Promise when finished.

const power3Out = (t) => 1 - (1 - t) ** 4; // GSAP's power3.out is a quartic ease-out

export function shuffleIn(el, opts = {}) {
  const { duration = 0.35, stagger = 0.03, shuffleTimes = 1, charset = "", letters: given } = opts;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  // Letters: given spans, or split the element's text into spans now (undone at the end).
  let restore = () => {};
  let letters = given ? [...given] : null;
  if (!letters) {
    const text = el.textContent;
    el.textContent = "";
    // one inline wrapper, so the letters stay in a line of text even inside a flex box
    // (as separate flex items the spaces between words would collapse)
    const line = document.createElement("span");
    el.append(line);
    letters = [...text].map((ch) => {
      const s = document.createElement("span");
      s.textContent = ch;
      line.append(s);
      return s;
    });
    restore = () => (el.textContent = letters.map((s) => s.textContent).join(""));
  }
  const pick = (ch) => (charset ? charset[Math.floor(Math.random() * charset.length)] : ch);
  const cells = letters
    .filter((s) => s.textContent.trim())
    .map((s) => {
      const ch = s.textContent,
        w = s.getBoundingClientRect().width,
        html = s.innerHTML;
      // window → strip: [the letter, shuffleTimes rolls]; the strip starts on its last cell
      s.innerHTML = "";
      const win = document.createElement("span");
      win.style.cssText = `display:inline-block;overflow:hidden;vertical-align:bottom;width:${w}px;white-space:nowrap`;
      const strip = document.createElement("span");
      strip.style.cssText = "display:inline-flex;will-change:transform";
      for (const c of [ch, ...Array.from({ length: shuffleTimes }, () => pick(ch))]) {
        const cell = document.createElement("span");
        cell.style.cssText = `display:inline-block;width:${w}px;text-align:center`;
        cell.textContent = c;
        strip.append(cell);
      }
      win.append(strip);
      s.append(win);
      return { s, html, strip, from: -w * shuffleTimes };
    });
  // "evenodd": odd letters (1, 3, 5…) go first, the even ones after 70 % of that run.
  const odd = cells.filter((_, i) => i % 2 === 1),
    even = cells.filter((_, i) => i % 2 === 0),
    evenStart = (duration + Math.max(0, odd.length - 1) * stagger) * 0.7;
  odd.forEach((c, i) => (c.delay = i * stagger));
  even.forEach((c, i) => (c.delay = evenStart + i * stagger));
  const total = Math.max(0, ...cells.map((c) => c.delay)) + duration;
  cells.forEach((c) => (c.strip.style.transform = `translateX(${c.from}px)`));
  return new Promise((done) => {
    const t0 = performance.now();
    const frame = (now) => {
      const t = (now - t0) / 1000;
      for (const c of cells) {
        const k = Math.min(1, Math.max(0, (t - c.delay) / duration));
        c.strip.style.transform = `translateX(${(c.from * (1 - power3Out(k))).toFixed(2)}px)`;
      }
      if (t < total) requestAnimationFrame(frame);
      else {
        cells.forEach((c) => (c.s.innerHTML = c.html));
        restore();
        done();
      }
    };
    requestAnimationFrame(frame);
  });
}
