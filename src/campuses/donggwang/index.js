import { WORLD_UNITS_PER_METER, GEO_ORIGIN, DONGGWANG_PLACEMENTS, DONGGWANG_BUILDING_BASE, DONGGWANG_HEIGHT_GRIDS, DONGGWANG_HEIGHT_RANGE_M, DONGGWANG_ENV_IDS, DONGGWANG_PROVENANCE } from './data.js';
import { DONGGWANG_FOOTPRINTS } from './footprints.js';
import { DONGGWANG_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(DONGGWANG_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/donggwang/${f}`,import.meta.url).href;
export const DONGGWANG=Object.freeze({
 id:'donggwang',meta:Object.freeze({school:'동광산업과학고등학교',campus:'고성',short:'동광산업과학고',modelNoun:'동광산업과학고'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:DONGGWANG_PLACEMENTS,approvedCount:DONGGWANG_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:18,tiltNear:14}),
 coreIds:Object.freeze(['main','middle','dorm','gym']),startBuildingId:'main',
 // East courtyard approach relates the high-school main facade to the shared middle-school wing.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[-10,-1,-8],max:[16,8,21],azimuth:1.73}:{min:[-32,0,-8],max:[27,8,22],azimuth:1.48};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:DONGGWANG_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:DONGGWANG_HEIGHT_GRIDS,buildingBase:DONGGWANG_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:DONGGWANG_PROVENANCE,sourceNote:'OSM building outlines and authored aerial proxies, official school layout and photographed facade; estimated heights and planting. Surroundings: OSM © OpenStreetMap contributors'}),
 ground:Object.freeze({baked:Object.freeze({envIds:DONGGWANG_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact Donggwang school ground, site, planting and surrounding buildings'})}),
 protected:Object.freeze({models:DONGGWANG_PROTECTED}),hazardTape:Object.freeze({footprints:DONGGWANG_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5ea',fog:Object.freeze({color:'#dce5ea',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:DONGGWANG_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default DONGGWANG;
