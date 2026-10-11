// Paint: pencil, brush, eraser, spray, fill, line, rectangle, ellipse, colours,
// sizes, undo, and "Save" to a PNG file.
const COLORS = [
  "#000000",
  "#808080",
  "#800000",
  "#808000",
  "#008000",
  "#008080",
  "#000080",
  "#800080",
  "#808040",
  "#004040",
  "#0080ff",
  "#004080",
  "#8000ff",
  "#804000",
  "#ffffff",
  "#c0c0c0",
  "#ff0000",
  "#ffff00",
  "#00ff00",
  "#00ffff",
  "#0000ff",
  "#ff00ff",
  "#ffff80",
  "#00ff80",
  "#80ffff",
  "#8080ff",
  "#ff0080",
  "#ff8040",
];
const TOOLS = [
  ["pencil", "✏️", "Pencil"],
  ["brush", "🖌️", "Brush"],
  ["eraser", "🧽", "Eraser"],
  ["spray", "💨", "Airbrush"],
  ["fill", "🪣", "Fill with colour"],
  ["picker", "💧", "Pick colour"],
  ["line", "╱", "Line"],
  ["rect", "▭", "Rectangle"],
  ["ellipse", "◯", "Ellipse"],
];

export function mount(el, api, windowEl) {
  el.innerHTML = `
    <div class="xp-menubar"><button data-act="new">File ▸ New</button><button data-act="save">Save as PNG</button><button data-act="undo">Undo</button><button data-act="help">Help</button></div>
    <div class="pt-main">
      <div class="pt-tools">${TOOLS.map(([k, ic, label]) => `<button data-tool="${k}" title="${label}" aria-label="${label}">${ic}</button>`).join("")}
        <div class="pt-sizes">${[1, 3, 6, 12].map((n) => `<button data-size="${n}" title="Size ${n}"><i style="width:${Math.min(14, n + 2)}px;height:${Math.min(14, n + 2)}px"></i></button>`).join("")}</div>
      </div>
      <div class="pt-scroll"><div class="pt-stage"><canvas class="pt-canvas" width="640" height="420"></canvas><canvas class="pt-preview" width="640" height="420"></canvas></div></div>
    </div>
    <div class="pt-palette"><div class="pt-current"><i class="pt-fg"></i><i class="pt-bg"></i></div><div class="pt-colors">${COLORS.map((c) => `<button data-color="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join("")}</div></div>
    <footer class="xp-status">Left-click: colour 1 · Right-click: colour 2 · Your drawing stays here until you close Paint</footer>`;
  const canvas = el.querySelector(".pt-canvas"),
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  const preview = el.querySelector(".pt-preview"),
    pctx = preview.getContext("2d");
  let tool = "pencil",
    size = 3,
    fg = "#000000",
    bg = "#ffffff";
  const undo = [];
  const clear = () => {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };
  clear();
  const sync = () => {
    el.querySelectorAll("[data-tool]").forEach((b) =>
      b.classList.toggle("active", b.dataset.tool === tool),
    );
    el.querySelectorAll("[data-size]").forEach((b) =>
      b.classList.toggle("active", +b.dataset.size === size),
    );
    el.querySelector(".pt-fg").style.background = fg;
    el.querySelector(".pt-bg").style.background = bg;
    preview.style.cursor = tool === "fill" || tool === "picker" ? "pointer" : "crosshair";
  };
  sync();

  el.querySelector(".pt-tools").onclick = (e) => {
    const t = e.target.closest("[data-tool]");
    if (t) tool = t.dataset.tool;
    const s = e.target.closest("[data-size]");
    if (s) size = +s.dataset.size;
    sync();
  };
  const colors = el.querySelector(".pt-colors");
  colors.onclick = (e) => {
    const c = e.target.closest("[data-color]");
    if (c) fg = c.dataset.color;
    sync();
  };
  colors.oncontextmenu = (e) => {
    const c = e.target.closest("[data-color]");
    if (!c) return;
    e.preventDefault();
    bg = c.dataset.color;
    sync();
  };

  const pos = (e) => {
    const r = preview.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  };
  const pushUndo = () => {
    undo.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undo.length > 25) undo.shift();
  };
  const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

  function floodFill(x, y, color) {
    x |= 0;
    y |= 0;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height),
      d = img.data,
      w = canvas.width,
      h = canvas.height;
    const at = (px, py) => (py * w + px) * 4;
    const start = d.slice(at(x, y), at(x, y) + 4);
    const [r, g, b] = hexToRgb(color);
    // Same (or nearly the same) colour: nothing to do — also prevents an endless fill.
    if (Math.abs(start[0] - r) + Math.abs(start[1] - g) + Math.abs(start[2] - b) < 40) return;
    const same = (i) =>
      Math.abs(d[i] - start[0]) + Math.abs(d[i + 1] - start[1]) + Math.abs(d[i + 2] - start[2]) <
      40;
    const stack = [[x, y]];
    while (stack.length) {
      const [px, py] = stack.pop();
      let lx = px;
      while (lx >= 0 && same(at(lx, py))) lx--;
      lx++;
      let up = false,
        down = false;
      for (let cx = lx; cx < w && same(at(cx, py)); cx++) {
        const i = at(cx, py);
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
        d[i + 3] = 255;
        if (py > 0) {
          const s = same(at(cx, py - 1));
          if (s && !up) stack.push([cx, py - 1]);
          up = s;
        }
        if (py < h - 1) {
          const s = same(at(cx, py + 1));
          if (s && !down) stack.push([cx, py + 1]);
          down = s;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  let drawing = null;
  preview.addEventListener("contextmenu", (e) => e.preventDefault());
  preview.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    preview.setPointerCapture(e.pointerId);
    const p = pos(e),
      color = e.button === 2 ? bg : fg;
    if (tool === "picker") {
      const [r, g, b] = ctx.getImageData(p.x | 0, p.y | 0, 1, 1).data;
      fg = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
      tool = "pencil";
      return sync();
    }
    pushUndo();
    if (tool === "fill") return floodFill(p.x, p.y, color);
    drawing = { start: p, last: p, color };
    paintAt(p, p);
  });
  preview.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = pos(e);
    paintAt(drawing.last, p);
    drawing.last = p;
  });
  const finish = () => {
    if (!drawing) return;
    if (["line", "rect", "ellipse"].includes(tool)) {
      shape(ctx, drawing.start, drawing.last, drawing.color);
      pctx.clearRect(0, 0, preview.width, preview.height);
    }
    drawing = null;
  };
  preview.addEventListener("pointerup", finish);
  preview.addEventListener("pointercancel", finish);

  function shape(c, a, b, color) {
    c.strokeStyle = color;
    c.lineWidth = size;
    c.lineCap = "round";
    c.beginPath();
    if (tool === "line") {
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
    } else if (tool === "rect") c.rect(a.x, a.y, b.x - a.x, b.y - a.y);
    else
      c.ellipse(
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
        Math.abs(b.x - a.x) / 2,
        Math.abs(b.y - a.y) / 2,
        0,
        0,
        Math.PI * 2,
      );
    c.stroke();
  }
  function paintAt(a, b) {
    const color = tool === "eraser" ? "#ffffff" : drawing.color;
    if (["line", "rect", "ellipse"].includes(tool)) {
      pctx.clearRect(0, 0, preview.width, preview.height);
      return shape(pctx, drawing.start, b, color);
    }
    if (tool === "spray") {
      ctx.fillStyle = color;
      for (let i = 0; i < size * 4; i++) {
        const ang = Math.random() * Math.PI * 2,
          rad = Math.random() * size * 3;
        ctx.fillRect(b.x + Math.cos(ang) * rad, b.y + Math.sin(ang) * rad, 1, 1);
      }
      return;
    }
    ctx.strokeStyle = color;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.lineWidth =
      tool === "pencil" ? Math.max(1, size / 2) : tool === "eraser" ? size * 3 : size * 1.6;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x + 0.01, b.y);
    ctx.stroke();
  }

  el.querySelector(".xp-menubar").onclick = (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "new") {
      pushUndo();
      clear();
    }
    if (act === "undo" && undo.length) ctx.putImageData(undo.pop(), 0, 0);
    if (act === "save") {
      const a = document.createElement("a");
      a.download = "my-masterpiece.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    }
    if (act === "help")
      api.messageBox(
        "Paint",
        "Pick a tool on the left and a colour at the bottom.<br>Right-click a colour to set colour 2 (used with the right mouse button).",
        "paint",
      );
  };
  const keys = (e) => {
    if (!el.isConnected) return window.removeEventListener("keydown", keys);
    if (
      windowEl.classList.contains("focused") &&
      (e.ctrlKey || e.metaKey) &&
      e.key === "z" &&
      undo.length
    ) {
      e.preventDefault();
      ctx.putImageData(undo.pop(), 0, 0);
    }
  };
  window.addEventListener("keydown", keys);
}
