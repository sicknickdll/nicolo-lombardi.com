// Optional sound: soft generated wind and a few synthesised clicks (WebAudio, no files). Muted by default.
export function createAudio() {
  let ctx = null,
    master = null,
    windGain = null,
    windFilter = null,
    enabled = false;
  const ensure = () => {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // wind: looped noise through a slowly moving band-pass
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b = (b + 0.02 * w) / 1.02; // brown-ish
      d[i] = b * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0.05;
    src.connect(windFilter).connect(windGain).connect(master);
    src.start();
    const lfo = ctx.createOscillator(),
      lg = ctx.createGain();
    lfo.frequency.value = 0.12;
    lg.gain.value = 160;
    lfo.connect(lg).connect(windFilter.frequency);
    lfo.start();
    return ctx;
  };
  const tone = (freq, dur, type = "square", vol = 0.05, slide = 0) => {
    if (!enabled || !ctx) return;
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  };
  return {
    get enabled() {
      return enabled;
    },
    set(on) {
      enabled = on;
      if (on) {
        ensure();
        ctx?.resume();
        master.gain.setTargetAtTime(1, ctx.currentTime, 0.3);
      } else if (master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    },
    wind(k) {
      if (!ctx || !enabled) return;
      windGain.gain.setTargetAtTime(0.04 + 0.16 * k, ctx.currentTime, 0.5);
      windFilter.frequency.setTargetAtTime(380 + 500 * k, ctx.currentTime, 0.5);
    },
    select: () => tone(520, 0.06, "square", 0.03),
    move: () => tone(220, 0.09, "triangle", 0.06, -60),
    capture: () => (tone(160, 0.16, "sawtooth", 0.05, -90), tone(90, 0.2, "triangle", 0.06)),
    fall: () => tone(300, 0.5, "sine", 0.05, -240),
    snap: () => (tone(900, 0.04, "square", 0.06), tone(140, 0.12, "sawtooth", 0.06)),
    tick: () => tone(1100, 0.015, "square", 0.012),
    phase: () => (tone(110, 1.2, "sine", 0.08, -30), tone(165, 1.4, "sine", 0.04)),
    win: () => [392, 523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.6, "sine", 0.05), i * 180)),
    lose: () => [330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.7, "sine", 0.05), i * 240)),
  };
}
