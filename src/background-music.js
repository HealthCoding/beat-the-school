// Long songs stay in the browser's streaming decoder (no whole-song PCM buffers).
// Keep this module URL shared by title and game: ?v=music23.
const MUSIC_GAIN = .14;
const CROSSFADE = 1.2;
export const MUSIC_KEY = 'beat-school-music';
export const MUSIC_HANDOFF_KEY = 'beat-school-music-handoff';
export const MUSIC_CHOICES = [['songs', '노래'], ['calm', '잔잔한 기본'], ['off', '끄기']];
export function musicPreference() {
  try { const value = localStorage.getItem(MUSIC_KEY); return MUSIC_CHOICES.some(([id]) => id === value) ? value : 'songs'; } catch { return 'songs'; }
}
export function saveMusicPreference(value) {
  if (!MUSIC_CHOICES.some(([id]) => id === value)) return;
  try { localStorage.setItem(MUSIC_KEY, value); } catch {}
}
export function createMusicSetting(document, value, onChange) {
  const label = document.createElement('label'), caption = document.createElement('span'), select = document.createElement('select');
  // Same row as 화면 품질 (label above, full-width select) so the long song titles fit on phones.
  label.className = 'quality-control'; caption.textContent = '배경음악'; select.id = 'music-choice';
  select.setAttribute('aria-label', '배경음악');
  for (const [id, text] of MUSIC_CHOICES) { const option = document.createElement('option'); option.value = id; option.textContent = id === 'songs' ? 'Arcade Rush · Game Over Groove' : text; select.append(option); }
  select.value = value; select.addEventListener('change', () => onChange(select.value)); label.append(caption, select);
  return label;
}
const url = name => new URL(`../assets/audio/${name}`, import.meta.url).href;
const TITLE = { id: 'campus-song', url: url('campus-song.m4a'), start: 37.5 };
const SONGS = [{ id: 'arcade-rush', url: url('arcade-rush.m4a') }, { id: 'game-over-groove', url: url('game-over-groove.m4a') }];
const CALM = { id: 'campus-bgm', url: url('campus-bgm.wav') };
// One navigation only: never restore a stale title song on a later direct visit.
export function consumeMusicHandoff() {
  try {
    const raw = sessionStorage.getItem(MUSIC_HANDOFF_KEY); sessionStorage.removeItem(MUSIC_HANDOFF_KEY);
    const value = JSON.parse(raw);
    if (!value || !Number.isFinite(value.offset) || value.offset < 0 || value.offset > 86400 ||
        !Number.isFinite(value.savedAt) || Date.now() - value.savedAt > 300000 || Date.now() < value.savedAt ||
        !((value.mode === 'songs' && value.track === TITLE.id) || (value.mode === 'calm' && value.track === CALM.id))) return null;
    return value;
  } catch { return null; }
}
// Each reusable media element is unlocked in the gesture, including the second crossfade deck.
// Inline silence avoids a network request and permits later play() on iOS after the gesture ends.
const SILENCE = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==';

