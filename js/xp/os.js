// Easter egg: click the landing-page name 5 times → the page glitches into
// "Nicoló OS", a Windows XP–inspired desktop. All artwork and code are original
// (no Microsoft assets). Loaded only when triggered; games load on first open.
import { projects, filmOrder, visualsOrder, hero, heroPoster } from "../data.js";
import { pixelCurtain } from "../pixels.js";

export const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const byId = (id) => projects.find((p) => p.id === id);
const nameOf = (p) => (p.title === p.brand ? p.brand : `${p.brand} — ${p.title}`);
const isSmall = () => innerWidth < 760;
const touchOnly = () => matchMedia("(hover: none)").matches;

// ── Icons (original SVGs) ───────────────────────────────────────────────────
const svg = (body) => `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${body}</svg>`;
// Original Windows XP icons (assets/xp/icons). The Command Prompt uses Nicoló's eye.
const img = (src) => `<img class="xp-ico" src="${src}" alt="" draggable="false">`;
const xp = (f) => img(`/assets/xp/icons/${f}.png`);
export const ICONS = {
  computer: xp("computer"),
  folder: xp("pictures"),
  notepad: xp("notepad"),
  media: xp("wmp"),
  mine: img("/assets/xp/mines/mine-icon.png"),
  bin: xp("recycle"),
  globe: xp("ie"),
  mail: xp("outlook"),
  cards: xp("solitaire"),
  pinball: xp("pinball"),
  paint: xp("paint"),
  cmd: img("/assets/anime-eye-icon-64.png"),
  help: xp("help"),
  power: xp("turnoff"),
  logoff: xp("logoff"),
  restart: xp("restart"),
  back: xp("back"),
  forward: xp("forward"),
  search: xp("search"),
  error: xp("error"),
  instagram: svg(
    `<rect x="6" y="6" width="36" height="36" rx="10" fill="#d6336c"/><rect x="14" y="14" width="20" height="20" rx="6" fill="none" stroke="#fff" stroke-width="3"/><circle cx="24" cy="24" r="4.5" fill="none" stroke="#fff" stroke-width="3"/><circle cx="33" cy="15" r="1.8" fill="#fff"/>`,
  ),
  linkedin: svg(
    `<rect x="6" y="6" width="36" height="36" rx="5" fill="#0a66c2"/><text x="24" y="32" text-anchor="middle" font-family="Arial" font-weight="700" font-size="20" fill="#fff">in</text>`,
  ),
  file: svg(
    `<path d="M11 5h18l8 8v30H11z" fill="#fff" stroke="#7d8a99"/><path d="M29 5v8h8" fill="#e6edf4" stroke="#7d8a99"/>`,
  ),
};
// Clappy: an original clapperboard assistant.
const CLAPPY = `<svg viewBox="0 0 100 100" aria-hidden="true"><g class="xp-clappy-top"><path d="M14 30 L84 14 L87 26 L17 42 Z" fill="#222"/><path d="M24 27.7l8 12M40 24l8 12M56 20.4l8 12M72 16.8l8 12" stroke="#fff" stroke-width="6"/></g><rect x="14" y="40" width="72" height="50" rx="4" fill="#222"/><rect x="14" y="40" width="72" height="9" fill="#fff"/><path d="M22 40l8 9M38 40l8 9M54 40l8 9M70 40l8 9" stroke="#222" stroke-width="5"/><g class="xp-clappy-eyes"><ellipse cx="38" cy="66" rx="9" ry="11" fill="#fff"/><ellipse cx="62" cy="66" rx="9" ry="11" fill="#fff"/><circle cx="40" cy="68" r="4.5" fill="#111"/><circle cx="64" cy="68" r="4.5" fill="#111"/></g><path d="M30 52q8-5 16 0M54 52q8-5 16 0" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`;

// ── Glitch transition ───────────────────────────────────────────────────────
function glitch(duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 250 : 1100) {
  return new Promise((resolve) => {
    const root = document.documentElement;
    root.classList.add("xp-glitching");
    const c = document.createElement("canvas");
    c.className = "xp-glitch";
    c.width = innerWidth;
    c.height = innerHeight;
    document.body.append(c);
    const ctx = c.getContext("2d");
    const colors = ["#fff", "#000", "#00f0ff", "#ff2bd6", "#39ff14"];
    const start = performance.now();
    const frame = (now) => {
      const t = (now - start) / duration;
      ctx.clearRect(0, 0, c.width, c.height);
      for (let i = 0, n = 6 + Math.floor(t * 40); i < n; i++) {
        ctx.globalAlpha = 0.25 + Math.random() * 0.6;
        ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
        ctx.fillRect(
          Math.random() * c.width * 0.3 - 40,
          Math.random() * c.height,
          c.width * (0.4 + Math.random()),
          2 + Math.random() * (10 + t * 60),
        );
      }
      if (t > 0.75) {
        ctx.globalAlpha = (t - 0.75) * 4;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, c.width, c.height);
      }
      ctx.globalAlpha = 1;
      root.style.setProperty("--gx", `${(Math.random() - 0.5) * 30 * t}px`);
      root.style.setProperty("--gh", `${Math.random() * 360}deg`);
      if (t < 1) requestAnimationFrame(frame);
      else {
        root.classList.remove("xp-glitching");
        resolve(c);
      }
    };
    requestAnimationFrame(frame);
  });
}

// ── Desktop ─────────────────────────────────────────────────────────────────
let desktop = null;

export async function launch() {
  if (desktop) return;
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "/xp.css";
  document.head.append(css);
  const cssReady = new Promise((r) => (css.onload = css.onerror = r));
  document.querySelectorAll("video").forEach((v) => v.pause());
  const [glitchCanvas] = await Promise.all([glitch(), cssReady]);
  boot();
  glitchCanvas.remove();
  document.documentElement.classList.add("xp-open");
}

