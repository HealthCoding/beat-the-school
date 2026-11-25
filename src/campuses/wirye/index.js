import { WORLD_UNITS_PER_METER, GEO_ORIGIN, WIRYE_PLACEMENTS, WIRYE_BUILDING_BASE, WIRYE_HEIGHT_GRIDS, WIRYE_HEIGHT_RANGE_M, WIRYE_ENV_IDS, WIRYE_PROVENANCE } from './data.js';
import { WIRYE_FOOTPRINTS } from './footprints.js';
import { WIRYE_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(WIRYE_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/wirye/${f}`, import.meta.url).href;
export const WIRYE = Object.freeze({
  id: 'wirye',
  meta: Object.freeze({ school: '위례고등학교', campus: '하남', short: '위례고', modelNoun: '위례고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: WIRYE_PLACEMENTS,
  approvedCount: WIRYE_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main-west', 'entrance-core', 'main-east', 'gym']),
  startBuildingId: 'entrance-core',
  camera: Object.freeze({ overviewElevation: 48, playElevation: 24, tiltNear: 15 }),
  // Phone: south-east oblique over the field (west yellow end, core, canopy). PC: near-frontal like the official banner photo
  // (front normal az -0.62; yellow west end, central core, white-framed east wing, assembly canopy). Claude final review 10-27.
  view: Object.freeze({
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-16, -1, -12], max: [10, 8, 3], azimuth: 0.22 }
        : { min: [-22, -1, -17], max: [16, 9, 6], azimuth: -0.55 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: WIRYE_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: WIRYE_HEIGHT_GRIDS,
    buildingBase: WIRYE_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: WIRYE_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: WIRYE_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Wirye school ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: WIRYE_PROTECTED }),
  hazardTape: Object.freeze({ footprints: WIRYE_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: WIRYE_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default WIRYE;
