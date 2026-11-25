import { WORLD_UNITS_PER_METER, GEO_ORIGIN, BUHEUNG_PLACEMENTS, BUHEUNG_BUILDING_BASE, BUHEUNG_HEIGHT_GRIDS, BUHEUNG_HEIGHT_RANGE_M, BUHEUNG_ENV_IDS, BUHEUNG_PROVENANCE } from './data.js';
import { BUHEUNG_FOOTPRINTS } from './footprints.js';
import { BUHEUNG_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(BUHEUNG_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/buheung/${f}`, import.meta.url).href;
export const BUHEUNG = Object.freeze({
  id: 'buheung',
  meta: Object.freeze({ school: '부흥고등학교', campus: '부산', short: '부흥고', modelNoun: '부흥고', level: 'high' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: BUHEUNG_PLACEMENTS,
  approvedCount: BUHEUNG_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'west-wing', 'science-wing', 'buheung-hall', 'cafeteria']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 44, playElevation: 32, tiltNear: 20 }),
  view: Object.freeze({
    overviewAzimuth: 0.15,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-28, -16, -13], max: [22, -4, 0], azimuth: -0.3, elevationDegrees: 32 }
        : { min: [-33, -4, -20], max: [20, 11, 11], azimuth: -0.25, elevationDegrees: 38 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: BUHEUNG_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: BUHEUNG_HEIGHT_GRIDS,
    buildingBase: BUHEUNG_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: BUHEUNG_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: BUHEUNG_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Busan Buheung High School ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: BUHEUNG_PROTECTED }),
  hazardTape: Object.freeze({ footprints: BUHEUNG_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: BUHEUNG_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default BUHEUNG;
