// Hospital shield (round 2, user request 2026-10-18: "an energy barrier in the spirit of a sci-fi city dome", original look).
// Each protected site gets an invisible rounded-box shell hugging its footprint (oriented box of the outline) and a rounder
// dome for the nuke. A hit materialises the barrier from the impact point: big hexagonal panels switch on in a ripple,
// bright panel edges, an impact flare with concentric rings, a sweeping front, scanline shimmer and a fresnel rim; then the
// panels go off in reverse (outer first). Small rapid hits (minigun) only flash the panels around the hit. The nuke dome
// rises from the ground in a wave and dents / glows where the shock front passes.
// One ShaderMaterial for every shell (premultiplied blending: a blue-violet tint darkens bright ground / sky, the glow adds on
// dark), hits live in fixed uniform arrays, nothing is allocated per frame. ?shield=v1 keeps the round-1 look.
// API (unchanged for callers): flash / holdAt / release / dome / update / clear / animating / stats / dispose.
// Options: sites (protected sites; without them a hit shows on a small panel patch), output (WebAudio {context,
// destination} getter for the low energy hum under the "팅"), reducedMotion (shorter, no strong flashes).

export function createShieldEffects(THREE, scene, camera, options = {}) {
  let v1 = false;
  try { v1 = new URLSearchParams(globalThis.location?.search ?? '').get('shield') === 'v1'; } catch {}
  return v1 ? createShieldEffectsV1(THREE, scene, camera, options) : createEnergyShield(THREE, scene, camera, options);
}

const SLOTS = 16;             // hits drawn at once (uniform arrays)
const KIND_LOCAL = 0, KIND_SWEEP = 1, KIND_DOME = 2;
const DOME_SITE = 100;        // dome meshes carry site index + 100

