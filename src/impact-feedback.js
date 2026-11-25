/** Local, bounded debris feedback. Does not alter building geometry or rewards. */
export function createImpactFeedback(THREE, scene, { reducedMotion = false } = {}) {
  const root = new THREE.Group(); root.name = 'impact-feedback'; scene.add(root);
  const transform = new THREE.Object3D(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const normal = new THREE.Vector3(), axis = new THREE.Vector3(0, 0, 1);
  const orientation = new THREE.Quaternion(), color = new THREE.Color();
  let disposed = false, seed = 0x84613, bursts = 0, evicted = 0, serial = 0, lastEvent = null;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  function pool(name, capacity, geometry, material) {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.name = name; mesh.frustumCulled = false; mesh.visible = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < capacity; i++) mesh.setMatrixAt(i, zero);
    root.add(mesh);
    return { mesh, capacity, cursor: 0, active: 0, particles: Array.from({ length: capacity }, () => ({
      age: 0, life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      sx: 0, sy: 0, sz: 0, rx: 0, ry: 0, rz: 0, spin: 0, q: new THREE.Quaternion(),
    })) };
  }
  const chips = pool('impact-stone-chips', 192, new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: '#b7ad97', roughness: .94 }));
  const dust = pool('impact-low-dust', 96, new THREE.SphereGeometry(1, 8, 4),
    new THREE.MeshBasicMaterial({ color: '#b8b0a0', transparent: true, opacity: .13, depthWrite: false }));
  const rings = pool('impact-local-rings', 12, new THREE.TorusGeometry(1, .035, 4, 32),
    new THREE.MeshBasicMaterial({ color: '#efcc85', transparent: true, opacity: .46, depthWrite: false }));
  const pools = [chips, dust, rings];
  function slot(p) {
    let index = p.cursor;
    for (let i = 0; i < p.capacity; i++) {
      const candidate = (p.cursor + i) % p.capacity;
      if (p.particles[candidate].life === 0) { index = candidate; break; }
    }
    p.cursor = (index + 1) % p.capacity;
    const particle = p.particles[index];
    if (particle.life) evicted++; else p.active++;
    particle.age = 0; return particle;
  }
  const finite = value => Number.isFinite(value);
  function paint(p, type) {
    // Empty pools keep their buffers until the next burst. Hiding the mesh
    // avoids both a redundant upload and drawing zero-sized instances.
    p.mesh.visible = p.active > 0;
    if (!p.active) return;
    for (let i = 0; i < p.capacity; i++) {
      const a = p.particles[i]; if (!a.life) { p.mesh.setMatrixAt(i, zero); continue; }
      const progress = a.age / a.life;
      const fade = Math.min(1, (1 - progress) * 4);
      transform.position.set(a.x, a.y, a.z);
      if (type === 'ring') {
        transform.quaternion.copy(a.q);
        const r = a.sx * (.5 + progress * .9);
        transform.scale.set(r, r, Math.max(.05, fade));
      } else {
        transform.rotation.set(a.rx, a.ry, a.rz);
        const growth = type === 'dust' ? 1 + progress * .8 : 1;
        transform.scale.set(a.sx * fade * growth, a.sy * fade * growth, a.sz * fade * growth);
      }
      transform.updateMatrix(); p.mesh.setMatrixAt(i, transform.matrix);
    }
    p.mesh.instanceMatrix.needsUpdate = true;
  }
  function burst({ point, normal: inputNormal, radius = 1, force = 6, toolId,
    count = 0, weight = 0, finisher = false, cleared = false } = {}) {
    if (disposed || !point || ![point.x, point.y, point.z, count].every(finite) || count <= 0) return false;
    radius = finite(radius) ? Math.max(.1, Math.min(radius, 20)) : 1;
    force = finite(force) ? Math.max(0, Math.min(force, 40)) : 6;
    normal.set(inputNormal?.x ?? 0, inputNormal?.y ?? 1, inputNormal?.z ?? 0);
    if (![normal.x, normal.y, normal.z].every(finite) || normal.lengthSq() < 1e-10) normal.set(0, 1, 0);
    normal.normalize(); orientation.setFromUnitVectors(axis, normal);
    const boost = cleared ? 1.65 : finisher ? 1.35 : 1;
    const drilling = toolId === 'drill' || toolId === 'minigun' || toolId === 'flamethrower'; // continuous tools: lighter bursts
    const amount = reducedMotion ? 3 : Math.min(24, Math.ceil((drilling ? 5 : 9) * boost + Math.sqrt(count) * .3));
    const scale = Math.min(2.2, .65 + radius * .085) * boost;
    bursts++;
    lastEvent = Object.freeze({ serial: ++serial, toolId: toolId ?? null, count,
      weight: finite(weight) ? weight : 0, radius, force, finisher: !!finisher, cleared: !!cleared,
      point: Object.freeze({ x: point.x, y: point.y, z: point.z }),
      normal: Object.freeze({ x: normal.x, y: normal.y, z: normal.z }),
    });
    for (let i = 0; i < amount; i++) {
      const a = slot(chips), speed = reducedMotion ? .08 : (1.3 + random() * 2.1 + force * .055) * boost;
      a.life = reducedMotion ? .25 : .65 + random() * .45;
      a.x = point.x + normal.x * .08; a.y = point.y + normal.y * .08; a.z = point.z + normal.z * .08;
      a.vx = (normal.x * .7 + (random() - .5)) * speed;
      a.vy = reducedMotion ? 0 : (normal.y * .4 + .45 + random() * .5) * speed;
      a.vz = (normal.z * .7 + (random() - .5)) * speed;
      const size = (.09 + random() * .14) * scale;
      a.sx = size; a.sy = size * (.55 + random() * .45); a.sz = size * (.60 + random() * .65);
      a.rx = random() * 6; a.ry = random() * 6; a.rz = random() * 6; a.spin = reducedMotion ? 0 : (random() - .5) * 9;
      color.set(cleared && i < 3 ? '#dfbb6e' : random() > .5 ? '#b7ad97' : '#958e80');
      chips.mesh.setColorAt(chips.particles.indexOf(a), color);
    }
    const clouds = reducedMotion ? 1 : drilling ? 2 : cleared ? 9 : finisher ? 6 : 4;
    for (let i = 0; i < clouds; i++) {
      const a = slot(dust), spread = scale * .25;
      a.life = reducedMotion ? .22 : .40 + random() * .25;
      a.x = point.x + normal.x * .1 + (random() - .5) * spread;
      a.y = point.y + normal.y * .1; a.z = point.z + normal.z * .1 + (random() - .5) * spread;
      a.vx = reducedMotion ? 0 : (random() - .5) * 1.7 * scale;
      a.vy = reducedMotion ? 0 : .15; a.vz = reducedMotion ? 0 : (random() - .5) * 1.7 * scale;
      a.sx = (.24 + random() * .30) * scale; a.sy = a.sx * .4; a.sz = a.sx;
      a.rx = a.ry = a.rz = a.spin = 0;
    }
    const r = slot(rings); r.life = reducedMotion ? .16 : cleared ? .38 : .24;
    r.x = point.x + normal.x * .11; r.y = point.y + normal.y * .11; r.z = point.z + normal.z * .11;
    r.sx = scale * (reducedMotion ? .50 : .85); r.q.copy(orientation);
    paint(chips, 'chip'); paint(dust, 'dust'); paint(rings, 'ring');
    if (chips.mesh.instanceColor) chips.mesh.instanceColor.needsUpdate = true;
    return true;
  }
  function update(dt) {
    if (disposed || !finite(dt) || dt <= 0) return;
    dt = Math.min(dt, 10);
    for (const p of pools) {
      if (!p.active) continue;
      for (const a of p.particles) {
        if (!a.life) continue;
        a.age += dt;
        if (a.age >= a.life) { a.life = 0; p.active--; continue; }
        if (p !== rings) {
          a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt;
          if (p === chips && !reducedMotion) a.vy -= 9 * dt;
          a.rx += a.spin * dt; a.rz += a.spin * .7 * dt;
        }
      }
      paint(p, p === chips ? 'chip' : p === dust ? 'dust' : 'ring');
    }
  }
  function clear() {
    if (disposed) return;
    lastEvent = null; serial = 0;
    for (const p of pools) { p.active = 0; p.cursor = 0; for (const a of p.particles) a.life = 0; }
    paint(chips, 'chip'); paint(dust, 'dust'); paint(rings, 'ring');
  }
  function dispose() {
    if (disposed) return; clear(); disposed = true; root.removeFromParent();
    for (const p of pools) { p.mesh.dispose(); p.mesh.geometry.dispose(); p.mesh.material.dispose(); }
  }
  return { burst, update, clear, dispose, get stats() { return {
    active: chips.active + dust.active + rings.active, chips: chips.active, dust: dust.active, rings: rings.active,
    capacity: 300, meshes: 3, bursts, evicted, disposed, reducedMotion, serial, lastEvent,
  }; } };
}
