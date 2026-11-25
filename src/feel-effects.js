// ?feel preview only: big-moment hit-stop and release bursts layered on top of the
// existing effects. main.js imports this file dynamically when the page URL has
// `?feel`; without the flag it is never loaded and the game is unchanged.
// Budget: five pooled instanced draws (only while alive), fixed caps, no textures
// (soft alpha is procedural in the shader), no per-frame allocations.
// The specifier must match the one src/engine/campus-engine.js uses, so both share one module instance.
import { setDebrisGroundListener, setDebrisCollapse } from './model-destruction.js?v=lz69';

// Caps (instances; one draw per pool while alive). puffs 64->96: dust now lives 2-4 s instead of
// .8-2.5 s, so a clear (up to 3 buildings x 18) + a bomb (12) + landing dust (~12/s x 1.7 s) overlap.
// sparks 48->128: a shotgun shot is up to 7 pellets x 8 sparks = 56, two shots can overlap.
// glows 16->32: 7 pellet flashes + 1 hit flash per shot without evicting bomb/clear flashes.
const CAPS = Object.freeze({ puffs: 96, glows: 32, sparks: 128, chips: 40, rings: 6 });
const LANDING_PUFF_LIMIT = 60; // landing puffs never evict; bursts keep room above this
const LANDING_RATE = 12, LANDING_BURST = 5; // landing puffs per second / token bucket size
const MAX_CONTINUOUS_STOP = .5;
// Construction-site dust drifts downwind (world units/s, fixed per session) and rises slowly.
const WIND_X = 1.9, WIND_Z = .75;

const VERTEX = `
attribute vec3 iPos; attribute vec4 iA; attribute vec4 iColor;
uniform float uStretch; uniform float uMaxLen; uniform float uPixel; uniform vec2 uMinPx;
varying vec2 vUv; varying vec4 vColor; varying float vThick;
#if MODE==3
varying vec4 vDust;
#endif
void main(){
  vUv=uv; vColor=iColor; vThick=iA.y;
#if MODE==2
  vec3 p=iPos+vec3(position.x,0.0,-position.y)*(iA.x*2.0);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
#else
  vec4 mv=modelViewMatrix*vec4(iPos,1.0);
#if MODE==0
  float c=cos(iA.z),s=sin(iA.z);vec2 q=position.xy*iA.xy;
  mv.xy+=vec2(c*q.x-s*q.y,s*q.x+c*q.y);
#elif MODE==3
  // Dust billboard (iA = size, age 0..1, rotation, seed). Pushed toward the camera by half its
  // radius so it does not slice into the ground, faded when it gets close to the camera.
  float c=cos(iA.z),s=sin(iA.z);vec2 q=position.xy*iA.x;
  mv.xy+=vec2(c*q.x-s*q.y,s*q.x+c*q.y);
  float depth=-mv.z;mv.z+=min(iA.x*.25,depth*.3);
  vDust=vec4(iA.w,s,c,smoothstep(iA.x*.7,iA.x*2.2,depth));
#else
  vec3 vd=(modelViewMatrix*vec4(iA.xyz,0.0)).xyz;float l=length(vd.xy);
  vec2 d=l>1e-4?vd.xy/l:vec2(0.0,1.0),n=vec2(-d.y,d.x);
  float px=uPixel*max(-mv.z,.01),w=max(iA.w,uMinPx.x*px);
  float len=max(min(length(iA.xyz)*uStretch,uMaxLen)*(l/max(length(vd),1e-4))+w,uMinPx.y*px);
#if GLOW
  w*=2.4; // wide quad: hot core in the middle third, red halo around it
#endif
  mv.xy+=d*(position.y-0.5)*len+n*position.x*w;
#endif
  gl_Position=projectionMatrix*mv;
#endif
}`;
const FRAGMENT = `
varying vec2 vUv; varying vec4 vColor; varying float vThick;
#if MODE==3
uniform float uTime; varying vec4 vDust;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
#endif
void main(){
  float a;vec3 rgb=vColor.rgb;
#if MODE==0
  float r=length(vUv*2.0-1.0);a=clamp(1.0-r,0.0,1.0);a*=a;
#elif MODE==1
#if HARD
  a=1.0;
#elif GLOW
  float x=abs(vUv.x*2.0-1.0),core=smoothstep(.42,.0,x),halo=(1.0-x)*(1.0-x);
  a=(core*.95+halo*.55)*mix(.18,1.0,vUv.y);
  rgb=mix(rgb,vec3(1.0,.9,.62),core*.7*vUv.y);
#else
  a=(1.0-abs(vUv.x*2.0-1.0))*mix(.2,1.0,vUv.y);
#endif
#elif MODE==3
  // Billowing dust: soft body + fbm-eroded, torn edge that frays further with age; lit from
  // screen-up (the quad is rotated, vDust.yz = sin/cos of that rotation).
  vec2 c=vUv*2.0-1.0;float r=length(c);if(r>1.0)discard;
  float seed=vDust.x,t=vThick;
  vec2 np=c*1.7+seed*vec2(37.1,91.7)+vec2(uTime*.11,-uTime*.16);
  float n=vnoise(np)*.57+vnoise(np*2.03+vec2(17.0,9.0))*.29+vnoise(np*4.1+vec2(3.0,41.0))*.14;
  float g=vnoise(c*7.5+seed*13.0+uTime*.35);
  float body=(1.0-r)*1.3+(n-.5)*1.15+(g-.5)*.45-t*.38;
  a=smoothstep(0.0,.42,body)*(.82+.18*n);
  float lit=clamp(.5+dot(c,vec2(vDust.y,vDust.z))*.5+(n-.5)*.9,0.0,1.0);
  rgb*=mix(vec3(.6,.58,.6),vec3(1.13,1.09,1.0),lit);
  a*=vDust.w;
#else
  float r=length(vUv*2.0-1.0);
  a=smoothstep(1.0,.965,r)*smoothstep(1.0-vThick-.05,1.0-vThick,r)+.1*smoothstep(1.0,.5,r)*step(r,1.0);
#endif
  a*=vColor.a;if(a<.003)discard;
  gl_FragColor=vec4(rgb,a);
}`;

