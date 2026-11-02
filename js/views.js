// Page markup, shared by the browser (js/app.js) and the page generator
// (tools/build.mjs), so the pre-built HTML Google reads is exactly what visitors see.
// Pure string functions: no DOM access here.
import { projects, workOrder, hero, heroPoster, clients } from "./data.js";
import { collections } from "./archive-data.js";
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

// Full-screen scrolling covers. `heading` adds a screen-reader/search heading.
export function listMarkup(list, label, heading) {
  return `${heading ? `<h1 class="sr-only">${esc(heading)}</h1>` : ""}<div class="project-scroll" id="work" aria-label="${label}">${list.map((p, i) => `<section class="project-section" id="p-${p.id}" data-project="${p.id}" style="--cover:url(${p.cover})" aria-label="${esc(fullName(p))}"><a class="project-open" href="${projectURL(p)}" aria-label="Open ${esc(fullName(p))} project"></a><img src="${p.cover}" alt="${esc(`${fullName(p)} — ${p.type} by Nicoló Lombardi`)}" loading="${i === 0 ? "eager" : "lazy"}" decoding="async"></section>`).join("")}</div><a class="view-project" href="${projectURL(list[0])}" aria-label="View ${esc(list[0].brand)} project" hidden>view project</a>`;
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
const pad = (n) => String(n).padStart(2, "0");
const searchText = (it) => [it.name, it.type, it.country, it.location].filter(Boolean).join(" ").toLowerCase();

// /archive/: one tile per collection. A collection without an icon gets a placeholder.
export function archiveMarkup() {
  return `<section class="arch-index" aria-labelledby="arch-title"><h1 id="arch-title" class="arch-title">Archive</h1><p class="arch-lede">Collections, found and kept.</p><ul class="arch-collections">${collections
    .map(
      (c) =>
        `<li><a class="arch-tile" href="${collectionURL(c)}"><span class="arch-icon${c.icon ? "" : " placeholder"}" aria-hidden="true">${c.icon ? `<img src="${c.icon}" alt="" loading="lazy">` : `<i></i><i></i><i></i>`}</span><span class="arch-tile-name">${esc(c.title)}</span><span class="arch-tile-meta">${pad(c.items.length)} pieces</span></a></li>`,
    )
    .join("")}</ul></section>`;
}

// /archive/<id>/: an infinite, pannable grid of the pieces (tiles are drawn by js/archive.js),
// a search bar at the bottom, and the viewer that opens a piece as an interactive 3D card.
// The list below is for search engines and screen readers.
export function collectionMarkup(c) {
  const n = c.items.length;
  const list = c.items
    .map((it) => `<li>${esc(it.name)} — ${esc(it.type)}${it.country ? `, ${esc(it.country)}` : ""}${it.location ? `, ${esc(it.location)}` : ""}</li>`)
    .join("");
  return `<section class="arch-wall" data-collection="${c.id}" aria-labelledby="arch-title"><header class="arch-head"><nav class="arch-crumb" aria-label="Breadcrumb"><a href="/archive/">Archive</a></nav><h1 id="arch-title" class="arch-title caslon">${esc(c.title)}</h1><p class="arch-count"><span id="arch-shown">${pad(n)}</span> / ${pad(n)} · ${esc(c.blurb)}</p></header><div class="arch-grid" id="arch-grid" role="region" aria-roledescription="gallery" aria-label="${esc(c.title)}: drag or scroll to explore, click a piece to open it"></div><ul class="sr-only" aria-label="Pieces in ${esc(c.title)}">${list}</ul><p class="arch-empty" id="arch-empty" hidden>Nothing like that in the archive yet.</p><form class="arch-search" role="search" autocomplete="off"><label class="sr-only" for="arch-q">Search the collection</label><input id="arch-q" type="search" placeholder="Search a servilleta, a bar, a country…" spellcheck="false" enterkeyhint="search"><kbd aria-hidden="true">/</kbd></form></section>${viewerMarkup(c)}`;
}
function viewerMarkup(c) {
  return `<div class="arch-viewer" id="arch-viewer" role="dialog" aria-modal="true" aria-label="${esc(c.title)} piece" hidden><button type="button" class="arch-close" aria-label="Close viewer">Close <span aria-hidden="true">×</span></button><div class="arch-stage" id="arch-stage" aria-label="3D view of the piece. Drag to turn it, double-click to flip."></div><aside class="arch-info"><p class="arch-no"><span id="arch-no">01</span> / ${pad(c.items.length)}</p><h2 class="arch-name caslon" id="arch-name"></h2><p class="arch-type" id="arch-type"></p><dl class="arch-facts"><div><dt>(COUNTRY)</dt><dd id="arch-country"></dd></div><div><dt>(LOCATION)</dt><dd id="arch-location"></dd></div></dl><div class="arch-actions"><button type="button" id="arch-flip">See the back</button><span class="arch-steps"><button type="button" id="arch-prev" aria-label="Previous piece">←</button><button type="button" id="arch-next" aria-label="Next piece">→</button></span></div><p class="arch-hint">Drag to turn it over · double-click to flip · move over it for the foil</p></aside></div>`;
}
export const archiveCollections = collections;
