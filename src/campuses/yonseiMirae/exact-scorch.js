// Campus-only: the finale must shade the displayed terrain, not its 4m
// collision proxy. The shared finale and clearing code remain unchanged.
export function createExactScorchHook(THREE) {
  let installed = false;
  return material => {
    const previous = material.onBeforeRender;
    material.onBeforeRender = function(renderer, scene, camera, geometry, object, group) {
      previous?.call(this, renderer, scene, camera, geometry, object, group);
      if (installed) return;
      let proxy = object;
      while (proxy && proxy.name !== 'continuous-estimated-terrain') proxy = proxy.parent;
      const surface = proxy?.getObjectByName('env-ground');
      if (!surface || !proxy.geometry) return;
      const started = performance.now(), meshes = [];
      surface.updateWorldMatrix(true, true);
      surface.traverse(node => { if (node.isMesh && !node.isInstancedMesh && node.geometry?.getAttribute('position')) meshes.push(node); });
      if (!meshes.length) return;
      const target = proxy.geometry, original = target.getAttribute('position');
      const prefixCount = original.count, inverse = proxy.matrixWorld.clone().invert();
      const arrays = new Map(), chunks = [], batches = [];
      let count = prefixCount, indices = 0;
      for (const mesh of meshes) {
        const position = mesh.geometry.getAttribute('position');
        if (position.isInterleavedBufferAttribute) throw new Error('Yonsei exact scorch expects packed glTF positions');
        const transform = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
        let variants = arrays.get(position.array.buffer);
        if (!variants) arrays.set(position.array.buffer, variants = new Map());
        const key = `${position.array.byteOffset}:${position.array.byteLength}:${transform.elements.join(',')}`;
        let chunk = variants.get(key);
        if (!chunk) { chunk = { position, transform, offset: count }; variants.set(key, chunk); chunks.push(chunk); count += position.count; }
        const index = mesh.geometry.index;
        batches.push({ index, count: index ? index.count : position.count, offset: chunk.offset });
        indices += index ? index.count : position.count;
      }
      const positions = new Float32Array(count * 3), index = new Uint32Array(indices), point = new THREE.Vector3();
      positions.set(original.array);
      for (const chunk of chunks) for (let i = 0; i < chunk.position.count; i++) {
        point.fromBufferAttribute(chunk.position, i).applyMatrix4(chunk.transform);
        point.toArray(positions, (chunk.offset + i) * 3);
      }
      let cursor = 0;
      for (const batch of batches) for (let i = 0; i < batch.count; i++) index[cursor++] = batch.offset + (batch.index ? batch.index.getX(i) : i);
      // Keep the original BufferAttribute and its prefix: flatCleared cached
      // references/vertex indices still address their original hidden proxy.
      // Only appended, exact terrain indices are drawn by the scorch mesh.
      // projectObject may already have uploaded the invisible proxy before
      // any material callback runs. Release its old GPU buffers before growing
      // the retained attribute; the JS geometry/attribute references survive.
      target.dispose();
      original.array = positions; original.count = count; original.needsUpdate = true;
      target.setIndex(new THREE.BufferAttribute(index, 1));
      target.clearGroups(); target.setDrawRange(0, indices);
      target.computeBoundingBox(); target.computeBoundingSphere();
      const scorch = scene.getObjectByName('campus-finale-scorched-ground');
      if (scorch) { scorch.material.side = THREE.DoubleSide; scorch.material.needsUpdate = true; }
      installed = true;
      proxy.userData.exactScorch = { source: 'env-ground actual transformed triangles', triangles: indices / 3,
        exactVertices: count - prefixCount, preservedProxyVertices: prefixCount, positionChunks: chunks.length,
        bytes: positions.byteLength + index.byteLength, installMs: +(performance.now() - started).toFixed(2),
        originalAttributePreserved: target.getAttribute('position') === original,
        finaleGeometryShared: !scorch || scorch.geometry === target };
    };
    return false;
  };
}
