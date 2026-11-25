// Approved GLB surfaces, clipped into spatial fragments without replacing geometry.
// Source geometry/material/textures remain cache-owned and are never disposed here.
// Laser cut look A+C (user approved 10-23 after comparison): on by default; ?laser=old shows the previous look for comparison.
export const LASER_NEW = new URLSearchParams(globalThis.location?.search || '').get('laser') !== 'old';
const GLOBAL_FLYING = new Map();
const GLOBAL_DEBRIS_LIMIT = 320;
// Optional observer for first ground contacts (only the ?feel preview sets it; null otherwise).
let groundContactListener = null;
export function setDebrisGroundListener(fn) { groundContactListener = typeof fn === 'function' ? fn : null; }
// Optional ?feel collapse: after a hit, fragments no longer connected to the ground shake, then fall or sink.
// null (the default) leaves hit() exactly as before. mode: { shake, fly, count, onCollapse }.
let collapseMode = null;
export function setDebrisCollapse(mode) { collapseMode = mode && typeof mode === 'object' ? mode : null; }
// Optional ?feel&physics driver (src/feel-physics.js): weak-support rules + cluster rigid bodies. Only used while
// collapseMode is also set; null (the default) leaves the collapse above exactly as it was.
let physicsDriver = null;
export function setDebrisPhysics(driver) { physicsDriver = driver && typeof driver === 'object' ? driver : null; }
const EPS = 1e-8;
// Cell keys: an injective integer for ordinary ranges, else the former string.
const KEY_OFFSET = 65536, KEY_RANGE = 131072;
function cellKey(x, y, z) {
  const kx = x + KEY_OFFSET, ky = y + KEY_OFFSET, kz = z + KEY_OFFSET;
  if (kx >= 0 && kx < KEY_RANGE && ky >= 0 && ky < KEY_RANGE && kz >= 0 && kz < KEY_RANGE) return (kx * KEY_RANGE + ky) * KEY_RANGE + kz;
  return [x, y, z].join(',');
}

// interiorSide (?interior only): the geometry carries modelInteriorSide per triangle (1 back side, 2 front side,
// 3 both face the building's inside, from src/interior-fill.js); those sides are painted dark concrete.
function shaderPatch(material, texture, width, sourceHook, sourceKey, interiorSide = false, laser = null) {
  const originalKey = sourceKey ?? material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    if (sourceHook) sourceHook.call(material, shader, renderer);
    shader.uniforms.modelChunkTexture = { value: texture };
    shader.uniforms.modelChunkTextureSize = { value: width };
    const hasImpactColor = shader.fragmentShader?.includes('#include <emissivemap_fragment>');
    if (hasImpactColor && laser) {
      Object.assign(shader.uniforms, laser);
      shader.vertexShader = 'attribute float modelLaserDistance; varying float vModelLaserDistance;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(/void\s+main\s*\(\s*\)\s*\{/, 'void main() { vModelLaserDistance = modelLaserDistance;');
    }
    const declarations = (hasImpactColor ? 'varying float modelImpactPulse;\n' : '') + `
uniform sampler2D modelChunkTexture;
uniform float modelChunkTextureSize;
attribute float modelChunkId;
vec4 modelChunkRead(float offset) {
  float i = modelChunkId * 3.0 + offset;
  return texture2D(modelChunkTexture, (vec2(mod(i, modelChunkTextureSize), floor(i / modelChunkTextureSize)) + 0.5) / modelChunkTextureSize);
}
vec3 modelChunkRotate(vec3 v, vec4 q) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
`;
    shader.vertexShader = declarations + (interiorSide ? 'attribute float modelInteriorSide;\nvarying float vModelInteriorSide;\n' : '') + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(/void\s+main\s*\(\s*\)\s*\{/, `void main() {${interiorSide ? '\n      vModelInteriorSide = modelInteriorSide;' : ''}
      vec4 chunkPositionScale = modelChunkRead(0.0);
      vec4 chunkQuaternion = modelChunkRead(1.0);
      // Held vortex pieces pack axial stretch into quaternion length; ordinary unit poses stay unchanged.
      float chunkStretch = max(1.0, length(chunkQuaternion));
      if (chunkStretch > 1.001) chunkQuaternion /= chunkStretch;
      vec3 chunkPivot = modelChunkRead(2.0).xyz;
      ${hasImpactColor ? 'modelImpactPulse = modelChunkRead(2.0).w;' : ''}`);
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      objectNormal.y /= chunkStretch;
      objectNormal = modelChunkRotate(objectNormal, chunkQuaternion);
      #ifdef USE_TANGENT
        objectTangent.y *= chunkStretch;
        objectTangent = modelChunkRotate(objectTangent, chunkQuaternion);
      #endif`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed -= chunkPivot; transformed.y *= chunkStretch;
      transformed = modelChunkRotate(transformed, chunkQuaternion) * chunkPositionScale.w + chunkPositionScale.xyz;`);
    if (hasImpactColor) {
      shader.fragmentShader = 'varying float modelImpactPulse;\n' + (laser ? `
varying float vModelLaserDistance;
uniform vec4 laserBand; // melt width (m), char width (m), emission, char strength
uniform vec3 laserWhite, laserYellow, laserOrange, laserRed, laserChar;
` : '') + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // A negative pulse is the flamethrower char (0..1, see scorch()); it darkens the surface before lighting.
        // Ordinary pulses are >= 0, so the warm hit glow is exactly as before. 2 + h (h 0..1) is a laser cut face (slice()
        // heat): darkened and glowing red-hot, through orange to a dull red as h falls.
        if (modelImpactPulse < 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.045, 0.036, 0.03), clamp(-modelImpactPulse, 0.0, 1.0) * 0.93);
        else if (modelImpactPulse > 1.99) {
          float modelHeat = clamp(modelImpactPulse - 2.0, 0.0, 1.0);
          ${laser ? `if (vModelLaserDistance >= 0.0) {
            // Distance to the exposed kerf boundary, in metres, attached to the REST surface.
            // Interpolation is exact on planar cell edges; the strip moves/rotates with held fragments.
            float d = vModelLaserDistance;
            float gradient = fwidth(d), aa = max(gradient, 0.002);
            // A pre-existing pane/floor coplanar with the kerf is NOT a newly exposed cut surface. Its distance is
            // constant over the triangle; exclude it rather than flooding that whole pane with molten colour.
            float crossing = smoothstep(0.00001, 0.0001, gradient);
            float band = (1.0 - smoothstep(laserBand.x - aa, laserBand.x + aa, d)) * crossing;
            float charMask = (1.0 - smoothstep(laserBand.x + laserBand.y - aa, laserBand.x + laserBand.y + aa, d)) * crossing;
            float temp = modelHeat * (1.0 - smoothstep(0.0, laserBand.x, d));
            vec3 hot = temp < 0.33 ? mix(laserRed, laserOrange, temp / 0.33) : temp < 0.72 ? mix(laserOrange, laserYellow, (temp - 0.33) / 0.39) : mix(laserYellow, laserWhite, (temp - 0.72) / 0.28);
            diffuseColor.rgb = mix(diffuseColor.rgb, laserChar, charMask * laserBand.w);
            totalEmissiveRadiance += hot * laserBand.z * modelHeat * band;
          } else {` : ''}
          vec3 modelHot = modelHeat < 0.5 ? mix(vec3(0.22, 0.015, 0.0), vec3(0.8, 0.09, 0.01), modelHeat * 2.0) : mix(vec3(0.8, 0.09, 0.01), vec3(1.0, 0.36, 0.08), modelHeat * 2.0 - 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.035, 0.03), 0.6 + 0.3 * modelHeat);
          totalEmissiveRadiance += modelHot * (0.45 + 0.75 * modelHeat);
          ${laser ? '}' : ''}
        }
        else totalEmissiveRadiance += vec3(0.72, 0.45, 0.18) * modelImpactPulse;`);
    }
    if (interiorSide && shader.fragmentShader.includes('#include <color_fragment>')) {
      shader.fragmentShader = 'varying float vModelInteriorSide;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float modelSide = vModelInteriorSide;
        bool modelInner = modelSide > 2.5 || (gl_FrontFacing ? modelSide > 1.5 : (modelSide > .5 && modelSide < 1.5));
        if (modelInner) diffuseColor.rgb = vec3(.105, .1, .092);`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (modelInner) totalEmissiveRadiance = vec3(0.0);`);
    }
  };
  material.customProgramCacheKey = () => (laser ? 'laser-band-v1:' : '')+(interiorSide ? 'approved-model-fragments-v2i:' : 'approved-model-fragments-v2:')+originalKey;
  material.needsUpdate = true;
}

