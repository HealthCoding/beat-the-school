// Original models, interpreted from the existing village's art-heritage.ts and
// art-academic.ts. These are toy-scale silhouettes, not measured elevations.
export const HERITAGE_IDS = ['underwood','stimson','appenzeller','pinson','yeonhui','nonjidang','theology','education','dining'];
const C = {stone:'#aaa999', pale:'#d4cfb9', joint:'#878c7f', roof:'#657772', dark:'#485c56', glass:'#567f82', ivy:'#628360', wood:'#8b7352'};

function mass(k,x,z,w,h,d,color=C.stone) {
  k.box(x,h/2,z,w,h,d,color);
  k.collider(x,z,w,d);
  k.box(x,.27,z,w+.18,.54,d+.18,C.joint);
}
function ledge(k,x,y,z,w,d,color=C.pale) { k.box(x,y,z,w,.28,d,color); }
function roof(k,x,y,z,w,d,h=2.6,color=C.roof) {
  // Stepped hipped slate roof: long ridge along the facade, four sloping edges.
  ledge(k,x,y,z,w+.26,d+.26,C.pale);
  const n=7;
  for(let i=0;i<n;i++){
    const t=i/n;
    k.box(x,y+.2+(i+.5)*h/n,z,w-t*Math.min(w*.32,h*1.7),h/n+.035,Math.max(.5,d*(1-t)+.15),i%3===0?C.dark:color);
  }
  k.box(x,y+h+.27,z,w-Math.min(w*.32,h*1.7),.24,.46,C.dark);
}
function gable(k,x,y,z,w,d,h,color=C.stone) {
  // Solid front-facing triangular gable, rendered as broad clean voxel courses.
  const n=8;
  for(let i=0;i<n;i++){
    const ww=w*(1-i/n);
    k.box(x,y+(i+.5)*h/n,z,ww,h/n+.01,d,color);
    // Roof edge on each slope, and the ridge are the only dark trim.
    for(const s of [-1,1])k.box(x+s*(ww/2-.12),y+(i+.9)*h/n,z,.32,h/n*.4,d+.2,C.roof);
  }
}
function window(k,x,y,z,w=1.2,h=1.65,side=0) {
  const b=(xx,yy,zz,ww,hh,dd,c)=>Math.abs(side)===1?k.box(zz,yy,xx,dd,hh,ww,c):k.box(xx,yy,zz,ww,hh,dd,c);
  b(x,y,z,w+.32,h+.3,.16,C.pale);
  b(x,y,z+(side<0?-.12:.12),w,h,.14,C.glass);
  b(x,y,z+(side<0?-.21:.21),.085,h,.12,C.pale);
  b(x,y+.08,z+(side<0?-.22:.22),w,.075,.12,C.pale);
  b(x,y-h/2-.16,z+(side<0?-.16:.16),w+.5,.17,.3,C.pale);
}
function rearAndSides(k,w,d,rows=2,h=8) {
  for(let r=0;r<rows;r++){
    const y=1.8+r*(h-2.8)/Math.max(1,rows-1);
    for(let c=0;c<Math.max(2,Math.floor(w/3));c++){
      const n=Math.max(2,Math.floor(w/3));
      window(k,-w/2+(c+1)*w/(n+1),y,-d/2-.01,1.1,1.5,-2);
    }
    for(const side of [-1,1])for(const z of [-d*.25,d*.2])window(k,z,y,side*(w/2+.01),1.05,1.5,side);
  }
}
function courses(k,w,h,z,color=C.joint) {
  // Sparse masonry courses retain the source's stonework without pixel noise.
  for(let y=1.05;y<h-.5;y+=1.3) {
    k.box(0,y,z,w-.2,.055,.08,color);
    const offset=Math.round(y*10)%2?1.1:0;
    for(let x=-w/2+1+offset;x<w/2-.8;x+=3.7)k.box(x,y+.48,z,.055,.9,.09,color);
  }
}
function entry(k,x,z,w=2.5,h=3,point=true) {
  k.box(x,h/2+.2,z,w+.62,h+.4,.28,C.pale);
  k.box(x,h/2+.12,z+.18,w,h,.18,C.dark);
  k.box(x,h*.69,z+.29,w-.2,.7,.12,C.glass);
  k.box(x,h/2,z+.32,.11,h,.12,C.pale);
  k.box(x+.21,1.05,z+.4,.08,.28,.09,'#b69d62');
  if(point)for(let i=0;i<4;i++)k.box(x,h+.34+i*.22,z,Math.max(.3,w+.6-i*.55),.28,.35,C.pale);
  // Shallow stoop remains visually distinct; pedestrians can reach the door.
  for(let i=0;i<3;i++)k.box(x,.09+i*.11,z+.16-i*.12,w+.8-i*.16,.18+i*.22,.65-i*.14,i%2?C.joint:C.pale);
}
function ivy(k,x,y,z,w,h) {
  k.box(x,y,z,w,h,.12,C.ivy);
  k.box(x+w*.35,y+h*.24,z+.04,w*.6,h*.55,.1,'#7a915e');
  k.box(x-w*.28,y-h*.15,z+.04,w*.55,h*.56,.1,'#4f7256');
}
function crenel(k,x,y,z,w,d) {
  ledge(k,x,y,z,w+.35,d+.35);
  for(let i=0;i<4;i++)for(const s of [-1,1])k.box(x-w/2+(i+.5)*w/4,y+.55,z+s*(d/2-.18),w/7,1,.5,C.stone);
  for(const s of [-1,1])for(const dz of [-d*.18,d*.18])k.box(x+s*(w/2-.18),y+.55,z+dz,.5,1,.65,C.stone);
}

