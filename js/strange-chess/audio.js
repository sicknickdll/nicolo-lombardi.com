// Sound: soft generated wind and a few synthesised clicks (WebAudio, no files). Muted by
// default; the context is only created when sound is first turned on (a user gesture).
export function createAudio() {
  let ac = null,
    master = null,
    windGain = null,
    on = false;
  function init() {
    if (ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
    // wind: looping brown-ish noise through a slowly wandering band-pass
    const len = ac.sampleRate * 4;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 420;
    bp.Q.value = 0.6;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(bp.frequency);
    windGain = ac.createGain();
    windGain.gain.value = 0.18;
    src.connect(bp).connect(windGain).connect(master);
    src.start();
    lfo.start();
  }
  function blip(freq, dur, type = "triangle", vol = 0.12, noise = false) {
    if (!on || !ac) return;
    const t = ac.currentTime;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(master);
    if (noise) {
      const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
      const c = b.getChannelData(0);
      for (let i = 0; i < c.length; i++) c[i] = (Math.random() * 2 - 1) * (1 - i / c.length);
      const s = ac.createBufferSource();
      s.buffer = b;
      const f = ac.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = freq;
      s.connect(f).connect(g);
      s.start(t);
    } else {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
      o.connect(g);
      o.start(t);
      o.stop(t + dur);
    }
  }
  const SOUNDS = {
    select: () => blip(1800, 0.05, "sine", 0.05, true),
    move: () => blip(900, 0.08, "sine", 0.08, true),
    capture: () => (blip(220, 0.25, "triangle", 0.14), blip(500, 0.3, "sine", 0.06, true)),
    push: () => blip(140, 0.3, "triangle", 0.16),
    trap: () => (blip(2600, 0.06, "square", 0.08, true), blip(160, 0.2, "square", 0.08)),
    gust: () => windGain && windGain.gain.setTargetAtTime(0.45, ac.currentTime, 0.3) && setTimeout(() => windGain && windGain.gain.setTargetAtTime(0.18, ac.currentTime, 1.2), 1500),
    phase: () => blip(70, 1.6, "sine", 0.2),
  };
  return {
    get on() {
      return on;
    },
    toggle() {
      on = !on;
      if (on) init();
      if (ac) {
        if (on) ac.resume();
        else ac.suspend();
      }
      return on;
    },
    play(name) {
      if (on && SOUNDS[name]) SOUNDS[name]();
    },
    close() {
      if (ac) ac.close();
    },
  };
}
