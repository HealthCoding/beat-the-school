// Large-scale ground variation for baked campus grounds (port of pilot/hanyang-seoul/preview.js applyLook, Claude 2026-10-18):
// world-space value noise at two periods (metres) modulates the tile albedo, mixes a rotated / scaled copy of the same tile
// (no visible repeat from afar) and, when a layer names a second tile, patches of it. No extra geometry.
// Only used when a campus package declares `ground.baked.look`; other campuses never load this module's shader.
const NOISE_GLSL = `varying vec3 vWPos;
uniform vec3 uTint; uniform float uAmp, uClump, uDry, uShare, uAnti, uAntiW, uSat; uniform sampler2D uMap2;
float gHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float gNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y); }
`;
const LOOK_MAP = `#ifdef USE_MAP
  vec2 gw = vWPos.xz;
  float n1 = gNoise(gw / LOOK_P1), n2 = gNoise(gw / LOOK_P2 + 17.3), n3 = gNoise(gw / 1.7 + 5.1);
  vec2 uvB = mat2(LOOK_RC, -LOOK_RS, LOOK_RS, LOOK_RC) * vMapUv * uAnti + vec2(0.37, 0.71);
  vec4 gTex = mix(texture2D(map, vMapUv), texture2D(map, uvB), uAntiW * (0.25 + 0.5 * smoothstep(0.3, 0.7, n1)));
  #ifdef LOOK_MAP2
    vec4 gTex2 = mix(texture2D(uMap2, vMapUv * 1.31 + 0.21), texture2D(uMap2, uvB * 1.9), 0.5);
    gTex = mix(gTex, gTex2, smoothstep(1.0 - uShare - 0.08, 1.0 - uShare + 0.08, n2 * 0.75 + n3 * 0.25));
  #endif
  vec3 gCol = gTex.rgb * uTint * (1.0 + uAmp * (2.0 * (n1 * 0.55 + n2 * 0.45) - 1.0)) * (1.0 - uClump * smoothstep(0.45, 0.85, n3));
  gCol = mix(gCol, gCol * vec3(1.12, 1.03, 0.76), uDry * smoothstep(0.55, 0.85, n1 * 0.4 + n2 * 0.6));
  gCol = mix(vec3(dot(gCol, vec3(0.2126, 0.7152, 0.0722))), gCol, uSat);
  diffuseColor.rgb *= gCol;
#endif`;

export function applyGroundLook(THREE, material, layer, tint, macro, { worldUnitsPerMeter = 1, map2 = null } = {}) {
  const a = macro.antiTileRotate_deg * Math.PI / 180;
  const t = tint == null ? [1, 1, 1] : typeof tint === 'string' ? (c => [c.r, c.g, c.b])(new THREE.Color(tint)) : tint;
  const u = { uTint: { value: new THREE.Vector3(...t) }, uAmp: { value: layer.amp ?? .12 }, uClump: { value: layer.clump ?? 0 }, uDry: { value: layer.dry ?? 0 },
    uShare: { value: layer.secondShare ?? 0 }, uAnti: { value: macro.antiTileScale }, uAntiW: { value: layer.anti ?? 1 }, uSat: { value: layer.sat ?? 1 }, uMap2: { value: map2 } };
  const unit = (1 / worldUnitsPerMeter).toFixed(6);
  material.onBeforeCompile = sh => { Object.assign(sh.uniforms, u);
    sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz * ${unit};`);
    sh.fragmentShader = `#define LOOK_P1 ${macro.periods_m[0].toFixed(2)}\n#define LOOK_P2 ${macro.periods_m[1].toFixed(2)}\n#define LOOK_RC ${Math.cos(a).toFixed(5)}\n#define LOOK_RS ${Math.sin(a).toFixed(5)}\n${map2 ? '#define LOOK_MAP2\n' : ''}` + NOISE_GLSL + sh.fragmentShader.replace('#include <map_fragment>', LOOK_MAP); };
  material.customProgramCacheKey = () => 'ground-look' + (map2 ? 2 : 1);
  material.needsUpdate = true;
  return material;
}

// Distance fade for a baked environment's wide surroundings (pilot previews fade their context into the sky by HORIZONTAL
// distance from the campus centre, so the backdrop's square edge never shows). fade = { centre: [x, z], near, far } in world
// units (+ optional linear share), colour = the scene background (sRGB). Mixed after tone mapping / colour space so it meets the background exactly.
export function applyDistanceFade(THREE, material, fade, colour) {
  const c = new THREE.Color(colour), prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey, linear = fade.linear > 0 ? +fade.linear : 0;
  const u = { uFadeCentre: { value: new THREE.Vector2(...fade.centre) }, uFadeRange: { value: new THREE.Vector2(fade.near, fade.far) }, uFadeColour: { value: new THREE.Vector3(c.r, c.g, c.b) } };
  c.convertLinearToSRGB(); u.uFadeColour.value.set(c.r, c.g, c.b);
  material.onBeforeCompile = (sh, renderer) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev.call(material, sh, renderer);
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'varying vec2 vFadeXZ;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
vec4 fadeP = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
fadeP = instanceMatrix * fadeP;
#endif
vFadeXZ = (modelMatrix * fadeP).xz;`);
    // optional fade.linear (yonseiSongdo, its pilot preview's rule): max(smoothstep, linear * ramp); without it the shader text is unchanged
    const amount = linear ? `max(smoothstep(uFadeRange.x, uFadeRange.y, fadeD), ${linear.toFixed(4)} * clamp((fadeD - uFadeRange.x) / (uFadeRange.y - uFadeRange.x), 0.0, 1.0))` : null;
    sh.fragmentShader = 'varying vec2 vFadeXZ;\nuniform vec2 uFadeCentre, uFadeRange; uniform vec3 uFadeColour;\n' + sh.fragmentShader.replace('#include <fog_fragment>', amount
      ? `float fadeD = length(vFadeXZ - uFadeCentre);\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uFadeColour, ${amount});\n#include <fog_fragment>`
      : 'gl_FragColor.rgb = mix(gl_FragColor.rgb, uFadeColour, smoothstep(uFadeRange.x, uFadeRange.y, length(vFadeXZ - uFadeCentre)));\n#include <fog_fragment>');
  };
  material.customProgramCacheKey = () => (prevKey ? prevKey.call(material) : '') + '|fade' + (linear ? 'L' + linear : '');
  material.needsUpdate = true;
  return material;
}