function underwood(k,b) {
  // Source: two low symmetric ivy wings and a square castellated center;
  // the small emblem is a shield, deliberately no invented clock face.
  const w=b.w-.8,d=b.d-1.3,zf=d/2,h=8.1,tw=w*.225;
  mass(k,0,0,w,h,d); roof(k,0,h,0,w+.55,d+.48,2.8);
  courses(k,w,h,zf+.03);
  for(const x of [-w*.42,-w*.29,-w*.17,w*.17,w*.29,w*.42])for(const y of [2.8,6])window(k,x,y,zf+.1,1.45,1.85);
  for(const x of [-w*.46,-w*.34,w*.34,w*.46])ivy(k,x,4.7,zf+.11,.38,5.1);
  mass(k,0,.33,tw,13.8,d+.66,'#9ca48e');
  for(const s of [-1,1])k.box(s*(tw/2-.15),7,.33,.43,14,d+.78,C.pale);
  crenel(k,0,13.9,.33,tw,d+.66);
  for(const y of [5.2,8.25,10.55])window(k,0,y,zf+.72,tw*.49,1.65);
  for(const y of [6.4,9.45,12.3])ledge(k,0,y,zf+.63,tw+.16,.42);
  entry(k,0,zf+.75,2.15,3.1);
  k.box(0,12.7,zf+.8,1.1,.95,.22,C.pale);k.box(0,12.7,zf+.94,.42,.55,.09,'#718f92');
  for(const s of [-1,1]){k.box(s*.75,15.8,.2,.065,2.1,.065,C.joint);k.box(s*.75+.35,16.3,.2,.65,.5,.06,s<0?'#f3eddd':'#477da0');}
  rearAndSides(k,w,d,2,h);
  return {height:16.85,door:{x:0,z:b.d/2+1.4}};
}
function stimson(k,b) {
  // Source: long TWO-storey roof, warm stone, one off-center thin chimney;
  // shallow central portal, deliberately no tower.
  const w=b.w-.8,d=b.d-1.3,h=7.2,z=d/2;
  mass(k,0,0,w,h,d,'#b0a790');roof(k,0,h,0,w+.48,d+.5,2.35,'#7c8173');
  courses(k,w,h,z+.04);ledge(k,0,3.8,0,w+.1,d+.1);
  for(const x of [-w*.4,-w*.25,-w*.1,w*.13,w*.28,w*.42])window(k,x,5.4,z+.11,1.2,1.8);
  for(const x of [-w*.38,-w*.2,w*.24,w*.4])window(k,x,2.1,z+.11,1.3,1.55);
  for(const x of [-w*.46,-w*.32,w*.07,w*.35])ivy(k,x,3.9,z+.07,.46,5.7);
  k.box(.45,10.15,-.5,.65,2.25,.8,C.pale);ledge(k,.45,11.3,-.5,.92,1);
  k.box(0,1.8,z+.1,3.6,3.6,.45,'#bbb69e');entry(k,0,z+.35,2.25,3.05,false);
  rearAndSides(k,w,d,2,h);
  return {height:11.44,door:{x:0,z:b.d/2+1.4}};
}
function appenzeller(k,b) {
  // Source: flat parapet, faceted projecting end bays, paired tall upper windows,
  // and a small gabled entrance. This hall has no large pitched roof.
  const w=b.w-.9,d=b.d-1.3,h=8.1,z=d/2,bay=w*.13;
  mass(k,0,-.15,w-1,h,d-.3,'#a4a894');ledge(k,0,h+.1,-.15,w-.5,d+.1);
  k.box(0,h+.4,-.15,w-1,.6,d-.3,C.joint);k.box(0,h+.55,-.15,w-1.5,.18,d-.85,C.roof);
  courses(k,w-1,h,z-.22);
  for(const x of [-w*.31,-w*.16,0,w*.16,w*.31])window(k,x,6,z-.18,1.45,2.05);
  for(const x of [-w*.29,-w*.13,w*.15,w*.31])window(k,x,2.4,z-.18,1.05,1.35);
  for(const s of [-1,1]){
    const x=s*(w/2-bay/2);
    mass(k,x,0,bay,8.8,d,'#a8ad96');ledge(k,x,8.95,0,bay+.27,d+.2);
    for(const dx of [-1,1])k.box(x+dx*(bay/2-.13),4.25,z+.08,.32,8.5,.32,dx<0?C.pale:C.joint);
    for(const y of [2.55,6])window(k,x,y,z+.17,1.04,1.9);
    k.box(x,8.18,z+.1,.76,.5,.12,C.pale);
  }
  mass(k,0,z-.35,3.6,3.65,1.5,'#bcbda7');gable(k,0,3.65,z-.35,3.9,1.5,1.25,C.pale);
  entry(k,0,z+.46,2.05,2.9);
  for(const x of [-w*.37,w*.38])ivy(k,x,4.9,z-.16,.47,5);
  rearAndSides(k,w-1,d-.3,2,h);
  return {height:9.1,door:{x:0,z:b.d/2+1.4}};
}
function pinson(k,b) {
  // Source: bare mottled stone, twin roof dormers and a low central entrance
  // gable; the former dormitory is low and intimate, with no tall keep.
  const w=b.w-.8,d=b.d-1.2,h=7.7,z=d/2;
  mass(k,0,0,w,h,d,'#a2a699');roof(k,0,h,0,w+.5,d+.5,2.4,'#657b77');courses(k,w,h,z+.04);
  ledge(k,0,3.85,0,w+.1,d+.1);
  for(const x of [-w*.41,-w*.29,-w*.17,w*.17,w*.29,w*.41])for(const y of [2,5.65])window(k,x,y,z+.1,.95,1.8);
  for(const x of [-w*.31,w*.31]){
    k.box(x,9.15,1.05,2.3,1.95,2,'#85968c');gable(k,x,10.1,1.05,2.65,2.1,1.05,C.roof);window(k,x,9.25,2.1,1.14,1.12);
  }
  mass(k,0,z-.35,3.2,8,1.6,'#b0b19d');gable(k,0,8,z-.35,3.5,1.7,1.6,C.stone);
  window(k,0,5.8,z+.55,1.45,1.85);entry(k,0,z+.55,2.05,3.05,false);
  k.box(2.05,1.7,z+.17,.43,1,.1,'#376f7a');
  for(const x of [-w*.47,w*.47])ivy(k,x,1.6,z+.11,.48,2.3);
  rearAndSides(k,w,d,2,h);
  return {height:11.3,door:{x:0,z:b.d/2+1.4}};
}
function yeonhui(k,b) {
  // Source: taller warm stone hall, four window rows, twin end gables,
  // narrow pale castellated central bay and sparse climbing vines.
  const w=b.w-.8,d=b.d-1.3,h=12.7,z=d/2,ew=w*.18,tw=w*.16;
  mass(k,0,-.1,w,h,d-.2,'#ad9f85');roof(k,0,h,-.1,w+.4,d+.2,1.65,'#847967');courses(k,w,h,z-.17,'#8c927d');
  for(const s of [-1,1]){
    const x=s*(w/2-ew/2);
    mass(k,x,0,ew,13.2,d,'#a69b83');gable(k,x,13.2,0,ew+.15,d+.18,3.1,'#b0a58c');
    window(k,x,14.05,z+.16,.9,1);
  }
  for(const x of [-w*.41,-w*.32,-w*.22,-w*.12,w*.12,w*.22,w*.32,w*.41])for(const y of [2,5,8,11])window(k,x,y,z+.11,.86,1.43);
  for(const x of [-w*.46,-w*.26,w*.26,w*.46])ivy(k,x,6.5,z+.07,.3,10.8);
  mass(k,0,.25,tw,16.5,d+.5,'#bbb298');crenel(k,0,16.55,.25,tw,d+.5);
  for(const s of [-1,1])k.box(s*(tw/2-.1),8.4,z+.58,.4,16.8,.34,C.pale);
  for(const y of [4.7,7.2,9.7,12.2,14.7])window(k,0,y,z+.62,.9,1.5);
  k.box(0,1.8,z+.58,3.35,3.6,.6,C.pale);gable(k,0,3.6,z+.58,3.6,.7,1.1,C.pale);entry(k,0,z+.76,2,2.95);
  rearAndSides(k,w,d,4,h);
  return {height:17.6,door:{x:0,z:b.d/2+1.4}};
}
function nonjidang(k,b) {
  // Source: ONE-storey cream lounge, low roof, timber veranda and lattice.
  // Kept faithful to the current village, rather than inventing a hanok temple.
  const w=b.w-1,d=b.d-1.5,backDepth=d-1.1,z=d/2;
  mass(k,0,-.55,w,3.4,backDepth,'#ddd2ac');
  k.box(0,.25,z-.6,w+.1,.5,1.25,C.wood);
  roof(k,0,3.48,-.12,w+.55,d+.6,.72,'#859483');
  for(const x of [-w*.35,-w*.21,w*.21,w*.35])window(k,x,1.9,z-1.06,.85,1.95);
  entry(k,0,z-1.03,1.65,2.5,false);
  for(const x of [-w*.46,-w*.11,w*.11,w*.46]){
    k.box(x,1.95,z-.05,.17,3.3,.17,'#98774f');k.collider(x,z-.05,.17,.17);
  }
  for(const s of [-1,1]){
    const x=s*w*.3,ww=w*.31;
    for(const y of [.62,1.5])k.box(x,y,z,ww,.14,.12,'#765b3d');
    for(let j=0;j<6;j++)k.box(x-ww/2+(j+.5)*ww/6,1.05,z,.075,.86,.12,'#876947');
  }
  k.box(0,3.05,z-.95,1.35,.36,.12,'#7d7655');
  for(const x of [-w*.3,0,w*.3])window(k,x,1.8,-d/2-.03,.95,1.4,-2);
  for(const side of [-1,1])window(k,-.8,1.8,side*(w/2+.02),.95,1.4,side);
  return {height:4.47,door:{x:0,z:b.d/2+1.4}};
}
function theology(k,b) {
  // Source: low stone wings, tall pointed central gable, a rose window,
  // pale balcony and the stair ascending along the right-hand side.
  const w=b.w-.85,d=b.d-1.4,h=8.5,z=d/2,tw=w*.35;
  mass(k,0,-.1,w,h,d-.2,'#9ca08e');ledge(k,0,h+.15,-.1,w+.25,d+.1);courses(k,w,h,z-.17);
  for(const s of [-1,1])for(const x of [.29,.41])for(const y of [2.5,5.9])window(k,s*w*x,y,z-.08,1,1.7);
  mass(k,0,.15,tw,12.25,d+.3,'#959e8d');gable(k,0,12.25,.15,tw+.12,d+.4,3.2,C.pale);
  // Stepped rose opening with light stone surround and cross mullions.
  const rz=z+.46;
  k.box(0,12.2,rz,1.72,1.1,.16,C.pale);k.box(0,12.2,rz,1.12,1.72,.16,C.pale);
  k.box(0,12.2,rz+.1,1.25,.75,.14,C.glass);k.box(0,12.2,rz+.1,.75,1.25,.14,C.glass);
  k.box(0,12.2,rz+.2,.09,1.4,.07,C.pale);k.box(0,12.2,rz+.2,1.4,.09,.07,C.pale);
  window(k,0,9.2,rz,2.2,1.85);window(k,0,5.45,rz,1.85,2.15);
  for(const s of [-1,1])window(k,s*tw*.35,10.65,rz,.42,1.35);
  k.box(0,7.92,rz+.24,3.5,.34,1.03,C.pale);k.box(0,8.43,rz+.72,3.5,.8,.15,C.pale);
  for(const x of [-1.3,-.65,0,.65,1.3])k.box(x,8.45,rz+.82,.22,.44,.08,C.joint);
  entry(k,0,rz+.2,2.15,2.8,false);ledge(k,0,3.35,rz+.12,3.5,.85);
  for(let i=0;i<7;i++){
    const xx=w*.24+i*.4,hh=3.4-i*.43;
    k.box(xx,hh/2,z+.08,.43,hh,.55,i%2?C.pale:C.stone);
  }
  rearAndSides(k,w,d-.2,2,h);
  return {height:15.6,door:{x:0,z:b.d/2+1.4}};
}
function education(k,b) {
  // Source: tall ivory block, reddish window spandrels on the left, blue
  // vertical glass tower on the right, and a low projecting entry canopy.
  const w=b.w-.9,d=b.d-1.3,z=d/2,lw=w*.61,rw=w-lw;
  mass(k,-rw/2,-.15,lw,15.25,d-.3,'#dfddcf');ledge(k,-rw/2,15.35,-.15,lw+.16,d-.05);
  for(let c=0;c<3;c++){
    const x=-w/2+(c+1)*lw/4;
    k.box(x,8.65,z-.2,1.65,11.75,.13,'#aa8270');
    for(let r=0;r<6;r++)window(k,x,3.9+r*1.85,z-.05,1.27,1.18);
    k.box(x-.95,8.7,z-.06,.19,12.2,.2,'#ede7d5');
  }
  const tx=lw/2;
  mass(k,tx,0,rw,16.5,d,'#e8e4d5');ledge(k,tx,16.65,0,rw+.18,d+.18);
  k.box(tx,8.95,z+.09,rw*.57,13.25,.16,C.glass);
  for(let i=0;i<9;i++)k.box(tx,2.45+i*1.5,z+.2,rw*.59,.12,.18,'#b9ccc1');
  for(const dx of [-rw*.28,0,rw*.28])k.box(tx+dx,8.92,z+.23,.13,13.4,.16,'#8faeab');
  k.box(tx,2.75,z+.45,rw+1.3,.6,1.22,'#d4d5c3');
  for(const x of [tx-rw/2-.3,tx+rw/2+.3]){k.box(x,1.25,z+.64,.28,2.5,.28,C.pale);k.collider(x,z+.64,.28,.28);}
  entry(k,tx,z+.16,2.1,2.2,false);
  rearAndSides(k,w,d,5,14.8);
  return {height:16.8,door:{x:tx,z:b.d/2+1.4}};
}
function dining(k,b) {
  // Source: low rough stone dining hall, broad two-storey left wing,
  // right-hand gabled entry bay and a pale horizontal canopy on two columns.
  const w=b.w-.9,d=b.d-1.35,h=7.2,z=d/2,rw=w*.35,rx=w*.3;
  mass(k,0,-.12,w,h,d-.24,'#9ba08c');ledge(k,0,h+.13,-.12,w+.12,d+.02,C.roof);courses(k,w,h,z-.21);
  for(const x of [-w*.41,-w*.27,-w*.13,w*.01])for(const y of [2.3,5.3])window(k,x,y,z-.1,1.05,1.65);
  mass(k,rx,.1,rw,7.9,d+.2,'#929b88');gable(k,rx,7.9,.1,rw+.17,d+.3,2.4,'#a0a78f');
  for(const dx of [-rw*.23,rw*.23])window(k,rx+dx,6.1,z+.31,1.14,1.6);
  k.box(rx,4.5,z+.36,rw+.6,.64,.95,'#e2dfcc');
  for(const s of [-1,1]){k.box(rx+s*rw*.45,2.1,z+.55,.32,4.2,.32,C.pale);k.collider(rx+s*rw*.45,z+.55,.32,.32);}
  entry(k,rx,z+.24,2.1,3.05,false);
  rearAndSides(k,w,d-.24,2,h);
  return {height:10.45,door:{x:rx,z:b.d/2+1.4}};
}
const BUILDERS={underwood,stimson,appenzeller,pinson,yeonhui,nonjidang,theology,education,dining};
const DESCRIPTIONS={
  underwood:'낮은 양쪽 날개 사이로 네모난 중앙 탑이 솟아요. 탑의 성가퀴와 담쟁이, 푸른 교기를 원본 마을에서 가져왔어요.',
  stimson:'길고 낮은 2층 석조 건물이에요. 경사진 지붕 위의 가느다란 굴뚝과 담쟁이가 특징이에요.',
  appenzeller:'평평한 지붕과 앞으로 나온 양끝 벽체가 특징이에요. 중앙 입구에만 작은 박공을 얹었어요.',
  pinson:'낮은 석조 몸체에 지붕 창 두 개가 올라가 있어요. 중앙 현관의 작은 박공을 살렸어요.',
  yeonhui:'네 줄의 창, 양끝의 높은 박공, 좁고 밝은 중앙 탑이 특징이에요. 원본의 따뜻한 석재 색을 반영했어요.',
  nonjidang:'한 층짜리 크림색 건물 앞에 목재 베란다가 있어요. 원본의 낮은 지붕과 격자 난간을 살렸어요.',
  theology:'낮은 석조 날개 가운데 뾰족한 박공이 솟아요. 작은 장미창과 밝은 발코니를 반영했어요.',
  education:'왼쪽의 적갈색 창 사이 벽과 오른쪽의 세로 유리탑이 대비돼요. 밝은 외벽과 낮은 입구 캐노피를 반영했어요.',
  dining:'낮고 넓은 2층 석조 건물이에요. 오른쪽 박공 현관과 밝은 수평 캐노피가 특징이에요.'
};
export function buildHeritage(k,b) {
  const builder=BUILDERS[b.id];
  if(!builder)throw new Error(`Unknown heritage building: ${b.id}`);
  return {...builder(k,b),description:DESCRIPTIONS[b.id]};
}
