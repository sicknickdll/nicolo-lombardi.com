// Hover effect on buttons and links (desktop mouse only, off with reduced motion): the label
// glitches for a moment: letters scramble, the colours split and the text jitters.
// Delegated from `document`, so pages swapped in place keep working.
const GLITCH = "a[href], button";
const SKIP_GLITCH = ".menu-toggle, .project-open, .brand, .video-thumbnail, .gallery-prev, .gallery-next, .skip, .view-project";
const GLYPHS = "!<>-_\\/[]{}=+*^?#$%&~";
const GLITCH_MS = 380;

export function hoverFx() {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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
