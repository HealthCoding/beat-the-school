// 국립한국해양대학교 부산 · 35 destructible buildings and two training ships, zero shields.
import { WORLD_UNITS_PER_METER, GEO_ORIGIN, KMOU_PLACEMENTS, KMOU_BUILDING_BASE, KMOU_HEIGHT_GRIDS, KMOU_HEIGHT_RANGE_M, KMOU_ENV_IDS, KMOU_PROVENANCE } from './data.js';
import { KMOU_FOOTPRINTS } from './footprints.js';
import { KMOU_PROTECTED } from './protected.js';
const IDS=Object.freeze(KMOU_PLACEMENTS.map(p=>p.id));
const asset=file=>new URL(`../../../assets/campuses/kmou/${file}`,import.meta.url).href;
const HAZE='#dce8ec';
export const KMOU=Object.freeze({
 id:'kmou',meta:Object.freeze({school:'국립한국해양대학교',campus:'부산',short:'한국해양대',modelNoun:'한국해양대'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),
 placements:KMOU_PLACEMENTS,approvedCount:KMOU_PLACEMENTS.length,additionalCount:0,
 coreIds:Object.freeze(['main','maritime','newMaritime','oceanScience','libraryNew']),startBuildingId:'main',
 // From the causeway / entrance shore toward the headquarters and maritime-school group.
 view:Object.freeze({get startFrame(){return(globalThis.innerWidth||1280)<600
  ?{min:[-30.65,-2,-57.6],max:[31.35,12,6.4],azimuth:-1.08}
  :{min:[-40,-9,-83],max:[75,7,8],azimuth:-1.10};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:IDS},{url:asset('environment.json'),expectedIds:KMOU_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural KMOU buildings');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:KMOU_HEIGHT_GRIDS,buildingBase:KMOU_BUILDING_BASE,source:'Estimated ground sampled from the final visible Float32 terrain triangles; centimetre grid, not a survey'}),
 environment:Object.freeze({provenance:KMOU_PROVENANCE,sourceNote:'조도 캠퍼스 · 사진, OSM 지도와 GLO30 지형 기반 추정. © OpenStreetMap contributors (ODbL)'}),
 ground:Object.freeze({baked:Object.freeze({envIds:KMOU_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:80,
  fade:Object.freeze({centre_m:Object.freeze([100,190]),near_m:1050,far_m:2050,colour:HAZE}),
  source:'KMOU baked ground and scenery, terrain-matched courtyard paving; tree instances match the preview'})}),
 protected:Object.freeze({models:KMOU_PROTECTED}),hazardTape:Object.freeze({footprints:KMOU_FOOTPRINTS}),
 scene:Object.freeze({background:HAZE,fog:Object.freeze({color:HAZE,near:900,far:3000}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-125,250,75]),shadowSpan:325}),floor:Object.freeze({color:'#2d859b',hidden:true,y:KMOU_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})}),
});
export default KMOU;
