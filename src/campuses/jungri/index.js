import { WORLD_UNITS_PER_METER, GEO_ORIGIN, JUNGRI_PLACEMENTS, JUNGRI_BUILDING_BASE, JUNGRI_HEIGHT_GRIDS, JUNGRI_HEIGHT_RANGE_M, JUNGRI_ENV_IDS, JUNGRI_PROVENANCE } from './data.js';
import { JUNGRI_FOOTPRINTS } from './footprints.js';
import { JUNGRI_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(JUNGRI_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/jungri/${f}`,import.meta.url).href;
export const JUNGRI=Object.freeze({
 id:'jungri',meta:Object.freeze({school:'중리중학교',campus:'대구',short:'중리중',modelNoun:'중리중'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:JUNGRI_PLACEMENTS,approvedCount:JUNGRI_PLACEMENTS.length,additionalCount:0,
 coreIds:Object.freeze(['main','rear','hall']),startBuildingId:'main',
 // West gate approach toward the main facade. Parent validates desktop/mobile HUD framing.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[-16,-2,-11],max:[5,6,1],azimuth:-.88}:{min:[-25,-2,-12],max:[21,6,2],azimuth:-.88};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:JUNGRI_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:JUNGRI_HEIGHT_GRIDS,buildingBase:JUNGRI_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:JUNGRI_PROVENANCE,sourceNote:'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'}),
 ground:Object.freeze({baked:Object.freeze({envIds:JUNGRI_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact Jungri school ground, site, planting and surrounding buildings'})}),
 protected:Object.freeze({models:JUNGRI_PROTECTED}),hazardTape:Object.freeze({footprints:JUNGRI_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5ea',fog:Object.freeze({color:'#dce5ea',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:JUNGRI_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default JUNGRI;
