// Portfolio behaviour. Every page (/, /about/, /work/<id>/) is a real, pre-built
// HTML file (see tools/build.mjs) so search engines can read it; this script
// re-renders the same markup and adds the interactions: the scroll-driven project blocks, carousels,
// the menu (js/menu.js) and the 3D head on the About page (js/head.js).
import { projects } from "./data.js";
import { bindGalleries } from "./galleries.js";
import { bindScramble } from "./scramble.js";
import { bindPlayers } from "./player.js";
import { eyeTracking } from "./eye.js";
import { isMenuOpen, setNavigator } from "./menu.js";
import { smoothScroll } from "./smooth.js";
import { bindReveal } from "./reveal.js";
import { work, homeMarkup, projectMarkup, projectURL, aboutMarkup, archiveMarkup, collectionMarkup, archiveCollections, archiveExperiences, tarotMarkup } from "./views.js";
const main = document.querySelector("#main");
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
let cleanup = () => {};
function announce(s) {
  document.querySelector("#announcer").textContent = s;
}
function showHome() {
  main.innerHTML = homeMarkup();
  const v = document.querySelector("#entrance-video");
  // Under the landing intro the video waits: js/intro.js starts it when the page appears.
  if (reduce.matches || document.documentElement.classList.contains("intro")) v.pause();
  else v.play().catch(() => {});
  // Landing intro: html.intro is set by the inline script in the page head.
  const root = document.documentElement;
  if (root.classList.contains("intro"))
    import("./intro.js")
      .then((m) => m.playIntro())
      .catch(() => root.classList.remove("intro"));
  const scrollCleanup = bindReveal(main),
    eyeCleanup = eyeTracking(v);
  cleanup = () => {
    v.pause();
    scrollCleanup();
    eyeCleanup();
  };
}
function showProject(id) {
  const p = projects.find((x) => x.id === id);
  if (!p) return location.replace("/");
  main.innerHTML = projectMarkup(p);
  main.querySelectorAll("video").forEach((v) =>
    v.addEventListener("play", () =>
      main.querySelectorAll("video").forEach((other) => {
        if (v !== other) other.pause();
      }),
    ),
  );
  const galleriesCleanup = bindGalleries(main);
  const scrambleCleanup = bindScramble(main);
  const playersCleanup = bindPlayers(main);
  // Closing films (data-inview) play on their own, muted, while they are on screen.
  const autoplay = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        const v = e.target;
        if (e.isIntersecting && !reduce.matches) {
          v.preload = "auto";
          v.play().catch(() => {});
        } else v.pause();
      }),
    { threshold: 0.35 },
  );
  main.querySelectorAll("video[data-inview]").forEach((v) => autoplay.observe(v));
  cleanup = () => {
    autoplay.disconnect();
    galleriesCleanup();
    scrambleCleanup();
    playersCleanup();
    main.querySelectorAll("video").forEach((v) => v.pause());
  };
}
function showArchive() {
  main.innerHTML = archiveMarkup();
  let off = () => {},
    gone = false;
  import("./archive-desktop.js")
    .then((m) => {
      if (!gone) off = m.bindDesktop(main);
    })
    // If the script cannot load (an old cached copy, say), show the titles as a plain list
    // instead of leaving the page empty.
    .catch(() => main.querySelector(".desk")?.classList.add("plain"));
  cleanup = () => {
    gone = true;
    off();
  };
}
function showCollection(id) {
  const c = archiveCollections.find((x) => x.id === id);
  if (!c) return location.replace("/archive/");
  main.innerHTML = collectionMarkup(c);
  let off = () => {},
    gone = false;
  import("./archive.js").then((m) => {
    if (!gone) off = m.bindCollection(main);
  });
  cleanup = () => {
    gone = true;
    off();
  };
}
// /archive/tarot/: the Tarot Reader. Its scripts (three.js included) load only here.
function showTarot() {
  main.innerHTML = tarotMarkup();
  let off = () => {},
    gone = false;
  import("./tarot/experience.js")
    .then((m) => {
      if (!gone) off = m.mountTarot(main.querySelector(".tarot"));
    })
    .catch(() => main.querySelector(".tr-loading p") && (main.querySelector(".tr-loading p").textContent = "The cards could not be brought to the table. Reload to try again."));
  cleanup = () => {
    gone = true;
    off();
  };
}
function showAbout() {
  main.innerHTML = aboutMarkup();
  const stage = main.querySelector(".about-head");
  let headCleanup = () => {},
    gone = false;
  import("./head.js")
    .then((m) => {
      if (!gone) headCleanup = m.mountHead(stage);
    })
    .catch(() => stage.classList.add("failed"));
  cleanup = () => {
    gone = true;
    headCleanup();
  };
}
// Old links: #film, #visuals and #project/<id> from the ChatGPT site go to the real pages.
function redirectLegacyHash() {
  const h = location.hash.slice(1);
  if (h === "film" || h === "visuals") return (location.replace("/#work"), true);
  if (h.startsWith("project/")) return (location.replace(`/work/${h.slice(8)}/`), true);
  if (h === "home") history.replaceState(null, "", "/");
  return false;
}
function render() {
  const path = location.pathname.replace(/index\.html$/, "");
  const project = path.match(/^\/work\/([^/]+)\/?$/);
  document.documentElement.classList.toggle("light", path === "/about/");
  if (path === "/privacy/") return;
  const collection = path.match(/^\/archive\/([^/]+)\/?$/);
  if (path === "/about/") showAbout();
  else if (path === "/archive/") showArchive();
  else if (path === "/archive/tarot/" || path === "/archive/tarot") showTarot();
  else if (collection) showCollection(collection[1]);
  else if (project) showProject(project[1]);
  else showHome();
  // Arriving with a hash (…/#work, …/#p-<id> from "back"): land on that slide.
  const target = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
  window.scrollTo({ top: target ? target.offsetTop : 0, behavior: "instant" });
}
// Moves to another page without reloading, so the menu can lift and show it underneath.
// Returns false for addresses that only exist as pre-built pages (Privacy, 404).
const titles = new Map([[location.pathname, document.title]]);
function go(href) {
  const url = new URL(href, location.href);
  if (!(url.pathname === "/" || url.pathname === "/about/" || url.pathname === "/archive/" || [...archiveCollections, ...archiveExperiences].some((c) => url.pathname === `/archive/${c.id}/`) || /^\/work\/[^/]+\/?$/.test(url.pathname))) return false;
  cleanup();
  cleanup = () => {};
  history.pushState(null, "", url);
  render();
  const known = titles.get(url.pathname);
  if (known) document.title = known;
  else
    fetch(url.pathname)
      .then((r) => r.text())
      .then((t) => {
        const title = t.match(/<title>([^<]*)<\/title>/)?.[1];
        if (title) titles.set(url.pathname, (document.title = new DOMParser().parseFromString(title, "text/html").body.textContent));
      })
      .catch(() => {});
  return true;
}
setNavigator(go);
addEventListener("popstate", () => {
  cleanup();
  cleanup = () => {};
  render();
});
// Clicking the name goes home: it scrolls up on the landing page, swaps the page elsewhere.
document.querySelector(".header .brand").addEventListener("click", (e) => {
  if (isMenuOpen()) return;
  if (location.pathname === "/") {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reduce.matches ? "auto" : "smooth" });
  } else if (go("/")) e.preventDefault();
});
if (!redirectLegacyHash()) render();
smoothScroll(); // last, so the wheel handlers above get the first say
