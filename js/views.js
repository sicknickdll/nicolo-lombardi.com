// Page markup, shared by the browser (js/app.js) and the page generator
// (tools/build.mjs), so the pre-built HTML Google reads is exactly what visitors see.
// Pure string functions: no DOM access here.
import { projects, workOrder, hero, heroPoster, clients } from "./data.js";
import { collections, experiences } from "./archive-data.js";
import { videoGalleryMarkup, imageGalleryMarkup, tickerMarkup, videoSources } from "./galleries.js";

export const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const byIds = (ids) => ids.map((id) => projects.find((p) => p.id === id)).filter(Boolean);
export const work = byIds(workOrder);
export const projectURL = (p) => `/work/${p.id}/`;
// Every image a project shows, for the sitemap and structured data.
export const projectImages = (p) => [
  ...p.images,
  ...(p.stills || []).map((s) => s.src),
  ...(p.bts?.images || []).map((s) => s.src),
];
export const fullName = (p) => (p.title === p.brand ? p.brand : `${p.brand} — ${p.title}`);

export function homeMarkup() {
  const name = "NICOLÓ LOMBARDI";
  const letters = [...name]
    .map(
      (letter, i) =>
        `<span class="name-letter" style="--letter:${i}" aria-hidden="true">${letter === " " ? "&nbsp;" : esc(letter)}</span>`,
    )
    .join("");
  return `<section class="home" aria-label="Portfolio introduction"><img class="poster" src="${heroPoster}" alt=""><video id="entrance-video" poster="${heroPoster}" autoplay loop muted playsinline preload="auto" aria-hidden="true">${videoSources(hero)}</video><a class="home-entry" href="#work" aria-label="See the work of Nicoló Lombardi"><h1 class="animated-name" aria-label="Nicoló Lombardi">${letters}</h1><p class="home-tagline">AI Production Specialist</p><span class="down" aria-hidden="true"></span></a></section>${listMarkup(work, "Selected work")}`;
}

// The loop (or slideshow) a project shows on the landing page: its own `heroVideo`, else the first film.
export function heroOf(p) {
  if (p.heroSlides?.length) return { slides: p.heroSlides };
  if (p.heroVideo) return { video: p.heroVideo.src, poster: p.heroVideo.poster };
  if (p.videos?.[0]) return { video: p.videos[0], poster: p.videoPosters?.[0] || p.cover };
  return { poster: p.cover };
}

// Landing page: one white block per project with a small window; scrolling grows the window until the
// loop fills the screen (js/reveal.js). 
export function listMarkup(list, label, heading) {
  const sections = list
    .map((p, i) => {
      const m = heroOf(p);
      const media = m.slides
        ? m.slides.map((s, k) => `<img class="reveal-slide${k === 0 ? " is-on" : ""}" src="${s}" alt="" loading="${i < 2 ? "eager" : "lazy"}" decoding="async">`).join("")
        : m.video
          ? `<video muted loop playsinline preload="none" poster="${m.poster}" aria-hidden="true">${videoSources(m.video)}</video>`
          : `<img src="${m.poster}" alt="" loading="lazy" decoding="async">`;
      const second = p.title === p.brand ? p.type : p.title;
      const num = String(i + 1).padStart(2, "0");
      return `<section class="reveal" id="p-${p.id}" data-project="${p.id}" aria-label="${esc(fullName(p))}"><div class="reveal-stage"><span class="reveal-client">${esc(p.brand)}</span><span class="reveal-num" aria-hidden="true">${num}</span><span class="reveal-type">${esc(p.type)}</span><a class="reveal-open" href="${projectURL(p)}" aria-label="Open ${esc(fullName(p))} project"></a><div class="reveal-media">${media}<span class="reveal-shade"></span><span class="reveal-title" aria-hidden="true"><b>${esc(p.brand)}</b><i>${esc(second)}</i></span></div></div></section>`;
    })
    .join("");
  return `${heading ? `<h1 class="sr-only">${esc(heading)}</h1>` : ""}<div class="reveal-list" id="work" aria-label="${label}">${sections}</div>`;
}

