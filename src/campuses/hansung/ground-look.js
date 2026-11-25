import { applyHansungBackdropFade } from './backdrop-fade.js';
// Hansung game ground shader: exact NOISE_GLSL/LOOK_MAP from its pilot final-materials.js,
// 마을·경계, 2026-10-18), used through pkg.ground.baked.materialHook (src/engine/baked-ground.js). Only this campus loads it.
//   - every baked ground material whose glTF extras say { skku: { kind } } gets its layer from SK_LOOK (site/claude-ground.json):
//     tile + 0.37x / 37° rotated copy, second tile by the 37 m / 1.7 m mask, tint, 13 / 37 m macro, clumps, dry shift, saturation;
//   - slope surfaces per fragment from the (crease) normal: planted bank 12->20°, granite 석축 38->46° (triplanar);
//   - the ground-zones mask (village alleys / cement yards, campus granite / brick / bed strip, contact shadow);
//   - textures: the material's own tile (its glTF map) + the colour tiles and the zone mask carried by the env model
//     'look-textures' (materials named look-tex-<name>), so everything is loaded before the campus is assembled.
// Positions are world units in the game (metres x worldUnitsPerMeter): the shader scales them back to metres.
const NOISE_GLSL = `varying vec3 vWPos; varying vec3 vWNrm;
uniform vec3 uTint, uBTint, uSTint; uniform vec4 uP1, uBP1, uSlope; uniform vec2 uP2, uBP2; uniform float uInvS, uBInvS, uSInvS, uUseM2, uSAmp, uOwnTri, uBank, uStone;
uniform sampler2D uMap2, uBMap, uBMap2, uSMap;
#ifdef LOOK_ZONE
uniform sampler2D uZMap, uCMap, uCMap2, uVMap, uVMap2; uniform vec4 uZB, uCP1, uVP1, uYP1, uKP1; uniform vec3 uCTint, uVTint, uYTint, uKTint, uZWarm; uniform vec2 uCP2, uVP2, uYP2, uKP2; uniform float uCInvS, uVInvS, uYInvS, uKInvS, uZMode, uZAO;
#endif
float gHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float gNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(gHash(i),gHash(i+vec2(1.0,0.0)),f.x),mix(gHash(i+vec2(0.0,1.0)),gHash(i+vec2(1.0,1.0)),f.x),f.y);}
// one layer: tile + rotated copy, optional second tile by the 37 m / 1.7 m mask, tint, macro, clumps, dry shift, saturation
// p1 = (amp, clump, dry, secondShare), p2 = (anti, sat)
vec3 gLayer(sampler2D m, sampler2D m2, float useM2, float invS, vec3 tint, vec4 p1, vec2 p2, vec2 gw, float n1, float n2, float n3){
  vec2 uvA=gw*invS, uvB=mat2(LOOK_RC,-LOOK_RS,LOOK_RS,LOOK_RC)*uvA*LOOK_AS+vec2(0.37,0.71);
  vec4 t=mix(texture2D(m,uvA),texture2D(m,uvB),p2.x*(0.25+0.5*smoothstep(0.3,0.7,n1)));
  if(useM2>0.5){vec4 t2=mix(texture2D(m2,uvA*1.31+0.21),texture2D(m2,uvB*1.9),0.5*step(0.01,p2.x));t=mix(t,t2,smoothstep(1.0-p1.w-0.08,1.0-p1.w+0.08,n2*0.75+n3*0.25));}
  vec3 c=t.rgb*tint*(1.0+p1.x*(2.0*(n1*0.55+n2*0.45)-1.0))*(1.0-p1.y*smoothstep(0.45,0.85,n3));
  c=mix(c,c*vec3(1.12,1.03,0.76),p1.z*smoothstep(0.55,0.85,n1*0.4+n2*0.6));
  return mix(vec3(dot(c,vec3(0.2126,0.7152,0.0722))),c,p2.y);
}
// 석축: triplanar (x / y / z planes, sharp weights), so block courses stay level on every face
vec3 gStone(sampler2D m, float invS, vec3 tint, float amp, vec3 wp, vec3 nrm, float n1, float n2){
  vec3 an=pow(abs(nrm),vec3(6.0)); an/=(an.x+an.y+an.z);
  vec3 c=texture2D(m,vec2(-wp.z,wp.y)*invS).rgb*an.x+texture2D(m,vec2(wp.x,-wp.z)*invS).rgb*an.y+texture2D(m,vec2(wp.x,wp.y)*invS).rgb*an.z;
  return c*tint*(1.0+amp*(2.0*(n1*0.5+n2*0.5)-1.0));
}
`;
const LOOK_MAP = `#ifdef USE_MAP
  vec2 gw=vec2(vWPos.x,-vWPos.z);
  float n1=gNoise(gw/LOOK_P1),n2=gNoise(gw/LOOK_P2+17.3),n3=gNoise(gw/LOOK_CL+5.1);
  vec3 gN=normalize(vWNrm);
  vec3 gCol=uOwnTri>0.5?gStone(map,uInvS,uTint,uP1.x,vWPos,gN,n1,n2):gLayer(map,uMap2,uUseM2,uInvS,uTint,uP1,uP2,gw,n1,n2,n3);
#ifdef LOOK_ZONE
  // Claude 마을·경계: ground-zones.png (R village alley / yard, G campus paving / bed, B contact shadow)
  vec3 zv=texture2D(uZMap,(gw-uZB.xy)/uZB.zw).rgb;
  if(uZMode>2.5){
    float wc=smoothstep(0.86,0.97,zv.g), wk=smoothstep(0.62,0.72,zv.g)*(1.0-wc), wbd=smoothstep(0.3,0.45,zv.g)*(1.0-smoothstep(0.62,0.72,zv.g)), wa=smoothstep(0.62,0.9,zv.r), wy=smoothstep(0.3,0.45,zv.r)*(1.0-wa);
#ifdef LOOK_GEOMETRY_PAVING
    wc=0.0;wk=0.0;wbd=smoothstep(0.3,0.45,zv.g);
#endif
    if(wc>0.0) gCol=mix(gCol,gLayer(uCMap,uCMap,0.0,uCInvS,uCTint,uCP1,uCP2,gw,n1,n2,n3),wc);
    if(wk>0.0) gCol=mix(gCol,gLayer(uCMap2,uCMap2,0.0,uKInvS,uKTint,uKP1,uKP2,gw,n1,n2,n3),wk);
    if(wbd>0.0) gCol=mix(gCol,gLayer(uBMap,uBMap2,1.0,uBInvS,uBTint,uBP1,uBP2,gw,n1,n2,n3),wbd);
    if(wy>0.0) gCol=mix(gCol,gLayer(uVMap2,uVMap2,0.0,uYInvS,uYTint,uYP1,uYP2,gw,n1,n2,n3),wy);
    if(wa>0.0) gCol=mix(gCol,gLayer(uVMap,uVMap2,1.0,uVInvS,uVTint,uVP1,uVP2,gw,n1,n2,n3),wa);
  } else if(uZMode>1.5){ gCol*=mix(vec3(1.0),uZWarm,smoothstep(0.62,0.72,zv.g)); }
  if(uZMode>0.5) gCol*=1.0-uZAO*zv.b;
#endif
  // uSlope = cos(bank start), cos(bank full), cos(stone start), cos(stone full)
  if(uBank>0.5){float wb=1.0-smoothstep(uSlope.y,uSlope.x,gN.y); if(wb>0.0) gCol=mix(gCol,gLayer(uBMap,uBMap2,1.0,uBInvS,uBTint,uBP1,uBP2,gw,n1,n2,n3),wb);}
  if(uStone>0.5){float ws=1.0-smoothstep(uSlope.w,uSlope.z,gN.y); if(ws>0.0) gCol=mix(gCol,gStone(uSMap,uSInvS,uSTint,uSAmp,vWPos,gN,n1,n2),ws);}
  diffuseColor.rgb*=gCol;
#endif`;

