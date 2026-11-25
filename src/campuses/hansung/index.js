// Hansung University Seoul local campus; generated data preserves the active pilot decision.
import { WORLD_UNITS_PER_METER, GEO_ORIGIN, HANSUNG_PLACEMENTS, HANSUNG_BUILDING_BASE, HANSUNG_HEIGHT_GRIDS, HANSUNG_HEIGHT_RANGE_M, HANSUNG_ENV_IDS, HANSUNG_ENV_MANIFEST_IDS, HANSUNG_LOOK, HANSUNG_ZONES, HANSUNG_DISPLAY, HANSUNG_PROVENANCE } from './data.js';
import { HANSUNG_FOOTPRINTS } from './footprints.js';
import { HANSUNG_PROTECTED } from './protected.js';
import { createHansungGroundLook } from './ground-look.js';

const MODEL_IDS = Object.freeze(HANSUNG_PLACEMENTS.map(p => p.id));
const asset = file => new URL(`../../../assets/campuses/hansung/${file}`, import.meta.url).href;
const HAZE = HANSUNG_DISPLAY.haze, FADE = HANSUNG_DISPLAY.fade;

export const HANSUNG = Object.freeze({
  id: 'hansung',
  meta: Object.freeze({ school: '한성대학교', campus: '서울', short: '한성대', modelNoun: '한성대' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: HANSUNG_PLACEMENTS,
  approvedCount: HANSUNG_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['sangsang', 'mirae', 'uchon', 'research', 'naksan'].filter(id => MODEL_IDS.includes(id))),
  // 정문 진입 → 상상관 축. 공통 게임 카메라의 하향20°/줌14° 사용.
  startBuildingId: 'sangsang',
  view: Object.freeze({ get startFrame() { return (globalThis.innerWidth || 1280) < 600
    ? { min: [-9, -21, -24], max: [22, 5, 4], azimuth: 1.3 }
    : { min: [-30, -10, -36], max: [40, 10, 20], azimuth: 1.0 }; } }),
  models: Object.freeze({
    manifests: Object.freeze([
      Object.freeze({ url: asset('manifest.json'), expectedIds: MODEL_IDS }),
      Object.freeze({ url: asset('environment.json'), expectedIds: HANSUNG_ENV_MANIFEST_IDS }),
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw new Error('No procedural buildings in this campus'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} }),
  }),
  terrain: Object.freeze({ heightGrids: HANSUNG_HEIGHT_GRIDS, buildingBase: HANSUNG_BUILDING_BASE,
    source: 'Relative terrain estimate (place / photo level evidence, pilot/hansung-seoul); not a survey' }),
  environment: Object.freeze({ provenance: HANSUNG_PROVENANCE, sourceNote: 'OSM ground surfaces and surroundings (© OpenStreetMap contributors, ODbL); heights, planting and the place models estimated' }),
  ground: Object.freeze({
    baked: Object.freeze({ envIds: HANSUNG_ENV_IDS, castShadow: Object.freeze([]), materialHook: createHansungGroundLook(HANSUNG_LOOK, HANSUNG_ZONES, HANSUNG_DISPLAY.backdropFade),
      // context.json display fade (preview.js FADE): campus clear to r0, the backdrop melts into the haze by r1
      fade: Object.freeze({ centre_m: Object.freeze([...FADE.centreEN]), near_m: FADE.r0_m, far_m: FADE.r1_m, ...(FADE.linearShare ? { linear: FADE.linearShare } : {}), colour: HAZE }), playMargin_m: 30,
      source: 'pilot/hansung-seoul preview ground + planting + landscape + context, baked' }),
  }),
  // Protection records are generated from the active pilot decision.
  protected: Object.freeze({
    ...(HANSUNG_PROTECTED.length ? { manifestURL: asset('protected/manifest.json') } : {}),
    models: HANSUNG_PROTECTED,
  }),
  // Hazard tape around every destructible building only (src/engine/hazard-tape.js): none on the protected models or the context.
  hazardTape: Object.freeze({ footprints: HANSUNG_FOOTPRINTS }),
  scene: Object.freeze({
    // Same light as the Hansung preview: sun (-190, 360, 180), target origin, coordinates halved.
    background: HAZE, fog: Object.freeze({ color: HAZE, near: 650, far: 2200 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-95, 180, 90]), shadowSpan: 280 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: HANSUNG_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - .3 }),
  }),
});
export default HANSUNG;