// "Case" layout (projects with `stills`): film on top, text, a two-column grid of stills,
// an optional "Behind the scenes" strip and an optional closing film that plays on its own.
const stillAlt = (p, what, i) => esc(`${fullName(p)} — ${what} ${i + 1}`);
function stillsMarkup(p) {
  if (!p.stills?.length) return "";
  return `<section class="case-stills" aria-label="${esc(p.brand)} stills">${p.stills.map((s, i) => `<figure><img src="${s.src}" alt="${stillAlt(p, "still", i)}" width="${s.w}" height="${s.h}" loading="lazy" decoding="async"></figure>`).join("")}</section>`;
}
function btsMarkup(p) {
  if (!p.bts?.images?.length) return "";
  const item = (s, i, copy) =>
    `<li${copy ? ' aria-hidden="true"' : ""}><img src="${s.src}" alt="${copy ? "" : stillAlt(p, "behind the scenes", i)}" width="${s.w}" height="${s.h}" loading="lazy" decoding="async"></li>`;
  const list = p.bts.images.map((s, i) => item(s, i, false)).join("");
  const copy = p.bts.images.map((s, i) => item(s, i, true)).join("");
  return `<section class="case-bts" aria-labelledby="bts-title">${btsHeader}<div class="bts-marquee"><ul class="bts-track">${list}${copy}</ul></div></section>`;
}
const btsHeader = `<header><span>— Making of</span><h2 id="bts-title">Behind the scenes</h2></header>`;
// A making-of film without a marquee gets the same heading as the Behind the scenes strip.
function closingMarkup(p) {
  const v = p.closingVideo;
  if (!v) return "";
  const heading = !p.bts?.images?.length && /behind the scenes/i.test(v.label || "")
    ? `<section class="case-bts case-bts--heading" aria-labelledby="bts-title">${btsHeader}</section>`
    : "";
  return `${heading}<section class="case-film" aria-label="${esc(p.brand)} — ${esc(v.label || "closing film")}"><div class="player" data-brand="${esc(v.label || p.brand)}"><video controls muted loop playsinline preload="none" data-inview poster="${v.poster}" style="--ratio:${v.ratio || 16 / 9}">${videoSources(v.src)}</video></div></section>`;
}

