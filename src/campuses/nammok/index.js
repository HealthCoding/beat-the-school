import { WORLD_UNITS_PER_METER, GEO_ORIGIN, NAMMOK_PLACEMENTS, NAMMOK_BUILDING_BASE, NAMMOK_HEIGHT_GRIDS, NAMMOK_HEIGHT_RANGE_M, NAMMOK_ENV_IDS, NAMMOK_PROVENANCE } from './data.js';
import { NAMMOK_FOOTPRINTS } from './footprints.js';
import { NAMMOK_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(NAMMOK_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/nammok/${f}`,import.meta.url).href;
export const NAMMOK=Object.freeze({
 id:'nammok',meta:Object.freeze({school:'남목고등학교',campus:'울산',short:'남목고',modelNoun:'남목고'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:NAMMOK_PLACEMENTS,approvedCount:NAMMOK_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:16,tiltNear:14}),
 coreIds:Object.freeze(['main','gym','bridge']),startBuildingId:'main',
 // Southeast courtyard approach shows the glazed stair core and teaching wings; independent mobile framing.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[10,-4,-7],max:[21,6,4],azimuth:.65}:{min:[0,.1,-24],max:[35,11,11],azimuth:.55};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:NAMMOK_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:NAMMOK_HEIGHT_GRIDS,buildingBase:NAMMOK_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:NAMMOK_PROVENANCE,sourceNote:'Authored aerial roof proxy, official school layout and photographed facade; estimated heights and planting. Surroundings: OSM © OpenStreetMap contributors'}),
 ground:Object.freeze({baked:Object.freeze({envIds:NAMMOK_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact Nammok school ground, site, planting and surrounding buildings'})}),
 protected:Object.freeze({models:NAMMOK_PROTECTED}),hazardTape:Object.freeze({footprints:NAMMOK_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5ea',fog:Object.freeze({color:'#dce5ea',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:NAMMOK_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default NAMMOK;
