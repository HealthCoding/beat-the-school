import { WORLD_UNITS_PER_METER, GEO_ORIGIN, JANGYU_PLACEMENTS, JANGYU_BUILDING_BASE, JANGYU_HEIGHT_GRIDS, JANGYU_HEIGHT_RANGE_M, JANGYU_ENV_IDS, JANGYU_PROVENANCE } from './data.js';
import { JANGYU_FOOTPRINTS } from './footprints.js';
import { JANGYU_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(JANGYU_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/jangyu/${f}`, import.meta.url).href;
export const JANGYU = Object.freeze({
  id: 'jangyu',
  meta: Object.freeze({ school: '장유중학교', campus: '김해', short: '장유중', modelNoun: '장유중' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: JANGYU_PLACEMENTS,
  approvedCount: JANGYU_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main-long', 'new-wing', 'special-wing', 'gym', 'history']),
  startBuildingId: 'main-long',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Front view toward main-long like photo official2026-630: glass entry bay and red-white walkway, special-wing in front.
  // Claude final review 10-27: phone box sinks below ground (y -16) so the school sits higher and less empty terrain shows;
  // previous values were phone { min: [-6, -1.5, 16], max: [24, 7, 38], azimuth: 2.48 }, PC { min: [-8, -1.5, 14], max: [25, 7, 39], azimuth: 2.50 }.
  view: Object.freeze({
    overviewAzimuth: 2.50,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-6, -16, 22], max: [18, 8, 40], azimuth: 2.15 }
        : { min: [-14, -1.5, 22], max: [20, 8, 42], azimuth: 2.0 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: JANGYU_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: JANGYU_HEIGHT_GRIDS,
    buildingBase: JANGYU_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: JANGYU_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: JANGYU_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Jangyu school ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: JANGYU_PROTECTED }),
  hazardTape: Object.freeze({ footprints: JANGYU_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: JANGYU_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default JANGYU;
