// 경기대 전용 완파 바닥. 공용 폭발·파괴 순서는 그대로 쓰고, 4 m 대리 격자에
// 덧그리던 탄 자국만 실제 구운 지면 재질에 적용한다. 추가 메시·삼각형은 없다.
// kyonggi/index.html의 import map은 이 학교에만 어댑터를 연결한다.
import { createCampusFinale as createSharedFinale, emptyFinaleDamage, FINALE_BUILDINGS_PER_FRAME } from '../../campus-finale.js?v=demo18&kyonggi-base=1';
export { emptyFinaleDamage, FINALE_BUILDINGS_PER_FRAME };

const VERTEX = `varying vec2 kgScorchPosition;\n`;
const FRAGMENT = `varying vec2 kgScorchPosition;
uniform vec2 kgScorchOrigin;
uniform float kgScorchRadius;
float kgScorchHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float kgScorchNoise(vec2 p) { vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
 return mix(mix(kgScorchHash(i),kgScorchHash(i+vec2(1.0,0.0)),f.x),mix(kgScorchHash(i+vec2(0.0,1.0)),kgScorchHash(i+vec2(1.0,1.0)),f.x),f.y); }
`;
const MIX = `if (kgScorchRadius > 0.0) {
 float radial=distance(kgScorchPosition,kgScorchOrigin)/max(.01,kgScorchRadius);
 float edge=pow(1.0-smoothstep(.06,1.0,radial),2.0);
 float grain=kgScorchNoise(kgScorchPosition*.37)*.7+kgScorchNoise(kgScorchPosition*2.7)*.3;
 vec3 ash=mix(vec3(.035,.032,.030),vec3(.105,.088,.068),grain);
 gl_FragColor.rgb=mix(gl_FragColor.rgb,ash,edge*.84*(.82+.18*grain));
}
#include <tonemapping_fragment>`;

function attachGroundScorch(THREE, scenery) {
  const origin={value:new THREE.Vector2()},radius={value:0},records=[],seen=new Set();
  for(const id of ['env-ground','env-site']) {
    const layer=scenery.group.getObjectByName(id);if(!layer)throw new Error(`Kyonggi finale missing ${id}`);
    layer.traverse(o=>{
      if(!o.isMesh||o.isInstancedMesh)return;
      for(const m of (Array.isArray(o.material)?o.material:[o.material])) {
        if(!m||seen.has(m)||(id==='env-site'&&!m.name?.startsWith('kyonggi-')))continue;
        seen.add(m);const prior=m.onBeforeCompile,key=m.customProgramCacheKey,cacheKey=key.call(m);
        m.onBeforeCompile=function(shader,renderer){
          prior.call(this,shader,renderer);
          Object.assign(shader.uniforms,{kgScorchOrigin:origin,kgScorchRadius:radius});
          shader.vertexShader=VERTEX+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nkgScorchPosition=(modelMatrix*vec4(transformed,1.0)).xz;');
          shader.fragmentShader=FRAGMENT+shader.fragmentShader.replace('#include <tonemapping_fragment>',MIX);
        };
        m.customProgramCacheKey=()=>cacheKey+'|kyonggi-ground-scorch-v1';m.needsUpdate=true;
        records.push({m,prior,key});
      }
    });
  }
  if(!records.length)throw new Error('Kyonggi finale ground materials missing');
  return {origin,radius,records,dispose(){for(const {m,prior,key} of records){m.onBeforeCompile=prior;m.customProgramCacheKey=key;m.needsUpdate=true;}}};
}
export function createCampusFinale(THREE, options) {
  const finale=createSharedFinale(THREE,options),start=finale.start.bind(finale),update=finale.update.bind(finale),reset=finale.reset.bind(finale),dispose=finale.dispose.bind(finale);
  let paint=null,disposed=false;
  finale.start=(point,settings)=>{
    if(disposed||finale.state.active||finale.state.finished||!point||![point.x,point.y,point.z].every(Number.isFinite))return false;
    const ok=start(point,settings);if(!ok)return false;
    paint??=attachGroundScorch(THREE,options.scenery);
    paint.origin.value.set(point.x,point.z);paint.radius.value=0;
    finale.scorch.visible=false;
    return true;
  };
  finale.update=dt=>{const result=update(dt);if(paint)paint.radius.value=finale.state.radius;return result;};
  finale.reset=()=>{reset();if(paint)paint.radius.value=0;};
  finale.dispose=()=>{if(disposed)return;disposed=true;dispose();paint?.dispose();paint=null;};
  return finale;
}
