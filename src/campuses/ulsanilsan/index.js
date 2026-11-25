import { WORLD_UNITS_PER_METER, GEO_ORIGIN, ULSANILSAN_PLACEMENTS, ULSANILSAN_BUILDING_BASE, ULSANILSAN_HEIGHT_GRIDS, ULSANILSAN_HEIGHT_RANGE_M, ULSANILSAN_ENV_IDS, ULSANILSAN_PROVENANCE } from './data.js';
import { ULSANILSAN_FOOTPRINTS } from './footprints.js';
import { ULSANILSAN_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(ULSANILSAN_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/ulsanilsan/${f}`, import.meta.url).href;
export const ULSANILSAN = Object.freeze({
  id: 'ulsanilsan',
  meta: Object.freeze({ school: '일산중학교', campus: '울산', short: '울산일산중', modelNoun: '일산중', level: 'middle' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: ULSANILSAN_PLACEMENTS,
  approvedCount: ULSANILSAN_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'west-wing', 'east-wing', 'naraemoe-gym', 'cafeteria-wing']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 44, playElevation: 22, tiltNear: 15 }),
  view: Object.freeze({
    overviewAzimuth: -0.25,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-10, -12, -22], max: [10, -3, -16], azimuth: 0.35, elevationDegrees: 20 }
        : { min: [-24, -6, -25], max: [23, 4, -8], azimuth: 0.2, elevationDegrees: 15 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: ULSANILSAN_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: ULSANILSAN_HEIGHT_GRIDS,
    buildingBase: ULSANILSAN_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: ULSANILSAN_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: ULSANILSAN_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Ulsan Ilsan Middle School ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: ULSANILSAN_PROTECTED }),
  hazardTape: Object.freeze({ footprints: ULSANILSAN_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 55, far: 230 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: ULSANILSAN_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default ULSANILSAN;
