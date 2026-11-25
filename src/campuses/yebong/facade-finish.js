// These are explicitly modelled exterior finishes, including the open 2F balcony.
// The generic interior heuristic can misclassify faces in the concave entrance
// recess. Keep their authored coating while retaining the normal fragment,
// impact, laser, lighting and destruction shaders. No global engine patch.
export function preserveYebongExteriorFinishes(THREE, id, scene) {
  const owned = [], names = [];
  const exterior = /__(?:frame|window-reveal|window-sill-metal|core-balcony-(?:tile|soffit|aluminium)|core-ochre-columns|deck-mustard-column|plaza-wall-mirror-\d+|plaza-mirror-frame|plaza-mirror-glint)$/;
  scene.traverse(object => {
    if (!object.isMesh) return;
    const apply = source => {
      if (!exterior.test(source.name)) return source;
      const material = source.clone(), prior = source.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        prior?.call(material, shader, renderer);
        // Expand only this finish's standard colour chunk before the shared
        // fragment shader sees it. Its optional interior repaint then has no
        // marker to replace; all later fragment animation hooks remain intact.
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', THREE.ShaderChunk.color_fragment);
      };
      material.customProgramCacheKey = () => 'yebong-exterior-finish-v4:' + source.name;
      owned.push(material); names.push(source.name); return material;
    };
    object.material = Array.isArray(object.material) ? object.material.map(apply) : apply(object.material);
  });
  return { stats: { exteriorFinishMaterials: [...new Set(names)] }, dispose() { for (const m of owned) m.dispose(); } };
}
