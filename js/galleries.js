// Video carousel (horizontal, with thumbnails) and image carousel (vertical)
// used on project pages.
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const behavior = () => (reduced() ? "instant" : "smooth");

// WebM first (smaller, Chrome/Firefox/modern Safari), MP4 fallback for the rest.
export function videoSources(webm) {
  const mp4 = webm.replace(/\.webm$/, ".mp4");
  return `<source src="${webm}" type="video/webm"><source src="${mp4}" type="video/mp4">`;
}

export function videoGalleryMarkup(project, escape) {
  const posters = project.videoPosters || [],
    thumbs = project.videoThumbnails || posters;
  return `<section class="video-gallery" aria-label="${escape(project.brand)} films" aria-roledescription="carousel">
  <div class="video-track" tabindex="0" aria-label="Video carousel — use left and right arrows">${project.videos.map((src, i) => `<div class="video-slide" data-slide="${i}" style="--ratio:${project.videoRatios?.[i] || 16 / 9}" role="group" aria-label="Film ${i + 1} of ${project.videos.length}"><div class="player" data-brand="${escape(project.brand)}" data-title="${escape(project.title === project.brand ? "" : project.title)}" data-type="${escape(project.type)}"><video controls playsinline preload="${i === 0 ? "metadata" : "none"}" poster="${posters[i] || project.cover}" aria-label="${escape(project.brand)} film ${i + 1}">${videoSources(src)}</video></div></div>`).join("")}</div>
  <div class="video-navigation"><button class="gallery-prev" aria-label="Previous video">←</button><div class="video-thumbnails" aria-label="Select a video">${project.videos.map((_, i) => `<button class="video-thumbnail" data-video="${i}" aria-label="Select film ${i + 1}" aria-pressed="${i === 0}"><img src="${thumbs[i] || project.cover}" alt="" loading="lazy"></button>`).join("")}</div><button class="gallery-next" aria-label="Next video">→</button></div>
 </section>`;
}

export function imageGalleryMarkup(project, escape) {
  if (!project.images.length) return "";
  return `<section class="image-gallery" aria-label="${escape(project.brand)} images" aria-roledescription="carousel"><div class="image-track" tabindex="0" aria-label="Image carousel — use up and down arrows">${project.images.map((src, i) => `<figure class="image-slide" role="group" aria-label="Image ${i + 1} of ${project.images.length}"><img src="${src}" alt="${escape(project.title === project.brand ? project.brand : project.brand + " — " + project.title)} (${escape(project.type)}), image ${i + 1}" loading="lazy" decoding="async"></figure>`).join("")}</div>${project.images.length > 1 ? '<div class="image-navigation"><button class="gallery-prev" aria-label="Previous image">↑</button><button class="gallery-next" aria-label="Next image">↓</button></div>' : ""}</section>`;
}

// Ticker gallery (project.gallery === "ticker"): one row of images that scrolls by itself,
// endlessly, with faded edges. It slows right down under the pointer and the mouse wheel
// or a drag pushes it along. The images are listed twice (the copy is hidden from screen
// readers) and the row wraps by exactly one set.
export function tickerMarkup(project, escape) {
  const name = project.title === project.brand ? project.brand : `${project.brand} — ${project.title}`;
  const item = (src, i, copy) =>
    `<li${copy ? ' aria-hidden="true"' : ""}><img src="${src}" alt="${copy ? "" : `${escape(name)} (${escape(project.type)}), image ${i + 1}`}" loading="eager" decoding="async" draggable="false"></li>`;
  const once = project.images.map((s, i) => item(s, i, false)).join("");
  const twice = project.images.map((s, i) => item(s, i, true)).join("");
  return `<section class="ticker" aria-label="${escape(project.brand)} gallery"><div class="ticker-row"><ul class="ticker-track">${once}${twice}</ul></div></section>`;
}

