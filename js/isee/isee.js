// /archive/i-see-u/: I SEE U. Hold the cursor still and a painting appears whose sitter looks
// right at it. Move, and the painting is gone. After Pointer Pointer (pointerpointer.com), with
// gazes instead of fingers: the paintings and where each one looks are in js/isee/paintings.js,
// made by tools/isee/ (see the README); the matching is js/isee/match.js.
import { PAINTINGS } from "./paintings.js";
import { pick } from "./match.js";

const STILL = 320; // ms the cursor must rest before someone looks
const SLACK = 6; // px the cursor may drift while a painting is shown

export function mountIsee(root) {
  const stage = root.querySelector(".is-stage"),
    img = root.querySelector(".is-img"),
    hint = root.querySelector(".is-hint"),
    load = root.querySelector(".is-load"),
    dot = root.querySelector(".is-dot"),
    cite = root.querySelector(".is-cite"),
    live = root.querySelector(".is-live"),
    touch = matchMedia("(hover: none)");
  hint.textContent = touch.matches ? "Tap anywhere." : "Hold the cursor still.";
  const recent = [];
  let timer = 0,
    shown = null, // { x, y } where the painting was asked for
    ticket = 0,
    last = null;

  const hide = () => {
    ticket++;
    shown = null;
    root.classList.remove("is-on", "is-busy");
    cite.hidden = true;
  };
  const fill = (p) => {
    cite.querySelector(".is-title").textContent = p.title;
    cite.querySelector(".is-artist").textContent = p.artist;
    cite.querySelector(".is-meta").textContent = [p.date, p.medium].filter(Boolean).join(" · ");
    cite.querySelector(".is-museum").textContent = [p.museum, p.accession].filter(Boolean).join(", ");
    const a = cite.querySelector(".is-link");
    a.href = p.link;
    a.hidden = !p.link;
  };
  const look = (x, y) => {
    const r = stage.getBoundingClientRect(),
      hit = pick(PAINTINGS, r.width, r.height, x, y, recent);
    if (!hit) return;
    const { p, at } = hit,
      mine = ++ticket;
    shown = { x, y };
    root.classList.add("is-busy");
    load.style.transform = `translate(${x}px, ${y}px)`;
    dot.style.transform = `translate(${x}px, ${y}px)`;
    const pre = new Image();
    pre.src = p.src;
    (pre.decode ? pre.decode() : Promise.resolve())
      .catch(() => {})
      .then(() => {
        if (mine !== ticket) return;
        img.src = p.src;
        img.alt = `${p.title}, ${p.artist}`;
        img.style.width = `${at.w}px`;
        img.style.height = `${at.h}px`;
        img.style.transform = `translate(${at.x}px, ${at.y}px)`;
        fill(p);
        cite.hidden = false;
        root.classList.remove("is-busy");
        root.classList.add("is-on");
        live.textContent = `${p.title}, by ${p.artist}, looks at you.`;
        recent.push(p.id);
        if (recent.length > 24) recent.shift();
      });
  };

  const onMove = (e) => {
    if (e.pointerType === "touch") return;
    last = { x: e.clientX, y: e.clientY };
    if (cite.contains(e.target)) return; // reading the caption, reaching for its link
    if (shown && Math.hypot(e.clientX - shown.x, e.clientY - shown.y) <= SLACK) return;
    if (shown || root.classList.contains("is-busy")) hide();
    clearTimeout(timer);
    timer = setTimeout(() => look(last.x, last.y), STILL);
  };
  const onDown = (e) => {
    if (e.pointerType !== "touch" || cite.contains(e.target) || e.target.closest("a")) return;
    hide();
    look(e.clientX, e.clientY);
  };
  // the mouse leaving the window (a finger lifting also "leaves": that keeps the painting)
  const onLeave = (e) => e.pointerType === "mouse" && (clearTimeout(timer), hide());
  // the keyboard: Enter or Space asks for a look at the cursor (or the middle of the screen)
  const onKey = (e) => {
    if (e.key === "Escape") return hide();
    if ((e.key === "Enter" || e.key === " ") && !e.target.closest("a")) {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      hide();
      look(last ? last.x : r.width / 2, last ? last.y : r.height / 2);
    }
  };
  const onResize = () => hide();
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerdown", onDown);
  document.documentElement.addEventListener("pointerleave", onLeave);
  addEventListener("keydown", onKey);
  addEventListener("resize", onResize);
  root.classList.add("is-ready");
  return () => {
    clearTimeout(timer);
    ticket++;
    root.removeEventListener("pointermove", onMove);
    root.removeEventListener("pointerdown", onDown);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    removeEventListener("keydown", onKey);
    removeEventListener("resize", onResize);
  };
}
