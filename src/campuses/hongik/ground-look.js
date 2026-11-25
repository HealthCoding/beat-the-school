// Hongik ground look in the game: a copy of src/campuses/sogang/ground-look.js (the Hongik pilot site/ground-look.js applyLook is the
// Sogang one unchanged, material extras { sogang: { kind } }), used through pkg.ground.baked.materialHook (src/engine/baked-ground.js).
//   - every baked material whose glTF extras say { sogang: { kind } } gets the pilot's macro look for that kind (HI_LOOK = the pilot's
//     LOOK, written into data.js by scripts/campuses/hongik/build-package.mjs): 13 / 37 m world noise on the albedo, a 0.37x copy of
//     the tile rotated 33 deg, 1.7 m clumps, dry tint, saturation;
//   - slope blend per fragment from the world normal on the kinds of LOOK.slopeBlend.kinds: planted-bank tile over 14-22 deg,
//     석축 tile (triplanar on x / z) over 52-60 deg; the two tiles come from the carrier env model 'look-textures'
//     (materials look-tex-<tile>), loaded with the campus before it is assembled.
// The shader text is the pilot's; the only change is the unit: the game scene is metres x worldUnitsPerMeter, so the world
// position is scaled back to metres before the noise / slope tiles (the UVs are the pilot's, repeat folded in by the bake).
const NOISE_GLSL = `varying vec3 vWPos; varying vec3 vWNrm;
uniform float uAmp, uClump, uDry, uAnti, uAntiW, uSat, uBankW, uStoneW;
uniform sampler2D uBankMap, uStoneMap;
float gHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float gNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y); }
`;
const LOOK_MAP = `#ifdef USE_MAP
  vec2 gw = vWPos.xz;
  float n1 = gNoise(gw / LOOK_P1), n2 = gNoise(gw / LOOK_P2 + 17.3), n3 = gNoise(gw / 1.7 + 5.1);
  vec2 uvB = mat2(LOOK_RC, -LOOK_RS, LOOK_RS, LOOK_RC) * vMapUv * uAnti + vec2(0.37, 0.71);
  vec4 gTex = mix(texture2D(map, vMapUv), texture2D(map, uvB), uAntiW * (0.25 + 0.5 * smoothstep(0.3, 0.7, n1)));
  #ifdef LOOK_SLOPE
    float gNy = normalize(vWNrm).y;
    float gBank = uBankW * (1.0 - smoothstep(LOOK_B1, LOOK_B0, gNy)), gStone = uStoneW * (1.0 - smoothstep(LOOK_S1, LOOK_S0, gNy));
    vec3 gB = mix(texture2D(uBankMap, gw / LOOK_BT).rgb, texture2D(uBankMap, mat2(LOOK_RC, -LOOK_RS, LOOK_RS, LOOK_RC) * gw / LOOK_BT * 0.37).rgb, 0.4);
    vec3 an = abs(normalize(vWNrm)); vec2 sx = vec2(vWPos.z, vWPos.y) / LOOK_ST, sz = vec2(vWPos.x, vWPos.y) / LOOK_ST;
    vec3 gS = (texture2D(uStoneMap, sx).rgb * an.x + texture2D(uStoneMap, sz).rgb * an.z) / max(an.x + an.z, 1e-3);
    gTex.rgb = mix(gTex.rgb, gB, gBank); gTex.rgb = mix(gTex.rgb, gS, gStone);
  #endif
  vec3 gCol = gTex.rgb * (1.0 + uAmp * (2.0 * (n1 * 0.55 + n2 * 0.45) - 1.0)) * (1.0 - uClump * smoothstep(0.45, 0.85, n3));
  gCol = mix(gCol, gCol * vec3(1.12, 1.03, 0.76), uDry * smoothstep(0.55, 0.85, n1 * 0.4 + n2 * 0.6));
  gCol = mix(vec3(dot(gCol, vec3(0.2126, 0.7152, 0.0722))), gCol, uSat);
  diffuseColor.rgb *= gCol;
#endif`;

export function createHongikGroundLook(look) {
  return (THREE, { worldUnitsPerMeter: W = .5, modelAssets }) => {
    const tex = {};
    if (modelAssets?.has?.('look-textures')) modelAssets.createScene('look-textures').traverse(o => {
      if (o.isMesh && o.material?.map && /^look-tex-/.test(o.material.name)) tex[o.material.name.slice(9)] = o.material.map; });
    const SB = look.slopeBlend, bankTex = SB && tex[SB.bankTile[0]], stoneTex = SB && tex[SB.stoneTile[0]], haveSlope = !!(bankTex && stoneTex);
    const a = look.antiTileRotate_deg * Math.PI / 180, unit = (1 / W).toFixed(6), cosd = d => Math.cos(d * Math.PI / 180).toFixed(5);
    return material => {
      const kind = material.userData?.sogang?.kind, ly = kind && look.layers[kind];
      if (!ly || !material.map) return false;
      const sw = (SB && SB.kinds[kind]) || null, slope = !!(sw && haveSlope);
      const u = { uAmp: { value: ly.amp }, uClump: { value: ly.clump }, uDry: { value: ly.dry }, uAnti: { value: look.antiTileScale }, uAntiW: { value: ly.anti }, uSat: { value: ly.sat },
        uBankW: { value: sw ? sw[0] : 0 }, uStoneW: { value: sw ? sw[1] : 0 }, uBankMap: { value: slope ? bankTex : null }, uStoneMap: { value: slope ? stoneTex : null } };
      const defs = `#define LOOK_P1 ${look.periods_m[0].toFixed(2)}\n#define LOOK_P2 ${look.periods_m[1].toFixed(2)}\n#define LOOK_RC ${Math.cos(a).toFixed(5)}\n#define LOOK_RS ${Math.sin(a).toFixed(5)}\n`
        + (slope ? `#define LOOK_SLOPE\n#define LOOK_B0 ${cosd(SB.bank[0])}\n#define LOOK_B1 ${cosd(SB.bank[1])}\n#define LOOK_S0 ${cosd(SB.stone[0])}\n#define LOOK_S1 ${cosd(SB.stone[1])}\n#define LOOK_BT ${SB.bankTile[1].toFixed(2)}\n#define LOOK_ST ${SB.stoneTile[1].toFixed(2)}\n` : '');
      material.onBeforeCompile = sh => { Object.assign(sh.uniforms, u);
        sh.vertexShader = 'varying vec3 vWPos; varying vec3 vWNrm;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz * ${unit}; vWNrm = mat3(modelMatrix) * objectNormal;`);
        sh.fragmentShader = defs + NOISE_GLSL + sh.fragmentShader.replace('#include <map_fragment>', LOOK_MAP); };
      material.customProgramCacheKey = () => 'hongik-look' + (slope ? '-s' : '');
      material.needsUpdate = true;
      return true;
    };
  };
}
