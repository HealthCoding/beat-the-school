// URL font preview, shared preference across title and school pages; blocked storage is harmless.
(()=>{const root=document.documentElement;if(!root)return;const key='beat-school-font',valid=v=>['c','a','b','b2'].includes(v);let font=new URLSearchParams(window.location.search).get('font');if(valid(font)){try{localStorage.setItem(key,font);}catch{}}else{try{font=localStorage.getItem(key);}catch{}}root.classList.remove('font-c','font-a','font-b','font-b2');root.classList.add('font-'+(valid(font)?font:'c'));})();
import * as THREE from '../vendor/three.module.js';
import {createRenderQuality,createShadowBudget} from './render-performance.js?v=sn109';
import {createCampusAsync} from './engine/campus-engine.js?v=lr01';
import {createFragmentPool} from './workers/fragment-pool.js?v=prep43';
import {loadCampusPackage} from './campus-select.js?v=sg01';
import {LAST_CAMPUS_KEY} from './campuses/registry.js?v=sg01';
import {tickOnPress,soundPreference,saveSoundPreference} from './ui-sound.js?v=sound34';
import {streamPackageModels,loadCampusModels} from './model-assets.js?v=sn120';
import {createCampusCamera} from './camera.js?v=lr01';
import {campusTools} from './demo-weapons.js?v=sn130';
import {createDemoWeaponBag} from './demo-weapon-bag.js?v=weapons40';
import {createComicEffects} from './effects.js?v=nuke21';
import {createBackgroundMusic, consumeMusicHandoff, musicPreference, saveMusicPreference, createMusicSetting} from './background-music.js?v=sn119';
import {createComicAudio} from './audio.js?v=weapons40';
import {ATTACKS,createWeaponActions} from './weapon-actions.js?v=mini24b';
import {createHitRhythm,createScreenImpact} from './game-feel.js?v=shake74';
import {createNuclearCamera,NUCLEAR_COUNTDOWN_SECONDS,NUCLEAR_IMPACT_AT,NUCLEAR_COMPLETE_AT} from './nuclear-camera.js?v=impact20';
import {createImpactFeedback} from './impact-feedback.js?v=weapons40';

import {createShotgunView} from './shotgun-view.js?v=shotgun27';
import {loadShotgunModel} from './shotgun-model.js?v=shotgun27';
import {sampleShotgunHits} from './shotgun-hit.js?v=weapons40';
// Hospitals stay standing (shield reaction) and the three heavy weapons (user decisions 2026-10-18).
import {createProtectedBuildings} from './protected-buildings.js?v=jbnu63';
import {createShieldEffects} from './hospital-shield.js?v=weapons40';
import {createHeavyWeapons,HEAVY_WEAPON_IDS,HOLD_WEAPON_IDS} from './heavy-weapons.js?v=weapons40';
import {createHeavyAudio} from './heavy-weapons-audio.js?v=weapons40';
import {WEAPON_TUNING} from './weapon-tuning.js?v=sn130';
import {track} from './analytics.js';
import {createShare} from './share.js?v=sn176';
import {createTimeOfDay} from './time-of-day.js?v=time75';
// Wrecking-ball crane (free weapon, user decision 2026-10-18): src/wrecking-ball.js, numbers in weapon-tuning.js `wreckingBall`.
import {createWreckingBall,WRECK_ID} from './wrecking-ball.js?v=wreck46';
// Laser cutter (free weapon, user decision 2026-10-22): src/laser-cutter.js, numbers in weapon-tuning.js `laser`.
import {createLaserCutter,LASER_ID} from './laser-cutter.js?v=lz85';
// Ruyi staff 여의봉 (free weapon, user request 2026-10-26): src/ruyi-staff.js, numbers in weapon-tuning.js `ruyi`.
import {createRuyiStaff,RUYI_ID} from './ruyi-staff.js?v=sn109';
// Robot vacuum 로봇청소기 (15th weapon, user decisions 2026-10-26; in the bag only with ?robovac=1 until the user has seen it):
// src/robot-vacuum.js, numbers in weapon-tuning.js `robovac`.
import {createRobotVacuum,ROBOVAC_ID} from './robot-vacuum.js?v=sn130';
// Ad-reward weapons (user decisions 2026-10-22): hidden unless src/ad-rewards.js shows them; first one = blast demolition.
import {adWeaponsVisible,isUnlocked} from './ad-rewards.js';
import {createUnlockDialog} from './unlock-dialog.js';
import {createBlackHole,BLACKHOLE_ID} from './blackhole.js?v=bh86';
import {createBlastDemolition,BLAST_ID} from './blast-demolition.js';
// Second ad-reward weapon: the bulldozer (src/bulldozer.js, numbers in weapon-tuning.js `bulldozer`).
import {createBulldozer,DOZER_ID} from './bulldozer.js';