// Year / Client / Discipline beside the project text (set `year` and, if different from the
// brand, `client` in js/data.js; a project without a year just leaves that line out).
function factsMarkup(p) {
  const rows = [
    ["Year", p.year],
    ["Client", p.client || p.brand],
    ["Discipline", p.type],
  ].filter(([, v]) => v);
  return `<dl class="facts">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;
}

export function projectMarkup(p, backHref = `/#p-${p.id}`) {
  const local =
    p.videos.length === 1
      ? `<section class="single-film" aria-label="${esc(p.brand)} film"><div class="player" data-brand="${esc(p.brand)}" data-title="${esc(p.title === p.brand ? "" : p.title)}" data-type="${esc(p.type)}"><video controls playsinline ${p.autoplay ? 'autoplay muted preload="auto"' : 'preload="metadata"'} poster="${p.videoPosters?.[0] || p.cover}" aria-label="${esc(fullName(p))}">${videoSources(p.videos[0])}</video></div></section>`
      : p.videos.length > 1
        ? videoGalleryMarkup(p, esc)
        : "";
  const embed =
    p.youtube ||
    (p.externalVideo?.includes("vimeo.com/")
      ? "https://player.vimeo.com/video/" + p.externalVideo.match(/vimeo\.com\/(\d+)/)[1] + "?dnt=1"
      : null);
  const media = embed
    ? `<section class="single-film"><iframe src="${esc(embed)}" title="${esc(fullName(p))}" allow="fullscreen; picture-in-picture; encrypted-media" allowfullscreen loading="lazy"></iframe></section>`
    : local;
  const caseLayout = Boolean(p.stills?.length);
  // In the case layout the portrait key visuals sit in a row after the stills.
  // A single picture fills the screen like the films do.
  const fullImage = !caseLayout && p.images.length === 1 && !p.gallery
    ? `<section class="single-film single-image"><img src="${p.images[0]}" alt="${esc(fullName(p))} (${esc(p.type)})" loading="lazy" decoding="async"></section>`
    : "";
  const images = caseLayout || fullImage
    ? ""
    : p.gallery === "ticker"
      ? tickerMarkup(p, esc)
      : imageGalleryMarkup(p, esc);
  const posters = caseLayout && p.images.length
    ? `<section class="case-posters" aria-label="${esc(p.brand)} key visuals">${p.images.map((src, i) => `<figure><img src="${src}" alt="${stillAlt(p, "key visual", i)}" loading="lazy" decoding="async"></figure>`).join("")}</section>`
    : "";
  const fallback =
    !media && !images
      ? `<section class="detail-header"><img src="${p.cover}" alt="${esc(fullName(p))}"></section>`
      : "";
  // "Next project" follows the Work order for projects in it, otherwise the `projects` order.
  const order = work.includes(p) ? work : projects;
  const next = order[(order.indexOf(p) + 1) % order.length];
  return `<article class="detail"><a class="back" href="${backHref}">back</a>${media}${fullImage}${images}${fallback}<header class="detail-heading"><h1>${esc(p.brand)}${p.title === p.brand ? "" : "<br>" + esc(p.title)}</h1><p>${esc(p.type)}</p></header><div class="detail-text"><div><h2>About the project</h2>${factsMarkup(p)}</div><p>${esc(p.description)}</p></div>${stillsMarkup(p)}${posters}${btsMarkup(p)}${closingMarkup(p)}${p.externalVideo ? `<p class="media-note"><a href="${esc(p.externalVideo)}" target="_blank" rel="noopener noreferrer">Open film on Vimeo</a></p>` : ""}<a class="next-project" href="${projectURL(next)}"><span>Next project</span><strong>${esc(next.brand)}</strong></a></article>`;
}

// About page: the name and the text on the left, the 3D head (js/head.js) on the right.
export function aboutMarkup() {
  return `<article class="about-page">
  <div class="about-text">
    <h1 class="about-title">Nicoló Lombardi</h1>
    <p class="bio">AI Filmmaker, Creative Technologist and Art Director specializing in the design and production of next-generation visual content. Combining artificial intelligence, storytelling, motion, sound and creative direction, he creates campaigns and experiences for global brands.</p>
    <div class="about-columns">
      <div>
        <p>Film &amp; visual production</p>
        <p>Art direction<br>AI filmmaking<br>Motion &amp; sound<br>Virtual production</p>
      </div>
      <div>
        <p>Based in Madrid, Spain</p>
        <a href="mailto:hello.nicolombardi@gmail.com">hello.nicolombardi@gmail.com</a><br>
        <a href="tel:+34643868613">+34 643 868 613</a>
      </div>
      <div>
        <a href="https://www.instagram.com/nickprods/" target="_blank" rel="noopener noreferrer">Instagram</a><br>
        <a href="https://www.linkedin.com/in/nicolo-lombardi/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
      </div>
    </div>
    ${clientsMarkup()}
    <p class="copyright">© ${new Date().getFullYear()} Nicoló Lombardi · <a href="/privacy/">Privacy</a></p>
  </div>
  <div class="about-head" aria-hidden="true"></div>
</article>`;
}

// "Selected clients" strip. Each logo gets the same visual area whatever its shape:
// width = √(area × ratio), so wide wordmarks don't dwarf square emblems.
export function clientsMarkup() {
  const area = 56 * 56;
  return `<div class="clients"><p>Selected clients</p><ul class="client-logos">${clients
    .map((c) => {
      const h = Math.min(56, Math.sqrt(area / c.ratio));
      return `<li><img src="${c.logo}" alt="${esc(c.name)}" title="${esc(c.name)}" width="${Math.round(h * c.ratio)}" height="${Math.round(h)}" loading="lazy" decoding="async"></li>`;
    })
    .join("")}</ul></div>`;
}