export function createBackgroundMusic({
  AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext, Audio = globalThis.Audio,
  fetchAudio = globalThis.fetch,
  scene = 'game', ready = false, mode = musicPreference(), handoff = null,
} = {}) {
  if (scene !== 'game' || ready || handoff?.mode !== mode || ![TITLE.id, CALM.id].includes(handoff?.track)) handoff = null;
  let context = null, master = null, decks = [], active = null, outgoing = null;
  let enabled = false, paused = false, disposed = false, unlocked = false, fading = false;
  let loadCount = 0, createdSources = 0, transitions = 0, generation = 0, lastError = null, fadeTimer = null;
  let index = 0;
  const desired = () => enabled && mode !== 'off' && (ready || !!handoff) && unlocked && !paused && !disposed && !fading;
  const track = () => mode === 'calm' ? CALM : scene === 'title' || (!ready && handoff) ? TITLE : SONGS[index];
  const report = error => { if (error?.name !== 'AbortError' && error?.name !== 'NotAllowedError') lastError = String(error?.message || error); };
  function level(deck, value, seconds = 0) {
    const param = deck.gain.gain, now = context.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else { param.cancelScheduledValues(now); param.setValueAtTime(param.value, now); }
    if (seconds) param.linearRampToValueAtTime(value, now + seconds); else param.setValueAtTime(value, now);
  }
  function finishCrossfade() {
    clearTimeout(fadeTimer); fadeTimer = null;
    if (outgoing) {
      outgoing.audio.pause(); level(outgoing, 0); outgoing.revision++; outgoing.controller?.abort(); outgoing.controller = null;
      if (outgoing.blobURL) URL.revokeObjectURL(outgoing.blobURL);
      outgoing.blobURL = null; outgoing.loading = false; outgoing.seek = null; outgoing.track = null; outgoing = null;
    }
    if (active) level(active, 1);
  }
  function halt() {
    finishCrossfade();
    for (const deck of decks) deck.audio.pause();
    if (master) { master.gain.cancelScheduledValues(context.currentTime); master.gain.setValueAtTime(0, context.currentTime); }
  }
  async function loadEncoded(deck) {
    if (deck.controller) return;
    const token = generation, revision = deck.revision, controller = new AbortController(); deck.controller = controller; deck.loading = true;
    try {
      // A handoff starts with this one low-priority request, avoiding a competing
      // media request + Range fallback while campus geometry is downloading.
      const response = await fetchAudio(deck.track.url, { signal: controller.signal, priority: 'low' });
      if (!response.ok) throw new Error(`Music HTTP ${response.status}`);
      const blob = await response.blob();
      if (token !== generation || revision !== deck.revision || disposed) return;
      deck.blobURL = URL.createObjectURL(blob); deck.loading = false; deck.audio.src = deck.blobURL; deck.audio.load();
    } catch (error) { if (revision === deck.revision) report(error); }
    finally { if (deck.controller === controller) { deck.controller = null; deck.loading = false; } }
  }
  function ensureContext() {
    if (context) return context.state !== 'closed';
    if (disposed || typeof AudioContext !== 'function' || typeof Audio !== 'function') return false;
    try {
      context = new AudioContext(); master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
      for (let i = 0; i < 2; i++) {
        const audio = new Audio(); audio.preload = 'none'; audio.playsInline = true;
        const gain = context.createGain(); gain.gain.value = 0;
        const source = context.createMediaElementSource(audio); source.connect(gain); gain.connect(master);
        const deck = { audio, gain, source, track: null, pending: false, seek: null, blobURL: null, controller: null, loading: false, revision: 0 };
        decks.push(deck); createdSources++;
        audio.addEventListener('loadedmetadata', async () => {
          if (deck.seek === null || deck.loading) return;
          // Simple local servers may ignore HTTP Range, making any nonzero seek
          // snap back to zero. Only there, retain ~3 MB of encoded AAC as a Blob;
          // decoding still belongs to the media element, never a full PCM buffer.
          if (deck.seek > 0 && !deck.blobURL && audio.seekable &&
              (!audio.seekable.length || audio.seekable.end(audio.seekable.length - 1) < deck.seek)) {
            void loadEncoded(deck);
            return;
          }
          try { audio.currentTime = deck.seek; deck.seek = null; start(); } catch (error) { report(error); }
        });
        audio.addEventListener('timeupdate', () => advance(deck));
        audio.addEventListener('ended', () => ended(deck));
        audio.addEventListener('error', () => { if (deck.track) lastError = `Music ${deck.track.id}: ${audio.error?.code || 'unavailable'}`; });
        audio.src = SILENCE;
      }
      context.onstatechange = () => {
        if (disposed) return;
        if (context.state === 'running') start(); else halt();
      };
      return true;
    } catch (error) { report(error); halt(); return false; }
  }
  function prepare(deck, song, startAt = 0, lowPriority = false) {
    deck.revision++; deck.controller?.abort(); deck.controller = null; deck.loading = false;
    if (deck.blobURL) URL.revokeObjectURL(deck.blobURL); deck.blobURL = null;
    deck.audio.pause(); deck.track = song; deck.pending = false; deck.seek = startAt;
    deck.audio.loop = song === CALM; deck.audio.preload = 'auto'; loadCount++;
    if (lowPriority) { void loadEncoded(deck); return; }
    deck.audio.src = song.url;
    // Setting currentTime before metadata also handles browsers that begin playback immediately.
    try { deck.audio.currentTime = startAt; } catch {}
    deck.audio.load();
  }
  function play(deck, then) {
    if (deck.loading || deck.seek > 0 || deck.pending || !deck.audio.paused) return;
    deck.pending = true; const token = generation, revision = deck.revision;
    try {
      Promise.resolve(deck.audio.play()).then(() => {
        if (token !== generation || revision !== deck.revision) return;
        deck.pending = false;
        if (!desired()) { deck.audio.pause(); return; }
        // A play() begun inside the first tap can resolve before the context has resumed; wait for it instead of pausing,
        // or iOS (which only allows play() inside a gesture) stays silent until the next tap.
        if (context.state !== 'running') { Promise.resolve(context.resume()).then(() => { if (!desired() || token !== generation) deck.audio.pause(); else { lastError = null; then?.(); } }).catch(report); return; }
        lastError = null; then?.();
      }, error => { if (token === generation && revision === deck.revision) { deck.pending = false; report(error); } });
    } catch (error) { deck.pending = false; report(error); }
  }
  function start(inGesture = false) {
    // Inside a tap the context may still be resuming: start the element now anyway (iOS allows play() only in the gesture).
    if (!desired() || !context || (context.state !== 'running' && !inGesture)) return;
    if (ready && handoff && mode === 'songs' && active?.track === TITLE) { enterGame(); return; }
    if (!active) { active = decks[0]; prepare(active, track(), handoff && !ready ? handoff.offset : scene === 'title' && mode === 'songs' ? TITLE.start : 0, !!handoff && !ready); }
    if (!active.audio.paused || active.pending) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(0, now); master.gain.linearRampToValueAtTime(MUSIC_GAIN, now + .25);
    level(active, 1); play(active);
  }
  function enterGame() {
    if (!desired() || !ready || context?.state !== 'running' || outgoing) return;
    const previous = active, next = decks.find(d => d !== previous);
    if (next.track !== SONGS[0]) { level(next, 0); prepare(next, SONGS[0]); }
    play(next, () => {
      if (active !== previous) return;
      outgoing = previous; active = next; handoff = null; index = 0; transitions++;
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(MUSIC_GAIN, now);
      level(next, 1, CROSSFADE); level(previous, 0, CROSSFADE);
      fadeTimer = setTimeout(finishCrossfade, CROSSFADE * 1000 + 30);
    });
  }
  function advance(deck) {
    if (deck !== active || !desired() || !ready || scene !== 'game' || mode !== 'songs' || outgoing || handoff) return;
    const remaining = deck.audio.duration - deck.audio.currentTime;
    if (!Number.isFinite(remaining) || remaining > 10) return;
    const next = decks.find(d => d !== active), song = SONGS[(index + 1) % SONGS.length];
    if (next.track !== song) { level(next, 0); prepare(next, song); }
    if (remaining > CROSSFADE || next.pending) return;
    play(next, () => {
      if (active !== deck) return;
      outgoing = deck; active = next; index = (index + 1) % SONGS.length; transitions++;
      const duration = Math.min(CROSSFADE, Math.max(.08, remaining));
      level(next, 1, duration); level(deck, 0, duration);
      fadeTimer = setTimeout(finishCrossfade, duration * 1000 + 30);
    });
  }
  function ended(deck) {
    if (deck !== active || !desired()) return;
    if (mode === 'songs' && scene === 'game' && ready) {
      advance(deck); // The same transition also covers a late/slow network and a missed timeupdate.
    } else { deck.audio.currentTime = 0; play(deck); }
  }
  function setEnabled(value) {
    enabled = !!value;
    if (!enabled || mode === 'off') { halt(); return Promise.resolve(false); }
    unlocked = true;
    if (!ensureContext()) return Promise.resolve(false);
    // Repeat priming inside a later gesture too: the initial loading attempt may
    // have been rejected before either Safari media element was unlocked.
    for (const deck of decks) if (!deck.track) {
      deck.audio.src = SILENCE;
      const token = generation;
      try { Promise.resolve(deck.audio.play()).then(() => { if (!deck.track && token === generation) deck.audio.pause(); }).catch(report); } catch (error) { report(error); }
    }
    // Always retry resume in a gesture: Safari may leave an earlier non-gesture promise pending.
    try { Promise.resolve(context.resume()).then(() => start()).catch(report); } catch (error) { report(error); }
    start(true); return Promise.resolve(!!active && !active.audio.paused);
  }
  function setReady(value = true) {
    ready = !!value;
    if (ready) { if (!active || mode !== 'songs') handoff = null; start(); } else if (!handoff) halt();
  }
  function setPaused(value) { paused = !!value; if (paused) halt(); else if (enabled && context) { try { Promise.resolve(context.resume()).then(start).catch(report); } catch (error) { report(error); } start(); } }
  function reset() {
    generation++; halt(); active = null; index = 0;
    for (const deck of decks) {
      deck.controller?.abort(); deck.controller = null;
      if (deck.blobURL) URL.revokeObjectURL(deck.blobURL); deck.blobURL = null;
      deck.revision++; deck.loading = false; deck.track = null; deck.pending = false; deck.seek = null; deck.audio.removeAttribute('src'); deck.audio.load();
    }
  }
  function setMode(value) {
    if (!MUSIC_CHOICES.some(([id]) => id === value) || mode === value) return;
    reset(); handoff = null; mode = value; if (enabled && mode !== 'off') setEnabled(true);
  }
  // User 10-24: the music no longer dips under weapon hits; callers stay, the dip is off.
  const DUCK_ON_HITS = false;
  function duck(seconds = .32) {
    if (!DUCK_ON_HITS || !active || !desired() || active.audio.paused) return;
    const duration = Number.isFinite(seconds) ? Math.min(2, Math.max(.08, seconds)) : .32;
    const now = context.currentTime, param = master.gain;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else { param.cancelScheduledValues(now); param.setValueAtTime(Math.min(MUSIC_GAIN, Math.max(0, param.value)), now); }
    param.linearRampToValueAtTime(MUSIC_GAIN * .28, now + .018);
    param.setValueAtTime(MUSIC_GAIN * .28, now + duration); param.linearRampToValueAtTime(MUSIC_GAIN, now + duration + .25);
  }
  function fadeOut(seconds = .35) {
    fading = true; finishCrossfade();
    if (master) { const now = context.currentTime; master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.linearRampToValueAtTime(0, now + seconds); }
  }
  function resumeScene() { fading = false; start(); }
  function saveHandoff() {
    try {
      sessionStorage.removeItem(MUSIC_HANDOFF_KEY);
      if (scene !== 'title' || !enabled || mode === 'off' || !active?.track || active.seek !== null || !Number.isFinite(active.audio.currentTime)) return false;
      sessionStorage.setItem(MUSIC_HANDOFF_KEY, JSON.stringify({ track: active.track.id, offset: active.audio.currentTime, mode, savedAt: Date.now() }));
      return true;
    } catch { return false; }
  }
  function dispose() {
    if (disposed) return; reset(); disposed = true; enabled = false;
    for (const deck of decks) { deck.source.disconnect(); deck.gain.disconnect(); }
    master?.disconnect(); try { context?.close()?.catch?.(() => {}); } catch {}
  }
  return { setEnabled, setReady, setPaused, setMode, duck, fadeOut, resumeScene, saveHandoff, dispose,
    get stats() { return { enabled, paused, mode, ready, playing: !!active && !active.audio.paused && context?.state === 'running', loaded: !!active && active.audio.readyState >= 2,
      loading: !!active && active.audio.readyState < 2, disposed, contexts: context ? 1 : 0, activeSources: decks.filter(d => d.track && !d.audio.paused).length,
      createdSources, loadCount, decodeCount: 0, duration: active?.audio.duration || 0, offset: active?.audio.currentTime || 0, volume: MUSIC_GAIN, lastError,
      track: active?.track?.id || null, playlist: SONGS.map(s => s.id), transitions, crossfading: !!outgoing, streaming: true, encodedFallback: !!active?.blobURL }; },
  };
}
