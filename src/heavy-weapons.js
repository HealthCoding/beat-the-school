// Three heavy weapons (user decision 2026-10-18; look, feel and numbers from 시안/새무기_시안.html):
//   bazooka      - tap: a rocket flies .32 s and explodes; bounces off a hospital shield.
//   minigun      - hold: 11 shots/s after a short spin-up for as long as it is held (round 5, user 10-18: no overheat stop;
//                  the barrels still glow hotter with use - look only).
//   flamethrower - hold: a cartoon flame stream (round puffs in three layers: hot core, orange body, dark-red edge; capped),
//                  chars the aimed surface, a ring of points around it and points behind it; charred pieces crumble.
// Round 2 (2026-10-18): detailed viewmodels from src/heavy-weapon-models.js framed like the shotgun (shotgun-view.js).
// Round 3 (2026-10-18, "roughly made — more detail"): screen-space tracers, velocity-stretched sparks, pooled bullet-hole /
// scorch decals, tumbling debris chunks, casings that bounce, muzzle glow + light, heat glow; a staged bazooka blast
// (white core -> fireball -> dark smoke column, ground shock ring + dust, light flash on the wall and ground, debris);
// flamethrower burn spots that smoke (and keep burning a little) after the stream leaves, follow-through after a
// punch-through, curling smoke wisps off the flame tips; spring-based recoil and weighty sway.
// Round 4 (2026-10-18): tracers and the flame stream are re-anchored to the barrel tip AFTER the final pose of each frame
// (they used to keep a world point taken before the caller's screen shake, so a 1 px shake at the target - tenths of a unit
// of camera travel - threw the start dozens of px off the gun); the flamethrower is now real-looking fire: a continuous
// noise-scrolled stream strip + shader-shaped flame tongues (see fireSystem / stream), premultiplied additive-ish blending.
// Round 5 (2026-10-18, user: "the minigun still fires from the LEFT of the gun now and then"): a bolt's tail ran past its
// head in the last 7 % of its life (tail share k * 1.5 - .4 > 1). The screen-even depth mapping f = g z0 / (z1 - g (z1 - z0))
// has a pole just above g = 1 (z1 / (z1 - z0), ~1.02-1.06), so the tail flew beyond the target and then BEHIND the camera;
// the GPU clipped that quad at the near plane and its constant-pixel-width extrusion (x clip w) blew up into a ~60 px wedge
// from the target down past the side of the gun to the screen edge - drawn for one frame whenever a frame landed in the
// last ~7 ms of a bolt (frame-time jitter decides, so "now and then"). Now both ends stay on the muzzle -> target segment.
// Also: the muzzle glow sprite is placed after the final pose (it lagged up to 80 px at low frame rates), and bolts are
// dropped when the minigun is put away instead of being drawn from a stale world point.
// This module owns the camera-relative viewmodels (own overlay pass like shotgun-view.js), the world particles, rockets and
// the per-weapon timing. Hit tests and damage stay with the caller (main.js): `probe(x, y)` returns
// { kind: 'building' | 'protected' | 'ground', point, normal, site?, targetId? } or null, and the on* callbacks apply damage.
// Every pool is allocated here once; update() does not allocate.
import { WEAPON_TUNING } from './weapon-tuning.js?v=sn130';
import { buildHeavyWeaponModels } from './heavy-weapon-models.js?v=weapons40';

export const HEAVY_WEAPON_IDS = Object.freeze(['minigun', 'flamethrower', 'bazooka']);
export const HOLD_WEAPON_IDS = Object.freeze(['minigun', 'flamethrower']);

