// ?feel preview only: a distant air-raid siren under the nuclear countdown. Pure WebAudio synthesis, no files.
// The whole wail (spin-up, two swells, wind-down) is scheduled once as automation, so there are no timers.
// It owns its own small AudioContext; the caller starts it from the nuke tap gesture and stops it via sync().
export const SIREN_SECONDS = 5.6; // countdown 3 s + most of the 3 s fall; ends before the 6 s impact.
export const SIREN_LEVEL = .04; // bus gain: offline render ~.01 RMS while held, under the spoken numbers (~.023 RMS).

// Fundamental pitch path (seconds, Hz): motor spin-up, wail down/up, then a long wind-down under the fall.
const PITCH = [[0, 150], [1.3, 520], [2.2, 600], [3.0, 470], [3.8, 580], [5.6, 160]];
// Loudness path (0..1): rises with the rotor, holds through the countdown, fades while the warhead falls.
const LOUDNESS = [[0, 0], [.9, .85], [2.2, 1], [3.0, .9], [3.8, .7], [5.0, .18], [5.6, 0]];
const DETUNE = 1.0065; // second rotor ~11 cents sharp: slow beating, not a chord.

function automate(param, points, at, scale = 1, floor = 0) {
  param.cancelScheduledValues?.(at);
  param.setValueAtTime(Math.max(floor, points[0][1] * scale), at);
  for (let i = 1; i < points.length; i++) {
    const [time, value] = points[i];
    param.linearRampToValueAtTime(Math.max(floor, value * scale), at + time);
  }
}

// Builds one siren on any BaseAudioContext (live or OfflineAudioContext) into `destination`.
export function scheduleSiren(context, destination, { at = context.currentTime, duration = SIREN_SECONDS, level = SIREN_LEVEL } = {}) {
  const span = Math.max(.5, Math.min(SIREN_SECONDS, duration)), stretch = span / SIREN_SECONDS, endAt = at + span;
  const pitch = PITCH.map(([t, f]) => [t * stretch, f]), loud = LOUDNESS.map(([t, v]) => [t * stretch, v]);
  const nodes = [], sources = [];
  const node = made => (nodes.push(made), made);
  const bus = node(context.createGain()); automate(bus.gain, loud, at, level, 0);
  // Distance: dull the top, thin the bottom, then a short filtered echo for open-air space.
  const lowpass = node(context.createBiquadFilter()); lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(1500, at); lowpass.Q.setValueAtTime(.7, at);
  const highpass = node(context.createBiquadFilter()); highpass.type = 'highpass';
  highpass.frequency.setValueAtTime(220, at); highpass.Q.setValueAtTime(.5, at);
  const chop = node(context.createGain()); chop.gain.setValueAtTime(.86, at); // rotor port chop (LFO adds ±.14)
  const dry = node(context.createGain()); dry.gain.setValueAtTime(.78, at);
  const delay = node(context.createDelay(1)); delay.delayTime.setValueAtTime(.19, at);
  const feedback = node(context.createGain()); feedback.gain.setValueAtTime(.34, at);
  const echoTone = node(context.createBiquadFilter()); echoTone.type = 'lowpass'; echoTone.frequency.setValueAtTime(1100, at);
  const wet = node(context.createGain()); wet.gain.setValueAtTime(.36, at);
  lowpass.connect(highpass); highpass.connect(chop);
  chop.connect(dry); dry.connect(bus);
  chop.connect(delay); delay.connect(echoTone); echoTone.connect(feedback); feedback.connect(delay); echoTone.connect(wet); wet.connect(bus);
  bus.connect(destination);
  // Two detuned sawtooth rotors share one slow vibrato.
  const vibrato = node(context.createOscillator()); vibrato.type = 'sine'; vibrato.frequency.setValueAtTime(4.2, at); sources.push(vibrato);
  const vibratoDepth = node(context.createGain()); vibratoDepth.gain.setValueAtTime(5, at); vibrato.connect(vibratoDepth);
  for (const [ratio, gainValue] of [[1, .5], [DETUNE, .42]]) {
    const rotor = node(context.createOscillator()); rotor.type = 'sawtooth'; sources.push(rotor);
    automate(rotor.frequency, pitch, at, ratio, 20);
    vibratoDepth.connect(rotor.frequency);
    const trim = node(context.createGain()); trim.gain.setValueAtTime(gainValue, at);
    rotor.connect(trim); trim.connect(lowpass);
  }
  const tremolo = node(context.createOscillator()); tremolo.type = 'sine'; tremolo.frequency.setValueAtTime(7, at); sources.push(tremolo);
  const tremoloDepth = node(context.createGain()); tremoloDepth.gain.setValueAtTime(.14, at); tremolo.connect(tremoloDepth); tremoloDepth.connect(chop.gain);
  // Echo tail rings ~.6 s after the dry voice ends; then everything stops.
  for (const source of sources) { source.start(at); source.stop(endAt + .7); }
  return { bus, nodes, sources, at, endAt };
}

