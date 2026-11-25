import { WORLD_UNITS_PER_METER, GEO_ORIGIN, SEOULARTS_PLACEMENTS, SEOULARTS_BUILDING_BASE, SEOULARTS_HEIGHT_GRIDS, SEOULARTS_HEIGHT_RANGE_M, SEOULARTS_ENV_IDS, SEOULARTS_PROVENANCE } from './data.js';
import { SEOULARTS_FOOTPRINTS } from './footprints.js';
import { SEOULARTS_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(SEOULARTS_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/seoularts/${f}`, import.meta.url).href;
export const SEOULARTS = Object.freeze({
  id: 'seoularts',
  meta: Object.freeze({ school: '서울미술고등학교', campus: '서울', short: '서울미술고', modelNoun: '서울미술고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: SEOULARTS_PLACEMENTS,
  approvedCount: SEOULARTS_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['jeongsu', 'finwing']),
  startBuildingId: 'jeongsu',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Both photographed facades frame the narrow court; adjusted on desktop and phone separately.
  view: Object.freeze({
    overviewAzimuth: -0.4,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-12, -22, -14], max: [24, 9, 22], azimuth: -1.6 }
        : { min: [-8, -1, -16], max: [20, 9, 16], azimuth: -1.6 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: SEOULARTS_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: SEOULARTS_HEIGHT_GRIDS,
    buildingBase: SEOULARTS_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: SEOULARTS_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: SEOULARTS_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Seoul Art High School ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: SEOULARTS_PROTECTED }),
  hazardTape: Object.freeze({ footprints: SEOULARTS_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: SEOULARTS_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default SEOULARTS;
