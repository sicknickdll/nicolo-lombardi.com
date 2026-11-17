// The reading, written down: an overlay with the guiding card, the five cards of the cross, what
// each one said and the closing story. From it the reading can be kept on this device, saved
// as an image (drawn on a canvas, same-origin art only) or printed.
import { esc } from "../views.js";

const SAVED = "nl-tarot-saved";
const ROMAN = ["I", "II", "III", "IV", "V"];
const fmtDate = (t) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export function savedReadings() {
  try {
    return JSON.parse(localStorage.getItem(SAVED)) || [];
  } catch {
    return [];
  }
}
// Keeps the reading (the cards and every text, exactly as she said them). Returns true if stored.
export function keepReading(sum) {
  try {
    const list = savedReadings().filter((r) => r.seed !== sum.seed || r.guiding.id !== sum.guiding.id);
    list.unshift({ ...sum, savedAt: Date.now() });
    localStorage.setItem(SAVED, JSON.stringify(list.slice(0, 12)));
    return true;
  } catch {
    return false;
  }
}

export function summaryMarkup(sum, { note = "" } = {}) {
  const fig = (c, alt) => `<figure><img src="${c.art}" alt="${esc(alt)}" width="720" height="1280" loading="lazy" decoding="async"></figure>`;
  const kw = (k) => `<p class="trs-kw">${k.map(esc).join(" · ")}</p>`;
  return `<div class="trs-inner">
<button type="button" class="trs-x" data-act="close" aria-label="Close">X</button><header class="trs-head"><p class="trs-kicker">The Tarot Reader · ${esc(fmtDate(sum.savedAt || sum.at || Date.now()))}</p><h2 class="caslon" id="trs-title">Your Reading</h2>${note ? `<p class="trs-note">${esc(note)}</p>` : ""}</header>
<section class="trs-card trs-guide">${fig(sum.guiding, sum.guiding.name)}<div><p class="trs-pos">The Guiding Card</p><h3 class="caslon">${esc(sum.guiding.name)}</h3>${kw(sum.guiding.keywords)}<p>${esc(sum.guiding.text)}</p></div></section>
<ol class="trs-cross">${sum.cards
    .map(
      (c, i) =>
        `<li class="trs-card">${fig(c, c.name)}<div><p class="trs-pos">${ROMAN[i]} · ${esc(c.label)}</p><h3 class="caslon">${esc(c.name)}</h3>${kw(c.keywords)}<p>${esc(c.interpretation)}</p><p class="trs-refl">${esc(c.reflection)}</p></div></li>`,
    )
    .join("")}</ol>
<section class="trs-story"><h3 class="caslon">The Story</h3><p>${esc(sum.synthesis)}</p></section>
<footer class="trs-actions"><button type="button" data-act="keep">Save Reading</button><button type="button" data-act="image">Download Image</button><button type="button" data-act="print">Print</button><button type="button" data-act="again">Begin Again</button></footer>
</div>`;
}

// Opens the overlay; resolves with "close" or "again".
export function openSummary(root, sum, { note = "", onKeep } = {}) {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "tr-summary";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "trs-title");
    el.innerHTML = summaryMarkup(sum, { note });
    root.append(el);
    const prev = document.activeElement;
    requestAnimationFrame(() => el.classList.add("on"));
    el.querySelector("[data-act='close']").focus({ preventScroll: true });
    const status = (msg) => {
      let p = el.querySelector(".trs-note");
      if (!p) {
        p = document.createElement("p");
        p.className = "trs-note";
        el.querySelector(".trs-head").append(p);
      }
      p.textContent = msg;
    };
    const done = (how) => {
      el.classList.remove("on");
      removeEventListener("keydown", onKey, true);
      setTimeout(() => el.remove(), 300);
      prev?.focus?.({ preventScroll: true });
      resolve(how);
    };
    const onKey = (e) => {
      if (e.key === "Escape") (e.preventDefault(), e.stopPropagation(), done("close"));
    };
    addEventListener("keydown", onKey, true);
    el.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const act = b.dataset.act;
      if (act === "close") return done("close");
      if (act === "again") return done("again");
      if (act === "keep") {
        const ok = keepReading(sum);
        if (ok) onKeep?.();
        return status(ok ? "Saved on this device. It will be here when you come back." : "This browser won't let me keep it. Try Download Image.");
      }
      if (act === "print") return window.print();
      if (act === "image") {
        b.disabled = true;
        try {
          await downloadImage(sum);
          status("The image is on its way to your downloads.");
        } catch {
          status("The image couldn't be made here. Try Print instead.");
        }
        b.disabled = false;
      }
    });
  });
}

// ── the reading as one tall image ──
const loadImg = (src) =>
  new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
