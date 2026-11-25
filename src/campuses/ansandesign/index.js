import { WORLD_UNITS_PER_METER, GEO_ORIGIN, ANSANDESIGN_PLACEMENTS, ANSANDESIGN_BUILDING_BASE, ANSANDESIGN_HEIGHT_GRIDS, ANSANDESIGN_HEIGHT_RANGE_M, ANSANDESIGN_ENV_IDS, ANSANDESIGN_PROVENANCE } from './data.js';
import { ANSANDESIGN_FOOTPRINTS } from './footprints.js';
import { ANSANDESIGN_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(ANSANDESIGN_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/ansandesign/${f}`,import.meta.url).href;
export const ANSANDESIGN=Object.freeze({
 id:'ansandesign',meta:Object.freeze({school:'안산디자인문화고등학교',campus:'안산',short:'안산디자인문화고',modelNoun:'안산디자인문화고'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:ANSANDESIGN_PLACEMENTS,approvedCount:ANSANDESIGN_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:23,tiltNear:14}),
 coreIds:Object.freeze(['main','kium']),startBuildingId:'main',
 // Initial main-building frame; parent supplies and validates desktop and phone framing.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[-26,-2,-32],max:[30,18,8],azimuth:.6}:{min:[-28,-6,-30],max:[30,7,10],azimuth:.6};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:ANSANDESIGN_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:ANSANDESIGN_HEIGHT_GRIDS,buildingBase:ANSANDESIGN_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:ANSANDESIGN_PROVENANCE,sourceNote:'OSM building outlines and authored aerial proxies, official school layout and photographed facade; estimated heights and planting. Surroundings: OSM © OpenStreetMap contributors'}),
 ground:Object.freeze({baked:Object.freeze({envIds:ANSANDESIGN_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact Ansan Design school ground, site, planting and surrounding buildings'})}),
 protected:Object.freeze({models:ANSANDESIGN_PROTECTED}),hazardTape:Object.freeze({footprints:ANSANDESIGN_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5ea',fog:Object.freeze({color:'#dce5ea',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:ANSANDESIGN_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default ANSANDESIGN;
