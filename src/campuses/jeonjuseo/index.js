import { WORLD_UNITS_PER_METER, GEO_ORIGIN, JEONJUSEO_PLACEMENTS, JEONJUSEO_BUILDING_BASE, JEONJUSEO_HEIGHT_GRIDS, JEONJUSEO_HEIGHT_RANGE_M, JEONJUSEO_ENV_IDS, JEONJUSEO_PROVENANCE } from './data.js';
import { JEONJUSEO_FOOTPRINTS } from './footprints.js';
import { JEONJUSEO_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(JEONJUSEO_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/jeonjuseo/${f}`, import.meta.url).href;
export const JEONJUSEO = Object.freeze({
  id: 'jeonjuseo',
  meta: Object.freeze({ school: '전주서중학교', campus: '전주', short: '전주서중', modelNoun: '전주서중' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: JEONJUSEO_PLACEMENTS,
  approvedCount: JEONJUSEO_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'west', 'mid', 'stand']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Start view: the blue-roof west building and the 5-floor block in front of the long main building, seen from the south across the sand field so the main building fills the width on PC; phone (review fix 2) looks down from the west-south-west at elevation 47 so the main roof fills the height, apartments leave the frame and the bag stays clear (review/frame-sim/search2.mjs). Values chosen by simulating src/camera.js focus() for the real 390x844 / 1280x800 view
  // (pilot/jeonjuseo-jeonju/review/frame-sim/): the main building and the entrance bay stay on screen, the entrance clear of the weapon bag
  // (phone x 314-390, y 363-440; PC x 1216-1280, y 345-420) and of the guide text. Box in world units (1 m = 0.5), azimuth 0 = from the south, +x = east.
  view: Object.freeze({
    overviewAzimuth: 2.5,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-11.9, -0.8, -28.6], max: [21.1, 11.3, -23.3], azimuth: -1.23, elevationDegrees: 47 }
        : { min: [4.3, -5.6, -31.5], max: [27.2, 8.5, -20.6], azimuth: 0.11, elevationDegrees: 34 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: JEONJUSEO_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: JEONJUSEO_HEIGHT_GRIDS,
    buildingBase: JEONJUSEO_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: JEONJUSEO_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: JEONJUSEO_ENV_IDS,
      castShadow: Object.freeze([]),
      // context fade (pilot context.json display.fade): campus clear to near_m from its centre, the backdrop melts into the scene colour by far_m
      fade: Object.freeze({ centre_m: Object.freeze([-10, -5]), near_m: 200, far_m: 400, linear: 0.8, colour: '#dce5ea' }),
      playMargin_m: 24,
      source: 'Exact Jeonju Seo school ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: JEONJUSEO_PROTECTED }),
  hazardTape: Object.freeze({ footprints: JEONJUSEO_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 500, far: 1400 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: JEONJUSEO_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default JEONJUSEO;
