// Yonsei-bound compatibility wrapper over the campus-independent terrain (src/engine/terrain.js).
import { CAMPUS_HILLS } from './campus-hills-data.js';
import { createCampusTerrain as engineTerrain } from './engine/terrain.js';
const YONSEI_BASE = (x, z) => Math.min(4.5, Math.max(0, (-z - 35) * .025));
const YONSEI_SOURCE = 'Photo/context-based relative hills and northward grade; no surveyed elevations';
export function createCampusTerrain(entries = [], { baseHeight = YONSEI_BASE, hills = CAMPUS_HILLS, source = YONSEI_SOURCE } = {}) {
 return engineTerrain(entries, { baseHeight, hills, source });
}
