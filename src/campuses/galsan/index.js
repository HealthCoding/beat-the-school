import { WORLD_UNITS_PER_METER, GEO_ORIGIN, GALSAN_PLACEMENTS, GALSAN_BUILDING_BASE, GALSAN_HEIGHT_GRIDS, GALSAN_HEIGHT_RANGE_M, GALSAN_ENV_IDS, GALSAN_PROVENANCE } from './data.js';
import { GALSAN_FOOTPRINTS } from './footprints.js';
import { GALSAN_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(GALSAN_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/galsan/${f}`,import.meta.url).href;
export const GALSAN=Object.freeze({
 id:'galsan',meta:Object.freeze({school:'아산갈산중학교',campus:'아산',short:'갈산중',modelNoun:'갈산중'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:GALSAN_PLACEMENTS,approvedCount:GALSAN_PLACEMENTS.length,additionalCount:0,
 coreIds:Object.freeze(['south','gym','southwest']),startBuildingId:'south',
 // Southeast gate approach toward the south classrooms and gym. Parent validates desktop/mobile HUD framing.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[5,-2,-8],max:[24,7,11],azimuth:.78}:{min:[-9,-2,-5],max:[27,7,9],azimuth:.78};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:GALSAN_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:GALSAN_HEIGHT_GRIDS,buildingBase:GALSAN_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:GALSAN_PROVENANCE,sourceNote:'Official overhead traced estimated footprints and photo-based facades; OSM site-boundary proxy © OpenStreetMap contributors; heights and planting estimated'}),
 ground:Object.freeze({baked:Object.freeze({envIds:GALSAN_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact Galsan school ground, site, planting and surrounding buildings'})}),
 protected:Object.freeze({models:GALSAN_PROTECTED}),hazardTape:Object.freeze({footprints:GALSAN_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5ea',fog:Object.freeze({color:'#dce5ea',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:GALSAN_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default GALSAN;
