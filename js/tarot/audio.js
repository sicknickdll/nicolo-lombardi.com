// The Tarot Reader's sound, synthesised with the Web Audio API (no files to load, so nothing can
// go missing): a low room drone, candle crackle, card sounds, a few restrained stingers and a
// quiet tick for her typing. Starts only after a click or key press (browser autoplay rules).
// Mute is remembered.
const KEY = "nl-tarot-muted";

export function createAudio() {
  let ctx = null,
    master = null,
    verb = null,
    noiseBuf = null,
    crackle = 0,
    started = false;
  let muted = false;
  try {
    muted = localStorage.getItem(KEY) === "1";
  } catch {}

  function unlock() {
    if (started) return ctx?.resume?.();
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    started = true;
    try {
      ctx = new AC();
    } catch {
      return;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    master.connect(comp).connect(ctx.destination);
    // white noise, reused by every noisy sound
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // a small dark room: convolution with decaying noise
    verb = ctx.createConvolver();
    const ir = ctx.createBuffer(2, ctx.sampleRate * 1.8, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length) ** 3;
    }
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    verb.connect(wet).connect(master);
    ambience();
  }

  const now = () => ctx.currentTime;
  function env(g, t, a, peak, r) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + r);
  }
  function noise({ t = now(), dur = 0.2, type = "bandpass", f0 = 1000, f1 = f0, q = 1, gain = 0.1, a = 0.005, send = 0 }) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    env(g, t, a, gain, dur);
    src.connect(flt).connect(g).connect(master);
    if (send) g.connect(verb);
    src.start(t, Math.random() * 1.5);
    src.stop(t + a + dur + 0.05);
  }
  function tone({ t = now(), f0 = 220, f1 = f0, type = "sine", dur = 0.4, a = 0.01, gain = 0.1, send = 0, lp = 0 }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + dur);
    const g = ctx.createGain();
    env(g, t, a, gain, dur);
    let node = o.connect(g);
    if (lp) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = lp;
      g.disconnect();
      o.disconnect();
      o.connect(f).connect(g);
    }
    g.connect(master);
    if (send) g.connect(verb);
    o.start(t);
    o.stop(t + a + dur + 0.05);
    return node;
  }

  function ambience() {
    // drone: two low, slightly detuned voices through a slowly breathing filter
    const flt = ctx.createBiquadFilter();
    flt.type = "lowpass";
    flt.frequency.value = 240;
    const lfo = ctx.createOscillator(),
      lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain).connect(flt.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now());
    g.gain.exponentialRampToValueAtTime(0.05, now() + 6);
    for (const [f, type] of [
      [55, "triangle"],
      [82.6, "sine"],
      [55.4, "sawtooth"],
    ]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = type === "sawtooth" ? 0.15 : 0.5;
      o.connect(og).connect(flt);
      o.start();
    }
    flt.connect(g).connect(master);
    lfo.start();
    // room tone
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const rf = ctx.createBiquadFilter();
    rf.type = "lowpass";
    rf.frequency.value = 320;
    const rg = ctx.createGain();
    rg.gain.value = 0.018;
    src.connect(rf).connect(rg).connect(master);
    src.start();
    // candle crackle, irregular
    const tick = () => {
      crackle = setTimeout(tick, 300 + Math.random() * 2200);
      if (document.hidden) return;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) noise({ t: now() + i * 0.03 * Math.random(), dur: 0.012, f0: 2500 + Math.random() * 2500, q: 2, gain: 0.012 + Math.random() * 0.02 });
    };
    tick();
  }

  const SFX = {
    slide: () => noise({ dur: 0.32, f0: 700, f1: 2200, q: 0.8, gain: 0.07, a: 0.04 }),
    riffle: () => noise({ dur: 0.02, f0: 3200 + Math.random() * 1500, q: 1.5, gain: 0.06 }),
    spread: () => {
      for (let i = 0; i < 18; i++) noise({ t: now() + i * 0.05 + Math.random() * 0.02, dur: 0.03, f0: 2200 + Math.random() * 1800, q: 1.2, gain: 0.04 });
    },
    tap: () => (tone({ f0: 140, f1: 70, dur: 0.09, gain: 0.12 }), noise({ dur: 0.03, f0: 1800, q: 1, gain: 0.04 })),
    place: () => (tone({ f0: 120, f1: 60, dur: 0.12, gain: 0.1 }), noise({ dur: 0.08, f0: 1400, f1: 700, q: 0.7, gain: 0.05 })),
    lift: () => noise({ dur: 0.18, type: "highpass", f0: 1800, f1: 3000, gain: 0.03, a: 0.03 }),
    hover: () => noise({ dur: 0.05, f0: 2600, q: 1.4, gain: 0.012 }),
    flip: () => (noise({ dur: 0.16, f0: 900, f1: 5200, q: 1.1, gain: 0.08, a: 0.02 }), noise({ t: now() + 0.12, dur: 0.05, f0: 1500, q: 1, gain: 0.03 })),
    stinger: () => {
      tone({ f0: 74, f1: 36, dur: 1.8, a: 0.02, gain: 0.32, send: 1 });
      noise({ dur: 1.4, type: "lowpass", f0: 400, f1: 60, gain: 0.12, a: 0.01, send: 1 });
      tone({ f0: 196, f1: 185, type: "sawtooth", dur: 1.2, a: 0.02, gain: 0.03, lp: 700, send: 1 });
    },
    dread: () => {
      for (const f of [110, 116.5, 164.8]) tone({ f0: f, f1: f * 0.98, type: "triangle", dur: 2.6, a: 1.1, gain: 0.05, send: 1, lp: 900 });
    },
    chime: () => {
      for (const [m, g] of [
        [1, 0.06],
        [2.76, 0.025],
        [5.4, 0.012],
      ])
        tone({ f0: 659 * m, dur: 2.4, a: 0.004, gain: g, send: 1 });
    },
    tick: () => {
      for (let i = 0; i < 7; i++) noise({ t: now() + i * (0.06 + i * 0.018), dur: 0.015, f0: 1800, q: 4, gain: 0.05 });
    },
    low: () => tone({ f0: 55, f1: 49, type: "sawtooth", dur: 1.8, a: 0.6, gain: 0.07, lp: 260, send: 1 }),
    // a breath across the candle flames
    blow: () => {
      noise({ dur: 0.9, type: "bandpass", f0: 500, f1: 260, q: 0.6, gain: 0.16, a: 0.12 });
      noise({ t: now() + 0.25, dur: 0.7, type: "bandpass", f0: 420, f1: 200, q: 0.6, gain: 0.1, a: 0.08 });
    },
    crack: () => {
      for (let i = 0; i < 4; i++) noise({ t: now() + i * 0.018, dur: 0.035, type: "bandpass", f0: 1400 + i * 500, q: 3, gain: 0.35 });
      tone({ f0: 90, f1: 40, dur: 0.25, gain: 0.4 });
      noise({ t: now() + 0.08, dur: 1.0, type: "highpass", f0: 3000, f1: 6000, gain: 0.05 });
    },
    poke: () => tone({ f0: 330, f1: 300, dur: 0.25, gain: 0.03, send: 1 }),
    type: () => tone({ f0: 160 + Math.random() * 60, dur: 0.025, a: 0.002, gain: 0.018, type: "triangle" }),
  };

  return {
    unlock,
    play(name) {
      if (!ctx || muted || !SFX[name]) return;
      try {
        SFX[name]();
      } catch {}
    },
    get muted() {
      return muted;
    },
    setMuted(m) {
      muted = m;
      try {
        localStorage.setItem(KEY, m ? "1" : "0");
      } catch {}
      if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, now(), 0.08);
    },
    dispose() {
      clearTimeout(crackle);
      ctx?.close?.();
      ctx = null;
    },
  };
}
