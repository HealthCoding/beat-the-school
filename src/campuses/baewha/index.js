import { WORLD_UNITS_PER_METER, GEO_ORIGIN, BAEWHA_PLACEMENTS, BAEWHA_BUILDING_BASE, BAEWHA_HEIGHT_GRIDS, BAEWHA_HEIGHT_RANGE_M, BAEWHA_ENV_IDS, BAEWHA_PROVENANCE } from './data.js';
import { BAEWHA_FOOTPRINTS } from './footprints.js';
import { BAEWHA_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(BAEWHA_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/baewha/${f}`, import.meta.url).href;
export const BAEWHA = Object.freeze({
  id: 'baewha',
  meta: Object.freeze({ school: '배화여자고등학교', campus: '서울', short: '배화여고', modelNoun: '배화여고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: BAEWHA_PLACEMENTS,
  approvedCount: BAEWHA_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['campbell','annex','carolina','dorm']),
  startBuildingId: 'campbell',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  view: Object.freeze({overviewAzimuth:.25,get startFrame(){return {min:[-24,-5,-1.5],max:[-1,1.7,13.6],azimuth:.25};}}),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: BAEWHA_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: BAEWHA_HEIGHT_GRIDS,
    buildingBase: BAEWHA_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: BAEWHA_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: BAEWHA_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Baewha Girls High School ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: BAEWHA_PROTECTED, ...(BAEWHA_PROTECTED.length ? {manifestURL: asset('protected/manifest.json')} : {}) }),
  hazardTape: Object.freeze({ footprints: BAEWHA_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 90, far: 210 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: BAEWHA_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default BAEWHA;
