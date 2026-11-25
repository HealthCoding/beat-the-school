// Ruyi staff 여의봉 (free weapon, user request 2026-10-26 "무기로 여의봉도 넣자. 위에서 아래로 내려찍고 막 길어지게").
// Tap a building (or the ground): a short golden staff with red-and-gold banded ends glints in high above the spot, then
// stretches in a blink - the bottom end shoots down (accelerating) through the roofs and floors to the ground while the top
// end climbs into the sky, so it visibly grows rather than falls. As the tip passes, campus.hit punches a column through
// the building from the top down; at the ground one wider slam, a camera kick (host), a dust ring, chunks and gold sparks.
// It rests a moment, ringing, then shrinks back up and is gone. Two staffs may be out at once.
// Protected buildings (hospitals, religious / hanok heritage): the tip stops on the roof, the shield flashes, it bounces
// back; nothing is damaged. Numbers: WEAPON_TUNING.ruyi. Damage only through campus.hit. Meshes and effect pools are made
// once at creation; update() allocates nothing (WebAudio nodes aside).
import { WEAPON_TUNING } from './weapon-tuning.js?v=sn130';
import { dataTexture } from './wrecking-ball-models.js?v=wreck46';
import { insideRing } from './protected-buildings.js?v=skku42';
import { createRuyiAudio } from './ruyi-audio.js';

export const RUYI_ID = 'ruyi';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// ---------- timeline (pure; also run by 검증/ruyi-check.mjs) ----------
export function ruyiPhases(T = WEAPON_TUNING.ruyi, shield = false) {
  const appear = T.appear, impact = appear + T.extend, rise = impact + (shield ? T.hold * .4 : T.hold), end = rise + T.retract;
  return { appear, impact, rise, end };
}
// Staff ends at age t: s = { tip0, top0, tipEnd, len0, R } (world units, already scaled), out = { tip, top, width, phase }.
// Appear: a short staff drops in a little and swells. Extend: tip accelerates down (u^2.3), top climbs (decelerating).
// Hold: stuck (a shield stop bounces up instead). Retract: both ends rise, the tip faster, and it thins out at the end.
export function ruyiStaffAt(t, s, T = WEAPON_TUNING.ruyi, out = { tip: 0, top: 0, width: 0, phase: 'none' }, units = 1) {
  const P = ruyiPhases(T, !!s.shield), rise = T.topRise * units;
  if (t < 0 || t >= P.end) { out.phase = 'none'; out.width = 0; out.tip = s.tip0; out.top = s.top0; return out; }
  if (t < P.appear) {
    const k = t / P.appear; out.phase = 'appear';
    out.tip = s.tip0 + (1 - smooth(k)) * s.len0 * .35; out.top = out.tip + s.len0; out.width = k < .7 ? Math.max(.05, k / .7 * 1.15) : 1.15 - (k - .7) / .3 * .15; // swells a little past full, settles
  } else if (t < P.impact) {
    const u = (t - P.appear) / T.extend; out.phase = 'extend';
    out.tip = s.tip0 + (s.tipEnd - s.tip0) * Math.pow(u, 2.3); out.top = s.top0 + rise * (1 - (1 - u) * (1 - u)); out.width = 1;
  } else if (t < P.rise) {
    const k = (t - P.impact) / (P.rise - P.impact); out.phase = 'hold'; out.top = s.top0 + rise; out.width = 1;
    out.tip = s.shield ? s.tipEnd + s.R * 2.2 * Math.sin(k * Math.PI * .5) : s.tipEnd;
  } else {
    const u = (t - P.rise) / T.retract, e = u * u, top = s.top0 + rise, from = s.shield ? s.tipEnd + s.R * 2.2 : s.tipEnd;
    out.phase = 'retract'; out.top = top + rise * .5 * e; out.tip = from + (out.top - s.len0 * .6 - from) * e; out.width = 1 - smooth((u - .72) / .28);
  }
  return out;
}

