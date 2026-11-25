import { WORLD_UNITS_PER_METER, GEO_ORIGIN, IPSEOK_PLACEMENTS, IPSEOK_BUILDING_BASE, IPSEOK_HEIGHT_GRIDS, IPSEOK_HEIGHT_RANGE_M, IPSEOK_ENV_IDS, IPSEOK_PROVENANCE } from './data.js';
import { IPSEOK_FOOTPRINTS } from './footprints.js';
import { IPSEOK_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(IPSEOK_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/ipseok/${f}`, import.meta.url).href;
export const IPSEOK = Object.freeze({
  id: 'ipseok',
  meta: Object.freeze({ school: '입석중학교', campus: '대구', short: '입석중', modelNoun: '입석중' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: IPSEOK_PLACEMENTS,
  approvedCount: IPSEOK_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'east', 'eastend', 'hall']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Start view: the long classroom wing (107 m), the entry link with the sign band and the barrel-roofed end block seen from the yard's NW end, like the Commons
  // photo. Values come from simulating src/camera.js focus() for the real 390x844 / 1280x800 view (pilot/ipseok-daegu/review/frame-sim/): the whole L-shaped block on screen,
  // clear of the weapon bag (phone x 314-390, y 363-440; PC x 1216-1280, y 345-420) and of the guide text. Box in world units (1 m = 0.5), azimuth 0 = from the south, +x = east.
  view: Object.freeze({
    overviewAzimuth: 3.3,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-42.2, -1, -24.6], max: [14.9, 8, 9.3], azimuth: 3.4, elevationDegrees: 44 }
        : { min: [-31.2, -1, -15.6], max: [15.9, 8, 12.3], azimuth: 3.2, elevationDegrees: 38 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: IPSEOK_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: IPSEOK_HEIGHT_GRIDS,
    buildingBase: IPSEOK_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: IPSEOK_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: IPSEOK_ENV_IDS,
      castShadow: Object.freeze([]),
      // context fade (pilot context.json display.fade): campus clear to near_m from its centre, the backdrop melts into the scene colour by far_m
      fade: Object.freeze({ centre_m: Object.freeze([0, 0]), near_m: 180, far_m: 380, linear: 0.8, colour: '#dce5ea' }),
      playMargin_m: 24,
      source: 'Exact Hyeopseong school ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: IPSEOK_PROTECTED }),
  hazardTape: Object.freeze({ footprints: IPSEOK_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 500, far: 1400 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: IPSEOK_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default IPSEOK;
