import { WORLD_UNITS_PER_METER, GEO_ORIGIN, POSCOHIGH_PLACEMENTS, POSCOHIGH_BUILDING_BASE, POSCOHIGH_HEIGHT_GRIDS, POSCOHIGH_HEIGHT_RANGE_M, POSCOHIGH_ENV_IDS, POSCOHIGH_PROVENANCE } from './data.js';
import { POSCOHIGH_FOOTPRINTS } from './footprints.js';
import { POSCOHIGH_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(POSCOHIGH_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/poscohigh/${f}`, import.meta.url).href;
export const POSCOHIGH = Object.freeze({
  id: 'poscohigh',
  meta: Object.freeze({ school: '포항제철고등학교', campus: '포항', short: '포항제철고', modelNoun: '포항제철고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: POSCOHIGH_PLACEMENTS,
  approvedCount: POSCOHIGH_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'grade1', 'grade2', 'special3', 'yeonhak']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Claude 10-27: 본관동 centre gable (clock band, pilotis, grand stair) seen from the field side; the front normal is world
  // azimuth -1.19 (school frame rotated -68 deg). Boxes in world units (0.5 per metre), the 본관 pad is +4 m.
  view: Object.freeze({
    overviewAzimuth: -1.19,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-14, -6, 2], max: [1, 9, 18], azimuth: -1.19 }
        : { min: [-19, 1, 0], max: [4, 9, 22], azimuth: -1.19 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: POSCOHIGH_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: POSCOHIGH_HEIGHT_GRIDS,
    buildingBase: POSCOHIGH_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: POSCOHIGH_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: POSCOHIGH_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Pohang Jecheol HS terraced school ground, site, planting, wooded hills and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: POSCOHIGH_PROTECTED }),
  hazardTape: Object.freeze({ footprints: POSCOHIGH_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: POSCOHIGH_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default POSCOHIGH;
