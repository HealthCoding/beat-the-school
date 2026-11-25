import { WORLD_UNITS_PER_METER, GEO_ORIGIN, SANGSIN_PLACEMENTS, SANGSIN_BUILDING_BASE, SANGSIN_HEIGHT_GRIDS, SANGSIN_HEIGHT_RANGE_M, SANGSIN_ENV_IDS, SANGSIN_PROVENANCE } from './data.js';
import { SANGSIN_FOOTPRINTS } from './footprints.js';
import { SANGSIN_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(SANGSIN_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/sangsin/${f}`, import.meta.url).href;
export const SANGSIN = Object.freeze({
  id: 'sangsin',
  meta: Object.freeze({ school: '상신중학교', campus: '서울', short: '상신중', modelNoun: '상신중' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: SANGSIN_PLACEMENTS,
  approvedCount: SANGSIN_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'annex']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Start view (focus() box from review/frame-sim/eval.mjs, then checked on the real page at 1280 and 390 — review/frame-sim/shots2): the front (north) side of the main block seen from the yard,
  // the three stair projections, the glazed entrance and the name tower on screen; phone (north-east oblique, whole block on screen, weapon bag x 314-390 / y 363-440 clear) differs from the PC frame.
  // Box in world units (1 m = 0.5), azimuth 0 = from the south, +x = east.
  view: Object.freeze({
    overviewAzimuth: 2.5,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [0.8, -0.3, 5.0], max: [24.9, 13.5, 14.3], azimuth: 2.17, elevationDegrees: 41 }
        : { min: [-20.0, -2.0, 13.0], max: [12.0, 9.6, 21.0], azimuth: 3.45, elevationDegrees: 26 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: SANGSIN_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: SANGSIN_HEIGHT_GRIDS,
    buildingBase: SANGSIN_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: SANGSIN_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; footprints from OSM, no exterior photo: facade, heights and planting estimated'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: SANGSIN_ENV_IDS,
      castShadow: Object.freeze([]),
      // context fade (pilot context.json display.fade): campus clear to near_m from its centre, the backdrop melts into the scene colour by far_m
      fade: Object.freeze({ centre_m: Object.freeze([0, 0]), near_m: 200, far_m: 400, linear: 0.8, colour: '#dce5ea' }),
      playMargin_m: 24,
      source: 'Exact Sangsin school ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: SANGSIN_PROTECTED }),
  hazardTape: Object.freeze({ footprints: SANGSIN_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 500, far: 1400 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: SANGSIN_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default SANGSIN;
