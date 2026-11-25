import { WORLD_UNITS_PER_METER, GEO_ORIGIN, SUNGDEOK_PLACEMENTS, SUNGDEOK_BUILDING_BASE, SUNGDEOK_HEIGHT_GRIDS, SUNGDEOK_HEIGHT_RANGE_M, SUNGDEOK_ENV_IDS, SUNGDEOK_PROVENANCE } from './data.js';
import { SUNGDEOK_FOOTPRINTS } from './footprints.js';
import { SUNGDEOK_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(SUNGDEOK_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/sungdeok/${f}`,import.meta.url).href;
export const SUNGDEOK=Object.freeze({
 id:'sungdeok',meta:Object.freeze({school:'숭덕고등학교',campus:'광주',short:'숭덕고',modelNoun:'숭덕고'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:SUNGDEOK_PLACEMENTS,approvedCount:SUNGDEOK_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:24,tiltNear:14}),
 coreIds:Object.freeze(['main','hall','dorm']),startBuildingId:'main',
 // Southwest approach frames the main arch and Cheongsong hall; parent validates desktop and phone framing.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[-28,-24,-12],max:[30,-6,23],azimuth:-1.1}:{min:[-25,0,-13],max:[28,10,20],azimuth:-.8};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:SUNGDEOK_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:SUNGDEOK_HEIGHT_GRIDS,buildingBase:SUNGDEOK_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:SUNGDEOK_PROVENANCE,sourceNote:'OSM building outlines and authored aerial proxies, official school layout and photographed facade; estimated heights and planting. Surroundings: OSM © OpenStreetMap contributors'}),
 ground:Object.freeze({baked:Object.freeze({envIds:SUNGDEOK_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact Sungdeok school ground, site, planting and surrounding buildings'})}),
 protected:Object.freeze({models:SUNGDEOK_PROTECTED}),hazardTape:Object.freeze({footprints:SUNGDEOK_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5ea',fog:Object.freeze({color:'#dce5ea',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:SUNGDEOK_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default SUNGDEOK;
