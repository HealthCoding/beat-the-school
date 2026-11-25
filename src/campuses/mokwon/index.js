// Mokwon University Daejeon: protection follows the pilot model inventory.
import { WORLD_UNITS_PER_METER, GEO_ORIGIN, MOKWON_PLACEMENTS, MOKWON_BUILDING_BASE, MOKWON_HEIGHT_GRIDS, MOKWON_HEIGHT_RANGE_M, MOKWON_ENV_IDS, MOKWON_ENV_MANIFEST_IDS, MOKWON_LOOK, MOKWON_ZONES, MOKWON_DISPLAY, MOKWON_PROVENANCE } from './data.js';
import { MOKWON_FOOTPRINTS } from './footprints.js';
import { MOKWON_PROTECTED } from './protected.js';
import { createMokwonGroundLook } from './ground-look.js';

const MODEL_IDS = Object.freeze(MOKWON_PLACEMENTS.map(p => p.id));
const asset = file => new URL(`../../../assets/campuses/mokwon/${file}`, import.meta.url).href;
const HAZE = MOKWON_DISPLAY.haze, FADE = MOKWON_DISPLAY.fade;

export const MOKWON = Object.freeze({
  id: 'mokwon',
  meta: Object.freeze({ school: '목원대학교', campus: '대전', short: '목원대', modelNoun: '목원대' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: MOKWON_PLACEMENTS,
  approvedCount: MOKWON_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['library', 'history', 'art', 'concert'].filter(id => MODEL_IDS.includes(id))),
  // 중앙도서관·대학본부 전면과 주변 학관 축. 공통 카메라 하향20°/줌14° 사용.
  startBuildingId: 'library',
  view: Object.freeze({ get startFrame() { return (globalThis.innerWidth || 1280) < 600
    ? { min: [-13, -13, -25], max: [25, 5, 9], azimuth: -2.82 }
    : { min: [0, -14, -35], max: [51, 4, 5], azimuth: -2.82 }; } }),
  models: Object.freeze({
    manifests: Object.freeze([
      Object.freeze({ url: asset('manifest.json'), expectedIds: MODEL_IDS }),
      Object.freeze({ url: asset('environment.json'), expectedIds: MOKWON_ENV_MANIFEST_IDS }),
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw new Error('No procedural buildings in this campus'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} }),
  }),
  terrain: Object.freeze({ heightGrids: MOKWON_HEIGHT_GRIDS, buildingBase: MOKWON_BUILDING_BASE,
    source: 'Relative terrain estimate (Copernicus GLO-30, building-filled, forest lowered + place / photo level evidence, pilot/mokwon-daejeon); not a survey' }),
  environment: Object.freeze({ provenance: MOKWON_PROVENANCE, sourceNote: 'OSM ground surfaces and surroundings (© OpenStreetMap contributors, ODbL); heights, planting and the place models estimated' }),
  ground: Object.freeze({
    baked: Object.freeze({ envIds: MOKWON_ENV_IDS, castShadow: Object.freeze([]), materialHook: createMokwonGroundLook(MOKWON_LOOK, MOKWON_ZONES, MOKWON_DISPLAY.backdropFade),
      // context.json display fade (preview.js FADE): campus clear to r0, the backdrop melts into the haze by r1
      fade: Object.freeze({ centre_m: Object.freeze([...FADE.centreEN]), near_m: FADE.r0_m, far_m: FADE.r1_m, ...(FADE.linearShare ? { linear: FADE.linearShare } : {}), colour: HAZE }), playMargin_m: 30,
      source: 'pilot/mokwon-daejeon preview ground + planting + landscape + context, baked' }),
  }),
  // The package builder separates protected models from destructible placements.
  protected: Object.freeze({
    ...(MOKWON_PROTECTED.length ? { manifestURL: asset('protected/manifest.json') } : {}),
    models: MOKWON_PROTECTED,
  }),
  // Hazard tape around every destructible building only (src/engine/hazard-tape.js): none on the protected models or the context.
  hazardTape: Object.freeze({ footprints: MOKWON_FOOTPRINTS }),
  scene: Object.freeze({
    // Same light as the Mokwon preview: sun (-190, 360, -40), target origin, coordinates halved.
    background: HAZE, fog: Object.freeze({ color: HAZE, near: 650, far: 2200 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-95, 180, -20]), shadowSpan: 280 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: MOKWON_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - .3 }),
  }),
});
export default MOKWON;
