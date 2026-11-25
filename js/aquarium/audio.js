// Small synthesised sounds, no files. Starts on the first touch.
export function createAudio(on = true) {
  let ctx = null,
    out = null;
  const wake = () => {
    if (ctx) return ctx.state === "suspended" && ctx.resume();
    try {
      ctx = new AudioContext();
      out = ctx.createGain();
      out.gain.value = 0.22;
      out.connect(ctx.destination);
    } catch {}
  };
  const tone = (f0, f1, dur, type = "sine", vol = 1, delay = 0) => {
    const t = ctx.currentTime + delay,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  const noise = (dur, freq, vol = 0.5) => {
    const t = ctx.currentTime,
      len = (ctx.sampleRate * dur) | 0,
      buf = ctx.createBuffer(1, len, ctx.sampleRate),
      d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const s = ctx.createBufferSource(),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain();
    s.buffer = buf;
    f.type = "bandpass";
    f.frequency.value = freq;
    g.gain.value = vol;
    s.connect(f).connect(g).connect(out);
    s.start(t);
  };
  const SFX = {
    plop: () => (tone(520, 180, 0.12, "sine", 0.6), noise(0.08, 1800, 0.25)),
    eat: () => tone(300, 900, 0.07, "triangle", 0.5),
    pop: () => tone(900 + Math.random() * 500, 1800, 0.05, "sine", 0.35),
    coin: () => (tone(1320, 1320, 0.09, "triangle", 0.4), tone(1980, 1980, 0.22, "triangle", 0.35, 0.07)),
    poke: () => tone(220, 440, 0.1, "square", 0.15),
    love: () => (tone(660, 660, 0.14, "sine", 0.4), tone(880, 880, 0.24, "sine", 0.4, 0.13)),
    grr: () => noise(0.35, 380, 0.7),
    splash: () => noise(0.4, 900, 0.8),
    hatch: () => (tone(500, 1000, 0.08, "triangle", 0.4), tone(750, 1500, 0.12, "triangle", 0.4, 0.09)),
    tick: () => tone(1400, 1400, 0.02, "square", 0.08),
  };
  return {
    wake,
    get on() {
      return on;
    },
    set on(v) {
      on = v;
    },
    play(name) {
      if (!on || !ctx || ctx.state !== "running") return;
      try {
        SFX[name]?.();
      } catch {}
    },
  };
}
