import {createBundangjungangGroundLook} from './ground-look.js';
import { WORLD_UNITS_PER_METER, GEO_ORIGIN, BUNDANGJUNGANG_PLACEMENTS, BUNDANGJUNGANG_BUILDING_BASE, BUNDANGJUNGANG_HEIGHT_GRIDS, BUNDANGJUNGANG_HEIGHT_RANGE_M, BUNDANGJUNGANG_ENV_IDS, BUNDANGJUNGANG_PROVENANCE } from './data.js';
import { BUNDANGJUNGANG_FOOTPRINTS } from './footprints.js';
import { BUNDANGJUNGANG_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(BUNDANGJUNGANG_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/bundangjungang-hq/${f}`,import.meta.url).href;
export const BUNDANGJUNGANG=Object.freeze({
 id:'bundangjungang-hq',meta:Object.freeze({school:'분당중앙고등학교',campus:'경기 성남시 분당구',short:'분당중앙고등학교',modelNoun:'분당중앙고등학교'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:BUNDANGJUNGANG_PLACEMENTS,approvedCount:BUNDANGJUNGANG_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:35,tiltNear:22,overviewElevation:55}),coreIds:MODEL_IDS,startBuildingId:'main',
 // Main school facade and eastern annex/bridge, from the southwest field.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[-8,8,-22],max:[28,30,26],azimuth:-1.55}:{min:[-24,0,-26],max:[31,11,26],azimuth:-.65};},overviewAzimuth:-.65}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:BUNDANGJUNGANG_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:BUNDANGJUNGANG_HEIGHT_GRIDS,buildingBase:BUNDANGJUNGANG_BUILDING_BASE,source:BUNDANGJUNGANG_PROVENANCE.terrain}),
 environment:Object.freeze({provenance:BUNDANGJUNGANG_PROVENANCE,sourceNote:'사진에 따른 학교 외벽과 OSM 윤곽·주변. © OpenStreetMap contributors. 높이·후면·일부 시설은 추정.'}),
 ground:Object.freeze({baked:Object.freeze({materialHook:createBundangjungangGroundLook,envIds:BUNDANGJUNGANG_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact HQ preview terrain, site, planting and context; no added floor cap'})}),
 protected:Object.freeze({models:BUNDANGJUNGANG_PROTECTED}),hazardTape:Object.freeze({footprints:BUNDANGJUNGANG_FOOTPRINTS}),
 scene:Object.freeze({background:'#dde5e8',fog:Object.freeze({color:'#dde5e8',near:500,far:1400}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-150,260,110]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:BUNDANGJUNGANG_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default BUNDANGJUNGANG;
