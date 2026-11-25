const SUNAE_DISPLAY={fade:{r0_m:80,r1_m:240}};
// R4 game context only: retain real heights and mute the backdrop in the active time-of-day fog colour.
export function createSunaeGroundLook(THREE, { worldUnitsPerMeter: W }) {
  return material => {
    if (!/^ctx-/.test(material.name)) return false;
    material.color.lerp(new THREE.Color('#858b88'), .35);
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vContextWorld;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvContextWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
      // fogColor is already in the renderer output space, just like Three's fog_fragment.
      // Blend after tone mapping / colour conversion so the horizon does not turn white.
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vContextWorld;')
        .replace('#include <fog_fragment>', `#include <fog_fragment>\nfloat cf=0.66+0.28*smoothstep(${(SUNAE_DISPLAY.fade.r0_m*W).toFixed(3)},${(SUNAE_DISPLAY.fade.r1_m*W).toFixed(3)},length(vContextWorld.xz));gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,cf);`);
    };
    material.customProgramCacheKey = () => 'sunae-hq-context-fade-r3';
    material.needsUpdate = true;
    return true;
  };
}
