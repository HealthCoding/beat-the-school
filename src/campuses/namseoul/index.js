import { WORLD_UNITS_PER_METER, GEO_ORIGIN, NAMSEOUL_PLACEMENTS, NAMSEOUL_BUILDING_BASE, NAMSEOUL_HEIGHT_GRIDS, NAMSEOUL_HEIGHT_RANGE_M, NAMSEOUL_ENV_IDS, NAMSEOUL_PROVENANCE } from './data.js';
import { NAMSEOUL_FOOTPRINTS } from './footprints.js';
import { NAMSEOUL_PROTECTED } from './protected.js';
const MODEL_IDS = Object.freeze(NAMSEOUL_PLACEMENTS.map(p => p.id));
const asset = f => new URL(`../../../assets/campuses/namseoul/${f}`, import.meta.url).href;
export const NAMSEOUL = Object.freeze({
  id: 'namseoul',
  meta: Object.freeze({ school: '남서울대학교', campus: '천안', short: '남서울대', modelNoun: '남서울대' }),
  geo: Object.freeze({ origin: GEO_ORIGIN, worldUnitsPerMeter: WORLD_UNITS_PER_METER }),
  placements: NAMSEOUL_PLACEMENTS,
  approvedCount: NAMSEOUL_PLACEMENTS.length,
  additionalCount: 0,
  coreIds: Object.freeze(['main','library','knowledge','student','gym']),
  startBuildingId: 'main',
  camera: Object.freeze({ overviewElevation: 46, playElevation: 23, tiltNear: 15 }),
  // Approach from the campus side of the main building, matching the photographed front.
  // The portrait frame keeps that facade above the first-use gesture hint.
  view: Object.freeze({
    overviewAzimuth: -2.7,
    get startFrame() {
      return (globalThis.innerWidth || 1280) < 600
        ? { min: [-59, 20, 91], max: [-37, 32, 101], azimuth: -2.97, elevationDegrees: 14 }
        : { min: [-73, 20, 86], max: [-24, 33, 104], azimuth: -2.97, elevationDegrees: 17 };
    }
  }),
  models: Object.freeze({
    manifests: Object.freeze([
      { url: asset('manifest.json'), expectedIds: MODEL_IDS },
      { url: asset('environment.json'), expectedIds: NAMSEOUL_ENV_IDS }
    ]),
    proceduralIds: Object.freeze([]),
    createProceduralSource: () => { throw Error('No procedural building'); },
    enhanceFacade: () => ({ stats: {}, dispose() {} })
  }),
  terrain: Object.freeze({
    heightGrids: NAMSEOUL_HEIGHT_GRIDS,
    buildingBase: NAMSEOUL_BUILDING_BASE,
    source: 'Sampled visible ground and under-building floor caps; estimated relative levels'
  }),
  environment: Object.freeze({
    provenance: NAMSEOUL_PROVENANCE,
    sourceNote: 'OSM © OpenStreetMap contributors; photo-based building form, estimated heights and planting'
  }),
  ground: Object.freeze({
    baked: Object.freeze({
      envIds: NAMSEOUL_ENV_IDS,
      castShadow: Object.freeze([]),
      playMargin_m: 24,
      source: 'Exact Namseoul campus ground, site, planting and surrounding buildings'
    })
  }),
  protected: Object.freeze({...(NAMSEOUL_PROTECTED.length ? {manifestURL:asset('protected/manifest.json')} : {}), models: NAMSEOUL_PROTECTED }),
  hazardTape: Object.freeze({ footprints: NAMSEOUL_FOOTPRINTS }),
  scene: Object.freeze({
    background: '#dfe6ea',
    fog: Object.freeze({ color: '#dfe6ea', near: 325, far: 950 }),
    hemisphere: Object.freeze({ sky: '#ffffff', ground: '#7d8a78', intensity: 1.35 }),
    sun: Object.freeze({ color: '#fff4e2', intensity: 3.1, position: Object.freeze([-130, 210, 170]), shadowSpan: 210 }),
    floor: Object.freeze({ color: '#c9cbc8', hidden: true, y: NAMSEOUL_HEIGHT_RANGE_M[0] * WORLD_UNITS_PER_METER - 0.3 })
  })
});
export default NAMSEOUL;
