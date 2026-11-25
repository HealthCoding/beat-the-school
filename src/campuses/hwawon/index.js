import { WORLD_UNITS_PER_METER, GEO_ORIGIN, HWAWON_PLACEMENTS, HWAWON_BUILDING_BASE, HWAWON_HEIGHT_GRIDS, HWAWON_HEIGHT_RANGE_M, HWAWON_ENV_IDS, HWAWON_PROVENANCE } from './data.js';
import { HWAWON_FOOTPRINTS } from './footprints.js';
import { HWAWON_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(HWAWON_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/hwawon/${f}`, import.meta.url).href;
export const HWAWON = Object.freeze({
  id: 'hwawon',
  meta: Object.freeze({ school: '화원중학교', campus: '서울', short: '화원중', modelNoun: '화원중' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: HWAWON_PLACEMENTS,
  approvedCount: HWAWON_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'main-north', 'hwawon-hall', 'rear-wing']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Claude R3 10-29: 본관 field facade (glass stair tower, red fire-escape frames, blue clock) large from the sand field, 화원관's blue band
  // and lime frame at the right edge. Camera sits WSW of the bar (azimuth -1.35, just south of the facade normal -1.26) so the line of sight passes north of
  // Hwawon-gwan's big green roof (R3 first try -1.12 put that roof in the foreground: reports/2026-10-29_hwawon/final/ first run).
  // Codex Astra 1차 HW-01 (fix1): PC box lowered (min y -5) and turned to -1.42 so 본관 sits above the hint text; phone box shifted
  // ~6 m south and widened so the glass tower, clock and both red stairs sit left of the weapon bag (candidates: pilot/hwawon-seoul/review/fix1/start-cand*/).
  // Codex Astra 2차 HW-01 (fix2): phone box widened/shifted south so 본관's south end and 화원관's field face come into view (review/fix2/start-cand/c0).
  view: Object.freeze({
    overviewAzimuth: -1.0,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-8, -10, -16], max: [7, 10, 4], azimuth: -1.3 }
        : { min: [-8, -5, -24], max: [11, 10, 4], azimuth: -1.42 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: HWAWON_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: HWAWON_HEIGHT_GRIDS,
    buildingBase: HWAWON_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: HWAWON_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: HWAWON_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Hwawon school ground (hillside terraces), site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: HWAWON_PROTECTED }),
  hazardTape: Object.freeze({ footprints: HWAWON_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: HWAWON_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default HWAWON;
