// Landing intro, in the manner of auge-xp.com. On a light screen: the name in bold capitals,
// a line in italic Caslon under it and a counter at the bottom. A black panel with a curved
// edge sweeps up behind the text (which turns white with it: mix-blend-mode), the italic line
// scrambles while the counter runs to 100, then the whole screen lifts away with a curved
// bottom edge and the page is underneath.
// It only runs when the inline script in template.html added `html.intro` (entering the site
// or reloading the landing page, not coming back to it from another page, and never with
// reduced motion). Any click, tap or key skips it.

const NAME = "NICOLÓ LOMBARDI";
const LINE = "Portfolio";
const GLYPHS = "abcdefghijklmnopqrstuvwxyz";
// ms
const T = { sweep: 250, count: 1900, scrambleFrom: 450, scrambleTo: 1700, lift: 2150, liftFor: 900 };

export function playIntro() {
  const root = document.documentElement;
  const heroVideo = document.querySelector("#entrance-video");
  heroVideo?.pause();
  const blocked = [document.querySelector("#main"), document.querySelector(".header")];
  blocked.forEach((el) => el && (el.inert = true));

  const el = document.createElement("div");
  el.className = "intro-overlay";
  el.innerHTML = `<div class="intro-sweep"></div><div class="intro-mark" aria-hidden="true"><p class="intro-name">${NAME}</p><p class="intro-line caslon">${LINE}</p></div><p class="intro-count" aria-hidden="true">000</p>`;
  document.body.append(el);
  const line = el.querySelector(".intro-line"),
    count = el.querySelector(".intro-count");

  let raf = 0,
    ended = false,
    resolve;
  const finished = new Promise((r) => (resolve = r));
  const t0 = performance.now();
  const frame = (now) => {
    const t = now - t0;
    count.textContent = String(Math.round(Math.min(1, t / T.count) * 100)).padStart(3, "0");
    // the italic line: random letters between scrambleFrom and scrambleTo, resolving left to right
    if (t > T.scrambleFrom && t < T.scrambleTo) {
      const k = (t - T.scrambleFrom) / (T.scrambleTo - T.scrambleFrom),
        done = Math.floor(k * k * LINE.length);
      line.textContent = [...LINE].map((c, i) => (i < done ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join("");
    } else if (t >= T.scrambleTo) line.textContent = LINE;
    if (t >= T.lift) return end(false);
    raf = requestAnimationFrame(frame);
  };
  setTimeout(() => el.classList.add("is-swept"), T.sweep);
  raf = requestAnimationFrame(frame);

  function end(fast) {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    count.textContent = "100";
    line.textContent = LINE;
    root.classList.remove("intro");
    heroVideo?.play().catch(() => {});
    blocked.forEach((b) => b && (b.inert = false));
    el.classList.add(fast ? "is-skipped" : "is-lifting");
    removeEventListener("keydown", skipKey);
    setTimeout(
      () => {
        el.remove();
        resolve();
      },
      fast ? 450 : T.liftFor + 50,
    );
  }
  const skipKey = (e) => !e.metaKey && !e.ctrlKey && !e.altKey && end(true);
  el.addEventListener("pointerdown", () => end(true));
  addEventListener("keydown", skipKey);
  return finished;
}
