// ?interior preview only (dynamically imported by main.js; never loaded otherwise).
// The approved models are hollow shells. Before a model is cut into fragments this module, at runtime only,
//  A) marks which side of every opaque shell triangle faces the building's inside (mesh.userData.interiorSides:
//     1 = back side, 2 = front side, 3 = both), so model-destruction.js paints that side dark concrete, and
//  B) adds flat floor slabs, a few columns and corridor/room partitions to the source scene, so they are
//     fragmented, hit and collapsed exactly like the shell. Assets on disk are never touched.
// "Inside" is decided on a plan grid (6 cells per 3.2 m fragment cell) at each storey height: a cell is inside when
// an opaque surface covers it from above (glass roofs don't count) and at least 7 of 8 horizontal rays hit the
// shell. The rays are answered for the whole grid at once from wall rasters (plane slices of the shell triangles),
// a few linear passes per storey instead of real ray casts. Slabs also keep >= INSET metres from every wall hit.
// All lengths are model metres (the campus scales models by worldUnitsPerMeter afterwards).
import { describeFragmentSource } from './model-destruction.js?v=lz69';

// Halls and open structures with no storeys: only the dark inner face (A) applies.
const NO_FLOORS = new Set(['gym', 'auditorium', 'amphitheater', 'radioObservatory', 'nonjidang', 'sportsLife']);
const SURFACE_ONLY = /glass|ivy|flag|lawn|pole|membrane|seating|water|leaf|tree/i;
const CELL = 3.2;         // model-destruction.js default fragment cell: slab quads never cross one
const R = CELL / 6;       // plan grid cell (~.53 m)
const EDGE = 2e-4;        // slab quads stop this short of a cell border (float32 rounding would cross it)
const SLICE = .4;         // spacing of horizontal shell slices
const SLAB_T = .3;        // slab rim height
const INSET = 1.0;        // slab cell centre to nearest wall cell centre (~.5 m clear gap to the wall)
const HEADROOM = 2.2;     // a slab needs this much covered height above it
const STOREY = 3.8;       // fallback storey height (university buildings ~3.5-4 m)
// Columns/partitions sit on the fragment-cell grid so the clipper does not cut them again: a column at the centre of
// every 3rd cell along the long axis and every 2nd across it; corridor walls one cell long with a door at the end
// of every other cell; a room wall every 3 cells.
const COLUMN = .6, COLUMN_CLEAR = 1.5, CORRIDOR = 1.2, DOOR = 1.1;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// The one material of the added geometry (named so the campus finishes give it the same mineral grain as the shell's concrete).
export function createInteriorMaterial(THREE, id) {
  const material = new THREE.MeshStandardMaterial({ name: `${id}-interior-concrete`, color: 0x9b968c, roughness: .93, metalness: 0, side: THREE.DoubleSide });
  material.userData.interiorWeight = .15;
  return material;
}
// Its entry in a fragment job's material table (src/model-destruction.js describeFragmentSource).
export function interiorMaterialInfo(id) { return { visible: true, name: `${id}-interior-concrete`, transparent: false, opacity: 1, interiorWeight: .15 }; }

/** Former in-place API: classifies the scene's shell sides (mesh.userData.interiorSides) and adds the interior mesh
 * as the root's last child. Same result as before; the work itself is computeInteriorData. */
