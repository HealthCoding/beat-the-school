// Kookmin only: soften distant context facades by camera distance, never campus planting or paving.
// Positions, heights and opacity stay intact; the current time-of-day fog colour supplies the haze.
export function applyKookminBackdropFade(material, worldUnitsPerMeter = 1, settings = {}) {
  if (!/^(fac-|roof-flat$|shopfront$|stone-plinth$|hanok-|giwa$|ridge$|wall-cap$)/.test(material.name || '')) return false;
  if (material.userData.kookminBackdropFade) return true;
  material.userData.kookminBackdropFade = true;
  const near = (settings.near_m ?? 180) * worldUnitsPerMeter, far = (settings.far_m ?? 620) * worldUnitsPerMeter;
  const strength = settings.strength ?? .86;
  const previous = material.onBeforeCompile, key = material.customProgramCacheKey;
  material.onBeforeCompile = shader => {
    if (previous) previous(shader);
    shader.vertexShader = 'varying vec2 vKookminBackdropXZ;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvKookminBackdropXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = 'varying vec2 vKookminBackdropXZ;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `
#ifdef USE_FOG
  float kookminBackdropDistance = length(vKookminBackdropXZ - cameraPosition.xz);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, ${strength.toFixed(4)} * smoothstep(${near.toFixed(4)}, ${far.toFixed(4)}, kookminBackdropDistance));
#endif
#include <fog_fragment>`);
  };
  material.customProgramCacheKey = () => (key ? key.call(material) : '') + '|kookmin-context-distance-' + [near, far, strength].join(',');
  material.needsUpdate = true;
  return true;
}
