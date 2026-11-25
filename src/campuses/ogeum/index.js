import { WORLD_UNITS_PER_METER, GEO_ORIGIN, OGEUM_PLACEMENTS, OGEUM_BUILDING_BASE, OGEUM_HEIGHT_GRIDS, OGEUM_HEIGHT_RANGE_M, OGEUM_ENV_IDS, OGEUM_PROVENANCE } from './data.js';
import { OGEUM_FOOTPRINTS } from './footprints.js';
import { OGEUM_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(OGEUM_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/ogeum/${f}`, import.meta.url).href;
export const OGEUM = Object.freeze({
  id: 'ogeum',
  meta: Object.freeze({ school: '오금고등학교', campus: '서울', short: '오금고', modelNoun: '오금고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: OGEUM_PLACEMENTS,
  approvedCount: OGEUM_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'rear', 'hall', 'walkway']),
  startBuildingId: 'main',
  // From the field toward the brick main facade (walkway and stands in front, green 복합정보센터 on the left), as in the
  // localnaeil-2021-front / official-main photos. Claude final review 10-27: the old azimuth 0.52 looked at the east end and
  // the courtyard; the phone frame is tighter so the facade fills the screen above the gesture hint (candidates in
  // reports/2026-10-27_Claude_최종검수/ogeum/).
  view: Object.freeze({
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-8, 0, -14], max: [10, 9, 0], azimuth: -0.4 }
        : { min: [-16, -1, -22], max: [24, 8, 4], azimuth: -0.25 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: OGEUM_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: OGEUM_HEIGHT_GRIDS,
    buildingBase: OGEUM_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: OGEUM_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: OGEUM_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Ogeum school ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: OGEUM_PROTECTED }),
  hazardTape: Object.freeze({ footprints: OGEUM_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: OGEUM_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default OGEUM;
