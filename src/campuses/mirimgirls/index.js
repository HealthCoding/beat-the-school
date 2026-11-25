import { WORLD_UNITS_PER_METER, GEO_ORIGIN, MIRIMGIRLS_PLACEMENTS, MIRIMGIRLS_BUILDING_BASE, MIRIMGIRLS_HEIGHT_GRIDS, MIRIMGIRLS_HEIGHT_RANGE_M, MIRIMGIRLS_ENV_IDS, MIRIMGIRLS_PROVENANCE } from './data.js';
import { MIRIMGIRLS_FOOTPRINTS } from './footprints.js';
import { MIRIMGIRLS_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(MIRIMGIRLS_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/mirimgirls/${f}`, import.meta.url).href;
export const MIRIMGIRLS = Object.freeze({
  id: 'mirimgirls',
  meta: Object.freeze({ school: '미림여자고등학교', campus: '서울', short: '미림여고', modelNoun: '미림여고' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: MIRIMGIRLS_PLACEMENTS,
  approvedCount: MIRIMGIRLS_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main-west', 'it-center', 'mg-north', 'mg-east', 'gym']),
  startBuildingId: 'main-west',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Claude R3 10-27: start from the field (west) so the stand, the blue glass 정보교육관 and the clock-tower 본관 fill the frame
  // like the school's own drone photo (reference mg-aerial-field). Candidates: pilot/mirimgirls-seoul/review/final/cand/, cand2/ (PC cand2 c0; phone box shifted south
  // and sunk to y -10 so the clock bay sits left of the weapon bag and above the hint). Sun from the west so the protruding
  // 본관 south block does not shade the clock bay (cand2 showed that shadow with the shared south-west sun).
  view: Object.freeze({
    overviewAzimuth: -1.55,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        // final review 10-27: closer phone box (was { min: [-2, -10, -8], max: [8, 10, 22], azimuth: -1.6 }) - bigger 본관, field instead of empty parking below;
        // candidates reports/2026-10-27_Claude_최종검수/mirimgirls/cand/ (c5)
        ? { min: [0, -3, -6], max: [8, 9, 20], azimuth: -1.62 }
        : { min: [-4, -1, -30], max: [8, 11, 31], azimuth: -1.55 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: MIRIMGIRLS_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: MIRIMGIRLS_HEIGHT_GRIDS,
    buildingBase: MIRIMGIRLS_BUILDING_BASE,
    source: 'Exact exported school ground samples; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: MIRIMGIRLS_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; school campus map and photographed facades, estimated heights, site levels, planting and house infill'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: MIRIMGIRLS_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Mirim school ground, stand, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({ models: MIRIMGIRLS_PROTECTED }),
  hazardTape: Object.freeze({ footprints: MIRIMGIRLS_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dce5ea',
    fog: Object.freeze({ color: '#dce5ea', near: 175, far: 500 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-100, 105, 35]), shadowSpan: 150 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: MIRIMGIRLS_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default MIRIMGIRLS;