// ---- Fragment preparation in three steps (2026-10-18 load optimisation; output bit-for-bit the former single pass) ----
// 1. describeFragmentSource (main thread, THREE): the visible source meshes as plain records (attribute arrays + layout,
//    index, draw range, groups, world/normal matrix, material slots) and a material table.
// 2. computeFragmentData (pure JS, main thread or a Web Worker): the clipping, fragment cells, vertex sharing and per-piece
//    face lists, as typed arrays. Every arithmetic expression and its order is the former code's.
// 3. createModelDestructible(..., { prepared }) (main thread, THREE): pieces, geometry, materials, meshes from that data.
// Without `prepared` createModelDestructible runs 1-3 itself, so every existing caller is unchanged.
const ATTRIBUTE_NAMES = ['position', 'normal', 'uv', 'uv1', 'color', 'tangent'];
function attributeRecord(a) {
  if (!a) return null;
  const interleaved = !!a.isInterleavedBufferAttribute;
  return { array: interleaved ? a.data.array : a.array, itemSize: a.itemSize, stride: interleaved ? a.data.stride : a.itemSize,
    offset: interleaved ? a.offset : 0, normalized: !!a.normalized, count: a.count };
}
export function describeFragmentSource(THREE, id, source, { interior = false, strict = true } = {}) {
  if (!source?.isObject3D) throw new TypeError('An approved GLTF Object3D scene is required');
  source.updateWorldMatrix(true, true);
  const records = [], meshes = [], materialObjects = [], slots = new Map(), normalMatrix = new THREE.Matrix3();
  const slot = material => { if (!material) return -1; let i = slots.get(material); if (i === undefined) { i = materialObjects.length; slots.set(material, i); materialObjects.push(material); } return i; };
  source.traverseVisible(mesh => {
    if (!mesh.isMesh) return;
    if (strict && (mesh.isSkinnedMesh || mesh.morphTargetInfluences?.some(v => v !== 0))) throw new Error(`Animated source geometry is unsupported: ${id}`);
    const geo = mesh.geometry, pos = geo?.getAttribute('position'); if (!pos) return;
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    const multi = Array.isArray(mesh.material), record = { multi };
    for (const name of ATTRIBUTE_NAMES) record[name] = attributeRecord(geo.attributes[name]);
    record.index = geo.index ? { array: geo.index.array, count: geo.index.count } : null;
    record.drawStart = geo.drawRange.start; record.drawCount = geo.drawRange.count;
    record.groups = multi ? geo.groups.map(g => ({ start: g.start, count: g.count, materialIndex: g.materialIndex })) : null;
    if (multi) record.materials = mesh.material.map(slot); else record.material = slot(mesh.material);
    record.matrix = Float64Array.from(mesh.matrixWorld.elements); record.normalMatrix = Float64Array.from(normalMatrix.elements);
    record.flip = mesh.matrixWorld.determinant() < 0;
    record.sides = interior && mesh.userData.interiorSides ? mesh.userData.interiorSides : null;
    records.push(record); meshes.push(mesh);
  });
  const materials = materialObjects.map(m => ({ visible: m.visible, name: m.name || '', transparent: !!m.transparent, opacity: m.opacity, interiorWeight: m.userData?.interiorWeight }));
  // materialObjects / meshes stay on the main thread (stripped before a job goes to a worker).
  return { id, interior: !!interior, records, materials, materialObjects, meshes };
}
export function fragmentCellSize(options = {}) { return Number.isFinite(options.chunkSize) ? Math.max(.5, Math.min(12, options.chunkSize)) : 3.2; }
// BufferAttribute / InterleavedBufferAttribute getX..getW of Three r170 (denormalize included), over an attribute record.
function componentReader(a, c) {
  const array = a.array, stride = a.stride, offset = a.offset + c;
  if (!a.normalized) return i => array[i * stride + offset];
  let scale;
  switch (array.constructor) {
    case Float32Array: return i => array[i * stride + offset];
    case Uint32Array: scale = v => v / 4294967295.0; break;
    case Uint16Array: scale = v => v / 65535.0; break;
    case Uint8Array: scale = v => v / 255.0; break;
    case Int32Array: scale = v => Math.max(v / 2147483647.0, - 1.0); break;
    case Int16Array: scale = v => Math.max(v / 32767.0, - 1.0); break;
    case Int8Array: scale = v => Math.max(v / 127.0, - 1.0); break;
    default: throw new Error('Invalid component type.');
  }
  return i => scale(array[i * stride + offset]);
}
/** Step 2: pure data in, typed arrays out (no THREE, no DOM; runs in src/workers/fragment-worker.js too). */
export function computeFragmentData({ id, interior = false, records, materials, cellSize = 3.2 }) {
  const pieces = [], cells = new Map(), batches = new Map(), work = new Map();
  let sourceTriangles = 0, outputTriangles = 0;

  // Clipping works on flat buffers. A vertex is S doubles in `pool` (position,
  // normal, uv, uv1, color rgba, tangent xyzw); a polygon is a run of pool slot
  // numbers in `polys`. Every arithmetic expression and its order is identical to
  // the former array-of-arrays version, so output is bit-for-bit the same.
  // ?interior adds one slot (18: modelInteriorSide); without it every buffer and output is unchanged.
  const S = interior ? 19 : 18;
  let pool = new Float64Array(S * 256), poolSlots = 0;
  let polys = new Int32Array(1024), polyTop = 0;
  function reservePool(n) {
    const need = (poolSlots + n) * S; if (need <= pool.length) return;
    let length = pool.length * 2; while (length < need) length *= 2;
    const grown = new Float64Array(length); grown.set(pool.subarray(0, poolSlots * S)); pool = grown;
  }
  function reservePolys(n) {
    const need = polyTop + n; if (need <= polys.length) return;
    let length = polys.length * 2; while (length < need) length *= 2;
    const grown = new Int32Array(length); grown.set(polys.subarray(0, polyTop)); polys = grown;
  }
  // Former splitPolygon(): writes the kept polygon at polyTop (space reserved by caller).
  function splitInto(src, n, axis, plane, keepLower) {
    const P = pool, L = polys, dst = polyTop, sign = keepLower ? 1 : -1;
    let previous = L[src + n - 1], pv = (P[previous * S + axis] - plane) * sign, m = 0;
    for (let j = 0; j < n; j++) {
      const current = L[src + j], cv = (P[current * S + axis] - plane) * sign;
      if ((pv <= 0) !== (cv <= 0)) {
        const t = pv / (pv - cv), a = previous * S, c = current * S, o = (poolSlots++) * S;
        for (let i = 0; i < S; i++) P[o + i] = P[a + i] + t * (P[c + i] - P[a + i]);
        P[o + axis] = plane; L[dst + m++] = o / S;
      }
      if (cv <= 0) L[dst + m++] = current;
      previous = current; pv = cv;
    }
    return m;
  }
  // Former clipCells(): same axis choice, plane and lower-then-upper recursion.
  function clipCells(src, n, batch, w) {
    let axis = -1, span = 0, lowCell = 0, highCell = 0, c0 = 0, c1 = 0, c2 = 0;
    const P = pool, L = polys;
    for (let k = 0; k < 3; k++) {
      let lo = Infinity, hi = -Infinity;
      for (let j = 0; j < n; j++) { const x = P[L[src + j] * S + k]; lo = Math.min(lo, x); hi = Math.max(hi, x); }
      const low = Math.floor((lo + EPS) / cellSize);
      const high = Math.max(low, Math.floor((hi - EPS) / cellSize));
      if (k === 0) c0 = low; else if (k === 1) c1 = low; else c2 = low;
      if (high - low > span) { axis = k; span = high - low; lowCell = low; highCell = high; }
    }
    if (axis < 0) { addPolygon(batch, w, src, n, cellKey(c0, c1, c2)); return; }
    const plane = Math.floor((lowCell + highCell + 1) / 2) * cellSize;
    reservePool(2 * n); reservePolys(4 * n);
    const lower = polyTop, lowerCount = splitInto(src, n, axis, plane, true); polyTop += lowerCount;
    const upper = polyTop, upperCount = splitInto(src, n, axis, plane, false); polyTop += upperCount;
    if (lowerCount >= 3) clipCells(lower, lowerCount, batch, w);
    if (upperCount >= 3) clipCells(upper, upperCount, batch, w);
    polyTop = lower;
  }

  // Each original GLB material is already a shared material signature (one batch per material slot).
  function getBatch(materialSlot) {
    if (!batches.has(materialSlot)) {
      const batch = { material: materialSlot };
      if (interior) batch.areaScale = materials[materialSlot].interiorWeight ?? 1;
      batches.set(materialSlot, batch);
      work.set(batch, { data: new Float32Array(S * 3 * 256), vertexCount: 0, ids: new Int32Array(256), faces: 0 });
    }
    return batches.get(materialSlot);
  }
  function reserveFaces(w, faces) {
    if (w.faces + faces > w.ids.length) {
      let length = w.ids.length * 2; while (length < w.faces + faces) length *= 2;
      const ids = new Int32Array(length); ids.set(w.ids.subarray(0, w.faces)); w.ids = ids;
      const data = new Float32Array(length * 3 * S); data.set(w.data.subarray(0, w.vertexCount * S)); w.data = data;
    }
  }
  // A piece here is plain data; createModelDestructible turns it into the former piece object (same values).
  function addPolygon(batch, w, src, n, key) {
    reserveFaces(w, n - 2);
    const P = pool, L = polys, data = w.data, a = L[src] * S;
    let piece = null;
    for (let i = 1; i < n - 1; i++) {
      const b = L[src + i] * S, c = L[src + i + 1] * S;
      const ax = P[a], ay = P[a + 1], az = P[a + 2], bx = P[b], by = P[b + 1], bz = P[b + 2], cx = P[c], cy = P[c + 1], cz = P[c + 2];
      const abx = bx-ax, aby=by-ay, abz=bz-az, acx=cx-ax, acy=cy-ay, acz=cz-az;
      const area = .5 * Math.hypot(aby*acz-abz*acy, abz*acx-abx*acz, abx*acy-aby*acx);
      if (area < 1e-12) continue;
      if (!piece) piece = cells.get(key);
      if (!piece) {
        piece = { index: pieces.length, key, sx: (ax+bx+cx)/3, sy: (ay+by+cy)/3, sz: (az+bz+cz)/3,
          minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity, area: 0 };
        cells.set(key, piece); pieces.push(piece);
      }
      w.ids[w.faces++] = piece.index;
      const o = w.vertexCount * S; w.vertexCount += 3;
      for (let k = 0; k < S; k++) { data[o + k] = P[a + k]; data[o + S + k] = P[b + k]; data[o + 2 * S + k] = P[c + k]; }
      // Same min/max sequence as Box3.expandByPoint(a), (b), (c).
      piece.minX = Math.min(piece.minX, ax); piece.minY = Math.min(piece.minY, ay); piece.minZ = Math.min(piece.minZ, az);
      piece.maxX = Math.max(piece.maxX, ax); piece.maxY = Math.max(piece.maxY, ay); piece.maxZ = Math.max(piece.maxZ, az);
      piece.minX = Math.min(piece.minX, bx); piece.minY = Math.min(piece.minY, by); piece.minZ = Math.min(piece.minZ, bz);
      piece.maxX = Math.max(piece.maxX, bx); piece.maxY = Math.max(piece.maxY, by); piece.maxZ = Math.max(piece.maxZ, bz);
      piece.minX = Math.min(piece.minX, cx); piece.minY = Math.min(piece.minY, cy); piece.minZ = Math.min(piece.minZ, cz);
      piece.maxX = Math.max(piece.maxX, cx); piece.maxY = Math.max(piece.maxY, cy); piece.maxZ = Math.max(piece.maxZ, cz);
      piece.area += batch.areaScale ? area * batch.areaScale : area; outputTriangles++;
    }
  }
  for (const record of records) {
    const pos = record.position, idx = record.index, available = idx ? idx.count : pos.count;
    const first = Math.max(0, record.drawStart || 0), last = Math.min(available, first + record.drawCount);
    const flip = record.flip;
    // Former vertex(): Vector3 fromBufferAttribute/applyMatrix4/applyMatrix3/
    // normalize/transformDirection written out with Three r170's exact expressions,
    // computed once per source vertex index of this mesh.
    const m = record.matrix, nm = record.normalMatrix, tangentSign = flip ? -1 : 1;
    const normal = record.normal, uv = record.uv, uv1 = record.uv1, color = record.color, tangent = record.tangent, color4 = color?.itemSize === 4;
    const px = componentReader(pos, 0), py = componentReader(pos, 1), pz = componentReader(pos, 2);
    const nx = normal && componentReader(normal, 0), ny = normal && componentReader(normal, 1), nz = normal && componentReader(normal, 2);
    const ux = uv && componentReader(uv, 0), uy = uv && componentReader(uv, 1), vx = uv1 && componentReader(uv1, 0), vy = uv1 && componentReader(uv1, 1);
    const cr = color && componentReader(color, 0), cg = color && componentReader(color, 1), cb = color && componentReader(color, 2), ca = color4 && componentReader(color, 3);
    const tx = tangent && componentReader(tangent, 0), ty = tangent && componentReader(tangent, 1), tz = tangent && componentReader(tangent, 2), tw = tangent && componentReader(tangent, 3);
    const indexArray = idx?.array;
    const cache = new Float64Array(pos.count * S), cached = new Uint8Array(pos.count);
    function vertex(i, o) {
      const x = px(i), y = py(i), z = pz(i);
      const w = 1 / (m[3] * x + m[7] * y + m[11] * z + m[15]);
      cache[o] = (m[0] * x + m[4] * y + m[8] * z + m[12]) * w;
      cache[o + 1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) * w;
      cache[o + 2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) * w;
      let ax = normal ? nx(i) : 0, ay = normal ? ny(i) : 1, az = normal ? nz(i) : 0;
      let bx = nm[0] * ax + nm[3] * ay + nm[6] * az, by = nm[1] * ax + nm[4] * ay + nm[7] * az, bz = nm[2] * ax + nm[5] * ay + nm[8] * az;
      let scale = 1 / (Math.sqrt(bx * bx + by * by + bz * bz) || 1);
      cache[o + 3] = bx * scale; cache[o + 4] = by * scale; cache[o + 5] = bz * scale;
      cache[o + 6] = uv ? ux(i) : 0; cache[o + 7] = uv ? uy(i) : 0;
      cache[o + 8] = uv1 ? vx(i) : 0; cache[o + 9] = uv1 ? vy(i) : 0;
      cache[o + 10] = color ? cr(i) : 1; cache[o + 11] = color ? cg(i) : 1; cache[o + 12] = color ? cb(i) : 1;
      cache[o + 13] = color4 ? ca(i) : 1;
      ax = tangent ? tx(i) : 1; ay = tangent ? ty(i) : 0; az = tangent ? tz(i) : 0;
      bx = m[0] * ax + m[4] * ay + m[8] * az; by = m[1] * ax + m[5] * ay + m[9] * az; bz = m[2] * ax + m[6] * ay + m[10] * az;
      scale = 1 / (Math.sqrt(bx * bx + by * by + bz * bz) || 1);
      cache[o + 14] = bx * scale; cache[o + 15] = by * scale; cache[o + 16] = bz * scale;
      cache[o + 17] = (tangent ? tw(i) : 1) * tangentSign;
      for (let k = 0; k < S; k++) if (!Number.isFinite(cache[o + k])) throw new Error(`Non-finite GLB vertex: ${id}`);
    }
    function loadVertex(i, slot) {
      const from = i * S;
      if (!cached[i]) { vertex(i, from); cached[i] = 1; }
      const P = pool, to = slot * S;
      for (let k = 0; k < S; k++) P[to + k] = cache[from + k];
    }
    const groups = record.multi ? record.groups : [{start:first,count:last-first,materialIndex:0}];
    const interiorSides = S > 18 ? record.sides : null;
    for (const range of groups) {
      const materialSlot = record.multi ? record.materials[range.materialIndex] : record.material;
      const material = materialSlot >= 0 ? materials[materialSlot] : null;
      if (!material || material.visible === false) continue;
      const batch = getBatch(materialSlot), w = work.get(batch), lo = Math.max(first,range.start), hi = Math.min(last,range.start+range.count);
      batch.hasUV ||= !!uv; batch.hasUV1 ||= !!uv1; batch.hasColor ||= !!color; batch.hasTangent ||= !!tangent;
      if (hi > lo) reserveFaces(w, Math.ceil((hi - lo) / 3) * 3); // clipping yields about 3 output faces per source face
      for (let k=lo;k+2<hi;k+=3) {
        let i0=idx?indexArray[k]:k, i1=idx?indexArray[k+1]:k+1, i2=idx?indexArray[k+2]:k+2;
        if (flip) { const swap=i1; i1=i2; i2=swap; }
        poolSlots = 0; polyTop = 0; reservePool(3); reservePolys(3);
        loadVertex(i0,0); loadVertex(i1,1); loadVertex(i2,2);
        if (S > 18) { const side = interiorSides ? interiorSides[(k / 3) | 0] || 0 : 0; pool[18] = pool[S + 18] = pool[2 * S + 18] = side; }
        if (!normal) {
          // Former Vector3 set/sub/crossVectors/normalize (Three r170), written out.
          const P = pool;
          const abx = P[S] - P[0], aby = P[S+1] - P[1], abz = P[S+2] - P[2];
          const acx = P[2*S] - P[0], acy = P[2*S+1] - P[1], acz = P[2*S+2] - P[2];
          let qx = aby * acz - abz * acy, qy = abz * acx - abx * acz, qz = abx * acy - aby * acx;
          const inv = 1 / (Math.sqrt(qx * qx + qy * qy + qz * qz) || 1); qx *= inv; qy *= inv; qz *= inv;
          for(let s=0;s<3;s++){P[s*S+3]=qx;P[s*S+4]=qy;P[s*S+5]=qz;}
        }
        poolSlots = 3; polys[0] = 0; polys[1] = 1; polys[2] = 2; polyTop = 3;
        sourceTriangles++; clipCells(0, 3, batch, w);
      }
    }
  }
  // Pieces as flat arrays (cell key: a number, or the former string for out-of-range cells).
  const N = pieces.length, pieceBounds = new Float64Array(N * 6), pieceArea = new Float64Array(N), pieceSurface = new Float64Array(N * 3), pieceKeys = new Float64Array(N), stringKeys = [];
  for (const p of pieces) {
    const i = p.index;
    pieceBounds[i*6] = p.minX; pieceBounds[i*6+1] = p.minY; pieceBounds[i*6+2] = p.minZ; pieceBounds[i*6+3] = p.maxX; pieceBounds[i*6+4] = p.maxY; pieceBounds[i*6+5] = p.maxZ;
    pieceArea[i] = p.area; pieceSurface[i*3] = p.sx; pieceSurface[i*3+1] = p.sy; pieceSurface[i*3+2] = p.sz;
    if (typeof p.key === 'number') pieceKeys[i] = p.key; else { pieceKeys[i] = NaN; stringKeys.push([i, p.key]); }
  }
  const out = [], pieceSlot = new Int32Array(N);
  for (const batch of batches.values()) {
    const w=work.get(batch), count=w.vertexCount, faces=w.faces, ids=w.ids, bits=new Uint32Array(w.data.buffer,0,count*S);
    const layout=[['position',0,3],['normal',3,3],['uv',6,2],['uv1',8,2],['color',10,4],['tangent',14,4]].filter(([name])=>
      !((name==='uv'&&!batch.hasUV)||(name==='uv1'&&!batch.hasUV1)||(name==='color'&&!batch.hasColor)||(name==='tangent'&&!batch.hasTangent)));
    // Every batch of an ?interior build carries the attribute (0 = no inner side), so all share one program per
    // material variant instead of compiling a second set.
    if(S>18)layout.push(['modelInteriorSide',18,1]);
    const chunkIds=new Float32Array(count);for(let i=0;i<faces;i++){const v=ids[i];chunkIds[i*3]=v;chunkIds[i*3+1]=v;chunkIds[i*3+2]=v;}
    const chunkBits=new Uint32Array(chunkIds.buffer);
    // Exact Float32 bit identity, including chunk ID, normal and every UV/color.
    // Sharing indices changes no surface/attribute and substantially reduces the
    // repeated vertices produced by triangle clipping. Vertices are numbered in
    // first-occurrence order (open-addressing table; collisions are compared).
    const offsets=Int32Array.from(layout.flatMap(([,offset,size])=>Array.from({length:size},(_,k)=>offset+k))),W=offsets.length,hashWords=Math.min(W,6);
    let tableSize=1;while(tableSize<count*2)tableSize*=2;
    const mask=tableSize-1,table=new Int32Array(tableSize),representatives=new Int32Array(count),index=new Uint32Array(count);let unique=0;
    for(let i=0;i<count;i++){
      const base=i*S,chunk=chunkBits[i];let hash=Math.imul(2166136261^chunk,16777619);
      for(let k=0;k<hashWords;k++)hash=Math.imul(hash^bits[base+offsets[k]],16777619);
      hash^=hash>>>15;hash=Math.imul(hash,0x2c1b3c6d);hash^=hash>>>12;
      let slot=hash&mask;
      for(;;){
        const entry=table[slot];
        if(entry===0){table[slot]=unique+1;representatives[unique]=i;index[i]=unique;unique++;break;}
        const r=representatives[entry-1];
        if(chunkBits[r]===chunk){const rb=r*S;let equal=true;for(let k=0;k<W;k++)if(bits[rb+offsets[k]]!==bits[base+offsets[k]]){equal=false;break;}
          if(equal){index[i]=entry-1;break;}}
        slot=(slot+1)&mask;
      }
    }
    const attributes=[];
    for (const [name,offset,size] of layout) {
      const array=new Float32Array(unique*size),view=new Uint32Array(array.buffer);
      for(let r=0;r<unique;r++){const from=representatives[r]*S+offset,to=r*size;for(let k=0;k<size;k++)view[to+k]=bits[from+k];}
      attributes.push([name,array,size]);
    }
    const uniqueChunkIds=new Float32Array(unique),uniqueChunkBits=new Uint32Array(uniqueChunkIds.buffer);
    for(let r=0;r<unique;r++)uniqueChunkBits[r]=chunkBits[representatives[r]];
    // Per-piece face lists in first-appearance order, faces ascending (former refs Map), concatenated.
    pieceSlot.fill(-1);const order=[],counts=[];
    for(let f=0;f<faces;f++){const p=ids[f];let s=pieceSlot[p];if(s<0){s=pieceSlot[p]=order.length;order.push(p);counts.push(0);}counts[s]++;}
    const starts=new Int32Array(order.length+1);for(let s=0;s<order.length;s++)starts[s+1]=starts[s]+counts[s];
    const faceLists=new Uint32Array(faces),filled=new Int32Array(order.length);
    for(let f=0;f<faces;f++){const s=pieceSlot[ids[f]];faceLists[starts[s]+filled[s]++]=f;}
    out.push({ material: batch.material, ...(interior ? { areaScale: batch.areaScale } : {}), hasUV: batch.hasUV, hasUV1: batch.hasUV1, hasColor: batch.hasColor, hasTangent: batch.hasTangent,
      faces, ids: ids.slice(0, faces), attributes, chunkIds: uniqueChunkIds, index: unique <= 65535 ? new Uint16Array(index) : index,
      refOrder: Int32Array.from(order), refStarts: starts, faceLists });
    work.delete(batch);
  }
  return { id, interior, sourceTriangles, outputTriangles, pieces: N, pieceBounds, pieceArea, pieceSurface, pieceKeys, stringKeys, batches: out };
}
/** Buffers of computeFragmentData's result (for a zero-copy postMessage). */
export function fragmentDataBuffers(data) {
  const list = new Set([data.pieceBounds.buffer, data.pieceArea.buffer, data.pieceSurface.buffer, data.pieceKeys.buffer]);
  for (const b of data.batches) { list.add(b.ids.buffer); list.add(b.chunkIds.buffer); list.add(b.index.buffer); list.add(b.refOrder.buffer); list.add(b.refStarts.buffer); list.add(b.faceLists.buffer); for (const [, array] of b.attributes) list.add(array.buffer); }
  return [...list];
}
// Interior record appended after every shell mesh (fillInterior adds it as the root's last child): position/normal/uv, no index.
function interiorRecord(geometry, placement, materialSlot) {
  const flat = (array, itemSize) => ({ array, itemSize, stride: itemSize, offset: 0, normalized: false, count: array.length / itemSize });
  return { multi: false, position: flat(geometry.position, 3), normal: flat(geometry.normal, 3), uv: flat(geometry.uv, 2), uv1: null, color: null, tangent: null,
    index: null, drawStart: 0, drawCount: Infinity, groups: null, material: materialSlot, matrix: placement.matrix, normalMatrix: placement.normalMatrix, flip: placement.flip, sides: null };
}
/** A whole building's preparation from a describeFragmentSource job (+ job.interiorPlacement when interior):
 * interior classification and fill (src/interior-fill.js computeInteriorData), then the fragments. Pure; the worker runs it too. */
