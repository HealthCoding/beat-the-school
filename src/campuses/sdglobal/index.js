import { WORLD_UNITS_PER_METER, GEO_ORIGIN, SDGLOBAL_PLACEMENTS, SDGLOBAL_BUILDING_BASE, SDGLOBAL_HEIGHT_GRIDS, SDGLOBAL_HEIGHT_RANGE_M, SDGLOBAL_ENV_IDS, SDGLOBAL_PROVENANCE } from './data.js';
import { SDGLOBAL_FOOTPRINTS } from './footprints.js';
import { SDGLOBAL_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(SDGLOBAL_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/sdglobal/${f}`, import.meta.url).href;
export const SDGLOBAL = Object.freeze({
  id: 'sdglobal',
  meta: Object.freeze({ school: '성동글로벌경영고등학교', campus: '서울', short: '성동글로벌경영고', modelNoun: '성동글로벌경영고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: SDGLOBAL_PLACEMENTS,
  approvedCount: SDGLOBAL_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'main-east', 'court-wing', 'west']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Start view = the field angle of the official VR tour (r12 운동장, sky_37058): from the dirt field toward 본관's 5-storey concrete
  // frame facade with the dark centre crown, the yellow east end and the teal arcade; 서관 on the left.
  // Box in world units (1 m = 0.5), azimuth 0 = camera on the south side, -π/2 = west.
  view: Object.freeze({
    overviewAzimuth: 0.5,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        // phone: box reaches below the ground so 본관 sits above the weapon-bag button row (x 314-390, y 363-440).
        // Final review 10-27: azimuth 0.15 -> 0.35 so the SW 9-storey brick context tower no longer covers 본관's west end
        // (reports/2026-10-27_Claude_최종검수/sdglobal/phone-frame-sheet.jpg, candidate 3).
        ? { min: [-22, -20, -21], max: [2, 9, -14], azimuth: 0.35 }
        : { min: [-34, -1, -21], max: [6, 9, -10], azimuth: 0.5 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: SDGLOBAL_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: SDGLOBAL_HEIGHT_GRIDS,
    buildingBase: SDGLOBAL_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: SDGLOBAL_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: SDGLOBAL_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Seongdong Global Business HS ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: SDGLOBAL_PROTECTED }),
  hazardTape: Object.freeze({ footprints: SDGLOBAL_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: SDGLOBAL_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default SDGLOBAL;
