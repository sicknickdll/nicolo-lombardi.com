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

// Showcase gallery (project.gallery === "showcase"): the images float in 3D on a black
// stage and can be rearranged into different "looks" (list, grid, ring, coverflow, helix,
// stack) with the buttons or the number keys. Drag or scroll to move through them; a click
// opens an image with a counter, previous / next / close and a thumbnail strip.
const LOOKS = ["list", "grid", "ring", "coverflow", "helix", "stack"];
export function showcaseMarkup(project, escape) {
  const name = project.title === project.brand ? project.brand : `${project.brand} — ${project.title}`;
  const n = project.images.length;
  return `<section class="showcase" aria-label="${escape(project.brand)} gallery" data-name="${escape(project.brand)}" data-type="${escape(project.type)}"><h2 class="showcase-title">${escape(project.brand)}<br>Gallery</h2><div class="showcase-stage">${project.images.map((src, i) => `<button class="showcase-item" type="button" data-i="${i}" aria-label="Open image ${i + 1} of ${n}"><img src="${src}" alt="${escape(name)} (${escape(project.type)}), image ${i + 1}" loading="${i < 6 ? "eager" : "lazy"}" decoding="async" draggable="false"><span>${String(i).padStart(2, "0")}</span></button>`).join("")}</div><div class="showcase-looks" role="group" aria-label="Gallery look">${LOOKS.map((l, i) => `<button type="button" data-look="${l}" aria-pressed="${i === 0}"><i>${i + 1}</i> ${l}</button>`).join("")}</div></section>`;
}

