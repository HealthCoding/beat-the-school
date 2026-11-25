// Yonsei campus bound to the campus-independent engine (src/engine/campus-engine.js).
// Kept so existing checks, scripts and imports work unchanged; the game itself uses the engine
// with the selected campus package.
import { YONSEI } from './campuses/yonsei/index.js';
import { createCampusSource as engineSource, createCampusAsync as engineAsync, createCampus as engineCreate } from './engine/campus-engine.js?v=lz71';

export const ALL_CAMPUS_PLACEMENTS = YONSEI.placements;
export const CAMPUS_BUILDING_COUNT = ALL_CAMPUS_PLACEMENTS.length;
export function createCampusSource(THREE, assets, id) { return engineSource(THREE, YONSEI, assets, id); }
export function createCampusAsync(THREE, options = {}) { return engineAsync(THREE, YONSEI, options); }
export function createCampus(THREE, options = {}) { return engineCreate(THREE, YONSEI, options); }