export function createHansungGroundLook(look, zones, backdropFade) {
  return (THREE, { worldUnitsPerMeter: W = .5, modelAssets }) => {
    // carrier textures (env model 'look-textures', never added to the scene)
    const tex = {};
    if (modelAssets?.has?.('look-textures')) modelAssets.createScene('look-textures').traverse(o => {
      if (o.isMesh && o.material?.map && /^look-tex-/.test(o.material.name)) tex[o.material.name.slice(9)] = o.material.map; });
    let zoneTex = null;
    if (tex.zones && zones && look.zones) {
      zoneTex = tex.zones.clone();
      Object.assign(zoneTex, { flipY: false, colorSpace: THREE.NoColorSpace, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
      zoneTex.needsUpdate = true;
      zoneTex.userData.box = [zones.firstSampleEN[0] - zones.cell_m / 2, zones.firstSampleEN[1] - zones.cell_m / 2, zones.size_px[0] * zones.cell_m, zones.size_px[1] * zones.cell_m];
    }
    const M = look.macro, a = M.antiTileRotate_deg * Math.PI / 180, S = look.slope || {};
    const P1 = ly => new THREE.Vector4(ly.amp ?? .12, ly.clump ?? 0, ly.dry ?? 0, ly.secondShare ?? 0), P2 = ly => new THREE.Vector2(ly.anti ?? 1, ly.sat ?? 1);
    const V3 = v => new THREE.Vector3(...(v || [1, 1, 1]));
    const defs = (look?.zones?.geometryOnlyCampusPaving ? '#define LOOK_GEOMETRY_PAVING\n' : '') + (zoneTex ? '#define LOOK_ZONE\n' : '') + `#define LOOK_P1 ${M.periods_m[0].toFixed(2)}\n#define LOOK_P2 ${M.periods_m[1].toFixed(2)}\n#define LOOK_CL ${(M.clump_m || 1.7).toFixed(2)}\n#define LOOK_RC ${Math.cos(a).toFixed(5)}\n#define LOOK_RS ${Math.sin(a).toFixed(5)}\n#define LOOK_AS ${M.antiTileScale.toFixed(4)}\n`;
    const unit = (1 / W).toFixed(6);
    return material => {
      if (applyHansungBackdropFade(material, W, backdropFade)) return true;
      const kind = material.userData?.skku?.kind, ly = kind && look.layers[kind];
      if (!ly || typeof ly.tint === 'string' || !material.map) return false;
      const own = tex[ly.tile] || material.map, to = (S.blendTo || {})[kind] || [];
      const bank = to.includes('bank') && look.layers.bank, stone = to.includes('stonebank') && look.layers.stonebank, ownTri = !!ly.triplanar, map2 = ly.second ? tex[ly.second] : null;
      const T = n => tex[n] || own;
      const u = { uTint: { value: V3(ly.tint) }, uP1: { value: P1(ly) }, uP2: { value: P2(ly) }, uInvS: { value: 1 / ly.scale_m }, uUseM2: { value: map2 ? 1 : 0 }, uMap2: { value: map2 || own },
        uBTint: { value: V3(bank && bank.tint) }, uBP1: { value: P1(bank || {}) }, uBP2: { value: P2(bank || {}) }, uBInvS: { value: bank ? 1 / bank.scale_m : 1 }, uBMap: { value: bank ? T(bank.tile) : own }, uBMap2: { value: bank && bank.second ? T(bank.second) : own },
        uSTint: { value: V3((stone && stone.tint) || (ownTri && ly.tint)) }, uSAmp: { value: stone ? stone.amp ?? .1 : 0 }, uSInvS: { value: stone ? 1 / stone.scale_m : 1 }, uSMap: { value: stone ? T(stone.tile) : own } };
      const deg = d => Math.cos(d * Math.PI / 180), bd = S.bank_deg || [90, 90], sd = S.stone_deg || [90, 90];
      u.uSlope = { value: new THREE.Vector4(deg(bd[0]), deg(bd[1]), deg(sd[0]), deg(sd[1])) };
      u.uOwnTri = { value: ownTri ? 1 : 0 }; u.uBank = { value: bank ? 1 : 0 }; u.uStone = { value: stone ? 1 : 0 };
      const Z = look.zones;
      if (zoneTex && Z) { const C = look.layers[Z.campusLayer], Kb = look.layers[Z.brickLayer], Vl = look.layers[Z.villageLayer], Y = look.layers[Z.yardLayer], Lw = look.layers[Z.lawnLayer || Z.campusLayer], md = Z.modes[kind] ?? Z.modes.default;
        if (!bank && md > 2.5) { const b = look.layers[Z.bedLayer]; u.uBTint.value.set(...(b.tint || [1, 1, 1])); u.uBP1.value = P1(b); u.uBP2.value = P2(b); u.uBInvS.value = 1 / b.scale_m; u.uBMap.value = T(b.tile); u.uBMap2.value = b.second ? T(b.second) : T(b.tile); }
        Object.assign(u, { uZMap: { value: zoneTex }, uZB: { value: new THREE.Vector4(...zoneTex.userData.box) }, uZMode: { value: md }, uZAO: { value: Z.ao }, uZWarm: { value: V3(Z.pavingWarm) },
          uCMap: { value: T(C.tile) }, uLMap: { value: T(Lw.tile) }, uLInvS: { value: 1 / Lw.scale_m }, uLTint: { value: V3(Lw.tint) }, uLP1: { value: P1(Lw) }, uLP2: { value: P2(Lw) },
          uCMap2: { value: T(Kb.tile) }, uKInvS: { value: 1 / Kb.scale_m }, uKTint: { value: V3(Kb.tint) }, uKP1: { value: P1(Kb) }, uKP2: { value: P2(Kb) }, uCInvS: { value: 1 / C.scale_m }, uCTint: { value: V3(C.tint) }, uCP1: { value: P1(C) }, uCP2: { value: P2(C) },
          uVMap: { value: T(Vl.tile) }, uVMap2: { value: T(Vl.second || Y.tile) }, uVInvS: { value: 1 / Vl.scale_m }, uVTint: { value: V3(Vl.tint) }, uVP1: { value: P1(Vl) }, uVP2: { value: P2(Vl) },
          uYInvS: { value: 1 / Y.scale_m }, uYTint: { value: V3(Y.tint) }, uYP1: { value: P1(Y) }, uYP2: { value: P2(Y) } }); }
      // the pilot's material: white base colour, roughness .96, metalness 0, the layer's normal strength
      material.color?.setRGB(1, 1, 1); material.roughness = .96; material.metalness = 0; material.map = own;
      if (material.normalMap) { const ns = ly.normal ?? .16; material.normalScale?.set(ns, ns); if (!ns) material.normalMap = null; }
      material.onBeforeCompile = sh => { Object.assign(sh.uniforms, u);
        sh.vertexShader = 'varying vec3 vWPos; varying vec3 vWNrm;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\nvWPos=(modelMatrix*vec4(transformed,1.0)).xyz*${unit}; vWNrm=normalize(mat3(modelMatrix)*objectNormal);`);
        sh.fragmentShader = defs + NOISE_GLSL + sh.fragmentShader.replace('#include <map_fragment>', LOOK_MAP); };
      material.customProgramCacheKey = () => 'hansung-look-r3|' + defs;
      material.needsUpdate = true;
      return true;
    };
  };
}
