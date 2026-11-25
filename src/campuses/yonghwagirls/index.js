import { WORLD_UNITS_PER_METER, GEO_ORIGIN, YONGHWAGIRLS_PLACEMENTS, YONGHWAGIRLS_BUILDING_BASE, YONGHWAGIRLS_HEIGHT_GRIDS, YONGHWAGIRLS_HEIGHT_RANGE_M, YONGHWAGIRLS_ENV_IDS, YONGHWAGIRLS_PROVENANCE } from './data.js';
import { YONGHWAGIRLS_FOOTPRINTS } from './footprints.js';
import { YONGHWAGIRLS_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(YONGHWAGIRLS_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/yonghwagirls/${f}`, import.meta.url).href;
export const YONGHWAGIRLS = Object.freeze({
  id: 'yonghwagirls',
  meta: Object.freeze({ school: '용화여자고등학교', campus: '서울', short: '용화여고', modelNoun: '용화여고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: YONGHWAGIRLS_PLACEMENTS,
  approvedCount: YONGHWAGIRLS_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'main-east', 'jiphyeon', 'bonggok', 'guyong']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 44, playElevation: 26, tiltNear: 16 }),
  view: Object.freeze({
    overviewAzimuth: -0.65,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-15, -4, -9], max: [16, 8, 20], azimuth: -0.60 }
        : { min: [-18, -3, -10], max: [20, 9, 22], azimuth: -0.65 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: YONGHWAGIRLS_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: YONGHWAGIRLS_HEIGHT_GRIDS,
    buildingBase: YONGHWAGIRLS_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: YONGHWAGIRLS_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: YONGHWAGIRLS_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Yonghwa Girls High School ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: YONGHWAGIRLS_PROTECTED }),
  hazardTape: Object.freeze({ footprints: YONGHWAGIRLS_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: YONGHWAGIRLS_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default YONGHWAGIRLS;