function createEnergyShield(THREE, scene, camera, { reducedMotion = false, sites = [], output = null } = {}) {
  const calm = reducedMotion ? 1 : 0;
  const SPEED = reducedMotion ? 80 : 52;      // sweep front, world units / s
  const group = new THREE.Group(); group.name = 'hospital-shield-effects'; scene.add(group);
  const owned = [];
  const uA = [], uB = [], uC = [], uD = [];
  for (let i = 0; i < SLOTS; i++) { uA.push(new THREE.Vector4(0, 0, 0, -1)); uB.push(new THREE.Vector4(-999, 1, 1, 0)); uC.push(new THREE.Vector4()); uD.push(new THREE.Vector4()); }
  const material = new THREE.ShaderMaterial({
    uniforms: { uA: { value: uA }, uB: { value: uB }, uC: { value: uC }, uD: { value: uD }, uTime: { value: 0 }, uCalm: { value: calm }, uWarm: { value: 0 }, uSpeed: { value: SPEED } },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  owned.push(material);

  // ---- shells (one rounded box + one dome per site), built once
  const entries = [];
  const entryOf = new Map();
  function addSite(site) {
    if (entryOf.has(site)) return entryOf.get(site);
    const index = entries.length, obb = orientedBox(site);
    const height = Math.max(4, site.topY - site.baseY), ext = Math.max(obb.hu, obb.hv, height);
    const m = Math.min(4, Math.max(1.6, ext * .05));
    const shellPanel = Math.min(9, Math.max(3.5, ext / 5.5));
    const shell = makeShell(THREE, { a: obb.hu + m, b: obb.hv + m, h: height + m * 1.2, e: .3, panel: shellPanel, site: index });
    const domeA = obb.hu * 1.3 + 6, domeB = obb.hv * 1.3 + 6;
    const dome = makeShell(THREE, { a: domeA, b: domeB, h: Math.max(height * 1.3 + 6, Math.max(domeA, domeB) * .72), e: .62, panel: shellPanel * 1.25, site: index + DOME_SITE });
    owned.push(shell, dome);
    const meshes = [shell, dome].map((g, k) => {
      const mesh = new THREE.Mesh(g, material); mesh.name = k ? 'shield-dome' : 'shield-shell';
      mesh.position.set(obb.cx, site.baseY - .6, obb.cz); mesh.rotation.y = -obb.angle; mesh.renderOrder = 4; mesh.visible = false;
      group.add(mesh); mesh.updateMatrixWorld(true); return mesh;
    });
    const bounds = new THREE.Box3().setFromObject(meshes[0]);
    const e = { site, index, shell: meshes[0], dome: meshes[1], bounds, ext, domeR: Math.hypot(domeA, domeB), panel: shellPanel, cx: obb.cx, cz: obb.cz };
    entries.push(e); entryOf.set(site, e); return e;
  }
  for (const site of sites || []) if (site?.ring?.length >= 3) addSite(site);
  // A hit away from every site (unit tests, unknown targets): a small panel patch facing the hit normal.
  const patchGeo = makePatch(THREE, 6.5, 1.9); owned.push(patchGeo);
  const patch = new THREE.Mesh(patchGeo, material); patch.name = 'shield-patch'; patch.visible = false; patch.renderOrder = 4; group.add(patch);

  // ---- hits
  const hits = Array.from({ length: SLOTS }, (_, slot) => ({ slot, active: false, kind: 0, entry: null, target: -999, point: new THREE.Vector3(),
    reach: 1, life: 1, strength: 1, age: 0, delay: 0, hold: false, holdAge: 0, size: 1, origin: null, ox: 0, oz: 0, dC: 0, speed: 1, rise: .5, riseStart: 0 }));
  let clock = 0, warm = 2, lastSweepAt = -1, lastHumAt = -1, nextSlot = 0;
  const ray = new THREE.Raycaster(), rayHits = [], tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), cam = new THREE.Vector3();
  function freeSlot() {
    for (let k = 0; k < SLOTS; k++) { const h = hits[(nextSlot + k) % SLOTS]; if (!h.active) { nextSlot = (h.slot + 1) % SLOTS; return h; } }
    // all busy: replace the oldest non-dome, non-held hit
    let best = null; for (const h of hits) if (h.kind !== KIND_DOME && !h.hold && (!best || h.age > best.age)) best = h;
    return best || hits[nextSlot++ % SLOTS];
  }
  function siteNear(point) {
    let best = null, bd = 6;
    for (const e of entries) { const d = e.bounds.distanceToPoint(point); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  // Move the impact onto the shell: cast from the wall point outward along the normal.
  function ontoShell(e, point, normal, out) {
    out.copy(point);
    if (!normal) return out;
    ray.set(tmp.copy(point).addScaledVector(normal, -.5), tmp2.copy(normal).normalize()); ray.far = 40;
    rayHits.length = 0; e.shell.raycast(ray, rayHits);
    let best = null; for (const r of rayHits) if (!best || r.distance < best.distance) best = r;
    if (best) out.copy(best.point);
    return out;
  }
  // size: the caller's flash size (bat 14, tools 6–10, blasts 8+, minigun 3.6). life .9+ marks heavy hits (bazooka / blast).
  function flash(point, normal, size = 8, { life = .7, strong = false, delay = 0, hold = false } = {}) {
    if (!point) return null;
    const e = siteNear(point), h = freeSlot();
    h.active = true; h.entry = e; h.age = 0; h.delay = Math.max(0, delay); h.hold = hold; h.size = size; h.origin = null;
    if (e) ontoShell(e, point, normal, h.point); else { h.point.copy(point); placePatch(point, normal); }
    const panel = e ? e.panel : 1.9, heavy = life >= .9;
    let kind = size < 5 ? KIND_LOCAL : KIND_SWEEP;
    // a sweep that already runs on this site absorbs rapid follow-up hits as local flashes (and stays up a little longer)
    if (kind === KIND_SWEEP && e && !heavy) for (const o of hits) if (o !== h && o.active && o.kind === KIND_SWEEP && o.entry === e && o.age < .28) { kind = KIND_LOCAL; o.life = Math.min(o.life + .25, o.life0 + .8); break; }
    h.kind = kind; h.target = e ? e.index : -1;
    if (kind === KIND_LOCAL) {
      h.reach = panel * (strong ? 1.9 : 1.45); h.life = (reducedMotion ? .24 : .36) + (strong ? .12 : 0); h.strength = strong ? 1.2 : 1;
    } else {
      let reach = size * 1.8 * (strong ? 1.3 : 1) * (heavy ? 1.7 : 1);
      if (e) reach = Math.min(reach, e.ext * 2.4); else reach = Math.min(reach, 6.5);
      h.reach = Math.max(reach, panel * 2.2);
      const holdFor = .3 + (strong ? .2 : 0) + (heavy ? .45 : 0);
      h.life = (h.reach / SPEED + holdFor + .45) * (reducedMotion ? .7 : 1); h.strength = heavy ? 1.25 : strong ? 1.1 : .95;
      if (now() - lastHumAt > .12) { lastHumAt = now(); hum(heavy ? 1 : strong ? .75 : .5, h.delay); }
    }
    h.life0 = h.life; h.holdAge = Math.min(h.life * .5, h.reach / SPEED + .12);
    lastSweepAt = clock;
    return h;
  }
  function placePatch(point, normal) {
    patch.position.copy(point); if (normal) { patch.position.addScaledVector(normal, .4); patch.lookAt(tmp.copy(patch.position).add(normal)); }
    patch.updateMatrixWorld(true);
  }
  // A held flash (drill / flamethrower contact) stays lit and follows the contact point until released.
  function holdAt(h, point, normal) {
    if (!h?.active) return; h.hold = true;
    if (h.entry) ontoShell(h.entry, point, normal, h.point); else { h.point.copy(point); placePatch(point, normal); }
  }
  function release(h) { if (h) h.hold = false; }
  // Nuke: a dome over one protected site rises from the ground before the shock front arrives (delay = arrival time) and
  // holds while it passes. origin (the blast point, optional) aims the bright pressure band; without it the band rises.
  function dome(site, { delay = 0, life = 4.2, origin = null } = {}) {
    const e = addSite(site), h = freeSlot();
    h.active = true; h.kind = KIND_DOME; h.entry = e; h.target = e.index + DOME_SITE; h.age = 0; h.delay = 0; h.hold = false;
    // the dome is up just before the shock front reaches it (near sites rise faster)
    h.rise = Math.min(reducedMotion ? .35 : .6, Math.max(.22, delay - .06)); h.riseStart = Math.max(0, delay - h.rise - .06);
    h.arrive = delay; h.life = delay + life * (reducedMotion ? .7 : 1); h.life0 = h.life; h.strength = 1;
    h.point.set(e.cx, site.baseY, e.cz);
    if (origin) { h.origin = true; h.ox = origin.x; h.oz = origin.z; h.dC = Math.hypot(e.cx - origin.x, e.cz - origin.z); h.speed = delay - .12 > .05 ? h.dC / (delay - .12) : 220; }
    else { h.origin = null; h.speed = 0; }
    e.dome.visible = false;
    if (now() - lastHumAt > .4) { lastHumAt = now(); hum(1.4, Math.max(0, h.riseStart)); }
    return h;
  }
  const now = () => clock;

  function update(dt) {
    if (!(dt >= 0)) return; clock += dt;
    material.uniforms.uTime.value = reducedMotion ? 0 : clock;
    for (const e of entries) { e.shell.visible = false; e.dome.visible = false; }
    patch.visible = false;
    if (warm > 0) { warm--; material.uniforms.uWarm.value = 1; for (const e of entries) e.shell.visible = true; patch.visible = true; }
    else material.uniforms.uWarm.value = 0;
    for (const h of hits) {
      const A = uA[h.slot], B = uB[h.slot], C = uC[h.slot], D = uD[h.slot];
      if (h.active) {
        if (h.delay > 0) { h.delay -= dt; if (h.delay > 0) { A.w = -1; B.x = -999; continue; } }
        h.age += dt; if (h.hold && h.age > h.holdAge) h.age = h.holdAge;
        if (h.age >= h.life) h.active = false;
      }
      if (!h.active) { A.w = -1; B.x = -999; continue; }
      A.set(h.point.x, h.point.y, h.point.z, h.age); B.set(h.target, h.reach, h.life, h.strength);
      C.set(h.kind, h.kind === KIND_DOME ? Math.max(8, h.entry.domeR * .2) : h.hold ? 1 : 0, h.ox, h.oz);
      if (h.kind === KIND_DOME) {
        // pressure band: current shock radius around the blast point, and how strongly this dome is being pushed now
        const t = h.age, R = h.origin ? h.dC + (t - h.arrive) * h.speed : 0, span = h.entry.domeR;
        const push = h.origin ? smooth(-span * 1.2, -span * .4, R - h.dC) * Math.exp(-Math.max(0, R - h.dC + span * .4) / Math.max(30, h.speed * .9)) : smooth(h.arrive - .1, h.arrive + .1, t) * Math.exp(-Math.max(0, t - h.arrive) * 1.4);
        D.set(h.origin ? R : -1, (h.age - h.riseStart) / h.rise, push, h.entry.site.baseY);
        if (h.age >= h.riseStart) h.entry.dome.visible = true;
      } else {
        D.set(0, 0, 0, 0);
        if (h.entry) h.entry.shell.visible = true; else patch.visible = true;
      }
    }
  }
  function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function clear() { for (const h of hits) { h.active = false; h.hold = false; uA[h.slot].w = -1; uB[h.slot].x = -999; } for (const e of entries) e.shell.visible = e.dome.visible = false; patch.visible = false; }

  // ---- low energy hum under the "팅": detuned saw + sine through a low-pass, a fast tremolo (thrum), short decay.
  function hum(level = 1, delay = 0) {
    const out = typeof output === 'function' ? output() : null; if (!out?.context || !out.destination) return;
    try {
      const ctx = out.context, t = ctx.currentTime + delay, dur = .45 + .4 * Math.min(1.4, level), peak = .16 + .12 * Math.min(1.4, level);
      const g = ctx.createGain(), trem = ctx.createGain(), lp = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), depth = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(520, t); lp.frequency.exponentialRampToValueAtTime(160, t + dur); lp.Q.value = 3.2;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + .025); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      trem.gain.value = .7; lfo.frequency.setValueAtTime(17, t); lfo.frequency.linearRampToValueAtTime(9, t + dur); depth.gain.value = .3;
      lfo.connect(depth).connect(trem.gain);
      const oscs = [['sawtooth', 58, 52], ['sine', 87, 80], ['sine', 116, 104]].map(([type, f0, f1]) => {
        const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); o.connect(lp); return o;
      });
      lp.connect(trem).connect(g).connect(out.destination);
      for (const o of [...oscs, lfo]) { o.start(t); o.stop(t + dur + .05); }
      oscs[0].onended = () => { try { g.disconnect(); } catch {} };
    } catch {}
  }

  return {
    flash, holdAt, release, dome, update, clear,
    get animating() { for (const h of hits) if (h.active) return true; return false; },
    get stats() {
      let flashes = 0, domes = 0, domesShown = 0, sweeps = 0, maxAge = 0, domePush = 0;
      for (const h of hits) if (h.active) { if (h.kind === KIND_DOME) { domes++; domePush = Math.max(domePush, uD[h.slot].z); } else { flashes++; if (h.kind === KIND_SWEEP) sweeps++; maxAge = Math.max(maxAge, h.age); } }
      for (const e of entries) if (e.dome.visible) domesShown++;
      return { version: 2, flashes, sweeps, domes, domesShown, shells: entries.length, oldestFlashAge: +maxAge.toFixed(3), domePush: +domePush.toFixed(3) };
    },
    dispose() { clear(); group.removeFromParent(); for (const o of owned) o.dispose(); },
  };
}

