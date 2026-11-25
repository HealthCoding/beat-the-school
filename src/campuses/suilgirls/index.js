import { WORLD_UNITS_PER_METER, GEO_ORIGIN, SUILGIRLS_PLACEMENTS, SUILGIRLS_BUILDING_BASE, SUILGIRLS_HEIGHT_GRIDS, SUILGIRLS_HEIGHT_RANGE_M, SUILGIRLS_ENV_IDS, SUILGIRLS_PROVENANCE } from './data.js';
import { SUILGIRLS_FOOTPRINTS } from './footprints.js';
import { SUILGIRLS_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(SUILGIRLS_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/suilgirls/${f}`,import.meta.url).href;
export const SUILGIRLS=Object.freeze({
 id:'suilgirls',meta:Object.freeze({school:'수일여자중학교',campus:'수원',short:'수일여중',modelNoun:'수일여중'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:SUILGIRLS_PLACEMENTS,approvedCount:SUILGIRLS_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:18,tiltNear:14}),
 coreIds:Object.freeze(['main','annex','gym','bridge']),startBuildingId:'main',
 // Southwest field approach keeps the main facade, long stairs and lower stage together; wider portrait framing.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[-28,8,-28],max:[30,30,10],azimuth:-1.5}:{min:[-17,0,-15],max:[20,11,12],azimuth:-.65};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:SUILGIRLS_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:SUILGIRLS_HEIGHT_GRIDS,buildingBase:SUILGIRLS_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:SUILGIRLS_PROVENANCE,sourceNote:'OSM building outlines and authored aerial proxies, official school layout and photographed facade; estimated heights and planting. Surroundings: OSM © OpenStreetMap contributors'}),
 ground:Object.freeze({baked:Object.freeze({envIds:SUILGIRLS_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact Suil Girls school ground, site, planting and surrounding buildings'})}),
 protected:Object.freeze({models:SUILGIRLS_PROTECTED}),hazardTape:Object.freeze({footprints:SUILGIRLS_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5ea',fog:Object.freeze({color:'#dce5ea',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:SUILGIRLS_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default SUILGIRLS;