/** @returns null-safe preview API; see main.js for the gating points. */
export function createFeelEffects(THREE, scene, { reducedMotion = false, stop, groundHeight, canvas, camera } = {}) {
  const requested = Number.parseFloat(stop);
  const stopSeconds = Number.isFinite(requested) ? Math.min(.5, Math.max(.05, requested)) : .15;
  const freeze = reducedMotion ? Math.min(.1, stopSeconds * .5) : stopSeconds;
  const heightAt = typeof groundHeight === 'function' ? groundHeight : () => 0;
  const root = new THREE.Group(); root.name = 'feel-preview-effects'; scene.add(root);
  let seed = 0x5eed1, disposed = false, suppressed = false, warmFrames = 2, frameNo = 0, shotFrame = -1;
  // World size of one screen pixel at view depth 1; streaks keep a minimum on-screen size.
  const pixelUniform = { value: .001 }, timeUniform = { value: 0 }; // time: simulated seconds (stops during the hit-stop)
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

  // Dense pools: alive particles occupy [0,n), so the instance arrays upload as-is.
  function pool(name, capacity, mode, { additive = false, hard = false, glow = false, stretch = .05, maxLength = 3, minPx = [0, 0], fade = 'smoke', order = 0, wind = 0 } = {}) {
    const base = new THREE.PlaneGeometry(1, 1), geometry = new THREE.InstancedBufferGeometry();
    geometry.index = base.index; geometry.setAttribute('position', base.getAttribute('position')); geometry.setAttribute('uv', base.getAttribute('uv'));
    const instanced = (array, size) => { const a = new THREE.InstancedBufferAttribute(array, size); a.setUsage(THREE.DynamicDrawUsage); return a; };
    const pos = new Float32Array(capacity * 3), aux = new Float32Array(capacity * 4), col = new Float32Array(capacity * 4);
    const posAttr = instanced(pos, 3), auxAttr = instanced(aux, 4), colAttr = instanced(col, 4);
    geometry.setAttribute('iPos', posAttr); geometry.setAttribute('iA', auxAttr); geometry.setAttribute('iColor', colAttr);
    // One zeroed (alpha 0, discarded) instance during the warm-up frames: a real draw, so the GPU pipeline is
    // built at boot instead of on the first explosion (a 0-instance draw may be skipped by the driver).
    geometry.instanceCount = 1;
    const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, defines: { MODE: mode, HARD: hard ? 1 : 0, GLOW: glow ? 1 : 0 },
      uniforms: { uStretch: { value: stretch }, uMaxLen: { value: maxLength }, uPixel: pixelUniform, uMinPx: { value: new THREE.Vector2(...minPx) }, uTime: timeUniform }, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.frustumCulled = false; mesh.visible = true; mesh.renderOrder = order; root.add(mesh);
    const f = () => new Float32Array(capacity);
    return { name, capacity, mode, fade, wind, mesh, base, geometry, material, pos, aux, col, posAttr, auxAttr, colAttr, n: 0, uploaded: 0, dirty: false, spawned: 0, evicted: 0,
      px: f(), py: f(), pz: f(), vx: f(), vy: f(), vz: f(), age: f(), life: f(), s0: f(), s1: f(), rot: f(), spin: f(),
      r: f(), g: f(), b: f(), a: f(), drag: f(), grav: f(), floor: f(), seed: f() };
  }
  const puffs = pool('feel-dust-puffs', CAPS.puffs, 3, { fade: 'dust', order: 1, wind: reducedMotion ? .4 : 1 });
  const glows = pool('feel-glows', CAPS.glows, 0, { additive: true, fade: 'flash', order: 3 });
  const sparks = pool('feel-sparks', CAPS.sparks, 1, { additive: true, glow: true, stretch: .075, maxLength: 3.4, minPx: [3.2, 18], fade: 'linear', order: 3 });
  const chips = pool('feel-debris-spray', CAPS.chips, 1, { hard: true, stretch: .035, maxLength: 1.6, minPx: [2.5, 4], fade: 'tail', order: 2 });
  const rings = pool('feel-shockwave', CAPS.rings, 2, { fade: 'ring', order: 1 });
  const pools = [puffs, glows, sparks, chips, rings];

  function spawn(p, evict = true) {
    let i = p.n;
    if (i >= p.capacity) {
      if (!evict) return -1;
      i = 0; for (let k = 1; k < p.capacity; k++) if (p.age[k] / p.life[k] > p.age[i] / p.life[i]) i = k;
      p.evicted++;
    } else p.n++;
    p.spawned++; p.dirty = true;
    p.age[i] = 0; p.rot[i] = random() * 6.283; p.spin[i] = 0; p.drag[i] = 0; p.grav[i] = 0; p.floor[i] = -Infinity; p.seed[i] = random() * 10;
    p.r[i] = p.g[i] = p.b[i] = 1; p.a[i] = 1;
    return i;
  }
  const set = (p, i, x, y, z, vx, vy, vz, life, s0, s1) => { p.px[i] = x; p.py[i] = y; p.pz[i] = z; p.vx[i] = vx; p.vy[i] = vy; p.vz[i] = vz; p.life[i] = Math.max(.02, life); p.s0[i] = s0; p.s1[i] = s1; };
  const tint = (p, i, r, g, b, a) => { p.r[i] = r; p.g[i] = g; p.b[i] = b; p.a[i] = a; };
  const FIELDS = ['px', 'py', 'pz', 'vx', 'vy', 'vz', 'age', 'life', 's0', 's1', 'rot', 'spin', 'r', 'g', 'b', 'a', 'drag', 'grav', 'floor', 'seed'];
  function removeAt(p, i) { const last = --p.n; if (i !== last) for (const k of FIELDS) p[k][i] = p[k][last]; }
  function step(p, dt) {
    if (!p.n && !p.uploaded) return;
    if (dt > 0) for (let i = 0; i < p.n; i++) {
      p.age[i] += dt;
      if (p.age[i] >= p.life[i]) { removeAt(p, i); i--; continue; }
      if (p.age[i] < 0) continue;
      const damp = p.drag[i] ? Math.exp(-p.drag[i] * dt) : 1;
      p.vx[i] *= damp; p.vz[i] *= damp; p.vy[i] = p.vy[i] * damp - p.grav[i] * dt;
      p.px[i] += p.vx[i] * dt; p.py[i] += p.vy[i] * dt; p.pz[i] += p.vz[i] * dt; p.rot[i] += p.spin[i] * dt;
      // Wind takes over once the burst has slowed (full drift after ~1.2 s).
      if (p.wind) { const w = p.wind * Math.min(1, p.age[i] / 1.2) * dt; p.px[i] += WIND_X * w; p.pz[i] += WIND_Z * w; }
      if (p.py[i] < p.floor[i]) { p.py[i] = p.floor[i]; p.vy[i] *= -.18; p.vx[i] *= .45; p.vz[i] *= .45; }
    } else if (!p.dirty) return;
    p.dirty = false;
    for (let i = 0; i < p.n; i++) {
      const t = p.age[i] < 0 ? 0 : p.age[i] / p.life[i], o3 = i * 3, o4 = i * 4;
      let alpha;
      if (p.age[i] < 0) alpha = 0;
      else if (p.fade === 'dust') alpha = Math.min(1, t / .07) * (t < .4 ? 1 : 1 - ((t - .4) / .6) ** 1.3);
      else if (p.fade === 'flash') alpha = (1 - t) ** 2;
      else if (p.fade === 'tail') alpha = Math.min(1, (1 - t) / .3);
      else if (p.fade === 'ring') alpha = (1 - t) ** 1.5;
      else alpha = 1 - t;
      const grow = 1 - (1 - t) ** (p.mode === 3 ? 2.6 : 2), size = p.s0[i] + (p.s1[i] - p.s0[i]) * grow;
      p.pos[o3] = p.px[i]; p.pos[o3 + 1] = p.py[i]; p.pos[o3 + 2] = p.pz[i];
      if (p.mode === 0) { p.aux[o4] = size; p.aux[o4 + 1] = size; p.aux[o4 + 2] = p.rot[i]; p.aux[o4 + 3] = 0; }
      else if (p.mode === 3) { p.aux[o4] = size; p.aux[o4 + 1] = t; p.aux[o4 + 2] = p.rot[i]; p.aux[o4 + 3] = p.seed[i]; }
      else if (p.mode === 1) { p.aux[o4] = p.vx[i]; p.aux[o4 + 1] = p.vy[i]; p.aux[o4 + 2] = p.vz[i]; p.aux[o4 + 3] = p.s0[i]; }
      else { p.aux[o4] = size; p.aux[o4 + 1] = .07 + .05 * (1 - t); p.aux[o4 + 2] = 0; p.aux[o4 + 3] = 0; }
      p.col[o4] = p.r[i]; p.col[o4 + 1] = p.g[i]; p.col[o4 + 2] = p.b[i]; p.col[o4 + 3] = p.a[i] * alpha;
    }
    p.geometry.instanceCount = p.n; p.mesh.visible = p.n > 0;
    if (p.n) { p.posAttr.needsUpdate = true; p.auxAttr.needsUpdate = true; p.colAttr.needsUpdate = true; }
    p.uploaded = p.n;
  }

  // Screen flash: a plain overlay above the canvas but below the HUD/comic text (z-index 3+).
  let flashEl = null, flashShown = -1, flashPop = 0;
  if (!reducedMotion && canvas?.ownerDocument) {
    flashEl = canvas.ownerDocument.createElement('div'); flashEl.id = 'feel-flash'; flashEl.setAttribute('aria-hidden', 'true');
    Object.assign(flashEl.style, { position: 'absolute', inset: '0', background: '#fffaf0', opacity: '0', pointerEvents: 'none', zIndex: '1', display: 'none' });
    canvas.after(flashEl);
  }
  function showFlash(value) {
    if (!flashEl) return;
    const q = Math.round(Math.max(0, Math.min(1, value)) * 50) / 50;
    if (q === flashShown) return; flashShown = q;
    flashEl.style.display = q > 0 ? 'block' : 'none'; flashEl.style.opacity = String(q);
  }

  // Hit-stop clock (real seconds). Releases fire once the stop ends.
  let stopStart = -Infinity, stopUntil = -Infinity, stops = 0, releases = 0, landingPuffs = 0, landingSkipped = 0, tokens = LANDING_BURST;
  const pending = Array.from({ length: 6 }, () => ({ kind: null, x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, entries: [] }));
  let pendingCount = 0;
  function beginStop(now) {
    if (!Number.isFinite(now)) return;
    if (now < stopUntil) stopUntil = Math.min(Math.max(stopUntil, now + freeze * .5), stopStart + MAX_CONTINUOUS_STOP);
    else { stopStart = now; stopUntil = now + freeze; }
    stops++;
  }
  function queue(kind, point, normal, entries) {
    const record = pending[Math.min(pendingCount, pending.length - 1)];
    if (pendingCount < pending.length) pendingCount++;
    record.kind = kind; record.x = point.x; record.y = point.y; record.z = point.z;
    record.nx = normal?.x ?? 0; record.ny = normal?.y ?? 1; record.nz = normal?.z ?? 0;
    record.entries.length = 0; if (entries) for (const entry of entries.slice(0, 3)) record.entries.push(entry);
  }

  function ring(x, y, z, r0, r1, life, alpha) { const i = spawn(rings); set(rings, i, x, y, z, 0, 0, 0, life, r0, r1); tint(rings, i, 1, .95, .84, alpha); }
  function glow(x, y, z, s0, s1, life, r, g, b, a) { const i = spawn(glows); set(glows, i, x, y, z, 0, 0, 0, life, s0, s1); tint(glows, i, r, g, b, a); }
  // One dust billow: earth/cement grey-brown (shade ~.5 dark core .. ~.7 light), rises with `lift`
  // (terminal speed ~ lift/drag), slows with `drag`, then drifts downwind. Reduced motion: shorter,
  // fainter, no spin, half the lift.
  // Overall dust amount (user: "a bit less"): &dust= 0~1.5 scales opacity fully, size and life partly. Default .6.
  const dustAmount = (() => { const v = Number.parseFloat(new URLSearchParams(globalThis.location?.search ?? '').get('dust')); return Number.isFinite(v) ? Math.min(1.5, Math.max(0, v)) : .6; })();
  const dustSize = .55 + dustAmount * .45, dustLife = .6 + dustAmount * .4;
  function dust(x, y, z, vx, vy, vz, life, s0, s1, shade, alpha, lift, drag, evict = true) {
    if (dustAmount <= 0) return -1;
    const i = spawn(puffs, evict); if (i < 0) return -1;
    life *= dustLife; s0 *= dustSize; s1 *= dustSize; alpha *= Math.min(1, dustAmount);
    set(puffs, i, x, y, z, vx, vy, vz, reducedMotion ? Math.min(2, life * .65) : life, s0, s1);
    puffs.drag[i] = drag; puffs.grav[i] = -(reducedMotion ? lift * .5 : lift); puffs.spin[i] = reducedMotion ? 0 : (random() - .5) * .35;
    const v = (random() - .5) * .05, cement = random() < .35 ? .05 : 0;
    tint(puffs, i, shade + .1 + v - cement, shade + .04 + v, shade - .06 + v + cement * .8, reducedMotion ? alpha * .7 : alpha);
    return i;
  }
  function releaseClear(record) {
    for (const entry of record.entries) {
      const box = entry.worldBounds, cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
      const hx = Math.max(2, (box.max.x - box.min.x) / 2), hz = Math.max(2, (box.max.z - box.min.z) / 2), radius = Math.hypot(hx, hz);
      const ground = heightAt(cx, cz), baseY = Number.isFinite(ground) ? ground : box.min.y;
      ring(cx, baseY + .4, cz, radius * .55, radius * 1.6 + 14, reducedMotion ? .45 : .8, .8);
      if (!reducedMotion) glow(cx, baseY + Math.min(12, radius * .3), cz, radius * 1.1, radius * 2.4, .3, 1, .86, .62, .55);
      // Ground skirt rolling out from the footprint + a slower, darker billow rising from inside it.
      const count = reducedMotion ? 7 : 12, size = Math.min(11, Math.max(5, radius * .3));
      for (let k = 0; k < count; k++) {
        const a = (k + random() * .6) / count * 6.283, c = Math.cos(a), s = Math.sin(a), speed = (reducedMotion ? 2 : 3.5) + random() * 3, out = .75 + random() * .35;
        dust(cx + c * hx * out, baseY + size * .35, cz + s * hz * out, c * speed, .6 + random() * .8, s * speed, 2.4 + random() * .9, size, size * (2.2 + random() * .8), .62 + random() * .08, .78, .7 + random() * .5, 1.4);
      }
      for (let k = 0; k < (reducedMotion ? 2 : 6); k++) {
        const i = dust(cx + (random() - .5) * hx * 1.2, baseY + size * (.6 + random() * .7), cz + (random() - .5) * hz * 1.2, (random() - .5) * 1.5, 1.5 + random() * 2, (random() - .5) * 1.5,
          2.8 + random() * .7, size * 1.1, size * (2.8 + random() * .6), .54 + random() * .07, .7, .8, 1.1);
        if (i >= 0) puffs.age[i] = -.04 - random() * .2;
      }
    }
  }
  const tangentA = new THREE.Vector3(), tangentB = new THREE.Vector3(), surface = new THREE.Vector3(), helper = new THREE.Vector3();
  function basis(nx, ny, nz) {
    surface.set(nx, ny, nz); if (surface.lengthSq() < 1e-8) surface.set(0, 1, 0); surface.normalize();
    helper.set(Math.abs(surface.y) < .9 ? 0 : 1, Math.abs(surface.y) < .9 ? 1 : 0, 0);
    tangentA.crossVectors(surface, helper).normalize(); tangentB.crossVectors(surface, tangentA).normalize();
  }
  function releaseBomb(record) {
    const { x, y, z } = record, ground = heightAt(x, z), floorY = (Number.isFinite(ground) ? ground : y - 1) + .1;
    basis(record.nx, record.ny, record.nz);
    const cx = x + surface.x * 1.4, cy = y + surface.y * 1.4, cz = z + surface.z * 1.4;
    for (let k = 0; k < (reducedMotion ? 8 : 20); k++) {
      const a = random() * 6.283, out = .35 + random() * .9, speed = 9 + random() * 8, c = Math.cos(a) * out, s = Math.sin(a) * out, lift = .6 + random() * .9;
      const dx = tangentA.x * c + tangentB.x * s + surface.x * lift, dy = tangentA.y * c + tangentB.y * s + surface.y * lift + .45, dz = tangentA.z * c + tangentB.z * s + surface.z * lift;
      const len = Math.hypot(dx, dy, dz) || 1, i = spawn(chips), shade = .2 + random() * .22;
      set(chips, i, cx, cy, cz, dx / len * speed, dy / len * speed, dz / len * speed, .9 + random() * .5, .22 + random() * .26, 0);
      chips.grav[i] = 19; chips.floor[i] = floorY; tint(chips, i, shade + .06, shade + .03, shade, 1);
    }
    for (let k = 0; k < (reducedMotion ? 4 : 12); k++) {
      const a = random() * 6.283, c = Math.cos(a), s = Math.sin(a), speed = 8 + random() * 9, i = spawn(sparks);
      set(sparks, i, cx, cy, cz, (tangentA.x * c + tangentB.x * s + surface.x) * speed, (tangentA.y * c + tangentB.y * s + surface.y) * speed + 3, (tangentA.z * c + tangentB.z * s + surface.z) * speed, .35 + random() * .3, .16, 0);
      sparks.grav[i] = 16; sparks.drag[i] = 1.2; tint(sparks, i, 1, .62 + random() * .2, .22, 1);
    }
    // Dark smoke-dust column rising from the blast + lighter dust skirt blown out along the surface.
    for (let k = 0; k < (reducedMotion ? 3 : 5); k++) {
      const size = 2.2 + random() * 1.1, i = dust(cx + (random() - .5) * 1.4, cy + k * .3, cz + (random() - .5) * 1.4, (random() - .5) * 1.4 + surface.x * 2, 3 + random() * 4, (random() - .5) * 1.4 + surface.z * 2,
        2.3 + random(), size, size * (3.3 + random() * 1.2), .46 + random() * .08, .78, 1, 1);
      if (i >= 0) puffs.age[i] = -k * .05;
    }
    const skirt = reducedMotion ? 3 : 7, low = y - floorY < 4;
    for (let k = 0; k < skirt; k++) {
      const a = (k + random() * .7) / skirt * 6.283, c = Math.cos(a), s = Math.sin(a), speed = 4 + random() * 3.5, size = 2.4 + random();
      if (low) dust(x + c * 1.2, floorY + size * .4, z + s * 1.2, c * speed, .5 + random() * .6, s * speed, 2.4 + random() * .8, size, size * (2.6 + random() * .8), .62 + random() * .08, .76, .6, 1.8);
      else dust(cx, cy, cz, (tangentA.x * c + tangentB.x * s + surface.x * .4) * speed, (tangentA.y * c + tangentB.y * s + surface.y * .4) * speed, (tangentA.z * c + tangentB.z * s + surface.z * .4) * speed,
        2.4 + random() * .8, size, size * (2.6 + random() * .8), .62 + random() * .08, .76, .6, 1.8);
    }
    if (y - floorY < 3.5) ring(x, floorY + .3, z, 1.5, 15, reducedMotion ? .4 : .6, .7);
  }
  function release() {
    for (let k = 0; k < pendingCount; k++) { const record = pending[k]; if (record.kind === 'clear') releaseClear(record); else releaseBomb(record); record.entries.length = 0; }
    if (pendingCount) { releases++; flashPop = Math.max(flashPop, pending.slice(0, pendingCount).some(r => r.kind === 'clear') ? .6 : .45); }
    pendingCount = 0;
  }

  // Collapse (B): fragments cut off from the ground shake, then fall or sink into dust.
  // URL knobs: &fall= share that falls as debris (0~1, .35), &shake= seconds (.1~.6, .25),
  // &count= share of their weight counted toward clearing (0~1, 1), &collapse=off disables it.
  const knobs = new URLSearchParams(globalThis.location?.search ?? ''), knob = (k, lo, hi, d) => { const v = Number.parseFloat(knobs.get(k)); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const collapse = knobs.get('collapse') === 'off' ? null : { fly: knob('fall', 0, 1, .35), shake: reducedMotion ? .12 : knob('shake', .1, .6, .25), count: knob('count', 0, 1, 1) };
  let collapses = 0, collapsedPieces = 0;
  if (collapse) setDebrisCollapse({ ...collapse, onCollapse(box, count) {
    if (disposed || suppressed) return;
    collapses++; collapsedPieces += count;
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, hx = Math.max(1, (box.max.x - box.min.x) / 2), hz = Math.max(1, (box.max.z - box.min.z) / 2);
    const ground = heightAt(cx, cz), baseY = Number.isFinite(ground) ? ground : box.min.y, size = Math.min(10, Math.max(3, Math.hypot(hx, hz) * .35));
    const n = Math.min(reducedMotion ? 5 : 14, 3 + Math.floor(count / 5));
    // Mostly a ground skirt where the pieces sink; every third puff hangs where they were, settling slowly.
    for (let k = 0; k < n; k++) {
      const a = (k + random() * .7) / n * 6.283, c = Math.cos(a), s = Math.sin(a), low = k % 3 !== 0, speed = 2 + random() * 2.5;
      const y = low ? baseY + size * .35 : box.min.y + random() * (box.max.y - box.min.y) * .5;
      const i = dust(cx + c * hx * (.6 + random() * .5), y, cz + s * hz * (.6 + random() * .5), c * speed, low ? .4 + random() * .6 : -.3, s * speed,
        2.4 + random(), size, size * (2.3 + random() * .8), low ? .63 + random() * .07 : .56 + random() * .06, .76, low ? .6 : .3, 1.6);
      if (i < 0) break;
    }
  } });

  setDebrisGroundListener((x, y, z, speed) => {
    if (disposed || suppressed) return;
    if (tokens < 1 || puffs.n >= LANDING_PUFF_LIMIT) { landingSkipped++; return; }
    tokens -= 1; landingPuffs++;
    const a = random() * 6.283, size = 1.6 + Math.min(1.8, speed * .08);
    dust(x, y + size * .3, z, Math.cos(a) * 1.6, .4, Math.sin(a) * 1.6, 1.4 + random() * .6, size, size * (2.8 + random() * .6), .64 + random() * .08, .58, .5, 2, false);
  });

  return {
    stopSeconds: freeze,
    /** True while the big-moment stop holds. The nuclear cinematic cancels and never freezes. */
    holding(now, nuclear = false) {
      suppressed = !!nuclear;
      if (nuclear) { if (stopUntil > now) stopUntil = -Infinity; return false; }
      return now < stopUntil;
    },
    pelletSparks(point, normal) {
      if (disposed || !point) return;
      basis(normal?.x ?? 0, normal?.y ?? 1, normal?.z ?? 0);
      const x = point.x + surface.x * .1, y = point.y + surface.y * .1, z = point.z + surface.z * .1;
      // Hot red-orange hit flash per pellet; the first pellet of a shot gets a bigger one.
      if (!reducedMotion) {
        if (shotFrame !== frameNo) { shotFrame = frameNo; glow(x, y, z, 2.2, 4.4, .14, 1, .5, .22, .8); }
        glow(x, y, z, 1.3, 2.6, .12, 1, .42, .14, 1);
      }
      for (let k = 0; k < (reducedMotion ? 3 : 8); k++) {
        const a = random() * 6.283, spread = .5 + random() * 1, speed = 8 + random() * 10, c = Math.cos(a) * spread, s = Math.sin(a) * spread;
        const i = spawn(sparks), hot = random() < .3;
        set(sparks, i, x, y, z, (surface.x + tangentA.x * c + tangentB.x * s) * speed, (surface.y + tangentA.y * c + tangentB.y * s) * speed + 1.5, (surface.z + tangentA.z * c + tangentB.z * s) * speed, .26 + random() * .22, .13 + random() * .08, 0);
        sparks.grav[i] = 20; sparks.drag[i] = .6; tint(sparks, i, 1, hot ? .45 + random() * .2 : .13 + random() * .15, hot ? .14 : .04, 1);
      }
    },
    miniBomb(point, normal, now) {
      if (disposed || !point) return;
      basis(normal?.x ?? 0, normal?.y ?? 1, normal?.z ?? 0);
      const x = point.x + surface.x * 1.4, y = point.y + surface.y * 1.4, z = point.z + surface.z * 1.4;
      if (!reducedMotion) { glow(x, y, z, 7, 11, .32, 1, .97, .86, 1); glow(x, y, z, 12, 20, .45, 1, .55, .18, .7); }
      else glow(x, y, z, 6, 8, .2, 1, .8, .5, .5);
      queue('bomb', point, normal, null); beginStop(now);
    },
    buildingCleared(entries, now) {
      if (disposed || !entries?.length) return;
      const box = entries[0].worldBounds;
      queue('clear', { x: (box.min.x + box.max.x) / 2, y: box.min.y, z: (box.min.z + box.max.z) / 2 }, null, entries); beginStop(now);
    },
    /** simDt is 0 while frozen; realDt drives the screen flash. */
    update(simDt, realDt, now) {
      if (disposed) return;
      frameNo++; if (simDt > 0) timeUniform.value = (timeUniform.value + Math.min(simDt, .1)) % 1000;
      if (warmFrames && !--warmFrames) for (const p of pools) p.mesh.visible = p.n > 0; // programs compiled by the boot render
      if (camera?.isPerspectiveCamera) pixelUniform.value = 2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, globalThis.innerHeight || 800);
      if (pendingCount && !(now < stopUntil)) release();
      tokens = Math.min(LANDING_BURST, tokens + Math.max(0, simDt) * LANDING_RATE);
      for (const p of pools) step(p, simDt > 0 ? Math.min(simDt, .1) : 0);
      const holdFlash = now < stopUntil && pendingCount ? .2 : 0;
      if (flashPop > 0 && realDt > 0) flashPop = flashPop > .01 ? flashPop * Math.exp(-realDt * 14) : 0;
      showFlash(Math.max(holdFlash, flashPop));
    },
    reset() {
      stopUntil = -Infinity; pendingCount = 0; flashPop = 0; showFlash(0);
      for (const p of pools) { p.n = 0; p.dirty = true; step(p, 0); }
    },
    get animating() { return pools.some(p => p.n > 0) || pendingCount > 0 || flashPop > 0; },
    get stats() { return { stopSeconds: freeze, reducedMotion, stops, releases, pending: pendingCount, lastStop: Number.isFinite(stopStart) ? { start: stopStart, until: stopUntil } : null, landingPuffs, landingSkipped, collapse, collapses, collapsedPieces,
      live: Object.fromEntries(pools.map(p => [p.name, p.n])), spawned: Object.fromEntries(pools.map(p => [p.name, p.spawned])),
      evicted: pools.reduce((n, p) => n + p.evicted, 0), caps: CAPS, flash: flashShown < 0 ? 0 : flashShown }; },
    dispose() {
      if (disposed) return; disposed = true; setDebrisGroundListener(null); setDebrisCollapse(null); flashEl?.remove(); root.removeFromParent();
      for (const p of pools) { p.geometry.dispose(); p.base.dispose(); p.material.dispose(); }
    },
  };
}
