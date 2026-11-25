// A fictional metal projectile and bounded, texture-based smoke. No real weapon specifications.
// Cloud batches share one 96px texture; shell markings use one 256×128 texture. No Canvas/network asset.
export const NUCLEAR_AFTERMATH_SECONDS = 7;

// Conservative visual bounds relative to the impact point (excluding far ground dust).
export function getNuclearCloudEnvelope(worldRadius) {
  const radius=Number.isFinite(worldRadius)&&worldRadius>30?Math.min(2000,worldRadius):28;
  const unit=Math.max(12,Math.min(128,radius*.27));
  return {unit,height:unit*3,radius:unit*1.5};
}

// Shared by the actual projectile and the cinematic camera; positions use world coordinates.
export function getNuclearFlightPose({ point, worldRadius, age = 0, reducedMotion = false, impactDelay = 3 }) {
  const wholeCampus=Number.isFinite(worldRadius)&&worldRadius>30;
  const blastRadius=wholeCampus?Math.min(2000,worldRadius):28;
  const size=wholeCampus?Math.min(1.8,Math.max(1.2,blastRadius/220)):1.45;
  const impact=Number.isFinite(impactDelay)&&impactDelay>=0?impactDelay:3;
  const elapsed=Number.isFinite(age)?Math.max(0,age):0;
  const progress=impact?Math.min(1,elapsed/impact):1;
  const dropHeight=reducedMotion?12:wholeCampus?Math.min(450,Math.max(80,blastRadius*.75)):52;
  const altitude=dropHeight*(1-progress*progress);
  const position={x:point.x,y:point.y+4.7*size+altitude,z:point.z};
  return {position,nosePosition:{x:point.x,y:point.y+altitude,z:point.z},
    topPosition:{x:point.x,y:position.y+5.3*size,z:point.z},size,altitude,progress,
    rotationY:reducedMotion?0:elapsed*.36,height:10*size,radius:2.4*size};
}

