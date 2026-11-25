// Local draft. Identity, architecture and terrain require further review.
import {WORLD_UNITS_PER_METER,GEO_ORIGIN,YM_PLACEMENTS,YM_BUILDING_BASE,YM_HEIGHT_GRIDS,YM_HEIGHT_RANGE_M,YM_ENV_IDS,YM_PROVENANCE} from './data.js';
import {YM_FOOTPRINTS} from './footprints.js';
import {YM_PROTECTED} from './protected.js';
import {exactHeightAt} from './exact-ground.js';
import {createExactScorchHook} from './exact-scorch.js';
const asset=f=>new URL(`../../../assets/campuses/yonseiMirae/${f}`,import.meta.url).href;
const IDS=Object.freeze(YM_PLACEMENTS.map(x=>x.id));
export default Object.freeze({
 id:'yonseiMirae',meta:Object.freeze({school:'연세대학교',campus:'미래캠퍼스',short:'연세대 미래',modelNoun:'연세대 미래캠퍼스'}),
 geo:Object.freeze({origin:GEO_ORIGIN,worldUnitsPerMeter:WORLD_UNITS_PER_METER}),placements:YM_PLACEMENTS,approvedCount:IDS.length,additionalCount:0,
 coreIds:Object.freeze(['library','convergence-hall','cheongsong','hq','sports-center']),startBuildingId:'library',
 view:Object.freeze({get startFrame(){return (globalThis.innerWidth||1280)<600?{min:[8,-15,-148],max:[48,-1,-123],azimuth:.25,elevationDegrees:22}:{min:[-2,-7,-148],max:[46,7,-123],azimuth:.25,elevationDegrees:22}}}),
 models:Object.freeze({manifests:Object.freeze([{url:asset('manifest.json'),expectedIds:IDS},{url:asset('environment.json'),expectedIds:YM_ENV_IDS}]),proceduralIds:Object.freeze([]),createProceduralSource:()=>{throw Error('No procedural building')},enhanceFacade:()=>({stats:{},dispose(){}})}),
 terrain:Object.freeze({heightGrids:YM_HEIGHT_GRIDS,buildingBase:YM_BUILDING_BASE,exactHeightAt,source:'Estimated terrain; twelve local areas use the visible surface, elsewhere the collision grid may differ'}),
 environment:Object.freeze({provenance:YM_PROVENANCE,sourceNote:'OSM © OpenStreetMap contributors; local elevations and appearance are provisional'}),
 ground:Object.freeze({baked:Object.freeze({envIds:YM_ENV_IDS,materialHook:createExactScorchHook,castShadow:Object.freeze([]),playMargin_m:30,flat:Object.freeze({byId:Object.freeze({'old-museum':Object.freeze({band_m:0})})}),/* 11-07 Claude YM-02: 구박물관은 높은 절토에 붙어 4 m 띠가 위 광장을 끌어내려 톱니 → 그 동만 띠 없음. 11-08: 전체 0 이면 다른 동 자리가 수직 절벽+톱니라 나머지는 기본 띠 */source:'Draft pilot terrain and surroundings'})}),
 protected:Object.freeze({manifestURL:asset('protected/manifest.json'),models:YM_PROTECTED}),hazardTape:Object.freeze({footprints:YM_FOOTPRINTS,inner_m:.9,outer_m:1.5,cell_m:.2,maxStep_m:.25}),
 scene:Object.freeze({background:'#c9dce5',fog:Object.freeze({color:'#c9dce5',near:450,far:1200}),hemisphere:Object.freeze({sky:'#f6fbff',ground:'#75876c',intensity:1.3}),sun:Object.freeze({color:'#fff4dd',intensity:2.9,position:Object.freeze([-180,340,200]),shadowSpan:260}),floor:Object.freeze({color:'#c9cbc8',hidden:true,y:YM_HEIGHT_RANGE_M[0]*WORLD_UNITS_PER_METER-.3})})
});
