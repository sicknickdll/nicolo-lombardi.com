// /archive/: a desktop. Markup in js/views.js (archiveMarkup).
//   · Wallpaper: "ARCHIVE" drawn in dots (js/particle-text.js). Every 15 s it glitches: the letters
//     scramble through random characters and settle on another phrase (PHRASES below).
//   · Icons in the top-left corner: readme.txt, one folder per collection, contact.mail.
//     A collection's folder opens on hover and its pieces float out; a click goes to its page.
//     readme / contact: click selects, double-click (or Enter, or a tap) opens a window.
//     Icons can be dragged; View → Clean up icons puts them back.
//   · Windows: drag by the title bar, ● closes, – minimises to the taskbar, click to bring forward.
//   · Menu bar: File / View / Go drop down with an eased motion; on the right "Based in Madrid",
//     the time in Madrid and the dark / light switch.
//   · Taskbar: the "archive" button opens a start menu; each open window has a tab.
//   · The layout (open windows, positions, icon spots, theme) is kept for the visit in sessionStorage.
import { navigateTo } from "./menu.js";
import { esc } from "./views.js";
import { mountParticleText } from "./particle-text.js";
import { play as playSound } from "./sound.js";

const KEY = "nl-desk";
const PHRASES = [
  "WELCOME BACK",
  "WHERE ARE YOU LOOKING?",
  "NEED SOMETHING?",
  "HUMAN FIRST",
  "PLAYGROUND",
  "HEY :)",
  "YOU LOOK GREAT!",
  "ERROR 404",
  "HELLO WORLD!",
  'print("Hello, World!")',
];
const GLITCH_EVERY = 15000; // ms between glitches
const GLITCH_FOR = 650; // ms the scramble lasts
const GLITCH_STEP = 55; // ms between scrambled frames
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/\\<>?!$@";
const touch = matchMedia("(hover: none)");
const small = matchMedia("(max-width: 720px)");