export function createHeavyWeapons(THREE, scene, camera, {
  reducedMotion = false, mobile = false, tuning = WEAPON_TUNING, audio = null, shield = null,
  probe = () => null, onRocket = () => {}, onBullet = () => {}, onScorch = () => {}, onKick = () => {},
} = {}) {
  const V3 = THREE.Vector3, rnd = (a, b) => a + Math.random() * (b - a);
  const TB = tuning.bazooka, TM = tuning.minigun, TF = tuning.flamethrower, TS = tuning.shield;
  const lite = mobile ? .65 : 1; // phones get fewer particles per event
  const owned = [];
  const own = o => (owned.push(o), o);
  const tmpM = new THREE.Matrix4(), tmpS = new V3(), tmpC = new THREE.Color(), tmpC2 = new THREE.Color(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion();
  const tA = new V3(), tB = new V3(), tC = new V3(), tD = new V3(), tE = new V3(), tF = new V3(), tG = new V3(), camPos = new V3(), camQ = new THREE.Quaternion(), QI = new THREE.Quaternion();
  const pA = new V3(), pB = new V3(), pC = new V3(); // pool-update temporaries (never used outside the pools)
  const UP = new V3(0, 1, 0), Z_AXIS = new V3(0, 0, 1), FWD0 = new V3(0, 0, -1);
  const C = hex => new THREE.Color(hex);
  const COL = { flameA: C('#ffb02e'), flameB: C('#ff9a24'), flameEnd: C('#e4471c'), core: C('#fff4b8'), mid: C('#ffc53a'),
    blastCore: C('#fff3c4'), blastEnd: C('#ff6a1a'), smokeW: C('#fbfaf6'), smokeWEnd: C('#c4bfb6'), smokeD: C('#5d5550'), smokeDEnd: C('#b2aba2'),
    puff: C('#f1eee7'), puffEnd: C('#bdb8ae'), spark: C('#ffd27a'), sparkHot: C('#ffe08a'), sparkEnd: C('#ff8a2a'), sparkRed: C('#ff6a1a'),
    blue: C('#bff1ff'), blueEnd: C('#2fc4ff'), paleYellow: C('#fff2a8'), dust: C('#ddd6c8'), dustEnd: C('#bdb5a6'), back: C('#f3f0ea'), backEnd: C('#c9c4bb'),
    ember: C('#ffc457'), emberEnd: C('#ff4a1a'), ash: C('#4a4440'), ashEnd: C('#8d8680'),
    white: C('#ffffff'), fireHot: C('#ffd66b'), fireDark: C('#a8321a'), fireLate: C('#ff7a22'), fireSoot: C('#4a2a20'),
    sootA: C('#2b2725'), sootB: C('#8f8983'), wispA: C('#57514d'), wispB: C('#8e8882'), colA: C('#2c2826'), colB: C('#9b948c'),
    concrete: C('#cfc7b8'), concreteEnd: C('#a9a192'), streak: C('#fff1c2'), streakEnd: C('#ff9a3a'),
    glowF: C('#ffb04a'), glowM: C('#ffd890'), lightF: C('#ff9a3c'), lightM: C('#ffc27a') };
  const DEBRIS_COLORS = ['#8a7f70', '#6f665b', '#a39886', '#5a534c', '#7b6a58', '#c9c0b0', '#3d3834', '#9b8b74'].map(C);
  const pickDebris = () => DEBRIS_COLORS[(Math.random() * DEBRIS_COLORS.length) | 0];
  const WIND = new V3(1.3, 0, .55); // smoke drifts this way (units/s)

  // ---------- textures (pure JS) ----------
  function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function dataTex(size, fn) {
    const d = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = (x + .5) / size * 2 - 1, v = (y + .5) / size * 2 - 1, i = (y * size + x) * 4, [l, a] = fn(u, v, Math.hypot(u, v));
      d[i] = d[i + 1] = d[i + 2] = Math.round(Math.min(1, Math.max(0, l)) * 255); d[i + 3] = Math.round(Math.min(1, Math.max(0, a)) * 255);
    }
    const t = own(new THREE.DataTexture(d, size, size, THREE.RGBAFormat)); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
  }
  // cartoon puff: hard edge, a darker rim at the bottom-right; soft dot for sparks
  const puffTex = dataTex(64, (u, v, r) => [1 - .24 * Math.min(1, Math.max(0, (u - v) * .45 + .25 + r * .3)), Math.min(1, Math.max(0, (1 - r) / .1))]);
  const softTex = dataTex(32, (u, v, r) => [1, Math.max(0, 1 - r) ** 2]);
  // lumpy soft smoke (radially shaded, so it can be rolled per particle without a wrong-way rim)
  const smokeTex = dataTex(64, (u, v, r) => {
    const a = Math.atan2(v, u), e = .8 + .1 * Math.sin(a * 3 + 1.3) + .07 * Math.sin(a * 5 + .4) + .05 * Math.sin(a * 8 + 2.1);
    return [1 - .2 * smoothstep(.15, e, r), Math.min(1, Math.max(0, (e - r) / .3)) ** 1.3];
  });

  // ---------- camera-facing instanced particle pools ----------
  //   roll: each particle has its own slowly spinning angle (no repeated-looking sprites)
  //   curl: sideways swirl acceleration (smoke curls); stretch: quads stretch along the velocity (sparks read as streaks)
  const circleGeo = own(new THREE.CircleGeometry(1, 16)), quadGeo = own(new THREE.PlaneGeometry(2, 2));
  function pool(cap, geo, material, innerMaterial = null, { roll = false, curl = 0, stretch = 0 } = {}) {
    const f = { p: new Float32Array(cap * 3), v: new Float32Array(cap * 3), ca: new Float32Array(cap * 3), cb: new Float32Array(cap * 3), n: new Float32Array(cap * 3),
      age: new Float32Array(cap), life: new Float32Array(cap), s0: new Float32Array(cap), s1: new Float32Array(cap), drag: new Float32Array(cap), grav: new Float32Array(cap),
      stop: new Float32Array(cap), ss: new Float32Array(cap), gp: new Float32Array(cap), rot: new Float32Array(cap), spin: new Float32Array(cap), ph: new Float32Array(cap) };
    const vec = ['p', 'v', 'ca', 'cb', 'n'], one = ['age', 'life', 's0', 's1', 'drag', 'grav', 'stop', 'ss', 'gp', 'rot', 'spin', 'ph'];
    const make = (m, order) => {
      const o = new THREE.InstancedMesh(geo, own(m), cap); o.frustumCulled = false; o.count = 0; o.renderOrder = order;
      o.instanceMatrix.setUsage(THREE.DynamicDrawUsage); o.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); o.instanceColor.setUsage(THREE.DynamicDrawUsage);
      scene.add(o); owned.push({ dispose: () => { o.removeFromParent(); o.dispose(); } }); return o;
    };
    const P = { cap, limit: cap, n: 0, guard: 0, mesh: make(material, 2), inner: innerMaterial ? make(innerMaterial, 3) : null };
    P.add = (px, py, pz, vx, vy, vz, s0, s1, life, ca, cb, drag = 0, grav = 0, stop = Infinity, nrm = null, ss = 0, gp = 1) => {
      if (P.n >= P.limit) return -1;
      if (P.guard) { const dx = px - camPos.x, dy = py - camPos.y, dz = pz - camPos.z; if (dx * dx + dy * dy + dz * dz < P.guard) return -1; }
      const i = P.n++, k = i * 3;
      f.p[k] = px; f.p[k + 1] = py; f.p[k + 2] = pz; f.v[k] = vx; f.v[k + 1] = vy; f.v[k + 2] = vz;
      f.ca[k] = ca.r; f.ca[k + 1] = ca.g; f.ca[k + 2] = ca.b; f.cb[k] = cb.r; f.cb[k + 1] = cb.g; f.cb[k + 2] = cb.b;
      if (nrm) { f.n[k] = nrm.x; f.n[k + 1] = nrm.y; f.n[k + 2] = nrm.z; } else { f.n[k] = 0; f.n[k + 1] = 1; f.n[k + 2] = 0; }
      f.age[i] = 0; f.life[i] = life; f.s0[i] = s0; f.s1[i] = s1; f.drag[i] = drag; f.grav[i] = grav; f.stop[i] = stop; f.ss[i] = ss; f.gp[i] = gp;
      f.rot[i] = Math.random() * 6.283; f.spin[i] = rnd(-.7, .7); f.ph[i] = Math.random() * 6.283;
      return i;
    };
    P.kill = i => { const j = --P.n; if (i === j) return; for (const key of vec) f[key].copyWithin(i * 3, j * 3, j * 3 + 3); for (const key of one) f[key][i] = f[key][j]; };
    P.shorten = left => { for (let i = 0; i < P.n; i++) f.life[i] = Math.min(f.life[i], f.age[i] + left * (.6 + .4 * Math.random())); };
    P.clear = () => { P.n = 0; P.mesh.count = 0; if (P.inner) P.inner.count = 0; };
    P.update = dt => {
      if (dt > 0) for (let i = 0; i < P.n; i++) {
        f.age[i] += dt; if (f.age[i] >= f.life[i]) { P.kill(i); i--; continue; }
        const k = i * 3;
        if (f.stop[i] !== Infinity) {
          f.stop[i] -= Math.hypot(f.v[k], f.v[k + 1], f.v[k + 2]) * dt;
          if (f.stop[i] <= 0) { // splat on the wall: slide sideways along it
            f.stop[i] = Infinity; const nx = f.n[k], ny = f.n[k + 1], nz = f.n[k + 2];
            let tx = rnd(-1, 1), ty = rnd(-.3, 1), tz = rnd(-1, 1); const dd = tx * nx + ty * ny + tz * nz; tx -= nx * dd; ty -= ny * dd; tz -= nz * dd;
            const tl = Math.hypot(tx, ty, tz) || 1, ss = f.ss[i];
            f.v[k] = tx / tl * ss + nx * 1.6; f.v[k + 1] = ty / tl * ss + ny * 1.6 + 1.5; f.v[k + 2] = tz / tl * ss + nz * 1.6; f.drag[i] = 4; f.s1[i] *= 1.25;
          }
        }
        const dr = Math.exp(-f.drag[i] * dt);
        f.v[k] *= dr; f.v[k + 1] = f.v[k + 1] * dr + f.grav[i] * dt; f.v[k + 2] *= dr;
        if (curl) { const a = f.age[i] * 2.4 + f.ph[i]; f.v[k] += Math.cos(a) * curl * dt; f.v[k + 2] += Math.sin(a) * curl * dt; }
        f.p[k] += f.v[k] * dt; f.p[k + 1] += f.v[k + 1] * dt; f.p[k + 2] += f.v[k + 2] * dt;
        f.rot[i] += f.spin[i] * dt;
      }
      const cnt = P.n;
      for (let i = 0; i < cnt; i++) {
        const k = i * 3, t = f.age[i] / f.life[i];
        let s = f.s0[i] + (f.s1[i] - f.s0[i]) * (1 - (1 - t) ** 2.2) ** f.gp[i];
        if (t > .72) s *= Math.max(0, (1 - t) / .28) ** .7;
        pA.set(f.p[k], f.p[k + 1], f.p[k + 2]);
        let done = false;
        if (stretch) {
          const vx = f.v[k], vy = f.v[k + 1], vz = f.v[k + 2], vl = Math.hypot(vx, vy, vz);
          if (vl > .5) {
            pB.set(camPos.x - pA.x, camPos.y - pA.y, camPos.z - pA.z).normalize(); pC.set(vx / vl, vy / vl, vz / vl);
            tmpS.crossVectors(pC, pB); const gl = tmpS.length();
            if (gl > .05) { // side = v x view, along = view x side (motion as seen on screen), stretched by speed
              tmpS.multiplyScalar(s / gl); pC.crossVectors(pB, tmpS).normalize().multiplyScalar(s * (1 + vl * stretch * gl)); pB.multiplyScalar(s);
              P.mesh.setMatrixAt(i, tmpM.makeBasis(tmpS, pC, pB).setPosition(pA)); done = true;
            }
          }
        }
        if (!done) {
          if (roll) { tmpQ.setFromAxisAngle(Z_AXIS, f.rot[i]); tmpQ2.copy(camQ).multiply(tmpQ); P.mesh.setMatrixAt(i, tmpM.compose(pA, tmpQ2, tmpS.set(s, s, s))); }
          else P.mesh.setMatrixAt(i, tmpM.compose(pA, camQ, tmpS.set(s, s, s)));
        }
        tmpC.setRGB(f.ca[k], f.ca[k + 1], f.ca[k + 2]).lerp(tmpC2.setRGB(f.cb[k], f.cb[k + 1], f.cb[k + 2]), Math.min(1, t * 1.25)); P.mesh.setColorAt(i, tmpC);
        if (P.inner) {
          const si = s * .62 * Math.max(0, 1 - t * 1.15); pB.copy(camPos).sub(pA).normalize().multiplyScalar(s * .2); pA.add(pB);
          P.inner.setMatrixAt(i, tmpM.compose(pA, camQ, tmpS.set(si, si, si)));
          tmpC.copy(COL.core).lerp(COL.mid, Math.min(1, t * 1.6)); P.inner.setColorAt(i, tmpC);
        }
      }
      P.mesh.count = cnt; if (cnt) { P.mesh.instanceMatrix.needsUpdate = true; P.mesh.instanceColor.needsUpdate = true; }
      if (P.inner) { P.inner.count = cnt; if (cnt) { P.inner.instanceMatrix.needsUpdate = true; P.inner.instanceColor.needsUpdate = true; } }
    };
    return P;
  }
  const flameMat = () => new THREE.MeshBasicMaterial({ toneMapped: false, depthWrite: false, transparent: true, opacity: .97, fog: false });
  const smoke = pool(mobile ? 160 : 240, quadGeo, new THREE.MeshBasicMaterial({ map: puffTex, transparent: true, opacity: .9, depthWrite: false }));
  // flame smoke: soft, lumpy, see-through (it must not hide the target), rolls and curls
  const soot = pool(mobile ? TF.smokeCapPhone : TF.smokeCap, quadGeo, new THREE.MeshBasicMaterial({ map: smokeTex, transparent: true, opacity: .62, depthWrite: false }), null, { roll: true, curl: 2.4 });
  const blast = pool(mobile ? 120 : 150, circleGeo, flameMat(), flameMat());
  // bazooka smoke column: denser than the flame smoke, same soft lumpy rolled puffs
  const plume = pool(mobile ? 44 : 64, quadGeo, new THREE.MeshBasicMaterial({ map: smokeTex, transparent: true, opacity: .88, depthWrite: false }), null, { roll: true, curl: 1.4 });
  const sparks = pool(mobile ? 180 : 260, quadGeo, new THREE.MeshBasicMaterial({ map: softTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), null, { stretch: .07 });
  smoke.guard = 196; soot.guard = 144; plume.guard = 196; sparks.guard = 16; blast.guard = 25; // never puff right in front of the lens

  // ---------- debris chunks: small lit boxes that tumble, bounce once or twice and shrink away ----------
  const DEB = mobile ? 40 : 64;
  const debMesh = new THREE.InstancedMesh(own(new THREE.BoxGeometry(1, 1, 1)), own(new THREE.MeshLambertMaterial({ color: '#ffffff' })), DEB);
  debMesh.frustumCulled = false; debMesh.count = 0; debMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  debMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(DEB * 3), 3); debMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  scene.add(debMesh); owned.push({ dispose: () => { debMesh.removeFromParent(); debMesh.dispose(); } });
  const dP = new Float32Array(DEB * 3), dV = new Float32Array(DEB * 3), dW = new Float32Array(DEB * 3), dS = new Float32Array(DEB * 3), dQ = new Float32Array(DEB * 4),
    dAge = new Float32Array(DEB), dLife = new Float32Array(DEB), dFloor = new Float32Array(DEB);
  let debN = 0, debColorDirty = false;
  function addDebris(x, y, z, vx, vy, vz, size, life, floor, color) {
    if (debN >= DEB) return; const i = debN++, k = i * 3;
    dP[k] = x; dP[k + 1] = y; dP[k + 2] = z; dV[k] = vx; dV[k + 1] = vy; dV[k + 2] = vz;
    dW[k] = rnd(-14, 14); dW[k + 1] = rnd(-14, 14); dW[k + 2] = rnd(-14, 14);
    dS[k] = size * rnd(.6, 1.3); dS[k + 1] = size * rnd(.35, .9); dS[k + 2] = size * rnd(.6, 1.4);
    tmpQ.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().toArray(dQ, i * 4);
    dAge[i] = 0; dLife[i] = life; dFloor[i] = floor;
    debMesh.instanceColor.setXYZ(i, color.r, color.g, color.b); debColorDirty = true;
  }
  function updateDebris(dt) {
    if (dt > 0) for (let i = 0; i < debN; i++) {
      dAge[i] += dt;
      if (dAge[i] >= dLife[i]) {
        const j = --debN;
        if (i !== j) { dP.copyWithin(i * 3, j * 3, j * 3 + 3); dV.copyWithin(i * 3, j * 3, j * 3 + 3); dW.copyWithin(i * 3, j * 3, j * 3 + 3); dS.copyWithin(i * 3, j * 3, j * 3 + 3); dQ.copyWithin(i * 4, j * 4, j * 4 + 4); dAge[i] = dAge[j]; dLife[i] = dLife[j]; dFloor[i] = dFloor[j];
          debMesh.instanceColor.array.copyWithin(i * 3, j * 3, j * 3 + 3); debColorDirty = true; }
        i--; continue;
      }
      const k = i * 3; dV[k + 1] -= 26 * dt; const dr = Math.exp(-.35 * dt); dV[k] *= dr; dV[k + 2] *= dr;
      dP[k] += dV[k] * dt; dP[k + 1] += dV[k + 1] * dt; dP[k + 2] += dV[k + 2] * dt;
      const half = dS[k + 1] * .5;
      if (dP[k + 1] < dFloor[i] + half && dV[k + 1] < 0) { dP[k + 1] = dFloor[i] + half; dV[k + 1] *= -.3; dV[k] *= .55; dV[k + 2] *= .55; dW[k] *= .5; dW[k + 1] *= .5; dW[k + 2] *= .5; }
      pB.set(dW[k], dW[k + 1], dW[k + 2]); const wl = pB.length();
      if (wl > 1e-3) { tmpQ.fromArray(dQ, i * 4); tmpQ2.setFromAxisAngle(pB.divideScalar(wl), wl * dt); tmpQ.premultiply(tmpQ2).toArray(dQ, i * 4); }
    }
    for (let i = 0; i < debN; i++) {
      const k = i * 3, t = dAge[i] / dLife[i], sh = t > .75 ? (1 - t) / .25 : 1;
      pA.set(dP[k], dP[k + 1], dP[k + 2]); tmpQ.fromArray(dQ, i * 4);
      debMesh.setMatrixAt(i, tmpM.compose(pA, tmpQ, tmpS.set(dS[k] * sh, dS[k + 1] * sh, dS[k + 2] * sh)));
    }
    debMesh.count = debN; if (debN) debMesh.instanceMatrix.needsUpdate = true;
    if (debColorDirty) { debMesh.instanceColor.needsUpdate = true; debColorDirty = false; }
  }

  // ---------- decals: bullet holes (fresh = glowing rim) and blast scorch marks, one instanced draw ----------
  // aDecal = (fade, seed, heat, kind 0 hole / 1 scorch); shape is drawn in the shader so no two look the same.
  const DEC = mobile ? TM.decalsPhone : TM.decals;
  const decGeo = own(new THREE.PlaneGeometry(1, 1)), decAttr = new THREE.InstancedBufferAttribute(new Float32Array(DEC * 4), 4);
  decAttr.setUsage(THREE.DynamicDrawUsage); decGeo.setAttribute('aDecal', decAttr);
  const decMat = own(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    vertexShader: `attribute vec4 aDecal; varying vec2 vUv; varying vec4 vD;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){ vUv = uv; vD = aDecal; vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `varying vec2 vUv; varying vec4 vD;
      #include <logdepthbuf_pars_fragment>
      float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hh(i), hh(i + vec2(1.0, 0.0)), f.x), mix(hh(i + vec2(0.0, 1.0)), hh(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main(){
        #include <logdepthbuf_fragment>
        vec2 q = vUv * 2.0 - 1.0; float r = length(q), a = atan(q.y, q.x), seed = vD.y, scorch = step(0.5, vD.w);
        float wob = 0.5 + 0.5 * sin(a * 5.0 + seed * 6.3) * sin(a * 3.0 - seed * 4.1), jag = 0.5 + 0.5 * sin(a * 11.0 + seed * 17.0);
        float blot = vn(q * 3.5 + seed * 11.0);
        float edge = mix(0.5 + 0.28 * wob, 0.55 + 0.2 * wob + 0.1 * jag + 0.15 * blot, scorch);
        float soot = 1.0 - smoothstep(edge - mix(0.3, 0.38, scorch), edge, r);
        float hole = (1.0 - scorch) * (1.0 - smoothstep(0.12, 0.19, r + 0.04 * jag));
        float grain = 0.62 + 0.38 * vn(q * 7.0 + seed * 5.0);
        float speck = smoothstep(0.74, 0.84, vn(q * 11.0 + seed * 3.0)) * (1.0 - smoothstep(0.6, 1.0, r)) * (1.0 - hole);
        float alpha = max(hole * 0.95, soot * mix(0.72, 0.82, scorch) * grain + speck * 0.35);
        vec3 col = mix(vec3(0.11, 0.09, 0.08), vec3(0.025), hole);
        col = mix(col, vec3(1.0, 0.58, 0.18), vD.z * (1.0 - smoothstep(0.0, mix(0.3, 0.55, scorch), r)));
        alpha *= vD.x; if (alpha < 0.01) discard;
        gl_FragColor = vec4(col, alpha);
      }`,
  }));
  const decMesh = new THREE.InstancedMesh(decGeo, decMat, DEC); decMesh.frustumCulled = false; decMesh.count = 0; decMesh.renderOrder = 1;
  decMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(decMesh); owned.push({ dispose: () => { decMesh.removeFromParent(); decMesh.dispose(); } });
  const decAge = new Float32Array(DEC).fill(99), decLife = new Float32Array(DEC).fill(1);
  let decNext = 0, decUsed = 0, decAlive = 0;
  function addDecal(p, n, size, kind, life) {
    const i = decNext; decNext = (decNext + 1) % DEC; decUsed = Math.min(DEC, decUsed + 1);
    pA.copy(p).addScaledVector(n, .05); tmpQ.setFromUnitVectors(Z_AXIS, n); tmpQ2.setFromAxisAngle(Z_AXIS, Math.random() * 6.283); tmpQ.multiply(tmpQ2);
    decMesh.setMatrixAt(i, tmpM.compose(pA, tmpQ, tmpS.set(size, size, size))); decMesh.instanceMatrix.needsUpdate = true;
    decAge[i] = 0; decLife[i] = life; decAttr.setXYZW(i, 1, Math.random(), 1, kind); decAttr.needsUpdate = true; decMesh.count = decUsed;
  }
  function updateDecals(dt) {
    let alive = 0, dirty = false;
    for (let i = 0; i < decUsed; i++) {
      if (decAge[i] >= decLife[i]) { if (decAttr.getX(i) !== 0) { decAttr.setX(i, 0); dirty = true; } continue; }
      decAge[i] += dt; alive++; dirty = true;
      const a = decAge[i], L = decLife[i];
      decAttr.setX(i, Math.max(0, Math.min(1, (L - a) / (L * .35)))); decAttr.setZ(i, Math.max(0, 1 - a / (decAttr.getW(i) > .5 ? 1.2 : .4)));
    }
    if (dirty) decAttr.needsUpdate = true; decAlive = alive;
  }

  // ---------- flame stream: one particle = three camera-facing layers (dark-red edge, orange body, hot core) ----------
  // Colour follows age through a ramp; size grows with the distance travelled (a cone), flickers, drifts upward and,
  // when the puff reaches the aimed surface, it splats sideways along it. Fixed arrays, no allocation per frame.
  const flameTex = dataTex(64, (u, v, r) => [1 - .2 * smoothstep(.62, 1, r) - .14 * Math.max(0, Math.min(1, (u - v) * .5 + r * .25 - .1)), Math.min(1, Math.max(0, (1 - r) / .07))]);
  const coreTex = dataTex(32, (u, v, r) => [1, Math.min(1, Math.max(0, (1 - r) / .35)) ** 1.3]);
  const ramp = (...stops) => stops.map(([t, hex]) => [t, new THREE.Color(hex)]);
  function rampAt(stops, t, out) {
    if (t <= stops[0][0]) return out.copy(stops[0][1]);
    for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const [a, ca] = stops[i - 1], [b, cb] = stops[i]; return out.copy(ca).lerp(cb, (t - a) / (b - a)); }
    return out.copy(stops[stops.length - 1][1]);
  }
  const RAMP = {
    edge: ramp([0, '#ff8a1e'], [.3, '#f2521a'], [.6, '#b82a16'], [.85, '#6a2219'], [1, '#3b2a26']),
    mid: ramp([0, '#ffe066'], [.25, '#ffb12a'], [.55, '#ff7a1c'], [.8, '#d9431a'], [1, '#7a2a1c']),
    core: ramp([0, '#fffdf0'], [.25, '#fff3a6'], [.5, '#ffd34a'], [1, '#ffb02e']),
  };
  // Flight runs at an even speed ON SCREEN: a straight 3D path from a muzzle 2 units ahead of the lens to a wall 70 units
  // away projects almost entirely next to the wall, so the 3D fraction f follows the screen fraction g through the depths
  // (f = g z0 / (z1 - g (z1 - z0))). Size is set as a share of the distance to the lens (thin at the nozzle, wide at the
  // wall), then the puff lands: it splats along the wall (or drifts on) and grows, cools and rises as a world particle.
  // `onTip(x, y, z)` is called for some landed puffs as they die (thin smoke wisps curling off the flame tips).
  function flameSystem(cap, onTip) {
    const p = new Float32Array(cap * 3), v = new Float32Array(cap * 3), nn = new Float32Array(cap * 3), pa = new Float32Array(cap * 3), pb = new Float32Array(cap * 3), pt = new Float32Array(cap * 3),
      age = new Float32Array(cap), life = new Float32Array(cap), tv = new Float32Array(cap), z0 = new Float32Array(cap), z1 = new Float32Array(cap), s1 = new Float32Array(cap),
      ph = new Float32Array(cap), mode = new Float32Array(cap), ss = new Float32Array(cap), drag = new Float32Array(cap), lift = new Float32Array(cap), landS = new Float32Array(cap);
    const vec = [p, v, nn, pa, pb, pt], one = [age, life, tv, z0, z1, s1, ph, mode, ss, drag, lift, landS];
    const make = (map, order) => {
      const o = new THREE.InstancedMesh(quadGeo, own(new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false, fog: false })), cap);
      o.frustumCulled = false; o.count = 0; o.renderOrder = order; o.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      o.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); o.instanceColor.setUsage(THREE.DynamicDrawUsage);
      scene.add(o); owned.push({ dispose: () => { o.removeFromParent(); o.dispose(); } }); return o;
    };
    const layers = [make(flameTex, 2), make(flameTex, 3), make(coreTex, 4)];
    const NOZZLE = .015; // puff radius at the nozzle as a share of its distance to the lens
    const F = { cap, limit: cap, n: 0 };
    // from -> to (world), flight seconds, total life, world radius on arrival, surface normal (null = open air), slide speed
    F.add = (from, to, flight, lifeS, size1, nrm, slide, aim = to) => {
      if (F.n >= F.limit) return -1;
      const i = F.n++, k = i * 3;
      pa[k] = p[k] = from.x; pa[k + 1] = p[k + 1] = from.y; pa[k + 2] = p[k + 2] = from.z; pb[k] = to.x; pb[k + 1] = to.y; pb[k + 2] = to.z; pt[k] = aim.x; pt[k + 1] = aim.y; pt[k + 2] = aim.z;
      z0[i] = Math.max(.5, from.distanceTo(camPos)); z1[i] = Math.max(z0[i] + .5, to.distanceTo(camPos));
      if (nrm) { nn[k] = nrm.x; nn[k + 1] = nrm.y; nn[k + 2] = nrm.z; mode[i] = 1; } else mode[i] = 0;
      v[k] = (to.x - from.x) / flight * .25; v[k + 1] = (to.y - from.y) / flight * .25; v[k + 2] = (to.z - from.z) / flight * .25;
      age[i] = 0; life[i] = lifeS; tv[i] = flight; s1[i] = size1; ph[i] = Math.random() * 6.3; ss[i] = slide; drag[i] = 1.5; lift[i] = TF.lift; landS[i] = 0;
      return i;
    };
    // free puff (mode -2): starts at `p` with velocity, grows from size0 to size1 in ~.25 s, then cools, rises (lift) and fades
    F.addFree = (x, y, z, vx, vy, vz, size0, size1, lifeS, dragK = 3, liftK = TF.lift * 2) => {
      if (F.n >= F.limit) return -1;
      const i = F.n++, k = i * 3;
      p[k] = x; p[k + 1] = y; p[k + 2] = z; v[k] = vx; v[k + 1] = vy; v[k + 2] = vz;
      age[i] = 0; life[i] = lifeS; s1[i] = size1; z0[i] = Math.min(1, size0 / Math.max(1e-3, size1)); ph[i] = Math.random() * 6.3; mode[i] = -2; drag[i] = dragK; lift[i] = liftK; landS[i] = 0;
      return i;
    };
    F.kill = i => { const j = --F.n; if (i === j) return; for (const a of vec) a.copyWithin(i * 3, j * 3, j * 3 + 3); for (const a of one) a[i] = a[j]; };
    F.shorten = left => { for (let i = 0; i < F.n; i++) if (mode[i] !== -2) life[i] = Math.min(life[i], age[i] + left * (.6 + .4 * Math.random())); };
    F.clear = () => { F.n = 0; for (const l of layers) l.count = 0; };
    F.update = dt => {
      if (dt > 0) for (let i = 0; i < F.n; i++) {
        age[i] += dt;
        if (age[i] >= life[i]) { const k = i * 3; if (mode[i] === -1 && Math.random() < TF.tipSmoke) onTip(p[k], p[k + 1], p[k + 2]); F.kill(i); i--; continue; }
        const k = i * 3;
        if (mode[i] >= 0 && age[i] < tv[i]) { // in flight: screen-even straight path from the nozzle as it is NOW (user 10-18: no bent stream when the gun or camera moves)
          const g = age[i] / tv[i], f = g * z0[i] / (z1[i] - g * (z1[i] - z0[i])), s = F.src;
          const ax = s ? s.x : pa[k], ay = s ? s.y : pa[k + 1], az = s ? s.z : pa[k + 2], d = F.dst; // while the trigger is held, puffs follow the current aim too
          if (d) { pb[k] += d.x - pt[k]; pb[k + 1] += d.y - pt[k + 1]; pb[k + 2] += d.z - pt[k + 2]; pt[k] = d.x; pt[k + 1] = d.y; pt[k + 2] = d.z; }
          p[k] = ax + (pb[k] - ax) * f; p[k + 1] = ay + (pb[k + 1] - ay) * f; p[k + 2] = az + (pb[k + 2] - az) * f;
          continue;
        }
        if (mode[i] >= 0) { // land
          p[k] = pb[k]; p[k + 1] = pb[k + 1]; p[k + 2] = pb[k + 2]; landS[i] = age[i];
          if (mode[i] === 1) { const o = s1[i] * .7; p[k] += nn[k] * o; p[k + 1] += nn[k + 1] * o; p[k + 2] += nn[k + 2] * o; }
          if (mode[i] === 1) { // splat: slide along the surface, rise
            const nx = nn[k], ny = nn[k + 1], nz = nn[k + 2];
            let tx = rnd(-1, 1), ty = rnd(-.2, 1), tz = rnd(-1, 1); const dd = tx * nx + ty * ny + tz * nz; tx -= nx * dd; ty -= ny * dd; tz -= nz * dd;
            const tl = Math.hypot(tx, ty, tz) || 1, sl = ss[i];
            v[k] = tx / tl * sl + nx * 2; v[k + 1] = ty / tl * sl + ny * 2 + 1.5; v[k + 2] = tz / tl * sl + nz * 2; drag[i] = 3.2; lift[i] = TF.lift * 2.4;
          }
          mode[i] = -1;
        }
        const dr = Math.exp(-drag[i] * dt);
        v[k] *= dr; v[k + 1] = v[k + 1] * dr + lift[i] * dt; v[k + 2] *= dr;
        p[k] += v[k] * dt; p[k + 1] += v[k + 1] * dt; p[k + 2] += v[k + 2] * dt;
      }
      const cnt = F.n, [edge, mid, core] = layers;
      for (let i = 0; i < cnt; i++) {
        const k = i * 3, t = age[i] / life[i];
        tA.set(p[k], p[k + 1], p[k + 2]); tB.copy(camPos).sub(tA); const dc = tB.length() || 1; tB.multiplyScalar(1 / dc);
        let s;
        if (mode[i] >= 0) { const g = age[i] / tv[i]; s = dc * (NOZZLE + (s1[i] / z1[i] - NOZZLE) * g ** .75); }
        else if (mode[i] === -2) { const u = Math.min(1, age[i] / .25); s = s1[i] * (z0[i] + (1 - z0[i]) * (1 - (1 - u) ** 2)) * (1 + .25 * smoothstep(.3, 1, t)); }
        else s = s1[i] * (1 + .35 * smoothstep(0, .35, age[i] - landS[i]));
        s *= 1 + .13 * Math.sin(age[i] * 41 + ph[i]) + .06 * Math.sin(age[i] * 17 + ph[i] * 2);
        if (t > .78) s *= ((1 - t) / .22) ** .6;
        edge.setMatrixAt(i, tmpM.compose(tA, camQ, tmpS.setScalar(s))); edge.setColorAt(i, rampAt(RAMP.edge, t, tmpC));
        const sm = s * (.8 - .3 * t); tC.copy(tA).addScaledVector(tB, Math.min(s * .15, dc * .2));
        mid.setMatrixAt(i, tmpM.compose(tC, camQ, tmpS.setScalar(sm))); mid.setColorAt(i, rampAt(RAMP.mid, t, tmpC));
        const sc = s * .56 * Math.max(0, 1 - t / .62); tC.copy(tA).addScaledVector(tB, Math.min(s * .3, dc * .3));
        core.setMatrixAt(i, tmpM.compose(tC, camQ, tmpS.setScalar(Math.max(1e-4, sc)))); core.setColorAt(i, rampAt(RAMP.core, t, tmpC));
      }
      for (const l of layers) { l.count = cnt; if (cnt) { l.instanceMatrix.needsUpdate = true; l.instanceColor.needsUpdate = true; } }
    };
    return F;
  }
  // light splash on the aimed surface (additive, faces the surface normal) - stands in for a real light, costs one quad
  const splash = new THREE.Mesh(quadGeo, own(new THREE.MeshBasicMaterial({ map: softTex, color: '#ff8a30', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -4 })));
  splash.visible = false; splash.renderOrder = 1; splash.frustumCulled = false; scene.add(splash); owned.push({ dispose: () => splash.removeFromParent() });
  let splashLevel = 0;
  // the bazooka fireball keeps the round-3 layered puffs (only the flamethrower changed in round 4)
  const fireball = flameSystem(Math.max(TF.particles, TF.particlesPhone), () => {});

  // ---------- flamethrower fire (round 4, user 10-18: "real fire, not round cartoon puffs") ----------
  // Everything is driven by one tileable fbm noise texture built here at load (no downloaded images):
  //   stream  - one camera-facing strip from the nozzle to the aimed point, screen-even along its length (the same depth
  //             mapping as the tracers) and a true 3D cone in width; the noise scrolls along it toward the wall, so it reads as
  //             a narrow white-yellow core at the nozzle -> wider turbulent orange body -> broken red / brown edges.
  //   tongues - instanced quads stretched along their screen motion and shaped in the shader (a teardrop eroded by scrolling
  //             noise, colour from a temperature ramp). They ride the stream, roll over the hit surface and lick upward
  //             (buoyancy only after they land), cool to dark-red and break into smoke.
  // Blending is premultiplied "additive-ish": hot parts add light (overlapping fire brightens), cool parts also darken what
  // is behind them a little, so the fire keeps its colour over a bright sky and the tips read as sooty.
  function noiseTex(size) {
    const R = new Float32Array(size * size), G = new Float32Array(size * size);
    const lattice = (P, seed) => { const a = new Float32Array(P * P); let s = seed; for (let i = 0; i < a.length; i++) { s = (s * 16807) % 2147483647; a[i] = s / 2147483647; } return a; };
    const oct = [[4, 1], [8, .55], [16, .3], [32, .16]].map(([P, w], i) => [P, w, lattice(P, 977 + i * 131), lattice(P, 4111 + i * 71)]);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let r = 0, g = 0;
      for (const [P, w, A, B] of oct) {
        const fx = x / size * P, fy = y / size * P, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const x0 = ix % P, x1 = (ix + 1) % P, y0 = (iy % P) * P, y1 = ((iy + 1) % P) * P;
        r += ((A[y0 + x0] * (1 - sx) + A[y0 + x1] * sx) * (1 - sy) + (A[y1 + x0] * (1 - sx) + A[y1 + x1] * sx) * sy) * w;
        g += ((B[y0 + x0] * (1 - sx) + B[y0 + x1] * sx) * (1 - sy) + (B[y1 + x0] * (1 - sx) + B[y1 + x1] * sx) * sy) * w;
      }
      R[y * size + x] = r; G[y * size + x] = g;
    }
    const norm = a => { let lo = Infinity, hi = -Infinity; for (const x of a) { lo = Math.min(lo, x); hi = Math.max(hi, x); } return x => (x - lo) / (hi - lo || 1); };
    const nr = norm(R), ng = norm(G), d = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) { d[i * 4] = Math.round(nr(R[i]) * 255); d[i * 4 + 1] = Math.round(ng(G[i]) * 255); d[i * 4 + 3] = 255; }
    const t = own(new THREE.DataTexture(d, size, size, THREE.RGBAFormat)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
  }
  const uNoise = { value: noiseTex(128) }, uTime = { value: 0 };
  const FIRE_GLSL = `
    vec3 fireRamp(float h){
      vec3 c = mix(vec3(.08, .03, .022), vec3(.46, .075, .02), smoothstep(.0, .2, h));
      c = mix(c, vec3(.97, .3, .045), smoothstep(.15, .4, h));
      c = mix(c, vec3(1.0, .56, .1), smoothstep(.36, .6, h));
      c = mix(c, vec3(1.0, .82, .36), smoothstep(.58, .8, h));
      return mix(c, vec3(1.0, .97, .86), smoothstep(.8, 1.02, h));
    }`;
  // DoubleSide: both quads are built in screen space from a direction, so their winding flips with it (like the tracers)
  const fireBlend = () => ({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
  const fireOcc = mobile ? TF.occlusionPhone : TF.occlusion, fireAlpha = mobile ? TF.alphaPhone : 1, fireWidth = mobile ? TF.widthPhone : 1;

  // tongues: per instance aPos (centre), aAxis (stretch direction, world), aP = (radius, stretch, heat, seed), aA = alpha
  function fireSystem(cap, onTip) {
    const p = new Float32Array(cap * 3), v = new Float32Array(cap * 3), nn = new Float32Array(cap * 3), pa = new Float32Array(cap * 3), pb = new Float32Array(cap * 3), pt = new Float32Array(cap * 3),
      age = new Float32Array(cap), life = new Float32Array(cap), tv = new Float32Array(cap), s1 = new Float32Array(cap), ph = new Float32Array(cap), mode = new Float32Array(cap),
      ss = new Float32Array(cap), drag = new Float32Array(cap), lift = new Float32Array(cap), landS = new Float32Array(cap), h0 = new Float32Array(cap), g0 = new Float32Array(cap);
    const vec = [p, v, nn, pa, pb, pt], one = [age, life, tv, s1, ph, mode, ss, drag, lift, landS, h0, g0];
    const geo = own(new THREE.InstancedBufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3)); geo.setIndex([0, 1, 2, 2, 1, 3]);
    const aPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3), aAxis = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
      aP = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4), aA = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    for (const a of [aPos, aAxis, aP, aA]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPos', aPos); geo.setAttribute('aAxis', aAxis); geo.setAttribute('aP', aP); geo.setAttribute('aA', aA); geo.instanceCount = 0;
    const mat = own(new THREE.ShaderMaterial({ ...fireBlend(), uniforms: { uNoise, uTime, uOcc: { value: fireOcc } },
      vertexShader: `attribute vec3 aPos; attribute vec3 aAxis; attribute vec4 aP; attribute float aA; varying vec2 vQ; varying vec4 vD;
        void main(){
          vec4 mv = viewMatrix * vec4(aPos, 1.0); vec3 ax = (viewMatrix * vec4(aAxis, 0.0)).xyz;
          float l = length(ax.xy), la = length(ax); vec2 a2 = l > 1e-4 ? ax.xy / l : vec2(0.0, 1.0);
          float st = 1.0 + (aP.y - 1.0) * clamp(l / max(la, 1e-4), 0.0, 1.0); // stretch only as far as the motion shows on screen
          mv.xy += vec2(-a2.y, a2.x) * position.x * aP.x + a2 * (position.y * st + (st - 1.0) * .35) * aP.x;
          gl_Position = projectionMatrix * mv; vQ = position.xy; vD = vec4(aP.z, aP.w, aA, 0.0);
        }`,
      fragmentShader: `uniform sampler2D uNoise; uniform float uTime; uniform float uOcc; varying vec2 vQ; varying vec4 vD;
        ${FIRE_GLSL}
        void main(){
          vec2 q = vQ; float tip = q.y * .5 + .5, seed = vD.y;
          vec2 uv = vec2(q.x * .23 + seed * 5.3, q.y * .3 - uTime * 1.7 + seed * 2.7);
          vec2 n = texture2D(uNoise, uv).rg; float n2 = texture2D(uNoise, uv * 2.3 + n * .3 + vec2(.37, .11)).r;
          float turb = n.r * .6 + n2 * .4;
          float w = mix(1.0, .38, smoothstep(.2, 1.0, tip));                       // teardrop: round base, thin licking tip
          float x = q.x / w + (n.g - .5) * 1.3 * tip * tip;                        // the tip sways and breaks up
          float r = length(vec2(x * .95, q.y * .9 + .08));
          float dens = 1.0 - smoothstep(.25, 1.0, r + (turb - .5) * (.9 + .6 * tip));
          if (dens < .01) discard;
          float h = vD.x * (.38 + .72 * dens) * (.84 + .32 * turb);
          float a = dens * vD.z;
          vec3 col = fireRamp(h) * (1.0 + .45 * smoothstep(.8, 1.05, h));
          gl_FragColor = vec4(col * a, a * uOcc * (1.0 - .75 * smoothstep(.3, .8, h)));
        }`,
    }));
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.visible = false; scene.add(mesh); owned.push({ dispose: () => mesh.removeFromParent() });
    const F = { cap, limit: cap, n: 0, src: null, dst: null, w0: .03 };
    // in-flight tongue: from -> to (world), flight seconds, total life, radius on arrival, surface normal (null = open air), slide speed
    F.add = (from, to, flight, lifeS, size1, nrm, slide, aim = to) => {
      if (F.n >= F.limit) return -1;
      const i = F.n++, k = i * 3;
      pa[k] = p[k] = from.x; pa[k + 1] = p[k + 1] = from.y; pa[k + 2] = p[k + 2] = from.z; pb[k] = to.x; pb[k + 1] = to.y; pb[k + 2] = to.z; pt[k] = aim.x; pt[k + 1] = aim.y; pt[k + 2] = aim.z;
      if (nrm) { nn[k] = nrm.x; nn[k + 1] = nrm.y; nn[k + 2] = nrm.z; mode[i] = 1; } else mode[i] = 0;
      v[k] = (to.x - from.x) / flight * .2; v[k + 1] = (to.y - from.y) / flight * .2; v[k + 2] = (to.z - from.z) / flight * .2;
      age[i] = 0; life[i] = lifeS; tv[i] = flight; s1[i] = size1; ph[i] = Math.random(); ss[i] = slide; drag[i] = 1.5; lift[i] = TF.lift; landS[i] = 0; h0[i] = 1; g0[i] = 0;
      return i;
    };
    // free tongue (a lick off a burning surface): starts at p with velocity, radius grows from .5 to 1 x size in .15 s
    F.addFree = (x, y, z, vx, vy, vz, size, lifeS, heat = .8, dragK = 2.5, liftK = TF.lift * 2) => {
      if (F.n >= F.limit) return -1;
      const i = F.n++, k = i * 3;
      p[k] = x; p[k + 1] = y; p[k + 2] = z; v[k] = vx; v[k + 1] = vy; v[k + 2] = vz;
      age[i] = 0; life[i] = lifeS; s1[i] = size; ph[i] = Math.random(); mode[i] = -2; drag[i] = dragK; lift[i] = liftK; landS[i] = 0; h0[i] = heat; g0[i] = 0;
      return i;
    };
    F.kill = i => { const j = --F.n; if (i === j) return; for (const a of vec) a.copyWithin(i * 3, j * 3, j * 3 + 3); for (const a of one) a[i] = a[j]; };
    F.shorten = left => { for (let i = 0; i < F.n; i++) life[i] = Math.min(life[i], age[i] + left * (.6 + .4 * Math.random())); };
    F.clear = () => { F.n = 0; geo.instanceCount = 0; mesh.visible = false; };
    // simulation only (draw() places the in-flight tongues on the stream as it is at draw time)
    F.update = dt => {
      if (!(dt > 0)) return;
      const d = F.dst;
      for (let i = 0; i < F.n; i++) {
        age[i] += dt; const k = i * 3;
        if (age[i] >= life[i]) { if (mode[i] === -1 && Math.random() < TF.tipSmoke) onTip(p[k], p[k + 1], p[k + 2]); F.kill(i); i--; continue; }
        if (mode[i] >= 0 && age[i] < tv[i]) { // in flight: follow the current aim (no bent stream when the pointer sweeps)
          if (d) { pb[k] += d.x - pt[k]; pb[k + 1] += d.y - pt[k + 1]; pb[k + 2] += d.z - pt[k + 2]; pt[k] = d.x; pt[k + 1] = d.y; pt[k + 2] = d.z; }
          continue;
        }
        if (mode[i] >= 0) { // land: spread over the surface (or drift on in open air), then rise
          p[k] = pb[k]; p[k + 1] = pb[k + 1]; p[k + 2] = pb[k + 2]; landS[i] = age[i]; h0[i] = .58;
          if (mode[i] === 1) {
            const nx = nn[k], ny = nn[k + 1], nz = nn[k + 2], o = s1[i] * .55; p[k] += nx * o; p[k + 1] += ny * o; p[k + 2] += nz * o;
            let tx = rnd(-1, 1), ty = rnd(0, 1.2), tz = rnd(-1, 1); const dd = tx * nx + ty * ny + tz * nz; tx -= nx * dd; ty -= ny * dd; tz -= nz * dd;
            const tl = Math.hypot(tx, ty, tz) || 1, sl = ss[i] * .65;
            v[k] = tx / tl * sl + nx * 1.4; v[k + 1] = ty / tl * sl + ny * 1.4 + 1.6; v[k + 2] = tz / tl * sl + nz * 1.4; drag[i] = 2.8; lift[i] = TF.lift * 3;
          } else lift[i] = TF.lift * 1.6;
          mode[i] = -1;
        }
        const dr = Math.exp(-drag[i] * dt);
        v[k] *= dr; v[k + 1] = v[k + 1] * dr + lift[i] * dt; v[k + 2] *= dr;
        p[k] += v[k] * dt; p[k + 1] += v[k + 1] * dt; p[k + 2] += v[k + 2] * dt;
      }
    };
    F.draw = () => {
      const cnt = F.n, s = F.src; mesh.visible = cnt > 0; geo.instanceCount = cnt; if (!cnt) return;
      const sx = s ? s.x : 0, sy = s ? s.y : 0, sz = s ? s.z : 0;
      for (let i = 0; i < cnt; i++) {
        const k = i * 3, t = age[i] / life[i], fl = 1 + .12 * Math.sin(age[i] * 37 + ph[i] * 40) + .06 * Math.sin(age[i] * 13 + ph[i] * 80);
        let size, st, heat, alpha;
        if (mode[i] >= 0) { // on the stream: screen-even from the nozzle as it is NOW to the (aim-following) landing point
          const ax = s ? sx : pa[k], ay = s ? sy : pa[k + 1], az = s ? sz : pa[k + 2], g = age[i] / tv[i];
          pA.set(ax, ay, az); pB.set(pb[k], pb[k + 1], pb[k + 2]);
          const z0 = Math.max(.3, pA.distanceTo(camPos)), z1 = Math.max(z0 + .3, pB.distanceTo(camPos)), f = g * z0 / (z1 - g * (z1 - z0));
          pC.lerpVectors(pA, pB, f); aPos.setXYZ(i, pC.x, pC.y, pC.z); aAxis.setXYZ(i, pB.x - pA.x, pB.y - pA.y, pB.z - pA.z);
          size = (F.w0 + (s1[i] * .72 - F.w0) * f ** .8) * fl; st = 2.3 - g * .9; heat = .95 - .45 * g; alpha = smoothstep(.04, .3, g) * .62;
        } else {
          const u = mode[i] === -1 ? (age[i] - landS[i]) / Math.max(.05, life[i] - landS[i]) : t, vx = v[k], vy = v[k + 1], vz = v[k + 2], vl = Math.hypot(vx, vy, vz);
          aPos.setXYZ(i, p[k], p[k + 1], p[k + 2]); aAxis.setXYZ(i, vx * .35, vy * .35 + 4, vz * .35); // flames point up (buoyancy), leaning with the motion
          size = s1[i] * (mode[i] === -2 ? .5 + .5 * smoothstep(0, .15, age[i]) : 1 + .3 * smoothstep(0, .35, age[i] - landS[i])) * fl;
          st = 1.35 + Math.min(.9, vl * .12) + .25 * Math.sin(age[i] * 23 + ph[i] * 50); heat = h0[i] * (1 - u) ** 1.25; alpha = 1 - smoothstep(.72, 1, u);
        }
        aP.setXYZW(i, Math.max(1e-4, size), st, heat, ph[i]); aA.setX(i, alpha * fireAlpha);
      }
      aPos.needsUpdate = aAxis.needsUpdate = aP.needsUpdate = aA.needsUpdate = true;
    };
    return F;
  }
  const flames = fireSystem(Math.max(TF.particles, TF.particlesPhone), (x, y, z) =>
    soot.add(x, y, z, rnd(-.4, .4), rnd(1.6, 2.8), rnd(-.4, .4), .3 * TF.size, rnd(1.2, 2) * TF.size, rnd(1.1, 1.8), COL.wispA, COL.wispB, .6, 1.4));
  // small separate pool for the tongues licking off burnt spots after the stream has left (stream tongues die with the stream)
  const spotFire = fireSystem(mobile ? 16 : 24, () => {});
  const flameSrc = new V3(), flameDst = new V3();

  // the continuous stream strip (one draw, 2 x (STREAM_SEG + 1) vertices); uSpan = visible part (tail .. head) while it
  // shoots out after a press and breaks off the nozzle after a release
  const STREAM_SEG = 40, streamGeo = own(new THREE.BufferGeometry());
  { const pos = [], idx = []; for (let i = 0; i <= STREAM_SEG; i++) { pos.push(-1, i / STREAM_SEG, 0, 1, i / STREAM_SEG, 0); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); } }
    streamGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); streamGeo.setIndex(idx); }
  const streamMat = own(new THREE.ShaderMaterial({ ...fireBlend(),
    uniforms: { uNoise, uTime, uA: { value: new V3() }, uB: { value: new V3(0, 0, -1) }, uRes: { value: new THREE.Vector2(1280, 800) }, uW: { value: new THREE.Vector2(.03, 1) },
      uSpan: { value: new THREE.Vector2(0, 1) }, uAlpha: { value: 1 }, uOcc: { value: fireOcc } },
    vertexShader: `uniform vec3 uA; uniform vec3 uB; uniform vec2 uRes; uniform vec2 uW; varying vec2 vS; varying float vL;
      void main(){
        vec4 va = viewMatrix * vec4(uA, 1.0), vb = viewMatrix * vec4(uB, 1.0);
        float z0 = max(.05, -va.z), z1 = max(z0 + .05, -vb.z), g = position.y, f = g * z0 / (z1 - g * (z1 - z0));
        vec4 ca = projectionMatrix * va, cb = projectionMatrix * vb, c = projectionMatrix * mix(va, vb, f);
        vec2 d = (cb.xy / cb.w - ca.xy / ca.w) * uRes * .5; float L = length(d); d = L > 1e-3 ? d / L : vec2(1.0, 0.0);
        float hw = (uW.x + (uW.y - uW.x) * pow(f, .8)) * projectionMatrix[1][1] * .5 * uRes.y / c.w; // half width, px
        c.xy += vec2(-d.y, d.x) * position.x * hw / uRes * 2.0 * c.w;
        gl_Position = c; vS = position.xy; vL = L;
      }`,
    fragmentShader: `uniform sampler2D uNoise; uniform float uTime; uniform vec2 uSpan; uniform float uAlpha; uniform float uOcc; varying vec2 vS; varying float vL;
      ${FIRE_GLSL}
      void main(){
        float g = vS.y, s = vS.x;
        float span = smoothstep(uSpan.x, uSpan.x + .06, g) * (1.0 - smoothstep(uSpan.y - .1, uSpan.y, g));
        if (span <= 0.0) discard;
        float flow = g * vL / 120.0 - uTime * 4.6;                              // pattern runs toward the wall
        vec2 n = texture2D(uNoise, vec2(s * .16 + .31, flow * .21)).rg;
        float n2 = texture2D(uNoise, vec2(s * .42 + n.g * .35, flow * .57 + .5)).r;
        float turb = n.r * .55 + n2 * .45, grow = smoothstep(0.0, .85, g), amp = mix(.1, 1.0, grow);
        float x = abs(s + (n.g - .5) * amp * .9);
        float dens = 1.0 - smoothstep(.3 - .15 * grow, 1.0, x + (turb - .5) * amp * 1.4);
        float core = exp(-s * s * mix(16.0, 4.0, grow)) * (1.0 - smoothstep(.04, .32, g));
        float h = mix(1.05, .4, smoothstep(0.0, .72, g)) * (.36 + .76 * dens) * (.85 + .3 * turb) + core * .4;
        float a = clamp(dens * (1.0 - .45 * smoothstep(.7, 1.0, g)) + core * .5, 0.0, 1.0) * span * uAlpha;
        if (a < .004) discard;
        vec3 col = fireRamp(h) * (1.0 + .45 * smoothstep(.8, 1.05, h));
        gl_FragColor = vec4(col * a, a * uOcc * (1.0 - .75 * smoothstep(.3, .8, h)));
      }`,
  }));
  const streamMesh = new THREE.Mesh(streamGeo, streamMat); streamMesh.frustumCulled = false; streamMesh.renderOrder = 3; streamMesh.visible = false; scene.add(streamMesh);
  owned.push({ dispose: () => streamMesh.removeFromParent() });
  const stream = { on: false, head: 0, tail: 0, end: new V3(), w1: 1 };

  // flash quads: brief additive light on the wall and the ground around a blast
  const flashQuads = Array.from({ length: 4 }, () => {
    const m = new THREE.Mesh(quadGeo, own(new THREE.MeshBasicMaterial({ map: softTex, color: '#ffd59a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -4 })));
    m.visible = false; m.renderOrder = 1; m.frustumCulled = false; m.userData = { age: 0, life: .3, size: 1, peak: 1 }; scene.add(m); owned.push({ dispose: () => m.removeFromParent() }); return m;
  });
  let flashNext = 0;
  function flashAt(p, n, size, color, peak = 1, life = .3) {
    const m = flashQuads[flashNext++ % flashQuads.length]; m.position.copy(p); m.quaternion.setFromUnitVectors(Z_AXIS, n); m.material.color.copy(color);
    Object.assign(m.userData, { age: 0, life, size, peak }); m.visible = true;
  }
  function updateFlashes(dt) { for (const m of flashQuads) { if (!m.visible) continue; const u = m.userData; u.age += dt; const k = u.age / u.life; if (k >= 1) { m.visible = false; continue; } m.material.opacity = u.peak * (1 - k) ** 1.6; m.scale.setScalar(u.size * .5 * (.8 + .4 * k)); } }
  const FLASH_WALL = C('#ffd9a0'), FLASH_GROUND = C('#ffb466');

  // tracers (minigun): screen-space lines - a constant pixel width at both ends (no wedge when they run into the depth)
  const TRACERS = 24, tracerItems = Array.from({ length: TRACERS }, () => ({ a: new V3(), b: new V3(), age: 0, life: .09 }));
  const trGeo = own(new THREE.InstancedBufferGeometry());
  trGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3)); trGeo.setIndex([0, 1, 2, 2, 1, 3]);
  const trA = new THREE.InstancedBufferAttribute(new Float32Array(TRACERS * 3), 3), trB = new THREE.InstancedBufferAttribute(new Float32Array(TRACERS * 3), 3), trW = new THREE.InstancedBufferAttribute(new Float32Array(TRACERS * 2), 2);
  for (const a of [trA, trB, trW]) a.setUsage(THREE.DynamicDrawUsage);
  trGeo.setAttribute('aA', trA); trGeo.setAttribute('aB', trB); trGeo.setAttribute('aW', trW); trGeo.instanceCount = 0;
  const trMat = own(new THREE.ShaderMaterial({
    uniforms: { uRes: { value: new THREE.Vector2(1280, 800) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `attribute vec3 aA; attribute vec3 aB; attribute vec2 aW; uniform vec2 uRes; varying vec2 vP; varying float vA;
      void main(){
        vec4 ca = projectionMatrix * viewMatrix * vec4(aA, 1.0), cb = projectionMatrix * viewMatrix * vec4(aB, 1.0);
        vec2 d = (cb.xy / cb.w - ca.xy / ca.w) * uRes; float L = length(d); d = L > 1e-4 ? d / L : vec2(1.0, 0.0);
        vec4 c = mix(ca, cb, position.y); c.xy += vec2(-d.y, d.x) * position.x * aW.y / uRes * 2.0 * c.w;
        gl_Position = c; vP = position.xy; vA = aW.x;
      }`,
    fragmentShader: `varying vec2 vP; varying float vA;
      void main(){
        float x = vP.x, core = exp(-x * x * 10.0), glow = exp(-x * x * 2.2) * 0.5, along = smoothstep(0.0, 0.55, vP.y) * (0.75 + 0.25 * smoothstep(0.7, 1.0, vP.y));
        vec3 col = mix(vec3(1.0, 0.6, 0.16), vec3(1.0, 0.97, 0.86), core);
        gl_FragColor = vec4(col, (core + glow) * along * vA);
      }`,
  }));
  const tracerMesh = new THREE.Mesh(trGeo, trMat); tracerMesh.frustumCulled = false; tracerMesh.renderOrder = 5; tracerMesh.visible = false; scene.add(tracerMesh);
  owned.push({ dispose: () => tracerMesh.removeFromParent() });
  let tracerN = 0;
  function addTracer(a, b) { const it = tracerN < TRACERS ? tracerItems[tracerN++] : tracerItems[0]; it.a.copy(a); it.b.copy(b); it.age = 0; it.life = .1; }
  function updateTracers(dt) {
    for (let i = 0; i < tracerN; i++) {
      const it = tracerItems[i]; it.age += dt;
      if (it.age >= it.life) { const last = tracerItems[--tracerN]; tracerItems[tracerN] = it; tracerItems[i] = last; i--; continue; }
    }
  }
  // Round 4 fix (user 10-18 "tracers sometimes leave from the LEFT of the gun"): the bolt used to run from a WORLD point taken
  // when the shot was fired - from the gun as it was posed last frame, before this frame's camera move and the caller's screen
  // shake. The gun is redrawn glued to the lens every frame, so that point slid away from the barrel: the shake moves the camera
  // by (px x units-per-pixel AT THE TARGET), tenths of a unit, which is tens of px at the muzzle 2 units from the lens (and the
  // minigun kicks the shake every shot, alternating sides); fast turns add the 0.1 s life on top. Now every live bolt starts at
  // the barrel tip as it is posed for THIS frame (drawn from pose(), after the shake), and only its far end is a world point.
  const tracerSrc = new V3();
  function drawTracers() {
    trMat.uniforms.uRes.value.set(width, height);
    const glued = tool === 'minigun' && visible; if (glued) worldOf(VM.minigun.muzzle, tracerSrc);
    else tracerN = 0; // the gun was put away / hidden: its bolts go with it (no start left at a stale world point)
    for (let i = 0; i < tracerN; i++) {
      // a bolt that runs from the gun to the wall at an even speed ON SCREEN (same depth mapping as the flame stream)
      // round 5: both screen shares stay in [0, 1] - past 1 the depth mapping below runs into its pole and then behind the camera
      const it = tracerItems[i], a = tracerSrc, k = it.age / it.life, z0 = Math.max(.3, a.distanceTo(camPos)), z1 = Math.max(z0 + .3, it.b.distanceTo(camPos));
      const gH = Math.min(1, k * 1.5 + .2), gT = Math.min(gH, Math.max(0, k * 1.5 - .4)), fT = gT * z0 / (z1 - gT * (z1 - z0)), fH = gH * z0 / (z1 - gH * (z1 - z0));
      pA.lerpVectors(a, it.b, fT); pB.lerpVectors(a, it.b, fH);
      trA.setXYZ(i, pA.x, pA.y, pA.z); trB.setXYZ(i, pB.x, pB.y, pB.z); trW.setXY(i, 1 - k * .45, mobile ? 2.8 : 3.4);
    }
    trGeo.instanceCount = tracerN; tracerMesh.visible = tracerN > 0;
    if (tracerN) { trA.needsUpdate = true; trB.needsUpdate = true; trW.needsUpdate = true; }
  }
  // pressure rings
  const ringGeo = own(new THREE.RingGeometry(.84, 1, 48)), ringThin = own(new THREE.RingGeometry(.94, 1, 64)), rq = new V3();
  const rings = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(ringGeo, own(new THREE.MeshBasicMaterial({ color: '#ffe0a8', transparent: true, depthWrite: false, side: THREE.DoubleSide }))); m.visible = false; m.userData = { age: 0, life: .5, size: 1, peak: .75 }; scene.add(m); owned.push({ dispose: () => m.removeFromParent() }); return m; });
  let ringNext = 0;
  function ringAt(p, n, size, life = .45, color = '#ffe0a8', peak = .75, thin = false) { const m = rings[ringNext++ % rings.length]; m.geometry = thin ? ringThin : ringGeo; m.position.copy(p).addScaledVector(n, .2); m.lookAt(rq.copy(m.position).add(n)); m.material.color.set(color); Object.assign(m.userData, { age: 0, life, size, peak }); m.visible = true; }
  function updateRings(dt) { for (const m of rings) { if (!m.visible) continue; const u = m.userData; u.age += dt; const k = u.age / u.life; if (k >= 1) { m.visible = false; continue; } m.scale.setScalar(u.size * (.15 + (1 - (1 - k) ** 2.5))); m.material.opacity = u.peak * (1 - k); } }

  // ---------- viewmodels (overlay pass, camera space; -z of each gun = its barrel, like the shotgun) ----------
  const overlayScene = new THREE.Scene(), overlayCamera = new THREE.PerspectiveCamera();
  overlayCamera.matrixAutoUpdate = false; overlayCamera.matrixWorldAutoUpdate = false;
  const root = new THREE.Group(); root.name = 'heavy-weapon-view'; root.visible = false; overlayScene.add(root);
  const holder = new THREE.Group(); root.add(holder);
  // same light rig as the shotgun view (hemisphere + warm key + cool fill), plus a muzzle light that is dark unless firing
  root.add(new THREE.HemisphereLight('#e1edf5', '#4b3430', 1.8));
  const key = new THREE.DirectionalLight('#ffefd8', 2.4); key.position.set(-2, 3, 3); root.add(key); key.target = holder;
  const fill = new THREE.DirectionalLight('#b7d5ef', 1.2); fill.position.set(2, 1, -2); root.add(fill); fill.target = holder;
  const fireLight = new THREE.PointLight('#ff9a3c', 0, 0, 2); root.add(fireLight);
  const kick = new THREE.Group(); holder.add(kick);
  const VM = buildHeavyWeaponModels(THREE, own);
  for (const k in VM) { VM[k].g.visible = false; kick.add(VM[k].g); }
  // muzzle glow (camera space, additive): flame heat, minigun / bazooka shot flashes; heat glow on hot minigun barrels
  const glow = new THREE.Mesh(own(new THREE.PlaneGeometry(1, 1)), own(new THREE.MeshBasicMaterial({ map: softTex, color: '#ffb04a', transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false })));
  glow.renderOrder = 12; glow.frustumCulled = false; glow.visible = false; root.add(glow);
  const heatGlow = new THREE.Mesh(glow.geometry, own(new THREE.MeshBasicMaterial({ map: softTex, color: '#ff5a1e', transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false })));
  heatGlow.renderOrder = 12; heatGlow.frustumCulled = false; heatGlow.visible = false; root.add(heatGlow);
  let glowLevel = 0;
  // casings and steam / muzzle smoke: small camera-space pools
  const CASINGS = 32, casingItems = Array.from({ length: CASINGS }, () => ({ p: new V3(), v: new V3(), q: new THREE.Quaternion(), w: new V3(), age: 9, s: 1 }));
  const casingMesh = new THREE.InstancedMesh(own(new THREE.CylinderGeometry(.011, .011, .05, 8)), own(new THREE.MeshStandardMaterial({ color: '#d9a441', roughness: .35, metalness: 0, fog: false })), CASINGS);
  casingMesh.frustumCulled = false; casingMesh.count = 0; casingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(casingMesh);
  let casingNext = 0;
  const STEAM = 32, steamItems = Array.from({ length: STEAM }, () => ({ p: new V3(), v: new V3(), age: 9, life: 1, s: 1, r: 0 }));
  const steamMesh = new THREE.InstancedMesh(own(new THREE.PlaneGeometry(1, 1)), own(new THREE.MeshBasicMaterial({ map: smokeTex, transparent: true, opacity: .7, depthWrite: false, fog: false })), STEAM);
  steamMesh.frustumCulled = false; steamMesh.count = 0; steamMesh.renderOrder = 11; steamMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(steamMesh);
  let steamNext = 0;
  const spinStep = new THREE.Quaternion(), spinAxis = new V3();

  // rockets (world): four reusable meshes
  const rocketProto = (() => { // +z = nose (lookAt), olive body, yellow band, red nose, four fins, glowing nozzle
    const g = new THREE.Group(), L = c => own(new THREE.MeshLambertMaterial({ color: c })), olive = L('#6b7a3a'), dark = L('#424c25'), red = L('#c94a35'), yel = L('#d9b843');
    const add = (geo, m, z) => { const o = new THREE.Mesh(own(geo), m); o.rotation.x = Math.PI / 2; o.position.z = z; o.castShadow = true; g.add(o); return o; };
    add(new THREE.CylinderGeometry(.3, .3, 1.7, 12), olive, 0); add(new THREE.CylinderGeometry(.31, .31, .18, 12), yel, .55);
    add(new THREE.CylinderGeometry(.04, .3, 1, 12), red, 1.35); add(new THREE.CylinderGeometry(.24, .18, .3, 10), dark, -1);
    const glowEnd = new THREE.Mesh(own(new THREE.CircleGeometry(.2, 12)), own(new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false, side: THREE.DoubleSide })));
    glowEnd.position.z = -1.16; g.add(glowEnd);
    const fin = own(new THREE.BoxGeometry(.05, .55, .6));
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(fin, dark); f.position.set(Math.cos(i * Math.PI / 2) * .36, Math.sin(i * Math.PI / 2) * .36, -.7); f.rotation.z = i * Math.PI / 2 + Math.PI / 2; f.castShadow = true; g.add(f); }
    return g;
  })();
  const rockets = Array.from({ length: 4 }, () => { const mesh = rocketProto.clone(); mesh.scale.setScalar(.6); mesh.visible = false; scene.add(mesh); owned.push({ dispose: () => mesh.removeFromParent() });
    return { mesh, active: false, phase: 'fly', from: new V3(), to: new V3(), side: new V3(), vel: new V3(), prev: new V3(), age: 0, dur: .32, hit: null, groundY: NaN }; });
  // staged blasts: late fire licks and the rising smoke column are emitted over the first second
  const blastEv = Array.from({ length: 3 }, () => ({ on: false, age: 0, p: new V3(), n: new V3(), R: 1, col: 0, lick: 0 }));

  // ---------- flamethrower burn spots: smoke, flame licks and a little afterburn where the stream has been ----------
  const spots = Array.from({ length: TF.burnSpots }, () => ({ p: new V3(), n: new V3(), heat: 0, fedAt: -9, targetId: null, emit: 0, lick: 0 }));
  const burnHit = { kind: 'building', point: new V3(), normal: new V3(), site: null, targetId: null, afterburn: true };
  const biteHit = { kind: 'building', point: new V3(), normal: new V3(), site: null, targetId: null };

  // ---------- state ----------
  let tool = null, visible = false, holding = false, disposed = false;
  const aim = { x: 0, y: 0, w: 1, h: 1 };
  const st = { lastShot: -9, spin: 0, heat: 0, shotAcc: 0, lastBullet: -9, shells: 0, emitAcc: 0, nextProbe: 0, flameHit: null,
    flameShield: null, lastAim: null, pingAt: -9, crackAcc: 0, spreadPhase: 0, firing: false, shots: 0, rocketsFired: 0, scorchTicks: 0, view: { aimPoint: new V3(), hasAim: false },
    flashGlow: 0, tickAt: -9, ricAt: -9, burnDist: 0, burnAt: -9, burnDepth: 0, burnTarget: null, ray: new V3(0, 0, -1), afterAcc: 0, burning: 0,
    fxKind: null, fxPoint: new V3(), fxNormal: new V3(), lickAcc: 0 };
  const muzzle = new V3(), dir = new V3(), aimLocal = new V3(), baseFwd = new V3(), MAX_SWING = .14, aimQ = new THREE.Quaternion(), baseQ = new THREE.Quaternion(), swingQ = new THREE.Quaternion(), baseE = new THREE.Euler();
  const flameCap = () => mobile ? TF.particlesPhone : TF.particles;
  let width = 1, height = 1;
  const heatView = { heat: 0 };
  // weighty motion: spring recoil (z back + muzzle climb) and sway that lags behind camera turns, plus a slow breathing bob
  const MOTION = { minigun: { k: 50, d: 10, rk: 220, rd: 22, push: 5 }, flamethrower: { k: 60, d: 11, rk: 180, rd: 20, push: 5 }, bazooka: { k: 34, d: 8, rk: 60, rd: 10, push: 7 } };
  const sway = { x: 0, y: 0, vx: 0, vy: 0, t: 0 }, rec = { z: 0, v: 0 }, prevFwd = new V3(0, 0, -1), invQ = new THREE.Quaternion();
  let hasPrev = false;
  function recoil(impulse) { if (!reducedMotion) rec.v += impulse; else rec.v += impulse * .5; }

  function pose(dt) {
    const p = camera.projectionMatrix.elements, depth = 2, halfX = depth / p[0], halfY = depth / p[5], F = VM[tool]?.frame || VM.minigun.frame, M = MOTION[tool] || MOTION.minigun;
    camera.getWorldQuaternion(camQ); camera.getWorldPosition(camPos);
    root.position.copy(camPos); root.quaternion.copy(camQ);
    if (dt > 0) {
      // the gun lags behind a camera turn (springs back), weightier for the bazooka
      tE.copy(prevFwd).applyQuaternion(invQ.copy(camQ).invert());
      if (hasPrev && !reducedMotion) { sway.vx += Math.max(-.3, Math.min(.3, tE.x)) * M.push * 60 * dt; sway.vy += Math.max(-.3, Math.min(.3, tE.y)) * M.push * 60 * dt; }
      prevFwd.copy(FWD0).applyQuaternion(camQ); hasPrev = true;
      sway.vx += (-M.k * sway.x - M.d * sway.vx) * dt; sway.vy += (-M.k * sway.y - M.d * sway.vy) * dt;
      sway.x = Math.max(-.15, Math.min(.15, sway.x + sway.vx * dt)); sway.y = Math.max(-.15, Math.min(.15, sway.y + sway.vy * dt));
      rec.v += (-M.rk * rec.z - M.rd * rec.v) * dt; rec.z += rec.v * dt; sway.t += dt;
    }
    const breathe = reducedMotion ? 0 : 1, bob = Math.sin(sway.t * 1.6) * .006 * breathe, roll = Math.sin(sway.t * .7) * .012 * breathe;
    // Framing = shotgun-view.js: anchor through the real projection (HUD view offset included), size from the short half-extent.
    holder.position.set((F.x + p[8] + sway.x * .45) * halfX, (F.y + p[9] + sway.y * .45 + bob) * halfY, -depth);
    holder.scale.setScalar(Math.min(halfY, halfX) * F.s);
    // Rest pose = the shotgun's (barrel toward a point 6 units ahead of the lens, slight cant); the barrel then swings toward
    // the surface under the pointer (latest probe) or the pointer ray: 45 % of the way, at most MAX_SWING away from rest.
    baseQ.setFromEuler(baseE.set(Math.atan2(-F.y * halfY, 6), Math.atan2(F.x * halfX, 6), -.075));
    baseFwd.copy(FWD0).applyQuaternion(baseQ);
    if (st.view.hasAim) aimLocal.copy(st.view.aimPoint);
    else aimLocal.set(aim.x / width * 2 - 1, 1 - aim.y / height * 2, .5).unproject(camera).sub(camPos).normalize().multiplyScalar(80).add(camPos);
    aimLocal.applyMatrix4(camera.matrixWorldInverse).sub(holder.position).normalize();
    // follow the pointer only partly (the shotgun sways the same way), so the gun keeps the shotgun's diagonal
    const ang = aimLocal.angleTo(baseFwd), turn = Math.min(ang * .45, MAX_SWING);
    swingQ.setFromUnitVectors(baseFwd, aimLocal); aimQ.slerpQuaternions(QI, swingQ, ang > 1e-5 ? turn / ang : 0).multiply(baseQ);
    holder.quaternion.slerp(aimQ, dt > 0 ? 1 - Math.exp(-dt * 14) : 1);
    const kz = rec.z, kAmt = tool === 'bazooka' ? .5 : .22;
    const shake = tool === 'minigun' && !reducedMotion ? st.spin * (st.firing ? .012 : .003) : 0;
    kick.position.set(rnd(-shake, shake), kz * .04 + rnd(-shake, shake), kz * kAmt);
    kick.rotation.set(kz * (tool === 'bazooka' ? .3 : .22) - sway.y * .5, sway.x * .6, roll - sway.x * .25);
    root.updateMatrixWorld(true);
  }
  function worldOf(local, out) { return VM[tool].g.localToWorld(out.copy(local)); }
  function screenRay(out) { return out.set(aim.x / width * 2 - 1, 1 - aim.y / height * 2, .5).unproject(camera).sub(camPos).normalize(); }

  function setTool(id) {
    const next = HEAVY_WEAPON_IDS.includes(id) ? id : null; if (next === tool) return;
    release(); tool = next; for (const k in VM) VM[k].g.visible = k === tool; root.visible = visible && !!tool; hasPrev = false; if (root.visible) pose(0);
    if (!tool) audio?.setLoops(0, false);
  }
  function setVisible(value) { const v = !!value; if (v === visible) return; visible = v; root.visible = visible && !!tool; hasPrev = false; if (!visible) { release(); audio?.setLoops(0, false); } else if (tool) pose(0); }
  function setAim(x, y, w, h) { if ([x, y].every(Number.isFinite)) { aim.x = x; aim.y = y; } if (w > 0) aim.w = width = w; if (h > 0) aim.h = height = h; }
  function press(now) {
    if (disposed || !visible || !tool) return false;
    if (tool === 'bazooka') { if (now - st.lastShot < TB.cooldown) return false; fireRocket(now); return true; }
    holding = true; if (tool === 'flamethrower') { audio?.play('ignite'); st.nextProbe = 0; } return true;
  }
  function release() {
    if (!holding) return; holding = false;
    if (tool === 'flamethrower') flames.shorten(TF.linger);
    if (st.flameShield) { shield?.release(st.flameShield); st.flameShield = null; }
  }

  // ---------- bazooka ----------
  // Ground height under a wall hit (for the ground shock ring / dust): walk the screen point below the hit twice.
  function groundBelow(h) {
    if (!h) return NaN; if (h.kind === 'ground' || h.normal.y > .7) return h.point.y;
    let gy = h.point.y - 12;
    for (let i = 0; i < 3; i++) {
      tE.set(h.point.x, gy, h.point.z).project(camera);
      if (tE.z > 1 || Math.abs(tE.x) > 1.3 || Math.abs(tE.y) > 1.3) return NaN;
      const g = probe((tE.x * .5 + .5) * width, (-tE.y * .5 + .5) * height);
      if (!g || g.kind !== 'ground' || g.point.y > h.point.y) return NaN;
      const off = Math.hypot(g.point.x - h.point.x, g.point.z - h.point.z); gy = g.point.y;
      if (off < 3) return gy;
    }
    return gy;
  }
  function fireRocket(now) {
    const r = rockets.find(x => !x.active); if (!r) return;
    st.lastShot = now; st.rocketsFired++; recoil(7); st.flashGlow = 1; pose(0);
    const hit = probe(aim.x, aim.y);
    worldOf(VM.bazooka.muzzle, r.from);
    if (hit) r.to.copy(hit.point); else r.to.copy(camPos).addScaledVector(dir.set(0, 0, -1).applyQuaternion(camQ), 140);
    dir.subVectors(r.to, r.from).normalize();
    r.dur = TB.flight * THREE.MathUtils.clamp(r.from.distanceTo(r.to) / 45, .78, 1.25);
    r.from.addScaledVector(dir, 2.5); r.side.crossVectors(dir, UP).normalize();
    r.mesh.position.copy(r.from); r.mesh.lookAt(r.to); r.mesh.visible = true; r.prev.copy(r.from);
    Object.assign(r, { active: true, phase: 'fly', age: 0, hit, groundY: hit && hit.kind !== 'protected' ? groundBelow(hit) : NaN });
    VM.bazooka.flash.visible = true; VM.bazooka.flash.userData.until = now + .06; VM.bazooka.flash.rotation.z = rnd(0, 6.3); VM.bazooka.head.visible = false;
    worldOf(VM.bazooka.back, tA);
    // back-blast: a cone of light smoke and a few sparks behind the shooter
    for (let k = 0; k < 10; k++) smoke.add(tA.x, tA.y, tA.z, rnd(-2.4, 2.4) - dir.x * 5, rnd(0, 2.4) - dir.y * 5, rnd(-2.4, 2.4) - dir.z * 5, .3, rnd(.7, 1.3), rnd(.45, .8), COL.back, COL.backEnd, 3, .6);
    for (let k = 0; k < 5; k++) sparks.add(tA.x, tA.y, tA.z, rnd(-3, 3) - dir.x * 12, rnd(-1, 3) - dir.y * 12, rnd(-3, 3) - dir.z * 12, .16, .05, rnd(.15, .3), COL.sparkHot, COL.sparkEnd, 2, -10);
    worldOf(VM.bazooka.muzzle, tA);
    for (let k = 0; k < 4; k++) smoke.add(tA.x + dir.x * 3, tA.y + dir.y * 3, tA.z + dir.z * 3, rnd(-1.5, 1.5) + dir.x * 4, rnd(0, 1.5), rnd(-1.5, 1.5) + dir.z * 4, .3, rnd(.6, 1), rnd(.35, .6), COL.smokeW, COL.smokeWEnd, 3.5, .4);
    audio?.play('launch'); audio?.play('flight', r.dur); onKick('bazooka-launch');
  }
  function updateRockets(dt) {
    for (const r of rockets) {
      if (!r.active) continue; r.age += dt;
      if (r.phase === 'fly') {
        const k = Math.min(1, r.age / r.dur), e = k ** 1.12; r.prev.copy(r.mesh.position);
        r.mesh.position.lerpVectors(r.from, r.to, e).addScaledVector(r.side, Math.sin(k * 9) * .25 * (1 - k)); r.mesh.lookAt(r.to);
        tB.set(0, 0, -.8).applyQuaternion(r.mesh.quaternion); // tail offset
        const steps = Math.max(1, Math.min(6, Math.ceil(r.prev.distanceTo(r.mesh.position) / 1.1)));
        for (let s = 0; s < steps; s++) {
          tA.copy(r.prev).lerp(r.mesh.position, s / steps).add(tB);
          const far = Math.min(1, tA.distanceTo(r.from) / 30);
          smoke.add(tA.x, tA.y, tA.z, rnd(-.4, .4), rnd(.2, .9), rnd(-.4, .4), .2, (.35 + far * .95) * rnd(.85, 1.15), rnd(.7, 1.1), COL.smokeW, COL.smokeWEnd, 1.2, .5);
        }
        tA.copy(r.mesh.position).add(tB); blast.add(tA.x, tA.y, tA.z, 0, 0, 0, .55, .2, .07, COL.flameA, COL.sparkRed);
        if (Math.random() < .5) sparks.add(tA.x, tA.y, tA.z, -tB.x * 8 + rnd(-2, 2), -tB.y * 8 + rnd(-2, 2), -tB.z * 8 + rnd(-2, 2), .14, .04, rnd(.12, .22), COL.sparkHot, COL.sparkEnd, 3, -6);
        if (k >= 1) arrive(r);
      } else { // bounced off a hospital shield
        r.vel.y -= 26 * dt; r.mesh.position.addScaledVector(r.vel, dt); r.mesh.rotateX(dt * 14); r.mesh.rotateY(dt * 9);
        if (Math.random() < .7) smoke.add(r.mesh.position.x, r.mesh.position.y, r.mesh.position.z, 0, .5, 0, .3, .9, .6, COL.smokeW, COL.smokeWEnd, 1, .4);
        if (r.age > .85) { poof(r.mesh.position, .7); r.active = false; r.mesh.visible = false; }
      }
    }
  }
  function arrive(r) {
    const h = r.hit;
    if (h?.kind === 'protected') {
      shield?.flash(h.point, h.normal, 10, { life: .95, strong: true }); audio?.play('shield', true); audio?.play('bounce'); onKick('bazooka-shield');
      ringAt(h.point, h.normal, 9, .45, '#bff1ff');
      dir.subVectors(r.to, r.from).normalize(); r.vel.copy(dir).addScaledVector(h.normal, -2 * dir.dot(h.normal)).multiplyScalar(24); r.vel.y += 9;
      r.phase = 'bounce'; r.age = 0; return;
    }
    r.active = false; r.mesh.visible = false;
    if (!h) { poof(r.to, 1); return; }
    explode(h.point, h.normal, TB.radius * TB.blast, r.groundY);
    onRocket(h);
  }
  function poof(p, s) {
    for (let k = 0; k < 7; k++) smoke.add(p.x + rnd(-s, s), p.y + rnd(-s, s), p.z + rnd(-s, s), rnd(-2, 2), rnd(0, 2), rnd(-2, 2), .4 * s, rnd(1.4, 2) * s, rnd(.5, .8), COL.puff, COL.puffEnd, 2.5, .6);
    blast.add(p.x, p.y, p.z, 0, 0, 0, .6 * s, 1.4 * s, .16, COL.flameA, COL.sparkRed); audio?.play('bounce');
  }
  // Blast, in layers: a white-hot additive core + light flash on the wall / ground -> fireball of flame puffs (white-yellow
  // core, orange body, dark-red rim, cooling to brown) -> streak sparks, embers and tumbling chunks -> rings (wall, a faint
  // air shock, ground) + a ground dust ring -> scorch decal; then the staged part (late fire licks, a dark smoke column
  // rising for ~1 s) runs in updateBlastEvents().
  function explode(p, n, R, gy) {
    const c = tC.copy(p).addScaledVector(n, .6), scale = R / TB.radius, sq = Math.sqrt(scale);
    const hasGround = Number.isFinite(gy) && p.y - gy < R * 6 && p.y >= gy - .5;
    sparks.add(c.x, c.y, c.z, 0, 0, 0, R * 1.5, R * .5, .13, COL.white, COL.fireHot);
    sparks.add(c.x, c.y, c.z, 0, 0, 0, R * .8, R * .3, .09, COL.white, COL.white);
    flashAt(tE.copy(p).addScaledVector(n, .3), n, R * 2.8 * TB.flash, FLASH_WALL, .85, .24);
    if (hasGround) flashAt(tE.set(p.x, gy + .15, p.z), UP, R * 3.2 * TB.flash, FLASH_GROUND, .5, .3);
    for (let k = 0, m = Math.round(20 * lite); k < m; k++) { // fireball: inner puffs hot and quick, outer ones bigger, darker, slower
      tD.set(rnd(-1, 1), rnd(-.3, 1), rnd(-1, 1)).addScaledVector(n, 1).normalize(); const outer = k / m, o = rnd(.1, R * .25) * (.4 + outer), sp = rnd(5, 13) * sq * (.6 + outer * .8);
      fireball.addFree(c.x + tD.x * o, c.y + tD.y * o, c.z + tD.z * o, tD.x * sp, tD.y * sp + 1, tD.z * sp, R * .12, R * rnd(.28, .42) * (.8 + outer * .4), rnd(.36, .56) * (.8 + outer * .4), 4.5, 6);
    }
    for (let k = 0, m = Math.round(34 * lite); k < m; k++) {
      tD.set(rnd(-1, 1), rnd(-.2, 1), rnd(-1, 1)).addScaledVector(n, .8).normalize(); const sp = rnd(14, 34) * sq;
      sparks.add(c.x, c.y, c.z, tD.x * sp, tD.y * sp, tD.z * sp, .26, .1, rnd(.3, .65), COL.streak, COL.streakEnd, 1.6, -22);
    }
    for (let k = 0, m = Math.round(12 * lite); k < m; k++) sparks.add(c.x + rnd(-1, 1), c.y + rnd(-1, 1), c.z + rnd(-1, 1), rnd(-6, 6) + n.x * 4, rnd(4, 12), rnd(-6, 6) + n.z * 4, .2, .08, rnd(1, 1.7), COL.ember, COL.emberEnd, 1.8, -5);
    const floor = hasGround ? gy : p.y - 40;
    for (let k = 0, m = mobile ? TB.debrisPhone : TB.debris; k < m; k++) {
      tD.set(rnd(-1, 1), rnd(-.1, 1), rnd(-1, 1)).addScaledVector(n, 1.1).normalize(); const sp = rnd(8, 22) * sq;
      addDebris(c.x + tD.x * .5, c.y + tD.y * .5, c.z + tD.z * .5, tD.x * sp, tD.y * sp + rnd(2, 8), tD.z * sp, rnd(.3, .8) * sq, rnd(1.4, 2.4), floor, pickDebris());
    }
    addDecal(p, n, R * 1.6, 1, 9);
    ringAt(p, n, R * 1.7, .32, '#ffe7b0', .5, true);
    if (hasGround) {
      ringAt(tF.set(p.x, gy + .1, p.z), UP, R * 3, .6, '#f1e3c4', .75, true);
      for (let k = 0, m = Math.round(14 * lite); k < m; k++) {
        const a = k / m * 6.283 + rnd(-.2, .2), sp = rnd(10, 18), ca = Math.cos(a), sa = Math.sin(a);
        smoke.add(p.x + ca * R * .4, gy + .6, p.z + sa * R * .4, ca * sp, rnd(.5, 2), sa * sp, R * .12, R * rnd(.28, .45), rnd(1, 1.6), COL.dust, COL.dustEnd, 2.6, .8);
      }
    }
    const ev = blastEv.find(e => !e.on) || blastEv[0];
    ev.on = true; ev.age = 0; ev.p.copy(c); ev.n.copy(n); ev.R = R; ev.col = 0; ev.lick = 0;
    audio?.play('boom', scale);
  }
  function updateBlastEvents(dt) {
    for (const e of blastEv) {
      if (!e.on) continue; e.age += dt; const R = e.R, c = e.p, n = e.n;
      if (e.age < .3) { e.lick += dt * 34 * lite; while (e.lick >= 1) { e.lick--; tD.set(rnd(-1, 1), rnd(0, 1), rnd(-1, 1)).normalize(); const o = rnd(R * .1, R * .4);
        fireball.addFree(c.x + tD.x * o, c.y + tD.y * o + e.age * 4, c.z + tD.z * o, tD.x * 3 + n.x * 3, rnd(4, 8), tD.z * 3 + n.z * 3, R * .08, R * rnd(.2, .32), rnd(.4, .6), 2.5, 7); } }
      if (e.age > .06 && e.age < 1) { e.col += dt * 30 * lite; while (e.col >= 1) { e.col--; const w = R * .2 * (1 - e.age * .5);
        plume.add(c.x + n.x * 1.2 + rnd(-w, w), c.y + n.y * 1.2 + rnd(0, R * .25), c.z + n.z * 1.2 + rnd(-w, w),
          rnd(-1.2, 1.2) + n.x * 2 + WIND.x * .6, rnd(7, 15), rnd(-1.2, 1.2) + n.z * 2 + WIND.z * .6, R * .1, R * rnd(.26, .42), rnd(1.9, 2.8), COL.colA, COL.colB, .9, 1.8, Infinity, null, 0, .55); } }
      if (e.age >= 1) e.on = false;
    }
  }

  // ---------- minigun ----------
  function bullet(now) {
    const j = TM.spread * Math.PI / 180 / Math.max(.1, THREE.MathUtils.degToRad(camera.fov) / 2) * aim.h / 2;
    const h = probe(aim.x + rnd(-j, j), aim.y + rnd(-j, j)); st.shots++; st.lastAim = h;
    worldOf(VM.minigun.muzzle, muzzle);
    if (h) tB.copy(h.point); else tB.copy(camPos).addScaledVector(dir.set(rnd(-.01, .01), rnd(-.01, .01), -1).applyQuaternion(camQ), 160);
    tA.copy(muzzle).lerp(tB, .02); addTracer(tA, tB); // from the muzzle (the gun is drawn over the first part)
    const fl = VM.minigun.flash; fl.visible = true; fl.userData.until = now + rnd(.025, .045); fl.rotation.z = rnd(0, 6.3); fl.scale.set(rnd(.9, 1.5), rnd(.9, 1.5), rnd(.7, 1.6));
    st.flashGlow = Math.max(st.flashGlow, rnd(.7, 1));
    if ((st.shots % 3) === 0) { worldOf(VM.minigun.muzzle, tA); puffSteam(tA, .5); }
    ejectCasing(); audio?.play('bullet'); recoil(rnd(2.2, 3)); onKick('minigun');
    if (!h) return;
    const p = h.point, n = h.normal;
    if (h.kind === 'protected') {
      for (let k = 0; k < 6; k++) { const s = rnd(4, 9); sparks.add(p.x, p.y, p.z, rnd(-3, 3) + n.x * s, rnd(-1, 4) + n.y * s, rnd(-3, 3) + n.z * s, .24, .06, rnd(.2, .38), k % 2 ? COL.paleYellow : COL.blue, COL.blueEnd, 0, -16); }
      if ((st.shells++ % 3) === 0) { shield?.flash(p, n, 3.6, { life: .3 }); audio?.play('ping'); }
      return;
    }
    if (h.kind === 'building') onBullet(h);
    // impact: streak sparks thrown along the reflected path, sometimes a long ricochet, concrete dust, chips, a hole
    tE.subVectors(p, muzzle).normalize(); tF.copy(tE).addScaledVector(n, -2 * tE.dot(n));
    for (let k = 0; k < 5; k++) { const s = rnd(8, 18); sparks.add(p.x + n.x * .1, p.y + n.y * .1, p.z + n.z * .1, tF.x * s + rnd(-4, 4) + n.x * 3, tF.y * s + rnd(-1, 5) + n.y * 3, tF.z * s + rnd(-4, 4) + n.z * 3, .34, .08, rnd(.14, .3), COL.sparkHot, COL.sparkEnd, 1, -18); }
    sparks.add(p.x + n.x * .3, p.y + n.y * .3, p.z + n.z * .3, 0, 0, 0, rnd(1, 1.5), .3, .06, COL.paleYellow, COL.sparkEnd); // impact flash
    if (Math.random() < TM.ricochet) {
      const s = rnd(32, 46); sparks.add(p.x + n.x * .2, p.y + n.y * .2, p.z + n.z * .2, tF.x * s + rnd(-4, 4), tF.y * s + rnd(0, 6), tF.z * s + rnd(-4, 4), .26, .14, rnd(.25, .38), COL.paleYellow, COL.sparkEnd, .4, -6);
      if (now - st.ricAt > .3) { st.ricAt = now; audio?.play('ricochet'); }
    }
    soot.add(p.x + n.x * .5, p.y + n.y * .5, p.z + n.z * .5, n.x * 2 + rnd(-.6, .6), .6 + n.y + rnd(0, .8), n.z * 2 + rnd(-.6, .6), .3, rnd(1.1, 1.7), rnd(.55, .85), COL.concrete, COL.concreteEnd, 2.4, .4);
    for (let k = 0; k < TM.chips; k++) addDebris(p.x + n.x * .2, p.y + n.y * .2, p.z + n.z * .2, n.x * rnd(4, 8) + rnd(-3, 3), n.y * rnd(4, 8) + rnd(2, 6), n.z * rnd(4, 8) + rnd(-3, 3), rnd(.1, .22), rnd(.7, 1.1), p.y - 30, pickDebris());
    addDecal(p, n, rnd(2.1, 2.7), 0, TM.decalLife);
    if (now - st.tickAt > 1 / TM.impactTicks) { st.tickAt = now; audio?.play('impact'); }
  }
  function ejectCasing() {
    const c = casingItems[casingNext++ % CASINGS]; tA.copy(VM.minigun.eject); VM.minigun.g.localToWorld(tA); root.worldToLocal(c.p.copy(tA));
    c.v.set(rnd(.45, .85), rnd(.6, 1), rnd(-.25, .1)).multiplyScalar(2 * holder.scale.x); c.q.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), 1).normalize(); c.w.set(rnd(-24, 24), rnd(-24, 24), rnd(-24, 24)); c.age = 0; c.s = rnd(.9, 1.1);
  }
  // camera-space puff at a world point (muzzle smoke, steam off hot barrels); size in holder scales
  function puffSteam(world, size = 1) { const s = steamItems[steamNext++ % STEAM]; root.worldToLocal(s.p.copy(world)); s.v.set(rnd(-.05, .05), rnd(.25, .45), rnd(-.08, .02)).multiplyScalar(2 * holder.scale.x); s.age = 0; s.life = rnd(.55, .9); s.s = size; s.r = rnd(0, 6.3); }
  function steamAt(lx, ly, lz) { tA.set(lx, ly, lz); VM.minigun.g.localToWorld(tA); puffSteam(tA, 1); }
  function updateMinigun(dt, now) {
    const firing = tool === 'minigun' && holding && visible; // round 5: no overheat stop - it fires as long as it is held
    st.spin = THREE.MathUtils.clamp(st.spin + (firing ? dt / TM.spinUp : -dt / .5), 0, 1);
    VM.minigun.spin.rotation.z += dt * (4 + st.spin * 40);
    if (firing && st.spin > .55) {
      st.shotAcc += dt; const iv = 1 / TM.rate;
      // barrel heat is look only (glowing barrels, heat shimmer glow, steam wisps): it rises to 1 over TM.heatUp s of fire
      while (st.shotAcc >= iv) { st.shotAcc -= iv; bullet(now); st.lastBullet = now; st.heat = Math.min(1, st.heat + iv / TM.heatUp); }
    } else st.shotAcc = Math.min(st.shotAcc, 0);
    if (now - st.lastBullet > .18) st.heat = Math.max(0, st.heat - dt / TM.cool);
    const hh = st.heat ** 2.2; VM.minigun.hot.emissive.setRGB(hh * 1.4, hh * .32, hh * .06); VM.minigun.hot.color.setRGB(1 + hh * .3, 1 - hh * .45, 1 - hh * .65);
    if (tool === 'minigun' && st.heat > .75 && Math.random() < dt * 6) steamAt(rnd(-.05, .05), .12, -rnd(.8, 1.9));
    return firing;
  }

  // ---------- flamethrower ----------
  // One bite = the contact, a turning ring of points around it (char spreads, a patch crumbles together) and points
  // behind it along the stream (it eats into the building instead of only peeling its skin).
  function bite(point, n, amount, targetId, ray) {
    biteHit.point.copy(point); biteHit.normal.copy(n); biteHit.targetId = targetId; st.scorchTicks++; onScorch(biteHit, amount);
    tC.set(0, 1, 0); if (Math.abs(n.y) > .9) tC.set(1, 0, 0); tC.cross(n).normalize(); tD.crossVectors(n, tC);
    st.spreadPhase += 1.3;
    for (let k = 0; k < TF.spreadPoints; k++) {
      const a = st.spreadPhase + k * Math.PI * 2 / TF.spreadPoints;
      biteHit.point.copy(point).addScaledVector(tC, Math.cos(a) * TF.spreadRadius).addScaledVector(tD, Math.sin(a) * TF.spreadRadius);
      biteHit.normal.copy(n); biteHit.targetId = targetId; st.scorchTicks++; onScorch(biteHit, amount * TF.spreadShare);
    }
    for (let k = 1; k <= TF.depthPoints; k++) {
      biteHit.point.copy(point).addScaledVector(ray, k * TF.depthStep); biteHit.normal.copy(n); biteHit.targetId = targetId; st.scorchTicks++; onScorch(biteHit, amount * TF.depthShare);
    }
  }
  function feedSpot(p, n, id, now, dt) {
    let best = null, bd = 2.6 * 2.6, cold = spots[0];
    for (const s of spots) { if (s.heat > 0) { const d = s.p.distanceToSquared(p); if (d < bd) { bd = d; best = s; } } if (s.heat < cold.heat) cold = s; }
    if (!best) { best = cold; best.p.copy(p); best.heat = 0; best.emit = 0; best.lick = 0; } else best.p.lerp(p, .25);
    best.n.copy(n); best.targetId = id; best.fedAt = now; best.heat = Math.min(1, best.heat + dt * 2.2 + .02);
  }
  // Burning spots smoke (thicker while fed, lingering after), lick small flames and keep charring a little after the stream leaves.
  function updateBurn(dt, now) {
    if (!(dt > 0)) return;
    st.afterAcc += dt; const chunk = st.afterAcc, doChar = chunk >= TF.tick * 3; if (doChar) st.afterAcc = 0;
    let hot = 0; for (const s of spots) if (s.heat > 0) hot++;
    st.burning = hot; const share = 1 / Math.max(1, hot / 3), g = TF.size;
    for (const s of spots) {
      if (s.heat <= 0) continue;
      const fed = now - s.fedAt < .25, n = s.n;
      if (!fed) s.heat = Math.max(0, s.heat - dt / TF.smokeLinger);
      s.emit += dt * TF.smokeRate * s.heat * share * (fed ? 1 : .85);
      while (s.emit >= 1) { s.emit--;
        soot.add(s.p.x + n.x * 1.4 + rnd(-.8, .8), s.p.y + n.y * 1.4 + rnd(.6, 2), s.p.z + n.z * 1.4 + rnd(-.8, .8), WIND.x + n.x * 1.2 + rnd(-.6, .6), rnd(2.2, 4), WIND.z + n.z * 1.2 + rnd(-.6, .6),
          .9 * g, rnd(3.2, 5) * g, rnd(2.4, 3.6), COL.sootA, COL.sootB, .45, 1.1, Infinity, null, 0, .7); }
      if (!fed && s.heat > .4) {
        // flickering tongues licking up off the burnt patch (the same shader-shaped fire as the stream)
        s.lick += dt * 18 * s.heat * lite; while (s.lick >= 1) { s.lick--; const z = g * fireWidth * (.45 + s.heat * .5);
          spotFire.addFree(s.p.x + n.x * .6 + rnd(-1.1, 1.1), s.p.y + n.y * .6 + rnd(-.5, .3), s.p.z + n.z * .6 + rnd(-1.1, 1.1), rnd(-.5, .5) + n.x * .8, rnd(3.5, 6), rnd(-.5, .5) + n.z * .8, rnd(.7, 1.1) * z, rnd(.3, .48), .55 + .3 * s.heat, 2.2, TF.lift * 2.5); }
        if (Math.random() < dt * 14) sparks.add(s.p.x + n.x * .5, s.p.y + n.y * .5, s.p.z + n.z * .5, 0, 0, 0, 2.2 * s.heat, 1.6 * s.heat, .14, COL.ember, COL.emberEnd); // warm glow
        if (Math.random() < dt * 6 * s.heat) sparks.add(s.p.x + n.x * .6, s.p.y + n.y * .6, s.p.z + n.z * .6, rnd(-1.5, 1.5) + n.x * 2, rnd(2.5, 5), rnd(-1.5, 1.5) + n.z * 2, .18, .06, rnd(.6, 1.1), COL.ember, COL.emberEnd, .6, 2.5);
      }
      if (doChar && !fed && s.heat > .3 && TF.afterburn > 0) {
        burnHit.point.copy(s.p); burnHit.normal.copy(n); burnHit.targetId = s.targetId; st.scorchTicks++; onScorch(burnHit, TF.charPerSecond * TF.afterburn * s.heat * chunk);
      }
    }
  }
  function updateFlamer(dt, now) {
    const firing = tool === 'flamethrower' && holding && visible;
    flames.limit = flameCap();
    let hitLit = false;
    if (firing) {
      if (now >= st.nextProbe) {
        const elapsed = st.nextProbe ? Math.min(.25, now - st.nextProbe + TF.tick) : 0; st.nextProbe = now + TF.tick;
        st.flameHit = probe(aim.x, aim.y);
        const h = st.flameHit;
        st.fxKind = h ? h.kind : null; if (h) { st.fxPoint.copy(h.point); st.fxNormal.copy(h.normal); }
        if (h) st.ray.subVectors(h.point, camPos).normalize(); else screenRay(st.ray);
        if (h?.kind === 'protected') {
          st.burnAt = -9; // never follow through a shield
          if (!st.flameShield || !st.flameShield.active) { st.flameShield = shield?.flash(h.point, h.normal, 7, { life: .5 }) || null; audio?.play('shield'); st.pingAt = now; }
          shield?.holdAt(st.flameShield, h.point, h.normal);
          if (now - st.pingAt > TS.pingInterval) { st.pingAt = now; audio?.play('ping'); }
        } else {
          if (st.flameShield) { shield?.release(st.flameShield); st.flameShield = null; }
          if (h?.kind === 'building') {
            st.burnDist = h.point.distanceTo(camPos); st.burnAt = now; st.burnDepth = 0; st.burnTarget = h.targetId;
            if (elapsed > 0) { bite(h.point, h.normal, TF.charPerSecond * elapsed, h.targetId, st.ray); feedSpot(h.point, h.normal, h.targetId, now, elapsed); }
          } else if (elapsed > 0 && now - st.burnAt < TF.followTime && (!h || h.point.distanceTo(camPos) > st.burnDist + 1)) {
            // the stream punched through: keep eating deeper along the current ray behind the last contact
            st.burnDepth = Math.min(TF.burrowMax, st.burnDepth + TF.burrowSpeed * elapsed);
            tF.copy(camPos).addScaledVector(st.ray, st.burnDist + st.burnDepth); tG.copy(st.ray).negate();
            bite(tF, tG, TF.charPerSecond * TF.burrowShare * elapsed, st.burnTarget, st.ray); feedSpot(tF, tG, st.burnTarget, now, elapsed);
            st.fxKind = 'air'; st.fxPoint.copy(tF); st.fxNormal.copy(tG); // the flames vanish into the hole (no splat, no splash)
          }
        }
      }
      const hasFx = !!st.fxKind; worldOf(VM.flamethrower.muzzle, muzzle);
      if (hasFx) tB.copy(st.fxPoint); else tB.copy(camPos).addScaledVector(dir.set(0, 0, -1).applyQuaternion(camQ), 60);
      dir.subVectors(tB, muzzle); const reach = dir.length() || 1; dir.divideScalar(reach);
      flames.dst = flameDst.copy(tB);
      const flight = TF.flight, grow = TF.size * fireWidth * THREE.MathUtils.clamp(reach / 45, .6, 2);
      // the stream strip shoots out from the nozzle over one flight time (and starts over if it was still breaking off)
      if (!stream.on || stream.tail > 0) { stream.on = true; stream.head = 0; stream.tail = 0; }
      stream.head = Math.min(1, stream.head + dt / (flight * .9)); stream.end.copy(tB); stream.w1 = TF.streamWidth * grow;
      // tongues riding the stream: most of the budget; the rest is left for licks off the surface and the burnt spots
      st.emitAcc += dt * flameCap() * TF.streamShare / (flight + .45);
      const hosp = st.fxKind === 'protected', nrm = hasFx && st.fxKind !== 'air' ? st.fxNormal : null;
      while (st.emitAcc >= 1) { st.emitAcc -= 1;
        // the cone: each tongue aims at a point jittered around the target, wider with distance
        const j = TF.cone * reach;
        tC.set(tB.x + rnd(-j, j), tB.y + rnd(-j * .7, j), tB.z + rnd(-j, j)); if (nrm) tC.addScaledVector(nrm, -((tC.x - tB.x) * nrm.x + (tC.y - tB.y) * nrm.y + (tC.z - tB.z) * nrm.z)); // stay on the wall plane
        flames.add(muzzle, tC, flight * rnd(.85, 1.1), flight + rnd(.3, .55), 1.5 * grow * rnd(.7, 1.15), nrm, hosp ? rnd(10, 16) : rnd(4, 8.5), tB);
      }
      // embers thrown off the stream body (screen-even point along it, flying on with the stream and falling)
      if (Math.random() < dt * 9 * lite) {
        const g = rnd(.3, .9), z0 = Math.max(.3, muzzle.distanceTo(camPos)), z1 = Math.max(z0 + .3, tB.distanceTo(camPos)), f = g * z0 / (z1 - g * (z1 - z0)), sp = rnd(6, 14);
        tC.lerpVectors(muzzle, tB, f); sparks.add(tC.x, tC.y, tC.z, dir.x * sp + rnd(-1.5, 1.5), dir.y * sp + rnd(.5, 3), dir.z * sp + rnd(-1.5, 1.5), rnd(.12, .2), .05, rnd(.35, .7), COL.ember, COL.emberEnd, 1.2, -4);
      }
      if (hasFx && !hosp && st.fxKind !== 'air' && stream.head >= 1) {
        const p = st.fxPoint, n = st.fxNormal; hitLit = true;
        // fire rolling over the hit surface and licking upward around the contact
        tC.set(0, 1, 0); if (Math.abs(n.y) > .9) tC.set(1, 0, 0); tC.cross(n).normalize(); tD.crossVectors(n, tC);
        st.lickAcc += dt * TF.surfaceLicks * lite;
        while (st.lickAcc >= 1) { st.lickAcc -= 1;
          const a = rnd(0, 6.283), r = Math.sqrt(Math.random()) * TF.radius * .55 * grow, ca = Math.cos(a) * r, sa = Math.sin(a) * r;
          tE.copy(p).addScaledVector(tC, ca).addScaledVector(tD, sa).addScaledVector(n, .5 * grow);
          flames.addFree(tE.x, tE.y, tE.z, n.x * 1.2 + rnd(-1, 1), rnd(2.5, 5.5), n.z * 1.2 + rnd(-1, 1), rnd(.55, .95) * grow, rnd(.28, .5), rnd(.6, .85), 2.4, TF.lift * 3);
        }
        // embers rise off the burning spot (smoke comes from the burn spots)
        if (Math.random() < dt * 26 * lite) sparks.add(p.x + n.x * .6 + rnd(-.8, .8), p.y + n.y * .6 + rnd(-.4, .8), p.z + n.z * .6 + rnd(-.8, .8), rnd(-1.6, 1.6) + n.x * 2, rnd(2.5, 5.5), rnd(-1.6, 1.6) + n.z * 2, rnd(.16, .26), .06, rnd(.6, 1.2), COL.ember, COL.emberEnd, .6, 2.5);
        // light splash on the hit surface
        splash.position.copy(p).addScaledVector(n, .25); splash.quaternion.setFromUnitVectors(Z_AXIS, n);
        splash.scale.setScalar(TF.radius * 1.5 * grow * (.9 + .2 * Math.random()));
      } else st.lickAcc = 0;
      st.crackAcc += dt * 16; if (st.crackAcc >= 1) { st.crackAcc -= Math.floor(st.crackAcc); if (Math.random() < .9) audio?.play('crackle'); }
      if (Math.random() < dt * 20) recoil(rnd(-.5, .7)); if (Math.random() < dt * 30) onKick('flamethrower');
    } else {
      st.emitAcc = 0; flames.dst = null; st.fxKind = null; if (st.flameShield) { shield?.release(st.flameShield); st.flameShield = null; }
      // after a release the stream breaks off the nozzle and its tail runs out to the wall
      if (stream.on) { stream.tail += dt / (TF.flight * .9); if (stream.tail >= stream.head || tool !== 'flamethrower' || !visible) stream.on = false; }
    }
    // light splash and the nozzle heat follow the trigger (fade in fast, out slower)
    splashLevel = Math.max(0, Math.min(1, splashLevel + (hitLit ? dt * 8 : -dt * 3)));
    splash.visible = splashLevel > .01; splash.material.opacity = splashLevel * (.42 + .16 * Math.random());
    glowLevel = Math.max(0, Math.min(1, glowLevel + (firing ? dt * 12 : -dt * 5)));
    const f = .8 + Math.random() * .4; VM.flamethrower.pilot.scale.setScalar(firing ? f * 1.4 : f); VM.flamethrower.pilotFlame.scale.set(.8, .8, 1.2 + Math.random() * .9);
    return firing;
  }
  // muzzle glow + the light it throws on the gun: flame heat, minigun / bazooka shot flashes; heat glow on hot barrels
  function updateGlow(dt) {
    st.flashGlow = Math.max(0, st.flashGlow - dt * (tool === 'bazooka' ? 9 : 26));
    const level = tool === 'flamethrower' ? glowLevel : st.flashGlow, on = visible && !!tool;
    const flick = .85 + .3 * Math.random();
    glow.visible = on && level > .01;
    if (glow.visible) { // its position (and the light's) is set in placeGlow(), after the frame's final pose
      glow.material.color.copy(tool === 'flamethrower' ? COL.glowF : COL.glowM);
      glow.scale.setScalar(holder.scale.x * (tool === 'flamethrower' ? .22 + .5 * level : tool === 'bazooka' ? 1.3 * level : .6 * level) * flick);
      glow.material.opacity = tool === 'flamethrower' ? .25 + .65 * level : Math.min(1, level * 1.1);
    }
    fireLight.intensity = on ? level * (tool === 'flamethrower' ? 2.2 : tool === 'bazooka' ? 5 : 2.6) * flick : 0;
    if (fireLight.intensity > 0) { fireLight.color.copy(tool === 'flamethrower' ? COL.lightF : COL.lightM); fireLight.distance = holder.scale.x * 3; }
    const hot = tool === 'minigun' && on ? Math.max(0, (st.heat - .45) / .55) : 0;
    heatGlow.visible = hot > .01;
    if (heatGlow.visible) { heatGlow.scale.set(holder.scale.x * .5 * (.9 + .2 * Math.random()), holder.scale.x * .42, 1); heatGlow.material.opacity = hot * (.45 + .15 * Math.random()); }
  }
  // Round 5: the muzzle glow, the light it throws on the gun and the barrel heat glow sit on the barrel as posed for the frame
  // being drawn (they used to take the pose before the last one and trailed the barrel by up to 80 px at low frame rates).
  function placeGlow() {
    if (!visible || !tool) return;
    if (glow.visible || fireLight.intensity > 0) { worldOf(VM[tool].muzzle, tA); root.worldToLocal(glow.position.copy(tA)); fireLight.position.copy(glow.position); fireLight.position.y += holder.scale.x * .15; }
    if (heatGlow.visible) { tA.copy(VM.minigun.muzzle); tA.z += .35; VM.minigun.g.localToWorld(tA); root.worldToLocal(heatGlow.position.copy(tA)); }
  }
  // Charred pieces that crumbled: a puff of ash, a few chunks and the crumble rattle (called by the caller with the scorch result).
  let crumbleAt = -9, ashAt = -9;
  function crumbled(point, normal, now) {
    if (now - ashAt > .07) { ashAt = now; for (let k = 0; k < 2; k++) soot.add(point.x + normal.x * 1.2 + rnd(-.6, .6), point.y + normal.y + rnd(0, 1), point.z + normal.z * 1.2 + rnd(-.6, .6), rnd(-1, 1), rnd(1.4, 2.6), rnd(-1, 1), .5, rnd(1.6, 2.4), rnd(1, 1.5), COL.ash, COL.ashEnd, 1.2, 1); }
    if (Math.random() < .35) addDebris(point.x + normal.x * .4, point.y + normal.y * .4, point.z + normal.z * .4, normal.x * 3 + rnd(-2, 2), rnd(1, 4), normal.z * 3 + rnd(-2, 2), rnd(.2, .45), rnd(.9, 1.4), point.y - 30, DEBRIS_COLORS[6]);
    if (now - crumbleAt > .12) { crumbleAt = now; audio?.play('crumble'); }
  }

  // ---------- frame ----------
  function update(dt, now, simDt = dt) {
    if (disposed) return;
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0, sim = Number.isFinite(simDt) ? Math.max(0, Math.min(.1, simDt)) : 0;
    camera.getWorldQuaternion(camQ); camera.getWorldPosition(camPos);
    // the gun follows this frame's camera before anything reads its muzzle (pose() refines it after the caller's shake)
    if (root.visible) { root.position.copy(camPos); root.quaternion.copy(camQ); root.updateMatrixWorld(true); }
    // keep the barrel on the surface under the pointer (cheap: reuse the latest probe of the active weapon)
    const live = tool === 'flamethrower' ? st.flameHit : tool === 'minigun' && now - st.lastBullet < .25 ? st.lastAim : null;
    if (live) { st.view.aimPoint.copy(live.point); st.view.hasAim = true; } else st.view.hasAim = false;
    const spinning = updateMinigun(step, now), flaming = updateFlamer(step, now);
    st.firing = spinning || flaming;
    audio?.setLoops(tool === 'minigun' && visible ? st.spin : 0, flaming, spinning && st.spin > .55);
    updateRockets(sim); updateBlastEvents(sim); updateBurn(step, now);
    if (!(tool === 'flamethrower' && visible)) flames.dst = null;
    uTime.value = (uTime.value + step) % 1000;
    smoke.update(sim); plume.update(sim); soot.update(step); flames.update(step); spotFire.update(step); fireball.update(sim); blast.update(sim); sparks.update(sim); updateDebris(sim); updateDecals(step);
    updateTracers(step); updateRings(step); updateFlashes(step); updateGlow(step);
    drawAnchored();
    if (tool === 'bazooka') { const r = (now - st.lastShot) / TB.cooldown, hd = VM.bazooka.head; hd.visible = r > .55; hd.position.z = VM.bazooka.headRest + Math.max(0, .9 - r) * 1.4; }
    if (VM.bazooka.flash.visible && now > VM.bazooka.flash.userData.until) VM.bazooka.flash.visible = false;
    if (VM.minigun.flash.visible && now > VM.minigun.flash.userData.until) VM.minigun.flash.visible = false;
    // casings (camera space): tumble, bounce once or twice on a floor just under the gun, then drop out of view
    let nc = 0;
    const floorY = holder.position.y - holder.scale.x * .55;
    for (const c of casingItems) { if (c.age >= .95) continue; c.age += step; c.v.y -= 11 * holder.scale.x * step; c.p.addScaledVector(c.v, step);
      if (c.p.y < floorY && c.v.y < 0 && c.age < .6) { c.p.y = floorY; c.v.y *= -.38; c.v.x *= .7; c.v.z *= .7; c.w.multiplyScalar(.6); }
      const wl = c.w.length(); if (wl > 1e-4) { spinStep.setFromAxisAngle(spinAxis.copy(c.w).divideScalar(wl), wl * step); c.q.premultiply(spinStep); }
      casingMesh.setMatrixAt(nc++, tmpM.compose(c.p, c.q, tmpS.setScalar(2 * holder.scale.x * c.s))); }
    casingMesh.count = nc; if (nc) casingMesh.instanceMatrix.needsUpdate = true;
    let ns = 0;
    for (const s of steamItems) { if (s.age >= s.life) continue; s.age += step; s.p.addScaledVector(s.v, step); s.r += step * .8; const k = s.age / s.life, sz = (.05 + k * .16) * (k > .7 ? (1 - k) / .3 : 1) * 2 * holder.scale.x * s.s;
      tmpQ.setFromAxisAngle(Z_AXIS, s.r); steamMesh.setMatrixAt(ns++, tmpM.compose(s.p, tmpQ, tmpS.setScalar(Math.max(1e-4, sz)))); }
    steamMesh.count = ns; if (ns) steamMesh.instanceMatrix.needsUpdate = true;
  }
  // Everything that starts at a barrel (tracers, the flame stream and its in-flight tongues, the muzzle glow) is placed from the gun as it is
  // posed for the frame being drawn: called at the end of update() and again from pose() after the caller's screen shake.
  function drawAnchored() {
    flames.src = tool === 'flamethrower' && visible ? worldOf(VM.flamethrower.muzzle, flameSrc) : null;
    flames.w0 = holder.scale.x * TF.nozzleWidth; drawTracers(); flames.draw(); spotFire.draw(); placeGlow();
    streamMesh.visible = stream.on && !!flames.src;
    if (streamMesh.visible) {
      const u = streamMat.uniforms; u.uA.value.copy(flames.src); u.uB.value.copy(stream.end); u.uRes.value.set(width, height);
      u.uW.value.set(holder.scale.x * TF.nozzleWidth, stream.w1); u.uSpan.value.set(stream.tail, stream.head); u.uAlpha.value = fireAlpha;
    }
  }
  // Check data (gameDiagnostics / 검증): the barrel tip and every live tracer's drawn tail / head and the stream origin, projected
  // with the camera as last drawn, in CSS px. fresh = the tail is still at its start (first .27 of the bolt's life).
  function muzzleCheck() {
    if (disposed || !visible || (tool !== 'minigun' && tool !== 'flamethrower')) return null;
    const P = v => { tE.copy(v).project(camera); return [+((tE.x * .5 + .5) * width).toFixed(2), +((-tE.y * .5 + .5) * height).toFixed(2)]; };
    const out = { tool, tip: P(worldOf(VM[tool].muzzle, tG)), tracers: [], stream: null };
    if (tool === 'minigun') for (let i = 0; i < tracerN; i++) { const it = tracerItems[i]; out.tracers.push([...P(tF.fromArray(trA.array, i * 3)), ...P(tF.fromArray(trB.array, i * 3)), it.age / it.life < .267 ? 1 : 0]); }
    if (tool === 'flamethrower' && streamMesh.visible) out.stream = P(streamMat.uniforms.uA.value);
    return out;
  }
  function render(renderer) {
    if (disposed || !visible || !tool) return false;
    overlayCamera.projectionMatrix.copy(camera.projectionMatrix); overlayCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    overlayCamera.matrixWorld.copy(camera.matrixWorld); overlayCamera.matrixWorldInverse.copy(camera.matrixWorldInverse);
    const autoClear = renderer.autoClear;
    try { renderer.autoClear = false; renderer.clearDepth(); renderer.render(overlayScene, overlayCamera); } finally { renderer.autoClear = autoClear; }
    return true;
  }
  function clear() {
    release(); smoke.clear(); plume.clear(); soot.clear(); flames.clear(); spotFire.clear(); fireball.clear(); stream.on = false; streamMesh.visible = false; blast.clear(); sparks.clear(); tracerN = 0; trGeo.instanceCount = 0; tracerMesh.visible = false;
    debN = 0; debMesh.count = 0; decUsed = 0; decNext = 0; decAlive = 0; decMesh.count = 0; decAge.fill(99);
    for (const r of rockets) { r.active = false; r.mesh.visible = false; } for (const m of rings) m.visible = false; for (const m of flashQuads) m.visible = false;
    for (const e of blastEv) e.on = false; for (const s of spots) { s.heat = 0; s.emit = 0; s.lick = 0; }
    for (const c of casingItems) c.age = 9; for (const s of steamItems) s.age = 9; casingMesh.count = steamMesh.count = 0;
    Object.assign(st, { lastShot: -9, spin: 0, heat: 0, shotAcc: 0, emitAcc: 0, nextProbe: 0, flameHit: null, flashGlow: 0, burnAt: -9, burning: 0, fxKind: null, afterAcc: 0 });
    rec.z = rec.v = 0; sway.x = sway.y = sway.vx = sway.vy = 0; audio?.stop();
  }
  return {
    setTool, setVisible, setAim, press, release, update, render, clear, crumbled,
    // Called after the caller's camera recoil so the gun stays glued to the lens.
    pose(dt) { if (!disposed && visible && tool) { pose(Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0); drawAnchored(); } },
    // Shield reaction helpers shared with the caller: blue sparks where a pellet / tool meets a shield.
    shieldSparks(p, n, count = 4) { for (let k = 0; k < count; k++) sparks.add(p.x, p.y, p.z, rnd(-4, 4) + n.x * 5, rnd(2, 6) + n.y * 5, rnd(-4, 4) + n.z * 5, .22, .08, .3, COL.blue, COL.blueEnd, 0, -14); },
    get holding() { return holding; },
    get firing() { return st.firing; },
    get heat() { heatView.heat = st.heat; return heatView; },
    get ready() { return tool !== 'bazooka' || performance.now() / 1000 - st.lastShot >= TB.cooldown; },
    get animating() {
      if (disposed) return false; if (visible && tool || smoke.n + plume.n + soot.n + flames.n + spotFire.n + fireball.n + +stream.on + blast.n + sparks.n + tracerN + debN + decAlive + st.burning > 0) return true;
      for (const r of rockets) if (r.active) return true; for (const e of blastEv) if (e.on) return true; for (const m of flashQuads) if (m.visible) return true; for (const m of rings) if (m.visible) return true; return false;
    },
    get stats() { return { tool, visible, holding, firing: st.firing, heat: +st.heat.toFixed(3), spin: +st.spin.toFixed(2), shots: st.shots, rocketsFired: st.rocketsFired, rocketsFlying: rockets.filter(r => r.active).length,
      scorchTicks: st.scorchTicks, burningSpots: st.burning, particles: { flames: flames.n, flameCap: flames.limit, stream: stream.on, spotFlames: spotFire.n, fireball: fireball.n, smoke: smoke.n, plume: plume.n, soot: soot.n, sootCap: soot.limit, blast: blast.n, sparks: sparks.n, tracers: tracerN, debris: debN, decals: decAlive }, audio: audio?.stats ?? null, muzzle: muzzleCheck() }; },
    dispose() { if (disposed) return; clear(); disposed = true; overlayScene.clear(); for (const o of owned) o.dispose(); },
  };
}
