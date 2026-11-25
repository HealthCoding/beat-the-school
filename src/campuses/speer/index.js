import { WORLD_UNITS_PER_METER, GEO_ORIGIN, SPEER_PLACEMENTS, SPEER_BUILDING_BASE, SPEER_HEIGHT_GRIDS, SPEER_HEIGHT_RANGE_M, SPEER_ENV_IDS, SPEER_PROVENANCE } from './data.js';
import { SPEER_FOOTPRINTS } from './footprints.js';
import { SPEER_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(SPEER_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/speer/${f}`,import.meta.url).href;
export const SPEER=Object.freeze({
 id:'speer',meta:Object.freeze({school:'수피아여자고등학교',campus:'광주',short:'수피아여고',modelNoun:'수피아여고'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:SPEER_PLACEMENTS,approvedCount:SPEER_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:26,tiltNear:14}),
 coreIds:Object.freeze(['speerhall','gym','main','winsborough']),startBuildingId:'speerhall',
 // Separate phone and desktop framing for the historic hall, gymnasium and chapel precinct.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[6,-6,-44],max:[32,6,-24],azimuth:4}:{min:[-2,-17,-48],max:[40,-5,-18],azimuth:.9};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:SPEER_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:SPEER_HEIGHT_GRIDS,buildingBase:SPEER_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:SPEER_PROVENANCE,sourceNote:'OSM building outlines and authored aerial proxies, official school layout and photographed facade; estimated heights and planting. Surroundings: OSM © OpenStreetMap contributors'}),
 ground:Object.freeze({baked:Object.freeze({envIds:SPEER_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact Speer school ground, site, planting and surrounding buildings',fade:Object.freeze({centre_m:[0,0],near_m:240,far_m:500,colour:'#dce5e1'})})}),
 protected:Object.freeze({manifestURL:asset('protected/manifest.json'),models:SPEER_PROTECTED}),hazardTape:Object.freeze({footprints:SPEER_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5e1',fog:Object.freeze({color:'#dce5e1',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:SPEER_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default SPEER;
