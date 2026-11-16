// Menu, after auge-xp.com: the "Menu" label in the header (top right) opens a black panel that grows
// out of the corner; the links slide in one after another, and a white pill follows the one you
// hover, with a short tick sound. Black and white only. Styles and timings: the "Menu" block in style.css.
import { play, preload } from "./sound.js";
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const menu = document.querySelector("#menu");
const toggle = document.querySelector(".menu-toggle");
const roll = toggle.querySelector(".menu-toggle-roll");
const nav = menu.querySelector(".menu-nav");
const pill = menu.querySelector(".menu-pill");
const links = [...menu.querySelectorAll(".menu-items a")];
let open = false;

export const isMenuOpen = () => open;
// js/app.js registers a function that swaps the page without reloading: it returns true when it
// handled the address.
let navigate = null;
export const setNavigator = (fn) => (navigate = fn);
export const navigateTo = (href) => (navigate?.(href) ? true : ((location.href = href), false));

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

function setOpen(value, { focus = true } = {}) {
  if (open === value) return;
  open = value;
  if (open) {
    markCurrent();
    preload("hover"); // decoded now, from this click, so the first hover is instant and clean
  }
  nav.inert = !open;
  menu.dataset.open = String(open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  rollLabel(open);
  if (!open) hidePill();
  if (focus && !open) toggle.focus({ preventScroll: true });
}
export const openMenu = () => setOpen(true);
export const closeMenu = (opts) => setOpen(false, opts);

// The yellow pill: it appears behind the hovered (or focused) link and slides to the next one.
let pillShown = false;
function showPill(a) {
  const x = a.offsetLeft, y = a.offsetTop; // relative to .menu-nav (position: relative)
  if (!pillShown) {
    // First link of this visit: put the pill there without sliding, then reveal it.
    pill.style.transition = "none";
    pill.style.transform = `translate(${x}px, ${y}px)`;
    pill.style.width = a.offsetWidth + "px";
    pill.style.height = a.offsetHeight + "px";
    pill.getBoundingClientRect();
    pill.style.transition = "";
    pillShown = true;
  } else {
    pill.style.transform = `translate(${x}px, ${y}px)`;
    pill.style.width = a.offsetWidth + "px";
    pill.style.height = a.offsetHeight + "px";
  }
  pill.classList.add("is-on");
  links.forEach((l) => l.classList.toggle("is-active", l === a));
}
function hidePill() {
  pill.classList.remove("is-on");
  links.forEach((l) => l.classList.remove("is-active"));
  pillShown = false;
}
links.forEach((a) => {
  a.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "touch") return;
    showPill(a);
    play("hover", 0.4);
  });
  a.addEventListener("focus", () => a.matches(":focus-visible") && showPill(a));
});
nav.addEventListener("pointerleave", hidePill);
nav.addEventListener("focusout", (e) => !nav.contains(e.relatedTarget) && hidePill());

toggle.addEventListener("click", () => (open ? closeMenu() : openMenu()));

document.addEventListener(
  "keydown",
  (e) => {
    if (open && e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    }
  },
  true,
);
// A click anywhere outside the menu closes it.
document.addEventListener("pointerdown", (e) => open && !menu.contains(e.target) && !toggle.contains(e.target) && closeMenu({ focus: false }));

// Links to the page you're already on (Work on the landing page) just close the menu and
// scroll; e-mail links close it too. Every other link navigates as usual.
menu.addEventListener("click", (e) => {
  const a = e.target.closest("a");
  if (!a) return;
  if (a.protocol === "mailto:") return closeMenu({ focus: false });
  if (a.origin === location.origin && a.pathname !== location.pathname) {
    e.preventDefault();
    closeMenu({ focus: false });
    if (!navigate?.(a.href)) setTimeout(() => (location.href = a.href), reduce.matches ? 0 : 300);
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
addEventListener("pageshow", (e) => e.persisted && open && closeMenu({ focus: false }));
