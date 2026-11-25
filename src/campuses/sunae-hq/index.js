import {createSunaeGroundLook} from './ground-look.js';
import { WORLD_UNITS_PER_METER, GEO_ORIGIN, SUNAE_PLACEMENTS, SUNAE_BUILDING_BASE, SUNAE_HEIGHT_GRIDS, SUNAE_HEIGHT_RANGE_M, SUNAE_ENV_IDS, SUNAE_PROVENANCE } from './data.js';
import { SUNAE_FOOTPRINTS } from './footprints.js';
import { SUNAE_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(SUNAE_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/sunae-hq/${f}`,import.meta.url).href;
export const SUNAE=Object.freeze({
 id:'sunae-hq',meta:Object.freeze({school:'수내고등학교',campus:'경기 성남시 분당구',short:'수내고등학교',modelNoun:'수내고등학교'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:SUNAE_PLACEMENTS,approvedCount:SUNAE_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:28,tiltNear:22,overviewElevation:55}),coreIds:MODEL_IDS,startBuildingId:'main',
 // Southwest courtyard view: main school and western annex; follows the published campus orientation.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[-30,4,-34],max:[46,24,6],azimuth:-1.7}:{min:[-21,0,-25],max:[29,10,9],azimuth:-.7854};},overviewAzimuth:-.7854}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:SUNAE_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:SUNAE_HEIGHT_GRIDS,buildingBase:SUNAE_BUILDING_BASE,source:SUNAE_PROVENANCE.terrain}),
 environment:Object.freeze({provenance:SUNAE_PROVENANCE,sourceNote:'사진에 따른 학교 외벽과 OSM 윤곽·주변. © OpenStreetMap contributors. 높이·후면·일부 시설은 추정.'}),
 ground:Object.freeze({baked:Object.freeze({materialHook:createSunaeGroundLook,envIds:SUNAE_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact HQ preview terrain, site, planting and context; no added floor cap'})}),
 protected:Object.freeze({models:SUNAE_PROTECTED}),hazardTape:Object.freeze({footprints:SUNAE_FOOTPRINTS}),
 scene:Object.freeze({background:'#dde5e8',fog:Object.freeze({color:'#dde5e8',near:500,far:1400}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-150,260,110]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:SUNAE_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default SUNAE;
