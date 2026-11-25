// Baked campus ground: the non-destructible environment of a pilot preview (ground surfaces, site layer, place pads, walls,
// stairs, planting, context) computed once by scripts/campuses/<id>/build-package.mjs and loaded as glTF scenes through the
// campus model cache (ids in pkg.ground.baked.envIds). Used instead of ground.js only when a package declares ground.baked;
// Yonsei / Korea never reach this module.
//   - scenes are in metres (x = E, y = up, z = -N) and are placed under one group scaled to world units;
//   - glTF extras carry what glTF cannot: castShadow / receiveShadow / renderOrder (node), polygonOffset / depthWrite / look (material);
//   - 'continuous-estimated-terrain' is a hidden mesh of the terrain grid in world units: campus-finale borrows its geometry
//     for the nuke scorch and keeps it (with everything under it = the baked ground) visible while the scenery is cleared.
import { applyGroundLook, applyDistanceFade } from './ground-look.js';

// flatCleared: destructible footprints (pkg.hazardTape.footprints) to flatten each cleared building's ground (prototype, see
// createClearedFlattening below); campus-engine passes it only with ?flatcleared=1 on a local server, otherwise null = as before.
export function createBakedGround(THREE, { entries = [], terrain, profile, modelAssets, worldUnitsPerMeter, flatCleared = null }) {
  const baked = profile.baked, W = worldUnitsPerMeter;
  const group = new THREE.Group(); group.name = 'continuous-campus-ground';
  const owned = { geometries: new Set(), materials: new Set() }; let disposed = false;
  // Terrain proxy (world units) from the coarsest height grid.
  const G = terrain.grid, pos = new Float32Array(G.nx * G.nz * 3), index = [];
  for (let j = 0; j < G.nz; j++) for (let i = 0; i < G.nx; i++) { const k = (j * G.nx + i) * 3; pos[k] = G.minX + i * G.step; pos[k + 1] = G.heights[j * G.nx + i]; pos[k + 2] = G.minZ + j * G.step; }
  for (let j = 0; j < G.nz - 1; j++) for (let i = 0; i < G.nx - 1; i++) { const a = j * G.nx + i; index.push(a, a + G.nx, a + 1, a + 1, a + G.nx, a + G.nx + 1); }
  const proxyGeometry = new THREE.BufferGeometry(); proxyGeometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); proxyGeometry.setIndex(index); proxyGeometry.computeBoundingSphere();
  const proxyMaterial = new THREE.MeshBasicMaterial({ visible: false });
  owned.geometries.add(proxyGeometry); owned.materials.add(proxyMaterial);
  const proxy = new THREE.Mesh(proxyGeometry, proxyMaterial); proxy.name = 'continuous-estimated-terrain'; group.add(proxy);
  const holder = new THREE.Group(); holder.name = 'baked-environment'; holder.scale.setScalar(W); proxy.add(holder);
  const look = baked.look, stats = { triangles: 0, instancedTriangles: 0, meshes: 0, layers: {}, envIds: [...baked.envIds] };
  const lookFor = material => {
    if (!look) return null;
    if (material.userData.look) return { cls: material.userData.look, site: false };
    const suffix = material.name.split('__').pop(), cls = look.siteMaterials?.[suffix];
    return material.map && cls ? { cls, site: true } : null;
  };
  // optional horizontal distance fade (metres in the package -> world units)
  const fade = baked.fade ? { centre: [baked.fade.centre_m[0] * W, -baked.fade.centre_m[1] * W], near: baked.fade.near_m * W, far: baked.fade.far_m * W, ...(baked.fade.linear ? { linear: baked.fade.linear } : {}) } : null;
  // optional campus material hook (a package's own ground shader, given as baked.materialHook): returns true for a material
  // it took over (that material then skips `look`); campuses without baked.materialHook never call anything here
  const hook = baked.materialHook ? baked.materialHook(THREE, { worldUnitsPerMeter: W, modelAssets }) : null;
  const seen = new Set();
  for (const id of baked.envIds) {
    const scene = modelAssets.createScene(id); scene.name = id; holder.add(scene);
    scene.traverse(o => {
      if (!o.isMesh) return;
      // flags on the mesh, else on its node group (a multi-primitive glTF node becomes a Group of meshes)
      const u = { ...(o.parent?.userData || {}), ...(o.userData || {}) };
      o.castShadow = u.castShadow ?? !!baked.castShadow?.includes(id); o.receiveShadow = u.receiveShadow !== false; if (u.renderOrder) o.renderOrder = u.renderOrder;
      const n = (o.geometry.index ? o.geometry.index.count : o.geometry.getAttribute('position').count) / 3;
      if (o.isInstancedMesh) stats.instancedTriangles += n * o.count; else stats.triangles += n; stats.meshes++;
      if ((Array.isArray(o.material) ? o.material : [o.material]).some(m => m?.userData?.castShadow)) o.castShadow = true;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m || seen.has(m)) continue; seen.add(m);
        const md = m.userData || {};
        if (md.polygonOffset) { m.polygonOffset = true; [m.polygonOffsetFactor, m.polygonOffsetUnits] = md.polygonOffset; }
        if (md.depthWrite === false) m.depthWrite = false;
        const l = hook?.(m) ? (stats.hooked = (stats.hooked || 0) + 1, null) : lookFor(m);
        if (l && look.layers[l.cls]) {
          const layer = l.site ? { ...look.layers[l.cls], clump: 0, dry: (look.layers[l.cls].dry || 0) * .5 } : look.layers[l.cls];
          const map2 = m.aoMap || null; m.aoMap = null;
          applyGroundLook(THREE, m, layer, look.tints?.[l.cls], look.macro, { worldUnitsPerMeter: W, map2 });
          stats.layers[l.cls] = (stats.layers[l.cls] || 0) + 1;
        }
        // md.noFade (glTF material extras, opt-in, 11-10 liraart 남산타워): 먼 랜드마크는 거리 안개만 받고 하늘색으로 지우지 않음. 기본 동작 불변.
        if (fade && !md.noFade) { applyDistanceFade(THREE, m, fade, baked.fade.colour); stats.faded = (stats.faded || 0) + 1; }
      }
    });
  }
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3(new THREE.Vector3(G.minX, -Infinity, G.minZ), new THREE.Vector3(G.maxX, Infinity, G.maxZ));
  { let lo = Infinity, hi = -Infinity; for (const h of G.heights) { lo = Math.min(lo, h); hi = Math.max(hi, h); } bounds.min.y = lo; bounds.max.y = hi; }
  // Playable region: the buildings plus a margin, never the wide backdrop (keeps the overview camera on the campus).
  const playBounds = new THREE.Box3(); for (const e of entries) playBounds.union(e.worldBounds);
  if (playBounds.isEmpty()) playBounds.copy(bounds); else { playBounds.expandByScalar((baked.playMargin_m ?? 30) * W);
    playBounds.min.x = Math.max(playBounds.min.x, bounds.min.x); playBounds.min.z = Math.max(playBounds.min.z, bounds.min.z);
    playBounds.max.x = Math.min(playBounds.max.x, bounds.max.x); playBounds.max.z = Math.min(playBounds.max.z, bounds.max.z); }
  Object.assign(stats, { source: baked.source, terrain: terrain.stats, scale: W, groundContinuous: true, drawCalls: stats.meshes });
  const flat = flatCleared ? createClearedFlattening(THREE, { entries, footprints: flatCleared, W, proxy, holder, owned, options: baked.flat }) : null;
  if (flat) { stats.flatCleared = flat.stats; group.userData.flatCleared = flat; }
  return { group, bounds, playBounds, terrain, stats,
    ...(flat ? { flattenCleared: flat.flatten, restoreCleared: flat.restore } : {}),
    update() {},
    dispose() { if (disposed) return; disposed = true; flat?.restore(); for (const g of owned.geometries) g.dispose(); for (const m of owned.materials) m.dispose(); group.removeFromParent(); group.clear(); } };
}

