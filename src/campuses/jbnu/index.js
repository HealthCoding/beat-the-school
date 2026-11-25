// Jeonbuk National University Jeonju: General university buildings restored from the pilot; protection follows the recorded per-building decision.
import { WORLD_UNITS_PER_METER, GEO_ORIGIN, JBNU_PLACEMENTS, JBNU_BUILDING_BASE, JBNU_HEIGHT_GRIDS, JBNU_HEIGHT_RANGE_M, JBNU_ENV_IDS, JBNU_ENV_MANIFEST_IDS, JBNU_LOOK, JBNU_ZONES, JBNU_DISPLAY, JBNU_PROVENANCE } from './data.js';
import { JBNU_FOOTPRINTS } from './footprints.js';
import { JBNU_PROTECTED } from './protected.js';
import { createJbnuGroundLook } from './ground-look.js';
import { batchJbnuFlatMaterials } from './flat-batching.js';

const MODEL_IDS = Object.freeze(JBNU_PLACEMENTS.map(p => p.id));
const asset = file => new URL(`../../../assets/campuses/jbnu/${file}`, import.meta.url).href;
const HAZE = JBNU_DISPLAY.haze, FADE = JBNU_DISPLAY.fade;

export const JBNU = Object.freeze({
  id: 'jbnu',
  meta: Object.freeze({ school: '전북대학교', campus: '전주', short: '전북대', modelNoun: '전북대' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: JBNU_PLACEMENTS,
  approvedCount: JBNU_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['gate', 'main', 'library', 'museum', 'naturalHistory'].filter(id => MODEL_IDS.includes(id))),
  // 정문에서 본부로 이어지는 진입 축. 공통 게임 카메라의 하향20°/줌14° 사용.
  startBuildingId: 'gate',
  view: Object.freeze({ get startFrame() { return (globalThis.innerWidth || 1280) < 600
    ? { min: [-18, 8, 250], max: [18, 28, 312], azimuth: 0.05 }
    : { min: [-24.5, 4, 250], max: [24.5, 20, 315], azimuth: 0.05 }; } }),
  models: Object.freeze({
    manifests: Object.freeze([
      Object.freeze({ url: asset('manifest.json'), expectedIds: MODEL_IDS }),
      Object.freeze({ url: asset('environment.json'), expectedIds: JBNU_ENV_MANIFEST_IDS }),
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw new Error('No procedural buildings in this campus'); },
    enhanceFacade: (THREE, id, scene) => batchJbnuFlatMaterials(THREE, id, scene),
  }),
  terrain: Object.freeze({ heightGrids: JBNU_HEIGHT_GRIDS, buildingBase: JBNU_BUILDING_BASE,
    source: 'Relative terrain estimate (Copernicus GLO-30, building-filled, forest lowered + place / photo level evidence, pilot/jbnu-jeonju); not a survey' }),
  environment: Object.freeze({ provenance: JBNU_PROVENANCE, sourceNote: 'OSM ground surfaces and surroundings (© OpenStreetMap contributors, ODbL); heights, planting and the place models estimated' }),
  ground: Object.freeze({
    baked: Object.freeze({ envIds: JBNU_ENV_IDS, castShadow: Object.freeze([]), materialHook: createJbnuGroundLook(JBNU_LOOK, JBNU_ZONES, JBNU_DISPLAY.backdropFade),
      // context.json display fade (preview.js FADE): campus clear to r0, the backdrop melts into the haze by r1
      fade: Object.freeze({ centre_m: Object.freeze([...FADE.centreEN]), near_m: FADE.r0_m, far_m: FADE.r1_m, ...(FADE.linearShare ? { linear: FADE.linearShare } : {}), colour: HAZE }), playMargin_m: 30,
      source: 'pilot/jbnu-jeonju preview ground + planting + landscape + context, baked' }),
  }),
  // Protected records are generated separately from destructible placements.
  protected: Object.freeze({
    ...(JBNU_PROTECTED.length ? { manifestURL: asset('protected/manifest.json') } : {}),
    models: JBNU_PROTECTED,
  }),
  // Hazard tape around every destructible building only (src/engine/hazard-tape.js): none on the protected models or the context.
  hazardTape: Object.freeze({ footprints: JBNU_FOOTPRINTS }),
  scene: Object.freeze({
    // Same light as the Jbnu preview: sun (-190, 360, -40), target origin, coordinates halved.
    background: HAZE, fog: Object.freeze({ color: HAZE, near: 650, far: 2200 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-95, 180, -20]), shadowSpan: 280 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: JBNU_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - .3 }),
  }),
});
export default JBNU;