function boot() {
  desktop = document.createElement("div");
  desktop.id = "xp";
  desktop.setAttribute("role", "application");
  desktop.setAttribute("aria-label", "Nicoló OS desktop");
  desktop.innerHTML = `
    <div class="xp-boot"><div class="xp-boot-logo"><img src="/assets/xp/icons/windows.png" alt=""><div><small>Microsoft<sup>®</sup></small><b>Windows<sup>xp</sup></b></div></div><div class="xp-boot-bar"><i></i><i></i><i></i></div><p>Copyright © Microsoft Corporation</p></div>
    <div class="xp-wallpaper"></div>
    <ul class="xp-icons"></ul>
    <div class="xp-windows"></div>
    <div class="xp-start" hidden></div>
    <div class="xp-clappy" hidden></div>
    <div class="xp-taskbar">
      <button class="xp-start-btn" aria-label="Start"><img src="/assets/xp/icons/start.png" alt="start" draggable="false"></button>
      <div class="xp-tasks"></div>
      <div class="xp-tray"><button class="xp-tray-clappy" aria-label="Show Clappy" title="Clappy">${ICONS.help}</button><time class="xp-clock"></time></div>
    </div>`;
  document.body.append(desktop);
  setTimeout(() => desktop?.querySelector(".xp-boot")?.classList.add("xp-boot-done"), 1900);
  setTimeout(() => desktop?.querySelector(".xp-boot")?.remove(), 2600);
  buildIcons();
  buildStart();
  bindTaskbar();
  tickClock();
  desktop._clock = setInterval(tickClock, 15000);
  setTimeout(() => desktop && clappy.show(), 2900);
}

function exitOS() {
  clearInterval(desktop._clock);
  desktop.remove();
  desktop = null;
  document.documentElement.classList.remove("xp-open");
  scrollTo({ top: 0, behavior: "instant" });
  document
    .querySelector("#entrance-video")
    ?.play()
    .catch(() => {});
}
function turnOffDialog() {
  closeStart();
  const veil = document.createElement("div");
  veil.className = "xp-turnoff";
  veil.innerHTML = `<div class="xp-turnoff-box" role="dialog" aria-label="Turn off computer">
      <header><span>Turn off computer</span><img src="/assets/xp/icons/windows.png" alt=""></header>
      <div class="xp-turnoff-actions">
        <button data-act="standby"><span class="xp-big">${ICONS.logoff}</span>Stand By</button>
        <button data-act="off"><span class="xp-big">${ICONS.power}</span>Turn Off</button>
        <button data-act="restart"><span class="xp-big">${ICONS.restart}</span>Restart</button>
      </div>
      <footer><button class="xp-btn" data-act="cancel">Cancel</button></footer>
    </div>`;
  desktop.append(veil);
  veil.querySelector('[data-act="off"]').focus();
  veil.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    veil.remove();
    if (act === "off") shutdownScreen(() => pixelCurtain(exitOS));
    if (act === "restart")
      shutdownScreen(() => {
        exitOS();
        boot();
        document.documentElement.classList.add("xp-open");
      }, "Restarting…");
    if (act === "standby") {
      const black = document.createElement("div");
      black.className = "xp-standby";
      black.innerHTML = "<p>Click anywhere to wake up</p>";
      black.onclick = () => black.remove();
      desktop.append(black);
    }
  });
}
function shutdownScreen(after, text = "Windows is shutting down…") {
  const s = document.createElement("div");
  s.className = "xp-shutdown";
  s.innerHTML = `<div class="xp-boot-logo"><img src="/assets/xp/icons/windows.png" alt=""><div><small>Microsoft<sup>®</sup></small><b>Windows<sup>xp</sup></b></div></div><p>${text}</p>`;
  desktop.append(s);
  setTimeout(after, 1400);
}

// ── Apps registry ───────────────────────────────────────────────────────────
const lazy = (file, opts) => () =>
  import(`./${file}.js`).then((m) => openWindow({ ...opts, body: (el, w) => m.mount(el, api, w) }));
const APPS = {
  computer: { title: "My Portfolio", icon: "computer", open: () => openExplorer("film") },
  visuals: { title: "My Visuals", icon: "folder", open: () => openExplorer("visuals") },
  browser: { title: "Web Browser", icon: "globe", open: () => openBrowser("/") },
  media: { title: "Media Player", icon: "media", open: () => openMedia() },
  solitaire: {
    title: "Solitaire",
    icon: "cards",
    open: lazy("solitaire", {
      key: "solitaire",
      title: "Solitaire",
      icon: "cards",
      width: 640,
      height: 500,
      className: "xp-solitaire",
    }),
  },
  pinball: {
    title: "3D Pinball",
    icon: "pinball",
    // The real "3D Pinball for Windows – Space Cadet", via the 98.js.org web port.
    open: () =>
      openWindow({
        key: "pinball",
        title: "3D Pinball for Windows - Space Cadet",
        icon: "pinball",
        width: 640,
        height: 520,
        className: "xp-pinball",
        body(el) {
          el.innerHTML = `<iframe src="https://98.js.org/programs/pinball/space-cadet.html" title="3D Pinball for Windows – Space Cadet" allow="autoplay; fullscreen; gamepad" loading="eager"></iframe>`;
        },
      }),
  },
  paint: {
    title: "Paint",
    icon: "paint",
    open: lazy("paint", {
      key: "paint",
      title: "untitled - Paint",
      icon: "paint",
      width: 760,
      height: 540,
      className: "xp-paint",
    }),
  },
  mines: { title: "Minesweeper", icon: "mine", open: () => openMinesweeper() },
  about: { title: "About me.txt", icon: "notepad", open: () => openNotepad() },
  cmd: { title: "Command Prompt", icon: "cmd", open: () => openCmd() },
  mail: {
    title: "E-mail",
    icon: "mail",
    open: () => (location.href = "mailto:hello.nicolombardi@gmail.com"),
  },
  instagram: {
    title: "Instagram",
    icon: "instagram",
    open: () => window.open("https://www.instagram.com/nickprods/", "_blank", "noopener"),
  },
  linkedin: {
    title: "LinkedIn",
    icon: "linkedin",
    open: () => window.open("https://www.linkedin.com/in/nicolo-lombardi/", "_blank", "noopener"),
  },
  bin: { title: "Recycle Bin", icon: "bin", open: () => openRecycleBin() },
  help: { title: "Help (Clappy)", icon: "help", open: () => clappy.show(true) },
};
const DESKTOP_ICONS = [
  "computer",
  "visuals",
  "browser",
  "media",
  "solitaire",
  "pinball",
  "paint",
  "about",
  "cmd",
  "mines",
  "bin",
];

