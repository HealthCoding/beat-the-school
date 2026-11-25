import { WORLD_UNITS_PER_METER, GEO_ORIGIN, CHEONGJUHITECH_PLACEMENTS, CHEONGJUHITECH_BUILDING_BASE, CHEONGJUHITECH_HEIGHT_GRIDS, CHEONGJUHITECH_HEIGHT_RANGE_M, CHEONGJUHITECH_ENV_IDS, CHEONGJUHITECH_PROVENANCE } from './data.js';
import { CHEONGJUHITECH_FOOTPRINTS } from './footprints.js';
import { CHEONGJUHITECH_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(CHEONGJUHITECH_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/cheongjuhitech/${f}`, import.meta.url).href;
export const CHEONGJUHITECH = Object.freeze({
  id: 'cheongjuhitech',
  meta: Object.freeze({ school: '청주하이텍고등학교', campus: '청주', short: '청주하이텍고', modelNoun: '청주하이텍고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: CHEONGJUHITECH_PLACEMENTS,
  approvedCount: CHEONGJUHITECH_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'practice', 'dowoom']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 30, playElevation: 20, tiltNear: 14 }),
  view: Object.freeze({
    overviewAzimuth: 0.08,
    // 2026-10-30: 본관 정면(교명 글자)을 주인공으로 — 거의 정남쪽에서, 아래쪽은 운동장(안내문 자리), 왼쪽에 융합실습실·도움반.
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-6, 0, -26], max: [27, 10.5, -4], azimuth: -0.04 }
        : { min: [-11, 0, -27], max: [26, 10.5, 6], azimuth: -0.06 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: CHEONGJUHITECH_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: CHEONGJUHITECH_HEIGHT_GRIDS,
    buildingBase: CHEONGJUHITECH_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: CHEONGJUHITECH_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: CHEONGJUHITECH_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Cheongju Hitech school ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: CHEONGJUHITECH_PROTECTED }),
  hazardTape: Object.freeze({ footprints: CHEONGJUHITECH_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: CHEONGJUHITECH_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default CHEONGJUHITECH;
