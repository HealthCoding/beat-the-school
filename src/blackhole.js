// One sky-scale vortex. Peel real model cells from the near face; collapse the remaining shell in place.
// Only a bounded selection of real fragments remains animated; no cloned campus geometry. A lazy, depth-aware screen lens exists only during a cast.
import { WEAPON_TUNING } from './weapon-tuning.js?v=sn130';
import { createBlackHoleAudio } from './blackhole-audio.js?v=bh86';
import { createScreenImpact } from './game-feel.js?v=shake74';
export const BLACKHOLE_ID = 'blackhole';
export function createBlackHole(THREE, scene, { campus, protectedSet = null, mobile = false, reducedMotion = false,
  tuning = WEAPON_TUNING.blackhole, output = () => null, onDamage = () => {}, onShield = () => {} } = {}) {
  const T = tuning, units = (campus.worldUnitsPerMeter || .5) / .5;
  const cap = mobile ? T.piecesPhone : T.pieces, batch = mobile ? T.batchPhone : T.batch;
  const radius = T.radius * units, core = T.core * units, diskRadius = T.disk * units;
  const audio = createBlackHoleAudio({ output, tuning: T }), impact = createScreenImpact({ reducedMotion });
  const root = new THREE.Group(); root.name = 'blackhole'; root.visible = false; scene.add(root);
  const sphere = new THREE.SphereGeometry(core, mobile ? 24 : 40, mobile ? 16 : 28);
  const black = new THREE.MeshBasicMaterial({ color: 0x000001, toneMapped: false, fog: false });
  const body = new THREE.Mesh(sphere, black); root.add(body);
  // A closed, tapered volume: upper and lower surfaces meet at the edges. No flat ring billboard.
  const segments = mobile ? 64 : 112, radial = mobile ? 10 : 16, positions = [], indices = [];
  for (let side = 0; side < 2; side++) for (let j = 0; j <= radial; j++) for (let i = 0; i <= segments; i++) {
    const t = j / radial, a = i / segments * Math.PI * 2, r = core * 1.04 + (diskRadius - core * 1.04) * t;
    const thickness = core * .19 * Math.sin(Math.PI * t) ** .65;
    positions.push(Math.cos(a) * r, Math.sin(a) * r, (side ? -1 : 1) * thickness);
  }
  const layer = (radial + 1) * (segments + 1);
  for (let side = 0; side < 2; side++) for (let j = 0; j < radial; j++) for (let i = 0; i < segments; i++) {
    const a = side * layer + j * (segments + 1) + i, b = a + segments + 1;
    if (side) indices.push(a, a + 1, b, a + 1, b + 1, b); else indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const ringGeo = new THREE.BufferGeometry(); ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  ringGeo.setIndex(indices); ringGeo.computeVertexNormals();
  const glow = new THREE.ShaderMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { age: { value: 0 }, alpha: { value: 1 }, inner: { value: core * 1.04 }, outer: { value: diskRadius },
      observer: { value: new THREE.Vector3(0, 0, 1) } },
    vertexShader: `varying vec3 p; uniform float age,inner,outer;
      void main(){p=position;float t=clamp((length(p.xy)-inner)/(outer-inner),0.,1.);
      vec3 q=p;q.z+=sin(atan(p.y,p.x)*3.-age*.6+t*5.)*inner*.055*sin(t*3.14159);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(q,1.);}`,
    fragmentShader: `varying vec3 p; uniform float age,alpha,inner,outer; uniform vec3 observer;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){float r=length(p.xy),t=clamp((r-inner)/(outer-inner),0.,1.),a=atan(p.y,p.x);
        float advect=a-age*(.18+1.65*pow(1.-t,2.));
        vec3 flow=vec3(cos(advect)*5.,sin(advect)*5.,t*9.+age*.18);
        float n=noise(flow),eddy=noise(flow*2.1+vec3(n*2.,age*.13,n));
        float heat=.42+.42*n+.26*eddy, doppler=.68+.45*dot(vec3(-sin(a),cos(a),0.),observer);
        float edge=smoothstep(0.,.045,t)*(1.-smoothstep(.78,1.,t));
        float flicker=1.+.055*sin(age*9.+n*12.);
        vec3 col=mix(vec3(1.,.77,.38),vec3(.84,.16,.018),smoothstep(.04,.9,t));
        float light=(.6+1.25*pow(1.-t,2.))*heat*doppler*flicker;
        gl_FragColor=vec4(col*light*1.7,alpha*edge*(.64+.3*eddy));}` });
  const disk = new THREE.Mesh(ringGeo, glow); disk.rotation.set(-Math.PI / 2 + .24, .08, .16); root.add(disk);
  const lamp = new THREE.PointLight(0xffa04b, 0, radius * 3, 2); lamp.name = 'blackhole-disk-light'; scene.add(lamp); // Keep the light count stable across casts (no campus shader recompile).
  // Camera-facing photon halo reads as bent light over / under the opaque core, with the disk occluded by it.
  const rimGeo = new THREE.TorusGeometry(core * 1.035, core * .018, 8, mobile ? 64 : 112);
  const rimMat = new THREE.MeshBasicMaterial({ color: 0xffeed2, transparent: true, opacity: .95, toneMapped: false, fog: false });
  const rim = new THREE.Mesh(rimGeo, rimMat); root.add(rim);
  const haloGeo = new THREE.RingGeometry(core * 1.07, core * 1.17, mobile ? 64 : 112);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xff9b47, transparent: true, opacity: .24, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, fog: false });
  const halo = new THREE.Mesh(haloGeo, haloMat); root.add(halo);
  const shockGeo = new THREE.RingGeometry(.96, 1, mobile ? 64 : 112);
  const shockMat = new THREE.MeshBasicMaterial({ color: 0xffe5bf, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false });
  const shock = new THREE.Mesh(shockGeo, shockMat); shock.visible = false; shock.rotation.copy(disk.rotation); scene.add(shock);
  // One instanced stream: bounded luminous dust / stretched debris silhouettes, shared geometry and material.
  const particleCap = mobile ? T.particlesPhone : T.particles;
  const dustGeo = new THREE.BoxGeometry(1, 1, 1), dustMat = new THREE.MeshBasicMaterial({ color: 0xffb76b, transparent: true, opacity: .55, toneMapped: false, fog: false });
  const dust = new THREE.InstancedMesh(dustGeo, dustMat, particleCap); dust.instanceMatrix.setUsage(THREE.DynamicDrawUsage); dust.frustumCulled = false; dust.visible = false; scene.add(dust);
  const dummy = new THREE.Object3D(), v = new THREE.Vector3(), axis = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), localY = new THREE.Vector3(0, 1, 0);
  let hole = null, popAge = -1, clock = 0, darkness = 0, flash = 0, framing = 0;
  const framingTarget = new THREE.Vector3();
  const flying = [], peeling = [], falling = [];
  const stats = { spawned: 0, captured: 0, absorbed: 0, finished: 0, peakPieces: 0, settled: 0, shields: 0, buildings: 0, peeled: 0, waves: 0, orbiting: 0, collapsed: 0, rumbles: 0 };

  // Linear HDR colour + depth, one scene render and one fullscreen triangle. No idle target/pass.
  let lens = null;
  const lensStats = { frames: 0, width: 0, height: 0, samples: 0, radius: 0, center: [0, 0], strength: 0 };
  const lensPoint = new THREE.Vector3(), lensSize = new THREE.Vector2();
  function releaseLens() {
    if (!lens) return;
    lens.target.dispose(); lens.geometry.dispose(); lens.material.dispose(); lens = null;
    lensStats.width = lensStats.height = lensStats.samples = lensStats.radius = lensStats.strength = 0;
  }
  function makeLens(renderer) {
    const samples = renderer.capabilities?.isWebGL2
      ? Math.min(mobile ? T.lensSamplesPhone : T.lensSamples, renderer.capabilities.maxSamples) : 0;
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true, samples });
    target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    const uniforms = { colour: { value: target.texture }, depth: { value: target.depthTexture },
      centre: { value: new THREE.Vector2() }, aspect: { value: 1 }, radius: { value: 0 },
      strength: { value: mobile ? T.lensPhone : T.lens }, coreDepth: { value: 0 }, worldRadius: { value: 1 },
      near: { value: .1 }, far: { value: 10000 } };
    const material = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms,
      vertexShader: `varying vec2 uvScreen;void main(){uvScreen=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader: `varying vec2 uvScreen;uniform sampler2D colour,depth;
        uniform vec2 centre;uniform float aspect,radius,strength,coreDepth,worldRadius,near,far;
        float distanceAt(vec2 uv){float z=texture2D(depth,uv).x;return near*far/(far-z*(far-near));}
        void main(){vec2 d=(uvScreen-centre)*vec2(aspect,1.);float r=length(d),x=r/max(radius,.00001);
          // Peak just outside the horizon; a smooth long tail bends straight background edges into an arc.
          float ring=smoothstep(.99,1.12,x)*exp(-max(0.,x-1.12)*1.55)*(1.-smoothstep(2.8,3.6,x));
          vec2 bend=d/max(r,.00001)*radius*strength*ring/vec2(aspect,1.);
          vec2 sampleUV=clamp(uvScreen+bend,vec2(.001),vec2(.999));
          // Keep the opaque horizon and near-side disk / foreground buildings in front of the bent background.
          float behind=smoothstep(coreDepth,coreDepth+worldRadius*.8,distanceAt(uvScreen))
            *smoothstep(coreDepth,coreDepth+worldRadius*.8,distanceAt(sampleUV));
          gl_FragColor=texture2D(colour,mix(uvScreen,sampleUV,behind));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0], 3));
    const pass = new THREE.Scene(), quad = new THREE.Mesh(geometry, material); quad.frustumCulled = false; pass.add(quad);
    lens = { target, uniforms, material, geometry, pass, camera: new THREE.Camera() };
  }
  function render(renderer, camera) {
    // The caller takes the original direct-render branch when idle or motion is reduced.
    if (reducedMotion || (!hole && popAge < 0)) return false;
    if (!lens) makeLens(renderer);
    renderer.getDrawingBufferSize(lensSize);
    // Match normal rendering exactly, including DPR caps / quality changes / resize.
    // Lowering a fullscreen target blurs even buildings far outside the lens.
    const width = Math.max(1, lensSize.x), height = Math.max(1, lensSize.y);
    if (lens.target.width !== width || lens.target.height !== height) lens.target.setSize(width, height);
    lensStats.width = width; lensStats.height = height; lensStats.samples = lens.target.samples;
    const target = renderer.getRenderTarget(), depthWrite = glow.depthWrite;
    try {
      // Transparent front/back disk fragments also supply depth to the foreground mask.
      glow.depthWrite = true; renderer.setRenderTarget(lens.target); renderer.render(scene, camera);
      renderer.setRenderTarget(target); renderer.render(lens.pass, lens.camera); lensStats.frames++;
    } finally { glow.depthWrite = depthWrite; renderer.setRenderTarget(target); restoreRender(); }
    return true;
  }

  // The render callbacks confine light changes and the existing game-feel rumble to this render.
  // Restore projection/background/fog/lights immediately after drawing.
  const previousBefore = scene.onBeforeRender, previousAfter = scene.onAfterRender;
  let renderState = null;
  function restoreRender() {
    if (!renderState) return;
    const s = renderState; if (s.bg) scene.background.copy(s.bg); if (s.fog) scene.fog.color.copy(s.fog);
    for (const [light, intensity] of s.lights) light.intensity = intensity;
    s.camera.position.copy(s.position); s.camera.updateMatrixWorld(true);
    s.camera.projectionMatrix.copy(s.projection); s.camera.projectionMatrixInverse.copy(s.inverse); renderState = null;
  }
  function beforeRender(renderer, currentScene, camera, ...rest) {
    previousBefore?.call(scene, renderer, currentScene, camera, ...rest);
    if (!hole && popAge < 0) return;
    const lights = []; scene.traverse(o => { if (o.isLight && o !== lamp) lights.push([o, o.intensity]); });
    renderState = { camera, position: camera.position.clone(), projection: camera.projectionMatrix.clone(), inverse: camera.projectionMatrixInverse.clone(), lights,
      bg: scene.background?.isColor ? scene.background.clone() : null, fog: scene.fog?.color.clone() };
    // Render-only dolly keeps the sky event in view even from the normal close building camera.
    // Preserve the player's orbit/target and restore it after every frame (also on cancellation).
    if (camera.isPerspectiveCamera) {
      const forward = camera.getWorldDirection(new THREE.Vector3());
      const startDistance = Math.max(1, camera.position.distanceTo(framingTarget));
      const fov = camera.fov * Math.PI / 180;
      const halfAngle = Math.min(fov / 2, Math.atan(Math.tan(fov / 2) * camera.aspect));
      const distance = Math.max(startDistance, diskRadius * 1.22 / Math.sin(halfAngle));
      const desired = framingTarget.clone().addScaledVector(forward, -distance);
      camera.position.lerp(desired, framing); camera.updateMatrixWorld(true);
    }
    const shade = 1 - darkness;
    if (renderState.bg) scene.background.multiplyScalar(shade).lerp(new THREE.Color(0xffecd9), flash);
    if (renderState.fog) scene.fog.color.multiplyScalar(shade).lerp(new THREE.Color(0xffecd9), flash);
    for (const [light, intensity] of lights) light.intensity = intensity * (shade + flash * 1.7);
    rim.quaternion.copy(camera.quaternion); halo.quaternion.copy(camera.quaternion);
    root.updateMatrixWorld(true);
    // The lensed far-side arc flattens with inclination; it is not painted into the disk texture.
    dir.copy(camera.position).sub(root.position).normalize();
    const diskNormal = localY.clone().set(0, 0, 1).applyQuaternion(disk.quaternion);
    const inclination = Math.abs(dir.dot(diskNormal));
    rim.scale.set(1.035, .86 + .18 * inclination, 1); halo.scale.copy(rim.scale);
    glow.uniforms.observer.value.copy(dir).applyQuaternion(disk.quaternion.clone().invert());
    const shake = impact.sample(clock), size = renderer.getSize(new THREE.Vector2());
    // Perspective projection centre shift in CSS pixels; no camera drift or HUD shake.
    camera.projectionMatrix.elements[8] += shake.x * 2 / size.x;
    camera.projectionMatrix.elements[9] += shake.y * 2 / size.y;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    if (lens) {
      const u = lens.uniforms, r = core * root.scale.x;
      lensPoint.copy(root.position).applyMatrix4(camera.matrixWorldInverse);
      u.coreDepth.value = Math.max(camera.near, -lensPoint.z);
      const z = u.coreDepth.value; u.worldRadius.value = r;
      u.radius.value = camera.projectionMatrix.elements[5] * r / (2 * Math.sqrt(Math.max(r*r, z*z-r*r)));
      lensPoint.copy(root.position).project(camera);
      u.centre.value.set(lensPoint.x*.5+.5, lensPoint.y*.5+.5);
      u.aspect.value = camera.aspect; u.near.value = camera.near; u.far.value = camera.far;
      lensStats.radius = u.radius.value; lensStats.center = u.centre.value.toArray(); lensStats.strength = u.strength.value;
    }
  }
  function afterRender(...args) { restoreRender(); previousAfter?.apply(scene, args); }
  scene.onBeforeRender = beforeRender; scene.onAfterRender = afterRender;

  function candidates(point) {
    const list = [];
    for (const entry of campus.entries) {
      if (entry.cleared || entry.protected) continue;
      const box = entry.model.worldBounds;
      const dx = Math.max(box.min.x - point.x, 0, point.x - box.max.x), dz = Math.max(box.min.z - point.z, 0, point.z - box.max.z);
      if (Math.hypot(dx, dz) > radius) continue;
      const center = box.getCenter(new THREE.Vector3());
      list.push({ entry, center, d: Math.hypot(center.x - point.x, center.z - point.z) });
    }
    return list.sort((a, b) => a.d - b.d);
  }
  function launch({ point, entry = null, site = null } = {}) {
    // Only occupancy locks placement, including the visible closing ring. There is no refire timer.
    if (hole || popAge >= 0) return 'busy';
    if (site || entry?.protected) { stats.shields++; if (point) onShield(point, new THREE.Vector3(0, 1, 0)); return 'shield'; }
    if (!point || ![point.x, point.y, point.z].every(Number.isFinite)) return 'miss';
    const list = candidates(point), center = point.clone();
    const roof = entry?.model.worldBounds.max.y ?? Math.max(campus.terrain.heightAt(point.x, point.z), ...list.map(c => c.entry.model.worldBounds.max.y));
    center.y = roof + T.height * units;
    framingTarget.copy(center).lerp(point, .4); framing = 0;
    lamp.position.copy(center); root.position.copy(center); root.scale.setScalar(.015); root.visible = true; body.visible = disk.visible = rim.visible = halo.visible = true;
    glow.uniforms.alpha.value = 1; shock.visible = false; dust.visible = false;
    const spread = Math.max(0, T.duration - T.anticipation - T.peel - T.travel - .75);
    list.forEach((c, i) => { c.at = T.anticipation + (list.length > 1 ? i * spread / (list.length - 1) : 0); });
    hole = { center, ground: point.clone(), age: 0, list, cursor: 0 }; stats.spawned++; audio.start();
    // Probe at ground level: a high sky centre must not miss nearby protected buildings.
    const near = protectedSet?.nearestSurface(point, radius); if (near) { stats.shields++; onShield(near.point, near.normal); }
    return 'started';
  }
  function startPeel(c) {
    const model = c.entry.model; model.group.updateWorldMatrix(true, false);
    const matrix = model.group.matrixWorld.clone(), inverse = matrix.clone().invert();
    const ordered = model.pieces.filter(p => p.active).map(p => ({ p, d: v.copy(p.restPosition).applyMatrix4(matrix).distanceToSquared(hole.center) }))
      .sort((a, b) => a.d - b.d || a.p.index - b.p.index);
    peeling.push({ ...c, age: 0, next: 0, cursor: 0, ordered, matrix, inverse });
    stats.buildings++;
  }
  const livePieces = () => flying.length + falling.length;
  function sweepFalling() {
    for (let i = falling.length - 1; i >= 0; i--) if (falling[i].p.hidden) { falling.splice(i, 1); stats.settled++; }
  }
  function tear(c, final = false) {
    if (cap - livePieces() < (final ? 2 : 1)) return false;
    const active = c.entry.model.pieces.filter(p => p.active), wanted = new Set(), visible = new Set();
    const end = final ? c.ordered.length : Math.min(c.ordered.length, Math.ceil(c.ordered.length * .7 * Math.min(1, c.age / T.peel)));
    for (; c.cursor < end; c.cursor++) if (c.ordered[c.cursor].p.active) wanted.add(c.ordered[c.cursor].p.index);
    if (final) for (const p of active) wanted.add(p.index);
    if (!wanted.size) return true;
    // Screen-size LOD: retain actual near-front surface cells, retire the rest of this thin wave.
    // Keep the distant shell standing until the final in-place collapse. Never transform the building group.
    const candidates = c.ordered.filter(o => wanted.has(o.p.index));
    const count = Math.min(final ? batch * 2 : batch, cap - livePieces(), candidates.length);
    for (let i = 0; i < count; i++) visible.add(candidates[Math.floor(i * candidates.length / count)].p.index);
    let cursor = 0;
    const result = campus.cut(c.entry, () => {
      const p = active[cursor++]; return visible.has(p.index) ? 2 : wanted.has(p.index) ? -1 : 0;
    }, { point: hole.center, minPieces: 1, kerfFly: 0, force: 0,
      ...(final ? { drop: { shake: reducedMotion ? 0 : .08, spread: .12, gravity: 2.5, fly: 0, linger: .35, tremble: !reducedMotion } } : {}) });
    if (result.chunk) {
      const { handle, pieces } = result.chunk;
      for (const p of pieces) {
        if (final) { falling.push({ p, handle }); continue; }
        const from = p.restPosition.clone().applyMatrix4(c.matrix), orbit = !reducedMotion && p.index % 4 === 0;
        const spin = new THREE.Vector3(Math.sin(p.index), .7, Math.cos(p.index * .7)).normalize();
        flying.push({ p, handle, inverse: c.inverse, from, age: 0, life: T.travel + (orbit ? T.orbit : 0), orbit, spin, phase: p.index * .7 });
        stats.captured++; if (orbit) stats.orbiting++;
      }
    }
    stats.waves++; stats.peeled += result.count; if (final) stats.collapsed++;
    stats.peakPieces = Math.max(stats.peakPieces, livePieces());
    onDamage(result, { point: c.center }); return true;
  }
  function releaseAll() {
    const touched = new Set();
    for (const f of [...flying, ...falling]) { f.handle.drop(f.p); touched.add(f.handle); }
    for (const h of touched) h.touch(); flying.length = falling.length = peeling.length = 0;
  }
  function clear() {
    releaseAll(); hole = null; popAge = -1; root.visible = shock.visible = dust.visible = false;
    darkness = flash = framing = 0; lamp.intensity = 0; impact.reset(); audio.clear(); restoreRender(); releaseLens();
  }
  function update(dt) {
    dt = Math.max(0, Math.min(.1, Number.isFinite(dt) ? dt : 0)); clock += dt;
    if (popAge >= 0) {
      popAge += dt; const t = Math.min(1, popAge / T.pop);
      root.scale.setScalar(Math.max(.001, (1 - Math.min(1, t * 3)) ** 2));
      shock.scale.setScalar(diskRadius * (.3 + t * 2.4)); shockMat.opacity = (reducedMotion ? .22 : .85) * (1 - t) ** 1.3;
      lamp.intensity *= Math.exp(-dt * 12);
      flash = reducedMotion ? 0 : .5 * Math.exp(-t * 12); darkness = T.darkness * (1 - t); framing = 1 - t * t * (3 - 2 * t);
      if (t >= 1) clear(); return;
    }
    if (!hole) return;
    hole.age += dt; const grow = Math.min(1, hole.age / T.anticipation), smooth = grow * grow * (3 - 2 * grow);
    root.scale.setScalar((.015 + .985 * smooth) * (reducedMotion ? 1 : 1 + .012 * Math.sin(hole.age * 3))); darkness = T.darkness * smooth; framing = smooth;
    lamp.intensity = 950 * units * units * smooth * (reducedMotion ? 1 : 1 + .055 * Math.sin(hole.age * 7));
    glow.uniforms.age.value = reducedMotion ? 0 : hole.age; audio.update(hole.age / T.duration);
    sweepFalling();
    if (hole.cursor < hole.list.length && hole.age >= hole.list[hole.cursor].at) startPeel(hole.list[hole.cursor++]);
    // One surface classification / frame. Stagger buildings, not each piece's animation.
    for (const c of peeling) c.age += dt;
    const next = peeling.filter(c => c.age >= c.next).sort((a, b) => (b.age - b.next) - (a.age - a.next))[0];
    if (next) {
      const final = next.age >= T.peel, done = tear(next, final); next.next = next.age + (done ? T.wave : .04);
      if (final && done) peeling.splice(peeling.indexOf(next), 1);
    }
    const touched = new Set();
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i]; f.age += dt; const t = Math.min(1, f.age / f.life);
      if (t >= 1) { f.handle.drop(f.p); touched.add(f.handle); flying.splice(i, 1); stats.absorbed++; audio.feed(); continue; }
      // Pull off the wall, linger in the disk for one/two revolutions, then contract into the core.
      const approach = f.orbit ? Math.min(1, t / .43) : t;
      const angle = (f.orbit ? Math.max(0, (t - .25) / .75) * Math.PI * 2 * T.turns : t * t * Math.PI * 1.3) * (reducedMotion ? .08 : 1);
      v.copy(f.from).sub(hole.center);
      if (f.orbit) {
        const theta = Math.atan2(v.z, v.x) + angle, collapse = Math.max(0, (t - .8) / .2);
        const r = (core * 1.8 + (f.p.index % 5) * units) * (1 - collapse);
        const blend = approach * approach * (3 - 2 * approach);
        dir.set(Math.cos(theta) * r, Math.sin(theta) * r * .15, Math.sin(theta) * r);
        v.lerp(dir, blend).add(hole.center);
      } else v.applyAxisAngle(axis, angle).multiplyScalar((1 - t) ** 1.35).add(hole.center);
      f.p.position.copy(v).applyMatrix4(f.inverse);
      f.p.quaternion.setFromAxisAngle(f.spin, reducedMotion ? 0 : angle + t * (4 + f.phase % 5));
      f.handle.pose(f.p, Math.max(.001, (1 - t) ** .65), reducedMotion ? 1 : 1 + 1.4 * Math.sin(t * Math.PI)); touched.add(f.handle);
    }
    for (const h of touched) h.touch();
    dust.visible = !reducedMotion && hole.age >= T.anticipation;
    if (dust.visible) {
      for (let i = 0; i < particleCap; i++) {
        const t = (hole.age * .38 + i / particleCap) % 1, angle = i * 2.39996 + t * 5, r = radius * (1 - t);
        dummy.position.set(hole.center.x + Math.cos(angle) * r, hole.center.y - (1 - t) * T.height * units, hole.center.z + Math.sin(angle) * r);
        dir.copy(hole.center).sub(dummy.position).normalize(); dummy.quaternion.setFromUnitVectors(localY, dir);
        dummy.scale.set(.09 * units, (1 + t * 4) * units, .09 * units); dummy.updateMatrix(); dust.setMatrixAt(i, dummy.matrix);
      }
      dust.instanceMatrix.needsUpdate = true;
    }
    if (hole.age >= T.duration) {
      releaseAll(); hole = null; popAge = 0; stats.finished++; dust.visible = false;
      shock.position.copy(root.position); shock.visible = true; shockMat.opacity = 0; shock.scale.setScalar(.001);
      impact.trigger({ time: clock, toolId: 'nuke' }); stats.rumbles++; audio.pop();
    }
  }
  return { launch, update, clear, render, reset: clear, group: root, get animating() { return Boolean(hole) || popAge >= 0; },
    get stats() { return { ...stats, live: hole || popAge >= 0 ? 1 : 0, phase: hole ? (hole.age < T.anticipation ? 'growing' : 'feeding') : popAge >= 0 ? 'collapse' : 'idle',
      age: hole?.age ?? 0, pieces: livePieces(), flying: flying.length, falling: falling.length, peeling: peeling.length, cap, particleCap, cooldown: 0, radius, position: root.visible ? root.position.toArray() : null, voices: audio.voices, audio: audio.stats, lens: { ...lensStats, active: Boolean(lens), reducedMotion } }; },
    dispose() { clear(); if (scene.onBeforeRender === beforeRender) scene.onBeforeRender = previousBefore; if (scene.onAfterRender === afterRender) scene.onAfterRender = previousAfter;
      root.removeFromParent(); shock.removeFromParent(); dust.removeFromParent(); dust.dispose();
      lamp.removeFromParent(); lamp.dispose();
      for (const o of [sphere, black, ringGeo, glow, rimGeo, rimMat, haloGeo, haloMat, shockGeo, shockMat, dustGeo, dustMat]) o.dispose(); } };
}