function buildIcons() {
  const list = desktop.querySelector(".xp-icons");
  list.innerHTML = DESKTOP_ICONS.map(
    (key) =>
      `<li><button class="xp-icon" data-app="${key}"><span class="xp-icon-img">${ICONS[APPS[key].icon]}</span><span class="xp-icon-label">${esc(APPS[key].title)}</span></button></li>`,
  ).join("");
  list.addEventListener("click", (e) => {
    const b = e.target.closest(".xp-icon");
    list.querySelectorAll(".xp-icon").forEach((i) => i.classList.toggle("selected", i === b));
    if (b && touchOnly()) APPS[b.dataset.app].open();
  });
  list.addEventListener("dblclick", (e) => {
    const b = e.target.closest(".xp-icon");
    if (b) APPS[b.dataset.app].open();
  });
  list.addEventListener("keydown", (e) => {
    const b = e.target.closest(".xp-icon");
    if (b && e.key === "Enter") APPS[b.dataset.app].open();
  });
  desktop.querySelector(".xp-wallpaper").addEventListener("pointerdown", () => {
    list.querySelectorAll(".xp-icon").forEach((i) => i.classList.remove("selected"));
    closeStart();
  });
  bindMarquee(list);
}

// Click-and-drag selection rectangle on the desktop, like Explorer's.
function bindMarquee(list) {
  const root = desktop;
  root.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    if (!e.target.classList.contains("xp-wallpaper") && e.target !== list) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const box = document.createElement("div");
    box.className = "xp-marquee";
    let started = false;
    const move = (ev) => {
      const x = Math.min(Math.max(ev.clientX, 0), innerWidth);
      const y = Math.min(Math.max(ev.clientY, 0), innerHeight);
      const l = Math.min(x, x0);
      const t = Math.min(y, y0);
      const w = Math.abs(x - x0);
      const h = Math.abs(y - y0);
      if (!started && w < 3 && h < 3) return;
      if (!started) {
        started = true;
        root.append(box);
      }
      Object.assign(box.style, { left: l + "px", top: t + "px", width: w + "px", height: h + "px" });
      list.querySelectorAll(".xp-icon").forEach((i) => {
        const r = i.getBoundingClientRect();
        i.classList.toggle("selected", r.left < l + w && r.right > l && r.top < t + h && r.bottom > t);
      });
    };
    const end = () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", end);
      removeEventListener("pointercancel", end);
      box.remove();
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", end);
    addEventListener("pointercancel", end);
    e.preventDefault();
  });
}

// ── Start menu ──────────────────────────────────────────────────────────────
function buildStart() {
  const start = desktop.querySelector(".xp-start");
  const item = (k, sub = "") =>
    `<li><button data-app="${k}"><span class="xp-mid">${ICONS[APPS[k].icon]}</span><span><b>${esc(APPS[k].title)}</b>${sub ? `<small>${sub}</small>` : ""}</span></button></li>`;
  const link = (k, label) =>
    `<li><button data-app="${k}"><span class="xp-mini">${ICONS[APPS[k].icon]}</span>${esc(label)}</button></li>`;
  start.innerHTML = `
    <header><img src="/assets/xp/icons/user.png" alt=""><span>Nicoló</span></header>
    <div class="xp-start-cols">
      <div class="xp-start-left">
        <ul class="xp-pinned">${item("computer", "Films & projects")}${item("browser", "nicolo-lombardi.com")}</ul>
        <ul>${["solitaire", "pinball", "paint", "media", "cmd", "mines"].map((k) => item(k)).join("")}</ul>
        <ul class="xp-results"></ul>
      </div>
      <div class="xp-start-right">
        <div class="xp-search"><input type="search" placeholder="Search projects…" aria-label="Search projects"></div>
        <ul>
          ${link("computer", "My Films")}${link("visuals", "My Visuals")}${link("about", "About Me")}
          <li class="xp-sep"></li>
          ${link("instagram", "Instagram")}${link("linkedin", "LinkedIn")}${link("mail", "E-mail me")}
          <li class="xp-sep"></li>
          ${link("help", "Help and Support")}${link("bin", "Recycle Bin")}
        </ul>
      </div>
    </div>
    <footer><button data-act="logoff"><span class="xp-mini">${ICONS.logoff}</span>Log Off</button><button data-act="off"><span class="xp-mini">${ICONS.power}</span>Turn Off Computer</button></footer>`;
  start.addEventListener("click", (e) => {
    const b = e.target.closest("[data-app]");
    if (b) {
      closeStart();
      APPS[b.dataset.app].open();
    }
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "off") turnOffDialog();
    if (act === "logoff") {
      closeStart();
      shutdownScreen(() => pixelCurtain(exitOS), "Logging off…");
    }
    const r = e.target.closest("[data-project]");
    if (r) {
      closeStart();
      openBrowser(`/work/${r.dataset.project}/`);
    }
  });
  const input = start.querySelector("input"),
    results = start.querySelector(".xp-results");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    const hits = q
      ? projects
          .filter((p) => `${p.brand} ${p.title} ${p.type}`.toLowerCase().includes(q))
          .slice(0, 7)
      : [];
    results.innerHTML = hits.length
      ? hits
          .map(
            (p) =>
              `<li><button data-project="${p.id}"><span class="xp-mid">${ICONS.file}</span><span><b>${esc(nameOf(p))}</b><small>${esc(p.type)}</small></span></button></li>`,
          )
          .join("")
      : q
        ? `<li class="xp-empty">No projects match “${esc(q)}”.</li>`
        : "";
    start.classList.toggle("searching", !!q);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") results.querySelector("button")?.click();
    if (e.key === "Escape") closeStart();
  });
}
function toggleStart() {
  const s = desktop.querySelector(".xp-start");
  s.hidden = !s.hidden;
  desktop.querySelector(".xp-start-btn").classList.toggle("active", !s.hidden);
  if (!s.hidden && !touchOnly()) setTimeout(() => s.querySelector("input")?.focus(), 50);
}
function closeStart() {
  if (!desktop) return;
  const s = desktop.querySelector(".xp-start");
  s.hidden = true;
  s.querySelector("input").value = "";
  s.classList.remove("searching");
  s.querySelector(".xp-results").innerHTML = "";
  desktop.querySelector(".xp-start-btn").classList.remove("active");
}

