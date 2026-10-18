// Easter-egg sounds: a glitch made on the fly with Web Audio (noise stutters, a digital
// squeal jumping between pitches, a rising mains buzz), then the Windows XP startup
// chime (assets/xp/sounds/startup.mp3) when the desktop appears, and the Windows XP shutdown
// sound (assets/xp/sounds/shutdown.mp3) when Turn Off is chosen.
// The AudioContext is created by js/app.js inside the click that opens the easter egg,
// because browsers only let a page make sound after a click.

// Plays the glitch on `audio` for `duration` ms, getting harsher towards the end, then
// cutting dead like the screen going black.
export function glitchSound(audio, duration) {
  if (!audio) return;
  const t0 = audio.currentTime + 0.02,
    len = duration / 1000,
    end = t0 + len;
  const master = audio.createGain();
  master.gain.setValueAtTime(0.32, t0);
  master.gain.setValueAtTime(0.32, end - 0.03);
  master.gain.linearRampToValueAtTime(0, end);
  master.connect(audio.destination);

  // White noise through a band-pass whose centre jumps around, chopped into stutters.
  const noise = audio.createBufferSource();
  const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * len), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buffer;
  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 1.4;
  const noiseGate = audio.createGain();
  noise.connect(band).connect(noiseGate).connect(master);

  // Square-wave squeal, the "digital" part.
  const squeal = audio.createOscillator();
  squeal.type = "square";
  const squealGate = audio.createGain();
  squeal.connect(squealGate).connect(master);

  // Low buzz swelling up underneath.
  const buzz = audio.createOscillator();
  buzz.type = "sawtooth";
  buzz.frequency.setValueAtTime(55, t0);
  const buzzGain = audio.createGain();
  buzzGain.gain.setValueAtTime(0.02, t0);
  buzzGain.gain.linearRampToValueAtTime(0.22, end);
  buzz.connect(buzzGain).connect(master);

  noiseGate.gain.setValueAtTime(0, t0);
  squealGate.gain.setValueAtTime(0, t0);
  for (let t = t0; t < end; ) {
    const k = (t - t0) / len, // 0 → 1 across the glitch
      step = 0.015 + Math.random() * (0.07 - 0.04 * k);
    band.frequency.setValueAtTime(200 + Math.random() * 5000, t);
    noiseGate.gain.setValueAtTime(Math.random() < 0.35 - 0.2 * k ? 0 : 0.35 + 0.65 * k, t);
    squeal.frequency.setValueAtTime(80 + Math.random() ** 2 * 2400, t);
    squealGate.gain.setValueAtTime(Math.random() < 0.55 - 0.3 * k ? 0 : 0.05 + 0.12 * k, t);
    t += step;
  }
  for (const node of [noise, squeal, buzz]) {
    node.start(t0);
    node.stop(end);
  }
}

// Fetches and decodes a sound ahead of time, so it plays on cue.
export function loadSound(audio, url) {
  if (!audio) return Promise.resolve(null);
  return fetch(url)
    .then((r) => r.arrayBuffer())
    .then((data) => audio.decodeAudioData(data))
    .catch(() => null);
}
export const loadStartup = (audio) => loadSound(audio, "/assets/xp/sounds/startup.mp3");

export function play(audio, buffer, volume = 0.8) {
  if (!audio || !buffer) return null;
  const source = audio.createBufferSource(),
    gain = audio.createGain();
  source.buffer = buffer;
  gain.gain.value = volume;
  source.connect(gain).connect(audio.destination);
  source.start();
  return source;
}
