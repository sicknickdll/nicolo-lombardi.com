// Hover effects (desktop mouse only, off with reduced motion):
//  · Text: while the cursor is over a paragraph or heading its letters dim a little, and the
//    ones the cursor passes light up (with a glow) and slowly fade back, leaving a trail.
//  · Buttons and links: the label glitches for a moment: letters scramble, the colours split
//    and the text jitters.
// Everything is delegated from `document`, so pages swapped in place keep working.
const TEXT = "p, h1, h2, h3, dt, dd";
const SKIP_TEXT = "a, button, .home, .project-section, .menu-items, .intro-overlay, .sr-only, .player, .skip";
const GLITCH = "a[href], button";
const SKIP_GLITCH = ".menu-toggle, .project-open, .brand, .video-thumbnail, .gallery-prev, .gallery-next, .skip, .view-project";
const GLYPHS = "!<>-_\\/[]{}=+*^?#$%&~";
const GLITCH_MS = 380,
  FADE_MS = 1100;

export function hoverFx() {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // ── text trail ──
  // Wraps every character of a block in a span (spaces stay real text, so lines wrap as before).
  const split = (el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) if (walker.currentNode.data.trim()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const frag = document.createDocumentFragment();
      for (const part of node.data.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) frag.append(part);
        else {
          const word = document.createElement("span");
          word.className = "fx-word";
          for (const ch of part) {
            const c = document.createElement("span");
            c.className = "fx-char";
            c.textContent = ch;
            word.append(c);
          }
          frag.append(word);
        }
      }
      node.replaceWith(frag);
    }
    el.dataset.fx = "1";
  };
  const timers = new WeakMap();
  const light = (c, k) => {
    c.style.setProperty("--k", k);
    c.classList.add("lit");
    clearTimeout(timers.get(c));
    // Next frame: drop the class so the CSS transition fades it back.
    timers.set(
      c,
      setTimeout(() => c.classList.remove("lit"), 40),
    );
  };
  let current = null;
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse" || !(e.target instanceof Element)) return;
    const char = e.target.closest(".fx-char");
    if (char) {
      // Light the letter under the cursor and two on either side, fading with distance.
      light(char, 1);
      let n = char.nextElementSibling,
        p = char.previousElementSibling;
      for (const k of [0.55, 0.25]) {
        if (n) (light(n, k), (n = n.nextElementSibling));
        if (p) (light(p, k), (p = p.previousElementSibling));
      }
      return;
    }
    const block = e.target.closest(TEXT);
    if (block && !block.closest(SKIP_TEXT) && !block.querySelector(".sc-char,.sc-pending") && !block.closest(".sc-pending")) {
      if (!block.dataset.fx) split(block);
      if (current !== block) {
        current?.classList.remove("fx-on");
        current = block;
        block.classList.add("fx-on");
      }
    }
  });
  document.addEventListener("pointerout", (e) => {
    if (current && !current.contains(e.relatedTarget)) {
      current.classList.remove("fx-on");
      current = null;
    }
  });

  // ── glitch on buttons and links ──
  const running = new WeakSet();
  const glitch = (el) => {
    if (running.has(el)) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) if (walker.currentNode.data.trim()) nodes.push(walker.currentNode);
    if (!nodes.length || el.querySelector("img,video,canvas,svg")) return;
    running.add(el);
    const originals = nodes.map((n) => n.data);
    const box = el.getBoundingClientRect();
    // Keep the label's size while its letters change, so nothing around it moves.
    const display = getComputedStyle(el).display;
    if (display === "inline") el.style.display = "inline-block";
    el.style.minWidth = box.width + "px";
    el.classList.add("fx-glitch");
    const start = performance.now();
    let last = 0;
    const tick = (now) => {
      const t = now - start;
      if (t >= GLITCH_MS) {
        nodes.forEach((n, i) => (n.data = originals[i]));
        el.classList.remove("fx-glitch");
        el.style.minWidth = "";
        if (display === "inline") el.style.display = "";
        running.delete(el);
        return;
      }
      if (now - last > 45) {
        last = now;
        const settled = t / GLITCH_MS; // letters settle left to right
        nodes.forEach((n, i) => {
          const src = originals[i];
          n.data = [...src]
            .map((ch, j) => (/\s/.test(ch) || j / src.length < settled * 1.1 - 0.1 ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
            .join("");
        });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse" || !(e.target instanceof Element)) return;
    const el = e.target.closest(GLITCH);
    if (!el || el.closest(SKIP_GLITCH) || el.contains(e.relatedTarget)) return;
    glitch(el);
  });
}
