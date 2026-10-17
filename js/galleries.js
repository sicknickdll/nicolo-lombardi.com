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
  <div class="video-track" tabindex="0" aria-label="Video carousel — use left and right arrows">${project.videos.map((src, i) => `<div class="video-slide" data-slide="${i}" style="--ratio:${project.videoRatios?.[i] || 16 / 9}" role="group" aria-label="Film ${i + 1} of ${project.videos.length}"><video controls playsinline preload="${i === 0 ? "metadata" : "none"}" poster="${posters[i] || project.cover}" aria-label="${escape(project.brand)} film ${i + 1}">${videoSources(src)}</video></div>`).join("")}</div>
  <div class="video-navigation"><button class="gallery-prev" aria-label="Previous video">←</button><div class="video-thumbnails" aria-label="Select a video">${project.videos.map((_, i) => `<button class="video-thumbnail" data-video="${i}" aria-label="Select film ${i + 1}" aria-pressed="${i === 0}"><img src="${thumbs[i] || project.cover}" alt="" loading="lazy"></button>`).join("")}</div><button class="gallery-next" aria-label="Next video">→</button></div>
 </section>`;
}

export function imageGalleryMarkup(project, escape) {
  if (!project.images.length) return "";
  return `<section class="image-gallery" aria-label="${escape(project.brand)} images" aria-roledescription="carousel"><div class="image-track" tabindex="0" aria-label="Image carousel — use up and down arrows">${project.images.map((src, i) => `<figure class="image-slide" role="group" aria-label="Image ${i + 1} of ${project.images.length}"><img src="${src}" alt="${escape(project.title === project.brand ? project.brand : project.brand + " — " + project.title)} (${escape(project.type)}), image ${i + 1}" loading="lazy" decoding="async"></figure>`).join("")}</div>${project.images.length > 1 ? '<div class="image-navigation"><button class="gallery-prev" aria-label="Previous image">↑</button><button class="gallery-next" aria-label="Next image">↓</button></div>' : ""}</section>`;
}

// Tilted, endless gallery (project.gallery === "tilt"): the images sit in a rotated grid
// that repeats in every direction and can be dragged (or scrolled) around; a click opens
// the image in a panel over the dimmed grid. Pre-built as a plain grid of buttons.
export function tiltGalleryMarkup(project, escape) {
  const name = project.title === project.brand ? project.brand : `${project.brand} — ${project.title}`;
  return `<section class="tilt-gallery" aria-label="${escape(project.brand)} gallery" data-name="${escape(name)}" data-type="${escape(project.type)}"><div class="tilt-stage"><div class="tilt-layer">${project.images.map((src, i) => `<button class="tilt-tile" type="button" data-src="${src}" aria-label="Open image ${i + 1} of ${project.images.length}"><img src="${src}" alt="${escape(name)} (${escape(project.type)}), image ${i + 1}" loading="${i < 6 ? "eager" : "lazy"}" decoding="async" draggable="false"></button>`).join("")}</div></div><p class="tilt-hint" aria-hidden="true">drag to explore · click to open</p></section>`;
}

function bindTilt(root) {
  const stage = root.querySelector(".tilt-stage"),
    layer = root.querySelector(".tilt-layer");
  const originals = [...layer.querySelectorAll(".tilt-tile")];
  const N = originals.length,
    ANGLE = (-9 * Math.PI) / 180;
  const rows = N > 6 ? 2 : 1,
    cols = Math.ceil(N / rows);
  let tile = 0,
    gap = 0,
    blockW = 0,
    blockH = 0,
    ox = 0,
    oy = 0,
    vx = 0,
    vy = 0,
    raf = 0;
  // Three-by-three copies of one block; the extra copies are decoration only.
  const build = () => {
    layer.replaceChildren();
    for (let by = -1; by <= 1; by++)
      for (let bx = -1; bx <= 1; bx++)
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++) {
            const src = originals[(r * cols + c) % N];
            const el = src.cloneNode(true);
            const main = bx === 0 && by === 0;
            if (!main) {
              el.tabIndex = -1;
              el.setAttribute("aria-hidden", "true");
              el.querySelector("img").alt = "";
              el.querySelector("img").loading = "lazy";
            }
            el.dataset.cell = `${bx},${by},${r},${c}`;
            el.dataset.col = (bx * cols + c) + "";
            el.dataset.row = (by * rows + r) + "";
            layer.append(el);
          }
  };
  const layout = () => {
    tile = Math.max(150, Math.min(300, innerWidth * (innerWidth < 700 ? 0.42 : 0.2)));
    gap = Math.round(tile * 0.06);
    blockW = cols * (tile + gap);
    blockH = rows * (tile + gap);
    layer.style.setProperty("--tile", tile + "px");
    layer.style.setProperty("--gap", gap + "px");
    layer.style.width = blockW * 3 + "px";
    layer.style.height = blockH * 3 + "px";
    layer.querySelectorAll(".tilt-tile").forEach((el) => {
      el.style.left = (+el.dataset.col + cols) * (tile + gap) + "px";
      el.style.top = (+el.dataset.row + rows) * (tile + gap) + "px";
    });
    place();
  };
  const place = () => {
    // Wrap the offset into one block so the repeat is seamless.
    ox = ((ox % blockW) + blockW) % blockW;
    oy = ((oy % blockH) + blockH) % blockH;
    layer.style.transform = `translate3d(${-blockW - ox + stage.clientWidth / 2 - blockW / 2}px,${-blockH - oy + stage.clientHeight / 2 - blockH / 2}px,0)`;
  };
  build();
  layout();
  // Screen movement → layer movement through the stage's rotation.
  const toLayer = (dx, dy) => [
    dx * Math.cos(ANGLE) + dy * Math.sin(ANGLE),
    -dx * Math.sin(ANGLE) + dy * Math.cos(ANGLE),
  ];
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const glide = () => {
    raf = 0;
    ox -= vx;
    oy -= vy;
    vx *= 0.94;
    vy *= 0.94;
    place();
    if (Math.abs(vx) + Math.abs(vy) > 0.15) raf = requestAnimationFrame(glide);
  };
  let drag = null,
    moved = 0;
  const down = (e) => {
    if (e.button > 0) return;
    cancelAnimationFrame(raf);
    raf = 0;
    drag = { x: e.clientX, y: e.clientY, t: performance.now() };
    moved = 0;
    vx = vy = 0;
  };
  const move = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 6 && !stage.hasPointerCapture(e.pointerId)) {
      stage.setPointerCapture(e.pointerId);
      stage.classList.add("dragging");
    }
    const [lx, ly] = toLayer(dx, dy);
    ox -= lx;
    oy -= ly;
    vx = lx * 0.6 + vx * 0.4;
    vy = ly * 0.6 + vy * 0.4;
    drag.x = e.clientX;
    drag.y = e.clientY;
    place();
  };
  const up = (e) => {
    if (!drag) return;
    drag = null;
    stage.classList.remove("dragging");
    if (moved <= 6) {
      const t = document.elementFromPoint(e.clientX, e.clientY)?.closest(".tilt-tile");
      if (t) open(t);
    } else if (!reduce()) raf = requestAnimationFrame(glide);
  };
  const wheel = (e) => {
    // Scrolling the page past the gallery stays natural when the cursor is not over it.
    e.preventDefault();
    const [lx, ly] = toLayer(e.deltaX, e.deltaY);
    ox += lx;
    oy += ly;
    place();
  };
  stage.addEventListener("pointerdown", down);
  stage.addEventListener("pointermove", move);
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", up);
  stage.addEventListener("wheel", wheel, { passive: false });
  const keys = (e) => {
    if (e.target.closest(".tilt-panel")) return;
    const step = tile * 0.8;
    const k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!k) return;
    e.preventDefault();
    const [lx, ly] = toLayer(k[0], k[1]);
    ox += lx;
    oy += ly;
    place();
  };
  root.addEventListener("keydown", keys);
  window.addEventListener("resize", layout);

  // The panel.
  let panel = null,
    opener = null;
  const close = () => {
    if (!panel) return;
    const p = panel;
    panel = null;
    p.classList.remove("is-open");
    root.classList.remove("has-panel");
    setTimeout(() => p.remove(), 300);
    opener?.focus();
  };
  function open(tileEl) {
    if (panel) return;
    opener = tileEl;
    const img = tileEl.querySelector("img");
    const index = originals.findIndex((o) => o.dataset.src === tileEl.dataset.src) + 1;
    panel = document.createElement("div");
    panel.className = "tilt-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", `${root.dataset.name}, image ${index}`);
    panel.innerHTML = `<div class="tilt-card"><img src="${tileEl.dataset.src}" alt="${img.alt.replace(/"/g, "&quot;")}"><div class="tilt-info"><span>SG-${String(index).padStart(2, "0")}</span><h2></h2><p></p><button type="button" class="tilt-close">Close</button></div></div>`;
    panel.querySelector("h2").textContent = root.dataset.name;
    panel.querySelector("p").textContent = root.dataset.type;
    root.append(panel);
    root.classList.add("has-panel");
    requestAnimationFrame(() => panel.classList.add("is-open"));
    panel.querySelector(".tilt-close").focus();
    panel.addEventListener("click", (e) => {
      if (e.target === panel || e.target.closest(".tilt-close")) close();
    });
  }
  const esc = (e) => {
    if (e.key === "Escape" && panel) {
      e.stopPropagation();
      close();
    }
  };
  window.addEventListener("keydown", esc, true);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", layout);
    window.removeEventListener("keydown", esc, true);
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
  main.querySelectorAll(".tilt-gallery").forEach((root) => clean.push(bindTilt(root)));
  return () => clean.forEach((fn) => fn());
}
