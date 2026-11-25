import { WORLD_UNITS_PER_METER, GEO_ORIGIN, CHUNGWOON_PLACEMENTS, CHUNGWOON_BUILDING_BASE, CHUNGWOON_HEIGHT_GRIDS, CHUNGWOON_HEIGHT_RANGE_M, CHUNGWOON_ENV_IDS, CHUNGWOON_PROVENANCE } from './data.js';
import { CHUNGWOON_FOOTPRINTS } from './footprints.js';
import { CHUNGWOON_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(CHUNGWOON_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/chungwoon/${f}`, import.meta.url).href;
export const CHUNGWOON = Object.freeze({
  id: 'chungwoon',
  meta: Object.freeze({ school: '청운대학교', campus: '홍성', short: '청운대', modelNoun: '청운대' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: CHUNGWOON_PLACEMENTS,
  approvedCount: CHUNGWOON_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'sinae', 'huimang', 'susin', 'music']),
  startBuildingId: 'huimang',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  view: Object.freeze({
    overviewAzimuth: 0.45,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [15, 16, -22], max: [72, 46, 26], azimuth: 0.45 }
        : { min: [-10, 22, -45], max: [75, 48, 30], azimuth: 0.48 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: CHUNGWOON_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: CHUNGWOON_HEIGHT_GRIDS,
    buildingBase: CHUNGWOON_BUILDING_BASE,
    source: 'Sampled visible ground and under-building floor caps; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: CHUNGWOON_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: CHUNGWOON_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Chungwoon campus ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: CHUNGWOON_PROTECTED }),
  hazardTape: Object.freeze({ footprints: CHUNGWOON_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dfe6ea',
    fog: Object.freeze({ color: '#dfe6ea', near: 325, far: 950 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-130, 210, 170]), shadowSpan: 210 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: CHUNGWOON_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default CHUNGWOON;
