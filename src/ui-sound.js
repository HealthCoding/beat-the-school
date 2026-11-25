// Interface sound shared by the title screen and the game: a short synthesized "tick" for buttons and
// the title-screen music (the game track, low-passed so it sounds far away). One lazily created
// AudioContext, unlocked by the first gesture; nothing is downloaded for the tick.
// The on/off choice is remembered (beat-school-sound) and the game reads the same key.
export const SOUND_KEY = 'beat-school-sound';
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
export const soundPreference = () => store.get(SOUND_KEY) !== 'off';
export const saveSoundPreference = on => store.set(SOUND_KEY, on ? 'on' : 'off');

const MUSIC_URL = new URL('../assets/audio/campus-bgm.wav', import.meta.url).href;
let context = null, music = null, musicBuffer = null, musicLoading = null, wantMusic = false;
function audio() {
  if (context) return context;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  try { context = new AC(); } catch { context = null; }
  return context;
}
function envelope(gain, t, peak, decay) { gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(peak, t + .003); gain.gain.exponentialRampToValueAtTime(.0001, t + decay); }

/** Wooden-block tick (≈60 ms). Silent when sound is off or audio is unavailable. */
export function playTick() {
  if (!soundPreference()) return;
  const c = audio(); if (!c) return;
  try {
    c.resume?.()?.catch?.(() => {});
    const t = c.currentTime + .005, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(1050, t); o.frequency.exponentialRampToValueAtTime(700, t + .04);
    envelope(g, t, .22, .06); o.connect(g).connect(c.destination); o.start(t); o.stop(t + .07);
    const len = Math.ceil(c.sampleRate * .03), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const n = c.createBufferSource(), f = c.createBiquadFilter(), ng = c.createGain();
    n.buffer = buf; f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 2.5; envelope(ng, t, .12, .025);
    n.connect(f).connect(ng).connect(c.destination); n.start(t);
  } catch {}
}

/** Title music: the game track through a low-pass filter, quiet, looping. Starts on a gesture. */
export async function setTitleMusic(on) {
  wantMusic = on && soundPreference();
  const c = audio();
  if (!c) return;
  if (!wantMusic) { if (music) { try { music.stop(); } catch {} music = null; } return; }
  if (music) return;
  try {
    await c.resume?.();
    musicLoading ??= fetch(MUSIC_URL).then(r => r.arrayBuffer()).then(b => c.decodeAudioData(b));
    musicBuffer ??= await musicLoading;
    if (!wantMusic || music) return;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = musicBuffer; src.loop = true; f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = .7;
    g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(.28, c.currentTime + .6);
    src.connect(f).connect(g).connect(c.destination); src.start(); music = src;
  } catch { musicLoading = null; }
}

/** Plays the tick for every press on a matching control (pointerdown, so it is instant on touch). */
export function tickOnPress(root, selector) {
  root.addEventListener('pointerdown', e => {
    const el = e.target.closest?.(selector);
    if (el && !el.disabled && el.getAttribute('aria-disabled') !== 'true') playTick();
  }, true);
}
