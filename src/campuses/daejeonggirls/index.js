import { WORLD_UNITS_PER_METER, GEO_ORIGIN, DAEJEONGGIRLS_PLACEMENTS, DAEJEONGGIRLS_BUILDING_BASE, DAEJEONGGIRLS_HEIGHT_GRIDS, DAEJEONGGIRLS_HEIGHT_RANGE_M, DAEJEONGGIRLS_ENV_IDS, DAEJEONGGIRLS_PROVENANCE } from './data.js';
import { DAEJEONGGIRLS_FOOTPRINTS } from './footprints.js';
import { DAEJEONGGIRLS_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(DAEJEONGGIRLS_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/daejeonggirls/${f}`,import.meta.url).href;
export const DAEJEONGGIRLS=Object.freeze({
 id:'daejeonggirls',meta:Object.freeze({school:'대정여자고등학교',campus:'서귀포',short:'대정여고',modelNoun:'대정여고'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:DAEJEONGGIRLS_PLACEMENTS,approvedCount:DAEJEONGGIRLS_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:22,tiltNear:14}),
 coreIds:Object.freeze(['main','heritage','annex']),startBuildingId:'main',
 // Initial main-building frame; parent supplies and validates desktop and phone framing.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[-40,2,-26],max:[2,18,6],azimuth:.9}:{min:[-43,-4,-29],max:[5,7,8],azimuth:.55};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:DAEJEONGGIRLS_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:DAEJEONGGIRLS_HEIGHT_GRIDS,buildingBase:DAEJEONGGIRLS_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:DAEJEONGGIRLS_PROVENANCE,sourceNote:'OSM building outlines and authored aerial proxies, official school layout and photographed facade; estimated heights and planting. Surroundings: OSM © OpenStreetMap contributors'}),
 ground:Object.freeze({baked:Object.freeze({envIds:DAEJEONGGIRLS_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact Daejeong Girls school ground, site, planting and surrounding buildings'})}),
 protected:Object.freeze({models:DAEJEONGGIRLS_PROTECTED}),hazardTape:Object.freeze({footprints:DAEJEONGGIRLS_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5ea',fog:Object.freeze({color:'#dce5ea',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:DAEJEONGGIRLS_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default DAEJEONGGIRLS;
