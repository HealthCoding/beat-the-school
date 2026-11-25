import { WORLD_UNITS_PER_METER, GEO_ORIGIN, KOYANG_PLACEMENTS, KOYANG_BUILDING_BASE, KOYANG_HEIGHT_GRIDS, KOYANG_HEIGHT_RANGE_M, KOYANG_ENV_IDS, KOYANG_PROVENANCE } from './data.js';
import { KOYANG_FOOTPRINTS } from './footprints.js';
import { KOYANG_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(KOYANG_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/koyang/${f}`, import.meta.url).href;
export const KOYANG = Object.freeze({
  id: 'koyang',
  meta: Object.freeze({ school: '고양고등학교', campus: '고양', short: '고양고', modelNoun: '고양고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: KOYANG_PLACEMENTS,
  approvedCount: KOYANG_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'hall', 'gym', 'electric', 'food']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  view: Object.freeze({
    overviewAzimuth: 0.36,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-78, -8, -48], max: [42, 12, 58], azimuth: 0.36 }
        : { min: [-84, -2, -52], max: [46, 12, 62], azimuth: 0.38 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: KOYANG_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: KOYANG_HEIGHT_GRIDS,
    buildingBase: KOYANG_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: KOYANG_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: KOYANG_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 28,
      source: 'Exact Koyang High School ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: KOYANG_PROTECTED }),
  hazardTape: Object.freeze({ footprints: KOYANG_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 200, far: 560 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-75, 115, 95]), shadowSpan: 180 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: KOYANG_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default KOYANG;