export function prepareFragmentJob(job, interiorModule = null) {
  let records = job.records, materials = job.materials, interiorStats = null, interiorMaterial = false;
  if (job.interior) {
    if (!interiorModule?.computeInteriorData) throw new Error('Interior fill module is required for an interior build');
    const fill = interiorModule.computeInteriorData(records, materials, { id: job.id });
    interiorStats = fill.stats;
    records = records.map((record, i) => fill.sides[i] ? { ...record, sides: fill.sides[i] } : record);
    if (fill.geometry) {
      materials = [...materials, interiorModule.interiorMaterialInfo(job.id)]; interiorMaterial = true;
      records.push(interiorRecord(fill.geometry, job.interiorPlacement, materials.length - 1));
    }
  }
  const data = computeFragmentData({ id: job.id, interior: job.interior, records, materials, cellSize: job.cellSize ?? 3.2 });
  data.interiorStats = interiorStats; data.interiorMaterial = interiorMaterial;
  return data;
}
/** Main-thread job for one building: the description plus (interior) where fillInterior would place its mesh. */
export function fragmentJob(THREE, id, source, { interior = false, chunkSize } = {}) {
  const job = describeFragmentSource(THREE, id, source, { interior });
  job.cellSize = fragmentCellSize({ chunkSize });
  if (interior) {
    // fillInterior: mesh.matrix = inverse(root.matrixWorld), then updateWorldMatrix: matrixWorld = root.matrixWorld x matrix.
    const inverse = new THREE.Matrix4().copy(source.matrixWorld).invert(), world = new THREE.Matrix4().multiplyMatrices(source.matrixWorld, inverse);
    job.interiorPlacement = { matrix: Float64Array.from(world.elements), normalMatrix: Float64Array.from(new THREE.Matrix3().getNormalMatrix(world).elements), flip: world.determinant() < 0 };
  }
  return job;
}

