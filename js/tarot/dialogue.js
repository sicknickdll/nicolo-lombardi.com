// Her voice: lines typed out at the bottom of the screen, retro-game style.
// A click, a tap, Enter or Space first finishes the line being typed, then moves to the next.
// Each line can carry cues (eyes, a gesture, a sound, a pause before it, a reaction of the room);
// onCue runs them as the line starts. A screen reader gets each line whole, once.
export function createDialogue(root, { onCue = () => {}, onType = () => {}, reduce = false } = {}) {
  const box = root.querySelector(".tr-dialogue"),
    text = box.querySelector(".tr-text"),
    more = box.querySelector(".tr-more"),
    live = root.querySelector(".tr-live");
  let typing = null, // { full, i, timer, done }
    waiting = null, // resolve() of the current line
    token = 0,
    current = "", // her line being said (put back after a remark)
    lineNo = 0;

  const norm = (l) => (typeof l === "string" ? { t: l } : l);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function type(full) {
    return new Promise((resolve) => {
      text.textContent = "";
      more.hidden = true;
      const chars = [...full];
      let i = 0;
      const step = () => {
        if (typing !== me) return; // a newer line took over
        if (i >= chars.length) return finish();
        const ch = chars[i++];
        text.textContent += ch;
        if (i % 2 === 0 && ch.trim()) onType();
        const base = reduce ? 6 : 26;
        const pause = ".?!".includes(ch) ? (chars[i] === "." ? 60 : 240) : ch === "," || ch === ";" || ch === ":" ? 110 : ch === "…" ? 300 : 0;
        typing.timer = setTimeout(step, base + pause);
      };
      const finish = () => {
        if (typing !== me) return resolve();
        clearTimeout(typing.timer);
        text.textContent = full;
        typing = null;
        more.hidden = false;
        resolve();
      };
      const me = (typing = { full, finish, timer: 0 });
      step();
    });
  }

  // Shows lines one after another; resolves once the last one is acknowledged.
  async function say(lines, { hold = false } = {}) {
    const my = ++token;
    if (typing) typing.finish(); // an older line still typing: let it end (its say() then stops)
    if (waiting) (waiting(), (waiting = null));
    box.hidden = false;
    box.classList.add("on");
    for (const raw of lines) {
      const line = norm(raw);
      if (my !== token) return;
      if (line.pause) {
        text.textContent = "";
        more.hidden = true;
        await sleep(reduce ? Math.min(300, line.pause) : line.pause);
      }
      if (my !== token) return;
      onCue(line);
      current = line.t;
      lineNo++;
      live.textContent = line.t;
      await type(line.t);
      if (my !== token) return;
      await new Promise((r) => (waiting = r));
      waiting = null;
    }
    if (!hold && my === token) clear();
  }
  function clear() {
    current = "";
    text.textContent = "";
    more.hidden = true;
    box.classList.remove("on");
  }
  // A click / key: finish typing, or move on. Returns true if the dialogue used it.
  function advance() {
    if (typing) return typing.finish(), true;
    if (waiting) return waiting(), true;
    return false;
  }
  // A remark over whatever she was saying: it takes the same line for a moment, then her line
  // comes back (unless she has moved on meanwhile).
  // Remarks wait their turn (one at a time). Her own line is put back whole afterwards, unless
  // she has already moved on to the next one.
  let chain = Promise.resolve();
  function interject(t, ms = 2000) {
    return (chain = chain.then(async () => {
      if (typing) typing.finish();
      const n = lineNo;
      box.classList.add("on", "aside");
      text.textContent = t;
      live.textContent = t;
      await sleep(ms);
      if (lineNo !== n) return; // a new line has taken over
      box.classList.remove("aside");
      text.textContent = current;
      if (!current && !waiting) box.classList.remove("on");
    }));
  }
  return {
    say,
    interject,
    advance,
    clear,
    // stop whatever is being said (leaving the page, restarting)
    cancel() {
      token++;
      if (typing) (clearTimeout(typing.timer), (typing = null));
      waiting?.();
      waiting = null;
      clear();
    },
    get active() {
      return Boolean(typing || waiting);
    },
  };
}
