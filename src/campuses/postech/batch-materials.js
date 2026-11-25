// POSTECH-only preparation hook. No cached source object, triangle, node transform,
// building boundary, material classification or fragment-cell coordinate is edited.
// The shared destruction engine already batches within a building by Material identity.
// 1. Share strictly equivalent opaque materials (including identical texture identity).
// 2. For texture-free opaque colours only, move linear RGB to Float32 vertex colour.
// Use as pkg.models.enhanceFacade; dispose after fragment preparation, as the engine does.

export function materialSemantics(name = '') {
  const n = name.toLowerCase(), glass = /glass/.test(n) && !/spandrel/.test(n);
  const decor = !glass && /glass|ivy|flag|lawn|pole|membrane|seating|water|leaf|tree/.test(n);
  const finish = /glass/.test(n) ? 'glass'
    : /stone|concrete|limestone|coping|pale|plaster|render|stucco/.test(n) && !/joint/.test(n) ? 'masonry'
    : /roof|slate/.test(n) ? 'roof' : '';
  return [glass, decor, finish];
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}

function state(material, colour = true) {
  const desc = material.toJSON();
  for (const key of ['metadata', 'uuid', 'name']) delete desc[key];
  if (!colour) delete desc.color;
  // toJSON colour is sRGB packed RGB; retain exact linear components separately.
  delete desc.color;
  return JSON.stringify(stable([desc, colour ? material.color.toArray() : null,
    materialSemantics(material.name), material.visible, material.userData?.interiorWeight]));
}

function eligible(THREE, mesh) {
  const m = mesh.material, g = mesh.geometry;
  return !Array.isArray(m) && m?.isMeshStandardMaterial && !m.isMeshPhysicalMaterial
    && !m.transparent && m.opacity === 1 && !m.alphaTest && !m.vertexColors && !g?.attributes.color
    && g?.attributes.position && !mesh.isSkinnedMesh && !mesh.isInstancedMesh
    && !Object.keys(g.morphAttributes || {}).length
    && m.onBeforeCompile === THREE.Material.prototype.onBeforeCompile
    && m.customProgramCacheKey === THREE.Material.prototype.customProgramCacheKey;
}

// Optional independent audit, never run automatically in the loading path.
// Traversal/vertex order is unchanged by this helper, so an ordered two-word digest
// covers every vertex/index byte, draw/group state, world transform, effective linear
// colour and material semantic. This is an equality check, not a cryptographic hash.
export function materialBatchInvariant(scene) {
  let a = 2166136261, b = 2246822519, bytes = 0, meshes = 0;
  const scratch = new ArrayBuffer(8), dv = new DataView(scratch), enc = new TextEncoder();
  const feed = data => { for (const x of data) { a = Math.imul(a ^ x, 16777619); b = Math.imul(b ^ x, 3266489917); } bytes += data.length; };
  const text = value => feed(enc.encode(JSON.stringify(stable(value))));
  const number = value => { dv.setFloat64(0, value, true); feed(new Uint8Array(scratch)); };
  const float = value => { dv.setFloat32(0, value, true); feed(new Uint8Array(scratch, 0, 4)); };
  scene.updateWorldMatrix(true, true);
  scene.traverse(mesh => {
    if (!mesh.isMesh) return; meshes++;
    const g = mesh.geometry, mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    text([mesh.name, mesh.visible, mesh.castShadow, mesh.receiveShadow, mesh.renderOrder,
      mesh.matrixWorld.elements, g.drawRange, g.groups]);
    for (const key of Object.keys(g.attributes).filter(k => k !== 'color').sort()) {
      const attr = g.attributes[key]; text([key, attr.itemSize, attr.count, attr.normalized]);
      for (let i = 0; i < attr.count; i++) for (let k = 0; k < attr.itemSize; k++) number(attr.getComponent(i, k));
    }
    text(g.index ? ['index', g.index.count] : ['unindexed']);
    if (g.index) for (let i = 0; i < g.index.count; i++) number(g.index.getX(i));
    for (const m of mats) {
      const desc = JSON.parse(state(m, false)); delete desc[0].vertexColors;
      text(desc);
      const c = g.attributes.color, count = g.attributes.position?.count || 0, rgb = m.color.toArray();
      for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++)
        float(Math.fround(rgb[k]) * Math.fround(m.vertexColors && c ? c.getComponent(i, k) : 1));
      // This hook excludes alpha vertex colours; audit existing alpha separately.
      if (c?.itemSize === 4) for (let i = 0; i < count; i++) number(c.getW(i));
    }
  });
  return { meshes, bytes, digest: [a >>> 0, b >>> 0].map(n => n.toString(16).padStart(8, '0')).join('') };
}

export function batchBuildingMaterials(THREE, id, scene, { audit = false } = {}) {
  const geometries = [], materials = [], changes = [], before = audit ? materialBatchInvariant(scene) : null;
  const stats = { materialBatching: true, building: id, meshes: 0, exactShared: 0,
    materialsBefore: 0, materialsAfter: 0, colourVertices: 0, maxLinearColourRounding: 0 };
  const all = new Set(), rows = [], exact = new Map();
  let disposed = false;
  scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) all.add(m);
    if (!eligible(THREE, mesh)) return;
    changes.push({ mesh, geometry: mesh.geometry, material: mesh.material }); rows.push(mesh);
    const key = state(mesh.material), known = exact.get(key);
    if (known) { if (known !== mesh.material) stats.exactShared++; mesh.material = known; }
    else exact.set(key, mesh.material);
  });
  stats.materialsBefore = all.size;
  const buckets = new Map();
  for (const mesh of rows) {
    const m = mesh.material;
    if (Object.values(m).some(value => value?.isTexture)) continue;
    const key = state(m, false);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(mesh);
  }
  const dispose = () => {
    if (disposed) return; disposed = true;
    // Restore the caller's scene; cached geometry/material resources are never disposed.
    for (const row of changes) { row.mesh.geometry = row.geometry; row.mesh.material = row.material; }
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  };
  try {
    for (const list of buckets.values()) {
      if (new Set(list.map(mesh => mesh.material)).size < 2) continue;
      const shared = list[0].material.clone(); shared.color.setRGB(1, 1, 1); shared.vertexColors = true;
      materials.push(shared);
      for (const mesh of list) {
        const rgb = mesh.material.color.toArray(), geometry = mesh.geometry.clone();
        const values = new Float32Array(geometry.attributes.position.count * 3);
        for (let i = 0; i < values.length; i += 3) values.set(rgb, i);
        for (const c of rgb) stats.maxLinearColourRounding = Math.max(stats.maxLinearColourRounding, Math.abs(c - Math.fround(c)));
        geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
        geometries.push(geometry); mesh.geometry = geometry; mesh.material = shared;
        stats.meshes++; stats.colourVertices += values.length / 3;
      }
    }
    const after = new Set();
    scene.traverse(mesh => { if (mesh.isMesh) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) after.add(m); });
    stats.materialsAfter = after.size;
    if (audit) {
      stats.invariantBefore = before; stats.invariantAfter = materialBatchInvariant(scene);
      stats.invariantEqual = JSON.stringify(before) === JSON.stringify(stats.invariantAfter);
      if (!stats.invariantEqual) throw Error(`POSTECH ${id}: material batching changed rendered inputs`);
    }
    return { stats, dispose };
  } catch (error) { dispose(); throw error; }
}
