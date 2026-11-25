import { WORLD_UNITS_PER_METER, GEO_ORIGIN, YEWON_PLACEMENTS, YEWON_BUILDING_BASE, YEWON_HEIGHT_GRIDS, YEWON_HEIGHT_RANGE_M, YEWON_ENV_IDS, YEWON_PROVENANCE } from './data.js';
import { YEWON_FOOTPRINTS } from './footprints.js';
import { YEWON_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(YEWON_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/yewon/${f}`, import.meta.url).href;
export const YEWON = Object.freeze({
  id: 'yewon',
  meta: Object.freeze({ school: '예원예술대학교', campus: '양주', short: '예원예대', modelNoun: '예원예대' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: YEWON_PLACEMENTS,
  approvedCount: YEWON_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['art-hall', 'main-east', 'main-north', 'yewon-hall', 'main-link']),
  startBuildingId: 'art-hall',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  view: Object.freeze({ overviewAzimuth: 1.0,
    startFrame: Object.freeze({ min: [20, -4, -22], max: [44, 8, 3], azimuth: 1.0 })
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: YEWON_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: YEWON_HEIGHT_GRIDS,
    buildingBase: YEWON_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: YEWON_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; school campus map and photographed facades, estimated heights, site levels, planting and house infill'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: YEWON_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Yewon school ground, courtyard, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: YEWON_PROTECTED }),
  hazardTape: Object.freeze({ footprints: YEWON_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([85, 105, 70]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: YEWON_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default YEWON;
