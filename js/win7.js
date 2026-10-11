// Easter egg: click the landing-page name 5 times → the page glitches and turns
// into a Windows 7–style desktop. Original artwork and code (no Microsoft assets).
// Loaded only when triggered, so it costs nothing for normal visitors.
import { projects, filmOrder, visualsOrder, hero, heroPoster } from "./data.js";
import { pixelCurtain } from "./pixels.js";

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const byId = (id) => projects.find((p) => p.id === id);
const nameOf = (p) => (p.title === p.brand ? p.brand : `${p.brand} — ${p.title}`);
const isSmall = () => innerWidth < 760;

// ── Icons (simple original SVGs) ────────────────────────────────────────────
const svg = (body, vb = "0 0 48 48") =>
  `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
const ICONS = {
  computer: svg(
    `<defs><linearGradient id="scr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fd0ff"/><stop offset="1" stop-color="#1a5fb4"/></linearGradient></defs><rect x="5" y="7" width="38" height="27" rx="3" fill="#2b2f36"/><rect x="8" y="10" width="32" height="21" rx="1" fill="url(#scr)"/><path d="M8 10h32L8 24z" fill="#fff" opacity=".25"/><rect x="19" y="34" width="10" height="5" fill="#4a4f57"/><rect x="12" y="39" width="24" height="3" rx="1.5" fill="#6b7078"/>`,
  ),
  folder: svg(
    `<path d="M4 12a3 3 0 0 1 3-3h11l4 4h19a3 3 0 0 1 3 3v3H4z" fill="#d9a632"/><path d="M4 18h40v20a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="#f6cf5c"/><path d="M4 18h40v5H4z" fill="#fff" opacity=".35"/>`,
  ),
  notepad: svg(
    `<rect x="9" y="5" width="30" height="38" rx="2" fill="#fff" stroke="#9aa6b2"/><rect x="9" y="5" width="30" height="7" fill="#4c8fd6"/><g stroke="#b9c6d3" stroke-width="1.5"><path d="M14 19h20M14 24h20M14 29h20M14 34h14"/></g>`,
  ),
  media: svg(
    `<defs><radialGradient id="med" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffcf6b"/><stop offset=".6" stop-color="#f08a24"/><stop offset="1" stop-color="#b8510e"/></radialGradient></defs><circle cx="24" cy="24" r="19" fill="url(#med)"/><path d="M19 15l14 9-14 9z" fill="#fff"/><ellipse cx="20" cy="13" rx="11" ry="5" fill="#fff" opacity=".35"/>`,
  ),
  mine: svg(
    `<rect x="4" y="4" width="40" height="40" rx="4" fill="#cfd8e3"/><g stroke="#222" stroke-width="3" stroke-linecap="round"><path d="M24 11v26M11 24h26M15 15l18 18M33 15L15 33"/></g><circle cx="24" cy="24" r="9" fill="#222"/><circle cx="21" cy="21" r="2.5" fill="#fff"/>`,
  ),
  bin: svg(
    `<path d="M12 14h24l-3 28H15z" fill="#dfe9f3" stroke="#8aa1b8"/><rect x="10" y="9" width="28" height="5" rx="2" fill="#b8c9da"/><g stroke="#8aa1b8"><path d="M19 18l1 20M24 18v20M29 18l-1 20"/></g>`,
  ),
  globe: svg(
    `<defs><radialGradient id="glb" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#9fe3ff"/><stop offset="1" stop-color="#1b6fc2"/></radialGradient></defs><circle cx="24" cy="24" r="18" fill="url(#glb)"/><g fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"><ellipse cx="24" cy="24" rx="8" ry="18"/><path d="M6 24h36M9 15h30M9 33h30"/></g>`,
  ),
  mail: svg(
    `<rect x="5" y="11" width="38" height="26" rx="3" fill="#f4f7fb" stroke="#8aa1b8"/><path d="M6 13l18 14 18-14" fill="none" stroke="#4c8fd6" stroke-width="2.5"/>`,
  ),
  instagram: svg(
    `<defs><linearGradient id="igg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#f9a33a"/><stop offset=".5" stop-color="#e1306c"/><stop offset="1" stop-color="#7a3cff"/></linearGradient></defs><rect x="6" y="6" width="36" height="36" rx="10" fill="url(#igg)"/><rect x="14" y="14" width="20" height="20" rx="6" fill="none" stroke="#fff" stroke-width="3"/><circle cx="24" cy="24" r="4.5" fill="none" stroke="#fff" stroke-width="3"/><circle cx="33" cy="15" r="1.8" fill="#fff"/>`,
  ),
  linkedin: svg(
    `<rect x="6" y="6" width="36" height="36" rx="5" fill="#0a66c2"/><text x="24" y="32" text-anchor="middle" font-family="Arial" font-weight="700" font-size="20" fill="#fff">in</text>`,
  ),
  file: svg(
    `<path d="M11 5h18l8 8v30H11z" fill="#fff" stroke="#9aa6b2"/><path d="M29 5v8h8" fill="#e6edf4" stroke="#9aa6b2"/>`,
  ),
  shutdown: svg(
    `<path d="M24 8v14" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M15 13a14 14 0 1 0 18 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,
  ),
};

// ── Glitch transition ───────────────────────────────────────────────────────
function glitch(duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 250 : 1100) {
  return new Promise((resolve) => {
    const root = document.documentElement;
    root.classList.add("w7-glitching");
    const c = document.createElement("canvas");
    c.className = "w7-glitch";
    c.width = innerWidth;
    c.height = innerHeight;
    document.body.append(c);
    const ctx = c.getContext("2d");
    const colors = ["#fff", "#000", "#00f0ff", "#ff2bd6", "#39ff14"];
    const start = performance.now();
    const frame = (now) => {
      const t = (now - start) / duration;
      ctx.clearRect(0, 0, c.width, c.height);
      const bars = 6 + Math.floor(t * 40);
      for (let i = 0; i < bars; i++) {
        ctx.globalAlpha = 0.25 + Math.random() * 0.6;
        ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
        const h = 2 + Math.random() * (10 + t * 60);
        ctx.fillRect(
          Math.random() * c.width * 0.3 - 40,
          Math.random() * c.height,
          c.width * (0.4 + Math.random()),
          h,
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
        root.classList.remove("w7-glitching");
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
  css.href = "/win7.css";
  document.head.append(css);
  const cssReady = new Promise((r) => (css.onload = css.onerror = r));
  document.querySelectorAll("video").forEach((v) => v.pause());
  const [glitchCanvas] = await Promise.all([glitch(), cssReady]);

  desktop = document.createElement("div");
  desktop.id = "win7";
  desktop.setAttribute("role", "application");
  desktop.setAttribute("aria-label", "Nicoló OS desktop");
  desktop.innerHTML = `
    <div class="w7-boot"><div class="w7-boot-orb"><img src="/assets/anime-eye-icon-64.png" alt=""></div><p>Starting Nicoló OS</p></div>
    <div class="w7-wallpaper"></div>
    <ul class="w7-icons"></ul>
    <div class="w7-windows"></div>
    <div class="w7-start" hidden></div>
    <div class="w7-taskbar">
      <button class="w7-orb" aria-label="Start"><img src="/assets/anime-eye-icon-64.png" alt=""></button>
      <div class="w7-tasks"></div>
      <div class="w7-tray"><span class="w7-tray-icon" title="Nicoló OS">●</span><time class="w7-clock"></time><button class="w7-show-desktop" aria-label="Show desktop"></button></div>
    </div>`;
  document.body.append(desktop);
  glitchCanvas.remove();
  document.documentElement.classList.add("w7-open");
  setTimeout(() => desktop.querySelector(".w7-boot")?.classList.add("w7-boot-done"), 1500);
  setTimeout(() => desktop.querySelector(".w7-boot")?.remove(), 2300);

  buildIcons();
  buildStart();
  bindTaskbar();
  tickClock();
  desktop._clock = setInterval(tickClock, 15000);
  setTimeout(() => {
    if (desktop)
      messageBox(
        "Welcome",
        "Welcome to <b>Nicoló OS</b>.<br>You found the secret. Double-click the icons to explore — or open the Start orb and choose <i>Shut down</i> to go back.",
      );
  }, 2400);
}

function shutdown() {
  closeStart();
  const screen = document.createElement("div");
  screen.className = "w7-shutdown";
  screen.innerHTML = `<div class="w7-spinner"></div><p>Shutting down…</p>`;
  desktop.append(screen);
  setTimeout(() => {
    pixelCurtain(() => {
      clearInterval(desktop._clock);
      desktop.remove();
      desktop = null;
      document.documentElement.classList.remove("w7-open");
      scrollTo({ top: 0, behavior: "instant" });
      document
        .querySelector("#entrance-video")
        ?.play()
        .catch(() => {});
    });
  }, 1200);
}

// ── Desktop icons ───────────────────────────────────────────────────────────
const APPS = {
  computer: { title: "Portfolio", icon: "computer", open: () => openExplorer("film") },
  visuals: { title: "Visuals", icon: "folder", open: () => openExplorer("visuals") },
  media: { title: "Media Player", icon: "media", open: () => openMedia() },
  about: { title: "About me.txt", icon: "notepad", open: () => openNotepad() },
  mines: { title: "Minesweeper", icon: "mine", open: () => openMinesweeper() },
  browser: { title: "Web Browser", icon: "globe", open: () => openBrowser("/") },
  mail: {
    title: "Contact",
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
};

function buildIcons() {
  const list = desktop.querySelector(".w7-icons");
  list.innerHTML = Object.entries(APPS)
    .map(
      ([key, a]) =>
        `<li><button class="w7-icon" data-app="${key}"><span class="w7-icon-img">${ICONS[a.icon]}</span><span class="w7-icon-label">${esc(a.title)}</span></button></li>`,
    )
    .join("");
  list.addEventListener("click", (e) => {
    const b = e.target.closest(".w7-icon");
    list.querySelectorAll(".w7-icon").forEach((i) => i.classList.toggle("selected", i === b));
    // Touch screens open on a single tap; mouse users double-click like on Windows.
    if (b && (e.pointerType === "touch" || matchMedia("(hover: none)").matches))
      APPS[b.dataset.app].open();
  });
  list.addEventListener("dblclick", (e) => {
    const b = e.target.closest(".w7-icon");
    if (b) APPS[b.dataset.app].open();
  });
  list.addEventListener("keydown", (e) => {
    const b = e.target.closest(".w7-icon");
    if (b && e.key === "Enter") APPS[b.dataset.app].open();
  });
  desktop.querySelector(".w7-wallpaper").addEventListener("pointerdown", () => {
    list.querySelectorAll(".w7-icon").forEach((i) => i.classList.remove("selected"));
    closeStart();
  });
}

// ── Start menu ──────────────────────────────────────────────────────────────
function buildStart() {
  const start = desktop.querySelector(".w7-start");
  const left = ["computer", "browser", "media", "about", "mines", "mail"];
  start.innerHTML = `
    <div class="w7-start-left">
      <ul>${left.map((k) => `<li><button data-app="${k}"><span class="w7-mini">${ICONS[APPS[k].icon]}</span>${esc(APPS[k].title)}</button></li>`).join("")}</ul>
      <div class="w7-search"><input type="search" placeholder="Search projects" aria-label="Search projects"><ul class="w7-results"></ul></div>
    </div>
    <div class="w7-start-right">
      <div class="w7-user"><img src="/assets/anime-eye-touch-180.png" alt=""></div>
      <ul>
        <li><button data-go="film">Nicoló</button></li>
        <li><button data-app="computer">Film</button></li>
        <li><button data-app="visuals">Visuals</button></li>
        <li><button data-app="instagram">Instagram</button></li>
        <li><button data-app="linkedin">LinkedIn</button></li>
        <li><button data-app="mail">hello.nicolombardi@gmail.com</button></li>
      </ul>
      <button class="w7-shutdown-btn">${ICONS.shutdown}<span>Shut down</span></button>
    </div>`;
  start.addEventListener("click", (e) => {
    const b = e.target.closest("[data-app]");
    if (b) {
      closeStart();
      APPS[b.dataset.app].open();
    }
    if (e.target.closest("[data-go]")) {
      closeStart();
      openNotepad();
    }
    if (e.target.closest(".w7-shutdown-btn")) shutdown();
    const r = e.target.closest("[data-project]");
    if (r) {
      closeStart();
      openBrowser(`/work/${r.dataset.project}/`);
    }
  });
  const input = start.querySelector("input"),
    results = start.querySelector(".w7-results");
  const search = () => {
    const q = input.value.trim().toLowerCase();
    const hits = q
      ? projects
          .filter((p) => `${p.brand} ${p.title} ${p.type}`.toLowerCase().includes(q))
          .slice(0, 6)
      : [];
    results.innerHTML = hits
      .map(
        (p) =>
          `<li><button data-project="${p.id}"><span class="w7-mini">${ICONS.file}</span>${esc(nameOf(p))}</button></li>`,
      )
      .join("");
    start.classList.toggle("searching", !!q);
  };
  input.addEventListener("input", search);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") results.querySelector("button")?.click();
    if (e.key === "Escape") closeStart();
  });
}
function toggleStart() {
  const s = desktop.querySelector(".w7-start");
  s.hidden = !s.hidden;
  desktop.querySelector(".w7-orb").classList.toggle("active", !s.hidden);
  if (!s.hidden) setTimeout(() => s.querySelector("input")?.focus(), 50);
}
function closeStart() {
  if (!desktop) return;
  const s = desktop.querySelector(".w7-start");
  s.hidden = true;
  s.querySelector("input").value = "";
  s.classList.remove("searching");
  s.querySelector(".w7-results").innerHTML = "";
  desktop.querySelector(".w7-orb").classList.remove("active");
}

// ── Taskbar ─────────────────────────────────────────────────────────────────
function bindTaskbar() {
  desktop.querySelector(".w7-orb").onclick = toggleStart;
  desktop.querySelector(".w7-show-desktop").onclick = () =>
    desktop.querySelectorAll(".w7-window").forEach((w) => minimize(w, true));
  desktop.querySelector(".w7-tasks").addEventListener("click", (e) => {
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
  const now = new Date();
  desktop.querySelector(".w7-clock").innerHTML =
    `${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}<br>${now.toLocaleDateString()}`;
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
  onClose,
}) {
  const existing = key && desktop.querySelector(`.w7-window[data-key="${key}"]`);
  if (existing) {
    minimize(existing, false);
    return existing;
  }
  closeStart();
  const id = `w7win${++winCount}`;
  const w = document.createElement("section");
  w.className = `w7-window ${className}`;
  w.id = id;
  if (key) w.dataset.key = key;
  w.setAttribute("role", "dialog");
  w.setAttribute("aria-label", title);
  const W = Math.min(width, innerWidth - 20),
    H = Math.min(height, innerHeight - 60);
  const offset = (winCount % 6) * 26;
  Object.assign(w.style, {
    width: W + "px",
    height: H + "px",
    left: Math.max(10, (innerWidth - W) / 2 - 80 + offset) + "px",
    top: Math.max(8, (innerHeight - 40 - H) / 2 - 40 + offset) + "px",
  });
  w.innerHTML = `
    <header class="w7-titlebar"><span class="w7-title-icon">${ICONS[icon]}</span><span class="w7-title">${esc(title)}</span>
      <div class="w7-controls"><button class="w7-min" aria-label="Minimize"></button><button class="w7-max" aria-label="Maximize"></button><button class="w7-close" aria-label="Close"></button></div>
    </header>
    <div class="w7-body"></div>`;
  desktop.querySelector(".w7-windows").append(w);
  if (isSmall()) w.classList.add("maximized");
  body(w.querySelector(".w7-body"), w);
  w._onClose = onClose;

  const task = document.createElement("button");
  task.className = "w7-task";
  task.dataset.win = id;
  task.innerHTML = `<span class="w7-mini">${ICONS[icon]}</span><span>${esc(title)}</span>`;
  desktop.querySelector(".w7-tasks").append(task);

  w.addEventListener("pointerdown", () => focus(w));
  w.querySelector(".w7-close").onclick = () => close(w);
  w.querySelector(".w7-min").onclick = (e) => {
    e.stopPropagation();
    minimize(w, true);
  };
  w.querySelector(".w7-max").onclick = () => w.classList.toggle("maximized");
  const bar = w.querySelector(".w7-titlebar");
  bar.addEventListener(
    "dblclick",
    (e) => !e.target.closest("button") && w.classList.toggle("maximized"),
  );
  dragByTitle(w, bar);
  focus(w);
  w.classList.add("w7-opening");
  setTimeout(() => w.classList.remove("w7-opening"), 250);
  return w;
}
function focus(w) {
  desktop.querySelectorAll(".w7-window").forEach((x) => x.classList.toggle("focused", x === w));
  desktop
    .querySelectorAll(".w7-task")
    .forEach((t) => t.classList.toggle("active", t.dataset.win === w.id));
  w.style.zIndex = ++zTop;
}
function minimize(w, hide) {
  w.hidden = hide;
  if (!hide) focus(w);
  else desktop.querySelector(`[data-win="${w.id}"]`)?.classList.remove("active");
  if (hide) w.querySelectorAll("video").forEach((v) => v.pause());
}
function close(w) {
  w._onClose?.();
  w.querySelectorAll("video").forEach((v) => v.pause());
  desktop.querySelector(`[data-win="${w.id}"]`)?.remove();
  w.remove();
  // Hand focus to the top-most window still open, like a real desktop.
  const next = [...desktop.querySelectorAll(".w7-window:not([hidden])")].sort(
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
    w.classList.add("dragging");
  });
  bar.addEventListener("pointermove", (e) => {
    if (!start) return;
    const left = Math.min(
      innerWidth - 80,
      Math.max(-w.offsetWidth + 120, start.left + e.clientX - start.x),
    );
    const top = Math.min(innerHeight - 80, Math.max(0, start.top + e.clientY - start.y));
    w.style.left = left + "px";
    w.style.top = top + "px";
  });
  const end = () => {
    start = null;
    w.classList.remove("dragging");
  };
  bar.addEventListener("pointerup", end);
  bar.addEventListener("pointercancel", end);
}
function messageBox(title, html) {
  openWindow({
    title,
    icon: "computer",
    width: 400,
    height: 210,
    className: "w7-dialog",
    body(el, w) {
      el.innerHTML = `<div class="w7-msg"><p>${html}</p><button class="w7-btn">OK</button></div>`;
      el.querySelector("button").onclick = () => close(w);
      setTimeout(() => el.querySelector("button").focus(), 60);
    },
  });
}

// ── Apps ────────────────────────────────────────────────────────────────────
function openExplorer(section) {
  openWindow({
    key: "explorer",
    title: "Portfolio",
    icon: "computer",
    width: 860,
    height: 540,
    className: "w7-explorer",
    body(el) {
      const render = (sec) => {
        const ids =
          sec === "visuals" ? visualsOrder : sec === "all" ? projects.map((p) => p.id) : filmOrder;
        el.querySelector(".w7-path").textContent =
          `Portfolio ▸ ${sec === "all" ? "All projects" : sec[0].toUpperCase() + sec.slice(1)}`;
        el.querySelectorAll(".w7-nav button").forEach((b) =>
          b.classList.toggle("active", b.dataset.sec === sec),
        );
        const list = ids.map(byId).filter(Boolean);
        el.querySelector(".w7-files").innerHTML = list
          .map(
            (p) =>
              `<li><button class="w7-file" data-project="${p.id}" title="${esc(nameOf(p))}"><img src="${p.cover}" alt="" loading="lazy"><span>${esc(nameOf(p))}</span></button></li>`,
          )
          .join("");
        el.querySelector(".w7-status").textContent = `${list.length} items`;
      };
      el.innerHTML = `
        <div class="w7-toolbar"><button class="w7-nav-btn" aria-label="Back">◀</button><button class="w7-nav-btn" aria-label="Forward">▶</button><div class="w7-path"></div></div>
        <div class="w7-cmdbar"><span>Organize ▾</span><span>Open</span><span>Share with ▾</span><span>New folder</span></div>
        <div class="w7-split">
          <nav class="w7-nav"><p>Favorites</p><button data-sec="film">${ICONS.folder}Film</button><button data-sec="visuals">${ICONS.folder}Visuals</button><button data-sec="all">${ICONS.computer}All projects</button></nav>
          <ul class="w7-files"></ul>
        </div>
        <footer class="w7-status"></footer>`;
      el.querySelector(".w7-nav").onclick = (e) => {
        const b = e.target.closest("[data-sec]");
        if (b) render(b.dataset.sec);
      };
      const openFile = (e) => {
        const f = e.target.closest(".w7-file");
        if (f) openBrowser(`/work/${f.dataset.project}/`);
      };
      el.querySelector(".w7-files").addEventListener("dblclick", openFile);
      el.querySelector(".w7-files").addEventListener("click", (e) => {
        el.querySelectorAll(".w7-file").forEach((f) =>
          f.classList.toggle("selected", f === e.target.closest(".w7-file")),
        );
        if (matchMedia("(hover: none)").matches) openFile(e);
      });
      render(section);
    },
  })
    .querySelector(`.w7-nav [data-sec="${section}"]`)
    ?.click();
}

function openBrowser(path) {
  openWindow({
    key: "browser",
    title: "Web Browser",
    icon: "globe",
    width: 1000,
    height: 640,
    className: "w7-browser",
    body(el) {
      el.innerHTML = `<div class="w7-toolbar"><button class="w7-nav-btn" data-act="back" aria-label="Back">◀</button><button class="w7-nav-btn" data-act="fwd" aria-label="Forward">▶</button><div class="w7-address" contenteditable="false"></div><button class="w7-nav-btn" data-act="out" aria-label="Open in a new tab" title="Open in a new tab">↗</button></div><iframe title="Web browser"></iframe>`;
      const frame = el.querySelector("iframe"),
        address = el.querySelector(".w7-address");
      frame.addEventListener("load", () => {
        try {
          address.textContent =
            "https://nicolo-lombardi.com" + frame.contentWindow.location.pathname;
        } catch {}
      });
      el.querySelector(".w7-toolbar").onclick = (e) => {
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
  })
    .querySelector(".w7-body")
    ._go(path);
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
    className: "w7-media",
    body(el) {
      el.innerHTML = `<div class="w7-player"><video controls playsinline></video></div><ol class="w7-playlist">${playlist
        .map((t, i) => `<li><button data-track="${i}">${esc(t.title)}</button></li>`)
        .join("")}</ol>`;
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
      el.querySelector(".w7-playlist").onclick = (e) => {
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
    className: "w7-notepad",
    body(el) {
      el.innerHTML = `<div class="w7-menu"><span>File</span><span>Edit</span><span>Format</span><span>View</span><span>Help</span></div><textarea spellcheck="false" aria-label="About me"></textarea>`;
      el.querySelector("textarea").value =
        `NICOLÓ LOMBARDI\nAI Production Specialist — Madrid, Spain\n\n${bio}\n\n` +
        `What I do\n- Film & visual production\n- Art direction\n- AI filmmaking\n- Motion & sound\n- Virtual production\n\n` +
        `Contact\nhello.nicolombardi@gmail.com\n+34 643 868 613\ninstagram.com/nickprods\nlinkedin.com/in/nicolo-lombardi\n\n` +
        `P.S. You found the Easter egg. Let's make something together.`;
    },
  });
}