// ── Archive ──────────────────────────────────────────────────────────────────
export const collectionURL = (c) => `/archive/${c.id}/`;

// /archive/: a desktop (js/archive-desktop.js). Icons in the top-left corner: readme.txt, one
// object per collection (a napkin, a card back: they turn on hover) and, bottom right, one folder per
// portfolio project. A project's folder opens on hover and its pictures float
// out (after React Bits' "Folder Float"); a click goes straight to the collection's page. The
// collections without a page yet (`upcoming` in js/archive-data.js) are not shown.
// Behind everything, js/particle-text.js draws "ARCHIVE" in dots, glitching into other phrases.
// The icons are real links, so the page still works (and is readable by search engines) without JS.
const fileSVG = (ext) => `<svg class="desk-file" viewBox="0 0 48 60" aria-hidden="true"><path d="M4 2h28l14 14v40a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path class="fold" d="M32 2v14h14"/><text x="24" y="46" text-anchor="middle">${ext}</text></svg>`;
// Pieces leaving the folder: an arc above it, each a little tilted (fixed, so it never jumps).
const floatSpots = (n) =>
  Array.from({ length: n }, (_, i) => {
    const u = n > 1 ? i / (n - 1) - 0.5 : 0,
      j = Math.abs(Math.sin(i * 12.9898 + 4.1414) * 43758.5453) % 1;
    return { x: Math.round(34 + u * 110 + (j - 0.5) * 6), y: Math.round(-30 - (1 - (2 * u) ** 2) * 20 - j * 6), r: Math.round(8 * (j * 2 - 1)) };
  });
const floatFolder = (thumbs) => {
  const spots = floatSpots(thumbs.length);
  return `<span class="ff" style="--n:${thumbs.length}" aria-hidden="true"><span class="ff-back"></span><span class="ff-paper"></span><span class="ff-items">${thumbs.map((t, i) => `<span class="ff-item" style="--i:${i};--x:${spots[i].x}px;--y:${spots[i].y}px;--r:${spots[i].r}deg"><img src="${t}" alt="" loading="lazy" draggable="false"></span>`).join("")}</span><span class="ff-front"></span></span>`;
};
const sunSVG = `<svg viewBox="0 0 24 24" aria-hidden="true" class="i-sun"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>`;
const moonSVG = `<svg viewBox="0 0 24 24" aria-hidden="true" class="i-moon"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>`;
// LA BARRA and the Tarot Reader are shown as objects (a napkin, a card back) instead of folders;
// on hover they turn slowly, like a 3D model. Both faces are real: the napkin's back is its scan.
const objIcon = (front, back, ratio) =>
  `<span class="dobj" style="--r:${ratio}" aria-hidden="true"><span class="dobj-spin"><img class="dobj-f" src="${front}" alt="" draggable="false"><img class="dobj-b" src="${back}" alt="" draggable="false"></span></span>`;
const archiveObject = {
  "la-barra": () => {
    const it = collections.find((c) => c.id === "la-barra").items.find((i) => i.id === "bar-luce");
    return objIcon(it.front, it.back, it.ratio);
  },
  tarot: () => objIcon("/assets/archive/tarot/back-thumb.webp", "/assets/archive/tarot/back-thumb.webp", 0.5625),
};
// One folder per project of the portfolio, in the bottom right corner: hover shows its pictures.
const projectFolders = () =>
  work
    .map(
      (p) =>
        `<li><a class="desk-icon desk-coll desk-proj" href="${projectURL(p)}" data-href="${projectURL(p)}" data-id="p-${p.id}" draggable="false"><span class="desk-glyph">${floatFolder([p.cover, ...p.images].filter(Boolean).slice(0, 3))}</span><span class="desk-label">${esc((work.filter((q) => q.brand === p.brand).length > 1 && p.title !== p.brand ? p.title : p.brand).toLowerCase())}</span></a></li>`,
    )
    .join("");