export function bindDesktop(main) {
  const desk = main.querySelector(".desk");
  if (!desk) return () => {};
  const root = document.documentElement;
  root.classList.add("desk-page");
  playSound("archive-loading", 0.55); // heard when arriving from another page (after a click)
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const layer = desk.querySelector(".desk-windows"),
    tabs = desk.querySelector(".desk-tabs"),
    iconList = desk.querySelector(".desk-icons"),
    task = desk.querySelector(".desk-task");
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

  // ── wallpaper: particle text that glitches into another phrase every few seconds ──
  const particles = mountParticleText(desk.querySelector(".desk-particles"), {
    text: "ARCHIVE",
    fontFamily: getComputedStyle(root).getPropertyValue("--head").trim() || "Helvetica, Arial, sans-serif",
    fontWeight: 700,
    fontSize: "clamp(3rem, 12vw, 9rem)",
    density: small.matches ? 3 : 4,
  });
  const phrase = desk.querySelector(".desk-phrase");
  let glitchTimer = 0,
    scrambleTimer = 0,
    lastPick = -1;
  const pick = () => {
    let i;
    do i = Math.floor(Math.random() * PHRASES.length);
    while (i === lastPick && PHRASES.length > 1);
    return PHRASES[(lastPick = i)];
  };
  function glitch() {
    const target = pick();
    phrase.textContent = target;
    if (reduce) return particles.setText(target);
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / GLITCH_FOR);
      if (k >= 1) return particles.setText(target);
      // Letters resolve left to right; the rest are random glyphs (spaces stay spaces).
      const done = Math.floor(k * k * target.length);
      let s = "";
      for (let i = 0; i < target.length; i++)
        s += i < done || target[i] === " " ? target[i] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      particles.setText(s, { glitch: true });
      scrambleTimer = setTimeout(tick, GLITCH_STEP);
    };
    tick();
  }
  glitchTimer = setInterval(() => !document.hidden && glitch(), GLITCH_EVERY);
  // A click on the empty desktop blows the dots apart.
  on(desk, "pointerdown", (e) => {
    if (e.target === desk || e.target.closest(".desk-wall")) particles.burst(e.clientX, e.clientY);
  });

  // ── content of each kind of window ──
  function contentFor(id) {
    if (id === "readme")
      return {
        title: "readme.txt",
        w: 380,
        body: `<div class="dw-doc"><p class="dw-kicker">Archive · Nicoló Lombardi</p><h2 class="caslon">Hello, welcome in.</h2><p>This is my personal archive and playground: things I find and keep, and things I make for fun. Feel free to explore.</p><p class="dw-hint">Hover a folder to peek inside, click to open it.</p></div>`,
      };
    if (id === "leave")
      return {
        title: "leave.exe",
        w: 340,
        body: `<div class="dw-doc"><h2>Back to the portfolio?</h2><p class="dw-choices"><button type="button" class="dw-btn" data-leave="stay">Stay</button><button type="button" class="dw-btn dw-btn-go" data-leave="go">Yes, take me back</button></p></div>`,
      };
    if (id === "mail")
      return {
        title: "contact.mail",
        w: 360,
        body: `<div class="dw-doc"><p class="dw-kicker">New message</p><p><span class="dw-k">To</span> hello.nicolombardi@gmail.com</p><p><span class="dw-k">Subject</span> Archive</p><p>Found something that belongs here? Send it over.</p><p><a class="dw-btn" href="mailto:hello.nicolombardi@gmail.com?subject=Archive">Write an email</a></p></div>`,
      };
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
    el.className = "dw";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", c.title);
    el.style.width = `${c.w}px`;
    el.innerHTML = `<header class="dw-bar"><span class="dw-title">${esc(c.title)}</span><button type="button" class="dw-min" aria-label="Minimise">–</button><button type="button" class="dw-close" aria-label="Close"></button></header><div class="dw-body">${c.body}</div>${c.status ? `<footer class="dw-status"><span>${esc(c.status)}</span></footer>` : ""}`;
    const tab = document.createElement("li");
    tab.innerHTML = `<button type="button">${esc(c.title)}</button>`;
    tabs.append(tab);
    layer.append(el);
    const w = { id, el, tab, x: 0, y: 0, min: false };
    wins.set(id, w);
    if (at) (w.x = at.x), (w.y = at.y);
    else {
      // Windows open to the right of the icons, cascading.
      const left = small.matches ? 0 : iconList.getBoundingClientRect().right - bounds().left + 24;
      if (small.matches) (w.x = 0), (w.y = iconList.getBoundingClientRect().bottom - bounds().top + 8 + (cascade % 4) * 24);
      else (w.x = left + (cascade % 6) * 28), (w.y = 52 + (cascade % 6) * 28);
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
  on(layer, "click", (e) => {
    const choice = e.target.closest("[data-leave]");
    if (choice) {
      const w = wins.get("leave");
      if (choice.dataset.leave === "go") return goodbye();
      return w && close(w);
    }
    const a = e.target.closest("a[href^='/']");
    if (a) (e.preventDefault(), navigateTo(a.getAttribute("href")));
  });

  // ── icons ──
  const icons = [...desk.querySelectorAll(".desk-icon")];
  // a soft sound on every file and folder (assets/sounds/archive-hover.mp3)
  icons.forEach((icon) => icon.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && playSound("archive-hover", 0.45)));
  const iconKey = (icon) => icon.dataset.open || icon.dataset.id;
  const select = (icon) => icons.forEach((i) => i.classList.toggle("sel", i === icon));
  const iconPos = (icon) => {
    const p = state.icons[iconKey(icon)];
    icon.style.transform = p ? `translate(${p.dx}px, ${p.dy}px)` : "";
  };
  icons.forEach(iconPos);
  const leave = (href) => {
    desk.classList.add("leaving");
    setTimeout(() => navigateTo(href), reduce ? 0 : 260);
  };
  const openIcon = (icon) => {
    if (icon.dataset.href) return leave(icon.dataset.href); // a collection: straight to its page
    if (icon.dataset.open === "mail" && touch.matches) return (location.href = icon.href); // the phone's mail app
    open(icon.dataset.open);
  };
  icons.forEach((icon) => {
    let down = null,
      moved = false;
    icon.addEventListener("click", (e) => {
      e.preventDefault();
      if (moved) return;
      select(icon);
      // Collections open on a single click; files on a tap, Enter, or a double-click.
      if (icon.dataset.href || touch.matches || e.detail === 0) openIcon(icon);
    });
    icon.addEventListener("dblclick", (e) => (e.preventDefault(), !icon.dataset.href && openIcon(icon)));
    icon.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.pointerType !== "mouse") return;
      const p = state.icons[iconKey(icon)] || { dx: 0, dy: 0 };
      down = { x: e.clientX, y: e.clientY, dx: p.dx, dy: p.dy, id: e.pointerId };
      moved = false;
    });
    icon.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - down.x,
        dy = e.clientY - down.y;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      if (!moved) (moved = true), icon.setPointerCapture(down.id), icon.classList.add("dragging"), select(icon);
      state.icons[iconKey(icon)] = { dx: down.dx + dx, dy: down.dy + dy };
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
  });

  // ── menu bar ──
  const menuItems = [...desk.querySelectorAll(".desk-menus > li")];
  const isOpen = (li) => li.classList.contains("open");
  const setMenu = (li, yes) => (li.classList.toggle("open", yes), li.firstElementChild.setAttribute("aria-expanded", String(yes)));
  const closeMenus = () => menuItems.forEach((li) => setMenu(li, false));
  menuItems.forEach((li) => {
    const b = li.firstElementChild;
    b.addEventListener("click", () => {
      const was = isOpen(li);
      closeMenus();
      if (!was) setMenu(li, true);
    });
    // Once one menu is open, hovering the others switches to them, like a real menu bar.
    b.addEventListener("pointerenter", () => {
      if (menuItems.some((o) => o !== li && isOpen(o))) (closeMenus(), setMenu(li, true));
    });
  });
  const setTheme = (dark) => {
    state.dark = desk.classList.toggle("dark", dark);
    // the dots take their colour from the page: wait for the colour transition to finish
    setTimeout(particles.recolor, 320);
    save();
  };
  const commands = {
    "open-readme": () => open("readme"),
    "close-all": () => [...wins.values()].forEach(close),
    restore: () => {
      cascade = 0;
      (state.lastOpen?.length ? state.lastOpen : ["readme"]).forEach((id) => open(id));
    },
    arrange: () => ((state.icons = {}), icons.forEach(iconPos), save()),
    theme: () => setTheme(!desk.classList.contains("dark")),
  };
  // Clicking the name: a window asks if you really want to go. If so, the windows close, the files
  // burn away, the dots spell a farewell, and the portfolio comes back.
  let gone = false;
  on(desk.querySelector(".desk-brand"), "click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!gone) open("leave");
  });
  async function goodbye() {
    if (gone) return;
    gone = true;
    clearInterval(glitchTimer);
    clearTimeout(scrambleTimer);
    [...wins.values()].forEach(close);
    const all = [...desk.querySelectorAll(".desk-icon")];
    all.forEach((icon, i) => {
      icon.style.animationDelay = `${(reduce ? 0 : i * 70 + Math.random() * 120) | 0}ms`;
      icon.classList.add("burning");
    });
    desk.classList.add("farewell");
    const word = Math.random() < 0.5 ? "SEE YOU SOON" : "BYE BYE!";
    setTimeout(() => {
      phrase.textContent = word;
      if (reduce) return particles.setText(word);
      const t0 = performance.now();
      const tick = () => {
        const k = Math.min(1, (performance.now() - t0) / 900);
        if (k >= 1) return particles.setText(word);
        const done = Math.floor(k * k * word.length);
        let txt = "";
        for (let i = 0; i < word.length; i++) txt += i < done || word[i] === " " ? word[i] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        particles.setText(txt, { glitch: true });
        scrambleTimer = setTimeout(tick, GLITCH_STEP);
      };
      tick();
    }, reduce ? 0 : 500);
    setTimeout(() => leave("/"), reduce ? 1200 : 3600);
  }
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

  // Time in Madrid, e.g. "16:27 CET" (CEST in summer).
  const time = desk.querySelector(".desk-time");
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
  const tickClock = () => {
    const parts = fmt.formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value || "";
    let zone = get("timeZoneName");
    if (!/^CES?T$/.test(zone)) zone = zone === "GMT+2" ? "CEST" : "CET";
    time.textContent = `${get("hour")}:${get("minute")} ${zone}`;
  };
  tickClock();
  const clock = setInterval(tickClock, 10000);

  const onKey = (e) => {
    if (e.key !== "Escape") return;
    if (menuItems.some(isOpen)) return closeMenus();
    const top = [...wins.values()].find((w) => w.el.classList.contains("focused") && !w.min);
    if (top) close(top);
  };
  addEventListener("keydown", onKey);

  const onResize = () => wins.forEach(place);
  addEventListener("resize", onResize);

  // First visit: the readme is open. Coming back: the windows as they were.
  if (state.open) state.open.forEach((o) => open(o.id, { x: o.x, y: o.y }, { quiet: true, min: o.min }));
  else open("readme", null, { quiet: true });
  desk.classList.add("ready");

  return () => {
    offs.forEach((f) => f());
    particles.off();
    clearInterval(glitchTimer);
    clearTimeout(scrambleTimer);
    clearInterval(clock);
    removeEventListener("keydown", onKey);
    removeEventListener("resize", onResize);
    root.classList.remove("desk-page");
  };
}