function openRecycleBin() {
  openWindow({
    key: "bin",
    title: "Recycle Bin",
    icon: "bin",
    width: 560,
    height: 340,
    className: "w7-explorer",
    body(el) {
      el.innerHTML = `<div class="w7-toolbar"><div class="w7-path">Recycle Bin</div></div><ul class="w7-files w7-files-list"><li><button class="w7-file" data-deleted>${ICONS.file}<span>old-portfolio-made-with-chatgpt.html</span></button></li></ul><footer class="w7-status">1 item</footer>`;
      el.querySelector("[data-deleted]").ondblclick = el.querySelector("[data-deleted]").onclick =
        () =>
          messageBox(
            "Recycle Bin",
            "This item has been permanently deleted.<br>Nicoló doesn't depend on it anymore. 😉",
          );
    },
  });
}

// Minesweeper: 9×9, 10 mines. Right-click (or long-press) to flag.
function openMinesweeper() {
  openWindow({
    key: "mines",
    title: "Minesweeper",
    icon: "mine",
    width: 300,
    height: 390,
    className: "w7-mines",
    body(el) {
      const N = 9,
        MINES = 10;
      let cells, over, opened, flags, timer, seconds, first;
      el.innerHTML = `<div class="w7-ms-top"><span class="w7-ms-count"></span><button class="w7-ms-face" aria-label="New game">🙂</button><span class="w7-ms-time"></span></div><div class="w7-ms-grid" role="grid"></div>`;
      const grid = el.querySelector(".w7-ms-grid"),
        face = el.querySelector(".w7-ms-face");
      const around = (i) => {
        const r = (i / N) | 0,
          c = i % N,
          out = [];
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr,
              cc = c + dc;
            if ((dr || dc) && rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc);
          }
        return out;
      };
      const status = () => {
        el.querySelector(".w7-ms-count").textContent = String(MINES - flags).padStart(3, "0");
        el.querySelector(".w7-ms-time").textContent = String(Math.min(999, seconds)).padStart(
          3,
          "0",
        );
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
        opened = 0;
        flags = 0;
        seconds = 0;
        first = true;
        face.textContent = "🙂";
        grid.innerHTML = cells
          .map((_, i) => `<button data-i="${i}" aria-label="Cell"></button>`)
          .join("");
        status();
      };
      const plant = (safe) => {
        const banned = new Set([safe, ...around(safe)]);
        let placed = 0;
        while (placed < MINES) {
          const i = (Math.random() * N * N) | 0;
          if (!cells[i].mine && !banned.has(i)) {
            cells[i].mine = true;
            placed++;
          }
        }
        cells.forEach((c, i) => (c.n = around(i).filter((j) => cells[j].mine).length));
        timer = setInterval(() => {
          if (!el.isConnected) return clearInterval(timer); // window was closed
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
        const b = btn(i);
        b.classList.add("open");
        if (c.mine) return;
        if (c.n) {
          b.textContent = c.n;
          b.dataset.n = c.n;
        } else around(i).forEach(reveal);
      };
      const end = (won) => {
        over = true;
        clearInterval(timer);
        face.textContent = won ? "😎" : "😵";
        cells.forEach((c, i) => {
          if (c.mine) {
            btn(i).classList.add("mine");
            btn(i).textContent = won ? "🚩" : "💣";
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
        btn(i).textContent = c.flag ? "🚩" : "";
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
          b.classList.add("boom");
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
    onClose() {},
  });
}