// ── Taskbar ─────────────────────────────────────────────────────────────────
function bindTaskbar() {
  desktop.querySelector(".xp-start-btn").onclick = toggleStart;
  desktop.querySelector(".xp-tray-clappy").onclick = () => clappy.show(true);
  desktop.querySelector(".xp-tasks").addEventListener("click", (e) => {
    const b = e.target.closest("[data-win]");
    if (!b) return;
    const w = desktop.querySelector(`#${b.dataset.win}`);
    if (w.hidden) minimize(w, false);
    else if (w.classList.contains("focused")) minimize(w, true);
    else focus(w);
  });
  window.addEventListener("keydown", onKey);
}
function onKey(e) {
  if (!desktop) return window.removeEventListener("keydown", onKey);
  if (e.key === "Escape") closeStart();
}
function tickClock() {
  if (!desktop) return;
  desktop.querySelector(".xp-clock").textContent = new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Window manager ──────────────────────────────────────────────────────────
let zTop = 10,
  winCount = 0;
function openWindow({
  key,
  title,
  icon,
  width = 720,
  height = 480,
  body,
  className = "",
  resizable = true,
}) {
  const existing = key && desktop.querySelector(`.xp-window[data-key="${key}"]`);
  if (existing) {
    minimize(existing, false);
    return existing;
  }
  closeStart();
  const id = `xpwin${++winCount}`;
  const w = document.createElement("section");
  w.className = `xp-window ${className}`;
  w.id = id;
  if (key) w.dataset.key = key;
  w.setAttribute("role", "dialog");
  w.setAttribute("aria-label", title);
  const W = Math.min(width, innerWidth - 16),
    H = Math.min(height, innerHeight - 46);
  const offset = (winCount % 6) * 24;
  Object.assign(w.style, {
    width: W + "px",
    height: H + "px",
    left: Math.max(6, (innerWidth - W) / 2 - 60 + offset) + "px",
    top: Math.max(4, (innerHeight - 30 - H) / 2 - 30 + offset) + "px",
  });
  w.innerHTML = `
    <header class="xp-titlebar"><span class="xp-title-icon">${ICONS[icon]}</span><span class="xp-title">${esc(title)}</span>
      <div class="xp-controls"><button class="xp-min" aria-label="Minimize"></button><button class="xp-max" aria-label="Maximize"></button><button class="xp-close" aria-label="Close"></button></div>
    </header>
    <div class="xp-body"></div>${resizable ? '<span class="xp-grip" aria-hidden="true"></span>' : ""}`;
  desktop.querySelector(".xp-windows").append(w);
  if (isSmall()) w.classList.add("maximized");
  body(w.querySelector(".xp-body"), w);

  const task = document.createElement("button");
  task.className = "xp-task";
  task.dataset.win = id;
  task.innerHTML = `<span class="xp-mini">${ICONS[icon]}</span><span>${esc(title)}</span>`;
  desktop.querySelector(".xp-tasks").append(task);

  w.addEventListener("pointerdown", () => focus(w));
  w.querySelector(".xp-close").onclick = () => close(w);
  w.querySelector(".xp-min").onclick = (e) => {
    e.stopPropagation();
    minimize(w, true);
  };
  w.querySelector(".xp-max").onclick = () => toggleMax(w);
  const bar = w.querySelector(".xp-titlebar");
  bar.addEventListener("dblclick", (e) => !e.target.closest("button") && toggleMax(w));
  dragByTitle(w, bar);
  if (resizable) resizeByGrip(w, w.querySelector(".xp-grip"));
  focus(w);
  w.classList.add("xp-opening");
  setTimeout(() => w.classList.remove("xp-opening"), 200);
  return w;
}
function toggleMax(w) {
  w.classList.toggle("maximized");
  w.dispatchEvent(new Event("xp-resize"));
}
function focus(w) {
  desktop.querySelectorAll(".xp-window").forEach((x) => x.classList.toggle("focused", x === w));
  desktop
    .querySelectorAll(".xp-task")
    .forEach((t) => t.classList.toggle("active", t.dataset.win === w.id));
  w.style.zIndex = ++zTop;
}
function minimize(w, hide) {
  w.hidden = hide;
  if (!hide) focus(w);
  else {
    desktop.querySelector(`[data-win="${w.id}"]`)?.classList.remove("active");
    w.querySelectorAll("video").forEach((v) => v.pause());
  }
  w.dispatchEvent(new Event(hide ? "xp-hide" : "xp-show"));
}
function close(w) {
  w.dispatchEvent(new Event("xp-close"));
  w.querySelectorAll("video").forEach((v) => v.pause());
  desktop.querySelector(`[data-win="${w.id}"]`)?.remove();
  w.remove();
  const next = [...desktop.querySelectorAll(".xp-window:not([hidden])")].sort(
    (a, b) => b.style.zIndex - a.style.zIndex,
  )[0];
  if (next) focus(next);
}
function dragByTitle(w, bar) {
  let start = null;
  bar.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button") || w.classList.contains("maximized")) return;
    start = { x: e.clientX, y: e.clientY, left: w.offsetLeft, top: w.offsetTop };
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener("pointermove", (e) => {
    if (!start) return;
    w.style.left =
      Math.min(innerWidth - 80, Math.max(-w.offsetWidth + 120, start.left + e.clientX - start.x)) +
      "px";
    w.style.top = Math.min(innerHeight - 70, Math.max(0, start.top + e.clientY - start.y)) + "px";
  });
  const end = () => (start = null);
  bar.addEventListener("pointerup", end);
  bar.addEventListener("pointercancel", end);
}
function resizeByGrip(w, grip) {
  let start = null;
  grip.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    start = { x: e.clientX, y: e.clientY, w: w.offsetWidth, h: w.offsetHeight };
    grip.setPointerCapture(e.pointerId);
  });
  grip.addEventListener("pointermove", (e) => {
    if (!start) return;
    w.style.width = Math.max(260, start.w + e.clientX - start.x) + "px";
    w.style.height = Math.max(160, start.h + e.clientY - start.y) + "px";
    w.dispatchEvent(new Event("xp-resize"));
  });
  const end = () => (start = null);
  grip.addEventListener("pointerup", end);
  grip.addEventListener("pointercancel", end);
}
function messageBox(title, html, icon = "help") {
  return openWindow({
    title,
    icon,
    width: 400,
    height: 220,
    resizable: false,
    className: "xp-dialog",
    body(el, w) {
      el.innerHTML = `<div class="xp-msg"><div class="xp-msg-row"><span class="xp-big">${ICONS[icon]}</span><p>${html}</p></div><button class="xp-btn">OK</button></div>`;
      el.querySelector("button").onclick = () => close(w);
      setTimeout(() => el.querySelector("button").focus(), 60);
    },
  });
}
// What the lazily loaded apps (solitaire, pinball, paint) can use.
export const api = { messageBox, close, ICONS, esc };