/** Synchronous, immutable-source adapter. Placement is entirely group transforms.
 * reset() reuses every generated buffer/material/texture. No WebGL context needed
 * for construction, ray queries, damage, simulation or the geometry tests.
 * options.prepared = { data: computeFragmentData/prepareFragmentJob result, materials: the job's materialObjects (+ the
 * interior material last when data.interiorMaterial) } skips steps 1-2; the result is identical.
 */
export function createModelDestructible(THREE, id, source, options = {}) {
  if (!source?.isObject3D) throw new TypeError('An approved GLTF Object3D scene is required');
  const cellSize = fragmentCellSize(options);
  const laserBands = options.laserBands ?? LASER_NEW;
  const debrisLimit = Number.isFinite(options.maxDebris) ? Math.max(0, Math.min(128, Math.floor(options.maxDebris))) : 48;
  let groundHeightAt = typeof options.groundHeightAt === 'function' ? options.groundHeightAt : () => 0;
  const start = performance.now();
  const group = new THREE.Group(); group.name = `${id}-approved-model`; group.userData.buildingId = id;
  group.userData.description = '승인한 Blender 모델의 실제 삼각형 표면을 사용하는 파괴 시안';
  let data, materialObjects;
  if (options.prepared) ({ data, materials: materialObjects } = options.prepared);
  else {
    const job = describeFragmentSource(THREE, id, source, { interior: options.interior });
    materialObjects = job.materialObjects; data = computeFragmentData({ ...job, cellSize });
  }
  const pieces = [], cells = new Map(), batches = new Map(), batchData = new Map();
  const sourceTriangles = data.sourceTriangles, outputTriangles = data.outputTriangles;
  const stringKeys = new Map(data.stringKeys);
  for (let i = 0; i < data.pieces; i++) {
    const piece = { index: pieces.length, active: true, hidden: false, position: new THREE.Vector3(), restPosition: new THREE.Vector3(),
      surfacePoint: new THREE.Vector3(data.pieceSurface[i*3], data.pieceSurface[i*3+1], data.pieceSurface[i*3+2]),
      bounds: new THREE.Box3(), scale: new THREE.Vector3(), quaternion: new THREE.Quaternion(), velocity: new THREE.Vector3(),
      spin: new THREE.Vector3(), age: 0, lifetime: 0, impactPulse: 0, pulseAge: 0, pulseStrength: 0, area: 0, weight: 0, references: [] };
    const b = data.pieceBounds, o = i * 6;
    piece.bounds.min.set(b[o], b[o+1], b[o+2]); piece.bounds.max.set(b[o+3], b[o+4], b[o+5]); piece.area = data.pieceArea[i];
    cells.set(stringKeys.has(i) ? stringKeys.get(i) : data.pieceKeys[i], piece); pieces.push(piece);
  }
  // Batch objects keep the former key order (sourceMaterial, vertices, ids, refs, [areaScale], hasUV, hasUV1, hasColor, hasTangent, ...).
  for (const d of data.batches) {
    const batch = { sourceMaterial: materialObjects[d.material], vertices: null, ids: null, refs: null };
    if (data.interior) batch.areaScale = d.areaScale;
    batch.hasUV = d.hasUV; batch.hasUV1 = d.hasUV1; batch.hasColor = d.hasColor; batch.hasTangent = d.hasTangent;
    batches.set(batch.sourceMaterial, batch); batchData.set(batch, d);
  }
  const S = data.interior ? 19 : 18;
  if (!pieces.length) throw new Error(`No triangle surfaces in approved model: ${id}`);
  const bounds = new THREE.Box3();
  for (const piece of pieces) {
    piece.bounds.getCenter(piece.position);piece.restPosition.copy(piece.position);piece.bounds.getSize(piece.scale);
    piece.weight=Math.max(.001,Math.min(12,piece.area*.35));bounds.union(piece.bounds);
  }
  const textureWidth=2**Math.ceil(Math.log2(Math.ceil(Math.sqrt(pieces.length*3))));
  const transforms=new Float32Array(textureWidth*textureWidth*4);
  const texture=new THREE.DataTexture(transforms,textureWidth,textureWidth,THREE.RGBAFormat,THREE.FloatType);
  texture.name=`${id}-fragment-transforms`;texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.flipY=false;
  function write(piece,scale=1,stretch=1) {
    const i=piece.index*12;transforms.set([piece.position.x,piece.position.y,piece.position.z,scale,piece.quaternion.x*stretch,piece.quaternion.y*stretch,piece.quaternion.z*stretch,piece.quaternion.w*stretch,piece.restPosition.x,piece.restPosition.y,piece.restPosition.z,piece.impactPulse],i);
  }
  pieces.forEach(p=>write(p));texture.needsUpdate=true;
  // Shared uniforms are ready before warmup; changing a laser style never recompiles a building shader.
  const laserUniforms={laserBand:{value:new THREE.Vector4()},laserWhite:{value:new THREE.Color()},laserYellow:{value:new THREE.Color()},
    laserOrange:{value:new THREE.Color()},laserRed:{value:new THREE.Color()},laserChar:{value:new THREE.Color()}};
  const meshes=[], ownedMaterials=[];
  for (const batch of batches.values()) {
    const d=batchData.get(batch), faces=d.faces, ids=d.ids;
    const geometry=new THREE.BufferGeometry();
    for (const [name,array,size] of d.attributes) geometry.setAttribute(name,new THREE.BufferAttribute(array,size));
    geometry.setAttribute('modelChunkId',new THREE.BufferAttribute(d.chunkIds,1));
    if(laserBands)geometry.setAttribute('modelLaserDistance',new THREE.BufferAttribute(new Float32Array(d.chunkIds.length).fill(-1),1).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(new THREE.BufferAttribute(d.index, 1));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const material=batch.sourceMaterial.clone();material.name=`${id}-fragment-${batch.sourceMaterial.name}`;
    shaderPatch(material,texture,textureWidth,batch.sourceMaterial.onBeforeCompile,batch.sourceMaterial.customProgramCacheKey(),S>18,laserBands?laserUniforms:null);
    const shadowParams={map:material.map,alphaMap:material.alphaMap,alphaTest:material.alphaTest,side:material.side};
    const depth=new THREE.MeshDepthMaterial({...shadowParams,depthPacking:THREE.RGBADepthPacking});
    const distance=new THREE.MeshDistanceMaterial(shadowParams);shaderPatch(depth,texture,textureWidth);shaderPatch(distance,texture,textureWidth);
    ownedMaterials.push(material,depth,distance);
    const lookup=new Array(faces);for(let i=0;i<faces;i++)lookup[i]=pieces[ids[i]];
    const mesh=new THREE.Mesh(geometry,material);mesh.name=`${id}-surface-${meshes.length}`;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=true;
    mesh.customDepthMaterial=depth;mesh.customDistanceMaterial=distance;mesh.userData.pieceLookup=lookup;
    batch.mesh=mesh;batch.position=geometry.getAttribute('position');batch.index=geometry.index;batch.references=[];
    // Per-piece face lists in first-appearance order, faces ascending (former refs Map).
    const order=d.refOrder,starts=d.refStarts;
    for(let s=0;s<order.length;s++){const piece=pieces[order[s]],ref={batch,faces:d.faceLists.subarray(starts[s],starts[s+1])};piece.references.push(ref);batch.references.push({piece,ref});}
    batch.vertices=null;batch.ids=null;batch.refs=null;
    group.add(mesh);meshes.push(mesh);
  }
  let disposed=false,destroyedWeight=0,destroyedCount=0;
  const totalWeight=pieces.reduce((n,p)=>n+p.weight,0),flying=new Set(),pulsing=new Set(),collapsing=new Map(),held=new Set();
  // Laser cut faces (slice heat): fragments next to the cut glow through the warm impact pulse, cool, and keep a char tint.
  const heated=new Map(),laserJobs=[];let heatClock=0;
  function* narrowCut(warm,kerf,heat,job){
    const T=heat.narrow,metres=group.matrixWorld.getMaxScaleOnAxis()/heat.units;
    laserUniforms.laserBand.value.set(T.meltWidth,T.charWidth,T.meltEmission,T.charStrength);
    for(const key of ['White','Yellow','Orange','Red','Char'])laserUniforms['laser'+key].value.fromArray(T['melt'+key]);
    // The old classifier removes a whole cell. Measuring against the drawn centre plane would put the entire .35 m
    // strip in empty air. Use the ACTUAL removed-cell faces instead: distance to their planes, sampled on retained
    // vertices. No extra mesh/draw call. Bake once in small frame-budgeted batches, then only decay heat at 20 Hz.
    const p=new THREE.Vector3(),near=[],normal=(heat.normal||new THREE.Vector3(0,1,0)).clone().transformDirection(inverse);
    const axis=Math.abs(normal.x)>Math.abs(normal.y)?(Math.abs(normal.x)>Math.abs(normal.z)?'x':'z'):(Math.abs(normal.y)>Math.abs(normal.z)?'y':'z');
    const cross=['x','y','z'].filter(a=>a!==axis);
    let work=0;
    for(const[piece]of warm){
      if(!piece.active&&!held.has(piece))continue;
      near.length=0;
      for(const k of kerf){const a=piece.bounds,b=k.piece.bounds;
        if(++work%64===0)yield;
        const dx=Math.max(0,a.min.x-b.max.x,b.min.x-a.max.x),dy=Math.max(0,a.min.y-b.max.y,b.min.y-a.max.y),dz=Math.max(0,a.min.z-b.max.z,b.min.z-a.max.z);
        if(Math.hypot(dx,dy,dz)*metres>T.meltWidth+T.charWidth)continue;
        // Only the boundary facing the cut direction is hot. A side wall lying on another voxel face must NOT
        // get distance zero over its whole triangle (the same painted-box defect in a different direction).
        const plane=a.min[axis]>=b.max[axis]-1e-5?b.max[axis]:a.max[axis]<=b.min[axis]+1e-5?b.min[axis]:null;
        if(plane!==null)near.push({box:b,plane});
      }
      if(!near.length)continue;
      for(const ref of piece.references){const geo=ref.batch.mesh.geometry,attr=geo.attributes.modelLaserDistance,idx=geo.index,pos=geo.attributes.position,norm=geo.attributes.normal,seen=new Set();
        for(const face of ref.faces)for(let c=0;c<3;c++){const i=idx.getX(face*3+c);if(seen.has(i))continue;seen.add(i);p.fromBufferAttribute(pos,i);
          if(++work%64===0)yield;
          let d=Infinity;for(const {box,plane} of near){const u=cross[0],v=cross[1];
            d=Math.min(d,Math.hypot(p[axis]-plane,Math.max(0,box.min[u]-p[u],p[u]-box.max[u]),Math.max(0,box.min[v]-p[v],p[v]-box.max[v]))*metres);}
          // Old panes parallel to the cut plane can be less than .35 m away over their entire face. They were not
          // sliced across: keep their material. On crossing surfaces measure along the surface, avoiding a broad
          // orange patch at a grazing angle. Original normals are in the same rest frame as the kerf planes.
          const alignment=norm?Math.abs(axis==='x'?norm.getX(i):axis==='y'?norm.getY(i):norm.getZ(i)):0;
          d=alignment>.98?T.meltWidth+T.charWidth+1:d/Math.sqrt(Math.max(.0001,1-alignment*alignment));
          attr.setX(i,attr.getX(i)<0?d:Math.min(d,attr.getX(i)));
        }attr.needsUpdate=true;
      }
      // Fragments can land, be hit or be rebuilt while a job is queued. Never revive their old heat.
      if(piece.hidden||!piece.active&&!held.has(piece))continue;
      piece.laserNarrow=true;
      pulsing.delete(piece);
      const peak=T.meltPeak,tau=heat.tau??3;
      heated.set(piece,{age:job.age,peak,tau,char:heat.char??.35,narrow:true});
      piece.impactPulse=2+peak*Math.exp(-job.age/tau);write(piece);
    }
  }
  const inverse=new THREE.Matrix4(),linear=new THREE.Matrix3(),inverseLinear=new THREE.Matrix3();
  const localRay=new THREE.Ray(),rayPoint=new THREE.Vector3(),worldPoint=new THREE.Vector3(),scorchPoint=new THREE.Vector3(),scorchCandidates=[];
  const triangle=new THREE.Triangle(),closest=new THREE.Vector3(),worldBox=new THREE.Box3();
  const velocityWorld=new THREE.Vector3(),gravity=new THREE.Vector3(),spinEuler=new THREE.Euler(),spinStep=new THREE.Quaternion();
  function matrices(){group.updateWorldMatrix(true,false);inverse.copy(group.matrixWorld).invert();linear.setFromMatrix4(group.matrixWorld);inverseLinear.setFromMatrix4(inverse);}
  function readTriangle(ref,face,world=false){
    const a=ref.batch.position,idx=ref.batch.index;triangle.a.fromBufferAttribute(a,idx.getX(face*3));triangle.b.fromBufferAttribute(a,idx.getX(face*3+1));triangle.c.fromBufferAttribute(a,idx.getX(face*3+2));
    if(world){triangle.a.applyMatrix4(group.matrixWorld);triangle.b.applyMatrix4(group.matrixWorld);triangle.c.applyMatrix4(group.matrixWorld);}return triangle;
  }
  for(const batch of batches.values())batch.mesh.raycast=(raycaster,intersections)=>{
    if(disposed)return;matrices();localRay.copy(raycaster.ray).applyMatrix4(inverse);
    if(!localRay.intersectsBox(bounds))return;
    for(const{piece,ref}of batch.references){
      if(!piece.active||!localRay.intersectsBox(piece.bounds))continue;
      for(const face of ref.faces){
        const t=readTriangle(ref,face),side=batch.mesh.material.side;
        const hit=side===THREE.BackSide?localRay.intersectTriangle(t.c,t.b,t.a,true,rayPoint):localRay.intersectTriangle(t.a,t.b,t.c,side!==THREE.DoubleSide,rayPoint);
        if(!hit)continue;worldPoint.copy(hit).applyMatrix4(group.matrixWorld);const distance=raycaster.ray.origin.distanceTo(worldPoint);
        if(distance<raycaster.near||distance>raycaster.far)continue;
        const normal=t.getNormal(new THREE.Vector3());
        intersections.push({distance,point:worldPoint.clone(),object:batch.mesh,faceIndex:face,pieceIndex:piece.index,face:{a:batch.index.getX(face*3),b:batch.index.getX(face*3+1),c:batch.index.getX(face*3+2),normal,materialIndex:0}});
      }
    }
  };
  let cullingEnabled=true;
  function syncVisibility(){
    // Vertex-shader debris can leave original mesh bounds. Suspend culling only
    // while it flies; untouched and settled buildings use normal Three culling.
    const enabled=flying.size===0&&held.size===0;
    if(enabled!==cullingEnabled){for(const mesh of meshes)mesh.frustumCulled=enabled;cullingEnabled=enabled;}
    group.visible=destroyedCount<pieces.length||flying.size>0||collapsing.size>0||held.size>0;
  }
  function retire(piece){flying.delete(piece);GLOBAL_FLYING.delete(piece);piece.hidden=true;write(piece,0);texture.needsUpdate=true;syncVisibility();}
  function release(piece,point,force,animate,normal,direction){
    piece.active=false;destroyedCount++;destroyedWeight+=piece.weight;
    pulsing.delete(piece);piece.impactPulse=piece.char>0?-Math.min(1,piece.char):0;piece.pulseStrength=0;
    if(!animate||!debrisLimit){retire(piece);return;}
    while(flying.size>=debrisLimit)retire(flying.values().next().value);
    while(GLOBAL_FLYING.size>=GLOBAL_DEBRIS_LIMIT)GLOBAL_FLYING.values().next().value();
    worldPoint.copy(piece.restPosition).applyMatrix4(group.matrixWorld);velocityWorld.subVectors(worldPoint,point);
    if(velocityWorld.lengthSq()<1e-8)velocityWorld.set(.23,.25,-.32);
    velocityWorld.normalize().multiplyScalar(.65);
    if(normal)velocityWorld.addScaledVector(normal,.95);
    // A bat carries debris along its world-space swing, while retaining a small
    // outward component so chips leave the wall instead of skating inside it.
    if(direction)velocityWorld.multiplyScalar(.45).addScaledVector(direction,1.65);
    velocityWorld.y+=.32;
    velocityWorld.normalize().multiplyScalar(2.6+Math.sqrt(force)*1.25);
    velocityWorld.y=Math.max(1.6,velocityWorld.y)+1.8+force*.09;
    piece.velocity.copy(velocityWorld).applyMatrix3(inverseLinear);
    const seed=piece.index*12.9898;piece.spin.set(Math.sin(seed)*5,Math.cos(seed*.7)*5,Math.sin(seed*.3)*5);
    piece.age=0;piece.lifetime=3.1+(piece.index%9)*.08;flying.add(piece);GLOBAL_FLYING.set(piece,()=>retire(piece));write(piece);syncVisibility();
  }
  // Select visible fragments before changing activity. Geometry iteration order
  // must never make a wide strike instantly hide its closest/contact fragments.
  function damageBatch(candidates,point,force,preserveFlying=false,direction=null){
    candidates.sort((a,b)=>a.distance-b.distance||a.piece.index-b.piece.index);
    const reserve=preserveFlying?flying.size:Math.min(flying.size,Math.floor(debrisLimit*.25));
    const visible=new Set(candidates.slice(0,Math.max(0,debrisLimit-reserve)).map(c=>c.piece));
    let weight=0;
    // Farthest first keeps the nearest fragments newest in the global budget.
    for(let i=candidates.length-1;i>=0;i--){const c=candidates[i];weight+=c.piece.weight;release(c.piece,point,force,visible.has(c.piece),c.normal,direction);}
    return {count:candidates.length,weight};
  }
  function emphasize(neighbors){
    neighbors.sort((a,b)=>a.distance-b.distance||a.piece.index-b.piece.index);
    for(const {piece,strength}of neighbors.slice(0,64)){
      while(pulsing.size>=96&&!pulsing.has(piece)){const old=pulsing.values().next().value;pulsing.delete(old);old.impactPulse=0;write(old);}
      piece.pulseAge=0;piece.pulseStrength=Math.max(piece.impactPulse,strength);piece.impactPulse=piece.pulseStrength;pulsing.add(piece);write(piece);
    }
  }
  // ?feel collapse. Support graph: 26-neighbour cells; roots are fragments resting on the ground plus any
  // part that was never ground-connected in the intact model (so detached trims never fall on the first hit).
  let support=null;
  function supportGraph(){
    if(support)return support;matrices();
    const cellOf=new Array(pieces.length),index=new Map();let minY=Infinity;
    for(const[key,piece]of cells){
      let x,y,z;
      if(typeof key==='number'){z=key%KEY_RANGE;const t=(key-z)/KEY_RANGE;y=t%KEY_RANGE;x=(t-y)/KEY_RANGE;x-=KEY_OFFSET;y-=KEY_OFFSET;z-=KEY_OFFSET;}
      else[x,y,z]=key.split(',').map(Number);
      cellOf[piece.index]=[x,y,z];index.set(key,piece.index);if(y<minY)minY=y;
    }
    const adj=pieces.map(piece=>{const c=cellOf[piece.index],list=[];if(!c)return list;
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){if(!dx&&!dy&&!dz)continue;const n=index.get(cellKey(c[0]+dx,c[1]+dy,c[2]+dz));if(n!==undefined)list.push(n);}
      return list;});
    const reach=cellSize*group.matrixWorld.getMaxScaleOnAxis()*.75,roots=new Uint8Array(pieces.length),seen=new Uint8Array(pieces.length),queue=[];
    for(const piece of pieces){
      worldBox.copy(piece.bounds).applyMatrix4(group.matrixWorld);const g=groundHeightAt((worldBox.min.x+worldBox.max.x)/2,(worldBox.min.z+worldBox.max.z)/2);
      if(cellOf[piece.index]?.[1]===minY||worldBox.min.y<=(Number.isFinite(g)?g:0)+reach){roots[piece.index]=1;seen[piece.index]=1;queue.push(piece.index);}
    }
    for(let q=0;q<queue.length;q++)for(const n of adj[queue[q]])if(!seen[n]){seen[n]=1;queue.push(n);}
    const groundRoots=roots.slice();
    for(let i=0;i<pieces.length;i++)if(!seen[i])roots[i]=1;
    return support={adj,roots,groundRoots,cellOf,index,minY};
  }
  function collapse(result){
    const mode=collapseMode,g=supportGraph(),seen=new Uint8Array(pieces.length),queue=[],driver=physicsDriver;
    driver?.prepare?.();
    const fail=driver?weakFailures(driver.weak):null;
    for(const piece of pieces)if(piece.active&&g.roots[piece.index]&&!fail?.[piece.index]){seen[piece.index]=1;queue.push(piece.index);}
    for(let q=0;q<queue.length;q++)for(const n of g.adj[queue[q]])if(!seen[n]&&pieces[n].active&&!fail?.[n]){seen[n]=1;queue.push(n);}
    const share=Number.isFinite(mode.count)?Math.max(0,Math.min(1,mode.count)):1,shake=Number.isFinite(mode.shake)?mode.shake:.25;
    const fallen=new THREE.Box3(),falling=driver?[]:null;let count=0,weight=0;
    for(const piece of pieces){
      if(!piece.active||seen[piece.index])continue;
      piece.active=false;destroyedCount++;destroyedWeight+=piece.weight*share;count++;weight+=piece.weight*share;
      pulsing.delete(piece);piece.impactPulse=0;piece.pulseStrength=0;
      // Physics: tremble in place (no deadline) until the driver turns the cluster into a rigid body.
      if(falling){falling.push(piece);collapsing.set(piece,{age:0,delay:Infinity,sink:-1});}
      // Lower fragments let go first so the mass reads as giving way from below.
      else collapsing.set(piece,{age:0,delay:shake+Math.max(0,piece.bounds.min.y-bounds.min.y)*.012+(piece.index%7)*.015,sink:-1});
      fallen.union(piece.bounds);
    }
    if(!count)return;result.count+=count;result.weight+=weight;
    if(falling){const a=physicsAdapter();a.driver=driver;driver.collapse(a,clusters(falling,fail));}
    fallen.applyMatrix4(group.matrixWorld);
    try{mode.onCollapse?.(fallen,count);}catch{}
  }
  // Fly share falls as ordinary debris (within budget); the rest sinks into the dust and shrinks away.
  function letGo(piece,state){
    const fly=Number.isFinite(state.fly)?state.fly:Number.isFinite(collapseMode?.fly)?collapseMode.fly:.35;
    if((piece.index*.6180339887)%1>=fly||!debrisLimit||flying.size>=debrisLimit){state.sink=0;return false;}
    while(GLOBAL_FLYING.size>=GLOBAL_DEBRIS_LIMIT)GLOBAL_FLYING.values().next().value();
    collapsing.delete(piece);worldPoint.copy(piece.position).applyMatrix4(group.matrixWorld);
    velocityWorld.copy(bounds.getCenter(rayPoint)).applyMatrix4(group.matrixWorld);velocityWorld.subVectors(worldPoint,velocityWorld);velocityWorld.y=0;
    if(velocityWorld.lengthSq()<1e-8)velocityWorld.set(.3,0,-.2);
    velocityWorld.normalize().multiplyScalar(.6+(piece.index%5)*.25);velocityWorld.y=-.4;piece.velocity.copy(velocityWorld).applyMatrix3(inverseLinear);
    const seed=piece.index*12.9898;piece.spin.set(Math.sin(seed)*2,Math.cos(seed*.7)*2,Math.sin(seed*.3)*2);
    piece.age=0;piece.lifetime=2.4+(piece.index%9)*.08;flying.add(piece);GLOBAL_FLYING.set(piece,()=>retire(piece));write(piece);syncVisibility();return true;
  }
  function dropState(piece,drop){
    const h=Math.max(0,piece.bounds.min.y-bounds.min.y),H=Math.max(1e-6,bounds.max.y-bounds.min.y),n=v=>Number.isFinite(v)?v:undefined;
    return{age:0,delay:(n(drop.shake)??.3)+h/H*(n(drop.spread)??.25)+(piece.index%7)*.02,sink:-1,fall:h,v:0,d:0,g:n(drop.gravity)??1,fly:n(drop.fly)??.05,linger:n(drop.linger)??.7,tremble:drop.tremble!==false};
  }
  function stepCollapse(dt){
    const sag=cellSize*.04,fallG=19/Math.max(1e-6,group.matrixWorld.getMaxScaleOnAxis());
    for(const[piece,state]of collapsing){
      state.age+=dt;const r=piece.restPosition;
      // Blast demolition drop (split `drop`): after the tremble it falls straight down to the building's base, then sinks.
      if(state.fall>=0&&state.sink<0&&state.age>=state.delay){
        state.v+=fallG*state.g*dt;state.d=Math.min(state.fall,state.d+state.v*dt);piece.position.set(r.x,r.y-state.d,r.z);write(piece);
        if(state.d>=state.fall){state.fall=-1;state.base=piece.position.clone();letGo(piece,state);}
        continue;
      }
      if(state.sink<0&&state.age>=state.delay&&letGo(piece,state))continue;
      if(state.sink>=0){state.sink+=dt;const t=state.sink/(state.linger||.7);if(t>=1){collapsing.delete(piece);retire(piece);continue;}
        const b=state.base||r;piece.position.set(b.x,b.y-cellSize*.9*t*t,b.z);write(piece,1-t*t);continue;}
      const k=Math.min(1,state.age/Math.max(.05,state.delay)),a=state.tremble===false?0:sag*(.4+k);
      piece.position.set(r.x+Math.sin(state.age*67+piece.index)*a,r.y-sag*k*k+Math.sin(state.age*53+piece.index*1.7)*a*.5,r.z+Math.cos(state.age*59+piece.index*.9)*a);write(piece);
    }
    if(!collapsing.size)syncVisibility();
  }
  // ?feel&physics only (never reached without a driver). Weak-support rules on the support graph's cells:
  // stress - a part above layer y whose remaining supports at y each carry more than `stress`x their intact share
  //          fails, and so do those supports; tip - a part whose centre of mass left its support footprint at y
  //          fails but keeps its supports (they become the pivot); span - a run that lost its straight-down load
  //          path and now hangs from its sides fails when hanging pieces per side attachment exceed `span`.
  let structureCache=null;
  function structure(){
    if(structureCache)return structureCache;
    const g=supportGraph(),N=pieces.length,cy=new Int32Array(N),below=new Int32Array(N).fill(-1);let minY=Infinity,maxY=-Infinity;
    for(let i=0;i<N;i++){const c=g.cellOf[i];cy[i]=c?c[1]:0;if(cy[i]<minY)minY=cy[i];if(cy[i]>maxY)maxY=cy[i];
      if(c){const n=g.index.get(cellKey(c[0],c[1]-1,c[2]));if(n!==undefined)below[i]=n;}}
    const L=maxY-minY+1,layers=Array.from({length:L},()=>[]);for(let i=0;i<N;i++)layers[cy[i]-minY].push(i);
    const s=structureCache={cy,minY,maxY,L,layers,below,sigma0:new Float32Array(N*L),tip0:new Uint8Array(N*L),vs0:null};
    const all=new Uint8Array(N).fill(1);s.vs0=verticalSupport(all);
    scanLayers(all,(ly,r,stress,tip,list,count,members)=>{for(const i of members(r)){s.sigma0[i*L+ly]=stress;s.tip0[i*L+ly]=tip?1:0;}});
    return s;
  }
  // Top-down union-find: at each layer y, the parts made of pieces above y and the pieces at y holding each up.
  function scanLayers(on,visit){
    const s=structureCache,g=support,N=pieces.length,parent=new Int32Array(N).fill(-1),next=new Int32Array(N).fill(-1),tail=new Int32Array(N);
    const W=new Float64Array(N),X=new Float64Array(N),Z=new Float64Array(N),C=new Int32Array(N),sup=new Map();
    const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
    const union=(a,b)=>{a=find(a);b=find(b);if(a===b)return;if(C[a]<C[b]){const t=a;a=b;b=t;}parent[b]=a;W[a]+=W[b];X[a]+=X[b];Z[a]+=Z[b];C[a]+=C[b];next[tail[a]]=b;tail[a]=tail[b];};
    const members=r=>{const out=[];for(let i=r;i>=0;i=next[i])out.push(i);return out;};
    for(let y=s.maxY;y>s.minY;y--){
      for(const i of s.layers[y-s.minY]){if(!on[i])continue;const p=pieces[i];parent[i]=i;tail[i]=i;W[i]=p.weight;X[i]=p.weight*p.restPosition.x;Z[i]=p.weight*p.restPosition.z;C[i]=1;
        for(const n of g.adj[i])if(parent[n]>=0)union(i,n);}
      const ly=y-1-s.minY;sup.clear();
      for(const j of s.layers[ly]){if(!on[j])continue;const pj=pieces[j],b=pj.bounds;
        for(const n of g.adj[j]){if(s.cy[n]!==y||parent[n]<0)continue;const r=find(n);let e=sup.get(r);
          if(!e){e={w:0,x0:Infinity,x1:-Infinity,z0:Infinity,z1:-Infinity,list:[]};sup.set(r,e);}
          if(e.list[e.list.length-1]===j)continue;
          e.list.push(j);e.w+=pj.weight;e.x0=Math.min(e.x0,b.min.x);e.x1=Math.max(e.x1,b.max.x);e.z0=Math.min(e.z0,b.min.z);e.z1=Math.max(e.z1,b.max.z);}}
      for(const[r,e]of sup){const w=W[r],cx=X[r]/w,cz=Z[r]/w,m=.25*cellSize;
        visit(ly,r,w/Math.max(1e-6,e.w),cx<e.x0-m||cx>e.x1+m||cz<e.z0-m||cz>e.z1+m,e.list,C[r],members);}
    }
  }
  function verticalSupport(on){
    const s=structureCache,g=support,vs=new Uint8Array(pieces.length);
    for(const layer of s.layers)for(const i of layer){if(!on[i])continue;if(g.groundRoots[i]){vs[i]=1;continue;}const b=s.below[i];if(b>=0&&on[b]&&vs[b])vs[i]=1;}
    return vs;
  }
  function weakFailures(weak){
    if(!weak)return null;const s=structure(),g=support,N=pieces.length,L=s.L,fail=new Uint8Array(N),on=new Uint8Array(N);let any=false;
    for(let i=0;i<N;i++)on[i]=pieces[i].active?1:0;
    const k=Number.isFinite(weak.stress)?weak.stress:Infinity,span=Number.isFinite(weak.span)?weak.span:Infinity,tipOn=weak.tip!==false;
    if(k<Infinity||tipOn)scanLayers(on,(ly,r,stress,tip,list,count,members)=>{
      if(count<3)return;const base=s.sigma0[r*L+ly];if(!(base>0))return;
      const crushed=stress>k*base,tipped=tipOn&&tip&&!s.tip0[r*L+ly];if(!crushed&&!tipped)return;any=true;
      // Codes: 1 crushed (keeps crushing what it lands on), 2 tipped (its supports stay as the pivot), 3 span.
      for(const i of members(r))fail[i]=tipped?2:Math.max(fail[i],1);
      if(crushed&&!tipped)for(const j of list)if(!fail[j])fail[j]=1;
    });
    if(span<Infinity){
      const vs=verticalSupport(on),newly=new Uint8Array(N),mark=new Uint8Array(N),comp=[],attach=new Set();
      for(let i=0;i<N;i++)if(on[i]&&!fail[i]&&s.vs0[i]&&!vs[i])newly[i]=1;
      for(let i=0;i<N;i++){if(!newly[i]||mark[i])continue;comp.length=0;attach.clear();mark[i]=1;comp.push(i);
        for(let q=0;q<comp.length;q++)for(const n of g.adj[comp[q]]){if(newly[n]){if(!mark[n]){mark[n]=1;comp.push(n);}}else if(on[n]&&!fail[n])attach.add(n);}
        if(attach.size&&comp.length>span*attach.size){any=true;for(const j of comp)fail[j]=3;}}
    }
    return any?fail:null;
  }
  // Falling pieces split into 26-connected clusters, largest first: each becomes one rigid body. mode: 'tip' when
  // any part tipped off its support (the supports stay as the pivot), 'crush' when it overloaded its supports.
  function clusters(list,fail){
    const g=support,inSet=new Uint8Array(pieces.length),mark=new Uint8Array(pieces.length),out=[];
    for(const p of list)inSet[p.index]=1;
    for(const p of list){if(mark[p.index])continue;const c=[p];mark[p.index]=1;
      for(let q=0;q<c.length;q++)for(const n of g.adj[c[q].index])if(inSet[n]&&!mark[n]){mark[n]=1;c.push(pieces[n]);}
      c.mode=c.some(p=>fail?.[p.index]===2)?'tip':c.some(p=>fail?.[p.index]===1)?'crush':'fall';out.push(c);}
    return out.sort((a,b)=>b.length-a.length);
  }
  // What the physics driver may touch: poses of the pieces it holds, and handing them back as debris/dust.
  let adapter=null;
  function physicsAdapter(){
    if(adapter)return adapter;const g=supportGraph(),t=new THREE.Vector3(),q=new THREE.Quaternion(),sc=new THREE.Vector3();group.matrixWorld.decompose(t,q,sc);
    const share=()=>Number.isFinite(collapseMode?.count)?Math.max(0,Math.min(1,collapseMode.count)):1;
    return adapter={id,group,pieces,bounds,cellSize,cellOf:g.cellOf,index:g.index,cellKey,held,driver:null,inverse,
      scale:(sc.x+sc.y+sc.z)/3,quaternion:q.clone(),groundHeightAt:(x,z)=>groundHeightAt(x,z),
      claim(piece){collapsing.delete(piece);held.add(piece);piece.position.copy(piece.restPosition);piece.quaternion.identity();},
      pose(piece){write(piece);},
      fly(piece,v,spin=3){held.delete(piece);collapsing.delete(piece);if(!debrisLimit||flying.size>=debrisLimit)return false;
        while(GLOBAL_FLYING.size>=GLOBAL_DEBRIS_LIMIT)GLOBAL_FLYING.values().next().value();
        piece.velocity.copy(v).applyMatrix3(inverseLinear);const seed=piece.index*12.9898;piece.spin.set(Math.sin(seed),Math.cos(seed*.7),Math.sin(seed*.3)).multiplyScalar(spin);
        piece.age=0;piece.lifetime=1.8+(piece.index%9)*.08;flying.add(piece);GLOBAL_FLYING.set(piece,()=>retire(piece));write(piece);syncVisibility();return true;},
      sink(piece){held.delete(piece);collapsing.set(piece,{age:0,delay:0,sink:0,base:piece.position.clone()});},
      fallback(piece){held.delete(piece);const st=collapsing.get(piece);if(st&&st.delay===Infinity)st.delay=st.age+.05+(piece.index%7)*.015;},
      crush(piece){if(!piece.active)return false;piece.active=false;destroyedCount++;destroyedWeight+=piece.weight*share();pulsing.delete(piece);piece.impactPulse=0;piece.pulseStrength=0;
        if(destroyedCount===pieces.length)destroyedWeight=totalWeight;return true;},
      dust(x,y,z,speed){if(groundContactListener)try{groundContactListener(x,y,z,speed);}catch{}},
      drop(piece){held.delete(piece);collapsing.delete(piece);retire(piece);},
      touch(){texture.needsUpdate=true;syncVisibility();},
    };
  }
  function finalizeDamage(){if(destroyedCount===pieces.length)destroyedWeight=totalWeight;texture.needsUpdate=true;}
  const api={group,meshes,pieces,bounds,totalWeight,height:bounds.max.y-bounds.min.y,
    setGroundHeight(fn){groundHeightAt=typeof fn==='function'?fn:()=>0;},
    stats:{sourceTriangles,triangles:outputTriangles,pieces:pieces.length,drawCalls:meshes.length,chunkSize:cellSize,geometryBytes:meshes.reduce((sum,m)=>sum+(m.geometry.index?.array.byteLength??0)+Object.values(m.geometry.attributes).reduce((s,a)=>s+a.array.byteLength,0),0),transformBytes:transforms.byteLength,buildMilliseconds:performance.now()-start},
    transformTexture:texture,
    get destroyedWeight(){return destroyedWeight;},get destroyedCount(){return destroyedCount;},get remaining(){return pieces.length-destroyedCount;},
    get reacting(){return false;},get pulsingCount(){return pulsing.size;},get heatedCount(){return heated.size;},get pendingCutCount(){return laserJobs.length;},get flyingCount(){return flying.size+collapsing.size+held.size;},get disposed(){return disposed;},
    get worldBounds(){group.updateWorldMatrix(true,false);return bounds.clone().applyMatrix4(group.matrixWorld);},
    localToWorld(point){group.updateWorldMatrix(true,false);return group.localToWorld(point);},
    hit(point,radius=2.8,force=1,options={}){
      if(disposed||!point||![point.x,point.y,point.z,radius,force].every(Number.isFinite))return{count:0,weight:0};
      matrices();const r=Math.max(0,radius),r2=r*r+1e-12,strength=Math.max(0,Math.min(30,force));
      const shell=Math.max(.3,Math.min(2,cellSize*group.matrixWorld.getMaxScaleOnAxis()*.75)),nearRadius=r+shell;
      const candidates=[],neighbors=[];
      for(const piece of pieces){
        if(!piece.active||worldBox.copy(piece.bounds).applyMatrix4(group.matrixWorld).distanceToPoint(point)>nearRadius+1e-7)continue;
        let distance=Infinity,normal=null;
        for(const ref of piece.references){for(const face of ref.faces){
          const t=readTriangle(ref,face,true);t.closestPointToPoint(point,closest);const d=closest.distanceToSquared(point);
          if(d<distance){distance=d;normal=t.getNormal(normal??new THREE.Vector3());}
        }}
        if(distance<=r2)candidates.push({piece,distance,normal});
        else if(distance<=nearRadius*nearRadius)neighbors.push({piece,distance,strength:.7*(1-(Math.sqrt(distance)-r)/shell)});
      }
      if(!candidates.length)return{count:0,weight:0};
      const requested=options?.direction;
      const direction=requested&&[requested.x,requested.y,requested.z].every(Number.isFinite)
        ?new THREE.Vector3(requested.x,requested.y,requested.z):null;
      if(direction&&direction.lengthSq()>1e-8)direction.normalize();
      const result=damageBatch(candidates,point,strength,false,direction?.lengthSq()>1e-8?direction:null);emphasize(neighbors);if(collapseMode)collapse(result);finalizeDamage();return result;
    },
    // Flamethrower: adds char (0..1) to active fragments within `radius` of `point` (world). Charred fragments darken via the
    // negative impact pulse; at char >= 1 they crumble through the same release/collapse path as hit() with a soft force.
    // Distance is to the fragment box in model space x the uniform group scale; nothing is allocated per call.
    scorch(point,radius=2.4,amount=.1,options={}){
      if(disposed||!point||![point.x,point.y,point.z,radius,amount].every(Number.isFinite)||radius<=0||amount<=0)return{count:0,weight:0,charred:0};
      matrices();scorchPoint.copy(point).applyMatrix4(inverse);const s=group.matrixWorld.getMaxScaleOnAxis()||1,r=radius/s;
      let charred=0;scorchCandidates.length=0;
      for(const piece of pieces){
        if(!piece.active)continue;const d=piece.bounds.distanceToPoint(scorchPoint);if(d>r)continue;
        piece.char=(piece.char||0)+amount*(1-.65*d/r);charred++;
        if(piece.char>=1)scorchCandidates.push({piece,distance:d*d,normal:null});
        else if(!pulsing.has(piece)){piece.impactPulse=-Math.min(1,piece.char);write(piece);}
      }
      if(charred)texture.needsUpdate=true;
      if(!scorchCandidates.length)return{count:0,weight:0,charred};
      const force=Number.isFinite(options.force)?Math.max(0,Math.min(30,options.force)):1.2;
      const result=damageBatch(scorchCandidates.splice(0),point,force,false,null);if(collapseMode)collapse(result);finalizeDamage();result.charred=charred;return result;
    },
    // Laser cutter (src/laser-cutter.js, 2026-10-22, round 2 "cut along the drawn path"): classify(x, y, z) sorts every
    // standing fragment by its world centre: -1 = the groove (it leaves through the same release / debris path as hit()),
    // [0, 1) = stays, [2, 3) = falls; the fraction is how hot its cut face glows. The falling fragments become one held
    // cluster - inactive and counted as destroyed - that the caller poses through `handle` and later lets go (fly / sink /
    // drop); fewer than minPieces stay standing. kerfFly: only the nearest this many groove fragments to `point` fly as chips
    // (the rest vanish). heat: { tau, char } - glowing fragments cool over tau and keep a char tint.
    // drop (src/blast-demolition.js): { shake, spread, gravity, fly, linger } - the falling fragments are not held: each
    // trembles, falls straight down to the building's base (upper ones a little later), then sinks into the dust (a `fly`
    // share is thrown off as debris on landing).
    split(classify,{point,force=6,debrisNormal=null,minPieces=3,kerfFly=Infinity,heat=null,drop=null}={}){
      const none={count:0,weight:0,kerf:[],chunk:[],handle:null};
      if(disposed||typeof classify!=='function'||!point||![point.x,point.y,point.z].every(Number.isFinite))return none;
      matrices();const kerf=[],fall=[],warm=[];
      for(const piece of pieces){
        if(!piece.active)continue;worldPoint.copy(piece.restPosition).applyMatrix4(group.matrixWorld);
        const c=classify(worldPoint.x,worldPoint.y,worldPoint.z);if(!Number.isFinite(c))continue;
        if(c<0){kerf.push({piece,distance:worldPoint.distanceToSquared(point),normal:debrisNormal});continue;}
        if(c>=2)fall.push(piece);const h=c>=2?c-2:c;if(heat&&h>0)warm.push([piece,Math.min(1,h)]);
      }
      const chunk=fall.length>=Math.max(1,minPieces)?fall:[];
      if(!kerf.length&&!chunk.length)return none;
      // the groove: the nearest kerfFly fragments fly as chips, the rest are vaporised (counted, hidden)
      kerf.sort((a,b)=>a.distance-b.distance||a.piece.index-b.piece.index);
      const chips=kerf.slice(0,Math.max(0,kerfFly)),strength=Math.max(0,Math.min(30,force));
      const result=chips.length?damageBatch(chips,point,strength,false,null):{count:0,weight:0};
      for(const c of kerf.slice(chips.length)){result.count++;result.weight+=c.piece.weight;release(c.piece,point,strength,false);}
      for(const piece of chunk){
        piece.active=false;destroyedCount++;destroyedWeight+=piece.weight;result.count++;result.weight+=piece.weight;
        pulsing.delete(piece);piece.impactPulse=piece.char>0?-Math.min(1,piece.char):0;piece.pulseStrength=0;
        if(drop){collapsing.set(piece,dropState(piece,drop));continue;}
        held.add(piece);piece.position.copy(piece.restPosition);piece.quaternion.identity();write(piece);
      }
      // cut faces glow (then cool 20 times a second in update)
      if(heat?.narrow&&laserBands){const job={age:0,budget:heat.budget??heat.narrow.cutWorkMs};job.work=narrowCut(warm,kerf,heat,job);laserJobs.push(job);}
      if(heat&&!heat.narrow)for(const[piece,h]of warm){if(!piece.active&&!held.has(piece))continue;
        heated.set(piece,{age:0,peak:h,tau:heat.tau??3,char:heat.char??.35});piece.impactPulse=2+h;write(piece);}
      if(collapseMode)collapse(result);finalizeDamage();syncVisibility();
      const handle={group,
        pose(piece,scale=1,stretch=1){if(held.has(piece))write(piece,Math.max(0,Math.min(1,scale)),Number.isFinite(stretch)?Math.max(1,Math.min(3,stretch)):1);},
        fly(piece,v,spin=3){if(!held.has(piece))return true;if(!debrisLimit||flying.size>=debrisLimit)return false;held.delete(piece);
          while(GLOBAL_FLYING.size>=GLOBAL_DEBRIS_LIMIT)GLOBAL_FLYING.values().next().value();
          piece.velocity.copy(v).applyMatrix3(inverseLinear);const seed=piece.index*12.9898;piece.spin.set(Math.sin(seed),Math.cos(seed*.7),Math.sin(seed*.3)).multiplyScalar(spin);
          piece.age=0;piece.lifetime=1.8+(piece.index%9)*.08;flying.add(piece);GLOBAL_FLYING.set(piece,()=>retire(piece));write(piece);syncVisibility();return true;},
        sink(piece){if(!held.delete(piece))return;collapsing.set(piece,{age:0,delay:0,sink:0,base:piece.position.clone()});},
        drop(piece){const owned=held.delete(piece);if(collapsing.delete(piece)||owned)retire(piece);},
        touch(){texture.needsUpdate=true;syncVisibility();},
        get live(){return !disposed;},
      };
      return{count:result.count,weight:result.weight,kerf:kerf.map(c=>c.piece),chunk,handle};
    },
    // Laser put away (src/laser-cutter.js): glowing cut faces cool at once and keep their char tint.
    coolCuts(){
      laserJobs.length=0;
      if(disposed||!heated.size)return 0;let n=0;
      for(const[piece,h]of heated){if(!piece.hidden&&(piece.active||held.has(piece))&&!pulsing.has(piece)){piece.impactPulse=h.narrow?2:-Math.max(h.char,Math.min(1,piece.char||0));write(piece);n++;}}
      heated.clear();texture.needsUpdate=true;return n;
    },
    explode(){
      if(disposed)return{count:0,weight:0};matrices();const origin=bounds.getCenter(new THREE.Vector3()).applyMatrix4(group.matrixWorld),candidates=[];
      for(const piece of pieces)if(piece.active)candidates.push({piece,distance:worldPoint.copy(piece.restPosition).applyMatrix4(group.matrixWorld).distanceToSquared(origin)});
      // Auto-clear after a strong strike must retain that strike's visible debris.
      const result=damageBatch(candidates,origin,16,true);if(result.count)finalizeDamage();return result;
    },
    update(dt){
      if(disposed||!Number.isFinite(dt)||dt<=0||!flying.size&&!pulsing.size&&!collapsing.size&&!held.size&&!heated.size&&!laserJobs.length)return;matrices();const step=Math.min(.05,dt);gravity.set(0,-19,0).applyMatrix3(inverseLinear);
      for(const piece of flying){
        piece.age+=dt;if(piece.age>=piece.lifetime){retire(piece);continue;}
        piece.velocity.addScaledVector(gravity,step);piece.position.addScaledVector(piece.velocity,step);
        worldPoint.copy(piece.position).applyMatrix4(group.matrixWorld);
        const sampledGround=groundHeightAt(worldPoint.x,worldPoint.z),floorY=(Number.isFinite(sampledGround)?sampledGround:0)+.08;
        if(worldPoint.y<floorY){worldPoint.y=floorY;piece.position.copy(worldPoint).applyMatrix4(inverse);velocityWorld.copy(piece.velocity).applyMatrix3(linear);if(groundContactListener&&velocityWorld.y<-5)groundContactListener(worldPoint.x,worldPoint.y,worldPoint.z,-velocityWorld.y);velocityWorld.set(velocityWorld.x*.75,Math.abs(velocityWorld.y)*.25,velocityWorld.z*.75);piece.velocity.copy(velocityWorld).applyMatrix3(inverseLinear);piece.spin.multiplyScalar(.8);}
        spinEuler.set(piece.spin.x*step,piece.spin.y*step,piece.spin.z*step);spinStep.setFromEuler(spinEuler);piece.quaternion.multiply(spinStep).normalize();write(piece,Math.min(1,(piece.lifetime-piece.age)/.9));
      }
      if(adapter?.driver&&(held.size||collapsing.size))adapter.driver.update(adapter,dt);
      if(collapsing.size)stepCollapse(dt);
      // cut-face heat, 20 times a second: fragments still standing (or held by the laser) glow and cool, then keep a char tint
      if(heated.size&&(heatClock+=dt)>=.05){const step=heatClock;heatClock=0;
        for(const[piece,h]of heated){
          if(piece.hidden||!piece.active&&!held.has(piece)){heated.delete(piece);continue;}h.age+=step;if(pulsing.has(piece))continue;
          const v=h.peak*Math.exp(-h.age/h.tau);if(v<.04){piece.impactPulse=h.narrow?2:-Math.max(h.char,Math.min(1,piece.char||0));heated.delete(piece);}else piece.impactPulse=2+Math.min(1,v);write(piece);
        }}
      if(laserJobs.length){
        for(const job of laserJobs)job.age+=dt;
        const start=performance.now(),budget=laserJobs[0].budget;
        do{if(laserJobs[0].work.next().done)laserJobs.shift();}while(laserJobs.length&&performance.now()-start<budget);
      }
      for(const piece of pulsing){
        piece.pulseAge+=dt;const t=Math.min(1,piece.pulseAge/.22);piece.impactPulse=piece.pulseStrength*(1-t)*(1-t);
        if(t>=1){piece.impactPulse=piece.char>0?-Math.min(1,piece.char):0;piece.pulseStrength=0;pulsing.delete(piece);}write(piece);
      }
      texture.needsUpdate=true;
    },
    reset(){
      if(disposed)return false;adapter?.driver?.clear(adapter);held.clear();heated.clear();for(const piece of flying)GLOBAL_FLYING.delete(piece);flying.clear();pulsing.clear();collapsing.clear();destroyedCount=0;destroyedWeight=0;
      laserJobs.length=0;
      if(laserBands)for(const mesh of meshes){mesh.geometry.attributes.modelLaserDistance.array.fill(-1);mesh.geometry.attributes.modelLaserDistance.needsUpdate=true;}
      for(const piece of pieces)piece.laserNarrow=false;
      for(const piece of pieces){piece.active=true;piece.hidden=false;piece.position.copy(piece.restPosition);piece.quaternion.identity();piece.velocity.set(0,0,0);piece.spin.set(0,0,0);piece.age=0;piece.lifetime=0;piece.impactPulse=0;piece.pulseAge=0;piece.pulseStrength=0;if(piece.char)piece.char=0;write(piece);}
      texture.needsUpdate=true;syncVisibility();return true;
    },
    dispose(){
      if(disposed)return;disposed=true;adapter?.driver?.clear(adapter);held.clear();for(const piece of flying)GLOBAL_FLYING.delete(piece);flying.clear();pulsing.clear();collapsing.clear();
      laserJobs.length=0;
      for(const mesh of meshes)mesh.geometry.dispose();for(const material of ownedMaterials)material.dispose();texture.dispose();group.removeFromParent();group.clear();
    },
  };
  return api;
}