export function createRuyiStaff(THREE, scene, camera, {
  campus, protectedSet = null, tuning = WEAPON_TUNING.ruyi, reducedMotion = false, mobile = false,
  output = () => null, heavyAudio = null, pixelRatio = () => 1,
  onDamage = () => {}, onImpact = () => {}, onShield = () => {}, onKick = () => {},
} = {}) {
  const T = tuning, V3 = THREE.Vector3, units = (campus.worldUnitsPerMeter || .5) / .5;
  const R = T.radius * units, HR = R * T.bite, heightAt = (x, z) => campus.terrain.heightAt(x, z);
  const audio = createRuyiAudio({ output, heavy: heavyAudio, lite: mobile });
  const owned = [], own = o => (owned.push(o), o), rnd = (a, b) => a + Math.random() * (b - a);
  const entries = campus.entries, sites = protectedSet?.sites || [];
  const tA = new V3(), tQ = new THREE.Quaternion(), tM = new THREE.Matrix4(), tS = new V3(), tC = new V3(), hitPoint = new V3();
  const perFrame = mobile ? T.perFramePhone : T.perFrame;

  // ---------- textures (plain data; gold reads as metal without an environment map) ----------
  // Shaft: a fake reflection across the circumference (the staff turns to face the camera): a hot highlight just off centre,
  // darker silhouette edges, a warm bounce on the far side.
  const goldTex = dataTexture(THREE, 128, 4, u => {
    const g = (c, w) => Math.exp(-Math.pow(Math.min(Math.abs(u - c), 1 - Math.abs(u - c)) / w, 2));
    const k = .7 + .38 * g(.06, .05) + .2 * g(.94, .09) - .36 * g(.25, .07) - .36 * g(.75, .07), hot = g(.06, .03);
    return [clamp(Math.round(218 * k + 30 * hot), 0, 255), clamp(Math.round(172 * k + 50 * hot), 0, 255), clamp(Math.round(70 * k + 70 * hot), 0, 255)];
  }, own);
  const glow = dataTexture(THREE, 64, 64, (u, v) => { const r = Math.hypot(u * 2 - 1, v * 2 - 1), a = Math.max(0, 1 - r); return [255, 230, 160, Math.round(a * a * 255)]; }, own);
  // four-point star for the glint
  const star = dataTexture(THREE, 64, 64, (u, v) => { const x = Math.abs(u * 2 - 1), y = Math.abs(v * 2 - 1), r = Math.hypot(x, y), a = Math.max(0, 1 - r * 1.6) + Math.max(0, 1 - x * 14) * Math.max(0, 1 - y) + Math.max(0, 1 - y * 14) * Math.max(0, 1 - x); return [255, 244, 200, Math.round(clamp(a, 0, 1) * 255)]; }, own);
  const ringTex = dataTexture(THREE, 64, 64, (u, v) => { const r = Math.hypot(u * 2 - 1, v * 2 - 1), a = Math.max(0, 1 - Math.abs(r - .8) / .2); return [255, 246, 228, Math.round(a * a * 230 * (r < 1 ? 1 : 0))]; }, own);
  const hash = (x, y) => { let n = (x * 374761393 + y * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
  const crack = dataTexture(THREE, 96, 96, (u, v) => {
    const dx = u * 2 - 1, dy = v * 2 - 1, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx), spoke = Math.pow(Math.abs(Math.sin(a * 4.5 + hash(Math.round(r * 9), 5) * 2)), 16) * (r < .9 ? 1 : 0) * (1 - r);
    const dark = Math.max(0, .34 - r) * 2.6 + spoke * 1.1; return [36, 28, 20, Math.round(Math.min(1, dark) * 225)];
  }, own, false);
  for (const t of [glow, star, ringTex, crack]) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;

  // ---------- staff meshes (MeshStandardMaterial, metalness 0 like the rest of the game; emissive keeps the gold warm in shade) ----------
  const goldMat = own(new THREE.MeshStandardMaterial({ map: goldTex, roughness: .32, metalness: 0, emissive: '#5a3a08', emissiveIntensity: .22 }));
  const rimMat = own(new THREE.MeshStandardMaterial({ color: '#ffd24a', roughness: .3, metalness: 0, emissive: '#7a4a00', emissiveIntensity: .45 }));
  const redMat = own(new THREE.MeshStandardMaterial({ color: '#c0261d', roughness: .42, metalness: 0, emissive: '#420500', emissiveIntensity: .4 }));
  const cylinder = own(new THREE.CylinderGeometry(1, 1, 1, mobile ? 16 : 24, 1, false)); // height 1, centred
  const BAND = 2.6, RIM = .42; // band length and rim width, x R
  function staffEnd(dir) { // dir +1: the bottom end (band above the tip), -1: the top end
    const g = new THREE.Group();
    const band = new THREE.Mesh(cylinder, redMat); band.scale.set(1.1, BAND, 1.1); band.position.y = dir * BAND / 2; g.add(band);
    for (const y of [RIM / 2, BAND - RIM / 2]) { const rim = new THREE.Mesh(cylinder, rimMat); rim.scale.set(1.24, RIM, 1.24); rim.position.y = dir * y; g.add(rim); }
    return g;
  }
  const streakMat = own(new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  const streakGeo = own(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true));
  function makeStaff() {
    const root = new THREE.Group(); root.visible = false; root.frustumCulled = false;
    const shaft = new THREE.Mesh(cylinder, goldMat), bottom = staffEnd(1), top = staffEnd(-1);
    const streak = new THREE.Mesh(streakGeo, streakMat.clone()); owned.push(streak.material); streak.renderOrder = 5;
    const glint = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: star, color: '#fff3c4', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }))); glint.renderOrder = 6;
    const tipGlow = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: glow, color: '#ffd77a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }))); tipGlow.renderOrder = 6;
    for (const o of [shaft, bottom, top, streak, glint, tipGlow]) { root.add(o); o.frustumCulled = false; }
    root.traverse(o => { o.frustumCulled = false; }); scene.add(root);
    return { root, shaft, bottom, top, streak, glint, tipGlow, on: false, age: 0, x: 0, z: 0, cx: 0, cz: 0, groundY: 0, tip0: 0, top0: 0, tipEnd: 0, len0: 0, R,
      shield: null, colTop: 0, nextHitY: 0, impacted: false, struck: new Set(), id: 0, pieces: 0, weight: 0, hitYs: [], target: null, pos: { tip: 0, top: 0, width: 0, phase: 'none' }, crunchAt: -1, buildings: [] };
  }
  const staffs = [makeStaff(), makeStaff()];

  // ---------- effects: ground patches, particles, chunks, flash ----------
  function groundPatch(tex, segs, offset, color = '#ffffff') {
    const geo = own(new THREE.PlaneGeometry(1, 1, segs, segs)); geo.rotateX(-Math.PI / 2);
    const mat = own(new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset }));
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.visible = false;
    const base = Float32Array.from(geo.attributes.position.array); mesh.userData.born = -1e9;
    mesh.userData.place = (x, z, size, lift = .08) => {
      const a = geo.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) { const wx = x + base[i] * size, wz = z + base[i + 2] * size; a[i] = wx; a[i + 1] = heightAt(wx, wz) + lift; a[i + 2] = wz; }
      geo.attributes.position.needsUpdate = true;
    };
    scene.add(mesh); return mesh;
  }
  const rings = [groundPatch(ringTex, 12, -5, '#e9dcc4'), groundPatch(ringTex, 12, -5, '#e9dcc4')];
  const cracks = [groundPatch(crack, 8, -3), groundPatch(crack, 8, -3), groundPatch(crack, 8, -3)];
  const oldest = list => { let o = list[0]; for (const m of list) if (m.userData.born < o.userData.born) o = m; return o; };

  const ATTRS = ['position', 'size', 'alpha', 'tint'];
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
      geo.setDrawRange(0, n); drawn = n; for (const k of ATTRS) geo.attributes[k].needsUpdate = true;
    }
    return { points: pts, spawn, update, clear() { n = 0; geo.setDrawRange(0, 0); drawn = 0; }, get count() { return n; } };
  }
  const dust = createPoints(mobile ? T.dustPhone : T.dust, false), sparks = createPoints(mobile ? 28 : 48, true);

  const CH = mobile ? T.chunksPhone : T.chunks, unitBox = own(new THREE.BoxGeometry(1, 1, 1));
  const chunkMesh = new THREE.InstancedMesh(unitBox, own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .92, metalness: 0 })), CH);
  chunkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); chunkMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CH * 3), 3); chunkMesh.frustumCulled = false; chunkMesh.count = 0; scene.add(chunkMesh);
  const chunkColors = ['#a59d8e', '#8c8478', '#b9ab95', '#6f6a62', '#c4b8a4', '#7b6a58'].map(c => new THREE.Color(c));
  const chunks = Array.from({ length: CH }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 2, s: 1, ax: 0, ay: 1, az: 0, spin: 0, ang: 0, bounced: 0, color: 0 }));
  let chunkNext = 0;
  function addChunk(x, y, z, vx, vy, vz, s) {
    const c = chunks[chunkNext++ % CH];
    c.on = true; c.x = x; c.y = y; c.z = z; c.vx = vx; c.vy = vy; c.vz = vz; c.age = 0; c.life = rnd(1.4, 2.3); c.s = s; c.spin = rnd(4, 12); c.ang = rnd(0, 6.28); c.bounced = 0; c.color = (Math.random() * chunkColors.length) | 0;
    c.ax = rnd(-1, 1); c.ay = rnd(-1, 1); c.az = rnd(-1, 1); const l = Math.hypot(c.ax, c.ay, c.az) || 1; c.ax /= l; c.ay /= l; c.az /= l;
  }
  function updateChunks(dt) {
    let n = 0;
    for (const c of chunks) {
      if (!c.on) continue;
      if (dt > 0) {
        c.age += dt; if (c.age >= c.life) { c.on = false; continue; }
        c.vy -= 26 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.ang += c.spin * dt;
        const gy = heightAt(c.x, c.z) + c.s * .4;
        if (c.y < gy) { c.y = gy; if (c.bounced++ < 2 && c.vy < -3) { c.vy *= -.3; c.vx *= .55; c.vz *= .55; c.spin *= .5; } else { c.vx *= .8; c.vz *= .8; c.vy = 0; c.spin *= .8; } }
      }
      const fade = Math.min(1, (c.life - c.age) / .4);
      tQ.setFromAxisAngle(tC.set(c.ax, c.ay, c.az), c.ang);
      chunkMesh.setColorAt(n, chunkColors[c.color]); chunkMesh.setMatrixAt(n++, tM.compose(tA.set(c.x, c.y, c.z), tQ, tS.set(c.s * fade, c.s * .8 * fade, c.s * .9 * fade)));
    }
    chunkMesh.count = n; if (n) { chunkMesh.instanceMatrix.needsUpdate = true; chunkMesh.instanceColor.needsUpdate = true; }
  }
  const flashes = Array.from({ length: 2 }, () => { const m = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: glow, color: '#fff0c8', transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }))); m.visible = false; m.renderOrder = 7; m.userData = { age: 0, life: .3, s0: 1, s1: 2, peak: 1 }; scene.add(m); return m; });
  let flashNext = 0;
  function flash(x, y, z, s0, s1, life, peak) { const m = flashes[flashNext++ % flashes.length]; m.position.set(x, y, z); const u = m.userData; u.age = 0; u.life = life; u.s0 = s0; u.s1 = s1; u.peak = peak; m.visible = true; }
  function updateFlashes(dt) { for (const m of flashes) { if (!m.visible) continue; const u = m.userData; u.age += dt; const k = u.age / u.life; if (k >= 1) { m.visible = false; continue; } m.scale.setScalar(u.s0 + (u.s1 - u.s0) * Math.sqrt(k)); m.material.opacity = u.peak * (1 - k) * (1 - k); } }

  // ---------- targeting ----------
  // Protected site the column would touch (outline + the staff's own thickness), or null.
  function blockedSite(x, z, given) {
    if (given) return given;
    for (const s of sites) {
      if (x < s.box.min.x - R * 1.3 || x > s.box.max.x + R * 1.3 || z < s.box.min.z - R * 1.3 || z > s.box.max.z + R * 1.3) continue;
      if (insideRing(x, z, s.ring)) return s;
      const p = s.ring; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], q = p[j], ex = q.x - a.x, ez = q.z - a.z, l2 = ex * ex + ez * ez || 1, t = clamp(((x - a.x) * ex + (z - a.z) * ez) / l2, 0, 1); if (Math.hypot(x - a.x - ex * t, z - a.z - ez * t) < R * 1.3) return s; }
    }
    return null;
  }
  // Highest roof under the column (buildings whose box the hit circle overlaps).
  function columnTop(x, z, groundY) {
    let top = groundY;
    for (const e of entries) { if (e.cleared) continue; const b = e.worldBounds; if (x < b.min.x - HR || x > b.max.x + HR || z < b.min.z - HR || z > b.max.z + HR) continue; top = Math.max(top, b.max.y); }
    return top;
  }

  let strikes = 0, impacts = 0, shieldHits = 0, columnHits = 0, busyRejects = 0, serial = 0; const history = [];
  function strike({ point, normal = null, entry = null, site = null } = {}) {
    if (!point || ![point.x, point.y, point.z].every(Number.isFinite)) return false;
    const s = staffs.find(k => !k.on) || staffs.find(k => k.on && (k.pos.phase === 'retract')) || null;
    if (!s) { busyRejects++; return 'busy'; }
    // a wall tap bites in from the wall: the column centre sits a little inside the building
    let cx = point.x, cz = point.z;
    if (entry && normal && Math.abs(normal.y) < .6) { const l = Math.hypot(normal.x, normal.z) || 1; cx -= normal.x / l * HR * .55; cz -= normal.z / l * HR * .55; }
    const groundY = heightAt(cx, cz); if (!Number.isFinite(groundY)) return false;
    const blocked = blockedSite(cx, cz, site);
    const colTop = blocked ? Math.max(groundY, blocked.topY) : columnTop(cx, cz, groundY);
    s.on = true; s.age = 0; s.id = ++serial; s.x = point.x; s.z = point.z; s.cx = cx; s.cz = cz; s.groundY = groundY; s.shield = blocked; s.colTop = colTop;
    s.len0 = T.startLen * units; s.tip0 = colTop + T.above * units;
    // keep the short staff in the frame when it appears (a close camera sees little sky): lower it until its middle is on screen
    // (10-26 r2: the first rule stopped 10 units over the roof, still above a close frame; now a search down to R x 3, and
    // the short staff itself gets shorter when even that leaves its top end out of the frame)
    const ndcY = y => { tA.set(cx, y, cz).project(camera); return tA.z > 1 || !Number.isFinite(tA.y) ? -1 : tA.y; };
    if (ndcY(s.tip0 + s.len0 * .5) > .7) {
      let lo = colTop + R * 3, hi = s.tip0;
      for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (ndcY(mid + s.len0 * .5) > .7) hi = mid; else lo = mid; }
      s.tip0 = lo;
      if (ndcY(s.tip0 + s.len0) > .95) { let a = R * 5, b = s.len0; for (let i = 0; i < 10; i++) { const m = (a + b) / 2; if (ndcY(s.tip0 + m) > .95) b = m; else a = m; } s.len0 = a; }
    }
    s.top0 = s.tip0 + s.len0;
    s.tipEnd = blocked ? blocked.topY + R * .3 : groundY - T.sink * units;
    s.nextHitY = colTop - HR * .35; s.impacted = false; s.struck.clear(); s.pieces = 0; s.weight = 0; s.hitYs.length = 0; s.buildings.length = 0; s.crunchAt = -1;
    s.target = entry?.id || null; s.root.visible = true; strikes++;
    audio.play('glint');
    return true;
  }

  // ---------- damage ----------
  const agg = { count: 0, weight: 0, affected: [], cleared: [] }, aggPoint = new V3(), aggNormal = new V3(0, 1, 0);
  let aggFeedback = false;
  function collect(s, res) {
    agg.count += res.count; agg.weight += res.weight; s.pieces += res.count; s.weight += res.weight;
    for (const e of res.affected) { if (!agg.affected.includes(e)) agg.affected.push(e); if (!s.buildings.includes(e.id)) s.buildings.push(e.id); }
    for (const e of res.cleared) if (!agg.cleared.includes(e)) agg.cleared.push(e);
  }
  function columnHit(s, y) {
    hitPoint.set(s.cx, y, s.cz);
    const res = campus.hit(hitPoint, HR, T.force); columnHits++; s.hitYs.push(+y.toFixed(2));
    if (!res.count) return;
    collect(s, res); aggPoint.copy(hitPoint); aggNormal.set(0, 1, 0);
    // first bite into each building: a puff where the tip broke in, a crunch and a small kick
    let first = false; for (const e of res.affected) if (!s.struck.has(e.id)) { s.struck.add(e.id); first = true; }
    if (first) {
      aggFeedback = true; onKick('roof');
      for (let i = 0; i < (mobile ? 8 : 14); i++) { const a = rnd(0, 6.28), v = rnd(4, 10); dust.spawn(s.cx + Math.cos(a) * R, y + rnd(-.5, 1), s.cz + Math.sin(a) * R, Math.cos(a) * v, rnd(1, 5), Math.sin(a) * v, rnd(1.4, 2.4) * R, R * 1.2, rnd(1, 1.8), .7, .78, .74, .68, 1.8, .5); }
      flash(s.cx, y, s.cz, R * 1.5, R * 6, .18, reducedMotion ? .3 : .6);
    }
    if (s.age - s.crunchAt > .07) { s.crunchAt = s.age; audio.play('crunch', Math.min(1.2, .4 + res.count / 40)); }
  }
  function slam(s, now) {
    impacts++;
    const gy = s.groundY;
    if (s.shield) {
      shieldHits++; const site = s.shield;
      const p = tA.set(s.cx, site.topY, s.cz); let n = tC.set(0, 1, 0);
      if (!insideRing(s.cx, s.cz, site.ring)) { const near = protectedSet?.nearestSurface?.(tS.set(s.cx, site.topY, s.cz), 40); if (near) { p.copy(near.point); n = tC.copy(near.normal); } }
      onShield(p.clone(), n.clone(), true, Math.max(12, R * 8)); audio.play('clang');
      for (let i = 0; i < (mobile ? 12 : 20); i++) sparks.spawn(p.x, p.y + .3, p.z, rnd(-12, 12), rnd(3, 12), rnd(-12, 12), rnd(.3, .6), -.3, rnd(.25, .5), 1, .7, .9, 1, 1.4, -18);
      flash(p.x, p.y, p.z, R * 2, R * 8, .22, reducedMotion ? .3 : .6);
      history.push({ id: s.id, shield: site.id, pieces: 0, hits: 0 }); if (history.length > 12) history.shift();
      return;
    }
    // the slam: one wider punch just above the ground (outward), then the look
    hitPoint.set(s.cx, gy + R * 2.2, s.cz);
    const res = campus.hit(hitPoint, R * T.slamRadius, T.slamForce);
    if (res.count) { collect(s, res); aggPoint.copy(hitPoint); aggNormal.set(0, 1, 0); aggFeedback = true; }
    audio.play('slam', 1); onImpact({ point: hitPoint.clone(), cleared: agg.cleared.length, pieces: s.pieces });
    const ring = oldest(rings); ring.userData.born = now; ring.userData.x = s.cx; ring.userData.z = s.cz; ring.visible = true; ring.userData.place(s.cx, s.cz, R * 3, .12);
    const ck = oldest(cracks); ck.userData.place(s.cx, s.cz, R * 7, .07); ck.userData.born = now; ck.material.opacity = 1; ck.visible = true;
    const k = reducedMotion ? .6 : 1;
    for (let i = 0, m = Math.round((mobile ? 30 : 56) * k); i < m; i++) { const a = i / m * 6.283 + rnd(-.1, .1), v = rnd(10, 22); dust.spawn(s.cx + Math.cos(a) * R * 1.2, gy + rnd(.2, 1.4), s.cz + Math.sin(a) * R * 1.2, Math.cos(a) * v, rnd(.5, 3), Math.sin(a) * v, rnd(1.6, 2.8) * R, R * 2.2, rnd(1.3, 2.3), .78, .8, .75, .68, 2.2, .45); }
    for (let i = 0, m = mobile ? 8 : 14; i < m; i++) dust.spawn(s.cx + rnd(-R, R), gy + rnd(1, 4), s.cz + rnd(-R, R), rnd(-3, 3), rnd(6, 14), rnd(-3, 3), rnd(2, 3.2) * R, R * 2, rnd(1.4, 2.2), .6, .74, .7, .64, 1.6, .2);
    for (let i = 0, m = mobile ? 14 : 26; i < m; i++) { const a = rnd(0, 6.28), v = rnd(8, 22); sparks.spawn(s.cx, gy + .6, s.cz, Math.cos(a) * v, rnd(4, 16), Math.sin(a) * v, rnd(.3, .55), -.25, rnd(.3, .6), 1, 1, .8, .35, 1.3, -20); }
    for (let i = 0; i < CH * .6; i++) { const a = rnd(0, 6.28), v = rnd(7, 16); addChunk(s.cx + Math.cos(a) * R * 1.5, gy + rnd(.5, 2), s.cz + Math.sin(a) * R * 1.5, Math.cos(a) * v, rnd(6, 15), Math.sin(a) * v, rnd(.5, 1.3) * units); }
    flash(s.cx, gy + R, s.cz, R * 2, R * 12, .3, reducedMotion ? .4 : .85);
    history.push({ id: s.id, target: s.target, buildings: s.buildings.slice(), pieces: s.pieces, pct: +(s.weight / campus.totalWeight * 100).toFixed(3), hits: s.hitYs.length, hitYs: s.hitYs.slice(), colTop: +s.colTop.toFixed(2), ground: +gy.toFixed(2) });
    if (history.length > 12) history.shift();
  }
  function flush() {
    if (!agg.count) return;
    const res = { count: agg.count, weight: agg.weight, affected: agg.affected.slice(), cleared: agg.cleared.slice() };
    agg.count = 0; agg.weight = 0; agg.affected.length = 0; agg.cleared.length = 0;
    onDamage(res, { kind: 'ruyi', point: aggPoint, normal: aggNormal, radius: HR, force: T.force, feedback: aggFeedback }); aggFeedback = false;
  }

  // ---------- per frame ----------
  const camPos = new V3();
  function draw(s) {
    const p = s.pos, w = p.width; if (w <= 0) { s.root.visible = false; return; }
    s.root.visible = true; camera.getWorldPosition(camPos);
    const yaw = Math.atan2(camPos.x - s.cx, camPos.z - s.cz), jitter = p.phase === 'hold' && !s.shield && !reducedMotion ? Math.sin(s.age * 90) * R * .12 * Math.max(0, 1 - (s.age - ruyiPhases(T).impact) / T.hold) : 0;
    s.root.position.set(s.cx + jitter * Math.cos(yaw), 0, s.cz - jitter * Math.sin(yaw));
    const r = R * w, band = BAND * r, shaftLen = Math.max(.01, p.top - p.tip - band * 2);
    s.shaft.scale.set(r, shaftLen, r); s.shaft.position.y = p.tip + band + shaftLen / 2; s.shaft.rotation.y = yaw;
    s.bottom.scale.setScalar(r); s.bottom.position.y = p.tip; s.top.scale.setScalar(r); s.top.position.y = p.top;
    // stretching: an additive sheath over the lower part fades as it lands; a glow rides the tip
    const P = ruyiPhases(T, !!s.shield);
    const u = p.phase === 'extend' ? (s.age - P.appear) / T.extend : p.phase === 'retract' ? (s.age - P.rise) / T.retract : 0;
    const sheath = p.phase === 'extend' ? .28 * (1 - u * .4) : p.phase === 'retract' ? .25 * (1 - u) : 0;
    s.streak.visible = sheath > .01; if (s.streak.visible) { const len = Math.min(shaftLen, (p.top - p.tip) * .45 + R * 8); s.streak.scale.set(r * 1.7, len, r * 1.7); s.streak.position.y = p.tip + len / 2; s.streak.material.opacity = reducedMotion ? sheath * .5 : sheath; }
    const appearK = p.phase === 'appear' ? (s.age / P.appear) : 0;
    s.glint.visible = p.phase === 'appear' || p.phase === 'extend' && u < .25;
    if (s.glint.visible) { const g = p.phase === 'appear' ? Math.sin(appearK * Math.PI * .5 + .3) : 1 - u * 4; s.glint.position.set(0, p.tip + R * .5, 0); s.glint.scale.setScalar(R * (6 + 10 * g)); s.glint.material.opacity = Math.max(0, g); s.glint.material.rotation = s.age * 3; }
    s.tipGlow.visible = p.phase === 'extend'; if (s.tipGlow.visible) { s.tipGlow.position.set(0, p.tip, 0); s.tipGlow.scale.setScalar(R * (4 + 3 * u)); s.tipGlow.material.opacity = .55 + .35 * u; }
  }
  function step(s, dt, now) {
    s.age += dt; const P = ruyiPhases(T, !!s.shield);
    ruyiStaffAt(s.age, s, T, s.pos, units);
    const prevPhase = s.lastPhase; s.lastPhase = s.pos.phase;
    if (s.pos.phase === 'extend' && prevPhase !== 'extend') audio.play('stretch', T.extend + .02);
    if (s.pos.phase === 'retract' && prevPhase !== 'retract') { audio.play('retract', T.retract); if (!s.shield) for (let i = 0; i < (mobile ? 6 : 10); i++) dust.spawn(s.cx + rnd(-R, R), s.groundY + rnd(.3, 2), s.cz + rnd(-R, R), rnd(-2, 2), rnd(4, 9), rnd(-2, 2), rnd(1.4, 2.2) * R, R, rnd(.8, 1.4), .5, .78, .74, .68, 1.6, .3); }
    // column hits top -> bottom as the tip passes (capped per frame; the rest follow on the next frames)
    if (!s.shield && (s.pos.phase === 'extend' || s.pos.phase === 'hold' || s.age >= P.impact)) {
      const floor = s.groundY + R * .6, reach = s.age >= P.impact ? -Infinity : s.pos.tip; let n = 0;
      while (s.nextHitY > floor && s.nextHitY >= reach && n < (s.age >= P.impact && !s.impacted ? perFrame * 2 : perFrame)) { columnHit(s, s.nextHitY); s.nextHitY -= HR * T.step; n++; }
    }
    if (!s.impacted && s.age >= P.impact) { s.impacted = true; slam(s, now); }
    if (s.pos.phase === 'none') { s.on = false; s.root.visible = false; s.lastPhase = 'none'; return; }
    draw(s);
  }
  function update(simDt, realDt, now = performance.now() / 1000) {
    const dt = Math.max(0, Math.min(.05, Number.isFinite(simDt) ? simDt : 0)), rdt = Math.max(0, Math.min(.1, Number.isFinite(realDt) ? realDt : 0));
    for (const s of staffs) if (s.on) step(s, dt, now);
    flush();
    updateChunks(dt); updateFlashes(rdt);
    dust.points.material.uniforms.uScale.value = sparks.points.material.uniforms.uScale.value = (globalThis.innerHeight || 800) * pixelRatio() / (2 * Math.tan(camera.fov * Math.PI / 360));
    dust.update(dt); sparks.update(dt);
    for (const g of rings) if (g.visible) { const t = (now - g.userData.born) / .8; if (t >= 1 || t < 0) { g.visible = false; continue; } g.userData.place(g.userData.x, g.userData.z, R * (3 + 26 * Math.sqrt(t)), .12); g.material.opacity = (1 - t) * .9; }
    for (const d of cracks) if (d.visible) { const age = now - d.userData.born; d.material.opacity = age < 8 ? 1 : Math.max(0, 1 - (age - 8) / 4); if (d.material.opacity <= 0) d.visible = false; }
  }
  function clear() {
    for (const s of staffs) { s.on = false; s.root.visible = false; s.lastPhase = 'none'; s.pos.phase = 'none'; }
    for (const c of chunks) c.on = false; chunkMesh.count = 0; dust.clear(); sparks.clear();
    for (const d of [...rings, ...cracks]) { d.visible = false; d.userData.born = -1e9; } for (const m of flashes) m.visible = false;
    agg.count = 0; agg.weight = 0; agg.affected.length = 0; agg.cleared.length = 0; aggFeedback = false;
  }
  return {
    strike, update, clear,
    get live() { return staffs.filter(s => s.on).length; },
    get busy() { return staffs.every(s => s.on && s.pos.phase !== 'retract'); },
    get animating() { return staffs.some(s => s.on) || dust.count > 0 || sparks.count > 0 || chunkMesh.count > 0 || flashes.some(m => m.visible) || rings.some(r => r.visible); },
    get stats() {
      return { strikes, impacts, shieldHits, columnHits, busyRejects, live: staffs.filter(s => s.on).length, radius: R, hitRadius: HR,
        staffs: staffs.filter(s => s.on).map(s => ({ id: s.id, phase: s.pos.phase, age: +s.age.toFixed(3), tip: +s.pos.tip.toFixed(2), top: +s.pos.top.toFixed(2), length: +(s.pos.top - s.pos.tip).toFixed(2), width: +s.pos.width.toFixed(3), x: +s.cx.toFixed(2), z: +s.cz.toFixed(2), ground: +s.groundY.toFixed(2), shield: s.shield?.id ?? null })),
        particles: { dust: dust.count, sparks: sparks.count, chunks: chunkMesh.count }, voices: audio.voices, last: history.at(-1) || null, history: history.slice(), phases: ruyiPhases(T) };
    },
    dispose() { clear(); for (const s of staffs) scene.remove(s.root); for (const o of [...rings, ...cracks, dust.points, sparks.points, chunkMesh, ...flashes]) scene.remove(o); for (const o of owned) o.dispose?.(); },
  };
}
