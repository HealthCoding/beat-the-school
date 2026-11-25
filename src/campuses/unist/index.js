// Ulsan National Institute of Science and Technology: 49 destructible units (47 school buildings + 2 open bridges), 1 child shield (user 2026-10-26).
import { WORLD_UNITS_PER_METER, GEO_ORIGIN, UNIST_PLACEMENTS, UNIST_BUILDING_BASE, UNIST_HEIGHT_GRIDS, UNIST_HEIGHT_RANGE_M, UNIST_ENV_IDS, UNIST_ENV_MANIFEST_IDS, UNIST_LOOK, UNIST_ZONES, UNIST_DISPLAY, UNIST_PROVENANCE } from './data.js';
import { UNIST_FOOTPRINTS } from './footprints.js';
import { UNIST_PROTECTED } from './protected.js';
import { createUnistGroundLook } from './ground-look.js';

const MODEL_IDS = Object.freeze(UNIST_PLACEMENTS.map(p => p.id));
const asset = file => new URL(`../../../assets/campuses/unist/${file}`, import.meta.url).href;
const HAZE = UNIST_DISPLAY.haze, FADE = UNIST_DISPLAY.fade;

export const UNIST = Object.freeze({
  id: 'unist',
  meta: Object.freeze({ school: '울산과학기술원', campus: '울산', short: 'UNIST', modelNoun: 'UNIST' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: UNIST_PLACEMENTS,
  approvedCount: UNIST_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['library', 'main', 'gym', 'business', 'eng1'].filter(id => MODEL_IDS.includes(id))),
  // 학술정보관 → 호수 → 보행교 대표 장면 초기 구도. 공통 게임 카메라의 하향20°/줌14° 사용.
  startBuildingId: 'library',
  view: Object.freeze({ get startFrame() { return (globalThis.innerWidth || 1280) < 600
    ? { min: [-100, -2, -40], max: [-20, 22, 30], azimuth: 1.6 }
    : { min: [-110, -4, -60], max: [10, 20, 50], azimuth: 1.6 }; } }),
  models: Object.freeze({
    manifests: Object.freeze([
      Object.freeze({ url: asset('manifest.json'), expectedIds: MODEL_IDS }),
      Object.freeze({ url: asset('environment.json'), expectedIds: UNIST_ENV_MANIFEST_IDS }),
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw new Error('No procedural buildings in this campus'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} }),
  }),
  terrain: Object.freeze({ heightGrids: UNIST_HEIGHT_GRIDS, buildingBase: UNIST_BUILDING_BASE,
    source: 'Relative terrain estimate (Copernicus GLO-30, building-filled, forest lowered + place / photo level evidence, pilot/unist-ulsan); not a survey' }),
  environment: Object.freeze({ provenance: UNIST_PROVENANCE, sourceNote: 'OSM ground surfaces and surroundings (© OpenStreetMap contributors, ODbL); heights, planting and the place models estimated' }),
  ground: Object.freeze({
    baked: Object.freeze({ envIds: UNIST_ENV_IDS, castShadow: Object.freeze([]), materialHook: createUnistGroundLook(UNIST_LOOK, UNIST_ZONES, UNIST_DISPLAY.backdropFade),
      // context.json display fade (preview.js FADE): campus clear to r0, the backdrop melts into the haze by r1
      fade: Object.freeze({ centre_m: Object.freeze([...FADE.centreEN]), near_m: FADE.r0_m, far_m: FADE.r1_m, ...(FADE.linearShare ? { linear: FADE.linearShare } : {}), colour: HAZE }), playMargin_m: 30,
      source: 'pilot/unist-ulsan preview ground + planting + landscape + context, baked' }),
  }),
  // Only b207 (UNIST 어린이집) is protected. Gym (205) is destructible by user decision.
  protected: Object.freeze({
    ...(UNIST_PROTECTED.length ? { manifestURL: asset('protected/manifest.json') } : {}),
    models: UNIST_PROTECTED,
  }),
  // Hazard tape around every destructible building only (src/engine/hazard-tape.js): none on open bridges, the protected model or the context.
  hazardTape: Object.freeze({ footprints: UNIST_FOOTPRINTS }),
  scene: Object.freeze({
    // Same light as the Unist preview: sun (-190, 360, -40), target origin, coordinates halved.
    background: HAZE, fog: Object.freeze({ color: HAZE, near: 650, far: 2200 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-95, 180, -20]), shadowSpan: 280 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: UNIST_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - .3 }),
  }),
});
export default UNIST;
