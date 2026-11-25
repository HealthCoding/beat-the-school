// Laser cutter (free weapon, user decisions 2026-10-22 on 시안/무기_레이저절단기_시안.html): a hand-held cutter (view B), red beam,
// width 'mid', long afterglow, bag icon A. Hold and draw a line over a building: the beam scores the wall along the line
// (glowing mark, sparks, a little smoke). On release it is cut along the path as drawn (round 2, user 10-22): campus.cut
// (src/model-destruction.js split) takes the cells the path went through out as a groove (the ordinary debris path) and hands
// the cells above the path over as one held cluster, which this module slides down the face (a straight cut) or drops (a
// zigzag / curve), then turns to rubble. See cutEntry for the rules.
// The cut faces glow and cool: the fragments next to the groove (both sides) get the building shader's red-hot pulse, which
// fades and leaves a char tint, so the glow sits on the real walls and floors (as jagged as the cells, never a smooth cap).
// ?laser=new (A+C, 2026-10-23): only a .35 m strip at exposed cut edges melts, with .3 m of char outside it. The rest
// keeps the original lit material. Existing particle pools emit smaller rising sparks, falling droplets and pale smoke.
// Protected buildings are never cut: the beam meets the shield (onShield). Put away: beam, scored marks, the cut-face glow (it
// cools to its char tint at once) and sound go at once (a release glides out in .16 s, a cancel stops in 30 ms);
// a part already sliding keeps falling (it is building debris). All look objects exist from the start (compiled at boot,
// drawn with zero instances), so the first cut never compiles a shader. Numbers: src/weapon-tuning.js `laser`.
import { WEAPON_TUNING } from './weapon-tuning.js?v=sn130';
import { LASER_NEW } from './model-destruction.js?v=lz69';
export { LASER_NEW };

export const LASER_ID = 'laser';
const RAMP = ['#2a1c16', '#6e1a0c', '#c8320f', '#ff7a22', '#ffe6a6'];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- sound (re-synthesised 2026-10-22 from the measured reference, reference/laser-sound/reference.json) ----------
// The reference ("Laser Sound Effect", https://youtu.be/Utyfma7bBlc) was analysed only; none of its audio is used. Measured:
//   start   - a broadband noise burst, 6 ms attack, top roll-off ~10 kHz falling to ~3 kHz, ~15 dB above the steady tone,
//             with a low thump (30-140 Hz) in its first 50 ms
//   sustain - two inharmonic tones 1052 Hz and 2880 Hz (equal level), a weak 4840 Hz, 88 Hz and 521 Hz under them; both tones
//             wobble at 33 Hz (with a 16.5 Hz sub-rate): amplitude depth .75, pitch sd 36-40 Hz (both tones), and drift slowly
//             1034-1072 Hz
//   end     - the clip is cut while the tone sounds, so the release here is designed (a short downward glide and hiss)
// Game timing: the burst holds .12 s (reference .65 s) and falls into the tone in about .5 s (reference ~1.5 s at 10 dB/s), so
// a short stroke still hears the tone. On a wall the contact layer adds the burning crackle ("지지직": sparse clicks and a
// sizzle) and a low burn, and the tone sags a little. The landing thud and the cut hiss are the earlier sounds, unchanged.
// Stopping: release() glides out in .16 s; a cancel (weapon switch, hidden page, blur, clear) cuts everything in 30 ms.
// Level (reference/laser-sound/levels.json): the start, the tone and the release go to their own path (a peak guard only, not the
// shared compressor, which squashed the burst into the tone): held 3 dB (air) / 1.4 dB (on a wall) under the flamethrower, the
// start about 5.5 dB over the tone (reference 15 dB, kept 2.3 dB under the bazooka blast's peak). The cut and the landing keep the earlier compressed path.
const LZ = {
  // tones [Hz, level, follows the wobble / drift]; the wobble and drift move the tones by the same Hz (the reference's ~33 Hz
  // sidebands sit at the same spacing around both tones), the low ones stay put
  tones: [[1052, 1, 1], [2880, .95, 1], [4840, .24, 1], [521, .11, 0], [88, .14, 0]], toneGain: .057, fadeIn: .25,
  wobble: 33.1, wobbleSub: 16.5, amDepth: .52, amSub: .26, fmHz: 34, fmSubHz: 26, driftHz: .35, driftSwing: 19,
  burst: { peak: .28, att: .006, hold: .12, fall: .5, f0: 10000, f1: 3000, thump: .12 },
  crackle: .55, sizzle: .07, burn: .11, sagCents: -45,
  end: { glide: -500, time: .16, hiss: .1 },
};
export function createLaserAudio({ output = () => null, lite = false } = {}) {
  let ctx = null, bus = null, dry = null, white = null, crackleBuf = null, voices = 0, hum = null;
  const MAX = lite ? 14 : 24, fx = new Set();
  function ready() {
    const out = output(); if (!out?.context || !out.destination) return null;
    if (out.context !== ctx) {
      ctx = out.context; voices = 0; hum = null; fx.clear();
      try {
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
        bus = ctx.createGain(); bus.gain.value = .9; bus.connect(comp).connect(out.destination);
        // peak guard: linear below .5 (no make-up gain, no look-ahead delay), rounds off towards .9
        const guard = ctx.createWaveShaper(), curve = new Float32Array(2049);
        for (let i = 0; i < curve.length; i++) { const v = i / 1024 - 1, m = Math.abs(v); curve[i] = Math.sign(v) * (m < .5 ? m : .5 + .4 * Math.tanh((m - .5) / .4)); }
        guard.curve = curve; dry = ctx.createGain(); dry.gain.value = 1; dry.connect(guard).connect(out.destination);
        const sr = ctx.sampleRate;
        white = ctx.createBuffer(1, sr * 2, sr); const d = white.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        // burning crackle: about 45 clicks a second (1-4 ms noise decays, uneven sizes) over a faint sizzle
        crackleBuf = ctx.createBuffer(1, sr * 2, sr); const c = crackleBuf.getChannelData(0);
        for (let i = 0; i < c.length; i++) c[i] = (Math.random() * 2 - 1) * .12;
        for (let t = Math.random() * .02; t < 1.98; t += -Math.log(1 - Math.random()) / 45) {
          const i0 = Math.round(t * sr), a = Math.min(1, .25 + .75 * Math.random() ** 2.5), tau = sr * (.001 + Math.random() * .003);
          for (let j = 0; j < tau * 5 && i0 + j < c.length; j++) c[i0 + j] += (Math.random() * 2 - 1) * a * Math.exp(-j / tau);
        }
        let top = 0; for (let i = 0; i < c.length; i++) top = Math.max(top, Math.abs(c[i])); for (let i = 0; i < c.length; i++) c[i] /= top || 1;
      } catch { ctx = null; bus = null; dry = null; return null; }
    }
    return ctx;
  }
  const track = s => { voices++; s.onended = () => { voices = Math.max(0, voices - 1); }; };
  function noise(dur, peak, type, f0, f1, q = 1, delay = 0, att = .004, to = bus) {
    if (!ctx || voices >= MAX) return;
    try {
      const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = white; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + att + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + att + dur);
      s.connect(f).connect(g).connect(to); track(s); s.start(t, Math.random() * Math.max(0, white.duration - dur - .1)); s.stop(t + att + dur + .05);
      return { s, g };
    } catch {}
  }
  function tone(type, f0, f1, dur, peak, delay = 0, att = .004, to = bus) {
    if (!ctx || voices >= MAX) return;
    try {
      const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + att + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + att + dur);
      o.connect(g).connect(to); track(o); o.start(t); o.stop(t + att + dur + .05);
      return { s: o, g };
    } catch {}
  }
  // a one-shot that a stop has to reach (the start burst, the release hiss)
  const hold = v => { if (v) { fx.add(v); v.s.addEventListener?.('ended', () => fx.delete(v)); } return v; };
  // start: the noise burst (low-pass sweeping down) and the low thump under it
  function burst() {
    const B = LZ.burst;
    if (!ctx || voices >= MAX) return;
    try {
      const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + B.att + B.hold + B.fall;
      s.buffer = white; f.type = 'lowpass'; f.Q.value = .7; f.frequency.setValueAtTime(B.f0, t); f.frequency.setValueAtTime(B.f0, t + B.att + B.hold * .5); f.frequency.exponentialRampToValueAtTime(B.f1, end);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(B.peak, t + B.att); g.gain.setValueAtTime(B.peak, t + B.att + B.hold); g.gain.exponentialRampToValueAtTime(.0001, end);
      s.connect(f).connect(g).connect(dry); track(s); s.start(t, Math.random()); s.stop(end + .05); hold({ s, g });
    } catch {}
    hold(tone('sine', 120, 55, .1, B.thump, 0, .004, dry));
  }
  function startHum() {
    if (!ready() || hum) return;
    try {
      const t = ctx.currentTime, master = ctx.createGain(), sources = [];
      master.gain.setValueAtTime(.0001, t); master.gain.exponentialRampToValueAtTime(1, t + LZ.fadeIn); master.connect(dry);
      const lfo = (hz, depth, to, type = 'sine') => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = hz; g.gain.value = depth; o.connect(g); for (const p of to) g.connect(p); o.start(t); sources.push(o); return o; };
      // the tone: the measured partials through one amplitude wobble (33 Hz + 16.5 Hz), all detuned together (wobble + drift)
      const am = ctx.createGain(); am.gain.value = 1; const tg = ctx.createGain(); tg.gain.value = LZ.toneGain; am.connect(tg).connect(master);
      const moving = [], oscs = (lite ? LZ.tones.filter(([f]) => f !== 4840 && f !== 521) : LZ.tones).map(([hz, lv, fm]) => {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = hz; g.gain.value = lv;
        o.connect(g).connect(am); o.start(t); sources.push(o); if (fm) moving.push(o.frequency); return o;
      });
      lfo(LZ.wobble, LZ.amDepth, [am.gain]); lfo(LZ.wobble, LZ.fmHz, moving);
      if (!lite) { lfo(LZ.wobbleSub, LZ.amSub, [am.gain]); lfo(LZ.wobbleSub, LZ.fmSubHz, moving); }
      lfo(LZ.driftHz, LZ.driftSwing, moving, 'triangle');
      // contact: the crackle (band-limited clicks), the sizzle (high noise) and the burn (low noise); silent off the wall
      const cs = ctx.createBufferSource(), cb = ctx.createBiquadFilter(), crackle = ctx.createGain();
      cs.buffer = crackleBuf; cs.loop = true; cb.type = 'bandpass'; cb.frequency.value = 2400; cb.Q.value = .5; crackle.gain.value = 0;
      cs.connect(cb).connect(crackle).connect(master);
      const ns = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), sizzle = ctx.createGain(), lp = ctx.createBiquadFilter(), burn = ctx.createGain();
      ns.buffer = white; ns.loop = true; hp.type = 'highpass'; hp.frequency.value = 4500; sizzle.gain.value = 0; lp.type = 'lowpass'; lp.frequency.value = 480; burn.gain.value = 0;
      ns.connect(hp).connect(sizzle).connect(master); ns.connect(lp).connect(burn).connect(master);
      cs.start(t, Math.random() * 1.5); ns.start(t, Math.random() * 1.5); sources.push(cs, ns);
      hum = { master, crackle, sizzle, burn, oscs, sources, on: false };
    } catch { hum = null; }
  }
  // every one-shot a stop has to reach fades out within `tau` seconds
  function fadeFx(tau) {
    for (const v of fx) { try { const t = ctx.currentTime; v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, tau); v.s.stop(t + tau * 6); } catch {} }
    fx.clear();
  }
  return {
    startHum,
    // called every frame while held: on the wall the crackle flickers, the burn comes in and the tone sags; off it, all quiet
    contact(on) {
      if (!hum || !ctx) return;
      try {
        const t = ctx.currentTime, k = on ? .7 + Math.random() * .3 : 0, tau = on ? .012 : .03;
        hum.crackle.gain.setTargetAtTime(LZ.crackle * k, t, tau); hum.sizzle.gain.setTargetAtTime(LZ.sizzle * k, t, tau); hum.burn.gain.setTargetAtTime(on ? LZ.burn : 0, t, .05);
        if (on !== hum.on) { hum.on = on; for (const o of hum.oscs) o.detune.setTargetAtTime(on ? LZ.sagCents : 0, t, .04); }
      } catch {}
    },
    // soft = the player let go: the tone glides down and out with a short hiss; otherwise (a cancel) everything stops in 30 ms
    stopHum(soft = false) {
      const h = hum; hum = null;
      if (!ctx) return;
      if (!soft) fadeFx(.008); else fadeFx(.05);
      if (!h) return;
      try {
        const t = ctx.currentTime, E = LZ.end, end = soft ? E.time : .03;
        h.master.gain.cancelScheduledValues(t); h.master.gain.setValueAtTime(Math.max(.0001, h.master.gain.value), t); h.master.gain.exponentialRampToValueAtTime(.0001, t + end);
        if (soft) for (const o of h.oscs) { o.detune.cancelScheduledValues(t); o.detune.setValueAtTime(o.detune.value, t); o.detune.linearRampToValueAtTime(E.glide, t + end); }
        for (const s of h.sources) s.stop(t + end + .02);
      } catch {}
      if (soft) hold(noise(LZ.end.time, LZ.end.hiss, 'bandpass', 3000, 1200, .8, 0, .01, dry));
    },
    play(id, k = 1) {
      if (!ready()) return false;
      if (id === 'zap') burst();
      else if (id === 'cut') { noise(.42, .12, 'bandpass', 4200, 1300, 1.1); noise(.18, .07, 'highpass', 5000, 2500, .7, .02); tone('sine', 150, 62, .3, .06, .05); }
      else if (id === 'land') { const a = clamp(k, .35, 1.6); noise(.75, .32 * a, 'lowpass', 520, 55, .8); tone('sine', 74, 34, .42, .22 * a); noise(.35, .08 * a, 'bandpass', 1600, 500, .9, .04); }
      return true;
    },
    stop() { this.stopHum(false); },
    get voices() { return voices; }, get humming() { return !!hum; },
  };
}

