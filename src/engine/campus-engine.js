// Campus-independent assembly: places a campus package's models, terrain and ground into one group
// and exposes the destructible campus API. Everything school-specific comes in through `pkg`
// (see src/campuses/yonsei/index.js); this module never imports campus data itself.
import { createCampusMaterials } from '../campus-materials.js?v=realism14';
import { createModelDestructible, fragmentJob, prepareFragmentJob } from '../model-destruction.js?v=lz69';
import { createCampusFinale, emptyFinaleDamage } from '../campus-finale.js?v=demo18';
import { createCampusGround } from './ground.js';
import { createCampusTerrain } from './terrain.js';
import { createBakedGround } from './baked-ground.js?v=lr01';
import { createHazardTape } from './hazard-tape.js?v=tape41';
import { loadGroundBake, groundBakeMismatch, createBakedCampusGround, groundBakeStatus } from './ground-bake.js';

// Borrowed original source resources are never disposed by this wrapper.
export function createCampusSource(THREE, pkg, assets, id) {
  if (pkg.models.proceduralIds.includes(id)) return pkg.models.createProceduralSource(THREE, id);
  if (!assets?.has(id)) throw new Error(`Approved campus model missing: ${id}`);
  const scene = assets.createScene(id), facade = pkg.models.enhanceFacade(THREE, id, scene);
  return { scene, stats: facade.stats, dispose: () => facade.dispose() };
}
// `interior` (on by default since 10-17; ?classic / &interior=off: null): the dynamically imported src/interior-fill.js module.
// It adds floor slabs etc. to the source scene before fragmentation; without it this is exactly the former build.
// A building is prepared in two halves (src/model-destruction.js): startBuilding = source scene + plain-data job + the heavy
// computation (interior fill, clipping, vertex sharing: in a worker of `pool`, else here), finishBuilding = THREE objects.
// The result is identical to the former one-pass build (검증/runtime-prep-equivalence-check.mjs).
export function startBuilding(THREE, pkg, assets, id, interior = null, pool = null) {
  const source = createCampusSource(THREE, pkg, assets, id);
  try {
    const job = fragmentJob(THREE, id, source.scene, { interior: Boolean(interior) });
    const local = () => prepareFragmentJob(job, interior);
    const built = { id, source, job, where: pool ? 'worker' : 'main' };
    // Any worker problem (or a data error there) recomputes on the main thread, which then throws a real error itself.
    built.data = pool ? pool.run(job).catch(error => { if (!error?.fallback) throw error; built.where = 'main'; return local(); }) : local();
    return built;
  } catch (error) { source.dispose(); throw error; }
}
export function finishBuilding(THREE, built, data, interior = null) {
  const { id, source, job } = built;
  let interiorMaterial = null;
  try {
    const materials = [...job.materialObjects];
    if (data.interiorMaterial) { interiorMaterial = interior.createInteriorMaterial(THREE, id); materials.push(interiorMaterial); }
    const model = createModelDestructible(THREE, id, source.scene, { maxDebris: 64, ...(interior ? { interior: true } : {}), prepared: { data, materials } });
    model.facadeStats = source.stats; if (interior) model.interiorStats = data.interiorStats;
    Object.defineProperty(model, 'prepSource', { value: built.where, enumerable: false });
    return model;
  } finally { interiorMaterial?.dispose(); source.dispose(); }
}
function buildModel(THREE, pkg, assets, id, interior = null) {
  const built = startBuilding(THREE, pkg, assets, id, interior);
  return finishBuilding(THREE, built, built.data, interior);
}
const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));
// ?ground=live builds a baked campus ground (pkg.ground.bake, src/engine/ground-bake.js) at load time as before, for comparison.
const groundModeFromPage = () => { try { return new URLSearchParams(globalThis.location?.search || '').get('ground'); } catch { return null; } };
// A cleared building's baked ground is lowered to its pad (src/engine/baked-ground.js createClearedFlattening; user decision
// 10-23 option B, on by default since the user saw the pairs). ?flatcleared=0 turns it off on any host (debugging / comparison).
const flatClearedFromPage = () => { try { return new URLSearchParams(globalThis.location?.search || '').get('flatcleared') !== '0'; } catch { return true; } };
// modelAssets: a finished model cache (Map with has/createScene), or a stream from streamPackageModels (src/model-assets.js).
// With a stream every building starts preparing as soon as its own model has arrived (in a worker of `pool` when given),
// while the remaining models and the ground/context keep downloading. THREE objects are only created once every model
// has loaded, in placement order, as before - so object/material order (draw order) and the campus are unchanged.
// onProgress counts prepared buildings.
export async function createCampusAsync(THREE, pkg, { modelAssets, onProgress = () => {}, reducedMotion = false, interior = null, pool = null, groundMode = groundModeFromPage() } = {}) {
  const preparedModels = new Map(), started = new Map();
  // A package with a ground bake (yonsei, korea) makes the ground textures in a worker while the models load and fetches the
  // bake once every campus model has arrived (modelsIn: it never takes bandwidth from the models) while the buildings are
  // assembled; if anything fails the ground is built live below. Packages without pkg.ground.bake never start this.
  let modelsIn = () => {}; const modelsArrived = new Promise(resolve => { modelsIn = resolve; });
  const groundBake = pkg.ground.bake && groundMode !== 'live'
    ? loadGroundBake(pkg.ground.bake, { after: modelsArrived }).catch(error => { console.warn('Ground bake unavailable; building the campus ground live', error); return { error }; })
    : null;
  if (pkg.ground.bake && !groundBake) Object.assign(groundBakeStatus, { campus: pkg.id, source: 'live', reason: 'ground=live', ms: null });
  const stream = typeof modelAssets?.whenModel === 'function' ? modelAssets : null;
  let prepared = 0, failed = null;
  try {
    // Main-thread preparation runs one building per task so the loading screen and model parsing keep going.
    let chain = Promise.resolve();
    const begin = id => {
      const task = chain.then(async () => {
        if (failed) throw failed;
        const built = startBuilding(THREE, pkg, modelAssets, id, interior, pool);
        started.set(id, built);
        if (!pool) await nextTask();
        built.data = await built.data;
        onProgress({ loaded: ++prepared, total: pkg.placements.length, id });
        return built;
      });
      // Workers: start the next building right away; main thread: one after another.
      chain = pool ? Promise.resolve() : task.catch(() => {});
      task.catch(error => { failed ??= error; });
      return task;
    };
    const tasks = new Map();
    if (stream) {
      const order = pkg.placements.map(({ id }) => id);
      await Promise.all(order.map(id => (pkg.models.proceduralIds.includes(id) ? Promise.resolve() : stream.whenModel(id)).then(() => { tasks.set(id, begin(id)); })));
    } else for (const { id } of pkg.placements) tasks.set(id, begin(id));
    const assets = stream ? await stream.done : modelAssets;
    modelsIn();
    for (const { id } of pkg.placements) {
      const built = await tasks.get(id);
      preparedModels.set(id, finishBuilding(THREE, built, built.data, interior)); started.delete(id);
      // Give loading text and input processing a frame between building assemblies.
      await nextTask();
    }
    // Same synchronous assembly steps, with a macrotask between terrain/ground stages
    // so the loading screen keeps painting during the final campus assembly.
    const steps = campusAssemblySteps(THREE, pkg, { modelAssets: assets, preparedModels, reducedMotion, interior, groundBake: groundBake ? await groundBake : null });
    for (;;) {
      const step = steps.next();
      if (step.done) return step.value;
      await nextTask();
    }
  } catch (error) {
    failed ??= error; modelsIn();
    for (const model of preparedModels.values()) model.dispose();
    for (const built of started.values()) built.source.dispose();
    throw error;
  }
}
export function createCampus(THREE, pkg, options = {}) {
  const steps = campusAssemblySteps(THREE, pkg, options);
  for (;;) { const step = steps.next(); if (step.done) return step.value; }
}
function fromGroundBake(THREE, pkg, { bake, pixels = null, error = null, timing = null }, { entries, terrain, reducedMotion }) {
  const status = { campus: pkg.id, source: 'live', reason: null, ms: null, timing: timing && { ...timing, usedAt: Math.round(performance.now()) } };
  try {
    status.reason = error ? `load: ${error.message || error}` : groundBakeMismatch(bake, { campus: pkg.id, entries, terrain, environment: pkg.environment });
    if (status.reason) { if (!error) console.warn(`Ground bake not used (${status.reason}); building the campus ground live`); return null; }
    const t0 = performance.now();
    const scenery = createBakedCampusGround(THREE, { entries, terrain, reducedMotion, profile: pkg.ground, environment: pkg.environment, worldUnitsPerMeter: pkg.geo.worldUnitsPerMeter, bake, pixels });
    Object.assign(status, { source: 'bake', textures: pixels ? 'worker' : 'main', ms: +(performance.now() - t0).toFixed(1) });
    return scenery;
  } catch (failure) {
    status.reason = `build: ${failure.message || failure}`; console.warn('Ground bake failed; building the campus ground live', failure); return null;
  } finally { for (const key of Object.keys(groundBakeStatus)) delete groundBakeStatus[key]; Object.assign(groundBakeStatus, status); }
}
function* campusAssemblySteps(THREE, pkg, { modelAssets, preparedModels, reducedMotion = false, interior = null, groundBake = null } = {}) {
  const required = pkg.placements.filter(p => !pkg.models.proceduralIds.includes(p.id));
  if (!modelAssets || required.some(p => !modelAssets.has(p.id))) {
    throw new Error(`All ${required.length} campus models must load before campus creation`);
  }
  const group = new THREE.Group(); group.name = 'approved-model-campus';
  const entries = [];
  let scenery, terrain;
  const finishes = createCampusMaterials(THREE);
  try {
    for (const placement of pkg.placements) {
      const { id, name, code, x, z, rotation = 0 } = placement;
      const model = preparedModels?.get(id) || buildModel(THREE, pkg, modelAssets, id, interior);
      for (const mesh of model.meshes) finishes.apply(mesh.material);
      const size = model.bounds.getSize(new THREE.Vector3());
      const center = model.bounds.getCenter(new THREE.Vector3());
      const scale = pkg.geo.worldUnitsPerMeter;
      model.group.scale.setScalar(scale); model.group.rotation.y = rotation;
      const anchor = placement.modelAnchor || center;
      const offset = new THREE.Vector3(anchor.x, model.bounds.min.y, anchor.z).multiplyScalar(scale).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
      model.group.position.set(x - offset.x, -offset.y, z - offset.z);
      group.add(model.group); model.group.updateMatrixWorld(true);
      const worldBounds = model.worldBounds.clone();
      // Placement anchors follow the mapped main body; asymmetric stairs/canopies
      // must not shift it. Runtime bounds stay centered for ground clearance.
      const placedCenter = center.clone().applyMatrix4(model.group.matrixWorld);
      const entry = { id, name, code, x: placement.modelAnchor ? placedCenter.x : x, z: placement.modelAnchor ? placedCenter.z : z, rotation, w: size.x * scale, d: size.z * scale,
        source: placement.source, sourceSize: size.clone(), modelScale: scale,
        ...(placement.modelBaseOffset_m ? { modelBaseOffset: placement.modelBaseOffset_m * scale } : {}), model, worldBounds, cleared: false };
      for (const mesh of model.meshes) mesh.userData.entry = entry;
      entries.push(entry);
    }
    yield 'placed';
    terrain = createCampusTerrain(entries, pkg.terrain.heightGrids ? { ...pkg.terrain, worldUnitsPerMeter: pkg.geo.worldUnitsPerMeter } : pkg.terrain);
    yield 'terrain';
    for (const entry of entries) {
      entry.baseY = terrain.buildingHeight(entry);
      // Exposed lower storeys may sit below the entrance terrace. Keep its
      // ground pad at baseY while shifting only the building model.
      entry.model.group.position.y += entry.baseY + (entry.modelBaseOffset || 0);
      entry.model.setGroundHeight(terrain.heightAt);
      entry.model.group.updateMatrixWorld(true);
      entry.worldBounds.copy(entry.model.worldBounds);
      // Preserve the oriented source envelope instead of fitting empty world-AABB corners.
      const b = entry.model.bounds; entry.focusPoints = [];
      for (const x of [b.min.x,b.max.x]) for (const y of [b.min.y,b.max.y]) for (const z of [b.min.z,b.max.z])
        entry.focusPoints.push(new THREE.Vector3(x,y,z).applyMatrix4(entry.model.group.matrixWorld));
    }
    yield 'grounded';
    // A baked ground (pkg.ground.baked) is read from the model cache; every other campus builds its ground here as before.
    // A pre-computed procedural ground (pkg.ground.bake + groundBake = { bake, pixels }) is used only when it was made for these
    // buildings and this terrain; otherwise (and for every package without one) the ground is built here as before.
    scenery = pkg.ground.baked
      ? createBakedGround(THREE, { entries, terrain, profile: pkg.ground, modelAssets, worldUnitsPerMeter: pkg.geo.worldUnitsPerMeter, flatCleared: flatClearedFromPage() ? pkg.hazardTape?.footprints || null : null })
      : (groundBake ? fromGroundBake(THREE, pkg, groundBake, { entries, terrain, reducedMotion }) : null)
        ?? createCampusGround(THREE, { entries, terrain, reducedMotion, profile: pkg.ground, environment: pkg.environment, terrainProfile: pkg.terrain, worldUnitsPerMeter: pkg.geo.worldUnitsPerMeter });
    group.add(scenery.group);
  } catch (error) {
    for (const entry of entries) entry.model.dispose();
    scenery?.dispose(); finishes.dispose(); group.clear(); throw error;
  }
  group.updateMatrixWorld(true);
  // Hazard tape (pkg.hazardTape only): one ground band around each destructible building, on the visible baked ground.
  let tape = null;
  if (pkg.hazardTape) {
    yield 'ground';
    try {
      const surfaceRoots = pkg.ground.baked ? pkg.ground.baked.envIds.filter(id => id === 'env-ground' || id === 'env-site' || id.startsWith('site-')).map(id => scenery.group.getObjectByName(id)).filter(Boolean) : [];
      tape = createHazardTape(THREE, { entries, spec: pkg.hazardTape, terrain, surfaceRoots, worldUnitsPerMeter: pkg.geo.worldUnitsPerMeter });
      if (tape) group.add(tape.mesh);
    } catch (error) { console.warn('Hazard tape skipped', error); tape = null; }
  }
  // A broad backdrop must not make the playable campus shrink in overview.
  const bounds = new THREE.Box3();
  for (const entry of entries) bounds.union(entry.worldBounds);
  if (scenery.playBounds || scenery.bounds) bounds.union(scenery.playBounds || scenery.bounds);
  const coreBounds = new THREE.Box3();
  for (const entry of entries) if (pkg.coreIds.includes(entry.id)) coreBounds.union(entry.worldBounds);
  const totalWeight = entries.reduce((sum, entry) => sum + entry.model.totalWeight, 0);
  let clearedCount = 0, disposed = false, visualRevision=0, flattenedCount = 0;
  const finale = createCampusFinale(THREE, { entries, scenery, group, clearEntry(entry) {
    const result = emptyFinaleDamage();
    if (entry.cleared) return result;
    const damage = entry.model.explode();
    result.count = damage.count; result.weight = damage.weight;
    entry.cleared = true; clearedCount++; result.cleared.push(entry); result.affected.push(entry);
    return result;
  } });
  const api = {
    group, entries, terrain, meshes: entries.flatMap(entry => entry.model.meshes), bounds, coreBounds, totalWeight,
    get hazardTape() { return tape ? { ...tape.stats, visibleBuildings: tape.visibleBuildings } : null; },
    materialStats: finishes.stats, source: 'approved-plus-reference-models', approvedCount:pkg.approvedCount, additionalCount:pkg.additionalCount, layoutSource: 'geographic-common-scale', worldUnitsPerMeter: pkg.geo.worldUnitsPerMeter, sceneryStats: scenery.stats,
    get destroyedWeight() {
      if (clearedCount === entries.length) return totalWeight;
      return entries.reduce((sum, entry) => sum + entry.model.destroyedWeight, 0);
    },
    get visualRevision(){return visualRevision;},
    get movingDebris(){return entries.some(e=>e.model.flyingCount>0);},
    get finale(){return finale.state;},
    get clearedCount() { return clearedCount; },
    get remaining() { return entries.length - clearedCount; },
    hit(point, radius = 3.6, force = 10, options = {}) {
      const result = { count: 0, weight: 0, cleared: [], affected: [] };
      if (disposed || !point || ![point.x, point.y, point.z, radius, force].every(Number.isFinite)) return result;
      const safeRadius = Math.max(0, radius);
      for (const entry of entries) {
        entry.worldBounds.copy(entry.model.worldBounds);
        if (entry.cleared || entry.worldBounds.distanceToPoint(point) > safeRadius) continue;
        const damage = entry.model.hit(point, safeRadius, force, options);
        if (!damage.count) continue;
        result.count += damage.count; result.weight += damage.weight; result.affected.push(entry);
        if (entry.model.destroyedWeight / entry.model.totalWeight >= .88) {
          const bonus = entry.model.explode(); result.count += bonus.count; result.weight += bonus.weight;
          entry.cleared = true; clearedCount++; result.cleared.push(entry);
        }
        entry.worldBounds.copy(entry.model.worldBounds);
      }
      if(result.count)visualRevision++;
      return result;
    },
    // Flamethrower char (src/model-destruction.js scorch): same clearing rule as hit(); `charred` counts tinted fragments.
    scorch(point, radius = 2.4, amount = .1, options = {}) {
      const result = { count: 0, weight: 0, cleared: [], affected: [], charred: 0 };
      if (disposed || !point || ![point.x, point.y, point.z, radius, amount].every(Number.isFinite)) return result;
      for (const entry of entries) {
        if (entry.cleared || entry.worldBounds.distanceToPoint(point) > radius) continue;
        const damage = entry.model.scorch(point, radius, amount, options);
        result.charred += damage.charred || 0;
        if (!damage.count) continue;
        result.count += damage.count; result.weight += damage.weight; result.affected.push(entry);
        if (entry.model.destroyedWeight / entry.model.totalWeight >= .88) {
          const bonus = entry.model.explode(); result.count += bonus.count; result.weight += bonus.weight;
          entry.cleared = true; clearedCount++; result.cleared.push(entry);
        }
      }
      if (result.count) visualRevision++;
      return result;
    },
    // Laser cutter (src/model-destruction.js split): one building cut along the drawn path; same clearing rule as hit().
    // `chunk` is the held falling cluster ({ pieces, handle, model, entry }) the laser module animates, or null.
    cut(entry, classify, options = {}) {
      const result = { count: 0, weight: 0, cleared: [], affected: [], kerf: [], chunk: null };
      if (disposed || !entry || entry.cleared || !entries.includes(entry) || typeof entry.model.split !== 'function') return result;
      const damage = entry.model.split(classify, options);
      if (!damage.count) return result;
      result.count = damage.count; result.weight = damage.weight; result.kerf = damage.kerf; result.affected.push(entry);
      if (damage.chunk.length) result.chunk = { pieces: damage.chunk, handle: damage.handle, model: entry.model, entry };
      if (entry.model.destroyedWeight / entry.model.totalWeight >= .88) {
        const bonus = entry.model.explode(); result.count += bonus.count; result.weight += bonus.weight;
        entry.cleared = true; clearedCount++; result.cleared.push(entry);
      }
      entry.worldBounds.copy(entry.model.worldBounds); visualRevision++;
      return result;
    },
    startFinale(point, options = {}) {
      if (disposed) return false;
      const started = finale.start(point, options);
      if (started) visualRevision++;
      return started;
    },
    reset() {
      if (disposed) return;
      finale.reset();
      for (const entry of entries) {
        entry.model.reset(); entry.cleared = false; entry.worldBounds.copy(entry.model.worldBounds);
      }
      clearedCount = 0;visualRevision++; tape?.reset(); scenery.restoreCleared?.(); flattenedCount = 0;
    },
    update(dt, time = 0) {
      if (disposed) return emptyFinaleDamage();
      const step = finale.update(dt);
      if (step.changed) visualRevision++;
      for (const entry of entries) entry.model.update(dt);
      // flatcleared prototype: lower the ground of buildings cleared since the last frame (every clear path counts clearedCount)
      if (scenery.flattenCleared && flattenedCount !== clearedCount) { flattenedCount = clearedCount; for (const entry of entries) if (entry.cleared && scenery.flattenCleared(entry)) visualRevision++; }
      tape?.update(dt);
      if (!finale.state.sceneryCleared && Number.isFinite(time)) scenery.update(time);
      return step.result;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      finale.dispose(); tape?.dispose();
      for (const entry of entries) entry.model.dispose();
      scenery.dispose(); finishes.dispose(); group.removeFromParent(); group.clear();
    },
  };
  return api;
}
