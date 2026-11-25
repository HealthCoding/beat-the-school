import { WORLD_UNITS_PER_METER, GEO_ORIGIN, CHEONANDONG_PLACEMENTS, CHEONANDONG_BUILDING_BASE, CHEONANDONG_HEIGHT_GRIDS, CHEONANDONG_HEIGHT_RANGE_M, CHEONANDONG_ENV_IDS, CHEONANDONG_PROVENANCE } from './data.js';
import { CHEONANDONG_FOOTPRINTS } from './footprints.js';
import { CHEONANDONG_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(CHEONANDONG_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/cheonandong/${f}`, import.meta.url).href;
export const CHEONANDONG = Object.freeze({
  id: 'cheonandong',
  meta: Object.freeze({ school: '천안동중학교', campus: '천안', short: '천안동중', modelNoun: '천안동중' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: CHEONANDONG_PLACEMENTS,
  approvedCount: CHEONANDONG_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'gym', 'annex']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Start view chosen by simulating src/camera.js focus() for the real 390x844 / 1280x800 view (pilot/cheonandong-cheonan/review/frame-sim/search.mjs): the whole 88 m main building (PC: from the south road side, phone: from the south-east so the brick front, the name letters and the orange gym roof stay in frame) stays on screen,
  // the entrance clear of the weapon bag (phone x 314-390, y 363-440; PC x 1216-1280, y 345-420) and of the guide text. Box in world units (1 m = 0.5), azimuth 0 = from the south, +x = east.
  view: Object.freeze({
    overviewAzimuth: 2.5,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-10, -5.5, 1.9], max: [31.1, 6.6, 21.6], azimuth: 1.09, elevationDegrees: 49 }
        : { min: [-13.6, -2.4, 5.4], max: [17.8, 11.2, 20.6], azimuth: -0.04, elevationDegrees: 33 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: CHEONANDONG_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: CHEONANDONG_HEIGHT_GRIDS,
    buildingBase: CHEONANDONG_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: CHEONANDONG_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: CHEONANDONG_ENV_IDS,
      castShadow: Object.freeze([]),
      // context fade (pilot context.json display.fade): campus clear to near_m from its centre, the backdrop melts into the scene colour by far_m
      fade: Object.freeze({ centre_m: Object.freeze([0, 0]), near_m: 200, far_m: 400, linear: 0.8, colour: '#dce5ea' }),
      playMargin_m: 24,
      source: 'Exact Cheonan Dong school ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: CHEONANDONG_PROTECTED }),
  hazardTape: Object.freeze({ footprints: CHEONANDONG_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 500, far: 1400 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: CHEONANDONG_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default CHEONANDONG;
