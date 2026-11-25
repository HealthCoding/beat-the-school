import { WORLD_UNITS_PER_METER, GEO_ORIGIN, GWANYANG_PLACEMENTS, GWANYANG_BUILDING_BASE, GWANYANG_HEIGHT_GRIDS, GWANYANG_HEIGHT_RANGE_M, GWANYANG_ENV_IDS, GWANYANG_PROVENANCE } from './data.js';
import { GWANYANG_FOOTPRINTS } from './footprints.js';
import { GWANYANG_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(GWANYANG_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/gwanyang/${f}`,import.meta.url).href;
export const GWANYANG=Object.freeze({
 id:'gwanyang',meta:Object.freeze({school:'관양고등학교',campus:'안양',short:'관양고',modelNoun:'관양고'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:GWANYANG_PLACEMENTS,approvedCount:GWANYANG_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:26,tiltNear:14}),
 coreIds:Object.freeze(['main','gym']),startBuildingId:'main',
 // Southwest approach frames the main teaching wings and Hanbyeot hall together on desktop and phone.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[-30,-17,-15],max:[28,-5,23],azimuth:-1.3}:{min:[-28,0,-16],max:[33,10,25],azimuth:-.8};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:GWANYANG_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:GWANYANG_HEIGHT_GRIDS,buildingBase:GWANYANG_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:GWANYANG_PROVENANCE,sourceNote:'OSM building outlines and authored aerial proxies, official school layout and photographed facade; estimated heights and planting. Surroundings: OSM © OpenStreetMap contributors'}),
 ground:Object.freeze({baked:Object.freeze({envIds:GWANYANG_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact Gwanyang school ground, site, planting and surrounding buildings'})}),
 protected:Object.freeze({models:GWANYANG_PROTECTED}),hazardTape:Object.freeze({footprints:GWANYANG_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5ea',fog:Object.freeze({color:'#dce5ea',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:GWANYANG_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default GWANYANG;
