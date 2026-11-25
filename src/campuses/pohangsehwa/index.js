import { WORLD_UNITS_PER_METER, GEO_ORIGIN, POHANGSEHWA_PLACEMENTS, POHANGSEHWA_BUILDING_BASE, POHANGSEHWA_HEIGHT_GRIDS, POHANGSEHWA_HEIGHT_RANGE_M, POHANGSEHWA_ENV_IDS, POHANGSEHWA_PROVENANCE } from './data.js';
import { POHANGSEHWA_FOOTPRINTS } from './footprints.js';
import { POHANGSEHWA_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(POHANGSEHWA_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/pohangsehwa/${f}`, import.meta.url).href;
export const POHANGSEHWA = Object.freeze({
  id: 'pohangsehwa',
  meta: Object.freeze({ school: '포항세화고등학교', campus: '포항', short: '포항세화고', modelNoun: '포항세화고', level: 'high' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: POHANGSEHWA_PLACEMENTS,
  approvedCount: POHANGSEHWA_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'west-wing', 'east-wing', 'stand-podium', 'achigwan']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 44, playElevation: 22, tiltNear: 15 }),
  view: Object.freeze({
    overviewAzimuth: -0.22,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-18, -0.2, -34], max: [24, 10, -14], azimuth: -0.28 }
        : { min: [-23, -0.2, -34], max: [19, 10, -14], azimuth: -0.22 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: POHANGSEHWA_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: POHANGSEHWA_HEIGHT_GRIDS,
    buildingBase: POHANGSEHWA_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: POHANGSEHWA_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: POHANGSEHWA_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Pohang Sehwa High School ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: POHANGSEHWA_PROTECTED }),
  hazardTape: Object.freeze({ footprints: POHANGSEHWA_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: POHANGSEHWA_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default POHANGSEHWA;
