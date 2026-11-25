import { WORLD_UNITS_PER_METER, GEO_ORIGIN, JINHAESEHWA_PLACEMENTS, JINHAESEHWA_BUILDING_BASE, JINHAESEHWA_HEIGHT_GRIDS, JINHAESEHWA_HEIGHT_RANGE_M, JINHAESEHWA_ENV_IDS, JINHAESEHWA_PROVENANCE } from './data.js';
import { JINHAESEHWA_FOOTPRINTS } from './footprints.js';
import { JINHAESEHWA_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(JINHAESEHWA_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/jinhaesehwa/${f}`,import.meta.url).href;
export const JINHAESEHWA=Object.freeze({
 id:'jinhaesehwa',meta:Object.freeze({school:'진해세화여자고등학교',campus:'창원',short:'진해세화여고',modelNoun:'진해세화여고'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:JINHAESEHWA_PLACEMENTS,approvedCount:JINHAESEHWA_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:26,tiltNear:14}),
 coreIds:Object.freeze(['main','hall']),startBuildingId:'main',
 // Main teaching facade is the start subject; desktop and phone framing are independent.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[-12,-18,-5],max:[24,-8,3],azimuth:-1.05}:{min:[-16,-10,-6],max:[28,0,4],azimuth:-.45};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:JINHAESEHWA_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:JINHAESEHWA_HEIGHT_GRIDS,buildingBase:JINHAESEHWA_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:JINHAESEHWA_PROVENANCE,sourceNote:'OSM building outlines and authored aerial proxies, official school layout and photographed facade; estimated heights and planting. Surroundings: OSM © OpenStreetMap contributors'}),
 ground:Object.freeze({baked:Object.freeze({envIds:JINHAESEHWA_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact Jinhae Sehwa school ground, site, planting and surrounding buildings'})}),
 protected:Object.freeze({models:JINHAESEHWA_PROTECTED}),hazardTape:Object.freeze({footprints:JINHAESEHWA_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5ea',fog:Object.freeze({color:'#dce5ea',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:JINHAESEHWA_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default JINHAESEHWA;
