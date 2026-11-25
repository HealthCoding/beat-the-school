// Kyung Hee University Global Campus; generated data preserves the active pilot decision.
import { WORLD_UNITS_PER_METER, GEO_ORIGIN, KYUNGHEE_GLOBAL_PLACEMENTS, KYUNGHEE_GLOBAL_BUILDING_BASE, KYUNGHEE_GLOBAL_HEIGHT_GRIDS, KYUNGHEE_GLOBAL_HEIGHT_RANGE_M, KYUNGHEE_GLOBAL_ENV_IDS, KYUNGHEE_GLOBAL_ENV_MANIFEST_IDS, KYUNGHEE_GLOBAL_LOOK, KYUNGHEE_GLOBAL_ZONES, KYUNGHEE_GLOBAL_DISPLAY, KYUNGHEE_GLOBAL_PROVENANCE } from './data.js';
import { KYUNGHEE_GLOBAL_FOOTPRINTS } from './footprints.js';
import { KYUNGHEE_GLOBAL_PROTECTED } from './protected.js';
import { createKyungheeGlobalGroundLook } from './ground-look.js';
import { exactHeightAt } from './exact-ground.js';

const MODEL_IDS = Object.freeze(KYUNGHEE_GLOBAL_PLACEMENTS.map(p => p.id));
const asset = file => new URL(`../../../assets/campuses/kyungheeGlobal/${file}`, import.meta.url).href;
const HAZE = KYUNGHEE_GLOBAL_DISPLAY.haze, FADE = KYUNGHEE_GLOBAL_DISPLAY.fade;

export const KYUNGHEE_GLOBAL = Object.freeze({
  id: 'kyungheeGlobal',
  meta: Object.freeze({ school: '경희대학교', campus: '국제캠퍼스', short: '경희대 국제', modelNoun: '경희대 국제' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: KYUNGHEE_GLOBAL_PLACEMENTS,
  approvedCount: KYUNGHEE_GLOBAL_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['gate', 'library', 'arts', 'physical', 'seonseung'].filter(id => MODEL_IDS.includes(id))),
  startBuildingId: 'library',
  // 사색의 광장 정면 축에서 중앙도서관과 연못·아치·화단을 함께 보여준다.
  view: Object.freeze({ get startFrame() { return (globalThis.innerWidth || 1280) < 600
    ? { min: [-78, -8, 29], max: [12, 10, 81], azimuth: Math.PI / 2, elevationDegrees: 12 }
    : { min: [-75, -8, 30], max: [20, 10, 80], azimuth: Math.PI / 2, elevationDegrees: 12 }; } }),
  models: Object.freeze({
    manifests: Object.freeze([
      Object.freeze({ url: asset('manifest.json'), expectedIds: MODEL_IDS }),
      Object.freeze({ url: asset('environment.json'), expectedIds: KYUNGHEE_GLOBAL_ENV_MANIFEST_IDS }),
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw new Error('No procedural buildings in this campus'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} }),
  }),
  terrain: Object.freeze({ heightGrids: KYUNGHEE_GLOBAL_HEIGHT_GRIDS, buildingBase: KYUNGHEE_GLOBAL_BUILDING_BASE, exactHeightAt,
    source: 'Relative terrain estimate (place / photo level evidence, pilot/kyunghee-global); not a survey' }),
  environment: Object.freeze({ provenance: KYUNGHEE_GLOBAL_PROVENANCE, sourceNote: 'OSM ground surfaces and surroundings (© OpenStreetMap contributors, ODbL); heights, planting and the place models estimated' }),
  ground: Object.freeze({
    baked: Object.freeze({ envIds: KYUNGHEE_GLOBAL_ENV_IDS, castShadow: Object.freeze([]), materialHook: createKyungheeGlobalGroundLook(KYUNGHEE_GLOBAL_LOOK, KYUNGHEE_GLOBAL_ZONES, KYUNGHEE_GLOBAL_DISPLAY.backdropFade),
      // context.json display fade (preview.js FADE): campus clear to r0, the backdrop melts into the haze by r1
      fade: Object.freeze({ centre_m: Object.freeze([...FADE.centreEN]), near_m: FADE.r0_m, far_m: FADE.r1_m, ...(FADE.linearShare ? { linear: FADE.linearShare } : {}), colour: HAZE }), playMargin_m: 30,
      source: 'pilot/kyunghee-global preview ground + planting + landscape + context, baked' }),
  }),
  // Protection records are generated from the active pilot decision.
  protected: Object.freeze({
    ...(KYUNGHEE_GLOBAL_PROTECTED.length ? { manifestURL: asset('protected/manifest.json') } : {}),
    models: KYUNGHEE_GLOBAL_PROTECTED,
  }),
  // Hazard tape around every destructible building only (src/engine/hazard-tape.js): none on the protected models or the context.
  hazardTape: Object.freeze({ footprints: KYUNGHEE_GLOBAL_FOOTPRINTS }),
  scene: Object.freeze({
    // Same light direction as the preview: sun (190, 360, 220), target origin, coordinates halved.
    background: HAZE, fog: Object.freeze({ color: HAZE, near: 650, far: 2200 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([95, 180, 110]), shadowSpan: 280 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: KYUNGHEE_GLOBAL_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - .3 }),
  }),
});
export default KYUNGHEE_GLOBAL;
