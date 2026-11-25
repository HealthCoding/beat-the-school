// Robot vacuum 로봇청소기 sounds (user decision 2026-10-26): all WebAudio synthesis into the comic-audio master (src/audio.js
// output()), the same bus pattern as src/ruyi-audio.js. No samples, no timers.
//   motor  - a low "위잉" while any vacuum roams: a soft saw + sub through a low-pass, with a slow wobble and a fan hiss band.
//            One shared voice; motor(n) sets how many are running (0 fades it out and stops the nodes).
//   land   - a dull "쿵" when it lands on the ground
//   bump   - "툭": the bumper meeting a wall (short muffled knock + a plastic click)
//   chew   - the bite into the ground floor (rubble crunch, lighter than the bowling ball's)
//   suck   - "쓱": a falling hiss as rubble disappears into it
//   chime  - the short two-note "done" tone as it sparkles away
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export function createRobotVacuumAudio({ output = () => null, lite = false } = {}) {
  let ctx = null, bus = null, brown = null, white = null, voices = 0, motor = null;
  const MAX = lite ? 20 : 32, rnd = (a, b) => a + Math.random() * (b - a);
  function ready() {
    const out = output(); if (!out?.context || !out.destination) return null;
    if (out.context !== ctx) {
      ctx = out.context; voices = 0; motor = null;
      try {
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
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
  // ---------- the motor: built on demand, faded and stopped when nothing roams ----------
  function startMotor() {
    try {
      const t = ctx.currentTime, saw = ctx.createOscillator(), sub = ctx.createOscillator(), wob = ctx.createOscillator(), wg = ctx.createGain();
      const lp = ctx.createBiquadFilter(), fan = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), fg = ctx.createGain(), g = ctx.createGain();
      saw.type = 'sawtooth'; saw.frequency.value = 118; sub.type = 'sine'; sub.frequency.value = 59;
      wob.frequency.value = 3.2; wg.gain.value = 3.5; wob.connect(wg); wg.connect(saw.frequency); wg.connect(sub.frequency);
      lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 1.4;
      fan.buffer = white; fan.loop = true; bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = .9; fg.gain.value = .06;
      g.gain.setValueAtTime(.0001, t);
      saw.connect(lp); sub.connect(lp); lp.connect(g); fan.connect(bp).connect(fg).connect(g); g.connect(bus);
      for (const n of [saw, sub, wob, fan]) n.start(t);
      motor = { nodes: [saw, sub, wob, fan], gain: g, saw, lp, level: 0, stopAt: -1 };
    } catch { motor = null; }
  }
  function setMotor(n) {
    if (!ready()) return;
    const want = n > 0 ? clamp(.07 + .025 * (n - 1), 0, .12) : 0;
    if (want > 0 && (!motor || motor.stopAt >= 0)) { if (motor) stopNodes(); startMotor(); }
    if (!motor) return;
    const t = ctx.currentTime;
    if (want !== motor.level) {
      motor.level = want; motor.gain.gain.cancelScheduledValues(t); motor.gain.gain.setTargetAtTime(Math.max(.0001, want), t, want > 0 ? .12 : .08);
      if (want > 0) { motor.saw.frequency.setTargetAtTime(112 + n * 6, t, .2); motor.lp.frequency.setTargetAtTime(380 + n * 40, t, .2); }
      else { motor.stopAt = t + .5; for (const o of motor.nodes) try { o.stop(motor.stopAt); } catch {} }
    }
  }
  function stopNodes() { if (!motor) return; try { motor.gain.gain.cancelScheduledValues(ctx.currentTime); motor.gain.gain.setValueAtTime(.0001, ctx.currentTime); } catch {} for (const o of motor.nodes) try { o.stop(); } catch {} motor = null; }
  const cues = {
    land(k = 1) { const a = clamp(k, .3, 1.2); tone('sine', 95, 42, .32, .42 * a); noise(brown, .3, .34 * a, 'lowpass', 700, 120, .8); noise(white, .05, .08 * a, 'bandpass', 2600, 1800, 2, .01, .002); },
    bump(k = 1) { const a = clamp(k, .3, 1.2); noise(brown, .08, .42 * a, 'lowpass', 650, 180, 1.1, 0, .002); tone('sine', 190, 120, .07, .16 * a, 0, .002); tone('triangle', 1250, 1100, .03, .03 * a, .004, .001); },
    chew(k = 1) { const a = clamp(k, .2, 1.2); noise(brown, .22, .3 * a, 'lowpass', 900, 160, .9); const f = rnd(500, 1400); noise(white, .08, .1 * a, 'bandpass', f, f * .7, 1.8, rnd(0, .02)); },
    suck(k = 1) { const a = clamp(k, .3, 1.2); noise(white, .2, .09 * a, 'bandpass', rnd(2000, 2600), 650, 1.3, 0, .012); },
    chime() { tone('sine', 1318.5, 1318.5, .2, .09, 0, .004); tone('triangle', 2637, 2637, .14, .02, 0, .004); tone('sine', 1760, 1760, .34, .09, .15, .004); tone('triangle', 3520, 3520, .2, .018, .15, .004); },
  };
  return {
    play(id, a) { if (!ready() || !cues[id]) return false; cues[id](a); return true; },
    motor: setMotor,
    stop() { if (ctx && motor) stopNodes(); },
    get voices() { return voices; }, get motorOn() { return !!motor && motor.level > 0; }, get live() { return !!output(); },
  };
}
