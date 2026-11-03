// Full-screen menu. The "Menu +" button in the header (the plus turns into a cross and the
// label rolls Menu → Close, like React Bits' Staggered Menu) drops a white panel from the
// top of the screen; the big links rise one by one from behind a mask, stacked vertically
// (layout after dizmar.xyz). Styles and timings: the "Menu" block in style.css.
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const root = document.documentElement;
const menu = document.querySelector("#menu");
const toggle = document.querySelector(".menu-toggle");
const roll = toggle.querySelector(".menu-toggle-roll");
const main = document.querySelector("#main");
const CLOSE_MS = 800;
let open = false,
  closeTimer = 0;

export const isMenuOpen = () => open;
// js/app.js registers a function that swaps the page without reloading: it returns true when it
// handled the address. The menu then lifts (the opening curtain played backwards) and reveals
// the new page underneath.
let navigate = null;
export const setNavigator = (fn) => (navigate = fn);
export const navigateTo = (href) => (navigate?.(href) ? true : ((location.href = href), false));

// The label rolls through Menu / Close a few times before it settles on the new word.
function rollLabel(opening) {
  const from = opening ? "Menu" : "Close",
    to = opening ? "Close" : "Menu";
  const words = reduce.matches ? [to] : [from, to, from, to];
  roll.replaceChildren(...words.map((w) => Object.assign(document.createElement("span"), { textContent: w })));
  if (reduce.matches) return;
  roll.style.transition = "none";
  roll.style.transform = "translateY(0)";
  roll.getBoundingClientRect();
  roll.style.transition = "";
  roll.style.transform = `translateY(${(-100 * (words.length - 1)) / words.length}%)`;
}

// The page you're on is marked in the menu (Work covers the landing and every project).
function markCurrent() {
  const path = location.pathname.replace(/index\.html$/, "");
  const section = path === "/" || path.startsWith("/work/") ? "/" : path.startsWith("/archive/") ? "/archive/" : path;
  menu.querySelectorAll(".menu-items a").forEach((a) => {
    const here = a.protocol !== "mailto:" && a.pathname === section;
    if (here) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

export function openMenu() {
  if (open) return;
  open = true;
  clearTimeout(closeTimer);
  markCurrent();
  menu.inert = false;
  main.inert = true;
  root.classList.add("menu-open");
  toggle.setAttribute("aria-expanded", "true");
  toggle.setAttribute("aria-label", "Close menu");
  rollLabel(true);
  // One frame later, so the transitions start from the closed state.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      menu.dataset.open = "true";
    }),
  );
  setTimeout(() => menu.querySelector(".menu-items a")?.focus({ preventScroll: true }), reduce.matches ? 0 : 350);
}

export function closeMenu({ focus = true } = {}) {
  if (!open) return;
  open = false;
  menu.dataset.open = "false";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Open menu");
  rollLabel(false);
  main.inert = false;
  closeTimer = setTimeout(
    () => {
      menu.inert = true;
      root.classList.remove("menu-open");
    },
    reduce.matches ? 0 : CLOSE_MS,
  );
  if (focus) toggle.focus({ preventScroll: true });
}

toggle.addEventListener("click", () => (open ? closeMenu() : openMenu()));

document.addEventListener(
  "keydown",
  (e) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    } else if (e.key === "Tab") {
      // Keep the focus inside the menu (the header button counts as part of it).
      const items = [document.querySelector(".header .brand"), toggle, ...menu.querySelectorAll("a")];
      const first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  },
  true,
);

// Links to the page you're already on (Work on the landing page) just close the menu and
// scroll; e-mail links close it too. Every other link navigates as usual.
menu.addEventListener("click", (e) => {
  const a = e.target.closest("a");
  if (!a) return;
  if (a.protocol === "mailto:") return closeMenu({ focus: false });
  if (a.origin === location.origin && a.pathname !== location.pathname) {
    e.preventDefault();
    if (navigate?.(a.href)) closeMenu({ focus: false });
    else {
      // A page that can't be swapped in place (Privacy, 404): lift the curtain, then go there.
      closeMenu({ focus: false });
      setTimeout(() => (location.href = a.href), reduce.matches ? 0 : CLOSE_MS - 100);
    }
    return;
  }
  if (a.origin === location.origin && a.pathname === location.pathname) {
    e.preventDefault();
    closeMenu({ focus: false });
    const target = a.hash && document.getElementById(a.hash.slice(1));
    window.scrollTo({ top: target ? target.offsetTop : 0, behavior: reduce.matches ? "auto" : "smooth" });
  }
});

// Coming back with "back" can restore the page with the menu open: close it at once.
addEventListener("pageshow", (e) => {
  if (!e.persisted || !open) return;
  menu.style.transition = "none";
  closeMenu({ focus: false });
  requestAnimationFrame(() => (menu.style.transition = ""));
});
