import { WORLD_UNITS_PER_METER, GEO_ORIGIN, GYEONGILGIRLS_PLACEMENTS, GYEONGILGIRLS_BUILDING_BASE, GYEONGILGIRLS_HEIGHT_GRIDS, GYEONGILGIRLS_HEIGHT_RANGE_M, GYEONGILGIRLS_ENV_IDS, GYEONGILGIRLS_PROVENANCE } from './data.js';
import { GYEONGILGIRLS_FOOTPRINTS } from './footprints.js';
import { GYEONGILGIRLS_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(GYEONGILGIRLS_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/gyeongilgirls/${f}`,import.meta.url).href;
export const GYEONGILGIRLS=Object.freeze({
 id:'gyeongilgirls',meta:Object.freeze({school:'창원경일여자고등학교',campus:'창원',short:'창원경일여고',modelNoun:'창원경일여고'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:GYEONGILGIRLS_PLACEMENTS,approvedCount:GYEONGILGIRLS_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:22,tiltNear:14}),
 coreIds:Object.freeze(['main','gym']),startBuildingId:'main',
 // School field approach frames the long teaching wing and southwest hall; parent validates desktop and phone framing.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[-43,-20,-12],max:[12,2,19],azimuth:-.7}:{min:[-43,0,-12],max:[12,12,19],azimuth:-.7};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:GYEONGILGIRLS_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:GYEONGILGIRLS_HEIGHT_GRIDS,buildingBase:GYEONGILGIRLS_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:GYEONGILGIRLS_PROVENANCE,sourceNote:'OSM building outlines and authored aerial proxies, official school layout and photographed facade; estimated heights and planting. Surroundings: OSM © OpenStreetMap contributors'}),
 ground:Object.freeze({baked:Object.freeze({envIds:GYEONGILGIRLS_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact Gyeongil Girls school ground, site, planting and surrounding buildings'})}),
 protected:Object.freeze({models:GYEONGILGIRLS_PROTECTED}),hazardTape:Object.freeze({footprints:GYEONGILGIRLS_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5ea',fog:Object.freeze({color:'#dce5ea',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:GYEONGILGIRLS_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default GYEONGILGIRLS;
