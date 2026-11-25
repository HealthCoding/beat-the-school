import { WORLD_UNITS_PER_METER, GEO_ORIGIN, SUNHWAARTS_PLACEMENTS, SUNHWAARTS_BUILDING_BASE, SUNHWAARTS_HEIGHT_GRIDS, SUNHWAARTS_HEIGHT_RANGE_M, SUNHWAARTS_ENV_IDS, SUNHWAARTS_PROVENANCE } from './data.js';
import { SUNHWAARTS_FOOTPRINTS } from './footprints.js';
import { SUNHWAARTS_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(SUNHWAARTS_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/sunhwaarts/${f}`, import.meta.url).href;
export const SUNHWAARTS = Object.freeze({
  id: 'sunhwaarts',
  meta: Object.freeze({ school: '선화예술고등학교', campus: '서울', short: '선화예고', modelNoun: '선화예고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: SUNHWAARTS_PLACEMENTS,
  approvedCount: SUNHWAARTS_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['classroom', 'main-arts', 'uac', 'dining']),
  startBuildingId: 'classroom',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Claude Opus R3 10-30: start frame chosen with src/camera.js focus() simulation (pilot/sunhwaarts-seoul/review/frame-sim/);
  // fix2 (경복초 removed): re-searched - phone 교사동 14 % of the screen, PC 10 %, weapon bag / hint overlap 0 (frame-sim/phone-fix2.txt, pc-fix2.txt).
  view: Object.freeze({
    overviewAzimuth: -1.0,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-25.4, -2, -0.6], max: [2.2, 9.1, 20.8], azimuth: -2.0, elevationDegrees: 30 }
        : { min: [-29.7, -2, -7.9], max: [9.9, 8.4, 12.7], azimuth: -1.87, elevationDegrees: 23 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: SUNHWAARTS_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: SUNHWAARTS_HEIGHT_GRIDS,
    buildingBase: SUNHWAARTS_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: SUNHWAARTS_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; official CG campus map based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: SUNHWAARTS_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Sunhwa Arts school ground (upper terrace + stepped plaza), site, planting and surrounding buildings'
    })
  }),
  // 선화유치원 (OSM building=kindergarten inside the school area): never destructible, shield reaction; own protected manifest.
  protected: Object.freeze({
    ...(SUNHWAARTS_PROTECTED.length ? { manifestURL: asset('protected/manifest.json') } : {}),
    models: SUNHWAARTS_PROTECTED
  }),
  hazardTape: Object.freeze({ footprints: SUNHWAARTS_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 500, far: 1400 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-65, 105, 85]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: SUNHWAARTS_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default SUNHWAARTS;