// Click an image: it grows from where it sits to a large centred view (a "FLIP" animation
// on a smooth ease-out curve) over a dark backdrop, and shrinks back on close.
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
function bindZoom(root, pause) {
  let box = null;
  const fit = (img) => {
    const k = Math.min((innerWidth * 0.9) / img.naturalWidth, (innerHeight * 0.84) / img.naturalHeight);
    const w = img.naturalWidth * k,
      h = img.naturalHeight * k;
    return { left: (innerWidth - w) / 2, top: (innerHeight - h) / 2 + 12, width: w, height: h };
  };
  const frames = (from, to) => [
    { transform: `translate(${from.left - to.left}px,${from.top - to.top}px) scale(${from.width / to.width},${from.height / to.height})` },
    { transform: "none" },
  ];
  const duration = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 750);
  const open = (img) => {
    if (box) return;
    pause(true);
    const from = img.getBoundingClientRect(),
      to = fit(img);
    const wrap = document.createElement("div");
    wrap.className = "zoom";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-label", img.alt || "Image");
    const back = document.createElement("div");
    back.className = "zoom-back";
    const big = document.createElement("img");
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    Object.assign(big.style, {
      left: to.left + "px",
      top: to.top + "px",
      width: to.width + "px",
      height: to.height + "px",
    });
    const x = document.createElement("button");
    x.type = "button";
    x.className = "zoom-close";
    x.textContent = "close";
    wrap.append(back, big, x);
    document.body.append(wrap);
    img.style.visibility = "hidden";
    const d = duration();
    back.animate([{ opacity: 0 }, { opacity: 1 }], { duration: d * 0.8, easing: EASE, fill: "forwards" });
    x.animate([{ opacity: 0 }, { opacity: 1 }], { duration: d, delay: d * 0.4, fill: "backwards" });
    big.animate(frames(from, to), { duration: d, easing: EASE });
    box = { wrap, back, big, x, img, to };
    x.focus({ preventScroll: true });
    wrap.addEventListener("click", close);
  };
  const close = () => {
    if (!box) return;
    const { wrap, back, big, x, img, to } = box;
    box = null;
    const d = duration();
    // The row may have drifted: grow back to where the image is now, if it is on screen.
    const now = img.getBoundingClientRect();
    const onScreen = now.right > 0 && now.left < innerWidth;
    back.animate([{ opacity: 1 }, { opacity: 0 }], { duration: d * 0.8, easing: EASE, fill: "forwards" });
    x.style.opacity = 0;
    const a = big.animate(
      onScreen ? [...frames(now, to)].reverse() : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.96)" }],
      { duration: d, easing: EASE, fill: "forwards" },
    );
    a.onfinish = () => {
      img.style.visibility = "";
      wrap.remove();
      pause(false);
    };
  };
  const key = (e) => {
    if (box && e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  };
  window.addEventListener("keydown", key, true);
  return { open, off: () => window.removeEventListener("keydown", key, true) };
}

function bindTicker(root) {
  const row = root.querySelector(".ticker-row"),
    track = root.querySelector(".ticker-track");
  let paused = false,
    moved = 0;
  const zoom = bindZoom(root, (p) => (paused = p));
  row.addEventListener("click", (e) => {
    if (moved > 6) return;
    const img = document.elementFromPoint(e.clientX, e.clientY)?.closest(".ticker-track img");
    if (img) zoom.open(img);
  });
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return zoom.off;
  const BASE = 60; // px per second
  let x = 0,
    setW = 0,
    speed = BASE,
    target = BASE,
    kick = 0,
    raf = 0,
    last = 0,
    visible = true,
    drag = null;
  const measure = () => {
    const kids = [...track.children];
    const half = kids.length / 2;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    setW = kids.slice(0, half).reduce((w, el) => w + el.getBoundingClientRect().width + gap, 0);
  };
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
    last = now;
    if (!visible || !setW || paused) return;
    speed += (target - speed) * Math.min(1, dt * 5);
    kick *= Math.pow(0.04, dt);
    x -= (drag ? 0 : speed + kick) * dt;
    x = ((x % setW) + setW) % setW - setW;
    track.style.transform = `translate3d(${x}px,0,0)`;
  };
  const imgs = [...track.querySelectorAll("img")];
  // Measure now and again as each image arrives (a row's width depends on its images).
  measure();
  imgs.forEach((im) => !im.complete && im.addEventListener("load", measure, { once: true }));
  addEventListener("resize", measure);
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(root);
  row.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && (target = BASE * 0.12));
  row.addEventListener("pointerleave", () => (target = BASE));
  row.addEventListener(
    "wheel",
    (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // vertical scrolling stays the page's
      e.preventDefault();
      kick += e.deltaX * 2.2;
    },
    { passive: false },
  );
  row.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    drag = { px: e.clientX, x0: x };
    moved = 0;
    row.setPointerCapture(e.pointerId);
    row.classList.add("dragging");
  });
  row.addEventListener("pointermove", (e) => {
    if (!drag) return;
    moved = Math.max(moved, Math.abs(e.clientX - drag.px));
    x = drag.x0 + (e.clientX - drag.px);
    x = ((x % setW) + setW) % setW - setW;
    track.style.transform = `translate3d(${x}px,0,0)`;
    kick = -(e.movementX || 0) * 20; // let go and it carries on in the same direction
  });
  const up = () => {
    drag = null;
    row.classList.remove("dragging");
  };
  row.addEventListener("pointerup", up);
  row.addEventListener("pointercancel", up);
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
    removeEventListener("resize", measure);
    zoom.off();
  };
}