// Monotone-chain hull (same as protected-buildings.js; kept local so this module has no versioned import).
function convexHull(points) {
  const P = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-9) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 1e-9) up.pop(); up.push(p); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
// Oriented box of a site's outline (minimum-area rectangle over the hull edges). angle: local X axis = (cos, sin) in XZ.
function orientedBox(site) {
  const hull = convexHull(site.ring.map(p => [p.x, p.z]));
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const [ax, az] = hull[i], [bx, bz] = hull[(i + 1) % hull.length], angle = Math.atan2(bz - az, bx - ax), c = Math.cos(angle), s = Math.sin(angle);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, z] of hull) { const u = x * c + z * s, v = -x * s + z * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) { const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2; best = { area, angle, hu: (u1 - u0) / 2, hv: (v1 - v0) / 2, cx: cu * c - cv * s, cz: cu * s + cv * c }; }
  }
  return best || { angle: 0, hu: 10, hv: 10, cx: site.centerX, cz: site.centerZ };
}

// Upper half of a superellipsoid (exponent e: .3 = rounded box, .6 = dome), local, open at the bottom, no seam.
function makeShell(THREE, { a, b, h, e, panel, site }) {
  const LON = 72, LAT = 22, pos = [], info = [], index = [];
  const pw = (v, k) => Math.sign(v) * Math.pow(Math.abs(v), k);
  for (let j = 0; j < LAT; j++) {
    const phi = j / LAT * Math.PI / 2, cp = pw(Math.cos(phi), e), y = h * pw(Math.sin(phi), e);
    for (let i = 0; i < LON; i++) {
      const lam = i / LON * Math.PI * 2;
      pos.push(a * cp * pw(Math.cos(lam), e), y, b * cp * pw(Math.sin(lam), e)); info.push(site, panel, 1 / h);
    }
  }
  pos.push(0, h, 0); info.push(site, panel, 1 / h);
  const top = LAT * LON;
  for (let j = 0; j < LAT - 1; j++) for (let i = 0; i < LON; i++) {
    const p = j * LON + i, q = j * LON + (i + 1) % LON, r = p + LON, s = q + LON; index.push(p, r, q, q, r, s);
  }
  for (let i = 0; i < LON; i++) index.push((LAT - 1) * LON + i, top, (LAT - 1) * LON + (i + 1) % LON);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 3)); g.setIndex(index);
  g.computeVertexNormals();
  // outward: flip if the first side vertex's normal points to the centre
  const n = g.getAttribute('normal'); if (n.getX(0) * pos[0] + n.getZ(0) * pos[2] < 0) { for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); }
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
function makePatch(THREE, radius, panel) {
  const g = new THREE.CircleGeometry(radius, 36), n = g.getAttribute('position').count, info = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) info.set([-1, panel, 1 / radius], i * 3);
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 3)); return g;
}

