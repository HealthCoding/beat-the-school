// A small cartoon fuse bomb. All geometry is event-owned and released by effects.js.
export function createMiniBombEffect(THREE, {point,camera,impactDelay=1.8,normal}, {reducedMotion=false}={}) {
  const impact=Number.isFinite(impactDelay)&&impactDelay>=0?impactDelay:1.8;
  const duration=impact+1.5, tossTime=Math.min(.3,impact), radius=1.35;
  const group=new THREE.Group();group.name='mini-bomb-event';group.position.copy(point);
  const weapon=new THREE.Group();weapon.name='weapon-mini-bomb';group.add(weapon);
  const geometries=new Set(),materials=new Set(),textures=new Set();
  const geo=g=>(geometries.add(g),g),mat=m=>(materials.add(m),m);
  const surface=new THREE.Vector3(0,1,0);
  if(normal&&[normal.x,normal.y,normal.z].every(Number.isFinite)&&normal.x*normal.x+normal.y*normal.y+normal.z*normal.z>1e-10)surface.copy(normal).normalize();
  const up=new THREE.Vector3(0,1,0),forward=new THREE.Vector3(0,0,1);
  const orientation=new THREE.Quaternion().setFromUnitVectors(up,surface);
  const tangent=new THREE.Vector3(1,0,0).applyQuaternion(orientation),bitangent=new THREE.Vector3(0,0,1).applyQuaternion(orientation);
  const approach=new THREE.Vector3();
  if(camera)camera.getWorldPosition(approach).sub(point);else approach.copy(tangent);
  approach.addScaledVector(surface,-approach.dot(surface));
  if(approach.lengthSq()<1e-8)approach.copy(tangent);approach.normalize();
  const shellMat=mat(new THREE.MeshStandardMaterial({color:0x20262c,roughness:.36,metalness:.68}));
  const capMat=mat(new THREE.MeshStandardMaterial({color:0x8a928f,roughness:.43,metalness:.8}));
  const fuseMat=mat(new THREE.MeshStandardMaterial({color:0xc39b62,roughness:.95,metalness:0}));
  function mesh(geometry,material,name,parent=weapon){const object=new THREE.Mesh(geometry,material);object.name=name;parent.add(object);return object;}
  mesh(geo(new THREE.SphereGeometry(radius,16,10)),shellMat,'mini-bomb-shell');
  const cap=mesh(geo(new THREE.CylinderGeometry(.31,.39,.32,12)),capMat,'mini-bomb-cap');cap.position.y=1.36;
  const fusePath=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,1.52,0),new THREE.Vector3(.06,2.09,0),new THREE.Vector3(.47,2.14,0));
  mesh(geo(new THREE.TubeGeometry(fusePath,7,.075,4,false)),fuseMat,'mini-bomb-fuse');

  // Tiny shared alpha map softens fire and dust without external assets or canvases.
  const size=32,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1,r=Math.hypot(u,v);
    const grain=.86+.14*Math.sin(x*1.7+y*2.3),a=Math.max(0,1-r);
    const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(255*a*a*grain);
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;textures.add(texture);
  const plane=geo(new THREE.PlaneGeometry(2,2));
  function batch(name,count,color,additive,parent=group){
    const material=mat(new THREE.MeshBasicMaterial({color,map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,toneMapped:!additive}));
    const object=new THREE.InstancedMesh(plane,material,count);object.name=name;object.frustumCulled=false;object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);parent.add(object);return object;
  }
  const sparks=batch('mini-bomb-fuse-sparks',6,0xffb343,true);
  const fire=batch('mini-bomb-fire',5,0xffffff,true);
  const coreColor=new THREE.Color(0xffedba),outerColor=new THREE.Color(0xff751b),fireColor=new THREE.Color();
  for(let i=0;i<fire.count;i++)fire.setColorAt(i,i===0?coreColor:outerColor);
  const dust=batch('mini-bomb-dust',10,0xab8e68,false);
  const ringMat=mat(new THREE.MeshBasicMaterial({color:0xffdb9b,transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true}));
  const ring=mesh(geo(new THREE.RingGeometry(.82,1,32)),ringMat,'mini-bomb-pressure-ring',group);
  ring.quaternion.setFromUnitVectors(forward,surface);ring.position.copy(surface).multiplyScalar(.16);
  const dummy=new THREE.Object3D(),billboard=new THREE.Quaternion(),roll=new THREE.Quaternion(),twist=new THREE.Quaternion();
  const local=new THREE.Vector3(),center=new THREE.Vector3(),fuseTip=new THREE.Vector3(.47,2.14,0),sparkOrigin=new THREE.Vector3();
  function particle(batch,index,position,width,height,angle=0){
    dummy.position.copy(position);dummy.quaternion.copy(billboard);roll.setFromAxisAngle(forward,angle);dummy.quaternion.multiply(roll);
    dummy.scale.set(Math.max(.001,width),Math.max(.001,height),1);dummy.updateMatrix();batch.setMatrixAt(index,dummy.matrix);
  }
  let objects=0;group.traverse(()=>objects++);
  const effect={group,weapon,toolId:'mini-bomb',geometries,materials,textures,objects,age:0,duration,impact,protectedUntil:impact,reward:0,registered:false,disposed:false,
    animate(time){
      const t=Number.isFinite(time)?Math.max(0,time):0,post=Math.max(0,t-impact),exploded=t>=impact,done=t>=duration;
      const u=tossTime?Math.min(1,t/tossTime):1,throwEase=1-(1-u)**2;
      if(camera)camera.getWorldQuaternion(billboard);else billboard.identity();
      weapon.visible=!exploded;
      weapon.position.copy(surface).multiplyScalar(radius+.08+(reducedMotion?0:Math.sin(u*Math.PI)*2.5));
      weapon.position.addScaledVector(approach,(1-throwEase)*(reducedMotion?1.5:6));
      weapon.quaternion.copy(orientation);
      const warning=!reducedMotion&&t>=tossTime&&impact-t<.45?Math.sin(t*93)*.045:0;
      twist.setFromAxisAngle(forward,warning);weapon.quaternion.multiply(twist);
      sparks.visible=!exploded;sparks.material.opacity=reducedMotion?.55:.95;
      sparkOrigin.copy(fuseTip).applyQuaternion(weapon.quaternion).add(weapon.position);
      if(sparks.visible)for(let i=0;i<sparks.count;i++){
        const cycle=(t*(reducedMotion?1.3:5)+i/sparks.count)%1,a=i*2.39996;
        local.copy(sparkOrigin).addScaledVector(tangent,Math.cos(a)*cycle*.65).addScaledVector(bitangent,Math.sin(a)*cycle*.5).addScaledVector(surface,cycle*.55);
        particle(sparks,i,local,(1-cycle)*.18+.04,(1-cycle)*.18+.04);
      }
      fire.visible=exploded&&!done&&post<.58;dust.visible=exploded&&!done&&post>=.07;ring.visible=exploded&&!done&&post<.55&&!reducedMotion;
      fire.material.opacity=(reducedMotion?.45:1)*Math.max(0,1-Math.max(0,post-.1)/.48);
      dust.material.opacity=.82*Math.min(1,post/.19)*Math.max(0,1-Math.max(0,post-.35)/1.15);
      ring.scale.setScalar(1+(1-(1-Math.min(1,post/.55))**2)*9.7);ringMat.opacity=.7*Math.max(0,1-post/.55);
      center.copy(surface).multiplyScalar(radius+.08);
      if(fire.visible)for(let i=0;i<fire.count;i++){
        const a=i*2.39996,spread=1-Math.exp(-post*32),edge=i===0?0:1;
        local.copy(center).addScaledVector(tangent,Math.cos(a)*spread*2.3*edge).addScaledVector(bitangent,Math.sin(a)*spread*2.3*edge).addScaledVector(surface,.3+post*1.8);
        const size=1.5+spread*(i===0?3.3:2.9);particle(fire,i,local,size,size,i*.4);
        fireColor.copy(i===0?coreColor:outerColor).lerp(outerColor,Math.min(1,post/.4));fire.setColorAt(i,fireColor);
      }
      if(dust.visible)for(let i=0;i<dust.count;i++){
        const a=i*2.39996,travel=(1-Math.exp(-post*3.4))*(7+i%3*.4);
        local.copy(center).addScaledVector(tangent,Math.cos(a)*travel).addScaledVector(bitangent,Math.sin(a)*travel).addScaledVector(surface,post*(.6+i%3*.2));
        particle(dust,i,local,1+post*(1+i%3*.15),.85+post*1.1,i*.6);
      }
      for(const object of [sparks,fire,dust])if(object.visible)object.instanceMatrix.needsUpdate=true;
      if(fire.visible)fire.instanceColor.needsUpdate=true;
      group.userData.phase=done?'done':exploded?'blast':t<tossTime?'throw':'fuse';
    },
  };
  effect.animate(0);return effect;
}
