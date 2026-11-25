// Robot vacuum 로봇청소기 (15th weapon; user decisions 2026-10-26, mock 시안/로봇청소기_시안.html, look A: glossy white
// shell, black bumper, black LiDAR dome with a spinning red dot, one side brush, a blue light ring, dust-bin lid seam and
// buttons; no brand or logo). Drawn big: about half a 4-5 storey building wide.
// Tap the ground (or a building: it is set down just outside that wall): it drops from above, lands on the terrain and roams
// for `roam` seconds like a real one - straight on, bumper meets something, a short back-off, a turn (now and then it follows
// the wall for a while) - tilting with the slope (campus.terrain.heightAt). Then it sparkles, shrinks and is gone (no dock).
// Two jobs (the first weapon in this game that cleans up):
//  1. Rubble: fragments that are flying / lying near it (model-destruction pieces that are released but not yet retired) are
//     swallowed: up to `suckMax` swirl into it as stand-in chunks, the rest are retired at once. Rubble lying close to a
//     roaming vacuum is kept from fading until it gets there, and the vacuum leans towards the nearest pile.
//  2. Ground floor: walls are found from the building's own fragments in the vacuum's height band (a lazy grid of their
//     world boxes, so the real outline and any hole already bitten count); a bump bites the bottom of the wall with
//     campus.hit spheres kept close to the ground; wall following scrapes it lightly.
// Floor dust (PC only): impacts reported by the host (soil()) leave dust patches on the ground; the vacuum wipes a clean
// path through them. Phones only swallow rubble.
// Protected buildings (hospitals, heritage): the bumper bounces off the shield, nothing is bitten. At most `maxLive` at
// once; another tap sends the oldest away early. Numbers: WEAPON_TUNING.robovac. Damage only through campus.hit. Meshes and
// pools are made once at creation; update() allocates nothing (WebAudio nodes aside).
import { WEAPON_TUNING } from './weapon-tuning.js?v=sn130';
import { insideRing } from './protected-buildings.js?v=skku42';
import { createRobotVacuumAudio } from './robot-vacuum-audio.js?v=sn130';

export const ROBOVAC_ID = 'robovac';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const TAU = Math.PI * 2;
const angTo = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

// ---------- model (unit diameter, +z = front, y = 0 on the floor; mock look A) ----------
// Parts that never move relative to the body are merged per material: one draw per material, plus the bumper, the LiDAR dot
// and the side brush that move.
function mergeParts(THREE, parts) {
  let nv = 0, ni = 0;
  for (const { geo } of parts) { nv += geo.attributes.position.count; ni += geo.index ? geo.index.count : geo.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3(); let vo = 0, io = 0;
  for (const { geo, m } of parts) {
    const p = geo.attributes.position, n = geo.attributes.normal; nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
      if (n) v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); else v.set(0, 1, 0);
      nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z;
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) idx[io + i] = geo.index.getX(i) + vo;
    else for (let i = 0; i < p.count; i++) idx[io + i] = vo + i;
    io += geo.index ? geo.index.count : p.count; vo += p.count; geo.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere(); return g;
}
export function buildRobotVacuumParts(THREE, { mobile = false } = {}) {
  const V2 = (x, y) => new THREE.Vector2(x, y), M = new THREE.Matrix4(), seg = n => mobile ? Math.max(12, Math.round(n * .6)) : n;
  const at = (x = 0, y = 0, z = 0, ry = 0) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
  const groups = { white: [], dark: [], seam: [], btn: [], led: [], win: [], cap: [], bump: [], bumpWin: [], dot: [], brush: [] };
  const add = (k, geo, m = M.clone().identity()) => groups[k].push({ geo, m });
  function roundRect(x0, y0, x1, y1, r) {
    const s = new THREE.Shape();
    s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1);
    s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0); return s;
  }
  // body: lower skirt + upper shell with a soft chamfer
  add('dark', new THREE.CylinderGeometry(.47, .47, .02, seg(40)), at(0, .01, 0));
  add('white', new THREE.LatheGeometry([V2(0, .02), V2(.47, .02), V2(.493, .032), V2(.5, .058), V2(.5, .11), V2(0, .11)], seg(56)));
  add('white', new THREE.LatheGeometry([V2(.5, .11), V2(.5, .148), V2(.492, .172), V2(.47, .188), V2(.44, .19), V2(0, .19)], seg(56)));
  // front bumper (half ring, slightly proud) + the dark sensor window in its middle
  add('bump', new THREE.LatheGeometry([V2(.492, .034), V2(.511, .04), V2(.515, .09), V2(.511, .146), V2(.492, .152)], seg(40), -Math.PI * .56, Math.PI * 1.12));
  add('bumpWin', new THREE.LatheGeometry([V2(.5155, .072), V2(.5165, .1), V2(.5155, .124)], 10, -.32, .64));
  for (const s of [-1, 1]) { const a = s * Math.PI * .56; add('bump', new THREE.BoxGeometry(.02, .112, .012), at(Math.sin(a) * .502, .093, Math.cos(a) * .502, a)); }
  // top: edge groove, dust-bin lid seam + finger notch, buttons with a light ring
  add('seam', new THREE.RingGeometry(.448, .454, seg(64)).rotateX(-Math.PI / 2), at(0, .1906, 0));
  const lidRing = roundRect(-.24, .03, .24, .38, .08); lidRing.holes.push(roundRect(-.233, .037, .233, .373, .074));
  add('seam', new THREE.ShapeGeometry(lidRing, 6).rotateX(-Math.PI / 2), at(0, .1909, 0));
  add('seam', new THREE.BoxGeometry(.07, .004, .018), at(0, .1912, -.365));
  add('btn', new THREE.CylinderGeometry(.024, .026, .01, 20), at(-.055, .195, .03));
  add('btn', new THREE.CylinderGeometry(.024, .026, .01, 20), at(.055, .195, .03));
  add('led', new THREE.TorusGeometry(.03, .0045, 6, 28).rotateX(Math.PI / 2), at(.055, .197, .03));
  // LiDAR turret: base, dark window band, cap, top disc; a red dot spins inside the window
  const tz = .17;
  add('white', new THREE.CylinderGeometry(.098, .1, .018, 32), at(0, .199, tz));
  add('win', new THREE.CylinderGeometry(.092, .092, .03, 32), at(0, .223, tz));
  add('cap', new THREE.CylinderGeometry(.094, .098, .018, 32), at(0, .247, tz));
  add('seam', new THREE.CylinderGeometry(.06, .06, .002, 24), at(0, .2565, tz));
  add('dot', new THREE.BoxGeometry(.02, .016, .004), at(0, 0, .0925));
  // side brush (front right), arms reach past the rim
  add('brush', new THREE.CylinderGeometry(.04, .04, .016, 14));
  for (let i = 0; i < 3; i++) add('brush', new THREE.BoxGeometry(.034, .008, .3).translate(0, 0, .15).rotateX(.04), at(0, 0, 0, i * TAU / 3));
  const out = {};
  for (const [k, list] of Object.entries(groups)) out[k] = mergeParts(THREE, list);
  return { geos: out, turret: { y: .223, z: tz }, brush: { x: Math.sin(.7) * .36, y: .014, z: Math.cos(.7) * .36 }, top: .256 };
}

