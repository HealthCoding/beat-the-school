import { WORLD_UNITS_PER_METER, GEO_ORIGIN, CHANGCHEON_PLACEMENTS, CHANGCHEON_BUILDING_BASE, CHANGCHEON_HEIGHT_GRIDS, CHANGCHEON_HEIGHT_RANGE_M, CHANGCHEON_ENV_IDS, CHANGCHEON_PROVENANCE } from './data.js';
import { CHANGCHEON_FOOTPRINTS } from './footprints.js';
import { CHANGCHEON_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(CHANGCHEON_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/changcheon/${f}`, import.meta.url).href;
export const CHANGCHEON = Object.freeze({
  id: 'changcheon',
  meta: Object.freeze({ school: '창천중학교', campus: '서울', short: '창천중', modelNoun: '창천중' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: CHANGCHEON_PLACEMENTS,
  approvedCount: CHANGCHEON_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'west-wing', 'gym-hall', 'north-west-wing', 'east-wing']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  view: Object.freeze({
    overviewAzimuth: 0.35,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-24, -10, -14], max: [26, 13, 12], azimuth: 0.32 }
        : { min: [-24, -3, -14], max: [26, 13, 12], azimuth: 0.36 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: CHANGCHEON_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: CHANGCHEON_HEIGHT_GRIDS,
    buildingBase: CHANGCHEON_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: CHANGCHEON_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: CHANGCHEON_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Changcheon school ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: CHANGCHEON_PROTECTED }),
  hazardTape: Object.freeze({ footprints: CHANGCHEON_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: CHANGCHEON_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default CHANGCHEON;
