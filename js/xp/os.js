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
const store = {
  get(k, d) {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

// ── Icons (original SVGs) ───────────────────────────────────────────────────
const svg = (body) => `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${body}</svg>`;
export const ICONS = {
  computer: svg(
    `<rect x="5" y="6" width="38" height="28" rx="3" fill="#d9dde3" stroke="#6d7783"/><rect x="9" y="10" width="30" height="20" fill="#2a7de1"/><path d="M9 10h30L9 24z" fill="#fff" opacity=".3"/><path d="M17 34h14l3 6H14z" fill="#b9c0c9" stroke="#6d7783"/><rect x="10" y="40" width="28" height="3" rx="1.5" fill="#8a939e"/>`,
  ),
  folder: svg(
    `<path d="M4 12a3 3 0 0 1 3-3h11l4 4h19a3 3 0 0 1 3 3v3H4z" fill="#e0a92a"/><path d="M4 18h40v20a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="#fcd66a"/><path d="M4 18h40v5H4z" fill="#fff" opacity=".4"/>`,
  ),
  notepad: svg(
    `<rect x="9" y="5" width="30" height="38" rx="2" fill="#fff" stroke="#7d8a99"/><rect x="9" y="5" width="30" height="7" fill="#3a8be0"/><g stroke="#a9bfd6" stroke-width="1.5"><path d="M14 19h20M14 24h20M14 29h20M14 34h14"/></g>`,
  ),
  media: svg(
    `<circle cx="24" cy="24" r="19" fill="#1d4fa8"/><circle cx="24" cy="24" r="15" fill="#f39a1e"/><path d="M19 15l14 9-14 9z" fill="#fff"/><ellipse cx="20" cy="13" rx="10" ry="4" fill="#fff" opacity=".35"/>`,
  ),
  mine: svg(
    `<rect x="4" y="4" width="40" height="40" rx="3" fill="#c0c0c0" stroke="#7b7b7b"/><g stroke="#111" stroke-width="3" stroke-linecap="round"><path d="M24 11v26M11 24h26M15 15l18 18M33 15L15 33"/></g><circle cx="24" cy="24" r="9" fill="#111"/><circle cx="21" cy="21" r="2.5" fill="#fff"/>`,
  ),
  bin: svg(
    `<path d="M12 14h24l-3 28H15z" fill="#e3edf7" stroke="#6f8aa8"/><rect x="10" y="9" width="28" height="5" rx="2" fill="#a9c1da" stroke="#6f8aa8"/><g stroke="#6f8aa8"><path d="M19 18l1 20M24 18v20M29 18l-1 20"/></g>`,
  ),
  globe: svg(
    `<circle cx="24" cy="24" r="18" fill="#2e8de6"/><path d="M10 18c6-2 9 3 14 1s5-8 12-6c-2 6 2 10-4 13s-4 9-12 9c1-6-6-8-10-17z" fill="#43b649"/><circle cx="24" cy="24" r="18" fill="none" stroke="#14549e" stroke-width="2"/><ellipse cx="18" cy="14" rx="9" ry="4" fill="#fff" opacity=".35"/>`,
  ),
  mail: svg(
    `<rect x="5" y="11" width="38" height="26" rx="3" fill="#fffbe8" stroke="#a88a3a"/><path d="M6 13l18 14 18-14" fill="none" stroke="#2f7ad8" stroke-width="2.5"/>`,
  ),
  instagram: svg(
    `<rect x="6" y="6" width="36" height="36" rx="10" fill="#d6336c"/><rect x="14" y="14" width="20" height="20" rx="6" fill="none" stroke="#fff" stroke-width="3"/><circle cx="24" cy="24" r="4.5" fill="none" stroke="#fff" stroke-width="3"/><circle cx="33" cy="15" r="1.8" fill="#fff"/>`,
  ),
  linkedin: svg(
    `<rect x="6" y="6" width="36" height="36" rx="5" fill="#0a66c2"/><text x="24" y="32" text-anchor="middle" font-family="Arial" font-weight="700" font-size="20" fill="#fff">in</text>`,
  ),
  file: svg(
    `<path d="M11 5h18l8 8v30H11z" fill="#fff" stroke="#7d8a99"/><path d="M29 5v8h8" fill="#e6edf4" stroke="#7d8a99"/>`,
  ),
  cards: svg(
    `<rect x="6" y="10" width="22" height="30" rx="3" fill="#fff" stroke="#555" transform="rotate(-12 17 25)"/><rect x="18" y="8" width="22" height="30" rx="3" fill="#fff" stroke="#555" transform="rotate(10 29 23)"/><path d="M30 17c-3-4-8-1-5 4l5 5 5-5c3-5-2-8-5-4z" fill="#d61f26" transform="rotate(10 29 23)"/>`,
  ),
  pinball: svg(
    `<rect x="10" y="4" width="28" height="40" rx="6" fill="#20124d" stroke="#7b5cff"/><circle cx="18" cy="15" r="4" fill="#ff3ea5"/><circle cx="30" cy="15" r="4" fill="#33d6ff"/><circle cx="24" cy="24" r="4" fill="#ffd23e"/><path d="M14 38l7-3M34 38l-7-3" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="31" r="2.5" fill="#e8e8e8"/>`,
  ),
  paint: svg(
    `<path d="M24 6C12 6 5 14 5 23c0 8 6 12 11 11 4-1 3-5 6-6s5 2 8 2c9 0 13-5 13-11C43 12 35 6 24 6z" fill="#f2d7a6" stroke="#9a7a45"/><circle cx="14" cy="19" r="3" fill="#e5312b"/><circle cx="22" cy="13" r="3" fill="#f6c21c"/><circle cx="31" cy="14" r="3" fill="#27a844"/><circle cx="36" cy="22" r="3" fill="#2f6fe0"/><path d="M27 44l14-20 3 2-12 21z" fill="#7a4a1d"/>`,
  ),
  sticky: svg(
    `<path d="M8 6h32v26l-10 10H8z" fill="#fff47a" stroke="#c9b52a"/><path d="M30 42V32h10" fill="#e8d84e" stroke="#c9b52a"/><g stroke="#b9a62a" stroke-width="1.5"><path d="M13 15h22M13 21h22M13 27h14"/></g>`,
  ),
  cmd: svg(
    `<rect x="4" y="8" width="40" height="32" rx="2" fill="#000" stroke="#7d8a99"/><rect x="4" y="8" width="40" height="6" fill="#3a8be0"/><path d="M10 21l6 4-6 4" fill="none" stroke="#c0c0c0" stroke-width="2.5"/><path d="M19 30h9" stroke="#c0c0c0" stroke-width="2.5"/>`,
  ),
  help: svg(
    `<circle cx="24" cy="24" r="18" fill="#2f7ad8"/><text x="24" y="32" text-anchor="middle" font-family="Arial" font-weight="700" font-size="24" fill="#fff">?</text>`,
  ),
  power: svg(
    `<rect x="4" y="4" width="40" height="40" rx="6" fill="#e2552a"/><path d="M24 12v12" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M16 16a11 11 0 1 0 16 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,
  ),
  logoff: svg(
    `<rect x="4" y="4" width="40" height="40" rx="6" fill="#f0a830"/><path d="M14 24h18M26 17l7 7-7 7" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  restart: svg(
    `<rect x="4" y="4" width="40" height="40" rx="6" fill="#3bab3b"/><path d="M33 22a10 10 0 1 1-4-7" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M30 9l1 7-7 0" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
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
    <div class="xp-boot"><div class="xp-boot-logo"><img src="/assets/anime-eye-icon-64.png" alt=""><div><b>Nicoló</b><span>OS</span></div></div><div class="xp-boot-bar"><i></i><i></i><i></i></div><p>Portfolio Edition</p></div>
    <div class="xp-wallpaper"></div>
    <ul class="xp-icons"></ul>
    <div class="xp-notes"></div>
    <div class="xp-windows"></div>
    <div class="xp-start" hidden></div>
    <div class="xp-clappy" hidden></div>
    <div class="xp-taskbar">
      <button class="xp-start-btn" aria-label="Start"><img src="/assets/anime-eye-icon-64.png" alt=""><span>start</span></button>
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
  restoreNotes();
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
      <header><span>Turn off computer</span><img src="/assets/anime-eye-icon-64.png" alt=""></header>
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
function shutdownScreen(after, text = "Nicoló OS is shutting down…") {
  const s = document.createElement("div");
  s.className = "xp-shutdown";
  s.innerHTML = `<div class="xp-boot-logo"><img src="/assets/anime-eye-icon-64.png" alt=""><div><b>Nicoló</b><span>OS</span></div></div><p>${text}</p>`;
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
    title: "Nicoló Pinball",
    icon: "pinball",
    open: lazy("pinball", {
      key: "pinball",
      title: "Nicoló Pinball",
      icon: "pinball",
      width: 400,
      height: 660,
      className: "xp-pinball",
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
  sticky: { title: "Sticky Notes", icon: "sticky", open: () => newNote() },
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
  "sticky",
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
}

// ── Start menu ──────────────────────────────────────────────────────────────
function buildStart() {
  const start = desktop.querySelector(".xp-start");
  const item = (k, sub = "") =>
    `<li><button data-app="${k}"><span class="xp-mid">${ICONS[APPS[k].icon]}</span><span><b>${esc(APPS[k].title)}</b>${sub ? `<small>${sub}</small>` : ""}</span></button></li>`;
  const link = (k, label) =>
    `<li><button data-app="${k}"><span class="xp-mini">${ICONS[APPS[k].icon]}</span>${esc(label)}</button></li>`;
  start.innerHTML = `
    <header><img src="/assets/anime-eye-touch-180.png" alt=""><span>Nicoló</span></header>
    <div class="xp-start-cols">
      <div class="xp-start-left">
        <ul class="xp-pinned">${item("computer", "Films & projects")}${item("browser", "nicolo-lombardi.com")}</ul>
        <ul>${["solitaire", "pinball", "paint", "sticky", "media", "cmd", "mines"].map((k) => item(k)).join("")}</ul>
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
    width: 380,
    height: 190,
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

function openRecycleBin() {
  openWindow({
    key: "bin",
    title: "Recycle Bin",
    icon: "bin",
    width: 560,
    height: 340,
    className: "xp-explorer",
    body(el) {
      el.innerHTML = `<div class="xp-menubar"><span>File</span><span>Edit</span><span>View</span><span>Help</span></div><div class="xp-empty-folder">This folder is empty.</div><footer class="xp-status">0 objects</footer>`;
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
            "ABOUT      Who is Nicoló\nPROJECTS   List all projects (alias: DIR)\nOPEN <id>  Open a project, e.g. OPEN lexus\nCONTACT    How to reach me\nPLAY <x>   solitaire | pinball | mines\nPAINT      Open Paint\nNOTE       New sticky note\nDATE       Show the date\nCOLOR      Change colours\nCLS        Clear the screen\nEXIT       Close this window\nSHUTDOWN   Turn off Nicoló OS",
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
        note: () => newNote(),
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

// ── Sticky notes (saved in this browser) ────────────────────────────────────
const NOTES_KEY = "nicolo-os-notes";
const saveNotes = () =>
  store.set(
    NOTES_KEY,
    [...desktop.querySelectorAll(".xp-note")].map((n) => ({
      x: n.offsetLeft,
      y: n.offsetTop,
      text: n.querySelector("textarea").value,
    })),
  );
function restoreNotes() {
  const notes = store.get(NOTES_KEY, null);
  if (notes === null)
    newNote(
      "Welcome to Nicoló OS!\n\n• Try Solitaire & Pinball\n• Draw something in Paint\n• Type HELP in Command Prompt\n\n(Notes are saved in your browser)",
      innerWidth - 250,
      20,
    );
  else notes.forEach((n) => newNote(n.text, n.x, n.y));
}
function newNote(text = "", x, y) {
  const n = document.createElement("div");
  n.className = "xp-note";
  const count = desktop.querySelectorAll(".xp-note").length;
  n.style.left = (x ?? Math.min(innerWidth - 230, 140 + count * 24)) + "px";
  n.style.top = (y ?? 60 + count * 24) + "px";
  n.innerHTML = `<header><button class="xp-note-add" aria-label="New note">+</button><button class="xp-note-del" aria-label="Delete note">×</button></header><textarea aria-label="Sticky note" placeholder="Write a note…"></textarea>`;
  n.querySelector("textarea").value = text;
  desktop.querySelector(".xp-notes").append(n);
  n.querySelector(".xp-note-add").onclick = () => newNote();
  n.querySelector(".xp-note-del").onclick = () => {
    n.remove();
    saveNotes();
  };
  n.querySelector("textarea").addEventListener("input", saveNotes);
  n.addEventListener("pointerdown", () => (n.style.zIndex = ++zTop));
  const head = n.querySelector("header");
  let start = null;
  head.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    start = { x: e.clientX, y: e.clientY, left: n.offsetLeft, top: n.offsetTop };
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener("pointermove", (e) => {
    if (!start) return;
    n.style.left = Math.min(innerWidth - 60, Math.max(0, start.left + e.clientX - start.x)) + "px";
    n.style.top = Math.min(innerHeight - 80, Math.max(0, start.top + e.clientY - start.y)) + "px";
  });
  head.addEventListener("pointerup", () => {
    start = null;
    saveNotes();
  });
  if (!text) setTimeout(() => n.querySelector("textarea").focus(), 30);
  saveNotes();
  return n;
}

// ── Clappy, the assistant ───────────────────────────────────────────────────
const TIPS = [
  "Double-click <b>My Portfolio</b> to browse every project like files on a computer.",
  "Can you beat Solitaire in under 5 minutes? I've never seen it happen. 🎬",
  "In <b>Pinball</b>, use Z and / (or ← →) for the flippers and hold Space to launch.",
  "Type <b>HELP</b> in the Command Prompt. There are a few hidden commands…",
  "Paint saves your masterpiece as a PNG. Send it to Nicoló!",
  "Sticky notes stay here even if you leave and come back.",
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
    width: 280,
    height: 370,
    resizable: false,
    className: "xp-mines",
    body(el) {
      const N = 9,
        MINES = 10;
      let cells, over, opened, flags, timer, seconds, first;
      el.innerHTML = `<div class="xp-menubar"><span>Game</span><span>Help</span></div><div class="xp-ms"><div class="xp-ms-top"><span class="xp-ms-count"></span><button class="xp-ms-face" aria-label="New game">🙂</button><span class="xp-ms-time"></span></div><div class="xp-ms-grid" role="grid"></div></div>`;
      const grid = el.querySelector(".xp-ms-grid"),
        face = el.querySelector(".xp-ms-face");
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
        el.querySelector(".xp-ms-count").textContent = String(MINES - flags).padStart(3, "0");
        el.querySelector(".xp-ms-time").textContent = String(Math.min(999, seconds)).padStart(
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
        opened = flags = seconds = 0;
        first = true;
        face.textContent = "🙂";
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
        if (c.n) {
          btn(i).textContent = c.n;
          btn(i).dataset.n = c.n;
        } else around(i).forEach(reveal);
      };
      const end = (won) => {
        over = true;
        clearInterval(timer);
        face.textContent = won ? "😎" : "😵";
        cells.forEach((c, i) => c.mine && (btn(i).textContent = won ? "🚩" : "💣"));
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
  });
}
