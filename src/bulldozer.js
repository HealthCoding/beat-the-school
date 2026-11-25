// Bulldozer, the second ad-reward weapon (user decisions 2026-10-22; 시안/광고무기_발파·불도저_시안.html variant B, icon B1).
// Press on the ground or a building: a small yellow bulldozer appears near the press (outside every building; pressed on a
// building it stands `spawnBack` out from that wall, facing it) and drives toward the pointer along the terrain
// (campus.terrain.heightAt) while it is held; letting go brakes it, so a long hold is full control. A quick tap still does
// something on a phone: it drives toward the tapped spot for at most `tapDrive` (on a building: through the wall).
// Held on a building, it keeps pushing in the direction it went in. A press far from the parked dozer brings a new one there.
// The blade scrapes the band in front of it (fragments whose centre is within `floor` above the ground it stands on and
// inside the blade width): the nearest few fly forward as chips, the rest vanish. Once a building's ground floor (the blast's
// band: base .. base + floor) has lost its share of weight (doomScale / sqrt(footprint m²), within doomMin .. doom: a big building needs
// a smaller share but more driving), the whole building comes down in place (model-destruction split
// `drop`, as the blast); a building it stops scraping for `settle` seconds short of that drops only the part above the strip.
// The support graph roots every fragment that touches the ground, so this module decides the collapse (as blast-demolition.js).
// Protected buildings stop the dozer at their outline and light the shield; nothing is damaged. Trees and lamps are driven
// through (no collision); it never climbs onto a building (heightAt is the ground or the building's pad).
// Sound: the crane's diesel voice from wrecking-ball.js (idle, revs with speed) and its rubble crunch; no new audio files.
// Zoomed far out the model is drawn larger (look only, minPixels / maxLook) so it never shrinks to a dot.
// Numbers: weapon-tuning.js `bulldozer`.
import { WEAPON_TUNING } from './weapon-tuning.js?v=sn130';
import { buildingBoxes, createWreckAudio } from './wrecking-ball.js?v=wreck46';
export const DOZER_ID = 'bulldozer';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export function createBulldozer(THREE, scene, { campus, camera, protectedSet = null, tuning = WEAPON_TUNING.bulldozer, reducedMotion = false,
  mobile = false, viewHeight = () => globalThis.innerHeight || 720, output = () => null, heavyAudio = null, probe = () => null, onScrape = () => {}, onCollapse = () => {}, onShield = () => {} } = {}) {
  const T = tuning, u = campus.worldUnitsPerMeter || .5, m = v => v * u, S = u * T.size, heightAt = (x, z) => campus.terrain.heightAt(x, z);
  const audio = createWreckAudio({ output, heavy: heavyAudio, lite: mobile, idle: 1 });
  const root = new THREE.Group(); root.name = 'bulldozer'; scene.add(root);

  // ---------- model (plain blocks, metres before S; forward = +z) ----------
  const lam = color => new THREE.MeshLambertMaterial({ color });
  const mat = { yellow: lam('#f2c230'), blade: lam('#d9a800'), dark: lam('#2f353b'), steel: lam('#8f989e'), glass: lam('#3c5566'), black: lam('#1c1c1c') };
  const cube = new THREE.BoxGeometry(1, 1, 1), pipe = new THREE.CylinderGeometry(.1, .12, 1, 8);
  const box = (g, w, h, d, material, x, y, z) => { const o = new THREE.Mesh(cube, material); o.scale.set(w, h, d); o.position.set(x, y, z); g.add(o); return o; };
  const dozer = new THREE.Group(), body = new THREE.Group(), blade = new THREE.Group(); dozer.name = 'bulldozer-model'; dozer.add(body);
  for (const s of [-1, 1]) {
    box(body, .9, 1, 4.6, mat.dark, s * 1.35, .5, -.2); box(body, .94, .1, 4.66, mat.black, s * 1.35, 1.02, -.2);
    for (const z of [-2, -.7, .6, 1.9]) box(body, .96, .42, .42, mat.steel, s * 1.35, .42, z);
    box(body, .22, .3, 2.4, mat.dark, s * 1.35, .95, 2);
  }
  box(body, 2.1, 1.05, 2.5, mat.yellow, 0, 1.5, .6); box(body, 2.12, .12, 2.52, mat.dark, 0, 2.06, .6);
  box(body, 1.9, 1.1, 1.7, mat.yellow, 0, 1.55, -1.25); box(body, 1.94, .85, 1.6, mat.glass, 0, 2.52, -1.25); box(body, 2.1, .14, 1.9, mat.yellow, 0, 3.01, -1.25);
  const stack = new THREE.Mesh(pipe, mat.dark); stack.scale.y = .9; stack.position.set(.62, 2.5, 1.3); body.add(stack);
  box(body, .26, 1, .26, mat.dark, 0, .7, -2.75); box(body, 1.5, .26, .4, mat.dark, 0, 1.2, -2.6);
  box(blade, T.blade, 1.35, .26, mat.blade, 0, .8, 0).rotation.x = -.12; box(blade, T.blade, .18, .36, mat.steel, 0, .1, .1); box(blade, T.blade, .12, .3, mat.dark, 0, 1.5, -.1);
  blade.position.z = 3; body.add(blade);
  // soft dark footprint instead of a shadow-map caster (the shadow map only redraws on campus changes)
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: .28, depthWrite: false }));
  shade.rotation.x = -Math.PI / 2; shade.scale.set(Math.max(3.6, T.blade + .4), 6.8, 1); shade.position.set(0, .05, .1); shade.renderOrder = 1; dozer.add(shade);
  dozer.scale.setScalar(S); dozer.visible = false; root.add(dozer);
  const FRONT = 3.2 * S, BACK = 2.9 * S, HALF = T.blade / 2 * S + m(T.margin);

  // ---------- campus data ----------
  // The ground-floor band of a building (blast's rule) and its weight; once per building.
  const bands = new Map();
  function bandOf(entry) {
    let b = bands.get(entry); if (b) return b;
    const model = entry.model, minY = model.worldBounds.min.y, base = Math.max(minY, Number.isFinite(entry.baseY) ? entry.baseY : minY);
    const top = base + m(T.floor), band = [], v = new THREE.Vector3(); let weight = 0;
    model.group.updateWorldMatrix(true, false);
    for (let i = 0; i < model.pieces.length; i++) { const p = model.pieces[i]; v.copy(p.restPosition).applyMatrix4(model.group.matrixWorld); if (v.y <= top) { band.push(i); weight += p.weight; } }
    const c = model.worldBounds.getCenter(new THREE.Vector3()), lb = model.bounds, sc = new THREE.Vector3().setFromMatrixScale(model.group.matrixWorld);
    // footprint in m² (local bounds, so a rotated building is not inflated); a big building needs a smaller share gone
    const area = lb ? (lb.max.x - lb.min.x) * sc.x * (lb.max.z - lb.min.z) * sc.z / (u * u) : 0;
    const doom = area > 0 ? clamp(T.doomScale / Math.sqrt(area), T.doomMin, T.doom) : T.doom;
    b = { base, top, band, weight, cx: c.x, cz: c.z, area, doom }; bands.set(entry, b); return b;
  }
  function bandLost(entry) {
    const b = bandOf(entry); if (!b.weight) return 0;
    let lost = 0; for (const i of b.band) if (!entry.model.pieces[i].active) lost += entry.model.pieces[i].weight;
    return lost / b.weight;
  }
  // Building boxes (local bounds + inverse matrix, from the crane planner) for a clear spawn spot; refreshed as buildings clear.
  let boxes = null, boxesCleared = -1;
  function insideBuilding(x, z, pad) {
    if (!boxes || boxesCleared !== campus.clearedCount) { boxes = buildingBoxes(THREE, campus.entries); boxesCleared = campus.clearedCount; }
    for (const b of boxes) {
      const e = b.inv, lx = e[0] * x + e[8] * z + e[12], lz = e[2] * x + e[10] * z + e[14], p = pad / b.scale;
      if (lx >= b.min[0] - p && lx <= b.max[0] + p && lz >= b.min[2] - p && lz <= b.max[2] + p) return true;
    }
    return false;
  }
  const probeV = new THREE.Vector3();
  function siteNear(x, z, y, gap) { if (!protectedSet) return null; const n = protectedSet.nearestSurface(probeV.set(x, y, z), gap); return n ? { point: n.point.clone(), normal: n.normal.clone(), site: n.site } : null; }
  const area = { minX: campus.bounds.min.x - m(60), maxX: campus.bounds.max.x + m(60), minZ: campus.bounds.min.z - m(60), maxZ: campus.bounds.max.z + m(60) };
  const G = campus.terrain.grid;
  if (G && [G.minX, G.minZ, G.step, G.nx, G.nz].every(Number.isFinite)) {
    area.minX = Math.max(area.minX, G.minX + 4); area.minZ = Math.max(area.minZ, G.minZ + 4);
    area.maxX = Math.min(area.maxX, G.minX + G.step * (G.nx - 1) - 4); area.maxZ = Math.min(area.maxZ, G.minZ + G.step * (G.nz - 1) - 4);
  }
  const inArea = (x, z) => x >= area.minX && x <= area.maxX && z >= area.minZ && z <= area.maxZ;
  function ground(x, z, fallback) { const h = heightAt(x, z); return Number.isFinite(h) ? h : fallback; }

  // ---------- state ----------
  const st = { on: false, x: 0, z: 0, y: 0, yaw: 0, speed: 0, pitch: 0 };
  const stats = { presses: 0, spawned: 0, taps: 0, scrapes: 0, scraped: 0, contacts: 0, travelled: 0, blocked: { shield: 0, step: 0, edge: 0 }, shields: 0,
    collapses: { full: 0, partial: 0, none: 0, cleared: 0 }, last: null, max: { speed: 0 } };
  let active = false, visible = false, holding = false, aim = null, aimProbe = -1, target = null, pushDir = null, pushEntry = null, tapLeft = 0;
  let look = 1, clock = 0, scrapeAt = -1, contactUntil = -1, crunchAt = -1, feedbackAt = -1, shieldAt = -1, engine = null, engineCheck = -1;
  // Buildings scraped and waiting to settle: entry -> { last, doomAt, strips: [{ x, z, fx, fz, half, ahead, hi }] }.
  const pend = new Map();
  const fwd = new THREE.Vector3();

  function camYaw() { const d = new THREE.Vector3(); camera?.getWorldDirection?.(d); return Math.hypot(d.x, d.z) > 1e-4 ? Math.atan2(d.x, d.z) : st.yaw; }
  // Walk from (x, z) along (dx, dz) until the dozer's footprint is off every building and clear of protected outlines.
  function clearSpot(x, z, dx, dz) {
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    for (let i = 0; i < 40; i++) {
      const y = ground(x, z, NaN);
      if (Number.isFinite(y) && inArea(x, z) && !insideBuilding(x, z, BACK * .8) && !siteNear(x, z, y + m(1), FRONT + m(1))) return { x, z, y };
      x += dx * m(2); z += dz * m(2);
    }
    return null;
  }
  function spawn(spot, yaw) {
    Object.assign(st, { on: true, x: spot.x, z: spot.z, y: spot.y, yaw, speed: 0, pitch: 0 }); stats.spawned++;
    target = null; pushDir = null; pushEntry = null; tapLeft = 0; pose(0); dozer.visible = active;
  }
  // Where the dozer is heading for an aimed surface. On a building: past the pointed spot, in the direction it went in.
  function setTarget(hit) {
    if (!hit) return;
    const p = hit.point;
    if (hit.kind === 'building' && hit.entry && !hit.entry.cleared) {
      if (hit.entry !== pushEntry || !pushDir) {
        const dx = p.x - st.x, dz = p.z - st.z, l = Math.hypot(dx, dz);
        pushDir = l > m(1) ? { x: dx / l, z: dz / l } : { x: Math.sin(st.yaw), z: Math.cos(st.yaw) }; pushEntry = hit.entry;
      }
      target = { x: p.x + pushDir.x * m(T.push), z: p.z + pushDir.z * m(T.push), entry: hit.entry }; return;
    }
    // still held on a building: once the ray slips through the scraped hole to the ground inside it, keep pushing
    if (holding && pushEntry && !pushEntry.cleared && target?.entry === pushEntry) { const w = pushEntry.worldBounds; if (p.x >= w.min.x && p.x <= w.max.x && p.z >= w.min.z && p.z <= w.max.z) return; }
    pushDir = null; pushEntry = null; target = { x: p.x, z: p.z, entry: null };
  }
  // press(x, y, { touch }): 'drive' | 'spawn' | 'miss' | 'no-spot'. On touch the aim is lifted above the finger (a building
  // under the finger itself still wins on the press, so "press the building" does what it says).
  function press(x, y, { touch = false } = {}) {
    if (!active) return 'miss';
    stats.presses++;
    let hit = probe(x, y, true);
    if (touch && hit?.kind !== 'building' && hit?.kind !== 'protected') hit = probe(x, y - T.touchLift, true) || hit;
    if (!hit) return 'miss';
    holding = true; aim = { x, y: touch ? y - T.touchLift : y }; aimProbe = clock; tapLeft = 0; pushDir = null; pushEntry = null;
    const p = hit.point, far = !st.on || Math.hypot(p.x - st.x, p.z - st.z) > m(T.reuse);
    let made = false;
    if (far) {
      if (hit.kind === 'ground') {
        const yaw = camYaw(), spot = clearSpot(p.x, p.z, -Math.sin(yaw), -Math.cos(yaw));
        if (!spot) { holding = false; return 'no-spot'; }
        spawn(spot, yaw); made = true;
      } else {
        let ox = hit.normal?.x ?? 0, oz = hit.normal?.z ?? 0;
        if (Math.hypot(ox, oz) < .3) { const c = hit.entry ? bandOf(hit.entry) : { cx: hit.site?.centerX ?? p.x, cz: hit.site?.centerZ ?? p.z }; ox = p.x - c.cx; oz = p.z - c.cz; }
        if (Math.hypot(ox, oz) < 1e-6) { const yaw = camYaw(); ox = -Math.sin(yaw); oz = -Math.cos(yaw); }
        const l = Math.hypot(ox, oz); ox /= l; oz /= l;
        const spot = clearSpot(p.x + ox * m(T.spawnBack), p.z + oz * m(T.spawnBack), ox, oz);
        if (!spot) { holding = false; return 'no-spot'; }
        spawn(spot, Math.atan2(-ox, -oz)); made = true;
      }
    }
    setTarget(hit);
    return made ? 'spawn' : 'drive';
  }
  function setAim(x, y, { touch = false } = {}) { if (holding) aim = { x, y: touch ? y - T.touchLift : y }; }
  // Let go: a long hold brakes; a quick tap keeps heading for the tapped spot for at most tapDrive.
  function release({ tap = false } = {}) {
    if (!holding) return; holding = false; aim = null;
    if (tap && target && st.on) { tapLeft = m(T.tapDrive); stats.taps++; } else { target = null; tapLeft = 0; }
  }
  function stop() { holding = false; aim = null; target = null; tapLeft = 0; }

  // ---------- scraping ----------
  function inStrip(s, x, z, widen = 1) {
    const dx = x - s.x, dz = z - s.z, a = dx * s.fx + dz * s.fz, side = Math.abs(dx * s.fz - dz * s.fx);
    return a >= -m(1.2) && a <= s.ahead && side <= s.half * widen;
  }
  function scrape() {
    const fx = Math.sin(st.yaw), fz = Math.cos(st.yaw), bx = st.x + fx * FRONT, bz = st.z + fz * FRONT, g = st.y;
    const strip = { x: bx, z: bz, fx, fz, half: HALF, ahead: m(T.bite), hi: g + m(T.floor) }, lo = g - m(1.2);
    const reach = HALF + m(T.bite) + m(1.2), point = new THREE.Vector3(bx, g + m(1.2), bz);
    fwd.set(fx, .25, fz).normalize();
    let any = false;
    for (const entry of campus.entries) {
      if (entry.cleared) continue;
      const w = entry.worldBounds;
      if (bx + reach < w.min.x || bx - reach > w.max.x || bz + reach < w.min.z || bz - reach > w.max.z || strip.hi < w.min.y || lo > w.max.y) continue;
      const classify = (x, y, z) => y >= lo && y <= strip.hi && inStrip(strip, x, z) ? -1 : 0;
      const result = campus.cut(entry, classify, { point, force: T.force, debrisNormal: fwd, minPieces: 1, kerfFly: T.chips });
      if (!result.count) continue;
      any = true; stats.scrapes++; stats.scraped += result.count;
      let p = pend.get(entry), first = false; if (!p) { pend.set(entry, p = { last: clock, doomAt: -1, strips: [] }); stats.contacts++; first = true; }
      p.last = clock;
      const prev = p.strips[p.strips.length - 1];
      if (!prev || Math.hypot(prev.x - strip.x, prev.z - strip.z) > m(.5) || Math.abs(prev.fx - fx) + Math.abs(prev.fz - fz) > .1) p.strips.push({ ...strip });
      if (!entry.cleared && p.doomAt < 0 && bandLost(entry) >= bandOf(entry).doom) p.doomAt = clock + T.doomDelay;
      const feedback = clock - feedbackAt >= .22; if (feedback) feedbackAt = clock;
      if (clock - crunchAt >= .16) { crunchAt = clock; audio.play('crunch', clamp(.45 + result.count / 30, .4, 1.1)); }
      onScrape({ entry, point: point.clone(), normal: new THREE.Vector3(fx, 0, fz), result, feedback, first });
    }
    if (any) contactUntil = clock + .3;
  }
  function collapse(entry, p) {
    const ratio = bandLost(entry), b = bandOf(entry);
    let kind = entry.cleared ? 'cleared' : 'none', result = null;
    if (!entry.cleared) {
      const drop = { shake: reducedMotion ? .15 : T.shake, spread: T.spread, gravity: T.gravity, fly: T.fly, linger: T.linger }, centre = new THREE.Vector3(b.cx, b.base, b.cz);
      if (ratio >= b.doom) { kind = 'full'; result = campus.cut(entry, () => 2, { point: centre, minPieces: 1, drop }); }
      else {
        const strips = p.strips, above = (x, y, z) => strips.some(s => y > s.hi - m(.3) && inStrip(s, x, z, 1.1)) ? 2 : 0;
        result = campus.cut(entry, above, { point: centre, minPieces: 1, drop });
        kind = result.count ? 'partial' : 'none';
      }
    }
    stats.collapses[kind] = (stats.collapses[kind] || 0) + 1;
    stats.last = { entry: entry.id, kind, ratio: Math.round(ratio * 1000) / 1000, doom: Math.round(b.doom * 1000) / 1000, area: Math.round(b.area), count: result?.count ?? 0, strips: p.strips.length };
    onCollapse({ entry, kind, ratio, result: result || { count: 0, weight: 0, cleared: [], affected: [] } });
  }
  function settle() {
    for (const [entry, p] of pend) {
      if (p.doomAt >= 0 ? clock >= p.doomAt : clock - p.last >= T.settle) { pend.delete(entry); collapse(entry, p); }
    }
  }

  // ---------- driving ----------
  function drive(dt) {
    let want = 0;
    if (target && (holding || tapLeft > 0)) {
      const dx = target.x - st.x, dz = target.z - st.z, d = Math.hypot(dx, dz);
      if (d > m(T.arrive)) {
        const diff = angDiff(st.yaw, Math.atan2(dx, dz));
        st.yaw += clamp(diff, -T.turn * dt, T.turn * dt);
        want = m(T.speed) * (Math.abs(diff) > 1.1 ? .25 : 1) * Math.min(1, d / m(T.slow));
      } else if (!holding) { target = null; tapLeft = 0; }
    }
    if (clock < contactUntil) want = Math.min(want, m(T.pushSpeed));
    st.speed += clamp(want - st.speed, -m(T.brake) * dt, m(T.accel) * dt);
    if (st.speed < 1e-3) st.speed = 0;
    const fx = Math.sin(st.yaw), fz = Math.cos(st.yaw), step = st.speed * dt;
    if (step > 0) {
      const nx = st.x + fx * step, nz = st.z + fz * step, ny = ground(nx, nz, NaN);
      const ahead = ground(nx + fx * FRONT, nz + fz * FRONT, ny);
      const site = siteNear(nx + fx * FRONT, nz + fz * FRONT, (Number.isFinite(ny) ? ny : st.y) + m(1.2), m(T.shieldGap));
      if (site) {
        st.speed = 0; stats.blocked.shield++; target = holding ? target : null; tapLeft = 0;
        if (clock - shieldAt >= T.shieldPing) { shieldAt = clock; stats.shields++; onShield(site.point, site.normal); }
      } else if (!Number.isFinite(ny) || !inArea(nx, nz)) { st.speed = 0; stats.blocked.edge++; tapLeft = 0; }
      else if (ahead - st.y > m(T.maxStep)) { st.speed = 0; stats.blocked.step++; tapLeft = 0; }
      else {
        st.x = nx; st.z = nz; stats.travelled += step / u;
        if (tapLeft > 0) { tapLeft -= step; if (tapLeft <= 0) { tapLeft = 0; target = null; } }
      }
    }
    stats.max.speed = Math.max(stats.max.speed, st.speed / u);
    if (st.speed > m(.2) && clock - scrapeAt >= 1 / T.rate) { scrapeAt = clock; scrape(); }
  }
  function pose(dt) {
    const g = ground(st.x, st.z, st.y);
    st.y = dt > 0 ? st.y + (g - st.y) * Math.min(1, dt * 10) : g;
    const fx = Math.sin(st.yaw), fz = Math.cos(st.yaw), hf = ground(st.x + fx * FRONT * .7, st.z + fz * FRONT * .7, g), hb = ground(st.x - fx * BACK * .7, st.z - fz * BACK * .7, g);
    const pitch = clamp(-Math.atan2(hf - hb, (FRONT + BACK) * .7), -.35, .35);
    st.pitch = dt > 0 ? st.pitch + (pitch - st.pitch) * Math.min(1, dt * 8) : pitch;
    dozer.position.set(st.x, st.y, st.z); dozer.rotation.set(st.pitch, st.yaw, 0, 'YXZ');
    // look only: zoomed far out the model grows (up to maxLook) so it stays at least minPixels long on screen
    if (camera?.isPerspectiveCamera) {
      const d = Math.max(1e-3, camera.position.distanceTo(dozer.position)), ppu = viewHeight() / (2 * d * Math.tan(camera.fov * Math.PI / 360));
      const k = clamp(T.minPixels / Math.max(1e-6, 6.6 * S * ppu), 1, T.maxLook); look = dt > 0 ? look + (k - look) * Math.min(1, dt * 6) : k;
      dozer.scale.setScalar(S * look);
    }
    const shake = !reducedMotion && visible ? (st.speed > m(.3) ? .045 : .015) * (clock < contactUntil ? 2 : 1) : 0;
    body.position.y = Math.sin(clock * 41) * shake; body.rotation.z = Math.sin(clock * 29) * shake * .25;
  }
  function engineSync() {
    const want = visible && st.on;
    if (!want) { if (engine) { engine.stop(); engine = null; } return; }
    if (clock - engineCheck > .5) { engineCheck = clock; if (!audio.live) { if (engine) { engine.stop(); engine = null; } return; } }
    if (!engine) { engine = audio.engine(); if (!engine) return; }
    engine.set(1, clamp(st.speed / m(T.speed) + (clock < contactUntil ? .45 : 0), 0, 1));
  }
  function update(dt) {
    if (!Number.isFinite(dt) || dt < 0) return;
    clock += dt;
    if (holding && aim && st.on && clock - aimProbe >= .06) { aimProbe = clock; setTarget(probe(aim.x, aim.y, false)); }
    if (st.on && dt > 0) { drive(dt); pose(dt); }
    settle(); engineSync();
  }
  // selected: the bulldozer is the weapon in hand; free: no dialog / nuke / hidden page (engine sound only while free).
  // Put away, the dozer leaves; buildings already scraped still settle.
  function setState(selected, free) {
    const a = Boolean(selected);
    if (a !== active) { active = a; if (!a) { stop(); st.on = false; st.speed = 0; } }
    visible = a && Boolean(free); dozer.visible = active && st.on;
    if (!visible) { if (holding) release(); if (engine) { engine.stop(); engine = null; } }
  }
  function clear() { stop(); st.on = false; st.speed = 0; dozer.visible = false; pend.clear(); contactUntil = -1; if (engine) { engine.stop(); engine = null; } }
  function reset() { clear(); bands.clear(); boxes = null; }
  return {
    press, setAim, release, update, setState, clear, reset, group: root, ratio: bandLost,
    get holding() { return holding; },
    get animating() { return st.on && (st.speed > 0 || holding || tapLeft > 0) || pend.size > 0; },
    get stats() {
      return { ...stats, blocked: { ...stats.blocked }, collapses: { ...stats.collapses }, max: { ...stats.max }, on: st.on, holding, pending: pend.size,
        position: st.on ? [st.x, st.y, st.z].map(v => Math.round(v * 100) / 100) : null, yaw: Math.round(st.yaw * 1000) / 1000, speed: Math.round(st.speed / u * 100) / 100,
        contact: clock < contactUntil, target: target ? [Math.round(target.x * 10) / 10, Math.round(target.z * 10) / 10] : null, engine: Boolean(engine),
        bands: [...pend.keys()].map(e => ({ entry: e.id, ratio: Math.round(bandLost(e) * 1000) / 1000, doom: Math.round(bandOf(e).doom * 1000) / 1000 })), look: Math.round(look * 100) / 100 };
    },
    dispose() { clear(); root.removeFromParent(); cube.dispose(); pipe.dispose(); shade.geometry.dispose(); },
  };
}
