// Local draft. Identity, architecture and terrain require further review.
import {WORLD_UNITS_PER_METER,GEO_ORIGIN,GWG_PLACEMENTS,GWG_BUILDING_BASE,GWG_HEIGHT_GRIDS,GWG_HEIGHT_RANGE_M,GWG_ENV_IDS,GWG_PROVENANCE} from './data.js';
import {GWG_FOOTPRINTS} from './footprints.js';
import {GWG_PROTECTED} from './protected.js';
import {exactHeightAt} from './surface.js';
const asset=f=>new URL(`../../../assets/campuses/gwnuGangneung/${f}`,import.meta.url).href;
const IDS=Object.freeze(GWG_PLACEMENTS.map(x=>x.id));
export default Object.freeze({
 id:'gwnuGangneung',meta:Object.freeze({school:'강원대학교',campus:'강릉캠퍼스',short:'강원대 강릉',modelNoun:'강원대학교 강릉캠퍼스'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:GWG_PLACEMENTS,approvedCount:IDS.length,additionalCount:0,
 coreIds:Object.freeze(['c5-library','c6-main-admin','n10-iacg','c2-humanities','n5-haeram-hall']),startBuildingId:'c5-library',
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[19,-20,-82],max:[33,-8,-22],azimuth:1.55,elevationDegrees:25}:{min:[15,-14,-90],max:[38,-2,-10],azimuth:1.55,elevationDegrees:12}}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:IDS},{url:asset('environment.json'),expectedIds:GWG_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building')},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({exactHeightAt,heightGrids:GWG_HEIGHT_GRIDS,buildingBase:GWG_BUILDING_BASE,source:'Photo-estimated levels; final triangle surface lookup in EN metres'}),
 environment:Object.freeze({provenance:GWG_PROVENANCE,sourceNote:'OSM © OpenStreetMap contributors; local elevations and appearance are provisional'}),
 ground:Object.freeze({baked:Object.freeze({envIds:GWG_ENV_IDS,castShadow:Object.freeze([]),playMargin_m:30,flat:Object.freeze({byId:Object.freeze({'s1-dent1':Object.freeze({band_m:0}),'s2-dent2':Object.freeze({band_m:0}),'s-annex1':Object.freeze({band_m:0}),'s-annex2':Object.freeze({band_m:0}),'d9-haesong':Object.freeze({band_m:0})})}),/* 5차a: S 구역·해송관은 받침 옆이 장소 판+옹벽(site/place-walls) — 4 m 띠가 옹벽 윗단 땅을 끌어내리지 않게 띠 없음 *//* 11-10 1차부지 M01: 치학1 서쪽은 S3 고원과 12 m 단차라 석축(7.5 m)+비탈로 구웠다 → 엔진 4 m 띠가 석축 윗단을 끌어내리지 않게 그 동만 띠 없음 */source:'Draft pilot terrain and surroundings'})}),
 protected:Object.freeze({manifestURL:asset('protected/manifest.json'),models:GWG_PROTECTED}),hazardTape:Object.freeze({footprints:GWG_FOOTPRINTS,inner_m:.9,outer_m:1.5,cell_m:.2,maxStep_m:.25}),
 scene:Object.freeze({background:'#c9dce5',fog:Object.freeze({color:'#c9dce5',near:450,far:1200}),hemisphere:Object.freeze({sky:'#f6fbff',ground:'#75876c',intensity:1.3}),sun:Object.freeze({color:'#fff4dd',intensity:2.9,position:Object.freeze([-180,340,200]),shadowSpan:260}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:GWG_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