export function createNukeSiren({ AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext, win = globalThis.window, doc = globalThis.document, nav = globalThis.navigator } = {}) {
  let context = null, voice = null, disposed = false;
  const stats = { starts: 0, stops: 0, refused: 0, nodesCreated: 0, lastStartAt: null, lastStopAt: null, lastStopReason: null, contextState: null };
  function cleanup(target) {
    if (voice === target) voice = null;
    for (const made of target.nodes) { try { made.disconnect(); } catch {} }
  }
  function stop(reason = 'stop', fade = .06) {
    if (!voice) return false;
    const current = voice, now = context.currentTime, param = current.bus.gain;
    stats.stops++; stats.lastStopAt = now; stats.lastStopReason = reason;
    try {
      if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
      else { param.cancelScheduledValues(now); param.setValueAtTime(param.value, now); }
      param.linearRampToValueAtTime(0, now + fade);
      for (const source of current.sources) { try { source.stop(now + fade + .02); } catch {} }
    } catch {}
    // Mark stopped now (no duplicates, diagnostics are immediate); disconnect after the short fade.
    voice = null;
    return true;
  }
  function start({ enabled = true, duration = SIREN_SECONDS } = {}) {
    // Mute, missing WebAudio, or no user gesture yet: stay silent and create nothing.
    if (disposed || !enabled || !AudioContext || doc?.hidden || nav?.userActivation?.hasBeenActive === false) { stats.refused++; return false; }
    if (voice && context.currentTime < voice.endAt + .7) { stats.refused++; return false; } // never two at once
    try {
      context ??= new AudioContext();
      context.resume?.()?.catch?.(() => {});
      const made = scheduleSiren(context, context.destination, { at: context.currentTime + .02, duration });
      voice = made; stats.starts++; stats.nodesCreated += made.nodes.length; stats.lastStartAt = context.currentTime;
      made.sources[0].onended = () => cleanup(made);
      return true;
    } catch { stats.refused++; return false; }
  }
  // Called every frame by the game: anything other than "nuke counting down / falling with sound on" stops it.
  function sync(allowed) { if (!allowed && voice) stop('sync', .12); }
  const onHidden = () => { if (doc?.hidden) stop('hidden'); };
  const onBlur = () => stop('blur');
  const onPageHide = () => stop('pagehide');
  doc?.addEventListener?.('visibilitychange', onHidden); win?.addEventListener?.('blur', onBlur); win?.addEventListener?.('pagehide', onPageHide);
  function dispose() {
    if (disposed) return;
    stop('dispose', .02); disposed = true;
    doc?.removeEventListener?.('visibilitychange', onHidden); win?.removeEventListener?.('blur', onBlur); win?.removeEventListener?.('pagehide', onPageHide);
    try { context?.close()?.catch?.(() => {}); } catch {}
    context = null;
  }
  return {
    start, stop, sync, dispose,
    get playing() { return Boolean(voice) && context.currentTime < voice.endAt + .7; },
    get stats() { return { ...stats, playing: this.playing, activeNodes: voice ? voice.nodes.length : 0, endsAt: voice?.endAt ?? null, now: context?.currentTime ?? null, contextState: context?.state ?? null }; },
  };
}
