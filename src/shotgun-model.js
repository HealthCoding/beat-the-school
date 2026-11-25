import {GLTFLoader} from '../vendor/model-assets/GLTFLoader.js';

export const SHOTGUN_MODEL_URL=new URL('../assets/weapons/shotgun/model.gltf',import.meta.url).href;

// The template owns geometry/textures; instances own their trees and material
// copies. A requested asset disposal waits for any still-mounted instances.
export async function loadShotgunModel(THREE,{url=SHOTGUN_MODEL_URL,fetchImpl=globalThis.fetch,loaderFactory=()=>new GLTFLoader()}={}){
 const geometries=new Set(),materials=new Set(),textures=new Set(),images=new Set(),instances=new Set();
 let template=null,parser=null,closing=false,released=false;
 function remember(value){
  if(!value)return;
  if(value.isBufferGeometry)geometries.add(value);
  if(value.isTexture){textures.add(value);if(value.source?.data)images.add(value.source.data);}
  if(value.isMaterial){materials.add(value);for(const field of Object.values(value))if(field?.isTexture)remember(field);}
  if(value.isObject3D)value.traverse(object=>{remember(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])remember(material);});
 }
 async function collectParser(){
  if(!parser)return;
  const pending=[];
  for(const [kind,list]of [['mesh',parser.json?.meshes],['material',parser.json?.materials],['texture',parser.json?.textures]])
   (list||[]).forEach((_,index)=>{const promise=parser.cache?.get(`${kind}:${index}`);if(promise)pending.push(promise);});
  for(const result of await Promise.allSettled(pending))if(result.status==='fulfilled')remember(result.value);
  for(const record of Object.values(parser.primitiveCache||{})){try{remember(await record.promise);}catch{}}
 }
 function release(){
  if(released||!closing||instances.size)return;
  released=true;for(const resource of [...geometries,...materials,...textures])resource.dispose();for(const image of images)image.close?.();
  template=null;geometries.clear();materials.clear();textures.clear();images.clear();
 }
 try{
  const response=await fetchImpl(url);if(!response?.ok)throw Error(`Shotgun model unavailable (${response?.status??'network'})`);
  const definition=await response.json(),loader=loaderFactory();
  loader.register?.(value=>{parser=value;return{name:'ShotgunResourceOwnership'};});
  const gltf=await loader.parseAsync(JSON.stringify(definition),new URL('./',url).href);template=gltf.scene;remember(template);
  await collectParser();
  if(!template?.isObject3D)throw Error('Shotgun model has no scene');
  if(definition.images?.length&&!textures.size)throw Error('Shotgun model texture failed to load');
  for(const name of ['ShotgunBody','ShotgunPump','Muzzle','EjectionPort'])if(!template.getObjectByName(name))throw Error(`Shotgun model missing ${name}`);
  template.updateMatrixWorld(true);
  const pump=template.getObjectByName('ShotgunPump');
  if(pump.quaternion.angleTo(new THREE.Quaternion())>1e-5||pump.scale.distanceTo(new THREE.Vector3(1,1,1))>1e-5)throw Error('Shotgun pump must use unrotated unit local axes');
  let meshes=0,triangles=0;template.traverse(object=>{if(object.isMesh){meshes++;triangles+=(object.geometry.index?.count||object.geometry.attributes.position?.count||0)/3;}});
  if(!meshes||!Number.isFinite(triangles))throw Error('Shotgun model has no drawable geometry');
  const metadata={source:'blender-gltf',meshes,triangles,textures:textures.size,materials:materials.size};
  return {
   createInstance(){
    if(closing||released)throw Error('Disposed shotgun asset cannot create instances');
    const root=template.clone(true),owned=new Map();
    root.traverse(object=>{
     if(!object.isMesh)return;
     const cloneMaterial=material=>{
      if(!owned.has(material)){const copy=material.clone();copy.transparent=false;copy.opacity=1;copy.depthTest=true;copy.depthWrite=true;copy.fog=false;owned.set(material,copy);}return owned.get(material);
     };
     object.material=Array.isArray(object.material)?object.material.map(cloneMaterial):cloneMaterial(object.material);
     object.renderOrder=0;object.castShadow=false;object.receiveShadow=false;object.frustumCulled=false;
    });
    root.updateMatrixWorld(true);const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert();
    const marker=name=>root.getObjectByName(name).getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
    const instance={root,pump:root.getObjectByName('ShotgunPump'),muzzle:marker('Muzzle'),ejectionPort:marker('EjectionPort'),disposed:false,
     dispose(){if(instance.disposed)return;instance.disposed=true;root.removeFromParent();root.clear();for(const material of owned.values())material.dispose();owned.clear();instances.delete(instance);release();}};
    instances.add(instance);return instance;
   },
   dispose(){closing=true;release();},
   get stats(){return {...metadata,instances:instances.size,disposed:released,disposalRequested:closing};},
  };
 }catch(error){await collectParser();closing=true;release();throw error;}
}
