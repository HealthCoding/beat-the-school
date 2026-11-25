import { WORLD_UNITS_PER_METER, GEO_ORIGIN, DEUNGCHON_PLACEMENTS, DEUNGCHON_BUILDING_BASE, DEUNGCHON_HEIGHT_GRIDS, DEUNGCHON_HEIGHT_RANGE_M, DEUNGCHON_ENV_IDS, DEUNGCHON_PROVENANCE } from './data.js';
import { DEUNGCHON_FOOTPRINTS } from './footprints.js';
import { DEUNGCHON_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(DEUNGCHON_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/deungchon/${f}`, import.meta.url).href;
export const DEUNGCHON = Object.freeze({
  id: 'deungchon',
  meta: Object.freeze({ school: '등촌고등학교', campus: '서울', short: '등촌고', modelNoun: '등촌고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: DEUNGCHON_PLACEMENTS,
  approvedCount: DEUNGCHON_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['central', 'link-west', 'main', 'west-hall', 'gym']),
  startBuildingId: 'central',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Claude R3 10-27: start from the dirt field (SSW) so the 중앙동 front - peach entrance box with the clock, blue tile stair bay,
  // orange strip - fills the frame (official-main-front-banner-unknown). Candidates: reports/2026-10-27_deungchon/cand/.
  // 최종검수 10-27: phone box moved ~5 units along the facade (+0.88, 0, +0.47) and widened so the blue tile bay and orange strip sit left of
  // the weapon bag (x314+); candidates reports/2026-10-27_Claude_최종검수/deungchon/try390/ (2 adopted).
  view: Object.freeze({
    overviewAzimuth: -0.494,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [6.5, -2, -3.1], max: [20.3, 9, 4.85], azimuth: -0.5 }
        : { min: [4, -2, -8], max: [22, 9, 4], azimuth: -0.35 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: DEUNGCHON_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: DEUNGCHON_HEIGHT_GRIDS,
    buildingBase: DEUNGCHON_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: DEUNGCHON_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photographed facades (blogs, school banner), estimated heights, flat site, planting and context infill'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: DEUNGCHON_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Deungchon school ground, field, courtyard, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: DEUNGCHON_PROTECTED }),
  hazardTape: Object.freeze({ footprints: DEUNGCHON_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-90, 110, 70]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: DEUNGCHON_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default DEUNGCHON;
