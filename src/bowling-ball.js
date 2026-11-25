// Bowling-ball bomb: SKKU's free weapon, and an ad-reward weapon on every campus while ad weapons are shown (10-23).
// User decisions 2026-10-18; mock 시안/성대_볼링공_시안.html, option A + classic black ball.
// Tap a spot: the ball is let go up the slope from it (a short search over drop points picks the one whose terrain-only roll
// passes closest to the spot) and rolls down on the campus heightAt. Physics: the ball centre rests on the highest touch of a
// 17-point footprint (kerbs lift it early), rolling acceleration 5/7 g, rolling friction + a little speed-squared drag, kerb
// hop / block, hard landings bounce, thud and crack the ground.
// Buildings: while it touches one faster than breakSpeed it ploughs through (campus.hit every 1/40 s with a speed-dependent
// radius, plus hits stacked higher up the facade), losing speed only for the pieces it ploughs (capped per hit), so it keeps
// rolling through several buildings. The first touch of each building at strike speed is a strike: freeze + slow motion, a
// wider blast, a shock hit on buildings close by and flying chunks that break whatever they fly into, pin-clatter sound.
// Protected hanok: it bounces off the shield (flash + "팅"), no damage.
// Bomb (user addition 10-18): a lit fuse sticks out of the thumb hole and fizzes while it rolls. When it stops, gets stuck,
// leaves the play area or reaches its max lifetime the fuse burns down (blink + faster beeps) and it explodes at mini-bomb
// size; the host (main.js) adds the shared mini-bomb blast look and sound on top of this module's fireball, smoke column,
// chunks and crack. Damage only ever goes through campus.hit (destructible campus buildings); the village is untouched.
// Everything is pooled when the module is created; update() does not allocate (WebAudio nodes are made per throw).
import { WEAPON_TUNING } from './weapon-tuning.js?v=sn130';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
// 17-point footprint: centre + an inner ring of 8 and an outer ring of 8 (x, z share of the radius, height share).
const RING = Array.from({ length: 16 }, (_, i) => { const k = i < 8 ? .5 : .9, a = i * Math.PI / 4 + (i < 8 ? 0 : Math.PI / 8); return [Math.cos(a) * k, Math.sin(a) * k, Math.sqrt(1 - k * k)]; });

// ---------- terrain roll + drop-point search (no THREE, no DOM: also run by 검증/bowling-check.mjs) ----------
// A ball state is a plain object { px, py, pz, vx, vy, vz, r, grounded, event, landSpeed, blockSpeed }.
export function createRollPhysics({ heightAt, tuning = WEAPON_TUNING.bowling }) {
  const T = tuning, N = { x: 0, y: 1, z: 0 };
  function support(x, z, r) { let s = heightAt(x, z) + r; for (let i = 0; i < 16; i++) { const c = RING[i], h = heightAt(x + c[0] * r, z + c[1] * r) + c[2] * r; if (h > s) s = h; } return s; }
  function normalAt(x, z, r) {
    const e = Math.max(.6, r * .35), gx = (support(x + e, z, r) - support(x - e, z, r)) / (2 * e), gz = (support(x, z + e, r) - support(x, z - e, r)) / (2 * e);
    const l = Math.hypot(gx, 1, gz); N.x = -gx / l; N.y = 1 / l; N.z = -gz / l; return N;
  }
  function block(b, nx, nz, px, py, pz, e) {
    b.px = px; b.pz = pz; b.py = Math.max(py, support(px, pz, b.r));
    const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; const vn = b.vx * nx + b.vz * nz;
    if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vz -= (1 + e) * vn * nz; if (-vn > 2.5) { b.event |= 2; b.blockSpeed = -vn; } }
  }
  // One step on the ground. Sets b.event: 1 = hard landing (b.landSpeed), 2 = blocked by a kerb / slope (b.blockSpeed).
  function step(b, dt) {
    const g = T.gravity, r = b.r; b.event = 0;
    b.vy -= g * (b.grounded ? 5 / 7 : 1) * dt;
    if (b.grounded) { const sp = Math.hypot(b.vx, b.vy, b.vz); if (sp > 1e-5) { const k = Math.min(Math.max(0, sp - (T.friction * g + sp * sp * T.drag) * dt), T.maxSpeed) / sp; b.vx *= k; b.vy *= k; b.vz *= k; } }
    const px = b.px, py = b.py, pz = b.pz;
    b.px += b.vx * dt; b.py += b.vy * dt; b.pz += b.vz * dt;
    const s = support(b.px, b.pz, r); let contact = false;
    if (b.py <= s + .02) {
      const lift = s - b.py, n = normalAt(b.px, b.pz, r);
      if (n.y < .42 || lift > r * .85) block(b, n.x, n.z, px, py, pz, .3);
      else {
        if (lift > .04) {
          const sp2 = b.vx * b.vx + b.vy * b.vy + b.vz * b.vz, left = sp2 - 2 * g * lift;
          if (left <= 0) { block(b, n.x, n.z, px, py, pz, .2); return; }
          const k = Math.sqrt(left / sp2); b.vx *= k; b.vy *= k; b.vz *= k;
        }
        b.py = s; const vn = b.vx * n.x + b.vy * n.y + b.vz * n.z;
        if (vn < 0) { const hard = -vn > 4.5, e = hard ? .3 : 0; b.vx -= (1 + e) * vn * n.x; b.vy -= (1 + e) * vn * n.y; b.vz -= (1 + e) * vn * n.z; if (hard && (b.airT || 0) > .12) { b.event |= 1; b.landSpeed = -vn; } }
        contact = true;
      }
    }
    b.grounded = contact || b.py - s < .1; b.airT = contact ? 0 : (b.airT || 0) + dt;
  }
  // Smoothed uphill direction (5-point average around the spot, +-10 units).
  const avg = (x, z) => (heightAt(x, z) + heightAt(x + 5, z) + heightAt(x - 5, z) + heightAt(x, z + 5) + heightAt(x, z - 5)) / 5;
  function uphillFrom(tx, tz, outside) {
    let x = tx, z = tz, dx = T.uphill[0], dz = T.uphill[1], len = 0; const h0 = heightAt(tx, tz), e = 10;
    for (let i = 0; i < 80; i++) {
      const gx = (avg(x + e, z) - avg(x - e, z)) / (2 * e), gz = (avg(x, z + e) - avg(x, z - e)) / (2 * e), l = Math.hypot(gx, gz);
      // ignore the local slope where it would turn the walk back (flat pads and pits)
      if (l > .015 && (gx * dx + gz * dz) / l > -.2) { dx = dx * .4 + gx / l * .6; dz = dz * .4 + gz / l * .6; const m = Math.hypot(dx, dz); dx /= m; dz /= m; }
      const nx = x + dx * 3, nz = z + dz * 3; if (outside(nx, nz)) break;
      x = nx; z = nz; len += 3; if (len >= T.walkMax || (len >= T.walkMin && heightAt(x, z) - h0 >= T.spawnHeight)) break;
    }
    return { x, z, dx, dz, len };
  }
  const pv = { px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0, r: 1, grounded: true, event: 0, landSpeed: 0, blockSpeed: 0 };
  // Closest pass of a terrain-only roll (plus `bounce(pv)` for shields) to (tx, tz); pass.at = seconds from release to it.
  // With `path` (Float32Array, x y z triples) the rolled path is written every ~1.2 units: pass.points = how many.
  const pass = { dmin: 0, at: 0, points: 0 };
  function closestPass(sx, sz, vx, vz, tx, tz, { inPlay = () => true, bounce = null, seconds = 5, h = 1 / 30, path = null } = {}) {
    pv.r = T.radius; pv.px = sx; pv.pz = sz; pv.py = support(sx, sz, pv.r) + T.drop; pv.vx = vx; pv.vy = 0; pv.vz = vz; pv.grounded = false; pv.airT = 1;
    let dmin = Math.hypot(sx - tx, sz - tz), at = 0, n = 0, lx = sx, lz = sz; const cap = path ? path.length / 3 : 0;
    if (path) { path[0] = sx; path[1] = pv.py - pv.r; path[2] = sz; n = 1; }
    for (let t = 0; t < seconds; t += h) {
      step(pv, h); bounce?.(pv);
      const d = Math.hypot(pv.px - tx, pv.pz - tz); if (d < dmin) { dmin = d; at = t + h; }
      if (path && n < cap && Math.hypot(pv.px - lx, pv.pz - lz) > 1.2) { path[n * 3] = lx = pv.px; path[n * 3 + 1] = pv.py - pv.r; path[n * 3 + 2] = lz = pv.pz; n++; }
      if (t > .5 && Math.hypot(pv.vx, pv.vy, pv.vz) < .5) break; if (!inPlay(pv.px, pv.pz)) break;
      if (path && d > dmin + 30) break; // the preview path ends a little past the aimed spot
    }
    pass.dmin = dmin; pass.at = at; pass.points = n; return pass;
  }
  // Option A: drop point on a short arc across the slope above the spot whose roll passes closest to it (the roll itself
  // stays pure physics). Mock measurement on the 15 SKKU buildings: closest pass <= 5 units for 14, 13 for the library.
  // Round 2 (user 10-18 "too slow"): released with a downhill shove (T.push) from a shorter walk; arrival time is scored too.
  // `blocked(x, z)`: drop points there (inside a building) are only used when every candidate is blocked.
  function aim(tx, tz, { outside = () => false, inPlay, bounce, path = null, blocked = null } = {}) {
    const s = uphillFrom(tx, tz, outside); let best = null;
    for (const strict of blocked ? [true, false] : [false]) {
    if (best) break;
    for (const [pi, push] of T.push.entries()) for (const off of [0, -10, 10, -20, 20, -30, 30, -40, 40]) {
      const sx = s.x - s.dz * off, sz = s.z + s.dx * off; if (off && outside(sx, sz)) continue; if (strict && blocked(sx, sz)) continue;
      const ddx = tx - sx, ddz = tz - sz, l = Math.hypot(ddx, ddz) || 1, vx = ddx / l * push, vz = ddz / l * push;
      const r = closestPass(sx, sz, vx, vz, tx, tz, { inPlay, bounce }), score = r.dmin + Math.abs(off) * .08 + pi + Math.max(0, r.at - 2.2) * 2;
      if (!best || score < best.score) best = { sx, sz, vx, vz, tx, tz, score, dmin: r.dmin, at: r.at, points: 0 };
      if (r.dmin < 2.5 && pi === 0) break;
    }
    }
    // Every campus (ad weapon, user decision 10-23): when the drop point is outside the play area (the predicted roll is cut
    // there), or the walk found no hill (it climbed less than half of spawnHeight) and the throw from there misses, is slow or
    // starts too close to roll (the play-area edge cut the walk short),
    // straight run-ups from the other seven compass sides (inside the play area, first push only) are tried too. SKKU's hill
    // throws do not pass this gate (they start inside, climb, arrive close and fast), so their drop points stay as before.
    const startsOut = Boolean(best && inPlay && !inPlay(best.sx, best.sz)), short = Boolean(best && Math.hypot(best.sx - tx, best.sz - tz) < T.walkMin);
    if (best && (startsOut || heightAt(s.x, s.z) - heightAt(tx, tz) < T.spawnHeight * .5) && (startsOut || short || best.dmin > 2.5 || best.at > 2.6)) {
      if (short) best = { ...best, score: best.score + 50 };
      for (const k of [1, -1, 2, -2, 3, -3, 4]) {
        const q = k * Math.PI / 4, c = Math.cos(q), sn = Math.sin(q), dx = s.dx * c - s.dz * sn, dz = s.dx * sn + s.dz * c;
        let len = 0;
        while (len < T.walkMax) { const nx = tx + dx * (len + 3), nz = tz + dz * (len + 3); if (outside(nx, nz) || (inPlay && !inPlay(nx, nz))) break; len += 3; }
        if (len < T.walkMin) continue;
        const sx = tx + dx * len, sz = tz + dz * len; if (blocked && blocked(sx, sz)) continue;
        const push = T.push[0], vx = -dx * push, vz = -dz * push;
        const r = closestPass(sx, sz, vx, vz, tx, tz, { inPlay, bounce }), score = r.dmin + Math.max(0, r.at - 2.2) * 2;
        if (score < best.score) best = { sx, sz, vx, vz, tx, tz, score, dmin: r.dmin, at: r.at, points: 0 };
      }
    }
    if (best && path) best.points = closestPass(best.sx, best.sz, best.vx, best.vz, tx, tz, { inPlay, bounce, path }).points;
    return best;
  }
  return { support, normalAt, step, uphillFrom, closestPass, aim };
}

