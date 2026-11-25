// Ruyi staff 여의봉 sounds (user request 2026-10-26): all WebAudio synthesis into the comic-audio master (src/audio.js
// output()), same bus pattern as the wrecking ball. No samples, no timers.
//   glint   - a bright two-note chime as the short staff appears in the sky
//   stretch - "쭈욱": a fast rising, slightly wobbling tone with a rising wind band, timed to the stretch
//   slam    - "쾅": the bazooka body (heavy audio) under a sub drop, rubble crunch and a low bronze ring of the staff
//   crunch  - the tip punching through a roof / floor on the way down
//   clang   - stopped on a protected building's shield (the host adds the shield "팅")
//   retract - a lighter falling whoosh as it shrinks back into the sky
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export function createRuyiAudio({ output = () => null, heavy = null, lite = false } = {}) {
  let ctx = null, bus = null, brown = null, white = null, voices = 0;
  const MAX = lite ? 22 : 36, rnd = (a, b) => a + Math.random() * (b - a);
  function ready() {
    const out = output(); if (!out?.context || !out.destination) return null;
    if (out.context !== ctx) {
      ctx = out.context; voices = 0;
      try {
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
        bus = ctx.createGain(); bus.gain.value = .7; bus.connect(comp).connect(out.destination);
        brown = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); { const d = brown.getChannelData(0); let l = 0, top = 0; for (let i = 0; i < d.length; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l; top = Math.max(top, Math.abs(l)); } for (let i = 0; i < d.length; i++) d[i] /= top || 1; }
        white = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); { const d = white.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      } catch { ctx = null; bus = null; return null; }
    }
    return ctx;
  }
  const track = s => { voices++; s.onended = () => { voices = Math.max(0, voices - 1); }; };
  function noise(buf, dur, peak, type, f0, f1, q = 1, delay = 0, att = .004) {
    if (!ctx || voices >= MAX) return;
    try {
      const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = buf; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + att + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + att + dur);
      s.connect(f).connect(g).connect(bus); track(s); s.start(t, Math.random() * Math.max(0, buf.duration - dur - .2)); s.stop(t + att + dur + .05);
    } catch {}
  }
  function tone(type, f0, f1, dur, peak, delay = 0, att = .005) {
    if (!ctx || voices >= MAX) return;
    try {
      const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + att + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + att + dur);
      o.connect(g).connect(bus); track(o); o.start(t); o.stop(t + att + dur + .05);
    } catch {}
  }
  // "쭈욱": a saw through a band-pass that both climb fast, a vibrato that speeds up, the gain swelling to the end
  function stretch(dur) {
    if (!ctx || voices >= MAX - 3) return;
    try {
      const t = ctx.currentTime, o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(620, t + dur);
      lfo.frequency.setValueAtTime(9, t); lfo.frequency.linearRampToValueAtTime(26, t + dur); lg.gain.setValueAtTime(10, t); lg.gain.linearRampToValueAtTime(34, t + dur); lfo.connect(lg).connect(o.frequency);
      f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(420, t); f.frequency.exponentialRampToValueAtTime(2600, t + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.06, t + dur * .25); g.gain.linearRampToValueAtTime(.12, t + dur * .95); g.gain.exponentialRampToValueAtTime(.0001, t + dur + .06);
      o.connect(f).connect(g).connect(bus); track(o); o.start(t); lfo.start(t); o.stop(t + dur + .1); lfo.stop(t + dur + .1);
    } catch {}
    noise(white, dur, .16, 'bandpass', 380, 3400, 1.3, 0, dur * .8);   // rising wind
    noise(brown, dur * .9, .18, 'lowpass', 140, 520, .8, 0, dur * .7); // air pushed down
  }
  const cues = {
    glint() { tone('sine', 2350, 2500, .35, .06); tone('sine', 3520, 3700, .3, .035, .05); tone('triangle', 1175, 1250, .3, .03); },
    stretch(dur = .3) { stretch(dur); },
    crunch(k = 1) { const a = clamp(k, .2, 1.2); noise(brown, .28, .36 * a, 'lowpass', 900, 150, .9); const f = rnd(400, 1300); noise(white, .1, .13 * a, 'bandpass', f, f * .7, 1.8, rnd(0, .02)); },
    slam(k = 1) {
      heavy?.play('boom', clamp(1 + k * .3, 1, 1.5)); tone('sine', 58, 22, 1.05, .7 * k); noise(brown, .75, .6 * k, 'lowpass', 600, 70, .8); cues.crunch(k);
      // bronze staff ring: low inharmonic partials, slow decay
      tone('triangle', 196, 182, 1.1, .1); tone('sine', 523, 505, 1.3, .05); tone('sine', 931, 905, .9, .03); tone('sine', 1478, 1450, .6, .016);
      for (let i = 0; i < (lite ? 3 : 5); i++) { const f = rnd(300, 1200); noise(white, .12, .1, 'bandpass', f, f * .7, 1.6, .05 + i * .05 + rnd(0, .03)); }
    },
    clang(k = 1) { tone('triangle', 330, 290, .6, .12 * k); tone('sine', 990, 960, .9, .05 * k); tone('sine', 1650, 1610, .6, .03 * k); noise(white, .05, .16 * k, 'bandpass', 2400, 1800, 2, 0, .001); },
    retract(dur = .4) { noise(white, dur * .7, .09, 'bandpass', 2200, 500, 1.2, 0, dur * .3); tone('sine', 900, 420, dur * .8, .03, 0, .03); },
  };
  return { play(id, a, b) { if (!ready() || !cues[id]) return false; cues[id](a, b); return true; }, get voices() { return voices; }, get live() { return !!output(); } };
}