// ── Apps ────────────────────────────────────────────────────────────────────
function openExplorer(section) {
  const w = openWindow({
    key: "explorer",
    title: "My Portfolio",
    icon: "computer",
    width: 860,
    height: 540,
    className: "xp-explorer",
    body(el) {
      el.innerHTML = `
        <div class="xp-menubar"><span>File</span><span>Edit</span><span>View</span><span>Favorites</span><span>Tools</span><span>Help</span></div>
        <div class="xp-toolbar"><button class="xp-tool-btn" data-nav="back">${ICONS.restart}<span>Back</span></button><span class="xp-addr-label">Address</span><div class="xp-address"></div></div>
        <div class="xp-split">
          <nav class="xp-taskpane">
            <section><h3>Portfolio Tasks</h3><button data-sec="film">${ICONS.folder}View my films</button><button data-sec="visuals">${ICONS.folder}View my visuals</button><button data-sec="all">${ICONS.computer}View all projects</button></section>
            <section><h3>Other Places</h3><button data-open="about">${ICONS.notepad}About me</button><button data-open="mail">${ICONS.mail}E-mail me</button><button data-open="bin">${ICONS.bin}Recycle Bin</button></section>
            <section class="xp-details"><h3>Details</h3><p></p></section>
          </nav>
          <ul class="xp-files"></ul>
        </div>
        <footer class="xp-status"></footer>`;
      const render = (sec) => {
        const ids =
          sec === "visuals" ? visualsOrder : sec === "all" ? projects.map((p) => p.id) : filmOrder;
        const label =
          sec === "all" ? "All projects" : sec === "visuals" ? "My Visuals" : "My Films";
        el.querySelector(".xp-address").textContent = `C:\\Nicoló\\${label}`;
        el.querySelector(".xp-details p").textContent = `${label}: ${ids.length} projects`;
        el.querySelector(".xp-files").innerHTML = ids
          .map(byId)
          .filter(Boolean)
          .map(
            (p) =>
              `<li><button class="xp-file" data-project="${p.id}" title="${esc(nameOf(p))}"><img src="${p.cover}" alt="" loading="lazy"><span>${esc(nameOf(p))}</span></button></li>`,
          )
          .join("");
        el.querySelector(".xp-status").textContent = `${ids.length} objects`;
      };
      el._render = render;
      el.querySelector(".xp-taskpane").onclick = (e) => {
        const s = e.target.closest("[data-sec]");
        if (s) render(s.dataset.sec);
        const o = e.target.closest("[data-open]");
        if (o) APPS[o.dataset.open].open();
      };
      el.querySelector('[data-nav="back"]').onclick = () => render("film");
      const files = el.querySelector(".xp-files");
      const openFile = (e) => {
        const f = e.target.closest(".xp-file");
        if (f) openBrowser(`/work/${f.dataset.project}/`);
      };
      files.addEventListener("dblclick", openFile);
      files.addEventListener("click", (e) => {
        const f = e.target.closest(".xp-file");
        files.querySelectorAll(".xp-file").forEach((x) => x.classList.toggle("selected", x === f));
        if (f) {
          const p = byId(f.dataset.project);
          el.querySelector(".xp-details p").innerHTML =
            `<b>${esc(nameOf(p))}</b><br>${esc(p.type)}`;
        }
        if (touchOnly()) openFile(e);
      });
    },
  });
  w.querySelector(".xp-body")._render(section);
}

function openBrowser(path) {
  const w = openWindow({
    key: "browser",
    title: "Web Browser",
    icon: "globe",
    width: 1000,
    height: 640,
    className: "xp-browser",
    body(el) {
      el.innerHTML = `<div class="xp-menubar"><span>File</span><span>Edit</span><span>View</span><span>Favorites</span><span>Tools</span><span>Help</span></div><div class="xp-toolbar"><button class="xp-tool-btn" data-act="back">◀ <span>Back</span></button><button class="xp-tool-btn" data-act="fwd">▶</button><span class="xp-addr-label">Address</span><div class="xp-address"></div><button class="xp-tool-btn" data-act="out">Go ↗</button></div><iframe title="Web browser"></iframe>`;
      const frame = el.querySelector("iframe"),
        address = el.querySelector(".xp-address");
      frame.addEventListener("load", () => {
        try {
          address.textContent =
            "https://nicolo-lombardi.com" + frame.contentWindow.location.pathname;
        } catch {}
      });
      el.querySelector(".xp-toolbar").onclick = (e) => {
        const act = e.target.closest("[data-act]")?.dataset.act;
        try {
          if (act === "back") frame.contentWindow.history.back();
          if (act === "fwd") frame.contentWindow.history.forward();
        } catch {}
        if (act === "out") window.open(frame.contentWindow.location.href, "_blank", "noopener");
      };
      el._go = (p) => {
        frame.src = p;
        address.textContent = "https://nicolo-lombardi.com" + p;
      };
    },
  });
  w.querySelector(".xp-body")._go(path);
}