export function archiveMarkup() {
  const icons = [
    `<li><a class="desk-icon" href="#readme" data-open="readme" draggable="false"><span class="desk-glyph">${fileSVG("TXT")}</span><span class="desk-label">readme.txt</span></a></li>`,
    ...collections.map(
      (c) =>
        `<li><a class="desk-icon desk-obj" href="${collectionURL(c)}" data-href="${collectionURL(c)}" data-id="${c.id}" draggable="false"><span class="desk-glyph">${archiveObject[c.id] ? archiveObject[c.id]() : floatFolder(c.items.slice(0, 5).map((i) => i.thumb))}</span><span class="desk-label">${esc(c.title.toLowerCase())}</span></a></li>`,
    ),
    ...experiences.map(
      (x) =>
        `<li><a class="desk-icon desk-obj desk-${x.id}" href="${collectionURL(x)}" data-href="${collectionURL(x)}" data-id="${x.id}" draggable="false"><span class="desk-glyph">${archiveObject[x.id] ? archiveObject[x.id]() : floatFolder(x.icon)}</span><span class="desk-label">${esc(x.label)}</span></a></li>`,
    ),
  ];
  return `<section class="desk" aria-labelledby="arch-title"><h1 id="arch-title" class="sr-only">Archive</h1>
<nav class="desk-bar" aria-label="Archive menu bar"><a class="desk-brand" href="/">Nicoló Lombardi</a><ul class="desk-menus">
<li><button type="button" aria-haspopup="true" aria-expanded="false">File</button><ul class="desk-drop"><li><button type="button" data-cmd="open-readme">Open readme.txt</button></li><li><button type="button" data-cmd="close-all">Close all windows</button></li><li><button type="button" data-cmd="restore">Restore windows</button></li></ul></li>
<li><button type="button" aria-haspopup="true" aria-expanded="false">View</button><ul class="desk-drop"><li><button type="button" data-cmd="arrange">Clean up icons</button></li><li><button type="button" data-cmd="theme">Dark / light</button></li></ul></li>
<li><button type="button" aria-haspopup="true" aria-expanded="false">Go</button><ul class="desk-drop"><li><a href="/#work">Work</a></li><li><a href="/about/">About</a></li><li><a href="mailto:hello.nicolombardi@gmail.com?subject=Project%20enquiry">Contact</a></li></ul></li>
</ul><div class="desk-corner"><span class="desk-based">Based in Madrid</span><span class="desk-time" aria-label="Time in Madrid"></span><button type="button" class="desk-theme" data-cmd="theme" aria-label="Switch dark / light mode">${sunSVG}${moonSVG}</button></div></nav>
<div class="desk-wall" aria-hidden="true"><canvas class="desk-particles"></canvas></div>
<p class="sr-only desk-phrase" aria-live="off">ARCHIVE</p>
<ul class="desk-icons" aria-label="Archive">${icons.join("")}</ul>
<ul class="desk-icons desk-projects" aria-label="Portfolio projects">${projectFolders()}</ul>
<div class="desk-windows"></div>
<footer class="desk-task"><ul class="desk-tabs" aria-label="Open windows"></ul></footer>
</section>`.replace(/\n/g, "");
}

