// Small interface sounds (assets/sounds): "loaded" during an Archive collection's loading screen,
// "timepass" each time the clock completes a minute.
// Browsers only allow sound after the visitor has interacted with the page, so a play() before
// that does nothing, silently.
const files = {};
const get = (name) => (files[name] ||= Object.assign(new Audio(`/assets/sounds/${name}.mp3`), { preload: "auto" }));
// Fetch a sound ahead of time, so it plays the instant it is needed.
export const preload = (name) => get(name).load();
export function play(name, volume = 0.6) {
  if (document.hidden) return;
  const audio = get(name);
  audio.volume = volume;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}
