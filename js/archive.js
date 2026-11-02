// Archive collection page: the search bar and the 3D viewer.
//   · Typing in the bar (or pressing "/") filters the pieces on the shelf by name, type,
//     country or location.
//   · Clicking a piece opens it as an interactive 3D card (js/card3d.js) with its details on
//     the right. ← / → change piece, F flips, Esc closes. The address keeps the piece
//     (…/la-barra/#bar-luce) so it can be shared.
import { collections } from "./archive-data.js";

export function bindCollection(main) {
  const wall = main.querySelector(".arch-wall");
  if (!wall) return () => {};
  const collection = collections.find((c) => c.id === wall.dataset.collection);
  const items = collection.items;
  const viewer = document.querySelector("#arch-viewer"),
    stage = viewer.querySelector("#arch-stage"),
    q = wall.querySelector("#arch-q"),
    empty = wall.querySelector("#arch-empty"),
    shown = wall.querySelector("#arch-shown"),
    cells = [...wall.querySelectorAll(".arch-cell")],
    flipBtn = viewer.querySelector("#arch-flip");
  const root = document.documentElement;
  const pad = (n) => String(n).padStart(2, "0");
  const $ = (id) => viewer.querySelector(id);
  let card = null,
    index = -1,
    opener = null,
    loading = null;

  // ── search ──
  const filter = () => {
    const words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
    let n = 0;
    for (const cell of cells) {
      const hit = words.every((w) => cell.dataset.search.includes(w));
      cell.classList.toggle("off", !hit);
      cell.inert = !hit;
      if (hit) n++;
    }
    shown.textContent = pad(n);
    empty.hidden = n > 0;
  };
  q.addEventListener("input", filter);
  wall.querySelector(".arch-search").addEventListener("submit", (e) => e.preventDefault());

  // ── viewer ──
  const ensureCard = () =>
    (loading ||= import("./card3d.js").then((m) => {
      card = m.mountCard(stage);
      stage.addEventListener("face", (e) => (flipBtn.textContent = e.detail.back ? "See the front" : "See the back"));
    }));
  const show = async (i) => {
    index = (i + items.length) % items.length;
    const it = items[index];
    $("#arch-no").textContent = pad(index + 1);
    $("#arch-name").textContent = it.name;
    $("#arch-type").textContent = it.type;
    $("#arch-country").textContent = it.country || "—";
    $("#arch-location").textContent = it.location || "—";
    flipBtn.textContent = "See the back";
    history.replaceState(null, "", `#${it.id}`);
    await ensureCard().catch(() => stage.classList.add("failed"));
    if (card && items[index] === it) card.setItem(it);
  };
  const open = (id, from) => {
    const i = items.findIndex((it) => it.id === id);
    if (i < 0) return;
    opener = from || null;
    viewer.hidden = false;
    root.classList.add("arch-open");
    wall.inert = true;
    document.querySelector(".header").inert = true;
    show(i);
    requestAnimationFrame(() => viewer.classList.add("on"));
    viewer.querySelector(".arch-close").focus({ preventScroll: true });
  };
  const close = () => {
    if (viewer.hidden) return;
    viewer.classList.remove("on");
    root.classList.remove("arch-open");
    wall.inert = false;
    document.querySelector(".header").inert = false;
    history.replaceState(null, "", location.pathname);
    setTimeout(() => (viewer.hidden = true), 280);
    (opener?.isConnected ? opener : null)?.focus({ preventScroll: true });
  };

  const onClick = (e) => {
    const piece = e.target.closest(".arch-piece");
    if (piece && wall.contains(piece)) open(piece.dataset.id, piece);
  };
  main.addEventListener("click", onClick);
  viewer.querySelector(".arch-close").addEventListener("click", close);
  flipBtn.addEventListener("click", () => card?.flip());
  $("#arch-prev").addEventListener("click", () => show(index - 1));
  $("#arch-next").addEventListener("click", () => show(index + 1));
  viewer.addEventListener("click", (e) => {
    if (e.target === viewer) close();
  });

  const onKey = (e) => {
    if (!viewer.hidden) {
      if (e.key === "Escape") (e.preventDefault(), e.stopPropagation(), close());
      else if (e.key === "ArrowRight") show(index + 1);
      else if (e.key === "ArrowLeft") show(index - 1);
      else if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey) card?.flip();
      else if (e.key === "Tab") {
        const f = [...viewer.querySelectorAll("button")].filter((b) => !b.disabled);
        const first = f[0],
          last = f.at(-1);
        if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
        else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
      }
    } else if (e.key === "/" && document.activeElement !== q && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      q.focus();
    } else if (e.key === "Escape" && document.activeElement === q) {
      q.value = "";
      filter();
      q.blur();
    }
  };
  addEventListener("keydown", onKey, true);

  // A shared address opens its piece straight away.
  const id = location.hash.slice(1);
  if (id) open(id, null);

  return () => {
    removeEventListener("keydown", onKey, true);
    main.removeEventListener("click", onClick);
    card?.dispose();
    root.classList.remove("arch-open");
    wall.inert = false;
    document.querySelector(".header").inert = false;
  };
}
