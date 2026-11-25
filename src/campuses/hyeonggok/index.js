import { WORLD_UNITS_PER_METER, GEO_ORIGIN, HYEONGGOK_PLACEMENTS, HYEONGGOK_BUILDING_BASE, HYEONGGOK_HEIGHT_GRIDS, HYEONGGOK_HEIGHT_RANGE_M, HYEONGGOK_ENV_IDS, HYEONGGOK_PROVENANCE } from './data.js';
import { HYEONGGOK_FOOTPRINTS } from './footprints.js';
import { HYEONGGOK_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(HYEONGGOK_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/hyeonggok/${f}`, import.meta.url).href;
export const HYEONGGOK = Object.freeze({
  id: 'hyeonggok',
  meta: Object.freeze({ school: '형곡중학교', campus: '구미', short: '형곡중', modelNoun: '형곡중' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: HYEONGGOK_PLACEMENTS,
  approvedCount: HYEONGGOK_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'annex', 'gym-hall', 'guard']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 30, playElevation: 20, tiltNear: 14 }),
  view: Object.freeze({
    overviewAzimuth: 2.48,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-32, -1, -18], max: [8, 9, 24], azimuth: 2.52 }
        : { min: [-34, -1, -20], max: [10, 9, 26], azimuth: 2.48 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: HYEONGGOK_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: HYEONGGOK_HEIGHT_GRIDS,
    buildingBase: HYEONGGOK_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: HYEONGGOK_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: HYEONGGOK_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Gumi Hyeonggok Middle School ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: HYEONGGOK_PROTECTED }),
  hazardTape: Object.freeze({ footprints: HYEONGGOK_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: HYEONGGOK_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default HYEONGGOK;