export function fillInterior(THREE, scene, { id = '' } = {}) {
  const job = describeFragmentSource(THREE, id, scene, { strict: false });
  const fill = computeInteriorData(job.records, job.materials, { id });
  job.meshes.forEach((mesh, i) => { if (fill.sides[i]) mesh.userData.interiorSides = fill.sides[i]; });
  if (!fill.geometry) return { stats: fill.stats, dispose() {} };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(fill.geometry.position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(fill.geometry.normal, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(fill.geometry.uv, 2));
  const material = createInteriorMaterial(THREE, id);
  const mesh = new THREE.Mesh(geometry, material); mesh.name = `${id}-interior`;
  // Scene space: undo the root's own transform so vertices land where the slices were taken.
  mesh.matrixAutoUpdate = false; mesh.matrix.copy(scene.matrixWorld).invert(); scene.add(mesh); mesh.updateMatrixWorld(true);
  return { stats: fill.stats, mesh, dispose() { mesh.removeFromParent(); geometry.dispose(); material.dispose(); } };
}

// Same attribute read as BufferAttribute.getX/Y/Z (records: src/model-destruction.js describeFragmentSource).
function positionReader(a) {
  const { array, stride, offset } = a;
  if (!a.normalized || array.constructor === Float32Array) return (i, c) => array[i * stride + offset + c];
  const d = { [Uint32Array.name]: 4294967295.0, [Uint16Array.name]: 65535.0, [Uint8Array.name]: 255.0 }[array.constructor.name];
  if (d) return (i, c) => array[i * stride + offset + c] / d;
  const n = { [Int32Array.name]: 2147483647.0, [Int16Array.name]: 32767.0, [Int8Array.name]: 127.0 }[array.constructor.name];
  if (n) return (i, c) => Math.max(array[i * stride + offset + c] / n, - 1.0);
  throw new Error('Invalid component type.');
}

/** Pure (no THREE, no DOM; also runs in src/workers/fragment-worker.js): sides per record (Uint8Array, or null when the
 * mesh has no classified triangle) and the added geometry as Float32Arrays (null when nothing is added). */
export function computeInteriorData(records, materials, { id = '' } = {}) {
  const started = performance.now(), phase = {};
  const lap = name => { phase[name] = +(performance.now() - started).toFixed(1); };
  // 1. Shell triangles in scene space (same mesh/group/drawRange walk as model-destruction.js).
  let tris = new Float32Array(9 * 8192), kinds = new Uint8Array(8192), slot = new Int32Array(8192), triCount = 0;
  const sidesList = [], sidesOut = [];   // per mesh its sides array; slot = meshNumber * 2^22 + triangle number (or -1)
  for (const record of records) {
    const pos = record.position, idx = record.index, ia = idx?.array, available = idx ? idx.count : pos.count;
    const first = Math.max(0, record.drawStart || 0), last = Math.min(available, first + record.drawCount);
    const flip = record.flip, e = record.matrix, world = new Float32Array(pos.count * 3), read = positionReader(pos);
    for (let i = 0; i < pos.count; i++) {
      const x = read(i, 0), y = read(i, 1), z = read(i, 2), w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
      world[i * 3] = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w; world[i * 3 + 1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w; world[i * 3 + 2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    }
    const sides = new Uint8Array(Math.ceil(available / 3)), meshNo = sidesList.length;
    const groups = record.multi ? record.groups : [{ start: first, count: last - first, materialIndex: 0 }];
    let any = false;
    for (const range of groups) {
      const materialSlot = record.multi ? record.materials[range.materialIndex] : record.material;
      const material = materialSlot >= 0 ? materials[materialSlot] : null;
      if (!material || material.visible === false) continue;
      const name = material.name || '', glass = /glass/i.test(name) && !/spandrel/i.test(name);
      const see = material.transparent || material.opacity < 1;
      const decor = !glass && SURFACE_ONLY.test(name);   // ivy, flags, lawn...: neither walls nor roofs here
      const kind = (glass ? 1 : 0) | (see ? 2 : 0) | (glass || see || decor ? 4 : 0) | (decor ? 8 : 0);
      const lo = Math.max(first, range.start), hi = Math.min(last, range.start + range.count);
      for (let k = lo; k + 2 < hi; k += 3) {
        let i0 = ia ? ia[k] : k, i1 = ia ? ia[k + 1] : k + 1, i2 = ia ? ia[k + 2] : k + 2;
        if (flip) { const s = i1; i1 = i2; i2 = s; }
        if (triCount >= kinds.length) {
          const n = kinds.length * 2, t2 = new Float32Array(n * 9), k2 = new Uint8Array(n), s2 = new Int32Array(n);
          t2.set(tris); k2.set(kinds); s2.set(slot); tris = t2; kinds = k2; slot = s2;
        }
        const o = triCount * 9;
        tris[o] = world[i0 * 3]; tris[o + 1] = world[i0 * 3 + 1]; tris[o + 2] = world[i0 * 3 + 2];
        tris[o + 3] = world[i1 * 3]; tris[o + 4] = world[i1 * 3 + 1]; tris[o + 5] = world[i1 * 3 + 2];
        tris[o + 6] = world[i2 * 3]; tris[o + 7] = world[i2 * 3 + 1]; tris[o + 8] = world[i2 * 3 + 2];
        kinds[triCount] = kind; slot[triCount] = kind & 4 ? -1 : meshNo * 4194304 + ((k / 3) | 0); triCount++; any = true;
      }
    }
    sidesList.push(sides); sidesOut.push(any ? sides : null);
  }
  lap('collect');
  const stats = { id, phase, levels: [], slabs: 0, slabArea: 0, columns: 0, partitions: 0, triangles: 0, darkSides: 0, shellTriangles: triCount, ms: 0 };
  if (!triCount) return { stats, sides: sidesOut, geometry: null };
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let t = 0; t < triCount * 9; t += 3) {
    const x = tris[t], y = tris[t + 1], z = tris[t + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  // Grid origin on a fragment-cell corner so slab quads can be cut exactly at cell borders.
  const ox = (Math.floor(minX / CELL) - 1) * CELL, oz = (Math.floor(minZ / CELL) - 1) * CELL;
  const nx = Math.ceil((maxX - ox) / R) + 7, nz = Math.ceil((maxZ - oz) / R) + 7, N = nx * nz;
  const cellX = x => Math.floor((x - ox) / R), cellZ = z => Math.floor((z - oz) / R);
  const X = i => ox + i * R, Z = j => oz + j * R;

  // 2. Highest opaque cover over every plan cell (scanline per row; glass/transparent roofs leave atria open).
  const top = new Float32Array(N).fill(-Infinity);
  for (let t = 0; t < triCount; t++) {
    if (kinds[t] & 11) continue;
    const o = t * 9, ax = tris[o], ay = tris[o + 1], az = tris[o + 2], bx = tris[o + 3], by = tris[o + 4], bz = tris[o + 5], cx = tris[o + 6], cy = tris[o + 7], cz = tris[o + 8];
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const qx = uy * vz - uz * vy, qy = uz * vx - ux * vz, qz = ux * vy - uy * vx;
    if (Math.abs(qy) < .05 * Math.hypot(qx, qy, qz)) continue;   // (near-)vertical: covers nothing
    const ylo = Math.min(ay, by, cy), yhi = Math.max(ay, by, cy);
    const j0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - oz) / R - .5)), j1 = Math.min(nz - 1, Math.floor((Math.max(az, bz, cz) - oz) / R - .5));
    for (let j = j0; j <= j1; j++) {
      const pz = Z(j + .5); let lo = Infinity, hi = -Infinity;
      for (let e = 0; e < 3; e++) {
        const a = o + e * 3, b = o + (e === 2 ? 0 : e + 1) * 3, za = tris[a + 2], zb = tris[b + 2];
        if ((za <= pz && zb >= pz) || (zb <= pz && za >= pz)) {
          if (za === zb) { lo = Math.min(lo, tris[a], tris[b]); hi = Math.max(hi, tris[a], tris[b]); continue; }
          const x = tris[a] + (tris[b] - tris[a]) * (pz - za) / (zb - za); if (x < lo) lo = x; if (x > hi) hi = x;
        }
      }
      if (!(hi >= lo)) continue;
      const i0 = Math.max(0, Math.ceil((lo - ox) / R - .5)), i1 = Math.min(nx - 1, Math.floor((hi - ox) / R - .5));
      for (let i = i0; i <= i1; i++) { const y = Math.min(yhi, Math.max(ylo, ay - (qx * (X(i + .5) - ax) + qz * (pz - az)) / qy)), c = j * nx + i; if (y > top[c]) top[c] = y; }
    }
  }
  // Lowest cover over each 3x3 neighbourhood: a sill hood or eave over a cell outside the wall does not count.
  const cover3 = new Float32Array(N).fill(-Infinity);
  for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const c = j * nx + i; let m = Infinity;
    for (let dj = -nx; dj <= nx; dj += nx) for (let di = -1; di <= 1; di++) { const v = top[c + dj + di]; if (v < m) m = v; }
    cover3[c] = m;
  }
  lap('top');

  // 3. Storey heights. Window sills (bottoms of glass panes) repeat once per storey: slab = sill - .9 m.
  const bins = new Float64Array(Math.ceil((maxY - minY) / .2) + 1);
  for (let t = 0; t < triCount; t++) {
    if (!(kinds[t] & 1)) continue;
    const o = t * 9, y = Math.min(tris[o + 1], tris[o + 4], tris[o + 7]);
    const ux = tris[o + 3] - tris[o], uy = tris[o + 4] - tris[o + 1], uz = tris[o + 5] - tris[o + 2], wx = tris[o + 6] - tris[o], wy = tris[o + 7] - tris[o + 1], wz = tris[o + 8] - tris[o + 2];
    bins[Math.floor((y - minY) / .2)] += .5 * Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx);
  }
  let peak = 0; for (const b of bins) if (b > peak) peak = b;
  const sills = [];
  for (let b = 0; b < bins.length; b++) if (bins[b] > 0 && bins[b] >= peak * .15 && bins[b] >= (bins[b - 1] || 0) && bins[b] >= (bins[b + 1] || 0)) {
    const y = minY + (b + .5) * .2, last = sills[sills.length - 1];
    if (last && y - last.y < 1.2) { if (bins[b] > last.w) { last.y = y; last.w = bins[b]; } } else sills.push({ y, w: bins[b] });
  }
  const fromSills = [];
  for (const s of sills) { const y = s.y - .9; if (y >= minY + 2.6 && y <= maxY - HEADROOM && (!fromSills.length || y - fromSills[fromSills.length - 1] >= 2.6)) fromSills.push(y); }
  // Fill storeys the windows do not show (blank walls, tall curtain walls, no glass), up to the very top so the
  // classification (A) has a level near every height; only levels with enough cover above become slabs.
  const storeys = [], marks = [minY, ...fromSills];
  for (let k = 0; k < marks.length; k++) {
    const a = marks[k], b = k + 1 < marks.length ? marks[k + 1] : null;
    if (k > 0) storeys.push(a);
    if (b !== null) { const n = Math.round((b - a) / STOREY) - 1; for (let m = 1; m <= n; m++) storeys.push(a + (b - a) / (n + 1) * m); }
    else for (let y = a + STOREY; y < maxY - .5; y += STOREY) storeys.push(y);
  }
  stats.storeySource = fromSills.length >= 2 ? 'window-sills' : fromSills.length ? 'window-sills+uniform' : 'uniform';
  const ground = minY + 1.2, levelYs = [ground, ...storeys.filter(y => y > ground + 1)];

  // 4. Slices of the shell (glass included: a window still closes the room), only where a level needs them.
  const below = .5, above = .8, S = Math.max(1, Math.ceil((maxY - minY) / SLICE)), sliceY = s => minY + (s + .5) * SLICE;
  const sliceAt = new Int32Array(S).fill(-1); let used = 0;
  // Plus a foot level just above the base: ground-storey columns/partitions also need walls down there.
  const foot = { y: minY + .3, below: .25, above: .3 };
  for (const [y, b, a] of [...levelYs.map(y => [y, below, above]), [foot.y, foot.below, foot.above]])
    for (let s = Math.max(0, Math.ceil((y - b - minY) / SLICE - .5)); s <= Math.min(S - 1, Math.floor((y + a - minY) / SLICE - .5)); s++) if (sliceAt[s] < 0) sliceAt[s] = used++;
  const slices = new Uint8Array(used * N);
  const mark = (base, x0, z0, x1, z1) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (R * .5)));
    let pi = -1, pj = -1;
    for (let k = 0; k <= n; k++) {
      const f = k / n, i = Math.floor((x0 + (x1 - x0) * f - ox) / R), j = Math.floor((z0 + (z1 - z0) * f - oz) / R);
      if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
      slices[base + j * nx + i] = 1;
      if (pi >= 0 && pi !== i && pj !== j) slices[base + pj * nx + i] = 1;  // no diagonal leak between steps
      pi = i; pj = j;
    }
  };
  for (let t = 0; t < triCount; t++) {
    if (kinds[t] & 8) continue;
    const o = t * 9, y0 = tris[o + 1], y1 = tris[o + 4], y2 = tris[o + 7];
    const lo = Math.min(y0, y1, y2), hi = Math.max(y0, y1, y2);
    const s0 = Math.max(0, Math.ceil((lo - minY) / SLICE - .5)), s1 = Math.min(S - 1, Math.floor((hi - minY) / SLICE - .5));
    for (let s = s0; s <= s1; s++) {
      if (sliceAt[s] < 0) continue;
      const h = sliceY(s); let n = 0, p0 = 0, p1 = 0, p2 = 0, p3 = 0;
      for (let e = 0; e < 3; e++) {
        const a = o + e * 3, b = o + (e === 2 ? 0 : e + 1) * 3, ya = tris[a + 1] - h, yb = tris[b + 1] - h;
        if ((ya < 0) !== (yb < 0)) {
          const f = ya / (ya - yb), x = tris[a] + (tris[b] - tris[a]) * f, z = tris[a + 2] + (tris[b + 2] - tris[a + 2]) * f;
          if (n === 0) { p0 = x; p1 = z; } else { p2 = x; p3 = z; } n++;
        }
      }
      if (n >= 2) mark(sliceAt[s] * N, p0, p1, p2, p3);
    }
  }
  lap('slices');

  // 5. Per level: wall union of nearby slices -> steps to the first wall in 8 directions (0 = the ray escapes).
  const steps = DIRS.map(() => new Uint16Array(N));
  function level(y, b = below, a = above) {
    const wall = new Uint8Array(N);
    for (let s = Math.max(0, Math.ceil((y - b - minY) / SLICE - .5)); s <= Math.min(S - 1, Math.floor((y + a - minY) / SLICE - .5)); s++) {
      const base = sliceAt[s] * N; for (let c = 0; c < N; c++) if (slices[base + c]) wall[c] = 1;
    }
    // The grid's outer ring never holds a wall (>= 6 empty cells of margin), so its steps stay 0 and the inner
    // cells need no bounds checks: each reads the neighbour one step along its direction, processed first.
    for (let d = 0; d < 8; d++) {
      const [dx, dz] = DIRS[d], D = steps[d], off = dz * nx + dx, step = dx > 0 ? -1 : 1;
      for (let jj = 1; jj < nz - 1; jj++) {
        const j = dz > 0 ? nz - 1 - jj : jj;
        for (let k = 1, c = j * nx + (dx > 0 ? nx - 2 : 1); k < nx - 1; k++, c += step) { const n = c + off; D[c] = wall[n] ? 1 : D[n] ? D[n] + 1 : 0; }
      }
    }
    const inside = new Uint8Array(N), clear = new Float32Array(N);
    const [D0, D1, D2, D3, D4, D5, D6, D7] = steps;
    for (let c = 0; c < N; c++) {
      if (!(top[c] > y + .05)) continue;
      const hits = (D0[c] ? 1 : 0) + (D1[c] ? 1 : 0) + (D2[c] ? 1 : 0) + (D3[c] ? 1 : 0) + (D4[c] ? 1 : 0) + (D5[c] ? 1 : 0) + (D6[c] ? 1 : 0) + (D7[c] ? 1 : 0);
      if (hits < 7) continue;
      inside[c] = hits === 8 ? 2 : 1; let near = Infinity;
      for (let d = 0; d < 8; d++) { const k = steps[d][c]; if (k) { const m = k * R * (d > 3 ? Math.SQRT2 : 1); if (m < near) near = m; } }
      clear[c] = near;
    }
    return { y, wall, inside, clear };
  }
  const levels = levelYs.map(y => level(y));
  lap('levels');

  // 6. A: dark inner faces. A side is inside when the first non-wall plan cell .45/.95/1.45 m away from the
  //    triangle on that side is inside at the nearest level.
  const nearest = new Uint8Array(Math.ceil((maxY - minY) / .1) + 32);   // nearest level per 10 cm of height
  for (let b = 0; b < nearest.length; b++) { const y = minY - 1.5 + b * .1; let k = 0; for (let l = 1; l < levels.length; l++) if (Math.abs(levels[l].y - y) < Math.abs(levels[k].y - y)) k = l; nearest[b] = k; }
  const insideAt = (x, y, z) => {
    const L = levels[nearest[Math.max(0, Math.min(nearest.length - 1, Math.round((y - minY + 1.5) / .1)))]];
    const i = Math.floor((x - ox) / R), j = Math.floor((z - oz) / R); if (i < 0 || j < 0 || i >= nx || j >= nz) return 0;
    // Stricter than a slab: all 8 rays hit and the probe point itself is covered from above.
    const c = j * nx + i; return L.wall[c] ? -1 : L.inside[c] === 2 && cover3[c] > y + .3 ? 1 : 0;
  };
  const probe = (cx, cy, cz, qx, qy, qz) => {
    let r = insideAt(cx + qx * .45, cy + qy * .45, cz + qz * .45); if (r >= 0) return r;
    r = insideAt(cx + qx * .95, cy + qy * .95, cz + qz * .95); if (r >= 0) return r;
    r = insideAt(cx + qx * 1.45, cy + qy * 1.45, cz + qz * 1.45); return r > 0 ? 1 : 0;
  };
  for (let t = 0; t < triCount; t++) {
    const sl = slot[t]; if (sl < 0) continue;
    const o = t * 9, ax = tris[o], ay = tris[o + 1], az = tris[o + 2];
    const ux = tris[o + 3] - ax, uy = tris[o + 4] - ay, uz = tris[o + 5] - az, wx = tris[o + 6] - ax, wy = tris[o + 7] - ay, wz = tris[o + 8] - az;
    let qx = uy * wz - uz * wy, qy = uz * wx - ux * wz, qz = ux * wy - uy * wx; const len = Math.hypot(qx, qy, qz); if (len < 1e-9) continue;
    qx /= len; qy /= len; qz /= len;
    const cx = (ax + tris[o + 3] + tris[o + 6]) / 3, cy = (ay + tris[o + 4] + tris[o + 7]) / 3, cz = (az + tris[o + 5] + tris[o + 8]) / 3;
    let side = probe(cx, cy, cz, -qx, -qy, -qz) | (probe(cx, cy, cz, qx, qy, qz) << 1);
    // A big triangle (> 1 m^2) can face the inside behind a bay and the open air above it: every corner region
    // (corner pulled 25% toward the centre) must agree, or that side keeps its own finish.
    if (side && len > 2) for (let v = 0; v < 3 && side; v++) {
      const px = tris[o + v * 3] * .75 + cx * .25, py = tris[o + v * 3 + 1] * .75 + cy * .25, pz = tris[o + v * 3 + 2] * .75 + cz * .25;
      if (side & 1 && !probe(px, py, pz, -qx, -qy, -qz)) side &= 2;
      if (side & 2 && !probe(px, py, pz, qx, qy, qz)) side &= 1;
    }
    if (side) { sidesList[Math.floor(sl / 4194304)][sl % 4194304] = side; stats.darkSides++; }
  }
  lap('classify');
  if (NO_FLOORS.has(id)) { stats.ms = performance.now() - started; return { stats, sides: sidesOut, geometry: null }; }

  // 7. B geometry (one double-sided material): slab planes cut at fragment-cell borders with a rim, columns,
  //    corridor partitions with door gaps and a few room walls.
  const P = [], Nn = [], U = [];
  const quad = (a, b, c, d, n) => {   // a..d in rotational order; wound so the face normal is n
    const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2], e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
    const dot = (e1y * e2z - e1z * e2y) * n[0] + (e1z * e2x - e1x * e2z) * n[1] + (e1x * e2y - e1y * e2x) * n[2];
    for (const p of dot >= 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c]) {
      P.push(p[0], p[1], p[2]); Nn.push(n[0], n[1], n[2]);
      U.push(Math.abs(n[1]) > .5 ? p[0] / 3 : (p[0] + p[2]) / 3, Math.abs(n[1]) > .5 ? p[2] / 3 : p[1] / 3);
    }
    stats.triangles += 2;
  };
  const masks = [], seen = new Uint8Array(N), stack = new Int32Array(N), comp = new Int32Array(N);
  // Ground-storey columns/partitions start .2 m up: some shells leave a sliver open between the base and the walls.
  const footLevel = level(foot.y, foot.below, foot.above), groundMask = { y: minY + .2, m: new Uint8Array(N), clear: new Float32Array(N) };
  for (let c = 0; c < N; c++) if (levels[0].inside[c] && footLevel.inside[c]) { groundMask.m[c] = 1; groundMask.clear[c] = Math.min(levels[0].clear[c], footLevel.clear[c]); }
  for (let k = 1; k < levels.length; k++) {
    // The storey below must be fully enclosed (all 8 rays hit): no slab over a passage, entrance recess or pilotis.
    const L = levels[k], under = levels[k - 1], y = L.y, m = new Uint8Array(N);
    for (let c = 0; c < N; c++) if (L.inside[c] && under.inside[c] === 2 && !L.wall[c] && L.clear[c] >= INSET && top[c] > y + HEADROOM) m[c] = 1;
    // Opening (erode then dilate, 4-neighbour): removes one-cell spurs/jaggies, never adds cells.
    const er = new Uint8Array(N);
    for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) { const c = j * nx + i; er[c] = m[c] & m[c - 1] & m[c + 1] & m[c - nx] & m[c + nx]; }
    for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) { const c = j * nx + i; m[c] = m[c] & (er[c] | er[c - 1] | er[c + 1] | er[c - nx] | er[c + nx]); }
    // Drop crumbs smaller than ~6 m^2 (a slab that small reads as debris, not a floor).
    seen.fill(0);
    for (let c = 0; c < N; c++) {
      if (!m[c] || seen[c]) continue;
      let sp = 0, size = 0; stack[sp++] = c; seen[c] = 1; comp[size++] = c;
      while (sp) { const q = stack[--sp];
        for (let e = 0; e < 4; e++) { const n = e === 0 ? q - 1 : e === 1 ? q + 1 : e === 2 ? q - nx : q + nx; if (m[n] && !seen[n]) { seen[n] = 1; comp[size++] = n; stack[sp++] = n; } } }
      if (size * R * R < 6) for (let k = 0; k < size; k++) m[comp[k]] = 0;
    }
    let cells = 0; for (let c = 0; c < N; c++) cells += m[c];
    if (!cells) continue;
    lap('mask' + masks.length);
    masks.push({ y, m, clear: L.clear });
    stats.levels.push(+y.toFixed(2)); stats.slabArea += cells * R * R;
    // Greedy rectangles inside each 6x6 block (= one fragment cell), so no quad is cut again by the clipper.
    const done = new Uint8Array(N);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const c = j * nx + i; if (!m[c] || done[c]) continue;
      const bi = Math.min(nx, Math.floor(i / 6) * 6 + 6), bj = Math.min(nz, Math.floor(j / 6) * 6 + 6);
      let w = 1; while (i + w < bi && m[c + w] && !done[c + w]) w++;
      let h = 1; grow: for (; j + h < bj; h++) { for (let k = 0; k < w; k++) { const q = (j + h) * nx + i + k; if (!m[q] || done[q]) break grow; } }
      for (let b = 0; b < h; b++) for (let k = 0; k < w; k++) done[(j + b) * nx + i + k] = 1;
      quad([X(i) + EDGE, y, Z(j) + EDGE], [X(i + w) - EDGE, y, Z(j) + EDGE], [X(i + w) - EDGE, y, Z(j + h) - EDGE], [X(i) + EDGE, y, Z(j + h) - EDGE], [0, 1, 0]);
      stats.slabs++;
    }
    // Rim (slab edge) along the mask boundary, merged into runs within one fragment cell.
    for (let j = 1; j < nz; j++) for (const s of [1, -1]) {
      let run = -1;
      for (let i = 0; i <= nx; i++) {
        const edge = i < nx && (s > 0 ? m[(j - 1) * nx + i] && !m[j * nx + i] : m[j * nx + i] && !m[(j - 1) * nx + i]);
        if (run >= 0 && (!edge || i % 6 === 0)) { quad([X(run) + EDGE, y - SLAB_T, Z(j)], [X(i) - EDGE, y - SLAB_T, Z(j)], [X(i) - EDGE, y, Z(j)], [X(run) + EDGE, y, Z(j)], [0, 0, s]); run = -1; }
        if (edge && run < 0) run = i;
      }
    }
    for (let i = 1; i < nx; i++) for (const s of [1, -1]) {
      let run = -1;
      for (let j = 0; j <= nz; j++) {
        const edge = j < nz && (s > 0 ? m[j * nx + i - 1] && !m[j * nx + i] : m[j * nx + i] && !m[j * nx + i - 1]);
        if (run >= 0 && (!edge || j % 6 === 0)) { quad([X(i), y - SLAB_T, Z(run) + EDGE], [X(i), y - SLAB_T, Z(j) - EDGE], [X(i), y, Z(j) - EDGE], [X(i), y, Z(run) + EDGE], [s, 0, 0]); run = -1; }
        if (edge && run < 0) run = j;
      }
    }
  }
  lap('slabs');
  // Is a plan rectangle wholly on cells of `mask` at least `clearance` from the walls?
  const solid = (mask, x0, z0, x1, z1, clearance) => {
    const i0 = cellX(x0), i1 = cellX(x1 - 1e-6), j0 = cellZ(z0), j1 = cellZ(z1 - 1e-6);
    if (i0 < 0 || j0 < 0 || i1 >= nx || j1 >= nz) return false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const c = j * nx + i; if (!mask.m[c] || mask.clear[c] < clearance) return false; }
    return true;
  };
  const cxm = (minX + maxX) / 2, czm = (minZ + maxZ) / 2, long = maxX - minX >= maxZ - minZ;
  const plane = (a0, a1, b, y0, y1) => {   // partition: one double-sided plane along the long axis at cross coordinate b
    if (long) quad([a0, y0, b], [a1, y0, b], [a1, y1, b], [a0, y1, b], [0, 0, 1]); else quad([b, y0, a0], [b, y0, a1], [b, y1, a1], [b, y1, a0], [1, 0, 0]);
    stats.partitions++;
  };
  const cross = (a, b0, b1, y0, y1) => {   // room wall: plane across the long axis at a
    if (long) quad([a, y0, b0], [a, y0, b1], [a, y1, b1], [a, y1, b0], [1, 0, 0]); else quad([b0, y0, a], [b1, y0, a], [b1, y1, a], [b0, y1, a], [0, 0, 1]);
    stats.partitions++;
  };
  for (let k = 0; k < masks.length; k++) {
    const upper = masks[k], lower = k > 0 ? masks[k - 1] : groundMask;
    const floorY = lower.y, ceilY = upper.y - SLAB_T;
    if (upper.y - lower.y > 2.2 * STOREY || ceilY - floorY < 2) continue;   // a gap the slabs do not describe
    const both = (x0, z0, x1, z1, clearance) => solid(upper, x0, z0, x1, z1, clearance) && solid(lower, x0, z0, x1, z1, clearance);
    for (let kx = Math.floor(minX / CELL); kx * CELL < maxX; kx++) {
      if (((kx % (long ? 3 : 2)) + 3) % (long ? 3 : 2)) continue;
      for (let kz = Math.floor(minZ / CELL); kz * CELL < maxZ; kz++) {
        if (((kz % (long ? 2 : 3)) + 3) % (long ? 2 : 3)) continue;
        const gx = (kx + .5) * CELL, gz = (kz + .5) * CELL, h = COLUMN / 2;
        if (!both(gx - h, gz - h, gx + h, gz + h, COLUMN_CLEAR)) continue;
        quad([gx - h, floorY, gz - h], [gx + h, floorY, gz - h], [gx + h, ceilY, gz - h], [gx - h, ceilY, gz - h], [0, 0, -1]);
        quad([gx - h, floorY, gz + h], [gx + h, floorY, gz + h], [gx + h, ceilY, gz + h], [gx - h, ceilY, gz + h], [0, 0, 1]);
        quad([gx - h, floorY, gz - h], [gx - h, floorY, gz + h], [gx - h, ceilY, gz + h], [gx - h, ceilY, gz - h], [-1, 0, 0]);
        quad([gx + h, floorY, gz - h], [gx + h, floorY, gz + h], [gx + h, ceilY, gz + h], [gx + h, ceilY, gz - h], [1, 0, 0]);
        stats.columns++;
      }
    }
    // Corridor: two partitions along the long axis about the slab's centre line; room walls off them.
    let sum = 0, n = 0;
    for (let c = 0; c < N; c++) if (upper.m[c]) { const i = c % nx, j = (c - i) / nx; sum += long ? Z(j + .5) : X(i + .5); n++; }
    const mid = sum / n, span = long ? [minX, maxX] : [minZ, maxZ];
    const fits = (a0, a1, b0, b1) => long ? both(a0, b0, a1, b1, .6) : both(b0, a0, b1, a1, .6);
    for (const side of [-1, 1]) {
      const b = mid + side * CORRIDOR;
      for (let ka = Math.floor(span[0] / CELL); ka * CELL < span[1]; ka++) {
        const a0 = ka * CELL + EDGE, a1 = (ka + 1) * CELL - (ka % 2 ? DOOR : EDGE);
        if (!fits(a0, a1, b - R / 2, b + R / 2)) continue;
        plane(a0, a1, b, floorY, ceilY);
        if (((ka % 3) + 3) % 3) continue;
        let reach = 0; while (fits(a0, a0 + R, side > 0 ? b + reach : b - reach - R, side > 0 ? b + reach + R : b - reach)) reach += R;
        if (reach >= 2) cross(a0, side > 0 ? b : b - reach, side > 0 ? b + reach : b, floorY, ceilY);
      }
    }
  }
  lap('geometry');
  stats.ms = performance.now() - started;
  if (!P.length) return { stats, sides: sidesOut, geometry: null };
  return { stats, sides: sidesOut, geometry: { position: new Float32Array(P), normal: new Float32Array(Nn), uv: new Float32Array(U) } };
}
