// Fictional compact pump-action viewmodel. Camera-relative cosmetic geometry only:
// aiming/hit tests, damage, recoil of the world camera and sound belong to the caller.
export function createShotgunView(THREE, scene, camera, { reducedMotion = false, modelAsset = null } = {}) {
  const READY = .82, EJECT = .28, SHELL_LIFE = .94, POOL = 4;
  const overlayScene=new THREE.Scene(),overlayCamera=new THREE.PerspectiveCamera();
  overlayCamera.matrixAutoUpdate=false;overlayCamera.matrixWorldAutoUpdate=false;
  const modelInstance=modelAsset?.createInstance()||null;
  const muzzlePoint=modelInstance?.muzzle||new THREE.Vector3(0,.12,-1.88),ejectionPoint=modelInstance?.ejectionPort||new THREE.Vector3(.19,.055,.1);
  const root = new THREE.Group(); root.name = 'shotgun-view'; root.visible = false;
  const gun = new THREE.Group(); gun.name = 'shotgun-model'; root.add(gun);
  let pump = new THREE.Group(); pump.name = 'shotgun-pump';
  if(modelInstance){gun.add(modelInstance.root);pump=modelInstance.pump;}else gun.add(pump);
  const pumpRestZ=pump.position.z;
  const geometries = new Set(), materials = new Set();
  let visible = false, disposed = false, age = -1, ejected = false, shots = 0, createdShells = 0;
  let width = 0, height = 0, aimX = 0, aimY = 0, currentX = 0, currentY = 0, modelScale = 1;
  const worldPosition = new THREE.Vector3(), worldRotation = new THREE.Quaternion();
  const dummy = new THREE.Object3D(), ejectPoint = new THREE.Vector3();
  const shellStates = Array.from({ length: POOL }, () => ({ active:false, age:0, x:0, y:0, z:0, vx:0, vy:0, vz:0 }));
  if(!modelInstance){
  const material = (color, order, roughness = .6, metalness = .3) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness, fog:false,
      transparent:false, opacity:1, depthTest:true, depthWrite:true });
    materials.add(mat); return { mat, order };
  };
  const steel = material(0x505d64,1003,.5,.42), timber = material(0xa85b2c,1001,.7,.04);
  const rubber = material(0x141b1e,1004,.84,.05), foreWood = material(0xffffff,1005,.7,.04);
  foreWood.mat.vertexColors = true;
  const trim = material(0x11191c,1006,.66,.3);
  // Merge construction pieces per material, keeping the visible gun to five mesh draws.
  const builds = new Map();
  function part(geometry, style, parent, position=[0,0,0], rotation=[0,0,0], scale=[1,1,1]) {
    dummy.position.fromArray(position); dummy.rotation.set(...rotation); dummy.scale.fromArray(scale); dummy.updateMatrix();
    geometry.applyMatrix4(dummy.matrix);
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    const key = style;
    if (!builds.has(key)) builds.set(key,{style,parent,parts:[]});
    builds.get(key).parts.push(flat);
    if (flat !== geometry) geometry.dispose();
  }
  const box = (size,style,parent,pos,rot) => part(new THREE.BoxGeometry(...size),style,parent,pos,rot);
  const cylinder = (radius,length,style,parent,pos,segments=12) => part(new THREE.CylinderGeometry(radius,radius,length,segments,1),style,parent,pos,[Math.PI/2,0,0]);
  // Receiver, barrel, magazine tube and raised top rib.
  box([.25,.24,.64],steel,gun,[0,.025,.18]);
  box([.19,.045,.74],steel,gun,[0,.158,.1]);
  cylinder(.062,1.72,steel,gun,[0,.12,-.98]);
  cylinder(.045,1.37,steel,gun,[0,-.055,-.72]);
  part(new THREE.TorusGeometry(.064,.014,5,12),steel,gun,[0,.12,-1.85]);
  cylinder(.045,.012,rubber,gun,[0,.12,-1.864]);
  box([.035,.04,1.5],steel,gun,[0,.186,-.95]);
  box([.045,.035,.06],rubber,gun,[0,.219,-1.62]);
  // A shaped wooden stock, with a darker end pad and a separate slanted grip.
  const stock = new THREE.BoxGeometry(.29,.28,.69);
  const positions = stock.attributes.position;
  for(let i=0;i<positions.count;i++){
    const z=positions.getZ(i),back=z>0;
    positions.setX(i,positions.getX(i)*(back?1.12:.7));
    positions.setY(i,positions.getY(i)*(back?1.2:.72)-(back?.105:0));
  }
  stock.computeVertexNormals();part(stock,timber,gun,[0,-.025,.81]);
  box([.34,.35,.065],rubber,gun,[0,-.13,1.175],[.04,0,0]);
  box([.17,.28,.2],timber,gun,[0,-.19,.46],[-.3,0,0]);
  part(new THREE.TorusGeometry(.104,.016,5,12),rubber,gun,[0,-.18,.24],[0,Math.PI/2,0],[1,.85,1.35]);
  box([.027,.087,.035],steel,gun,[0,-.15,.22],[-.22,0,0]);
  // Port, bolt face, pins and a small rear sight keep the receiver readable close up.
  box([.007,.1,.25],rubber,gun,[.128,.055,.12]);
  box([.012,.067,.16],steel,gun,[.132,.055,.085]);
  for(const z of [-.025,.38])part(new THREE.CylinderGeometry(.018,.018,.012,8),rubber,gun,[.135,-.015,z],[0,0,Math.PI/2]);
  box([.115,.045,.035],rubber,gun,[0,.2,.36]);
  // Fore-end slides back along the barrel; the six grooves move with it.
  const foreBase=new THREE.CylinderGeometry(.11,.11,.57,12,12),foreGeometry=foreBase.toNonIndexed();foreBase.dispose();
  const forePositions=foreGeometry.attributes.position,foreColors=new Float32Array(forePositions.count*3);
  const grooveColor=new THREE.Color(0x78441f),woodColor=new THREE.Color(0xb56b35);
  for(let i=0;i<forePositions.count;i+=3){
    const centerY=(forePositions.getY(i)+forePositions.getY(i+1)+forePositions.getY(i+2))/3;
    const band=Math.floor((centerY+.285)/.57*12);
    const color=band%2?woodColor:grooveColor;
    for(let j=0;j<3;j++)color.toArray(foreColors,(i+j)*3);
  }
  foreGeometry.setAttribute('color',new THREE.BufferAttribute(foreColors,3));
  part(foreGeometry,foreWood,pump,[0,-.035,-.79],[Math.PI/2,0,0]);
  for(const x of [-.083,.083])box([.025,.035,.62],trim,pump,[x,-.03,-.31]);
  for(const {style,parent,parts} of builds.values()){
    const total=parts.reduce((n,g)=>n+g.attributes.position.count,0),p=new Float32Array(total*3),n=new Float32Array(total*3),colors=style.mat.vertexColors?new Float32Array(total*3):null;
    let at=0;for(const g of parts){p.set(g.attributes.position.array,at);n.set(g.attributes.normal.array,at);if(colors)colors.set(g.attributes.color.array,at);at+=g.attributes.position.array.length;g.dispose();}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(p,3));geometry.setAttribute('normal',new THREE.BufferAttribute(n,3));if(colors)geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeBoundingSphere();geometries.add(geometry);
    const mesh=new THREE.Mesh(geometry,style.mat);mesh.name=parent===pump?'shotgun-pump-detail':'shotgun-body-detail';mesh.renderOrder=0;mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;parent.add(mesh);
  }
  }
  // One compact three-dimensional star flash, reused for every shot.
  const flashPositions=[];
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,b=(i+1)*Math.PI/4,r=i%2?.035:.13,s=(i+1)%2?.035:.13;
    flashPositions.push(0,0,-.22,Math.cos(a)*r,Math.sin(a)*r,0,Math.cos(b)*s,Math.sin(b)*s,0);
  }
  const flashGeometry=new THREE.BufferGeometry();flashGeometry.setAttribute('position',new THREE.Float32BufferAttribute(flashPositions,3));geometries.add(flashGeometry);
  const flashMaterial=new THREE.MeshBasicMaterial({color:0xffcf77,transparent:true,opacity:1,depthTest:true,depthWrite:false,fog:false,toneMapped:false,side:THREE.DoubleSide});materials.add(flashMaterial);
  const flash=new THREE.Mesh(flashGeometry,flashMaterial);flash.name='shotgun-muzzle-flash';flash.position.copy(muzzlePoint);flash.renderOrder=1008;flash.frustumCulled=false;flash.visible=false;gun.add(flash);
  // Four permanently allocated, red-and-brass spent cartridges; no mesh per fire.
  const bodySource=new THREE.CylinderGeometry(.033,.033,.15,8,1),baseSource=new THREE.CylinderGeometry(.036,.036,.03,8,1);
  const caseBody=bodySource.toNonIndexed(),caseBase=baseSource.toNonIndexed();bodySource.dispose();baseSource.dispose();
  caseBody.rotateX(Math.PI/2);caseBase.rotateX(Math.PI/2);caseBase.translate(0,0,.082);
  const count=caseBody.attributes.position.count+caseBase.attributes.position.count;
  const shellPositions=new Float32Array(count*3),shellNormals=new Float32Array(count*3),shellColors=new Float32Array(count*3);
  let cursor=0;
  for(const [geometry,hex] of [[caseBody,0xb64729],[caseBase,0xc79c45]]){
    shellPositions.set(geometry.attributes.position.array,cursor);shellNormals.set(geometry.attributes.normal.array,cursor);
    const color=new THREE.Color(hex);for(let i=0;i<geometry.attributes.position.count;i++)color.toArray(shellColors,cursor+i*3);
    cursor+=geometry.attributes.position.array.length;geometry.dispose();
  }
  const shellGeometry=new THREE.BufferGeometry();shellGeometry.setAttribute('position',new THREE.BufferAttribute(shellPositions,3));shellGeometry.setAttribute('normal',new THREE.BufferAttribute(shellNormals,3));shellGeometry.setAttribute('color',new THREE.BufferAttribute(shellColors,3));geometries.add(shellGeometry);
  const shellMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.58,metalness:.35,transparent:false,opacity:1,depthTest:true,depthWrite:true,fog:false});materials.add(shellMaterial);
  const shells=new THREE.InstancedMesh(shellGeometry,shellMaterial,POOL);shells.name='shotgun-shell-pool';shells.renderOrder=0;shells.frustumCulled=false;shells.visible=false;shells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(shells);
  root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});overlayScene.add(root);
  // A tiny stable light rig lives with the camera-relative prop, independently
  // of campus lights/shadows. The opaque meshes now occlude each other normally.
  root.add(new THREE.HemisphereLight(0xe1edf5,0x4b3430,1.8));
  const key=new THREE.DirectionalLight(0xffefd8,2.4);key.position.set(-2,3,3);key.target=gun;root.add(key);
  const fill=new THREE.DirectionalLight(0xb7d5ef,1.2);fill.position.set(2,1,-2);fill.target=gun;root.add(fill);
  const mountedGeometries=new Set(),mountedMaterials=new Set();
  let meshCount=0,triangles=0;root.traverse(o=>{if(o.isMesh){mountedGeometries.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:[o.material])mountedMaterials.add(material);meshCount++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?POOL:1);}});
  function pose(dt) {
    const blend=dt>0?1-Math.exp(-dt*16):1;
    currentX+=(aimX-currentX)*blend;currentY+=(aimY-currentY)*blend;
    // Solve the root anchor through the real projection matrix, including the game's HUD view offset.
    const p=camera.projectionMatrix.elements,depth=2,halfX=depth/p[0],halfY=depth/p[5];
    root.position.set((.63+p[8])*halfX,(-.76+p[9])*halfY,-depth);
    camera.getWorldQuaternion(worldRotation);camera.getWorldPosition(worldPosition);
    root.position.applyQuaternion(worldRotation).add(worldPosition);root.quaternion.copy(worldRotation);
    modelScale=Math.min(halfY*.73,halfX*.73);gun.scale.setScalar(modelScale);
    const recoil=age>=0&&age<.14?Math.sin(Math.PI*Math.min(1,age/.14))*(reducedMotion?.018:.095):0;
    gun.position.set(0,-recoil*.12,recoil);
    gun.rotation.set(Math.atan2(.76*halfY,6)+currentY*.07+recoil*.6,Math.atan2(.63*halfX,6)-currentX*.09,-.075-currentX*.012);
    let stroke=0;
    if(age>=.24&&age<.39)stroke=(age-.24)/.15;
    else if(age>=.39&&age<.58)stroke=1-(age-.39)/.19;
    pump.position.z=pumpRestZ+Math.sin(Math.max(0,stroke)*Math.PI/2)*.25;
    flash.visible=visible&&age>=0&&age<.055;
    flash.scale.setScalar(reducedMotion?.38:1);flashMaterial.opacity=reducedMotion?.38:Math.max(0,1-age/.055);
    gun.updateMatrix();
  }
  function shellMatrices(){
    let active=0;
    for(let i=0;i<POOL;i++){
      const s=shellStates[i];
      if(s.active){active++;dummy.position.set(s.x+s.vx*s.age,s.y+s.vy*s.age-modelScale*1.8*s.age*s.age,s.z+s.vz*s.age);dummy.rotation.set(s.age*8,s.age*11,s.age*5);dummy.scale.setScalar(modelScale*(s.age>SHELL_LIFE-.14?(SHELL_LIFE-s.age)/.14:1));}
      else{dummy.position.set(0,0,0);dummy.rotation.set(0,0,0);dummy.scale.setScalar(0);}
      dummy.updateMatrix();shells.setMatrixAt(i,dummy.matrix);
    }
    shells.visible=visible&&active>0;shells.instanceMatrix.needsUpdate=true;
  }
  function clearAction(){age=-1;ejected=false;flash.visible=false;pump.position.z=pumpRestZ;gun.position.set(0,0,0);for(const s of shellStates)s.active=false;shellMatrices();}
  function setVisible(value){if(disposed||visible===!!value)return;visible=!!value;root.visible=visible;if(!visible)clearAction();else pose(0);}
  function setAim(value={}){
    if(disposed)return;
    if(Number.isFinite(value.width)&&value.width>0)width=value.width;
    if(Number.isFinite(value.height)&&value.height>0)height=value.height;
    if(width&&Number.isFinite(value.x))aimX=Math.max(-1,Math.min(1,value.x/width*2-1));
    if(height&&Number.isFinite(value.y))aimY=Math.max(-1,Math.min(1,1-value.y/height*2));
  }
  function fire(){if(disposed||!visible||age>=0&&age<READY)return false;age=0;ejected=false;shots++;pose(0);return true;}
  function update(dt=0){
    if(disposed||!visible)return;
    const elapsed=Number.isFinite(dt)?Math.max(0,Math.min(5,dt)):0;
    for(const s of shellStates)if(s.active){s.age+=elapsed;if(s.age>=SHELL_LIFE)s.active=false;}
    if(age>=0)age+=elapsed;
    pose(elapsed);
    if(age>=EJECT&&!ejected){
      ejected=true;
      if(age-EJECT<SHELL_LIFE){
        const s=shellStates.find(s=>!s.active)||shellStates[0];ejectPoint.copy(ejectionPoint).applyMatrix4(gun.matrix);
        const velocity=reducedMotion?.5:1;
        Object.assign(s,{active:true,age:age-EJECT,x:ejectPoint.x,y:ejectPoint.y,z:ejectPoint.z,vx:modelScale*1.65*velocity,vy:modelScale*.95*velocity,vz:modelScale*.35});createdShells++;
      }
    }
    if(age>=READY)age=-1;
    if(shells.visible||shellStates.some(s=>s.active))shellMatrices();
  }
  function reset(){if(disposed)return;clearAction();aimX=aimY=currentX=currentY=0;pose(0);}
  function dispose(){if(disposed)return;clearAction();disposed=true;visible=false;root.visible=false;overlayScene.remove(root);shells.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();modelInstance?.dispose();modelAsset?.dispose();overlayScene.clear();}
  function render(renderer){
    if(disposed||!visible)return false;
    overlayCamera.projectionMatrix.copy(camera.projectionMatrix);overlayCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    overlayCamera.matrixWorld.copy(camera.matrixWorld);overlayCamera.matrixWorldInverse.copy(camera.matrixWorldInverse);overlayCamera.near=camera.near;overlayCamera.far=camera.far;
    const autoClear=renderer.autoClear;
    try{renderer.autoClear=false;renderer.clearDepth();renderer.render(overlayScene,overlayCamera);}finally{renderer.autoClear=autoClear;}
    return true;
  }
  return {setVisible,setAim,fire,update,reset,dispose,render,overlayScene,
    get animating(){return !disposed&&visible&&(age>=0||shellStates.some(s=>s.active)||Math.abs(currentX-aimX)+Math.abs(currentY-aimY)>.001);},
    get stats(){return {visible:visible&&!disposed,ready:!disposed&&visible&&age<0,age,pumpOffset:pump.position.z-pumpRestZ,modelLoaded:!!modelInstance,modelSource:modelInstance?'blender-gltf':'procedural-fallback',activeShells:shellStates.filter(s=>s.active).length,createdShells,shots,meshCount,triangles,geometryCount:mountedGeometries.size,materialCount:mountedMaterials.size,poolCapacity:POOL,disposed,flashVisible:flash.visible};},
  };
}
