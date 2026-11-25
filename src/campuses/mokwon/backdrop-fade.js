// Mokwon only: soften distant context facades by camera distance, never campus planting or paving.
// Positions, heights and opacity stay intact; the current time-of-day fog colour supplies the haze.
export function applyMokwonBackdropFade(material, worldUnitsPerMeter = 1, settings = {}) {
  if (!/^(fac-|roof-flat$|shopfront$|stone-plinth$|hanok-|giwa$|ridge$|wall-cap$)/.test(material.name || '')) return false;
  if (material.userData.mokwonBackdropFade) return true;
  material.userData.mokwonBackdropFade = true;
  const near = (settings.near_m ?? 180) * worldUnitsPerMeter, far = (settings.far_m ?? 620) * worldUnitsPerMeter;
  const strength = settings.strength ?? .86;
  const previous = material.onBeforeCompile, key = material.customProgramCacheKey;
  material.onBeforeCompile = shader => {
    if (previous) previous(shader);
    shader.vertexShader = 'varying vec2 vMokwonBackdropXZ;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvMokwonBackdropXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = 'varying vec2 vMokwonBackdropXZ;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `
#ifdef USE_FOG
  float mokwonBackdropDistance = length(vMokwonBackdropXZ - cameraPosition.xz);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, ${strength.toFixed(4)} * smoothstep(${near.toFixed(4)}, ${far.toFixed(4)}, mokwonBackdropDistance));
#endif
#include <fog_fragment>`);
  };
  material.customProgramCacheKey = () => (key ? key.call(material) : '') + '|mokwon-context-distance-' + [near, far, strength].join(',');
  material.needsUpdate = true;
  return true;
}