// ---------- shaders ----------
const RAMP_GLSL = `uniform vec3 r0; uniform vec3 r1; uniform vec3 r2; uniform vec3 r3; uniform vec3 r4;
vec3 ramp(float h) { h = clamp(h, 0.0, 1.0) * 4.0;
  if (h < 1.0) return mix(r0, r1, h); if (h < 2.0) return mix(r1, r2, h - 1.0); if (h < 3.0) return mix(r2, r3, h - 2.0); return mix(r3, r4, h - 3.0); }`;
// Scored line: one instanced quad does both the opaque-ish char (alpha) and the additive glow (premultiplied: rgb = char * a +
// glow, blend ONE / ONE_MINUS_SRC_ALPHA). Heat = exp(-age / tau); it fades out at the end of its life, or quickly after aKill
// (the groove under it was cut out).
const MARK_VS = `attribute float aBorn; attribute float aKill; uniform float uTime; varying vec2 vUv; varying float vAge; varying float vKill;
void main() { vUv = uv; vAge = uTime - aBorn; vKill = uTime - aKill;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`;
const MARK_FS = `${RAMP_GLSL}
uniform float uTau; uniform float uLife; uniform float uRatio; varying vec2 vUv; varying float vAge; varying float vKill;
void main() {
  float h = exp(-max(vAge, 0.0) / uTau), fade = (1.0 - smoothstep(uLife * 0.6, uLife, vAge)) * (1.0 - smoothstep(0.0, 0.3, vKill));
  float x = abs(vUv.y * 2.0 - 1.0), a = 1.0 - smoothstep(uRatio * 0.55, uRatio, x), glow = exp(-x * x * 6.0) * 0.6 + exp(-x * x * 34.0) * 0.55;
  vec3 c = ramp(h); float ca = a * fade * 0.94; vec3 g = c * pow(h, 1.25) * glow * fade * 1.1;
  if (ca + g.r + g.g + g.b < 0.003) discard;
  gl_FragColor = vec4(c * ca + g, ca);
  #include <colorspace_fragment>
}`;
const NARROW_MARK_FS = `${RAMP_GLSL}
uniform float uTau; uniform float uLife; uniform float uRatio; uniform float uEmission;
varying vec2 vUv; varying float vAge; varying float vKill;
void main() {
  float h = exp(-max(vAge, 0.0) / uTau);
  float fade = (1.0 - smoothstep(uLife * .6, uLife, vAge)) * (1.0 - smoothstep(0.0, .3, vKill));
  float x = abs(vUv.y * 2.0 - 1.0), aa = max(fwidth(x), .002);
  float band = 1.0 - smoothstep(uRatio - aa, uRatio + aa, x);
  float alpha = (1.0 - smoothstep(1.0 - aa, 1.0, x)) * fade * .88;
  vec3 hot = ramp(h * (1.0 - smoothstep(0.0, uRatio, x)));
  gl_FragColor = vec4(r0 * alpha + hot * h * band * fade * uEmission, alpha);
  #include <colorspace_fragment>
}`;
const BEAM_VS = `attribute float across; varying float vA; void main() { vA = across; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_FS = `uniform vec3 coreC; uniform vec3 glowC; uniform float ratio; uniform float alpha; varying float vA;
void main() { float a = abs(vA), core = 1.0 - smoothstep(ratio * 0.5, ratio, a), glow = exp(-a * a * 6.0) * 0.85 + exp(-a * a * 40.0) * 0.6;
  gl_FragColor = vec4((glowC * glow + coreC * core) * alpha, 1.0);
  #include <colorspace_fragment>
}`;
const PTS_VS = `attribute float aSize; attribute vec4 aColor; uniform float uScale; varying vec4 vColor;
void main() { vColor = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = max(1.5, aSize * uScale / max(0.1, -mv.z)); }`;
const PTS_FS = `varying vec4 vColor;
void main() { vec2 c = gl_PointCoord * 2.0 - 1.0; float r = dot(c, c); if (r > 1.0) discard; float a = (1.0 - r);
  #ifdef ADDITIVE
  gl_FragColor = vec4(vColor.rgb * a * a * vColor.a, 1.0);
  #else
  gl_FragColor = vec4(vColor.rgb, a * vColor.a);
  #endif
  #include <colorspace_fragment>
}`;

// ---------- the hand-held cutter, +z forward, origin = body centre ----------
// Fibre-laser cleaning gun (user decision 2026-10-23: variant B of 시안/레이저_모델_시안.html, buildCleanB, 392 triangles):
// octagonal yellow tube with three square cooling fins and a fan cap (emission light on it), dark scan head with a yellow
// cover and a warning triangle, steel lens + dark cone (the beam leaves from tip), focus-distance rod, rear pistol grip with
// guard and trigger, front grip under the head, cable out of the back.
// Port tweak (10-23): the game camera sees it almost end-on, where the mock's dark fins + dark fan cap read as a black and
// yellow striped lump on a 390 phone, so the fan cap is yellow (continuous with the tube) and the fins are steel.
const LED_OFF = 0x4a1712, LED_ON = 0xff3b2a;
function buildCutter(THREE, own) {
  const g = new THREE.Group(), V = THREE.Vector3;
  const lam = c => own(new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
  const yellow = lam('#f2c230'), dark = lam('#2f353b'), steel = lam('#9aa5ab'), black = lam('#1c1c1c');
  const led = own(new THREE.MeshBasicMaterial({ color: LED_OFF }));
  const put = (geo, m, p, r = [0, 0, 0]) => { const o = new THREE.Mesh(own(geo), m); o.position.set(...p); o.rotation.set(...r); g.add(o); return o; };
  const box = (s, m, p, r) => put(new THREE.BoxGeometry(...s), m, p, r);
  const rod = (a, b, ra, rb, seg, m, open = false) => {
    const A = new V(...a), d = new V(...b).sub(A), o = put(new THREE.CylinderGeometry(rb, ra, d.length(), seg, 1, open), m, A.addScaledVector(d, .5).toArray());
    o.quaternion.setFromUnitVectors(new V(0, 1, 0), d.normalize()); return o;
  };
  const warn = (x, y, z) => { for (const [r, m, dx] of [[.066, black, 0], [.05, yellow, .004]]) { const t = new THREE.CylinderGeometry(r, r, .01, 3); t.rotateZ(Math.PI / 2).rotateX(-Math.PI / 2); put(t, m, [x + dx, y, z]); } };
  // tube, fins, fan cap
  rod([0, 0, -.5], [0, 0, 0], .14, .14, 8, yellow);
  for (const z of [-.38, -.28, -.18]) box([.31, .31, .024], steel, [0, 0, z]);
  rod([0, 0, -.56], [0, 0, -.5], .15, .15, 8, yellow);
  box([.22, .03, .012], steel, [0, 0, -.565]); box([.03, .22, .012], steel, [0, 0, -.565]);
  box([.04, .04, .02], led, [.09, .09, -.57]);
  // scan head, lens + cone, focus-distance rod
  box([.36, .34, .32], dark, [0, .04, .16]); box([.3, .035, .26], yellow, [0, .225, .16]); warn(.183, .05, .16);
  rod([0, .02, .32], [0, .02, .4], .1, .1, 8, steel); rod([0, .02, .4], [0, .02, .54], .095, .06, 8, dark);
  box([.022, .022, .36], steel, [0, -.12, .5]); box([.07, .022, .022], steel, [0, -.12, .68]);
  // rear grip (trigger, guard), front grip, cable
  box([.13, .4, .17], dark, [0, -.3, -.3], [.25, 0, 0]);
  box([.04, .1, .05], steel, [0, -.19, -.15], [.2, 0, 0]); box([.05, .03, .17], dark, [0, -.29, -.11]); box([.05, .15, .03], dark, [0, -.22, -.03]);
  box([.1, .26, .12], dark, [0, -.24, .15]); box([.12, .04, .14], black, [0, -.38, .15]);
  rod([0, 0, -.56], [0, -.05, -.72], .07, .055, 8, black); rod([0, -.05, -.7], [0, -.35, -1.3], .05, .05, 8, black, true);
  const tip = new THREE.Object3D(); tip.position.set(0, .02, .55); g.add(tip);
  return { g, tip, led };
}

export function createLaserCutter(THREE, scene, camera, {
  campus, tuning = WEAPON_TUNING.laser, reducedMotion = false, mobile = false, output = () => null, pixelRatio = () => 1,
  probe = () => null, onCut = () => {}, onShield = () => {}, onKick = () => {}, onLand = () => {},
} = {}) {
  const T = tuning, V3 = THREE.Vector3, UP = new V3(0, 1, 0), DOWN = new V3(0, -1, 0);
  const heightAt = (x, z) => { const h = campus.terrain.heightAt(x, z); return Number.isFinite(h) ? h : 0; };
  const audio = createLaserAudio({ output, lite: mobile });
  const owned = [], own = o => (owned.push(o), o);
  const lite = mobile ? .7 : 1, fxScale = reducedMotion ? .35 : 1;
  const MAX_MARKS = mobile ? T.marksPhone : T.marks, MAX_CHUNKS = mobile ? T.maxChunksPhone : T.maxChunks;
  const MAX_SPARK = LASER_NEW ? Math.ceil((mobile ? T.cutSparksPhone : T.cutSparks) * fxScale) : mobile ? T.sparksPhone : T.sparks;
  const MAX_SMOKE = LASER_NEW ? Math.ceil((mobile ? T.cutSmokePhone : T.cutSmoke) * fxScale) : mobile ? T.smokePhone : T.smoke;
  const tA = new V3(), tB = new V3(), tC = new V3(), tD = new V3(), tQ = new THREE.Quaternion(), tM = new THREE.Matrix4();
  const ramp = LASER_NEW ? [T.meltChar, T.meltRed, T.meltOrange, T.meltYellow, T.meltWhite].map(c => new THREE.Color().fromArray(c)) : RAMP.map(h => new THREE.Color(h));
  const rampU = {}; ramp.forEach((c, i) => { rampU['r' + i] = { value: c }; });
  const sparkColor = new THREE.Color(); // Vector3 has x/y/z, not r/g/b: particle colours need a Color.
  const rampCPU = (h, out) => { h = clamp(h, 0, 1) * 4; const i = Math.min(3, Math.floor(h)); return out.copy(ramp[i]).lerp(ramp[i + 1], h - i); };
  const clock = { value: 0 };

  // ---------- scored marks (instanced quads) ----------
  const quad = own(new THREE.PlaneGeometry(1, 1));
  function markMaterial(tau, life) {
    return own(new THREE.ShaderMaterial({ uniforms: { ...rampU, uTime: clock, uTau: { value: LASER_NEW ? T.meltTau : tau }, uLife: { value: life },
      uRatio: { value: LASER_NEW ? T.meltWidth / (T.meltWidth + T.charWidth * 2) : 1 / 3.6 }, uEmission: { value: T.meltEmission } },
      vertexShader: MARK_VS, fragmentShader: LASER_NEW ? NARROW_MARK_FS : MARK_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  }
  const markMat = markMaterial(T.glowTau, T.markLife);
  function instanced(material, max, renderOrder) {
    const geo = own(quad.clone()), born = new THREE.InstancedBufferAttribute(new Float32Array(max), 1), kill = new THREE.InstancedBufferAttribute(new Float32Array(max).fill(1e9), 1);
    born.setUsage(THREE.DynamicDrawUsage); kill.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aBorn', born); geo.setAttribute('aKill', kill);
    const mesh = new THREE.InstancedMesh(geo, material, max); mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = renderOrder; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return { mesh, born, kill, head: 0, n: 0, max, tag: new Array(max).fill(0) };
  }
  // ring buffer add: returns the slot
  function push(set, matrix, born, tag = 0) {
    const i = set.head; set.mesh.setMatrixAt(i, matrix); set.born.array[i] = born; set.kill.array[i] = 1e9; set.tag[i] = tag;
    set.head = (i + 1) % set.max; set.n = Math.min(set.max, set.n + 1); set.mesh.count = set.n;
    set.mesh.instanceMatrix.needsUpdate = true; set.born.needsUpdate = true; set.kill.needsUpdate = true; return i;
  }
  function emptySet(set) { set.n = 0; set.head = 0; set.mesh.count = 0; }
  const marks = instanced(markMat, MAX_MARKS, 3);
  scene.add(marks.mesh);

  // ---------- beam and hit glow (main scene) ----------
  const beamGeo = own(new THREE.BufferGeometry());
  beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)); beamGeo.setAttribute('across', new THREE.BufferAttribute(new Float32Array([-1, 1, -1, 1]), 1)); beamGeo.setIndex([0, 2, 1, 1, 2, 3]);
  const beamU = { coreC: { value: new THREE.Color(T.core) }, glowC: { value: new THREE.Color(T.glow) }, ratio: { value: T.coreWidth / T.glowWidth }, alpha: { value: 0 } };
  const beam = new THREE.Mesh(beamGeo, own(new THREE.ShaderMaterial({ uniforms: beamU, vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })));
  beam.frustumCulled = false; beam.renderOrder = 5; scene.add(beam);
  const radial = (() => { const n = 64, d = new Uint8Array(n * n * 4); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const r = Math.hypot(x + .5 - n / 2, y + .5 - n / 2) / (n / 2), i = (y * n + x) * 4; const a = r >= 1 ? 0 : r < .35 ? 1 - r / .35 * .55 : .45 * (1 - (r - .35) / .65); d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(clamp(a, 0, 1) * 255); }
    const t = own(new THREE.DataTexture(d, n, n, THREE.RGBAFormat)); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; })();
  const glowSprite = () => new THREE.Sprite(own(new THREE.SpriteMaterial({ map: radial, color: T.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })));
  const hitGlow = glowSprite(); hitGlow.renderOrder = 6; scene.add(hitGlow);

  // ---------- sparks (streaks + heads) and smoke / dust (points) ----------
  const sparkPos = new Float32Array(MAX_SPARK * 6), sparkCol = new Float32Array(MAX_SPARK * 6);
  const sparkLineGeo = own(new THREE.BufferGeometry());
  sparkLineGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3).setUsage(THREE.DynamicDrawUsage)); sparkLineGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3).setUsage(THREE.DynamicDrawUsage)); sparkLineGeo.setDrawRange(0, 0);
  const sparkLines = new THREE.LineSegments(sparkLineGeo, own(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  sparkLines.frustumCulled = false; sparkLines.renderOrder = 7; scene.add(sparkLines);
  function pointsSet(max, additive, renderOrder) {
    const geo = own(new THREE.BufferGeometry()), pos = new Float32Array(max * 3), size = new Float32Array(max), col = new Float32Array(max * 4);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('aColor', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage)); geo.setDrawRange(0, 0);
    const material = own(new THREE.ShaderMaterial({ uniforms: { uScale: { value: 400 } }, vertexShader: PTS_VS, fragmentShader: PTS_FS, defines: additive ? { ADDITIVE: '' } : {}, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    const points = new THREE.Points(geo, material); points.frustumCulled = false; points.renderOrder = renderOrder; scene.add(points);
    return { points, pos, size, col, geo, material };
  }
  const sparkPts = pointsSet(MAX_SPARK, true, 7), smokePts = pointsSet(MAX_SMOKE, false, 4);
  const sparks = Array.from({ length: MAX_SPARK }, () => ({ p: new V3(), v: new V3(), life: 0, age: 1 }));
  const smoke = Array.from({ length: MAX_SMOKE }, () => ({ p: new V3(), v: new V3(), life: 0, age: 1, s0: 1, s1: 2, a: .3, r: .55, g: .53, b: .5 }));
  let sparkAcc = 0, smokeAcc = 0, dropAcc = 0, sparkLive = 0, smokeLive = 0;
  function spark(p, n, drop = false) {
    const s = sparks.find(o => o.age >= o.life); if (!s) return;
    s.p.copy(p).addScaledVector(n, .05); s.v.copy(n).multiplyScalar(rnd(1.5, 4.5)).add(tA.set(rnd(-2.5, 2.5), rnd(.5, 3.5), rnd(-2.5, 2.5))); s.life = rnd(.25, .6); s.age = 0;
    s.drop = drop;
    if (LASER_NEW) {
      s.v.multiplyScalar(.6); s.v.y = drop ? rnd(-1.5, -.5) : rnd(2, 4);
      s.life = drop ? T.dropletLife : rnd(.45, .8);
      if (drop) { s.v.x *= .15; s.v.z *= .15; }
    }
  }
  function puff(p, s0, s1, a, life, r, g, b, v = null) {
    let s = smoke.find(o => o.age >= o.life); if (!s) s = smoke.reduce((m, o) => o.age / o.life > m.age / m.life ? o : m);
    s.p.copy(p); s.age = 0; s.life = life; s.s0 = s0; s.s1 = s1; s.a = a; s.r = r; s.g = g; s.b = b;
    if (v) s.v.copy(v); else s.v.set(rnd(-.15, .15), rnd(.6, 1.1), rnd(-.15, .15));
  }

  // ---------- held cutter (overlay pass, like the wrecking-ball remote) ----------
  const overlayScene = new THREE.Scene(), overlayCamera = new THREE.PerspectiveCamera();
  overlayCamera.matrixAutoUpdate = false; overlayCamera.matrixWorldAutoUpdate = false;
  const rig = new THREE.Group(); rig.matrixAutoUpdate = false; rig.visible = false; overlayScene.add(rig);
  overlayScene.add(new THREE.HemisphereLight('#f2f6ff', '#6d6457', 2.2));
  { const key = new THREE.DirectionalLight('#fff2dc', 1.6); key.position.set(.4, 1, .6); overlayScene.add(key); }
  const cutter = buildCutter(THREE, own); rig.add(cutter.g);
  const aimDummy = new THREE.Object3D(); rig.add(aimDummy);
  const tipGlow = glowSprite(); tipGlow.renderOrder = 10; tipGlow.material.depthTest = false; overlayScene.add(tipGlow);

  // ---------- state ----------
  let active = false, visible = false, holding = false, beamA = 0, cooldownUntil = -1, lastNow = 0, shieldAt = -9, contactAt = -9;
  const aim = { x: NaN, y: NaN, w: 1, h: 1, probedX: NaN, probedY: NaN, probedAt: -9 };
  const aimPoint = new V3(0, 0, 0), aimNormal = new V3(0, 1, 0), tip = new V3(); let aimHit = null, aimDistance = 60, hasAim = false;
  let strokeId = 0, lastSample = null; const stroke = new Map();
  const chunks = []; let peakChunks = 0;
  const stats = { presses: 0, samples: 0, cuts: 0, rejected: { short: 0, none: 0, failed: 0 }, shieldHits: 0, landed: 0, ended: 0, lastCut: null, probesMax: 0 };

  function pxWorld(depth) { return 2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, globalThis.innerHeight || aim.h || 800) * depth; }
  function rayPoint(x, y, dist, out) {
    camera.updateMatrixWorld(); tA.setFromMatrixPosition(camera.matrixWorld);
    out.set(x / Math.max(1, aim.w) * 2 - 1, -(y / Math.max(1, aim.h)) * 2 + 1, .5).unproject(camera).sub(tA).normalize();
    return out.multiplyScalar(dist).add(tA);
  }
  function addMark(a, b, now) {
    tA.copy(a.point).addScaledVector(a.normal, .04); tB.copy(b.point).addScaledVector(b.normal, .04);
    const dir = tC.subVectors(tB, tA), L = dir.length(); if (L < 1e-3) return;
    dir.multiplyScalar(1 / L); const n = tD.copy(a.normal).add(b.normal).normalize(), side = new V3().crossVectors(n, dir).normalize();
    const mid = new V3().addVectors(tA, tB).multiplyScalar(.5), w = Math.max(T.markWidth, T.markPixels * pxWorld(camera.position.distanceTo(mid)));
    const width = LASER_NEW ? (T.meltWidth + T.charWidth * 2) * (campus.worldUnitsPerMeter || .5) : w * 3.6 * 2;
    tM.makeBasis(dir.multiplyScalar(L + (LASER_NEW ? width * .1 : w * .8)), side.multiplyScalar(width), n).setPosition(mid);
    push(marks, tM, now, strokeId);
  }
  function sample(x, y, now) {
    const hit = probe(x, y); stats.samples++; aim.probedX = x; aim.probedY = y; aim.probedAt = now;
    if (!hit) { aimHit = null; lastSample = null; rayPoint(x, y, aimDistance, aimPoint); return null; }
    aimHit = hit; aimPoint.copy(hit.point); aimNormal.copy(hit.normal); aimDistance = Math.max(4, camera.position.distanceTo(hit.point)); hasAim = true;
    if (!holding) return hit;
    if (hit.kind === 'protected') {
      lastSample = null;
      if (now - shieldAt >= T.shieldPing) { shieldAt = now; stats.shieldHits++; onShield(hit.point.clone(), hit.normal.clone(), hit.site); }
      return hit;
    }
    contactAt = now;
    const s = { point: hit.point.clone(), normal: hit.normal.clone(), entry: hit.kind === 'building' ? hit.entry || null : null };
    if (lastSample && lastSample.entry === s.entry && lastSample.point.distanceTo(s.point) < 6) addMark(lastSample, s, now);
    lastSample = s;
    if (s.entry && !s.entry.cleared) { const r = stroke.get(s.entry); if (!r) stroke.set(s.entry, { n: 1, samples: [s] }); else { r.n++; if (r.samples.length < 800) r.samples.push(s); } }
    return hit;
  }

  // ---------- the cut (round 2, user 10-22: "cut along the drawn path") ----------
  // Every building the beam drew on is cut on its own. On a wall, the path is read in the wall's own 2D frame (a across the
  // wall, b up it). Mostly across: the cut line is the path's height b(a), interpolated between its samples - the cells it
  // passes through are the groove (through the whole depth) and the cells above it, between the path's two ends, fall. Mostly
  // up: the line is a(b) over the whole height and the lighter side falls (tips over when it stands on the ground). On a roof:
  // cut straight down along the path, the lighter side between its ends falls. A short path (< minStroke) or too few samples:
  // only the groove under the path, a cell or so deep.
  function polyDist(P, a, b) {
    if (P.length === 1) return Math.hypot(a - P[0].a, b - P[0].b);
    let best = Infinity;
    for (let i = 1; i < P.length; i++) {
      const p = P[i - 1], q = P[i], da = q.a - p.a, db = q.b - p.b, l2 = da * da + db * db, t = l2 > 1e-9 ? clamp(((a - p.a) * da + (b - p.b) * db) / l2, 0, 1) : 0;
      best = Math.min(best, Math.hypot(a - p.a - da * t, b - p.b - db * t));
    }
    return best;
  }
  // y(x) through points sorted by x, samples closer than `merge` along x averaged; clamped beyond the ends
  function profile(pts, merge) {
    const sorted = pts.slice().sort((p, q) => p.x - q.x), X = [], Y = [], N = [];
    for (const p of sorted) { const k = X.length - 1; if (k >= 0 && p.x - X[k] < merge) { Y[k] = (Y[k] * N[k] + p.y) / (N[k] + 1); N[k]++; } else { X.push(p.x); Y.push(p.y); N.push(1); } }
    const n = X.length - 1;
    return x => { if (x <= X[0]) return Y[0]; if (x >= X[n]) return Y[n]; let lo = 0, hi = n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (X[m] <= x) lo = m; else hi = m; } return Y[lo] + (Y[hi] - Y[lo]) * (x - X[lo]) / Math.max(1e-9, X[hi] - X[lo]); };
  }
  function cutEntry(entry, r, now) {
    const S = r.samples, scale = entry.model.group.matrixWorld.getMaxScaleOnAxis() || 1, cell = (entry.model.stats?.chunkSize || 3.2) * scale;
    const half = cell * T.kerfCells / 2, reach = cell * T.heatCells, peak = Math.min(.999, T.heatPeak);
    const nOut = new V3(); for (const q of S) nOut.add(q.normal); if (nOut.lengthSq() < 1e-8) nOut.copy(S[0].normal); nOut.normalize();
    const wall = Math.abs(nOut.y) < .7;
    const e1 = wall ? new V3().crossVectors(UP, nOut).normalize() : new V3().subVectors(S.at(-1).point, S[0].point).projectOnPlane(nOut);
    if (!wall && e1.lengthSq() < 1e-6) e1.set(1, 0, 0).projectOnPlane(nOut); e1.normalize();
    const e2 = new V3().crossVectors(nOut, e1).normalize();
    // the path in the wall frame, thinned to a fifth of a cell
    const P = [];
    for (const q of S) { const a = e1.dot(q.point), b = e2.dot(q.point); if (!P.length || Math.hypot(a - P.at(-1).a, b - P.at(-1).b) > cell * .2) P.push({ a, b, p: q.point }); }
    let length = 0; for (let i = 1; i < S.length; i++) length += S[i].point.distanceTo(S[i - 1].point);
    let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity; for (const q of P) { aMin = Math.min(aMin, q.a); aMax = Math.max(aMax, q.a); bMin = Math.min(bMin, q.b); bMax = Math.max(bMax, q.b); }
    const surface = nOut.dot(S[0].point);
    const near = (a, b) => a >= aMin - half - reach && a <= aMax + half + reach && b >= bMin - half - reach && b <= bMax + half + reach ? polyDist(P, a, b) : Infinity;
    const warmth = d => d <= reach ? peak * (1 - .55 * d / Math.max(1e-6, reach)) : 0;
    // straight or bent: the farthest sample from the chord, against the chord's length
    const c0 = P[0], c1 = P.at(-1), chord = Math.hypot(c1.a - c0.a, c1.b - c0.b); let dev = 0;
    for (const q of P) dev = Math.max(dev, chord > 1e-6 ? Math.abs((q.a - c0.a) * (c1.b - c0.b) - (q.b - c0.b) * (c1.a - c0.a)) / chord : 0);
    const straight = chord > cell && dev <= Math.max(cell * .45, chord * T.straight);
    const full = length >= T.minStroke && r.n >= T.minSamples && P.length >= 2;
    let classify, kind = 'groove', fallSide = 0;
    if (!full) {
      // groove only: the cells under the path (centres within 3/4 of a cell of it), from the wall a cell and a half deep
      classify = (x, y, z) => { tA.set(x, y, z); const a = e1.dot(tA), b = e2.dot(tA), depth = surface - nOut.dot(tA); if (depth < -cell || depth > cell * 1.5) return 0;
        const d = near(a, b), g = Math.max(half, cell * .75); return d <= g ? -1 : warmth(d - g); };
    } else if (!wall) {
      // drawn on a roof (a high camera): the path is cut straight down through the whole height, and between the path's two
      // ends the lighter side falls (it tips over away from the cut when it stands on the ground)
      kind = 'down'; const h1 = new V3(c1.p.x - c0.p.x, 0, c1.p.z - c0.p.z); if (h1.lengthSq() < 1e-6) h1.set(1, 0, 0); h1.normalize();
      const h2 = new V3().crossVectors(UP, h1).normalize(), Q = S.map(q => ({ x: h1.dot(q.point), y: h2.dot(q.point) }));
      let xMin = Infinity, xMax = -Infinity; for (const q of Q) { xMin = Math.min(xMin, q.x); xMax = Math.max(xMax, q.x); }
      const line = profile(Q, cell * .25), G = entry.model.group.matrixWorld; let wPos = 0, wNeg = 0;
      for (const pc of entry.model.pieces) { if (!pc.active) continue; tA.copy(pc.restPosition).applyMatrix4(G); const x = h1.dot(tA); if (x < xMin || x > xMax) continue; const dv = h2.dot(tA) - line(x); if (Math.abs(dv) <= half) continue; if (dv > 0) wPos += pc.weight; else wNeg += pc.weight; }
      fallSide = wPos <= wNeg ? 1 : -1; e1.copy(h2);
      classify = (x, y, z) => { tA.set(x, y, z); const u = h1.dot(tA); if (u < xMin - half || u > xMax + half) return 0;
        const dv = h2.dot(tA) - line(u); if (Math.abs(dv) <= half) return -1; const h = warmth(Math.abs(dv) - half);
        return dv * fallSide > 0 && u >= xMin && u <= xMax ? 2 + h : h; };
    } else if (aMax - aMin >= bMax - bMin) {
      kind = 'across'; const line = profile(P.map(q => ({ x: q.a, y: q.b })), cell * .25);
      classify = (x, y, z) => { tA.set(x, y, z); const a = e1.dot(tA), b = e2.dot(tA);
        if (a < aMin - half || a > aMax + half) { const d = near(a, b); return d <= half ? -1 : warmth(d - half); }
        const dv = b - line(a), d = Math.min(Math.abs(dv), near(a, b)); if (d <= half) return -1;
        const h = warmth(d - half); return dv > 0 && a >= aMin && a <= aMax ? 2 + h : h; };
    } else {
      kind = 'up'; const line = profile(P.map(q => ({ x: q.b, y: q.a })), cell * .25);
      // the lighter side falls
      let wPos = 0, wNeg = 0; const G = entry.model.group.matrixWorld;
      for (const pc of entry.model.pieces) { if (!pc.active) continue; tA.copy(pc.restPosition).applyMatrix4(G); const dv = e1.dot(tA) - line(e2.dot(tA)); if (Math.abs(dv) <= half) continue; if (dv > 0) wPos += pc.weight; else wNeg += pc.weight; }
      fallSide = wPos <= wNeg ? 1 : -1;
      classify = (x, y, z) => { tA.set(x, y, z); const a = e1.dot(tA), b = e2.dot(tA), dv = a - line(b);
        const inRange = b >= bMin - half && b <= bMax + half, d = Math.min(inRange ? Math.abs(dv) : Infinity, near(a, b));
        if (d <= half) return -1; const h = inRange ? warmth(Math.min(Math.abs(dv), d) - half) : 0; return dv * fallSide > 0 ? 2 + h : h; };
    }
    const mid = P[Math.floor(P.length / 2)].p.clone();
    while (full && chunks.length >= MAX_CHUNKS) endChunk(chunks[0], now, false);
    const t0 = performance.now();
    const heatNormal = !wall || kind === 'up' ? e1.clone() : new V3().crossVectors(new V3().subVectors(c1.p, c0.p), nOut);
    if (heatNormal.lengthSq() < 1e-8) heatNormal.copy(e2); heatNormal.normalize();
    const res = campus.cut(entry, classify, { point: mid, force: T.kerfForce, debrisNormal: nOut, minPieces: full ? 3 : Infinity,
      kerfFly: Math.round((mobile ? T.kerfFlyPhone : T.kerfFly) * (reducedMotion ? .5 : 1)),
      heat: LASER_NEW ? { tau: T.meltTau, char: T.charStrength, narrow: T, units: campus.worldUnitsPerMeter || .5, normal: heatNormal,
        budget: mobile ? T.cutWorkMsPhone : T.cutWorkMs } : { tau: T.glowTau * 1.7, char: T.char } });
    const ms = performance.now() - t0;
    if (!res.count) return null;
    let mode = null;
    if (res.chunk) {
      if (kind === 'up' || kind === 'down') mode = 'side';
      else if (straight) mode = 'slide'; else mode = 'drop';
      const chordV = new V3().subVectors(c1.p, c0.p), n = new V3().crossVectors(chordV, nOut);
      if (n.lengthSq() < 1e-8) n.copy(e2); n.normalize(); if (n.y < 0) n.negate();
      const fallN = kind === 'up' || kind === 'down' ? e1.clone().multiplyScalar(fallSide) : n;
      mode = startChunk(res.chunk, { mode, n, fallN, nOut, cell, now }).mode;
    }
    onCut(res, { point: mid, normal: nOut, radius: half * 2, force: T.kerfForce });
    return { entry: entry.id, kind, shape: kind === 'groove' ? 'groove' : straight ? 'straight' : 'bent', mode, kerf: res.kerf.length, chunk: res.chunk?.pieces.length ?? 0,
      path: +length.toFixed(2), bend: +(chord > 1e-6 ? dev / chord : 0).toFixed(3), cell: +cell.toFixed(3), count: res.count, cleared: res.cleared.length, ms: +ms.toFixed(2), P, nOut };
  }
  function cutStroke(now) {
    const recs = [...stroke].filter(([entry, r]) => !entry.cleared && r.samples.length);
    stroke.clear();
    if (!recs.length) { stats.rejected.none++; return false; }
    recs.sort((x, y) => y[1].n - x[1].n);
    const done = [];
    for (const [entry, r] of recs) { const c = cutEntry(entry, r, now); if (c) done.push(c); }
    if (!done.length) { stats.rejected.failed++; return false; }
    stats.cuts++; if (!done.some(c => c.chunk)) stats.rejected.short++;
    // the scored line sat on the groove that is gone now: it fades out quickly
    for (let i = 0; i < marks.n; i++) if (marks.tag[i] === strokeId) marks.kill.array[i] = now; marks.kill.needsUpdate = true;
    // a burst of sparks and smoke along the cut
    const burst = Math.round(26 * lite * fxScale), main = done[0];
    for (let i = 0; i < burst; i++) { const q = main.P[Math.floor(Math.random() * main.P.length)]; spark(q.p, main.nOut); }
    for (let i = 0; i < Math.round(8 * fxScale); i++) { const q = main.P[Math.floor(Math.random() * main.P.length)]; puff(tA.copy(q.p).addScaledVector(main.nOut, .4), .5, 2.2, LASER_NEW ? T.cutSmokeAlpha : .3, rnd(1.4, 2.2), .55, .53, .51); }
    audio.play('cut'); onKick('cut');
    stats.lastCut = { ...done[0], P: undefined, nOut: undefined, entries: done.map(c => c.entry) }; delete stats.lastCut.P; delete stats.lastCut.nOut;
    return true;
  }

  // ---------- the falling part ----------
  // mode: 'slide' (a straight cut: down the cut face), 'drop' (a bent cut: tremble, then fall), 'side' (a cut up the wall: the
  // lighter side tips over away from the cut when it stands on the ground, else it drops)
  function startChunk(src, { mode, n, fallN, nOut, cell, now }) {
    const { pieces, handle, model } = src, G = model.group.matrixWorld, N = pieces.length;
    const rest = new Float32Array(N * 3), C0 = new V3(), box = new THREE.Box3(), pb = new THREE.Box3();
    for (let i = 0; i < N; i++) { tA.copy(pieces[i].restPosition).applyMatrix4(G); rest[i * 3] = tA.x; rest[i * 3 + 1] = tA.y; rest[i * 3 + 2] = tA.z; C0.add(tA); box.union(pb.copy(pieces[i].bounds).applyMatrix4(G)); }
    C0.multiplyScalar(1 / N);
    const corners = []; for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new V3(x, y, z).sub(C0));
    const qg = new THREE.Quaternion(); G.decompose(tA, qg, tB); const qgInv = qg.clone().invert(), inverse = G.clone().invert();
    const c = { model, handle, pieces, rest, C0, C: C0.clone(), Q: new THREE.Quaternion(), corners, qg, qgInv, inverse, t: 0, state: 'shudder', cell,
      sp: 0, s: 0, vel: new V3(), om: 0, axis: new V3(1, 0, 0), size: box.getSize(new V3()).length(), born: now, weight: pieces.reduce((w, p) => w + p.weight, 0) };
    const extent = (dir, set) => { let lo = Infinity, hi = -Infinity; for (let i = 0; i < N; i++) { if (set && !set(i)) continue; const d = dir.x * rest[i * 3] + dir.y * rest[i * 3 + 1] + dir.z * rest[i * 3 + 2]; lo = Math.min(lo, d); hi = Math.max(hi, d); } return hi > lo ? hi - lo : 0; };
    const minY = box.min.y, ground = heightAt(C0.x, C0.z);
    if (mode === 'side' && minY < ground + cell * 1.5) {
      // a steep cut through a part that stands on the ground: it tips over away from the cut
      c.mode = 'topple'; const away = tA.set(fallN.x, 0, fallN.z); if (away.lengthSq() < 1e-6) away.set(nOut.x, 0, nOut.z); away.normalize();
      let far = -Infinity; for (const k of corners) far = Math.max(far, k.dot(away));
      c.pivot = C0.clone().addScaledVector(away, far); c.pivot.y = Math.min(minY, heightAt(c.pivot.x, c.pivot.z));
      c.axis.crossVectors(UP, away).normalize(); c.theta = 0; c.omega = .25;
    } else if (mode !== 'slide') {
      c.mode = 'drop'; c.slideDir = tA.copy(nOut).setY(0); if (c.slideDir.lengthSq() < 1e-6) c.slideDir.set(0, 0, 1); c.slideDir = c.slideDir.clone().normalize();
      c.axis.crossVectors(c.slideDir, DOWN).normalize();
    } else {
      c.mode = 'slide';
      const gt = tA.copy(DOWN).addScaledVector(n, -DOWN.dot(n)), out = tB.copy(nOut).addScaledVector(n, -nOut.dot(n)); if (out.lengthSq() > 1e-6) out.normalize();
      const acc = gt.multiplyScalar(T.slideAccel).addScaledVector(out, T.slidePush).addScaledVector(fallN, .3);
      c.slideDir = acc.lengthSq() > 1e-6 ? acc.clone().normalize() : nOut.clone(); c.slideAcc = Math.max(5, acc.length());
      // slide about half the cut face, measured on the cells next to the cut
      const base = (() => { let lo = Infinity; for (let i = 0; i < N; i++) lo = Math.min(lo, fallN.x * rest[i * 3] + fallN.y * rest[i * 3 + 1] + fallN.z * rest[i * 3 + 2]); return lo; })();
      const face = extent(c.slideDir, i => fallN.x * rest[i * 3] + fallN.y * rest[i * 3 + 1] + fallN.z * rest[i * 3 + 2] < base + cell * 1.6) || extent(c.slideDir);
      c.slideLen = face * .5 + cell * .5;
      c.axis.crossVectors(c.slideDir, DOWN); if (c.axis.lengthSq() < 1e-6) c.axis.crossVectors(nOut, DOWN); if (c.axis.lengthSq() < 1e-6) c.axis.set(1, 0, 0); c.axis.normalize();
    }
    chunks.push(c); peakChunks = Math.max(peakChunks, chunks.length);
    poseChunk(c); return c;
  }
  function poseChunk(c) {
    const lq = tQ.copy(c.qgInv).multiply(c.Q).multiply(c.qg), r = c.rest;
    for (let i = 0; i < c.pieces.length; i++) {
      const p = c.pieces[i]; tA.set(r[i * 3] - c.C0.x, r[i * 3 + 1] - c.C0.y, r[i * 3 + 2] - c.C0.z).applyQuaternion(c.Q).add(c.C).applyMatrix4(c.inverse);
      p.position.copy(tA); p.quaternion.copy(lq); c.handle.pose(p);
    }
    c.handle.touch();
  }
  function lowest(c) { let low = Infinity, at = null; for (const k of c.corners) { tA.copy(k).applyQuaternion(c.Q).add(c.C); const d = tA.y - heightAt(tA.x, tA.z); if (d < low) { low = d; at = at || new V3(); at.copy(tA); } } return { low, at }; }
  function stepChunk(c, dt, now) {
    c.t += dt;
    if (c.state === 'shudder') {
      const j = reducedMotion ? 0 : c.cell * .035; c.C.copy(c.C0).add(tA.set(rnd(-j, j), rnd(-j, j) * .4, rnd(-j, j)));
      if (c.t >= T.shudder * (c.mode === 'drop' ? 1.6 : 1)) { c.C.copy(c.C0); c.state = c.mode === 'drop' ? 'fall' : c.mode; if (c.mode === 'drop') c.vel.copy(c.slideDir).multiplyScalar(1.2); }
    } else if (c.state === 'slide') {
      c.sp += c.slideAcc * dt; const ds = c.sp * dt; c.s += ds; c.C.addScaledVector(c.slideDir, ds);
      if (c.s >= c.slideLen) { c.state = 'fall'; c.vel.copy(c.slideDir).multiplyScalar(c.sp); }
    } else if (c.state === 'fall') {
      c.vel.y -= T.gravity * dt; c.C.addScaledVector(c.vel, dt); c.om = Math.min(T.spin, c.om + 2.4 * dt);
      c.Q.premultiply(tQ.setFromAxisAngle(c.axis, c.om * dt));
      if (lowest(c).low < .1) { endChunk(c, now, true); return; }
    } else if (c.state === 'topple') {
      c.omega += T.toppleRate * (.3 + Math.sin(c.theta)) * dt; c.theta += c.omega * dt;
      c.Q.setFromAxisAngle(c.axis, c.theta); c.C.copy(c.C0).sub(c.pivot).applyQuaternion(c.Q).add(c.pivot);
      if (c.theta > 1.3) { c.vel.set(0, -c.omega * c.size * .25, 0); endChunk(c, now, true); return; }
    }
    if (c.t > T.maxFall) { endChunk(c, now, true); return; }
    poseChunk(c);
  }
  // rubble: a few fragments fly off as debris, the rest sinks into a dust cloud
  function endChunk(c, now, landed) {
    const i = chunks.indexOf(c); if (i < 0) return; chunks.splice(i, 1);
    poseChunk(c);
    const fly = Math.min(c.pieces.length, Math.round((mobile ? T.landFlyPhone : T.landFly) * (reducedMotion ? .5 : 1))), stride = Math.max(1, Math.floor(c.pieces.length / Math.max(1, fly)));
    const v = new V3(), cx = c.C.x, cz = c.C.z;
    for (let k = 0; k < c.pieces.length; k++) {
      const p = c.pieces[k];
      if (k % stride === 0 && k / stride < fly) {
        const r = c.rest; tA.set(r[k * 3] - c.C0.x, r[k * 3 + 1] - c.C0.y, r[k * 3 + 2] - c.C0.z).applyQuaternion(c.Q).add(c.C);
        v.set(tA.x - cx, 0, tA.z - cz); if (v.lengthSq() < 1e-6) v.set(Math.sin(k), 0, Math.cos(k)); v.normalize().multiplyScalar(rnd(1.2, 3.4)).addScaledVector(c.vel, .25); v.y = rnd(1.4, 4.2);
        if (!c.handle.fly(p, v, 3)) c.handle.sink(p);
      } else c.handle.sink(p);
    }
    c.handle.touch();
    if (landed) {
      stats.landed++;
      const at = lowest(c).at || c.C, size = clamp(c.size, 4, 60), dust = Math.round(clamp(size * .9, 8, 26) * (reducedMotion ? .5 : 1) * lite);
      for (let k = 0; k < dust; k++) {
        tA.set(at.x + rnd(-size, size) * .35, 0, at.z + rnd(-size, size) * .35); tA.y = heightAt(tA.x, tA.z) + rnd(.3, 1.5);
        puff(tA, size * .08, size * rnd(.22, .34), .5, rnd(2.2, 3.6), .85, .81, .74, tB.set(rnd(-1.2, 1.2), rnd(.3, 1.1), rnd(-1.2, 1.2)));
      }
      audio.play('land', size / 26);
      onLand({ point: at.clone(), size, count: c.pieces.length, weight: c.weight });
    } else stats.ended++;
  }

  // ---------- frame ----------
  function update(simDt, realDt, now = performance.now() / 1000) {
    lastNow = now; clock.value = now;
    const dt = Math.max(0, Math.min(.05, Number.isFinite(simDt) ? simDt : 0)), rdt = Math.max(0, Math.min(.1, Number.isFinite(realDt) ? realDt : 0));
    // probes: while held, along the pointer path (at most 3 per frame); hovering, at most 10 a second
    if (visible && [aim.x, aim.y].every(Number.isFinite)) {
      if (holding) {
        const dx = aim.x - aim.probedX, dy = aim.y - aim.probedY, d = Number.isFinite(dx) ? Math.hypot(dx, dy) : 0;
        if (d > .5) { const steps = Math.min(3, Math.max(1, Math.ceil(d / T.probeGap))), x0 = aim.probedX, y0 = aim.probedY; for (let k = 1; k <= steps; k++) sample(x0 + dx * k / steps, y0 + dy * k / steps, now); stats.probesMax = Math.max(stats.probesMax, steps); }
      } else if ((aim.x !== aim.probedX || aim.y !== aim.probedY) && now - aim.probedAt > .1) sample(aim.x, aim.y, now);
    }
    const onSurface = holding && aimHit && aimHit.kind !== 'protected' && now - contactAt < .2;
    audio.contact(Boolean(onSurface && aimHit.kind === 'building'));
    beamA = holding ? 1 : Math.max(0, beamA - rdt / T.beamFade);
    if (onSurface && rdt > 0) {
      sparkAcc += rdt * (LASER_NEW ? T.cutSparkRate : T.sparkRate) * lite * fxScale; while (sparkAcc > 1) { spark(aimHit.point, aimHit.normal); sparkAcc--; }
      if (LASER_NEW) { dropAcc += rdt * T.dropletRate * lite * fxScale; while (dropAcc > 1) { spark(aimHit.point, aimHit.normal, true); dropAcc--; } }
      smokeAcc += rdt * (LASER_NEW ? T.cutSmokeRate : T.smokeRate) * fxScale * (mobile ? .7 : 1); while (smokeAcc > 1) { puff(tA.copy(aimHit.point).addScaledVector(aimHit.normal, .25), .3, 1.6, LASER_NEW ? T.cutSmokeAlpha : .38, rnd(1.1, 1.9), .54, .52, .5); smokeAcc--; }
    }
    for (const c of [...chunks]) stepChunk(c, dt, now);
    // sparks
    let m = 0; const col = LASER_NEW ? sparkColor : tB;
    for (const s of sparks) {
      if (s.age >= s.life) continue;
      s.age += rdt; s.v.y -= (s.drop ? T.dropletGravity : 9) * rdt; s.p.addScaledVector(s.v, rdt);
      const g = heightAt(s.p.x, s.p.z) + .03; if (s.p.y < g) { if (s.drop) { s.age = s.life; continue; } s.p.y = g; s.v.y *= -.35; s.v.x *= .6; s.v.z *= .6; }
      const t = Math.min(1, s.age / s.life); rampCPU(1 - t * .75, col).multiplyScalar(1.6 * (1 - t));
      sparkPos.set([s.p.x, s.p.y, s.p.z, s.p.x - s.v.x * .03, s.p.y - s.v.y * .03, s.p.z - s.v.z * .03], m * 6);
      sparkCol.set([col.r, col.g, col.b, col.r * .3, col.g * .2, col.b * .1], m * 6);
      sparkPts.pos.set([s.p.x, s.p.y, s.p.z], m * 3); sparkPts.size[m] = s.drop ? T.dropletSize : LASER_NEW ? .075 : .16; sparkPts.col.set([col.r, col.g, col.b, 1], m * 4); m++;
    }
    sparkLive = m; sparkLineGeo.setDrawRange(0, m * 2); sparkPts.geo.setDrawRange(0, m);
    if (m) { sparkLineGeo.attributes.position.needsUpdate = sparkLineGeo.attributes.color.needsUpdate = true; for (const k of ['position', 'aSize', 'aColor']) sparkPts.geo.attributes[k].needsUpdate = true; }
    // smoke / dust
    let q = 0;
    for (const s of smoke) {
      if (s.age >= s.life) continue;
      s.age += rdt; if (s.age >= s.life) continue;
      const t = s.age / s.life; s.p.addScaledVector(s.v, rdt); s.p.x += .3 * rdt;
      smokePts.pos.set([s.p.x, s.p.y, s.p.z], q * 3); smokePts.size[q] = s.s0 + (s.s1 - s.s0) * Math.sqrt(t);
      smokePts.col.set([s.r, s.g, s.b, s.a * Math.min(1, t * 6) * (1 - t)], q * 4); q++;
    }
    smokeLive = q; smokePts.geo.setDrawRange(0, q); if (q) for (const k of ['position', 'aSize', 'aColor']) smokePts.geo.attributes[k].needsUpdate = true;
    const uScale = (globalThis.innerHeight || aim.h || 800) * pixelRatio() / (2 * Math.tan(camera.fov * Math.PI / 360));
    sparkPts.material.uniforms.uScale.value = smokePts.material.uniforms.uScale.value = uScale;
    // the cutter points at the aim (smoothed)
    if (visible) {
      syncRig(); if (!hasAim && [aim.x, aim.y].every(Number.isFinite)) rayPoint(aim.x, aim.y, aimDistance, aimPoint);
      holdToward(holding && !aimHit ? rayPoint(aim.x, aim.y, aimDistance, tA) : aimPoint);
      cutter.g.quaternion.slerp(aimDummy.quaternion, rdt > 0 ? 1 - Math.exp(-rdt * 16) : 1);
    }
  }
  // Held three-quarter on (user 10-23, so the lens, cone, focus rod and front grip show as in the mock's close-up rather than
  // the back of the tool): the barrel is turned further away from the line of sight by `turn`, inside the plane through the
  // eye, the tool and the aim. Every direction in that plane draws on screen along the same line, so the beam from the lens
  // to the aim still runs straight out of the barrel on screen and ends exactly where the player points. `roll` then turns
  // the right side (warning triangle, focus rod) towards the camera. A phone holds it near the right edge with the beam going
  // nearly straight up, where only the roll can show the side. The barrel never turns past 80 degrees from the line of sight
  // (aiming far to the side would otherwise show its front). `size` is smaller than the straight-on hold (.5 / .36) because a
  // tool seen side on is longer on screen; the footprint stays about the old cutter's.
  const HOLD = { wide: { turn: 40 * Math.PI / 180, roll: -.3, size: .35 }, tall: { turn: 40 * Math.PI / 180, roll: .5, size: .26 } }, MAX_TURN = 80 * Math.PI / 180;
  const FWD = new V3(0, 0, 1), hE = new V3(), hF = new V3(), hN = new V3(), hQ = new THREE.Quaternion(), hM = new THREE.Matrix4();
  let hold = HOLD.wide;
  function holdToward(target) {
    const at = aimDummy.position, f = rig.worldToLocal(hE.copy(target)).sub(at).normalize(), v = hF.copy(at).normalize();
    hN.crossVectors(v, f);
    if (hN.lengthSq() > 1e-8) f.applyAxisAngle(hN.normalize(), clamp(MAX_TURN - v.angleTo(f), 0, hold.turn));
    hM.lookAt(hF.copy(at).add(f), at, UP);
    aimDummy.quaternion.setFromRotationMatrix(hM).multiply(hQ.setFromAxisAngle(FWD, hold.roll));
  }
  function syncRig() {
    camera.updateMatrixWorld(); rig.matrix.copy(camera.matrixWorld); rig.matrixWorld.copy(camera.matrixWorld);
    const p = camera.projectionMatrix.elements, halfW = 1 / p[0], halfH = 1 / p[5], tall = halfW < halfH;
    // a tall (phone) screen holds it further right and a little smaller, so it points in across the screen (side on) rather
    // than straight up the middle (seen from behind)
    const fx = tall ? .7 : .62, fy = tall ? -.62 : -.6;
    hold = tall ? HOLD.tall : HOLD.wide;
    cutter.g.scale.setScalar(halfH * hold.size);
    const jig = holding && !reducedMotion ? .004 : 0;
    cutter.g.position.set(halfW * fx + rnd(-jig, jig), halfH * fy + rnd(-jig, jig), -1);
    aimDummy.position.set(halfW * fx, halfH * fy, -1);
    rig.updateMatrixWorld(true);
  }
  // after the screen kick moved the camera: the beam from the nozzle to the aim, the glows
  function pose() {
    beam.visible = false; hitGlow.visible = false; tipGlow.visible = false;
    if (!visible) return;
    syncRig(); cutter.tip.getWorldPosition(tip);
    cutter.led.color.set(beamA > .001 ? LED_ON : LED_OFF);
    if (beamA <= .001) return;
    const flick = reducedMotion ? 1 : .9 + Math.random() * .1, end = holding && !aimHit ? rayPoint(aim.x, aim.y, aimDistance, tB) : tB.copy(aimPoint);
    const pos = beamGeo.attributes.position, cam = camera.position, axis = tC.subVectors(end, tip).normalize();
    [tip, end].forEach((pt, i) => { const view = tA.subVectors(pt, cam), side = tD.crossVectors(axis, view).normalize(), w = T.glowWidth / 2 * pxWorld(view.length());
      pos.setXYZ(i * 2, pt.x - side.x * w, pt.y - side.y * w, pt.z - side.z * w); pos.setXYZ(i * 2 + 1, pt.x + side.x * w, pt.y + side.y * w, pt.z + side.z * w); });
    pos.needsUpdate = true; beamGeo.computeBoundingSphere(); beamU.alpha.value = beamA * flick; beam.visible = true;
    if (aimHit && aimHit.kind !== 'protected') {
      const d = cam.distanceTo(end); hitGlow.position.copy(end).addScaledVector(tA.subVectors(cam, end).normalize(), Math.min(.6, d * .05));
      hitGlow.scale.setScalar(pxWorld(d) * T.glowWidth * 3.2 * flick); hitGlow.material.opacity = beamA; hitGlow.visible = true;
    }
    tipGlow.position.copy(tip); tipGlow.scale.setScalar(pxWorld(cam.distanceTo(tip)) * T.glowWidth * 2.4); tipGlow.material.opacity = beamA; tipGlow.visible = true;
  }
  function render(renderer) {
    if (!visible) return false;
    overlayCamera.projectionMatrix.copy(camera.projectionMatrix); overlayCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    overlayCamera.matrixWorld.copy(camera.matrixWorld); overlayCamera.matrixWorldInverse.copy(camera.matrixWorldInverse);
    const autoClear = renderer.autoClear;
    try { renderer.autoClear = false; renderer.clearDepth(); renderer.render(overlayScene, overlayCamera); } finally { renderer.autoClear = autoClear; }
    return true;
  }

  // ---------- input ----------
  function setAim(x, y, w, h) { if ([x, y].every(Number.isFinite)) { aim.x = x; aim.y = y; } if (w > 0) aim.w = w; if (h > 0) aim.h = h; }
  function press(now = performance.now() / 1000) {
    if (!visible || holding || now < cooldownUntil || ![aim.x, aim.y].every(Number.isFinite)) return false;
    holding = true; strokeId++; stroke.clear(); lastSample = null; stats.presses++; aim.probedX = NaN;
    sample(aim.x, aim.y, now); audio.startHum(); audio.play('zap');
    return true;
  }
  function release(cut = true) {
    if (!holding) return false; holding = false; lastSample = null; audio.stopHum(cut);
    if (!cut) { stroke.clear(); return false; }
    const done = cutStroke(lastNow); if (done) cooldownUntil = lastNow + T.cooldown; return done;
  }
  function cancel() { return release(false); }
  // looks of the weapon in hand (not the falling parts, which are building debris)
  function clearLook() {
    emptySet(marks);
    sparkAcc = smokeAcc = dropAcc = 0;
    for (const s of sparks) s.age = s.life = 0; for (const s of smoke) s.age = s.life = 0; sparkLive = smokeLive = 0;
    sparkLineGeo.setDrawRange(0, 0); sparkPts.geo.setDrawRange(0, 0); smokePts.geo.setDrawRange(0, 0);
    beamA = 0; beam.visible = hitGlow.visible = tipGlow.visible = false; aimHit = null;
  }
  // selected: the laser is the weapon in hand; free: no dialog / nuke / hidden page
  function setState(selected, free) {
    const a = !!selected, v = a && !!free;
    if (v !== visible) { visible = v; rig.visible = v; if (!v) { cancel(); audio.stopHum(); beamA = 0; } else hasAim = false; }
    if (a !== active) { active = a; if (!a) { cancel(); clearLook(); for (const e of campus.entries) e.model.coolCuts?.(); } }
  }
  function clear() {
    cancel(); audio.stopHum();
    for (const c of chunks.splice(0)) { for (const p of c.pieces) c.handle.drop(p); c.handle.touch(); }
    clearLook(); cooldownUntil = -1; strokeId++;
  }
  // a test / diagnostic helper: a scripted stroke through these screen points (pressed, moved, released in one go)
  function strokeThrough(points, now = performance.now() / 1000) {
    if (!points?.length) return false; setAim(points[0].x, points[0].y); if (!press(now)) return false;
    for (const p of points.slice(1)) { setAim(p.x, p.y); const d = Math.hypot(aim.x - aim.probedX, aim.y - aim.probedY), steps = Math.max(1, Math.ceil(d / T.probeGap)), x0 = aim.probedX, y0 = aim.probedY; for (let k = 1; k <= steps; k++) sample(x0 + (aim.x - x0) * k / steps, y0 + (aim.y - y0) * k / steps, now); }
    return release(true);
  }
  return {
    setAim, press, release, cancel, setState, update, pose, render, clear, strokeThrough,
    get holding() { return holding; }, get visible() { return visible; }, get active() { return active; },
    get animating() { return visible || holding || beamA > 0 || chunks.length > 0 || sparkLive > 0 || smokeLive > 0 || marks.n > 0; },
    get stats() {
      return { ...stats, variant: LASER_NEW ? 'new' : 'old', particleCaps: { sparks: MAX_SPARK, smoke: MAX_SMOKE }, droplets: sparks.filter(s => s.drop && s.age < s.life).length, rejected: { ...stats.rejected }, active, visible, holding, beam: +beamA.toFixed(2), chunks: chunks.map(c => ({ state: c.state, mode: c.mode, pieces: c.pieces.length, t: +c.t.toFixed(2), y: +c.C.y.toFixed(2) })),
        peakChunks, marks: marks.n, glowing: campus.entries.reduce((n, e) => n + (e.model.heatedCount || 0), 0), heatPending: campus.entries.reduce((n, e) => n + (e.model.pendingCutCount || 0), 0), sparks: sparkLive, smoke: smokeLive, voices: audio.voices, hum: audio.humming,
        stroke: [...stroke.values()].reduce((n, r) => Math.max(n, r.n), 0), aim: hasAim ? aimPoint.toArray().map(x => +x.toFixed(2)) : null };
    },
    dispose() { clear(); for (const o of [beam, hitGlow, marks.mesh, sparkLines, sparkPts.points, smokePts.points]) scene.remove(o); overlayScene.clear(); for (const o of owned) o.dispose?.(); },
  };
}
