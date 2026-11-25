import { WORLD_UNITS_PER_METER, GEO_ORIGIN, SONGJEONGGIRLS_PLACEMENTS, SONGJEONGGIRLS_BUILDING_BASE, SONGJEONGGIRLS_HEIGHT_GRIDS, SONGJEONGGIRLS_HEIGHT_RANGE_M, SONGJEONGGIRLS_ENV_IDS, SONGJEONGGIRLS_PROVENANCE } from './data.js';
import { SONGJEONGGIRLS_FOOTPRINTS } from './footprints.js';
import { SONGJEONGGIRLS_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(SONGJEONGGIRLS_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/songjeonggirls/${f}`, import.meta.url).href;
export const SONGJEONGGIRLS = Object.freeze({
  id: 'songjeonggirls',
  meta: Object.freeze({ school: '송정여자중학교', campus: '구미', short: '송정여중', modelNoun: '송정여중' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: SONGJEONGGIRLS_PLACEMENTS,
  approvedCount: SONGJEONGGIRLS_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'west']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Start view: frame box (world units, 1 m = 0.5) chosen with review/frame-sim (camera.js focus() in node): the long four-floor block with its entrance at the east end seen from the field, clear of the weapon bag (x 314-390, y 363-440) and the guide text; phone differs from PC.
  // Box in world units, azimuth 0 = from the south, +x = east.
  view: Object.freeze({
    overviewAzimuth: 0.3,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [17.2, -1.3, -13.5], max: [41.3, 3.0, 1.3], azimuth: 0.82, elevationDegrees: 24 }
        : { min: [17.8, -0.3, -12.3], max: [34.5, 5.1, 3.0], azimuth: 0.07, elevationDegrees: 33 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: SONGJEONGGIRLS_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: SONGJEONGGIRLS_HEIGHT_GRIDS,
    buildingBase: SONGJEONGGIRLS_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: SONGJEONGGIRLS_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors (school boundary, roads); building outlines traced from aerial imagery, one 2009 field photo for facades: heights and planting estimated'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: SONGJEONGGIRLS_ENV_IDS,
      castShadow: Object.freeze([]),
      // context fade (pilot context.json display.fade): campus clear to near_m from its centre, the backdrop melts into the scene colour by far_m
      fade: Object.freeze({ centre_m: Object.freeze([0, 0]), near_m: 200, far_m: 400, linear: 0.8, colour: '#dce5ea' }),
      playMargin_m: 24,
      source: 'Exact Sangsin school ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: SONGJEONGGIRLS_PROTECTED }),
  hazardTape: Object.freeze({ footprints: SONGJEONGGIRLS_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 500, far: 1400 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: SONGJEONGGIRLS_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default SONGJEONGGIRLS;
