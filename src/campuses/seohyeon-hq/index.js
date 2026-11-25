import {createSeohyeonGroundLook} from './ground-look.js';
import { WORLD_UNITS_PER_METER, GEO_ORIGIN, SEOHYEON_PLACEMENTS, SEOHYEON_BUILDING_BASE, SEOHYEON_HEIGHT_GRIDS, SEOHYEON_HEIGHT_RANGE_M, SEOHYEON_ENV_IDS, SEOHYEON_PROVENANCE } from './data.js';
import { SEOHYEON_FOOTPRINTS } from './footprints.js';
import { SEOHYEON_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(SEOHYEON_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/seohyeon-hq/${f}`,import.meta.url).href;
export const SEOHYEON=Object.freeze({
 id:'seohyeon-hq',meta:Object.freeze({school:'서현고등학교',campus:'경기 성남시 분당구',short:'서현고등학교',modelNoun:'서현고등학교'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:SEOHYEON_PLACEMENTS,approvedCount:SEOHYEON_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:34,tiltNear:28,overviewElevation:55}),coreIds:MODEL_IDS,startBuildingId:'wing1',
 // Southeast field view matches the authored main facade normal and HQ preview start.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[-32,0,-30],max:[2,9,22],azimuth:.05}:{min:[-36,0,-36],max:[8,10,24],azimuth:.05};},overviewAzimuth:1.5708}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:SEOHYEON_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:SEOHYEON_HEIGHT_GRIDS,buildingBase:SEOHYEON_BUILDING_BASE,source:SEOHYEON_PROVENANCE.terrain}),
 environment:Object.freeze({provenance:SEOHYEON_PROVENANCE,sourceNote:'사진에 따른 학교 외벽과 OSM 윤곽·주변. © OpenStreetMap contributors. 높이·후면·일부 시설은 추정.'}),
 ground:Object.freeze({baked:Object.freeze({materialHook:createSeohyeonGroundLook,envIds:SEOHYEON_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact HQ preview terrain, site, planting and context; no added floor cap'})}),
 protected:Object.freeze({models:SEOHYEON_PROTECTED}),hazardTape:Object.freeze({footprints:SEOHYEON_FOOTPRINTS}),
 scene:Object.freeze({background:'#dde5e8',fog:Object.freeze({color:'#dde5e8',near:500,far:1400}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-150,260,110]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:SEOHYEON_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default SEOHYEON;
