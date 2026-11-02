// Archive collection page: an infinite, pannable grid of the pieces, the search bar and the
// 3D viewer.
//   · The grid wraps endlessly in both directions: drag (mouse or finger) or scroll to pan, it
//     coasts to a stop. Tiles are created and recycled as they come into view.
//   · Typing in the bar (or pressing "/") keeps only the pieces that match the name, type,
//     country or location; the grid fills with those.
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
    grid = wall.querySelector("#arch-grid"),
    flipBtn = viewer.querySelector("#arch-flip");
  const root = document.documentElement;
  const pad = (n) => String(n).padStart(2, "0");
  const $ = (id) => viewer.querySelector(id);
  let card = null,
    index = -1,
    opener = null,
    loading = null;

  // ── the infinite grid ──
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.classList.add("arch-grid-page");
  const searchText = (it) => [it.name, it.type, it.country, it.location].filter(Boolean).join(" ").toLowerCase();
  let list = items; // what the grid cycles through (all, or the search matches)
  const tiles = new Map(); // "col,row" → element
  const dim = { w: 200, h: 276, gap: 20 };
  const pos = { x: 0, y: 0 }, // where the grid is
    target = { x: 0, y: 0 }; // where it is gliding to
  let drag = null,
    moved = false,
    raf = 0,
    last = performance.now();

  const measure = () => {
    const vw = grid.clientWidth;
    dim.w = Math.max(138, Math.min(250, vw * (vw < 700 ? 0.38 : 0.155)));
    dim.h = dim.w * 1.38;
    dim.gap = vw < 700 ? 14 : 20;
  };
  const tileFor = (c, r) => {
    const it = list[(((c + 2 * r) % list.length) + list.length) % list.length];
    const el = document.createElement("button");
    el.type = "button";
    el.className = "arch-piece";
    el.dataset.id = it.id;
    el.style.setProperty("--tone", it.tone || "#2a2824");
    el.setAttribute("aria-label", `${it.name}${it.country ? `, ${it.country}` : ""}`);
    el.tabIndex = -1;
    el.innerHTML = `<img src="${it.thumb}" alt="" draggable="false" decoding="async"><span class="arch-cap"><b>${String(items.indexOf(it) + 1).padStart(2, "0")}</b><span></span></span>`;
    el.querySelector(".arch-cap span").textContent = it.name;
    return el;
  };
  // Create the tiles that are on screen (plus a margin), drop the ones that left.
  const layout = () => {
    const vw = grid.clientWidth,
      vh = grid.clientHeight,
      px = dim.w + dim.gap,
      py = dim.h + dim.gap;
    // Grid origin: tile (0, 0) starts centred on the screen.
    const ox = vw / 2 - dim.w / 2 + pos.x,
      oy = vh / 2 - dim.h / 2 + pos.y;
    const c0 = Math.floor(-ox / px) - 1,
      c1 = Math.ceil((vw - ox) / px) + 1,
      r0 = Math.floor(-oy / py) - 1,
      r1 = Math.ceil((vh - oy) / py) + 1;
    for (const [key, el] of tiles) {
      const [c, r] = key.split(",").map(Number);
      if (c < c0 || c > c1 || r < r0 || r > r1) (el.remove(), tiles.delete(key));
    }
    if (list.length)
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) {
          const key = c + "," + r;
          let el = tiles.get(key);
          if (!el) {
            el = tileFor(c, r);
            el.style.width = dim.w + "px";
            el.style.height = dim.h + "px";
            tiles.set(key, el);
            grid.append(el);
          }
          // Tiles near the middle of the screen sit a little larger: a hint of depth.
          const x = ox + c * px,
            y = oy + r * py;
          const dx = (x + dim.w / 2 - vw / 2) / vw,
            dy = (y + dim.h / 2 - vh / 2) / vh;
          const s = 1 - Math.min(0.1, (dx * dx + dy * dy) * 0.16);
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
        }
  };
  const frame = (now) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!drag) {
      const k = 1 - Math.exp(-(reduce ? 30 : 7) * dt);
      pos.x += (target.x - pos.x) * k;
      pos.y += (target.y - pos.y) * k;
    }
    layout();
    if (drag || Math.abs(target.x - pos.x) > 0.3 || Math.abs(target.y - pos.y) > 0.3) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf) (last = performance.now()), (raf = requestAnimationFrame(frame));
  };
  const rebuild = () => {
    for (const el of tiles.values()) el.remove();
    tiles.clear();
    measure();
    layout();
  };
  new ResizeObserver(rebuild).observe(grid);
  measure();
  layout();

  grid.addEventListener("pointerdown", (e) => {
    if (drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    grid.setPointerCapture?.(e.pointerId);
    drag = { piece: e.target.closest?.(".arch-piece"), id: e.pointerId, x: e.clientX, y: e.clientY, px: pos.x, py: pos.y, lx: e.clientX, ly: e.clientY, t: performance.now(), vx: 0, vy: 0 };
    moved = false;
  });
  grid.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
      moved = true;
      grid.classList.add("panning");
    }
    if (!moved) return;
    const now = performance.now(),
      dt = Math.max(0.004, (now - drag.t) / 1000);
    drag.vx = drag.vx * 0.6 + ((e.clientX - drag.lx) / dt) * 0.4;
    drag.vy = drag.vy * 0.6 + ((e.clientY - drag.ly) / dt) * 0.4;
    drag.lx = e.clientX;
    drag.ly = e.clientY;
    drag.t = now;
    pos.x = drag.px + e.clientX - drag.x;
    pos.y = drag.py + e.clientY - drag.y;
    target.x = pos.x;
    target.y = pos.y;
    kick();
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    // Coast on in the direction it was thrown.
    if (moved && !reduce) {
      target.x = pos.x + drag.vx * 0.32;
      target.y = pos.y + drag.vy * 0.32;
    }
    const piece = drag.piece;
    drag = null;
    grid.classList.remove("panning");
    kick();
    // Pointer capture sends the click to the grid, so a tap is recognised here.
    if (!moved && piece && e.type === "pointerup") open(piece.dataset.id, null);
  };
  grid.addEventListener("pointerup", release);
  grid.addEventListener("pointercancel", release);
  // A drag must not count as a click on the tile it ended on.
  const swallow = (e) => {
    if (moved) (e.stopPropagation(), e.preventDefault(), (moved = false));
  };
  grid.addEventListener("click", swallow, true);
  grid.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || !viewer.hidden) return;
      e.preventDefault();
      const u = e.deltaMode === 1 ? 16 : 1;
      target.x -= e.deltaX * u;
      target.y -= e.deltaY * u;
      kick();
    },
    { passive: false },
  );
  const onGridKey = (e) => {
    if (!viewer.hidden || e.target === q || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const step = dim.w * 1.1;
    if (e.key === "ArrowLeft") target.x += step;
    if (e.key === "ArrowRight") target.x -= step;
    if (e.key === "ArrowUp") target.y += step;
    if (e.key === "ArrowDown") target.y -= step;
    kick();
  };
  addEventListener("keydown", onGridKey);

  // ── search ──
  const filter = () => {
    const words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
    list = items.filter((it) => words.every((w) => searchText(it).includes(w)));
    shown.textContent = pad(list.length);
    empty.hidden = list.length > 0;
    for (const el of tiles.values()) el.remove();
    tiles.clear();
    pos.x = pos.y = target.x = target.y = 0;
    layout();
  };
  q.addEventListener("input", filter);
  // Enter opens the first match.
  wall.querySelector(".arch-search").addEventListener("submit", (e) => {
    e.preventDefault();
    if (list.length) (q.blur(), open(list[0].id, null));
  });

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
    if (piece && wall.contains(piece)) open(piece.dataset.id, null);
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
    removeEventListener("keydown", onGridKey);
    cancelAnimationFrame(raf);
    root.classList.remove("arch-grid-page");
    main.removeEventListener("click", onClick);
    card?.dispose();
    root.classList.remove("arch-open");
    wall.inert = false;
    document.querySelector(".header").inert = false;
  };
}
