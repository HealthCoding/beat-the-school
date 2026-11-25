// Generated Web Audio only; shares audio.js's master/mute. Bounded voices, no per-fragment nodes.
import { WEAPON_TUNING } from './weapon-tuning.js?v=sn130';
export function createBlackHoleAudio({ output = () => null, tuning = WEAPON_TUNING.blackhole } = {}) {
  let sources = [], connections = [], bus = null, ctx = null, noise = null;
  let bass = null, overtone = null, wind = null, filter = null, emphasis = null, drone = [], uppers = [];
  let lastFeed = -Infinity, feeds = 0, peakNodes = 0;
  const count = () => { peakNodes = Math.max(peakNodes, sources.length + connections.length); };
  function disconnect() {
    for (const node of connections) node.disconnect();
    connections = []; bus = bass = overtone = wind = filter = emphasis = null; drone = []; uppers = [];
  }
  function clear() {
    for (const source of sources) { source.onended = null; try { source.stop(); } catch {} source.disconnect(); }
    sources = []; disconnect(); lastFeed = -Infinity;
  }
  function own(node) { connections.push(node); count(); return node; }
  function play(source, end) {
    sources.push(source); count();
    source.onended = () => {
      const index = sources.indexOf(source);
      if (index < 0) return;
      sources.splice(index, 1); source.disconnect();
      if (!sources.length) disconnect();
    };
    source.start(); if (end !== undefined) source.stop(end);
  }
  function begin() {
    clear(); const out = output(); if (!out) return false;
    ctx = out.context; bus = own(ctx.createGain());
    const limiter = own(ctx.createDynamicsCompressor());
    limiter.threshold.value = -6; limiter.knee.value = 6; limiter.ratio.value = 8;
    limiter.attack.value = .004; limiter.release.value = .16;
    bus.connect(limiter).connect(out.destination);
    // One cached, bounded noise buffer, no external recording or per-frame allocation.
    if (!noise || noise.sampleRate !== ctx.sampleRate) {
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const samples = noise.getChannelData(0); let last = 0;
      for (let i = 0; i < samples.length; i++) {
        last = (last + (Math.random() * 2 - 1) * .1) / 1.1;
        samples[i] = Math.max(-1, Math.min(1, last * 3));
      }
    }
    return true;
  }
  function noiseSource() { const source = ctx.createBufferSource(); source.buffer = noise; source.loop = true; return source; }
  function oscillator(frequency, gain, destination) {
    const source = ctx.createOscillator(); source.type = 'sine'; source.frequency.value = frequency;
    const trim = own(ctx.createGain()); trim.gain.value = gain;
    source.connect(trim).connect(destination); play(source); return source;
  }
  function start() {
    if (!begin()) return;
    const now = ctx.currentTime;
    bus.gain.setValueAtTime(0, now); bus.gain.linearRampToValueAtTime(1, now + .3);
    bass = own(ctx.createGain()); bass.gain.value = tuning.hum * .18;
    overtone = own(ctx.createGain()); overtone.gain.value = tuning.hum * .04;
    emphasis = own(ctx.createGain()); emphasis.gain.value = 1;
    bass.connect(emphasis); overtone.connect(emphasis); emphasis.connect(bus);
    // Slight detuning creates actual acoustic beats, about one swell per second.
    drone = [oscillator(66, .40, bass), oscillator(67.1, .34, bass), oscillator(65.3, .26, bass)];
    uppers = [oscillator(198, .60, overtone), oscillator(199.2, .40, overtone)];
    filter = own(ctx.createBiquadFilter()); filter.type = 'lowpass'; filter.frequency.value = 130; filter.Q.value = .65;
    wind = own(ctx.createGain()); wind.gain.value = .001;
    const source = noiseSource(); source.connect(filter).connect(wind).connect(bus); play(source);
  }
  function update(progress) {
    if (!bus) return;
    if (!output()) { clear(); return; }
    if (!drone.length) return;
    const p = Math.max(0, Math.min(1, progress)), now = ctx.currentTime;
    const swell = Math.min(1, p * tuning.duration / tuning.anticipation), airflow = Math.max(0, (p - .16) / .84);
    bass.gain.setTargetAtTime(tuning.hum * (.18 + .82 * swell), now, .12);
    overtone.gain.setTargetAtTime(tuning.hum * (.04 + .24 * swell), now, .12);
    const base = 66 - 22 * swell;
    drone.forEach((source, i) => source.frequency.setTargetAtTime(base + [0, 1.1, -.7][i], now, .18));
    uppers.forEach((source, i) => source.frequency.setTargetAtTime(base * 3 + i * 1.2, now, .18));
    wind.gain.setTargetAtTime(tuning.wind * (.035 + .965 * airflow), now, .1);
    filter.frequency.setTargetAtTime(130 + 1170 * airflow * airflow, now, .12);
  }
  function feed() {
    if (!emphasis || !drone.length || ctx.currentTime - lastFeed < .22) return;
    const now = ctx.currentTime; lastFeed = now; feeds++;
    // Reuse one envelope, even when dozens of fragments arrive on the same frame.
    emphasis.gain.cancelScheduledValues(now); emphasis.gain.setValueAtTime(1, now);
    emphasis.gain.linearRampToValueAtTime(1.28, now + .035);
    emphasis.gain.exponentialRampToValueAtTime(1, now + .20);
  }
  function pop() {
    if (!output()) { clear(); return; }
    if (!bus && !begin()) return;
    const now = ctx.currentTime, length = Math.max(.2, tuning.pop ?? .7);
    bus.gain.cancelScheduledValues(now); bus.gain.setValueAtTime(1, now);
    // Crossfade the drone into the thump; do not abruptly cut a nonzero oscillator sample.
    for (const gain of [bass, overtone, wind]) if (gain) {
      gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(Math.max(.001, gain.gain.value), now);
      gain.gain.exponentialRampToValueAtTime(.001, now + .06);
    }
    for (const source of sources) source.stop(now + .08);
    drone = []; uppers = [];
    const sub = ctx.createOscillator(); sub.type = 'sine';
    sub.frequency.setValueAtTime(105, now); sub.frequency.exponentialRampToValueAtTime(28, now + length * .82);
    const thump = own(ctx.createGain());
    thump.gain.setValueAtTime(.001, now); thump.gain.linearRampToValueAtTime(tuning.popGain, now + .025);
    thump.gain.exponentialRampToValueAtTime(.001, now + length * .97);
    sub.connect(thump).connect(bus); play(sub, now + length);
    const dust = noiseSource(), lowpass = own(ctx.createBiquadFilter()), impact = own(ctx.createGain());
    lowpass.type = 'lowpass'; lowpass.frequency.setValueAtTime(1200, now);
    lowpass.frequency.exponentialRampToValueAtTime(95, now + length * .8); lowpass.Q.value = .7;
    impact.gain.setValueAtTime(tuning.popGain * .45, now);
    impact.gain.exponentialRampToValueAtTime(.001, now + length * .8);
    dust.connect(lowpass).connect(impact).connect(bus); play(dust, now + length);
  }
  return { start, update, feed, pop, clear, get voices() { return sources.length; },
    get stats() { return { nodes: sources.length + connections.length, peakNodes, feeds, voices: sources.length }; } };
}
