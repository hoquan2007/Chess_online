/** Chess move audio is a browser preference, shared by local and online boards. */
const preferenceKey = "rookline-sound";
let audioContext: AudioContext | null = null;

export function moveSoundsEnabled() {
  try { return localStorage.getItem(preferenceKey) !== "off"; }
  catch { return true; }
}

export function setMoveSoundsEnabled(enabled: boolean) {
  try { localStorage.setItem(preferenceKey, enabled ? "on" : "off"); }
  catch { /* Private browsing may restrict storage. */ }
  window.dispatchEvent(new Event("rookline:preferences-changed"));
  if (enabled) playMoveSound(); // Immediate preview also unlocks browser audio on this click.
}

/** Call from user gestures to allow later opponent/computer move audio. */
export function unlockMoveAudio() {
  if (!moveSoundsEnabled() || typeof window === "undefined") return;
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") void audioContext.resume().catch(() => {});
  } catch { /* Audio hardware or browser permissions may be unavailable. */ }
}

export function playMoveSound() {
  if (!moveSoundsEnabled() || typeof window === "undefined") return;
  try {
    unlockMoveAudio();
    const context = audioContext;
    if (!context || context.state === "closed") { audioContext = null; return; }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(620, now);
    oscillator.frequency.exponentialRampToValueAtTime(310, now + 0.095);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.105);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.11);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch { /* Playing chess must remain possible without an audio device. */ }
}
