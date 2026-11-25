// Sungeui's authored one-metre cuts and outdoor supports stay fixed on removal.
// The finale must borrow those exact triangles, not the generic 4 m proxy.
import {createBakedGround as commonGround} from '../../engine/baked-ground.js';
import {SUNGEUI_SCORCH_MASK_FILE} from './scorch-mask.js?v=sungeui-r20';
import {decodeScorchMask} from './scorch-mask-codec.js?v=sungeui-r20';
import {clipExposed} from './scorch-clip.js?v=sungeui-r19';
// Finish-18 (Astra 18 SUN-53): the shared finale draws this proxy as the nuke scorch lifted 0.065 world units (0.13 m
// here). Ground triangles lying under a shallow site slab / stone toe / planted top (within 0.3 m) then rose through
// it as grey triangles after the nuke. The scorch copy is fitted to the authored site surfaces instead:
//  - a ground triangle covered by such a surface at its centre and three inner points is left out of the copy (the
//    slab hides it anyway);
//  - the up-facing site surfaces themselves (slab / toe / paving / stair / coping tops) are added to the copy, so they
//    burn with the ground round them instead of being overdrawn by a lifted ground sheet;
//  - the whole copy takes ONE small lift (NET_LIFT_M over the drawn surfaces; the finale's 0.13 m is taken back) on top
//    of the scorch's own polygon offset: a sheet lifted in one place and flat in the next showed through itself as a
//    dark double band at grazing views, and 0.13 m rose through 3-5 cm slabs.
// Which triangles drop / join is precomputed from the packed models by scripts/campuses/sungeui/make-scorch-mask.mjs
// (build-package) into the mask (now assets/campuses/sungeui/scorch-mask.bin, see below); if a mesh fingerprint does not match (a model changed without rebuilding the
// mask) the same fit runs here at load as before (legacyFit). Site layers the finale clears never count.
// Finish-19 (Astra 19 SUN-53): a ground triangle only partly under a site surface was kept or dropped whole by four sample
// points, so the covered part of a triangle sloping 4-19 cm under the C slab stayed in the copy and the polygon offset
// pulled it through the slab as thin dark triangle lines.  Covered parts (-1 cm .. +0.3 m under a site surface) are now
// cut away exactly (scorch-clip.js): partly covered triangles are replaced by their exposed pieces, and site surfaces
// lying 0.5 cm .. 0.3 m under another site surface are clipped the same way.
const FINALE_LIFT = .065, NET_LIFT_M = 0, COVER_M = .3, UNDER_M = .05, TOUCH_M = .05, UP = .3, COVER_LO_M = .005, CLIP_EPS_M2 = 1e-6;
const SKIP_LAYER = /^(env-ground|context|planting)/;
const CLEARED = /(?:^|[-_])(tree|trees|hedge|hedges|shrub|shrubs)(?:[-_]|$)|^(env-planting|detailed-campus-furniture|rounded-low-planting-beds)$/;
const THIN = /rail|lamp|sign|bench|crown|trunk|shrub|tree|hedge/i;
const now = () => (globalThis.performance ?? Date).now();
export function createBakedGround(THREE,options){
 const result=commonGround(THREE,{...options,flatCleared:null});
 const proxy=result.group.getObjectByName('continuous-estimated-terrain');
 const ground=result.group.getObjectByName('env-ground');
 result.group.updateMatrixWorld(true);
 const W=options.worldUnitsPerMeter||.5,inverse=proxy.matrixWorld.clone().invert(),meshes=[];
 // Finish-15: 'tape-ground' holds the plain grid triangles under the split wall-foot cells for the hazard tape only
 const tapeGround=ground.getObjectByName('tape-ground');if(tapeGround)tapeGround.visible=false;
 ground.traverse(o=>{if(!o.isMesh||!o.geometry?.attributes.position||o===tapeGround)return;
  for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m?.map){m.map.anisotropy=8;m.map.needsUpdate=true;}
  meshes.push(o);
 });
 const lift=FINALE_LIFT/Math.max(1e-9,Math.abs(proxy.getWorldScale(new THREE.Vector3()).y))-NET_LIFT_M*W;
 // 그을음압축 (11-12): the precomputed fit is a binary asset (assets/campuses/sungeui/scorch-mask.bin, 0.35 MB) fetched
 // when the game is ready and the page is idle, so it is no longer on the start path.  Until it is in, the proxy holds a
 // placeholder (below); the shared finale draws the scorch with this very geometry object (campus-finale.js
 // `new THREE.Mesh(ground.geometry, ...)`), so the fit replaces its attributes in place.  A nuke used before the mask is
 // in waits for it (the scorch fills in when it arrives); only a failed fetch / decode or a fingerprint mismatch runs the
 // same fit at load cost (legacyFit), spread over frames.
 let fitted=false,disposed=false,running=false;
 const apply=fit=>{
  if(fitted||disposed)return;fitted=true;const g=proxy.geometry;
  // the placeholder's GPU buffers go first; the renderer uploads the new attributes when it next draws the scorch (always
  // between frames here: a fetch / timer callback, never inside a render)
  g.dispose();g.setAttribute('position',new THREE.BufferAttribute(fit.positions,3));g.setIndex(new THREE.BufferAttribute(fit.indices,1));
  g.computeBoundingBox();g.computeBoundingSphere();
  result.stats.scorchTriangles=fit.indices.length/3;
  result.stats.scorchFit={mode:fit.mode,phases:fit.phases,vertices:fit.vertices,scaled:fit.scaled,coverTriangles:fit.cover,dropped:fit.dropped,piecePolygons:fit.pieces,netLift_m:NET_LIFT_M,ms:fit.ms,at:fit.at,slices:fit.slices,longestSlice_ms:fit.longest,scorchShownBefore:fit.shown};
 };
 // 보완 (11-12): the load-time fit (mask failed / fingerprint mismatch only) runs in slices of about 8 ms, one per task,
 // so the page keeps drawing; the scorch stays empty until it is done (the finale's burn radius keeps growing meanwhile)
 const loadFit=at=>{if(running||fitted||disposed)return;running=true;const t0=now();result.stats.scorchFit={mode:'load-running',at};
  const steps=(function*(){const positions=[],indices=[],point=new THREE.Vector3();
   for(const o of meshes){yield;const g=o.geometry,p=g.attributes.position,offset=positions.length/3,matrix=inverse.clone().multiply(o.matrixWorld);
    for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(matrix);positions.push(point.x,point.y,point.z);}
    if(g.index)for(const i of g.index.array)indices.push(offset+i);else for(let i=0;i<p.count;i++)indices.push(offset+i);}
   const fit=yield* legacyFitSteps(THREE,proxy,inverse,positions,indices,W,lift);fit.positions=new Float32Array(positions);fit.indices=new Uint32Array(fit.indices);return fit;})();
  let slices=0,longest=0;
  const tick=()=>{if(disposed)return;const s0=now();let r;do r=steps.next();while(!r.done&&now()-s0<8);slices++;longest=Math.max(longest,now()-s0);
   if(!r.done){setTimeout(tick,0);return;}
   const fit=r.value;fit.ms=Math.round(now()-t0);fit.at=at;fit.slices=slices;fit.longest=Math.round(longest);fit.shown=!!scorchMesh()?.visible;running=false;apply(fit);};
  setTimeout(tick,0);};
 // the finale's scorch mesh (shares the proxy geometry), for the stats only
 let scorchRef=null;const scorchMesh=()=>{if(scorchRef)return scorchRef;let root=proxy;while(root.parent)root=root.parent;root.traverse(o=>{if(!scorchRef&&o.isMesh&&o!==proxy&&o.geometry===proxy.geometry)scorchRef=o;});return scorchRef;};
 // Until then the proxy holds only two unindexed corner points: nothing is drawn, but its bounding box (the finale reads
 // it when the nuke starts, for the burn radius) is the fitted copy's -- the copy holds every ground vertex.
 {const box=new THREE.Box3(),b=new THREE.Box3(),m=new THREE.Matrix4();
  const exact=new Map();for(const o of meshes){const g=o.geometry,a=g.attributes.position;let bb=exact.get(a);if(!bb){exact.set(a,bb=new THREE.Box3().setFromBufferAttribute(a));}box.union(b.copy(bb).applyMatrix4(m.copy(inverse).multiply(o.matrixWorld)));}
  box.min.y-=lift;box.max.y-=lift;const g=proxy.geometry;g.dispose();
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array([box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z]),3));g.setIndex(new THREE.BufferAttribute(new Uint32Array(0),1));
  g.computeBoundingBox();g.computeBoundingSphere();}
 result.stats.authoredClearedSurface=true;result.stats.scorchUsesAuthoredTriangles=true;result.stats.scorchFit={mode:'pending'};
 const idle=f=>globalThis.requestIdleCallback?requestIdleCallback(f,{timeout:3000}):setTimeout(f,50);
 // a nuke used while the mask is still on its way draws no scorch until it arrives (no work on the main thread meanwhile)
 const start=()=>{
  if(fitted||disposed)return;result.stats.scorchFit={mode:'fetching'};
  const url=new URL(`../../../assets/campuses/sungeui/${SUNGEUI_SCORCH_MASK_FILE.file}?v=${SUNGEUI_SCORCH_MASK_FILE.hash}`,import.meta.url);
  fetch(url).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.arrayBuffer();}).then(buf=>new Promise(res=>idle(()=>res(buf)))).then(buf=>{
   if(fitted||disposed)return;const t0=now(),M=decodeScorchMask(buf),fit=maskFit(THREE,proxy,meshes,inverse,lift,M);
   if(!fit){loadFit('fingerprint-mismatch');return;}
   fit.ms=Math.round(now()-t0);fit.at='idle';fit.shown=!!scorchMesh()?.visible;apply(fit);
  }).catch(e=>{console.warn('Sungeui scorch mask skipped',e);loadFit('mask-failed');});
 };
 // wait for the game's ready state (main.js window.gameLoadState), then the first idle slot
 const wait=()=>{if(disposed||fitted)return;if(globalThis.gameLoadState?.().phase==='ready')idle(start);else setTimeout(wait,250);};
 if(typeof window!=='undefined')setTimeout(wait,0);
 const dispose0=result.dispose;if(typeof dispose0==='function')result.dispose=function(...a){disposed=true;return dispose0.apply(this,a);};
 result.stats.scorchMaskFile=SUNGEUI_SCORCH_MASK_FILE;
 return result;
}
// geometry fingerprint shared with make-scorch-mask.mjs: layer | index count | first and last indexed vertex (mm)
function fingerprint(layer,g){const p=g.attributes.position,ix=g.index;if(p.isInterleavedBufferAttribute||p.normalized||p.itemSize!==3)return null;const n=ix?ix.count:p.count,r=k=>{const v=ix?ix.getX(k):k;return Math.round(p.getX(v)*1000)+','+Math.round(p.getY(v)*1000)+','+Math.round(p.getZ(v)*1000);};return layer+'|'+n+'|'+r(0)+'|'+r(n-1);}
// a uniform scale + translation: one flat pass (most of the copy)
function copyScaled(P,o,a,n,s,tx,ty,tz){for(let i=0;i<n;i+=3){P[o+i]=a[i]*s+tx;P[o+i+1]=a[i+1]*s+ty;P[o+i+2]=a[i+2]*s+tz;}}
function unruns(runs,f){let s=0;for(let i=0;i<runs.length;i+=2){s+=runs[i];for(let k=0;k<runs[i+1];k++)f(s+k);s+=runs[i+1];}}
// fan triangle (P indices a, b, c) wound to face up (+y), as the cover triangles are
function upTri(P,I,pi,a,b,c){const ny=(P[b*3+2]-P[a*3+2])*(P[c*3]-P[a*3])-(P[b*3]-P[a*3])*(P[c*3+2]-P[a*3+2]);I[pi]=a;if(ny>=0){I[pi+1]=b;I[pi+2]=c;}else{I[pi+1]=c;I[pi+2]=b;}}
function maskFit(THREE,proxy,meshes,inverse,lift,M){
 if(!M?.drop||!M?.cover||!M.pieces||!M.pieceCounts)return null;const ph=[now()];
 const holder=proxy.children.find(c=>c.name==='baked-environment')||proxy,e=new THREE.Matrix4();
 // ground meshes and their dropped triangles
 // the ground parts share one position buffer (build-package): each distinct buffer + transform is copied once
 const G=[],seenDrop=new Set(),shared=new Map();let nv=0,nt=0;
 for(const o of meshes){const g=o.geometry,k=fingerprint('env-ground',g);if(!k)return null;const n=g.index.count/3,runs=M.drop[k]||[];
  // kept triangle blocks [start, end) = the gaps between the dropped runs
  const keepBlocks=[];let s0=0,c=0,nd=0;for(let i=0;i<runs.length;i+=2){c+=runs[i];if(c>s0)keepBlocks.push(s0,c);c+=runs[i+1];nd+=runs[i+1];s0=c;}if(n>s0)keepBlocks.push(s0,n);
  if(runs.length)seenDrop.add(k);
  // same BufferAttribute object (an accessor shared by several parts) under the same transform = one copy
  let byM=shared.get(g.attributes.position);if(!byM)shared.set(g.attributes.position,byM=new Map());const ms=o.matrixWorld.elements.join(',');let sk=byM.get(ms);
  if(!sk){sk={o};byM.set(ms,sk);nv+=g.attributes.position.count;}
  G.push([o,keepBlocks,nd,sk]);nt+=n-nd;}
 if(seenDrop.size!==Object.keys(M.drop).length)return null;ph.push(now());
 // site meshes that carry cover triangles
 const S=[],seenCover=new Set();let nc=0;
 for(const layer of holder.children){if(SKIP_LAYER.test(layer.name||''))continue;
  layer.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||!o.geometry?.attributes.position)return;const k=fingerprint(layer.name,o.geometry),runs=k&&M.cover[k];if(!runs)return;
   seenCover.add(k);const list=[];unruns(runs,t=>list.push(t));S.push([o,list]);nc+=list.length;});}
 if(seenCover.size!==Object.keys(M.cover).length)return null;
 const PC=M.pieceCounts,PV=M.pieces;let npt=0;for(const n of PC)npt+=n-2;ph.push(now());
 const P=new Float32Array((nv+nc*3+PV.length/3)*3),I=new Uint32Array((nt+nc+npt)*3);let pv=0,pi=0,dropped=0;
 const offsets=new Map();let nScaled=0;
 for(const [o,keepBlocks,nd,sk] of G){const g=o.geometry,p=g.attributes.position,a=p.array,ix=g.index.array;let off=offsets.get(sk);
  if(off===undefined){off=pv;offsets.set(sk,off);e.copy(inverse).multiply(o.matrixWorld);const m=e.elements;
   if(Math.abs(m[1])+Math.abs(m[2])+Math.abs(m[4])+Math.abs(m[6])+Math.abs(m[8])+Math.abs(m[9])<1e-12&&Math.abs(m[0]-m[5])<1e-9&&Math.abs(m[5]-m[10])<1e-9&&(nScaled++,true))copyScaled(P,pv*3,a,p.count*3,m[0],m[12],m[13]-lift,m[14]);
   else for(let v=0;v<p.count;v++){const x=a[v*3],y=a[v*3+1],z=a[v*3+2],q=(pv+v)*3;P[q]=m[0]*x+m[4]*y+m[8]*z+m[12];P[q+1]=m[1]*x+m[5]*y+m[9]*z+m[13]-lift;P[q+2]=m[2]*x+m[6]*y+m[10]*z+m[14];}
   pv+=p.count;}
  // kept triangle blocks: a plain block copy where the buffer starts at 0, else offset per index
  dropped+=nd;for(let b=0;b<keepBlocks.length;b+=2){const t=keepBlocks[b],u=keepBlocks[b+1];
   if(off===0){I.set(ix.subarray(t*3,u*3),pi);pi+=(u-t)*3;}else for(let k=t*3;k<u*3;k++)I[pi++]=off+ix[k];}}
 for(const [o,list] of S){const g=o.geometry,a=g.attributes.position.array,ix=g.index?g.index.array:null;e.copy(inverse).multiply(o.matrixWorld);const m=e.elements;
  for(const t of list){const o0=pv;
   for(let q=0;q<3;q++){const v=ix?ix[t*3+q]:t*3+q,x=a[v*3],y=a[v*3+1],z=a[v*3+2],w=pv*3;P[w]=m[0]*x+m[4]*y+m[8]*z+m[12];P[w+1]=m[1]*x+m[5]*y+m[9]*z+m[13]-lift;P[w+2]=m[2]*x+m[6]*y+m[10]*z+m[14];pv++;}
   const b=o0*3,ny=(P[b+5]-P[b+2])*(P[b+6]-P[b])-(P[b+3]-P[b])*(P[b+8]-P[b+2]);
   if(ny>=0){I[pi++]=o0;I[pi++]=o0+1;I[pi++]=o0+2;}else{I[pi++]=o0;I[pi++]=o0+2;I[pi++]=o0+1;}}}
 // exposed pieces (metres in the environment scene = holder space): one transform, fanned
 {e.copy(inverse).multiply(holder.matrixWorld);const m=e.elements;let q=0;
  for(const n of PC){const o0=pv;for(let k=0;k<n;k++,q+=3){const x=PV[q],y=PV[q+1],z=PV[q+2],w=pv*3;P[w]=m[0]*x+m[4]*y+m[8]*z+m[12];P[w+1]=m[1]*x+m[5]*y+m[9]*z+m[13]-lift;P[w+2]=m[2]*x+m[6]*y+m[10]*z+m[14];pv++;}
   for(let k=1;k+1<n;k++){upTri(P,I,pi,o0,o0+k,o0+k+1);pi+=3;}}}
 ph.push(now());
 return {mode:'mask',pieces:PC.length,positions:pv*3===P.length?P:P.subarray(0,pv*3),indices:I,cover:nc,dropped,phases:ph.slice(1).map((t,i)=>Math.round(t-ph[i])),vertices:pv,scaled:nScaled};
}
// fallback: the same fit at load (the pre-mask code)
// the same fit run to the end at once (offline tools)
function legacyFit(...a){const g=legacyFitSteps(...a);let r;while(!(r=g.next()).done);return r.value;}
// 보완 (11-12): legacyFit as steps -- it yields every few thousand triangles / per site mesh so the page can spread it
// over frames (runSteps); the order of work and so the result are the pre-split code's
function* legacyFitSteps(THREE,proxy,inverse,P,I,W,lift){
 const EPS=CLIP_EPS_M2*W*W,polys=[];
 const holder=proxy.children.find(c=>c.name==='baked-environment')||proxy,C=[],cell=W,buckets=new Map(),e=new THREE.Matrix4();
 const key=(i,j)=>(i+32768)*65536+(j+32768);
 const cleared=o=>{for(let x=o;x&&x!==holder;x=x.parent)if(CLEARED.test(x.name||'')||x.userData?.finale==='remove')return true;return false;};
 const site=[];for(const layer of holder.children){if(SKIP_LAYER.test(layer.name||''))continue;
  layer.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||!o.geometry?.attributes.position||THIN.test(o.name||'')||cleared(o))return;site.push(o);});}
 for(const o of site){yield;{
   const pos=o.geometry.attributes.position,idx=o.geometry.index,n=idx?idx.count:pos.count;e.copy(inverse).multiply(o.matrixWorld);const m=e.elements;
   const t=new Float64Array(9);for(let k=0;k+2<n;k+=3){
    for(let q=0;q<3;q++){const v=idx?idx.getX(k+q):k+q,x=pos.getX(v),y=pos.getY(v),z=pos.getZ(v);t[q*3]=m[0]*x+m[4]*y+m[8]*z+m[12];t[q*3+1]=m[1]*x+m[5]*y+m[9]*z+m[13];t[q*3+2]=m[2]*x+m[6]*y+m[10]*z+m[14];}
    const ux=t[3]-t[0],uy=t[4]-t[1],uz=t[5]-t[2],vx=t[6]-t[0],vy=t[7]-t[1],vz=t[8]-t[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,nl=Math.hypot(nx,ny,nz);
    if(!(nl>1e-12)||Math.abs(ny)/nl<UP)continue;
    const i0=Math.floor(Math.min(t[0],t[3],t[6])/cell),i1=Math.floor(Math.max(t[0],t[3],t[6])/cell),j0=Math.floor(Math.min(t[2],t[5],t[8])/cell),j1=Math.floor(Math.max(t[2],t[5],t[8])/cell);
    if((i1-i0+1)*(j1-j0+1)>2500)continue;
    const id=C.push(t.slice())-1;for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const kk=key(i,j);let l=buckets.get(kk);if(!l)buckets.set(kk,l=[]);l.push(id);}
   }
  }}
 const out=[],low=new Uint8Array(P.length/3),ABOVE=COVER_M*W,BELOW=UNDER_M*W,HIDE_UNDER=.005*W,TOUCH=TOUCH_M*W;let dropped=0;
 // occupancy of the cover buckets on a flat array (most ground triangles lie far from any site surface: rejected here)
 let oi0=Infinity,oi1=-Infinity,oj0=Infinity,oj1=-Infinity;for(const kk of buckets.keys()){const i=Math.floor(kk/65536)-32768,j=kk%65536-32768;oi0=Math.min(oi0,i);oi1=Math.max(oi1,i);oj0=Math.min(oj0,j);oj1=Math.max(oj1,j);}
 const onx=Math.max(0,oi1-oi0+1),occ=new Uint8Array(onx*Math.max(0,oj1-oj0+1));for(const kk of buckets.keys())occ[(kk%65536-32768-oj0)*onx+Math.floor(kk/65536)-32768-oi0]=1;
 const any=(i0,i1,j0,j1)=>{if(i1<oi0||i0>oi1||j1<oj0||j0>oj1)return false;for(let j=Math.max(j0,oj0);j<=Math.min(j1,oj1);j++)for(let i=Math.max(i0,oi0);i<=Math.min(i1,oi1);i++)if(occ[(j-oj0)*onx+i-oi0])return true;return false;};
 // height of cover triangle t at (x, z), or null outside it (with a small plan tolerance)
 const at=(t,x,z,tol)=>{const d=(t[5]-t[8])*(t[0]-t[6])+(t[6]-t[3])*(t[2]-t[8]);if(Math.abs(d)<1e-14)return null;
  const a=((t[5]-t[8])*(x-t[6])+(t[6]-t[3])*(z-t[8]))/d,b=((t[8]-t[2])*(x-t[6])+(t[0]-t[6])*(z-t[8]))/d,c=1-a-b;
  if(a<-tol||b<-tol||c<-tol)return null;return a*t[1]+b*t[4]+c*t[7];};
 // plan overlap of two triangles (separating axis, edges of both), allowing `pad` of touching
 const SA=[0,0,0,0,0,0],SB=[0,0,0,0,0,0];
 const overlap=(A,B,pad)=>{for(const T of [A,B])for(let q=0;q<3;q++){const ax=T[(q*2+2)%6]-T[q*2],az=T[(q*2+3)%6]-T[q*2+1],nx=-az,nz=ax,l=Math.hypot(nx,nz);if(l<1e-12)continue;
   let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;for(let r=0;r<3;r++){const pa=(A[r*2]*nx+A[r*2+1]*nz)/l,pb=(B[r*2]*nx+B[r*2+1]*nz)/l;a0=Math.min(a0,pa);a1=Math.max(a1,pa);b0=Math.min(b0,pb);b1=Math.max(b1,pb);}
   if(a1+pad<b0||b1+pad<a0)return false;}return true;};
 const seen=new Int32Array(C.length).fill(-1);
 // Finish-19: every drawn ground triangle also hides what lies 0.5 cm .. 0.3 m under it (own lower bound as 10th value)
 const GLO=COVER_LO_M*W,GT=[],GB=new Map();
 for(let k=0;k+2<I.length;k+=3){if(k%12288===0)yield;const t=new Float64Array(10);for(let q=0;q<3;q++){const v=I[k+q];t[q*3]=P[v*3];t[q*3+1]=P[v*3+1];t[q*3+2]=P[v*3+2];}t[9]=GLO;const id=GT.push(t)-1;
  for(let i=Math.floor(Math.min(t[0],t[3],t[6])/cell);i<=Math.floor(Math.max(t[0],t[3],t[6])/cell);i++)for(let j=Math.floor(Math.min(t[2],t[5],t[8])/cell);j<=Math.floor(Math.max(t[2],t[5],t[8])/cell);j++){const kk=key(i,j);let l=GB.get(kk);if(!l)GB.set(kk,l=[]);l.push(id);}}
 const gseen=new Int32Array(GT.length).fill(-1);let gtick=0;
 const groundAbove=(t,self)=>{const ymin=Math.min(t[1],t[4],t[7]),ymax=Math.max(t[1],t[4],t[7]),res=[];gtick++;
  for(let i=Math.floor(Math.min(t[0],t[3],t[6])/cell);i<=Math.floor(Math.max(t[0],t[3],t[6])/cell);i++)for(let j=Math.floor(Math.min(t[2],t[5],t[8])/cell);j<=Math.floor(Math.max(t[2],t[5],t[8])/cell);j++){const l=GB.get(key(i,j));if(l)for(const id of l){
   if(id===self||gseen[id]===gtick)continue;gseen[id]=gtick;const u=GT[id];if(Math.max(u[1],u[4],u[7])<ymin+GLO||Math.min(u[1],u[4],u[7])>ymax+ABOVE)continue;res.push(u);}}
  return res;};
 for(let k=0;k+2<I.length;k+=3){if(k%3072===0)yield;const a=I[k],b=I[k+1],c=I[k+2];
  const xa=P[a*3],ya=P[a*3+1],za=P[a*3+2],xb=P[b*3],yb=P[b*3+1],zb=P[b*3+2],xc=P[c*3],yc=P[c*3+1],zc=P[c*3+2];
  const i0=Math.floor((Math.min(xa,xb,xc)-TOUCH)/cell),i1=Math.floor((Math.max(xa,xb,xc)+TOUCH)/cell),j0=Math.floor((Math.min(za,zb,zc)-TOUCH)/cell),j1=Math.floor((Math.max(za,zb,zc)+TOUCH)/cell);
  let list=null;const ga=groundAbove(GT[k/3],k/3);
  if(!ga.length&&!any(i0,i1,j0,j1)){out.push(a,b,c);continue;}
  for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const l=buckets.get(key(i,j));if(l){list=list||[];for(const id of l)if(seen[id]!==k){seen[id]=k;list.push(id);}}}
  const hits=[];
  if(list){const gmin=Math.min(ya,yb,yc),gmax=Math.max(ya,yb,yc);SA[0]=xa;SA[1]=za;SA[2]=xb;SA[3]=zb;SA[4]=xc;SA[5]=zc;
   for(const id of list){const t=C[id];if(Math.min(t[1],t[4],t[7])>gmax+ABOVE||Math.max(t[1],t[4],t[7])<gmin-BELOW)continue;
    SB[0]=t[0];SB[1]=t[2];SB[2]=t[3];SB[3]=t[5];SB[4]=t[6];SB[5]=t[8];if(overlap(SA,SB,TOUCH))hits.push(t);}}
  if(hits.length||ga.length){
   // Finish-19: the part under a cover surface (-0.5 cm .. +0.3 m over the ground there) or under another drawn ground
   // triangle (+0.5 cm .. +0.3 m) is cut away exactly
   const r=clipExposed([xa,ya,za,xb,yb,zb,xc,yc,zc],hits.concat(ga),-HIDE_UNDER,ABOVE,EPS);
   if(hits.length)low[a]=low[b]=low[c]=1;if(r!==null){dropped++;for(const f of r)polys.push(f);continue;}
  }
  out.push(a,b,c);
 }
 // one lift for the whole copy (see the header)
 for(let v=0;v<low.length;v++)P[v*3+1]-=lift;
 // the site surfaces themselves join the copy with the same lift; one lying 0.5 cm .. 0.3 m under another is clipped
 const LO=COVER_LO_M*W,seen2=new Int32Array(C.length).fill(-1),cpolys=[];let ncov=0;
 for(let id=0;id<C.length;id++){if(id%512===0)yield;const t=C[id],ymin=Math.min(t[1],t[4],t[7]),ymax=Math.max(t[1],t[4],t[7]),above=[];
  const i0=Math.floor(Math.min(t[0],t[3],t[6])/cell),i1=Math.floor(Math.max(t[0],t[3],t[6])/cell),j0=Math.floor(Math.min(t[2],t[5],t[8])/cell),j1=Math.floor(Math.max(t[2],t[5],t[8])/cell);
  for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const l=buckets.get(key(i,j));if(l)for(const o of l){if(o===id||seen2[o]===id)continue;seen2[o]=id;const u=C[o];
   if(Math.max(u[1],u[4],u[7])<ymin+LO||Math.min(u[1],u[4],u[7])>ymax+ABOVE)continue;above.push(u);}}
  for(const u of groundAbove(t,-1))above.push(u);
  const r=above.length?clipExposed(t,above,LO,ABOVE,EPS):null;
  if(r!==null){for(const f of r)cpolys.push(f);continue;}
  ncov++;const o=P.length/3;P.push(t[0],t[1]-lift,t[2],t[3],t[4]-lift,t[5],t[6],t[7]-lift,t[8]);
  const ny=(t[5]-t[2])*(t[6]-t[0])-(t[3]-t[0])*(t[8]-t[2]);if(ny>=0)out.push(o,o+1,o+2);else out.push(o,o+2,o+1);}
 // exposed pieces (ground, then site surfaces), fanned and wound up
 const tmp=[0,0,0];let npoly=0;
 for(const f of [...polys,...cpolys]){npoly++;const o0=P.length/3;for(let k=0;k<f.length;k+=3)P.push(f[k],f[k+1]-lift,f[k+2]);
  for(let k=1;k+1<f.length/3;k++){upTri(P,tmp,0,o0,o0+k,o0+k+1);out.push(tmp[0],tmp[1],tmp[2]);}}
 return {mode:'load',indices:out,cover:ncov,dropped,pieces:npoly};
}