function bindShowcase(root) {
  const stage = root.querySelector(".showcase-stage");
  const items = [...stage.querySelectorAll(".showcase-item")];
  const lookButtons = [...root.querySelectorAll("[data-look]")];
  const N = items.length;
  let look = "list",
    pos = 0,
    target = 0,
    w = 240,
    h = 270,
    raf = 0,
    settle = 0,
    viewer = null;
  const wrap = (r) => ((((r + N / 2) % N) + N) % N) - N / 2;
  const sizes = () => {
    w = Math.max(120, Math.min(280, innerWidth * (innerWidth < 700 ? 0.36 : 0.19)));
    h = w * 1.14;
    items.forEach((el) => {
      el.style.width = w + "px";
      el.style.height = h + "px";
      el.style.marginLeft = -w / 2 + "px";
      el.style.marginTop = -h / 2 + "px";
    });
  };
  // Where item `i` sits for the current look; `rel` is its distance from the focus.
  const place = (i) => {
    const rel = look === "ring" || look === "helix" ? wrap(i - pos) : i - pos;
    const ar = Math.abs(rel);
    let x = 0, y = 0, z = 0, ry = 0, rx = 0, s = 1, o = 1;
    if (look === "list") {
      x = rel * w * 0.78 + w * 0.5;
      y = -rel * w * 0.3 + h * 0.08;
      z = -ar * 40;
      ry = -34;
      rx = 5;
      s = Math.max(0.5, 1 - ar * 0.045);
      o = ar > 7 ? 0 : 1;
    } else if (look === "grid") {
      const cols = innerWidth < 700 ? 3 : Math.min(5, Math.ceil(N / 2)),
        rows = Math.ceil(N / cols),
        c = i % cols,
        r = Math.floor(i / cols),
        k = innerWidth < 700 ? 0.82 : 0.78;
      x = (c - (cols - 1) / 2) * (w * k + 14);
      y = (r - (rows - 1) / 2) * (h * k + 14);
      s = k;
    } else if (look === "ring") {
      const R = Math.max(w * 2.1, (N * w * 0.62) / (2 * Math.PI) * 1.25),
        a = (rel / N) * Math.PI * 2;
      x = Math.sin(a) * R;
      z = Math.cos(a) * R - R;
      ry = (a * 180) / Math.PI;
      o = z < -R * 1.6 ? 0.35 : 1;
    } else if (look === "coverflow") {
      const sg = Math.sign(rel);
      x = rel * w * 0.5 + sg * (ar > 0.01 ? w * 0.55 * Math.min(1, ar) : 0);
      z = -Math.min(ar, 1) * 160 - ar * 20;
      ry = -sg * 52 * Math.min(1, ar);
      o = ar > 6 ? 0 : 1;
    } else if (look === "helix") {
      const R = Math.max(w * 1.6, (N * w * 0.5) / (2 * Math.PI) * 1.2),
        a = (rel / N) * Math.PI * 2 * 1.4;
      x = Math.sin(a) * R;
      z = Math.cos(a) * R - R;
      y = rel * h * 0.28;
      ry = (a * 180) / Math.PI;
      o = ar > 5 ? 0 : 1;
    } else {
      x = rel * 10;
      y = rel * 6;
      z = -ar * 60;
      ry = rel * -3;
      s = Math.max(0.6, 1 - ar * 0.03);
      o = ar > 8 ? 0 : 1;
    }
    return { x, y, z, ry, rx, s, o, depth: z };
  };
  const draw = () => {
    items.forEach((el, i) => {
      const p = place(i);
      el.style.transform = `translate3d(${p.x}px,${p.y}px,${p.z}px) rotateY(${p.ry}deg) rotateX(${p.rx}deg) scale(${p.s})`;
      el.style.opacity = p.o;
      el.style.zIndex = Math.round(1000 + p.depth);
      el.style.pointerEvents = p.o ? "" : "none";
      el.tabIndex = p.o ? 0 : -1;
    });
  };
  const tick = () => {
    raf = 0;
    pos += (target - pos) * 0.14;
    if (Math.abs(target - pos) < 0.002) pos = target;
    draw();
    if (pos !== target) raf = requestAnimationFrame(tick);
  };
  const go = (t) => {
    target = look === "ring" || look === "helix" ? t : Math.max(0, Math.min(N - 1, t));
    if (!raf) raf = requestAnimationFrame(tick);
  };
  const snap = () => go(Math.round(target));
  const setLook = (l) => {
    look = l;
    lookButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.look === l)));
    stage.classList.add("morph");
    clearTimeout(settle);
    settle = setTimeout(() => stage.classList.remove("morph"), 1000);
    if (l !== "ring" && l !== "helix") {
      target = Math.max(0, Math.min(N - 1, Math.round(((target % N) + N) % N)));
      pos = target;
    }
    draw();
  };
  lookButtons.forEach((b) => (b.onclick = () => setLook(b.dataset.look)));
  sizes();
  draw();
  const onResize = () => (sizes(), draw());
  window.addEventListener("resize", onResize);

  // Drag / scroll to move through the images.
  let drag = null,
    moved = 0;
  stage.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    drag = { x: e.clientX, t: target };
    moved = 0;
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    moved = Math.max(moved, Math.abs(dx));
    if (moved > 6) {
      if (!stage.hasPointerCapture(e.pointerId)) stage.setPointerCapture(e.pointerId);
      if (look !== "grid" && look !== "stack") {
        target = drag.t - dx / (w * 0.7);
        if (look !== "ring" && look !== "helix") target = Math.max(-0.4, Math.min(N - 0.6, target));
        if (!raf) raf = requestAnimationFrame(tick);
      }
    }
  });
  const end = (e) => {
    if (!drag) return;
    const wasClick = moved <= 6;
    drag = null;
    if (wasClick) {
      const item = document.elementFromPoint(e.clientX, e.clientY)?.closest(".showcase-item");
      if (item) return open(+item.dataset.i);
    } else snap();
  };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  let wheelTimer = 0;
  stage.addEventListener(
    "wheel",
    (e) => {
      if (look === "grid" || look === "stack") return;
      e.preventDefault();
      target += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / 260;
      if (look !== "ring" && look !== "helix") target = Math.max(-0.4, Math.min(N - 0.6, target));
      if (!raf) raf = requestAnimationFrame(tick);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(snap, 140);
    },
    { passive: false },
  );

  // The viewer.
  const close = () => {
    if (!viewer) return;
    const v = viewer;
    viewer = null;
    v.classList.remove("is-open");
    setTimeout(() => v.remove(), 300);
    items[Math.round(((pos % N) + N) % N)]?.focus({ preventScroll: true });
  };
  function open(i) {
    i = ((i % N) + N) % N;
    const src = items[i].querySelector("img");
    if (!viewer) {
      viewer = document.createElement("div");
      viewer.className = "showcase-viewer";
      viewer.setAttribute("role", "dialog");
      viewer.setAttribute("aria-modal", "true");
      viewer.setAttribute("aria-label", `${root.dataset.name} gallery`);
      viewer.innerHTML = `<div class="sv-main"><img alt=""><div class="sv-info"><span class="sv-count"></span><h3></h3><p class="sv-type"></p><div class="sv-actions"><button type="button" data-act="prev">Prev</button><button type="button" data-act="next">Next</button><button type="button" data-act="close">Close</button></div></div></div><div class="sv-thumbs">${items.map((it, k) => `<button type="button" data-k="${k}" aria-label="Image ${k + 1}"><img src="${it.querySelector("img").src}" alt=""></button>`).join("")}</div>`;
      viewer.querySelector("h3").textContent = root.dataset.name;
      viewer.querySelector(".sv-type").textContent = root.dataset.type;
      viewer.addEventListener("click", (e) => {
        const act = e.target.closest("[data-act]")?.dataset.act,
          k = e.target.closest("[data-k]")?.dataset.k;
        if (act === "close" || e.target === viewer) close();
        else if (act) open(+viewer.dataset.i + (act === "next" ? 1 : -1));
        else if (k !== undefined) open(+k);
      });
      root.append(viewer);
      requestAnimationFrame(() => viewer.classList.add("is-open"));
      viewer.querySelector('[data-act="close"]').focus({ preventScroll: true });
    }
    viewer.dataset.i = i;
    const big = viewer.querySelector(".sv-main > img");
    big.src = src.src;
    big.alt = src.alt;
    viewer.querySelector(".sv-count").textContent = `${String(i + 1).padStart(2, "0")} / ${String(N).padStart(2, "0")}`;
    viewer.querySelectorAll(".sv-thumbs button").forEach((b, k) => b.classList.toggle("on", k === i));
    viewer.querySelector(".sv-thumbs .on")?.scrollIntoView({ block: "nearest", inline: "center" });
  }
  const keys = (e) => {
    if (viewer) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      } else if (e.key === "ArrowRight") open(+viewer.dataset.i + 1);
      else if (e.key === "ArrowLeft") open(+viewer.dataset.i - 1);
      return;
    }
    if (!root.matches(":hover, :focus-within")) return;
    const k = +e.key;
    if (k >= 1 && k <= LOOKS.length) setLook(LOOKS[k - 1]);
    else if (e.key === "ArrowRight") go(Math.round(target) + 1);
    else if (e.key === "ArrowLeft") go(Math.round(target) - 1);
  };
  window.addEventListener("keydown", keys, true);
  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(settle);
    clearTimeout(wheelTimer);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("keydown", keys, true);
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
  main.querySelectorAll(".showcase").forEach((root) => clean.push(bindShowcase(root)));
  return () => clean.forEach((fn) => fn());
}
