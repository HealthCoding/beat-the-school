// Models for the wrecking-ball crane (src/wrecking-ball.js): the crawler crane in the world and the crane remote held in
// hand. Same conventions as src/heavy-weapon-models.js: low-poly primitives baked into one mesh per (parent, finish) with
// per-part vertex colours (a little darker toward each part's bottom = cheap ambient occlusion, slight brightness spread),
// metalness always 0 (the game has no environment map), no text or logos. Textures are generated in plain JS (DataTexture),
// so the module also builds in Node (검증/game-check.mjs runs main.js without a DOM canvas).
//
// Crane (world units, 0.5 per metre, cartoon scale like the mock): +z is the front (boom side), +y up, the origin is the
// ground under the slewing ring. `house` turns on the lower carriage; the boom itself is drawn by the weapon module as an
// instanced lattice from `foot` (house space) to the boom tip.
// Remote (held): -z away from the player, +y up out of the face, origin at the middle of the body; `frame` = anchor on the
// screen in half extents and size factor (heavy weapons: x .63, y -.76, s .6).

export function createBaker(THREE, own = o => o) {
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  const FINISH = { paint: .62, dark: .78, rubber: .94, steel: .46, glass: .16, worn: .7 };
  const mats = {};
  for (const f in FINISH) mats[f] = own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: FINISH[f], metalness: 0 }));
  const bakes = new Map();
  let seed = 20261019;
  const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  // Adds one primitive (consumed) under `parent` with colour `hex` and finish.
  function add(parent, geo, hex, finish = 'paint', pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1], opt = {}) {
    const flat = geo.index ? geo.toNonIndexed() : geo; if (flat !== geo) geo.dispose();
    flat.deleteAttribute('uv'); if (!flat.attributes.normal) flat.computeVertexNormals();
    dummy.position.fromArray(pos); dummy.rotation.set(rot[0], rot[1], rot[2]); dummy.scale.fromArray(scl); dummy.updateMatrix();
    flat.applyMatrix4(dummy.matrix);
    const q = flat.attributes.position, n = q.count, c = new Float32Array(n * 3), ao = opt.ao ?? .18;
    col.set(hex).multiplyScalar(1 + (opt.vary ?? .04) * (rand() * 2 - 1));
    let y0 = Infinity, y1 = -Infinity; for (let i = 0; i < n; i++) { const y = q.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const span = y1 - y0;
    for (let i = 0; i < n; i++) { const k = span > 1e-4 ? 1 - ao * (1 - (q.getY(i) - y0) / span) : 1; c[i * 3] = col.r * k; c[i * 3 + 1] = col.g * k; c[i * 3 + 2] = col.b * k; }
    flat.setAttribute('color', new THREE.BufferAttribute(c, 3));
    if (!bakes.has(parent)) bakes.set(parent, new Map());
    const byFinish = bakes.get(parent); if (!byFinish.has(finish)) byFinish.set(finish, []);
    byFinish.get(finish).push(flat);
  }
  function bake(custom = {}, { castShadow = false, fog = true } = {}) {
    for (const [parent, byFinish] of bakes) for (const [finish, list] of byFinish) {
      let total = 0; for (const g of list) total += g.attributes.position.count;
      const p = new Float32Array(total * 3), nn = new Float32Array(total * 3), c = new Float32Array(total * 3); let at = 0;
      for (const g of list) { p.set(g.attributes.position.array, at); nn.set(g.attributes.normal.array, at); c.set(g.attributes.color.array, at); at += g.attributes.position.count * 3; g.dispose(); }
      const geo = own(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nn, 3)); geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
      geo.computeBoundingSphere();
      const m = custom[finish] || mats[finish]; if (!fog) m.fog = false;
      const mesh = new THREE.Mesh(geo, m); mesh.name = `wreck-${finish}`; mesh.castShadow = castShadow; parent.add(mesh);
    }
    bakes.clear();
  }
  // primitives (fresh, consumed by add)
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const Y = (r, h, seg = 12, r2 = r) => new THREE.CylinderGeometry(r, r2, h, seg);
  const X = (r, len, seg = 12) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2);
  const Z = (r, len, seg = 12) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);
  const S = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
  // rounded box (extruded rounded rectangle in x-z, height along y, chamfered top and bottom edges)
  function rbox(w, h, d, r, bev = 0) {
    const s = new THREE.Shape(), x = w / 2 - bev, z = d / 2 - bev, rr = Math.min(r, x, z);
    s.moveTo(-x + rr, -z); s.lineTo(x - rr, -z); s.quadraticCurveTo(x, -z, x, -z + rr); s.lineTo(x, z - rr); s.quadraticCurveTo(x, z, x - rr, z);
    s.lineTo(-x + rr, z); s.quadraticCurveTo(-x, z, -x, z - rr); s.lineTo(-x, -z + rr); s.quadraticCurveTo(-x, -z, -x + rr, -z);
    const depth = h - 2 * bev;
    return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 3 }).rotateX(-Math.PI / 2).translate(0, -depth / 2, 0);
  }
  // tube between two points (house-space struts, rails)
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), qq = new THREE.Quaternion(), ee = new THREE.Euler();
  function strut(parent, a, b, r, hex, finish = 'dark', seg = 8) {
    v1.fromArray(a); v2.fromArray(b); const len = v1.distanceTo(v2); const g = Y(r, len, seg);
    qq.setFromUnitVectors(up, v2.clone().sub(v1).normalize()); ee.setFromQuaternion(qq);
    add(parent, g, hex, finish, [(v1.x + v2.x) / 2, (v1.y + v2.y) / 2, (v1.z + v2.z) / 2], [ee.x, ee.y, ee.z], [1, 1, 1], { ao: 0 });
  }
  return { add, bake, mats, B, Y, X, Z, S, rbox, strut };
}

