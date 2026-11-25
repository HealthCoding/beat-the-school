// Official-photo-informed silhouettes in the layout's game units (0.22 units/m).
// Heights and footprint dimensions supplied by LAYOUT are visual estimates, not surveys.
// The original heritage.js and modern.js builders remain untouched.
const C={stone:'#a8a396',stoneDark:'#827e74',limestone:'#d6d2c5',concrete:'#d6d7d3',white:'#e2e3de',
  roof:'#555a58',glass:'#516d78',glassLight:'#7c949d',frame:'#b8bfbd',dark:'#384747',brick:'#a97864'};
export const MODEL_FLOORS={library:6,samsung:7,business:6,centennial:3,auditorium:3,union:4,
  engHall:6,engPark:4,science:6,eng2:7,eng3:7,eng4:7,daewoo:6,baekyang:6,samsungHall:7,
  gym:2,music:4,law:5,'luce-wing':1,amphitheater:1,underwood:4,stimson:2,appenzeller:3,
  pinson:3,yeonhui:6,nonjidang:1,theology:4,education:6,dining:2};
const HISTORIC=new Set(['underwood','stimson','appenzeller','pinson','yeonhui','theology','dining']);
export function buildRealistic(k,b){
 const W=b.width??b.w,D=b.depth??b.d,H=b.height;
 if(![W,D,H].every(n=>Number.isFinite(n)&&n>0))throw new Error(`Invalid realistic dimensions: ${b.id}`);
 const floors=Math.max(1,Math.min(9,b.floors??MODEL_FLOORS[b.id]??Math.round(H/.72)));
 const emitted=[];
 const box=(x,y,z,w,h,d,c)=>{
  // All trim and glazing remain in the declared base footprint.
  w=Math.min(w,W);d=Math.min(d,D);
  x=Math.max(-W/2+w/2,Math.min(W/2-w/2,x));z=Math.max(-D/2+d/2,Math.min(D/2-d/2,z));
  emitted.push({x,y,z,w,h,d,c});
 };
 const mass=(x,z,w,d,h,c=C.concrete,base=0)=>{box(x,base+h/2,z,w,h,d,c);k.collider?.(x,z,w,d);};
 const roofFlat=(x,z,w,d,y,c=C.roof)=>box(x,y+.035,z,w,.07,d,c);
 // Dense, thin roof contours avoid the former thick seven-step toy roof.
 const pitched=(x,z,w,d,base,rise,c=C.roof,n=48)=>{
  for(let i=0;i<n;i++){
   const t=(i+.5)/n,ww=Math.max(.025,w*(1-t));
   box(x,base+(i+.5)*rise/n,z,ww,rise/n+.002,d,c);
  }
 };
 const hip=(x,z,w,d,base,rise,c=C.roof,n=48)=>{
  for(let i=0;i<n;i++){
   const t=(i+.5)/n;box(x,base+(i+.5)*rise/n,z,w*(1-t*.78),rise/n+.002,d*(1-t*.92),c);
  }
 };
 const pane=(x,y,z,w,h,side=0,stone=false)=>{
  const offset=stone?.025:.018;
  const place=(xx,yy,zz,ww,hh,dd,c)=>side?box(zz,yy,xx,dd,hh,ww,c):box(xx,yy,zz,ww,hh,dd,c);
  place(x,y,z,w+.06,h+.06,.025,stone?C.limestone:C.dark);
  place(x,y,z+offset,w,h,.026,C.glass);
  if(stone)place(x,y,z+offset+.018,.025,h,.018,C.limestone);
 };
 const facade=(x,z,w,h,rows=floors,base=0,stone=false,cols=Math.max(3,Math.round(w/.7)))=>{
  const dx=w/cols,dy=h/rows;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)pane(x-w/2+(c+.5)*dx,base+(r+.55)*dy,z,dx*(stone?.49:.57),dy*(stone?.64:.55),0,stone);
 };
 const sides=(x,z,w,d,h,rows=floors,base=0,stone=false)=>{
  const cols=Math.max(2,Math.round(d/.85)),step=d/cols,dy=h/rows;
  for(const sign of[-1,1])for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
   const xx=x+sign*(w/2+.014),zz=z-d/2+(c+.5)*step,yy=base+(r+.55)*dy;
   box(xx,yy,zz,.025,dy*.58,step*.55,stone?C.limestone:C.dark);
   box(xx+sign*.018,yy,zz,.025,dy*.52,step*.48,C.glass);
  }
 };
 const bands=(x,z,w,d,h,rows=floors,base=0,c=C.white)=>{for(let r=1;r<rows;r++)box(x,base+r*h/rows,z,w,.035,d,c);};
 const entry=(x,z,w=.65,h=.78)=>{
  box(x,h/2,z,w+.1,h+.06,.04,C.limestone);box(x,h/2,z+.025,w,h,.035,C.dark);
  box(x,h*.63,z+.048,w*.8,h*.45,.02,C.glassLight);
 };
 const masonry=(x,z,w,h)=>{
  // Sparse shallow stone courses retain natural material variation without a tiled logo.
  for(let r=0;r<Math.min(15,Math.round(h/.23));r++){
   const y=(r+.5)*h/Math.max(1,Math.round(h/.23)),cols=Math.max(4,Math.round(w/.45));
   for(let c=0;c<cols;c++)if((r*7+c*11)%6===0)box(x-w/2+(c+.5)*w/cols,y,z,w/cols*.84,.13,.014,(r+c)%2?C.stoneDark:'#b7b09f');
  }
 };
 const curtain=(x,z,w,h,rows=floors,base=0,cols=Math.max(4,Math.round(w/.7)))=>{
  box(x,base+h/2,z,w,h,.035,C.glass);
  for(let c=0;c<=cols;c++)box(x-w/2+c*w/cols,base+h/2,z+.025,.03,h,.025,C.frame);
  for(let r=0;r<=rows;r++)box(x,base+r*h/rows,z+.027,w,.026,.025,C.frame);
 };
 let bodyH=H*.94,stone=HISTORIC.has(b.id),front=D*.485;
 if(stone){
  const pitchedHall=!['appenzeller','theology','yeonhui','dining'].includes(b.id);
  bodyH=H*(pitchedHall?.71:.76);
  mass(0,0,W*.95,D*.94,bodyH,C.stone);masonry(0,front,W*.93,bodyH);
  const visibleRows=b.id==='underwood'?2:b.id==='yeonhui'?4:b.id==='pinson'?2:b.id==='appenzeller'?2:floors;
  facade(0,front,W*.92,bodyH,visibleRows,0,true,Math.max(5,Math.round(W/.7)));
  facade(0,-D*.476,W*.9,bodyH,visibleRows,0,true);
  sides(0,0,W*.95,D*.94,bodyH,visibleRows,0,true);
  if(pitchedHall)hip(0,0,W*.99,D*.98,bodyH,H*.20);
  if(b.id==='underwood'||b.id==='yeonhui'){
   const tw=W*.18,th=H*.95;
   mass(0,D*.015,tw,D*.98,th,b.id==='yeonhui'?'#ae9d86':C.stoneDark);
   facade(0,D*.51,tw*.72,th,4,0,true,2);
   for(const sign of[-1,1])box(sign*(tw/2-.035),th*.52,D*.51,.07,th*.88,.07,C.limestone);
   roofFlat(0,D*.015,tw,D*.98,th,C.stoneDark);
   for(let i=0;i<5;i++)for(const sign of[-1,1])box(-tw/2+(i+.5)*tw/5,H*.977,D*.015+sign*D*.46,tw*.13,H*.035,.12,C.stone);
   if(b.id==='yeonhui'){
    for(const sign of[-1,1]){const x=sign*W*.4;pitched(x,0,W*.19,D*.95,bodyH,H*.22,C.stone);
     for(let c=0;c<3;c++)box(x+(c-1)*W*.045,bodyH*.48,front+.012,W*.025,bodyH*.75,.02,C.brick);}
    hip(0,0,W*.64,D*.95,bodyH,H*.10);
   }
  }else if(b.id==='appenzeller'){
   roofFlat(0,0,W*.96,D*.95,bodyH,C.roof);
   for(const sign of[-1,1]){const x=sign*W*.415;mass(x,0,W*.16,D*.98,H*.82,C.stone);facade(x,D*.50,W*.15,H*.8,2,0,true,2);}
   for(const sign of[-1,1])box(0,bodyH+.09,sign*D*.465,W*.95,.16,.12,C.stone);
   pitched(0,D*.42,W*.2,D*.13,H*.3,H*.13,C.stone);
  }else if(b.id==='pinson'){
   const x=-W*.1;mass(x,D*.08,W*.16,D*.34,H*.15,C.stone,bodyH+H*.03);
   pitched(x,D*.08,W*.18,D*.35,bodyH+H*.18,H*.10);pane(x,bodyH+H*.10,D*.265,W*.08,H*.09,0,true);
  }else if(b.id==='stimson'){
   mass(W*.11,-D*.08,W*.027,D*.07,H*.15,C.limestone,H*.82);
  }else if(b.id==='theology'){
   const tw=W*.35;mass(0,0,tw,D*.96,H*.78,C.stoneDark);
   pitched(0,0,tw,D*.98,H*.78,H*.215,C.stoneDark);
   const ry=H*.70,rw=tw*.23;
   for(let j=0;j<18;j++){const yy=(j+.5)/18*2-1;box(0,ry+yy*rw/2,D*.50,rw*Math.sqrt(Math.max(.001,1-yy*yy)),rw/18,.03,C.limestone);}
   pane(0,H*.53,D*.505,tw*.45,H*.17,0,true);
   box(W*.21,H*.075,D*.40,W*.25,H*.15,D*.16,C.limestone);
  }else if(b.id==='dining'){
   const x=W*.25;mass(x,0,W*.3,D*.98,H*.77,C.stone);
   pitched(x,0,W*.3,D*.98,H*.77,H*.22,C.stone);
   box(x,H*.31,D*.48,W*.38,.10,D*.10,C.limestone);
   for(const s of[-1,1])box(x+s*W*.15,H*.15,D*.49,.06,H*.3,.06,C.limestone);
  }
  entry(0,Math.min(D*.51,D/2),Math.min(.8,W*.14),Math.min(.95,H*.23));
 }else switch(b.id){
  case'nonjidang':{
   const h=H*.73;mass(0,-D*.06,W*.93,D*.83,h,'#c9bba0');
   hip(0,0,W*.99,D*.99,h,H*.265,'#707568');
   facade(0,D*.365,W*.9,h,1,0,false,6);
   for(let i=0;i<6;i++)box(-W*.45+i*W*.18,h*.48,D*.45,.05,h*.96,.05,'#826b4e');
   box(0,h*.19,D*.47,W*.9,.035,.025,'#725d48');entry(0,D*.4,.55,H*.57);break;
  }
  case'library':{
   mass(0,0,W*.96,D*.95,H*.95,C.limestone);
   curtain(0,front,W*.89,H*.88,6,H*.03,10);
   for(let i=0;i<=10;i++)box(-W*.445+i*W*.089,H*.47,D*.499,W*.024,H*.94,D*.04,C.limestone);
   sides(0,0,W*.96,D*.95,H*.92,6);roofFlat(0,0,W*.99,D*.99,H*.96);break;
  }
  case'samsung':{
   mass(0,0,W*.94,D*.95,H*.95,C.concrete);curtain(0,front,W*.92,H*.91,7,H*.02,12);
   for(let i=0;i<=6;i++)box(-W*.46+i*W*.92/6,H*.48,D*.493,.07,H*.96,.075,C.white);
   sides(0,0,W*.94,D*.95,H*.94,7);roofFlat(0,0,W*.99,D*.99,H*.975,C.concrete);break;
  }
  case'business':{
   const tw=W*.14,lw=W-tw,tx=W/2-tw/2;
   mass(-tw/2,-D*.04,lw*.94,D*.85,H*.35,C.dark);curtain(-tw/2,D*.396,lw*.9,H*.32,2,0,10);
   mass(-tw/2,0,lw*.98,D*.95,H*.6,'#9c9387',H*.35);
   facade(-tw/2,front,lw*.95,H*.59,4,H*.35);sides(-tw/2,0,lw*.98,D*.95,H*.59,4,H*.35);
   mass(tx,0,tw*.9,D*.95,H*.98,C.white);facade(tx,front,tw*.8,H*.96,6,0,false,1);roofFlat(-tw/2,0,lw,D*.99,H*.955);break;
  }
  case'science':{
   const sw=W*.28,cw=W-2*sw;
   for(const sign of[-1,1]){const x=sign*(W/2-sw/2);mass(x,0,sw*.97,D*.96,H*.96,C.white);facade(x,front,sw*.94,H*.93,6);sides(x,0,sw*.97,D*.96,H*.93,6);roofFlat(x,0,sw,D*.98,H*.965);}
   mass(0,-D*.34,cw,D*.28,H*.91,C.white);curtain(0,-D*.19,cw*.95,H*.87,6);roofFlat(0,-D*.34,cw,D*.28,H*.92);break;
  }
  case'centennial':{
   mass(0,0,W*.96,D*.95,H*.68,'#c8bdae');curtain(0,front,W*.8,H*.32,2,H*.08);
   for(let i=0;i<48;i++){const xx=-W*.49+(i+.5)*W*.98/48,hh=H*.24*Math.sqrt(Math.max(0,1-(xx/(W*.5))**2));
    box(xx,H*.68+hh/2,0,W*.98/48,Math.max(.025,hh),D*.97,'#b9ae9e');}
   break;
  }
  case'auditorium':{
   const h=H*.7;mass(0,0,W*.96,D*.95,h,C.limestone);pitched(0,0,W*.98,D*.98,h,H*.295,C.concrete);
   curtain(0,front,W*.87,h*.91,7,h*.02,9);
   for(let i=0;i<=9;i++)box(-W*.435+i*W*.87/9,h*.48,D*.493,.10,h*.94,.07,C.limestone);break;
  }
  case'union':{
   mass(0,0,W*.97,D*.95,H*.97,C.concrete);facade(0,front,W*.95,H*.96,4,0,false,Math.max(12,Math.round(W/.42)));
   const n=Math.max(12,Math.round(W/.42)),dx=W*.95/n;
   for(let i=0;i<=n;i++)box(-W*.475+i*dx,H*.48,D*.498,.035,H*.94,.03,C.white);
   for(let r=1;r<4;r++)box(0,r*H*.24,0,W*.98,.08,D*.98,C.concrete);break;
  }
  case'eng4':{
   mass(0,-D*.10,W*.95,D*.75,H*.96,C.concrete);curtain(0,D*.29,W*.93,H*.90,floors,H*.03,12);
   for(let i=0;i<=9;i++)box(-W*.475+i*W*.95/9,H*.48,D*.48,.08,H*.96,D*.04,C.white);
   for(let r=1;r<=floors;r++)box(0,r*H*.95/floors,D*.36,W*.95,.05,D*.24,C.white);
   roofFlat(0,0,W*.99,D*.99,H*.975,C.white);break;
  }
  case'engPark':{
   const lw=W*.72,rw=W-lw;
   mass(-rw/2,0,lw*.98,D*.94,H*.73,'#c9bfa8');facade(-rw/2,front,lw*.94,H*.71,4);bands(-rw/2,0,lw,D*.95,H*.72,4);
   mass(lw/2,0,rw*.96,D*.94,H*.94,'#c9bfa8');curtain(lw/2,front,rw*.70,H*.85,5,H*.04,3);
   pitched(lw/2,0,rw,D*.96,H*.94,H*.055,C.roof,24);roofFlat(-rw/2,0,lw,D*.96,H*.735);break;
  }
  case'daewoo':case'samsungHall':{
   const h=H*.8;mass(0,0,W*.96,D*.95,h,C.limestone);facade(0,front,W*.93,h,floors);sides(0,0,W*.96,D*.95,h,floors);
   for(const sign of[-1,1])pitched(sign*W*.38,0,W*.23,D*.97,h,H*.19,C.limestone);
   mass(0,0,W*.16,D*.97,H*.96,C.limestone);facade(0,D*.50,W*.15,H*.94,floors,0,false,2);
   roofFlat(0,0,W*.99,D*.99,h,C.roof);break;
  }
  case'gym':{
   const h=H*.66;mass(0,0,W*.96,D*.95,h,C.concrete);curtain(0,front,W*.94,h*.94,2,h*.02,10);
   for(let i=0;i<48;i++){const xx=-W*.49+(i+.5)*W*.98/48,hh=H*.33*Math.sqrt(Math.max(0,1-(xx/(W*.5))**2));
    box(xx,h+hh/2,0,W*.98/48,Math.max(.02,hh),D*.98,'#76807e');}
   break;
  }
  case'luce-wing':{
   mass(0,D*.08,W*.62,D*.59,H*.48,'#9c9481');curtain(0,D*.39,W*.58,H*.43,1,H*.02,7);
   // Thin continuous floating cantilever, shallow roof depth rather than a stepped temple.
   for(let i=0;i<48;i++){const x=-W*.5+(i+.5)*W/48,y=H*.66+(x/W+.5)*H*.29;box(x,y,0,W/48,.055,D*.99,'#8c8679');}
   break;
  }
  case'amphitheater':{
   const nx=36,nz=22,dx=W/nx,dz=D/nz;
   for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
    const x=-W/2+(ix+.5)*dx,z=-D/2+(iz+.5)*dz,r=Math.hypot(x/(W/2),(D/2-z)/D);
    if(r>1||r<.27)continue;const y=.04+H*Math.min(1,(r-.27)/.73);
    box(x,y/2,z,dx*.995,y,dz*.995,(ix+iz)%9?C.limestone:'#bdb9ae');
   }
   box(0,.035,D*.37,W*.29,.07,D*.19,'#a49c89');break;
  }
  default:{
   const h=H*.97;mass(0,0,W*.96,D*.95,h,b.id==='education'?'#ddd9cf':C.concrete);
   facade(0,front,W*.93,h,floors);facade(0,-D*.48,W*.92,h,floors);sides(0,0,W*.96,D*.95,h,floors);
   bands(0,0,W*.98,D*.97,h,floors);roofFlat(0,0,W*.99,D*.99,H*.975);
   if(b.id==='education'){
    const x=W*.34;curtain(x,D*.494,W*.21,h*.91,floors,H*.03,2);
    for(let r=1;r<floors;r++)box(-W*.13,r*h/floors-h*.14,front+.018,W*.54,h*.055,.021,'#ad7865');
   }
   if(b.id==='music')curtain(W*.22,D*.494,W*.24,h*.98,floors,0,3);
   if(b.id==='baekyang')for(let r=0;r<floors;r++)box(0,(r+.5)*h/floors,D*.495,W*.9,h/floors*.43,.025,C.glass);
   break;
  }
 }
 // Entrances stay inside each physical base footprint, without invented signs or mascots.
 if(!stone&&b.id!=='amphitheater'&&b.id!=='nonjidang')entry(0,D*.487,Math.min(.85,W*.16),Math.min(.8,H*.26));
 // Bake the supplied estimated overall height, including roof/crown, into geometry.
 // This is a layout consistency operation, not a new claim of measured elevation.
 const top=Math.max(...emitted.map(p=>p.y+p.h/2)),verticalScale=H/top;
 for(const p of emitted)k.box(p.x,p.y*verticalScale,p.z,p.w,p.h*verticalScale,p.d,p.c);
 return{height:H,door:{x:0,z:D*.52},description:`공식 건물 사진의 외벽·창·지붕 특징을 반영한 ${b.name}. 높이와 세부 치수는 사진 기반 근사예요.`,floors};
}
