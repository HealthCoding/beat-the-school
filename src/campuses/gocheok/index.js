import { WORLD_UNITS_PER_METER, GEO_ORIGIN, GOCHEOK_PLACEMENTS, GOCHEOK_BUILDING_BASE, GOCHEOK_HEIGHT_GRIDS, GOCHEOK_HEIGHT_RANGE_M, GOCHEOK_ENV_IDS, GOCHEOK_PROVENANCE } from './data.js';
import { GOCHEOK_FOOTPRINTS } from './footprints.js';
import { GOCHEOK_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(GOCHEOK_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/gocheok/${f}`, import.meta.url).href;
export const GOCHEOK = Object.freeze({
  id: 'gocheok',
  meta: Object.freeze({ school: '고척중학교', campus: '서울', short: '고척중', modelNoun: '고척중' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: GOCHEOK_PLACEMENTS,
  approvedCount: GOCHEOK_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'neulbom-hall', 'library-wing', 'science-wing', 'north-wing']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Claude R3 10-27: main south face (yellow stair bay, navy canopy, clock, east yellow frame) large from the field side.
  // The 12-storey apartment block south-east of the field blocks any camera from the south-east (azimuth > ~0.2), so PC looks
  // almost due north and the phone from the south-west; the phone box sinks below ground (y -10) to lift the school above the
  // hint text. Candidates compared: reports/2026-10-27_고척중_R3/cand/, cand2/ (PC cand2 c0, phone cand2 c10).
  view: Object.freeze({
    overviewAzimuth: -0.1,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [6, -10, -6], max: [34, 8, 4], azimuth: -0.6 }
        : { min: [-4, -3, -6], max: [36, 8, 6], azimuth: -0.1 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: GOCHEOK_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: GOCHEOK_HEIGHT_GRIDS,
    buildingBase: GOCHEOK_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: GOCHEOK_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: GOCHEOK_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Gocheok school ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: GOCHEOK_PROTECTED }),
  hazardTape: Object.freeze({ footprints: GOCHEOK_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: GOCHEOK_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default GOCHEOK;