const COMMON = /* glsl */`
#define SLOTS ${SLOTS}
uniform vec4 uA[SLOTS]; // hit point on the shell (world), age (s; < 0 = unused)
uniform vec4 uB[SLOTS]; // target site (aInfo.x), reach (world), life (s), strength
uniform vec4 uC[SLOTS]; // kind (0 local, 1 sweep, 2 dome), held (dome: shock band width), blast origin x, z
uniform vec4 uD[SLOTS]; // dome: shock radius (-1 none), rise progress, push, base y
uniform float uTime, uCalm, uWarm, uSpeed;
`;
const VERT = COMMON + /* glsl */`
attribute vec3 aInfo;
varying vec3 vW, vN, vL, vLN, vBX, vBY, vBZ, vInfo;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * normal);
  // nuke dome: the shock band dents the side it reaches (vertices pushed away from the blast point)
  if (aInfo.x > 99.5 && uCalm < .5) {
    for (int i = 0; i < SLOTS; i++) {
      if (uC[i].x < 1.5 || abs(uB[i].x - aInfo.x) > .5 || uA[i].w < 0.0 || uD[i].x < 0.0) continue;
      vec2 d = w.xz - uC[i].zw; float r = length(d);
      float band = exp(-pow((r - uD[i].x) / uC[i].y, 2.0)) * uD[i].z;
      w.xz += d / max(r, 1e-3) * band * (1.5 + uC[i].y * .25) * (1.0 - smoothstep(.75, 1.0, position.y * aInfo.z));
    }
  }
  vW = w.xyz; vN = n; vL = position; vLN = normal; vInfo = aInfo;
  vBX = mat3(modelMatrix) * vec3(1.0, 0.0, 0.0); vBY = mat3(modelMatrix) * vec3(0.0, 1.0, 0.0); vBZ = mat3(modelMatrix) * vec3(0.0, 0.0, 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FRAG = COMMON + /* glsl */`