export function createNuclearEffect(THREE, { point, camera, impactDelay = 3, worldRadius, groundHeight }, { reducedMotion = false } = {}) {
  const impact = Number.isFinite(impactDelay) && impactDelay >= 0 ? impactDelay : 3;
  const wholeCampus = Number.isFinite(worldRadius) && worldRadius > 30;
  const radius = wholeCampus ? Math.min(2000, worldRadius) : 28;
  const aftermath = wholeCampus ? NUCLEAR_AFTERMATH_SECONDS : 2.2, duration = impact + aftermath;
  const size = getNuclearFlightPose({point,worldRadius,age:0,reducedMotion,impactDelay:impact}).size;
  const cloudUnit = getNuclearCloudEnvelope(worldRadius).unit;
  const groundAt = (x,z) => { const height = typeof groundHeight === 'function' ? groundHeight(x,z) : point.y; return Number.isFinite(height) ? height - point.y : 0; };
  const groundBase = groundAt(point.x,point.z);
  const group = new THREE.Group(); group.name = 'nuclear-event'; group.position.copy(point);
  const weapon = new THREE.Group(); weapon.name = 'weapon-nuke'; group.add(weapon);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const keepGeo = geo => (geometries.add(geo), geo);
  const keepMat = material => (materials.add(material), material);
  // Painted olive shell with a yellow warning belt and four evenly spaced trefoils.
  // Bake into the existing shell UVs: no decal meshes, extra draw calls or Canvas dependency.
  const paintWidth=256, paintHeight=128, paintData=new Uint8Array(paintWidth*paintHeight*4);
  const olive=[106,119,66], dark=[38,48,40], yellow=[241,194,40], ink=[20,24,18];
  for(let py=0;py<paintHeight;py++)for(let px=0;px<paintWidth;px++) {
    const sums=[0,0,0];
    // Four subpixels keep the small black emblem edges legible with linear filtering.
    for(const sy of [.25,.75])for(const sx of [.25,.75]) {
      const u=(px+sx)/paintWidth, y=(py+sy)/paintHeight*9.8-4.7;
      let rgb=y< -2.65||y>3.65?dark:olive;
      if((y>-.6&&y<1.85)||(y>2.43&&y<2.66))rgb=yellow;
      const dx=((u*4)%1-.5)*(Math.PI*2*1.3/4), dy=y-.63;
      const r=Math.hypot(dx,dy);
      const angle=((Math.atan2(dy,dx)+Math.PI/2+Math.PI/6)%(Math.PI*2/3)+Math.PI*2/3)%(Math.PI*2/3);
      if(r<.15||(r>.28&&r<.79&&angle<Math.PI/3))rgb=ink;
      for(let channel=0;channel<3;channel++)sums[channel]+=rgb[channel];
    }
    const index=(py*paintWidth+px)*4;
    for(let channel=0;channel<3;channel++)paintData[index+channel]=Math.round(sums[channel]/4);
    paintData[index+3]=255;
  }
  const paint=new THREE.DataTexture(paintData,paintWidth,paintHeight,THREE.RGBAFormat);
  paint.name='nuclear-olive-warning-paint';paint.colorSpace=THREE.SRGBColorSpace;
  paint.wrapS=THREE.RepeatWrapping;paint.magFilter=THREE.LinearFilter;paint.minFilter=THREE.LinearFilter;
  paint.generateMipmaps=false;paint.needsUpdate=true;textures.add(paint);
  const metal = keepMat(new THREE.MeshStandardMaterial({ color: 0xffffff, map:paint, roughness: .72, metalness: .32 }));
  const darkMetal = keepMat(new THREE.MeshStandardMaterial({ color: 0x263028, roughness: .78, metalness: .42 }));
  const seamMetal = keepMat(new THREE.MeshStandardMaterial({ color: 0x737c4c, roughness: .62, metalness: .48 }));
  function mesh(geo, material, name, parent = weapon) {
    const object = new THREE.Mesh(keepGeo(geo), material); object.name = name; parent.add(object); return object;
  }
  // Continuous ogive nose → broad shoulder → cylindrical shell → tapered tail.
  const profile = [[0,-4.7],[.2,-4.46],[.5,-3.95],[.89,-3.12],[1.18,-2.1],[1.3,-1.05],[1.3,2.9],[1.16,3.55],[.79,4.5],[.73,5.1],[0,5.1]];
  const shellGeometry=new THREE.LatheGeometry(profile.map(([x,y]) => new THREE.Vector2(x,y)), 24);
  // Lathe's default v is profile-index based; physical-height UVs keep the belt/emblems round.
  const shellUV=shellGeometry.attributes.uv, shellPosition=shellGeometry.attributes.position;
  for(let i=0;i<shellUV.count;i++)shellUV.setY(i,(shellPosition.getY(i)+4.7)/9.8);
  mesh(shellGeometry, metal, 'nuclear-metal-shell');
  for (const y of [-1.05,2.75]) {
    const seam = mesh(new THREE.TorusGeometry(1.306, .035, 4, 24), seamMetal, 'nuclear-shell-seam');
    seam.rotation.x = Math.PI / 2; seam.position.y = y;
  }
  const tail = mesh(new THREE.CylinderGeometry(.75,.8,.26,20), darkMetal, 'nuclear-tail-cap'); tail.position.y=5.05;
  // Four swept stabilisers, merged into one geometry, with a thin physical edge.
  const finVertices = [], finIndices = [];
  for (let i=0;i<4;i++) {
    const a=i*Math.PI/2, offset=finVertices.length/3;
    for (const z of [-.07,.07]) for (const [x,y] of [[.75,2.7],[2.4,4.25],[2.15,5.3],[.72,5.1]]) {
      finVertices.push(x*Math.cos(a)+z*Math.sin(a),y,-x*Math.sin(a)+z*Math.cos(a));
    }
    for (const face of [[0,1,2],[0,2,3],[4,6,5],[4,7,6],[0,4,5],[0,5,1],[1,5,6],[1,6,2],[2,6,7],[2,7,3],[3,7,4],[3,4,0]]) finIndices.push(...face.map(n=>n+offset));
  }
  const finGeo = new THREE.BufferGeometry(); finGeo.setAttribute('position',new THREE.Float32BufferAttribute(finVertices,3)); finGeo.setIndex(finIndices); finGeo.computeVertexNormals();
  mesh(finGeo,darkMetal,'nuclear-swept-fins');

  // Value noise baked once into the alpha: irregular soft edges instead of overlapping solid spheres.
  const hash = (x,y) => { const n=Math.sin(x*127.1+y*311.7+19.17)*43758.5453; return n-Math.floor(n); };
  const smooth = t=>t*t*(3-2*t), mix=(a,b,t)=>a+(b-a)*t;
  function noise(x,y) { const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy); return mix(mix(hash(ix,iy),hash(ix+1,iy),fx),mix(hash(ix,iy+1),hash(ix+1,iy+1),fx),fy); }
  const textureSize=96, data=new Uint8Array(textureSize*textureSize*4);
  for(let y=0;y<textureSize;y++)for(let x=0;x<textureSize;x++) {
    const u=(x+.5)/textureSize*2-1,v=(y+.5)/textureSize*2-1;
    // Domain-warped billows and fine ridges are baked once; the GPU still reads one texture.
    const radial=Math.sqrt(u*u+v*v);
    const warp=noise(u*2.7+13,v*2.7+21)-.5;
    const twist=.48*Math.max(0,1-radial)**2+warp*.22;
    const cos=Math.cos(twist),sin=Math.sin(twist);
    const wx=u*cos-v*sin+warp*.12,wy=u*sin+v*cos-warp*.09;
    const coarse=noise(wx*4.2+7,wy*4.2+3);
    const detail=noise(wx*12.5+2,wy*12.5+8)*.65+noise(wx*29+9,wy*29+5)*.35;
    const ridge=1-Math.abs(coarse*2-1),density=coarse*.55+ridge*.14+detail*.31;
    const edge=Math.max(0,Math.min(1,(.97-radial+(density-.5)*.3)/.32));
    const dx=noise(wx*4.2+7.16,wy*4.2+3)-coarse;
    const dy=noise(wx*4.2+7,wy*4.2+3.16)-coarse;
    const relief=dy*.7-dx*.5;
    const alpha=smooth(edge)*Math.min(1,.64+density*.46);
    const shade=Math.max(.3,Math.min(.98,.44+density*.53+relief-u*.055+v*.09+(detail-.5)*.12));
    const index=(y*textureSize+x)*4;
    data[index]=data[index+1]=data[index+2]=Math.round(shade*255);data[index+3]=Math.round(alpha*255);
  }
  const texture = new THREE.DataTexture(data,textureSize,textureSize,THREE.RGBAFormat);
  texture.magFilter=THREE.LinearFilter; texture.minFilter=THREE.LinearFilter; texture.generateMipmaps=false; texture.needsUpdate=true; textures.add(texture);
  const plane = keepGeo(new THREE.PlaneGeometry(2,2));
  function batch(name,count,color,opacity,additive=false) {
    const mat=keepMat(new THREE.MeshBasicMaterial({ color, map:texture, transparent:true, opacity, depthWrite:false,
      side:THREE.DoubleSide, forceSinglePass:true, blending:additive?THREE.AdditiveBlending:THREE.NormalBlending, toneMapped:!additive }));
    const object=new THREE.InstancedMesh(plane,mat,count);object.name=name;object.frustumCulled=false;
    object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(object);return object;
  }
  const fire=batch('nuclear-fireball',10,0xffb35b,.9,true);
  const smoke=batch('nuclear-rising-smoke',24,0xffffff,.96);
  const dust=batch('nuclear-ground-dust',24,0x8d877b,.42);
  const condensation=batch('nuclear-condensation',8,0xd7d9d4,.3);
  fire.renderOrder=3; smoke.renderOrder=4; dust.renderOrder=5; condensation.renderOrder=6;
  const shadowMaterial=keepMat(new THREE.MeshBasicMaterial({map:texture,color:0x172127,transparent:true,opacity:.2,depthWrite:false}));
  const shadow=new THREE.Mesh(plane,shadowMaterial);shadow.name='nuclear-ground-shadow';shadow.rotation.x=-Math.PI/2;shadow.position.y=groundBase+.06;group.add(shadow);
  const dummy=new THREE.Object3D(), billboard=new THREE.Quaternion(), rotation=new THREE.Quaternion();
  const forward=new THREE.Vector3(0,0,1), color=new THREE.Color(), warmColor=new THREE.Color(), coolColor=new THREE.Color();
  const setParticle=(batch,index,x,y,z,sx,sy,roll=0)=>{
    dummy.position.set(x,y,z);dummy.quaternion.copy(billboard);rotation.setFromAxisAngle(forward,roll);dummy.quaternion.multiply(rotation);
    dummy.scale.set(Math.max(.001,sx),Math.max(.001,sy),1);dummy.updateMatrix();batch.setMatrixAt(index,dummy.matrix);
  };
  // Instance colours are fixed variation, not new materials or extra draw calls.
  for(const object of [smoke,dust,condensation])for(let i=0;i<object.count;i++) {
    color.setScalar(.67+hash(i,9)*.33);object.setColorAt(i,color);
  }
  let objects=0;group.traverse(()=>objects++);
  const effect={group,weapon,toolId:'nuke',geometries,materials,textures,objects,age:0,duration,impact,protectedUntil:impact,
    reward:0,registered:false,disposed:false,blastRadius:radius,
    animate(t) {
      const u=impact?Math.min(1,t/impact):1, contacted=t>=impact;
      const post=Math.max(0,t-impact), phase=post;
      if(camera) camera.getWorldQuaternion(billboard); else billboard.identity();
      weapon.scale.setScalar(size);weapon.visible=!contacted;
      const flight=getNuclearFlightPose({point,worldRadius,age:t,reducedMotion,impactDelay:impact});
      weapon.position.set(flight.position.x-point.x,flight.position.y-point.y,flight.position.z-point.z);
      weapon.rotation.y=flight.rotationY;
      shadow.visible=!contacted;shadow.scale.setScalar((2+u*3)*size);shadow.material.opacity=.07+u*.16;
      fire.visible=contacted && phase<1.2;
      smoke.visible=contacted && phase>=.12 && phase<aftermath;
      dust.visible=contacted && phase>=.08 && phase<Math.min(5.6,aftermath);
      condensation.visible=contacted && phase>=.65 && phase<2.9 && !reducedMotion;
      // Real elapsed seconds: fast formation, held silhouette, then a slow terminal fade.
      const fadeWindow=Math.min(2.1,aftermath*.3);
      const fade=smooth(Math.max(0,Math.min(1,(aftermath-phase)/fadeWindow)));
      fire.material.opacity=(reducedMotion?.32:.92)*Math.max(0,1-phase/1.2);
      smoke.material.opacity=.96*fade;
      dust.material.opacity=(reducedMotion?.26:.43)*Math.min(1,Math.max(0,(Math.min(5.6,aftermath)-phase)/1.6));
      condensation.material.opacity=.2*Math.min(1,Math.max(0,(phase-.65)/.25))*Math.max(0,1-(phase-.65)/2.25);
      if(fire.visible) for(let i=0;i<fire.count;i++) {
        const a=i*2.39996, expansion=1-Math.exp(-phase/.32);
        const spread=cloudUnit*(.18+expansion*.37), r=Math.sqrt(i/fire.count);
        setParticle(fire,i,Math.cos(a)*spread*r,cloudUnit*(.09+phase*.38)+Math.sin(i*2.1)*spread*.28,Math.sin(a)*spread*r,spread*(.64+hash(i,1)*.3),spread*(.62+hash(i,2)*.36),i*.73);
      }
      const develop=1-Math.exp(-phase/.58), lift=1-Math.exp(-phase/1.05);
      const rise=cloudUnit*(.12+lift*1.86), grow=.22+develop*.78;
      const drift=cloudUnit*Math.min(phase,5)*.025;
      const capCenter=rise+cloudUnit*.12;
      if(smoke.visible) for(let i=0;i<smoke.count;i++) {
        const stem=i<8, crown=i>=8&&i<16, slot=stem?i:crown?i-8:i-16;
        const a=slot*Math.PI/4+(crown?.18:0)+(hash(i,12)-.5)*.18, jitter=hash(i,4);
        let x,y,z,sx,sy,roll;
        if(stem) {
          const along=i/7;
          // Widen the upper column into the inside of the cap instead of leaving a floating crown.
          const bend=Math.sin(along*3.2+phase*.12)*cloudUnit*.075;
          x=Math.cos(i*2.4)*cloudUnit*.075+bend+drift*along;
          z=Math.sin(i*2.4)*cloudUnit*.075;
          y=groundBase+(capCenter+cloudUnit*.08-groundBase)*along;
          sx=cloudUnit*(.23+along*.08+jitter*.045)*grow;
          sy=cloudUnit*(.3+jitter*.07)*grow;roll=i*.8+phase*.025;
          warmColor.set(0xa07850);coolColor.set(0x64635d);
        } else if(crown) {
          // A broad arched roof: smaller vertical radius keeps the cap wide, with a heavy centre.
          const ringRadius=cloudUnit*(.68+jitter*.08)*grow;
          x=Math.cos(a)*ringRadius+drift;z=Math.sin(a)*ringRadius;
          y=capCenter+cloudUnit*(.26+Math.sin(a*2+1)*.035)*grow;
          sx=cloudUnit*(.4+jitter*.065)*grow;sy=cloudUnit*(.31+jitter*.05)*grow;
          roll=(hash(i,2)-.5)*.35;
          warmColor.set(0xb4a18b);coolColor.set(0x9b9e99);
        } else {
          // The lower skirt moves inward and rises under the roof, suggesting a rolling vortex.
          const curl=1-Math.exp(-Math.max(0,phase-.45)/1.2);
          const ringRadius=cloudUnit*(1.02-curl*.13+jitter*.035)*grow;
          x=Math.cos(a)*ringRadius+drift;z=Math.sin(a)*ringRadius;
          y=capCenter+cloudUnit*(-.07+curl*.2+Math.sin(a*2)*.025)*grow;
          sx=cloudUnit*(.36+jitter*.055)*grow;sy=cloudUnit*(.27+jitter*.045)*grow;
          roll=(hash(i,2)-.5)*.3;
          warmColor.set(0x9a6945);coolColor.set(0x676e69);
        }
        // Half-turns vary the billow pattern without changing the quad footprint or count.
        roll+=(i%2)*Math.PI;
        setParticle(smoke,i,x,y,z,sx,sy,roll);
        color.copy(warmColor).lerp(coolColor,Math.min(1,Math.max(0,phase-.2)/1.6));
        color.multiplyScalar(.86+hash(i,9)*.14);smoke.setColorAt(i,color);
      }
      // Discontinuous low dust banks follow the actual whole-campus shock-front timing.
      const front=Math.min(1,phase/1.8)*radius;
      if(dust.visible) for(let i=0;i<dust.count;i++) {
        const a=i/dust.count*Math.PI*2+.11*Math.sin(i*7.1), irregular=(i%2?.82:.96)+hash(i,8)*.06;
        const wide=Math.max(2,front*(.14+hash(i,7)*.07));
        const x=Math.cos(a)*front*irregular,z=Math.sin(a)*front*irregular;
        const height=cloudUnit*(.08+hash(i,6)*.05)*(.3+Math.min(1,phase));
        setParticle(dust,i,x,groundAt(point.x+x,point.z+z)+height*.55,z,Math.max(wide,height*1.8),height,(hash(i,5)-.5)*.06);
      }
      if(condensation.visible) for(let i=0;i<condensation.count;i++) {
        const a=i/condensation.count*Math.PI*2+.2, r=cloudUnit*(.8+Math.min(phase,2)*.07)*grow;
        setParticle(condensation,i,Math.cos(a)*r+drift,capCenter+cloudUnit*.25*grow,Math.sin(a)*r,cloudUnit*.27*grow,cloudUnit*.075*grow,(hash(i,11)-.5)*.06);
      }
      for(const object of [fire,smoke,dust,condensation]) if(object.visible) object.instanceMatrix.needsUpdate=true;
      if(smoke.visible) smoke.instanceColor.needsUpdate=true;
      group.userData.blastFront=front;group.userData.phase=phase;group.userData.cloudRise=rise;group.userData.cloudUnit=cloudUnit;
    },
  };
  effect.animate(0);return effect;
}