const $=id=>document.getElementById(id),canvas=$('game');
let bootState={phase:'loading',loaded:0,total:0,error:null};
window.gameLoadState=()=>({...bootState});
// Start the title-song handoff independently of campus preparation. The encoded
// audio fetch is low priority and is never awaited by the loading/ready path.
const musicHandoff=consumeMusicHandoff();
const backgroundMusic=createBackgroundMusic({handoff:musicHandoff});
let musicMode=musicPreference(),userAudioActivated=!!musicHandoff,windowFocused=true;
window.loadingMusicState=()=>({...backgroundMusic.stats});
function resumeLoadingMusic(){
 if(bootState.phase==='ready'||!musicHandoff)return;
 backgroundMusic.setPaused(document.hidden||!windowFocused);
 void backgroundMusic.setEnabled(soundPreference()&&musicMode!=='off');
}
const pauseLoadingMusic=()=>{if(bootState.phase!=='ready'){windowFocused=false;backgroundMusic.setPaused(true);}};
const focusLoadingMusic=()=>{if(bootState.phase!=='ready'){windowFocused=true;resumeLoadingMusic();}};
// Safari may reject the automatic attempt; retry inside the first loading touch.
for(const type of ['pointerdown','pointerup','touchend','click'])document.addEventListener(type,resumeLoadingMusic,{passive:true}); // iOS grants audio on touchend/click only
document.addEventListener('keydown',resumeLoadingMusic);
document.addEventListener('visibilitychange',resumeLoadingMusic);
window.addEventListener('blur',pauseLoadingMusic);
window.addEventListener('focus',focusLoadingMusic);
window.addEventListener('pagehide',pauseLoadingMusic);
setTimeout(resumeLoadingMusic,0);
$('loading-retry').addEventListener('click',()=>window.location.reload());
function loadingError(error){bootState={...bootState,phase:'error',error:String(error?.message||error)};$('loading').dataset.state='error';$('loading-title').textContent='캠퍼스를 불러오지 못했어요';$('loading-message').textContent='다시 불러오기를 눌러 재시도해 주세요.';$('loading-progress').hidden=true;$('loading-retry').hidden=false;console.error(error);}
// Loading tape follows the progress value (style.css --p).
const loadingTape=()=>{const bar=$('loading-progress');$('loading').style.setProperty('--p',bar.max?Math.min(1,bar.value/bar.max).toFixed(3):'0');};
// Boot switches, read once. ?classic turns the feel set off (and interior fill unless &interior); &interior=off / &physics=off.
const bootQuery=new URLSearchParams(globalThis.location?.search??''),feelQuery=bootQuery,feelOn=!bootQuery.has('classic');
const interiorOn=bootQuery.get('interior')!=='off'&&(bootQuery.has('interior')||!bootQuery.has('classic'));
// Everything the boot needs later starts downloading now, in parallel with the campus package and its models;
// each is still awaited where it is used, so creation order is unchanged. (A rejection surfaces at that await.)
const early=p=>{p?.catch(()=>{});return p;};
const interiorModule=early(interiorOn?import('./interior-fill.js?v=interior24'):null);
const feelModules=early(feelOn?Promise.all([import('./feel-effects.js?v=weapons40'),import('./feel-nuke.js?v=nuke21'),bootQuery.get('physics')!=='off'?import('./feel-physics.js?v=weapons40'):null,import('./nuke-siren.js?v=siren20')]):null);
const shotgunModelPromise=early(loadShotgunModel(THREE));
// Building fragments (interior fill + clipping) are prepared in a few workers while the models download
// (src/workers/fragment-pool.js); same output as the main thread. ?prep=main keeps it all on the main thread.
let fragmentPool=null;if(bootQuery.get('prep')!=='main')try{fragmentPool=createFragmentPool({slow:Math.max(1,Math.min(8,Number(bootQuery.get('prepSlow'))||1))});}catch{fragmentPool=null;}
// Only the selected campus package is fetched; everything school-specific flows from it.
let campusPackage;try{campusPackage=await loadCampusPackage();}catch(error){loadingError(error);throw error;}
const CAMPUS_BUILDING_COUNT=campusPackage.placements.length,SCENE=campusPackage.scene;
// The bag: the shared tools, plus a package's own `exclusiveTools` before the nuke (SKKU: bowling-ball bomb, src/bowling-ball.js);
// with ad weapons shown, the bowling ball is a locked ad slot on every campus instead (demo-weapons.js campusTools).
const TOOLS=campusTools(campusPackage,{adWeapons:adWeaponsVisible()}),bowlingModule=early(TOOLS.some(tool=>tool.id==='bowling')?import('./bowling-ball.js?v=bowling44'):null);
// School-specific page text follows the loaded campus (a page can preview another campus locally).
{const m=campusPackage.meta;$('loading-title').textContent=m.short;$('loading-title').toggleAttribute?.('data-long',m.short.length>7);canvas.setAttribute('aria-label',`${m.modelNoun} 3D 캠퍼스. 터치로 타격하고 드래그로 이동해요.`);document.querySelector('meta[name=description]')?.setAttribute('content',`직접 만든 ${m.modelNoun} 3D 모델로 즐기는 작은 캠퍼스 파괴 놀이터.`);}bootState={...bootState,total:CAMPUS_BUILDING_COUNT};
$('loading-progress').max=campusPackage.models.manifests.reduce((n,m)=>n+(m.expectedIds?m.expectedIds.length:m.count),0)+CAMPUS_BUILDING_COUNT;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
$('gesture-hint').textContent=matchMedia('(pointer: coarse)').matches?'터치해 타격 · 드래그해 이동\n두 손가락으로 확대·회전':'클릭해 타격 · 드래그해 이동\n휠로 확대 · 오른쪽 드래그로 회전';
const QUALITY_KEY='beat-school-render-quality';let savedQuality='auto';try{savedQuality=localStorage.getItem(QUALITY_KEY)||'auto';}catch{}
const renderQuality=createRenderQuality({width:innerWidth,height:innerHeight,devicePixelRatio,mobile:innerWidth<760||(globalThis.navigator?.maxTouchPoints>0&&matchMedia('(pointer: coarse)').matches),mode:savedQuality});
const shadowBudget=createShadowBudget(renderQuality.profile.shadowHz);
const scene=new THREE.Scene();scene.background=new THREE.Color(SCENE.background);scene.fog=new THREE.Fog(SCENE.fog.color,SCENE.fog.near,SCENE.fog.far);
const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,5000);
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}
catch(error){loadingError(error);$('loading-message').textContent='3D 화면을 열지 못했어요. WebGL을 지원하는 브라우저에서 다시 열어주세요.';throw error;}
renderer.setPixelRatio(renderQuality.ratio);
renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const hemi=new THREE.HemisphereLight(SCENE.hemisphere.sky,SCENE.hemisphere.ground,SCENE.hemisphere.intensity);scene.add(hemi);
const sun=new THREE.DirectionalLight(SCENE.sun.color,SCENE.sun.intensity);sun.position.set(...SCENE.sun.position);sun.castShadow=true;
sun.shadow.mapSize.set(renderQuality.profile.shadowSize,renderQuality.profile.shadowSize);Object.assign(sun.shadow.camera,{left:-SCENE.sun.shadowSpan,right:SCENE.sun.shadowSpan,top:SCENE.sun.shadowSpan,bottom:-SCENE.sun.shadowSpan,near:1,far:650});sun.shadow.bias=-.00012;sun.shadow.normalBias=.04;scene.add(sun);scene.add(sun.target);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(6000,6000),new THREE.MeshStandardMaterial({color:SCENE.floor.color,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=SCENE.floor.y;floor.receiveShadow=true;scene.add(floor);
// A baked-ground campus may hide the backdrop floor (its surroundings fade into the sky like its pilot preview).
if(SCENE.floor.hidden)floor.visible=false;
// Time of day (낮/노을/해질녘, default 노을): src/time-of-day.js; a settings change re-aims the sun on the next frame.
const timeOfDay=createTimeOfDay({THREE,scene,renderer,hemi,sun,floor,SCENE,onChange:()=>{lastLight=[NaN,NaN,NaN,NaN];}});
let modelAssets,campus;
// Protected hospital models (Yonsei) load from their own small cache in parallel; a failure only leaves the hospitals out.
const protectedAssetsPromise=campusPackage.protected?.manifestURL&&campusPackage.protected.models?.length
 ?loadCampusModels(THREE,{manifestURL:campusPackage.protected.manifestURL,expectedIds:campusPackage.protected.models.map(m=>m.id)}).catch(error=>{console.warn('병원 모델을 불러오지 못했어요.',error);return null;})
 :Promise.resolve(null);
// Models stream in (src/model-assets.js streamPackageModels) and each building starts preparing as soon as its own model is
// here, while the rest (and the ground/context) keep downloading. Progress = models loaded + buildings prepared.
const modelStream=streamPackageModels(THREE,{manifests:campusPackage.models.manifests,onProgress:({loaded})=>{modelsLoaded=loaded;loadingProgress();}});
let modelsLoaded=0,buildingsBuilt=0;const modelTotal=$('loading-progress').max-CAMPUS_BUILDING_COUNT;
function loadingProgress(){
 // Concurrent model completions must not overwrite a failure or its retry UI.
 if(bootState.phase==='error')return;
 const assembling=modelsLoaded>=modelTotal;
 bootState=assembling?{phase:'assembling',loaded:buildingsBuilt,total:CAMPUS_BUILDING_COUNT,error:null}:{phase:'loading',loaded:modelsLoaded,total:modelTotal,error:null};
 $('loading-message').textContent=assembling?`캠퍼스에 건물을 세워요 · ${buildingsBuilt} / ${CAMPUS_BUILDING_COUNT}`:`3D 모델을 불러와요 · ${modelsLoaded} / ${modelTotal}`;
 $('loading-progress').value=modelsLoaded+buildingsBuilt;loadingTape();
}
let shaderWarmup=null;
try{
 // Interior fill: floor slabs/columns/partitions + dark inner wall faces (src/interior-fill.js). On by default since 10-17;
 // ?classic or &interior=off turns it off (?classic&interior keeps it on for comparison).
 const interior=await interiorModule;
 campus=await createCampusAsync(THREE,campusPackage,{modelAssets:modelStream,reducedMotion,pool:fragmentPool,...(interior?{interior}:{}),onProgress:({loaded})=>{buildingsBuilt=loaded;loadingProgress();}});
 modelAssets=await modelStream.done;
 scene.add(campus.group);
}catch(error){fragmentPool?.dispose();modelStream.done.then(m=>m.dispose(),()=>{});renderer.dispose?.();loadingError(error);throw error;}
const prepStats=fragmentPool?{...fragmentPool.stats}:null;fragmentPool?.dispose();fragmentPool=null;
window.prepDiagnostics=()=>({pool:prepStats,where:campus.entries.reduce((m,e)=>(m[e.model.prepSource||'main']=(m[e.model.prepSource||'main']||0)+1,m),{})});
let protectedSet=null;
try{
 protectedSet=createProtectedBuildings(THREE,{pkg:campusPackage,terrain:campus.terrain,sceneryRoot:campus.group,assets:await protectedAssetsPromise,worldUnitsPerMeter:campusPackage.geo.worldUnitsPerMeter});
 if(protectedSet){scene.add(protectedSet.group);protectedSet.hiddenInstances=protectedSet.hideInstancesInside(campus.group);if(!protectedSet.sites.length)protectedSet=null;}
}catch(error){console.warn('보호 건물을 세우지 못했어요.',error);protectedSet?.dispose();protectedSet=null;}
// Start compiling the campus shaders now (parallel compile where the browser supports it) while the rest of the boot runs;
// the first frame waits for it below instead of blocking on the same compiles inside renderer.render.
try{shaderWarmup=renderer.compileAsync(scene,camera).catch(()=>{});}catch{shaderWarmup=null;}
if(campus.entries.some(e=>e.model.interiorStats))window.interiorDiagnostics=()=>campus.entries.map(e=>({id:e.id,pieces:e.model.pieces.length,triangles:e.model.stats.triangles,...e.model.interiorStats}));
const view=createCampusCamera(THREE,camera,campus.bounds,{overviewAzimuth:campusPackage.view?.overviewAzimuth,angles:campusPackage.camera});
// Opt-in (pkg.camera.touchTilt, 11-10 liraart 남산타워): two fingers dragged together up / down tilt the view like a map app, so a phone
// can lie the camera down and look up too (a mouse already does this with the right button). Off (every other package) = unchanged.
const TOUCH_TILT=Boolean(campusPackage.camera?.touchTilt);
const startBuilding=campus.entries.find(entry=>entry.id===campusPackage.startBuildingId)||campus.entries[0];
let lastLight=[NaN,NaN,NaN,NaN],nuclearCamera=null,nuclearShot=null;
function updateLighting(){
 const target=nuclearShot?.target||view.target,distance=nuclearShot?.distance||view.state.distance,span=Math.max(38,Math.min(550,distance*.72));
 const state=[target.x,target.y,target.z,span],changed=state.some((n,i)=>!Number.isFinite(lastLight[i])||Math.abs(n-lastLight[i])>1e-6);
 scene.fog.near=nuclearShot?Math.max(500,distance*1.5):Math.max(130,distance*1.35);scene.fog.far=nuclearShot?Math.max(1800,distance*4):Math.max(550,distance*3.4);
 if(!changed)return false;lastLight=state;
 sun.position.set(target.x+timeOfDay.sunOffset[0],target.y+timeOfDay.sunOffset[1],target.z+timeOfDay.sunOffset[2]);sun.target.position.set(target.x,target.y,target.z);sun.target.updateMatrixWorld();
 Object.assign(sun.shadow.camera,{left:-span,right:span,top:span,bottom:-span,near:1,far:1400});sun.shadow.camera.updateProjectionMatrix();
 return true;
}

let roundStartedAt=0;
let selected='bat', completed=false, focused=null, soundOn=soundPreference(), audioReady=false, weaponBag;
let cooldownUntil=0, lastUi='', lastRhythmUi='', finisherUntil=0, impactSerial=0, lastImpact=null;
const RUBBLE_NOTE_MS=2200;
let toastTimer, impactTimer, targetTimer, completionTimer;
let nuclear=null, drillSession=null, spaceHeld=false;
const drillAim={x:innerWidth*.5,y:innerHeight*.5};
const drillProbe={hit:null,normal:null,lastProbe:-Infinity,x:NaN,y:NaN,depth:0};
const drillCameraPosition=new THREE.Vector3(Infinity,Infinity,Infinity),drillCameraQuaternion=new THREE.Quaternion();
const drillAirPoint=new THREE.Vector3(),drillAirNormal=new THREE.Vector3();
const pointers=new Map(), raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
let pinch=null, pinchRotation=0, pinchRotating=false, pinchMode=null;
const rhythm=createHitRhythm(), screenImpact=createScreenImpact({reducedMotion});
const recoilRight=new THREE.Vector3(), recoilUp=new THREE.Vector3();
const comicAudio=createComicAudio();
function syncMusic(){
 backgroundMusic.setPaused(document.hidden||!windowFocused||Boolean(nuclear));
 if(userAudioActivated)void backgroundMusic.setEnabled(soundOn&&musicMode!=='off');
}
const combatEffects=createComicEffects(THREE,scene,{reducedMotion});
const impactFeedback=createImpactFeedback(THREE,scene,{reducedMotion});
// On by default since 10-17 (phone-checked); ?classic turns the whole set off for comparison, &physics=off keeps the B collapse.
const [feelEffectsModule,feelNukeModule,feelPhysicsModule,nukeSirenModule]=feelOn?await feelModules:[];
const feel=feelOn?feelEffectsModule.createFeelEffects(THREE,scene,{reducedMotion,stop:feelQuery.get('stop'),groundHeight:campus.terrain.heightAt,canvas,camera}):null;
if(feel)window.feelDiagnostics=()=>feel.stats;
// ?feel: photographic mushroom cloud + terrain-hugging shock dust for the nuke (src/feel-nuke.js).
if(feel)combatEffects.setNuclearLook(feelNukeModule.createFeelNuke(THREE,{grid:campus.terrain.grid,mobile:renderQuality.profile.mobile,sunOffset:timeOfDay.sunOffset}));
// ?feel&physics: falling parts become rigid bodies (src/feel-physics.js; Rapier itself loads on the first attack).
if(feel&&feelQuery.get('physics')!=='off'){const physics=feelPhysicsModule.createFeelPhysics(THREE,{query:feelQuery});window.feelPhysicsDiagnostics=()=>({...physics.stats,live:physics.inspect()});}
let shotgunModelAsset=null;
try{shotgunModelAsset=await shotgunModelPromise;}
catch(error){console.warn('샷건 모델을 불러오지 못해 기본 모델을 사용해요.',error);}
const shotgunView=createShotgunView(THREE,scene,camera,{reducedMotion,modelAsset:shotgunModelAsset});
// Shield look and sound for protected buildings; only campuses with protected sites create the effect pool.
const heavyAudio=createHeavyAudio({output:()=>comicAudio.output?.()});
const shieldFx=protectedSet?createShieldEffects(THREE,scene,camera,{reducedMotion,sites:protectedSet.sites,output:()=>comicAudio.output?.()}):null;
let shieldHits=0,drillShield=null,drillPingAt=-Infinity;
const UP=new THREE.Vector3(0,1,0),groundProbe=new THREE.Vector3(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
// Why a protected building stands (user 10-19, copy B): one short line per building, at most every 4 s.
const SHIELD_NOTE_GAP=4,shieldNoteAt=new Map();
function shieldNoteText(name='',protectionKind=''){
 if(/병원|의료원|세브란스|치과|암센터/.test(name))return '병원은 건드리지 마!';
 if(/성당/.test(name))return '성당은 지켜져요';
 if(/교회/.test(name))return '교회는 지켜져요';
 if(/사찰|법당|암자|연화사|정각원|범종각/.test(name))return '절은 지켜져요';
 if(/채플|예배|한경직/.test(name))return '채플은 지켜져요';
 if(/예수회|수도회|수도원|사제관/.test(name))return '수도원은 지켜져요';
 if(/유치원|어린이집/.test(name))return '어린이 시설은 지켜져요';
 if(protectionKind==='school')return '학교 시설은 지켜져요';
 if(protectionKind==='religious')return '종교시설은 지켜져요';
 return '문화유산은 지켜져요';
}
function shieldNote(point){
 const site=protectedSet?.nearestSurface(point,12)?.site;if(!site)return;
 const now=performance.now()/1000;if(now-(shieldNoteAt.get(site)??-Infinity)<SHIELD_NOTE_GAP)return;
 shieldNoteAt.set(site,now);notify(shieldNoteText(site.name,site.protectionKind));
}
function shieldReact(point,normal,{size=8,strong=false,big=false,life=.7,delay=0}={}){
 if(!shieldFx)return;shieldHits++;shieldFx.flash(point,normal,size,{strong,life,delay});shieldNote(point);
 if(!delay)heavyAudio.play('shield',big);screenImpact.trigger({time:performance.now()/1000,toolId:'shield'});
}
// A blast that reaches a protected building lights the shield at its closest point (mini bomb / bazooka).
function blastShield(point,radius){const near=protectedSet?.nearestSurface(point,radius);if(near)shieldReact(near.point,near.normal,{size:Math.max(8,radius*1.5),strong:true,big:true,life:.9});}
// Surface under the pointer after pick(): the terrain, refined like the mini-bomb placement.
function groundAt(){
 groundPlane.constant=0;let found=null;
 for(let i=0;i<4;i++){
  if(!raycaster.ray.intersectPlane(groundPlane,groundProbe))break;
  const height=campus.terrain.heightAt(groundProbe.x,groundProbe.z);if(!Number.isFinite(height))break;found=groundProbe.clone();found.y=height;groundPlane.constant=-height;
 }
 return found&&found.distanceTo(camera.position)<2500?found:null;
}
const toolById=id=>TOOLS.find(tool=>tool.id===id);
const heavy=createHeavyWeapons(THREE,scene,camera,{reducedMotion,mobile:innerWidth<760||(globalThis.navigator?.maxTouchPoints>0&&matchMedia('(pointer: coarse)').matches),audio:heavyAudio,shield:shieldFx,
 probe(x,y){
  if(![x,y].every(Number.isFinite))return null;const hit=pick(x,y);
  if(hit){const site=hit.protectedSite||null;return{kind:site?'protected':'building',point:hit.point,normal:hitNormal(hit),site,targetId:hit.object.userData.entry?.id};}
  const ground=groundAt();return ground?{kind:'ground',point:ground,normal:UP.clone()}:null;
 },
 onRocket(hit){if(completed||nuclear)return;resolveAttack({tool:toolById('bazooka'),point:hit.point.clone(),normal:hit.normal.clone(),targetId:hit.targetId});},
 onBullet(hit){if(completed||nuclear)return;resolveAttack({tool:toolById('minigun'),point:hit.point.clone(),normal:hit.normal.clone(),targetId:hit.targetId});},
 onScorch(hit,amount){if(completed||nuclear)return;scorchAt(hit,amount);},
 onKick(id){screenImpact.trigger({time:performance.now()/1000,toolId:id});},
});
// Bowling-ball bomb (SKKU free slot, or the ad slot on any campus): rolls on the campus heightAt, ploughs buildings, bounces off the hanok shield, explodes when it stops.
const bowlingLib=await bowlingModule;
const bowling=bowlingLib?bowlingLib.createBowlingBall(THREE,scene,camera,{campus,protectedSet,shieldFx,reducedMotion,mobile:innerWidth<760||(globalThis.navigator?.maxTouchPoints>0&&matchMedia('(pointer: coarse)').matches),
 output:()=>comicAudio.output?.(),heavyAudio,pixelRatio:()=>renderer.getPixelRatio(),view,
 onDamage:bowlingDamage,
 onStrike({point,cleared}){if(completed||nuclear)return;screenImpact.trigger({time:performance.now()/1000,toolId:'mini-bomb',cleared});backgroundMusic.duck(.7);},
 onBlast({point,normal,result}){
  if(completed||nuclear)return;const now=performance.now()/1000;
  backgroundMusic.duck(.85);comicAudio.play('mini-blast');feel?.miniBomb(point,normal,now);
  combatEffects.hit({point,camera,tool:toolById('mini-bomb'),coins:0,impactDelay:0,normal,groundHeight:campus.terrain.heightAt});
  screenImpact.trigger({time:now,toolId:'mini-bomb',cleared:result.cleared.length});
 },
 onShield(point,normal,big,size){if(!completed&&!nuclear)shieldReact(point,normal,{size,strong:true,big,life:.8});},
 onKick(kind){if(!completed&&!nuclear)screenImpact.trigger({time:performance.now()/1000,toolId:kind==='land'?'bazooka-launch':'bat'});},
}):null;
// Damage the ball did (rolling plough, strike, shock, flying chunks, final blast): HUD, focus, debris feedback, clear notes.
function bowlingDamage(result,{kind,point,normal,radius,force,feedback}){
 if(completed||!result.count)return;const now=performance.now()/1000;
 impactSerial++;lastImpact={toolId:'bowling',kind,finisher:false,radius,force,count:result.count,weight:result.weight,clearedCount:result.cleared.length,point:{x:point.x,y:point.y,z:point.z}};
 if(feedback)impactFeedback.burst({point,normal,radius,force,toolId:'bowling',count:result.count,weight:result.weight,finisher:false,cleared:result.cleared.length});
 comicAudio.playDestruction({weight:result.weight,count:result.count,clearedCount:result.cleared.length});
 if(result.affected[0])setFocus(result.affected[0]);updateHud();
 if(feel&&result.cleared.length)feel.buildingCleared(result.cleared,now);
 if(result.cleared.length)notify(`${result.cleared.map(entry=>entry.name).join(', ')} 완파`);
 if(campus.clearedCount===campus.entries.length){stopInput();clearTimeout(completionTimer);completionTimer=setTimeout(finishRound,1100);}
}
// Wrecking-ball crane: tap a building, a crane stands beside that wall and swings the ball in (protected buildings: shield bounce).
const wreck=createWreckingBall(THREE,scene,camera,{campus,protectedSet,reducedMotion,mobile:innerWidth<760||(globalThis.navigator?.maxTouchPoints>0&&matchMedia('(pointer: coarse)').matches),
 output:()=>comicAudio.output?.(),heavyAudio,pixelRatio:()=>renderer.getPixelRatio?.()??1,
 onDamage:wreckDamage,
 onSlam({cleared}){if(completed||nuclear)return;screenImpact.trigger({time:performance.now()/1000,toolId:'bazooka',cleared});backgroundMusic.duck(.7);},
 onShield(point,normal,big,size){if(!completed&&!nuclear)shieldReact(point,normal,{size,strong:true,big,life:.8});},
 onKick(kind){if(!completed&&!nuclear)screenImpact.trigger({time:performance.now()/1000,toolId:kind==='land'?'bazooka-launch':'bat'});},
});
function wreckDamage(result,{point,normal,radius,force,feedback},toolId=WRECK_ID){
 if(completed||!result.count)return;const now=performance.now()/1000;
 impactSerial++;lastImpact={toolId,finisher:false,radius,force,count:result.count,weight:result.weight,clearedCount:result.cleared.length,point:{x:point.x,y:point.y,z:point.z}};
 if(feedback)impactFeedback.burst({point,normal,radius,force,toolId,count:result.count,weight:result.weight,finisher:false,cleared:result.cleared.length});
 comicAudio.playDestruction({weight:result.weight,count:result.count,clearedCount:result.cleared.length});
 if(result.affected[0])setFocus(result.affected[0]);updateHud();
 if(feel&&result.cleared.length)feel.buildingCleared(result.cleared,now);
 if(result.cleared.length)notify(`${result.cleared.map(entry=>entry.name).join(', ')} 완파`);
 if(campus.clearedCount===campus.entries.length){stopInput();clearTimeout(completionTimer);completionTimer=setTimeout(finishRound,1100);}
}
// Ruyi staff: tap a building (or the ground); the staff stretches down from the sky through it (protected buildings: shield).
const ruyi=createRuyiStaff(THREE,scene,camera,{campus,protectedSet,reducedMotion,mobile:innerWidth<760||(globalThis.navigator?.maxTouchPoints>0&&matchMedia('(pointer: coarse)').matches),
 output:()=>comicAudio.output?.(),heavyAudio,pixelRatio:()=>renderer.getPixelRatio?.()??1,
 onDamage:(result,options)=>wreckDamage(result,options,RUYI_ID),
 onImpact({cleared}){if(completed||nuclear)return;screenImpact.trigger({time:performance.now()/1000,toolId:'mini-bomb',cleared});backgroundMusic.duck(.8);},
 onShield(point,normal,big,size){if(!completed&&!nuclear)shieldReact(point,normal,{size,strong:true,big,life:.8});},
 onKick(){if(!completed&&!nuclear)screenImpact.trigger({time:performance.now()/1000,toolId:'bat'});},
});
// Robot vacuum (made only when it is in the bag): set down on the ground or outside a wall, it roams ~10 s swallowing rubble and
// biting the bottom of walls it bumps; impacts leave floor dust (PC) that it wipes (robovacSoil = last impactSerial seen).
const robovac=TOOLS.some(tool=>tool.id===ROBOVAC_ID)?createRobotVacuum(THREE,scene,camera,{campus,protectedSet,reducedMotion,mobile:innerWidth<760||(globalThis.navigator?.maxTouchPoints>0&&matchMedia('(pointer: coarse)').matches),
 output:()=>comicAudio.output?.(),pixelRatio:()=>renderer.getPixelRatio?.()??1,
 onDamage:(result,options)=>wreckDamage(result,options,ROBOVAC_ID),
 onShield(point,normal,big,size){if(!completed&&!nuclear)shieldReact(point,normal,{size,strong:false,big,life:.6});},
 onKick(){if(!completed&&!nuclear)screenImpact.trigger({time:performance.now()/1000,toolId:'bat'});},
}):null;let robovacSoil=0;
// Laser cutter: hold and draw over a building; on release the part above the line slides off (protected buildings: shield).
const laser=createLaserCutter(THREE,scene,camera,{campus,reducedMotion,mobile:innerWidth<760||(globalThis.navigator?.maxTouchPoints>0&&matchMedia('(pointer: coarse)').matches),
 output:()=>comicAudio.output?.(),pixelRatio:()=>renderer.getPixelRatio?.()??1,
 probe(x,y){
  if(![x,y].every(Number.isFinite))return null;const hit=pick(x,y,false);
  if(hit){const site=hit.protectedSite||null;return{kind:site?'protected':'building',point:hit.point,normal:hitNormal(hit),site,entry:site?null:hit.object.userData.entry};}
  const ground=groundAt();return ground?{kind:'ground',point:ground,normal:UP.clone()}:null;
 },
 onCut:laserDamage,
 onShield(point,normal){if(!completed&&!nuclear)shieldReact(point,normal,{size:6,life:.5});},
 onKick(){if(!completed&&!nuclear){screenImpact.trigger({time:performance.now()/1000,toolId:'drill'});backgroundMusic.duck(.5);}},
 onLand({size,count,weight}){if(completed||nuclear)return;screenImpact.trigger({time:performance.now()/1000,toolId:size>24?'bat':'bazooka-launch'});backgroundMusic.duck(.6);comicAudio.playDestruction({weight,count,clearedCount:0});},
});
function laserDamage(result,{point,normal,radius,force}){
 if(completed||!result.count)return;const now=performance.now()/1000;
 impactSerial++;lastImpact={toolId:LASER_ID,finisher:false,radius,force,count:result.count,weight:result.weight,clearedCount:result.cleared.length,point:{x:point.x,y:point.y,z:point.z}};
 impactFeedback.burst({point,normal,radius,force,toolId:LASER_ID,count:Math.min(result.count,result.kerf.length||1),weight:result.weight,finisher:false,cleared:result.cleared.length});
 if(result.affected[0]){setFocus(result.affected[0]);showTargetFeedback();}updateHud();
 if(feel&&result.cleared.length)feel.buildingCleared(result.cleared,now);
 if(result.cleared.length)notify(`${result.cleared.map(entry=>entry.name).join(', ')} 완파`);
 if(campus.clearedCount===campus.entries.length){stopInput();clearTimeout(completionTimer);completionTimer=setTimeout(finishRound,1100);}
}
// Free black hole: actual fragments, shared damage accounting and the existing shield copy.
const blackhole=createBlackHole(THREE,scene,{campus,protectedSet,reducedMotion,mobile:innerWidth<760,
 output:()=>windowFocused&&!document.hidden?comicAudio.output?.():null,
 onShield:(point,normal)=>shieldReact(point,normal,{size:10,strong:true}),
 onDamage:(result,{point})=>blastDamage(result,{point,normal:UP,radius:WEAPON_TUNING.blackhole.radius,force:1,feedback:false,toolId:BLACKHOLE_ID,sound:false})});
// Where the tap ray first meets the terrain. A y=0 plane misses on hill campuses (the ground sits above it), which pushed the
// point outside the campus and silently dropped black-hole taps.
function terrainPointOnRay(ray){
 const at=new THREE.Vector3(),step=2;let prev=null;
 for(let t=0;t<1600;t+=step){ray.at(t,at);const ground=campus.terrain.heightAt(at.x,at.z);
  if(Number.isFinite(ground)&&at.y<=ground){if(!prev)return null;let lo=t-step,hi=t;for(let i=0;i<12;i++){const mid=(lo+hi)/2;ray.at(mid,at);if(at.y<=campus.terrain.heightAt(at.x,at.z))hi=mid;else lo=mid;}ray.at(hi,at);at.y=campus.terrain.heightAt(at.x,at.z);return at.clone();}
  prev=t;}
 const flat=ray.intersectPlane(groundPlane,new THREE.Vector3());if(flat)flat.y=campus.terrain.heightAt(flat.x,flat.z);return flat;
}
function launchBlackHole(x,y){
 const hit=pick(x,y);let point=hit?.point||terrainPointOnRay(raycaster.ray);
 if(!point||point.x<campus.bounds.min.x||point.x>campus.bounds.max.x||point.z<campus.bounds.min.z||point.z>campus.bounds.max.z){notify('블랙홀은 캠퍼스 안을 눌러 열어요.');return;}
 const result=blackhole.launch({point,entry:hit?.object?.userData?.entry,site:hit?.protectedSite});
 if(result==='started'){breakRhythm();backgroundMusic.duck(.6);}
 else if(result==='busy')notify('블랙홀은 한 번에 하나만 열 수 있어요.');
 
}
// Blast demolition (ad-reward weapon): tap buildings to stick charges where the tap lands, 발파 -> charges go off at once in
// placement order -> a building that lost enough of its ground floor comes down in place, otherwise the part above each cut drops.
const blast=TOOLS.some(tool=>tool.id===BLAST_ID)?createBlastDemolition(THREE,scene,{campus,reducedMotion,onDetonate:blastDetonated,onCollapse:blastCollapsed,onChange:()=>syncBlastUi()}):null;
const toolLocked=id=>Boolean(toolById(id)?.ad)&&!isUnlocked(id);
let blastFire=null,blastFireCount=null,blastUiKey='';
if(blast){
 blastFire=document.createElement('button');blastFire.type='button';blastFire.className='blast-fire';blastFire.hidden=true;blastFire.disabled=true;
 const label=document.createElement('span');label.textContent='발파';blastFireCount=document.createElement('b');blastFireCount.textContent='0';blastFire.append(label,blastFireCount);
 document.querySelector('.current-weapon')?.append(blastFire);
 blastFire.addEventListener('click',()=>{activateAudio();if(blast.fire()){breakRhythm();comicAudio.play('mini-fuse');}syncBlastUi();});
}
function syncBlastUi(){
 if(!blast)return;const show=selected===BLAST_ID&&!nuclear&&!completed,key=[show,blast.count,blast.firing].join('|');if(key===blastUiKey)return;blastUiKey=key;
 blastFire.hidden=!show;blastFire.disabled=!blast.count||blast.firing;blastFireCount.textContent=String(blast.count);blastFire.setAttribute('aria-label',`발파, 폭약 ${blast.count}개`);
}
function placeCharge(x,y,now){
 if(!blast||![x,y].every(Number.isFinite))return;const hit=pick(x,y);if(!hit)return;
 // A protected building takes no charge: the shield answers instead.
 const site=hit.protectedSite||null,entry=site?null:hit.object.userData.entry,taken=blast.place({point:hit.point,normal:hitNormal(hit),entry,site});
 if(taken==='shield'){shieldReact(hit.point,hitNormal(hit),{size:8,strong:true});return;}
 if(taken==='full')notify(`폭약은 한 번에 ${blast.max}개까지 붙일 수 있어요.`);
 if(taken==='added'||taken==='removed'){cooldownUntil=now+currentTool().cooldown;comicAudio.play(taken==='added'?'bat-swing':'shotgun-pump');setFocus(entry);showTargetFeedback();}
 syncBlastUi();
}
function blastDetonated({point,normal,entry,result}){
 if(completed||nuclear)return;const now=performance.now()/1000;
 backgroundMusic.duck(.85);comicAudio.play('mini-blast');feel?.miniBomb(point,normal,now);
 screenImpact.trigger({time:now,toolId:'mini-bomb',cleared:result.cleared.length});
 if(!result.count)impactFeedback.burst({point,normal,radius:WEAPON_TUNING.blast.halfWidth*campus.worldUnitsPerMeter,force:WEAPON_TUNING.blast.force,toolId:'mini-bomb',count:6,weight:1,finisher:false,cleared:0});
 blastDamage(result,{point,normal,radius:WEAPON_TUNING.blast.halfWidth*campus.worldUnitsPerMeter,force:WEAPON_TUNING.blast.force,feedback:true});
 if(!result.cleared.length&&entry)setFocus(entry);
}
function blastCollapsed({entry,kind,result}){
 if(completed||nuclear||!result.count)return;const now=performance.now()/1000,box=entry.worldBounds,point=new THREE.Vector3((box.min.x+box.max.x)/2,box.min.y,(box.min.z+box.max.z)/2);
 screenImpact.trigger({time:now,toolId:kind==='full'?'bazooka':'mini-bomb',cleared:result.cleared.length});backgroundMusic.duck(.8);
 blastDamage(result,{point,normal:UP,radius:Math.max(box.max.x-box.min.x,box.max.z-box.min.z)/2,force:4,feedback:kind!=='full'});
 // A full collapse that stopped short of the clearing rule still gets the dust cloud.
 if(kind==='full'&&!result.cleared.length&&feel)feel.buildingCleared([entry],now);
}
// Shared by the blast and the bulldozer (toolId / burstId / sound: the bulldozer's light scrape bursts, its crunch only now and then).
function blastDamage(result,{point,normal,radius,force,feedback,toolId=BLAST_ID,burstId='mini-bomb',sound=true}){
 if(completed||!result.count)return;const now=performance.now()/1000;
 impactSerial++;lastImpact={toolId,finisher:false,radius,force,count:result.count,weight:result.weight,clearedCount:result.cleared.length,point:{x:point.x,y:point.y,z:point.z}};
 if(feedback)impactFeedback.burst({point,normal,radius,force,toolId:burstId,count:Math.min(result.count,60),weight:result.weight,finisher:false,cleared:result.cleared.length});
 if(sound||result.cleared.length)comicAudio.playDestruction({weight:result.weight,count:result.count,clearedCount:result.cleared.length});
 if(result.affected[0])setFocus(result.affected[0]);updateHud();
 if(feel&&result.cleared.length)feel.buildingCleared(result.cleared,now);
 if(result.cleared.length)notify(`${result.cleared.map(entry=>entry.name).join(', ')} 완파`);
 if(campus.clearedCount===campus.entries.length){stopInput();clearTimeout(completionTimer);completionTimer=setTimeout(finishRound,1100);}
}
// Bulldozer (ad-reward weapon): press and drag, it drives toward the pointer and scrapes the ground floor in front of its blade;
// a building that lost enough of its ground floor comes down in place, otherwise the part above the scraped strip drops.
const dozer=TOOLS.some(tool=>tool.id===DOZER_ID)?createBulldozer(THREE,scene,{campus,camera,protectedSet,reducedMotion,mobile:innerWidth<760||(globalThis.navigator?.maxTouchPoints>0&&matchMedia('(pointer: coarse)').matches),
 output:()=>comicAudio.output?.(),heavyAudio,
 probe(x,y,fresh){
  if(![x,y].every(Number.isFinite))return null;const hit=pick(x,y,fresh);
  if(hit){const site=hit.protectedSite||null;return{kind:site?'protected':'building',point:hit.point,normal:hitNormal(hit),site,entry:site?null:hit.object.userData.entry};}
  const ground=groundAt();return ground?{kind:'ground',point:ground,normal:UP.clone()}:null;
 },
 onScrape:dozerScraped,onCollapse:dozerCollapsed,
 onShield(point,normal){if(!completed&&!nuclear)shieldReact(point,normal,{size:8,strong:true,life:.6});},
}):null;
function dozerScraped({entry,point,normal,result,feedback,first}){
 if(completed||nuclear)return;
 if(first){screenImpact.trigger({time:performance.now()/1000,toolId:'drill'});backgroundMusic.duck(.5);setFocus(entry);showTargetFeedback();}
 blastDamage(result,{point,normal,radius:WEAPON_TUNING.bulldozer.blade*campus.worldUnitsPerMeter,force:WEAPON_TUNING.bulldozer.force,feedback,toolId:DOZER_ID,burstId:'drill',sound:feedback});
}
function dozerCollapsed({entry,kind,result}){
 if(completed||nuclear||!result.count)return;const now=performance.now()/1000,box=entry.worldBounds,point=new THREE.Vector3((box.min.x+box.max.x)/2,box.min.y,(box.min.z+box.max.z)/2);
 screenImpact.trigger({time:now,toolId:kind==='full'?'bazooka':'mini-bomb',cleared:result.cleared.length});backgroundMusic.duck(.8);
 blastDamage(result,{point,normal:UP,radius:Math.max(box.max.x-box.min.x,box.max.z-box.min.z)/2,force:4,feedback:kind!=='full',toolId:DOZER_ID});
 if(kind==='full'&&!result.cleared.length&&feel)feel.buildingCleared([entry],now);
}
let sceneActive=true; // set each frame from the same activity test that drives adaptive resolution
function renderGame(){
 // Count both passes together; the gun keeps its own depth buffer and lighting.
 const exposure=renderer.toneMappingExposure;
 if(feelNukeModule){
  const post=nuclear?nuclear.age-NUCLEAR_IMPACT_AT:-1;
  renderer.toneMappingExposure=exposure*feelNukeModule.nukeScreenState(post,reducedMotion).exposure;
  const ratio=nuclear?feelNukeModule.nukePixelRatio(renderQuality.ratio,innerWidth,innerHeight,renderQuality.profile.mobile):renderQuality.effectiveRatio(performance.now(),sceneActive);
  if(renderer.getPixelRatio()!==ratio)renderer.setPixelRatio(ratio);
 } else {const ratio=renderQuality.effectiveRatio(performance.now(),sceneActive);if(renderer.getPixelRatio()!==ratio)renderer.setPixelRatio(ratio);}
 const autoReset=renderer.info.autoReset;renderer.info.autoReset=false;renderer.info.reset?.();
 try{if(!blackhole.render(renderer,camera))renderer.render(scene,camera);shotgunView.render(renderer);heavy.render(renderer);wreck.render(renderer);laser.render(renderer);}
 finally{renderer.info.autoReset=autoReset;renderer.toneMappingExposure=exposure;}
}
const shotgunAim={x:innerWidth*.5,y:innerHeight*.5,inside:true};
let shotgunCycle=null,shotgunShots=0,lastShot=null;
function syncShotgun(){
 const free=!nuclear&&!completed&&!document.hidden&&windowFocused&&!document.querySelector('dialog[open]');
 const visible=selected==='shotgun'&&free,heavyVisible=HEAVY_WEAPON_IDS.includes(selected)&&free;
 heavy.setAim(shotgunAim.x,shotgunAim.y,innerWidth,innerHeight);shotgunView.setVisible(visible);heavy.setTool(selected);heavy.setVisible(heavyVisible);
 wreck.setState(selected===WRECK_ID&&!nuclear,free); // remote in hand + diesel idle only while free; put away -> every crane vanishes
 laser.setState(selected===LASER_ID&&!nuclear,free);
 dozer?.setState(selected===DOZER_ID&&!nuclear&&!completed,free);
 if(!visible&&shotgunCycle){shotgunCycle=null;comicAudio.stopCue('shotgun-pump');}
 shotgunView.setAim({...shotgunAim,width:innerWidth,height:innerHeight});
 // Hold weapons keep the reticle while the pointer is down (the canvas is 'grabbing' during the hold).
 const laserVisible=selected===LASER_ID&&free&&!laser.holding;
 const reticle=$('shotgun-reticle');reticle.hidden=!(visible||heavyVisible||laserVisible)||!shotgunAim.inside||canvas.classList.contains('grabbing')&&!heavy.holding;
 reticle.style.left=`${shotgunAim.x}px`;reticle.style.top=`${shotgunAim.y}px`;
 reticle.dataset.fired=String(Boolean(shotgunCycle&&shotgunCycle.age<.18)||heavyVisible&&heavy.firing);
 reticle.dataset.hit=String(Boolean(shotgunCycle&&shotgunCycle.age<.18&&lastShot?.hits));
}
const actionVisuals=new Map();
const weaponActions=createWeaponActions({
 onStart(action){
  const worldRadius=action.tool.id==='nuke'?campusRadius(action.point):undefined;
  const visual=combatEffects.hit({point:action.point,camera,tool:action.tool,coins:0,impactDelay:action.delay,normal:action.normal,worldRadius,groundHeight:campus.terrain.heightAt});
  if(visual?.accepted===false)return false;
  actionVisuals.set(action.id,visual);
  if(action.tool.id==='nuke')comicAudio.play('nuke-air');else if(action.tool.id==='mini-bomb')breakRhythm();else {backgroundMusic.duck(.45);comicAudio.play('bat-swing');}
 },
 onLand(action){if(action.tool.id==='mini-bomb'){comicAudio.play('mini-fuse');if(action.bounced)heavyAudio.play('shield',true);}},
 onImpact:resolveAttack,
});
function activateAudio(){
 userAudioActivated=true;windowFocused=true;syncMusic();
 if(!soundOn)return;
 comicAudio.setEnabled(true);
 if(!audioReady){audioReady=true;void comicAudio.loadDrillLoop();void comicAudio.loadImpactSample();void comicAudio.loadMiniBlastSample();void comicAudio.loadShotgunSample();void comicAudio.loadCountdownSamples();}
}
// ?feel preview: distant air-raid siren under the nuclear countdown (src/nuke-siren.js). Without the flag it is never loaded.
const nukeSiren=feelOn?nukeSirenModule.createNukeSiren():null;
if(nukeSiren)window.nukeSirenDiagnostics=()=>nukeSiren.stats;
// The campus shaders started compiling above; finish before input listeners attach and the first frame renders.
// The effect pools created since (hidden until the first hit) start compiling now too, without holding up the first frame,
// so an early strike does not stall on them.
await shaderWarmup;
try{renderer.compileAsync(scene,camera).catch(()=>{});}catch{}
function updateCountdown(){
 const element=$('nuclear-countdown');
 if(!nuclear||nuclear.age>=NUCLEAR_COUNTDOWN_SECONDS){element.hidden=true;return;}
 const progress=Math.min(1,nuclear.age/NUCLEAR_COUNTDOWN_SECONDS);
 element.style.setProperty('--countdown-progress',String(progress));
 element.style.setProperty('--countdown-angle',`${reducedMotion?0:nuclear.age*360}deg`);
 const value=Math.max(1,Math.ceil(NUCLEAR_COUNTDOWN_SECONDS-nuclear.age));
 if(value===nuclear.countdown)return;
 nuclear.countdown=value;element.hidden=false;element.dataset.count=String(value);
 $('nuclear-countdown-value').textContent=String(value);element.setAttribute('aria-label',`투하 ${value}초 전`);
 comicAudio.playCountdown(value);
}
function releaseNuclearCamera(){
 if(nuclearShot)view.adoptPose(camera.position,nuclearShot.target,{groundLevel:campus.terrain.heightAt(nuclearShot.target.x,nuclearShot.target.z)});
 nuclearCamera=null;nuclearShot=null;
}
function currentTool(){return TOOLS.find(tool=>tool.id===selected);}
function notify(message){
 $('rubble-toast').textContent=message;$('rubble-toast').classList.add('show');clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>{$('rubble-toast').classList.remove('show');$('rubble-toast').textContent='';},RUBBLE_NOTE_MS);
}
function stopDrill(){
 comicAudio.stopDrill();drillSession=null;combatEffects.updateDrill({running:false,contact:false});
 if(drillShield){shieldFx?.release(drillShield);drillShield=null;}
}
function stopInput(){stopDrill();heavy.release();laser.cancel();dozer?.release();pointers.clear();pinch=null;canvas.classList.remove('grabbing');}
function openDialog(id){
 stopInput();combatEffects.stopDrill();weaponBag?.close();
 for(const other of ['settings-dialog','reset-dialog','complete-dialog'])if(other!==id&&$(other).open)$(other).close();
 // showModal focuses the first control; on phones that opens the music <select> picker by itself, so focus the title instead.
 const dialog=$(id),title=dialog.querySelector('h2');if(title&&!title.hasAttribute('autofocus')){title.tabIndex=-1;title.setAttribute('autofocus','');}
 dialog.showModal();syncShotgun();
}
function updateRhythm(now=performance.now()/1000){
 const state=rhythm.state(now), charge=state.weapon===selected?state.charge:0, eligible=selected==='bat', burst=eligible&&now<finisherUntil;
 const percentage=Math.round((charge?state.remaining:0)*100), key=[eligible,burst,charge,percentage].join('|');
 if(key===lastRhythmUi)return;lastRhythmUi=key;
 const meter=$('rhythm-meter');meter.hidden=!eligible;meter.dataset.charge=String(burst?3:charge);meter.dataset.ready=String(charge===2);meter.setAttribute('aria-valuenow',String(burst?3:charge));
 $('rhythm-label').textContent=burst?'강타':charge===2?'다음 타격은 강타':charge===1?'한 번 더':'3연타마다 강타';
 $('rhythm-time').style.width=`${percentage}%`;
}
function breakRhythm(){rhythm.breakChain();finisherUntil=0;updateRhythm();}
function weaponHint(){
 const coarse=matchMedia('(pointer: coarse)').matches;
 if(selected==='drill')return coarse?'눌러서 작동 · 두 손가락으로 지도 이동':'누르는 동안 작동 · Space+드래그로 지도 이동';
 if(HOLD_WEAPON_IDS.includes(selected)||selected===LASER_ID||selected===DOZER_ID)return `${currentTool().hint} · ${coarse?'두 손가락으로 이동':'Space+드래그로 이동'}`;
 return currentTool().hint;
}
function updateWeapon(){
 $('equipped-name').textContent=currentTool().name;$('weapon-use-hint').textContent=weaponHint();
 canvas.dataset.tool=selected;weaponBag?.render();updateRhythm();syncShotgun();syncBlastUi();
}
function updateHud(){
 const destruction=Math.min(100,Math.round(campus.destroyedWeight/campus.totalWeight*100));
 const targetDamage=focused?Math.round(focused.model.destroyedWeight/focused.model.totalWeight*100):0;
 const key=[destruction,campus.clearedCount,focused?.id,targetDamage].join('|');if(key===lastUi)return;lastUi=key;
 $('destruction').textContent=`${destruction}%`;$('damage-fill').style.width=`${destruction}%`;$('cleared-count').textContent=`${campus.clearedCount} / ${campus.entries.length}`;
 $('building-name').textContent=focused?.name||'';$('target-damage').textContent=focused?(focused.cleared?'완파':`${targetDamage}%`):'';
}
// Local tuning only: ?startframe={"min":[..],"max":[..],"azimuth":..} overrides the package's first view (127.0.0.1/localhost).
function devStartFrame(){
 const l=globalThis.location;if(!l||!/^(127\.0\.0\.1|localhost)$/.test(l.hostname))return null;
 try{return JSON.parse(new URLSearchParams(l.search).get('startframe')||'null');}catch{return null;}
}
function setFocus(entry,moveCamera=false){
 focused=entry||null;
 // A package may frame its first view as a box (world units) seen from a fixed azimuth, e.g. SKKU: from the 문묘 side up the slope to 경영관.
 const frame=entry===startBuilding?devStartFrame()||campusPackage.view?.startFrame:null;
 if(entry&&moveCamera&&frame)view.focus(new THREE.Box3(new THREE.Vector3(...frame.min),new THREE.Vector3(...frame.max)),{azimuth:frame.azimuth,elevationDegrees:frame.elevationDegrees,groundLevel:entry.baseY||0});
 else if(entry&&moveCamera)view.focus(entry.worldBounds,{azimuth:entry.rotation+.18+(entry===startBuilding?campusPackage.view?.startTurn||0:0),points:entry.focusPoints,groundLevel:entry.baseY||0});
 updateHud();
}
function showTargetFeedback(){
 if(nuclear)return;
 $('target-card').classList.add('visible');
 clearTimeout(targetTimer);targetTimer=setTimeout(()=>{$('target-card').classList.remove('visible');},2200);
}
function openBag(){if(nuclear)return;activateAudio();stopInput();combatEffects.stopDrill();weaponBag.open();syncShotgun();}
function chooseTool(id){
 if(nuclear||!TOOLS.some(tool=>tool.id===id)||toolLocked(id))return false;
 // Put away, the blast weapon takes its charges, wire and countdown with it.
 if(selected===BLAST_ID&&id!==BLAST_ID)blast?.clear();
 if(selected===BLACKHOLE_ID&&id!==BLACKHOLE_ID)blackhole.clear();
 stopInput();if(selected!==id){breakRhythm();combatEffects.stopDrill();track('weapon_select',{weapon:id});}selected=id;drillProbe.lastProbe=-Infinity;updateWeapon();
 if(id==='bowling'&&bowling&&!bowlingSeen){bowlingSeen=true;aimBowling(innerWidth/2,innerHeight*.55,true);}
 return true;
}
function applyQuality(){
 const profile=renderQuality.profile;renderer.setPixelRatio(profile.pixelRatio);renderer.setSize(innerWidth,innerHeight,false);
 if(sun.shadow.mapSize.x!==profile.shadowSize){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(profile.shadowSize,profile.shadowSize);}
 shadowBudget.setRate(profile.shadowHz);shadowBudget.invalidate();
}
function resize(){
 renderQuality.resize(innerWidth,innerHeight,devicePixelRatio);applyQuality();
 const style=typeof getComputedStyle==='function'?getComputedStyle(document.documentElement):null;
 view.resize(innerWidth,innerHeight,{top:parseFloat(style?.getPropertyValue('--safe-top'))||0,bottom:parseFloat(style?.getPropertyValue('--safe-bottom'))||0});
}
$('quality-select').value=renderQuality.mode;
$('quality-select').addEventListener('change',event=>{if(renderQuality.setMode(event.target.value)){applyQuality();try{localStorage.setItem(QUALITY_KEY,renderQuality.mode);}catch{}}});
function impact(point,tool,finisher=false){
 if(tool.id==='drill'||tool.id==='nuke'||tool.id==='mini-bomb'||tool.id==='shotgun'||tool.id==='minigun'||tool.id==='flamethrower'||tool.id==='bazooka')return; // Tool contact and cinematic blast carry their own visual feedback (bazooka label dropped, user 10-18).
 const p=point.clone().project(camera),x=Math.max(30,Math.min(innerWidth-130,(p.x*.5+.5)*innerWidth)),y=Math.max(100,Math.min(innerHeight-65,(-p.y*.5+.5)*innerHeight));
 const text=$('impact-text');text.dataset.finisher=String(finisher);text.textContent=tool.id==='nuke'?'콰아앙':finisher?'와장창':'쾅';text.style.left=`${x}px`;text.style.top=`${y}px`;
 text.classList.remove('show');void text.offsetWidth;text.classList.add('show');clearTimeout(impactTimer);impactTimer=setTimeout(()=>text.classList.remove('show'),650);
}
// fresh=false (laser probes, several a frame): the scene matrices of this frame are current, only the camera is refreshed.
function pick(x,y,fresh=true){
 if(fresh){view.update();scene.updateMatrixWorld(true);}else camera.updateMatrixWorld();pointer.set(x/innerWidth*2-1,-y/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);
 const meshes=[];for(const entry of campus.entries)if(!entry.cleared&&raycaster.ray.intersectsBox(entry.worldBounds))meshes.push(...entry.model.meshes);
 if(protectedSet)for(const site of protectedSet.sites)if(raycaster.ray.intersectsBox(site.pickBox || site.box))meshes.push(...site.meshes);
 const hit=raycaster.intersectObjects(meshes,false)[0]||null;
 // A protected building in front stops the ray; callers react with the shield instead of damage.
 if(hit&&protectedSet){const site=protectedSet.siteOf(hit.object);if(site)hit.protectedSite=site;}
 return hit;
}
function hitNormal(hit){
 const normal=hit.face?.normal?.clone().transformDirection(hit.object.matrixWorld)||new THREE.Vector3(0,1,0);
 if(normal.dot(camera.position.clone().sub(hit.point))<0)normal.negate();return normal;
}
function campusRadius(point){
 let radius=1;for(const x of [campus.bounds.min.x,campus.bounds.max.x])for(const z of [campus.bounds.min.z,campus.bounds.max.z])radius=Math.max(radius,Math.hypot(x-point.x,z-point.z));
 return radius+35;
}
function dismissGestureHint(){$('gesture-hint').hidden=true;}
function fireShotgun(x,y,now){
 if(![x,y].every(Number.isFinite)||x<0||x>innerWidth||y<0||y>innerHeight)return;
 shotgunAim.x=x;shotgunAim.y=y;shotgunAim.inside=true;syncShotgun();
 if(!shotgunView.fire())return;
 view.update();scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 const sample=sampleShotgunHits(THREE,{camera,entries:campus.entries,x,y,width:innerWidth,height:innerHeight,...(protectedSet?{blockers:protectedSet.sites}:{})});
 const tool=currentTool();cooldownUntil=now+tool.cooldown;shotgunCycle={age:0,pumped:false};shotgunShots++;
 lastShot={rayCount:sample.rayCount,candidateBuildings:sample.candidateBuildings,hits:sample.hits.length};
 breakRhythm();backgroundMusic.duck(.55);comicAudio.play('shotgun');screenImpact.trigger({time:now,toolId:'shotgun'});
 if(sample.hits.length){const hit=sample.hits[0];resolveAttack({tool,point:hit.point,normal:hit.normal,targetId:hit.entry.id,hits:sample.hits});}
 // Pellets stopped by a hospital shield: one shield flash and blue sparks per pellet.
 if(sample.blocked?.length){shieldReact(sample.blocked[0].point,sample.blocked[0].normal,{size:6,life:.6});for(const b of sample.blocked)heavy.shieldSparks(b.point,b.normal);}
 syncShotgun();
}
function strike(x,y){
 dismissGestureHint();const now=performance.now()/1000;
 if(completed||nuclear||selected==='drill'||now<cooldownUntil)return;
 if(selected==='shotgun'){fireShotgun(x,y,now);return;}
 if(selected==='bazooka'){fireBazooka(x,y,now);return;}
 if(selected==='bowling'){rollBowling(x,y,now);return;}
 if(selected===WRECK_ID){swingWreck(x,y,now);return;}
 if(selected===RUYI_ID){strikeRuyi(x,y,now);return;}
 if(selected===ROBOVAC_ID){dropRobovac(x,y,now);return;}
 if(selected===BLAST_ID){placeCharge(x,y,now);return;}
 if(selected===BLACKHOLE_ID){launchBlackHole(x,y);return;}
 if(HOLD_WEAPON_IDS.includes(selected)||selected===LASER_ID||selected===DOZER_ID)return; // hold weapons fire from pointerdown
 const tool=currentTool(),hit=pick(x,y),site=hit?.protectedSite||null;
 let point=hit?.point;
 if(!point&&tool.id==='nuke'){
  point=groundAt();
  if(point){
   point.x=THREE.MathUtils.clamp(point.x,campus.bounds.min.x,campus.bounds.max.x);
   point.z=THREE.MathUtils.clamp(point.z,campus.bounds.min.z,campus.bounds.max.z);
   // Clamping can move the target onto a different terrace: flight and impact use its actual height.
   point.y=campus.terrain.heightAt(point.x,point.z);
  }
 }
 if(!point&&tool.id==='mini-bomb'){
  // Refine a horizontal intersection against the same terrain used by the campus.
  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),candidate=new THREE.Vector3();
  for(let i=0;i<6;i++){
   if(!raycaster.ray.intersectPlane(plane,candidate))break;
   if(candidate.x<campus.bounds.min.x||candidate.x>campus.bounds.max.x||candidate.z<campus.bounds.min.z||candidate.z>campus.bounds.max.z)break;
   point=candidate.clone();const height=campus.terrain.heightAt(point.x,point.z);point.y=height;plane.constant=-height;
  }
 }
 if(!point){breakRhythm();return;}
 if(tool.id==='mini-bomb'&&weaponActions.countFor('mini-bomb')>=3){notify('폭탄은 한 번에 3개까지 놓을 수 있어요.');return;}
 if(tool.id==='nuke'){
  stopInput();breakRhythm();weaponActions.clear();actionVisuals.clear();combatEffects.clear();comicAudio.stopAll();
  clearTimeout(completionTimer);
  nuclear={framing:{worldRadius:campusRadius(point),groundY:campus.terrain.heightAt(point.x,point.z)},age:0,phase:'countdown',countdown:0,point:point.clone(),tool:{...tool},targetId:hit?.object.userData.entry?.id};
  syncMusic();nukeSiren?.start({enabled:soundOn&&userAudioActivated});
  nuclearCamera=createNuclearCamera(THREE,camera,{point,...nuclear.framing,azimuth:view.state.azimuth,reducedMotion});
  nuclearShot=null;$('shop-open').disabled=true;$('target-card').classList.remove('visible');
  $('finale-status').hidden=false;$('finale-status').textContent='투하 준비';updateCountdown();
  cooldownUntil=now+tool.cooldown;return;
 }
 let normal=hit?hitNormal(hit):new THREE.Vector3(0,1,0),bounced=null;
 // A mini bomb thrown at a hospital bounces off the shield and lands on the ground in front of it.
 if(site&&tool.id==='mini-bomb'){bounced={point:point.clone(),normal:normal.clone()};point=bounceLanding(site,point,normal);normal=new THREE.Vector3(0,1,0);}
 const action=weaponActions.start({point,tool,normal});
 if(!action){nuclear=null;$('shop-open').disabled=false;$('finale-status').hidden=true;return;}
 action.targetId=hit?.object.userData.entry?.id;
 action.normal=normal;
 action.direction=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
 if(site&&!bounced)action.protectedSite=site;
 if(bounced){action.bounced=bounced;shieldReact(bounced.point,bounced.normal,{size:9,strong:true,life:.8,delay:.24});}
 cooldownUntil=now+tool.cooldown;
 if(hit&&!site){setFocus(hit.object.userData.entry);showTargetFeedback();}
}
// Ground point just outside a protected outline, on the side the bomb came from.
function bounceLanding(site,point,normal){
 const out=new THREE.Vector3(normal.x,0,normal.z);
 if(out.lengthSq()<.09)out.set(camera.position.x-site.centerX,0,camera.position.z-site.centerZ);
 out.normalize();const p=point.clone();
 for(let i=0;i<80&&insideSite(site,p);i++)p.addScaledVector(out,1.5);
 p.addScaledVector(out,3);p.y=campus.terrain.heightAt(p.x,p.z);return p;
}
function insideSite(site,p){let yes=false;const r=site.ring;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)yes=!yes;}return yes;}
function fireBazooka(x,y,now){
 if(![x,y].every(Number.isFinite)||x<0||x>innerWidth||y<0||y>innerHeight)return;
 shotgunAim.x=x;shotgunAim.y=y;shotgunAim.inside=true;syncShotgun();
 if(!heavy.press(now))return;
 cooldownUntil=now+toolById('bazooka').cooldown;breakRhythm();backgroundMusic.duck(.5);
}
// Wrecking ball: only a building (or a protected one: the ball bounces off its shield) is a target; the module picks the crane spot.
function swingWreck(x,y,now){
 if(![x,y].every(Number.isFinite))return;
 const hit=pick(x,y);if(!hit)return;
 const site=hit.protectedSite||null,entry=site?null:hit.object.userData.entry;
 const taken=wreck.swing({point:hit.point,normal:hitNormal(hit),entry,site,now});
 if(taken==='no-spot')notify('크레인이 들어갈 자리가 없어요');if(taken!==true)return;
 cooldownUntil=now+WEAPON_TUNING.wreckingBall.refire;breakRhythm();backgroundMusic.duck(.4);
 if(entry){setFocus(entry);showTargetFeedback();}
}
// Ruyi staff: the tapped building (or ground) spot; a protected building takes it on its shield.
function strikeRuyi(x,y,now){
 if(![x,y].every(Number.isFinite))return;
 const hit=pick(x,y),point=hit?.point||groundAt();if(!point)return;
 const site=hit?.protectedSite||null,entry=site?null:hit?.object.userData.entry||null;
 if(ruyi.strike({point,normal:hit?hitNormal(hit):UP,entry,site,now})!==true)return;
 cooldownUntil=now+WEAPON_TUNING.ruyi.cooldown;breakRhythm();backgroundMusic.duck(.4);
 if(entry){setFocus(entry);showTargetFeedback();}
}
// Robot vacuum: the tapped ground, or just outside the tapped wall (a protected one too: it bounces off the shield).
function dropRobovac(x,y,now){
 if(!robovac||![x,y].every(Number.isFinite))return;
 const hit=pick(x,y),point=hit?.point||groundAt();if(!point)return;
 const site=hit?.protectedSite||null,entry=site?null:hit?.object.userData.entry||null;
 if(robovac.strike({point,normal:hit?hitNormal(hit):UP,entry,site})!==true)return;
 cooldownUntil=now+WEAPON_TUNING.robovac.cooldown;breakRhythm();
}
// Bowling ball: the tapped surface (building, hanok or ground) is the spot it should roll through; it is let go up the slope.
function rollBowling(x,y,now){
 if(!bowling||![x,y].every(Number.isFinite))return;
 const hit=pick(x,y),point=hit?.point||groundAt();if(!point)return;
 if(!bowling.launch(point.x,point.z,now))return;
 cooldownUntil=now+currentTool().cooldown;breakRhythm();backgroundMusic.duck(.5);
 if(hit&&!hit.protectedSite){setFocus(hit.object.userData.entry);showTargetFeedback();}
 bowlingAim=null;
}
// Bowling aim preview: hover (mouse) or press-and-hold (touch) shows the drop point, the predicted roll and the spot; the first
// time the ball is picked it shows for the screen centre. Probed at most every 70 ms from the frame loop.
let bowlingAim=null,bowlingAimAt=-Infinity,bowlingSeen=false;
function aimBowling(x,y,now=false){if(bowling&&selected==='bowling'){bowlingAim={x,y};if(now)bowlingAimAt=-Infinity;}}
function updateBowlingAim(time){
 // no drop marker while a ball is still rolling / the camera follows it (user 10-18: the marker during a roll looks odd)
 if(selected!=='bowling'||nuclear||completed||bowling.count||bowling.following||document.querySelector('dialog[open]')){if(bowling.previewing)bowling.hidePreview();bowlingAim=null;return;}
 if(!bowlingAim||time-bowlingAimAt<70)return;
 bowlingAimAt=time;const {x,y}=bowlingAim;bowlingAim=null;
 const hit=pick(x,y),point=hit?.point||groundAt();if(point)bowling.preview(point.x,point.z);else bowling.hidePreview();
}
// Flamethrower char (campus.scorch); crumbled pieces count as damage like any other hit.
function scorchAt(hit,amount){
 const tool=toolById('flamethrower'),result=campus.scorch(hit.point,tool.radius,amount);
 if(!result.count)return;
 const now=performance.now()/1000;heavy.crumbled(hit.point,hit.normal,now);
 impactSerial++;lastImpact={toolId:tool.id,finisher:false,radius:tool.radius,force:0,count:result.count,weight:result.weight,clearedCount:result.cleared.length,point:{x:hit.point.x,y:hit.point.y,z:hit.point.z}};
 impactFeedback.burst({point:hit.point,normal:hit.normal,radius:tool.radius,force:3,toolId:tool.id,count:result.count,weight:result.weight,finisher:false,cleared:result.cleared.length});
 comicAudio.playDestruction({weight:result.weight,count:result.count,clearedCount:result.cleared.length});
 setFocus(result.affected.find(entry=>entry.id===hit.targetId)||result.affected[0]);showTargetFeedback();updateHud();
 if(feel&&result.cleared.length)feel.buildingCleared(result.cleared,now);
 if(result.cleared.length)notify(`${result.cleared.map(entry=>entry.name).join(', ')} 완파`);
 if(campus.clearedCount===campus.entries.length){stopInput();completionTimer=setTimeout(finishRound,1100);}
}
function finishRound(){
 if(completed)return;completed=true;stopDrill();
 $('final-cleared').textContent=`${campus.clearedCount} / ${campus.entries.length}`;
 openDialog('complete-dialog');
 track('campus_complete',{campus:campusPackage.id,seconds:Math.round((performance.now()-roundStartedAt)/1000)});
}
function resolveAttack(action){
 const visual=actionVisuals.get(action.id);actionVisuals.delete(action.id);
 if(completed){visual?.resolve?.({coins:0});return;}
 const {tool,point}=action,now=performance.now()/1000;
 // Protected building: the tool meets the shield (flash + "팅"), nothing is damaged.
 if(action.protectedSite){visual?.resolve?.({coins:0});if(tool.id==='bat')breakRhythm();shieldReact(point,action.normal||UP,{size:tool.id==='bat'?14:9,strong:true});return;}
 if(tool.id==='nuke'){
  visual?.resolve?.({coins:0});$('nuclear-countdown').hidden=true;comicAudio.stopCue('nuke-air');comicAudio.play('nuke');
  // Every protected building raises a hex dome as the shock front reaches it, and stays standing.
  if(protectedSet&&shieldFx){
   const far=Math.max(1,...protectedSet.sites.map(site=>Math.hypot(site.centerX-point.x,site.centerZ-point.z)));
   for(const site of protectedSet.sites)shieldFx.dome(site,{delay:.12+Math.hypot(site.centerX-point.x,site.centerZ-point.z)/far*1.4*.84,life:WEAPON_TUNING.shield.domeSeconds,origin:point});
   heavyAudio.play('shield',true);shieldHits++;
  }
  campus.startFinale(point,{duration:1.4});nuclear.phase='blast';$('finale-status').textContent='충격파';
  screenImpact.trigger({time:now,toolId:'nuke',cleared:campus.entries.length});impact(point,tool);
  if(!feelNukeModule)$('nuclear-flash').classList.add('show');return;
 }
 if(tool.id==='mini-bomb'){backgroundMusic.duck(.85);comicAudio.play('mini-blast');feel?.miniBomb(point,action.normal,now);}
 if(tool.id==='mini-bomb'||tool.id==='bazooka')blastShield(point,tool.radius);
 const hitProfile=rhythm.prepare(tool.id,now),radius=tool.radius*hitProfile.radiusMultiplier,force=tool.force*hitProfile.forceMultiplier;
 let result;
 if(tool.id==='shotgun'){
  result={count:0,weight:0,affected:[],cleared:[]};const affected=new Set(),cleared=new Set();
  for(const pellet of action.hits){
   const damage=campus.hit(pellet.point,radius,force,{direction:pellet.direction});
   result.count+=damage.count;result.weight+=damage.weight;
   for(const entry of damage.affected)affected.add(entry);for(const entry of damage.cleared)cleared.add(entry);
   if(damage.count)impactFeedback.burst({point:pellet.point,normal:pellet.normal,radius,force,toolId:tool.id,count:damage.count,weight:damage.weight,cleared:damage.cleared.length});
  }
  result.affected=[...affected];result.cleared=[...cleared];
  if(feel)for(const pellet of action.hits)feel.pelletSparks(pellet.point,pellet.normal);
 }else result=campus.hit(point,radius,force,{direction:tool.id==='bat'?action.direction:undefined});
 visual?.resolve?.({coins:0});if(!result.count){if(tool.id==='bat')breakRhythm();if(tool.id==='mini-bomb'||tool.id==='bazooka')screenImpact.trigger({time:now,toolId:tool.id});return;}
 rhythm.confirm(tool.id,now,result.count);
 const finisher=hitProfile.finisher;finisherUntil=finisher?now+.55:0;
 impactSerial++;lastImpact={toolId:tool.id,finisher,radius,force,count:result.count,weight:result.weight,clearedCount:result.cleared.length,point:{x:point.x,y:point.y,z:point.z}};
 if(tool.id!=='shotgun')impactFeedback.burst({point,normal:action.normal,radius,force,toolId:tool.id,count:result.count,weight:result.weight,finisher,cleared:result.cleared.length});
 screenImpact.trigger({time:now,toolId:tool.id,finisher,cleared:result.cleared.length});
 backgroundMusic.duck(tool.id==='bat'?.65:tool.id==='mini-bomb'?.85:tool.id==='shotgun'?.55:.3);
 if(tool.id==='bat')comicAudio.play('bat');
 comicAudio.playDestruction({weight:result.weight,count:result.count,clearedCount:result.cleared.length});impact(point,tool,finisher);
 setFocus(result.affected.find(entry=>entry.id===action.targetId)||result.affected[0]);showTargetFeedback();updateWeapon();updateHud();
 if(feel&&result.cleared.length)feel.buildingCleared(result.cleared,now);
 if(result.cleared.length)notify(`${result.cleared.map(entry=>entry.name).join(', ')} 완파`);
 if(campus.clearedCount===campus.entries.length){stopDrill();completionTimer=setTimeout(finishRound,1100);}
}
// The selected tool stays mounted. Contact, trigger and visibility are independent.
function updateDrillPreview(time,forceProbe=false){
 if(selected!=='drill'||nuclear||completed||document.hidden||document.querySelector('dialog[open]')){
  combatEffects.stopDrill();return;
 }
 const moved=drillProbe.x!==drillAim.x||drillProbe.y!==drillAim.y||!drillCameraPosition.equals(camera.position)||!drillCameraQuaternion.equals(camera.quaternion);
 if(forceProbe||(time-drillProbe.lastProbe>=40&&(moved||drillSession||!combatEffects.stats.drillActive))){
  drillProbe.hit=pick(drillAim.x,drillAim.y);drillProbe.normal=drillProbe.hit?hitNormal(drillProbe.hit):null;
  drillProbe.lastProbe=time;drillProbe.x=drillAim.x;drillProbe.y=drillAim.y;
  drillCameraPosition.copy(camera.position);drillCameraQuaternion.copy(camera.quaternion);
  if(drillProbe.hit)drillProbe.depth=camera.position.distanceTo(drillProbe.hit.point);
  const depth=drillProbe.depth||camera.position.distanceTo(view.target);
  raycaster.ray.at(Math.max(camera.near*4,depth),drillAirPoint);
  drillAirNormal.copy(raycaster.ray.direction).negate();
 }
 const hit=drillProbe.hit,normal=drillProbe.normal||drillAirNormal;
 const pose={point:hit?.point||drillAirPoint,normal,camera,tool:currentTool(),contact:Boolean(hit),running:Boolean(drillSession)};
 if(!combatEffects.stats.drillActive)combatEffects.startDrill(pose);else combatEffects.updateDrill(pose);
 if(!drillSession)return;
 comicAudio.setDrillContact(Boolean(hit)&&!hit.protectedSite);
 if(hit?.protectedSite){
  // The bit skids on the shield: a held flash that follows the bit, a "팅" now and then, no damage.
  if(!drillShield?.active){drillShield=shieldFx?.flash(hit.point,normal,6,{life:.5})||null;heavyAudio.play('shield');drillPingAt=time;shieldHits++;}
  shieldFx?.holdAt(drillShield,hit.point,normal);
  if(time-drillPingAt>WEAPON_TUNING.shield.pingInterval*1000){drillPingAt=time;heavyAudio.play('ping');}
  return;
 }
 if(drillShield){shieldFx?.release(drillShield);drillShield=null;}
 if(hit&&time-drillSession.lastHit>=100){
  drillSession.lastHit=time;
  resolveAttack({tool:currentTool(),point:hit.point,normal,targetId:hit.object.userData.entry.id});
 }
}
function beginDrill(p,id,time){
 p.drilling=true;breakRhythm();dismissGestureHint();
 drillAim.x=p.x;drillAim.y=p.y;drillSession={pointerId:id,lastHit:-Infinity};
 backgroundMusic.duck(.4);comicAudio.startDrill();updateDrillPreview(time,true);
}
function clearEffects(){
 shotgunView.reset();shotgunCycle=null;shotgunShots=0;lastShot=null;
 stopInput();comicAudio.stopAll();clearTimeout(targetTimer);$('target-card').classList.remove('visible');
 rhythm.reset();screenImpact.reset();impactFeedback.clear();impactSerial=0;lastImpact=null;finisherUntil=0;updateRhythm();
 weaponActions.clear();actionVisuals.clear();combatEffects.clear();feel?.reset();heavy.clear();bowling?.clear();wreck.clear();ruyi.clear();robovac?.clear();robovacSoil=0;laser.clear();blackhole.reset();blast?.clear();dozer?.clear();shieldFx?.clear();drillShield=null;$('impact-text').classList.remove('show');
 nuclear=null;nuclearCamera=null;nuclearShot=null;$('nuclear-countdown').hidden=true;$('nuclear-countdown-value').textContent='';$('nuclear-countdown').dataset.count='';$('nuclear-countdown').style.setProperty('--countdown-progress','0');$('nuclear-countdown').style.setProperty('--countdown-angle','0deg');$('shop-open').disabled=false;$('nuclear-flash').classList.remove('show');$('finale-status').hidden=true;syncMusic();
}
function rebuildCampus(){
 clearTimeout(completionTimer);clearTimeout(impactTimer);clearEffects();campus.reset();completed=false;roundStartedAt=performance.now();cooldownUntil=0;lastUi='';
 $('complete-dialog').close();$('reset-dialog').close();setFocus(startBuilding,true);updateHud();updateWeapon();
}
function pinchState(){const points=[...pointers.values()],dx=points[1].x-points[0].x,dy=points[1].y-points[0].y;return{distance:Math.max(1,Math.hypot(dx,dy)),angle:Math.atan2(dy,dx),x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2};}
canvas.addEventListener('pointerdown',e=>{
 if(nuclear||completed||document.querySelector('dialog[open]')||e.button!==0&&e.button!==2||pointers.size>=2)return;
 activateAudio();shotgunAim.x=e.clientX;shotgunAim.y=e.clientY;shotgunAim.inside=true;
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,orbit:e.button===2||e.shiftKey,started:performance.now(),drilling:false,pan:spaceHeld&&e.button===0});canvas.setPointerCapture(e.pointerId);canvas.classList.add('grabbing');
 if(pointers.size===2){stopDrill();heavy.release();laser.cancel();dozer?.release();pinchRotation=0;pinchRotating=false;pinchMode=null;breakRhythm();for(const p of pointers.values()){p.moved=true;p.aiming=false;p.gx=p.x;p.gy=p.y;}bowling?.hidePreview();pinch=pinchState();}
 else if(selected==='drill'&&!pointers.get(e.pointerId).orbit&&!pointers.get(e.pointerId).pan)beginDrill(pointers.get(e.pointerId),e.pointerId,performance.now());
 else if(HOLD_WEAPON_IDS.includes(selected)&&!pointers.get(e.pointerId).orbit&&!pointers.get(e.pointerId).pan)beginHold(pointers.get(e.pointerId));
 else if(selected===LASER_ID&&!pointers.get(e.pointerId).orbit&&!pointers.get(e.pointerId).pan)beginLaser(pointers.get(e.pointerId));
 else if(selected===DOZER_ID&&dozer&&!pointers.get(e.pointerId).orbit&&!pointers.get(e.pointerId).pan)beginDozer(pointers.get(e.pointerId),e.pointerType!=='mouse');
 // Bowling on touch: a held finger (no drag) shows the aim preview and moves it; letting go throws there. A quick tap throws.
 else if(selected==='bowling'&&bowling&&e.pointerType!=='mouse'&&!pointers.get(e.pointerId).orbit&&!pointers.get(e.pointerId).pan){
  const p=pointers.get(e.pointerId),id=e.pointerId;p.holdTimer=setTimeout(()=>{if(pointers.get(id)===p&&!p.moved&&pointers.size===1){p.aiming=true;aimBowling(p.x,p.y,true);}},220);
 }
});
// Minigun / flamethrower: fire while the pointer (mouse or finger) is down; dragging aims instead of moving the map.
function beginHold(p){
 p.drilling=true;p.holding=true;breakRhythm();dismissGestureHint();
 heavy.setAim(p.x,p.y,innerWidth,innerHeight);syncShotgun();
 if(heavy.press(performance.now()/1000))backgroundMusic.duck(.4);
}
// Laser cutter: the press starts the beam; dragging draws the cut line (not the map); release cuts.
function beginLaser(p){
 p.drilling=true;p.lasering=true;breakRhythm();dismissGestureHint();
 laser.setAim(p.x,p.y,innerWidth,innerHeight);syncShotgun();
 if(laser.press(performance.now()/1000))backgroundMusic.duck(.4);
}
// Bulldozer: the press brings / steers the dozer; dragging steers it (not the map); letting go brakes (a quick tap: a short push).
function beginDozer(p,touch){
 p.drilling=true;p.dozing=true;p.touch=touch;breakRhythm();dismissGestureHint();
 const taken=dozer.press(p.x,p.y,{touch});if(taken==='no-spot')notify('불도저가 들어갈 자리가 없어요');
 if(taken==='spawn'||taken==='drive')backgroundMusic.duck(.4);
}
canvas.addEventListener('pointermove',e=>{
 drillAim.x=e.clientX;drillAim.y=e.clientY;shotgunAim.x=e.clientX;shotgunAim.y=e.clientY;shotgunAim.inside=true;heavy.setAim(e.clientX,e.clientY,innerWidth,innerHeight);laser.setAim(e.clientX,e.clientY,innerWidth,innerHeight);
 if(e.pointerType==='mouse'&&!pointers.size)aimBowling(e.clientX,e.clientY);
 const p=pointers.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
 if(pointers.size===2){const next=pinchState();if(pinch){
  const ratio=next.distance/pinch.distance,angle=Math.atan2(Math.sin(next.angle-pinch.angle),Math.cos(next.angle-pinch.angle));
  if(TOUCH_TILT&&(pinchMode===null||pinchMode==='tilt')){
   // Decide once per two-finger gesture, from how far each finger has travelled since the second one landed (the two fingers report
   // one after the other, so a per-event angle / spacing wobbles): both moving up / down together = tilt; spreading, twisting or
   // sliding sideways = the usual zoom / turn / move ('pinch' = spread / twist: its small midpoint drift is a gentle pan that keeps a
   // look-up; 'free' = moved sideways together: a real pan). Until decided the move is held back (zoom still applies) and handed over whole.
   const [a,b]=[...pointers.values()],mx=(a.x-a.gx+b.x-b.gx)/2,my=(a.y-a.gy+b.y-b.gy)/2,apart=Math.hypot((a.x-a.gx)-(b.x-b.gx),(a.y-a.gy)-(b.y-b.gy));
   if(pinchMode===null){
    if(Math.abs(mx)>18)pinchMode='free';else if(apart>26)pinchMode='pinch';   // sideways together = move; spreading / twisting = zoom / turn
    else if(Math.abs(my)>16&&Math.abs(my)>2.2*Math.abs(mx)&&apart<Math.max(18,.9*Math.abs(my)))pinchMode='tilt';
    if(pinchMode==='tilt')view.orbit(0,my);else if(pinchMode==='free')view.pan(mx,my);else if(pinchMode==='pinch')view.pan(mx,my,true);
    if(pinchMode!=='tilt'&&Math.abs(ratio-1)>.0001)view.zoomBy(ratio,next.x,next.y);
    dismissGestureHint();pinch=next;return;}
   view.orbit(0,next.y-pinch.y);dismissGestureHint();pinch=next;return;
  }
  if(Math.abs(ratio-1)>.0001)view.zoomBy(ratio,next.x,next.y);
  let turn=angle;if(!pinchRotating){pinchRotation+=angle;const threshold=Math.PI/60;pinchRotating=Math.abs(pinchRotation)>threshold;turn=pinchRotating?pinchRotation-Math.sign(pinchRotation)*threshold:0;}
  if(Math.abs(turn)>.0001)view.orbit(-turn/.006);
  if(Math.hypot(next.x-pinch.x,next.y-pinch.y)>.01)view.pan(next.x-pinch.x,next.y-pinch.y,pinchMode==='pinch');   // a pinch's midpoint drift must not level a look-up (pinchMode is only set with TOUCH_TILT)
 }dismissGestureHint();pinch=next;return;}
 if(p.dozing){dozer.setAim(p.x,p.y,{touch:p.touch});return;}
 if(p.aiming){aimBowling(p.x,p.y);return;} // held bowling aim: the finger moves the preview, not the map
 if(p.drilling)return; // Once the motor engages, dragging guides the cutter, not the camera.
 if(!p.moved&&Math.hypot(p.x-p.startX,p.y-p.startY)>7){p.moved=true;breakRhythm();}
 if(p.moved){dismissGestureHint();if(p.orbit)view.orbit(dx,dy);else view.pan(dx,dy);if(bowling?.previewing)bowling.hidePreview();}
});
canvas.addEventListener('pointerup',e=>{
 const p=pointers.get(e.pointerId);if(!p)return;clearTimeout(p.holdTimer);
 const tap=!p.moved&&!p.orbit&&!p.pan&&!p.drilling&&pointers.size===1;
 if(p.drilling){if(p.lasering)laser.release();else if(p.dozing)dozer.release({tap:Math.hypot(e.clientX-p.startX,e.clientY-p.startY)<=7&&performance.now()-p.started<350});else if(p.holding)heavy.release();else stopDrill();}pointers.delete(e.pointerId);pinch=null;
 if(!pointers.size)canvas.classList.remove('grabbing');if(tap)strike(e.clientX,e.clientY);
});
function cancelPointer(e){clearTimeout(pointers.get(e.pointerId)?.holdTimer);if(pointers.get(e.pointerId)?.aiming)bowling?.hidePreview();stopDrill();heavy.release();laser.cancel();dozer?.release();pointers.delete(e.pointerId);pinch=null;for(const p of pointers.values())p.moved=true;if(!pointers.size)canvas.classList.remove('grabbing');}
canvas.addEventListener('pointerleave',()=>{if(!pointers.size)shotgunAim.inside=false;});
canvas.addEventListener('pointercancel',cancelPointer);
canvas.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))cancelPointer(e);});
window.addEventListener('blur',()=>{windowFocused=false;syncMusic();syncShotgun();spaceHeld=false;stopInput();comicAudio.stopAll();breakRhythm();});
window.addEventListener('focus',()=>{windowFocused=true;syncMusic();syncShotgun();});
window.addEventListener('pagehide',()=>{windowFocused=false;backgroundMusic.setPaused(true);syncShotgun();});
window.addEventListener('pageshow',()=>{windowFocused=true;syncMusic();syncShotgun();});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();if(nuclear)return;stopInput();dismissGestureHint();view.zoomBy(Math.exp(-Math.max(-300,Math.min(300,e.deltaY))*.0015),e.clientX,e.clientY);},{passive:false});
// iOS grants audio only at gesture end: canvas taps call activateAudio on pointerdown (too early on phones), so also unlock the
// game audio on the first touchend/click anywhere — otherwise hits stay silent until a button (e.g. the bag) is pressed.
for(const type of ['touchend','pointerup','click'])document.addEventListener(type,()=>{if(soundOn&&bootState.phase==='ready')activateAudio();},{capture:true,passive:true});
$('shop-open').addEventListener('click',openBag);
$('reset').addEventListener('click',()=>openDialog('reset-dialog'));$('reset-confirm').addEventListener('click',rebuildCampus);$('reset-cancel').addEventListener('click',()=>$('reset-dialog').close());
$('play-again').addEventListener('click',rebuildCampus);
// Support card left the completion dialog and credits.html (user 10-25); no KakaoPay link remains.
createShare({meta:campusPackage.meta,campusId:campusPackage.id,track,notify});
function showSoundSetting(){$('sound').setAttribute('aria-pressed',String(soundOn));$('sound').setAttribute('aria-label',soundOn?'소리 끄기':'소리 켜기');$('sound').title=soundOn?'소리 끄기':'소리 켜기';$('sound-state').textContent=soundOn?'켜짐':'꺼짐';}
// The on/off choice is shared with the title screen (also mutes interface ticks).
showSoundSetting();
$('sound').addEventListener('click',()=>{
 soundOn=!soundOn;saveSoundPreference(soundOn);comicAudio.setEnabled(soundOn);showSoundSetting();
 syncMusic();if(soundOn){activateAudio();comicAudio.play('bat');}
});
tickOnPress(document,'.game-dialog button, .game-dialog a, .bag-handle, .settings-open, .share-open');
$('music-toggle').replaceWith(createMusicSetting(document,musicMode,value=>{
 musicMode=value;saveMusicPreference(value);backgroundMusic.setMode(value);activateAudio();
}));
// Settings has its own corner button; closing it returns straight to the campus.
$('settings-open').addEventListener('click',()=>{if(!nuclear)openDialog('settings-dialog');});
$('settings-close').addEventListener('click',()=>$('settings-dialog').close());
window.addEventListener('keydown',e=>{
 if(e.ctrlKey||e.metaKey||e.altKey||e.target.matches('input,select,textarea'))return;
 if(e.key.toLowerCase()==='b'&&$('shop-dialog').open){if(!e.repeat){e.preventDefault();weaponBag.close();}return;}
 if(document.querySelector('dialog[open]'))return;
 if(e.code==='Space'||e.key===' '){if(e.target.matches('button,a,summary'))return;e.preventDefault();spaceHeld=true;if(drillSession)stopInput();return;}
 activateAudio();
 if(e.key.toLowerCase()==='r'){openDialog('reset-dialog');return;}
 if(nuclear)return;
 if(/^[0-9]$/.test(e.key)){const at=e.key==='0'?9:Number(e.key)-1;if(TOOLS[at])chooseTool(TOOLS[at].id);} // 0 = tenth tool (SKKU)
 if(e.key.toLowerCase()==='b'&&!e.repeat){e.preventDefault();openBag();}
 if(e.key.toLowerCase()==='y'&&!e.repeat)chooseTool(RUYI_ID); // 여의봉: the number keys stay on the first ten tools
 if(e.key.toLowerCase()==='v'&&!e.repeat&&robovac)chooseTool(ROBOVAC_ID); // 로봇청소기 (only when it is in the bag)
 if(e.key==='+'||e.key==='='){e.preventDefault();stopInput();dismissGestureHint();view.zoomBy(1.3);}
 if(e.key==='-'){e.preventDefault();stopInput();dismissGestureHint();view.zoomBy(1/1.3);}
 if(e.key.toLowerCase()==='q'){stopInput();view.orbit(60);}if(e.key.toLowerCase()==='e'){stopInput();view.orbit(-60);}
 if(e.key==='ArrowLeft'){e.preventDefault();stopInput();view.pan(50,0);}if(e.key==='ArrowRight'){e.preventDefault();stopInput();view.pan(-50,0);}
 if(e.key==='ArrowUp'){e.preventDefault();stopInput();view.pan(0,50);}if(e.key==='ArrowDown'){e.preventDefault();stopInput();view.pan(0,-50);}
});
window.addEventListener('keyup',e=>{if(e.code==='Space'||e.key===' ')spaceHeld=false;});
window.addEventListener('resize',resize);
// A restored WebGL context (iOS app switch / GPU process restart) comes back with an empty shadow map: redraw it.
canvas.addEventListener('webglcontextrestored',()=>shadowBudget.invalidate());
document.addEventListener('visibilitychange',()=>{spaceHeld=false;if(document.hidden){combatEffects.stopDrill();blast?.clear();blackhole.clear();}renderQuality.pause();shadowBudget.invalidate();breakRhythm();screenImpact.reset();stopInput();comicAudio.stopAll();syncMusic();syncShotgun();});
let previous=performance.now(),lastCameraMatrix=null;
function frame(time){
 requestAnimationFrame(frame);const elapsed=Math.min(Math.max(0,(time-previous)/1000),.1),dt=Math.min(elapsed,.033);previous=time;
 if(document.hidden){renderQuality.pause();return;}
 syncShotgun();
 if(shotgunCycle){
  shotgunCycle.age+=elapsed;
  if(shotgunCycle.age>=.24&&!shotgunCycle.pumped){shotgunCycle.pumped=true;comicAudio.play('shotgun-pump');}
  if(shotgunCycle.age>=.82)shotgunCycle=null;
 }
 let attackElapsed=elapsed;
 if(nuclear){
  const before=nuclear.age;nuclear.age+=elapsed;updateCountdown();
  if(nuclear.phase==='countdown'&&nuclear.age>=NUCLEAR_COUNTDOWN_SECONDS){
   const action=weaponActions.start({point:nuclear.point,tool:nuclear.tool});
   if(action){action.targetId=nuclear.targetId;nuclear.phase='fall';$('finale-status').textContent='낙하 중';attackElapsed=nuclear.age-Math.max(before,NUCLEAR_COUNTDOWN_SECONDS);}
   else {clearEffects();notify('투하를 다시 시도해 주세요.');}
  }
 }
 nukeSiren?.sync(Boolean(nuclear&&soundOn&&windowFocused&&(nuclear.phase==='countdown'||nuclear.phase==='fall')));
 const feelHold=Boolean(feel?.holding(performance.now()/1000,Boolean(nuclear))); // ?feel: big-moment stop also pauses fuses/swings
 if(bowling){if(nuclear&&(bowling.count||bowling.following))bowling.clear();else bowling.steer(elapsed);updateBowlingAim(time);} // bowling follow camera (moves the view itself) + aim preview
 view.update();
 if(nuclearCamera&&nuclear){nuclearShot=nuclearCamera.update(nuclear.age);feelNukeModule?.frameNukeCloud(camera,nuclearShot,nuclear.age-NUCLEAR_IMPACT_AT,reducedMotion,nuclear.framing);}
 updateDrillPreview(time);
 weaponActions.update(feelHold?0:attackElapsed);
 const hitClock=performance.now()/1000,recoil=screenImpact.sample(hitClock),feelFrozen=Boolean(feel?.holding(hitClock,Boolean(nuclear))),frozen=recoil.freeze||feelFrozen;
 // The bowling strike's freeze + slow motion also slows the falling debris (1 everywhere else).
 bowling?.update(frozen?0:elapsed,elapsed,hitClock);if(nuclear&&wreck.phase!=='none'&&wreck.phase!=='gone')wreck.clear();wreck.update(frozen?0:elapsed,elapsed,hitClock);
 laser.update(frozen?0:elapsed,elapsed,hitClock);
 if(nuclear&&ruyi.live)ruyi.clear();ruyi.update(frozen?0:elapsed,elapsed,hitClock);
 if(robovac){if(nuclear&&robovac.live)robovac.clear();robovac.update(frozen?0:elapsed,elapsed,hitClock);if(impactSerial!==robovacSoil){robovacSoil=impactSerial;if(lastImpact&&!nuclear)robovac.soil(lastImpact.point,lastImpact.radius,lastImpact.toolId);}}
 blackhole.update(elapsed);
 if(blast){blast.update(feelHold?0:attackElapsed);syncBlastUi();}
 dozer?.update(frozen?0:elapsed);
 const slow=Math.min(bowling?bowling.timeScale(hitClock):1,wreck.timeScale(hitClock));
 const wave=campus.update(frozen?0:dt*slow,time/1000);
 if(wave?.count)updateHud();
 combatEffects.update(feelHold?0:attackElapsed);impactFeedback.update(frozen?0:elapsed*slow);feel?.update(frozen?0:elapsed*slow,elapsed,hitClock);updateRhythm(hitClock);
 heavy.update(elapsed,hitClock,frozen?0:elapsed);shieldFx?.update(elapsed);
 if(nuclear&&nuclear.age>=NUCLEAR_IMPACT_AT+.3)$('nuclear-flash').classList.remove('show');
 if(nuclear&&campus.finale.finished){
  if(nuclear.phase!=='aftermath'){nuclear.phase='aftermath';$('finale-status').textContent='캠퍼스 완파';}
  if(nuclear.age>=NUCLEAR_COMPLETE_AT){releaseNuclearCamera();nuclear=null;syncMusic();$('shop-open').disabled=false;$('finale-status').hidden=true;finishRound();}
 }
 const unitsPerPixel=view.worldUnitsPerPixelAt(nuclearShot?.target);recoilRight.set(1,0,0).applyQuaternion(camera.quaternion);recoilUp.set(0,1,0).applyQuaternion(camera.quaternion);
 camera.position.addScaledVector(recoilRight,recoil.x*unitsPerPixel).addScaledVector(recoilUp,recoil.y*unitsPerPixel);
 shotgunView.update(elapsed);heavy.pose(elapsed);laser.pose();
 const cameraMoved=!lastCameraMatrix||camera.matrixWorld.elements.some((n,i)=>Math.abs(n-lastCameraMatrix[i])>1e-6);lastCameraMatrix=[...camera.matrixWorld.elements];
 sceneActive=cameraMoved||campus.movingDebris||weaponActions.count>0||combatEffects.animating||Boolean(drillSession)||shotgunView.animating||Boolean(feel?.animating)||heavy.animating||Boolean(shieldFx?.animating)||Boolean(bowling?.animating)||wreck.animating||ruyi.animating||Boolean(robovac?.animating)||laser.animating||blackhole.animating||Boolean(blast?.animating)||Boolean(dozer?.animating);if(renderQuality.sample(time,sceneActive))applyQuality();
 renderer.shadowMap.needsUpdate=shadowBudget.update(time,{lightChanged:updateLighting(),dynamic:campus.movingDebris,revision:campus.visualRevision});renderGame();
}
// Locked ad-reward cards open the unlock dialog (src/unlock-dialog.js); "바로 쓰기" equips at once.
const unlockDialog=TOOLS.some(tool=>tool.ad)?createUnlockDialog({document,track,onUnlocked:()=>weaponBag?.render(),onUse:id=>{if(chooseTool(id))weaponBag.close();}}):null;
weaponBag=createDemoWeaponBag({document,tools:TOOLS,getSelected:()=>selected,onEquip:chooseTool,isLocked:toolLocked,onLocked:id=>unlockDialog?.open(toolById(id))});
resize();setFocus(startBuilding,true);updateWeapon();updateHud();view.update();
renderer.shadowMap.needsUpdate=shadowBudget.update(performance.now(),{lightChanged:updateLighting(),revision:campus.visualRevision});renderGame();
bootState={phase:'ready',loaded:campus.entries.length,total:CAMPUS_BUILDING_COUNT,error:null};try{localStorage.setItem(LAST_CAMPUS_KEY,campusPackage.id);}catch{}$('loading').hidden=true;requestAnimationFrame(frame);
// Ready never waits for audio: the title song crosses into the game playlist in
// the next task. Direct visits without a handoff retain the original ready gate.
document.removeEventListener('pointerdown',resumeLoadingMusic);
document.removeEventListener('keydown',resumeLoadingMusic);
document.removeEventListener('visibilitychange',resumeLoadingMusic);
window.removeEventListener('blur',pauseLoadingMusic);
window.removeEventListener('focus',focusLoadingMusic);
window.removeEventListener('pagehide',pauseLoadingMusic);
setTimeout(()=>backgroundMusic.setReady(),0);
roundStartedAt=performance.now();track('game_start',{campus:campusPackage.id});
// Read-only diagnostics; demo never reads or writes earned economy saves.
window.gameDiagnostics=()=>({demo:true,availableWeapons:TOOLS.map(tool=>tool.id),tool:selected,completed,drilling:Boolean(drillSession),nuclear:nuclear?{...nuclear}:null,finale:campus.finale,
 performance:{...renderQuality.stats,shadowUpdates:shadowBudget.updates,triangles:renderer.info.render.triangles??null},effects:combatEffects.stats,audio:comicAudio.stats,music:{...backgroundMusic.stats,selected:musicMode},
 feel:{...rhythm.state(performance.now()/1000),impactSerial,lastImpact:lastImpact?{...lastImpact,point:{...lastImpact.point}}:null},impactFeedback:impactFeedback.stats,
 shotgun:{...shotgunView.stats,shots:shotgunShots,lastShot:lastShot?{...lastShot}:null,cycle:shotgunCycle?{...shotgunCycle}:null},
 heavy:heavy.stats,...(bowling?{bowling:bowling.stats}:{}),...(blast?{blast:blast.stats,adWeapons:{locked:TOOLS.filter(tool=>toolLocked(tool.id)).map(tool=>tool.id),unlock:unlockDialog?{open:unlockDialog.isOpen,state:unlockDialog.state,tool:unlockDialog.tool}:null}}:{}),...(dozer?{bulldozer:dozer.stats}:{}),wreck:wreck.stats,ruyi:ruyi.stats,...(robovac?{robovac:robovac.stats}:{}),laser:laser.stats,blackhole:blackhole.stats,protected:protectedSet?{...protectedSet.stats,hiddenInstances:protectedSet.hiddenInstances,shield:shieldFx?.stats??null,shieldHits,
  screen:protectedSet.sites.map(s=>{const v=new THREE.Vector3(s.centerX,(s.baseY+s.topY)/2,s.centerZ).project(camera);return{id:s.id,x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight,front:v.z<1};})}:null,
 pendingAttacks:weaponActions.count,miniBombs:weaponActions.countFor('mini-bomb'),cleared:campus.clearedCount,destruction:campus.destroyedWeight/campus.totalWeight,focus:focused?.id||null,
 mapSource:campus.layoutSource,worldUnitsPerMeter:campus.worldUnitsPerMeter,projection:'perspective',modelSource:campus.source,loadedModels:modelAssets.size,
 camera:nuclearShot?{...view.state,framing:'cinematic',phase:nuclearShot.phase,distance:nuclearShot.distance,zoom:view.state.baseDistance/nuclearShot.distance,target:nuclearShot.target.toArray(),position:camera.position.toArray()}:view.state,buildings:campus.entries.length,remaining:campus.remaining,drawCalls:renderer.info.render.calls,hazardTape:campus.hazardTape,
 targets:campus.entries.filter(e=>!e.cleared).flatMap(e=>e.model.pieces.filter(p=>p.active).filter((_,i)=>i%61===0).map(p=>{const v=e.model.localToWorld((p.surfacePoint||p.position).clone()).project(camera);return{id:e.id,x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight};}))});
