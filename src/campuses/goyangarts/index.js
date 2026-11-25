import { WORLD_UNITS_PER_METER, GEO_ORIGIN, GOYANGARTS_PLACEMENTS, GOYANGARTS_BUILDING_BASE, GOYANGARTS_HEIGHT_GRIDS, GOYANGARTS_HEIGHT_RANGE_M, GOYANGARTS_ENV_IDS, GOYANGARTS_PROVENANCE } from './data.js';
import { GOYANGARTS_FOOTPRINTS } from './footprints.js';
import { GOYANGARTS_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(GOYANGARTS_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/goyangarts/${f}`, import.meta.url).href;
export const GOYANGARTS = Object.freeze({
  id: 'goyangarts',
  meta: Object.freeze({ school: '고양예술고등학교', campus: '고양', short: '고양예술고', modelNoun: '고양예술고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: GOYANGARTS_PLACEMENTS,
  approvedCount: GOYANGARTS_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'east', 'gibong', 'theatre', 'yunsong', 'sculpture-mac']),
  startBuildingId: 'gibong',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  view: Object.freeze({
    overviewAzimuth: 0.45,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-26, -8, -42], max: [22, 14, 48], azimuth: 0.45 }
        : { min: [-30, -2, -46], max: [24, 14, 52], azimuth: 0.48 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: GOYANGARTS_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: GOYANGARTS_HEIGHT_GRIDS,
    buildingBase: GOYANGARTS_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: GOYANGARTS_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: GOYANGARTS_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Goyang High School of Arts ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: GOYANGARTS_PROTECTED }),
  hazardTape: Object.freeze({ footprints: GOYANGARTS_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: GOYANGARTS_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default GOYANGARTS;
