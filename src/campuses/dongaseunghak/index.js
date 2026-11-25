// Dong-A University Seunghak: local R3 package, 25 destructible units.
import { WORLD_UNITS_PER_METER, GEO_ORIGIN, DAS_PLACEMENTS, DAS_BUILDING_BASE, DAS_HEIGHT_GRIDS, DAS_HEIGHT_RANGE_M, DAS_ENV_IDS, DAS_ENV_MANIFEST_IDS, DAS_LOOK, DAS_ZONES, DAS_PROVENANCE } from './data.js';
import { DAS_FOOTPRINTS } from './footprints.js';
import { DAS_PROTECTED } from './protected.js';
import { createSkkuGroundLook } from '../skku/ground-look.js';

const MODEL_IDS = Object.freeze(DAS_PLACEMENTS.map(p => p.id));
const asset = file => new URL(`../../../assets/campuses/dongaseunghak/${file}`, import.meta.url).href;
const HAZE = '#dde5e8';

export const DONGASEUNGHAK = Object.freeze({
  id: 'dongaseunghak',
  meta: Object.freeze({ school: '동아대학교', campus: '승학캠퍼스', short: '동아대 승학', modelNoun: '동아대' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: DAS_PLACEMENTS,
  approvedCount: DAS_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['s01', 's07', 's10', 's17']),
  startBuildingId: 's01',
  // Wide view north across S01, S07, Newton Park and the library.  Portrait
  // needs a higher, wider vantage so the three landmarks clear the fixed HUD.
  view: Object.freeze({ get startFrame() {
    return (globalThis.innerWidth || 1280) < 600
      ? { min: [-64, -38, 18], max: [6, 2, 82], azimuth: -0.34, elevationDegrees: 26 }
      : { min: [-61, -38, 15], max: [9, 2, 85], azimuth: -0.34, elevationDegrees: 14 };
  } }),
  models: Object.freeze({
    manifests: Object.freeze([
      Object.freeze({ url: asset('manifest.json'), expectedIds: MODEL_IDS }),
      Object.freeze({ url: asset('environment.json'), expectedIds: DAS_ENV_MANIFEST_IDS }),
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw new Error('No procedural buildings in this campus'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} }),
  }),
  terrain: Object.freeze({ heightGrids: DAS_HEIGHT_GRIDS, buildingBase: DAS_BUILDING_BASE,
    source: 'Relative terrain estimate (Copernicus DSM with estimated building and canopy adjustments, pilot/donga-seunghak); not a survey' }),
  environment: Object.freeze({ provenance: DAS_PROVENANCE, sourceNote: 'OSM ground surfaces and surroundings (© OpenStreetMap contributors, ODbL); heights, planting and the formal landscape estimated' }),
  ground: Object.freeze({
    baked: Object.freeze({ envIds: DAS_ENV_IDS, castShadow: Object.freeze([]), materialHook: createSkkuGroundLook(DAS_LOOK, DAS_ZONES),
      fade: Object.freeze({ centre_m: Object.freeze([0, -5]), near_m: 520, far_m: 1250, colour: HAZE }), playMargin_m: 30,
      source: 'pilot/donga-seunghak preview ground + landscape + context, baked' }),
  }),
  // No separate protected buildings; the daycare in the residence is destroyed with it.
  protected: Object.freeze({
    models: DAS_PROTECTED,
  }),
  // Hazard tape around every destructible building only (src/engine/hazard-tape.js): none on the non-destructible context.
  // S21's steep entrance cuts the generated band into floating fragments.
  // Keep the other buildings' bands; the S21 model remains a normal target.
  hazardTape: Object.freeze({ footprints: DAS_FOOTPRINTS, maxStep_m: 0.35, exclude: ['s21'] }),
  scene: Object.freeze({
    background: HAZE, fog: Object.freeze({ color: HAZE, near: 700, far: 2200 }),
    hemisphere: Object.freeze({ sky: '#eef2f4', ground: '#7d8a78', intensity: 1.3 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 2.9, position: Object.freeze([-150, 200, 100]), shadowSpan: 230 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: DAS_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - .3 }),
  }),
});
export default DONGASEUNGHAK;
