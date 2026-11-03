// Small interface sounds (assets/sounds): "loaded" during an Archive collection's loading screen,
// "timepass" each time the clock completes a minute.
// Browsers only allow sound after the visitor has interacted with the page, so a play() before
// that does nothing, silently.
const files = {};
export function play(name, volume = 0.6) {
  if (document.hidden) return;
  const audio = (files[name] ||= new Audio(`/assets/sounds/${name}.mp3`));
  audio.volume = volume;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}
