import { WORLD_UNITS_PER_METER, GEO_ORIGIN, SEHWAGIRLS_PLACEMENTS, SEHWAGIRLS_BUILDING_BASE, SEHWAGIRLS_HEIGHT_GRIDS, SEHWAGIRLS_HEIGHT_RANGE_M, SEHWAGIRLS_ENV_IDS, SEHWAGIRLS_PROVENANCE } from './data.js';
import { SEHWAGIRLS_FOOTPRINTS } from './footprints.js';
import { SEHWAGIRLS_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(SEHWAGIRLS_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/sehwagirls/${f}`,import.meta.url).href;
export const SEHWAGIRLS=Object.freeze({
 id:'sehwagirls',meta:Object.freeze({school:'세화여자고등학교',campus:'서울',short:'세화여고',modelNoun:'세화여고'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:SEHWAGIRLS_PLACEMENTS,approvedCount:SEHWAGIRLS_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:26,tiltNear:14}),
 coreIds:Object.freeze(['main','gym','center']),startBuildingId:'main',
 // Southwest view keeps main entrance, red-brick facade and middle-school turn above the initial help/bag overlays.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[12,-15,-34],max:[48,-1,-16],azimuth:-.9}:{min:[5,-3,-35],max:[72,8,-8],azimuth:-.35};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:SEHWAGIRLS_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:SEHWAGIRLS_HEIGHT_GRIDS,buildingBase:SEHWAGIRLS_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:SEHWAGIRLS_PROVENANCE,sourceNote:'OSM building outlines and authored aerial proxies, official school layout and photographed facade; estimated heights and planting. Surroundings: OSM © OpenStreetMap contributors'}),
 ground:Object.freeze({baked:Object.freeze({envIds:SEHWAGIRLS_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact Sehwa Girls school ground, site, planting and surrounding buildings'})}),
 protected:Object.freeze({models:SEHWAGIRLS_PROTECTED}),hazardTape:Object.freeze({footprints:SEHWAGIRLS_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5ea',fog:Object.freeze({color:'#dce5ea',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:SEHWAGIRLS_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default SEHWAGIRLS;
