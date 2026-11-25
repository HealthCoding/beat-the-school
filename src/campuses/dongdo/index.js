import { WORLD_UNITS_PER_METER, GEO_ORIGIN, DONGDO_PLACEMENTS, DONGDO_BUILDING_BASE, DONGDO_HEIGHT_GRIDS, DONGDO_HEIGHT_RANGE_M, DONGDO_ENV_IDS, DONGDO_PROVENANCE } from './data.js';
import { DONGDO_FOOTPRINTS } from './footprints.js';
import { DONGDO_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(DONGDO_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/dongdo/${f}`, import.meta.url).href;
export const DONGDO = Object.freeze({
  id: 'dongdo',
  meta: Object.freeze({ school: '동도중학교', campus: '서울', short: '동도중', modelNoun: '동도중', level: 'middle' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: DONGDO_PLACEMENTS,
  approvedCount: DONGDO_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['gugwan', 'bongwan', 'junganggwan', 'songsangwan', 'donggwan']),
  startBuildingId: 'junganggwan',
  camera: Object.freeze({ overviewElevation: 44, playElevation: 22, tiltNear: 15 }),
  view: Object.freeze({
    overviewAzimuth: -0.25,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-34, -8, -34], max: [42, 10, 18], azimuth: -0.32 }
        : { min: [-36, -4, -36], max: [46, 10, 26], azimuth: -0.25 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: DONGDO_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: DONGDO_HEIGHT_GRIDS,
    buildingBase: DONGDO_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: DONGDO_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: DONGDO_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Dongdo Middle School ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: DONGDO_PROTECTED }),
  hazardTape: Object.freeze({ footprints: DONGDO_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: DONGDO_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default DONGDO;
