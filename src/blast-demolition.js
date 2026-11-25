// Blast demolition, the first ad-reward weapon (user decisions 2026-10-22; 시안/광고무기_발파·불도저_시안.html, variant
// "직접 설치 + 순서대로", icon A1). Tap a building: a charge sticks to the facade where the tap lands, at any height, like the
// mini bomb (tap it again to take it off; 10-22 user: "클릭한 데에 붙게"), up to maxCharges over all buildings; a detonator
// stands on the ground and a wire runs through the charges in placement order. Fire -> no countdown (10-22 user) -> the
// charges go off one by one, each cutting a strip one storey tall at its own height (a charge on the ground floor cuts the
// whole ground-floor band; the nearest few fragments fly as chips). After a building's last charge: if its ground floor lost
// `doom` of its weight the whole building comes down in place (model-destruction split `drop`: tremble, every fragment falls
// to the base, sinks into the dust), otherwise only the part above each cut strip drops.
// The support graph in model-destruction.js roots every fragment that touches the ground, so cutting part of the ground
// floor never brings the upper floors down by itself; this module decides the collapse instead. Numbers: weapon-tuning.js `blast`.
import { WEAPON_TUNING } from './weapon-tuning.js?v=sn130';
export const BLAST_ID = 'blast';

export function createBlastDemolition(THREE, scene, { campus, tuning = WEAPON_TUNING.blast, reducedMotion = false,
  onDetonate = () => {}, onCollapse = () => {}, onChange = () => {} } = {}) {
  const T = tuning, u = campus.worldUnitsPerMeter || .5, m = v => v * u, look = u * T.size;
  const root = new THREE.Group(); root.name = 'blast-demolition'; scene.add(root);
  const lam = color => new THREE.MeshLambertMaterial({ color });
  const mat = { red: lam('#c63a2c'), tape: lam('#26292d'), label: lam('#ffd950'), body: lam('#f2c230'), dark: lam('#2f353b'), steel: lam('#9aa5ab') };
  const ledMat = new THREE.MeshBasicMaterial({ color: '#ff3a24', transparent: true });
  const stick = new THREE.CylinderGeometry(.17, .17, 1.15, 10), cube = new THREE.BoxGeometry(1, 1, 1), ledGeo = new THREE.SphereGeometry(.1, 10, 8);
  // Soft red halo so a charge reads at campus distance (skipped where no 2D canvas exists).
  let haloMat = null;
  try {
    const c = globalThis.document?.createElement?.('canvas'), g = c?.getContext?.('2d');
    if (g) {
      c.width = c.height = 64; const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(.35, 'rgba(255,255,255,.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
      haloMat = new THREE.SpriteMaterial({ map, color: '#ff5a3a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .55 });
    }
  } catch { haloMat = null; }
  const box = (group, w, h, d, material, x, y, z) => { const o = new THREE.Mesh(cube, material); o.scale.set(w, h, d); o.position.set(x, y, z); o.castShadow = true; group.add(o); return o; };
  function chargeModel() {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    for (const x of [-.34, 0, .34]) { const s = new THREE.Mesh(stick, mat.red); s.position.set(x, 0, 0); s.castShadow = true; body.add(s); }
    box(body, 1.1, .26, .4, mat.tape, 0, .05, 0); box(body, .5, .22, .1, mat.label, 0, .05, .22);
    const led = new THREE.Mesh(ledGeo, ledMat); led.position.set(.16, .05, .3); body.add(led);
    body.scale.setScalar(look);
    if (haloMat) { const halo = new THREE.Sprite(haloMat); halo.scale.setScalar(look * 3.2); halo.position.z = look * .4; g.add(halo); }
    return g;
  }
  const detonator = new THREE.Group(), plunger = new THREE.Group(); detonator.name = 'blast-detonator';
  box(detonator, 1.3, .8, .9, mat.body, 0, .4, 0); box(detonator, 1.32, .2, .92, mat.dark, 0, .72, 0);
  box(plunger, .1, 1.1, .1, mat.steel, 0, .55, 0); box(plunger, 1, .16, .16, mat.dark, 0, 1.1, 0);
  plunger.position.y = .8; detonator.add(plunger); detonator.scale.setScalar(look); detonator.visible = false; root.add(detonator);
  const MAX_WIRE = 2 + 3 * T.maxCharges, wirePositions = new Float32Array(MAX_WIRE * 3), wireGeometry = new THREE.BufferGeometry();
  wireGeometry.setAttribute('position', new THREE.BufferAttribute(wirePositions, 3));
  const wire = new THREE.Line(wireGeometry, new THREE.LineBasicMaterial({ color: '#f2c230' })); wire.frustumCulled = false; wire.visible = false; root.add(wire);

  // Ground-floor band of a building, and every fragment's world centre (rest pose), once per building.
  const bands = new Map();
  function bandOf(entry) {
    let b = bands.get(entry); if (b) return b;
    const model = entry.model, minY = model.worldBounds.min.y, base = Math.max(minY, Number.isFinite(entry.baseY) ? entry.baseY : minY);
    const top = base + m(T.floor), n = model.pieces.length, centre = new Float32Array(n * 3), band = [], v = new THREE.Vector3();
    let weight = 0;
    model.group.updateWorldMatrix(true, false);
    for (let i = 0; i < n; i++) {
      const p = model.pieces[i]; v.copy(p.restPosition).applyMatrix4(model.group.matrixWorld); centre.set([v.x, v.y, v.z], i * 3);
      if (v.y <= top) { band.push(i); weight += p.weight; }
    }
    const c = model.worldBounds.getCenter(new THREE.Vector3());
    b = { minY, base, top, centre, band, weight, cx: c.x, cz: c.z }; bands.set(entry, b); return b;
  }
  function bandLost(entry) {
    const b = bandOf(entry); if (!b.weight) return 0;
    let lost = 0; for (const i of b.band) if (!entry.model.pieces[i].active) lost += entry.model.pieces[i].weight;
    return lost / b.weight;
  }
  // A charge's strip: from its facade point into the building along -normal (horizontal), halfWidth either side.
  function inStrip(c, x, z, widen = 1) {
    const dx = x - c.point.x, dz = z - c.point.z, along = dx * c.inward.x + dz * c.inward.z, side = Math.abs(dx * c.inward.z - dz * c.inward.x);
    return along >= -m(1.5) && along <= m(T.reach) && side <= m(T.halfWidth) * widen;
  }

  const charges = [], stats = { placed: 0, removed: 0, fired: 0, detonated: 0, collapses: { full: 0, partial: 0, none: 0, cleared: 0 }, last: null, shields: 0 };
  let firing = null, serial = 0;
  function rebuildWire() {
    detonator.visible = charges.length > 0 && (!firing || firing.t < 1.2);
    if (!charges.length) { wire.visible = false; return; }
    if (!firing) {
      const first = charges[0], out = first.outward, p = first.ground.clone().addScaledVector(out, m(7));
      p.y = campus.terrain.heightAt(p.x, p.z); if (!Number.isFinite(p.y)) p.y = first.ground.y;
      detonator.position.copy(p); detonator.rotation.y = Math.atan2(out.x, out.z);
    }
    let k = 0; const put = (x, y, z) => { if (k < MAX_WIRE) { wirePositions.set([x, y, z], k * 3); k++; } };
    const lift = m(.12), d = detonator.position;
    put(d.x, d.y + look * .75, d.z); put(d.x, d.y + lift, d.z);
    for (const c of charges) { put(c.ground.x, c.ground.y + lift, c.ground.z); put(c.point.x, c.point.y - look * .6, c.point.z); put(c.ground.x, c.ground.y + lift, c.ground.z); }
    wireGeometry.setDrawRange(0, k); wireGeometry.attributes.position.needsUpdate = true; wireGeometry.computeBoundingSphere();
    wire.visible = k > 1 && !firing;
  }
  function removeCharge(c) { const i = charges.indexOf(c); if (i >= 0) charges.splice(i, 1); root.remove(c.obj); }

  // hit: { point, normal, entry, site } from the game's pick(); 'added' | 'removed' | 'full' | 'busy' | 'miss' | 'shield'.
  // A protected building (site) never takes a charge; the caller shows the shield.
  function place({ point, normal, entry, site = null } = {}) {
    if (site) { stats.shields++; return 'shield'; }
    if (firing) return 'busy';
    if (!entry || entry.cleared || !point) return 'miss';
    const near = charges.find(c => c.entry === entry && c.point.distanceTo(point) <= m(T.snap) + look);
    if (near) { removeCharge(near); stats.removed++; rebuildWire(); onChange(); return 'removed'; }
    if (charges.length >= T.maxCharges) return 'full';
    const b = bandOf(entry), face = new THREE.Vector3(normal?.x ?? 0, normal?.y ?? 0, normal?.z ?? 0);
    if (face.lengthSq() < 1e-8) face.set(point.x - b.cx, 0, point.z - b.cz);
    if (face.lengthSq() < 1e-8) face.set(0, 1, 0);
    face.normalize();
    // The strip runs horizontally into the building: the facade's own direction, or away from the centre for a roof tap.
    const outward = new THREE.Vector3(face.x, 0, face.z);
    if (outward.lengthSq() < .09) outward.set(point.x - b.cx, 0, point.z - b.cz);
    if (outward.lengthSq() < 1e-8) outward.set(1, 0, 0);
    outward.normalize();
    const at = point.clone().addScaledVector(face, look * .35);
    const groundHere = campus.terrain.heightAt(at.x, at.z), ground = at.clone();
    ground.y = Math.min(at.y, Number.isFinite(groundHere) ? groundHere : b.base);
    // Cut height: a charge on the ground floor takes the whole ground-floor band; higher up, one storey around the charge.
    const half = m(T.floor) / 2, low = at.y <= b.top, lo = low ? b.minY - m(1) : at.y - half, hi = low ? b.top : at.y + half;
    const obj = chargeModel(); obj.position.copy(at); obj.lookAt(at.clone().add(face)); root.add(obj);
    charges.push({ id: ++serial, entry, point: at, ground, outward, inward: outward.clone().negate(), lo, hi, obj });
    stats.placed++; rebuildWire(); onChange(); return 'added';
  }
  function fire() {
    if (firing || !charges.length) return false;
    const order = charges.slice(), last = new Map();
    order.forEach((c, i) => last.set(c.entry, i));
    firing = { phase: 'boom', t: 0, list: order.map((c, i) => ({ c, at: i * T.step, done: false, closes: last.get(c.entry) === i })), evals: [], strips: new Map() };
    stats.fired++; rebuildWire(); onChange(); return true;
  }
  function detonate(item) {
    const c = item.c, entry = c.entry; removeCharge(c); stats.detonated++;
    let list = firing.strips.get(entry); if (!list) firing.strips.set(entry, list = []); list.push(c);
    const b = bandOf(entry), cut = (x, y, z) => y >= c.lo && y <= c.hi && inStrip(c, x, z) ? -1 : 0;
    const result = entry.cleared ? { count: 0, weight: 0, cleared: [], affected: [] }
      : campus.cut(entry, cut, { point: c.point, force: T.force, debrisNormal: c.outward, minPieces: 1, kerfFly: T.chips });
    onDetonate({ point: c.point.clone(), normal: c.outward.clone(), entry, result });
    if (item.closes) firing.evals.push({ entry, at: firing.t + T.settle });
  }
  function settle(entry) {
    const ratio = bandLost(entry), b = bandOf(entry), strips = firing.strips.get(entry) || [];
    let kind = entry.cleared ? 'cleared' : 'none', result = null;
    if (!entry.cleared) {
      const drop = { shake: reducedMotion ? .15 : T.shake, spread: T.spread, gravity: T.gravity, fly: T.fly, linger: T.linger };
      const centre = new THREE.Vector3(b.cx, b.base, b.cz);
      if (ratio >= T.doom) { kind = 'full'; result = campus.cut(entry, () => 2, { point: centre, minPieces: 1, drop }); }
      else {
        const above = (x, y, z) => strips.some(c => y > c.hi && inStrip(c, x, z, 1.1)) ? 2 : 0;
        result = campus.cut(entry, above, { point: centre, minPieces: 1, drop });
        kind = result.count ? 'partial' : 'none';
      }
    }
    stats.collapses[kind] = (stats.collapses[kind] || 0) + 1;
    stats.last = { entry: entry.id, kind, ratio: Math.round(ratio * 1000) / 1000, count: result?.count ?? 0 };
    onCollapse({ entry, kind, ratio, result: result || { count: 0, weight: 0, cleared: [], affected: [] } });
  }
  let blink = 0;
  function update(dt) {
    if (!Number.isFinite(dt) || dt < 0) return;
    blink += dt;
    ledMat.opacity = reducedMotion ? 1 : Math.sin(blink * 1.2 * Math.PI * 2) > 0 ? 1 : .15;
    if (!firing) return;
    firing.t += dt;
    plunger.position.y = Math.max(.25, .8 - firing.t * 8);
    for (const item of firing.list) if (!item.done && item.at <= firing.t) { item.done = true; detonate(item); }
    const due = firing.evals.filter(e => e.at <= firing.t); firing.evals = firing.evals.filter(e => e.at > firing.t);
    for (const e of due) settle(e.entry);
    if (firing.t >= 1.2 && detonator.visible && !charges.length) detonator.visible = false;
    if (firing.list.every(item => item.done) && !firing.evals.length) {
      firing = null; plunger.position.y = .8; detonator.visible = false; wire.visible = false; onChange();
    }
  }
  function clear() {
    for (const c of charges.splice(0)) root.remove(c.obj);
    const was = Boolean(firing); firing = null; plunger.position.y = .8; detonator.visible = false; wire.visible = false;
    if (was) onChange();
  }
  function reset() { clear(); bands.clear(); }
  return {
    place, fire, update, clear, reset, group: root,
    get count() { return charges.length; },
    get max() { return T.maxCharges; },
    get firing() { return Boolean(firing); },
    get phase() { return firing?.phase ?? 'idle'; },
    get animating() { return charges.length > 0 || Boolean(firing); },
    ratio: bandLost,
    get stats() {
      return { ...stats, collapses: { ...stats.collapses }, charges: charges.length, max: T.maxCharges, phase: firing?.phase ?? 'idle',
        wire: wire.visible ? wireGeometry.drawRange.count : 0, detonator: detonator.visible,
        list: charges.map(c => ({ entry: c.entry.id, point: c.point.toArray() })) };
    },
    dispose() { clear(); root.removeFromParent(); stick.dispose(); cube.dispose(); ledGeo.dispose(); wireGeometry.dispose(); },
  };
}
