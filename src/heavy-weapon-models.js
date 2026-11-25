// Held viewmodels of the three heavy weapons (round 2, 2026-10-18; detail pass round 3 the same day). Same conventions as
// the shotgun asset (assets/weapons/shotgun/model.gltf): -z is the barrel, +y up, the origin sits at the firing hand and one
// unit is the shotgun's unit (shotgun: 3.1 long, 0.62 tall), so src/heavy-weapons.js can frame all four guns with the same
// formula. Low-poly pieces are baked into one mesh per (parent, finish) with per-part vertex colours; only parts that move
// (minigun barrel cluster, bazooka rocket, pilot light) are separate groups. Metalness is always 0: the game has no
// environment map, so steel is a grey with a lower roughness. No brand names, logos or text.
// Detail is painted into the vertex colours while baking: chamfer/bevel faces of bevelled pieces get a lighter worn tint,
// every part is a little darker toward its own bottom (cheap ambient occlusion) and parts vary slightly in brightness.
// The game sees each gun from behind-left-above (the gun sits right of the lens), so the rear faces, the left side and the
// top carry most of the small parts.
// `frame` = anchor on screen in half-extents (shotgun: x .63, y -.76) and size factor (shotgun .73).

export function buildHeavyWeaponModels(THREE, own = o => o) {
  const dummy = new THREE.Object3D(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), e3 = new THREE.Vector3(), col = new THREE.Color(), tmp = new THREE.Color(), wearCol = new THREE.Color('#d6d0c0');
  const FINISH = { // roughness per surface kind
    paint: .78, steel: .46, dark: .62, rubber: .92, brass: .4, gloss: .3,
  };
  const mats = {};
  const mat = (finish, extra = {}) => own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: FINISH[finish] ?? .7, metalness: 0, fog: false, ...extra, metalness: 0 }));
  for (const f in FINISH) mats[f] = mat(f);
  const bakes = new Map();
  let seed = 20261018, aoDefault = .16;
  const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  // Adds one primitive (consumed) to the bake list of `parent` with colour `hex` and finish.
  // opt.wear: lighter tint on faces whose normal leans on two axes (chamfers, bevels); default .22 for bevelled pieces.
  // opt.ao: darkening toward the bottom of this part; opt.vary: random brightness spread between parts.
  function add(parent, geo, hex, finish = 'paint', pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1], opt = {}) {
    const edge = !!geo.userData.edge;
    const flat = geo.index ? geo.toNonIndexed() : geo; if (flat !== geo) geo.dispose();
    if (!flat.attributes.normal) flat.computeVertexNormals();
    const q = flat.attributes.position, nr = flat.attributes.normal, n = q.count, c = new Float32Array(n * 3);
    const wear = opt.wear ?? (edge ? .15 : 0), ao = opt.ao ?? aoDefault, narrow = geo.userData.wearWidth ?? Infinity;
    col.set(hex).multiplyScalar(1 + (opt.vary ?? .045) * (rand() * 2 - 1));
    for (let i = 0; i < n; i += 3) {
      tmp.copy(col);
      if (wear && (Math.abs(nr.getX(i)) > .25) + (Math.abs(nr.getY(i)) > .25) + (Math.abs(nr.getZ(i)) > .25) >= 2) {
        // only thin strips (bevels) wear, not broad chamfer faces: triangle height over its longest edge
        e1.fromBufferAttribute(q, i); e2.fromBufferAttribute(q, i + 1); e3.fromBufferAttribute(q, i + 2);
        const la = e1.distanceTo(e2), lb = e2.distanceTo(e3), lc = e3.distanceTo(e1), sp = (la + lb + lc) / 2;
        const area = Math.sqrt(Math.max(0, sp * (sp - la) * (sp - lb) * (sp - lc)));
        if (2 * area / Math.max(la, lb, lc, 1e-6) <= narrow) tmp.lerp(wearCol, wear);
      }
      for (let k = 0; k < 3 && i + k < n; k++) tmp.toArray(c, (i + k) * 3);
    }
    dummy.position.fromArray(pos); dummy.rotation.set(rot[0], rot[1], rot[2]); dummy.scale.fromArray(scl); dummy.updateMatrix();
    flat.applyMatrix4(dummy.matrix);
    if (ao) {
      let y0 = Infinity, y1 = -Infinity; for (let i = 0; i < n; i++) { const y = q.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const span = y1 - y0;
      if (span > 1e-4) for (let i = 0; i < n; i++) { const k = 1 - ao * (1 - (q.getY(i) - y0) / span); c[i * 3] *= k; c[i * 3 + 1] *= k; c[i * 3 + 2] *= k; }
    }
    flat.setAttribute('color', new THREE.BufferAttribute(c, 3));
    if (!bakes.has(parent)) bakes.set(parent, new Map());
    const byFinish = bakes.get(parent); if (!byFinish.has(finish)) byFinish.set(finish, []);
    byFinish.get(finish).push(flat);
  }
  function bake(customMats = {}) {
    for (const [parent, byFinish] of bakes) for (const [finish, list] of byFinish) {
      let total = 0; for (const g of list) total += g.attributes.position.count;
      const p = new Float32Array(total * 3), n = new Float32Array(total * 3), c = new Float32Array(total * 3); let at = 0;
      for (const g of list) { p.set(g.attributes.position.array, at); n.set(g.attributes.normal.array, at); c.set(g.attributes.color.array, at); at += g.attributes.position.count * 3; g.dispose(); }
      const geo = own(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(n, 3)); geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, customMats[finish] || mats[finish]); m.frustumCulled = false; m.name = `heavy-${finish}`; parent.add(m);
    }
    bakes.clear();
  }
  const tint = (hex, k) => '#' + new THREE.Color(hex).lerp(new THREE.Color(k > 0 ? '#ffffff' : '#000000'), Math.abs(k)).getHexString();
  // primitives (all fresh, consumed by add)
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  // cylinder along z: rFront at -z, rBack at +z
  const Z = (rFront, rBack, len, seg = 14) => new THREE.CylinderGeometry(rBack, rFront, len, seg).rotateX(Math.PI / 2);
  // open tube along z (bands on a tube: the end caps would be hidden)
  const Zo = (r, len, seg = 16) => new THREE.CylinderGeometry(r, r, len, seg, 1, true).rotateX(Math.PI / 2);
  // dome (half sphere) facing +z (dir 1) or -z (dir -1)
  const dome = (r, dir, w = 18, h = 5) => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(dir * Math.PI / 2);
  const X = (r, len, seg = 10) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2);
  const Y = (r, len, seg = 10) => new THREE.CylinderGeometry(r, r, len, seg);
  const S = (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);
  // chamfered rectangle prism along z (w x h cross-section, top corner cut c, bottom corner cut cb), optional bevel on
  // every edge (also the front and back faces); outer size stays w x h x len
  function prism(w, h, len, c, cb = c, bev = 0) {
    const s = new THREE.Shape(), x = w / 2 - bev, y = h / 2 - bev, ct = Math.max(0, c - bev * .6), cbt = Math.max(0, cb - bev * .6);
    s.moveTo(-x + cbt, -y); s.lineTo(x - cbt, -y); if (cbt) s.lineTo(x, -y + cbt); s.lineTo(x, y - ct); if (ct) s.lineTo(x - ct, y);
    s.lineTo(-x + ct, y); if (ct) s.lineTo(-x, y - ct); if (cbt) s.lineTo(-x, -y + cbt);
    const depth = len - 2 * bev, geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 2 }).translate(0, 0, -depth / 2);
    geo.userData.edge = bev > 0; geo.userData.wearWidth = bev * 2.2; return geo;
  }
  const rbox = (w, h, d, bev = .008) => prism(w, h, d, 0, 0, bev);
  // ring sector shell along z (heat shield), angles from +x counter-clockwise
  function shell(rIn, rOut, a0, a1, len) {
    const s = new THREE.Shape(); s.absarc(0, 0, rOut, a0, a1, false); s.absarc(0, 0, rIn, a1, a0, true);
    return new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: 14 }).translate(0, 0, -len / 2);
  }
  // revolved profile [[r, y], ...], y running toward -z (noses, ogives)
  const lathe = (pts, seg = 18) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg).rotateX(-Math.PI / 2);
  // half ring (handle / trigger guard) in the y-z plane, opening downward
  const arc = (r, t, a = Math.PI) => new THREE.TorusGeometry(r, t, 6, 16, a).rotateY(Math.PI / 2);
  const tube = (pts, r, seg = 24) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q))), seg, r, 8, false);
  // corrugated hose: rings alternate between full and groove radius; hard-edged ribs with exact cone normals
  function ribTube(pts, r, segs = 44, radial = 10, groove = .2) {
    const curve = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q))), fr = curve.computeFrenetFrames(segs, false);
    const P = [], R = [], pos = [], nor = [], v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], nn = v.map(() => new THREE.Vector3());
    for (let i = 0; i <= segs; i++) { P.push(curve.getPointAt(i / segs)); R.push(r * (i % 2 && i < segs ? 1 - groove : 1)); }
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3(), T = new THREE.Vector3();
    const corner = (i, j, slope, out, nOut) => {
      const a = j / radial * Math.PI * 2; nOut.copy(fr.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(fr.binormals[i], Math.sin(a));
      out.copy(P[i]).addScaledVector(nOut, R[i]); nOut.addScaledVector(T, -slope).normalize();
    };
    for (let i = 0; i < segs; i++) {
      const L = P[i].distanceTo(P[i + 1]) || 1e-4, slope = (R[i + 1] - R[i]) / L; T.copy(P[i + 1]).sub(P[i]).normalize();
      for (let j = 0; j < radial; j++) {
        corner(i, j, slope, v[0], nn[0]); corner(i + 1, j, slope, v[1], nn[1]); corner(i + 1, j + 1, slope, v[2], nn[2]); corner(i, j + 1, slope, v[3], nn[3]);
        for (const [a, b, d] of [[0, 1, 2], [0, 2, 3]]) {
          fn.crossVectors(e1.subVectors(v[b], v[a]), e2.subVectors(v[d], v[a]));
          const order = fn.dot(nn[a]) >= 0 ? [a, b, d] : [a, d, b];
          for (const k of order) { pos.push(v[k].x, v[k].y, v[k].z); nor.push(nn[k].x, nn[k].y, nn[k].z); }
        }
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return geo;
  }
  // cylinder along z with chamfered ends (three pieces; the chamfers take a lighter worn tint)
  function zch(parent, r, len, ch, hex, finish, pos, seg = 18, edgeHex = tint(hex, .07)) {
    add(parent, Z(r - ch, r, ch, seg), edgeHex, finish, [pos[0], pos[1], pos[2] - len / 2 + ch / 2]);
    add(parent, Z(r, r, len - 2 * ch, seg), hex, finish, pos);
    add(parent, Z(r, r - ch, ch, seg), edgeHex, finish, [pos[0], pos[1], pos[2] + len / 2 - ch / 2]);
  }
  // hex screw head; its axis is +y rotated by `rot`
  const bolt = (parent, pos, rot = [0, 0, 0], r = .012, hex = '#9aa4aa', finish = 'steel') => add(parent, new THREE.CylinderGeometry(r, r * 1.08, r * .75, 6), hex, finish, pos, rot, [1, 1, 1], { ao: 0 });
  const ALONG_X = [0, 0, Math.PI / 2], ALONG_Z = [Math.PI / 2, 0, 0];
  // pistol grip from a side profile (finger grooves at the front, flared heel, short beavertail), bevelled all round,
  // with raised horizontal ribs on the left side (the side the camera sees). `pos` = middle of the top edge; `rake` swings the bottom backward (+z).
  function grip(parent, hex, pos, rake = .3, h = .28, w = .1, d = .13) {
    const k = Math.tan(rake), pts = []; // shape +x = toward the muzzle; y < 0 goes down, lower points move back by y * k
    for (let i = 0; i <= 9; i++) { const t = i / 9, y = -t * h; pts.push([d / 2 + y * k + (t > .14 && t < .9 ? .012 * Math.abs(Math.sin((t - .14) / .76 * Math.PI * 3)) : 0), y]); }
    pts.push([-d / 2 + -h * k - .014, -h]);
    for (let i = 8; i >= 0; i--) { const t = i / 9, y = -t * h; pts.push([-d / 2 + y * k - (t < .22 ? (.22 - t) * .14 : 0), y]); }
    const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    const bev = .012, geo = new THREE.ExtrudeGeometry(s, { depth: w - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: .008, bevelSegments: 1, curveSegments: 1 });
    geo.translate(0, 0, -(w - 2 * bev) / 2).rotateY(Math.PI / 2); geo.userData.wearWidth = .022;
    add(parent, geo, hex, 'rubber', pos, [0, 0, 0], [1, 1, 1], { wear: .07 });
    for (let i = 0; i < 6; i++) {
      const t = .3 + i * .1, y = -t * h;
      add(parent, B(.004, .009, d * .6), tint(hex, .035), 'rubber', [pos[0] - (w / 2 + .0015), pos[1] + y, pos[2] - y * k], [0, 0, 0], [1, 1, 1], { ao: 0 });
    }
  }
  function trigger(parent, pos, bladeHex = '#15191b', bladeFinish = 'dark') {
    add(parent, arc(.075, .011), '#20262a', 'dark', [pos[0], pos[1] + .02, pos[2]], [Math.PI, 0, 0]);
    add(parent, rbox(.022, .07, .024, .006), bladeHex, bladeFinish, [pos[0], pos[1] + .005, pos[2] - .005], [-.25, 0, 0]);
  }
  function starFlash(size, color = '#ffd27a') {
    const pos = []; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, b = (i + 1) * Math.PI / 5, r = i % 2 ? .05 : .2, s = (i + 1) % 2 ? .05 : .2; pos.push(0, 0, -.25, Math.cos(a) * r, Math.sin(a) * r, 0, Math.cos(b) * s, Math.sin(b) * s, 0); }
    const g = own(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.Mesh(g, own(new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false, fog: false, transparent: true, depthWrite: false })));
    m.scale.setScalar(size); m.visible = false; m.renderOrder = 10; m.frustumCulled = false; m.userData.until = 0; return m;
  }
  const C = { gun: '#3b4348', gunHi: '#58636a', gunDark: '#242a2e', recess: '#111416', bore: '#070809', steel: '#7d888f', steelHi: '#a3adb3', rubber: '#1b1e20',
    olive: '#4f5a31', oliveB: '#48532d', oliveDark: '#3a4223', oliveHi: '#66733c', brass: '#c4923a', brassDark: '#94692a', copper: '#b36a3a', red: '#b8412f', redDark: '#8a2e22',
    yellow: '#d9b843', lens: '#5f93ad', glass: '#86c8e4', strap: '#2f3429', link: '#3b4044', dial: '#ebe5d3' };

  const VM = {};
  { // ---------------- minigun (rotary, six barrels) ----------------
    const g = new THREE.Group(); g.name = 'minigun-view';
    // receiver: bevelled housing, rear plate with four bolts and a centre boss, slotted top rail
    add(g, prism(.36, .34, .9, .07, .04, .014), C.gun, 'steel', [0, 0, .05]);
    add(g, prism(.38, .36, .05, .08, .05, .01), C.gunDark, 'dark', [0, 0, .52]);
    for (const x of [-.14, .14]) for (const y of [-.125, .125]) bolt(g, [x, y, .549], ALONG_Z, .014);
    add(g, rbox(.17, .11, .014, .004), C.gun, 'steel', [0, -.03, .552]); for (const x of [-.065, .065]) bolt(g, [x, -.03, .561], ALONG_Z, .009);
    add(g, rbox(.2, .022, .8, .004), C.gun, 'steel', [0, .175, .05]);
    for (let i = 0; i < 12; i++) add(g, B(.204, .006, .014), C.gunDark, 'dark', [0, .184, -.3 + i * .062], [0, 0, 0], [1, 1, 1], { ao: 0 });
    // left side (faces the middle of the screen): louvred vents, panel seams, screws; right side: ejection port + cover hinge
    for (let i = 0; i < 3; i++) { const z = -.33 + i * .075; add(g, B(.01, .045, .05), C.recess, 'dark', [-.181, .04, z]); add(g, B(.018, .008, .056), C.gunHi, 'steel', [-.187, .066, z], [0, 0, -.5]); }
    for (const z of [-.08, .24]) add(g, B(.006, .1, .006), C.recess, 'dark', [-.182, .035, z], [0, 0, 0], [1, 1, 1], { ao: 0 });
    for (const z of [-.37, .08, .44]) bolt(g, [-.183, .07, z], ALONG_X, .011);
    add(g, B(.01, .07, .16), C.recess, 'dark', [.181, .02, -.1]); add(g, B(.014, .012, .17), C.gunHi, 'steel', [.184, .062, -.1]);
    // drive motor: finned can, tapered nose, end cap with four screws, cable into the rear plate, bevelled mount
    add(g, Z(.085, .085, .36, 18), C.gunDark, 'dark', [-.14, .19, .02]);
    for (let i = 0; i < 5; i++) add(g, Z(.095, .095, .014, 14), C.gun, 'steel', [-.14, .19, -.12 + i * .052]);
    add(g, Z(.058, .085, .05, 18), C.gunDark, 'dark', [-.14, .19, -.185]);
    zch(g, .09, .045, .01, C.gunHi, 'steel', [-.14, .19, .215], 18);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; bolt(g, [-.14 + Math.cos(a) * .06, .19 + Math.sin(a) * .06, .241], ALONG_Z, .009); }
    add(g, rbox(.08, .05, .2), C.gunDark, 'dark', [-.11, .13, .02]);
    add(g, tube([[-.14, .15, .235], [-.13, .11, .34], [-.1, .075, .44], [-.08, .06, .5]], .012, 14), C.rubber, 'rubber');
    // carry handle: arc on bevelled feet, ribbed rubber grip
    add(g, arc(.16, .022), C.gunDark, 'dark', [.04, .18, -.02]);
    for (const z of [-.18, .14]) add(g, rbox(.06, .03, .06, .006), C.gunDark, 'dark', [.04, .19, z]);
    add(g, Z(.034, .034, .13, 14), C.rubber, 'rubber', [.04, .338, -.02]);
    for (let i = 0; i < 3; i++) add(g, Zo(.037, .01, 14), tint(C.rubber, .08), 'rubber', [.04, .338, -.05 + i * .05]);
    // front bearing housing with a split-clamp lug and bolt, rear flange
    zch(g, .2, .14, .016, C.gunDark, 'dark', [0, 0, -.46], 22);
    zch(g, .212, .03, .006, C.gunHi, 'steel', [0, 0, -.39], 22);
    add(g, rbox(.05, .05, .08, .006), C.gunDark, 'dark', [-.152, .152, -.46], [0, 0, Math.PI / 4]);
    bolt(g, [-.172, .172, -.46], [0, 0, Math.PI / 4], .014);
    // heat shield over the top of the barrel cluster: vented half shell with rolled edges
    const a0 = Math.PI / 2 - 1, a1 = Math.PI / 2 + 1;
    add(g, shell(.188, .2, a0, a1, .52), C.gun, 'steel', [0, 0, -.79]);
    for (const a of [a0, a1]) add(g, Z(.008, .008, .52, 6), C.gunHi, 'steel', [Math.cos(a) * .194, Math.sin(a) * .194, -.79]);
    for (let r = 0; r < 4; r++) for (const da of [-.55, 0, .55]) { const a = Math.PI / 2 + da; add(g, B(.008, .028, .07), C.recess, 'dark', [Math.cos(a) * .2, Math.sin(a) * .2, -.62 - r * .11], [0, 0, a], [1, 1, 1], { ao: 0 }); }
    // grips: rear pistol grip on a block + trigger, front vertical grip on a bevelled mount
    add(g, rbox(.11, .04, .14), C.gunDark, 'dark', [0, -.185, .3]);
    grip(g, C.rubber, [0, -.2, .3], .3, .27); trigger(g, [0, -.2, .17]);
    add(g, rbox(.12, .06, .2, .01), C.gunDark, 'dark', [0, -.19, -.28]); grip(g, C.rubber, [0, -.215, -.28], .06, .24);
    // ammo box on the left: bevelled can, lid, end bands, pressed rib, folding handle, rear latch and a blank plate
    add(g, rbox(.32, .3, .46, .014), C.olive, 'paint', [-.37, -.19, .14]);
    add(g, rbox(.34, .045, .48, .01), C.oliveDark, 'paint', [-.37, -.025, .14]);
    for (const z of [-.04, .32]) add(g, rbox(.336, .286, .026, .006), C.oliveDark, 'paint', [-.37, -.19, z]);
    add(g, rbox(.012, .02, .3, .004), C.oliveHi, 'paint', [-.533, -.25, .14]);
    add(g, arc(.06, .008), C.gunDark, 'dark', [-.543, -.1, .14], [Math.PI, 0, 0]);
    for (const z of [.08, .2]) add(g, rbox(.014, .024, .018, .004), C.gunDark, 'dark', [-.537, -.1, z]);
    add(g, B(.006, .028, .36), C.yellow, 'paint', [-.533, -.3, .14]);
    add(g, rbox(.07, .05, .014, .004), C.gunDark, 'dark', [-.37, -.075, .377]); add(g, X(.008, .08, 8), C.steel, 'steel', [-.37, -.05, .382]);
    add(g, B(.13, .07, .004), C.oliveHi, 'paint', [-.37, -.2, .372]);
    for (const x of [-.425, -.315]) for (const y of [-.17, -.23]) add(g, S(.006, 6, 4), C.oliveHi, 'paint', [x, y, .373], [0, 0, 0], [1, 1, .6]);
    // flexible feed chute: bevelled links with joint rings along a curve, belt of linked rounds feeding into it
    {
      const p0 = new THREE.Vector3(-.33, 0, .12), p1 = new THREE.Vector3(-.36, .16, .02), p2 = new THREE.Vector3(-.19, .07, -.12), a = new THREE.Vector3(), b = new THREE.Vector3();
      const at = (t, out) => out.set(0, 0, 0).addScaledVector(p0, (1 - t) ** 2).addScaledVector(p1, 2 * t * (1 - t)).addScaledVector(p2, t * t);
      const N = 8;
      for (let i = 0; i < N; i++) {
        const t = i / N; at(t, a); at(t + 1 / N, b);
        dummy.position.copy(a).lerp(b, .5); dummy.lookAt(b); const pos = dummy.position.toArray(), rot = [dummy.rotation.x, dummy.rotation.y, dummy.rotation.z];
        add(g, rbox(.14, .046, a.distanceTo(b) * .98, .008), i % 2 ? C.gunDark : C.gun, 'dark', pos, rot);
        dummy.position.copy(a); dummy.lookAt(b); add(g, rbox(.152, .058, .014, .004), C.gun, 'steel', dummy.position.toArray(), [dummy.rotation.x, dummy.rotation.y, dummy.rotation.z]);
      }
      for (let i = 0; i < 5; i++) {
        const y = .016, z = .15 + i * .04;
        add(g, X(.0155, .085, 8), C.brass, 'brass', [-.385, y, z]);
        add(g, new THREE.CylinderGeometry(.004, .0145, .032, 8).rotateZ(Math.PI / 2), C.copper, 'brass', [-.443, y, z]);
        for (const x of [-.405, -.362]) add(g, new THREE.CylinderGeometry(.0185, .0185, .016, 8, 1, true).rotateZ(Math.PI / 2), C.link, 'dark', [x, y, z]);
      }
    }
    bake();
    // rotating barrel cluster (no baked bottom shading: it turns)
    aoDefault = 0;
    const spin = new THREE.Group(); spin.position.z = -.54; g.add(spin);
    zch(spin, .17, .2, .016, C.gunDark, 'dark', [0, 0, -.06], 18);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; add(spin, rbox(.04, .03, .2, .006), C.gunHi, 'steel', [Math.cos(a) * .17, Math.sin(a) * .17, -.06], [0, 0, a]); }
    add(spin, Z(.045, .045, 1.36, 12), C.recess, 'dark', [0, 0, -.84]);
    for (const [z, r] of [[-.72, .155], [-1.4, .148]]) zch(spin, r, .07, .012, C.gun, 'steel', [0, 0, z], 18);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; bolt(spin, [Math.cos(a) * .122, Math.sin(a) * .122, -.72 + .038], ALONG_Z, .011); }
    zch(spin, .14, .03, .006, C.gunDark, 'dark', [0, 0, -1.5], 18);
    const hotMat = own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .42, metalness: 0, fog: false, emissive: '#000000' }));
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, x = Math.cos(a) * .105, y = Math.sin(a) * .105;
      add(spin, Z(.029, .031, 1.4, 12), C.steel, 'hot', [x, y, -.85]);
      add(spin, Z(.031, .034, .03, 10), '#8d979d', 'steel', [x, y, -1.555]);   // muzzle crown
      add(spin, new THREE.CircleGeometry(.016, 8).rotateY(Math.PI), C.bore, 'dark', [x, y, -1.5705]); // dark bore on the crown face
    }
    bake({ hot: hotMat });
    aoDefault = .16;
    const flash = starFlash(1.35); flash.position.set(0, 0, -2.12); g.add(flash);
    VM.minigun = { g, spin, hot: hotMat, flash, muzzle: new THREE.Vector3(0, 0, -2.12), eject: new THREE.Vector3(.19, .02, -.1),
      steam: [0, .12, -1.2], frame: { x: .62, y: -.76, s: .64 } };
  }
  { // ---------------- flamethrower ----------------
    const g = new THREE.Group(); g.name = 'flamethrower-view';
    // valve body / receiver: bevelled, top strip, seams and screws on the left
    add(g, prism(.17, .21, .56, .045, .03, .01), C.gun, 'steel', [0, 0, .06]);
    add(g, rbox(.12, .03, .5, .006), C.gunHi, 'steel', [0, .115, .06]);
    for (const z of [-.1, .22]) add(g, B(.006, .12, .006), C.recess, 'dark', [-.086, -.01, z], [0, 0, 0], [1, 1, 1], { ao: 0 });
    for (const y of [.035, -.055]) for (const z of [-.17, .3]) bolt(g, [-.087, y, z], ALONG_X, .009);
    add(g, prism(.176, .216, .03, .048, .033, .008), C.gunDark, 'dark', [0, 0, .35]);
    for (const x of [-.052, .052]) for (const y of [-.07, .055]) bolt(g, [x, y, .367], ALONG_Z, .009);
    for (let i = 0; i < 3; i++) add(g, B(.08, .008, .004), C.recess, 'dark', [0, -.005 + i * .02, .366], [0, 0, 0], [1, 1, 1], { ao: 0 });
    // red valve handwheel on the left (stem, rim, three spokes, hub)
    add(g, X(.011, .045, 8), C.steel, 'steel', [-.105, .045, -.08]);
    add(g, new THREE.TorusGeometry(.038, .008, 6, 18).rotateY(Math.PI / 2), C.red, 'gloss', [-.13, .045, -.08]);
    for (let k = 0; k < 3; k++) add(g, B(.006, .072, .007), C.red, 'gloss', [-.13, .045, -.08], [k * Math.PI / 3, 0, 0]);
    add(g, X(.014, .02, 10), C.redDark, 'gloss', [-.132, .045, -.08]);
    zch(g, .075, .08, .012, C.gunDark, 'dark', [0, .01, -.24], 16);
    // barrel, vented heat shroud with groove rings, bevelled end caps (the rear one screwed down)
    add(g, Z(.045, .045, 1.45, 14), C.steel, 'steel', [0, .01, -.92]);
    add(g, Z(.085, .085, .96, 20), C.gun, 'steel', [0, .01, -.84]);
    for (let i = 0; i < 7; i++) add(g, Zo(.088, .022, 18), C.gunDark, 'dark', [0, .01, -.43 - i * .12]);
    for (let i = 0; i < 6; i++) for (const a of [1.3, 1.9, 2.5]) add(g, B(.008, .02, .055), C.recess, 'dark', [Math.cos(a) * .086, .01 + Math.sin(a) * .086, -.49 - i * .12], [0, 0, a], [1, 1, 1], { ao: 0 });
    for (const z of [-.35, -1.33]) zch(g, .097, .045, .01, C.gunHi, 'steel', [0, .01, z], 20);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; bolt(g, [Math.cos(a) * .084, .01 + Math.sin(a) * .084, -.325], ALONG_Z, .008); }
    // nozzle with vent slots, rolled lip and a dark bore
    add(g, Z(.078, .052, .2, 18), C.gunDark, 'dark', [0, .01, -1.72]);
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; add(g, B(.008, .018, .05), C.recess, 'dark', [Math.cos(a) * .065, .01 + Math.sin(a) * .065, -1.71], [0, 0, a], [1, 1, 1], { ao: 0 }); }
    add(g, new THREE.TorusGeometry(.074, .012, 6, 18), C.steelHi, 'steel', [0, .01, -1.82]);
    add(g, Z(.064, .064, .01, 18), C.bore, 'dark', [0, .01, -1.818]);
    // igniter: wire clipped along the shroud, bevelled housing, white insulator, steel tip and electrode at the pilot light
    add(g, Z(.007, .007, 1.25, 6), C.redDark, 'gloss', [0, -.077, -1.05]);
    for (const z of [-.55, -.91, -1.27]) add(g, rbox(.03, .016, .02, .004), C.gunDark, 'dark', [0, -.08, z]);
    add(g, rbox(.036, .07, .06, .006), C.gunDark, 'dark', [0, -.07, -1.7]);
    add(g, Z(.017, .017, .06, 12), '#e6e1d4', 'gloss', [0, -.105, -1.7]);
    add(g, Z(.011, .014, .05, 10), C.steel, 'steel', [0, -.105, -1.755]);
    add(g, Z(.004, .004, .025, 6), C.steelHi, 'steel', [0, -.105, -1.79]);
    // grips: clamp collar with a screwed lug + front grip, rear pistol grip with a red trigger
    zch(g, .1, .07, .012, C.gunDark, 'dark', [0, .01, -.6], 18);
    add(g, rbox(.035, .03, .05, .005), C.gunDark, 'dark', [-.1, .06, -.6], [0, 0, -.6]); bolt(g, [-.114, .074, -.6], [0, 0, .97], .009);
    grip(g, C.rubber, [0, -.085, -.6], .05, .22);
    grip(g, C.rubber, [0, -.1, .24], .3, .26); trigger(g, [0, -.14, .12], C.red, 'gloss');
    // fuel tank (big, red): weld seams at the domes, webbing straps with steel buckles, bevelled mounts, filler cap, outlet
    add(g, Z(.13, .13, .62, 24), C.red, 'gloss', [-.27, -.13, .3]);
    for (const z of [-.01, .61]) { add(g, dome(.13, z > 0 ? 1 : -1, 22, 6), C.red, 'gloss', [-.27, -.13, z], [0, 0, 0], [1, 1, .55]); add(g, Zo(.1325, .008, 22), C.redDark, 'gloss', [-.27, -.13, z]); }
    for (const z of [.1, .5]) {
      add(g, Z(.137, .137, .04, 20), C.strap, 'rubber', [-.27, -.13, z]);
      add(g, rbox(.018, .058, .052, .005), C.steel, 'steel', [-.409, -.13, z]); add(g, B(.004, .03, .024), C.recess, 'dark', [-.419, -.13, z]);
      add(g, rbox(.14, .05, .1), C.gunDark, 'dark', [-.15, -.06, z]); bolt(g, [-.12, -.033, z], [0, 0, 0], .01);
    }
    add(g, Y(.022, .02, 12), C.steel, 'steel', [-.32, -.012, .02]); add(g, Y(.032, .022, 6), C.steel, 'steel', [-.32, .006, .02]);
    add(g, Z(.04, .04, .07, 12), C.brass, 'brass', [-.27, -.13, -.07]); add(g, Z(.036, .036, .026, 6), C.brassDark, 'brass', [-.27, -.13, -.112]);
    // corrugated fuel hose from the tank outlet under the gun into a bevelled manifold block
    add(g, ribTube([[-.27, -.13, -.12], [-.27, -.24, -.22], [-.18, -.23, -.36], [-.07, -.12, -.37], [-.022, -.072, -.33]], .022, 36, 8), C.rubber, 'rubber', [0, 0, 0], [0, 0, 0], [1, 1, 1], { ao: .1 });
    add(g, rbox(.06, .05, .08, .006), C.gunDark, 'dark', [0, -.06, -.31]); add(g, Z(.028, .028, .02, 6), C.brassDark, 'brass', [-.035, -.068, -.322], [0, -.6, 0]);
    // propellant bottle (steel) with clamp bands, front valve, rear regulator and a pressure gauge tilted toward the eye
    add(g, Z(.065, .065, .46, 18), C.steel, 'steel', [-.23, .07, .34]);
    for (const z of [.11, .57]) add(g, dome(.065, z > .3 ? 1 : -1, 16, 5), C.steel, 'steel', [-.23, .07, z], [0, 0, 0], [1, 1, .6]);
    for (const z of [.2, .48]) add(g, Z(.069, .069, .02, 18), C.gunDark, 'dark', [-.23, .07, z]);
    add(g, Z(.016, .016, .05, 10), C.brass, 'brass', [-.23, .07, .05]); add(g, new THREE.TorusGeometry(.02, .005, 5, 12), C.brassDark, 'brass', [-.23, .07, .03]);
    add(g, Z(.022, .022, .04, 10), C.brass, 'brass', [-.23, .07, .625]); add(g, rbox(.055, .055, .05, .006), C.brass, 'brass', [-.23, .07, .665]);
    add(g, X(.016, .03, 10), C.gunDark, 'dark', [-.27, .07, .665]);
    {
      const G = [-.23, .118, .672], R = [.9, 0, 0];
      add(g, Y(.041, .024, 18), C.gunDark, 'dark', G, R, [1, 1, 1], { ao: 0 });
      add(g, new THREE.TorusGeometry(.038, .0055, 6, 18).rotateX(Math.PI / 2).translate(0, .012, 0), C.steelHi, 'steel', G, R, [1, 1, 1], { ao: 0 });
      add(g, Y(.033, .004, 18).translate(0, .012, 0), C.dial, 'gloss', G, R, [1, 1, 1], { ao: 0 });
      for (let i = 0; i < 7; i++) { const a = -2.2 + i * 4.4 / 6; add(g, B(.0028, .002, .009).translate(0, .015, -.024).rotateY(a), C.recess, 'dark', G, R, [1, 1, 1], { ao: 0 }); }
      add(g, B(.0032, .002, .026).translate(0, .0165, -.01).rotateY(.7), C.red, 'gloss', G, R, [1, 1, 1], { ao: 0 });
      add(g, Y(.005, .006, 8).translate(0, .016, 0), C.recess, 'dark', G, R, [1, 1, 1], { ao: 0 });
    }
    add(g, tube([[-.255, .06, .685], [-.29, .045, .72], [-.31, .0, .67]], .008, 10), C.rubber, 'rubber');
    bake();
    // pilot light: blue core + orange tongue (flickers), heat glow is drawn by heavy-weapons.js
    const pilot = new THREE.Group(); pilot.position.set(0, -.105, -1.81); g.add(pilot);
    const blue = new THREE.Mesh(own(new THREE.ConeGeometry(.018, .06, 10).rotateX(-Math.PI / 2)), own(new THREE.MeshBasicMaterial({ color: '#79c8ff', toneMapped: false, fog: false })));
    const orange = new THREE.Mesh(own(new THREE.SphereGeometry(.026, 10, 8)), own(new THREE.MeshBasicMaterial({ color: '#ff9b2e', toneMapped: false, fog: false })));
    orange.position.z = -.035; orange.scale.set(.8, .8, 1.6); pilot.add(blue, orange);
    VM.flamethrower = { g, pilot, pilotFlame: orange, muzzle: new THREE.Vector3(0, .01, -1.86), frame: { x: .6, y: -.7, s: .78 } };
  }
  { // ---------------- bazooka ----------------
    const g = new THREE.Group(); g.name = 'bazooka-view';
    // launch tube in two shades, chamfered front collar with rolled lip and a dark bore, riveted bands, warning bands
    add(g, Z(.12, .12, 1.45, 24), C.olive, 'paint', [0, 0, -.775]);
    add(g, Z(.12, .12, 1.45, 24), C.oliveB, 'paint', [0, 0, .675]);
    zch(g, .145, .16, .02, C.oliveDark, 'paint', [0, 0, -1.44], 24);
    add(g, new THREE.TorusGeometry(.134, .016, 6, 22), C.oliveHi, 'paint', [0, 0, -1.52]);
    add(g, Z(.118, .118, .01, 24), C.bore, 'dark', [0, 0, -1.521]);
    for (const z of [-.95, 0, .95]) {
      zch(g, .128, .05, .008, C.oliveDark, 'paint', [0, 0, z], 24);
      for (const a of [1.9, 2.7]) add(g, S(.0075, 6, 3), C.oliveHi, 'paint', [Math.cos(a) * .128, Math.sin(a) * .128, z], [0, 0, 0], [1, 1, 1], { ao: 0 });
    }
    add(g, Z(.124, .124, .06, 24), C.yellow, 'paint', [0, 0, -1.22]);
    for (const z of [-1.253, -1.187]) add(g, Zo(.1245, .006, 22), C.recess, 'dark', [0, 0, z]);
    add(g, Z(.124, .124, .05, 24), C.red, 'paint', [0, 0, 1.2]);
    // rear bell: chamfered base ring, flared bell with four stiffening ribs, rolled worn rim, dark funnel inside
    zch(g, .132, .05, .008, C.oliveDark, 'paint', [0, 0, 1.33], 24);
    add(g, Z(.125, .19, .24, 24), C.oliveDark, 'paint', [0, 0, 1.47]);
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; add(g, B(.014, .016, .25).rotateX(-.265).translate(0, .165, 0), C.olive, 'paint', [0, 0, 1.47], [0, 0, a - Math.PI / 2]); }
    add(g, new THREE.TorusGeometry(.186, .014, 6, 22), C.oliveHi, 'paint', [0, 0, 1.59], [0, 0, 0], [1, 1, 1], { ao: .1 });
    add(g, Z(.176, .176, .006, 24), '#30362a', 'dark', [0, 0, 1.592], [0, 0, 0], [1, 1, 1], { ao: 0 });
    add(g, Z(.125, .125, .006, 20), '#20241c', 'dark', [0, 0, 1.594], [0, 0, 0], [1, 1, 1], { ao: 0 });
    add(g, Z(.075, .075, .006, 16), C.bore, 'dark', [0, 0, 1.596], [0, 0, 0], [1, 1, 1], { ao: 0 });
    // grips, trigger housing with screws, shoulder rest with ribs and two straps
    add(g, rbox(.1, .07, .2, .012), C.oliveDark, 'paint', [0, -.15, -.15]); for (const z of [-.2, -.1]) bolt(g, [-.051, -.15, z], ALONG_X, .009);
    grip(g, C.rubber, [0, -.18, -.12], .3, .25); trigger(g, [0, -.2, -.25]);
    add(g, rbox(.09, .06, .14, .01), C.oliveDark, 'paint', [0, -.15, -.78]); grip(g, C.rubber, [0, -.17, -.78], .08, .22);
    add(g, prism(.13, .11, .46, .02, .03, .012), C.rubber, 'rubber', [0, -.17, .66]); add(g, rbox(.15, .03, .46), C.gunDark, 'dark', [0, -.235, .66]);
    for (let i = 0; i < 6; i++) add(g, B(.006, .06, .012), tint(C.rubber, .04), 'rubber', [-.066, -.17, .47 + i * .075], [0, 0, 0], [1, 1, 1], { ao: 0 });
    for (const z of [.5, .82]) add(g, Z(.128, .128, .03, 20), C.strap, 'rubber', [0, 0, z]);
    // optical sight on the left: bevelled body on a mount, turrets with knurl rings, front hood + lens, rubber eyecup with
    // a dark eye hole and a lens glint (blue glass, white spark)
    add(g, rbox(.07, .05, .2), C.gunDark, 'dark', [-.14, .08, -.36]);
    add(g, prism(.1, .11, .34, .025, .025, .008), C.gunDark, 'dark', [-.22, .12, -.36]);
    add(g, Z(.052, .046, .06, 16), C.gun, 'steel', [-.22, .12, -.555]); add(g, Z(.04, .04, .01, 16), C.lens, 'gloss', [-.22, .12, -.583]);
    add(g, Z(.042, .042, .03, 16), C.rubber, 'rubber', [-.22, .12, -.175]); add(g, Z(.046, .06, .07, 16), C.rubber, 'rubber', [-.22, .12, -.125]);
    add(g, Z(.042, .042, .004, 16), C.bore, 'dark', [-.22, .12, -.0895], [0, 0, 0], [1, 1, 1], { ao: 0 });
    add(g, Z(.025, .025, .002, 14), C.glass, 'gloss', [-.222, .122, -.0865], [0, 0, 0], [1, 1, 1], { ao: 0 });
    add(g, Z(.007, .007, .002, 8), '#eef8ff', 'gloss', [-.231, .132, -.0855], [0, 0, 0], [1, 1, 1], { ao: 0 });
    add(g, Y(.022, .03, 14), C.gun, 'steel', [-.22, .19, -.38]); add(g, Y(.016, .006, 12), C.steelHi, 'steel', [-.22, .207, -.38]);
    for (let k = 0; k < 2; k++) add(g, Y(.024, .005, 14), C.gunDark, 'dark', [-.22, .183 + k * .012, -.38]);
    add(g, X(.022, .03, 14), C.gun, 'steel', [-.285, .12, -.38]); add(g, X(.016, .006, 12), C.steelHi, 'steel', [-.303, .12, -.38]);
    // iron sights: rear peep ring on a post, front post between two guard ears
    add(g, rbox(.05, .022, .05, .004), C.gunDark, 'dark', [0, .128, .3]); add(g, B(.014, .05, .014), C.gunDark, 'dark', [0, .16, .3]);
    add(g, new THREE.TorusGeometry(.022, .006, 6, 16), C.gunDark, 'dark', [0, .2, .3]);
    add(g, rbox(.06, .025, .06, .004), C.gunDark, 'dark', [0, .13, -1.32]); add(g, B(.01, .05, .01), C.gunDark, 'dark', [0, .165, -1.32]);
    for (const x of [-.026, .026]) add(g, B(.008, .055, .022), C.gunDark, 'dark', [x, .165, -1.32]);
    // sling lugs (swivel rings on bevelled bases, lower left), cable from the grip to the tube with a clip
    for (const z of [-1.05, .35]) {
      const a = 3.7;
      add(g, rbox(.03, .024, .04, .004), C.oliveDark, 'paint', [Math.cos(a) * .125, Math.sin(a) * .125, z], [0, 0, a - Math.PI / 2]);
      add(g, new THREE.TorusGeometry(.02, .005, 6, 12).rotateY(Math.PI / 2), C.gunDark, 'dark', [Math.cos(a) * .158, Math.sin(a) * .158, z], [0, 0, a + Math.PI / 2]);
    }
    add(g, tube([[.02, -.2, -.2], [.1, -.14, -.3], [.12, -.03, -.45]], .012, 12), C.rubber, 'rubber');
    add(g, rbox(.03, .024, .034, .004), C.gunDark, 'dark', [.118, -.03, -.45], [0, 0, -.25]);
    bake();
    // loaded rocket at the muzzle (slides in on reload): body, yellow band, dark seam, red ogive nose, standoff ring, brass fuze
    const head = new THREE.Group(); head.position.z = -1.5; g.add(head);
    add(head, Z(.1, .1, .2, 20), C.oliveHi, 'paint', [0, 0, -.06]);
    add(head, Z(.103, .103, .035, 20), C.yellow, 'paint', [0, 0, -.115]);
    add(head, Z(.1015, .1015, .006, 20), C.recess, 'paint', [0, 0, -.157]);
    const nose = []; for (let i = 0; i <= 8; i++) { const t = i / 8; nose.push([.018 + .084 * Math.cos(t * Math.PI / 2) ** .7, t * .34]); }
    add(head, lathe(nose, 16), C.red, 'gloss', [0, 0, -.16]);
    add(head, Z(.104, .104, .014, 20), C.redDark, 'gloss', [0, 0, -.172]);
    add(head, Z(.02, .02, .006, 12), C.brassDark, 'brass', [0, 0, -.5]);
    add(head, Z(.013, .019, .035, 12), C.brass, 'brass', [0, 0, -.515]); add(head, S(.013, 10, 6), C.brass, 'brass', [0, 0, -.533]);
    bake();
    const flash = starFlash(1.7); flash.position.set(0, 0, -1.6); g.add(flash);
    VM.bazooka = { g, head, flash, muzzle: new THREE.Vector3(0, 0, -1.62), back: new THREE.Vector3(0, 0, 1.65), headRest: -1.5, frame: { x: .63, y: -.76, s: .6 } };
  }
  return VM;
}
