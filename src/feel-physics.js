// ?feel&physics preview: falling parts of a building become a few rigid bodies (one per connected cluster of
// fragment cells) in a Rapier world. Remaining building cells are static boxes (supports, pivots), the ground is a
// terrain heightfield. Hard landings break a body into blocks, then blocks into loose fragments (the ordinary
// debris path). Rapier (vendor/, ~2.2 MB) is fetched on the first attack, never during the initial load.
// Without ?physics this file is never imported and the B-collapse in model-destruction.js runs unchanged.
import { setDebrisPhysics } from './model-destruction.js?v=lz69';

const RAPIER_URL = '../vendor/rapier3d-compat-0.19.3/rapier.mjs';
const H = 1 / 60;

export function createFeelPhysics(THREE, options = {}) {
  const query = options.query ?? new URLSearchParams(globalThis.location?.search ?? '');
  const num = (k, lo, hi, d) => { const v = Number.parseFloat(query.get(k)); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  // URL knobs: &weak= stress factor (lower = more collapses), &span= hanging pieces per side attachment,
  // &tip=off, &g= gravity (world units/s^2), &break= landing speed that breaks a body, &crush= contact force
  // (x body weight) that crushes a remaining support cell, &bodies= simultaneous rigid bodies, &pshake= tremble s.
  const cfg = {
    weak: { stress: num('weak', 1, 50, 2), span: num('span', .3, 50, 1.5), tip: query.get('tip') !== 'off' },
    gravity: num('g', 2, 40, 18), breakSpeed: num('break', 1, 60, 5), crush: num('crush', 1, 100, 4),
    maxBodies: Math.round(num('bodies', 1, 80, 40)), preShake: num('pshake', 0, 1, .12), maxAge: 7, loadTimeout: 3,
  };
  let R = null, world = null, events = null, loading = null, failed = false, acc = 0, loadStart = 0;
  const states = new Map(), bodies = new Set(), owners = new Map();
  const stats = { config: cfg, loaded: false, loadMs: null, error: null, collapses: 0, clusters: 0, bodies: 0, peakBodies: 0, breaks: 0,
    crushed: 0, debris: 0, sunk: 0, fallbacks: 0, steps: 0, stepMs: 0, stepMsMax: 0, spawnMsMax: 0, statics: 0, modes: {}, stuck: 0, get activeBodies() { return bodies.size; } };
  const v3 = new THREE.Vector3(), w3 = new THREE.Vector3(), c3 = new THREE.Vector3(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const box = new THREE.Box3(), pbox = new THREE.Box3();

  function prepare() {
    if (loading) return loading;
    loadStart = performance.now();
    loading = import(RAPIER_URL).then(async module => {
      R = module.default; await R.init();
      world = new R.World({ x: 0, y: -cfg.gravity, z: 0 }); world.timestep = H; events = new R.EventQueue(true);
      stats.loaded = true; stats.loadMs = Math.round(performance.now() - loadStart);
    }).catch(error => { failed = true; stats.error = String(error?.message || error); console.warn('물리 엔진을 불러오지 못해 기본 무너짐을 써요.', error); });
    return loading;
  }
  function state(a) {
    let s = states.get(a);
    if (!s) { s = { jobs: [], statics: new Map(), ground: null, groundMin: Infinity, bodies: 0, sinking: 0 }; states.set(a, s); }
    return s;
  }
  // Pose of a fragment held by body b: world = p + q * (s * (rest - R)); local = inverse(group) * world.
  function writePose(b) { writeFrame(b.adapter, b.ref, b.rb.translation(), b.rb.rotation(), b.pieces); }
  function writeFrame(a, ref, t, r, pieces) {
    qa.set(r.x, r.y, r.z, r.w); qb.copy(a.quaternion).invert().multiply(qa);
    for (const piece of pieces) {
      v3.copy(piece.restPosition).sub(ref).multiplyScalar(a.scale).applyQuaternion(qa); v3.x += t.x; v3.y += t.y; v3.z += t.z;
      piece.position.copy(v3).applyMatrix4(a.inverse); piece.quaternion.copy(qb); a.pose(piece);
    }
  }
  // Snapshot of a body's state (kept valid after the body is removed from the world).
  function snap(b) {
    const t = b.rb.translation(), r = b.rb.rotation(), v = b.rb.linvel(), w = b.rb.angvel(), c = b.rb.worldCom();
    return { adapter: b.adapter, ref: b.ref, level: b.level, t: { x: t.x, y: t.y, z: t.z }, q: { x: r.x, y: r.y, z: r.z, w: r.w }, v: { x: v.x, y: v.y, z: v.z }, w: { x: w.x, y: w.y, z: w.z }, c: new THREE.Vector3(c.x, c.y, c.z) };
  }
  function worldOf(f, rest, out) {
    qa.set(f.q.x, f.q.y, f.q.z, f.q.w);
    return out.copy(rest).sub(f.ref).multiplyScalar(f.adapter.scale).applyQuaternion(qa).add(c3.set(f.t.x, f.t.y, f.t.z));
  }
  function pointVelocity(f, point, out) {
    const v = f.v, w = f.w, x = point.x - f.c.x, y = point.y - f.c.y, z = point.z - f.c.z;
    return out.set(w.y * z - w.z * y + v.x, w.z * x - w.x * z + v.y, w.x * y - w.y * x + v.z);
  }

  function ensureGround(a, s) {
    if (s.ground) return;
    const wb = box.copy(a.bounds).applyMatrix4(a.group.matrixWorld), cx = (wb.min.x + wb.max.x) / 2, cz = (wb.min.z + wb.max.z) / 2;
    const size = Math.max(wb.max.x - wb.min.x, wb.max.z - wb.min.z) + 60, n = Math.max(8, Math.min(64, Math.ceil(size / 1.5)));
    const heights = new Float32Array((n + 1) * (n + 1));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const g = a.groundHeightAt(cx + (j / n - .5) * size, cz + (i / n - .5) * size), y = Number.isFinite(g) ? g : wb.min.y;
      heights[i + j * (n + 1)] = y; if (y < s.groundMin) s.groundMin = y;
    }
    s.ground = world.createCollider(R.ColliderDesc.heightfield(n, n, heights, { x: size, y: 1, z: size }).setTranslation(cx, 0, cz).setFriction(.9));
    owners.set(s.ground.handle, { ground: true, adapter: a });
  }
  // Remaining building cells near the falling clusters become fixed boxes, nearest first.
  function ensureStatics(a, s, region) {
    const m = a.group.matrixWorld, found = [];
    region.getCenter(c3);
    for (const piece of a.pieces) {
      if (!piece.active || s.statics.has(piece)) continue;
      pbox.copy(piece.bounds).applyMatrix4(m); if (!pbox.intersectsBox(region)) continue;
      found.push({ piece, d: pbox.distanceToPoint(c3) });
    }
    found.sort((x, y) => x.d - y.d);
    for (const { piece } of found.slice(0, Math.max(0, 900 - s.statics.size))) {
      piece.bounds.getCenter(v3).applyMatrix4(m); piece.bounds.getSize(w3).multiplyScalar(a.scale / 2);
      const desc = R.ColliderDesc.cuboid(Math.max(.08, w3.x), Math.max(.08, w3.y), Math.max(.08, w3.z))
        .setTranslation(v3.x, v3.y, v3.z).setRotation(a.quaternion).setFriction(.9);
      const col = world.createCollider(desc); s.statics.set(piece, col); owners.set(col.handle, { piece, adapter: a });
    }
    stats.statics = [...states.values()].reduce((n, x) => n + x.statics.size, 0);
  }
  function removeStatic(s, piece) {
    const col = s.statics.get(piece); if (!col) return;
    owners.delete(col.handle); world.removeCollider(col, true); s.statics.delete(piece);
  }

  // One rigid body per cluster. Colliders: 2x2x2-cell blocks (union of fragment bounds) unless the block also
  // holds a cell that is not part of this body, then one box per fragment, so no collider overlaps a support.
  function createBody(a, pieces, level, parent, lin, ang, mode = 'fall') {
    const ref = new THREE.Vector3(); let mass = 0;
    for (const p of pieces) { ref.addScaledVector(p.restPosition, p.weight); mass += p.weight; }
    ref.multiplyScalar(1 / mass);
    const p0 = parent ? worldOf(parent, ref, new THREE.Vector3()) : ref.clone().applyMatrix4(a.group.matrixWorld);
    const rot = parent ? parent.q : a.quaternion;
    const rb = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p0.x, p0.y, p0.z).setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w })
      .setLinvel(lin?.x ?? 0, lin?.y ?? 0, lin?.z ?? 0).setAngvel({ x: ang?.x ?? 0, y: ang?.y ?? 0, z: ang?.z ?? 0 }).setLinearDamping(.05).setAngularDamping(.15).setCcdEnabled(true));
    // Sides shrink a little so a body never starts wedged against its neighbours; the bottom stays flush with
    // the supports so the body does not drop onto them at the start.
    const mine = new Set(pieces), blocks = new Map(), s = a.scale, shrink = a.cellSize * s * .04, flush = .01;
    let G = 2; const key = (c, g) => `${Math.floor(c[0] / g)},${Math.floor(c[1] / g)},${Math.floor(c[2] / g)}`;
    for (;;) { blocks.clear(); for (const p of pieces) { const c = a.cellOf[p.index], k = key(c, G); (blocks.get(k) ?? blocks.set(k, []).get(k)).push(p); } if (blocks.size <= 96 || G >= 6) break; G++; }
    // An overloaded mass keeps crushing whatever it presses on (progressive collapse down to the ground);
    // others only crush a support they slam into.
    const b = { adapter: a, rb, pieces, ref, level, mass, mode, age: 0, still: 0, moved: 0, pv: new THREE.Vector3(), crushed: false, colliders: 0,
      crushForce: (mode === 'crush' && level === 0 ? .05 : cfg.crush) * mass * cfg.gravity };
    const addBox = (list) => {
      pbox.makeEmpty(); let m = 0; for (const p of list) { pbox.union(p.bounds); m += p.weight; }
      pbox.getCenter(v3).sub(ref).multiplyScalar(s); pbox.getSize(w3).multiplyScalar(s / 2);
      const col = world.createCollider(R.ColliderDesc.cuboid(Math.max(.12, w3.x - shrink), Math.max(.12, w3.y - flush), Math.max(.12, w3.z - shrink))
        .setTranslation(v3.x, v3.y, v3.z).setMass(m).setFriction(.85).setRestitution(.02)
        .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(b.crushForce), rb);
      owners.set(col.handle, { body: b }); b.colliders++;
    };
    for (const list of blocks.values()) {
      let mixed = false;
      if (list.length > 1) {
        const c = a.cellOf[list[0].index], bx = Math.floor(c[0] / G) * G, by = Math.floor(c[1] / G) * G, bz = Math.floor(c[2] / G) * G;
        for (let dx = 0; dx < G && !mixed; dx++) for (let dy = 0; dy < G && !mixed; dy++) for (let dz = 0; dz < G && !mixed; dz++) {
          const n = a.index.get(a.cellKey(bx + dx, by + dy, bz + dz)), other = n === undefined ? null : a.pieces[n];
          if (other && !mine.has(other) && !other.hidden) mixed = true;
        }
      }
      if (mixed) for (const p of list) addBox([p]); else addBox(list);
    }
    bodies.add(b); state(a).bodies++; stats.bodies++; stats.peakBodies = Math.max(stats.peakBodies, bodies.size);
    for (const p of pieces) if (!parent) a.claim(p);
    writePose(b);
    return b;
  }
  function removeBody(b) {
    if (!bodies.delete(b)) return;
    world.removeRigidBody(b.rb); state(b.adapter).bodies--;
  }
  // Loose fragment: carries the body's velocity at its position plus an outward kick; over budget it sinks.
  function shed(f, piece, kick, com) {
    const p = worldOf(f, piece.restPosition, new THREE.Vector3()), v = pointVelocity(f, p, new THREE.Vector3());
    w3.set(p.x - com.x, 0, p.z - com.z); if (w3.lengthSq() < 1e-6) w3.set(Math.sin(piece.index), 0, Math.cos(piece.index)); w3.normalize();
    v.addScaledVector(w3, kick * (.5 + (piece.index % 5) * .15)); v.y += kick * (.4 + (piece.index % 3) * .2);
    if (f.adapter.fly(piece, v, 2 + kick * .3)) stats.debris++; else { f.adapter.sink(piece); stats.sunk++; }
  }
  // Break on a hard landing: blocks of G cells become new bodies (G grows until they fit the body budget),
  // small blocks and the last level shed loose fragments; dust where it hit.
  function breakBody(body, dv) {
    writePose(body); const b = snap(body), a = b.adapter, com = b.c, ang = b.w, kick = Math.min(6, dv * .35), pieces = body.pieces;
    let low = null; for (const p of pieces) { const w = worldOf(b, p.restPosition, new THREE.Vector3()); if (!low || w.y < low.y) low = w; }
    if (low) for (let k = 0; k < 3; k++) a.dust(low.x + (k - 1) * a.cellSize * a.scale, low.y, low.z + ((k * 7) % 3 - 1) * a.cellSize * a.scale, 6 + dv);
    stats.breaks++; removeBody(body);
    if (b.level >= 2 || pieces.length <= 4) { for (const p of pieces) shed(b, p, kick, com); return; }
    let G = b.level === 0 ? 2 : 1, groups;
    for (;;) {
      const m = new Map(); for (const p of pieces) { const c = a.cellOf[p.index], k = `${Math.floor(c[0] / G)},${Math.floor(c[1] / G)},${Math.floor(c[2] / G)}`; (m.get(k) ?? m.set(k, []).get(k)).push(p); }
      groups = [...m.values()].sort((x, y) => y.length - x.length);
      if (groups.filter(g => g.length >= 3).length <= Math.min(16, cfg.maxBodies - bodies.size) || G >= 8) break; G++;
    }
    // At most 16 new bodies per break keeps the landing frame cheap; the rest leaves as loose fragments.
    let budget = Math.min(16, cfg.maxBodies - bodies.size);
    for (const list of groups) {
      if (list.length < 3 || budget <= 0) { for (const p of list) shed(b, p, kick, com); continue; }
      budget--;
      const sub = { restPosition: new THREE.Vector3() }; let m = 0; for (const p of list) { sub.restPosition.addScaledVector(p.restPosition, p.weight); m += p.weight; } sub.restPosition.multiplyScalar(1 / m);
      const at = worldOf(b, sub.restPosition, new THREE.Vector3()), v = pointVelocity(b, at, new THREE.Vector3());
      w3.set(at.x - com.x, 0, at.z - com.z); if (w3.lengthSq() > 1e-6) v.addScaledVector(w3.normalize(), kick * .45); v.y += kick * .25;
      const spin = new THREE.Vector3(ang.x * .7 + (w3.z || .3) * kick * .25, ang.y * .7, ang.z * .7 - (w3.x || .3) * kick * .25);
      createBody(a, list, b.level + 1, b, v, spin);
    }
  }
  // Settled rubble sinks into the ground as one rigid piece (no per-fragment shrinking), then is retired.
  const sinking = [];
  function endBody(b, sink = true) {
    writePose(b); const f = snap(b); removeBody(b);
    if (!sink) { for (const p of b.pieces) b.adapter.drop(p); return; }
    let lo = Infinity, hi = -Infinity; for (const p of b.pieces) { const y = worldOf(f, p.restPosition, v3).y; lo = Math.min(lo, y); hi = Math.max(hi, y); }
    const depth = hi - lo + b.adapter.cellSize * b.adapter.scale * 1.2;
    sinking.push({ f, pieces: b.pieces, depth, rate: Math.max(1.2, depth / 1.1), d: 0 }); state(b.adapter).sinking++; stats.sunk += b.pieces.length;
    if (b.pieces.length > 6) b.adapter.dust(f.c.x, lo, f.c.z, 6);
  }
  function stepSinking(dt, touched) {
    for (let i = sinking.length - 1; i >= 0; i--) {
      const k = sinking[i], a = k.f.adapter, step = Math.min(dt, .1) * k.rate; k.d += step; k.f.t.y -= step;
      if (k.d >= k.depth) { sinking.splice(i, 1); state(a).sinking--; for (const p of k.pieces) a.drop(p); touched.add(a); continue; }
      writeFrame(a, k.f.ref, k.f.t, k.f.q, k.pieces); touched.add(a);
    }
  }

  function spawn(a, s, job) {
    ensureGround(a, s);
    const region = new THREE.Box3(); for (const c of job.clusters) for (const p of c) region.union(pbox.copy(p.bounds).applyMatrix4(a.group.matrixWorld));
    region.expandByScalar(a.cellSize * a.scale * 2.5); ensureStatics(a, s, region);
    for (const c of job.clusters) {
      // Supports never let go perfectly evenly: a mass with nothing left under it starts with a slight spin so it
      // does not drop like a lift (one still resting on a support tips by itself).
      const resting = c.some(p => { const q = a.cellOf[p.index], n = a.index.get(a.cellKey(q[0], q[1] - 1, q[2])); return n !== undefined && a.pieces[n].active; });
      const seed = c[0].index * 7.31, spin = resting ? null : { x: Math.sin(seed) * .18, y: Math.cos(seed * 1.3) * .06, z: Math.sin(seed * 2.1) * .18 };
      if (c.length >= 3 && bodies.size < cfg.maxBodies) { createBody(a, c, 0, null, null, spin, c.mode); stats.clusters++; stats.modes[c.mode] = (stats.modes[c.mode] ?? 0) + 1; }
      else for (const p of c) { a.fallback(p); stats.fallbacks++; }
    }
  }
  function substep() {
    for (const b of bodies) { const v = b.rb.linvel(); b.pv.set(v.x, v.y, v.z); b.crushed = false; }
    world.step(events);
    const crush = new Map();
    events.drainContactForceEvents(e => {
      const o1 = owners.get(e.collider1()), o2 = owners.get(e.collider2()), body = o1?.body ?? o2?.body, fixed = o1?.piece ? o1 : o2?.piece ? o2 : null;
      if (body && fixed && body.age > .2 && e.totalForceMagnitude() > body.crushForce) { crush.set(fixed.piece, fixed.adapter); body.crushed = true; }
      // Hitting the ground itself at speed shatters the mass, even when crushing supports had slowed it.
      if (body && (o1?.ground || o2?.ground) && body.age > .2) {
        const speed = Math.hypot(body.pv.x, body.pv.y, body.pv.z);
        if (speed > cfg.breakSpeed * .6 * (1 + .3 * body.level)) body.slam = Math.max(body.slam ?? 0, speed);
      }
    });
    for (const [piece, a] of crush) {
      removeStatic(state(a), piece);
      if (a.crush(piece)) {
        stats.crushed++; piece.bounds.getCenter(v3).applyMatrix4(a.group.matrixWorld);
        if (a.fly(piece, w3.set(Math.sin(piece.index * 3.1) * 2, 1.5, Math.cos(piece.index * 3.1) * 2), 4)) stats.debris++; else { a.sink(piece); stats.sunk++; }
      }
    }
    const broken = [];
    for (const b of bodies) {
      b.age += H; const v = b.rb.linvel();
      // A crushed support absorbs part of the blow: the body keeps most of its speed and carries on down.
      if (b.slam) { broken.push([b, b.slam]); b.slam = 0; continue; }
      if (b.crushed) { b.rb.setLinvel({ x: b.pv.x * .8, y: Math.min(v.y, b.pv.y * .8), z: b.pv.z * .8 }, true); continue; }
      const dv = Math.hypot(v.x - b.pv.x, v.y - b.pv.y, v.z - b.pv.z);
      if (b.age > .15 && dv > cfg.breakSpeed * (1 + .3 * b.level)) broken.push([b, dv]);
    }
    for (const [b, dv] of broken) if (bodies.has(b)) breakBody(b, dv);
    for (const b of bodies) {
      const v = b.rb.linvel(), w = b.rb.angvel(), t = b.rb.translation(), s = state(b.adapter);
      const speed = Math.hypot(v.x, v.y, v.z); b.moved += speed * H;
      b.still = speed < .35 && Math.hypot(w.x, w.y, w.z) < .5 || b.rb.isSleeping() ? b.still + H : 0;
      // A mass that never got going (already lying on the ground or wedged) crumbles instead of sinking whole.
      if (b.level === 0 && b.moved < .3 && b.still > .35) { stats.stuck++; breakBody(b, 4); }
      else if (b.still > .6 || b.age > cfg.maxAge) endBody(b);
      else if (t.y < s.groundMin - 30) endBody(b, false);
    }
  }
  function leader(a) {
    for (const [x, s] of states) if (s.bodies > 0 || s.sinking > 0 || s.jobs.length) return x === a;
    return false;
  }

  const driver = {
    weak: cfg.weak,
    prepare,
    collapse(a, clusters) {
      const s = state(a); stats.collapses++;
      s.jobs.push({ clusters, age: 0 }); prepare();
    },
    update(a, dt) {
      const s = states.get(a); if (!s) return;
      for (let i = s.jobs.length - 1; i >= 0; i--) {
        const job = s.jobs[i]; job.age += dt;
        if (world && job.age >= cfg.preShake) { s.jobs.splice(i, 1); const t = performance.now(); spawn(a, s, job); stats.spawnMsMax = Math.max(stats.spawnMsMax, performance.now() - t); }
        else if (failed || job.age > cfg.loadTimeout) { s.jobs.splice(i, 1); for (const c of job.clusters) for (const p of c) { a.fallback(p); stats.fallbacks++; } }
      }
      if (world) for (const [piece] of s.statics) if (!piece.active) removeStatic(s, piece);
      if (!world || !bodies.size && !sinking.length || !leader(a)) return;
      const start = performance.now(), touched = new Set();
      // At most two 1/60 s steps per frame: on a slow phone the collapse slows down instead of stalling the frame.
      acc = Math.min(acc + Math.min(dt, .1), 2 * H);
      while (acc >= H - 1e-9) { acc -= H; substep(); stats.steps++; }
      stepSinking(dt, touched);
      for (const b of bodies) { writePose(b); touched.add(b.adapter); }
      for (const x of touched) x.touch();
      const ms = performance.now() - start; stats.stepMs = stats.stepMs * .9 + ms * .1; stats.stepMsMax = Math.max(stats.stepMsMax, ms);
    },
    clear(a) {
      const s = states.get(a); if (!s) return;
      for (const b of [...bodies]) if (b.adapter === a) removeBody(b);
      for (let i = sinking.length - 1; i >= 0; i--) if (sinking[i].f.adapter === a) sinking.splice(i, 1);
      if (world) { for (const piece of [...s.statics.keys()]) removeStatic(s, piece); if (s.ground) { owners.delete(s.ground.handle); world.removeCollider(s.ground, false); } }
      states.delete(a);
    },
  };
  setDebrisPhysics(driver);
  return {
    stats, driver, ready: () => prepare(),
    // Test/diagnostic view of the live bodies: fragment count, level, centre and tilt from the start rotation.
    inspect() { return [...bodies].map(b => { const t = b.rb.translation(), r = b.rb.rotation(), q0 = b.adapter.quaternion; const dot = Math.min(1, Math.abs(r.x * q0.x + r.y * q0.y + r.z * q0.z + r.w * q0.w));
      return { pieces: b.pieces.length, level: b.level, colliders: b.colliders, position: { x: t.x, y: t.y, z: t.z }, rotation: { x: r.x, y: r.y, z: r.z, w: r.w }, angle: 2 * Math.acos(dot), age: b.age }; }); },
    dispose() { setDebrisPhysics(null); for (const a of [...states.keys()]) driver.clear(a); world?.free?.(); world = null; },
  };
}
