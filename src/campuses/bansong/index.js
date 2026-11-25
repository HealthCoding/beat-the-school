import { WORLD_UNITS_PER_METER, GEO_ORIGIN, BANSONG_PLACEMENTS, BANSONG_BUILDING_BASE, BANSONG_HEIGHT_GRIDS, BANSONG_HEIGHT_RANGE_M, BANSONG_ENV_IDS, BANSONG_PROVENANCE } from './data.js';
import { BANSONG_FOOTPRINTS } from './footprints.js';
import { BANSONG_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(BANSONG_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/bansong/${f}`,import.meta.url).href;
export const BANSONG=Object.freeze({
 id:'bansong',meta:Object.freeze({school:'반송고등학교',campus:'화성',short:'반송고',modelNoun:'반송고'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:BANSONG_PLACEMENTS,approvedCount:BANSONG_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:20,tiltNear:14}),
 coreIds:Object.freeze(['main','gym','annex']),startBuildingId:'main',
 // Desktop and phone frames are separately tuned by the R3 scene review.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[-22,0,-14],max:[20,9,8],azimuth:1.6}:{min:[-29,0,-18],max:[25,11,12],azimuth:2.70526};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:BANSONG_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:BANSONG_HEIGHT_GRIDS,buildingBase:BANSONG_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:BANSONG_PROVENANCE,sourceNote:'OSM building outlines and authored aerial proxies, official school layout and photographed facade; estimated heights and planting. Surroundings: OSM © OpenStreetMap contributors'}),
 ground:Object.freeze({baked:Object.freeze({envIds:BANSONG_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact Bansong school ground, site, planting and surrounding buildings'})}),
 protected:Object.freeze({models:BANSONG_PROTECTED}),hazardTape:Object.freeze({footprints:BANSONG_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5ea',fog:Object.freeze({color:'#dce5ea',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:BANSONG_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default BANSONG;
