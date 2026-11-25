import { WORLD_UNITS_PER_METER, GEO_ORIGIN, YEONGJUGIRLS_PLACEMENTS, YEONGJUGIRLS_BUILDING_BASE, YEONGJUGIRLS_HEIGHT_GRIDS, YEONGJUGIRLS_HEIGHT_RANGE_M, YEONGJUGIRLS_ENV_IDS, YEONGJUGIRLS_PROVENANCE } from './data.js';
import { YEONGJUGIRLS_FOOTPRINTS } from './footprints.js';
import { YEONGJUGIRLS_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(YEONGJUGIRLS_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/yeongjugirls/${f}`, import.meta.url).href;
export const YEONGJUGIRLS = Object.freeze({
  id: 'yeongjugirls',
  meta: Object.freeze({ school: '영주여자중학교', campus: '영주', short: '영주여중', modelNoun: '영주여중', level: 'middle' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: YEONGJUGIRLS_PLACEMENTS,
  approvedCount: YEONGJUGIRLS_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'cheongaguan', 'rose-annex', 'guard']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 44, playElevation: 22, tiltNear: 15 }),
  view: Object.freeze({
    overviewAzimuth: -0.25,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-12, -14, -13], max: [12, -6, 7], azimuth: -0.7, elevationDegrees: 12 }
        : { min: [-30, 0, -25], max: [32, 9, 11], azimuth: -0.2, elevationDegrees: 22 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: YEONGJUGIRLS_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: YEONGJUGIRLS_HEIGHT_GRIDS,
    buildingBase: YEONGJUGIRLS_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: YEONGJUGIRLS_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: YEONGJUGIRLS_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Yeongju Girls Middle School ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: YEONGJUGIRLS_PROTECTED }),
  hazardTape: Object.freeze({ footprints: YEONGJUGIRLS_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: YEONGJUGIRLS_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default YEONGJUGIRLS;
