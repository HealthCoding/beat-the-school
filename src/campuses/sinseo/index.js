import { WORLD_UNITS_PER_METER, GEO_ORIGIN, SINSEO_PLACEMENTS, SINSEO_BUILDING_BASE, SINSEO_HEIGHT_GRIDS, SINSEO_HEIGHT_RANGE_M, SINSEO_ENV_IDS, SINSEO_PROVENANCE } from './data.js';
import { SINSEO_FOOTPRINTS } from './footprints.js';
import { SINSEO_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(SINSEO_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/sinseo/${f}`, import.meta.url).href;
export const SINSEO = Object.freeze({
  id: 'sinseo',
  meta: Object.freeze({ school: '신서고등학교', campus: '서울', short: '신서고', modelNoun: '신서고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: SINSEO_PLACEMENTS,
  approvedCount: SINSEO_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'west-tower', 'drum', 'east-wing']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Start view = the official tour photo angle: from the dirt yard (west) toward the white glass stair tower, the brick tower with its
  // orange top panel, the orange-banded drum and the stepped stand. Box in world units, azimuth -π/2 = camera on the west side.
  view: Object.freeze({
    overviewAzimuth: -1.0,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-5, -8, -16], max: [22, 10, 2], azimuth: -1.0 }
        : { min: [-4, -1, -16], max: [14, 10, 4], azimuth: -1.2 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: SINSEO_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: SINSEO_HEIGHT_GRIDS,
    buildingBase: SINSEO_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: SINSEO_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: SINSEO_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Sinseo school ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: SINSEO_PROTECTED }),
  hazardTape: Object.freeze({ footprints: SINSEO_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: SINSEO_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default SINSEO;