function openMedia() {
  const playlist = [
    { title: "Nicoló OS — intro loop", src: hero, poster: heroPoster },
    ...projects.flatMap((p) =>
      p.videos.map((src, i) => ({
        title: p.videos.length > 1 ? `${nameOf(p)} (${i + 1})` : nameOf(p),
        src,
        poster: p.videoPosters?.[i] || p.cover,
      })),
    ),
  ];
  openWindow({
    key: "media",
    title: "Media Player",
    icon: "media",
    width: 900,
    height: 540,
    className: "xp-media",
    body(el) {
      el.innerHTML = `<div class="xp-player"><video controls playsinline></video></div><div class="xp-playlist"><h3>Now Playing</h3><ol>${playlist.map((t, i) => `<li><button data-track="${i}">${esc(t.title)}</button></li>`).join("")}</ol></div>`;
      const video = el.querySelector("video");
      const play = (i) => {
        const t = playlist[i];
        video.poster = t.poster;
        video.innerHTML = `<source src="${t.src}" type="video/webm"><source src="${t.src.replace(/\.webm$/, ".mp4")}" type="video/mp4">`;
        video.load();
        video.play().catch(() => {});
        el.querySelectorAll("[data-track]").forEach((b) =>
          b.classList.toggle("active", +b.dataset.track === i),
        );
        video.onended = () => play((i + 1) % playlist.length);
      };
      el.querySelector("ol").onclick = (e) => {
        const b = e.target.closest("[data-track]");
        if (b) play(+b.dataset.track);
      };
      play(0);
    },
  });
}

function openNotepad() {
  const bio = document.querySelector(".bio")?.textContent.trim().replace(/\s+/g, " ") || "";
  openWindow({
    key: "notepad",
    title: "About me.txt - Notepad",
    icon: "notepad",
    width: 620,
    height: 460,
    className: "xp-notepad",
    body(el) {
      el.innerHTML = `<div class="xp-menubar"><span>File</span><span>Edit</span><span>Format</span><span>View</span><span>Help</span></div><textarea spellcheck="false" aria-label="About me"></textarea>`;
      el.querySelector("textarea").value =
        `NICOLÓ LOMBARDI\nAI Production Specialist — Madrid, Spain\n\n${bio}\n\n` +
        `What I do\n- Film & visual production\n- Art direction\n- AI filmmaking\n- Motion & sound\n- Virtual production\n\n` +
        `Contact\nhello.nicolombardi@gmail.com\n+34 643 868 613\ninstagram.com/nickprods\nlinkedin.com/in/nicolo-lombardi\n\n` +
        `P.S. You found the Easter egg. Let's make something together.`;
    },
  });
}

// "Deleted" classified files: internet mysteries, each opening its wiki page.
const CLASSIFIED = [
  {
    file: "CLASSIFIED_titor_2036.txt",
    title: "John Titor",
    teaser:
      "Subject claimed to be a soldier from the year 2036, sent back in time for an IBM 5100 computer. Posted on internet forums in 2000–2001, then vanished.",
    url: "https://en.wikipedia.org/wiki/John_Titor",
  },
  {
    file: "DO_NOT_OPEN_herobrine.dat",
    title: "Herobrine",
    teaser:
      "Unconfirmed entity reported in single-player worlds. White eyes. Builds pyramids, removes leaves from trees. Officially “removed” in many updates.",
    url: "https://minecraft.wiki/w/Herobrine",
  },
  {
    file: "have_you_seen_this_man.jpg",
    title: "This Man",
    teaser:
      "Thousands of people claim to have seen the same face in their dreams, all over the world. Have you seen this man?",
    url: "https://en.wikipedia.org/wiki/This_Man",
  },
];
function openRecycleBin() {
  openWindow({
    key: "bin",
    title: "Recycle Bin",
    icon: "bin",
    width: 640,
    height: 360,
    className: "xp-explorer xp-bin",
    body(el) {
      el.innerHTML = `<div class="xp-menubar"><span>File</span><span>Edit</span><span>View</span><span>Help</span></div>
        <table class="xp-bin-list"><thead><tr><th>Name</th><th>Original Location</th><th>Date Deleted</th></tr></thead><tbody>${CLASSIFIED.map(
          (c, i) =>
            `<tr><td><button class="xp-bin-file" data-i="${i}"><span class="xp-mini">${ICONS.file}</span>${esc(c.file)}</button></td><td>C:\\Nicoló\\Classified</td><td>${i === 0 ? "11/2/2000" : i === 1 ? "8/16/2010" : "1/1/2006"} 3:33 AM</td></tr>`,
        ).join("")}</tbody></table>
        <footer class="xp-status">${CLASSIFIED.length} objects · You weren't supposed to find these.</footer>`;
      const openFile = (e) => {
        const b = e.target.closest(".xp-bin-file");
        if (!b) return;
        const c = CLASSIFIED[b.dataset.i];
        messageBox(
          `${c.file} — CLASSIFIED`,
          `<b class="xp-classified">TOP SECRET // ${esc(c.title.toUpperCase())}</b><br>${esc(c.teaser)}<br><br><a href="${c.url}" target="_blank" rel="noopener noreferrer">Open the file ↗</a>`,
          "error",
        );
      };
      el.addEventListener("dblclick", openFile);
      el.addEventListener("click", (e) => {
        const b = e.target.closest(".xp-bin-file");
        el.querySelectorAll(".xp-bin-file").forEach((x) => x.classList.toggle("selected", x === b));
        if (touchOnly()) openFile(e);
      });
    },
  });
}

