// Synthesised sounds of the three heavy weapons and the hospital shield ("팅"), ported from 시안/새무기_시안.html and
// 시안/병원_보호_시안.html. Plays into the comic audio master (src/audio.js output()), so the global sound switch and
// master level apply; it keeps its own small voice budget so 11 shots a second never starve the other tools' voices.
// No timers; long sounds are WebAudio envelopes. The minigun motor and the flame roar are two persistent loops.
// Round 5 (user 2026-10-18 "make the minigun sound like real gunfire"): each shot is one buffer voice picked from a few
// gunshot variants synthesised here at first use (supersonic snap + broadband crack with a sub-millisecond attack, low-mid
// body thump, action click, short tail), played with a small random pitch / level change so 11 shots a second never sound
// machine-identical, through an outdoor slap-back + diffuse tail (a convolver with a generated impulse response) and a
// soft limiter on the minigun's own bus (a wave-shaper: linear below .6, rounds off to .95 - no make-up gain, so the level
// is exactly the gain below; it goes straight to the master, not through the shared compressor). Under it: the motor whine and barrel whirr follow the spin, and a mechanical rattle
// runs while it fires. All synthesised (no samples). `lite` (coarse pointer = phone): fewer variants, fewer voices.
export function createHeavyAudio({ output = () => null, lite = !!globalThis.matchMedia?.('(pointer: coarse)')?.matches } = {}) {
  let ctx = null, bus = null, dest = null, noise = null, brown = null, loops = null, voices = 0, gun = null, gunVoices = 0, lastShot = -1;
  const MAX_VOICES = 40, GUN_VOICES = lite ? 5 : 9;
  function ready() {
    const out = output();
    if (!out?.context || !out.destination) return null;
    if (out.context !== ctx) {
      ctx = out.context; loops = null; voices = 0;
      try {
        // Level: the mock mixed at .8 into a compressor; the game master already sits at .19, so these keep the mock's
        // balance against the shotgun sample (peak about .2 at the speaker either way).
        bus = ctx.createGain(); bus.gain.value = 1;
        const comp = ctx.createDynamicsCompressor(); bus.connect(comp).connect(out.destination); dest = out.destination;
        noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        // brown (integrated) noise for the bazooka's low body and debris rumble, normalised to a peak of 1
        brown = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
        const b = brown.getChannelData(0); let last = 0, top = 0;
        for (let i = 0; i < b.length; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last; top = Math.max(top, Math.abs(last)); }
        for (let i = 0; i < b.length; i++) b[i] /= top || 1;
        gun = null; gunVoices = 0;
      } catch { ctx = null; bus = null; noise = null; brown = null; return null; }
    }
    return ctx;
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  function env(g, t, peak, att, dec) { g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + att + dec); }
  function track(source) { voices++; source.onended = () => { voices--; }; }
  function osc(type, f0, f1, dur, peak, delay = 0, att = .004) {
    if (!ctx || voices >= MAX_VOICES) return;
    try {
      const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + att + dur);
      env(g, t, peak, att, dur); o.connect(g).connect(bus); track(o); o.start(t); o.stop(t + att + dur + .05);
    } catch {}
  }
  function nz(dur, peak, type = 'lowpass', f0 = 1200, f1 = f0, q = .7, att = .003, delay = 0) {
    if (!ctx || voices >= MAX_VOICES) return;
    try {
      const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noise; f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + att + dur); f.Q.value = q;
      env(g, t, peak, att, dur); s.connect(f).connect(g).connect(bus); track(s); s.start(t, Math.random() * 1.5); s.stop(t + att + dur + .05);
    } catch {}
  }
  // Short low sine "thump": the pitch settles from f0 to f1 within `drop` seconds (a body, not a sweep), then decays.
  function thump(f0, f1, drop, dur, peak, delay = 0) {
    if (!ctx || voices >= MAX_VOICES) return;
    try {
      const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + drop);
      env(g, t, peak, .003, dur); o.connect(g).connect(bus); track(o); o.start(t); o.stop(t + dur + .06);
    } catch {}
  }
  // Noise layer from any buffer; the filter centre glides f0 -> f1 over the whole sound, the level fades from `peak`
  // to `peak * tail` linearly before a short exponential release (used for the rocket motor and the debris rumble).
  function bed(buf, dur, peak, type, f0, f1, q, att, tail = 1, delay = 0) {
    if (!ctx || !buf || voices >= MAX_VOICES) return;
    try {
      const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      const rel = Math.min(.12, dur * .3), end = t + att + dur;
      s.buffer = buf; s.loop = true; f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), end);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + att);
      g.gain.linearRampToValueAtTime(Math.max(.0002, peak * tail), end - rel); g.gain.exponentialRampToValueAtTime(.0001, end);
      s.connect(f).connect(g).connect(bus); track(s); s.start(t, Math.random() * (buf.duration - .1)); s.stop(end + .05);
    } catch {}
  }
  // ---------- minigun gunshot (round 5) ----------
  // One shot, synthesised into a buffer (mono, ~0.24 s). Layers, in order of arrival:
  //   snap  - the supersonic N-wave: a ~0.5 ms positive then negative ramp (the 'crack' edge)
  //   crack - white noise, 0.3 ms attack, 5-8 ms decay, high-passed and lifted around 2.6-4.2 kHz (muzzle blast)
  //   body  - a sine whose pitch drops 150-190 -> 62-80 Hz in 25 ms + low-passed noise (the low-mid thump)
  //   click - a 1.5 ms 5 kHz tick 4-7 ms later (the action)
  //   tail  - low-passed noise from 6 ms, 50 ms decay (the close air / ground), the space comes from the convolver
  function biquad(type, f, q, sr) { // RBJ cookbook coefficients -> direct form I filter (for synthesis only)
    const w = 2 * Math.PI * f / sr, c = Math.cos(w), a = Math.sin(w) / (2 * q);
    const b = type === 'bp' ? [a, 0, -a] : type === 'hp' ? [(1 + c) / 2, -(1 + c), (1 + c) / 2] : [(1 - c) / 2, 1 - c, (1 - c) / 2], a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return x => { const y = (b[0] * x + b[1] * x1 + b[2] * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  }
  function shotBuffer(seed) {
    const sr = ctx.sampleRate, n = Math.round(sr * .24), d = new Float32Array(n);
    let s = 1 + seed * 7919; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }, w = () => r() * 2 - 1, pick = (a, b) => a + r() * (b - a);
    const crackHz = pick(2600, 4200), crackTau = pick(.005, .008), f0 = pick(150, 190), f1 = pick(62, 80), bodyTau = pick(.03, .045), lpHz = pick(700, 1100), click = pick(.004, .007);
    const hpC = biquad('hp', 900, .7, sr), bpC = biquad('bp', crackHz, 1.1, sr), lpB = biquad('lp', lpHz, .7, sr), bpK = biquad('bp', 5200, 2.5, sr), lpT = biquad('lp', 1500, .7, sr);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const snap = t < .0005 ? t / .0005 : t < .0011 ? 1 - 2 * (t - .0005) / .0006 : t < .0016 ? -1 + (t - .0011) / .0005 : 0;
      const ce = (t < .0003 ? t / .0003 : Math.exp(-(t - .0003) / crackTau)), cn = w();
      const crack = (hpC(cn) * .7 + bpC(cn) * 1.6) * ce;
      const f = f1 + (f0 - f1) * Math.exp(-t / .009); ph += 2 * Math.PI * f / sr;
      const be = (t < .001 ? t / .001 : Math.exp(-(t - .001) / bodyTau));
      const body = Math.sin(ph) * be + lpB(w()) * 2.2 * (t < .0008 ? t / .0008 : Math.exp(-(t - .0008) / .022));
      const kt = t - click, clk = bpK(kt > 0 && kt < .0015 ? w() * (1 - kt / .0015) : 0) * 3; // filters keep ringing after their input stops
      const tail = lpT(t > .006 ? w() * Math.exp(-(t - .006) / .05) : 0) * 1.6;
      d[i] = snap * .5 + crack * .9 + body * .75 + clk * .15 + tail * .14;
    }
    let peak = 0; for (let i = 0; i < n; i++) { d[i] = Math.tanh(d[i] * 1.4) / Math.tanh(1.4); peak = Math.max(peak, Math.abs(d[i])); }
    const k = .95 / (peak || 1), fade = Math.round(sr * .02);
    for (let i = 0; i < n; i++) d[i] *= k * (i > n - fade ? (n - i) / fade : 1);
    const b = ctx.createBuffer(1, n, sr); b.getChannelData(0).set(d); return b;
  }
  // Outdoor space: slap-back off nearby buildings (taps at 23-130 ms) over a diffuse tail that darkens as it decays.
  function outdoorIR() {
    const sr = ctx.sampleRate, n = Math.round(sr * .7), b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let s = 77 + c * 101; const w = () => { s = (s * 16807) % 2147483647; return s / 1073741823.5 - 1; };
      let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / sr; if (t < .012) continue; const a = Math.exp(-(t - .012) / .16), k = Math.min(.9, .25 + t * 1.6); lp += (w() - lp) * (1 - k); d[i] = lp * a * .5; }
      for (const [t, g] of [[.023, .7], [.041, .45], [.067, .5], [.095, .3], [.13, .22]]) { const i = Math.round((t + c * .0031) * sr); for (let j = 0; j < 24; j++) d[i + j] += g * (1 - j / 24) * (j % 2 ? -1 : 1) * .6; }
    }
    return b;
  }
  function gunChain() {
    if (gun || !ctx) return gun;
    try {
      const input = ctx.createGain(), verb = ctx.createConvolver(), wet = ctx.createGain(), lim = ctx.createWaveShaper(), out = ctx.createGain();
      verb.normalize = true; verb.buffer = outdoorIR(); wet.gain.value = lite ? .22 : .3;
      // soft limiter: a held burst never clips; level (measured offline): one shot ~5 dB under a shotgun blast, held ~.12 RMS
      const curve = new Float32Array(2049); for (let i = 0; i < curve.length; i++) { const x = i / 1024 - 1, a = Math.abs(x); curve[i] = Math.sign(x) * (a < .6 ? a : .6 + .35 * Math.tanh((a - .6) / .35)); }
      lim.curve = curve; lim.oversample = lite ? 'none' : '2x'; out.gain.value = .4;
      input.connect(lim); input.connect(verb).connect(wet).connect(lim); lim.connect(out).connect(dest || bus);
      const shots = Array.from({ length: lite ? 4 : 6 }, (_, i) => shotBuffer(i + 1));
      gun = { input, shots };
    } catch { gun = null; }
    return gun;
  }
  function shot() {
    const g = gunChain(); if (!g || voices >= MAX_VOICES || gunVoices >= GUN_VOICES) return;
    try {
      let i = (Math.random() * g.shots.length) | 0; if (i === lastShot) i = (i + 1) % g.shots.length; lastShot = i;
      const t = ctx.currentTime, src = ctx.createBufferSource(), v = ctx.createGain();
      src.buffer = g.shots[i]; src.playbackRate.value = rnd(.94, 1.06); v.gain.value = rnd(.84, 1); // ~+-6 % pitch, 1.5 dB level
      src.connect(v).connect(g.input); voices++; gunVoices++; src.onended = () => { voices--; gunVoices--; };
      src.start(t); src.stop(t + .26);
    } catch {}
  }
  const cues = {
    // Bazooka shot: low thump (sine 100 -> 70 Hz in 45 ms + low-passed brown noise), a broadband noise whoosh and a hiss tail.
    launch() {
      thump(100, 70, .045, .14, .42); bed(brown, .12, .55, 'lowpass', 260, 120, .7, .003, .2);
      nz(.26, .26, 'bandpass', 900, 2400, .6, .008); nz(.34, .1, 'highpass', 3600, 4800, .7, .03, .04);
    },
    // Rocket motor while the rocket flies `dur` seconds: band-passed hiss 3 kHz -> 2.4 kHz with a little low rumble,
    // fading as it moves away. No oscillator.
    flight(dur) {
      const d = Math.min(1, Math.max(.15, Number(dur) || .32));
      bed(noise, d, .2, 'bandpass', 3000, 2400, .9, .025, .55); bed(noise, d, .09, 'bandpass', 1500, 1250, .7, .03, .5);
      bed(brown, d, .14, 'lowpass', 180, 150, .7, .04, .5);
    },
    // Explosion: highpassed crack, a deep body (low-passed brown noise 280 -> 140 Hz plus a short 56 -> 46 Hz sub),
    // then a debris rumble that fades over 0.8-1.6 s and a few small crumble ticks; round 3 adds a 44 -> 31 Hz sub drop
    // and a 1.6 s low tail (140 -> 70 Hz) so the bigger fireball does not sound thin.
    boom(scale = 1) {
      const k = Math.min(2, Math.max(.5, Number(scale) || 1)), m = Math.sqrt(k);
      nz(.03, .45, 'highpass', 1600, 1600, .7, .001);
      bed(brown, .5 * m, .7 * Math.min(1.15, m), 'lowpass', 280, 140, .8, .004, .35);
      thump(56, 46, .25, .55 * m, .55 * Math.min(1.15, m));
      bed(brown, 1.15 * k, .4, 'lowpass', 420, 170, .7, .06, .2, .03); bed(noise, .9 * k, .05, 'bandpass', 320, 220, .8, .05, .2, .05);
      for (let i = 0; i < 4; i++) { const f = rnd(450, 1300); nz(.05, .08 * m, 'bandpass', f, f * .8, 1.4, .002, rnd(.1, .6)); }
      // round 3 (bigger blast on screen): a deeper sub drop and a long low tail under the same crack and body
      thump(44, 31, .4, .95 * m, .42 * Math.min(1.15, m), .01); bed(brown, 1.6 * m, .32, 'lowpass', 140, 70, .7, .02, .25, .02);
    },
    // Minigun bullet meeting a wall: a dry tick (band noise) with a tiny low knock; rate-limited by the caller.
    impact() { const f = rnd(1600, 2600); nz(.03, .09, 'bandpass', f, f * .7, 1.3, .001); thump(rnd(150, 190), 90, .02, .05, .06); },
    // Ricochet: a short descending whine over a noise tick (subtle, rate-limited by the caller).
    ricochet() { const f = rnd(2600, 3400); osc('sine', f, f * .55, .16, .035, 0, .006); nz(.025, .06, 'highpass', 3000, 3000, .7, .001); },
    bullet() { shot(); },
    ping() { osc('sine', 2500, 1900, .1, .05); },
    // Hospital shield "팅" (mock A): a bright sine bell with a triangle overtone; the big one adds a rising third.
    shield(big = false) { osc('sine', 2100, 1500, big ? .7 : .45, big ? .3 : .2); osc('triangle', 3150, 2600, .35, .08); if (big) osc('sine', 700, 1050, .4, .12); },
    crumble() { for (let k = 0; k < 5; k++) { const f = rnd(260, 800); nz(.09, .2, 'bandpass', f, f, 1.6, .003, k * .035 + rnd(0, .02)); } },
    bounce() { osc('square', 330, 150, .12, .05); nz(.1, .15, 'bandpass', 900, 900, 1.5); },
    crackle() { nz(.022, .16, 'highpass', rnd(1800, 3500)); },
    ignite() { nz(.2, .3, 'lowpass', 600, 2200, .7, .02); },
  };
  function ensureLoops() {
    if (loops || !ctx) return;
    try {
      const t = ctx.currentTime;
      // minigun motor (round 5): an electric whine whose pitch follows the barrel spin (saw + a detuned gear harmonic through a
      // band-pass that tracks it), a barrel whirr (band noise wobbling at the rotation rate) and, while firing, the mechanical
      // rattle of the feed (band noise chopped by a 30-40 Hz pulse)
      const mo = ctx.createOscillator(), mo2 = ctx.createOscillator(), mf = ctx.createBiquadFilter(), mg = ctx.createGain();
      mo.type = 'sawtooth'; mo.frequency.value = 90; mo2.type = 'triangle'; mo2.frequency.value = 271; mf.type = 'bandpass'; mf.frequency.value = 400; mf.Q.value = 1.4; mg.gain.value = 0;
      mo.connect(mf); mo2.connect(mf); mf.connect(mg).connect(bus); mo.start(t); mo2.start(t);
      const ws = ctx.createBufferSource(); ws.buffer = noise; ws.loop = true;
      const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 300; wf.Q.value = 1.8;
      const wa = ctx.createGain(); wa.gain.value = .7; const wl = ctx.createOscillator(), wd = ctx.createGain(); wl.frequency.value = 6; wd.gain.value = .3; wl.connect(wd).connect(wa.gain);
      const wg = ctx.createGain(); wg.gain.value = 0; ws.connect(wf).connect(wa).connect(wg).connect(bus); ws.start(t, .37); wl.start(t);
      const rs = ctx.createBufferSource(); rs.buffer = noise; rs.loop = true;
      const rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 1900; rf.Q.value = 2.4;
      const ra = ctx.createGain(); ra.gain.value = .5; const rl = ctx.createOscillator(), rd = ctx.createGain(); rl.type = 'square'; rl.frequency.value = 33; rd.gain.value = .5; rl.connect(rd).connect(ra.gain);
      const rg = ctx.createGain(); rg.gain.value = 0; rs.connect(rf).connect(ra).connect(rg).connect(bus); rs.start(t, .91); rl.start(t);
      // flamethrower: looping noise, band-limited, amplitude wobbles (화르르)
      const fs = ctx.createBufferSource(); fs.buffer = noise; fs.loop = true;
      const fb = ctx.createBiquadFilter(); fb.type = 'bandpass'; fb.frequency.value = 650; fb.Q.value = .55;
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2400;
      const wob = ctx.createGain(); wob.gain.value = .7; const fg = ctx.createGain(); fg.gain.value = 0;
      const l1 = ctx.createOscillator(), l1g = ctx.createGain(); l1.frequency.value = 9; l1g.gain.value = .3; l1.connect(l1g).connect(wob.gain);
      const l2 = ctx.createOscillator(), l2g = ctx.createGain(); l2.frequency.value = 3.1; l2g.gain.value = 260; l2.connect(l2g).connect(fb.frequency);
      fs.connect(fb).connect(fl).connect(wob).connect(fg).connect(bus); fs.start(t); l1.start(t); l2.start(t);
      loops = { mo, mo2, mf, mg, wf, wl, wg, rl, rg, fg, spin: 0, flame: false, firing: false };
    } catch { loops = null; }
  }
  return {
    play(id, arg) { if (!ready() || !cues[id]) return false; cues[id](arg); return true; },
    // spin 0..1 (minigun barrel), flame on/off, firing (minigun rattle); loops are created on the first heavy-weapon use.
    setLoops(spin, flame, firing = false) {
      if (!loops && !spin && !flame) return;
      if (!ready()) return; ensureLoops(); if (!loops) return;
      firing = !!firing && spin > 0;
      if (Math.abs(loops.spin - spin) < .01 && loops.flame === flame && loops.firing === firing) return;
      loops.spin = spin; loops.flame = flame; loops.firing = firing;
      try {
        const t = ctx.currentTime, f = 90 + 390 * spin;
        loops.mo.frequency.setTargetAtTime(f, t, .06); loops.mo2.frequency.setTargetAtTime(f * 3.01, t, .06); loops.mf.frequency.setTargetAtTime(f * 2.2, t, .06);
        loops.mg.gain.setTargetAtTime(.05 * spin ** 1.4, t, .06);
        loops.wf.frequency.setTargetAtTime(300 + 900 * spin, t, .06); loops.wl.frequency.setTargetAtTime(4 + 30 * spin, t, .06); loops.wg.gain.setTargetAtTime(.06 * spin, t, .06);
        loops.rl.frequency.setTargetAtTime(28 + 10 * spin, t, .05); loops.rg.gain.setTargetAtTime(firing ? (lite ? .05 : .07) : 0, t, firing ? .02 : .05);
        loops.fg.gain.setTargetAtTime(flame ? .55 : 0, t, flame ? .03 : .06);
      } catch {}
    },
    stop() { if (loops) { loops.spin = -1; try { const t = ctx.currentTime; for (const g of [loops.mg, loops.wg, loops.rg]) g.gain.setTargetAtTime(0, t, .03); loops.fg.gain.setTargetAtTime(0, t, .04); } catch {} loops.spin = 0; loops.flame = false; loops.firing = false; } },
    get stats() { return { ready: Boolean(ctx), loops: Boolean(loops), voices, gunVoices, gunVariants: gun ? gun.shots.length : 0 }; },
  };
}
