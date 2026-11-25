import { WORLD_UNITS_PER_METER, GEO_ORIGIN, DADAE_PLACEMENTS, DADAE_BUILDING_BASE, DADAE_HEIGHT_GRIDS, DADAE_HEIGHT_RANGE_M, DADAE_ENV_IDS, DADAE_PROVENANCE } from './data.js';
import { DADAE_FOOTPRINTS } from './footprints.js';
import { DADAE_PROTECTED } from './protected.js';
const MODEL_IDS=Object.freeze(DADAE_PLACEMENTS.map(p=>p.id));
const asset=f=>new URL(`../../../assets/campuses/dadae/${f}`,import.meta.url).href;
export const DADAE=Object.freeze({
 id:'dadae',meta:Object.freeze({school:'다대고등학교',campus:'부산',short:'다대고',modelNoun:'다대고'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:DADAE_PLACEMENTS,approvedCount:DADAE_PLACEMENTS.length,additionalCount:0,
 camera:Object.freeze({playElevation:16,tiltNear:14}),
 coreIds:Object.freeze(['main','gym','bridge']),startBuildingId:'main',
 // Southeast field approach emphasizes the curved main facade; independent mobile framing.
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[-4,0,-12],max:[6,11,-4],azimuth:1.3}:{min:[-22,.2,-20],max:[18,11,1],azimuth:.77};}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:MODEL_IDS},{url:asset('environment.json'),expectedIds:DADAE_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building');},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:DADAE_HEIGHT_GRIDS,buildingBase:DADAE_BUILDING_BASE,source:'Exact exported school ground samples; estimated relative levels'}),
 environment:Object.freeze({provenance:DADAE_PROVENANCE,sourceNote:'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'}),
 ground:Object.freeze({baked:Object.freeze({envIds:DADAE_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Exact Dadae school ground, site, planting and surrounding buildings'})}),
 protected:Object.freeze({models:DADAE_PROTECTED}),hazardTape:Object.freeze({footprints:DADAE_FOOTPRINTS}),
 scene:Object.freeze({background:'#dce5ea',fog:Object.freeze({color:'#dce5ea',near:175,far:500}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#7d8a78',intensity:1.35}),sun:Object.freeze({color:'#fff4e2',intensity:3.1,position:Object.freeze([-65,105,85]),shadowSpan:150}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:DADAE_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default DADAE;
