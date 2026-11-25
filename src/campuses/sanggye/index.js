import { WORLD_UNITS_PER_METER, GEO_ORIGIN, SANGGYE_PLACEMENTS, SANGGYE_BUILDING_BASE, SANGGYE_HEIGHT_GRIDS, SANGGYE_HEIGHT_RANGE_M, SANGGYE_ENV_IDS, SANGGYE_PROVENANCE } from './data.js';
import { SANGGYE_FOOTPRINTS } from './footprints.js';
import { SANGGYE_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(SANGGYE_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/sanggye/${f}`, import.meta.url).href;
export const SANGGYE = Object.freeze({
  id: 'sanggye',
  meta: Object.freeze({ school: '상계고등학교', campus: '서울', short: '상계고', modelNoun: '상계고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: SANGGYE_PLACEMENTS,
  approvedCount: SANGGYE_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main', 'cheongyeoul', 'north-wing', 'east-wing']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Start view = the field photo angle (namu-overview-2023, blog-rocketry-2026-field): from the dirt field south-east of 본관 toward its
  // brick south face with the grey parapet, the central porch and the red-brick stand with shade canopies; 청여울관 on the left.
  // Box in world units (1 m = 0.5), azimuth 0 = camera on the south side, -π/2 = west.
  view: Object.freeze({
    overviewAzimuth: 0.35,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        // phone: box pulled ~12 m north (final review 10-27) so 본관's east end sits below the weapon-bag button and less bare field shows
        ? { min: [-14, -2, -22], max: [6, 9, -4], azimuth: 0.35 }
        : { min: [-14, -1, -10], max: [8, 9, -2], azimuth: 0.35 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: SANGGYE_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: SANGGYE_HEIGHT_GRIDS,
    buildingBase: SANGGYE_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: SANGGYE_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: SANGGYE_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Sanggye school ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: SANGGYE_PROTECTED }),
  hazardTape: Object.freeze({ footprints: SANGGYE_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: SANGGYE_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default SANGGYE;
