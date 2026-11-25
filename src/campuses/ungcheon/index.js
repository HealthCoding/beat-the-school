import { WORLD_UNITS_PER_METER, GEO_ORIGIN, UNGCHEON_PLACEMENTS, UNGCHEON_BUILDING_BASE, UNGCHEON_HEIGHT_GRIDS, UNGCHEON_HEIGHT_RANGE_M, UNGCHEON_ENV_IDS, UNGCHEON_PROVENANCE } from './data.js';
import { UNGCHEON_FOOTPRINTS } from './footprints.js';
import { UNGCHEON_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(UNGCHEON_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/ungcheon/${f}`,import.meta.url).href;
export const UNGCHEON=Object.freeze({
 id:'ungcheon',meta:Object.freeze({school:'웅천고등학교',campus:'창원',short:'웅천고',modelNoun:'웅천고'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:UNGCHEON_PLACEMENTS,approvedCount:UNGCHEON_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:26,tiltNear:14}),
 coreIds:Object.freeze(['main','rear','gym']),startBuildingId:'main',
 // Main teaching facade is the start subject; desktop and phone framing are independent.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[-25,-15,5],max:[16,-5,19],azimuth:-.9}:{min:[-28,-6,3],max:[22,4,21],azimuth:-.45};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:UNGCHEON_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:UNGCHEON_HEIGHT_GRIDS,buildingBase:UNGCHEON_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:UNGCHEON_PROVENANCE,sourceNote:'OSM building outlines and authored aerial proxies, official school layout and photographed facade; estimated heights and planting. Surroundings: OSM © OpenStreetMap contributors'}),
 ground:Object.freeze({baked:Object.freeze({envIds:UNGCHEON_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact Ungcheon school ground, site, planting and surrounding buildings'})}),
 protected:Object.freeze({models:UNGCHEON_PROTECTED}),hazardTape:Object.freeze({footprints:UNGCHEON_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5ea',fog:Object.freeze({color:'#dce5ea',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:UNGCHEON_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default UNGCHEON;
