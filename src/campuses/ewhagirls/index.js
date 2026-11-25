import { WORLD_UNITS_PER_METER, GEO_ORIGIN, EWHAGIRLS_PLACEMENTS, EWHAGIRLS_BUILDING_BASE, EWHAGIRLS_HEIGHT_GRIDS, EWHAGIRLS_HEIGHT_RANGE_M, EWHAGIRLS_ENV_IDS, EWHAGIRLS_PROVENANCE } from './data.js';
import { EWHAGIRLS_FOOTPRINTS } from './footprints.js';
import { EWHAGIRLS_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(EWHAGIRLS_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/ewhagirls/${f}`,import.meta.url).href;
export const EWHAGIRLS=Object.freeze({
 id:'ewhagirls',meta:Object.freeze({school:'이화여자고등학교',campus:'서울',short:'이화여고',modelNoun:'이화여고'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:EWHAGIRLS_PLACEMENTS,approvedCount:EWHAGIRLS_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:22,tiltNear:14}),
 coreIds:Object.freeze(['main','centennial','simpson']),startBuildingId:'main',
 // Main facade and courtyard framing; desktop and phone validated separately.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[-10,-9,-1],max:[19,4,23],azimuth:.8}:{min:[-16,-2,-8],max:[23,15,31],azimuth:.8};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:EWHAGIRLS_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:EWHAGIRLS_HEIGHT_GRIDS,buildingBase:EWHAGIRLS_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:EWHAGIRLS_PROVENANCE,sourceNote:'OSM building outlines and authored aerial proxies, official school layout and photographed facade; estimated heights and planting. Surroundings: OSM © OpenStreetMap contributors'}),
 ground:Object.freeze({baked:Object.freeze({envIds:EWHAGIRLS_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact Ewha Girls school ground, site, planting and surrounding buildings'})}),
 protected:Object.freeze({models:EWHAGIRLS_PROTECTED}),hazardTape:Object.freeze({footprints:EWHAGIRLS_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5ea',fog:Object.freeze({color:'#dce5ea',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:EWHAGIRLS_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default EWHAGIRLS;
