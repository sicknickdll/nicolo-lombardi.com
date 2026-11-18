// The deck, laid out to be admired once the reading is over: every card in order (I to XXI),
// one at a time, as a 3D object. Drag to turn it (it keeps spinning a little, then settles
// back), move the pointer over it to tilt it under the light, flip it to see the back.
// Arrows, swipes or the keyboard go through the deck; Escape or X closes.
import { BACK, card } from "./cards.js";
import { DECK_IDS } from "./cards.js";
import { esc } from "../views.js";

export function openGallery(root, { onTurn = () => {} } = {}) {
  return new Promise((resolve) => {
    const ids = DECK_IDS.slice().sort((a, b) => card(a).number - card(b).number);
    const el = document.createElement("div");
    el.className = "tr-gallery";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "The deck");
    el.innerHTML = `<button type="button" class="trg-x" aria-label="Close">X</button>
<div class="trg-stage"><div class="trg-card"><img class="trg-front" alt="" draggable="false"><img class="trg-back" src="${BACK}" alt="" draggable="false"><span class="trg-glare"></span></div></div>
<button type="button" class="trg-prev" aria-label="Previous card">&lt;</button><button type="button" class="trg-next" aria-label="Next card">&gt;</button>
<p class="trg-caption" aria-live="polite"><b></b><span></span></p>`.replace(/\n/g, "");
    root.append(el);
    const cardEl = el.querySelector(".trg-card"),
      front = el.querySelector(".trg-front"),
      glare = el.querySelector(".trg-glare"),
      cap = el.querySelector(".trg-caption");
    let i = 0,
      rotY = 0, // degrees, from dragging
      vel = 0,
      tiltX = 0,
      tiltY = 0,
      drag = null,
      raf = 0,
      last = performance.now();
    // preload neighbours so turning is instant
    const preload = (k) => {
      const c = card(ids[(k + ids.length) % ids.length]);
      new Image().src = c.art;
    };
    function show(k, dir = 0) {
      i = (k + ids.length) % ids.length;
      const c = card(ids[i]);
      cardEl.classList.remove("in-l", "in-r");
      void cardEl.offsetWidth;
      if (dir) cardEl.classList.add(dir > 0 ? "in-r" : "in-l");
      front.src = c.art;
      front.alt = c.name;
      cap.querySelector("b").textContent = c.name;
      cap.querySelector("span").textContent = `${c.roman} · ${i + 1} of ${ids.length}`;
      rotY = 0;
      vel = dir ? dir * -120 : 0;
      preload(i + 1);
      preload(i - 1);
      onTurn();
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!drag) {
        rotY += vel * dt;
        vel *= Math.exp(-dt * 2.2);
        // settle on the nearest face once it has slowed down
        if (Math.abs(vel) < 25) {
          const target = Math.round(rotY / 180) * 180;
          rotY += (target - rotY) * (1 - Math.exp(-dt * 5));
        }
      }
      cardEl.style.transform = `rotateX(${tiltX}deg) rotateY(${rotY + tiltY}deg)`;
      const a = (((rotY % 360) + 360) % 360) * (Math.PI / 180);
      glare.style.opacity = String(0.12 + Math.abs(Math.sin(a)) * 0.25);
      glare.style.backgroundPosition = `${50 + tiltY * 3 + Math.sin(a) * 40}% ${50 - tiltX * 3}%`;
    }
    raf = requestAnimationFrame(frame);
    const stage = el.querySelector(".trg-stage");
    stage.addEventListener("pointerdown", (e) => {
      drag = { x: e.clientX, y: e.clientY, rot: rotY, t: performance.now(), lastX: e.clientX };
      stage.setPointerCapture(e.pointerId);
      vel = 0;
    });
    stage.addEventListener("pointermove", (e) => {
      const r = stage.getBoundingClientRect();
      if (!drag) {
        tiltX = ((e.clientY - r.top) / r.height - 0.5) * -14;
        tiltY = ((e.clientX - r.left) / r.width - 0.5) * 18;
        return;
      }
      const now = performance.now();
      rotY = drag.rot + (e.clientX - drag.x) * 0.6;
      vel = ((e.clientX - drag.lastX) * 0.6) / Math.max(0.008, (now - drag.t) / 1000);
      drag.t = now;
      drag.lastX = e.clientX;
    });
    const up = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y,
        quick = performance.now() - drag.t < 120;
      drag = null;
      // a fast vertical-free swipe on touch goes to the next card instead of spinning
      if (e.pointerType === "touch" && Math.abs(dx) > 90 && Math.abs(dy) < 60 && quick) (vel = 0), show(i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      else vel = Math.max(-900, Math.min(900, vel));
    };
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    stage.addEventListener("pointerleave", () => !drag && ((tiltX = 0), (tiltY = 0)));
    stage.addEventListener("dblclick", () => (vel = 420));
    el.querySelector(".trg-prev").addEventListener("click", () => show(i - 1, -1));
    el.querySelector(".trg-next").addEventListener("click", () => show(i + 1, 1));
    const close = () => {
      cancelAnimationFrame(raf);
      removeEventListener("keydown", onKey, true);
      el.classList.remove("on");
      setTimeout(() => el.remove(), 300);
      resolve();
    };
    el.querySelector(".trg-x").addEventListener("click", close);
    const onKey = (e) => {
      e.stopPropagation();
      if (e.key === "Escape") return close();
      if (e.key === "ArrowRight") show(i + 1, 1);
      if (e.key === "ArrowLeft") show(i - 1, -1);
      if (e.key === " " || e.key === "Enter") (e.preventDefault(), (vel = 420));
    };
    addEventListener("keydown", onKey, true);
    show(0);
    requestAnimationFrame(() => el.classList.add("on"));
    el.querySelector(".trg-next").focus({ preventScroll: true });
  });
}