// Command Prompt with a few portfolio commands.
function openCmd() {
  openWindow({
    key: "cmd",
    title: "Command Prompt",
    icon: "cmd",
    width: 680,
    height: 420,
    className: "xp-cmd",
    body(el, w) {
      el.innerHTML = `<pre class="xp-cmd-out"></pre><label class="xp-cmd-line"><span>C:\\Nicolo&gt;</span><input spellcheck="false" autocomplete="off" aria-label="Command"></label>`;
      const out = el.querySelector(".xp-cmd-out"),
        input = el.querySelector("input");
      const print = (t = "") => {
        out.textContent += t + "\n";
        el.scrollTop = el.scrollHeight;
      };
      print(
        "Nicoló OS [Version 5.1.2026]\n(C) Nicoló Lombardi. All rights reserved.\n\nType HELP for a list of commands.\n",
      );
      const cmds = {
        help: () =>
          print(
            "ABOUT      Who is Nicoló\nPROJECTS   List all projects (alias: DIR)\nOPEN <id>  Open a project, e.g. OPEN lexus\nCONTACT    How to reach me\nPLAY <x>   solitaire | pinball | mines\nPAINT      Open Paint\nDATE       Show the date\nCOLOR      Change colours\nCLS        Clear the screen\nEXIT       Close this window\nSHUTDOWN   Turn off Nicoló OS",
          ),
        about: () =>
          print(
            "NICOLÓ LOMBARDI — AI Production Specialist, Madrid.\nAI filmmaking, art direction, motion & sound, virtual production.",
          ),
        projects: () =>
          projects.forEach((p) => print(`  ${p.id.padEnd(16)} ${nameOf(p)}  [${p.type}]`)),
        dir: () => cmds.projects(),
        open: (id) => {
          const p =
            byId(id) ||
            projects.find((x) =>
              `${x.brand} ${x.title}`.toLowerCase().includes((id || "").toLowerCase()),
            );
          if (!id || !p)
            return print(
              "The system cannot find the project specified. Type PROJECTS for the list.",
            );
          print(`Opening ${nameOf(p)}…`);
          openBrowser(`/work/${p.id}/`);
        },
        contact: () =>
          print(
            "E-mail    hello.nicolombardi@gmail.com\nPhone     +34 643 868 613\nInstagram @nickprods\nLinkedIn  linkedin.com/in/nicolo-lombardi",
          ),
        play: (g) =>
          APPS[g === "mines" ? "mines" : g] && ["solitaire", "pinball", "mines"].includes(g)
            ? APPS[g].open()
            : print("Usage: PLAY solitaire | pinball | mines"),
        paint: () => APPS.paint.open(),
        date: () => print(new Date().toString()),
        color: () => el.classList.toggle("xp-cmd-green"),
        cls: () => (out.textContent = ""),
        exit: () => close(w),
        shutdown: () => turnOffDialog(),
        hello: () => print("Hello! 👋"),
      };
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        const raw = input.value.trim();
        input.value = "";
        print(`C:\\Nicolo>${raw}`);
        if (!raw) return;
        const [c, ...rest] = raw.split(/\s+/);
        const fn = cmds[c.toLowerCase()];
        if (fn) fn(rest.join(" ").toLowerCase());
        else
          print(
            `'${c}' is not recognized as an internal or external command.\nType HELP for a list of commands.`,
          );
        print();
      });
      el.addEventListener("click", () => input.focus());
      setTimeout(() => input.focus(), 60);
    },
  });
}

// ── Clappy, the assistant ───────────────────────────────────────────────────
const TIPS = [
  "Double-click <b>My Portfolio</b> to browse every project like files on a computer.",
  "Can you beat Solitaire in under 5 minutes? I've never seen it happen. 🎬",
  "In <b>3D Pinball</b>: Z and / are the flippers, hold Space to launch the ball.",
  "Type <b>HELP</b> in the Command Prompt. There are a few hidden commands…",
  "Paint saves your masterpiece as a PNG. Send it to Nicoló!",
  "When you're done, use <b>start → Turn Off Computer</b> to go back to the website.",
];
const clappy = {
  tip: 0,
  show(fromUser) {
    const el = desktop.querySelector(".xp-clappy");
    el.hidden = false;
    el.innerHTML = `<div class="xp-balloon"></div><button class="xp-clappy-body" aria-label="Clappy">${CLAPPY}</button>`;
    el.querySelector(".xp-clappy-body").onclick = () =>
      this.say(TIPS[this.tip++ % TIPS.length], [
        ["Next tip", () => el.querySelector(".xp-clappy-body").click()],
        ["Hide Clappy", () => this.hide()],
      ]);
    this.clap();
    if (fromUser) return this.say("Hi again! Need a hand?", this.menu());
    this.say(
      "It looks like you're exploring a portfolio.<br><b>Would you like help?</b>",
      this.menu(),
    );
  },
  menu() {
    return [
      [
        "Show me the films",
        () => (
          APPS.computer.open(),
          this.say("Here they are! Double-click any project to watch it. 🍿", [
            ["Thanks!", () => this.quiet()],
          ])
        ),
      ],
      [
        "I want to play a game",
        () => (
          APPS.solitaire.open(),
          this.say("Solitaire it is! Pinball is on the desktop too.", [
            ["Thanks!", () => this.quiet()],
          ])
        ),
      ],
      ["Who is Nicoló?", () => (APPS.about.open(), this.quiet())],
      ["No thanks", () => this.hide()],
    ];
  },
  say(html, buttons = []) {
    const b = desktop?.querySelector(".xp-balloon");
    if (!b) return;
    b.hidden = false;
    b.innerHTML = `<p>${html}</p>${buttons.map((_, i) => `<button data-i="${i}">${esc(buttons[i][0])}</button>`).join("")}`;
    b.onclick = (e) => {
      const i = e.target.closest("[data-i]")?.dataset.i;
      if (i !== undefined) buttons[i][1]();
    };
    this.clap();
  },
  quiet() {
    const b = desktop?.querySelector(".xp-balloon");
    if (b) b.hidden = true;
  },
  hide() {
    const el = desktop?.querySelector(".xp-clappy");
    if (el) el.hidden = true;
  },
  clap() {
    const el = desktop?.querySelector(".xp-clappy-body");
    if (!el) return;
    el.classList.remove("clap");
    void el.offsetWidth;
    el.classList.add("clap");
  },
};

