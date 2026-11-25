import { createGyeonginGroundLook } from './ground-look.js';
import { WORLD_UNITS_PER_METER, GEO_ORIGIN, GYEONGIN_PLACEMENTS, GYEONGIN_BUILDING_BASE, GYEONGIN_HEIGHT_GRIDS, GYEONGIN_HEIGHT_RANGE_M, GYEONGIN_ENV_IDS, GYEONGIN_PROVENANCE } from './data.js';
import { GYEONGIN_FOOTPRINTS } from './footprints.js';
import { GYEONGIN_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(GYEONGIN_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/gyeongin/${f}`,import.meta.url).href;
export const GYEONGIN=Object.freeze({
 id:'gyeongin',meta:Object.freeze({school:'경인고등학교',campus:'서울',short:'경인고',modelNoun:'경인고'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:GYEONGIN_PLACEMENTS,approvedCount:GYEONGIN_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:20,tiltNear:14,overviewElevation:52}),
 coreIds:Object.freeze(['main','west','gyeonginHall','bridge']),startBuildingId:'main',
 // Frame the foreground at ground Y=0 on phones, never below ground to lift the school above the HUD.
 // Pointer zoom preserves target Y; the positive 14-degree tilt therefore stays above this flat site.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[16,0,-14],max:[36,0,0],azimuth:1.15}:{min:[-25,0,-31],max:[23,10,-2],azimuth:.50};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:GYEONGIN_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:GYEONGIN_HEIGHT_GRIDS,buildingBase:GYEONGIN_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:GYEONGIN_PROVENANCE,sourceNote:'OSM footprints, requester floor plan and photo-based school facades; © OpenStreetMap contributors; heights and planting estimated'}),
 ground:Object.freeze({baked:Object.freeze({envIds:GYEONGIN_ENV_IDS,castShadow:Object.freeze([]),materialHook:createGyeonginGroundLook,playMargin_m:24,source:'Exact Gyeongin school ground, site, planting and surrounding buildings'})}),
 protected:Object.freeze({models:GYEONGIN_PROTECTED}),hazardTape:Object.freeze({footprints:GYEONGIN_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5ea',fog:Object.freeze({color:'#dce5ea',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:GYEONGIN_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default GYEONGIN;
