// Text "decode" on project pages: when the About block scrolls into view its letters
// shuffle through random glyphs and settle into the real text, left to right.
// Every character keeps the width of the real one, so the paragraph never reflows
// while it scrambles. The original text is put back untouched when it finishes.
const GLYPHS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_./\\|()$%*<>^=?#&~!:;,'";
const FRAME = 45; // ms between glyph changes

// A glyph must fit the box of the letter it replaces, or it would overlap its neighbours:
// wide letters get any glyph, narrow ones (i, l, comma…) only slim ones. Widths are
// measured once per font, then the candidates are cached per box width.
function glyphPicker(el) {
  const style = getComputedStyle(el);
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.font = `${style.fontWeight} 100px ${style.fontFamily}`;
  const widths = [...GLYPHS].map((g) => ({ g, em: ctx.measureText(g).width / 100 }));
  const cache = new Map();
  return (em) => {
    const key = Math.round(em * 20);
    let pool = cache.get(key);
    if (!pool) {
      pool = widths.filter((w) => w.em <= em + 0.04).map((w) => w.g);
      if (!pool.length) pool = ["."];
      cache.set(key, pool);
    }
    return pool[(Math.random() * pool.length) | 0];
  };
}

// Replaces every word with one fixed-width span per character (spaces and line
// breaks stay real text, so lines wrap exactly as before). Returns the character spans.
function split(root) {
  const letters = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  // Widths are read first, from plain inline spans, so splitting can't change them.
  const plans = nodes.map((node) => {
    const size = parseFloat(getComputedStyle(node.parentElement).fontSize) || 16;
    const range = document.createRange();
    const words = [];
    for (const m of node.data.matchAll(/\S+/g)) {
      const chars = [...m[0]].map((ch, i) => {
        range.setStart(node, m.index + i);
        range.setEnd(node, m.index + i + ch.length);
        return { ch, em: range.getBoundingClientRect().width / size };
      });
      words.push({ at: m.index, len: m[0].length, chars });
    }
    return { node, words };
  });
  for (const { node, words } of plans) {
    const frag = document.createDocumentFragment();
    let pos = 0;
    for (const w of words) {
      if (w.at > pos) frag.append(node.data.slice(pos, w.at));
      const word = document.createElement("span");
      word.className = "sc-word";
      word.setAttribute("aria-hidden", "true");
      for (const { ch, em } of w.chars) {
        const c = document.createElement("span");
        c.className = "sc-char";
        c.style.width = em + "em";
        c.textContent = ch;
        c.dataset.ch = ch;
        c.dataset.em = em;
        word.append(c);
        letters.push(c);
      }
      frag.append(word);
      pos = w.at + w.len;
    }
    if (pos < node.data.length) frag.append(node.data.slice(pos));
    node.replaceWith(frag);
  }
  return letters;
}

function decode(el) {
  const original = [...el.childNodes].map((n) => n.cloneNode(true));
  const spoken = el.textContent;
  const letters = split(el);
  const pick = glyphPicker(el);
  const reader = document.createElement("span");
  reader.className = "sr-only";
  reader.textContent = spoken;
  el.prepend(reader);
  el.classList.remove("sc-pending");

  const n = letters.length;
  const total = Math.min(1900, Math.max(900, 600 + n * 3.2));
  // Each letter settles at its place in the left-to-right wave, plus some jitter.
  const settle = letters.map((_, i) => (i / n) * total * 0.72 + Math.random() * total * 0.28);
  const start = performance.now();
  let last = 0;
  let live = n;
  const tick = (now) => {
    const t = now - start;
    if (now - last >= FRAME) {
      last = now;
      for (let i = 0; i < n; i++) {
        const c = letters[i];
        if (c.dataset.done) continue;
        if (t >= settle[i]) {
          c.textContent = c.dataset.ch;
          c.dataset.done = "1";
          live--;
        } else c.textContent = pick(+c.dataset.em);
      }
    }
    if (live > 0) requestAnimationFrame(tick);
    else el.replaceChildren(...original);
  };
  requestAnimationFrame(tick);
}

// Hides each target until it first scrolls into view, then decodes it once.
// Returns a cleanup function for when the page is replaced.
export function bindScramble(root, selector = ".detail-text h2, .detail-text p") {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const targets = [...root.querySelectorAll(selector)].filter((el) => el.textContent.trim());
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        decode(e.target);
      }),
    { threshold: 0.2, rootMargin: "0px 0px -10% 0px" },
  );
  targets.forEach((el) => {
    // Already scrolled past (e.g. the page opened part-way down): leave it as plain text.
    if (el.getBoundingClientRect().bottom < 0) return;
    el.classList.add("sc-pending");
    io.observe(el);
  });
  return () => io.disconnect();
}