// ---- Cleared footprints (prototype, user decision 10-23 option B). The baked ground was never cut around the building pads,
// so terrain / overlays / berms passing above a pad inside a footprint stick up as jagged triangles once the building is gone
// (reports/2026-10-22_잔해삼각형.txt). At load, every baked-ground vertex (and the terrain proxy the nuke scorch borrows) inside a
// destructible footprint + margin_m that rises above its pad (entry.baseY, or higher for a mass on an upper level: `level`) is
// indexed; surface layers (castShadow off) also get a band_m band outside it, capped to a `slope` rising from the pad so the
// edge is a short cut bank, not a wall. On 완파 those vertices go down (pad - eps_m inside, the slope in the band; normals redone
// for the touched triangles), instanced trees inside are hidden and trees in the band dropped with the ground. restore() (campus reset) puts everything back. A vertex or tree
// inside another footprint is never lowered by a neighbour's band (that building may still stand). No per-frame work.
const inRing = (r, x, z) => { let c = false; for (let n = r.length, j = n - 2, i = 0; i < n; j = i, i += 2) if ((r[i + 1] > z) !== (r[j + 1] > z) && x < (r[j] - r[i]) * (z - r[i + 1]) / (r[j + 1] - r[i + 1]) + r[i]) c = !c; return c; };
const FLAT = Object.freeze({ margin_m: .5, band_m: 4, slope: 1.2, eps_m: .08, tol_m: .02, raisedTol_m: .5, cell_m: 24 });
// options: per-campus override of FLAT (profile.ground.baked.flat), e.g. { band_m: 0 } where a pad sits against a tall cut;
// options.byId: { <entry id>: { band_m } } overrides the band for single buildings only (a pad against a tall cut, the rest keep the bank).
function createClearedFlattening(THREE, { entries, footprints, W, proxy, holder, owned, options = null }) {
  const F = options ? { ...FLAT, ...options } : FLAT;
  const t0 = performance.now();
  const MARGIN = F.margin_m * W, BAND = F.band_m * W, EPS = F.eps_m * W, TOL = F.tol_m * W, RAISED = F.raisedTol_m * W, CELL = F.cell_m * W;
  const sites = [], byEntry = new Map(), grid = new Map(), key = (i, j) => (i + 32768) * 65536 + (j + 32768);
  for (const entry of entries) {
    const raw = footprints[entry.id];
    if (!raw?.length || !Number.isFinite(entry.baseY)) continue;
    const rings = raw.map(r => { const o = []; for (let i = 0; i + 1 < r.length; i += 2) o.push(r[i] * W, -r[i + 1] * W); return o; });
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const r of rings) for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); z0 = Math.min(z0, r[i + 1]); z1 = Math.max(z1, r[i + 1]); }
    const sb = options?.byId?.[entry.id]?.band_m, BANDS = Number.isFinite(sb) ? sb * W : BAND;
    const r = MARGIN + BANDS, site = { entry, rings, band: BANDS, box: [x0 - r, z0 - r, x1 + r, z1 + r], verts: [], tris: new Map(), trees: [], done: false };
    sites.push(site); byEntry.set(entry, site);
    for (let i = Math.floor(site.box[0] / CELL); i <= Math.floor(site.box[2] / CELL); i++) for (let j = Math.floor(site.box[1] / CELL); j <= Math.floor(site.box[3] / CELL); j++) {
      const k = key(i, j); let list = grid.get(k); if (!list) grid.set(k, list = []); list.push(site);
    }
  }
  // Rings: an outer ring is a pit with its own level; a ring inside another (a courtyard) is a hole of it (outside the footprint).
  for (const site of sites) site.hole = site.rings.map((r, k) => {
    let parent = -1, odd = false;
    site.rings.forEach((q, m) => { if (m !== k && inRing(q, r[0], r[1])) { odd = !odd; parent = m; } });
    return odd ? parent : -1;
  });
  // scan(site, x, z): per ring, the distance from (x, z) to that ring's pit (0 inside it, a courtyard hole's edge counts) -> eff[]
  let eff = new Float64Array(8), own = new Uint8Array(8), dist = new Float64Array(8);
  function scan(site, x, z) {
    const R = site.rings, n = R.length;
    if (eff.length < n) { eff = new Float64Array(n); own = new Uint8Array(n); dist = new Float64Array(n); }
    for (let k = 0; k < n; k++) {
      const r = R[k]; let inside = false, d2 = Infinity;
      for (let m = r.length, j = m - 2, i = 0; i < m; j = i, i += 2) {
        const ax = r[j], az = r[j + 1], bx = r[i], bz = r[i + 1];
        if ((bz > z) !== (az > z) && x < (ax - bx) * (z - bz) / (az - bz) + bx) inside = !inside;
        const dx = bx - ax, dz = bz - az, u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1e-12))), ex = ax + dx * u - x, ez = az + dz * u - z;
        d2 = Math.min(d2, ex * ex + ez * ez);
      }
      own[k] = inside ? 1 : 0; dist[k] = Math.sqrt(d2);
    }
    let d = Infinity;
    for (let k = 0; k < n; k++) {
      if (site.hole[k] >= 0) { eff[k] = Infinity; continue; }
      let e = own[k] ? 0 : dist[k];
      if (own[k]) for (let h = 0; h < n; h++) if (site.hole[h] === k && own[h]) e = Math.max(e, dist[h]);
      eff[k] = e; d = Math.min(d, e);
    }
    return d;
  }
  // The ground cap at a scanned point: inside a pit (+ margin) that pit's level, in the band the slope of the nearest pit of each
  // level (the deepest cut), and across levels the highest (so the band of a low block never cuts the pad of its raised annex).
  // `raised`: the cap comes from a ring standing above entry.baseY (its level is its mass bottom, a little below its own pad).
  let capRaised = false;
  const byLevel = new Map();
  function cap(site, d) {
    byLevel.clear();
    for (let k = 0; k < site.rings.length; k++) {
      const e = eff[k]; if (e > MARGIN + site.band || (d <= MARGIN && e > MARGIN)) continue;
      const L = site.levels[k], c = e <= MARGIN ? L : L + (e - MARGIN) * F.slope;
      if (!(byLevel.get(L) <= c)) byLevel.set(L, c);
    }
    let y = -Infinity, from = -Infinity;
    for (const [L, c] of byLevel) if (c > y) { y = c; from = L; }
    capRaised = from > site.entry.baseY + TOL;
    return y;
  }
  // the sites whose footprint + margin + band holds (x, z): [site, distance, cap, raised] quads, and whether any footprint + margin holds it
  const hits = [];
  const near = (x, z) => {
    hits.length = 0; let inside = false;
    for (const site of grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) || []) {
      const b = site.box; if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) continue;
      const d = scan(site, x, z); if (d > MARGIN + site.band) continue;
      const y = cap(site, d); hits.push(site, d, y, capRaised); if (d <= MARGIN) inside = true;
    }
    return inside;
  };
  // Each ring's own level: max(entry.baseY, the bottom of the model's mass standing in it). A multi-mass building can stand on
  // two levels (KAIST 중앙기계실 E12: main block on the low pad, annex on a pad up the slope); digging the annex down to baseY
  // would open a pit, so the ground in each ring only goes down to where that ring's mass stood (rest piece bounds, world).
  const target = (d, y) => d <= MARGIN ? y - EPS : y;
  // a raised ring's level is its mass bottom, a little below its own pad: leave its pad (and anything within raisedTol_m) alone
  const limit = (d, y, raised) => y + (raised ? RAISED : TOL);
  // ground meshes: every baked layer except the far context, plus the terrain proxy; instanced meshes are trees / props
  const meshes = [proxy], instanced = [], uses = new Map();
  for (const layer of holder.children) if (!/^context/.test(layer.name)) layer.traverse(o => {
    if (!o.isMesh || !o.geometry?.getAttribute('position')) return;
    if (o.isInstancedMesh) instanced.push(o); else { meshes.push(o); uses.set(o.geometry, (uses.get(o.geometry) || 0) + 1); }
  });
  const box = new THREE.Box3(), mid = new THREE.Vector3();
  for (const site of sites) {
    site.levels = site.rings.map(() => Infinity);
    const model = site.entry.model, mw = model?.group?.matrixWorld;
    if (mw) for (const piece of model.pieces || []) {
      if (!piece.bounds) continue;
      box.copy(piece.bounds).applyMatrix4(mw); box.getCenter(mid);
      if (scan(site, mid.x, mid.z) > 0) continue;
      for (let k = 0; k < site.rings.length; k++) if (eff[k] === 0) site.levels[k] = Math.min(site.levels[k], box.min.y);
    }
    site.levels = site.levels.map(y => Number.isFinite(y) ? Math.max(site.entry.baseY, y) : site.entry.baseY);
  }
  // A raised ring's mass can reach below its own pad (E12 annex: ~2.5 m), so its level is also never below the lowest surface
  // ground already inside it: its pad stays, only what rises above the pad goes. Rings at baseY (almost all) are unchanged.
  const raisedRings = [];
  for (const site of sites) site.levels.forEach((y, k) => { if (y > site.entry.baseY + TOL && site.hole[k] < 0) {
    const r = site.rings[k]; let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); z0 = Math.min(z0, r[i + 1]); z1 = Math.max(z1, r[i + 1]); }
    raisedRings.push({ site, k, r, box: [x0, z0, x1, z1], min: Infinity });
  } });
  if (raisedRings.length) for (const mesh of meshes) {
    if (mesh === proxy || mesh.castShadow) continue;
    const pos = mesh.geometry.getAttribute('position'), m = mesh.matrixWorld.elements;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v), wx = m[0] * x + m[4] * y + m[8] * z + m[12], wz = m[2] * x + m[6] * y + m[10] * z + m[14];
      for (const q of raisedRings) if (wx >= q.box[0] && wx <= q.box[2] && wz >= q.box[1] && wz <= q.box[3] && inRing(q.r, wx, wz)) q.min = Math.min(q.min, m[1] * x + m[5] * y + m[9] * z + m[13]);
    }
  }
  for (const q of raisedRings) if (Number.isFinite(q.min)) q.site.levels[q.k] = Math.max(q.site.levels[q.k], q.min);
  // one pass over the vertices
  const slots = new Map(), p = new THREE.Vector3(), NONE = [];
  let vertexCount = 0;
  for (const mesh of meshes) {
    // a geometry drawn by two meshes in different places gets its own copy (same data: identical picture)
    if (uses.get(mesh.geometry) > 1) { mesh.geometry = mesh.geometry.clone(); owned.geometries.add(mesh.geometry); }
    const g = mesh.geometry, pos = g.getAttribute('position'), m = mesh.matrixWorld.elements, surface = mesh === proxy || !mesh.castShadow;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      const wx = m[0] * x + m[4] * y + m[8] * z + m[12], wz = m[2] * x + m[6] * y + m[10] * z + m[14];
      const inside = near(wx, wz); if (!hits.length) continue;
      const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
      for (let h = 0; h < hits.length; h += 4) {
        const site = hits[h], d = hits[h + 1], cy = hits[h + 2], raised = hits[h + 3];
        if (d > MARGIN && (inside || !surface)) continue;
        if (wy <= limit(d, cy, raised)) continue;
        let slot = slots.get(mesh);
        if (!slot) slots.set(mesh, slot = { mesh, g, pos, nor: g.getAttribute('normal'), inv: mesh.matrixWorld.clone().invert(), saved: new Map(), sphere: g.boundingSphere?.clone() ?? null, owner: new Map() });
        site.verts.push(slot, v, target(d, cy)); vertexCount++;
        let list = slot.owner.get(v); if (!list) slot.owner.set(v, list = []); if (!list.includes(site)) list.push(site);
      }
    }
  }
  // per site and mesh: the triangles touching its vertices (their normals are redone after lowering)
  for (const slot of slots.values()) {
    const idx = slot.g.index, n = idx ? idx.count : slot.pos.count;
    for (let t = 0; t + 2 < n; t += 3) {
      const a = idx ? idx.getX(t) : t, b = idx ? idx.getX(t + 1) : t + 1, c = idx ? idx.getX(t + 2) : t + 2;
      for (let q = 0; q < 3; q++) for (const site of slot.owner.get(q === 0 ? a : q === 1 ? b : c) || NONE) {
        let list = site.tris.get(slot); if (!list) site.tris.set(slot, list = []);
        if (list[list.length - 3] !== a || list[list.length - 2] !== b || list[list.length - 1] !== c) list.push(a, b, c);
      }
    }
    slot.owner = null;
  }
  // instanced trees: inside a footprint + margin -> hidden, in a band -> dropped to the lowered ground
  const tm = new THREE.Matrix4(); let treeCount = 0;
  for (const mesh of instanced) {
    const tree = { mesh, inv: mesh.matrixWorld.clone().invert(), saved: new Map() };
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, tm); if (Math.abs(tm.determinant()) < 1e-12) continue;
      p.setFromMatrixPosition(tm).applyMatrix4(mesh.matrixWorld);
      const inside = near(p.x, p.z);
      for (let h = 0; h < hits.length; h += 4) {
        const site = hits[h], d = hits[h + 1], cy = hits[h + 2], raised = hits[h + 3];
        if (d <= MARGIN) { site.trees.push(tree, i, NaN); treeCount++; }
        else if (!inside && p.y > limit(d, cy, raised)) { site.trees.push(tree, i, target(d, cy)); treeCount++; }
      }
    }
  }
  const stats = { sites: sites.length, vertices: vertexCount, meshes: slots.size, trees: treeCount, indexMs: +(performance.now() - t0).toFixed(1), flattened: 0, lastMs: 0, maxMs: 0 };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0), sums = new Map();
  const treesTouched = new Set();
  function flatten(entry) {
    const site = byEntry.get(entry); if (!site || site.done) return false;
    const start = performance.now(); site.done = true;
    const dirty = new Map(), V = site.verts;
    for (let k = 0; k < V.length; k += 3) {
      const slot = V[k], v = V[k + 1], ty = V[k + 2], pos = slot.pos, m = slot.mesh.matrixWorld.elements;
      const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      if (m[1] * x + m[5] * y + m[9] * z + m[13] <= ty) continue;
      if (!slot.saved.has(v)) slot.saved.set(v, slot.nor ? [x, y, z, slot.nor.getX(v), slot.nor.getY(v), slot.nor.getZ(v)] : [x, y, z]);
      p.set(x, y, z).applyMatrix4(slot.mesh.matrixWorld); p.y = ty; p.applyMatrix4(slot.inv);
      pos.setXYZ(v, p.x, p.y, p.z); let moved = dirty.get(slot); if (!moved) dirty.set(slot, moved = new Set()); moved.add(v);
      if (slot.g.boundingSphere) slot.g.boundingSphere.expandByPoint(p);
    }
    // normals of the lowered vertices from their (area-weighted) adjacent faces, in the mesh's own space
    for (const [slot, T] of site.tris) {
      const moved = dirty.get(slot); if (!slot.nor || !moved) continue;
      sums.clear();
      for (let k = 0; k < T.length; k += 3) {
        a.fromBufferAttribute(slot.pos, T[k]); b.fromBufferAttribute(slot.pos, T[k + 1]); c.fromBufferAttribute(slot.pos, T[k + 2]);
        c.sub(b); b.sub(a); b.cross(c);
        for (let q = 0; q < 3; q++) { const v = T[k + q]; if (!moved.has(v)) continue; const s = sums.get(v); if (s) s.add(b); else sums.set(v, b.clone()); }
      }
      // a face folded over by the cut (inner vertex down, outer one up) points down and draws black: keep normals facing up
      for (const [v, s] of sums) { if (s.lengthSq() < 1e-20) s.set(0, 1, 0); else { s.y = Math.abs(s.y); s.normalize(); } slot.nor.setXYZ(v, s.x, s.y, s.z); }
      slot.nor.needsUpdate = true;
    }
    for (const slot of dirty.keys()) { slot.pos.needsUpdate = true; slot.g.boundingBox = null; }
    const T = site.trees, touched = new Set();
    for (let k = 0; k < T.length; k += 3) {
      const tree = T[k], i = T[k + 1], ty = T[k + 2], mesh = tree.mesh;
      mesh.getMatrixAt(i, tm); if (Math.abs(tm.determinant()) < 1e-12) continue;
      if (Number.isNaN(ty)) { if (!tree.saved.has(i)) tree.saved.set(i, tm.clone()); mesh.setMatrixAt(i, zero); touched.add(tree); continue; }
      p.setFromMatrixPosition(tm).applyMatrix4(mesh.matrixWorld); if (p.y <= ty) continue;
      if (!tree.saved.has(i)) tree.saved.set(i, tm.clone());
      p.y = ty; p.applyMatrix4(tree.inv); tm.setPosition(p); mesh.setMatrixAt(i, tm); touched.add(tree);
    }
    for (const tree of touched) { tree.mesh.instanceMatrix.needsUpdate = true; treesTouched.add(tree); if (tree.mesh.boundingSphere) tree.mesh.computeBoundingSphere(); }
    const ms = performance.now() - start; stats.flattened++; stats.lastMs = +ms.toFixed(2); stats.maxMs = Math.max(stats.maxMs, stats.lastMs);
    return dirty.size > 0 || touched.size > 0;
  }
  function restore() {
    for (const slot of slots.values()) {
      if (!slot.saved.size) continue;
      for (const [v, o] of slot.saved) { slot.pos.setXYZ(v, o[0], o[1], o[2]); if (o.length > 3) slot.nor.setXYZ(v, o[3], o[4], o[5]); }
      slot.saved.clear(); slot.pos.needsUpdate = true; if (slot.nor) slot.nor.needsUpdate = true;
      slot.g.boundingSphere = slot.sphere ? slot.sphere.clone() : null; slot.g.boundingBox = null;
    }
    for (const tree of treesTouched) {
      for (const [i, m] of tree.saved) tree.mesh.setMatrixAt(i, m);
      tree.saved.clear(); tree.mesh.instanceMatrix.needsUpdate = true; if (tree.mesh.boundingSphere) tree.mesh.computeBoundingSphere();
    }
    treesTouched.clear(); for (const site of sites) site.done = false; stats.flattened = 0;
  }
  // diagnostics (검증/flat-cleared-check.mjs): what one building's clear would lower
  const info = entry => { const s = byEntry.get(entry); return s ? { vertices: s.verts.length / 3, trees: s.trees.length / 3, done: s.done, raisedRings: s.levels.filter(y => y > s.entry.baseY + TOL).length } : null; };
  return { stats, flatten, restore, info };
}