export function createRobotVacuum(THREE, scene, camera, {
  campus, protectedSet = null, tuning = WEAPON_TUNING.robovac, reducedMotion = false, mobile = false,
  output = () => null, pixelRatio = () => 1, onDamage = () => {}, onShield = () => {}, onKick = () => {},
} = {}) {
  const T = tuning; if (!T) throw new Error('robot vacuum: WEAPON_TUNING.robovac missing');
  const V3 = THREE.Vector3, units = (campus.worldUnitsPerMeter || .5) / .5;
  const D = T.diameter * units, R = D / 2, H = D * T.band, SPEED = D * T.speed, heightAt = (x, z) => campus.terrain.heightAt(x, z);
  const audio = createRobotVacuumAudio({ output, lite: mobile });
  const owned = [], own = o => (owned.push(o), o), rnd = (a, b) => a + Math.random() * (b - a);
  const entries = campus.entries, sites = protectedSet?.sites || [];
  const tA = new V3(), tB = new V3(), tQ = new THREE.Quaternion(), tM = new THREE.Matrix4(), tS = new V3(), tC = new V3(), hitPoint = new V3(), hitDir = new V3();
  const dustOn = !mobile && T.dustPatches > 0;

  // ---------- materials (shared by every vacuum; standard + basic only, no new texture maps) ----------
  const mats = {
    white: own(new THREE.MeshStandardMaterial({ color: '#f3f4f1', roughness: .26, metalness: 0, emissive: '#2a2b2a', emissiveIntensity: .35 })),
    dark: own(new THREE.MeshStandardMaterial({ color: '#141518', roughness: .9, metalness: 0 })),
    seam: own(new THREE.MeshBasicMaterial({ color: '#b3b8b8' })),
    btn: own(new THREE.MeshStandardMaterial({ color: '#dfe1e0', roughness: .45, metalness: 0 })),
    led: own(new THREE.MeshBasicMaterial({ color: '#5cc8ff' })),
    win: own(new THREE.MeshStandardMaterial({ color: '#08090b', roughness: .14, metalness: 0 })),
    cap: own(new THREE.MeshStandardMaterial({ color: '#1b1d20', roughness: .3, metalness: 0 })),
    bump: own(new THREE.MeshStandardMaterial({ color: '#1b1d20', roughness: .42, metalness: 0, side: THREE.DoubleSide })),
    dot: own(new THREE.MeshBasicMaterial({ color: '#ff3b2f' })),
    brush: own(new THREE.MeshStandardMaterial({ color: '#33373c', roughness: .8, metalness: 0 })),
  };
  mats.bumpWin = mats.win;
  const parts = buildRobotVacuumParts(THREE, { mobile }); for (const g of Object.values(parts.geos)) own(g);

  // ---------- textures ----------
  function canvasTex(w, h, paint) {
    const c = globalThis.document?.createElement?.('canvas'); if (!c) return null;
    c.width = w; c.height = h; const g = c.getContext('2d'); paint(g, w, h);
    const t = own(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const blobTex = canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(.62, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  const starTex = canvasTex(64, 64, (g, w) => {
    const c = w / 2, gr = g.createRadialGradient(c, c, 0, c, c, c * .55); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.moveTo(c, 0); g.lineTo(c + 3, c - 3); g.lineTo(w, c); g.lineTo(c + 3, c + 3); g.lineTo(c, w); g.lineTo(c - 3, c + 3); g.lineTo(0, c); g.lineTo(c - 3, c - 3); g.closePath(); g.fill();
  });

  // ground-hugging patch (draped on heightAt)
  function groundPatch(tex, segs, offset, { color = '#ffffff', opacity = 1, order = 2 } = {}) {
    const geo = own(new THREE.PlaneGeometry(1, 1, segs, segs)); geo.rotateX(-Math.PI / 2);
    const mat = own(new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset }));
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = order; mesh.visible = false;
    const base = Float32Array.from(geo.attributes.position.array);
    mesh.userData.place = (x, z, size, lift = .08) => {
      const a = geo.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) { const wx = x + base[i] * size, wz = z + base[i + 2] * size, h = heightAt(wx, wz); a[i] = wx; a[i + 1] = (Number.isFinite(h) ? h : 0) + lift; a[i + 2] = wz; }
      geo.attributes.position.needsUpdate = true;
    };
    scene.add(mesh); return mesh;
  }

  // ---------- the vacuums ----------
  function makeVac(n) {
    const root = new THREE.Group(); root.name = `robot-vacuum-${n}`; root.visible = false;
    const body = new THREE.Group(); body.scale.setScalar(D); root.add(body);
    const mesh = (k, parent = body) => { const o = new THREE.Mesh(parts.geos[k], mats[k]); o.castShadow = false; o.receiveShadow = false; parent.add(o); return o; };
    for (const k of ['white', 'dark', 'seam', 'btn', 'led', 'win', 'cap']) mesh(k);
    const bumper = new THREE.Group(); body.add(bumper); mesh('bump', bumper); mesh('bumpWin', bumper);
    const laser = new THREE.Group(); laser.position.set(0, parts.turret.y, parts.turret.z); body.add(laser); mesh('dot', laser);
    const brush = new THREE.Group(); brush.position.set(parts.brush.x, parts.brush.y, parts.brush.z); body.add(brush); mesh('brush', brush);
    scene.add(root);
    const shadow = blobTex ? groundPatch(blobTex, 6, -2, { opacity: .42, order: 1 }) : null;
    return { n, root, body, bumper, laser, brush, shadow, on: false, phase: 'off', t: 0, x: 0, y: 0, z: 0, vy: 0, gy: 0, th: 0, pitch: 0, roll: 0,
      mode: 'go', mt: 0, roam: 0, press: 0, squash: 0, follow: null, ft: 0, side: 1, scrape: 0, turnTo: 0, hit: null, lx: 0, lz: 0,
      seekX: 0, seekZ: 0, seek: false, id: 0, bites: 0, bumps: 0, sucked: 0, shield: 0, born: 0, spin: 0 };
  }
  const vacs = Array.from({ length: T.maxLive }, (_, i) => makeVac(i));

  // ---------- particles (dust puffs + sparkles), stand-in rubble, dust patches ----------
  const ATTRS = ['position', 'size', 'alpha', 'tint'];
  function createPoints(max, additive) {
    const geo = own(new THREE.BufferGeometry()), pos = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max), tint = new Float32Array(max * 3);
    const vel = new Float32Array(max * 3), age = new Float32Array(max), life = new Float32Array(max), grow = new Float32Array(max), a0 = new Float32Array(max), drag = new Float32Array(max), lift = new Float32Array(max);
    for (const [k, a, n] of [['position', pos, 3], ['size', size, 1], ['alpha', alpha, 1], ['tint', tint, 3]]) geo.setAttribute(k, new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage));
    const mat = own(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, ...(additive ? { blending: THREE.AdditiveBlending } : {}), uniforms: { uScale: { value: 400 } },
      vertexShader: 'attribute float size, alpha; attribute vec3 tint; uniform float uScale; varying float vA; varying vec3 vC; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv; gl_PointSize = min(512., size * uScale / max(.5, -mv.z)); vA = alpha; vC = tint; }',
      fragmentShader: additive
        ? 'varying float vA; varying vec3 vC; void main(){ vec2 q = gl_PointCoord * 2. - 1.; float d = dot(q,q); if (d > 1.) discard; float a = (1. - d); a *= a; float x = max(0., 1. - abs(q.x) * 9.) * (1. - abs(q.y)) + max(0., 1. - abs(q.y) * 9.) * (1. - abs(q.x)); a = max(a, x); gl_FragColor = vec4(vC * a * vA, a * vA); }'
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
        const t = age[i] / life[i]; alpha[i] = a0[i] * Math.min(1, age[i] * (additive ? 30 : 10)) * Math.pow(1 - t, 1.4);
      }
      geo.setDrawRange(0, n); drawn = n; for (const k of ATTRS) geo.attributes[k].needsUpdate = true;
    }
    return { points: pts, spawn, update, clear() { n = 0; geo.setDrawRange(0, 0); drawn = 0; }, get count() { return n; } };
  }
  const dust = createPoints(mobile ? T.dustPhone : T.dust, false), sparks = createPoints(mobile ? 24 : 40, true);

  // stand-in rubble that swirls into a vacuum (the real fragment is retired the moment it is caught)
  const SM = mobile ? T.suckMaxPhone : T.suckMax, unitBox = own(new THREE.BoxGeometry(1, 1, 1));
  const suckMesh = new THREE.InstancedMesh(unitBox, own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .92, metalness: 0 })), SM);
  suckMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); suckMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SM * 3), 3);
  suckMesh.frustumCulled = false; suckMesh.count = 0; suckMesh.castShadow = false; scene.add(suckMesh);
  const rubbleColors = ['#a59d8e', '#8c8478', '#b9ab95', '#6f6a62', '#c4b8a4', '#7b6a58', '#9a9893', '#d9cfbd'].map(c => new THREE.Color(c));
  const sucks = Array.from({ length: SM }, () => ({ on: false, v: null, t: 0, life: .4, ox: 0, oy: 0, oz: 0, s: 1, ax: 0, ay: 1, az: 0, ang: 0, spin: 0, color: 0, dir: 1 }));

  // dust patches (PC): a small canvas each, draped on the ground; the vacuum wipes its path out of them
  const DP = dustOn ? T.dustPatches : 0, DTX = T.dustTexture || 256;
  const patches = [];
  for (let i = 0; i < DP; i++) {
    const c = globalThis.document?.createElement?.('canvas'); if (!c) break; c.width = c.height = DTX;
    const g = c.getContext('2d'), tex = own(new THREE.CanvasTexture(c)); tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = groundPatch(tex, 12, -3, { opacity: 1, order: 2 });
    patches.push({ mesh, g, tex, x: 0, z: 0, size: 1, on: false, born: -1e9, dirty: false, wiped: 0 });
  }
  let seed = 7; const prand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // Soft grey-brown film (a few faint blotches, fine grit) so a wiped path reads as clean ground, not as a hole.
  function paintDust(p, fresh) {
    const g = p.g, w = DTX, k = w / 128; g.globalCompositeOperation = 'source-over';
    if (fresh) g.clearRect(0, 0, w, w);
    for (let i = 0; i < 6; i++) {
      const a = prand() * TAU, r = prand() * w * .22, x = w / 2 + Math.cos(a) * r, y = w / 2 + Math.sin(a) * r, s = w * (.22 + prand() * .18);
      const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(112,100,84,.26)'); gr.addColorStop(.55, 'rgba(118,106,90,.16)'); gr.addColorStop(1, 'rgba(118,106,90,0)'); g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2);
    }
    for (let i = 0, n = Math.round(150 * k * k); i < n; i++) {
      const a = prand() * TAU, r = Math.sqrt(prand()) * w * .4, x = w / 2 + Math.cos(a) * r, y = w / 2 + Math.sin(a) * r, s = .8 + prand() * 1.2;
      g.fillStyle = prand() < .5 ? 'rgba(78,68,54,.34)' : 'rgba(176,164,144,.3)'; g.fillRect(x, y, s, s);
    }
    p.tex.needsUpdate = true;
  }
  let soiled = 0;
  // Host: an impact at `point` (radius = its hit radius): a dust patch on the ground there (PC only; the vacuum's own bites
  // do not soil). Close to an existing patch it adds to that one instead of taking a new one.
  function soil(point, radius = 4, toolId = null) {
    if (!DP || !point || toolId === ROBOVAC_ID || ![point.x, point.z].every(Number.isFinite)) return false;
    const size = clamp(radius * 2.4 + 8 * units, 10 * units, 34 * units);
    let p = patches.find(q => q.on && Math.hypot(q.x - point.x, q.z - point.z) < q.size * .3);
    if (p) { paintDust(p, false); p.born = performance.now() / 1000; return true; }
    p = patches.find(q => !q.on) || patches.reduce((a, q) => q.born < a.born ? q : a, patches[0]);
    p.on = true; p.x = point.x; p.z = point.z; p.size = size; p.born = performance.now() / 1000; p.wiped = 0;
    seed = 7 + ((point.x * 73856093) ^ (point.z * 19349663)) & 0x7fffffff || 11;
    paintDust(p, true); p.mesh.userData.place(p.x, p.z, p.size, .1); p.mesh.visible = true; soiled++;
    return true;
  }
  function wipe(v) {
    if (!DP) return;
    for (const p of patches) {
      if (!p.on) continue;
      const half = p.size / 2; if (Math.abs(v.x - p.x) > half + R || Math.abs(v.z - p.z) > half + R) continue;
      const k = DTX / p.size, x0 = (v.lx - p.x + half) * k, y0 = (v.lz - p.z + half) * k, x1 = (v.x - p.x + half) * k, y1 = (v.z - p.z + half) * k;
      const g = p.g; g.globalCompositeOperation = 'destination-out'; g.lineCap = 'round'; g.lineWidth = R * 1.86 * k; g.strokeStyle = '#000';
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 + .01, y1); g.stroke(); p.dirty = true; p.wiped += Math.hypot(v.x - v.lx, v.z - v.lz) * R * 1.86;
    }
  }

  // ---------- walls: the buildings' own fragments in the vacuum's height band, in a lazy grid ----------
  const CELL = Math.max(2 * units, R * .5), grid = new Map(), items = [], indexed = new Set();
  const cellKey = (ix, iz) => (ix + 32768) * 65536 + (iz + 32768);
  function indexEntry(e) {
    indexed.add(e); const model = e.model; if (!model?.pieces || !model.group) return;
    model.group.updateWorldMatrix(true, false); const m = model.group.matrixWorld.elements;
    for (let i = 0; i < model.pieces.length; i++) {
      const p = model.pieces[i], b = p.bounds;
      const cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2, cz = (b.min.z + b.max.z) / 2, sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z;
      const wx = m[0] * cx + m[4] * cy + m[8] * cz + m[12], wy = m[1] * cx + m[5] * cy + m[9] * cz + m[13], wz = m[2] * cx + m[6] * cy + m[10] * cz + m[14];
      const hx = (Math.abs(m[0]) * sx + Math.abs(m[4]) * sy + Math.abs(m[8]) * sz) / 2, hy = (Math.abs(m[1]) * sx + Math.abs(m[5]) * sy + Math.abs(m[9]) * sz) / 2, hz = (Math.abs(m[2]) * sx + Math.abs(m[6]) * sy + Math.abs(m[10]) * sz) / 2;
      const g = heightAt(wx, wz), gy = Number.isFinite(g) ? g : wy - hy;
      if (wy - hy > gy + H || wy + hy < gy + .15 * units) continue; // above the vacuum, or a flat bit lying on the ground
      const it = { e, p, x0: wx - hx, x1: wx + hx, z0: wz - hz, z1: wz + hz }; items.push(it);
      for (let ix = Math.floor(it.x0 / CELL); ix <= Math.floor(it.x1 / CELL); ix++) for (let iz = Math.floor(it.z0 / CELL); iz <= Math.floor(it.z1 / CELL); iz++) {
        const k = cellKey(ix, iz); let list = grid.get(k); if (!list) grid.set(k, list = []); list.push(it);
      }
    }
  }
  function indexNear(x, z, reach) {
    for (const e of entries) {
      if (indexed.has(e) || e.cleared) continue; const b = e.worldBounds;
      if (x + reach < b.min.x || x - reach > b.max.x || z + reach < b.min.z || z - reach > b.max.z) continue;
      indexEntry(e);
    }
  }
  const solidHit = { e: null, cx: 0, cz: 0, d: 0 };
  // Nearest standing wall fragment within r of (x, z) (only = this building, skip = not this one), or null.
  function solidAt(x, z, r, skip = null, only = null) {
    let best = null, bd = r;
    const ix0 = Math.floor((x - r) / CELL), ix1 = Math.floor((x + r) / CELL), iz0 = Math.floor((z - r) / CELL), iz1 = Math.floor((z + r) / CELL);
    for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
      const list = grid.get(cellKey(ix, iz)); if (!list) continue;
      for (const it of list) {
        if (!it.p.active || it.e.cleared || it.e === skip || (only && it.e !== only)) continue;
        const cx = x < it.x0 ? it.x0 : x > it.x1 ? it.x1 : x, cz = z < it.z0 ? it.z0 : z > it.z1 ? it.z1 : z, d = Math.hypot(x - cx, z - cz);
        if (d < bd) { bd = d; best = it; solidHit.cx = cx; solidHit.cz = cz; }
      }
    }
    if (!best) return null;
    solidHit.e = best.e; solidHit.d = bd; return solidHit;
  }
  // Protected site whose outline is within r of (x, z): { site, cx, cz } or null.
  const siteHit = { site: null, cx: 0, cz: 0 };
  function siteAt(x, z, r) {
    for (const s of sites) {
      if (x < s.box.min.x - r || x > s.box.max.x + r || z < s.box.min.z - r || z > s.box.max.z + r) continue;
      if (insideRing(x, z, s.ring)) { siteHit.site = s; siteHit.cx = s.centerX; siteHit.cz = s.centerZ; return siteHit; }
      const p = s.ring;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const a = p[i], q = p[j], ex = q.x - a.x, ez = q.z - a.z, l2 = ex * ex + ez * ez || 1, t = clamp(((x - a.x) * ex + (z - a.z) * ez) / l2, 0, 1), px = a.x + ex * t, pz = a.z + ez * t;
        if (Math.hypot(x - px, z - pz) < r) { siteHit.site = s; siteHit.cx = px; siteHit.cz = pz; return siteHit; }
      }
    }
    return null;
  }
  // play area: buildings + protected sites, with a margin (past it is the backdrop nothing can touch)
  const playBox = new THREE.Box3(); for (const e of entries) playBox.union(e.worldBounds); for (const s of sites) playBox.union(s.box);
  if (playBox.isEmpty()) playBox.set(new V3(-200, -50, -200), new V3(200, 50, 200));
  playBox.expandByVector(new V3(16 * units, 0, 16 * units));
  const hitInfo = { kind: '', e: null, site: null, cx: 0, cz: 0 };
  function hitTest(v, x, z, skip = null) {
    const h = hitInfo; h.e = null; h.site = null;
    if (x < playBox.min.x + R || x > playBox.max.x - R || z < playBox.min.z + R || z > playBox.max.z - R) { h.kind = 'edge'; h.cx = clamp(x, playBox.min.x, playBox.max.x); h.cz = clamp(z, playBox.min.z, playBox.max.z); return h; }
    const g0 = heightAt(v.x, v.z), fx = x - v.x, fz = z - v.z, l = Math.hypot(fx, fz) || 1, ax = v.x + fx / l * R * .9, az = v.z + fz / l * R * .9, g1 = heightAt(ax, az);
    if (!Number.isFinite(g1)) { h.kind = 'edge'; h.cx = ax; h.cz = az; return h; }
    if (Number.isFinite(g0) && g1 - g0 > R * .9 * T.maxSlope) { h.kind = 'slope'; h.cx = ax; h.cz = az; return h; }
    const s = siteAt(x, z, R); if (s) { h.kind = 'site'; h.site = s.site; h.cx = s.cx; h.cz = s.cz; return h; }
    for (const o of vacs) if (o !== v && o.on && o.phase === 'roam' && Math.hypot(o.x - x, o.z - z) < R * 2) { h.kind = 'vac'; h.cx = (o.x + x) / 2; h.cz = (o.z + z) / 2; return h; }
    const w = solidAt(x, z, R, skip); if (w) { h.kind = 'building'; h.e = w.e; h.cx = w.cx; h.cz = w.cz; return h; }
    return null;
  }

  // ---------- damage ----------
  const agg = { count: 0, weight: 0, affected: [], cleared: [] }, aggPoint = new V3(), aggNormal = new V3(0, 1, 0);
  let aggFeedback = false, bites = 0, bitePieces = 0;
  function collect(res) {
    agg.count += res.count; agg.weight += res.weight;
    for (const e of res.affected) if (!agg.affected.includes(e)) agg.affected.push(e);
    for (const e of res.cleared) if (!agg.cleared.includes(e)) agg.cleared.push(e);
  }
  // A bite into the bottom of the wall at the contact point (cx, cz): campus.hit spheres just above the ground, the rubble
  // thrown back towards the vacuum (so it comes straight in).
  function chew(v, cx, cz, strong) {
    let fx = cx - v.x, fz = cz - v.z; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
    const g = heightAt(cx, cz), gy = Number.isFinite(g) ? g : v.y, r = D * (strong ? T.chewRadius : T.scrapeRadius), n = strong ? T.chewHits : 1;
    hitDir.set(-fx, .45, -fz).normalize(); let count = 0;
    for (let i = 0; i < n; i++) {
      const k = n === 1 ? 0 : (i / (n - 1) - .5) * 2, side = k * R * .34;
      hitPoint.set(cx + fx * r * .35 - fz * side, gy + D * T.chewLift, cz + fz * r * .35 + fx * side);
      const res = campus.hit(hitPoint, r, strong ? T.chewForce : T.scrapeForce, { direction: hitDir });
      if (!res.count) continue; collect(res); count += res.count; aggPoint.copy(hitPoint); aggNormal.set(-fx, 0, -fz);
    }
    if (!count) return 0;
    bites++; bitePieces += count; v.bites++; if (strong) aggFeedback = true;
    audio.play('chew', Math.min(1.2, .45 + count / 30));
    for (let i = 0; i < (mobile ? 5 : 9) * (strong ? 1 : .5); i++) { const a = rnd(-1.2, 1.2), sp = rnd(2, 6) * units; dust.spawn(cx - fx * R * .1 + rnd(-1, 1) * units, gy + rnd(.3, 1.6) * units, cz - fz * R * .1 + rnd(-1, 1) * units, (-fx * Math.cos(a) + fz * Math.sin(a)) * sp, rnd(.6, 2.4) * units, (-fz * Math.cos(a) - fx * Math.sin(a)) * sp, rnd(1.4, 2.6) * units, 1.6 * units, rnd(1, 1.7), .6, .78, .74, .67, 1.8, .45); }
    return count;
  }
  function flush() {
    if (!agg.count) return;
    const res = { count: agg.count, weight: agg.weight, affected: agg.affected.slice(), cleared: agg.cleared.slice() };
    agg.count = 0; agg.weight = 0; agg.affected.length = 0; agg.cleared.length = 0;
    onDamage(res, { kind: 'robovac', point: aggPoint, normal: aggNormal, radius: D * T.chewRadius, force: T.chewForce, feedback: aggFeedback }); aggFeedback = false;
  }

  // ---------- rubble: find released fragments near a roaming vacuum (bounds-filtered scan at scanEvery) ----------
  let scanClock = 0, sucked = 0, swirled = 0, held = 0;
  const pullR = R * T.pullRadius, holdR = R * T.holdRadius;
  function capture(v, p, wx, wy, wz, sx) {
    p.age = p.lifetime; // the model retires it on its next update
    sucked++; v.sucked++;
    const s = sucks.find(q => !q.on); if (!s) return;
    swirled++; s.on = true; s.v = v; s.t = 0; s.ox = wx - v.x; s.oy = wy - v.y; s.oz = wz - v.z; s.s = clamp(sx, .25 * units, 2.4 * units);
    s.life = T.suckTime * (.8 + Math.min(.8, Math.hypot(s.ox, s.oz) / pullR * .6)); s.dir = Math.random() < .5 ? 1 : -1;
    s.ax = rnd(-1, 1); s.ay = rnd(-1, 1); s.az = rnd(-1, 1); const l = Math.hypot(s.ax, s.ay, s.az) || 1; s.ax /= l; s.ay /= l; s.az /= l;
    s.ang = rnd(0, TAU); s.spin = rnd(6, 14); s.color = (Math.random() * rubbleColors.length) | 0;
  }
  let suckSoundAt = -1;
  function scanRubble(now) {
    held = 0; for (const v of vacs) v.seek = false;
    let any = false; for (const v of vacs) if (v.on && v.phase === 'roam') { any = true; break; } if (!any) return;
    const seekD = []; for (const v of vacs) seekD[v.n] = R * T.seekRange;
    let caught = 0;
    for (const e of entries) {
      const model = e.model; if (!model?.pieces || !(model.flyingCount > 0)) continue;
      const b = e.worldBounds, margin = holdR + 14 * units; let near = false;
      for (const v of vacs) if (v.on && v.phase === 'roam' && v.x + margin > b.min.x && v.x - margin < b.max.x && v.z + margin > b.min.z && v.z - margin < b.max.z) { near = true; break; }
      if (!near) continue;
      model.group.updateWorldMatrix(true, false); const m = model.group.matrixWorld.elements, sc = Math.hypot(m[0], m[1], m[2]);
      for (const p of model.pieces) {
        if (p.active || p.hidden || !(p.lifetime > 0) || p.age >= p.lifetime || p.age < .12) continue;
        const q = p.position, wx = m[0] * q.x + m[4] * q.y + m[8] * q.z + m[12], wy = m[1] * q.x + m[5] * q.y + m[9] * q.z + m[13], wz = m[2] * q.x + m[6] * q.y + m[10] * q.z + m[14];
        for (const v of vacs) {
          if (!v.on || v.phase !== 'roam') continue;
          const d = Math.hypot(wx - v.x, wz - v.z), low = wy < v.y + D * .75;
          if (d < pullR && low) { capture(v, p, wx, wy, wz, Math.max(p.scale.x, p.scale.y, p.scale.z) * sc * .8); caught++; break; }
          if (d < holdR && wy < v.y + R * .5) { if (p.lifetime - p.age < 1.05) p.age = p.lifetime - 1.05; held++; if (d < seekD[v.n]) { seekD[v.n] = d; v.seek = true; v.seekX = wx; v.seekZ = wz; } }
        }
      }
    }
    if (caught && now - suckSoundAt > .12) { suckSoundAt = now; audio.play('suck', Math.min(1.2, .5 + caught / 12)); }
  }
  function updateSucks(dt) {
    let n = 0;
    for (const s of sucks) {
      if (!s.on) continue;
      s.t += dt; const e = Math.min(1, s.t / s.life), ee = e * e, v = s.v;
      if (e >= 1 || !v?.on) { s.on = false; continue; }
      const a = e * 5 * s.dir, ca = Math.cos(a), sa = Math.sin(a), f = 1 - ee;
      const x = v.x + (s.ox * ca - s.oz * sa) * f, z = v.z + (s.ox * sa + s.oz * ca) * f, y = v.y + D * .08 + (s.oy - D * .08) * f + Math.sin(e * Math.PI) * D * .12;
      s.ang += s.spin * dt; tQ.setFromAxisAngle(tC.set(s.ax, s.ay, s.az), s.ang);
      const k = s.s * (1 - ee * .85);
      suckMesh.setColorAt(n, rubbleColors[s.color]); suckMesh.setMatrixAt(n++, tM.compose(tA.set(x, y, z), tQ, tS.set(k, k * .8, k * .9)));
      if (!mobile && Math.random() < dt * 14) dust.spawn(x, y, z, 0, 0, 0, s.s * 1.4, s.s, rnd(.25, .45), .35, .74, .7, .64, 3, 0);
    }
    suckMesh.count = n; if (n) { suckMesh.instanceMatrix.needsUpdate = true; suckMesh.instanceColor.needsUpdate = true; }
  }

  // ---------- drop ----------
  let serial = 0, drops = 0, shieldBumps = 0, edgeBumps = 0, buildingBumps = 0, follows = 0, vanished = 0, busy = 0; const history = [];
  function clearSpot(x, z, dx, dz, ignore = null) {
    const l = Math.hypot(dx, dz); if (l > 1e-6) { dx /= l; dz /= l; }
    const free = (px, pz) => {
      const g = heightAt(px, pz); if (!Number.isFinite(g)) return false;
      if (px < playBox.min.x + R || px > playBox.max.x - R || pz < playBox.min.z + R || pz > playBox.max.z - R) return false;
      indexNear(px, pz, R * 2);
      if (solidAt(px, pz, R * 1.08) || siteAt(px, pz, R * 1.1)) return false;
      for (const o of vacs) if (o !== ignore && o.on && o.phase !== 'vanish' && Math.hypot(o.x - px, o.z - pz) < R * 2.1) return false;
      return true;
    };
    if (free(x, z)) return { x, z };
    if (l > 1e-6) for (let i = 1; i < 30; i++) { const px = x + dx * R * .35 * i, pz = z + dz * R * .35 * i; if (free(px, pz)) return { x: px, z: pz }; }
    for (let ring = 0; ring < 10; ring++) for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + ring * .4, r = R * (.4 + ring * .5), px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (free(px, pz)) return { x: px, z: pz }; }
    return null;
  }
  function nearestBuilding(x, z) {
    let best = null, bd = Infinity;
    for (const e of entries) { if (e.cleared) continue; const b = e.worldBounds, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, d = Math.hypot(cx - x, cz - z); if (d < bd) { bd = d; best = { x: cx, z: cz, d }; } }
    return best;
  }
  function camYaw() { camera.getWorldDirection(tA); return Math.hypot(tA.x, tA.z) > 1e-4 ? Math.atan2(tA.x, tA.z) : 0; }
  // strike({ point, normal, entry, site }) -> true | false (no spot). A wall tap sets it down outside that wall, facing it.
  function strike({ point, normal = null, entry = null, site = null, yaw = null } = {}) {
    if (!point || ![point.x, point.y, point.z].every(Number.isFinite)) return false;
    let v = vacs.find(k => !k.on) || null;
    if (!v) { // all out: the oldest leaves now, the new one takes the next free slot when it is gone
      const old = vacs.filter(k => k.phase === 'roam' || k.phase === 'drop').sort((a, b) => a.born - b.born)[0];
      if (old) { startVanish(old); busy++; }
      v = vacs.reduce((a, k) => k.phase === 'vanish' && (!a || k.t > a.t) ? k : a, null); if (!v) return false;
      endVac(v);
    }
    let ox = 0, oz = 0, face = null;
    if ((entry || site) && normal && Math.hypot(normal.x, normal.z) > .3) { const l = Math.hypot(normal.x, normal.z); ox = normal.x / l; oz = normal.z / l; face = Math.atan2(-ox, -oz); }
    else if (entry || site) { const b = entry ? entry.worldBounds : site.box, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2; ox = point.x - cx; oz = point.z - cz; const l = Math.hypot(ox, oz); if (l < 1e-3) { const y = camYaw(); ox = -Math.sin(y); oz = -Math.cos(y); } else { ox /= l; oz /= l; } face = Math.atan2(-ox, -oz); }
    if (!ox && !oz) { const y = camYaw(); ox = -Math.sin(y); oz = -Math.cos(y); }
    indexNear(point.x, point.z, R * 4);
    const spot = clearSpot(point.x + ox * (entry || site ? R * 1.1 : 0), point.z + oz * (entry || site ? R * 1.1 : 0), entry || site ? ox : 0, entry || site ? oz : 0, v);
    if (!spot) return false;
    const g = heightAt(spot.x, spot.z);
    let th = face;
    if (th === null) { const nb = nearestBuilding(spot.x, spot.z); th = nb && nb.d < R * 14 ? Math.atan2(nb.x - spot.x, nb.z - spot.z) : camYaw(); }
    th = Number.isFinite(yaw) ? yaw : th + rnd(-.25, .25); // yaw: a fixed heading (tests)
    Object.assign(v, { on: true, phase: 'drop', t: 0, x: spot.x, z: spot.z, gy: g, y: g + D * T.dropHeight, vy: 0, th, pitch: 0, roll: 0, mode: 'go', mt: 0, roam: T.roam,
      press: 0, squash: 0, follow: null, ft: 0, side: 1, scrape: 0, turnTo: th, hit: null, lx: spot.x, lz: spot.z, seek: false, id: ++serial, bites: 0, bumps: 0, sucked: 0, shield: 0, born: performance.now() / 1000, spin: 0 });
    v.root.visible = true; drops++; place(v, 0);
    return true;
  }
  function startVanish(v) {
    if (v.phase === 'vanish' || !v.on) return;
    v.phase = 'vanish'; v.t = 0; audio.play('chime');
    for (let i = 0; i < (mobile ? 10 : 18); i++) { const a = rnd(0, TAU), sp = rnd(2, 7) * units; sparks.spawn(v.x + Math.cos(a) * R * .6, v.y + D * rnd(.1, .35), v.z + Math.sin(a) * R * .6, Math.cos(a) * sp, rnd(2, 7) * units, Math.sin(a) * sp, rnd(.9, 1.8) * units, -.4 * units, rnd(.45, .9), 1, .82, .94, 1, 1.4, -1);
    }
  }
  function endVac(v) {
    if (v.on) { vanished++; history.push({ id: v.id, bites: v.bites, bumps: v.bumps, sucked: v.sucked, shield: v.shield }); if (history.length > 12) history.shift(); }
    v.on = false; v.phase = 'off'; v.root.visible = false; if (v.shadow) v.shadow.visible = false; v.follow = null;
  }

  // ---------- driving (mock rules: straight -> bump -> back off -> turn; now and then follow the wall) ----------
  function steer(v, target, rate, dt) { const d = angTo(v.th, target); v.th += Math.sign(d) * Math.min(Math.abs(d), rate * dt); return Math.abs(d); }
  function bump(v, h) {
    v.mode = 'bump'; v.mt = 0; v.bumps++;
    v.hit = { kind: h.kind, e: h.e, site: h.site, cx: h.cx, cz: h.cz };
    if (h.kind === 'building') { buildingBumps++; chew(v, h.cx, h.cz, true); audio.play('bump', 1); }
    else if (h.kind === 'site') {
      shieldBumps++; v.shield++; audio.play('bump', .8);
      const site = h.site, gy = heightAt(h.cx, h.cz), p = tA.set(h.cx, (Number.isFinite(gy) ? gy : v.y) + H * .5, h.cz);
      let n = tC.set(v.x - h.cx, 0, v.z - h.cz); if (n.lengthSq() < 1e-6) n.set(-Math.sin(v.th), 0, -Math.cos(v.th)); n.normalize();
      const near = protectedSet?.nearestSurface?.(tS.set(h.cx, p.y, h.cz), R * 1.5); if (near) { p.copy(near.point); n = tC.copy(near.normal); }
      onShield(p.clone(), n.clone(), false, Math.max(8 * units, R * 1.4));
      for (let i = 0; i < (mobile ? 6 : 10); i++) sparks.spawn(p.x, p.y, p.z, n.x * rnd(3, 8) + rnd(-3, 3), rnd(1, 5), n.z * rnd(3, 8) + rnd(-3, 3), rnd(.3, .6) * units, -.2, rnd(.25, .45), .9, .7, .9, 1, 1.4, -12);
      void site;
    } else { edgeBumps++; audio.play('bump', h.kind === 'vac' ? .9 : .6); }
  }
  function drive(v, dt) {
    const fx = Math.sin(v.th), fz = Math.cos(v.th);
    if (v.mode === 'go') {
      if (v.seek) steer(v, Math.atan2(v.seekX - v.x, v.seekZ - v.z), T.seek, dt);
      const nx = v.x + fx * SPEED * dt, nz = v.z + fz * SPEED * dt, h = hitTest(v, nx, nz);
      if (h) bump(v, h); else { v.x = nx; v.z = nz; }
    } else if (v.mode === 'bump') {
      v.mt += dt; const shield = v.hit?.kind === 'site', back = shield ? .5 : .32;
      v.press = v.mt < .16 ? -.03 * Math.sin(Math.min(1, v.mt / .08) * Math.PI / 2) : -.03 * Math.max(0, 1 - (v.mt - .16) / .1);
      if (v.mt > .1 && v.mt < back) { const bx = v.x - fx * SPEED * (shield ? .8 : .45) * dt, bz = v.z - fz * SPEED * (shield ? .8 : .45) * dt; if (!hitTest(v, bx, bz)) { v.x = bx; v.z = bz; } }
      if (v.mt >= back) {
        v.press = 0; const h = v.hit;
        if (h.kind === 'building' && h.e && !h.e.cleared && Math.random() < T.followChance) { v.mode = 'follow'; v.follow = h.e; v.ft = rnd(T.followTime[0], T.followTime[1]); v.side = Math.random() < .5 ? 1 : -1; v.scrape = 0; follows++; }
        else if ((h.kind === 'edge' || h.kind === 'slope') && Math.random() < .5) { const nb = nearestBuilding(v.x, v.z); v.mode = 'turn'; v.turnTo = nb ? Math.atan2(nb.x - v.x, nb.z - v.z) + rnd(-.55, .55) : v.th + Math.PI; }
        else { v.mode = 'turn'; v.turnTo = v.th + (Math.random() < .5 ? 1 : -1) * (shield ? rnd(2.2, 3.4) : rnd(1.6, 3.5)); }
      }
    } else if (v.mode === 'turn') {
      if (steer(v, v.turnTo, T.turn, dt) < .02) v.mode = 'go';
    } else if (v.mode === 'follow') {
      const e = v.follow, c = e && !e.cleared ? solidAt(v.x, v.z, R * 1.9, null, e) : null;
      if (!c) { v.mode = 'turn'; v.turnTo = v.th + v.side * 1.1; v.follow = null; return; }
      const cx = c.cx, cz = c.cz, cd = c.d || 1e-3, nx = (v.x - cx) / cd, nz = (v.z - cz) / cd;
      const want = R + .7 * units, tx = nz * v.side, tz = -nx * v.side, k = (want - cd) / R * 2.2;
      const diff = steer(v, Math.atan2(tx + nx * k, tz + nz * k), 5, dt);
      if (diff < .6) {
        const mx = v.x + Math.sin(v.th) * SPEED * .85 * dt, mz = v.z + Math.cos(v.th) * SPEED * .85 * dt, h = hitTest(v, mx, mz, e), cc = solidAt(mx, mz, R - .08 * units, null, e);
        if (h) { bump(v, h); v.follow = null; return; }
        if (!cc) { v.x = mx; v.z = mz; }
      }
      v.scrape += dt; if (v.scrape > T.scrapeEvery) { v.scrape = 0; chew(v, cx, cz, false); }
      v.ft -= dt; if (v.ft <= 0) { v.mode = 'turn'; v.turnTo = v.th + v.side * 1.3; v.follow = null; }
    }
  }

  // ---------- pose: terrain height + tilt from four samples, bumper, brush, LiDAR ----------
  const upV = new V3(), fwdV = new V3(), rightV = new V3(), basis = new THREE.Matrix4();
  function ground(x, z, fb) { const h = heightAt(x, z); return Number.isFinite(h) ? h : fb; }
  function place(v, dt) {
    const fx = Math.sin(v.th), fz = Math.cos(v.th), s = R * .7;
    const g0 = ground(v.x, v.z, v.gy), gf = ground(v.x + fx * s, v.z + fz * s, g0), gb = ground(v.x - fx * s, v.z - fz * s, g0), gr = ground(v.x + fz * s, v.z - fx * s, g0), gl = ground(v.x - fz * s, v.z + fx * s, g0);
    const target = Math.max(g0, (gf + gb + gr + gl) / 4), pitch = Math.atan2(gf - gb, s * 2), roll = Math.atan2(gr - gl, s * 2), k = dt > 0 ? 1 - Math.exp(-dt * 14) : 1;
    v.gy = target;
    if (v.phase !== 'drop') { v.y += (target - v.y) * k; if (Math.abs(target - v.y) > D * .3) v.y = target; }
    v.pitch += (pitch - v.pitch) * k; v.roll += (roll - v.roll) * k;
    // orientation: yaw, then the ground plane's tilt
    fwdV.set(fx, Math.tan(v.pitch), fz).normalize(); rightV.set(fz, Math.tan(v.roll), -fx); upV.crossVectors(fwdV, rightV).normalize(); if (upV.y < 0) upV.negate();
    rightV.crossVectors(upV, fwdV).normalize(); fwdV.crossVectors(rightV, upV).normalize();
    basis.makeBasis(rightV, upV, fwdV); v.root.quaternion.setFromRotationMatrix(basis);
    v.root.position.set(v.x, v.y, v.z);
    let sx = 1, sy = 1;
    if (v.squash > 0) { sx = 1 + v.squash * .08; sy = 1 - v.squash * .25; }
    let k2 = 1; if (v.phase === 'vanish') k2 = Math.max(.001, 1 - v.t / T.vanish);
    v.body.scale.set(D * sx * k2, D * sy * k2, D * sx * k2); v.body.rotation.y = v.spin;
    v.bumper.position.z = v.press;
    if (v.shadow) { const above = Math.max(0, v.y - v.gy), f = clamp(1 - above / (D * 2.6), .15, 1); v.shadow.visible = true; v.shadow.userData.place(v.x, v.z, D * 1.16 * (.6 + .4 * f) * k2, .06); v.shadow.material.opacity = .42 * f * (v.phase === 'vanish' ? k2 : 1); }
  }

  // ---------- per frame ----------
  function step(v, dt, now) {
    v.t += dt;
    if (v.phase === 'drop') {
      v.vy -= D * T.gravity * dt; v.y += v.vy * dt; place(v, dt);
      if (v.y <= v.gy) {
        const speed = -v.vy; v.y = v.gy; v.vy = 0; v.phase = 'roam'; v.t = 0; v.squash = 1; audio.play('land', Math.min(1.2, speed / (D * 2.2)));
        onKick('land');
        const k = reducedMotion ? .6 : 1;
        for (let i = 0, m = Math.round((mobile ? 16 : 28) * k); i < m; i++) { const a = i / m * TAU + rnd(-.1, .1), sp = rnd(6, 14) * units; dust.spawn(v.x + Math.cos(a) * R * 1.02, v.gy + rnd(.2, 1.2) * units, v.z + Math.sin(a) * R * 1.02, Math.cos(a) * sp, rnd(.4, 2) * units, Math.sin(a) * sp, rnd(1.8, 3.2) * units, 2.4 * units, rnd(1.1, 1.9), .7, .8, .76, .68, 2.2, .4); }
      }
      return;
    }
    if (v.phase === 'roam') {
      v.roam -= dt;
      indexNear(v.x, v.z, R * 3 + SPEED * .5);
      v.lx = v.x; v.lz = v.z; drive(v, dt);
      if (dustOn && (v.x !== v.lx || v.z !== v.lz)) wipe(v);
      if (v.roam <= 0) { v.mode = 'go'; v.follow = null; startVanish(v); }
    } else if (v.phase === 'vanish') {
      v.spin += dt * 14 * (1 + v.t * 3);
      if (v.t >= T.vanish) {
        for (let i = 0; i < (mobile ? 8 : 14); i++) { const a = rnd(0, TAU), sp = rnd(1, 4) * units; sparks.spawn(v.x, v.y + D * .12, v.z, Math.cos(a) * sp, rnd(2, 6) * units, Math.sin(a) * sp, rnd(.8, 1.6) * units, -.5 * units, rnd(.35, .7), 1, .9, .97, 1, 1.6, -1); }
        endVac(v); return;
      }
    }
    v.squash = Math.max(0, v.squash - dt * 5);
    const active = v.phase === 'roam';
    v.brush.rotation.y += (active ? 15 : 4) * dt; v.laser.rotation.y += 7 * dt;
    if (active && !mobile && Math.random() < dt * 6) { const a = v.th + rnd(-.6, .6); dust.spawn(v.x + Math.sin(a) * R * .9, v.y + .3 * units, v.z + Math.cos(a) * R * .9, 0, rnd(.2, .8) * units, 0, rnd(.8, 1.4) * units, .8 * units, rnd(.5, .9), .25, .78, .74, .68, 2, .2); }
    place(v, dt);
  }
  let roaming = 0;
  function update(simDt, realDt, now = performance.now() / 1000) {
    const dt = Math.max(0, Math.min(.05, Number.isFinite(simDt) ? simDt : 0));
    roaming = 0;
    for (const v of vacs) if (v.on) { step(v, dt, now); if (v.on && v.phase === 'roam') roaming++; }
    audio.motor(roaming);
    scanClock -= dt; if (scanClock <= 0 && dt > 0) { scanClock = mobile ? T.scanEveryPhone : T.scanEvery; scanRubble(now); }
    flush(); updateSucks(dt);
    for (const p of patches) if (p.dirty) { p.dirty = false; p.tex.needsUpdate = true; }
    dust.points.material.uniforms.uScale.value = sparks.points.material.uniforms.uScale.value = (globalThis.innerHeight || 800) * pixelRatio() / (2 * Math.tan(camera.fov * Math.PI / 360));
    dust.update(dt); sparks.update(Math.max(dt, Math.min(.05, realDt || 0)));
  }
  function clear() {
    for (const v of vacs) { v.on = false; v.phase = 'off'; v.root.visible = false; if (v.shadow) v.shadow.visible = false; v.follow = null; }
    for (const s of sucks) s.on = false; suckMesh.count = 0; dust.clear(); sparks.clear(); audio.motor(0); audio.stop();
    for (const p of patches) { p.on = false; p.mesh.visible = false; p.born = -1e9; }
    agg.count = 0; agg.weight = 0; agg.affected.length = 0; agg.cleared.length = 0; aggFeedback = false;
    // walls are re-read from the reset buildings next time
    grid.clear(); items.length = 0; indexed.clear();
  }
  const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  return {
    strike, update, clear, soil,
    get live() { return vacs.filter(v => v.on).length; },
    get animating() { return vacs.some(v => v.on) || dust.count > 0 || sparks.count > 0 || suckMesh.count > 0 || patches.some(p => p.dirty); },
    get stats() {
      return { drops, live: vacs.filter(v => v.on).length, diameter: +D.toFixed(2), bandHeight: +H.toFixed(2), speed: +SPEED.toFixed(2),
        buildings: { medianShort: +median(entries.map(e => Math.min(e.w, e.d))).toFixed(1), medianLong: +median(entries.map(e => Math.max(e.w, e.d))).toFixed(1) },
        bites, bitePieces, bumps: { building: buildingBumps, shield: shieldBumps, edge: edgeBumps }, follows, sucked, swirled, held, vanished, busy,
        dust: { on: dustOn, patches: patches.filter(p => p.on).length, soiled, wiped: +patches.reduce((s, p) => s + p.wiped, 0).toFixed(1) },
        wallItems: items.length, indexedBuildings: indexed.size, motor: audio.motorOn, voices: audio.voices,
        vacs: vacs.filter(v => v.on).map(v => ({ id: v.id, phase: v.phase, mode: v.mode, t: +v.t.toFixed(2), roam: +v.roam.toFixed(2), x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(2), th: +v.th.toFixed(2), pitch: +v.pitch.toFixed(3), roll: +v.roll.toFixed(3), bites: v.bites, bumps: v.bumps, sucked: v.sucked, shield: v.shield })),
        particles: { dust: dust.count, sparks: sparks.count, swirl: suckMesh.count }, last: history.at(-1) || null };
    },
    dispose() { clear(); for (const v of vacs) { scene.remove(v.root); if (v.shadow) scene.remove(v.shadow); } for (const p of patches) scene.remove(p.mesh); scene.remove(dust.points, sparks.points, suckMesh); for (const o of owned) o.dispose?.(); },
  };
}