// /archive/<id>/: an infinite, pannable grid of the pieces (tiles are drawn by js/archive.js),
// a search bar at the bottom, and the viewer that opens a piece as an interactive 3D card.
// The list below is for search engines and screen readers.
export function collectionMarkup(c) {
  const list = c.items
    .map((it) => `<li>${esc(it.name)}, ${esc(it.type.toLowerCase())}${it.country ? `, ${esc(it.country)}` : ""}${it.location ? `, ${esc(it.location)}` : ""}</li>`)
    .join("");
  return `<section class="arch-wall" data-collection="${c.id}" aria-labelledby="arch-title"><header class="sr-only"><nav aria-label="Breadcrumb"><a href="/archive/">Archive</a></nav><h1 id="arch-title">${esc(c.title)}</h1><p>${esc(c.blurb)}</p></header><a class="arch-back caslon" href="/archive/">Back</a><div class="arch-grid" id="arch-grid" role="region" aria-roledescription="gallery" aria-label="${esc(c.title)}: drag or scroll to explore, click a piece to open it"></div><ul class="sr-only" aria-label="Pieces in ${esc(c.title)}">${list}</ul><p class="arch-empty" id="arch-empty" hidden>No match.</p>${loaderMarkup(c)}<form class="arch-search" role="search" autocomplete="off"><label class="sr-only" for="arch-q">Search the collection</label><input id="arch-q" type="search" placeholder="Search a servilleta, a bar, a country…" spellcheck="false" enterkeyhint="search"><kbd aria-hidden="true">/</kbd></form></section>${viewerMarkup(c)}`;
}
// Loading screen: the title forms like ink stains spreading (an SVG filter that js/archive.js
// animates), then the line under it appears.
function loaderMarkup(c) {
  return `<div class="arch-loader" id="arch-loader" aria-hidden="true"><svg width="0" height="0" style="position:absolute"><filter id="arch-stain" x="-10%" y="-30%" width="120%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="4" result="n"/><feDisplacementMap id="arch-disp" in="SourceGraphic" in2="n" scale="16" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur id="arch-blur" in="d" stdDeviation="16" result="b"/><feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11"/></filter></svg><p class="arch-load-title caslon">${esc(c.title)}</p><p class="arch-load-sub">${esc(c.subtext)}</p></div>`;
}
function viewerMarkup(c) {
  return `<div class="arch-viewer" id="arch-viewer" role="dialog" aria-modal="true" aria-label="${esc(c.title)} piece" hidden><button type="button" class="arch-close caslon" aria-label="Close viewer">X</button><h2 class="arch-name caslon" id="arch-name"></h2><div class="arch-stage" id="arch-stage" aria-label="3D view of the piece. Drag to turn it, double-click to flip."></div><dl class="arch-facts"><div><dt>Country</dt><dd id="arch-country"></dd></div><div><dt>Location</dt><dd id="arch-location"></dd></div><div><dt>Category</dt><dd id="arch-category"></dd></div></dl></div>`;
}
export const archiveCollections = collections;
export const archiveExperiences = experiences;

// /archive/tarot/: the Tarot Reader (js/tarot/experience.js). Everything on screen is drawn by
// the script; this markup holds the overlays (dialogue, prompts, caption, loading screen) and,
// for search engines and screen readers, what the piece is.
export function tarotMarkup() {
  const x = experiences.find((e) => e.id === "tarot");
  return `<section class="tarot" aria-labelledby="tr-title"><header class="sr-only"><nav aria-label="Breadcrumb"><a href="/archive/">Archive</a></nav><h1 id="tr-title">The Tarot Reader</h1><p>${esc(x.blurb)}</p><p>Shuffle the deck, cut it, meet the guiding card at the bottom of the deck, then choose five cards for your past, present, future, shadow and conscious potential. Use the mouse, touch, or the keyboard: Enter or Space to continue, arrow keys to choose, Escape to put a card back, M for sound.</p></header>
<div class="tr-stage" role="application" aria-label="The fortune teller's table" tabindex="-1"></div>
<div class="tr-grain" aria-hidden="true"></div>
<nav class="tr-top" aria-label="Tarot Reader"><a class="tr-back caslon" href="/archive/">Back</a></nav>
<p class="tr-caption" aria-live="polite" hidden></p>
<div class="tr-prompts" aria-live="polite"></div>
<div class="tr-dialogue" hidden><p class="tr-text caslon" aria-hidden="true"></p><span class="tr-more" aria-hidden="true" hidden></span></div>
<p class="sr-only tr-live" aria-live="polite"></p>
<div class="tr-loading" aria-hidden="true"><span class="tr-candle"></span><p class="caslon">The cards are being prepared…</p></div>
<noscript><p class="tr-noscript caslon">The fortune teller only reads by candlelight, and the candles need JavaScript.</p></noscript></section>`.replace(/\n/g, "");
}
