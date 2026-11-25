// Dong-A Bumin: each skybridge depends on both towers. All other campus
// assembly and destruction stays in the shared engine.
import * as engine from '../../engine/campus-engine.js?v=lr01&dongabumin-original=1';
export * from '../../engine/campus-engine.js?v=lr01&dongabumin-original=1';

function connectBridgeSupports(THREE, pkg, campus) {
  if (pkg.id !== 'dongabumin') return campus;
  // The law building's arch material is used only for its exterior stone
  // frame and window reveals. Keep those authored surfaces exterior when the
  // destruction mesher subdivides them; otherwise its cell classification
  // paints stair-step patches on an otherwise continuous ring.
  const law = campus.entries.find(e => e.id === 'b02');
  let archFaces = 0;
  if (law) for (const mesh of law.model.meshes) {
    if (!/b02__(?:arch-stone-wall|arch-frame-stone)/.test(mesh.material?.name || '')) continue;
    const side = mesh.geometry.getAttribute('modelInteriorSide');
    if (!side) continue;
    for (let i = 0; i < side.count; i++) {
      if (side.getX(i) !== 0) { side.setX(i, 0); archFaces++; }
    }
    side.needsUpdate = true;
  }
  if (law) {
    // The shallow frame self-shadows at sub-texel scale; limit the shadow
    // reception workaround to these two façade materials, not other walls.
    for (const mesh of law.model.meshes) {
      if (/b02__(?:arch-stone-wall|arch-frame-stone|arch-facade-wall)/.test(mesh.material?.name || '')) mesh.receiveShadow = false;
    }
    law.model.group.userData.correctedArchInteriorVertices = archFaces;
  }
  // The museum's dedicated arch brick is an exposed shell, including its
  // visible intrados. The generic destruction classifier labels some of its
  // curved underside as an interior face, producing a solid black wedge.
  const museum = campus.entries.find(e => e.id === 'b01');
  let museumArchFaces = 0;
  if (museum) for (const mesh of museum.model.meshes) {
    if (!/arch-brick/.test(mesh.material?.name || '')) continue;
    const side = mesh.geometry.getAttribute('modelInteriorSide');
    if (!side) continue;
    for (let i = 0; i < side.count; i++) {
      if (side.getX(i) !== 0) { side.setX(i, 0); museumArchFaces++; }
    }
    side.needsUpdate = true;
  }
  if (museum) museum.model.group.userData.correctedArchVertices = museumArchFaces;
  // The generic interior generator mistakes the open western steel staircase
  // for an enclosed storey and produces detached concrete floor fragments.
  // Degenerate only generated interior triangles in this open-air volume;
  // keep the authored stair, the building interior and fragment face indices.
  const base = campus.entries.find(e => e.id === 'b04base');
  let removedInteriorFaces = 0;
  if (base) for (const mesh of base.model.meshes) {
    if (!/b04base-interior-concrete/.test(mesh.material?.name || '')) continue;
    mesh.updateWorldMatrix(true, false);
    const pos = mesh.geometry.getAttribute('position'), idx = mesh.geometry.index;
    const point = new THREE.Vector3(), centroid = new THREE.Vector3();
    for (let i = 0; i < idx.count; i += 3) {
      centroid.set(0, 0, 0);
      for (let k = 0; k < 3; k++) centroid.add(point.fromBufferAttribute(pos, idx.getX(i+k)).applyMatrix4(mesh.matrixWorld));
      centroid.multiplyScalar(2/3);
      if (centroid.x > -62 && centroid.x < -55 && centroid.z > 12 && centroid.z < 22 && centroid.y > 5.6 && centroid.y < 9.2) {
        idx.setX(i+1, idx.getX(i)); idx.setX(i+2, idx.getX(i)); removedInteriorFaces++;
      }
    }
    idx.needsUpdate = true;
  }
  if (base) base.model.group.userData.removedOpenStairInteriorFaces = removedInteriorFaces;

  const north = campus.entries.find(e => e.id === 'b04n');
  const south = campus.entries.find(e => e.id === 'b04s');
  if (!north || !south) throw new Error('B04 bridge requires both towers');
  const centre = { b04n: [-29.428, 40.318], b04s: [-33.172, -21.327] };
  const point = new THREE.Vector3(), local = new THREE.Vector3();
  const removed = { b04n: false, b04s: false };
  function detachHalf(entry) {
    const [east, northing] = centre[entry.id];
    entry.model.group.updateWorldMatrix(true, false);
    // Drop only the exposed span. A short fragment at the surviving tower is
    // retained; fragments touching its main shell are outside this volume.
    entry.model.split((x, y, z) => {
      local.set(x, y, z);
      entry.model.group.worldToLocal(local);
      const E = local.x + east, N = northing - local.z, H = local.y;
      const span = entry.id === 'b04n' ? N > 9 && N < 17 : N > 2 && N < 10;
      const bridgeLevel = (H > 22 && H < 29.5) || (H > 33 && H < 40.5);
      return E > -35 && E < -26 && span && bridgeLevel ? -1 : 0;
    }, { point: point.set(entry.x, entry.baseY, entry.z), force: 0, kerfFly: 0 });
    removed[entry.id] = true;
  }
  const update = campus.update.bind(campus), reset = campus.reset.bind(campus);
  campus.update = (...args) => {
    if (north.cleared && !south.cleared && !removed.b04s) detachHalf(south);
    if (south.cleared && !north.cleared && !removed.b04n) detachHalf(north);
    return update(...args);
  };
  campus.reset = (...args) => {
    const result = reset(...args);
    removed.b04n = false; removed.b04s = false;
    return result;
  };
  return campus;
}
export async function createCampusAsync(THREE, pkg, options) {
  return connectBridgeSupports(THREE, pkg, await engine.createCampusAsync(THREE, pkg, options));
}
export function createCampus(THREE, pkg, options) {
  return connectBridgeSupports(THREE, pkg, engine.createCampus(THREE, pkg, options));
}
