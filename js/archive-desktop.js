// /archive/: a desktop. Markup in js/views.js (archiveMarkup).
//   · Icons on the right: readme.txt, one folder per collection, contact.mail. Click selects,
//     double-click (or Enter, or a tap on touch screens) opens. Icons can be dragged around;
//     View → Clean up icons puts them back in their column.
//   · Windows: drag by the title bar, ● closes, – minimises to the taskbar, click to bring forward.
//     A folder lists its pieces as files; a piece opens in its own window (click the scan to see
//     the back); "Open collection" goes to the full collection page.
//   · Taskbar: the "archive" button opens a start menu; each open window has a tab.
//   · The layout (open windows, positions, icon spots, theme) is kept for the visit in sessionStorage.
import { navigateTo } from "./menu.js";
import { collections, upcoming } from "./archive-data.js";
import { esc } from "./views.js";

const KEY = "nl-desk";
const touch = matchMedia("(hover: none)");
const small = matchMedia("(max-width: 720px)");

export function bindDesktop(main) {
  const desk = main.querySelector(".desk");
  if (!desk) return () => {};
  const root = document.documentElement;
  root.classList.add("desk-page");
  const layer = desk.querySelector(".desk-windows"),
    tabs = desk.querySelector(".desk-tabs"),
    iconList = desk.querySelector(".desk-icons"),
    startBtn = desk.querySelector(".desk-start"),
    startMenu = desk.querySelector(".desk-startmenu");
  const offs = [];
  const on = (el, type, fn, opt) => (el.addEventListener(type, fn, opt), offs.push(() => el.removeEventListener(type, fn, opt)));

  let state = {};
  try {
    state = JSON.parse(sessionStorage.getItem(KEY)) || {};
  } catch {}
  state.icons ||= {};
  if (state.dark) desk.classList.add("dark");
  const save = () => {
    state.open = [...wins.values()].map((w) => ({ id: w.id, x: w.x, y: w.y, min: w.min }));
    try {
      sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  };

  // ── content of each kind of window ──
  const folders = new Map([
    ...collections.map((c) => [c.id, { title: c.title, href: `/archive/${c.id}/`, blurb: c.blurb, items: c.items }]),
    ...upcoming.map((u) => [u.href.split("/").filter(Boolean).pop(), { title: u.title, href: u.href, blurb: "Being put together. Nothing to see here yet.", items: [] }]),
  ]);
  const pieceOf = (id) => {
    for (const c of collections) {
      const p = c.items.find((i) => i.id === id);
      if (p) return { c, p };
    }
  };
  function contentFor(id) {
    if (id === "readme")
      return {
        title: "readme.txt",
        w: 380,
        body: `<div class="dw-doc"><p class="dw-kicker">Archive · Nicoló Lombardi</p><h2 class="caslon">Things found and kept.</h2><p>Small pieces of graphic design picked up along the way: napkins and sugar sachets from bars, packaging from convenience stores, rolls of film. Each folder on the right is a collection.</p><p class="dw-hint">${touch.matches ? "Tap" : "Double-click"} a folder to open it.</p></div>`,
        status: `${folders.size} collections`,
      };
    if (id === "mail")
      return {
        title: "contact.mail",
        w: 360,
        body: `<div class="dw-doc"><p class="dw-kicker">New message</p><p><span class="dw-k">To</span> hello.nicolombardi@gmail.com</p><p><span class="dw-k">Subject</span> Archive</p><p>Found something that belongs here? Send it over.</p><p><a class="dw-btn" href="mailto:hello.nicolombardi@gmail.com?subject=Archive">Write an email</a></p></div>`,
      };
    if (id.startsWith("folder:")) {
      const f = folders.get(id.slice(7));
      if (!f) return null;
      const files = f.items.length
        ? `<ul class="dw-files">${f.items.map((i) => `<li><button type="button" data-open="piece:${i.id}"><img src="${i.thumb}" alt="" loading="lazy" draggable="false"><span>${esc(i.name)}</span></button></li>`).join("")}</ul>`
        : `<p class="dw-empty">This folder is empty.</p>`;
      return {
        title: f.title.toLowerCase(),
        w: 560,
        h: 420,
        folder: true,
        body: `<p class="dw-blurb">${esc(f.blurb)}</p>${files}`,
        status: `${f.items.length} ${f.items.length === 1 ? "object" : "objects"}`,
        action: f.items.length ? `<a class="dw-btn" href="${f.href}">Open collection</a>` : "",
      };
    }
    if (id.startsWith("piece:")) {
      const found = pieceOf(id.slice(6));
      if (!found) return null;
      const { c, p } = found;
      return {
        title: `${p.id}.webp`,
        w: 340,
        body: `<button type="button" class="dw-scan" aria-label="Turn it over"><img class="front" src="${p.front}" alt="${esc(p.name)}, front" draggable="false"><img class="back" src="${p.back}" alt="${esc(p.name)}, back" draggable="false" loading="lazy"></button><dl class="dw-facts"><div><dt>Name</dt><dd>${esc(p.name)}</dd></div><div><dt>Type</dt><dd>${esc(p.type)}</dd></div><div><dt>Place</dt><dd>${esc(p.location)}, ${esc(p.country)}</dd></div></dl>`,
        status: c.title,
        action: `<a class="dw-btn" href="/archive/${c.id}/#${p.id}">View in 3D</a>`,
      };
    }
    return null;
  }

  // ── windows ──
  const wins = new Map();
  let z = 10,
    cascade = 0;
  const bounds = () => desk.getBoundingClientRect();
  function place(w) {
    const b = bounds(),
      el = w.el;
    const maxX = Math.max(0, b.width - Math.min(el.offsetWidth, b.width)),
      maxY = Math.max(36, b.height - 80);
    w.x = Math.min(Math.max(0, w.x), maxX);
    w.y = Math.min(Math.max(36, w.y), maxY);
    el.style.transform = `translate(${Math.round(w.x)}px, ${Math.round(w.y)}px)`;
  }
  function focus(w) {
    for (const o of wins.values()) o.el.classList.toggle("focused", o === w), o.tab.classList.toggle("on", o === w && !o.min);
    w.el.style.zIndex = ++z;
  }
  function open(id, at, opts = {}) {
    const have = wins.get(id);
    if (have) {
      if (have.min) minimise(have, false);
      focus(have);
      return have;
    }
    const c = contentFor(id);
    if (!c) return;
    const el = document.createElement("article");
    el.className = `dw${c.folder ? " dw-folder" : ""}`;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", c.title);
    el.style.width = `${c.w}px`;
    if (c.h) el.style.height = `${c.h}px`;
    el.innerHTML = `<header class="dw-bar"><span class="dw-title">${esc(c.title)}</span><button type="button" class="dw-min" aria-label="Minimise">–</button><button type="button" class="dw-close" aria-label="Close"></button></header><div class="dw-body">${c.body}</div>${c.status || c.action ? `<footer class="dw-status"><span>${esc(c.status || "")}</span>${c.action || ""}</footer>` : ""}`;
    const tab = document.createElement("li");
    tab.innerHTML = `<button type="button">${esc(c.title)}</button>`;
    tabs.append(tab);
    layer.append(el);
    const w = { id, el, tab, x: 0, y: 0, min: false };
    wins.set(id, w);
    if (at) (w.x = at.x), (w.y = at.y);
    else {
      const b = bounds();
      if (small.matches) (w.x = 0), (w.y = iconList.getBoundingClientRect().bottom - b.top + 8 + (cascade % 4) * 24);
      else (w.x = 24 + (cascade % 6) * 28 + (id === "readme" ? 0 : b.width * 0.22)), (w.y = 52 + (cascade % 6) * 28);
      cascade++;
    }
    place(w);
    if (!opts.quiet) el.classList.add("pop");
    if (opts.min) minimise(w, true);
    else focus(w);
    tab.firstChild.addEventListener("click", () => (w.min || !w.el.classList.contains("focused") ? (minimise(w, false), focus(w)) : minimise(w, true)));
    el.addEventListener("pointerdown", () => focus(w));
    el.querySelector(".dw-close").addEventListener("click", () => close(w));
    el.querySelector(".dw-min").addEventListener("click", () => minimise(w, true));
    el.querySelector(".dw-scan")?.addEventListener("click", (e) => e.currentTarget.classList.toggle("flipped"));
    dragBy(el.querySelector(".dw-bar"), w);
    save();
    return w;
  }
  function close(w) {
    wins.delete(w.id);
    w.tab.remove();
    w.el.classList.add("closing");
    setTimeout(() => w.el.remove(), 160);
    save();
  }
  function minimise(w, yes) {
    w.min = yes;
    w.el.hidden = yes;
    w.tab.classList.toggle("on", !yes);
    save();
  }
  function dragBy(handle, w) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button")) return;
      const sx = e.clientX - w.x,
        sy = e.clientY - w.y;
      handle.setPointerCapture(e.pointerId);
      w.el.classList.add("dragging");
      const move = (ev) => ((w.x = ev.clientX - sx), (w.y = ev.clientY - sy), place(w));
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        w.el.classList.remove("dragging");
        save();
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    });
  }

  // Links inside windows: in-site addresses move without reloading; pieces/folders open windows.
  on(layer, "click", (e) => {
    const opener = e.target.closest("[data-open]");
    if (opener) return open(opener.dataset.open);
    const a = e.target.closest("a[href^='/']");
    if (a) (e.preventDefault(), navigateTo(a.getAttribute("href")));
  });

  // ── icons ──
  const icons = [...iconList.querySelectorAll(".desk-icon")];
  const select = (icon) => icons.forEach((i) => i.classList.toggle("sel", i === icon));
  const iconPos = (icon) => {
    const p = state.icons[icon.dataset.open];
    icon.classList.toggle("moved", Boolean(p));
    icon.style.transform = p ? `translate(${p.dx}px, ${p.dy}px)` : "";
  };
  icons.forEach(iconPos);
  const openIcon = (icon) => {
    const id = icon.dataset.open;
    if (id === "mail" && touch.matches) return; // let the phone open its mail app
    open(id);
  };
  icons.forEach((icon) => {
    let down = null,
      moved = false;
    icon.addEventListener("click", (e) => {
      if (icon.dataset.open === "mail" && touch.matches) return;
      e.preventDefault();
      if (moved) return;
      select(icon);
      if (touch.matches || e.detail === 0) openIcon(icon); // tap, or Enter from the keyboard
    });
    icon.addEventListener("dblclick", (e) => (e.preventDefault(), openIcon(icon)));
    icon.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.pointerType !== "mouse") return;
      const p = state.icons[icon.dataset.open] || { dx: 0, dy: 0 };
      down = { x: e.clientX, y: e.clientY, dx: p.dx, dy: p.dy, id: e.pointerId };
      moved = false;
      select(icon);
    });
    icon.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - down.x,
        dy = e.clientY - down.y;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      if (!moved) (moved = true), icon.setPointerCapture(down.id), icon.classList.add("dragging");
      state.icons[icon.dataset.open] = { dx: down.dx + dx, dy: down.dy + dy };
      iconPos(icon);
    });
    const up = () => {
      if (!down) return;
      down = null;
      icon.classList.remove("dragging");
      if (moved) save();
    };
    icon.addEventListener("pointerup", up);
    icon.addEventListener("pointercancel", up);
  });
  on(desk, "pointerdown", (e) => {
    if (!e.target.closest(".desk-icon")) select(null);
    if (!e.target.closest(".desk-menus")) closeMenus();
    if (!e.target.closest(".desk-start, .desk-startmenu")) toggleStart(false);
  });

  // ── menu bar ──
  const menuBtns = [...desk.querySelectorAll(".desk-menus > li > button")];
  const closeMenus = () => menuBtns.forEach((b) => ((b.nextElementSibling.hidden = true), b.setAttribute("aria-expanded", "false")));
  menuBtns.forEach((b) => {
    b.addEventListener("click", () => {
      const was = b.getAttribute("aria-expanded") === "true";
      closeMenus();
      if (!was) (b.nextElementSibling.hidden = false), b.setAttribute("aria-expanded", "true");
    });
    // Once one menu is open, hovering the others switches to them, like a real menu bar.
    b.addEventListener("pointerenter", () => {
      if (menuBtns.some((o) => o !== b && o.getAttribute("aria-expanded") === "true")) (closeMenus(), (b.nextElementSibling.hidden = false), b.setAttribute("aria-expanded", "true"));
    });
  });
  const commands = {
    "open-readme": () => open("readme"),
    "close-all": () => [...wins.values()].forEach(close),
    restore: () => {
      cascade = 0;
      const ids = state.lastOpen?.length ? state.lastOpen : ["readme"];
      ids.forEach((id) => open(id));
    },
    arrange: () => ((state.icons = {}), icons.forEach(iconPos), save()),
    theme: () => ((state.dark = desk.classList.toggle("dark")), save()),
  };
  on(desk.querySelector(".desk-bar"), "click", (e) => {
    const cmd = e.target.closest("[data-cmd]");
    if (cmd) {
      if (cmd.dataset.cmd === "close-all") state.lastOpen = [...wins.keys()];
      commands[cmd.dataset.cmd]?.();
      closeMenus();
      return;
    }
    const a = e.target.closest("a[href^='/']");
    if (a) (e.preventDefault(), closeMenus(), navigateTo(a.getAttribute("href")));
  });

  // ── taskbar ──
  const toggleStart = (show = startMenu.hidden) => {
    startMenu.hidden = !show;
    startBtn.setAttribute("aria-expanded", String(show));
  };
  startBtn.addEventListener("click", () => toggleStart());
  startMenu.addEventListener("click", (e) => {
    const a = e.target.closest("[data-open]");
    if (!a) return;
    e.preventDefault();
    toggleStart(false);
    open(a.dataset.open);
  });
  const onKey = (e) => {
    if (e.key !== "Escape") return;
    if (!startMenu.hidden) return toggleStart(false);
    if (menuBtns.some((b) => b.getAttribute("aria-expanded") === "true")) return closeMenus();
    const top = [...wins.values()].find((w) => w.el.classList.contains("focused") && !w.min);
    if (top) close(top);
  };
  addEventListener("keydown", onKey);

  // Date in the menu bar (the visitor's own).
  const date = desk.querySelector(".desk-date");
  date.textContent = new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

  const onResize = () => wins.forEach(place);
  addEventListener("resize", onResize);

  // First visit: the readme is open. Coming back: the windows as they were.
  if (state.open) state.open.forEach((o) => open(o.id, { x: o.x, y: o.y }, { quiet: true, min: o.min }));
  else open("readme", null, { quiet: true });
  desk.classList.add("ready");

  return () => {
    offs.forEach((f) => f());
    removeEventListener("keydown", onKey);
    removeEventListener("resize", onResize);
    root.classList.remove("desk-page");
  };
}