function bindCarousel(root, axis, selector, thumbnailSelector) {
  const track = root.querySelector(axis === "x" ? ".video-track" : ".image-track");
  const slides = [...track.querySelectorAll(selector)],
    thumbs = [...root.querySelectorAll(thumbnailSelector || ".unused")];
  let active = 0,
    frame = 0,
    pointer = null,
    suppressClick = false;
  const position = (el) => (axis === "x" ? el.offsetLeft : el.offsetTop);
  const size = (el) => (axis === "x" ? el.clientWidth : el.clientHeight);
  const scroll = () => (axis === "x" ? track.scrollLeft : track.scrollTop);
  const target = (i) => position(slides[i]) - (size(track) - size(slides[i])) / 2;
  const select = (i) => {
    i = Math.max(0, Math.min(slides.length - 1, i));
    track.scrollTo(
      axis === "x"
        ? { left: target(i), behavior: behavior() }
        : { top: target(i), behavior: behavior() },
    );
  };
  const update = () => {
    frame = 0;
    const next = slides.reduce(
      (best, slide, i) =>
        Math.abs(target(i) - scroll()) < Math.abs(target(best) - scroll()) ? i : best,
      0,
    );
    active = next;
    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === active);
      const video = slide.querySelector("video");
      if (video) {
        if (i !== active) video.pause();
        else video.preload = "metadata";
      }
    });
    thumbs.forEach((thumb, i) => thumb.setAttribute("aria-pressed", String(i === active)));
    if (thumbs[active]) {
      const bar = thumbs[active].parentElement;
      bar.scrollTo({
        left: thumbs[active].offsetLeft - (bar.clientWidth - thumbs[active].clientWidth) / 2,
        behavior: behavior(),
      });
    }
    const prev = root.querySelector(".gallery-prev"),
      nextButton = root.querySelector(".gallery-next");
    if (prev) prev.disabled = active === 0;
    if (nextButton) nextButton.disabled = active === slides.length - 1;
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  track.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  const prev = root.querySelector(".gallery-prev"),
    next = root.querySelector(".gallery-next");
  if (prev) prev.onclick = () => select(active - 1);
  if (next) next.onclick = () => select(active + 1);
  thumbs.forEach((thumb, i) => (thumb.onclick = () => select(i)));
  const key = (e) => {
    if (e.target.tagName === "VIDEO") return;
    const keys = axis === "x" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
    if (keys.includes(e.key)) {
      e.preventDefault();
      select(active + (e.key === keys[0] ? -1 : 1));
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      select(e.key === "Home" ? 0 : slides.length - 1);
    }
  };
  track.addEventListener("keydown", key);
  const down = (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || e.target.closest("button,a")) return;
    const video = e.target.closest("video");
    if (video && e.clientY > video.getBoundingClientRect().bottom - 60) return;
    suppressClick = false;
    pointer = {
      id: e.pointerId,
      start: axis === "x" ? e.clientX : e.clientY,
      scroll: scroll(),
      dragging: false,
    };
  };
  const move = (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    const distance = (axis === "x" ? e.clientX : e.clientY) - pointer.start;
    if (Math.abs(distance) > 5) {
      pointer.dragging = true;
      suppressClick = true;
      track.classList.add("dragging");
      track.setPointerCapture(e.pointerId);
    }
    if (pointer.dragging) {
      e.preventDefault();
      if (axis === "x") track.scrollLeft = pointer.scroll - distance;
      else track.scrollTop = pointer.scroll - distance;
    }
  };
  const up = (e) => {
    if (!pointer) return;
    if (track.hasPointerCapture?.(pointer.id)) track.releasePointerCapture(pointer.id);
    const dragged = pointer.dragging;
    pointer = null;
    track.classList.remove("dragging");
    if (dragged) select(active);
  };
  const click = (e) => {
    if (suppressClick) {
      e.preventDefault();
      e.stopPropagation();
      suppressClick = false;
    }
  };
  track.addEventListener("click", click, true);
  track.addEventListener("pointerdown", down);
  track.addEventListener("pointermove", move);
  track.addEventListener("pointerup", up);
  track.addEventListener("pointercancel", up);
  slides.forEach((slide, i) => {
    const video = slide.querySelector("video");
    if (video)
      video.addEventListener("play", () => {
        if (i !== active) select(i);
      });
  });
  const initial = requestAnimationFrame(() => {
    select(0);
    update();
  });
  return () => {
    cancelAnimationFrame(initial);
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", schedule);
    track.removeEventListener("scroll", schedule);
    track.removeEventListener("keydown", key);
    track.removeEventListener("click", click, true);
    track.removeEventListener("pointerdown", down);
    track.removeEventListener("pointermove", move);
    track.removeEventListener("pointerup", up);
    track.removeEventListener("pointercancel", up);
  };
}
export function bindGalleries(main) {
  const clean = [];
  main
    .querySelectorAll(".video-gallery")
    .forEach((root) => clean.push(bindCarousel(root, "x", ".video-slide", ".video-thumbnail")));
  main
    .querySelectorAll(".image-gallery")
    .forEach((root) => clean.push(bindCarousel(root, "y", ".image-slide")));
  main.querySelectorAll(".ticker").forEach((root) => clean.push(bindTicker(root)));
  return () => clean.forEach((fn) => fn());
}
