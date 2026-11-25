import { WORLD_UNITS_PER_METER, GEO_ORIGIN, WOLSAN_PLACEMENTS, WOLSAN_BUILDING_BASE, WOLSAN_HEIGHT_GRIDS, WOLSAN_HEIGHT_RANGE_M, WOLSAN_ENV_IDS, WOLSAN_PROVENANCE } from './data.js';
import { WOLSAN_FOOTPRINTS } from './footprints.js';
import { WOLSAN_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(WOLSAN_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/wolsan/${f}`, import.meta.url).href;
export const WOLSAN = Object.freeze({
  id: 'wolsan',
  meta: Object.freeze({ school: '월산중학교', campus: '김해', short: '월산중', modelNoun: '월산중' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: WOLSAN_PLACEMENTS,
  approvedCount: WOLSAN_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'west-wing', 'east-wing', 'gym', 'cafeteria']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 42, playElevation: 22, tiltNear: 15 }),
  view: Object.freeze({
    overviewAzimuth: -0.05,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-8, -9, -11], max: [16, 7, -3], azimuth: -0.05 }
        : { min: [-11, -2, -13], max: [20, 8, -2], azimuth: -0.05 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: WOLSAN_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: WOLSAN_HEIGHT_GRIDS,
    buildingBase: WOLSAN_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: WOLSAN_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: WOLSAN_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Wolsan school ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: WOLSAN_PROTECTED }),
  hazardTape: Object.freeze({ footprints: WOLSAN_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: WOLSAN_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default WOLSAN;
