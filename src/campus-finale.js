// Campus-wide finale: whole-model clears are scheduled by distance instead of
// ray/triangle tests with a huge blast radius. Shared fragment limits still apply.
export const FINALE_BUILDINGS_PER_FRAME = 2;
export const emptyFinaleDamage = () => ({ count: 0, weight: 0, cleared: [], affected: [] });

// Preserve by default, regardless of loader or nesting. Context (including its
// forest/props) and protected branches override removable campus vegetation.
function removableScenery(root) {
  const objects = [];
  function visit(object, removable = false) {
    const name = object.name || '', data = object.userData || {};
    if (/^(context|protected|shield)(?:[-_]|$)/.test(name) || data.protectedSite ||
        data.destructible === false || data.finale === 'preserve') return;
    removable ||= data.finale === 'remove' || name === 'env-planting' ||
      name === 'detailed-campus-furniture' || name === 'rounded-low-planting-beds' ||
      /(?:^|[-_])(tree|trees|hedge|hedges|shrub|shrubs)(?:[-_]|$)/.test(name);
    // Never hide a container: it may also contain a road, a protected object,
    // or a context branch. Unknown mixed meshes remain intact.
    if (removable && object.isMesh && object.children.length === 0) objects.push({ object, visible: object.visible });
    for (const child of object.children) visit(child, removable);
  }
  visit(root);
  return objects;
}

export function createCampusFinale(THREE, { entries, scenery, group, clearEntry }) {
  const ground = scenery.group.getObjectByName('continuous-estimated-terrain');
  if (!ground?.geometry) throw new Error('Campus finale requires the continuous terrain');
  const origin = new THREE.Vector3(), center = new THREE.Vector3();
  const scorchMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true,
    polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    uniforms: { blastOrigin: { value: new THREE.Vector2() }, blastRadius: { value: 0 }, burnOpacity: { value: .84 } },
    vertexShader: `varying vec2 groundPosition;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        groundPosition = world.xz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `varying vec2 groundPosition;
      uniform vec2 blastOrigin;
      uniform float blastRadius;
      uniform float burnOpacity;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1.0,0.0)),f.x),
                   mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0)),f.x),f.y);
      }
      void main() {
        float distanceFromBlast = distance(groundPosition, blastOrigin);
        float radial = distanceFromBlast / max(.01, blastRadius);
        float edge = pow(1.0-smoothstep(.06, 1.0, radial), 2.0);
        if (edge < .001) discard;
        float grain = noise(groundPosition*.37)*.7 + noise(groundPosition*2.7)*.3;
        vec3 ash = mix(vec3(.035,.032,.030), vec3(.105,.088,.068), grain);
        gl_FragColor = vec4(ash, edge*burnOpacity*(.82+.18*grain));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  // Borrow the existing terrain geometry: no copied vertex buffer or texture.
  // Only this material/mesh belongs to the finale and is disposed here.
  const scorch = new THREE.Mesh(ground.geometry, scorchMaterial);
  scorch.name = 'campus-finale-scorched-ground'; scorch.matrixAutoUpdate = false;
  scorch.visible = false; scorch.renderOrder = 1; group.add(scorch);
  const state = { active: false, finished: false, progress: 0, elapsed: 0, duration: 1.4,
    processed: 0, total: entries.length, lastBatchSize: 0, maxBatchSize: FINALE_BUILDINGS_PER_FRAME,
    origin, radius: 0, sceneryCleared: false };
  let queue = [], sceneryVisibility = [], maxRadius = 1, disposed = false;

  function finishScenery() {
    for (const { object } of sceneryVisibility) object.visible = false;
    state.sceneryCleared = true;
  }
  return {
    state, scorch,
    start(point, { duration = 1.4 } = {}) {
      if (disposed || state.active || state.finished || !point || ![point.x,point.y,point.z].every(Number.isFinite)) return false;
      origin.copy(point);
      state.active = true; state.finished = false; state.progress = 0; state.elapsed = 0;
      state.duration = Number.isFinite(duration) ? Math.max(.1, Math.min(8, duration)) : 1.4;
      state.processed = 0; state.lastBatchSize = 0; state.radius = 0; state.sceneryCleared = false;
      queue = entries.map(entry => {
        entry.worldBounds.getCenter(center);
        return { entry, distance: Math.hypot(center.x-origin.x, center.z-origin.z) };
      }).sort((a,b) => a.distance-b.distance || a.entry.id.localeCompare(b.entry.id));
      const farthest = Math.max(1, ...queue.map(item => item.distance));
      for (const item of queue) item.at = item.distance/farthest*state.duration*.84;
      sceneryVisibility = removableScenery(scenery.group);
      group.updateWorldMatrix(true, true);
      scorch.matrix.copy(ground.matrixWorld); scorch.matrix.elements[13] += .065;
      scorch.matrix.premultiply(group.matrixWorld.clone().invert());
      scorch.matrixWorldNeedsUpdate = true;
      ground.geometry.computeBoundingBox(); const box = ground.geometry.boundingBox;
      const localOrigin = ground.worldToLocal(origin.clone()), scale = ground.getWorldScale(new THREE.Vector3());
      // A circle contained inside the terrain, never a radius reaching its four
      // corners. The visual burn is independent of the campus-wide damage wave.
      const edgeDistance = Math.min(localOrigin.x-box.min.x, box.max.x-localOrigin.x,
        localOrigin.z-box.min.z, box.max.z-localOrigin.z) * Math.min(Math.abs(scale.x), Math.abs(scale.z));
      maxRadius = Math.max(0, Math.min(farthest*.85, edgeDistance*.95));
      scorchMaterial.uniforms.blastOrigin.value.set(origin.x,origin.z);
      scorchMaterial.uniforms.blastRadius.value = 0; scorch.visible = true;
      return true;
    },
    update(dt) {
      const result = emptyFinaleDamage(); state.lastBatchSize = 0;
      if (disposed || !state.active || !Number.isFinite(dt) || dt <= 0) return { result, changed: false };
      state.elapsed += dt; state.progress = Math.min(1,state.elapsed/state.duration);
      state.radius = state.progress*maxRadius; scorchMaterial.uniforms.blastRadius.value = state.radius;
      while (state.processed < queue.length && state.lastBatchSize < FINALE_BUILDINGS_PER_FRAME) {
        const item = queue[state.processed]; if (item.at > state.elapsed) break;
        const damage = clearEntry(item.entry);
        result.count += damage.count; result.weight += damage.weight;
        result.cleared.push(...damage.cleared); result.affected.push(...damage.affected);
        state.processed++; state.lastBatchSize++;
      }
      if (state.processed === queue.length && state.progress === 1) {
        finishScenery(); state.active = false; state.finished = true;
      }
      return { result, changed: true };
    },
    reset() {
      if (disposed) return;
      for (const { object, visible } of sceneryVisibility) object.visible = visible;
      sceneryVisibility = []; queue = []; scorch.visible = false;
      scorchMaterial.uniforms.blastRadius.value = 0;
      Object.assign(state,{active:false,finished:false,progress:0,elapsed:0,processed:0,lastBatchSize:0,radius:0,sceneryCleared:false});
      origin.set(0,0,0);
    },
    dispose() {
      if (disposed) return;
      disposed = true; queue = []; sceneryVisibility = []; state.active = false;
      scorch.removeFromParent(); scorchMaterial.dispose();
    },
  };
}