// ---------- sound (WebAudio synthesis into the game's comic-audio master) ----------
// Level: the mock mixed these at .55 into a compressor; heavy-weapons-audio keeps its mock (.8) values at bus 1 against the
// same master, so .7 here keeps the mock's balance against the bazooka boom it layers with.
export function createBowlingAudio({ output = () => null, heavy = null, lite = false } = {}) {
  let ctx = null, bus = null, brown = null, white = null, voices = 0;
  const MAX = lite ? 26 : 44, rnd = (a, b) => a + Math.random() * (b - a);
  function ready() {
    const out = output(); if (!out?.context || !out.destination) return null;
    if (out.context !== ctx) {
      ctx = out.context; voices = 0;
      try {
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
        bus = ctx.createGain(); bus.gain.value = .7; bus.connect(comp).connect(out.destination);
        brown = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate); { const d = brown.getChannelData(0); let l = 0, top = 0; for (let i = 0; i < d.length; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l; top = Math.max(top, Math.abs(l)); } for (let i = 0; i < d.length; i++) d[i] /= top || 1; }
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
      s.buffer = buf; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + att + dur);
      s.connect(f).connect(g).connect(bus); track(s); s.start(t, Math.random() * (buf.duration - dur - .1)); s.stop(t + att + dur + .05);
    } catch {}
  }
  function tone(type, f0, f1, dur, peak, delay = 0, att = .005) {
    if (!ctx || voices >= MAX) return;
    try {
      const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + att + dur);
      o.connect(g).connect(bus); track(o); o.start(t); o.stop(t + att + dur + .05);
    } catch {}
  }
  const cues = {
    launch(k) { tone('sine', 70, 120, .25, .25 * k); noise(brown, .4, .3 * k, 'lowpass', 300, 700, .9, 0, .05); },
    land(k) { const a = clamp(k, .2, 1.4); tone('sine', 85, 30, .38, .55 * a); noise(brown, .3, .5 * a, 'lowpass', 420, 90, .8); noise(white, .08, .12 * a, 'bandpass', 900, 500, 1.2); },
    bump(k) { const a = clamp(k, .15, 1); tone('sine', 130, 60, .16, .35 * a); noise(brown, .12, .3 * a, 'lowpass', 600, 200, .8); },
    // round 3: bounce off the invisible play-area edge (a low, soft thud, no crack)
    wall(k) { const a = clamp(k, .2, 1); tone('sine', 92, 38, .3, .42 * a); noise(brown, .26, .34 * a, 'lowpass', 380, 110, .8, 0, .01); },
    crunch(k) { const a = clamp(k, .2, 1.2) * 1.6; noise(brown, .35, .45 * a, 'lowpass', 900, 160, .9); for (let i = 0; i < 4; i++) { const f = rnd(300, 1400); noise(white, .12, .16 * a, 'bandpass', f, f * .7, 1.8, i * .03 + rnd(0, .02)); } },
    // Strike: the bazooka body under a crash and a wooden pin clatter (resonant clacks scattered over ~0.5 s).
    strike(k) {
      heavy?.play('boom', clamp(.7 + k * .5, .7, 1.6)); tone('sine', 62, 26, .7, .55);
      noise(white, .22, .3, 'bandpass', 2600, 1400, 1.1, .01);
      for (let i = 0; i < 18; i++) { const d = .04 + Math.pow(Math.random(), 1.6) * .5, f = rnd(1500, 3600); noise(white, .045, .22, 'bandpass', f, f * .8, 7, d, .001); tone('triangle', rnd(700, 1500), rnd(500, 900), .09, .07, d); }
    },
    blast(k = 1) { heavy?.play('boom', clamp(1.1 * k, .8, 1.6)); tone('sine', 55, 24, .95, .6); noise(brown, .9, .55, 'lowpass', 700, 70, .8, .02); },
    beep(k) { tone('sine', 2300 + k * 500, 2150 + k * 500, .06, .45 + k * .2, 0, .002); tone('square', 1150, 1100, .035, .07, 0, .001); },
    shield(big) { heavy?.play('shield', big); },
  };
  // One persistent voice per ball: rolling rumble (brown low-pass + a grit band + a low sine) and the fuse fizz (high band noise).
  function voice() {
    if (!ready()) return null;
    try {
      const make = (buf, type, f, q) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(bus); s.start(0, Math.random() * (buf.duration - .1)); return { s, fl, g }; };
      const rum = make(brown, 'lowpass', 80, .9), grit = make(white, 'bandpass', 700, 1.1), fizz = make(white, 'highpass', 5200, .7);
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 38; const og = ctx.createGain(); og.gain.value = 0; o.connect(og).connect(bus); o.start();
      let stopped = false;
      return {
        set(speed, grounded, spin, burning) {
          if (stopped) return; const t = ctx.currentTime, k = grounded ? clamp(speed / 24, 0, 1.2) : 0, flutter = .8 + .2 * Math.sin(spin * 2);
          rum.g.gain.setTargetAtTime(.4 * k * flutter, t, .05); rum.fl.frequency.setTargetAtTime(70 + speed * 9, t, .08);
          grit.g.gain.setTargetAtTime(.05 * k * (.6 + Math.random() * .8), t, .03); grit.fl.frequency.setTargetAtTime(500 + speed * 25, t, .1);
          og.gain.setTargetAtTime(.12 * k, t, .08); o.frequency.setTargetAtTime(30 + speed * .9, t, .1);
          fizz.g.gain.setTargetAtTime((burning ? .12 : .035) * (.5 + Math.random()), t, .015); fizz.fl.frequency.setTargetAtTime(burning ? 4200 : 5600, t, .05);
        },
        stop() {
          if (stopped) return; stopped = true; const t = ctx.currentTime;
          for (const g of [rum.g, grit.g, fizz.g, og]) g.gain.setTargetAtTime(0, t, .06);
          for (const s of [rum.s, grit.s, fizz.s, o]) { try { s.stop(t + .5); } catch {} }
        },
      };
    } catch { return null; }
  }
  return { play(id, arg) { if (!ready() || !cues[id]) return false; cues[id](arg); return true; }, voice, get voices() { return voices; } };
}

