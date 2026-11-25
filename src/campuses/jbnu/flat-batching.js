// R5: share only otherwise identical, opaque untextured solid materials within
// one destructible general building. Original colour becomes a vertex attribute.
// Geometry, glass/decor classifications, textures and protected objects stay exact.
const GENERAL_IDS = new Set(["b115951745","b115951746","b115951747","b115951748","b115951750","b115951751","b115951752","b115951753","b115951754","b115951755","b115951756","b115951757","b115951758","b115951759","b115951760","b115951761","b115951762","b115951763","b115951764","b115951766","b115951768","b115951770","b115951773","b115951774","b115951775","b115951776","b115951778","b115951779","b115951781","b115951782","b115951783","b115951784","b115951786","b115951787","b115951788","b115951790","b115951791","b115951792","b115951794","b115951799","b115951800","b115951803","b115951804","b115951806","b115951807","b115951808","b115951813","b115951815","b115951816","b115951817","b115951818","b115951819","b115951821","b115951822","b115951823","b115951824","b115951825","b115951826","b115951827","b115951828","b115951829","b115951832","b117908732","b117908733","b117908739","b117908745","b117912025","b470140010","b470144647","b470144649","b743633083","b743648652","b876428420","b968357470","b1293436254","b1299259734","b1299259735","b1367280820","b1389446813","b1554173625","b1557353110","b1557353114","b1557353117","b1557353121","b6953118","b36807585","b115951749","b115951780","b115951793","b115951801","b115951805","b115951830","b115951831","b117903329","b117903332","b117903335","b117903344","b117912026","b472625473","b472625484","b743641874","b743648654","b743648655","b743648656","b743648658","b743648659","b743648660","b743648661","b743648662","b981579179","b981579190","b981579191","b1228625126","b1389446812","b16784614","b16784615"]);
const SPECIAL = /glass|ivy|flag|lawn|pole|membrane|seating|water|leaf|tree/i;
function finishClass(name) {
  const n=name.toLowerCase();
  return /stone|concrete|limestone|coping|pale|plaster|render|stucco/.test(n)&&!/joint/.test(n)?'stone':/roof|slate/.test(n)?'roof':'solid';
}
export function batchJbnuFlatMaterials(THREE, id, scene) {
  const ownedGeometry=[],ownedMaterials=[],groups=new Map();
  const stats={flatBatching:true,meshes:0,materialsBefore:0,materialsAfter:0};
  const dispose=()=>{for(const g of ownedGeometry)g.dispose();for(const m of ownedMaterials)m.dispose();};
  if(!GENERAL_IDS.has(id))return {stats:{flatBatching:false},dispose};
  scene.traverse(mesh=>{
    const m=mesh.material,g=mesh.geometry;
    if(!mesh.isMesh||!g?.attributes?.position||Array.isArray(m)||!m?.isMeshStandardMaterial||m.transparent||m.opacity!==1||m.vertexColors||SPECIAL.test(m.name)||Object.values(m).some(v=>v?.isTexture)||m.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile)return;
    const json=m.toJSON();delete json.metadata;delete json.uuid;delete json.name;delete json.color;
    const key=JSON.stringify([json,finishClass(m.name)]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
  });
  for(const meshes of groups.values()){
    const originals=new Set(meshes.map(x=>x.material));if(originals.size<2)continue;
    const shared=meshes[0].material.clone();shared.color.setRGB(1,1,1);shared.vertexColors=true;
    shared.name=`${id}__r5-solid-batch-${finishClass(meshes[0].material.name)}-${ownedMaterials.length}`;ownedMaterials.push(shared);
    stats.materialsBefore+=originals.size;stats.materialsAfter++;
    for(const mesh of meshes){
      const source=mesh.material,g=mesh.geometry.clone(),n=g.attributes.position.count,color=new Float32Array(n*3);
      for(let i=0;i<n;i++){color[i*3]=source.color.r;color[i*3+1]=source.color.g;color[i*3+2]=source.color.b;}
      g.setAttribute('color',new THREE.BufferAttribute(color,3));ownedGeometry.push(g);mesh.geometry=g;mesh.material=shared;stats.meshes++;
    }
  }
  return {stats,dispose};
}