function wrap(g, text, x, y, maxW, lh) {
  const words = text.split(/\s+/);
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y);
      y += lh;
      line = w;
    } else line = test;
  }
  if (line) g.fillText(line, x, y), (y += lh);
  return y;
}
export async function renderImage(sum) {
  await Promise.all([document.fonts?.load?.('40px "Caslon Antique"'), document.fonts?.load?.('20px "Caslon Antique"')].filter(Boolean)).catch(() => {});
  const W = 1500,
    serif = '"Caslon Antique", Georgia, serif';
  const imgs = await Promise.all([sum.guiding, ...sum.cards].map((c) => loadImg(c.art).catch(() => null)));
  // measure the text first, to know how tall the image is
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = `30px ${serif}`;
  const lines = (t, w, font) => {
    probe.font = font;
    let n = 0,
      line = "";
    for (const word of t.split(/\s+/)) {
      const test = line ? line + " " + word : word;
      if (probe.measureText(test).width > w && line) (n++, (line = word));
      else line = test;
    }
    return n + 1;
  };
  const textW = W - 200;
  const crossBottom = 250 + Math.round(230 / 0.5625) * 3 + 160 + 130;
  let H = crossBottom + lines(sum.synthesis, textW, `30px ${serif}`) * 44 + 120;
  for (const c of sum.cards) H += 70 + lines(c.interpretation, textW - 40, `24px ${serif}`) * 34 + 30;
  H += 140;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d");
  const bg = g.createRadialGradient(W / 2, 700, 100, W / 2, 700, W);
  bg.addColorStop(0, "#2a0a0e");
  bg.addColorStop(1, "#070407");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(210,154,88,0.45)";
  g.lineWidth = 2;
  g.strokeRect(30, 30, W - 60, H - 60);
  g.textAlign = "center";
  g.fillStyle = "#d29a58";
  g.font = `64px ${serif}`;
  g.fillText("The Tarot Reader", W / 2, 130);
  g.fillStyle = "rgba(200,170,122,0.8)";
  g.font = `24px ${serif}`;
  g.fillText(fmtDate(sum.savedAt || Date.now()), W / 2, 172);
  // the cross, with the guiding card beside it
  const cw = 230,
    ch = Math.round(cw / 0.5625),
    cx = W / 2 + 140,
    cy = 250 + ch * 1.5 + 80,
    gap = 40,
    vgap = 80; // room for the labels under the middle row
  const spots = {
    past: [cx - cw - gap, cy],
    present: [cx, cy],
    future: [cx + cw + gap, cy],
    shadow: [cx, cy + ch + vgap],
    potential: [cx, cy - ch - vgap],
  };
  const drawCard = (img, x, y, label, name, below = true) => {
    g.save();
    g.shadowColor = "rgba(0,0,0,0.6)";
    g.shadowBlur = 24;
    if (img) g.drawImage(img, x - cw / 2, y - ch / 2, cw, ch);
    else (g.fillStyle = "#c8aa7a"), g.fillRect(x - cw / 2, y - ch / 2, cw, ch);
    g.restore();
    // labels beside the cards of the middle column, under the others
    const lx = below ? x : x + cw / 2 + 24,
      ly = below ? y + ch / 2 + 32 : y - 10;
    g.textAlign = below ? "center" : "left";
    g.fillStyle = "rgba(200,170,122,0.85)";
    g.font = `20px ${serif}`;
    g.fillText(label.toUpperCase(), lx, ly);
    g.fillStyle = "#e8d6b0";
    g.font = `26px ${serif}`;
    g.fillText(name, lx, ly + 30);
  };
  sum.cards.forEach((c, i) => {
    const [x, y] = spots[c.position];
    drawCard(imgs[i + 1], x, y, c.label, c.name, c.position !== "shadow" && c.position !== "potential");
  });
  drawCard(imgs[0], 210, cy, "The Guiding Card", sum.guiding.name);
  let y = cy + ch * 1.5 + vgap + 130;
  g.textAlign = "left";
  g.fillStyle = "#d29a58";
  g.font = `40px ${serif}`;
  g.fillText("The Story", 100, y - 40);
  g.fillStyle = "#e8d6b0";
  g.font = `30px ${serif}`;
  y = wrap(g, sum.synthesis, 100, y + 10, textW, 44) + 50;
  for (const [i, c] of sum.cards.entries()) {
    g.fillStyle = "#d29a58";
    g.font = `28px ${serif}`;
    g.fillText(`${ROMAN[i]} · ${c.label} · ${c.name}`, 100, y);
    g.fillStyle = "rgba(232,214,176,0.85)";
    g.font = `24px ${serif}`;
    y = wrap(g, c.interpretation, 120, y + 40, textW - 40, 34) + 30;
  }
  g.textAlign = "center";
  g.fillStyle = "rgba(200,170,122,0.6)";
  g.font = `20px ${serif}`;
  g.fillText("nicolo-lombardi.com/archive/tarot/", W / 2, H - 60);
  return cv;
}
export async function downloadImage(sum) {
  const cv = await renderImage(sum);
  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  if (!blob) throw new Error("no image");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tarot-reading-${new Date(sum.savedAt || Date.now()).toISOString().slice(0, 10)}.png`;
  document.body.append(a);
  a.click();
  setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1000);
}
