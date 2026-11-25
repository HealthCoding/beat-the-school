// Yonsei-bound compatibility wrapper over the campus-independent ground (src/engine/ground.js).
import { YONSEI } from './campuses/yonsei/index.js';
import { createCampusGround as engineGround } from './engine/ground.js';
export { groundPointBlocked, groundSegmentBlocked } from './engine/ground.js';
export function createCampusGround(THREE,{profile=YONSEI.ground,environment=YONSEI.environment,terrainProfile=YONSEI.terrain,worldUnitsPerMeter=YONSEI.geo.worldUnitsPerMeter,...options}={}){
 return engineGround(THREE,{...options,profile,environment,terrainProfile,worldUnitsPerMeter});
}
