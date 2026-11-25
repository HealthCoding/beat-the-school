import { WORLD_UNITS_PER_METER, GEO_ORIGIN, INCHEONIEUM_PLACEMENTS, INCHEONIEUM_BUILDING_BASE, INCHEONIEUM_HEIGHT_GRIDS, INCHEONIEUM_HEIGHT_RANGE_M, INCHEONIEUM_ENV_IDS, INCHEONIEUM_PROVENANCE } from './data.js';
import { INCHEONIEUM_FOOTPRINTS } from './footprints.js';
import { INCHEONIEUM_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(INCHEONIEUM_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/incheonieum/${f}`, import.meta.url).href;
export const INCHEONIEUM = Object.freeze({
  id: 'incheonieum',
  meta: Object.freeze({ school: '인천이음고등학교', campus: '인천', short: '인천이음고', modelNoun: '인천이음고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: INCHEONIEUM_PLACEMENTS,
  approvedCount: INCHEONIEUM_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main-west', 'central-hub', 'main-east', 'gym-hall', 'north-wing']),
  startBuildingId: 'central-hub',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  view: Object.freeze({
    overviewAzimuth: 0.45,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-26, -8, -16], max: [16, 12, 12], azimuth: 0.45 }
        : { min: [-28, -2, -18], max: [18, 12, 14], azimuth: 0.48 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: INCHEONIEUM_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: INCHEONIEUM_HEIGHT_GRIDS,
    buildingBase: INCHEONIEUM_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: INCHEONIEUM_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: INCHEONIEUM_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Incheon Ieum school ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: INCHEONIEUM_PROTECTED }),
  hazardTape: Object.freeze({ footprints: INCHEONIEUM_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: INCHEONIEUM_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default INCHEONIEUM;