// plain-JS textures
export function dataTexture(THREE, w, h, fn, own = o => o, srgb = true) {
  const d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, c = fn(x / w, y / h, x, y); d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3] ?? 255; }
  const t = own(new THREE.DataTexture(d, w, h, THREE.RGBAFormat)); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}
// value noise for the textures (deterministic)
function noise2(seed) {
  const h = (x, y) => { let n = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
  const s = t => t * t * (3 - 2 * t);
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = s(x - xi), yf = s(y - yi); const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
}

// ---------- crawler crane ----------
export function buildCrane(THREE, own = o => o) {
  const K = createBaker(THREE, own), { add, B, Y, X, Z, rbox, strut } = K;
  const YEL = '#f2b51e', YEL_D = '#c98e12', DARK = '#2c2e31', DARK2 = '#3b3e42', STEEL = '#8e979d', TRACK = '#2f3134', GLASS = '#2b3c48';
  const root = new THREE.Group(); root.name = 'wrecking-crane';
  const lower = new THREE.Group(); root.add(lower);
  // tracks: side frames, idler / sprocket ends, top and bottom shoes, rollers along the side
  for (const s of [-1, 1]) {
    const x = s * 2.65;
    add(lower, B(1.5, 1.05, 8.4), DARK2, 'dark', [x, .78, 0]);
    add(lower, B(1.55, .16, 8.2), YEL_D, 'paint', [x, 1.38, 0]);                     // painted track frame top
    for (const z of [-4.2, 4.2]) add(lower, X(.78, 1.86, 16), TRACK, 'rubber', [x, .78, z]);
    for (const z of [-4.2, 4.2]) add(lower, X(.36, 1.9, 10), STEEL, 'steel', [x, .78, z], [0, 0, 0], [1, 1, 1], { ao: 0 });
    for (let i = 0; i < 6; i++) add(lower, X(.22, .12, 10), STEEL, 'steel', [x + s * .8, .55, -2.9 + i * 1.16], [0, 0, 0], [1, 1, 1], { ao: 0 });
  }
  add(lower, B(3.8, .9, 4.6), DARK2, 'dark', [0, 1.25, 0]);                          // carbody
  add(lower, B(1.4, .5, 6.6), DARK2, 'dark', [0, 1.05, 0]);                          // cross members
  add(lower, Y(2.1, .42, 28), DARK, 'dark', [0, 1.9, 0]);                            // slewing ring
  add(lower, Y(2.16, .1, 28), YEL_D, 'paint', [0, 2.1, 0], [0, 0, 0], [1, 1, 1], { ao: 0 });
  K.bake({}, { castShadow: false });
  // track belts: shoe plates as a scrolling texture on the top / bottom / ends (the weapon moves the offset while it drives)
  const beltTex = dataTexture(THREE, 16, 64, (u, v, x, y) => { const k = y % 16; return k < 2 ? [22, 23, 25] : k < 4 ? [70, 72, 76] : k < 12 ? [48, 50, 54] : [36, 38, 41]; }, own);
  beltTex.repeat.set(1, 7); beltTex.magFilter = THREE.NearestFilter;
  // one texture per side (round 3): the belts run against each other while the crane pivots on the spot
  const sideMat = own(new THREE.MeshStandardMaterial({ color: '#34363a', roughness: .85, metalness: 0 }));
  const beltGeo = own(new THREE.BoxGeometry(1.92, 1.62, 8.6)), beltTexes = [beltTex, own(beltTex.clone())];
  const belts = [-1, 1].map((s, i) => { const bm = own(new THREE.MeshStandardMaterial({ map: beltTexes[i], roughness: .92, metalness: 0 })), m = new THREE.Mesh(beltGeo, [sideMat, sideMat, bm, bm, bm, bm]); m.position.set(s * 2.65, .81, 0); lower.add(m); return m; });

  const house = new THREE.Group(); house.position.y = 2.15; root.add(house);
  // deck, machinery housing, roof walk, side doors
  add(house, rbox(5.4, .32, 7.2, .3), YEL_D, 'paint', [0, .16, -.4]);
  add(house, rbox(4.9, 2.35, 5.4, .22, .08), YEL, 'paint', [.15, 1.5, -1.0]);
  add(house, B(4.6, .08, 5.0), '#d9a21a', 'paint', [.15, 2.71, -1.0]);
  for (const s of [-1, 1]) for (const z of [-2.6, -1.2, .2]) add(house, B(.05, 1.6, 1.1), YEL_D, 'paint', [.15 + s * 2.46, 1.45, z], [0, 0, 0], [1, 1, 1], { ao: .3 }); // door panels
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) add(house, B(.06, .06, .7), DARK, 'dark', [.15 + s * 2.47, 2.15 - i * .09, -2.4], [0, 0, 0], [1, 1, 1], { ao: 0 }); // louvres
  // counterweight slab (hazard face is a separate textured mesh) + stacked plates
  add(house, rbox(5.6, 2.3, 1.5, .25, .06), '#e9ab18', 'paint', [0, 1.45, -4.35]);
  for (let i = 0; i < 3; i++) add(house, B(5.64, .05, 1.54), YEL_D, 'paint', [0, .68 + i * .72, -4.35], [0, 0, 0], [1, 1, 1], { ao: 0 });
  // cab (front left): frame, glass, roof visor, wiper, step
  add(house, rbox(2.05, 2.5, 2.5, .18, .05), YEL, 'paint', [-1.7, 1.55, 2.25]);
  add(house, B(1.72, 1.15, .06), GLASS, 'glass', [-1.7, 2.0, 3.51]);
  add(house, B(.06, 1.1, 1.9), GLASS, 'glass', [-2.73, 2.0, 2.3]);
  add(house, B(.06, 1.1, 1.9), GLASS, 'glass', [-.67, 2.0, 2.3]);
  add(house, B(2.2, .1, 2.8), DARK2, 'dark', [-1.7, 2.86, 2.35]);
  add(house, B(.05, .7, .05), DARK, 'dark', [-1.4, 1.95, 3.56], [0, 0, .5]);
  add(house, B(.8, .1, .5), DARK, 'dark', [-1.7, .4, 3.65]);
  // engine hood with exhaust and air intake on the right
  add(house, rbox(1.7, .6, 2.6, .12, .04), YEL_D, 'paint', [1.55, 3.0, -2.1]);
  add(house, Y(.13, 1.3, 10), DARK, 'dark', [2.05, 3.65, -2.75]);
  add(house, Y(.17, .14, 10), DARK2, 'dark', [2.05, 4.3, -2.75]);
  add(house, B(.6, .5, .9), DARK2, 'dark', [1.2, 3.1, -.6]);
  // winch drums under the boom foot
  for (const z of [.9, 1.9]) { add(house, X(.55, 2.2, 18), DARK, 'dark', [.6, 1.1, z]); add(house, X(.6, .1, 18), YEL_D, 'paint', [-.55, 1.1, z]); add(house, X(.6, .1, 18), YEL_D, 'paint', [1.75, 1.1, z]); }
  // boom foot brackets
  for (const s of [-1, 1]) add(house, B(.3, 1.1, 1.2), YEL_D, 'paint', [s * 1.05, 1.95, 3.0]);
  add(house, X(.2, 2.5, 10), STEEL, 'steel', [0, 2.15, 3.05], [0, 0, 0], [1, 1, 1], { ao: 0 });
  // gantry (A-frame) and its sheave
  for (const s of [-1, 1]) { strut(house, [s * 1.5, 2.6, -3.4], [s * .55, 6.6, -1.9], .13, DARK2); strut(house, [s * 1.5, 2.6, -.2], [s * .55, 6.6, -1.9], .11, DARK2); }
  add(house, X(.16, 1.5, 10), DARK, 'dark', [0, 6.6, -1.9]);
  add(house, X(.34, .25, 14), STEEL, 'steel', [0, 6.75, -1.9]);
  // hand rails on the roof walk + beacon base
  for (const s of [-1, 1]) { strut(house, [.15 + s * 2.3, 2.75, -3.3], [.15 + s * 2.3, 3.3, -3.3], .03, YEL_D, 'paint', 6); strut(house, [.15 + s * 2.3, 2.75, 1.2], [.15 + s * 2.3, 3.3, 1.2], .03, YEL_D, 'paint', 6); strut(house, [.15 + s * 2.3, 3.3, -3.3], [.15 + s * 2.3, 3.3, 1.2], .03, YEL_D, 'paint', 6); }
  add(house, Y(.14, .12, 10), DARK, 'dark', [-1.7, 2.96, 1.4]);
  K.bake({}, { castShadow: false });

  // hazard stripes on the counterweight's back face (a textured quad, slightly proud of the slab)
  const hazardTex = dataTexture(THREE, 128, 32, (u, v, x, y) => (((x + y * 1.4) / 18 | 0) % 2 ? [32, 30, 28] : [252, 196, 34]), own);
  hazardTex.minFilter = THREE.LinearFilter; hazardTex.generateMipmaps = false;
  const hazard = new THREE.Mesh(own(new THREE.PlaneGeometry(5.2, 1.4)), own(new THREE.MeshStandardMaterial({ map: hazardTex, roughness: .7, metalness: 0 })));
  hazard.position.set(0, 1.45, -5.12); hazard.rotation.y = Math.PI; house.add(hazard);
  // amber beacon (look only: the weapon blinks its colour while the crane works)
  const beaconMat = own(new THREE.MeshBasicMaterial({ color: '#7a4a10' }));
  const beacon = new THREE.Mesh(own(new THREE.SphereGeometry(.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), beaconMat); beacon.position.set(-1.7, 3.02, 1.4); house.add(beacon);

  return {
    root, lower, house, beaconMat, belts, beltTex, beltTexes,
    foot: new THREE.Vector3(0, 2.15, 3.05),     // boom foot pin (house space)
    gantry: new THREE.Vector3(0, 6.75, -1.9),   // pendant anchor (house space)
    drum: new THREE.Vector3(.6, 1.7, 1.9),       // hoist rope leaves the drum here
    tag: new THREE.Vector3(1.9, 1.3, 2.6),       // tag line anchor (house space, front right)
    exhaust: new THREE.Vector3(2.05, 4.4, -2.75),
    trackHalf: [3.5, 5], // half width, half length of the tracks
  };
}

// A second crane sharing the geometry (round 3: the parked crane drives off while a new one drives in at a far spot).
// Own belt textures (they scroll on their own) and an unlit beacon; the boom is drawn by the weapon module.
export function cloneCrane(THREE, C, own = o => o) {
  const root = C.root.clone(true), lower = root.children[C.root.children.indexOf(C.lower)], house = root.children[C.root.children.indexOf(C.house)];
  const beltTexes = C.beltTexes.map(t => { const c = own(t.clone()); c.needsUpdate = true; return c; });
  const belts = C.belts.map((b, i) => { const m = lower.children[C.lower.children.indexOf(b)], bm = own(m.material[2].clone()); bm.map = beltTexes[i]; m.material = m.material.map((x, j) => j >= 2 ? bm : x); return m; });
  return { root, lower, house, belts, beltTexes, foot: C.foot, gantry: C.gantry, drum: C.drum, exhaust: C.exhaust };
}

// ---------- the crane remote (held) ----------
export function buildRemote(THREE, own = o => o) {
  const K = createBaker(THREE, own), { add, B, Y, X, Z, S, rbox } = K;
  const g = new THREE.Group(); g.name = 'crane-remote';
  const body = new THREE.Group(); g.add(body);
  const YEL = '#f3b61f', YEL_D = '#cf9314', DARK = '#26282b', RUB = '#1d1e20', GREY = '#5e666c';
  // housing: rounded yellow shell, dark face plate, rubber bumpers on the four corners, grip ribs underneath
  add(body, rbox(1.3, .34, .86, .16, .05), YEL, 'paint', [0, 0, 0]);
  add(body, rbox(1.14, .04, .7, .1), DARK, 'dark', [0, .185, 0], [0, 0, 0], [1, 1, 1], { ao: 0 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(body, rbox(.26, .38, .24, .1, .03), RUB, 'rubber', [sx * .56, 0, sz * .34]);
  for (let i = 0; i < 5; i++) add(body, B(.9, .04, .05), YEL_D, 'paint', [0, -.18, -.24 + i * .12], [0, 0, 0], [1, 1, 1], { ao: 0 });
  // belt loops on the sides
  for (const sx of [-1, 1]) add(body, new THREE.TorusGeometry(.09, .022, 6, 14), GREY, 'steel', [sx * .68, .06, 0], [0, Math.PI / 2, 0]);
  // E-stop: yellow collar + red mushroom (top centre, far edge)
  add(body, Y(.13, .05, 18), YEL, 'paint', [0, .22, -.2]);
  add(body, Y(.085, .06, 16), DARK, 'dark', [0, .26, -.2]);
  // three toggles + guard (near edge)
  for (let i = -1; i <= 1; i++) { add(body, Y(.04, .03, 10), GREY, 'steel', [i * .14, .215, .25]); add(body, Y(.014, .09, 6), '#c9ced1', 'steel', [i * .14, .26, .25], [-.45, 0, 0]); }
  add(body, B(.5, .05, .03), YEL_D, 'paint', [0, .23, .31]);
  // joystick boots
  for (const sx of [-1, 1]) add(body, Y(.075, .08, 14, .13), RUB, 'rubber', [sx * .34, .23, .02]);
  // antenna (back right corner) with a thick base
  add(body, Y(.05, .09, 10), DARK, 'dark', [.5, .2, -.36]);
  add(body, Y(.022, .62, 8, .03), RUB, 'rubber', [.55, .52, -.4], [-.22, 0, -.14]);
  add(body, S(.032, 8, 6), RUB, 'rubber', [.62, .82, -.47]);
  K.bake({}, { fog: false });
  for (const m of body.children) m.material.fog = false;
  // moving parts
  const stickMat = own(new THREE.MeshStandardMaterial({ color: '#222426', roughness: .7, metalness: 0, fog: false }));
  const knobMat = own(new THREE.MeshStandardMaterial({ color: '#161718', roughness: .55, metalness: 0, fog: false }));
  const stickGeo = own(new THREE.CylinderGeometry(.022, .026, .2, 10).translate(0, .1, 0)), knobGeo = own(new THREE.SphereGeometry(.05, 14, 10));
  const sticks = [-1, 1].map(sx => { const s = new THREE.Group(); s.position.set(sx * .34, .25, .02); const rod = new THREE.Mesh(stickGeo, stickMat); const k = new THREE.Mesh(knobGeo, knobMat); k.position.y = .21; k.scale.set(1, .85, 1); s.add(rod, k); body.add(s); return s; });
  const redMat = own(new THREE.MeshStandardMaterial({ color: '#d42a1e', roughness: .38, metalness: 0, fog: false }));
  const button = new THREE.Mesh(own(new THREE.SphereGeometry(.1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), redMat); button.position.set(0, .285, -.2); button.scale.y = .55; body.add(button);
  const lcdMat = own(new THREE.MeshBasicMaterial({ color: '#6fd27a', fog: false, toneMapped: false }));
  const lcd = new THREE.Mesh(own(new THREE.PlaneGeometry(.26, .1)), lcdMat); lcd.rotation.x = -Math.PI / 2; lcd.position.set(-.2, .209, -.2); body.add(lcd);
  const ledMat = own(new THREE.MeshBasicMaterial({ color: '#3a5a2a', fog: false, toneMapped: false }));
  const led = new THREE.Mesh(own(new THREE.SphereGeometry(.026, 10, 6)), ledMat); led.position.set(.22, .215, -.2); body.add(led);
  return { g, body, sticks, button, lcdMat, ledMat, frame: { x: .64, y: -.74, s: .44 }, frameTall: { x: .44, y: -.79, s: .47 } };
}
