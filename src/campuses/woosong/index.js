// Woosong University Daejeon: pilot-derived local campus package. W8 우송유치원 is protected; 31 university buildings break.
import { WORLD_UNITS_PER_METER, GEO_ORIGIN, WOOSONG_PLACEMENTS, WOOSONG_BUILDING_BASE, WOOSONG_HEIGHT_GRIDS, WOOSONG_HEIGHT_RANGE_M, WOOSONG_ENV_IDS, WOOSONG_ENV_MANIFEST_IDS, WOOSONG_LOOK, WOOSONG_ZONES, WOOSONG_DISPLAY, WOOSONG_PROVENANCE } from './data.js';
import { WOOSONG_FOOTPRINTS } from './footprints.js';
import { WOOSONG_PROTECTED } from './protected.js';
import { createSkkuGroundLook } from '../skku/ground-look.js';

const MODEL_IDS = Object.freeze(WOOSONG_PLACEMENTS.map(p => p.id));
const asset = file => new URL(`../../../assets/campuses/woosong/${file}`, import.meta.url).href;
const HAZE = WOOSONG_DISPLAY.haze, FADE = WOOSONG_DISPLAY.fade;

export const WOOSONG = Object.freeze({
  id: 'woosong',
  meta: Object.freeze({ school: '우송대학교', campus: '대전', short: '우송대', modelNoun: '우송대' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: WOOSONG_PLACEMENTS,
  approvedCount: WOOSONG_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['w7', 'w1', 'w13'].filter(id => MODEL_IDS.includes(id))),
  // 서캠 정원에서 우송관 축을 따라 보는 시작 장면. 도서관과 타워를 함께 담는다.
  startBuildingId: 'w7',
  view: Object.freeze({ startFrame: Object.freeze({ min: Object.freeze([-210, 2, -35]), max: Object.freeze([-146, 24, 95]), azimuth: -0.624 }) }),
  models: Object.freeze({
    manifests: Object.freeze([
      Object.freeze({ url: asset('manifest.json'), expectedIds: MODEL_IDS }),
      Object.freeze({ url: asset('environment.json'), expectedIds: WOOSONG_ENV_MANIFEST_IDS }),
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw new Error('No procedural buildings in this campus'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} }),
  }),
  terrain: Object.freeze({ heightGrids: WOOSONG_HEIGHT_GRIDS, buildingBase: WOOSONG_BUILDING_BASE,
    source: 'Relative terrain estimate (Copernicus GLO-30, building-filled, forest lowered + place / photo level evidence, pilot/woosong-daejeon); not a survey' }),
  environment: Object.freeze({ provenance: WOOSONG_PROVENANCE, sourceNote: 'OSM ground surfaces and surroundings (© OpenStreetMap contributors, ODbL); heights, planting and the place models estimated' }),
  ground: Object.freeze({
    baked: Object.freeze({ envIds: WOOSONG_ENV_IDS, castShadow: Object.freeze([]), materialHook: createSkkuGroundLook(WOOSONG_LOOK, WOOSONG_ZONES),
      // context.json display fade (preview.js FADE): campus clear to r0, the backdrop melts into the haze by r1
      fade: Object.freeze({ centre_m: Object.freeze([...FADE.centreEN]), near_m: FADE.r0_m, far_m: FADE.r1_m, ...(FADE.linearShare ? { linear: FADE.linearShare } : {}), colour: HAZE }), playMargin_m: 30,
      source: 'pilot/woosong-daejeon preview ground + planting + landscape + context, baked' }),
  }),
  // Protected (pilot destructible:false: W8 우송유치원, child facility, user decision 2026-10-23): weapons meet the protective
  // shield (src/protected-buildings.js); own manifest, models packed with the campus cache.
  protected: Object.freeze({
    ...(WOOSONG_PROTECTED.length ? { manifestURL: asset('protected/manifest.json') } : {}),
    models: WOOSONG_PROTECTED,
  }),
  // Hazard tape around every destructible building only (src/engine/hazard-tape.js): none on the protected models or the context.
  hazardTape: Object.freeze({ footprints: WOOSONG_FOOTPRINTS }),
  scene: Object.freeze({
    // Same light as the Woosong preview: sun (-190, 360, -40), target origin, coordinates halved.
    background: HAZE, fog: Object.freeze({ color: HAZE, near: 650, far: 2200 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-95, 180, -20]), shadowSpan: 280 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: WOOSONG_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - .3 }),
  }),
});
export default WOOSONG;
