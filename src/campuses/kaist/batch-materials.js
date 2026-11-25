// KAIST-only load-time material batching. The cached glTF and all source triangles stay intact.
// The engine already merges fragment geometry by material identity, within ONE building.
// Moving a constant linear diffuse colour to a vertex attribute allows that existing path
// to share otherwise identical opaque materials. No building/piece boundaries are merged.
const SYMBOLS = new Set(['mainBldg', 'library', 'creativeLearning', 'kiBldg', 'mainGate']);

function semantics(name) {
  const n = name.toLowerCase(), glass = /glass/.test(n) && !/spandrel/.test(n);
  // Keep the classifications used by interior-fill and campus-materials unchanged.
  const decor = !glass && /glass|ivy|flag|lawn|pole|membrane|seating|water|leaf|tree/.test(n);
  const finish = /glass/.test(n) ? 'glass' : /stone|concrete|limestone|coping|pale|plaster|render|stucco/.test(n) && !/joint/.test(n) ? 'masonry' : /roof|slate/.test(n) ? 'roof' : '';
  return [glass, decor, finish];
}

export function batchBuildingMaterials(THREE, id, scene) {
  const ownedGeometries = [], ownedMaterials = [];
  const stats = { materialBatching: true, symbolPreserved: SYMBOLS.has(id), meshes: 0, materialsBefore: 0, materialsAfter: 0 };
  const dispose = () => { for (const g of ownedGeometries) g.dispose(); for (const m of ownedMaterials) m.dispose(); };
  if (SYMBOLS.has(id)) return { stats, dispose };
  const buckets = new Map(), all = new Set();
  scene.traverse(o => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) all.add(m);
    const m = o.material, g = o.geometry;
    if (Array.isArray(m) || !m?.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.transparent || m.opacity !== 1 || m.alphaTest || m.vertexColors || g.attributes.color || !g.attributes.position || o.isSkinnedMesh || o.isInstancedMesh || Object.keys(g.morphAttributes).length) return;
    if (m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile || Object.values(m).some(v => v?.isTexture)) return;
    const desc = m.toJSON();
    // All other serialized shading/state/extras fields remain part of the signature.
    for (const k of ['metadata', 'uuid', 'name', 'color']) delete desc[k];
    const key = JSON.stringify([desc, semantics(m.name), m.visible, m.userData?.interiorWeight]);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  stats.materialsBefore = all.size;
  for (const meshes of buckets.values()) {
    if (new Set(meshes.map(o => o.material)).size < 2) continue;
    const shared = meshes[0].material.clone(); shared.color.setRGB(1, 1, 1); shared.vertexColors = true;
    ownedMaterials.push(shared);
    for (const o of meshes) {
      const colour = o.material.color, geometry = o.geometry.clone(), values = new Float32Array(geometry.attributes.position.count * 3);
      for (let i = 0; i < values.length; i += 3) { values[i] = colour.r; values[i + 1] = colour.g; values[i + 2] = colour.b; }
      geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
      ownedGeometries.push(geometry); o.geometry = geometry; o.material = shared; stats.meshes++;
    }
  }
  const after = new Set(); scene.traverse(o => { if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) after.add(m); });
  stats.materialsAfter = after.size;
  return { stats, dispose };
}
