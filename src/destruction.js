import { CAMPUS } from './campus-data.js';
import { HERITAGE_IDS, buildHeritage } from './heritage.js';
import { buildModern } from './modern.js';

export const BUILDINGS = CAMPUS.buildings.map(([id,name,,,,tw,td])=>({id,name,w:tw*2,d:td*2}));

// Reuse the unchanged original artwork, including every window, roof and colour.
function capture(building) {
  const boxes = [];
  const kit = {
    box(x, y, z, w, h, d, color) {
      if (![x, y, z, w, h, d].every(Number.isFinite) || Math.min(w, h, d) <= 0) {
        throw new Error(`Invalid source box in ${building.id}`);
      }
      boxes.push({ x, y, z, w, h, d, color });
    },
    collider() {},
  };
  const metadata = HERITAGE_IDS.includes(building.id) ? buildHeritage(kit,building) : buildModern(kit,building);
  return { boxes, metadata };
}

export function createDestructible(THREE, id) {
  const building = BUILDINGS.find(item => item.id === id);
  if (!building) throw new Error(`Unknown building: ${id}`);
  const { boxes, metadata } = capture(building);
  let chunkSize = 2.3;
  const estimate = () => boxes.reduce((sum, b) => sum
    + Math.ceil(b.w / chunkSize) * Math.ceil(b.h / chunkSize) * Math.ceil(b.d / chunkSize), 0);
  // Safety valve for future additions; current campus models stay comfortably below it.
  while (estimate() > 6000) chunkSize *= 1.12;
  const pieces = [];
  for (const b of boxes) {
    const nx = Math.ceil(b.w / chunkSize), ny = Math.ceil(b.h / chunkSize), nz = Math.ceil(b.d / chunkSize);
    const sx = b.w / nx, sy = b.h / ny, sz = b.d / nz;
    for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) {
      const position = new THREE.Vector3(
        b.x - b.w / 2 + (x + .5) * sx,
        b.y - b.h / 2 + (y + .5) * sy,
        b.z - b.d / 2 + (z + .5) * sz,
      );
      pieces.push({
        position, scale: new THREE.Vector3(sx, sy, sz), active: true,
        color: b.color, weight: Math.min(12, Math.max(.001, sx * sy * sz)),
        quaternion: new THREE.Quaternion(), velocity: new THREE.Vector3(),
        spin: new THREE.Vector3(), age: 0, lifetime: 0, hidden: false,
      });
    }
  }

  const group = new THREE.Group();
  group.name = building.name;
  group.userData.buildingId = id;
  group.userData.description = metadata.description;
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material=new THREE.MeshStandardMaterial({roughness:.88,metalness:.02});
  const mesh=new THREE.InstancedMesh(geometry,material,pieces.length);
  mesh.name=`${id}-blocks`;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.userData.pieceLookup=pieces;group.add(mesh);
  const meshes=[mesh];
  pieces.forEach((piece,index)=>{piece.mesh=mesh;piece.index=index;});
  const matrix = new THREE.Matrix4();
  const zeroScale = new THREE.Vector3(0, 0, 0);
  const animatedScale = new THREE.Vector3();
  const color = new THREE.Color();
  pieces.forEach(piece => {
    matrix.compose(piece.position, piece.quaternion, piece.scale);
    piece.mesh.setMatrixAt(piece.index, matrix);
    piece.mesh.setColorAt(piece.index, color.set(piece.color));
  });
  for(const mesh of meshes){mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;}
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  const totalWeight = pieces.reduce((sum, piece) => sum + piece.weight, 0);
  let destroyedWeight = 0, destroyedCount = 0, disposed = false;
  const flying = [];
  const direction = new THREE.Vector3();
  const spinStep = new THREE.Quaternion();
  const spinEuler = new THREE.Euler();

  function release(piece, origin, force) {
    piece.active = false;
    destroyedCount++;
    destroyedWeight += piece.weight;
    direction.subVectors(piece.position, origin);
    if (direction.lengthSq() < .00001) direction.set(Math.random() - .5, .4, Math.random() - .5);
    direction.normalize();
    const power = 3 + .7 * force;
    piece.velocity.copy(direction).multiplyScalar(power * (.7 + Math.random() * .7));
    piece.velocity.x += (Math.random() - .5) * 3;
    piece.velocity.z += (Math.random() - .5) * 3;
    piece.velocity.y = Math.max(2.4, piece.velocity.y) + 3 + force * .24;
    piece.spin.set((Math.random() - .5) * 9, (Math.random() - .5) * 9, (Math.random() - .5) * 9);
    piece.age = 0;
    piece.lifetime = 2.5 + Math.random() * .8;
    flying.push(piece);
    // Make the final ratio exactly one despite floating-point summation order.
    if (destroyedCount === pieces.length) destroyedWeight = totalWeight;
  }

  // Keep airborne rubble visible but exclude it from targeting. The original
  // InstancedMesh raycast identifies each block by instanceId.
  for(const mesh of meshes){const instanceRaycast = mesh.raycast.bind(mesh);
  mesh.raycast = (raycaster, intersects) => {
    const candidates = [];
    instanceRaycast(raycaster, candidates);
    for (const candidate of candidates) if (mesh.userData.pieceLookup[candidate.instanceId]?.active) intersects.push(candidate);
  };}

  const api = {
    group, meshes, pieces, bounds, totalWeight, height: metadata.height,
    get reacting() { return false; },
    get worldBounds() {
      group.updateWorldMatrix(true, false);
      return bounds.clone().applyMatrix4(group.matrixWorld);
    },
    localToWorld(point) { group.updateWorldMatrix(true, false); return group.localToWorld(point); },
    get destroyedWeight() { return destroyedWeight; },
    get destroyedCount() { return destroyedCount; },
    get remaining() { return pieces.length - destroyedCount; },
    hit(point, radius = 2.8, force = 1) {
      if (disposed || !point || ![point.x, point.y, point.z, radius, force].every(Number.isFinite)) return { count: 0, weight: 0 };
      group.updateWorldMatrix(true, false);
      const origin = group.worldToLocal(point.clone());
      const worldScale = group.getWorldScale(new THREE.Vector3());
      const r = Math.max(0, radius);
      const strength = Math.max(0, Math.min(30, force));
      let count = 0, weight = 0;
      for (const piece of pieces) {
        if (!piece.active) continue;
        // Distance to the box surface, including thin roofs and facade details.
        const dx = Math.max(0, Math.abs(piece.position.x - origin.x) - piece.scale.x / 2);
        const dy = Math.max(0, Math.abs(piece.position.y - origin.y) - piece.scale.y / 2);
        const dz = Math.max(0, Math.abs(piece.position.z - origin.z) - piece.scale.z / 2);
        if ((dx*worldScale.x)**2+(dy*worldScale.y)**2+(dz*worldScale.z)**2 > r*r) continue;
        count++;
        weight += piece.weight;
        release(piece, origin, strength);
      }
      return { count, weight };
    },
    explode() {
      if (disposed) return { count: 0, weight: 0 };
      const origin = bounds.getCenter(new THREE.Vector3());
      let count = 0, weight = 0;
      for (const piece of pieces) if (piece.active) {
        count++;
        weight += piece.weight;
        release(piece, origin, 16);
      }
      return { count, weight };
    },
    update(dt) {
      if (disposed || !Number.isFinite(dt) || dt <= 0) return;
      if (!flying.length) return;
      const step = Math.min(.05, dt);
      for (let i = flying.length - 1; i >= 0; i--) {
        const piece = flying[i];
        piece.age += dt;
        if (piece.age >= piece.lifetime) {
          piece.hidden = true;
          matrix.compose(piece.position, piece.quaternion, zeroScale);
          piece.mesh.setMatrixAt(piece.index, matrix);
          flying.splice(i, 1);
          continue;
        }
        piece.velocity.y -= 19 * step;
        piece.position.addScaledVector(piece.velocity, step);
        const floor = Math.min(.7, piece.scale.y / 2);
        if (piece.position.y < floor) {
          piece.position.y = floor;
          piece.velocity.y = Math.abs(piece.velocity.y) * .28;
          piece.velocity.x *= .76;
          piece.velocity.z *= .76;
          piece.spin.multiplyScalar(.78);
        }
        spinEuler.set(piece.spin.x * step, piece.spin.y * step, piece.spin.z * step);
        spinStep.setFromEuler(spinEuler);
        piece.quaternion.multiply(spinStep).normalize();
        const shrink = Math.min(1, (piece.lifetime - piece.age) / .5);
        matrix.compose(piece.position, piece.quaternion, animatedScale.copy(piece.scale).multiplyScalar(shrink));
        piece.mesh.setMatrixAt(piece.index, matrix);
      }
      for(const mesh of meshes)mesh.instanceMatrix.needsUpdate=true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      flying.length = 0;
      for(const mesh of meshes){mesh.dispose();mesh.material.dispose();}
      geometry.dispose();
      group.removeFromParent();
      group.clear();
    },
  };
  return api;
}
