// Klondike Solitaire (draw one). Drag cards with mouse or finger; double-click
// (or double-tap) a card to send it to the foundations; click the deck to draw.
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const red = (c) => c.suit === 1 || c.suit === 2;

export function mount(el, api, windowEl) {
  el.innerHTML = `<div class="xp-menubar"><button data-act="deal">Game ▸ Deal</button><button data-act="undo">Undo</button><button data-act="help">Help</button></div><div class="sol-table"></div><footer class="xp-status"><span class="sol-score"></span><span class="sol-time"></span></footer>`;
  const table = el.querySelector(".sol-table");
  let s, history, moves, started, timer;

  function deal() {
    const deck = [];
    for (let suit = 0; suit < 4; suit++)
      for (let rank = 0; rank < 13; rank++) deck.push({ suit, rank, up: false });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    s = { stock: [], waste: [], found: [[], [], [], []], tab: [[], [], [], [], [], [], []] };
    for (let c = 0; c < 7; c++)
      for (let r = 0; r <= c; r++) {
        const card = deck.pop();
        card.up = r === c;
        s.tab[c].push(card);
      }
    s.stock = deck;
    history = [];
    moves = 0;
    started = Date.now();
    clearInterval(timer);
    timer = setInterval(() => (el.isConnected ? status() : clearInterval(timer)), 1000);
    render();
  }
  const snapshot = () => history.push(JSON.stringify(s));
  const status = () => {
    el.querySelector(".sol-score").textContent = `Moves: ${moves}`;
    const t = Math.floor((Date.now() - started) / 1000);
    el.querySelector(".sol-time").textContent =
      `Time: ${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  };

  // Layout depends on the window size.
  let L;
  function layout() {
    const W = table.clientWidth,
      gap = Math.max(6, W * 0.015);
    const cw = Math.min(80, (W - gap * 8) / 7),
      ch = cw * 1.4;
    L = {
      cw,
      ch,
      gap,
      col: (i) => gap + i * (cw + gap),
      top: gap,
      tabTop: gap * 2 + ch,
      fan: Math.max(14, ch * 0.22),
      fanDown: Math.max(6, ch * 0.09),
    };
  }
  const cardHTML = (c) =>
    c.up
      ? `<span class="sol-c ${red(c) ? "red" : ""}"><b>${RANKS[c.rank]}<i>${SUITS[c.suit]}</i></b><em>${SUITS[c.suit]}</em><b class="sol-flip">${RANKS[c.rank]}<i>${SUITS[c.suit]}</i></b></span>`
      : `<span class="sol-back"></span>`;

  function render() {
    layout();
    table.innerHTML = "";
    const slot = (x, y, cls, attrs = "") => {
      const d = document.createElement("div");
      d.className = `sol-slot ${cls}`;
      Object.assign(d.style, {
        left: x + "px",
        top: y + "px",
        width: L.cw + "px",
        height: L.ch + "px",
      });
      d.innerHTML = attrs;
      table.append(d);
      return d;
    };
    slot(L.col(0), L.top, "sol-stock-slot", s.stock.length ? "" : "↻").dataset.pile = "stock";
    for (let f = 0; f < 4; f++)
      slot(L.col(3 + f), L.top, "sol-found-slot", SUITS[f]).dataset.pile = `found-${f}`;
    for (let c = 0; c < 7; c++) slot(L.col(c), L.tabTop, "sol-tab-slot").dataset.pile = `tab-${c}`;
    const place = (card, x, y, pile, index) => {
      const d = document.createElement("div");
      d.className = "sol-card";
      Object.assign(d.style, {
        left: x + "px",
        top: y + "px",
        width: L.cw + "px",
        height: L.ch + "px",
        fontSize: L.cw * 0.2 + "px",
      });
      d.innerHTML = cardHTML(card);
      d.dataset.pile = pile;
      d.dataset.index = index;
      table.append(d);
    };
    if (s.stock.length) place({ up: false }, L.col(0), L.top, "stock", s.stock.length - 1);
    s.waste
      .slice(-3)
      .forEach((c, i, arr) =>
        place(c, L.col(1) + i * L.cw * 0.18, L.top, "waste", s.waste.length - arr.length + i),
      );
    s.found.forEach(
      (p, f) => p.length && place(p.at(-1), L.col(3 + f), L.top, `found-${f}`, p.length - 1),
    );
    s.tab.forEach((p, c) => {
      let y = L.tabTop;
      p.forEach((card, i) => {
        place(card, L.col(c), y, `tab-${c}`, i);
        y += card.up ? L.fan : L.fanDown;
      });
    });
    status();
    if (s.found.every((p) => p.length === 13)) celebrate();
  }

  const pileOf = (name) => {
    const [kind, n] = name.split("-");
    return kind === "found" ? s.found[n] : kind === "tab" ? s.tab[n] : s[kind];
  };
  const canDrop = (cards, target) => {
    const [kind, n] = target.split("-");
    const first = cards[0];
    if (kind === "found") {
      if (cards.length !== 1) return false;
      const p = s.found[n];
      return p.length
        ? p.at(-1).suit === first.suit && p.at(-1).rank === first.rank - 1
        : first.rank === 0;
    }
    if (kind === "tab") {
      const p = s.tab[n];
      if (!p.length) return first.rank === 12;
      const top = p.at(-1);
      return top.up && red(top) !== red(first) && top.rank === first.rank + 1;
    }
    return false;
  };
  function move(from, index, to) {
    snapshot();
    const src = pileOf(from);
    const cards = src.splice(index);
    pileOf(to).push(...cards);
    if (from.startsWith("tab") && src.length && !src.at(-1).up) src.at(-1).up = true;
    moves++;
    render();
  }
  function autoFound(from, index) {
    const src = pileOf(from);
    if (index !== src.length - 1) return false;
    for (let f = 0; f < 4; f++)
      if (canDrop([src[index]], `found-${f}`)) {
        move(from, index, `found-${f}`);
        return true;
      }
    return false;
  }

  // Drag and drop with pointer events.
  let drag = null,
    lastTap = { t: 0, key: "" };
  table.addEventListener("pointerdown", (e) => {
    const cardEl = e.target.closest(".sol-card"),
      slotEl = e.target.closest(".sol-slot");
    if ((cardEl?.dataset.pile || slotEl?.dataset.pile) === "stock") {
      snapshot();
      if (s.stock.length) {
        const c = s.stock.pop();
        c.up = true;
        s.waste.push(c);
      } else {
        s.stock = s.waste.reverse().map((c) => ({ ...c, up: false }));
        s.waste = [];
      }
      moves++;
      return render();
    }
    if (!cardEl) return;
    const pile = cardEl.dataset.pile,
      index = +cardEl.dataset.index;
    const src = pileOf(pile);
    if (!src[index]?.up) return;
    if (pile === "waste" && index !== s.waste.length - 1) return;
    // Double-click / double-tap → foundation.
    const key = pile + index,
      now = Date.now();
    if (lastTap.key === key && now - lastTap.t < 380) {
      lastTap = { t: 0, key: "" };
      if (autoFound(pile, index)) return;
    }
    lastTap = { t: now, key };
    const els = [...table.querySelectorAll(`.sol-card[data-pile="${pile}"]`)].filter(
      (d) => +d.dataset.index >= index,
    );
    drag = {
      pile,
      index,
      els,
      x: e.clientX,
      y: e.clientY,
      origin: els.map((d) => [d.offsetLeft, d.offsetTop]),
      moved: false,
    };
    els.forEach((d) => d.classList.add("dragging"));
    table.setPointerCapture(e.pointerId);
  });
  table.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    drag.els.forEach((d, i) => {
      d.style.left = drag.origin[i][0] + dx + "px";
      d.style.top = drag.origin[i][1] + dy + "px";
    });
  });
  table.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.moved) return render();
    const cards = pileOf(d.pile).slice(d.index);
    const r = table.getBoundingClientRect(),
      x = e.clientX - r.left,
      y = e.clientY - r.top;
    const targets = [...Array(4)]
      .map((_, f) => `found-${f}`)
      .concat([...Array(7)].map((_, c) => `tab-${c}`));
    const hit = targets.find((t) => {
      const [kind, n] = t.split("-");
      const left = L.col(kind === "found" ? 3 + +n : +n);
      const top = kind === "found" ? L.top : L.tabTop;
      return (
        x >= left - L.gap / 2 &&
        x <= left + L.cw + L.gap / 2 &&
        y >= top - 10 &&
        (kind === "found" ? y <= top + L.ch : true)
      );
    });
    if (hit && hit !== d.pile && canDrop(cards, hit)) move(d.pile, d.index, hit);
    else render();
  });

  function celebrate() {
    clearInterval(timer);
    const t = Math.floor((Date.now() - started) / 1000);
    table.classList.add("sol-won");
    setTimeout(
      () =>
        api.messageBox(
          "Solitaire",
          `🎉 You won in ${moves} moves and ${Math.floor(t / 60)}m ${t % 60}s!<br>Game ▸ Deal to play again.`,
          "cards",
        ),
      400,
    );
  }

  el.querySelector(".xp-menubar").onclick = (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "deal") {
      table.classList.remove("sol-won");
      deal();
    }
    if (act === "undo" && history.length) {
      s = JSON.parse(history.pop());
      render();
    }
    if (act === "help")
      api.messageBox(
        "Solitaire",
        "Build the four piles at the top from Ace to King, one suit each.<br>On the table, stack cards down in alternating colours. Only Kings go in empty spaces.<br>Double-click a card to send it up.",
        "cards",
      );
  };
  windowEl.addEventListener("xp-resize", () => requestAnimationFrame(render));
  new ResizeObserver(() => s && render()).observe(table);
  deal();
}
