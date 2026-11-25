// Sample a single shot against existing live surfaces. The caller owns camera/scene
// matrix updates and applies damage only after this complete, bounded sample.
// blockers (optional): protected buildings ({box, meshes, ...site}); a pellet that meets one first stops there and is
// reported in `blocked` instead of `hits`. Without blockers the sample is exactly as before.
export function sampleShotgunHits(THREE,{camera,entries,x,y,width,height,blockers=null}={}) {
  const empty={hits:[],rayCount:0,candidateBuildings:0};
  if(!camera?.isCamera||(!camera.isPerspectiveCamera&&!camera.isOrthographicCamera)||!Array.isArray(entries)
    ||![x,y,width,height].every(Number.isFinite)||width<=0||height<=0||x<0||x>width||y<0||y>height
    ||!camera.matrixWorld?.elements.every(Number.isFinite)||!camera.projectionMatrixInverse?.elements.every(Number.isFinite))return empty;
  const spread=Math.max(8,Math.min(18,Math.min(width,height)*.025));
  const rays=[],ndc=new THREE.Vector2();
  for(let i=0;i<7;i++){
    const angle=(i-1)*Math.PI/3,px=x+(i?Math.cos(angle)*spread:0),py=y+(i?Math.sin(angle)*spread:0);
    const raycaster=new THREE.Raycaster();ndc.set(px/width*2-1,1-py/height*2);raycaster.setFromCamera(ndc,camera);rays.push(raycaster);
  }
  const candidates=rays.map(()=>new Set()),candidateEntries=new Set(),seenEntries=new Set();
  for(const entry of entries){
    if(!entry||seenEntries.has(entry)||entry.cleared||!entry.worldBounds?.isBox3||entry.worldBounds.isEmpty()||!Array.isArray(entry.model?.meshes))continue;
    seenEntries.add(entry);
    const box=entry.worldBounds;if(![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite))continue;
    const eligible=[];for(let i=0;i<7;i++)if(rays[i].ray.intersectsBox(box))eligible.push(i);
    if(!eligible.length)continue;
    const meshes=entry.model.meshes.filter(mesh=>mesh?.isObject3D&&typeof mesh.raycast==='function');
    if(!meshes.length)continue;
    candidateEntries.add(entry);for(const index of eligible)for(const mesh of meshes)candidates[index].add(mesh);
  }
  const blockedBy=new Map();
  if(Array.isArray(blockers))for(const site of blockers)for(let i=0;i<7;i++)if(site?.box&&rays[i].ray.intersectsBox(site.box))for(const mesh of site.meshes){candidates[i].add(mesh);blockedBy.set(mesh,site);}
  const hits=[],blocked=[],normalMatrix=new THREE.Matrix3(),towardCamera=new THREE.Vector3();
  for(let i=0;i<7;i++){
    if(!candidates[i].size)continue;
    // Existing destructible mesh raycasters skip removed faces and preserve holes.
    const intersections=rays[i].intersectObjects([...candidates[i]],false);
    const hit=intersections.find(hit=>(candidateEntries.has(hit.object?.userData?.entry)||blockedBy.has(hit.object))
      &&hit.point&&[hit.point.x,hit.point.y,hit.point.z,hit.distance].every(Number.isFinite));
    if(!hit)continue;
    const direction=rays[i].ray.direction.clone(),normal=hit.face?.normal?.clone()||direction.clone().negate();
    if(hit.face?.normal)normal.applyMatrix3(normalMatrix.getNormalMatrix(hit.object.matrixWorld));
    if(![normal.x,normal.y,normal.z].every(Number.isFinite)||normal.lengthSq()<1e-12)normal.copy(direction).negate();
    normal.normalize();towardCamera.copy(rays[i].ray.origin).sub(hit.point);if(normal.dot(towardCamera)<0)normal.negate();
    if(blockedBy.has(hit.object)){blocked.push({point:hit.point.clone(),normal,direction,site:blockedBy.get(hit.object)});continue;}
    hits.push({point:hit.point.clone(),normal,direction,entry:hit.object.userData.entry});
  }
  return blockers?{hits,blocked,rayCount:7,candidateBuildings:candidateEntries.size}:{hits,rayCount:7,candidateBuildings:candidateEntries.size};
}
