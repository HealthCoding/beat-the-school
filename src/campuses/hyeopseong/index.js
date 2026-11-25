import { WORLD_UNITS_PER_METER, GEO_ORIGIN, HYEOPSEONG_PLACEMENTS, HYEOPSEONG_BUILDING_BASE, HYEOPSEONG_HEIGHT_GRIDS, HYEOPSEONG_HEIGHT_RANGE_M, HYEOPSEONG_ENV_IDS, HYEOPSEONG_PROVENANCE } from './data.js';
import { HYEOPSEONG_FOOTPRINTS } from './footprints.js';
import { HYEOPSEONG_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(HYEOPSEONG_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/hyeopseong/${f}`, import.meta.url).href;
export const HYEOPSEONG = Object.freeze({
  id: 'hyeopseong',
  meta: Object.freeze({ school: '협성경복중학교', campus: '대구', short: '협성경복중', modelNoun: '협성경복중' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: HYEOPSEONG_PLACEMENTS,
  approvedCount: HYEOPSEONG_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'high', 'gym', 'dream']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Start view (review fix 4): the whole main building (103 m) with its navy entrance block, seen from the east-south-east along the courtyard's long axis
  // (the 협성고 roof is pushed to the edge instead of filling the lower half). Values chosen by simulating src/camera.js focus() for the real 390x844 / 1280x800
  // view (review/fix4/frame-sim/): every main corner and the entrance block on screen, entrance clear of the weapon bag (phone x 314-390, y 363-440; PC x 1216-1280,
  // y 345-420) and of the guide text. Box in world units (1 m = 0.5), azimuth 0 = from the south, +x = east.
  view: Object.freeze({
    overviewAzimuth: 2.5,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [3.8, -11.1, 6.7], max: [44.6, 18.3, 12.2], azimuth: 1.06, elevationDegrees: 33 }
        : { min: [-16.2, -1.3, 6.8], max: [14.9, 14.2, 19.2], azimuth: 1.21, elevationDegrees: 30 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: HYEOPSEONG_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: HYEOPSEONG_HEIGHT_GRIDS,
    buildingBase: HYEOPSEONG_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: HYEOPSEONG_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: HYEOPSEONG_ENV_IDS,
      castShadow: Object.freeze([]),
      // context fade (pilot context.json display.fade): campus clear to near_m from its centre, the backdrop melts into the scene colour by far_m
      fade: Object.freeze({ centre_m: Object.freeze([-45, 10]), near_m: 180, far_m: 380, linear: 0.8, colour: '#dce5ea' }),
      playMargin_m: 24,
      source: 'Exact Hyeopseong school ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: HYEOPSEONG_PROTECTED }),
  hazardTape: Object.freeze({ footprints: HYEOPSEONG_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 500, far: 1400 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: HYEOPSEONG_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default HYEOPSEONG;