varying vec3 vW, vN, vL, vLN, vBX, vBY, vBZ, vInfo;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// pointy hex grid, cells 1 unit across the flats: xy = offset from the cell centre, zw = cell id
vec4 hexCell(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 hc = floor(vec4(p, p - vec2(.5, 1.0)) / s.xyxy) + .5;
  vec4 h = vec4(p - hc.xy * s, p - (hc.zw + .5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hc.xy) : vec4(h.zw, hc.zw + .5);
}
float hexDist(vec2 p) { p = abs(p); return max(dot(p, vec2(.5, .8660254)), p.x); }
void main() {
  float site = vInfo.x, panelSize = vInfo.y, invH = vInfo.z;
  // panels: hex grid projected along the shell's dominant local axis (box faces stay flat, rounded edges become facets)
  vec3 an = abs(vLN); vec2 uv; float axis;
  if (an.y > an.x && an.y > an.z) { uv = vL.xz; axis = 1.0; } else if (an.x > an.z) { uv = vL.zy; axis = 0.0; } else { uv = vL.xy; axis = 2.0; }
  if (site < -.5) { uv = vL.xy; axis = 2.0; }
  vec4 hx = hexCell(uv / panelSize);
  float e = hexDist(hx.xy) * 2.0;                       // 0 centre .. 1 edge
  float aa = fwidth(e) * 1.2 + .004;
  float edge = smoothstep(.9 - aa, .955, e), halo = smoothstep(.72, .9, e) * (1.0 - edge);
  vec2 off = -hx.xy * panelSize;                         // fragment -> cell centre, in the projection plane
  vec3 dLoc = axis > .5 && axis < 1.5 ? vec3(off.x, 0.0, off.y) : axis < .5 ? vec3(0.0, off.y, off.x) : vec3(off.x, off.y, 0.0);
  vec3 cellW = vW + vBX * dLoc.x + vBY * dLoc.y + vBZ * dLoc.z;
  float rnd = hash(hx.zw + vec2(axis * 17.0 + sign(axis > .5 && axis < 1.5 ? vLN.y : axis < .5 ? vLN.x : vLN.z) * 5.0, site));
  float hCell = clamp((vL.y + dLoc.y) * invH, 0.0, 1.0), hF = clamp(vL.y * invH, 0.0, 1.0);

  float lit = 0.0, pop = 0.0, flare = 0.0, rings = 0.0, front = 0.0, band = 0.0;
  for (int i = 0; i < SLOTS; i++) {
    float age = uA[i].w;
    if (age < 0.0 || abs(uB[i].x - site) > .5) continue;
    float reach = uB[i].y, life = uB[i].z, str = uB[i].w, kind = uC[i].x, held = uC[i].y;
    if (kind < 1.5) {
      vec3 p = uA[i].xyz; float dc = distance(cellW, p), df = distance(vW, p);
      if (kind < .5) {                                    // local: the panels right at the hit pop and fade
        float k = age / life, cover = 1.0 - smoothstep(reach * .55, reach, dc + rnd * reach * .25);
        lit += cover * (1.0 - k) * (1.0 - k) * str * 1.2;
        pop += cover * exp(-age * 18.0) * str;
        flare += exp(-df * df / 3.5) * exp(-age * 14.0) * str;
      } else {                                            // sweep: ripple on, hold, reverse ripple off
        float speed = uSpeed;
        float tOn = dc / speed + rnd * .06;
        float fade = min(.45, life * .3), tOff = life - .04 - fade * (dc / reach) - rnd * .05;
        float cover = 1.0 - smoothstep(reach * .72, reach, dc + rnd * reach * .18);
        float on = smoothstep(tOn, tOn + .07, age) * (1.0 - smoothstep(tOff - .12, tOff, age)) * cover;
        lit += on * str;
        pop += cover * str * exp(-max(age - tOn, 0.0) * 9.0) * step(tOn, age);
        float fr = age * speed;
        front += exp(-pow((df - fr) / 1.4, 2.0)) * cover * (1.0 - smoothstep(reach * .6, reach, fr)) * (held > .5 ? 0.0 : 1.0);
        float fl = held > .5 ? .55 + .25 * sin(uTime * 24.0) : exp(-age * 5.5);
        float r0 = 2.6 + reach * .04;
        flare += exp(-df * df / (r0 * r0)) * fl * str;
        for (int k = 0; k < 3; k++) {                       // three concentric rings leave the impact point
          float t = age - float(k) * .09;
          if (t > 0.0) rings += exp(-pow((df - t * 30.0) / .9, 2.0)) * exp(-t * 3.2) * (1.0 - smoothstep(reach * .5, reach * .9, t * 30.0));
        }
      }
    } else {                                              // nuke dome: rises bottom-up, holds, goes off top-down
      float rise = uD[i].y, push = uD[i].z;
      float frontH = rise * 1.08;
      float on = smoothstep(frontH, frontH - .05, hCell + rnd * .04);
      float tOff = life - .05 - .8 * hCell - rnd * .08;
      on *= 1.0 - smoothstep(tOff - .15, tOff, age);
      lit += on * (.75 + .35 * push);
      pop += on * exp(-max(rise * 1.0 - hCell, 0.0) * 6.0) * step(rise, 1.15);
      front += exp(-pow((hF - frontH) / .025, 2.0)) * step(rise, 1.08) * step(0.0, rise);
      if (uD[i].x >= 0.0) {
        vec2 d = vW.xz - uC[i].zw; float r = length(d);
        float facing = clamp(-dot(d / max(r, 1e-3), normalize(vN.xz + 1e-4)), 0.0, 1.0);
        band += (exp(-pow((r - uD[i].x) / uC[i].y, 2.0)) * 1.5 + facing * .45) * push * on;
        lit += facing * push * .9 * on;
      } else band += exp(-pow((hF - push) / .08, 2.0)) * push * on;
    }
  }
  if (lit + pop + flare + rings + front + band < .002) { if (uWarm > .5) { gl_FragColor = vec4(0.0); return; } discard; }
  float calmK = 1.0 - .65 * uCalm;
  pop *= calmK; flare *= mix(1.0, .45, uCalm); rings *= 1.0 - uCalm;
  lit = min(lit, 1.6);
  vec3 V = normalize(cameraPosition - vW), N = normalize(vN);
  float fres = pow(1.0 - abs(dot(N, V)), 2.2);
  float scan = .84 + .16 * sin(vW.y * 1.6 - uTime * 2.6 + rnd * 1.5);
  float shimmer = .86 + .14 * sin(uTime * (2.0 + rnd * 3.0) + rnd * 40.0);
  float l = lit * scan * shimmer;
  float ground = exp(-hF / max(invH * 1.6, .015)) * min(lit, 1.0);   // contact line at the ground
  vec3 tint = vec3(.10, .13, .52), fill = mix(vec3(.26, .40, 1.0), vec3(.45, .34, 1.0), rnd) * (.8 + .4 * hash(hx.zw + 3.1)), edgeC = vec3(.40, .78, 1.0), hot = vec3(.82, .92, 1.0);
  float alpha = l * (.16 + .34 * fres) + lit * (edge * .62 + halo * .38) + pop * .25 * (1.0 - e * .5)
              + flare * .55 + rings * .35 + front * .42 + band * .5 + ground * .3;
  alpha = clamp(alpha, 0.0, .9);
  vec3 glow = fill * l * (.12 + .7 * fres) + edgeC * lit * edge * 1.05 + edgeC * halo * lit * .12 + fill * pop * .55
            + hot * (flare * 1.15 + front * .55 + band * .9) + edgeC * rings * .8 + edgeC * ground * .6;
  if (!gl_FrontFacing) { alpha *= .5; glow *= .5; }
  gl_FragColor = vec4(tint * alpha + glow, alpha);
}`;
// v1 (round 1, kept behind ?shield=v1 for side-by-side comparison). Hospital shield look (user decision 2026-10-18, 시안/병원_보호_시안.html option A): a hexagonal cyan shield flashes where a
// protected building is hit, with an expanding ring; the nuke raises a hex dome over each protected building. Visual only —
// sound and damage rules live with the caller. Everything is pooled at creation; the hex pattern is a DataTexture (no canvas).
function createShieldEffectsV1(THREE, scene, camera, { reducedMotion = false } = {}) {
  const FLASHES = 14, RINGS = 14, DOMES = 8;
  const hex = hexTexture(THREE);
  const disc = new THREE.CircleGeometry(1, 40), ringGeo = new THREE.RingGeometry(.2, 1.4, 40);
  const domeGeo = new THREE.SphereGeometry(1, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  const owned = [hex, disc, ringGeo, domeGeo];
  const group = new THREE.Group(); group.name = 'hospital-shield-effects'; scene.add(group);
  const basic = (o) => { const m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, ...o }); owned.push(m); return m; };
  const flashes = Array.from({ length: FLASHES }, () => {
    const map = hex.clone(); map.needsUpdate = true; owned.push(map);
    const m = new THREE.Mesh(disc, basic({ map })), r = new THREE.Mesh(ringGeo, basic({ color: 0x8ae6ff }));
    m.visible = r.visible = false; m.renderOrder = r.renderOrder = 4; m.frustumCulled = r.frustumCulled = false; group.add(m, r);
    return { m, r, age: 0, life: .7, size: 1, strong: false, hold: false, delay: 0, active: false };
  });
  const domes = Array.from({ length: DOMES }, () => {
    const map = hex.clone(); map.repeat.set(10, 4); map.needsUpdate = true; owned.push(map);
    const m = new THREE.Mesh(domeGeo, basic({ map, opacity: 0 })); m.visible = false; m.renderOrder = 4; group.add(m);
    return { m, age: 0, life: 4.2, delay: 0, active: false, rx: 1, ry: 1 };
  });
  let next = 0, nextDome = 0, clock = 0;
  const tmp = new THREE.Vector3(), cam = new THREE.Vector3();
  // size: world radius at about 90 units from the camera; grows with distance so a far hit still reads (capped).
  function flash(point, normal, size = 8, { life = .7, strong = false, delay = 0, hold = false } = {}) {
    if (!point || !normal) return null;
    const s = flashes[next++ % FLASHES];
    camera.getWorldPosition(cam); const scale = Math.min(2.5, Math.max(1, cam.distanceTo(point) / 90));
    place(s, point, normal);
    Object.assign(s, { age: 0, life, size: size * scale, strong, hold, delay, active: true });
    s.m.material.map.repeat.set(size / 7, size / 7);
    s.m.visible = s.r.visible = false;
    return s;
  }
  function place(s, point, normal) {
    s.m.position.copy(point).addScaledVector(normal, .35); s.m.lookAt(tmp.copy(s.m.position).add(normal));
    s.r.position.copy(s.m.position).addScaledVector(normal, .05); s.r.quaternion.copy(s.m.quaternion);
  }
  // A held flash (drill / flamethrower contact) stays lit and follows the contact point until released.
  function holdAt(s, point, normal) { if (s?.active) { place(s, point, normal); s.hold = true; } }
  function release(s) { if (s) s.hold = false; }
  // Dome over one protected site: ellipsoid that covers the footprint and the roof.
  function dome(site, { delay = 0, life = 4.2 } = {}) {
    const d = domes[nextDome++ % DOMES];
    d.m.position.set(site.centerX, site.baseY, site.centerZ);
    d.rx = site.radius * 1.12; d.ry = Math.max(site.radius * .9, (site.topY - site.baseY) * 1.18);
    d.m.material.opacity = 0; d.m.visible = false; Object.assign(d, { age: 0, life, delay, active: true });
    return d;
  }
  function update(dt) {
    if (!(dt >= 0)) return; clock += dt;
    for (const s of flashes) {
      if (!s.active) continue;
      if (s.delay > 0) { s.delay -= dt; if (s.delay > 0) continue; }
      s.age += dt; if (s.hold) s.age = Math.min(s.age, .12);
      const k = s.age / s.life; if (k >= 1) { s.active = false; s.m.visible = s.r.visible = false; continue; }
      s.m.visible = s.r.visible = true;
      const pop = Math.min(1, s.age * (s.strong ? 9 : 6)), wobble = s.hold && !reducedMotion ? 1 + .04 * Math.sin(clock * 22) : 1;
      s.m.scale.setScalar(s.size * (.35 + .65 * pop) * wobble);
      s.m.material.opacity = (s.strong ? 1 : .9) * (1 - k) * (s.hold ? .75 + .25 * Math.sin(clock * 14) : 1);
      s.m.material.color.setScalar(s.strong ? 1 + 1.6 * Math.max(0, 1 - s.age * 6) : 1);
      s.r.scale.setScalar(s.size / 14 * (1 + k * 9)); s.r.material.opacity = 1 - k;
    }
    for (const d of domes) {
      if (!d.active) continue;
      if (d.delay > 0) { d.delay -= dt; if (d.delay > 0) continue; }
      d.age += dt; const k = d.age;
      if (k >= d.life) { d.active = false; d.m.visible = false; continue; }
      d.m.visible = true; const grow = Math.min(1, .2 + k * 3);
      d.m.scale.set(d.rx * grow, d.ry * grow, d.rx * grow);
      d.m.material.opacity = k < .3 ? k / .3 * .7 : .7 * Math.max(0, Math.min(1, 1 - (k - (d.life - 1.2)) / 1.2));
    }
  }
  function clear() { for (const s of flashes) { s.active = false; s.m.visible = s.r.visible = false; } for (const d of domes) { d.active = false; d.m.visible = false; } }
  return {
    flash, holdAt, release, dome, update, clear,
    get animating() { for (const s of flashes) if (s.active) return true; for (const d of domes) if (d.active) return true; return false; },
    get stats() { return { flashes: flashes.filter(s => s.active).length, domes: domes.filter(d => d.active).length, domesShown: domes.filter(d => d.active && d.m.visible).length }; },
    dispose() { clear(); group.removeFromParent(); for (const o of owned) o.dispose(); },
  };
}

// Hex grid (mock: 16 px cells on 256 px): translucent cyan fill, bright cyan edges. 96 x 97 px holds exactly 8 columns x 7
// rows, so the repeat has no seam. Pure JS, works without a DOM.
function hexTexture(THREE) {
  const NW = 96, NH = 97, r = NW / 12, h = NH / 7, data = new Uint8Array(NW * NH * 4);
  for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) {
    // distance to the nearest hex centre on a flat-top layout (columns 1.5 r apart, odd columns shifted h/2)
    let best = Infinity, second = Infinity;
    const col = Math.round(x / (1.5 * r));
    for (let c = col - 1; c <= col + 1; c++) {
      const cx = c * 1.5 * r, off = (c & 1) ? h / 2 : 0, row = Math.round((y - off) / h);
      for (let j = row - 1; j <= row + 1; j++) {
        const cy = j * h + off, d = Math.hypot(x + .5 - cx, y + .5 - cy);
        if (d < best) { second = best; best = d; } else if (d < second) second = d;
      }
    }
    const edge = Math.max(0, 1 - (second - best) / 2.2), i = (y * NW + x) * 4;
    data[i] = Math.round(80 + (47 - 80) * edge); data[i + 1] = Math.round(210 + (196 - 210) * edge); data[i + 2] = 255;
    data[i + 3] = Math.round(56 + (255 - 56) * edge);
  }
  const t = new THREE.DataTexture(data, NW, NH, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
