import { WORLD_UNITS_PER_METER, GEO_ORIGIN, SUNJU_PLACEMENTS, SUNJU_BUILDING_BASE, SUNJU_HEIGHT_GRIDS, SUNJU_HEIGHT_RANGE_M, SUNJU_ENV_IDS, SUNJU_PROVENANCE } from './data.js';
import { SUNJU_FOOTPRINTS } from './footprints.js';
import { SUNJU_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(SUNJU_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/sunju/${f}`, import.meta.url).href;
export const SUNJU = Object.freeze({
  id: 'sunju',
  meta: Object.freeze({ school: '선주고등학교', campus: '구미', short: '선주고', modelNoun: '선주고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: SUNJU_PLACEMENTS,
  approvedCount: SUNJU_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'west-wing', 'mid-wing', 'gym']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Start view = the official main photo angle: from the dirt playground (south-west) toward the main block front — orange brick end blocks,
  // two white half-round stair bays, the maroon tower with teal glass, the stands with teal canopies and the arch stage.
  // Box in world units (1 m = 0.5), azimuth -0.8 = camera square to the south-west facade. Phone: turned to -0.95 so the 95 m front recedes and
  // the west brick end, both half-round stair bays and the tower sit left of the weapon bag (x 314+); only the east brick end goes under it (final review 10-27, 10 candidates).
  view: Object.freeze({
    overviewAzimuth: -0.8,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-9, -1, -6], max: [15, 9, 16], azimuth: -0.95 }
        : { min: [-4, -1, -12], max: [16, 9, 12], azimuth: -0.7 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: SUNJU_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: SUNJU_HEIGHT_GRIDS,
    buildingBase: SUNJU_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: SUNJU_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: SUNJU_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Sunju school ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: SUNJU_PROTECTED }),
  hazardTape: Object.freeze({ footprints: SUNJU_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: SUNJU_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default SUNJU;
