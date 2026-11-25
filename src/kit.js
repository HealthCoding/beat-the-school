// Shared block primitives: original geometry, one instanced draw per palette color.
export function createKit(THREE,scene){
  const batches=new Map(),materials=new Map(),colliders=[],dynamic=[];
  let finalized=false,count=0;
  const normalize=c=>typeof c==='number'?'#'+c.toString(16).padStart(6,'0'):c.toLowerCase();
  function material(color){
    color=normalize(color);
    if(!materials.has(color)){
      const m=new THREE.MeshStandardMaterial({color,roughness:.94,metalness:0});
      if(['#567f82','#52727a','#5d8790'].includes(color)){m.emissive.set('#e1b16b');m.userData.window=true;}
      if(color==='#f9df9b'){m.emissive.set('#ffd485');m.emissiveIntensity=.25;m.userData.lamp=true;}
      if(color==='#74a7a4'){m.roughness=.36;m.metalness=.08;}
      materials.set(color,m);
    }
    return materials.get(color);
  }
  function box(x,y,z,w,h,d,color='#aaa999',angle=0){
    if(![x,y,z,w,h,d].every(Number.isFinite)||w<=0||h<=0||d<=0)throw new Error('Invalid campus block: '+JSON.stringify([x,y,z,w,h,d]));
    if(finalized)throw new Error('Static kit already finalized');
    const key=normalize(color);if(!batches.has(key))batches.set(key,[]);
    batches.get(key).push([x,y,z,w,h,d,angle]);count++;
  }
  function collider(x,z,w,d){if(w>0&&d>0)colliders.push({x,z,w,d});}
  function at(x,z){return {box:(a,y,b,w,h,d,c,r=0)=>box(x+a,y,z+b,w,h,d,c,r),collider:(a,b,w,d)=>collider(x+a,z+b,w,d),at:(a,b)=>at(x+a,z+b)};}
  const geo=new THREE.BoxGeometry(1,1,1);
  function movable(x,y,z,w,h,d,color){const m=new THREE.Mesh(geo,material(color));m.position.set(x,y,z);m.scale.set(w,h,d);scene.add(m);return m;}
  function finalize(){
    const temp=new THREE.Object3D();
    for(const[color,items]of batches){const mesh=new THREE.InstancedMesh(geo,material(color),items.length);
      for(let i=0;i<items.length;i++){const[x,y,z,w,h,d,a]=items[i];temp.position.set(x,y,z);temp.scale.set(w,h,d);temp.rotation.set(0,a,0);temp.updateMatrix();mesh.setMatrixAt(i,temp.matrix);}
      mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();mesh.name='campus-'+color;scene.add(mesh);
    }
    finalized=true;return {blocks:count,batches:batches.size};
  }
  function setNight(night){for(const m of materials.values()){if(m.userData.window)m.emissiveIntensity=night?.8:0;if(m.userData.lamp)m.emissiveIntensity=night?2.3:.25;}}
  return{box,collider,at,movable,colliders,finalize,setNight,materials,dynamic};
}