// ── Minesweeper: 9×9, 10 mines. Right-click (or long-press) to flag. ─────────
function openMinesweeper() {
  openWindow({
    key: "mines",
    title: "Minesweeper",
    icon: "mine",
    width: 268,
    height: 352,
    resizable: false,
    className: "xp-mines",
    body(el) {
      const N = 9,
        MINES = 10;
      let cells, over, opened, flags, timer, seconds, first;
      const S = (f) => `/assets/xp/mines/${f}.png`;
      const digits = (n) =>
        String(Math.max(-99, Math.min(999, n)))
          .padStart(3, "0")
          .split("")
          .map((d) => `<img src="${S("digit" + d)}" alt="">`)
          .join("");
      el.innerHTML = `<div class="xp-menubar"><span>Game</span><span>Help</span></div><div class="xp-ms"><div class="xp-ms-top"><span class="xp-ms-count"></span><button class="xp-ms-face" aria-label="New game"><img alt=""></button><span class="xp-ms-time"></span></div><div class="xp-ms-grid" role="grid"></div></div>`;
      const grid = el.querySelector(".xp-ms-grid"),
        face = el.querySelector(".xp-ms-face");
      const setFace = (f) => (face.querySelector("img").src = S(f));
      grid.addEventListener("pointerdown", () => !over && setFace("ohh"));
      grid.addEventListener("pointerup", () => !over && setFace("smile"));
      grid.addEventListener("pointerleave", () => !over && setFace("smile"));
      const around = (i) => {
        const r = (i / N) | 0,
          c = i % N,
          o = [];
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr,
              cc = c + dc;
            if ((dr || dc) && rr >= 0 && rr < N && cc >= 0 && cc < N) o.push(rr * N + cc);
          }
        return o;
      };
      const status = () => {
        el.querySelector(".xp-ms-count").innerHTML = digits(MINES - flags);
        el.querySelector(".xp-ms-time").innerHTML = digits(seconds);
      };
      const reset = () => {
        clearInterval(timer);
        cells = Array.from({ length: N * N }, () => ({
          mine: false,
          open: false,
          flag: false,
          n: 0,
        }));
        over = false;
        opened = flags = seconds = 0;
        first = true;
        setFace("smile");
        grid.innerHTML = cells
          .map((_, i) => `<button data-i="${i}" aria-label="Cell"></button>`)
          .join("");
        status();
      };
      const plant = (safe) => {
        const banned = new Set([safe, ...around(safe)]);
        for (let placed = 0; placed < MINES; ) {
          const i = (Math.random() * N * N) | 0;
          if (!cells[i].mine && !banned.has(i)) {
            cells[i].mine = true;
            placed++;
          }
        }
        cells.forEach((c, i) => (c.n = around(i).filter((j) => cells[j].mine).length));
        timer = setInterval(() => {
          if (!el.isConnected) return clearInterval(timer);
          seconds++;
          status();
        }, 1000);
      };
      const btn = (i) => grid.children[i];
      const reveal = (i) => {
        const c = cells[i];
        if (c.open || c.flag) return;
        c.open = true;
        opened++;
        btn(i).classList.add("open");
        if (c.mine) return;
        if (c.n) btn(i).style.backgroundImage = `url(${S("open" + c.n)})`;
        else around(i).forEach(reveal);
      };
      const end = (won) => {
        over = true;
        clearInterval(timer);
        setFace(won ? "win" : "dead");
        cells.forEach((c, i) => {
          const b = btn(i);
          if (c.mine && !b.classList.contains("boom")) {
            b.classList.add(won ? "flag" : "open");
            b.style.backgroundImage = `url(${S(won ? "flag" : "mine-ceil")})`;
          } else if (!won && c.flag && !c.mine) {
            b.classList.add("open");
            b.style.backgroundImage = `url(${S("misflagged")})`;
          }
        });
        if (won)
          setTimeout(() => messageBox("Minesweeper", `You won in ${seconds} seconds! 🎉`), 300);
      };
      const toggleFlag = (i) => {
        const c = cells[i];
        if (over || c.open) return;
        c.flag = !c.flag;
        flags += c.flag ? 1 : -1;
        btn(i).classList.toggle("flag", c.flag);
        btn(i).style.backgroundImage = c.flag ? `url(${S("flag")})` : "";
        status();
      };
      grid.addEventListener("click", (e) => {
        const b = e.target.closest("[data-i]");
        if (!b || over) return;
        const i = +b.dataset.i;
        if (cells[i].flag) return;
        if (first) {
          first = false;
          plant(i);
        }
        if (cells[i].mine) {
          b.classList.add("boom", "open");
          b.style.backgroundImage = `url(${S("mine-death")})`;
          return end(false);
        }
        reveal(i);
        if (opened === N * N - MINES) end(true);
      });
      grid.addEventListener("contextmenu", (e) => {
        const b = e.target.closest("[data-i]");
        if (!b) return;
        e.preventDefault();
        toggleFlag(+b.dataset.i);
      });
      let press;
      grid.addEventListener(
        "touchstart",
        (e) => {
          const b = e.target.closest("[data-i]");
          if (b) press = setTimeout(() => ((press = null), toggleFlag(+b.dataset.i)), 450);
        },
        { passive: true },
      );
      grid.addEventListener("touchend", (e) => {
        if (press) clearTimeout(press);
        else e.preventDefault();
      });
      face.onclick = reset;
      reset();
    },
  });
}