// ---------- the weapon ----------
export function createBowlingBall(THREE, scene, camera, {
  campus, protectedSet = null, shieldFx = null, tuning = WEAPON_TUNING.bowling, reducedMotion = false, mobile = false,
  output = () => null, heavyAudio = null, pixelRatio = () => 1, view = null, follow = !reducedMotion,
  onDamage = () => {}, onStrike = () => {}, onBlast = () => {}, onShield = () => {}, onKick = () => {},
} = {}) {
  const T = tuning, V3 = THREE.Vector3, heightAt = (x, z) => campus.terrain.heightAt(x, z);
  const phys = createRollPhysics({ heightAt, tuning: T });
  const audio = createBowlingAudio({ output, heavy: heavyAudio, lite: mobile });
  const rnd = (a, b) => a + Math.random() * (b - a);
  const entries = campus.entries, owned = [];
  const own = x => (owned.push(x), x);
  const pieceWeight = campus.totalWeight / Math.max(1, entries.reduce((s, e) => s + e.model.pieces.length, 0));
  // Play area: buildings + hanok + 16 (the 명륜동 village has no collision, so a ball out there must end).
  const playBox = new THREE.Box3(); for (const e of entries) playBox.union(e.worldBounds); for (const s of protectedSet?.sites || []) playBox.union(s.box);
  playBox.expandByVector(new V3(16, 400, 16));
  const spawnBox = playBox.clone().expandByVector(new V3(26, 0, 26));
  const outside = (x, z) => x < spawnBox.min.x || x > spawnBox.max.x || z < spawnBox.min.z || z > spawnBox.max.z;
  const blocked = (x, z) => { const m = T.radius * 1.8; for (const e of entries) { const b = e.worldBounds; if (!e.cleared && x > b.min.x - m && x < b.max.x + m && z > b.min.z - m && z < b.max.z + m) return true; } return false; };
  const inPlay = (x, z) => x >= playBox.min.x && x <= playBox.max.x && z >= playBox.min.z && z <= playBox.max.z;
  const tA = new V3(), tB = new V3(), tC = new V3(), tQ = new THREE.Quaternion(), UP = new V3(0, 1, 0);
  // shield bounce on a plain ball state (shared by the aim search and the live roll)
  function shieldBounce(b) {
    if (!protectedSet) return null;
    const near = protectedSet.nearestSurface(tA.set(b.px, b.py, b.pz), b.r);
    if (!near || near.distance >= b.r) return null;
    const n = near.normal, vn = b.vx * n.x + b.vy * n.y + b.vz * n.z;
    if (vn < 0) { b.vx -= 1.65 * vn * n.x; b.vy -= 1.65 * vn * n.y; b.vz -= 1.65 * vn * n.z; }
    b.px = near.point.x + n.x * (b.r + .1); b.py = near.point.y + n.y * (b.r + .1); b.pz = near.point.z + n.z * (b.r + .1);
    if (n.y < .5) b.py = Math.max(b.py, phys.support(b.px, b.pz, b.r));
    return near;
  }

  let ballGeoCache = null; const ballGeoShared = () => ballGeoCache || (ballGeoCache = own(new THREE.SphereGeometry(1, mobile ? 32 : 48, mobile ? 22 : 32)));
  // ---------- textures ----------
  function canvasTex(w, h, draw, srgb = true) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = own(new THREE.CanvasTexture(c)); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const TW = mobile ? 512 : 1024;
  // finger holes on the equirect map (u, v in 0..1): two fingers side by side, the thumb below (the fuse comes out of it)
  const HOLES = [[.47, .36, .028], [.53, .36, .028], [.5, .47, .034]];
  const ballMap = canvasTex(TW, TW / 2, (g, w, h) => {
    g.fillStyle = '#0c0c10'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { // faint reactive-resin swirl
      g.strokeStyle = `rgba(${40 + rnd(0, 30) | 0},${34 + rnd(0, 20) | 0},${60 + rnd(0, 40) | 0},${rnd(.05, .16).toFixed(3)})`; g.lineWidth = rnd(4, 18) * w / 1024;
      g.beginPath(); let x = rnd(0, w), y = rnd(0, h); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += rnd(-140, 140) * w / 1024; y += rnd(-50, 50) * w / 1024; g.quadraticCurveTo(x + rnd(-60, 60), y + rnd(-40, 40), x, y); } g.stroke();
    }
    for (const [u, v, r] of HOLES) {
      const x = u * w, y = v * h, rx = r * w, gr = g.createRadialGradient(x - rx * .25, y - rx * .3, rx * .1, x, y, rx);
      gr.addColorStop(0, '#000'); gr.addColorStop(.75, '#050507'); gr.addColorStop(1, '#2a2a30'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, rx * 1.02, 0, 0, 7); g.fill();
    }
  });
  const holeBump = canvasTex(TW, TW / 2, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    for (const [u, v, r] of HOLES) { const gr = g.createRadialGradient(u * w, v * h, 0, u * w, v * h, r * w * 1.15); gr.addColorStop(0, '#000'); gr.addColorStop(.8, '#000'); gr.addColorStop(1, '#fff'); g.fillStyle = gr; g.beginPath(); g.arc(u * w, v * h, r * w * 1.15, 0, 7); g.fill(); }
  }, false);
  // soft sky / ground for the glossy reflections only (an equirect map; three prefilters it for the physical material)
  const envTex = canvasTex(256, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8ca8c6'); gr.addColorStop(.48, '#dfe7ec'); gr.addColorStop(.52, '#8c877a'); gr.addColorStop(1, '#4b4a44');
    g.fillStyle = gr; g.fillRect(0, 0, w, h); const s = g.createRadialGradient(w * .62, h * .2, 0, w * .62, h * .2, 18); s.addColorStop(0, '#fffdf4'); s.addColorStop(1, 'rgba(255,253,244,0)'); g.fillStyle = s; g.fillRect(0, 0, w, h);
  });
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  const softDot = canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(.55, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }, false);
  const glowDot = canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(.25, 'rgba(255,210,120,.9)'); gr.addColorStop(.6, 'rgba(255,120,30,.35)'); gr.addColorStop(1, 'rgba(255,80,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  const crackTex = canvasTex(512, 512, (g, w) => {
    const c = w / 2, gr = g.createRadialGradient(c, c, 0, c, c, w * .26); gr.addColorStop(0, 'rgba(40,32,24,.72)'); gr.addColorStop(.7, 'rgba(60,50,38,.35)'); gr.addColorStop(1, 'rgba(60,50,38,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w); g.lineCap = 'round';
    for (let i = 0; i < 13; i++) {
      let a = i / 13 * 6.283 + rnd(-.2, .2), r = w * .05, x = c + Math.cos(a) * r, y = c + Math.sin(a) * r; g.strokeStyle = 'rgba(28,22,16,.85)'; g.lineWidth = rnd(3, 6);
      g.beginPath(); g.moveTo(x, y); const len = rnd(.28, .46) * w; while (r < len) { r += rnd(14, 28); a += rnd(-.35, .35); x = c + Math.cos(a) * r; y = c + Math.sin(a) * r; g.lineTo(x, y); g.lineWidth *= .9; }
      g.stroke(); if (Math.random() < .6) { g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-40, 40), y + rnd(-40, 40)); g.stroke(); }
    }
  });
  const scorchTex = canvasTex(256, 256, (g, w) => { const c = w / 2, gr = g.createRadialGradient(c, c, 0, c, c, c); gr.addColorStop(0, 'rgba(18,14,10,.9)'); gr.addColorStop(.45, 'rgba(30,24,18,.6)'); gr.addColorStop(1, 'rgba(40,32,24,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  const ringTex = canvasTex(256, 256, (g, w) => { const c = w / 2, gr = g.createRadialGradient(c, c, w * .3, c, c, w * .5); gr.addColorStop(0, 'rgba(255,248,232,0)'); gr.addColorStop(.7, 'rgba(255,248,232,.9)'); gr.addColorStop(1, 'rgba(255,248,232,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });

  // ---------- ground-hugging patches (decals, blob shadows, shock rings) ----------
  function groundPatch(tex, segs, { opacity = 1, offset = -4, additive = false } = {}) {
    const geo = own(new THREE.PlaneGeometry(1, 1, segs, segs)); geo.rotateX(-Math.PI / 2);
    const mat = own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset, ...(additive ? { blending: THREE.AdditiveBlending } : {}) }));
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.visible = false;
    const base = Float32Array.from(geo.attributes.position.array);
    mesh.userData.born = -1e9;
    mesh.userData.place = (x, z, size, yaw = 0, lift = .08) => {
      const a = geo.attributes.position.array, c = Math.cos(yaw), s = Math.sin(yaw);
      for (let i = 0; i < a.length; i += 3) { const lx = base[i] * size, lz = base[i + 2] * size, wx = x + lx * c - lz * s, wz = z + lx * s + lz * c; a[i] = wx; a[i + 1] = heightAt(wx, wz) + lift; a[i + 2] = wz; }
      geo.attributes.position.needsUpdate = true;
    };
    scene.add(mesh); return mesh;
  }
  const decals = Array.from({ length: 14 }, () => groundPatch(crackTex, 10));
  const scorches = Array.from({ length: 4 }, () => groundPatch(scorchTex, 10, { offset: -3 }));
  const rings = Array.from({ length: 5 }, () => groundPatch(ringTex, 14, { offset: -5 }));
  const oldest = list => { let o = list[0]; for (const m of list) if (m.userData.born < o.userData.born) o = m; return o; };
  function decal(x, z, size, now) { const d = oldest(decals); d.userData.place(x, z, size, rnd(0, 6.28), .07); d.userData.born = now; d.material.opacity = 1; d.visible = true; }
  function scorch(x, z, size, now) { const d = oldest(scorches); d.userData.place(x, z, size, rnd(0, 6.28), .09); d.userData.born = now; d.material.opacity = 1; d.visible = true; }
  function shock(x, z, size, now) { const g = oldest(rings); g.userData.born = now; g.userData.x = x; g.userData.z = z; g.userData.size = size; g.visible = true; }

  // ---------- rolled-in groove behind a fast ball (ring buffer of quads, fades over 16 s) ----------
  const trail = (() => {
    const max = mobile ? 400 : 700, geo = own(new THREE.BufferGeometry()), pos = new Float32Array(max * 12), al = new Float32Array(max * 4), born = new Float32Array(max).fill(-1e9), str = new Float32Array(max), idx = new Uint16Array(max * 6);
    for (let i = 0; i < max; i++) { const a = i * 4; idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('alpha', new THREE.BufferAttribute(al, 1)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mat = own(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(.2,.16,.11, vA); }' }));
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 1; scene.add(mesh);
    let head = 0, alive = false;
    return { mesh,
      add(ax, az, bx, bz, w, strength, now) {
        const i = head++ % max, k = i * 12; let dx = bx - ax, dz = bz - az; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        const put = (j, x, z) => { pos[k + j * 3] = x; pos[k + j * 3 + 1] = heightAt(x, z) + .06; pos[k + j * 3 + 2] = z; };
        put(0, ax - dz * w, az + dx * w); put(1, ax + dz * w, az - dx * w); put(2, bx - dz * w, bz + dx * w); put(3, bx + dz * w, bz - dx * w);
        born[i] = now; str[i] = strength; geo.attributes.position.needsUpdate = true; alive = true;
      },
      update(now) {
        if (!alive) return; let any = false;
        for (let i = 0; i < max; i++) { const age = now - born[i], v = age < 16 ? str[i] * (1 - age / 16) : 0; if (v > 0) any = true; al[i * 4] = al[i * 4 + 1] = al[i * 4 + 2] = al[i * 4 + 3] = v; }
        geo.attributes.alpha.needsUpdate = true; alive = any;
      },
      clear() { born.fill(-1e9); al.fill(0); geo.attributes.alpha.needsUpdate = true; alive = false; },
    };
  })();

  // ---------- particles: dust (soft, normal blend) and fire / sparks (additive) ----------
  function createPoints(max, additive) {
    const geo = own(new THREE.BufferGeometry()), pos = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max), tint = new Float32Array(max * 3);
    const vel = new Float32Array(max * 3), age = new Float32Array(max), life = new Float32Array(max), grow = new Float32Array(max), a0 = new Float32Array(max), drag = new Float32Array(max), lift = new Float32Array(max);
    for (const [k, a, n] of [['position', pos, 3], ['size', size, 1], ['alpha', alpha, 1], ['tint', tint, 3]]) geo.setAttribute(k, new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage));
    const mat = own(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, ...(additive ? { blending: THREE.AdditiveBlending } : {}), uniforms: { uScale: { value: 400 } },
      vertexShader: 'attribute float size, alpha; attribute vec3 tint; uniform float uScale; varying float vA; varying vec3 vC; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv; gl_PointSize = min(512., size * uScale / max(.5, -mv.z)); vA = alpha; vC = tint; }',
      fragmentShader: additive
        ? 'varying float vA; varying vec3 vC; void main(){ vec2 q = gl_PointCoord * 2. - 1.; float d = dot(q,q); if (d > 1.) discard; float a = (1. - d); a *= a; gl_FragColor = vec4(vC * a * vA, a * vA); }'
        : 'varying float vA; varying vec3 vC; void main(){ vec2 q = gl_PointCoord * 2. - 1.; float d = dot(q,q); if (d > 1.) discard; float n = fract(sin(dot(floor(gl_PointCoord * 6.), vec2(12.9898,78.233))) * 43758.5453); float a = (1. - d); a = a * a * (.82 + .18 * n); gl_FragColor = vec4(vC * (.92 + .08 * (1. - q.y)), a * vA); }' }));
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 4; scene.add(pts);
    let n = 0, drawn = -1;
    function spawn(x, y, z, vx, vy, vz, s, g, l, a, r, gg, b, dr = 1.6, up = .8) {
      const i = n < max ? n++ : (Math.random() * max) | 0;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz; size[i] = s; grow[i] = g; life[i] = l; age[i] = 0; a0[i] = a; alpha[i] = 0; drag[i] = dr; lift[i] = up;
      tint[i * 3] = r; tint[i * 3 + 1] = gg; tint[i * 3 + 2] = b;
    }
    function copy(d, s) {
      for (let k = 0; k < 3; k++) { pos[d * 3 + k] = pos[s * 3 + k]; vel[d * 3 + k] = vel[s * 3 + k]; tint[d * 3 + k] = tint[s * 3 + k]; }
      size[d] = size[s]; grow[d] = grow[s]; life[d] = life[s]; age[d] = age[s]; a0[d] = a0[s]; alpha[d] = alpha[s]; drag[d] = drag[s]; lift[d] = lift[s];
    }
    function update(dt) {
      if (!n && !drawn) return;
      if (dt > 0) for (let i = 0; i < n; i++) {
        age[i] += dt; if (age[i] >= life[i]) { copy(i, --n); i--; continue; }
        const k = Math.exp(-drag[i] * dt); vel[i * 3] *= k; vel[i * 3 + 1] = vel[i * 3 + 1] * k + lift[i] * dt; vel[i * 3 + 2] *= k;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; size[i] += grow[i] * dt;
        const t = age[i] / life[i]; alpha[i] = a0[i] * Math.min(1, age[i] * (additive ? 40 : 10)) * Math.pow(1 - t, 1.4);
      }
      geo.setDrawRange(0, n); drawn = n; for (const k of ['position', 'size', 'alpha', 'tint']) geo.attributes[k].needsUpdate = true;
    }
    return { points: pts, spawn, update, clear() { n = 0; geo.setDrawRange(0, 0); drawn = 0; }, get count() { return n; } };
  }
  const dust = createPoints(mobile ? T.dustPhone : T.dust, false), fire = createPoints(mobile ? 160 : 260, true);

  // ---------- flying chunks (strike shrapnel breaks what it flies into; blast chunks are look only) ----------
  const CHUNKS = mobile ? 40 : 64;
  const chunkMesh = new THREE.InstancedMesh(own(new THREE.BoxGeometry(1, 1, 1)), own(new THREE.MeshStandardMaterial({ color: '#a59d8e', roughness: .92 })), CHUNKS);
  chunkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); chunkMesh.frustumCulled = false; chunkMesh.count = 0; chunkMesh.castShadow = false; scene.add(chunkMesh);
  const chunkColors = ['#a59d8e', '#8c8478', '#b9ab95', '#6f6a62', '#c4b8a4'].map(c => new THREE.Color(c));
  const chunks = Array.from({ length: CHUNKS }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 2, s: 1, ax: 0, ay: 1, az: 0, spin: 0, ang: 0, from: null, damage: false, next: 0, rec: null, bounced: 0, color: 0 }));
  let chunkNext = 0;
  function addChunk(x, y, z, vx, vy, vz, s, damage, from, rec) {
    const c = chunks[chunkNext++ % CHUNKS];
    Object.assign(c, { on: true, x, y, z, vx, vy, vz, age: 0, life: rnd(1.6, 2.6), s, spin: rnd(4, 12), ang: rnd(0, 6.28), from, damage, next: .06, rec, bounced: 0, color: (Math.random() * chunkColors.length) | 0 });
    const l = Math.hypot(c.ax = rnd(-1, 1), c.ay = rnd(-1, 1), c.az = rnd(-1, 1)) || 1; c.ax /= l; c.ay /= l; c.az /= l;
  }
  const chunkM = new THREE.Matrix4(), chunkS = new V3(), chunkP = new V3(), chunkAxis = new V3();
  function updateChunks(dt) {
    let n = 0;
    for (const c of chunks) {
      if (!c.on) continue;
      if (dt > 0) {
        c.age += dt; if (c.age >= c.life) { c.on = false; continue; }
        c.vy -= 22 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.ang += c.spin * dt;
        const gy = heightAt(c.x, c.z) + c.s * .4;
        if (c.y < gy) { c.y = gy; if (c.bounced++ < 2 && c.vy < -3) { c.vy *= -.3; c.vx *= .55; c.vz *= .55; c.spin *= .5; if (c.bounced === 1) dust.spawn(c.x, gy, c.z, 0, 1, 0, c.s * 1.6, c.s * 2, .9, .45, .78, .73, .66, 2, .4); } else { c.vx *= .8; c.vz *= .8; c.vy = 0; c.spin *= .8; } c.damage = false; }
        // a strike chunk breaks the first building it flies into (not its own one for the first .35 s)
        if (c.damage && c.age > c.next) {
          c.next = c.age + .05; tA.set(c.x, c.y, c.z);
          for (const e of entries) {
            if (e.cleared || (e === c.from && c.age < .35) || !e.worldBounds.containsPoint(tA)) continue;
            const sp = Math.hypot(c.vx, c.vy, c.vz) || 1, res = campus.hit(tA, T.shrapnelRadius, T.shrapnelForce, { direction: tB.set(c.vx / sp, c.vy / sp, c.vz / sp) });
            if (res.count) { c.damage = false; c.vx *= .25; c.vy *= .25; c.vz *= .25; if (c.rec) c.rec.shrapnel += res.weight; dust.spawn(c.x, c.y, c.z, 0, 1.5, 0, 2.2, 3, 1.4, .6, .74, .72, .69, 1.6, .5); onDamage(res, { kind: 'shrapnel', point: tA, normal: UP, radius: T.shrapnelRadius, force: T.shrapnelForce, feedback: true }); }
            break;
          }
        }
      }
      const fade = Math.min(1, (c.life - c.age) / .4);
      tQ.setFromAxisAngle(chunkAxis.set(c.ax, c.ay, c.az), c.ang);
      chunkMesh.setColorAt(n, chunkColors[c.color]); chunkMesh.setMatrixAt(n++, chunkM.compose(chunkP.set(c.x, c.y, c.z), tQ, chunkS.set(c.s * fade, c.s * .8 * fade, c.s * .9 * fade)));
    }
    chunkMesh.count = n; if (n) { chunkMesh.instanceMatrix.needsUpdate = true; if (chunkMesh.instanceColor) chunkMesh.instanceColor.needsUpdate = true; }
  }

  // ---------- trees: the baked planting is instanced; trees the ball rolls into (or the blast reaches) fall over ----------
  const trees = [], treeGrid = new Map(), CELL = 8, falling = [], treeM = new THREE.Matrix4(), treeP = new V3(), treeInv = new THREE.Matrix4();
  const cellKey = (cx, cz) => cx * 73856093 ^ cz * 19349663;
  campus.group?.getObjectByName?.('env-planting')?.traverse(o => {
    if (!o.isInstancedMesh) return; o.updateWorldMatrix(true, false); const inv = new THREE.Matrix4().copy(o.matrixWorld).invert();
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, treeM); if (Math.abs(treeM.determinant()) < 1e-9) continue; // hidden (inside a hanok outline)
      treeP.setFromMatrixPosition(treeM); const local = treeP.clone(); treeP.applyMatrix4(o.matrixWorld);
      const t = { mesh: o, inv, i, x: treeP.x, z: treeP.z, local, base: treeM.clone(), down: false, t: 0, ax: 0, az: 1, k: 1 };
      const key = cellKey(Math.floor(t.x / CELL), Math.floor(t.z / CELL)); let list = treeGrid.get(key); if (!list) treeGrid.set(key, list = []); list.push(t); trees.push(t);
    }
  });
  let nearestTree = Infinity;
  const fallAxis = new V3(), fallQ = new THREE.Quaternion(), fallA = new THREE.Matrix4(), fallB = new THREE.Matrix4();
  function knockTrees(x, z, radius, dx, dz, radial) {
    if (!trees.length || !Number.isFinite(x + z + radius)) return;
    const c0x = Math.floor((x - radius) / CELL), c1x = Math.floor((x + radius) / CELL), c0z = Math.floor((z - radius) / CELL), c1z = Math.floor((z + radius) / CELL);
    for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) {
      const list = treeGrid.get(cellKey(cx, cz)); if (!list) continue;
      for (const t of list) {
        if (t.down) continue; const ex = t.x - x, ez = t.z - z, d = Math.hypot(ex, ez); if (!radial && d < nearestTree) nearestTree = d; if (d > radius) continue;
        let fx = radial ? ex / (d || 1) : dx, fz = radial ? ez / (d || 1) : dz; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
        t.down = true; t.t = 0; t.k = radial ? 1.25 : .9 + Math.random() * .3;
        // fall away from the ball: rotate about the horizontal axis across the fall direction, in the mesh's own space
        fallAxis.set(fz, 0, -fx).transformDirection(t.inv); t.ax = fallAxis.x; t.ay = fallAxis.y; t.az = fallAxis.z;
        if (falling.length < 160) falling.push(t);
        if (Math.random() < .5) dust.spawn(t.x, heightAt(t.x, t.z) + .5, t.z, fx * 2, 1, fz * 2, 1.4, 2.2, 1.1, .4, .62, .66, .52, 2, .4);
      }
    }
  }
  function updateTrees(dt) {
    for (let j = falling.length - 1; j >= 0; j--) {
      const t = falling[j]; t.t += dt; const k = Math.min(1, t.t / (.55 / t.k)), ang = 1.48 * k * k;
      fallQ.setFromAxisAngle(fallAxis.set(t.ax, t.ay, t.az), ang);
      fallA.makeTranslation(t.local.x, t.local.y, t.local.z).multiply(fallB.makeRotationFromQuaternion(fallQ)).multiply(fallB.makeTranslation(-t.local.x, -t.local.y, -t.local.z));
      t.mesh.setMatrixAt(t.i, fallA.multiply(t.base)); t.mesh.instanceMatrix.needsUpdate = true;
      if (k >= 1) falling.splice(j, 1);
    }
  }
  function standTrees() {
    falling.length = 0;
    for (const t of trees) if (t.down) { t.down = false; t.mesh.setMatrixAt(t.i, t.base); t.mesh.instanceMatrix.needsUpdate = true; }
  }
  // big additive flash for the strike and the blast (drawn over walls, so a blast inside a building still reads)
  const flashes = Array.from({ length: 3 }, () => { const m = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: glowDot, color: '#fff1cf', transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }))); m.visible = false; m.renderOrder = 6; m.userData = { age: 0, life: .3, s0: 1, s1: 2, peak: 1 }; scene.add(m); return m; });
  let flashNext = 0;
  function flash(x, y, z, s0, s1, life, peak) { const m = flashes[flashNext++ % flashes.length]; m.position.set(x, y, z); Object.assign(m.userData, { age: 0, life, s0, s1, peak }); m.visible = true; }
  function updateFlashes(dt) { for (const m of flashes) { if (!m.visible) continue; const u = m.userData; u.age += dt; const k = u.age / u.life; if (k >= 1) { m.visible = false; continue; } m.scale.setScalar(u.s0 + (u.s1 - u.s0) * Math.sqrt(k)); m.material.opacity = u.peak * (1 - k) * (1 - k); } }

  // ---------- aim preview (round 2, user 10-18 "can't tell where it starts"): ghost ball at the drop point, the predicted
  // roll as a dashed ribbon down to the spot and a ring on the spot. Built once; updates rewrite the same buffers.
  const PATH_MAX = 160, pathPts = new Float32Array(PATH_MAX * 3);
  const guide = (() => {
    const geo = own(new THREE.BufferGeometry()), pos = new Float32Array(PATH_MAX * 6), uv = new Float32Array(PATH_MAX * 4), idx = new Uint16Array((PATH_MAX - 1) * 6);
    for (let i = 0; i < PATH_MAX - 1; i++) { const a = i * 2; idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('uvp', new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mat = own(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false,
      uniforms: { uTime: { value: 0 }, uLen: { value: 1 }, uColor: { value: new THREE.Color('#fff3dc') } },
      vertexShader: 'attribute vec2 uvp; varying vec2 vUv; void main(){ vUv = uvp; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'uniform float uTime, uLen; uniform vec3 uColor; varying vec2 vUv; void main(){ float u = vUv.x, av = abs(vUv.y); float fade = smoothstep(0., 3., u) * (1. - smoothstep(uLen * .8, uLen, u)); float dash = step(.45, fract(u * .16 - uTime * 1.4)); float core = 1. - smoothstep(.42, .55, av), rim = (1. - smoothstep(.85, 1., av)) * (1. - core); vec3 c = mix(vec3(.09,.12,.18), uColor, core); gl_FragColor = vec4(c, (core * (.35 + .65 * dash) + rim * .45) * fade); }' }));
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 7; mesh.visible = false; scene.add(mesh);
    return { mesh, mat,
      set(n, width) {
        let u = 0;
        for (let i = 0; i < n; i++) {
          const j = Math.min(n - 1, i + 1), k = Math.max(0, i - 1), x = pathPts[i * 3], y = pathPts[i * 3 + 1], z = pathPts[i * 3 + 2];
          let dx = pathPts[j * 3] - pathPts[k * 3], dz = pathPts[j * 3 + 2] - pathPts[k * 3 + 2]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
          if (i) u += Math.hypot(x - pathPts[i * 3 - 3], z - pathPts[i * 3 - 1]);
          for (let sd = 0; sd < 2; sd++) { const side = sd ? 1 : -1, px = x - dz * side * width, pz = z + dx * side * width, q = i * 2 + sd; pos[q * 3] = px; pos[q * 3 + 1] = Math.max(heightAt(px, pz), y) + .35; pos[q * 3 + 2] = pz; uv[q * 2] = u; uv[q * 2 + 1] = side; }
        }
        geo.setDrawRange(0, Math.max(0, n - 1) * 6); geo.attributes.position.needsUpdate = true; geo.attributes.uvp.needsUpdate = true; mat.uniforms.uLen.value = u; mesh.visible = n > 1;
      } };
  })();
  const ghost = new THREE.Mesh(ballGeoShared(), own(new THREE.MeshBasicMaterial({ color: '#151820', transparent: true, opacity: .5, depthWrite: false, depthTest: false })));
  ghost.visible = false; ghost.renderOrder = 8; scene.add(ghost);
  // a light rim behind the ghost so a far-away drop point still reads against roofs and trees
  const ghostRim = new THREE.Mesh(ballGeoShared(), own(new THREE.MeshBasicMaterial({ color: '#fff3dc', transparent: true, opacity: .8, depthWrite: false, depthTest: false, side: THREE.BackSide })));
  ghostRim.visible = false; ghostRim.renderOrder = 7; scene.add(ghostRim);
  const spotRing = groundPatch(ringTex, 14, { offset: -6 }); spotRing.material.depthTest = false; spotRing.material.color.set('#ffcf33'); spotRing.renderOrder = 7;
  const dropRing = groundPatch(ringTex, 14, { offset: -6 }); dropRing.material.depthTest = false; dropRing.renderOrder = 7;
  const prev = { aim: null, tx: NaN, tz: NaN, visible: false };
  const upp = (x, y, z) => view ? view.worldUnitsPerPixelAt(tA.set(x, y, z)) : .1;
  function preview(tx, tz) {
    if (![tx, tz].every(Number.isFinite)) { hidePreview(); return null; }
    if (!(prev.aim && Math.hypot(prev.tx - tx, prev.tz - tz) < .8)) {
      const a = phys.aim(tx, tz, { outside, inPlay, bounce: shieldBounce, path: pathPts, blocked }); if (!a) { hidePreview(); return null; }
      prev.aim = a; prev.tx = tx; prev.tz = tz;
    }
    const a = prev.aim, n = a.points, mid = Math.floor(n / 2), gy = heightAt(tx, tz), sy = phys.support(a.sx, a.sz, T.radius);
    guide.set(n, Math.max(.8, upp(pathPts[mid * 3], pathPts[mid * 3 + 1], pathPts[mid * 3 + 2]) * 8));
    spotRing.userData.place(tx, tz, Math.max(T.radius * 3, upp(tx, gy, tz) * 54), 0, .2); spotRing.visible = true;
    dropRing.userData.place(a.sx, a.sz, Math.max(T.radius * 3.2, upp(a.sx, sy, a.sz) * 56), 0, .2); dropRing.visible = true;
    const gs = Math.max(T.radius, upp(a.sx, sy, a.sz) * 13); ghost.position.set(a.sx, sy + T.drop * .5, a.sz); ghost.scale.setScalar(gs); ghostRim.scale.setScalar(gs * 1.14); ghostRim.position.copy(ghost.position); ghost.visible = ghostRim.visible = true; prev.visible = true;
    return a;
  }
  function hidePreview() { guide.mesh.visible = ghost.visible = ghostRim.visible = spotRing.visible = dropRing.visible = false; prev.visible = false; }
  function updatePreview(now) {
    if (!prev.visible) return; guide.mat.uniforms.uTime.value = now;
    const pulse = .8 + .2 * Math.sin(now * 5); spotRing.material.opacity = .9 * pulse; dropRing.material.opacity = .75 * pulse; ghost.material.opacity = .78 + .1 * Math.sin(now * 4);
    ghost.position.y = phys.support(prev.aim.sx, prev.aim.sz, T.radius) + T.drop * (.45 + .15 * Math.sin(now * 3)); ghostRim.position.copy(ghost.position);
  }

  // ---------- balls (pooled) ----------
  const ballGeo = ballGeoShared();
  const fuseGeo = own(new THREE.CylinderGeometry(.045, .055, 1, 6)); fuseGeo.translate(0, .5, 0);
  const fuseMat = own(new THREE.MeshStandardMaterial({ color: '#c39b62', roughness: .95 }));
  // thumb hole direction in ball space (SphereGeometry: u -> phi, v -> theta; the hole is at u .5, v .47)
  const THUMB = new V3(-Math.cos(Math.PI) * Math.sin(.47 * Math.PI), Math.cos(.47 * Math.PI), Math.sin(Math.PI) * Math.sin(.47 * Math.PI)).normalize();
  const FUSE_LEN = .5;
  // ---------- round 3 (user 10-18 "hidden behind buildings before it blows"): x-ray silhouette ----------
  // A second draw of the ball geometry with depthFunc GreaterDepth: it only lands where something already drawn is in front of
  // the ball (the ball's own visible surface fails the test, helped by pulling the copy a little towards the camera). Dark navy
  // fill with a cream rim; during the fuse it pulses red with the ball's blink. The bottom band fades out near the ground (no
  // slivers where the ground mesh covers the ball's foot), and away from buildings (hills / trees only) and far away it is fainter.
  const XRAY_VS = 'uniform float uBias; varying vec3 vN; varying vec3 vV; varying float vWy; void main(){ vec4 w = modelMatrix * vec4(position,1.); vWy = w.y; vec4 mv = viewMatrix * w; float l = length(mv.xyz); mv.xyz *= max(0., 1. - uBias / max(l, 1e-3)); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
  const XRAY_FS = 'uniform float uOpacity, uHeat, uGround, uFeather; varying vec3 vN; varying vec3 vV; varying float vWy; void main(){ float f = 1. - abs(dot(normalize(vN), normalize(vV))); float rim = smoothstep(.5, .86, f); vec3 c = mix(vec3(.105,.14,.25), vec3(1.,.953,.863), rim); c = mix(c, vec3(1.,.27,.12), uHeat * (.6 + .4 * rim)); float a = uOpacity * mix(.64 + .25 * uHeat, 1., rim) * smoothstep(uGround, uGround + uFeather, vWy); gl_FragColor = vec4(c, a); }';
  // camera -> ball sight line against the building boxes (and hanok sites): a cheap "a building may be in the way" test
  const occluders = [...entries.map(e => ({ box: e.worldBounds, entry: e })), ...(protectedSet?.sites || []).map(s => ({ box: s.box, entry: null }))];
  const sightRay = new THREE.Ray(), sightHit = new V3();
  function sightBlocked(from, x, y, z) {
    const d = Math.hypot(x - from.x, y - from.y, z - from.z); if (!(d > 1e-3)) return false;
    sightRay.origin.copy(from); sightRay.direction.set((x - from.x) / d, (y - from.y) / d, (z - from.z) / d);
    for (const o of occluders) { if (o.entry?.cleared) continue; if (sightRay.intersectBox(o.box, sightHit) && sightHit.distanceTo(from) < d - T.radius * .5) return true; }
    return false;
  }
  const balls = Array.from({ length: Math.max(1, T.maxBalls) }, (_, i) => {
    const mat = own(new THREE.MeshPhysicalMaterial({ map: ballMap, bumpMap: holeBump, bumpScale: 4, roughness: .26, metalness: 0, clearcoat: 1, clearcoatRoughness: .07, envMap: envTex, envMapIntensity: .42, emissive: new THREE.Color('#ff3a1a'), emissiveIntensity: 0 }));
    // parked under the ground and visible, so the boot's shader warm-up compiles the material (culled while parked)
    const mesh = new THREE.Mesh(ballGeo, mat); mesh.name = `bowling-ball-${i}`; mesh.position.set(0, -5000, 0); mesh.scale.setScalar(1e-3); scene.add(mesh);
    const fuse = new THREE.Mesh(fuseGeo, fuseMat); fuse.position.copy(THUMB).multiplyScalar(.93); fuse.quaternion.setFromUnitVectors(UP, THUMB); fuse.scale.set(1, FUSE_LEN, 1); mesh.add(fuse);
    const spark = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: glowDot, color: '#ffd27a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))); spark.visible = false; scene.add(spark);
    // x-ray copy (a child: parked and warmed up with the ball) + the spark's hidden half (GreaterDepth: only where it is covered)
    const xmat = own(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthFunc: THREE.GreaterDepth, vertexShader: XRAY_VS, fragmentShader: XRAY_FS,
      uniforms: { uOpacity: { value: 0 }, uHeat: { value: 0 }, uGround: { value: -1e4 }, uFeather: { value: 1 }, uBias: { value: .6 } } }));
    const xray = new THREE.Mesh(ballGeo, xmat); xray.name = `bowling-ball-xray-${i}`; xray.renderOrder = 9; mesh.add(xray);
    const sparkX = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: glowDot, color: '#ffc06a', transparent: true, opacity: .75, depthWrite: false, depthFunc: THREE.GreaterDepth, blending: THREE.AdditiveBlending }))); sparkX.visible = false; sparkX.renderOrder = 9; scene.add(sparkX);
    // the last moments of the fuse: a red glow drawn over everything, pulsing with the blink
    const glow = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: glowDot, color: '#ff4a22', transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }))); glow.visible = false; glow.renderOrder = 10; scene.add(glow);
    const shadow = groundPatch(softDot, 8, { opacity: .55 });
    return { slot: i, on: false, mesh, mat, fuse, spark, sparkX, glow, xray, xmat, shadow, voice: null, struck: new Set(), hidden: false, xk: 0,
      crawl: 0, passSlow: 0, lastSp: 0, acc: 0, ploughAt: -1, wallClock: 0,
      px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0, r: T.radius, m: T.mass, grounded: false, event: 0, landSpeed: 0, blockSpeed: 0,
      age: 0, slow: 0, out: 0, entered: false, ax: 0, az: 0, anchorAt: 0, hitClock: 0, blockClock: 0, shieldClock: 0, crunchClock: 0, feedClock: 0,
      dust: 0, tx: 0, tz: 0, spin: 0, fuseLeft: -1, burn: 0, beepAt: 0, blink: 0, sparkAcc: 0, maxSpeed: 0, rec: null, inside: false };
  });
  const rollAgg = { count: 0, weight: 0, affected: [], cleared: [] }, rollPoint = new V3(), rollNormal = new V3(), ploughDir = new V3();
  function flushRoll(b, force) {
    if (!rollAgg.count) return;
    onDamage(rollAgg, { kind: 'roll', point: rollPoint, normal: rollNormal, radius: b.r * (T.ploughRadius + T.ploughGrow), force: 20, feedback: force || b.feedClock <= 0 });
    if (b.feedClock <= 0) b.feedClock = .12;
    rollAgg.count = 0; rollAgg.weight = 0; rollAgg.affected.length = 0; rollAgg.cleared.length = 0;
  }
  const merge = res => { rollAgg.count += res.count; rollAgg.weight += res.weight; for (const e of res.affected) if (!rollAgg.affected.includes(e)) rollAgg.affected.push(e); for (const e of res.cleared) if (!rollAgg.cleared.includes(e)) rollAgg.cleared.push(e); };

  let serial = 0, launched = 0, exploded = 0, freezeUntil = -1, slowUntil = -1, lastSummary = null;
  const history = [];
  function live() { let n = 0; for (const b of balls) if (b.on) n++; return n; }
  function launch(tx, tz, now = performance.now() / 1000) {
    if (![tx, tz].every(Number.isFinite)) return null;
    // the throw rolls exactly the previewed path when the spot is the previewed one
    const a = prev.aim && Math.hypot(prev.tx - tx, prev.tz - tz) < .8 ? { ...prev.aim } : phys.aim(tx, tz, { outside, inPlay, bounce: shieldBounce, blocked });
    if (!a) return null;
    hidePreview();
    let b = balls.find(x => !x.on);
    if (!b) { // all in use: the oldest blows up early and its slot is reused
      let old = null; for (const x of balls) if (!old || x.rec.id < old.rec.id) old = x;
      old.rec.end = old.rec.end || 'replaced'; blast(old, now); b = old;
    }
    const rec = { id: ++serial, at: now, roll: 0, strike: 0, shock: 0, shrapnel: 0, blast: 0, pieces: 0, buildings: [], shield: 0, strikes: 0, end: '', seconds: 0, maxSpeed: 0, drop: [+a.sx.toFixed(1), +a.sz.toFixed(1)], target: [+tx.toFixed(1), +tz.toFixed(1)], aimMiss: +a.dmin.toFixed(1), blastPoint: null, tx, tz, passD: Infinity, arrive: null, predicted: +a.at.toFixed(2), walls: 0, armedAt: null };
    history.push(rec); if (history.length > 8) history.shift();
    Object.assign(b, { on: true, rec, r: T.radius, m: T.mass, px: a.sx, pz: a.sz, vx: a.vx, vy: 0, vz: a.vz, grounded: false, airT: 1, age: 0, slow: 0, out: 0, entered: false, anchorAt: 0, hitClock: 0, blockClock: 0, shieldClock: 0, crunchClock: 0, feedClock: 0, dust: 0, spin: 0, fuseLeft: -1, burn: 0, beepAt: 0, blink: 0, sparkAcc: 0, maxSpeed: 0, inside: false, crawl: 0, passSlow: 0, lastSp: 0, acc: 0, ploughAt: -1, wallClock: 0, xk: 0, hidden: false });
    b.py = phys.support(a.sx, a.sz, b.r) + T.drop; b.ax = b.px; b.az = b.pz; b.tx = b.px; b.tz = b.pz; b.struck.clear();
    b.mesh.scale.setScalar(b.r); b.mesh.position.set(b.px, b.py, b.pz); b.mesh.quaternion.setFromEuler(new THREE.Euler(rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)));
    b.fuse.visible = true; b.fuse.scale.y = FUSE_LEN; b.mat.emissiveIntensity = 0; b.spark.visible = true; b.shadow.visible = true;
    b.spark.material.depthTest = true; b.spark.renderOrder = 0; b.glow.visible = false; b.xmat.uniforms.uOpacity.value = 0; b.xmat.uniforms.uHeat.value = 0;
    b.voice?.stop(); b.voice = audio.voice(); audio.play('launch', .5);
    // release: a puff and a ring on the slope where it is let go (it lands with a thud and a crack a moment later)
    { const gy = heightAt(b.px, b.pz); shock(b.px, b.pz, b.r * 4, now); for (let i = 0; i < (mobile ? 8 : 14); i++) { const q = rnd(0, 6.28), sp = rnd(3, 6); dust.spawn(b.px + Math.cos(q) * b.r * .7, gy + .5, b.pz + Math.sin(q) * b.r * .7, Math.cos(q) * sp, rnd(.5, 2), Math.sin(q) * sp, b.r * .6, b.r * .9, rnd(1, 1.6), .55, .82, .77, .66, 2, .5); } }
    launched++; if (follow && view) cam.start(b, tx, tz);
    return { ...rec, drop: a };
  }
  function summary(rec) {
    const W = campus.totalWeight / 100, f = v => +(v / W).toFixed(2);
    return { id: rec.id, rollPct: f(rec.roll), strikePct: f(rec.strike + rec.shock), shrapnelPct: f(rec.shrapnel), blastPct: f(rec.blast), totalPct: f(rec.roll + rec.strike + rec.shock + rec.shrapnel + rec.blast),
      arrive: rec.arrive, passMiss: Number.isFinite(rec.passD) ? +rec.passD.toFixed(1) : null, predicted: rec.predicted,
      pieces: rec.pieces, buildings: [...rec.buildings], strikes: rec.strikes, shield: rec.shield, end: rec.end, armedAt: rec.armedAt, walls: rec.walls, seconds: +rec.seconds.toFixed(1), maxSpeed: +rec.maxSpeed.toFixed(1), aimMiss: rec.aimMiss, drop: rec.drop, target: rec.target, blastPoint: rec.blastPoint };
  }
  function note(rec, res) { rec.pieces += res.count; for (const e of res.affected) if (!rec.buildings.includes(e.id)) rec.buildings.push(e.id); }
  function arm(b, reason, fuse = T.fuse) { if (b.fuseLeft >= 0) { b.fuseLeft = Math.min(b.fuseLeft, fuse); return; } b.fuseLeft = fuse; b.burn = fuse; b.rec.end = reason; b.rec.armedAt = +b.age.toFixed(2); b.beepAt = 0; }
  function park(b) {
    b.on = false; b.voice?.stop(); b.voice = null; b.spark.visible = b.sparkX.visible = b.glow.visible = false; b.shadow.visible = false; b.fuse.visible = false; b.xmat.uniforms.uOpacity.value = 0;
    b.mesh.position.set(0, -5000, 0); b.mesh.scale.setScalar(1e-3);
  }

  // ---------- strike, plough, bump ----------
  function strike(b, sp, at, dx, dz, from, now) {
    const rec = b.rec; rec.strikes++;
    const k = clamp(sp / 22, .6, 1.6);
    freezeUntil = now + (reducedMotion ? T.hitstop * .5 : T.hitstop); slowUntil = freezeUntil + (reducedMotion ? 0 : T.slowmo);
    // the pins: a wider blast where it hits ...
    const res = campus.hit(at, b.r * T.strikeRadius, T.strikeForce, { direction: tB.set(dx, .35, dz).normalize() });
    rec.strike += res.weight; note(rec, res);
    if (res.count) onDamage(res, { kind: 'strike', point: at, normal: tC.set(-dx, .3, -dz).normalize(), radius: b.r * T.strikeRadius, force: T.strikeForce, feedback: true });
    // ... a shock on the near side of buildings close by ...
    for (const e of entries) {
      if (e.cleared || e === from) continue;
      const d = e.worldBounds.distanceToPoint(at); if (d > T.shockReach) continue;
      e.worldBounds.clampPoint(at, tA); tA.y = Math.max(tA.y, at.y);
      const r2 = campus.hit(tA, T.shockRadius, T.shockForce, { direction: tB.set(tA.x - at.x, 2, tA.z - at.z).normalize() });
      if (r2.count) { rec.shock += r2.weight; note(rec, r2); onDamage(r2, { kind: 'shock', point: tA, normal: UP, radius: T.shockRadius, force: T.shockForce, feedback: true }); }
    }
    // ... and chunks thrown forward and up that break what they fly into
    const n = mobile ? T.shrapnelPhone : T.shrapnel, base = Math.atan2(dz, dx);
    for (let i = 0; i < n; i++) { const a = base + rnd(-1.1, 1.1), s = rnd(14, 26) * Math.min(1.3, k); addChunk(at.x + Math.cos(a) * b.r * .6, at.y + rnd(0, b.r), at.z + Math.sin(a) * b.r * .6, Math.cos(a) * s, rnd(6, 14), Math.sin(a) * s, rnd(.7, 1.5), true, from, rec); }
    // look + sound
    const gy = heightAt(at.x, at.z);
    decal(at.x - dx * b.r * .3, at.z - dz * b.r * .3, b.r * 4.4, now); shock(at.x, at.z, b.r * 9 * k, now);
    for (let i = 0; i < (mobile ? 30 : 46); i++) { const a = rnd(0, 6.28), s = rnd(5, 14) * k; dust.spawn(at.x + Math.cos(a) * b.r, gy + rnd(.3, b.r * 1.2), at.z + Math.sin(a) * b.r, Math.cos(a) * s + dx * sp * .3, rnd(1, 6), Math.sin(a) * s + dz * sp * .3, rnd(.9, 1.5) * b.r, b.r * 1.5, rnd(1.8, 3.2), .62, .78, .75, .7, 1.5, .7); }
    flash(at.x, at.y + b.r * .4, at.z, b.r * 2, b.r * 6 * k, .28, reducedMotion ? .35 : .8);
    audio.play('strike', k);
    onStrike({ point: at, speed: sp, cleared: res.cleared.length });
  }
  function plough(b, sp, now) {
    const rec = b.rec; let dx = b.vx, dz = b.vz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; if (l < 1e-3) { dx = 1; dz = 0; }
    const k = clamp(sp / 22, 0, 1.3), R = b.r * (T.ploughRadius + T.ploughGrow * k), F = clamp(T.ploughForce + sp * T.ploughForcePerSpeed * b.m, 5, 30);
    const at = rollPoint.set(b.px + dx * Math.min(b.r * .45, sp * .03), b.py, b.pz + dz * Math.min(b.r * .45, sp * .03));
    rollNormal.set(-dx, .3, -dz).normalize();
    const dir = ploughDir.set(dx, .25, dz).normalize();
    let first = null, count = 0, weight = 0;
    for (let i = 0; i <= T.columnHits; i++) {
      const hp = i ? tC.set(at.x, at.y + b.r * T.columnStep * i, at.z) : at;
      const res = campus.hit(hp, i ? R * (1 - .15 * i) : R, i ? F * .85 : F, { direction: dir });
      if (!res.count) continue;
      merge(res); note(rec, res); count += res.count; weight += res.weight; if (!first) first = res.affected[0];
      if (i === 0) for (const e of res.affected) if (!b.struck.has(e.id)) { b.struck.add(e.id); if (sp >= T.strikeSpeed) strike(b, sp, at, dx, dz, e, now); else onKick('bump'); }
    }
    if (!count) return false;
    rec.roll += weight;
    // momentum: only the ploughed pieces slow it, never more than maxLoss per hit
    const keep = Math.max(1 - T.maxLoss, Math.exp(-(weight / pieceWeight) / (T.eat * b.m)));
    b.vx *= keep; b.vy *= keep; b.vz *= keep;
    const chunk = Math.min(mobile ? 10 : 18, 2 + count / 5);
    for (let i = 0; i < chunk; i++) dust.spawn(at.x + dx * b.r * .7 + rnd(-b.r, b.r) * .6, at.y + rnd(-b.r, b.r * 2), at.z + dz * b.r * .7 + rnd(-b.r, b.r) * .6, dx * sp * .25 + rnd(-3, 3), rnd(1, 4), dz * sp * .25 + rnd(-3, 3), rnd(2, 3.6) * b.r * .6, b.r * .9, rnd(1.6, 2.8), .55, .74, .72, .69, 1.4, .5);
    if (b.crunchClock <= 0) { audio.play('crunch', Math.min(1.2, count / 40 + sp / 40)); b.crunchClock = .11; }
    b.slow = 0; b.inside = true; b.ploughAt = b.age;
    return true;
  }
  // slow ball against an intact wall: a few horizontal rays against the fragment meshes (broken pieces are skipped)
  const raycaster = new THREE.Raycaster(), meshList = [], hits = [];
  function bump(b) {
    const sp = Math.hypot(b.vx, b.vz); if (sp < .05) return;
    meshList.length = 0; tA.set(b.px, b.py, b.pz);
    for (const e of entries) if (!e.cleared && e.worldBounds.distanceToPoint(tA) < b.r + 1) for (const m of e.model.meshes) meshList.push(m);
    if (!meshList.length) return;
    const base = Math.atan2(b.vz, b.vx);
    for (const off of [0, .6, -.6]) for (const dy of [0, -b.r * .5]) {
      raycaster.set(tA.set(b.px, b.py + dy, b.pz), tB.set(Math.cos(base + off), 0, Math.sin(base + off))); raycaster.far = b.r + .4;
      hits.length = 0; raycaster.intersectObjects(meshList, false, hits); const hit = hits[0];
      if (hit) {
        const n = tC.copy(hit.face.normal).transformDirection(hit.object.matrixWorld); if (n.x * tB.x + n.z * tB.z > 0) n.negate();
        const push = (b.r + .4 - hit.distance) * .5, px = b.px - tB.x * push, pz = b.pz - tB.z * push, l = Math.hypot(n.x, n.z) || 1, nx = n.x / l, nz = n.z / l, vn = b.vx * nx + b.vz * nz;
        b.px = px; b.pz = pz; b.py = Math.max(b.py, phys.support(px, pz, b.r));
        if (vn < 0) { b.vx -= 1.25 * vn * nx; b.vz -= 1.25 * vn * nz; if (-vn > 2.5) audio.play('bump', -vn / 12); }
        b.inside = true; return;
      }
    }
  }
  function landed(b, vn, now) {
    audio.play('land', vn / 12); if (vn > 8) onKick('land');
    const gx = b.px, gz = b.pz, gy = heightAt(gx, gz);
    for (let i = 0; i < (mobile ? 12 : 18); i++) { const a = rnd(0, 6.28), s = rnd(4, 9) * Math.min(1.5, vn / 10); dust.spawn(gx + Math.cos(a) * b.r * .8, gy + .4, gz + Math.sin(a) * b.r * .8, Math.cos(a) * s, rnd(.5, 2), Math.sin(a) * s, b.r * .7, b.r * 1.1, rnd(1.2, 2), .6, .8, .74, .63, 2.2, .4); }
    if (vn > 8) decal(gx, gz, b.r * 3.2, now);
  }

  // ---------- the bomb ----------
  const smokeEv = Array.from({ length: 4 }, () => ({ on: false, age: 0, x: 0, y: 0, z: 0, acc: 0 }));
  function blast(b, now) {
    if (!b.on) return;
    const rec = b.rec, p = tA.set(b.px, b.py - b.r * .2, b.pz);
    rec.blastPoint = [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)]; rec.seconds = b.age;
    if (!rec.end) rec.end = 'blast';
    const res = campus.hit(p, T.blastRadius, T.blastForce);
    rec.blast += res.weight; note(rec, res);
    const near = protectedSet?.nearestSurface(p, T.blastRadius);
    if (near) { rec.shield++; onShield(near.point, near.normal, true, Math.max(8, T.blastRadius * 1.5)); }
    // look: fireball, smoke column (staged), chunks, scorch + ring; the host adds the mini-bomb blast stack
    const gy = heightAt(p.x, p.z), R = T.blastRadius, sq = mobile ? .7 : 1;
    flash(p.x, p.y + 1.5, p.z, R * 1.2, R * 4.2, .38, reducedMotion ? .45 : 1); knockTrees(p.x, p.z, R * .9, 0, 0, true);
    for (let i = 0; i < 60 * sq; i++) { const a = rnd(0, 6.28), e = rnd(-.2, 1), s = rnd(4, 16); fire.spawn(p.x + rnd(-1, 1), p.y + rnd(0, 1.5), p.z + rnd(-1, 1), Math.cos(a) * s * (1 - e * .5), e * s + 3, Math.sin(a) * s * (1 - e * .5), rnd(3.4, 6), R * .7, rnd(.35, .7), 1, i < 8 ? 1 : .95, i < 8 ? .9 : rnd(.38, .6), i < 8 ? .7 : rnd(.08, .2), 4.5, 2); }
    for (let i = 0; i < 30 * sq; i++) { const a = rnd(0, 6.28), s = rnd(8, 18); fire.spawn(p.x, p.y + 1, p.z, Math.cos(a) * s, rnd(4, 16), Math.sin(a) * s, rnd(.35, .6), -.2, rnd(.5, 1.1), 1, 1, .7, .3, 1.2, -16); }
    for (let i = 0; i < 24 * sq; i++) { const a = i / 24 * 6.283, s = rnd(10, 18); dust.spawn(p.x + Math.cos(a) * R * .3, gy + .6, p.z + Math.sin(a) * R * .3, Math.cos(a) * s, rnd(.5, 2), Math.sin(a) * s, R * .25, R * .35, rnd(1.4, 2.2), .7, .77, .71, .6, 2.4, .6); }
    for (let i = 0; i < (mobile ? 8 : 14); i++) { const a = rnd(0, 6.28), s = rnd(8, 20); addChunk(p.x, p.y + 1, p.z, Math.cos(a) * s, rnd(8, 18), Math.sin(a) * s, rnd(.5, 1.2), false, null, null); }
    const ev = smokeEv.find(e => !e.on) || smokeEv[0]; Object.assign(ev, { on: true, age: 0, x: p.x, y: p.y, z: p.z, acc: 0 });
    scorch(p.x, p.z, R * 1.6, now); decal(p.x, p.z, R * 1.4, now); shock(p.x, p.z, R * 3.4, now);
    audio.play('blast', 1);
    exploded++;
    const point = p.clone();
    park(b);
    onBlast({ point, normal: UP, result: res, inside: b.inside, reason: rec.end });
    if (res.count) onDamage(res, { kind: 'blast', point, normal: UP, radius: T.blastRadius, force: T.blastForce, feedback: true });
    lastSummary = summary(rec);
  }
  function updateSmoke(dt) {
    for (const e of smokeEv) {
      if (!e.on || dt <= 0) continue; e.age += dt; if (e.age > 1.3) { e.on = false; continue; }
      e.acc += dt * (mobile ? 18 : 30); const R = T.blastRadius;
      while (e.acc >= 1) { e.acc--; const w = R * .2 * (1 - e.age * .4), c = .2 + Math.random() * .12; dust.spawn(e.x + rnd(-w, w), e.y + rnd(0, R * .3) + e.age * 4, e.z + rnd(-w, w), rnd(-1.2, 1.2) + 1.2, rnd(7, 14), rnd(-1.2, 1.2) + .6, R * .22, R * rnd(.3, .45), rnd(2, 3), .7, c, c * .95, c * .9, .9, 1.6); }
    }
  }

  // ---------- round 3 (user 10-18): the play-area edge is an invisible wall ----------
  // Past it is the village / backdrop, which nothing can damage, so once the ball is in the play area it bounces back off the
  // edge (no wall is drawn: a soft puff and a low thud). It is pushed back inside on every substep (no creeping along the edge);
  // the puff / thud have a cooldown. A ball that then slows down along the edge is caught by the crawl rule and blows up inside.
  function wall(b) {
    const m = b.r; let nx = 0, nz = 0;
    if (b.px < playBox.min.x + m) { b.px = playBox.min.x + m; nx = 1; } else if (b.px > playBox.max.x - m) { b.px = playBox.max.x - m; nx = -1; }
    if (b.pz < playBox.min.z + m) { b.pz = playBox.min.z + m; nz = 1; } else if (b.pz > playBox.max.z - m) { b.pz = playBox.max.z - m; nz = -1; }
    if (!nx && !nz) return;
    const l = Math.hypot(nx, nz); nx /= l; nz /= l;
    const vn = b.vx * nx + b.vz * nz;
    if (vn < 0) {
      const tx = b.vx - vn * nx, tz = b.vz - vn * nz; // along the edge
      b.vx = tx * T.wallKeep - vn * T.wallBounce * nx; b.vz = tz * T.wallKeep - vn * T.wallBounce * nz;
      if (-vn > 2.5 && b.wallClock <= 0) {
        b.wallClock = .3; b.rec.walls++; audio.play('wall', -vn / 14); audio.play('bump', -vn / 20);
        const ex = b.px - nx * b.r, ez = b.pz - nz * b.r, gy = heightAt(ex, ez), k = Math.min(1.4, -vn / 14);
        for (let i = 0; i < (mobile ? 8 : 14); i++) { const s = rnd(2, 6) * k, q = rnd(-1.3, 1.3), cx = nx * Math.cos(q) - nz * Math.sin(q), cz = nz * Math.cos(q) + nx * Math.sin(q); dust.spawn(ex + rnd(-1, 1), gy + rnd(.4, b.r), ez + rnd(-1, 1), cx * s, rnd(.6, 2.4), cz * s, b.r * rnd(.5, .8), b.r * .9, rnd(1, 1.7), .5, .82, .77, .66, 2, .45); }
      }
    }
    b.py = Math.max(b.py, phys.support(b.px, b.pz, b.r));
  }

  // ---------- frame ----------
  function stepBall(b, h, now) {
    b.hitClock -= h; b.blockClock -= h; b.wallClock -= h; b.shieldClock -= h; b.crunchClock -= h; b.feedClock -= h;
    phys.step(b, h);
    if (b.entered) wall(b);
    if (b.event & 1) landed(b, b.landSpeed, now);
    if (b.event & 2) audio.play('bump', b.blockSpeed / 12);
    if (b.shieldClock <= 0) {
      const near = shieldBounce(b);
      if (near) { const sp = Math.hypot(b.vx, b.vy, b.vz); onShield(near.point, near.normal, sp > 8, Math.max(8, b.r * 2.6)); b.shieldClock = .22; b.rec.shield++; }
    }
    if (b.hitClock > 0 && b.blockClock > 0) return;
    const sp = Math.hypot(b.vx, b.vy, b.vz), reach = b.r * (T.ploughRadius + T.ploughGrow * clamp(sp / 22, 0, 1.3)) + .6;
    let near = false; tA.set(b.px, b.py, b.pz); for (const e of entries) if (!e.cleared && e.worldBounds.distanceToPoint(tA) < reach) { near = true; break; }
    if (!near) { b.inside = false; return; }
    if (sp > T.breakSpeed && b.hitClock <= 0) { b.hitClock = 1 / T.ploughRate; if (!plough(b, sp, now) && b.blockClock <= 0) { b.blockClock = 1 / 30; bump(b); } }
    else if (sp <= T.breakSpeed && b.blockClock <= 0) { b.blockClock = 1 / 30; bump(b); }
  }
  const SUB = 1 / 120, spinAxis = new V3(), tipW = new V3();
  function updateBall(b, dt, realDt, now) {
    if (dt > 0) { let left = dt; while (left > 1e-6 && b.on) { const h = Math.min(SUB, left); left -= h; stepBall(b, h, now); } }
    if (!b.on) return;
    // never let a broken state run on (a non-finite position would also stall the tree lookup): end the throw quietly
    if (!Number.isFinite(b.px + b.py + b.pz + b.vx + b.vy + b.vz)) { b.rec.end = 'invalid'; park(b); return; }
    flushRoll(b, false);
    // ball-ball
    for (const o of balls) if (o !== b && o.on) {
      const dx = b.px - o.px, dy = b.py - o.py, dz = b.pz - o.pz, d = Math.hypot(dx, dy, dz), m = b.r + o.r;
      if (d > 0 && d < m) { const nx = dx / d, ny = dy / d, nz = dz / d, push = (m - d) / 2; b.px += nx * push; b.py += ny * push; b.pz += nz * push; o.px -= nx * push; o.py -= ny * push; o.pz -= nz * push;
        const rv = (b.vx - o.vx) * nx + (b.vy - o.vy) * ny + (b.vz - o.vz) * nz; if (rv < 0) { b.vx -= rv * .9 * nx; b.vy -= rv * .9 * ny; b.vz -= rv * .9 * nz; o.vx += rv * .9 * nx; o.vy += rv * .9 * ny; o.vz += rv * .9 * nz; audio.play('bump', -rv / 10); } }
    }
    b.age += dt; const sp = Math.hypot(b.vx, b.vy, b.vz), vh = Math.hypot(b.vx, b.vz); if (sp > b.maxSpeed) b.rec.maxSpeed = b.maxSpeed = sp;
    // roll without slipping
    if (vh > 1e-4 && dt > 0) { spinAxis.set(b.vz / vh, 0, -b.vx / vh); tQ.setFromAxisAngle(spinAxis, vh * dt / b.r); b.mesh.quaternion.premultiply(tQ); b.spin += vh * dt / b.r; }
    b.mesh.position.set(b.px, b.py, b.pz); b.mesh.updateMatrixWorld();
    { const d = Math.hypot(b.px - b.rec.tx, b.pz - b.rec.tz); if (d < b.rec.passD) { b.rec.passD = d; b.rec.arrive = +b.age.toFixed(2); }
      // well past the spot it brakes (low friction keeps the run down fast; this keeps the run-out short)
      else if (b.grounded && d > b.rec.passD + T.runOut) { const k = Math.exp(-T.runOutBrake * dt); b.vx *= k; b.vz *= k; } }
    const gh = heightAt(b.px, b.pz), above = b.py - b.r - gh;
    b.shadow.userData.place(b.px, b.pz, b.r * 2.4, 0, .05); b.shadow.material.opacity = .55 * clamp(1 - above / (b.r * 3), 0, 1);
    // trail + rolling dust
    if (b.grounded && dt > 0) {
      if (Math.hypot(b.px - b.tx, b.pz - b.tz) > 1.1) { if (vh > 5) trail.add(b.tx, b.tz, b.px, b.pz, b.r * .45, clamp((vh - 5) / 16, .12, .42), now); b.tx = b.px; b.tz = b.pz; }
      b.dust += dt * clamp(vh * 1.3, 0, 40) * (mobile ? .6 : 1);
      while (b.dust > 1) { b.dust--; const a = rnd(0, 6.28), bx = b.vx / Math.max(1, vh), bz = b.vz / Math.max(1, vh); dust.spawn(b.px - bx * b.r * .6 + Math.cos(a) * b.r * .5, gh + rnd(.2, .8), b.pz - bz * b.r * .6 + Math.sin(a) * b.r * .5, -b.vx * .08 + rnd(-1.2, 1.2), rnd(.6, 2.2), -b.vz * .08 + rnd(-1.2, 1.2), b.r * rnd(.35, .6), b.r * .7, rnd(1, 1.9), .5, .82, .76, .64, 1.8, .45); }
    }
    if (vh > 2 && dt > 0) knockTrees(b.px, b.pz, b.r + 1.2, b.vx / vh, b.vz / vh, false);
    // fuse: fizzing tip while it rolls; burning down (shorter, brighter, blinking, beeping faster) once armed
    const burning = b.fuseLeft >= 0, share = burning ? clamp(b.fuseLeft / b.burn, 0, 1) : 1;
    b.fuse.scale.y = FUSE_LEN * (burning ? .15 + .85 * share : 1);
    tipW.copy(THUMB).multiplyScalar(.93 + b.fuse.scale.y); b.mesh.localToWorld(tipW);
    const flick = .75 + Math.random() * .5; b.spark.position.copy(tipW); b.spark.scale.setScalar((burning ? 2.6 - share : 1.25) * flick);
    b.sparkAcc += realDt * (burning ? 80 : 26) * (mobile ? .6 : 1);
    while (b.sparkAcc >= 1) { b.sparkAcc--; const a = rnd(0, 6.28), s = rnd(2, 6); fire.spawn(tipW.x, tipW.y, tipW.z, Math.cos(a) * s + b.vx * .5, rnd(1, 5), Math.sin(a) * s + b.vz * .5, rnd(.18, .34), -.1, rnd(.18, .4), 1, 1, rnd(.55, .85), .25, .8, -14); }
    let blinkOn = 0, urgency = 0;
    if (burning) {
      urgency = 1 - share; const rate = 4 + urgency * 14; b.blink += realDt * rate; blinkOn = b.blink % 1 < .5 ? 1 : 0; b.mat.emissiveIntensity = (blinkOn ? 1 : .08) * (.3 + urgency * .7);
      if (b.age >= b.beepAt) { audio.play('beep', urgency); b.beepAt = b.age + 1 / rate; }
      // round 3: it brakes while the fuse burns, so the blast is where it was armed (next to / inside what it was ploughing)
      if (dt > 0) { const k = Math.exp(-T.fuseBrake * dt); b.vx *= k; b.vz *= k; }
      b.fuseLeft -= dt;
      if (b.fuseLeft <= 0) { b.voice?.set(0, false, 0, false); blast(b, now); return; }
    }
    sightline(b, burning, blinkOn, urgency, realDt);
    b.voice?.set(sp, b.grounded, b.spin, burning);
    // when to light the short fuse
    if (inPlay(b.px, b.pz)) { b.entered = true; b.out = 0; }
    else if (b.entered || b.age > 2) { b.out += dt; const k = Math.exp(-2.6 * dt); b.vx *= k; b.vz *= k; if (b.out > T.outTime) arm(b, 'left-campus'); } // safety net (the edge wall keeps it in)
    if (b.age > T.armDelay && b.grounded && sp < T.stopSpeed) { b.slow += dt; if (b.slow > T.stopTime) arm(b, b.inside ? 'stopped-in-building' : 'stopped'); } else if (sp >= T.stopSpeed) b.slow = 0;
    if (b.age - b.anchorAt > 1.5) { if (Math.hypot(b.px - b.ax, b.pz - b.az) < b.r * .6) arm(b, b.inside ? 'stuck-in-building' : 'stuck'); b.ax = b.px; b.az = b.pz; b.anchorAt = b.age; }
    // round 3 (user 10-18 "it crawls for a long time"): end the slow tail. Ploughing keeps it going unless it really crawls.
    if (dt > 0) { b.acc += ((sp - b.lastSp) / dt - b.acc) * Math.min(1, dt * 8); b.lastSp = sp; }
    if (b.age > T.armDelay && b.fuseLeft < 0) {
      const busy = b.age - b.ploughAt < .25, past = Math.hypot(b.px - b.rec.tx, b.pz - b.rec.tz) > b.rec.passD + T.passMargin, reached = past || b.struck.size > 0;
      const line = !reached ? T.crawlSpeed : Math.max(T.crawlSpeed, T.crawlShare * b.maxSpeed * (busy ? .6 : 1));
      if (sp < line) { b.crawl += dt; if (b.crawl > T.crawlTime) arm(b, b.inside ? 'crawl-in-building' : 'crawl'); } else b.crawl = 0;
      if (past && !busy && b.acc < -T.passDecel) { b.passSlow += dt; if (b.passSlow > T.passSlowTime) arm(b, b.inside ? 'past-spot-in-building' : 'past-spot'); } else b.passSlow = 0;
    }
    if (b.age > T.maxLife) arm(b, 'timeout');
  }
  // x-ray strength + the fuse cues drawn over everything (round 3). A building box on the camera -> ball line means it may be
  // hidden: full silhouette (the GPU test decides which pixels); otherwise (hills, trees) a fainter one; fainter far away.
  function sightline(b, burning, blinkOn, urgency, realDt) {
    const cp = camera.position, cy = b.py + b.r * .2;
    b.hidden = sightBlocked(cp, b.px, cy, b.pz) && sightBlocked(cp, b.px, b.py + b.r * 1.1, b.pz) && sightBlocked(cp, tipW.x, tipW.y, tipW.z);
    const want = sightBlocked(cp, b.px, cy, b.pz) || b.hidden ? 1 : T.xrayTerrain;
    b.xk += (want - b.xk) * Math.min(1, realDt * 8);
    const dist = Math.hypot(b.px - cp.x, b.py - cp.y, b.pz - cp.z), far = clamp(1 - (dist - 140) / Math.max(1, T.xrayFar - 140), .45, 1);
    const heat = burning ? (blinkOn ? .55 + .45 * urgency : .15) : 0, u = b.xmat.uniforms;
    u.uOpacity.value = T.xray * b.xk * far * (burning ? 1.25 : 1); u.uHeat.value = heat; u.uGround.value = heightAt(b.px, b.pz) + .05; u.uFeather.value = b.r * .35;
    // the spark's covered half; in the last moments the spark itself and a red glow go on top of everything instead
    const top = burning && b.fuseLeft <= T.fuseOnTop;
    b.spark.material.depthTest = !top; b.spark.renderOrder = top ? 10 : 0;
    b.sparkX.visible = !top; b.sparkX.position.copy(b.spark.position); b.sparkX.scale.copy(b.spark.scale); b.sparkX.material.opacity = .75 * clamp(b.xk, .4, 1);
    b.glow.visible = top;
    if (top) { const px = Math.max(b.r * .9, upp(tipW.x, tipW.y, tipW.z) * 30); b.glow.position.copy(tipW); b.glow.scale.setScalar(px * (blinkOn ? 1.6 + urgency * .8 : 1.05)); b.glow.material.opacity = blinkOn ? .75 + .25 * urgency : .35; }
  }
  // ---------- follow camera (round 2: framing, not chasing) ----------
  // On release it frames the drop point and the spot together (~.45 s), then keeps the ball and the spot in view (after the
  // ball has passed the spot: the ball and its surroundings), from the player's own direction (no swinging round), a little
  // higher so it sees over roofs; it holds on the blast and then hands the player's view back. It drives the game view
  // through adoptPose (taps keep aiming at what is on screen); any pan / orbit / zoom by the player ends it on the spot.
  const cam = (() => {
    const pos = new V3(), look = new V3(), want = new V3(), from = new V3(), fromLook = new V3(), spot = new V3(), drop = new V3();
    const saved = { pos: new V3(), look: new V3(), ground: 0 }, last = { az: 0, el: 0, zoom: 0, x: 0, y: 0, z: 0 };
    let active = false, ball = null, phase = 'intro', t = 0, az = 0, el = .5, dist = 80, passed = false, nearest = Infinity;
    // round 3: hidden behind a building for a moment -> lift a little (only to a height whose sight line is clear; never back down)
    let lift = 0, liftWant = 0, hiddenT = 0, nudges = 0; const probe = new V3();
    const smooth = k => k * k * (3 - 2 * k);
    function record() { const s = view.state; last.az = s.azimuth; last.el = s.elevation; last.zoom = s.zoom; [last.x, last.y, last.z] = s.target; }
    function touched() { const s = view.state; return Math.abs(s.azimuth - last.az) > 1e-5 || Math.abs(s.elevation - last.el) > 1e-5 || Math.abs(s.zoom - last.zoom) > 1e-5 || Math.abs(s.target[0] - last.x) > 1e-4 || Math.abs(s.target[1] - last.y) > 1e-4 || Math.abs(s.target[2] - last.z) > 1e-4; }
    // distance that fits a ground circle of radius r (plus a ball's height) on screen at this elevation
    function fit(r) { const s = view.state, tv = Math.tan(camera.fov * Math.PI / 360), th = tv * s.width / Math.max(1, s.height); return clamp(r * 1.05 / Math.min(tv, th) + T.radius * 4, 40, 260); }
    function frame(ax, az2, bx, bz, extra, dt, rate) {
      const cx = (ax + bx) / 2, cz = (az2 + bz) / 2, r = Math.hypot(ax - bx, az2 - bz) / 2 + extra;
      want.set(cx, heightAt(cx, cz) + T.radius, cz); look.lerp(want, 1 - Math.exp(-rate * dt)); dist += (fit(r) - dist) * (1 - Math.exp(-rate * .8 * dt));
      place(pos, el + lift);
    }
    function place(v, e) { e = Math.min(1.25, e); return v.set(look.x + Math.sin(az) * Math.cos(e) * dist, look.y + Math.sin(e) * dist, look.z + Math.cos(az) * Math.cos(e) * dist); }
    function nudge(dt) {
      if (!ball?.on) return;
      hiddenT = ball.hidden ? hiddenT + dt : 0;
      if (hiddenT > T.nudgeAfter && liftWant < T.nudgeMax && el + liftWant < 1.25) {
        for (let k = liftWant + .15; k <= T.nudgeMax + 1e-6 && el + k <= 1.25 + 1e-6; k += .15) { place(probe, el + k); if (!sightBlocked(probe, ball.px, ball.py + ball.r * .2, ball.pz)) { liftWant = k; nudges++; break; } }
        hiddenT = 0;
      }
      lift += (liftWant - lift) * (1 - Math.exp(-2.2 * dt));
    }
    return {
      get active() { return active; },
      start(b, tx, tz) {
        if (!active) {
          saved.pos.copy(camera.position); saved.look.copy(view.target); saved.ground = view.state.groundLevel;
          look.copy(saved.look); dist = camera.position.distanceTo(saved.look); const st = view.state; az = st.azimuth; el = clamp(st.elevation, .5, .95);
        }
        active = true; ball = b; phase = 'intro'; t = 0; passed = false; nearest = Infinity; liftWant = 0; hiddenT = 0; spot.set(tx, 0, tz); drop.set(b.px, 0, b.pz);
        record();
      },
      cancel() { active = false; ball = null; lift = liftWant = 0; },
      get stats() { return { lift: +lift.toFixed(3), liftWant: +liftWant.toFixed(2), nudges }; },
      update(dt) {
        if (!active) return false;
        if (touched()) { active = false; ball = null; lift = liftWant = 0; return false; }
        dt = Math.max(0, Math.min(.1, dt)); t += dt;
        if (phase === 'intro') { frame(drop.x, drop.z, spot.x, spot.z, T.radius * 2 + 4, dt, 7); if (t > .45 || !ball?.on) { phase = 'follow'; t = 0; } }
        else if (phase === 'follow') {
          if (!ball?.on) { phase = 'hold'; t = 0; }
          else {
            const d = Math.hypot(ball.px - spot.x, ball.pz - spot.z); if (d < nearest) nearest = d; else if (d > nearest + 6) passed = true;
            nudge(dt); if (passed) frame(ball.px, ball.pz, ball.px, ball.pz, 18, dt, 2.5); else frame(ball.px, ball.pz, spot.x, spot.z, T.radius * 2 + 4, dt, 3);
          }
        }
        if (phase === 'hold') { if (t > 1.3) { phase = 'return'; t = 0; from.copy(pos); fromLook.copy(look); } }
        if (phase === 'return') {
          const k = smooth(Math.min(1, t / .9)); pos.lerpVectors(from, saved.pos, k); look.lerpVectors(fromLook, saved.look, k);
          if (k >= 1) { view.adoptPose(saved.pos, saved.look, { groundLevel: saved.ground }); active = false; ball = null; lift = 0; return true; }
        }
        view.adoptPose(pos, look, { groundLevel: heightAt(look.x, look.z) }); record(); return true;
      },
    };
  })();
  function timeScale(now) {
    if (now < freezeUntil) return 0;
    if (now < slowUntil) { const t = 1 - (slowUntil - now) / Math.max(.01, T.slowmo); return .35 + .65 * t * t; }
    return 1;
  }
  let lastFrame = 0;
  function update(simDt, realDt, now) {
    const scale = timeScale(now), dt = Math.max(0, Math.min(.05, (Number.isFinite(simDt) ? simDt : 0) * scale)), rdt = Math.max(0, Math.min(.1, Number.isFinite(realDt) ? realDt : 0));
    for (const b of balls) if (b.on) updateBall(b, dt, rdt, now);
    updateChunks(dt); updateSmoke(dt); updateTrees(dt); updateFlashes(rdt); updatePreview(now);
    dust.points.material.uniforms.uScale.value = fire.points.material.uniforms.uScale.value = (globalThis.innerHeight || 800) * pixelRatio() / (2 * Math.tan(camera.fov * Math.PI / 360));
    dust.update(dt); fire.update(dt); trail.update(now);
    for (const d of decals) if (d.visible) { const age = now - d.userData.born; d.material.opacity = age < 14 ? 1 : Math.max(0, 1 - (age - 14) / 6); if (d.material.opacity <= 0) d.visible = false; }
    for (const d of scorches) if (d.visible) { const age = now - d.userData.born; d.material.opacity = age < 20 ? .9 : Math.max(0, .9 - (age - 20) / 8); if (d.material.opacity <= 0) d.visible = false; }
    for (const g of rings) if (g.visible) { const t = (now - g.userData.born) / .7; if (t >= 1) { g.visible = false; continue; } g.userData.place(g.userData.x, g.userData.z, g.userData.size * (.25 + .75 * Math.sqrt(t)), 0, .3); g.material.opacity = (1 - t) * .9; }
    lastFrame = now;
  }
  function clear() {
    for (const b of balls) if (b.on) park(b);
    for (const c of chunks) c.on = false; chunkMesh.count = 0; for (const e of smokeEv) e.on = false;
    dust.clear(); fire.clear(); trail.clear(); for (const d of [...decals, ...scorches, ...rings]) { d.visible = false; d.userData.born = -1e9; }
    cam.cancel(); hidePreview(); standTrees(); for (const m of flashes) m.visible = false; freezeUntil = slowUntil = -1; rollAgg.count = 0; rollAgg.weight = 0; rollAgg.affected.length = 0; rollAgg.cleared.length = 0;
  }
  return {
    launch, update, clear, timeScale, preview, hidePreview, get previewing() { return prev.visible; },
    // follow camera: call before the view poses the camera each frame; cancel() hands the view back as it is
    steer(dt) { return cam.update(dt); }, cancelFollow() { cam.cancel(); }, get following() { return cam.active; },
    get count() { return live(); },
    get animating() { return live() > 0 || dust.count > 0 || fire.count > 0 || chunkMesh.count > 0 || falling.length > 0 || rings.some(r => r.visible) || flashes.some(m => m.visible) || lastFrame < freezeUntil; },
    get stats() {
      return { launched, exploded, live: live(), last: lastSummary, throws: history.map(summary),
        balls: balls.filter(b => b.on).map(b => ({ id: b.rec.id, p: [+b.px.toFixed(1), +b.py.toFixed(1), +b.pz.toFixed(1)], speed: +Math.hypot(b.vx, b.vy, b.vz).toFixed(1), grounded: b.grounded, hidden: b.hidden, xray: +b.xmat.uniforms.uOpacity.value.toFixed(2), onTop: b.glow.visible, age: +b.age.toFixed(2), fuse: b.fuseLeft >= 0 ? +b.fuseLeft.toFixed(2) : null, end: b.rec.end, inside: b.inside })),
        follow: cam.stats, particles: { dust: dust.count, fire: fire.count, chunks: chunkMesh.count }, voices: audio.voices, trees: { total: trees.length, down: trees.reduce((n, t) => n + (t.down ? 1 : 0), 0), nearestPass: Number.isFinite(nearestTree) ? +nearestTree.toFixed(1) : null },
        preview: prev.visible && prev.aim ? { drop: [+prev.aim.sx.toFixed(1), +prev.aim.sz.toFixed(1)], spot: [+prev.tx.toFixed(1), +prev.tz.toFixed(1)], points: prev.aim.points, predicted: +prev.aim.at.toFixed(2), miss: +prev.aim.dmin.toFixed(1) } : null,
        playBox: [playBox.min.toArray(), playBox.max.toArray()].map(a => a.map(v => +v.toFixed(0))) };
    },
    dispose() { clear(); scene.remove(guide.mesh, ghost, ghostRim, spotRing, dropRing); for (const b of balls) { scene.remove(b.mesh, b.spark, b.sparkX, b.glow, b.shadow); } for (const m of [...decals, ...scorches, ...rings]) scene.remove(m); scene.remove(trail.mesh, dust.points, fire.points, chunkMesh); for (const o of owned) o.dispose?.(); },
  };
}
