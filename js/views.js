// Page markup, shared by the browser (js/app.js) and the page generator
// (tools/build.mjs), so the pre-built HTML Google reads is exactly what visitors see.
// Pure string functions: no DOM access here.
import { projects, filmOrder, visualsOrder, hero, heroPoster, clients } from "./data.js";
import { videoGalleryMarkup, imageGalleryMarkup, tickerMarkup, videoSources } from "./galleries.js";

export const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const byIds = (ids) => ids.map((id) => projects.find((p) => p.id === id)).filter(Boolean);
export const film = byIds(filmOrder);
export const visuals = byIds(visualsOrder);
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
  return `<section class="home" aria-label="Portfolio introduction"><img class="poster" src="${heroPoster}" alt=""><video id="entrance-video" poster="${heroPoster}" autoplay loop muted playsinline preload="auto" aria-hidden="true">${videoSources(hero)}</video><a class="home-entry" href="/film/" aria-label="Explore films by Nicoló Lombardi"><h1 class="animated-name" aria-label="Nicoló Lombardi">${letters}</h1><p class="home-tagline">AI Production Specialist</p><span class="down" aria-hidden="true"></span></a><a class="home-cta" href="mailto:hello.nicolombardi@gmail.com?subject=Project%20enquiry">let's work together →</a><button class="home-pause" aria-label="Pause background video">pause</button></section>${listMarkup(film, "Selected films")}`;
}

// Full-screen scrolling covers. `heading` adds a screen-reader/search heading.
export function listMarkup(list, label, heading) {
  return `${heading ? `<h1 class="sr-only">${esc(heading)}</h1>` : ""}<div class="project-scroll" aria-label="${label}">${list.map((p, i) => `<section class="project-section" id="p-${p.id}" data-project="${p.id}" style="--cover:url(${p.cover})" aria-label="${esc(fullName(p))}"><a class="project-open" href="${projectURL(p)}" aria-label="Open ${esc(fullName(p))} project"></a><img src="${p.cover}" alt="${esc(`${fullName(p)} — ${p.type} by Nicoló Lombardi`)}" loading="${i === 0 ? "eager" : "lazy"}" decoding="async"></section>`).join("")}</div><a class="view-project" href="${projectURL(list[0])}" aria-label="View ${esc(list[0].brand)} project" hidden>view project</a>`;
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

export function projectMarkup(p, backHref = "/film/") {
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
  // "Next project" follows the Film order for projects in it, otherwise the `projects` order.
  const order = film.includes(p) ? film : projects;
  const next = order[(order.indexOf(p) + 1) % order.length];
  return `<article class="detail"><a class="back" href="${backHref}">back</a>${media}${fullImage}${images}${fallback}<header class="detail-heading"><h1>${esc(p.brand)}${p.title === p.brand ? "" : "<br>" + esc(p.title)}</h1><p>${esc(p.type)}</p></header><div class="detail-text"><h2>About the project</h2><p>${esc(p.description)}</p></div>${stillsMarkup(p)}${posters}${btsMarkup(p)}${closingMarkup(p)}${p.externalVideo ? `<p class="media-note"><a href="${esc(p.externalVideo)}" target="_blank" rel="noopener noreferrer">Open film on Vimeo</a></p>` : ""}<a class="next-project" href="${projectURL(next)}"><span>Next project</span><strong>${esc(next.brand)}</strong></a></article>`;
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
