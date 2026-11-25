import { WORLD_UNITS_PER_METER, GEO_ORIGIN, JUNGWONBC_PLACEMENTS, JUNGWONBC_BUILDING_BASE, JUNGWONBC_HEIGHT_GRIDS, JUNGWONBC_HEIGHT_RANGE_M, JUNGWONBC_ENV_IDS, JUNGWONBC_PROVENANCE } from './data.js';
import { JUNGWONBC_FOOTPRINTS } from './footprints.js';
import { JUNGWONBC_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(JUNGWONBC_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/jungwonbc/${f}`, import.meta.url).href;
export const JUNGWONBC = Object.freeze({
  id: 'jungwonbc',
  meta: Object.freeze({ school: '중원고등학교', campus: '부천', short: '중원고', modelNoun: '중원고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: JUNGWONBC_PLACEMENTS,
  approvedCount: JUNGWONBC_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'gym']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Claude Opus 10-30: start on the west front (cream entrance bay with pediment, south stair tower, green canopies) seen from the dirt field;
  // frames chosen with the camera simulator (pilot/jungwon-bucheon/review/r3/frame-sim/).
  view: Object.freeze({
    overviewAzimuth: -1.45,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [0, -4.1, -8.1], max: [8.9, 5.2, 5.4], azimuth: -0.85, elevationDegrees: 18 }
        : { min: [1.1, -4.1, -18], max: [11.7, 6, 5.3], azimuth: -1.29, elevationDegrees: 17 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: JUNGWONBC_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: JUNGWONBC_HEIGHT_GRIDS,
    buildingBase: JUNGWONBC_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: JUNGWONBC_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: JUNGWONBC_ENV_IDS,
      castShadow: Object.freeze([]),
      // context fade (pilot context.json display.fade): campus clear to near_m from its centre, the backdrop melts into the scene colour by far_m
      fade: Object.freeze({ centre_m: Object.freeze([15, 0]), near_m: 185, far_m: 430, linear: 0.8, colour: '#dce5ea' }),
      playMargin_m: 24,
      source: 'Exact Jungwon school ground (field 0, yard +0.9 m), site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: JUNGWONBC_PROTECTED }),
  hazardTape: Object.freeze({ footprints: JUNGWONBC_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 500, far: 1400 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: JUNGWONBC_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default JUNGWONBC;
