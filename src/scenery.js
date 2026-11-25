import { CAMPUS } from './campus-data.js?v=detail8';
import { createKit } from './kit.js?v=detail8';
import { buildHeritage, HERITAGE_IDS } from './heritage.js?v=detail8';
import { buildModern } from './modern.js?v=detail8';

// The original village layout is the coordinate authority; one map cell = 2 units.
export function createScenery(THREE){
  const scene=new THREE.Group();scene.name='original-campus-scenery';
  const k=createKit(THREE,scene),{box,collider}=k,places=[],updates=[],lights=[];
  const X=x=>(x-50)*2,Z=y=>(y-64)*2,PX=x=>X(x/16),PZ=y=>Z(y/16);
  const C={grass:'#91a479',grassLight:'#a4b486',grassDark:'#82966b',forest:'#788d65',earth:'#b9ac8e',earthDark:'#8d8068',paving:'#e0d7bf',pavingLight:'#ebe1c9',pavingDark:'#c2baa5',stone:'#aaa999',stoneLight:'#d4cfb9',stoneDark:'#878c7f',roof:'#657772',roofDark:'#485c56',glass:'#567f82',wood:'#88674b',woodLight:'#ac875b',iron:'#3c5551',gold:'#d5b64f',goldLight:'#ecd075',goldDark:'#b69a43',leaf:'#697e55',leafLight:'#8a9b65',leafDark:'#536e4e',white:'#f3eddc',blue:'#356993',water:'#74a7a4',waterLight:'#a8cfbd',flower:'#dba687',chalk:'#d7debc',deep:'#455b57'};
  const hash=(x,z)=>(Math.imul((x*137|0)^9127,(z*73|0)^7321)>>>0)%10000/10000;
  const groundAt=(tx,ty)=>CAMPUS.ground[Math.max(0,Math.min(127,Math.floor(ty)))]?.[Math.max(0,Math.min(99,Math.floor(tx)))];
  // Thin layered base: paths stay at zero and structures provide the apparent relief.
  // The source's non-campus cells are empty; exposed rows form a pixel contour.
  const pit=CAMPUS.site.nuri;
  const pitRect={x0:PX(pit.x),x1:PX(pit.x+pit.w),z0:PZ(pit.y),z1:PZ(pit.y+pit.h)};
  function terrainRow(x,z,w,d,color){
    const a={x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2};
    const ix0=Math.max(a.x0,pitRect.x0),ix1=Math.min(a.x1,pitRect.x1),iz0=Math.max(a.z0,pitRect.z0),iz1=Math.min(a.z1,pitRect.z1);
    const pieces=ix0<ix1&&iz0<iz1?[{x0:a.x0,x1:ix0,z0:a.z0,z1:a.z1},{x0:ix1,x1:a.x1,z0:a.z0,z1:a.z1},{x0:ix0,x1:ix1,z0:a.z0,z1:iz0},{x0:ix0,x1:ix1,z0:iz1,z1:a.z1}]:[a];
    for(const p of pieces){const ww=p.x1-p.x0,dd=p.z1-p.z0;if(ww<=0||dd<=0)continue;const xx=(p.x0+p.x1)/2,zz=(p.z0+p.z1)/2;box(xx,-1.15,zz,ww,1.9,dd,C.earthDark);box(xx,-.32,zz,ww,.4,dd,C.earth);box(xx,-.045,zz,ww,.09,dd,color);}
  }
  const groundColors={'x':'#c4bea5','f':C.forest,'.':C.grass,'#':C.paving,'L':'#a2af80','=':C.stoneLight};
  for(let y=0;y<CAMPUS.height;y++){
    const row=CAMPUS.ground[y];let start=0;
    while(start<row.length){const ch=row[start];let end=start+1;while(end<row.length&&row[end]===ch)end++;
      if(ch!=='x'){
        const x=X((start+end)/2),z=Z(y+.5),w=(end-start)*2;
        terrainRow(x,z,w,2,groundColors[ch]||C.grass);
      }start=end;
    }
  }
  // Sparse flecks keep lawn and woodland surfaces from looking like a flat CAD map.
  for(let y=2;y<126;y+=3)for(let x=2;x<99;x+=3){const ch=groundAt(x,y),n=hash(x,y);if((ch==='.'||ch==='f')&&n>.57&&!(X(x+.4)>pitRect.x0&&X(x+.4)<pitRect.x1&&Z(y+.4)>pitRect.z0&&Z(y+.4)<pitRect.z1))box(X(x+.4),.012,Z(y+.4),.8+n*1.2,.028,.9+n,n>.8?C.grassLight:C.grassDark);}
  // Original divided Baekyang avenue and its center planting strip.
  const axisX=PX(CAMPUS.axis.x),axisTop=PZ(CAMPUS.axis.top),axisBottom=PZ(CAMPUS.axis.bottom);
  for(let zz=axisTop+1;zz<axisBottom;zz+=4){for(const xx of [axisX-6,axisX+6])box(xx,.036,zz,6.3,.025,.09,C.pavingDark);}
  for(const xx of [X(61),X(65)])box(xx,.045,(axisTop+axisBottom)/2,.18,.08,axisBottom-axisTop,C.stoneLight);

  const zoneFor=(x,y)=>y<48?'역사·인문':y<83?'배움의 중심':x<42?'운동장·공학':'백양로·문화';
  const buildings=CAMPUS.buildings.map(([id,name,code,tx,ty,tw,td])=>({id,name,code,x:X(tx+tw/2),z:Z(ty+td/2),w:tw*2,d:td*2,sourceX:tx,sourceY:ty,sourceW:tw,sourceH:td}));
  const supportedFootprints=[],cameraObstacles=[];
  function supportFootprint(b){
    let missing=false;
    for(let ty=Math.floor(b.sourceY);ty<Math.ceil(b.sourceY+b.sourceH);ty++)for(let tx=Math.floor(b.sourceX);tx<Math.ceil(b.sourceX+b.sourceW);tx++)if(groundAt(tx,ty)==='x')missing=true;
    if(!missing)return;
    // The original canvas paints building plots after GROUND; support their full mass.
    box(b.x,-1.15,b.z,b.w,1.9,b.d,C.earthDark);box(b.x,-.32,b.z,b.w,.4,b.d,C.earth);
    box(b.x,-.04,b.z,b.w,.08,b.d,C.pavingDark);supportedFootprints.push(b.id);
  }
  for(const b of buildings){
    supportFootprint(b);
    const before=k.colliders.length;
    // Keep the original solid-wing footprints for trees and furniture, while
    // the game owns the visible, destructible copy of every target building.
    const footprintKit={box(){},collider:(x,z,w,d)=>collider(b.x+x,b.z+z,w,d)};
    const model=HERITAGE_IDS.includes(b.id)?buildHeritage(footprintKit,b):buildModern(footprintKit,b);
    if(k.colliders.length===before)collider(b.x,b.z,b.w,b.d);
    b.height=model?.height||9;
    // Use each solid wing rather than its enclosing plot: courtyards stay open.
    for(const c of k.colliders.slice(before))cameraObstacles.push({...c,height:b.id==='luce-wing'?4.15:b.height});
    // Luce's wide roof floats above its smaller body; the space below is walkable.
    if(b.id==='luce-wing')cameraObstacles.push({x:b.x,z:b.z-.1,w:b.w+.45,d:b.d+.45,minY:4.15,height:b.height});
    const door=model?.door||{x:0,z:b.d/2+2};
    const arrival={x:b.x+door.x,z:b.z+door.z};
    places.push({id:b.id,name:b.name,subtitle:`${b.code} · ${zoneFor(b.sourceX,b.sourceY)}`,description:model?.description||`신촌맛집 마을의 ${b.name}을 입체 블록으로 다시 만들었어요. 원래 마을의 위치와 건물 특징을 따라 캠퍼스를 둘러보세요.`,x:b.x,z:b.z,y:(model?.height||9)+1.5,arrival,zone:zoneFor(b.sourceX,b.sourceY),kind:'building',code:b.code,sourceX:b.sourceX,sourceY:b.sourceY});
  }
  // The medical complex is a backdrop from the source's southeastern extent.
  const cancer={id:'cancer',name:'연세암병원',code:'풍경',x:X(81),z:Z(122.5),w:24,d:10,sourceX:75,sourceY:120,sourceW:12,sourceH:5};
  supportFootprint(cancer);const cancerBefore=k.colliders.length;
  cancer.height=buildModern(k.at(cancer.x,cancer.z),cancer)?.height||16;
  for(const c of k.colliders.slice(cancerBefore))cameraObstacles.push({...c,height:cancer.height});

  const taken=(x,z,margin=0)=>k.colliders.some(c=>Math.abs(x-c.x)<c.w/2+margin&&Math.abs(z-c.z)<c.d/2+margin);
  function reserveArrival(x,z,r=2.2){return places.some(p=>Math.hypot(x-p.arrival.x,z-p.arrival.z)<r);}
  function pad(x,z,w,d,color=C.pavingLight){box(x,.025,z,w,.05,d,color);}
  function plinth(x,z,w=2,d=2,h=1.4){box(x,.16,z,w+.65,.32,d+.65,C.stoneDark);box(x,.32+h/2,z,w,h,d,C.stoneLight);box(x,h+.43,z,w+.4,.25,d+.4,C.stoneDark);return h+.55;}
  function statuePerson(x,z){const base=plinth(x,z,1.6,1.7,1.4);box(x,base+.75,z,.95,1.5,.6,C.iron);box(x,base+1.74,z,.7,.68,.68,C.iron);box(x-.64,base+.95,z,.38,.9,.4,C.iron);box(x+.65,base+1,z,.38,1.1,.4,C.iron);collider(x,z,2.6,2.7);}
  function eagle(x,z){
    // Source has a slim 69 px shaft, broad raised wings and four surrounding stones.
    // Vertical scale is deliberately 0.60 of the map's px/8 conversion: 9.15 high,
    // between the 6–8 unit trees and the 12–16 unit adjacent academic halls.
    const ys=.60/8,baseTop=26*ys,shaftH=69*ys;
    box(x,6*ys,z,17/8,12*ys,17/8,C.stone);
    for(let i=0;i<4;i++)box(x,(12+(i+.5)*3.5)*ys,z,(17-i*2)/8,3.5*ys,(17-i*2)/8,C.stoneLight);
    box(x,baseTop+shaftH/2,z,9/8,shaftH,9/8,C.stoneLight);
    box(x-.38,baseTop+shaftH/2,z+.575,.18,shaftH,.08,'#a8b8ac');
    box(x,96*ys,z,13/8,4*ys,13/8,'#c2cbbf');
    box(x,101*ys,z,.65,9*ys,.7,C.iron);
    for(const sign of[-1,1])for(let i=0;i<7;i++){
      const wingX=sign*(.32+i*.4),wingY=(103+i*2.9)*ys;
      box(x+wingX,wingY,z,.64,.34,Math.max(.24,.96-i*.095),C.iron);
      if(i>1)box(x+wingX,wingY-.25,z-.29,.22,.48,.34,C.roofDark);
    }
    box(x+.43,106*ys,z+.27,.6,.23,.4,C.goldDark);collider(x,z,2.5,2.5);
    for(const[dx,dz]of[[-27,-5],[28,-5],[-18,9],[19,9]]){
      const xx=x+dx/8,zz=z+dz/8;box(xx,.16,zz,13/8,.32,1.1,C.stone);
      for(let i=0;i<4;i++)box(xx+(i>1?.08:0),.32+(i+.5)*.28,zz,1.1-i*.18,.29,.7-i*.1,C.stoneLight);
      collider(xx,zz,1.7,1.15);
    }
  }
  function tree(x,z,s=1,gold=false){
    box(x,1.7*s,z,.45*s,3.4*s,.45*s,C.wood);
    const colors=gold?[C.gold,C.goldLight,C.goldDark]:[C.leaf,C.leafLight,C.leafDark];
    box(x,4.1*s,z,2.8*s,2.7*s,2.65*s,colors[0]);box(x-.95*s,3.6*s,z+.1*s,1.7*s,1.7*s,2.25*s,colors[2]);box(x+1*s,4.15*s,z-.2*s,1.5*s,2*s,2*s,colors[0]);box(x-.12*s,5.6*s,z,1.9*s,.85*s,1.8*s,colors[1]);box(x-.45*s,4.9*s,z+1.2*s,1.6*s,.85*s,.4*s,colors[1]);
    collider(x,z,.66*s,.66*s);
  }
  function bench(x,z,angle=0,type='wood'){
    const c=Math.cos(angle),s=Math.sin(angle),wood=type==='stone'?C.stoneLight:C.woodLight;
    const b=(xx,y,zz,w,h,d,color)=>box(x+xx*c+zz*s,y,z-xx*s+zz*c,w,h,d,color,angle);
    for(const xx of[-.9,.9]){b(xx,.38,0,.18,.76,.7,C.iron);b(xx,1.1,-.3,.13,1.2,.13,C.iron);}
    for(const zz of[-.25,0,.25])b(0,.8,zz,2.6,.15,.21,wood);
    for(const yy of[1.2,1.52])b(0,yy,-.3,2.6,.22,.16,type==='stone'?C.stone:C.wood);
    const w=Math.abs(c)*2.7+Math.abs(s),d=Math.abs(s)*2.7+Math.abs(c);collider(x,z,w,d);
  }
  function lamp(x,z,tall=true){
    const h=tall?4.4:3.5;box(x,.12,z,.5,.24,.5,C.stoneDark);box(x,h/2,z,.12,h,.12,C.iron);box(x,h,z,.62,.62,.62,C.iron);box(x,h+.015,z,.42,.43,.42,'#f9df9b');box(x,h+.42,z,.8,.16,.8,C.iron);box(x,h+.55,z,.4,.14,.4,C.iron);
    for(const xx of[-.24,.24])for(const zz of[-.24,.24])box(x+xx,h,z+zz,.075,.54,.075,C.iron);
    collider(x,z,.5,.5);
    const glow=new THREE.Mesh(new THREE.PlaneGeometry(3.8,3.8),new THREE.MeshBasicMaterial({color:'#efc578',transparent:true,opacity:0,depthWrite:false}));glow.rotation.x=-Math.PI/2;glow.position.set(x,.085,z);scene.add(glow);lights.push(glow);
  }
  function stoneMarker(x,z,w=2.5,h=1.9,blue=false){
    box(x,h/2,z,w,h,.8,C.stone);box(x,h+.13,z,w+.3,.25,1.05,C.stoneLight);box(x,h*.57,z+.43,w*.7,h*.47,.1,blue?C.blue:C.stoneDark);
    for(let i=0;i<3;i++)box(x-.45+i*.4,h*.57,z+.51,.12,h*.29,.07,blue?C.white:C.stoneLight);collider(x,z,w+.2,1.1);
  }
  // 19 named places use the exact original markers; specific sculptures use SITE.
  const spotModels=new Map();
  const define=(id,fields)=>spotModels.set(id,fields);
  const s=CAMPUS.site;
  // Elliptical ground footprints stay in the source's already projected coordinates.
  // Heights are reconstructed separately; the 2D y axis is never reused as elevation.
  function ovalBlocks(x,z,rx,rz,y,h,color,step=.3){
    for(let dz=-rz;dz<rz;dz+=step){const depth=Math.min(step,rz-dz),mid=dz+depth/2,ww=2*rx*Math.sqrt(Math.max(0,1-mid*mid/(rz*rz)));if(ww>.025)box(x,y,z+mid,ww,h,depth+.006,color);}
  }
  function ovalCollision(x,z,rx,rz,step=.5){
    for(let dz=-rz;dz<rz;dz+=step){const d=Math.min(step,rz-dz),near=dz<=0&&dz+d>=0?0:Math.min(Math.abs(dz),Math.abs(dz+d)),w=2*rx*Math.sqrt(Math.max(0,1-near*near/(rz*rz)));if(w>.02)collider(x,z+dz+d/2,w,d);}
  }
  // Eagle plaza follows source paving188×126, oval84×44 and five low front steps.
  const ex=PX(s.eagle.x),ez=PZ(s.eagle.y);pad(ex,ez-11/8,188/8,126/8,'#dddccf');
  for(const dx of[-76,16])for(const dy of[-70,-48])box(ex+(dx+30)/8,.055,ez+(dy+8)/8,60/8,.07,16/8,C.grassLight);
  ovalBlocks(ex,ez,84/8,44/8,.07,.12,'#d9dacb');
  for(let i=0;i<5;i++){
    const rx=(62-i*5)/8,rz=(33-i*4)/8;
    for(let dz=0;dz<rz;dz+=.3){const dd=Math.min(.3,rz-dz),zz=dz+dd/2,ww=2*rx*Math.sqrt(1-zz*zz/(rz*rz));box(ex,.11+i*.045,ez+zz,ww,.075,dd+.005,i%2?'#dfdfd0':'#c2cbb9');}
  }
  eagle(ex,ez);
  define(125,{height:9.8,arrival:{x:ex,z:ez+4.5},description:'도서관 앞 원래 타원 광장에 가는 석재 주탑과 날개 편 독수리를 세웠어요. 주변의 돌 조형물 네 개와 낮은 반원 단도 함께 표현했어요.'});
  // Nuri: real 1.65-deep recess, thirteen descending western treads, glazing below grade.
  // Its full original192×112 px footprint remains reserved; ground-level visits use the rail.
  const nr=s.nuri,nx=PX(nr.x+nr.w/2),nz=PZ(nr.y+nr.h/2),nw=nr.w/8,nd=nr.h/8,pitDepth=1.65;
  box(nx,-pitDepth-.15,nz,nw,.3,nd,C.stoneDark);
  box(nx,-pitDepth+.02,nz,nw-.4,.05,nd-.4,'#dddccf');
  for(const xx of[nx-nw/2+.13,nx+nw/2-.13])box(xx,-pitDepth/2,nz,.26,pitDepth,nd,C.stoneLight);
  for(const zz of[nz-nd/2+.13,nz+nd/2-.13])box(nx,-pitDepth/2,zz,nw,.0+pitDepth,.26,C.stoneLight);
  for(const zz of[nz-nd/2,nz+nd/2]){
    box(nx,.045,zz,nw+.4,.09,.35,C.stoneLight);box(nx,.86,zz,nw,.08,.08,C.iron);
    for(let xx=nx-nw/2+.3;xx<=nx+nw/2;xx+=1.75)box(xx,.46,zz,.075,.86,.075,C.iron);
  }
  // Side rail on the eastern edge; the stair opening is framed on the west.
  box(nx+nw/2,.86,nz,.08,.08,nd,C.iron);for(let zz=nz-nd/2;zz<nz+nd/2;zz+=1.3)box(nx+nw/2,.46,zz,.075,.86,.075,C.iron);
  const stairX=PX(nr.x+6+38/2),stairStart=PZ(nr.y+7),treadDepth=7/8;
  for(let i=0;i<13;i++){const top=-pitDepth*i/13,h=pitDepth+top+.12;box(stairX,-pitDepth-.12+h/2,stairStart+(i+.5)*treadDepth,38/8,h,treadDepth,C.stoneLight);box(stairX,top+.015,stairStart+(i+1)*treadDepth-.06,38/8,.035,.10,'#a4b0a0');}
  // Northern below-grade facade: no tall above-ground glass pavilion.
  const glassX=PX(nr.x+46+(nr.w-52)/2),glassZ=PZ(nr.y+5),glassW=(nr.w-52)/8;
  box(glassX,-.91,glassZ,glassW,1.42,.18,C.glass);box(glassX,-.13,glassZ,glassW+.3,.18,.7,C.stoneLight);
  for(let xx=glassX-glassW/2;xx<=glassX+glassW/2;xx+=1.125)box(xx,-.92,glassZ+.13,.1,1.45,.12,C.iron);
  box(glassX,-1.08,glassZ+.13,glassW,.08,.12,C.stoneLight);
  const lawnX=PX(nr.x+70+(nr.w-98)/2),lawnZ=PZ(nr.y+68+29/2);
  box(lawnX,-pitDepth+.075,lawnZ,(nr.w-94)/8,.1,33/8,C.stoneLight);box(lawnX,-pitDepth+.14,lawnZ,(nr.w-98)/8,.07,29/8,C.grassLight);
  collider(nx,nz,nw+.45,nd+.45);
  define(44,{height:1.6,arrival:{x:nx+nw/2+2.2,z:nz},description:'지면 아래로 내려간 백양누리예요. 서쪽 13단 계단과 낮은 유리 출입구, 아래쪽 잔디를 난간 밖에서 내려다볼 수 있어요.'});
  // Fountain dimensions are exact rounded fk(px)=round(px*FOUNTAIN.scale)/8.
  const fountain=CAMPUS.fountain,fk=v=>Math.round(v*fountain.scale)/8;
  const fx=PX(s.fountain.x),fz=PZ(s.fountain.y),fr=fk(44),fzr=fk(36),plazaRx=fountain.paving.rx/8,plazaRz=fountain.paving.ry/8;
  ovalBlocks(fx,fz,plazaRx,plazaRz,.05,.1,'#b0b3a2');ovalBlocks(fx,fz,plazaRx-.125,plazaRz-.125,.115,.07,'#e8e7da');ovalBlocks(fx,fz,plazaRx-.25,plazaRz-.25,.157,.025,'#d9dacb');
  const r0=fk(46),rMid=(r0+plazaRx)/2,ratio=plazaRz/plazaRx;
  for(let i=0;i<112;i++){const a=i*Math.PI/56;box(fx+Math.cos(a)*rMid,.18,fz+Math.sin(a)*rMid*ratio,.12,.015,.12,'#c0c3b1');}
  for(let i=0;i<32;i++){const a=(i+.5)*Math.PI/16;for(let r=r0;r<plazaRx-.15;r+=.14)box(fx+Math.cos(a)*r,.183,fz+Math.sin(a)*r*ratio,.1,.014,.1,'#c0c3b1');}
  ovalBlocks(fx,fz,fr,fzr,.24,.28,'#b3b7a7');ovalBlocks(fx,fz,fk(42),fk(34),.39,.12,'#e2dfcc');
  ovalBlocks(fx,fz,fk(34),fk(27),.452,.025,'#707c75');ovalBlocks(fx,fz,fk(32),fk(25),.478,.025,'#6b9e9e');
  for(let i=0;i<46;i++){const a=i*Math.PI/23;for(let r=fk(36);r<=fk(42);r+=.18)box(fx+Math.cos(a)*r,.455,fz+Math.sin(a)*r*.81,.08,.018,.085,'#b3b4a4');}
  const sourceHash=(x,y)=>{let h=(x*374761393+y*668265263)^0x5bd1e995;h=(h^(h>>>13))*1274126177;return(h^(h>>>16))>>>0;};
  const stones=[];
  for(let i=0;i<fountain.stones;i++){
    const a=i*2.4,r=(7+sourceHash(i,55)%24)*fountain.scale,xx=PX(Math.round(s.fountain.x+Math.cos(a)*r)),zz=PZ(Math.round(s.fountain.y+Math.sin(a)*r*.7)),h=.18+hash(i,12)*.28;
    box(xx,.49+h/2,zz,.875,h,.5,i%3?'#586765':'#3e5256');box(xx-.06,.49+h+.025,zz,.625,.055,.32,'#83918b');stones.push({x:xx,z:zz,y:.51+h});
  }
  // Small transparent twelve-sided cylinder, not a blue cloud sculpture.
  const cylinderX=fx+fk(8),cylinderR=fk(14),cylinderH=fk(21),cylinderBase=.48;
  const clearMat=new THREE.MeshStandardMaterial({color:'#a8ccc3',transparent:true,opacity:.27,roughness:.32,metalness:.04,depthWrite:false,side:THREE.DoubleSide});
  const cylinder=new THREE.Mesh(new THREE.CylinderGeometry(cylinderR,cylinderR,cylinderH,12,1,true),clearMat);cylinder.position.set(cylinderX,cylinderBase+cylinderH/2,fz);cylinder.scale.z=.72;scene.add(cylinder);
  const top=new THREE.Mesh(new THREE.CylinderGeometry(cylinderR*.92,cylinderR*.92,.065,12),new THREE.MeshStandardMaterial({color:'#d7e9dc',transparent:true,opacity:.38,roughness:.4,depthWrite:false}));top.position.set(cylinderX,cylinderBase+cylinderH+.035,fz);top.scale.z=.72;scene.add(top);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;box(cylinderX+Math.cos(a)*cylinderR,cylinderBase+cylinderH/2,fz+Math.sin(a)*cylinderR*.72,.055,cylinderH,.055,'#d1e4d8');}
  for(const yy of[cylinderBase+.05,cylinderBase+cylinderH])for(let i=0;i<24;i++){const a=i*Math.PI/12;box(cylinderX+Math.cos(a)*cylinderR,yy,fz+Math.sin(a)*cylinderR*.72,.35,.07,.13,'#b8d6ca',-a);}
  // Four small inset name plaques use the original offsets without invented text.
  for(const[dx,dz]of[[-23,30],[24,30],[-27,-26],[26,-26]])box(fx+fk(dx),.463,fz+fk(dz),1.25,.025,.28,'#88978e');
  // Mist grows gently from the dark stone joints; there are no thrown water droplets.
  const mistGeo=new THREE.BoxGeometry(1,1,1);
  for(let i=0;i<28;i++){
    const rock=stones[Math.floor(i*stones.length/28)],mat=new THREE.MeshBasicMaterial({color:'#f0f8f7',transparent:true,opacity:.2,depthWrite:false}),m=new THREE.Mesh(mistGeo,mat);m.renderOrder=3;scene.add(m);
    updates.push(t=>{const tick=Math.floor(t*8)/8,p=(tick*.34+i*.618)%1,fade=Math.sin(p*Math.PI);m.position.set(rock.x+Math.sin(tick*.7+i)*.22,rock.y+.05+p*.9,rock.z+Math.cos(tick*.6+i)*.18);m.scale.set(.24+p*.7,.12+p*.25,.24+p*.55);mat.opacity=.30*fade;});
  }
  for(let i=0;i<5;i++){
    const mat=new THREE.MeshBasicMaterial({color:'#f0f8f7',transparent:true,opacity:.10,depthWrite:false}),m=new THREE.Mesh(mistGeo,mat);m.renderOrder=2;scene.add(m);
    updates.push(t=>{const ph=t*.35+i*1.7;m.position.set(fx+(-18+i*8+Math.sin(ph)*4)*fountain.scale/8,.84+Math.sin(ph)*.08,fz+(-8+(i*7)%16+Math.cos(ph*.8)*2)*fountain.scale/8);m.scale.set(1.9,.22,1);mat.opacity=.08+Math.sin(ph)*.025;});
  }
  ovalCollision(fx,fz,fr,fzr);
  define(134,{height:cylinderBase+cylinderH+.8,arrival:{x:fx+fr+1.25,z:fz},description:'낮은 수반 안의 검은 남포석 사이로 물안개가 피어나는 블루클라우드 분수예요. 원본의 1.18배 수반과 둥근 판석 광장, 작은 투명 원통을 함께 반영했어요.'});
  // Watercourse: every original crossing remains walkable, water between is solid.
  const sr=s.stream,sx=PX(sr.x+sr.w/2),sz0=PZ(sr.y),sz1=PZ(sr.y+sr.h),sw=sr.w/8;
  box(sx,.08,(sz0+sz1)/2,sw+.65,.16,sz1-sz0,C.stoneLight);box(sx,.19,(sz0+sz1)/2,sw,.07,sz1-sz0,C.water);
  const gaps=s.bridges.map(r=>({a:PZ(r.y)-.1,b:PZ(r.y+r.h)+.1,r})).sort((a,b)=>a.a-b.a);let cursor=sz0;
  for(const gap of gaps){if(gap.a>cursor)collider(sx,(cursor+gap.a)/2,sw+.5,gap.a-cursor);cursor=Math.max(cursor,gap.b);const r=gap.r;box(PX(r.x+r.w/2),.23,PZ(r.y+r.h/2),r.w/8,.14,r.h/8,C.stoneLight);for(const zz of[PZ(r.y)+.16,PZ(r.y+r.h)-.16])box(PX(r.x+r.w/2),.34,zz,r.w/8,.12,.15,C.stoneDark);}
  if(cursor<sz1)collider(sx,(cursor+sz1)/2,sw+.5,sz1-cursor);
  for(let z=sz0+1;z<sz1;z+=2.8)box(sx,.24,z,sw*.5,.03,.12,C.waterLight);
  define(9001,{height:1.5,arrival:{x:sx+3,z:PZ(s.bridges[4].y+s.bridges[4].h/2)},description:'공학관 앞 수로와 작은 돌다리 아홉 개를 원본 위치에 맞춰 놓았어요. 다리 사이 물길은 건널 수 없고 돌다리를 따라 건너요.'});
  // Site glass elevators and skylight are distinct from the main entrance.
  for(const name of['lift','libraryLift','skylight']){const r=s[name],x=PX(r.x+r.w/2),z=PZ(r.y+r.h/2),w=r.w/8,d=r.h/8,h=name==='skylight'?1.1:3.2;box(x,h/2,z,w,h,d,C.glass);box(x,h+.15,z,w+.35,.25,d+.35,C.stoneLight);for(const xx of[x-w/2,x+w/2])box(xx,h/2,z,.13,h,d,C.white);collider(x,z,w+.3,d+.3);}
  {const r=s.kumho,x=PX(r.x+r.w/2),z=PZ(r.y+r.h/2);box(x,.3,z,r.w/8,.6,r.h/8,C.stoneDark);box(x,1.4,z,r.w/8-.6,1.8,r.h/8-.6,C.glass);box(x,2.4,z,r.w/8+.3,.22,r.h/8+.3,C.stoneLight);collider(x,z,r.w/8+.3,r.h/8+.3);}
  function soccer(x,z){
    const w=31,d=37;pad(x,z,w+5,d+5,'#b7a28b');box(x,.075,z,w,.1,d,C.leaf);
    for(let i=0;i<9;i++)box(x,.135,z-d/2+(i+.5)*d/9,w-.4,.025,d/9-.05,i%2?C.leaf:C.leafLight);
    for(const xx of[x-w/2+.5,x+w/2-.5])box(xx,.17,z,.13,.035,d-1,C.chalk);
    for(const zz of[z-d/2+.5,z+d/2-.5,z])box(x,.17,zz,w-1,.035,.13,C.chalk);
    for(let i=0;i<24;i++){const a=i*Math.PI/12;box(x+Math.cos(a)*4,.17,z+Math.sin(a)*4,.7,.035,.14,C.chalk,-a);}
    for(const sign of[-1,1]){
      const zz=z+sign*(d/2-.5);for(const xx of[x-3.5,x+3.5]){box(xx,1.5,zz,.15,3,.15,C.white);collider(xx,zz,.18,.18);}box(x,3,zz,7.2,.15,.15,C.white);
      for(let i=0;i<=14;i++)box(x-3.5+i*.5,1.3,zz+sign, .045,2.6,.045,C.chalk);
      for(const yy of[.4,.9,1.4,1.9,2.4])box(x,yy,zz+sign,7,.045,.045,C.chalk);
      box(x,.18,zz-sign*5,13,.03,.13,C.chalk);for(const xx of[x-6.5,x+6.5])box(xx,.18,zz-sign*2.5,.13,.03,5,C.chalk);
    }
    // Compact bleachers at the western sideline, outside the touchline.
    for(let i=0;i<3;i++)box(x-w/2-1.8-i*.7,.3+i*.36,z,.6,.55,17,i%2?C.stoneLight:C.stone);
    collider(x-w/2-2.5,z,2.2,17);
    box(x+3,.42,z-2,.48,.48,.48,C.white);
  }
  soccer(X(13.5),Z(98.5));define(35,{height:1.8,arrival:{x:X(13.5)+17,z:Z(98.5)},description:'캠퍼스 서쪽 대운동장이에요. 줄무늬 잔디, 골대와 관람석을 둔 작은 축구장으로 표현했어요.'});
  {
    const x=X(22.5),z=Z(91.5),w=12,d=19;pad(x,z,w+1,d+1,C.stoneLight);box(x,.1,z,w,.13,d,'#ba9772');
    for(const xx of[x-w/2+.3,x+w/2-.3])box(xx,.185,z,.11,.04,d-.6,C.white);for(const zz of[z-d/2+.3,z,z+d/2-.3])box(x,.185,zz,w-.6,.04,.11,C.white);
    for(const sign of[-1,1]){const zz=z+sign*(d/2-.6);box(x,1.7,zz,.16,3.4,.16,C.iron);box(x,3.5,zz,2.3,1.3,.13,C.white);box(x,3.5,zz-sign*.08,.85,.65,.04,C.blue);box(x,2.94,zz-sign*.45,.85,.12,.85,'#bc7752');collider(x,zz,.6,.6);box(x,.2,zz-sign*2.5,4.6,.025,.1,C.white);}
    define(121,{height:3.8,arrival:{x:x+7.4,z},description:'체육관 서쪽의 작은 농구장이에요. 흰 라인과 양쪽 골대를 같은 자리에서 입체로 만나요.'});
  }
  {
    const x=X(23.5),z=Z(111.5);pad(x,z,27,22,C.grassDark);box(x,.08,z,20,.13,17,'#bda783');
    const home={x:x-7,z:z+6};for(let i=0;i<=12;i++){const t=i/12;box(home.x+t*16,.18,home.z-t*16,.5,.035,.12,C.chalk,-Math.PI/4);box(home.x+t*21,.18,home.z-t*1,.5,.035,.12,C.chalk);}
    for(const[dx,dz]of[[0,0],[7,0],[7,-7],[0,-7]])box(home.x+dx,.2,home.z+dz,.7,.07,.7,C.white,Math.PI/4);
    box(home.x+3.5,.22,home.z-3.5,1.3,.12,.8,C.stoneLight);
    for(let i=0;i<12;i++)box(x-12+i*2.1,2,z-11,.07,4,.07,C.iron);for(const yy of[1,2,3,4])box(x-.5,yy,z-11,24,.045,.045,C.iron);
    define(33,{height:2,arrival:{x:x-10,z:z+9},description:'서남쪽 야구장의 흙빛 내야와 베이스를 도트 블록으로 만들었어요. 운동장 옆 길로 이어서 걸어갈 수 있어요.'});
  }
  {
    const x=X(63),z=Z(41);pad(x,z,9,8);statuePerson(x,z);define(124,{height:5,arrival:{x:x+3.5,z:z+1.5},description:'언더우드관 앞 동상이에요. 중앙 축의 위치를 지키고 오래된 석조 건물과 함께 보이도록 만들었어요.'});
    const gz=Z(45);pad(x,gz,18,7,C.grassLight);for(const xx of[x-8.5,x+8.5])box(xx,.35,gz,1,.7,6,C.leaf);define(139,{height:1.5,arrival:{x,z:gz+2.4},description:'본관 앞 작은 뜰이에요. 스팀슨관과 아펜젤러관 사이의 원래 배치를 따라 잔디와 돌길을 놓았어요.'});
  }
  {
    const x=X(52.5),z=Z(47.5);pad(x,z,7.5,8.5,C.pavingDark);stoneMarker(x-1.5,z,2,2);box(x+1.6,.65,z-1,1.9,1.3,1.6,C.stone);box(x+1.6,1.4,z-1,2.1,.22,1.8,C.stoneLight);collider(x+1.6,z-1,2.1,1.8);bench(x,z+3.3);define(128,{height:3,arrival:{x:x+4.8,z:z+1},description:'핀슨관 옆 윤동주문학동산이에요. 돌 시비와 벤치를 놓은 조용한 작은 정원으로 만들었어요.'});
  }
  {
    const x=X(42),z=Z(95.5);plinth(x,z,1.7,1.7,.7);box(x,2.8,z,.75,3.7,.8,C.stoneLight);box(x,4.3,z,2.3,.65,.8,C.stoneLight);box(x+.78,3.6,z,.7,2.2,.8,C.stoneLight);box(x-.7,2.5,z,.7,.7,.8,C.stoneLight);collider(x,z,2.7,2.3);define(141,{height:5.3,arrival:{x:x-2.5,z:z+1.7},description:'백양누리 서쪽의 연세한글탑이에요. 한글의 획을 닮은 돌 블록으로 간결하게 표현했어요.'});
  }
  {
    const x=X(69.5),z=Z(94.5);pad(x,z,9,8,C.grassLight);stoneMarker(x,z,3,1.7);bench(x-3,z+2.7);define(126,{height:3,arrival:{x:x+3.6,z:z+2.5},description:'백양로 동쪽 이한열동산이에요. 원래 위치의 작은 추모 공간을 돌 표식과 벤치로 담았어요.'});
  }
  {
    const x=X(92.5),z=Z(39.5);pad(x,z,8,7,C.pavingDark);stoneMarker(x-2,z-1,2.4,1.6);bench(x+1.5,z+2);define(68,{height:3,arrival:{x:x+3,z:z+1},description:'노천극장 북쪽 청송대의 숲길이에요. 나무 사이 작은 쉼터를 따라 캠퍼스 동쪽을 둘러보세요.'});
  }
  // Original bridge near the engineering district, with free ground underneath.
  {
    const x=X(45.5),z=Z(116.5);for(const xx of[x-7.5,x+7.5]){box(xx,1.95,z,.7,3.9,2.4,C.stone);collider(xx,z,.9,2.6);}
    box(x,4,z,16,.45,3,C.stoneLight);for(const zz of[z-1.4,z+1.4]){box(x,5,zz,16,.15,.14,C.iron);for(let xx=x-7.5;xx<=x+7.5;xx+=1.5)box(xx,4.55,zz,.1,.85,.1,C.iron);}
    define(32,{height:5.7,arrival:{x,z:z+2.7},description:'공학원으로 이어지는 길의 포스코브리지예요. 낮은 석재 다리와 난간을 입체로 표현했어요.'});
  }
  for(const[id,tx,ty]of[[30,63,127],[129,14.5,75.5]]){
    const x=X(tx),z=Z(ty),main=id===30;
    for(const xx of[x-8,x+8]){box(xx,2.6,z,2.4,5.2,2.6,C.stone);box(xx,5.3,z,2.9,.3,3.1,C.stoneLight);box(xx,3.2,z+1.36,1.4,2,.12,C.blue);box(xx,3.35,z+1.46,.6,.8,.07,C.white);collider(xx,z,2.8,3);}
    for(const sign of[-1,1]){const xx=x+sign*13;box(xx,1.1,z,7.5,2.2,.7,C.stone);box(xx,2.3,z,7.9,.2,1,C.stoneLight);collider(xx,z,8,1);}
    define(id,{height:6.3,arrival:{x,z:main?z-4:z+3.5},description:main?'신촌에서 들어오는 연세대학교 정문이에요. 은행나무가 이어지는 백양로를 따라 북쪽 캠퍼스로 걸어보세요.':'운동장과 과학관 쪽에서 드나드는 서문이에요. 원본 마을의 서쪽 입구를 그대로 입체로 옮겼어요.'});
  }
  {const x=X(63),z=Z(122.5);stoneMarker(x,z,3.2,1.7);define(123,{height:3.2,arrival:{x:x+3,z},description:'정문 안쪽 중앙 축에 놓인 교훈석이에요. 작은 돌 표식을 지나 백양로 산책을 시작해요.'});}
  define(130,{height:1.5,arrival:{x:X(63),z:Z(114.5)},description:'정문부터 언더우드관 앞까지 이어지는 백양로예요. 원본의 양쪽 길과 은행나무 줄을 따라 길게 펼쳤어요.'});
  define(135,{height:1.8,arrival:{x:nx,z:nz+nd/2+2.3},description:'백양누리와 이어지는 동문광장이에요. 원본 명소 위치를 유지하고 주변의 선큰 공간과 함께 표현했어요.'});

  for(const[id,name,code,tx,ty]of CAMPUS.spots){
    const model=spotModels.get(id)||{};places.push({id:'spot'+id,name,subtitle:`${code} · ${zoneFor(tx,ty)}`,description:model.description||`${name}의 위치를 따라 만든 작은 캠퍼스 풍경이에요.`,x:X(tx),z:Z(ty),y:model.height||2.5,arrival:model.arrival||{x:X(tx),z:Z(ty)+3},zone:zoneFor(tx,ty),kind:'spot',code,sourceX:tx,sourceY:ty});
  }
  // Source furniture retains its location. Skip only pieces that block a doorstep.
  for(const[px,py,w,h]of CAMPUS.hedges){const x=PX(px),z=PZ(py-h/2),ww=w/8,dd=h/8;if(reserveArrival(x,z,2))continue;box(x,.36,z,ww,.72,dd,C.leaf);box(x-.15,.77,z-.12,ww*.84,.16,dd*.85,C.leafLight);collider(x,z,ww,dd);}
  for(const[px,py,type,deg]of CAMPUS.benches){const x=PX(px),z=PZ(py);if(taken(x,z,.4)||reserveArrival(x,z,2.5))continue;if(type==='picnic'){box(x,.92,z,2.4,.18,1.7,C.woodLight);box(x,.47,z,.18,.94,.18,C.iron);for(const sign of[-1,1]){box(x,.57,z+sign*1.15,2.5,.16,.55,C.wood);for(const xx of[x-.8,x+.8])box(xx,.25,z+sign*1.15,.16,.5,.16,C.iron);}collider(x,z,2.7,3);}else bench(x,z,deg*Math.PI/180,type);}
  for(const[px,py,tall]of CAMPUS.lamps){const x=PX(px),z=PZ(py);if(!taken(x,z,.45)&&!reserveArrival(x,z,1.7))lamp(x,z,!!tall);}
  // Golden rows are the original ginkgos; forest is thinned deterministically.
  let treeCount=0;
  for(const[tx,ty]of CAMPUS.ginkgos){const x=X(tx),z=Z(ty);if(taken(x,z,.6)||reserveArrival(x,z,2.5))continue;tree(x,z,.85+hash(tx,ty)*.25,true);treeCount++;for(let i=0;i<5;i++)box(x+(hash(tx+i,ty)-.5)*3,.065,z+(hash(tx,ty+i)-.5)*3,.2,.035,.28,C.goldLight);}
  const planted=[];
  for(const[tx,ty]of CAMPUS.trees){const ch=groundAt(tx,ty),x=X(tx),z=Z(ty);if(ch==='x'||ch==='#'||ch==='='||hash(tx,ty)<.29||taken(x,z,1.9)||reserveArrival(x,z,3.5)||planted.some(t=>Math.hypot(t.x-x,t.z-z)<4.8))continue;const size=.9+hash(ty,tx)*.4;tree(x,z,size,hash(tx+7,ty)>.85);planted.push({x,z});treeCount++;}
  // Tree clusters around the northern forest preserve paths and exact model footprints.
  for(let ty=2;ty<37;ty+=3)for(let tx=25;tx<99;tx+=3){if(groundAt(tx,ty)!=='f'||hash(tx,ty)>.55)continue;const x=X(tx+.5),z=Z(ty+.5);if(taken(x,z,2.2)||reserveArrival(x,z,4))continue;tree(x,z,.9+hash(ty,tx)*.35,false);treeCount++;}

  // Keep every destination safe, while preserving its label at the original source point.
  // Alternate nearby approaches are a navigation detail, never a moved building.
  const bounds={minX:-99,maxX:99,minZ:-127,maxZ:127};
  const isWalkable=(x,z)=>{const tx=Math.floor(x/2+50),ty=Math.floor(z/2+64);return tx>=0&&tx<100&&ty>=0&&ty<128&&CAMPUS.ground[ty][tx]!=='x';};
  const free=(x,z)=>isWalkable(x,z)&&x>bounds.minX+.7&&x<bounds.maxX-.7&&z>bounds.minZ+.7&&z<bounds.maxZ-.7&&!taken(x,z,.65);
  for(const p of places){if(free(p.arrival.x,p.arrival.z))continue;const origin={...p.arrival};let found=null;
    for(let r=.75;r<=14&&!found;r+=.75)for(let i=0;i<24;i++){const angle=i*Math.PI/12,x=origin.x+Math.cos(angle)*r,z=origin.z+Math.sin(angle)*r;if(free(x,z)){found={x,z};break;}}
    if(found)p.arrival=found;
  }
  const stats=k.finalize();stats.trees=treeCount;stats.buildings=buildings.length;stats.spots=CAMPUS.spots.length;stats.supportedFootprints=supportedFootprints;stats.refinement={fountain:{scale:fountain.scale,stones:stones.length,basinRadius:[fr,fzr],pavingRadius:[plazaRx,plazaRz],cylinderRadius:cylinderR,cylinderHeight:cylinderH,cylinderDepthScale:.72,mistParticles:33},nuri:{depth:pitDepth,stairCount:13,stairWidth:38/8},eagle:{height:122*.6/8,verticalMapScale:.6,surroundingStones:4}};
  function setNight(night){k.setNight(night);for(const light of lights)light.material.opacity=night?.085:0;}
  let disposed=false;
  function dispose(){
    if(disposed)return;disposed=true;
    const geometries=new Set(),materials=new Set();
    scene.traverse(object=>{
      if(object.geometry)geometries.add(object.geometry);
      if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);
      if(object.isInstancedMesh)object.dispose();
    });
    for(const geometry of geometries)geometry.dispose();
    for(const material of materials)material.dispose();
    updates.length=0;lights.length=0;
    scene.removeFromParent();scene.clear();
  }
  return{group:scene,dispose,cameraObstacles,colliders:k.colliders,places,spawn:{x:26,z:122},bounds,isWalkable,update(t){if(!disposed)for(const update of updates)update(t);},setNight,stats,mapData:{ground:CAMPUS.ground,buildings:buildings.map(b=>({...b})),width:100,height:128,scale:2}};
}
