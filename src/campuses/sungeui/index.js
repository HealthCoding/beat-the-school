// Draft local package. Protection and several R1/R2 findings remain unresolved.
import {WORLD_UNITS_PER_METER,GEO_ORIGIN,SUNGEUI_PLACEMENTS,SUNGEUI_BUILDING_BASE,SUNGEUI_HEIGHT_GRIDS,SUNGEUI_HEIGHT_RANGE_M,SUNGEUI_ENV_IDS,SUNGEUI_PROVENANCE} from './data.js?v=sungeui-r9';
import {SUNGEUI_FOOTPRINTS} from './footprints.js?v=sungeui-r9';
import {SUNGEUI_PROTECTED} from './protected.js?v=sungeui-r9';
const asset=f=>new URL(`../../../assets/campuses/sungeui/${f}`,import.meta.url).href;
const IDS=Object.freeze(SUNGEUI_PLACEMENTS.map(p=>p.id));
// The authored grid is E/north, while the runtime grid is E/z (z = -north).
// Reversing the row axis also reverses the cell diagonal. Match the visible
// ground triangles exactly for collision, aiming and the destruction surface.
const fine=SUNGEUI_HEIGHT_GRIDS[0];
const binary=atob(fine.centimetresBase64);
const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
const centimetres=new Int16Array(bytes.buffer);
function exactHeightAt(e,n) {
 const x=(e-fine.minE)/fine.step, z=(-n-fine.minZ)/fine.step;
 const i=Math.floor(x), j=Math.floor(z);
 if(i<0||j<0||i>=fine.nx-1||j>=fine.nz-1)return undefined;
 const u=x-i,v=z-j,k=j*fine.nx+i,a=centimetres[k]/100,b=centimetres[k+1]/100,c=centimetres[k+fine.nx]/100,d=centimetres[k+fine.nx+1]/100;
 return u>=v?a+u*(b-a)+v*(d-b):a+u*(d-c)+v*(c-a);
}

export const SUNGEUI=Object.freeze({
 id:'sungeui',meta:Object.freeze({school:'숭의여자대학교',campus:'서울',short:'숭의여대',modelNoun:'숭의여대'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:SUNGEUI_PLACEMENTS,approvedCount:IDS.length,additionalCount:0,
 coreIds:Object.freeze(['main','lecture_a','lecture_c']),startBuildingId:'main',camera:Object.freeze({overviewElevation:44,playElevation:22,tiltNear:15}),
 // 11-10: face the main front (official-22 direction); the old frame put a context roof in the foreground.
 view:Object.freeze({overviewAzimuth:-.35,get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[-20,-5,8],max:[16,9,30],azimuth:3.1,elevationDegrees:30}:{min:[-28,-6,2],max:[22,10,34],azimuth:3.1,elevationDegrees:28}}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:IDS},{url:asset('environment.json'),expectedIds:SUNGEUI_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building')},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:SUNGEUI_HEIGHT_GRIDS,buildingBase:SUNGEUI_BUILDING_BASE,exactHeightAt,source:'Estimated terrain; elevations are not surveyed'}),
 environment:Object.freeze({provenance:SUNGEUI_PROVENANCE,sourceNote:'OSM © OpenStreetMap contributors; buildings and site are provisional'}),
 ground:Object.freeze({baked:Object.freeze({envIds:SUNGEUI_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:24,source:'Sungeui provisional 1 m terrain and scene'})}),
 // 11-11: common band (0.7-2.3 m) and step limit (1.1 m) again; the 11-03 narrow band (0.9-1.5 m, step .25 m)
 // left only dotted remnants. Deck lift, step test and door / stair cuts: src/campuses/sungeui/hazard-tape.js.
 protected:Object.freeze({manifestURL:asset('protected/manifest.json'),models:SUNGEUI_PROTECTED}),hazardTape:Object.freeze({footprints:SUNGEUI_FOOTPRINTS,inner_m:.7,outer_m:2.3,cell_m:.4,maxStep_m:1.1}),
 scene:Object.freeze({background:'#dfe8ec',fog:Object.freeze({color:'#dfe8ec',near:300,far:750}),hemisphere:Object.freeze({sky:'#ffffff',ground:'#8c9981',intensity:1.35}),sun:Object.freeze({color:'#fff5e8',intensity:3.1,position:Object.freeze([-90,120,75]),shadowSpan:95}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:SUNGEUI_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
export default SUNGEUI;
