import { WORLD_UNITS_PER_METER, GEO_ORIGIN, YONGWON_PLACEMENTS, YONGWON_BUILDING_BASE, YONGWON_HEIGHT_GRIDS, YONGWON_HEIGHT_RANGE_M, YONGWON_ENV_IDS, YONGWON_PROVENANCE } from './data.js';
import { YONGWON_FOOTPRINTS } from './footprints.js';
import { YONGWON_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(YONGWON_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/yongwon/${f}`,import.meta.url).href;
export const YONGWON=Object.freeze({
 id:'yongwon',meta:Object.freeze({school:'진해용원고등학교',campus:'창원',short:'용원고',modelNoun:'용원고'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:YONGWON_PLACEMENTS,approvedCount:YONGWON_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:26,tiltNear:14}),
 coreIds:Object.freeze(['main','hall']),startBuildingId:'main',
 // Main teaching facade is the start subject; desktop and phone framing are independent.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[-13,-18,-8],max:[33,-8,8],azimuth:.7}:{min:[-22,-11,-28],max:[37,-1,4],azimuth:-.45};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:YONGWON_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:YONGWON_HEIGHT_GRIDS,buildingBase:YONGWON_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:YONGWON_PROVENANCE,sourceNote:'OSM building outlines and authored aerial proxies, official school layout and photographed facade; estimated heights and planting. Surroundings: OSM © OpenStreetMap contributors'}),
 ground:Object.freeze({baked:Object.freeze({envIds:YONGWON_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact Yongwon school ground, site, planting and surrounding buildings'})}),
 protected:Object.freeze({models:YONGWON_PROTECTED}),hazardTape:Object.freeze({footprints:YONGWON_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5ea',fog:Object.freeze({color:'#dce5ea',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:YONGWON_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default YONGWON;
