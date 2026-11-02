// Portfolio behaviour. Every page (/, /about/, /work/<id>/) is a real, pre-built
// HTML file (see tools/build.mjs) so search engines can read it; this script
// re-renders the same markup and adds the interactions: snap scrolling, carousels,
// the menu (js/menu.js) and the 3D head on the About page (js/head.js).
import { projects } from "./data.js";
import { bindGalleries } from "./galleries.js";
import { bindScramble } from "./scramble.js";
import { bindPlayers } from "./player.js";
import { eyeTracking } from "./eye.js";
import { isMenuOpen, setNavigator } from "./menu.js";
import { smoothScroll } from "./smooth.js";
import { hoverFx } from "./fx.js";
import { work, homeMarkup, projectMarkup, projectURL, aboutMarkup } from "./views.js";
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
  const scrollCleanup = bindProjectScroll(work),
    eyeCleanup = eyeTracking(v);
  cleanup = () => {
    v.pause();
    scrollCleanup();
    eyeCleanup();
  };
}
function bindProjectScroll(list) {
  const link = main.querySelector(".view-project");
  const pages = [...main.querySelectorAll(".home,.project-section")];
  let frame = 0,
    currentIndex = -1;
  const projectFor = (page) => list.find((p) => p.id === page?.dataset.project);
  const nearest = () =>
    pages.reduce((best, page, i) => {
      const distance = (element) => {
        const r = element.getBoundingClientRect();
        return Math.abs(r.top + r.height / 2 - innerHeight / 2);
      };
      return distance(page) < distance(pages[best]) ? i : best;
    }, 0);
  const update = () => {
    frame = 0;
    const index = nearest();
    if (index !== currentIndex) {
      currentIndex = index;
      const project = projectFor(pages[index]);
      link.hidden = !project;
      if (project) {
        link.href = projectURL(project);
        link.setAttribute("aria-label", "View " + project.brand + " — " + project.title);
        announce(project.brand + " — " + project.title);
      }
    }
  };
  const move = (direction) => {
    const destination = pages[nearest() + direction];
    if (!destination) return;
    window.scrollTo({
      top: window.scrollY + destination.getBoundingClientRect().top,
      behavior: reduce.matches ? "auto" : "smooth",
    });
  };
  const key = (e) => {
    if (isMenuOpen() || e.target.closest?.("a,button,input,textarea,select")) return;
    if (["ArrowDown", "ArrowRight", "PageDown"].includes(e.key)) {
      e.preventDefault();
      move(1);
    } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) {
      e.preventDefault();
      move(-1);
    }
  };
  // Require a fresh, deliberate gesture after the final section has settled.
  // Tracking all wheel events prevents arrival momentum from counting as intent.
  let atEnd = false,
    endSince = 0,
    lastWheel = -Infinity,
    wheelScore = 0,
    gestureStart = 0,
    gestureArmed = false,
    returning = false,
    touchStart = null;
  const checkEnd = () => {
    const rect = pages.at(-1).getBoundingClientRect();
    const end = rect.bottom <= innerHeight + 2 && rect.top <= 2;
    if (end !== atEnd) {
      atEnd = end;
      endSince = performance.now();
      wheelScore = 0;
      gestureArmed = false;
    }
    return end;
  };
  const returnToLanding = () => {
    returning = true;
    announce("Back to Nicoló Lombardi");
    window.scrollTo({ top: 0, behavior: reduce.matches ? "auto" : "smooth" });
  };
  const wheel = (e) => {
    const now = performance.now(),
      gap = now - lastWheel;
    lastWheel = now;
    const end = checkEnd();
    if (
      !end ||
      returning ||
      isMenuOpen() ||
      e.ctrlKey ||
      e.deltaY <= 0 ||
      Math.abs(e.deltaX) > Math.abs(e.deltaY)
    ) {
      wheelScore = 0;
      gestureArmed = false;
      return;
    }
    if (gap > 240) {
      wheelScore = 0;
      gestureStart = now;
      gestureArmed = now - endSince >= 240;
    }
    if (!gestureArmed) return;
    if (now - gestureStart > 450) {
      wheelScore = 0;
      gestureStart = now;
    }
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
    wheelScore += e.deltaY * scale;
    if (wheelScore >= Math.max(320, innerHeight * 0.45)) {
      e.preventDefault();
      returnToLanding();
    }
  };
  const touchBegin = (e) => {
    touchStart = null;
    if (
      e.touches.length !== 1 ||
      isMenuOpen() ||
      returning ||
      !checkEnd() ||
      performance.now() - endSince < 240
    )
      return;
    touchStart = { y: e.touches[0].clientY, time: performance.now() };
  };
  const touchEnd = (e) => {
    const start = touchStart;
    touchStart = null;
    if (!start || !checkEnd() || isMenuOpen() || e.changedTouches.length !== 1) return;
    const distance = start.y - e.changedTouches[0].clientY,
      elapsed = performance.now() - start.time;
    if (distance >= Math.max(110, innerHeight * 0.16) && elapsed <= 650) returnToLanding();
  };
  const touchCancel = () => {
    touchStart = null;
  };
  const scroll = () => {
    if (!checkEnd()) returning = false;
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener("scroll", scroll, { passive: true });
  window.addEventListener("resize", scroll);
  window.addEventListener("keydown", key);
  window.addEventListener("wheel", wheel, { passive: false });
  window.addEventListener("touchstart", touchBegin, { passive: true });
  window.addEventListener("touchend", touchEnd, { passive: true });
  window.addEventListener("touchcancel", touchCancel, { passive: true });
  update();
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("scroll", scroll);
    window.removeEventListener("resize", scroll);
    window.removeEventListener("keydown", key);
    window.removeEventListener("wheel", wheel);
    window.removeEventListener("touchstart", touchBegin);
    window.removeEventListener("touchend", touchEnd);
    window.removeEventListener("touchcancel", touchCancel);
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
  document.documentElement.classList.toggle("snap-pages", path === "/");
  document.documentElement.classList.toggle("light", path === "/about/");
  if (path === "/privacy/") return;
  if (path === "/about/") showAbout();
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
  if (!(url.pathname === "/" || url.pathname === "/about/" || /^\/work\/[^/]+\/?$/.test(url.pathname))) return false;
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
hoverFx();
smoothScroll(); // last, so the wheel handlers above get the first say
