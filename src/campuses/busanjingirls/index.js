import { WORLD_UNITS_PER_METER, GEO_ORIGIN, BUSANJINGIRLS_PLACEMENTS, BUSANJINGIRLS_BUILDING_BASE, BUSANJINGIRLS_HEIGHT_GRIDS, BUSANJINGIRLS_HEIGHT_RANGE_M, BUSANJINGIRLS_ENV_IDS, BUSANJINGIRLS_PROVENANCE } from './data.js';
import { BUSANJINGIRLS_FOOTPRINTS } from './footprints.js';
import { BUSANJINGIRLS_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(BUSANJINGIRLS_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/busanjingirls/${f}`, import.meta.url).href;
export const BUSANJINGIRLS = Object.freeze({
  id: 'busanjingirls',
  meta: Object.freeze({ school: '부산진여자고등학교', campus: '부산', short: '부산진여고', modelNoun: '부산진여고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: BUSANJINGIRLS_PLACEMENTS,
  approvedCount: BUSANJINGIRLS_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'east-wing', 'science-wing', 'library-wing', 'gym-hall']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 44, playElevation: 22, tiltNear: 15 }),
  view: Object.freeze({
    overviewAzimuth: 3.02,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-12, -10, 4], max: [14, 8, 22], azimuth: 2.95 }
        : { min: [-24, -4, -24], max: [24, 10, 22], azimuth: 3.02 }; // 10-30: terraces above the centre hint (shoot start-1280-A)
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: BUSANJINGIRLS_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: BUSANJINGIRLS_HEIGHT_GRIDS,
    buildingBase: BUSANJINGIRLS_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: BUSANJINGIRLS_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: BUSANJINGIRLS_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Busanjin Girls High School ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: BUSANJINGIRLS_PROTECTED }),
  hazardTape: Object.freeze({ footprints: BUSANJINGIRLS_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: BUSANJINGIRLS_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default BUSANJINGIRLS;
