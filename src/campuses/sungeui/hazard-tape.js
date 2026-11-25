// Sungeui only: the common band, then the school rules. The destruction outlines stay intact; display
// exclusions never become floor cuts.
// 1. Deck lift (11-11): court_wing, student and the A / 840 sides stand on the main building's roof deck (the
//    plaza, about 10.8 m above the baked ground under it), and the C front walk is a paving slab above the
//    baked ground. The common tape sits on the baked ground only, so those bands were hidden under the deck
//    and the paving. Here every vertex takes the topmost up-facing surface of the main model or of a site
//    paving mesh when one lies within 13 m above the baked ground.
// 2. The common step test is repeated on the lifted heights (same thresholds as src/engine/hazard-tape.js).
// 3. Whole quads at actual door / stair corridors (tape-exclusions.js) and short remnants are trimmed.
// 4. Surface fit (11-11 SUN-44): a quad whose interior dips under the surface (centre / edge / quarter samples,
//    not only the corners) is cut into short pieces that take the surface height, and a piece that crosses the
//    edge of a paving slab or of the deck is split at that edge (bisection), so each part lies on its own surface.
// 5. Deck loss (11-11 SUN-45): every band piece has an owner building. Pieces lifted onto the main deck fade
//    with the main building; a second copy of those quads, fitted to the ground without the deck, fades in at
//    the same time and stays while its owner stands. Each piece is faded as one (owner, class) unit.
import {createHazardTape as commonTape} from '../../engine/hazard-tape.js';
import {TAPE_EXCLUSIONS} from './tape-exclusions.js';
const DECK_ID = 'main', PAVING = /paving/i, UP = .7, ABOVE_M = 13, MIN_AREA_M2 = 5;
const FIT = { along_m: .3, across: 4, buried_m: .03, bisect: 12 };
export function createHazardTape(THREE, options) {
  return createSungeuiTape(THREE, options, TAPE_EXCLUSIONS);
}
export function createSungeuiTape(THREE, options, exclusions) {
  const spec = typeof options.spec === 'object' ? options.spec : {};
  const maxStep = spec.maxStep_m ?? 1.1, lift = (spec.lift_m ?? .06), W = options.worldUnitsPerMeter;
  const inner_m = spec.inner_m ?? .7, outer_m = spec.outer_m ?? 2.3;
  // Finish-15 (11-12): the drawn ground re-triangulates wall-foot cells into '<part>-split' meshes (build-package); the
  // plain grid triangles of those cells stay in the hidden 'tape-ground' mesh.  The band samples the ground without the
  // '-split' meshes, i.e. exactly the 1 m grid it was fitted to, so its shape does not depend on the split.
  const SPLIT = /-split$/, tapeRoots = (options.surfaceRoots || []).map(r => r && ({ name: r.name, parent: r.parent,
    traverse(fn) { r.traverse(o => { if (!SPLIT.test(o.name || '')) fn(o); }); } }));
  options = { ...options, surfaceRoots: tapeRoots, scenePaving: options.surfaceRoots?.[0]?.parent };
  const result = commonTape(THREE, { ...options, spec: { ...spec, maxStep_m: 1e9 } });
  if (!result) return result;
  const t0 = (globalThis.performance ?? Date).now(), ms = () => Math.round((globalThis.performance ?? Date).now() - t0), timing = {};
  const g = result.mesh.geometry, p = g.attributes.position, uv0 = g.attributes.uv, all = Array.from(g.index.array), L = lift * W;
  const inside = (x, z, r) => { let ok = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > z) != (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) ok = !ok; } return ok; };
  // ---- 1. ground / paving / deck surfaces near the tape (kind 0 / 1 / 2)
  const deck = options.entries.find(e => e.id === DECK_ID), roots = [];
  for (const r of options.surfaceRoots || []) if (r) roots.push([r, 0]);
  if (deck) roots.push([deck.model.group, 2]);
  const scen = options.scenePaving;
  scen?.traverse(o => { if (o.isMesh && !o.isInstancedMesh && PAVING.test(o.name)) roots.push([o, 1]); });
  g.computeBoundingBox(); const bb = g.boundingBox, cell = 2 * W, ox = Math.floor(bb.min.x / cell) - 1, oz = Math.floor(bb.min.z / cell) - 1;
  const gx = Math.floor(bb.max.x / cell) - ox + 2, gz = Math.floor(bb.max.z / cell) - oz + 2, buckets = new Map(), tris = [];
  const t = new Float64Array(9);
  for (const [root, kind] of roots) root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry || (kind && o.visible === false)) return;
    const pos = o.geometry.getAttribute('position'); if (!pos || pos.isInterleavedBufferAttribute || pos.normalized) return;
    o.updateWorldMatrix(true, false); const e = o.matrixWorld.elements, idx = o.geometry.index, n = idx ? idx.count : pos.count;
    for (let k = 0; k + 2 < n; k += 3) {
      for (let q = 0; q < 3; q++) { const v = idx ? idx.getX(k + q) : k + q, x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
        t[q * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; t[q * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; t[q * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
      const ux = t[3] - t[0], uy = t[4] - t[1], uz = t[5] - t[2], vx = t[6] - t[0], vy = t[7] - t[1], vz = t[8] - t[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz);
      if (kind === 0) { if (Math.abs((t[3] - t[0]) * (t[8] - t[2]) - (t[6] - t[0]) * (t[5] - t[2])) < 1e-6) continue; }
      else if (!(nl > 1e-9) || Math.abs(ny) / nl < UP) continue;
      const xa = Math.min(t[0], t[3], t[6]), xb = Math.max(t[0], t[3], t[6]), za = Math.min(t[2], t[5], t[8]), zb = Math.max(t[2], t[5], t[8]);
      const i0 = Math.max(0, Math.floor(xa / cell) - ox), i1 = Math.min(gx - 1, Math.floor(xb / cell) - ox), j0 = Math.max(0, Math.floor(za / cell) - oz), j1 = Math.min(gz - 1, Math.floor(zb / cell) - oz);
      if (i1 < i0 || j1 < j0 || (i1 - i0 + 1) * (j1 - j0 + 1) > 400) continue;
      const id = tris.length; tris.push([...t, kind]);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const c = j * gx + i; let l = buckets.get(c); if (!l) buckets.set(c, l = []); l.push(id); }
    }
  });
  timing.surfaces = ms();
  // The deck counts only inside the main outline (other buildings' bands on its roof), never for main's own band
  // (its entrance canopies are up-facing too).
  const deckRings = (spec.footprints?.[DECK_ID] || []).map(r => { const out = []; for (let i = 0; i + 1 < r.length; i += 2) out.push([r[i], r[i + 1]]); return out; });
  const inDeck = (x, z) => { const e = x / W, n = -z / W; let k = 0; for (const r of deckRings) if (inside(e, n, r)) k++; return k % 2 === 1; };
  const terrainAt = (x, z) => options.terrain?.heightAt ? options.terrain.heightAt(x, z) : 0;
  // Surface at (x, z): the baked ground (topmost ground triangle 4 m below .. 6 m above the terrain, as the common
  // band), then the topmost paving / deck within (ground + 2 cm, ground + 13 m]. Returns [height, kind] (no lift).
  // `base` overrides the ground (the common band's own ground height at its vertices).
  const surface = (x, z, withDeck, base) => {
    const l = buckets.get((Math.floor(z / cell) - oz) * gx + Math.floor(x / cell) - ox);
    let ground = base;
    if (ground === undefined) {
      const hT = terrainAt(x, z), lo = hT - 4 * W, hi = hT + 6 * W; let best = -Infinity;
      if (l) for (const id of l) { const T = tris[id]; if (T[9] !== 0) continue; const y = bary(T, x, z); if (y !== null && y >= lo && y <= hi && y > best) best = y; }
      ground = Number.isFinite(best) ? best : hT;
    }
    let top = -Infinity, kind = 0, deckOK = null;
    if (l) for (const id of l) { const T = tris[id]; if (T[9] === 0) continue; if (T[9] === 2 && (!withDeck || (deckOK ??= inDeck(x, z)) === false)) continue;
      const y = bary(T, x, z); if (y !== null && y > ground + .02 * W && y <= ground + ABOVE_M * W && y > top) { top = y; kind = T[9]; } }
    return Number.isFinite(top) ? [top, kind] : [ground, 0];
  };
  // ---- 2. owner building of every common loop (vertices sit inner_m / outer_m from their own outline)
  const ownIds = [], ownEntry = [], ownRings = [];
  for (const e of options.entries) { const rs = spec.footprints?.[e.id]; if (!rs?.length) continue; ownIds.push(e.id); ownEntry.push(e); ownRings.push(rs.map(r => { const o = []; for (let i = 0; i + 1 < r.length; i += 2) o.push([r[i], r[i + 1]]); return o; })); }
  const edgeDist = (e, n, rings) => { let d = Infinity; for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[j], b = r[i], dx = b[0] - a[0], dn = b[1] - a[1], ll = dx * dx + dn * dn || 1e-12, u = Math.max(0, Math.min(1, ((e - a[0]) * dx + (n - a[1]) * dn) / ll)); d = Math.min(d, Math.hypot(a[0] + dx * u - e, a[1] + dn * u - n)); } return d; };
  const loopOf = new Int32Array(p.count).fill(-1); const loops = [];
  for (let i = 0; i < all.length; i += 6) { const a = Math.min(...all.slice(i, i + 6)); let L0 = loopOf[a] >= 0 ? loopOf[a] : -1; if (L0 < 0) { L0 = loops.length; loops.push([]); } for (const k of all.slice(i, i + 6)) if (loopOf[k] < 0) { loopOf[k] = L0; loops[L0].push(k); } }
  const vOwner = new Uint8Array(p.count);
  for (const vs of loops) { const err = ownRings.map(() => 0); for (let s = 0; s < vs.length; s += 3) { const e = p.getX(vs[s]) / W, n = -p.getZ(vs[s]) / W; ownRings.forEach((rs, i) => { const d = edgeDist(e, n, rs); err[i] += Math.min(Math.abs(d - inner_m), Math.abs(d - outer_m), 4); }); } let best = 0; err.forEach((v, i) => { if (v < err[best]) best = i; }); for (const k of vs) vOwner[k] = best; }
  timing.owners = ms();
  // ---- 3. corner heights (with deck / without deck), step test, exclusions, short remnants
  const cornerH = [new Map(), new Map()];
  const corner = (k, mode) => { let h = cornerH[mode].get(k); if (!h) { h = surface(p.getX(k), p.getZ(k), mode === 0, p.getY(k) - L); cornerH[mode].set(k, h); } return h; };
  const step = maxStep * W; let dropped = 0, lifted = 0, deckCorners = 0;
  const probe = (mode, ...ks) => { const x = ks.reduce((s, k) => s + p.getX(k), 0) / ks.length, z = ks.reduce((s, k) => s + p.getZ(k), 0) / ks.length, base = terrainAt(x, z), h = surface(x, z, mode === 0, base); return h[0] + L; };
  const quads = [[], []];
  for (let i = 0; i < all.length; i += 6) {
    const ix = all.slice(i, i + 6), u = [...new Set(ix)].sort((x, y) => x - y), [a, b, c, d] = u;   // a,c inner; b,d outer
    const hd = u.map(k => corner(k, 0)), touchesDeck = hd.some(h => h[1] === 2);
    for (const mode of touchesDeck ? [0, 1] : [0]) {
      const ys = u.map(k => corner(k, mode)[0] + L), lo = Math.min(...ys), hi = Math.max(...ys);
      if (hi - lo > step * .55) {
        const off = Math.max(Math.abs(probe(mode, a, b) - (ys[0] + ys[1]) / 2), Math.abs(probe(mode, c, d) - (ys[2] + ys[3]) / 2), Math.abs(probe(mode, a, b, c, d) - (ys[0] + ys[1] + ys[2] + ys[3]) / 4));
        if (off > step * .3 || hi - lo > step * 3) { if (mode === 0) dropped++; continue; }
      }
      quads[mode].push(ix);
    }
  }
  for (const [k, h] of cornerH[0]) { if (h[1]) lifted++; if (h[1] === 2) deckCorners++; }
  let excluded = 0, short = 0, components = 0;
  const kept = quads.map((qs, mode) => {
    const open = [];
    for (const ix of qs) { const pts = [...new Set(ix)].map(k => [p.getX(k) / W, -p.getZ(k) / W]); pts.push([pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length]); if (exclusions.some(r => pts.some(q => inside(...q, r)))) { if (mode === 0) excluded++; continue; } open.push(ix); }
    const owner = new Map(), parent = open.map((_, i) => i), root = i => parent[i] === i ? i : (parent[i] = root(parent[i]));
    open.forEach((q, i) => { for (const k of q) { if (owner.has(k)) parent[root(i)] = root(owner.get(k)); else owner.set(k, i); } });
    const groups = new Map(); open.forEach((q, i) => { const k = root(i); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(q); });
    const out = [];
    for (const qs2 of groups.values()) { let area = 0; for (const q of qs2) for (let i = 0; i < 6; i += 3) { const a = q[i], b = q[i + 1], c = q[i + 2]; area += Math.abs((p.getX(b) - p.getX(a)) * (p.getZ(c) - p.getZ(a)) - (p.getZ(b) - p.getZ(a)) * (p.getX(c) - p.getX(a))) / (2 * W * W); } if (area < MIN_AREA_M2) { if (mode === 0) short += qs2.length; continue; } if (mode === 0) components++; out.push(...qs2); }
    return out;
  });
  timing.trim = ms();
  // ---- 4. emit: plain quads keep the common vertices; quads that dip under the surface are cut and fitted
  const X = [], Y = [], Z = [], U = [], V = [], OW = [], CL = [], index = [], shared = new Map();
  const add = (x, y, z, u, v, o, cl) => { X.push(x); Y.push(y); Z.push(z); U.push(u); V.push(v); OW.push(o); CL.push(cl); return X.length - 1; };
  const tri = (i0, i1, i2) => { const up = (Z[i1] - Z[i0]) * (X[i2] - X[i0]) - (X[i1] - X[i0]) * (Z[i2] - Z[i0]); if (up >= 0) index.push(i0, i1, i2); else index.push(i0, i2, i1); };
  let fitted = 0, pieces = 0, splits = 0, copies = 0;
  for (const mode of [0, 1]) for (const ix of kept[mode]) {
    const [a, b, c, d] = [...new Set(ix)].sort((x, y) => x - y), hs = [a, b, c, d].map(k => corner(k, mode)), o = vOwner[a];
    const quadCls = mode === 1 ? 2 : hs.some(h => h[1] === 2) ? 1 : 0;
    // bilinear point of the quad: s along (a -> c), w across (a -> b)
    const P = (s, w) => { const f = (k0, k1, k2, k3, get) => (get(k0) * (1 - w) + get(k1) * w) * (1 - s) + (get(k2) * (1 - w) + get(k3) * w) * s;
      return [f(a, b, c, d, k => p.getX(k)), f(a, b, c, d, k => p.getZ(k)), f(a, b, c, d, k => uv0.getX(k)), f(a, b, c, d, k => uv0.getY(k))]; };
    // height of the two drawn triangles (a-b-c, b-d-c) at a sample; centre, edge middles and quarter points are
    // tested against the surface, not only the corners
    const vt = (k, h) => [p.getX(k), h[0], p.getZ(k)], TA = [...vt(a, hs[0]), ...vt(b, hs[1]), ...vt(c, hs[2])], TB = [...vt(b, hs[1]), ...vt(d, hs[3]), ...vt(c, hs[2])];
    let buried = false;
    for (const s of [.25, .5, .75, 0, 1]) { for (const w of [0, .25, .5, .75, 1]) { if ((s === 0 || s === 1) && w !== .5) continue;
      const [x, z] = P(s, w), y = bary(TA, x, z) ?? bary(TB, x, z); if (y === null) continue;
      if (surface(x, z, mode === 0)[0] > y + FIT.buried_m * W) { buried = true; break; } } if (buried) break; }
    if (!buried) {
      const ids = new Map();
      for (const k of [a, b, c, d]) { const key = k * 4 + quadCls; let v = shared.get(key); if (v === undefined) { v = add(p.getX(k), corner(k, mode)[0] + L, p.getZ(k), uv0.getX(k), uv0.getY(k), o, quadCls); shared.set(key, v); } ids.set(k, v); }
      for (let i = 0; i < 6; i += 3) tri(ids.get(ix[i]), ids.get(ix[i + 1]), ids.get(ix[i + 2]));
      if (mode === 1) copies++;
      continue;
    }
    fitted++; if (mode === 1) copies++;
    const len = Math.max(Math.hypot(p.getX(c) - p.getX(a), p.getZ(c) - p.getZ(a)), Math.hypot(p.getX(d) - p.getX(b), p.getZ(d) - p.getZ(b))) / W;
    const na = Math.min(40, Math.max(1, Math.ceil(len / FIT.along_m))), nc = FIT.across;
    const at = (s, w) => { const q = P(s, w), h = surface(q[0], q[1], mode === 0); return { s, w, x: q[0], z: q[1], u: q[2], v: q[3], y: h[0] + L, k: h[1] }; };
    const grid = []; for (let i = 0; i <= na; i++) { const row = []; for (let j = 0; j <= nc; j++) row.push(at(i / na, j / nc)); grid.push(row); }
    const emit = poly => { if (poly.length < 3) return; const cl = mode === 1 ? 2 : poly.some(q => q.k === 2) ? 1 : 0, vs = poly.map(q => add(q.x, q.y, q.z, q.u, q.v, o, cl)); for (let i = 1; i + 1 < vs.length; i++) tri(vs[0], vs[i], vs[i + 1]); pieces++; };
    for (let i = 0; i < na; i++) for (let j = 0; j < nc; j++) {
      const ring = [grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]];
      const changes = ring.filter((q, r) => q.k !== ring[(r + 1) % 4].k).length;
      if (!changes) { emit(ring); continue; }
      if (changes !== 2) continue;
      // split where the surface kind changes along the two crossing edges
      const parts = [[], []], kA = ring[0].k; let side = 0;
      for (let r = 0; r < 4; r++) {
        const q = ring[r], n = ring[(r + 1) % 4]; parts[side].push(q);
        if (q.k !== n.k) {
          let lo = 0, hi = 1;
          for (let it = 0; it < FIT.bisect; it++) { const m = (lo + hi) / 2, mq = at(q.s + (n.s - q.s) * m, q.w + (n.w - q.w) * m); if (mq.k === q.k) lo = m; else hi = m; }
          parts[side].push(at(q.s + (n.s - q.s) * lo, q.w + (n.w - q.w) * lo)); side = 1 - side;
          parts[side].push(at(q.s + (n.s - q.s) * hi, q.w + (n.w - q.w) * hi));
        }
      }
      splits++; emit(parts[0]); emit(parts[1]); void kA;
    }
  }
  timing.emit = ms();
  const n = X.length, pos = new Float32Array(n * 3), uvs = new Float32Array(n * 2), alive = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = X[i]; pos[i * 3 + 1] = Y[i]; pos[i * 3 + 2] = Z[i]; uvs[i * 2] = U[i]; uvs[i * 2 + 1] = V[i]; alive[i] = CL[i] === 2 ? 0 : 1; }
  g.deleteAttribute('normal');
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  const aliveAttr = new THREE.BufferAttribute(alive, 1); aliveAttr.setUsage(THREE.DynamicDrawUsage); g.setAttribute('tapeAlive', aliveAttr);
  g.setIndex(index); g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox();
  result.mesh.userData.tapeOwner = Uint8Array.from(OW); result.mesh.userData.tapeOwnerIds = ownIds; result.mesh.userData.tapeClass = Uint8Array.from(CL);
  // ---- 5. fading: owner building (as the common band) x deck (main) for deck pieces / ground copies
  const ownerAlive = new Float64Array(ownIds.length).fill(1); let deckAlive = 1;
  const writeAll = () => { for (let i = 0; i < n; i++) { const oa = ownerAlive[OW[i]]; alive[i] = CL[i] === 0 ? oa : CL[i] === 1 ? Math.min(oa, deckAlive) : oa * (1 - deckAlive); } aliveAttr.needsUpdate = true; };
  const baseUpdate = result.update, baseReset = result.reset, fade = 1 / (spec.fade_s ?? .55);
  result.update = dt => { baseUpdate(dt); const s = (Number.isFinite(dt) && dt > 0 ? dt : 1 / 60) * fade; let changed = false;
    ownEntry.forEach((e, i) => { if (e.cleared && ownerAlive[i] > 0) { ownerAlive[i] = Math.max(0, ownerAlive[i] - s); changed = true; } });
    if (deck?.cleared && deckAlive > 0) { deckAlive = Math.max(0, deckAlive - s); changed = true; }
    if (changed) writeAll(); };
  result.reset = () => { baseReset(); ownerAlive.fill(1); deckAlive = 1; writeAll(); };
  const count = cl => CL.reduce((s, v) => s + (v === cl ? 1 : 0), 0);
  Object.assign(result.stats, { droppedAtSteps: dropped, triangles: index.length / 3, vertices: n, schoolTrim: { removedQuads: excluded + short, excluded, shortFragments: short, remainingComponents: components, liftedVertices: lifted, deckVertices: deckCorners, surfaceTriangles: tris.length,
    timing: { ...timing, total: ms() }, ownerQuads: kept.map(k => k.length), fittedQuads: fitted, fittedPieces: pieces, splitPieces: splits, deckCopyQuads: copies, verticesByClass: [count(0), count(1), count(2)] } });
  return result;
}
function bary(T, x, z) {
  const d = (T[3] - T[0]) * (T[8] - T[2]) - (T[6] - T[0]) * (T[5] - T[2]); if (!d) return null;
  const a = ((T[3] - x) * (T[8] - z) - (T[6] - x) * (T[5] - z)) / d, b = ((T[6] - x) * (T[2] - z) - (T[0] - x) * (T[8] - z)) / d, w = 1 - a - b;
  if (a < -1e-6 || b < -1e-6 || w < -1e-6) return null;
  return a * T[1] + b * T[4] + w * T[7];
}
