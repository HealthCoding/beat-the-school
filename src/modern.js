// New voxel interpretations of the existing Yonsei town artwork, never a measured 3D survey.
// Source mapping: art-modern.ts, art-engineering.ts, art-science.ts,
// art-academic.ts, art-samsung-hall.ts, art-gym.ts, art-extra.ts, art-cancer.ts.
// Only k.box and k.collider are used; all coordinates are local to each building.
const C = { stone:'#d7d1bd', pale:'#e2e0d1', joint:'#b8b6a5', dark:'#40565a',
  glass:'#567f82', blue:'#688f9c', roof:'#6b7c78', white:'#e8e9db', warm:'#a79b86' };


const DESCRIPTIONS = {
  library:'밝은 석재 기둥과 길게 이어지는 세로 창을 블록으로 옮긴 중앙도서관이에요.',
  samsung:'돌출된 평지붕 아래 푸른 유리와 흰 수직 기둥이 이어지는 학술정보관이에요.',
  business:'갈색 상부와 뒤로 들어간 유리 하부, 오른쪽의 밝은 계단탑을 구분했어요.',
  centennial:'낮고 넓은 몸체와 둥근 지붕·현관을 계단 형태로 표현했어요.',
  auditorium:'넓은 박공 지붕과 좁은 세로 창, 양끝의 두꺼운 날개가 보이는 대강당이에요.',
  union:'학생회관 정면에 반복되는 뾰족아치와 콘크리트 기둥을 작은 블록으로 표현했어요.',
  engHall:'낮고 긴 제1공학관의 밝은 기둥과 규칙적인 창, 중앙 옥상실을 살렸어요.',
  engPark:'낮고 긴 본관과 더 높은 모서리동의 단차를 살렸어요. 다섯 줄·여섯 줄 창, 폭이 다른 유리띠와 굵은 석재 벽, 그늘진 하부 기둥과 오른쪽 입구가 보여요.',
  science:'높이가 다른 세 건물과 가운데 열린 앞마당으로 과학관의 형태를 표현했어요.',
  eng2:'수평 층띠 사이로 가운데 푸른 유리 부분이 돌출된 제2공학관이에요.',
  eng3:'밝은 수평 몸체와 가운데 유리, 낮은 층의 넓은 아치를 살린 제3공학관이에요.',
  eng4:'흰 수직 기둥과 발코니, 위가 열린 지붕 틀로 제4공학관을 구분했어요.',
  daewoo:'따뜻한 석재색 날개와 작은 박공들, 높게 돌출된 가운데 동을 살렸어요.',
  baekyang:'긴 창띠가 이어진 높은 본체와 오른쪽 낮은 날개로 구성한 백양관이에요.',
  samsungHall:'오목한 흰 정면과 양끝 박공, 앞쪽의 낮은 홀로 삼성관을 표현했어요.',
  gym:'낮게 솟는 둥근 경기장 지붕과 넓은 유리 정면을 살린 체육관이에요.',
  music:'긴 연습실동 옆 푸른 유리 계단탑과 황토색 입구가 보이는 음악관이에요.',
  law:'밝은 벽의 쌍창과 거친 아래층, 오른쪽 높은 코어를 살린 광복관이에요.',
  'luce-wing':'낮은 벽 위에 넓게 떠 있는 지붕과 색색의 모자이크를 살린 루스채플이에요.',
  amphitheater:'부채꼴 돌 객석이 낮은 무대를 감싸는 노천극장이에요. 옆길에서 둘러볼 수 있어요.',
  cancer:'청록색 낮은 층 위로 은빛 테두리의 푸른 타워와 옥상정원이 보이는 풍경 건물이에요.',
};

function helpers(k) {
  const box = (...args) => k.box(...args);
  const mass = (x,z,w,d,h,color=C.stone,base=0) => {
    box(x,base+h/2,z,w,h,d,color);
    if (base<.5) k.collider(x,z,w,d);
  };
  const cap = (x,z,w,d,y,color=C.white) => box(x,y,z,w+.45,.38,d+.45,color);
  const pane = (x,y,z,w,h) => {
    box(x,y,z,w+.16,h+.16,.15,C.dark);
    box(x,y,z+.09,w,h,.12,C.glass);
  };
  const front = (x,z,w,h,rows=4,cols=7,base=0) => {
    const dx=w/cols, dy=(h-1.6)/rows;
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++)
      pane(x-w/2+dx*(c+.5),base+1.1+dy*(r+.5),z,dx*.57,dy*.57);
  };
  const sides = (x,z,w,d,h,rows=4,base=0) => {
    const cols=Math.max(2,Math.floor(d/2.2)), dx=d/cols, dy=(h-1.6)/rows;
    for(const sign of [-1,1]) for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) {
      const zz=z-d/2+dx*(c+.5), yy=base+1.1+dy*(r+.5);
      box(x+sign*(w/2+.06),yy,zz,.14,dy*.54,dx*.55,C.dark);
      box(x+sign*(w/2+.14),yy,zz,.09,dy*.45,dx*.44,C.glass);
    }
  };
  const band = (x,z,w,d,y,color=C.white) => box(x,y,z,w+.16,.22,d+.16,color);
  const door = (x,z,width=2.3,awning=C.roof) => {
    pane(x,1.28,z,width,2.45);
    box(x,1.28,z+.2,.1,2.45,.08,C.pale);
    box(x,1.2,z+.25,width,.09,.08,C.pale);
    box(x,2.8,z+.1,width+1,.3,.9,awning);
  };
  const gable = (x,z,w,d,y,rise,color=C.roof) => {
    const layers=7;
    for(let i=0;i<layers;i++) {
      const ww=w*(1-i/layers);
      box(x,y+rise*(i+.5)/layers,z,ww,rise/layers+.025,d,color);
    }
  };
  const gridGlass = (x,z,w,h,cols,rows,base=0) => {
    box(x,base+h/2,z,w,h,.17,C.blue);
    const cw=w/cols,ch=h/rows;
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++)
      box(x-w/2+cw*(c+.5),base+ch*(r+.5),z+.13,cw-.2,ch-.22,.1,C.glass);
  };
  return {box,mass,cap,pane,front,sides,band,door,gable,gridGlass};
}

export function buildModern(k,b) {
  const {box,mass,cap,pane,front,sides,band,door,gable,gridGlass}=helpers(k);
  const w=b.w-.7,d=b.d-.7, f=d/2;
  let height=12, entranceX=0;
  switch(b.id) {
    // art-modern: monumental limestone fins and deeply set full-height reading-room windows.
    case 'library': {
      height=12.5; mass(0,0,w,d,11.7); cap(0,0,w,d,12);
      const n=10, step=(w-1.1)/n;
      for(let i=0;i<n;i++) {
        const x=-(w-1.1)/2+step*(i+.5);
        pane(x,6.1,f+.06,step*.66,9.7);
        for(let r=1;r<5;r++) box(x,1.6+r*1.95,f+.21,step*.66,.13,.12,C.dark);
        box(x-step*.46,6.2,f+.31,.36,10.9,.45,C.white);
      }
      band(0,0,w,d,1); sides(0,0,w,d,11,4); door(0,f+.3,3.1);
      break;
    }
    // art-modern: projecting flat roof and bright vertical fins over a full curtain wall.
    case 'samsung': {
      height=16; mass(0,0,w,d,15,C.blue);
      gridGlass(0,f+.03,w-.5,14.5,9,6,.2);
      sides(0,0,w,d,14.5,6);
      for(let i=0;i<=9;i++) box(-w/2+.25+(w-.5)*i/9,7.7,f+.32,.3,15,.48,C.white);
      cap(0,0,w+.45,d+.45,15.5,'#b9c8c4');
      box(0,3,f+.27,w*.48,.3,.9,'#a7c8c6'); door(0,f+.22,3.4,'#a7c8c6');
      break;
    }
    // art-modern: heavy upper brown box above a recessed glass base, separate pale stair tower.
    case 'business': {
      height=15.8; const tw=w*.16, bw=w-tw;
      mass(-tw/2,-.32,bw-1,d-.64,5.5,'#567981');
      gridGlass(-tw/2,f-.63,bw-1,5.2,11,2,.15);
      mass(-tw/2,0,bw,d,7.9,'#928b7e',5.5);
      front(-tw/2,f+.05,bw-1,7.8,3,9,5.5); cap(-tw/2,0,bw,d,13.55,'#aaa391');
      const tx=w/2-tw/2; mass(tx,0,tw,d,15.2,C.pale);
      front(tx,f+.05,tw-.2,14.7,6,2); sides(0,0,w,d,12.5,4);
      cap(tx,0,tw,d,15.45); entranceX=-tw/2; door(entranceX,f-.55,3.1);
      break;
    }
    // art-modern: low broad hall with a faceted, round-ended roof and curved entrance canopy.
    case 'centennial': {
      height=9; mass(0,0,w,d,6.8,'#c7c9b8');
      gridGlass(0,f+.05,w-2,3.25,13,1,1.1);
      for(let i=0;i<4;i++) box(i*.2,6.9+i*.47,0,w-i*1.4,.7,d-i*.35,i%2?C.pale:'#c4cbbb');
      for(let i=0;i<4;i++) box(0,3.1+i*.28,f+.2,5.5-i*.55,.36,.8,C.white);
      box(w*.3,6,f+.15,1.5,2.8,.16,'#315c7b'); door(0,f+.1,3.1);
      break;
    }
    // art-modern: triangular auditorium roof, deep narrow windows and heavy end wings.
    case 'auditorium': {
      height=14.2; mass(0,0,w,d,8.7,C.pale);
      gable(0,0,w+.7,d+.6,8.7,4.8,'#abb7ac');
      for(const x of [-w*.43,w*.43]) {mass(x,f-.7,w*.14,1.4,9.5,'#d2d8c7'); pane(x,5.6,f+.1,.6,5.9);}
      for(let i=0;i<9;i++) {
        const x=(i-4)*w*.077; pane(x,5.9,f+.06,.66,5.15);
        box(x-.53,5.9,f+.21,.26,6,.35,C.white);
      }
      for(const x of [-w*.2,0,w*.2]) door(x,f+.15,2);
      box(0,11.45,f+.05,.2,1.5,.2,C.dark); box(0,11.65,f+.06,1,.2,.21,C.dark);
      break;
    }
    // art-modern: repeating pointed concrete arches, represented by chunky stepped tracery.
    case 'union': {
      height=11.8; mass(0,0,w,d,11,C.pale);
      const cols=10, dx=(w-1)/cols;
      for(let c=0;c<cols;c++) for(let r=0;r<3;r++) {
        const x=(c-(cols-1)/2)*dx,y=2.1+r*3.2;
        pane(x,y,f+.08,dx*.65,2.4);
        box(x,y+1.35,f+.19,dx*.47,.22,.2,C.white);
        box(x,y+1.58,f+.19,dx*.24,.22,.2,C.white);
      }
      for(let c=0;c<=cols;c++) box(-dx*cols/2+c*dx,5.85,f+.28,.25,11.5,.35,C.white);
      sides(0,0,w,d,10.7,3); cap(0,0,w,d,11.25); door(0,f+.1,3.2);
      break;
    }
    // art-science: lower, long first engineering wing with a small central rooftop plant room.
    case 'engHall': {
      height=12.1; mass(0,0,w,d,10.2,'#dedecd');
      front(0,f+.05,w-1,10,5,12); sides(0,0,w,d,10,4);
      for(let i=0;i<=12;i++) box(-w/2+.5+(w-1)*i/12,5.3,f+.23,.22,9.8,.3,C.white);
      for(let i=1;i<=5;i++) band(0,0,w,d,i*1.9);
      cap(0,0,w,d,10.45); box(0,11.2,-d*.16,w*.2,1.5,d*.35,C.joint);
      cap(0,-d*.16,w*.2,d*.35,12); door(0,f+.15,3.2); break;
    }
    // art-science: lower west wing and high stone corner pavilion over a colonnade.
    case 'engPark': {
      height=15.6; const left=w*.56,right=w*.44,lx=-right/2,rx=left/2;
      const split=-w/2+left,base=3.15,lh=11.3,rh=14.5;
      // Keep the approved footprint and arrival. A shallow (.64) recess sits behind
      // the columns; its depth is less than one character diameter, not a new passage.
      for(const [x,ww,h,col] of [[lx,left,lh,'#b8b7a8'],[rx,right,rh,'#b3b4a6']]) {
        k.collider(x,0,ww,d);
        box(x,.13,0,ww,.26,d,'#b5b6a4');
        box(x,base/2,-.32,ww,base,d-.64,'#52635a');
        box(x,base+(h-base)/2,0,ww,h-base,d,col);
        box(x,base-.12,f-.09,ww,.37,.82,'#dad5c0');
      }
      // Five storeys in the long wing: original art has seven fairly broad windows.
      const dx=(left-1.05)/7;
      for(let row=0;row<5;row++) {
        const y=4.25+row*1.42;
        for(let c=0;c<7;c++)pane(lx-(left-1.05)/2+(c+.5)*dx,y,f+.045,dx*.67,.96);
        box(lx,y-.65,f+.12,left-.28,.12,.13,'#b0b2a0');
      }
      // The corner pavilion is not another regular grid: three unequal glazed strips
      // are separated by two wide stone piers, as in art-science.ts engPark.
      const bays=[[.115,.19],[.64,.145],[.912,.085]];
      for(let row=0;row<6;row++) {
        const y=4.3+row*1.69;
        for(const [t,ww] of bays)pane(split+right*t,y,f+.065,right*ww,1.2);
        box(rx,y-.72,f+.12,right-.3,.14,.16,'#6d817c');
      }
      for(const [t,ww] of [[.405,.3],[.785,.155]]) {
        box(split+right*t,8.9,f+.2,right*ww,10.7,.36,'#c4c6b5');
        box(split+right*(t-ww/2)+.08,8.9,f+.405,.16,10.7,.05,'#d9d9c6');
      }
      // Real three-dimensional pillars cast a shallow arcade shadow below both wings.
      for(let c=0;c<7;c++) {
        const x=-w/2+.55+c*(left-1.05)/6;
        box(x,base/2,f-.02,.42,base,.58,'#d9d4bf');
        box(x+.18,base/2,f+.2,.11,base,.12,'#a1aa98');
      }
      entranceX=w*.27;
      for(const x of [split+.6,entranceX-1.67,entranceX+1.67,w/2-.45])
        box(x,base/2,f-.02,.46,base,.58,'#d9d4bf');
      cap(lx,0,left,d,lh+.18,'#e1ddc8');
      // A thin raised roof slab on short posts identifies the high corner pavilion.
      box(rx,rh+.08,0,right-.25,.2,d-.25,'#889b91');
      for(const z of [-d/2+.35,f-.3])for(let c=0;c<7;c++)
        box(split+.55+c*(right-1.1)/6,14.91,z,.17,.66,.18,'#819589');
      cap(rx,0,right,d,15.36,'#dfe1ce');
      // Side windows keep the long / tall split legible when orbiting the building.
      for(const [sign,x,h,rows] of [[-1,-w/2,lh,5],[1,w/2,rh,6]])
        for(let row=0;row<rows;row++)for(let c=0;c<4;c++) {
          const y=4.25+row*(h-4.9)/(rows-1),z=-d/2+1.25+c*(d-2.5)/3;
          box(x+sign*.055,y,z,.12,.98,1.32,C.dark);
          box(x+sign*.13,y,z,.065,.81,1.12,C.glass);
        }
      // The entrance stays at its previous location and ground level; no added stairs.
      box(entranceX,1.4,f-.24,2.8,2.8,.8,'#3f5853');
      door(entranceX,f+.13,2.5,'#91a69a');
      box(split+right*.405,12.8,f+.44,1.2,.57,.1,'#46697a');
      box(split+right*.405,12.85,f+.51,.75,.08,.04,'#e4e5d1');
      break;
    }
    // art-science: three separate U-shaped masses, open front court and higher east wing.
    case 'science': {
      height=14.6; const sw=w*.27,cw=w-2*sw;
      mass(-w/2+sw/2,0,sw,d,10.8,C.pale);mass(w/2-sw/2,0,sw,d,14,C.white);
      mass(0,-d*.24,cw,d*.52,9.3,'#c1cabd');
      front(-w/2+sw/2,f+.05,sw-.4,10.5,4,3);front(w/2-sw/2,f+.05,sw-.4,13.5,6,4);
      gridGlass(0,.03,cw-.5,7,6,3,1.3);
      cap(-w/2+sw/2,0,sw,d,11);cap(w/2-sw/2,0,sw,d,14.2);cap(0,-d*.24,cw,d*.52,9.5);
      sides(0,0,w,d,10,4);door(0,.1,3); break;
    }
    // art-engineering: tall horizontal bands with a projecting faceted central glass bay.
    case 'eng2': {
      height=16.1; mass(0,-.22,w,d-.44,14.5);
      front(0,f-.39,w-1,14.2,7,12);sides(0,-.22,w,d-.44,14,6);
      for(let i=1;i<8;i++) band(0,-.22,w,d-.44,i*1.95);
      mass(0,f-.43,w*.21,.85,15.3,'#789e9d');
      gridGlass(0,f+.02,w*.18,14.8,4,7,.2);cap(0,f-.43,w*.21,.85,15.55);
      cap(0,-.22,w,d-.44,14.75);door(0,f+.1,2.8); break;
    }
    // art-engineering: shorter green glass bay above a broad rusticated arcade.
    case 'eng3': {
      height=13.5; mass(0,-.15,w,d-.3,12.3,C.pale);
      front(0,f-.25,w-1,8.4,4,11,3.3);
      mass(0,f-.3,w*.22,.6,12.9,'#72999a');gridGlass(0,f+.04,w*.19,9.2,4,5,3.3);
      for(let i=1;i<6;i++) band(0,-.15,w,d-.3,3.4+i*1.75);
      for(let i=0;i<6;i++) {
        const x=(i-2.5)*w*.15;pane(x,1.6,f+.08,w*.1,2.7);
        box(x,3.05,f+.2,w*.08,.3,.28,C.stone);box(x,3.3,f+.2,w*.055,.25,.28,C.stone);
      }
      cap(0,-.15,w,d-.3,12.5);cap(0,f-.3,w*.22,.6,13.2); entranceX=w*.15;door(entranceX,f+.12,2.1);break;
    }
    // art-engineering: balcony stack, vertical white fins and an open rectangular roof crown.
    case 'eng4': {
      height=20.6; mass(0,0,w,d,17.5,C.pale);
      gridGlass(-w*.29,f+.05,w*.32,16.8,2,8,.4);
      for(let r=1;r<9;r++) box(-w*.29,r*1.95,f+.29,w*.37,.3,.48,C.white);
      front(w*.19,f+.05,w*.54,16.5,8,6);
      for(let c=0;c<7;c++) box(-w*.08+c*w*.086,9.1,f+.26,.25,17.1,.4,C.white);
      cap(0,0,w,d,17.75); 
      for(const x of [-w/2+.4, -w*.08,w/2-.4])for(const z of [-d/2+.4,d/2-.4]) box(x,19,z,.42,2.4,.42,C.white);
      box(0,20.2,0,w+.2,.45,d+.2,C.white);
      box(-w*.3,18.2,0,w*.2,.2,d*.43,'#9daea1');
      sides(0,0,w,d,17,7);door(0,f+.1,2.9);break;
    }
    // art-science: warm stone wings, little parapet gables and a tall projecting central tower.
    case 'daewoo': {
      height=15.3;mass(0,-.2,w,d-.4,10.9,'#c4bbaa');front(0,f-.33,w-.5,10.5,5,10);
      for(let i=0;i<7;i++)gable((i-3)*w*.135,0,w*.105,d-.2,10.9,.9,'#b4ad9b');
      mass(0,f-.85,w*.33,1.7,13.7,'#bdb5a5');mass(0,f-.6,w*.22,1.2,14.6,'#d1c6b1');
      front(0,f+.05,w*.22-.2,14,6,3);cap(0,f-.6,w*.22,1.2,14.85);
      sides(0,-.2,w,d-.4,10.5,4);door(0,f+.12,3);break;
    }
    // art-academic: long five-band main wing and low right-hand return.
    case 'baekyang': {
      height=12.9;const main=w*.72,wing=w-main;
      mass(-wing/2,0,main,d,12.2,'#dcdfd4');mass(main/2,0,wing,d,6.7,'#d5daca');
      front(-wing/2,f+.06,main-1,10.5,5,8,1.3);front(main/2,f+.06,wing-.5,6.2,2,3);
      for(let r=1;r<6;r++) band(-wing/2,0,main,d,1.5+r*1.85);
      cap(-wing/2,0,main,d,12.45);cap(main/2,0,wing,d,6.9); entranceX=-wing/2;door(entranceX,f+.1,2.4);break;
    }
    // art-samsung-hall: recessed white seven-storey wings, unequal gables and a low front hall.
    case 'samsungHall': {
      height=19.4;const lw=w*.3,rw=w*.33,cw=w-lw-rw;
      mass(-w/2+lw/2,-.45,lw,d-.9,16.5,'#e0e2d6');mass(w/2-rw/2,-.2,rw,d-.4,15.6,'#dce0d3');
      mass((lw-rw)/2,-d*.22,cw,d*.56,14.9,'#cbd2c7');
      gable(-w/2+lw/2,-.45,lw+.35,d-.55,16.5,2.4,'#91a097');
      gable(w/2-rw/2,-.2,rw+.35,d-.05,15.6,2.1,'#a4ada0');
      front(-w/2+lw/2,f-.83,lw-.5,16,7,3);front(w/2-rw/2,f-.33,rw-.5,15.2,7,4);
      gridGlass(1,d*.06+.05,cw*.56,12.8,3,6,.8);
      const hx=-w*.29,hw=w*.38,hd=d*.3;
      mass(hx,f-hd/2,hw,hd,4.5,'#d6dace');gable(hx,f-hd/2,hw+.3,hd+.3,4.5,2.6,'#71817a');
      box(1,15.7,-d*.22,cw*.4,2.2,d*.4,C.pale);gable(1,-d*.22,cw*.4,d*.4,16.8,1.15,C.roof);
      entranceX=hx;door(hx,f+.1,3.4);break;
    }
    // art-gym: a low barrel roof, enormous glazed face and a shallow entrance canopy.
    case 'gym': {
      height=13.5;mass(0,0,w,d,8.7,'#899d9b');gridGlass(0,f+.04,w-1,8.2,12,2,.2);
      const slices=15, dx=w/slices;
      for(let i=0;i<slices;i++) {
        const u=(i+.5)/slices*2-1,top=8.7+3.7*Math.sqrt(Math.max(0,1-u*u));
        box(-w/2+dx*(i+.5),8.7+(top-8.7)/2,0,dx+.02,top-8.7,d+.4,i%3===0?'#5c6e6d':'#768682');
      }
      box(0,8.6,f+.17,w+.1,.65,.35,C.dark);
      for(let i=0;i<=12;i++)box(-w/2+.5+i*(w-1)/12,4.5,f+.23,.18,8.2,.21,C.white);
      box(w*.29,6.25,f+.27,2.4,2.7,.16,'#315d73');
      // Geometric blue school-colour badge, no borrowed logo artwork.
      box(w*.29,6.3,f+.39,1.4,1.5,.09,'#d4e3d8');box(w*.29,6.6,f+.46,.65,1.35,.07,'#315d73');
      box(0,2.85,f+.25,w*.5,.3,.85,'#9fbcb5');door(0,f+.1,3.6);break;
    }
    // art-academic: long practice-room wing, tall glass stair tower and ochre entrance frame.
    case 'music': {
      height=14.8;const tw=w*.19,tx=w*.22;
      mass(-w*.17,0,w*.66,d,11.1,'#dbdbce');mass(w*.4,0,w*.2,d,10.2,'#cbd0c2');
      mass(tx,0,tw,d,14.2,'#88a5a6');front(-w*.17,f+.05,w*.62,10.6,4,8);front(w*.4,f+.05,w*.17,9.8,3,2);
      gridGlass(tx,f+.06,tw-.15,13.8,3,7,.2);cap(-w*.17,0,w*.66,d,11.35);cap(tx,0,tw,d,14.45);
      for(const x of [tx-tw/2+.17,tx+tw/2-.17])box(x,7.2,f+.22,.2,14.2,.22,C.white);
      entranceX=tx;door(tx,f+.14,2.25,'#c49a55');box(tx+1.7,1.4,f+.33,.33,2.8,.3,'#b48d46');break;
    }
    // art-academic: tiled paired windows, rusticated lower course, raised right-hand core.
    case 'law': {
      height=13.5;const tw=w*.19,tx=w/2-tw/2;
      mass(-tw/2,0,w-tw,d,11.8,'#daddd1');mass(tx,0,tw,d,12.8,'#d4dacc');
      front(-tw/2,f+.05,w-tw-.6,11.2,5,7);front(tx,f+.05,tw-.3,12.3,5,2);
      box(-tw/2,1.55,f+.1,w-tw,3.1,.19,'#aaafa3');
      for(let c=0;c<7;c++)pane(-w/2+1.2+c*(w-tw-2.4)/6,1.8,f+.24,1.15,1.75);
      cap(-tw/2,0,w-tw,d,12);cap(tx,0,tw+.3,d+.2,13.05,'#899b93');
      entranceX=-.8; box(entranceX,2.7,f+.27,2.7,5.4,.12,'#47564f');door(entranceX,f+.35,1.8);break;
    }
    // art-extra: floating cantilever roof, low rubble wall, coloured mosaic and timber grille.
    // The source explicitly omits an unverified cross/bell tower; preserve that choice.
    case 'luce-wing': {
      height=7.7;const bw=w*.68,bd=d*.61,bz=d*.12;
      mass(0,bz,bw,bd,4.15,'#8f8d82');const z=bz+bd/2;
      box(bw*.34,2.3,z+.05,bw*.28,3.5,.18,'#30494c');
      for(let c=0;c<4;c++)pane(bw*.23+c*bw*.073,2.4,z+.17,bw*.055,3.1);
      const colors=['#487196','#b67765','#ece6d5','#d0b477'];
      for(let c=0;c<8;c++)for(let r=0;r<2;r++)box(-bw*.22+c*bw*.059,3.5+r*.22,z+.12,bw*.057,.2,.12,colors[(c*3+r)%4]);
      for(let i=0;i<5;i++)box(0,4.05+i*.5,-.1,w*(.69+i*.07),.51,d*(.6+i*.07),'#746d59');
      box(0,6.6,-.1,w+.4,.5,d+.4,'#b5c1bd');box(0,6.28,-.1,w+.45,.22,d+.45,'#555b50');
      for(let c=0;c<7;c++)box(-w*.42+c*w*.14,6.88,-.1,.09,.08,d+.3,'#d8ddd1');
      door(0,z+.15,2.2,'#a18c64');break;
    }
    // art-extra: pixel half-ellipse stone seating, lower wooden stage, open south arrival.
    case 'amphitheater': {
      height=4.9;const cols=19,rows=10,dx=w/cols,dz=d/rows;
      for(let iz=0;iz<rows;iz++)for(let ix=0;ix<cols;ix++) {
        const x=-w/2+(ix+.5)*dx,z=-d/2+(iz+.5)*dz;
        const u=x/(w/2),v=(f-z)/d,r=Math.hypot(u,v);
        if(r>1||r<.3)continue;
        const tier=Math.floor((r-.3)*8), h=.48+tier*.7;
        box(x,h/2,z,dx+.015,h,dz+.015,tier%2?'#c8c1b3':'#dbd4c5');
        // Actual seat cells only: open aisles and the forecourt remain walkable at ground level.
        k.collider(x,z,dx,dz);
      }
      box(0,.045,f-1.1,w*.26,.09,d*.2,'#bda77f');
      for(let i=0;i<4;i++)box(0,.1,f-.3-i*.38,w*.26,.015,.045,'#9c8967');
      return {height,door:{x:w/2+1.4,z:d*.3},description:DESCRIPTIONS[b.id]};
    }
    // art-cancer: silver framed blue tower over turquoise podium, gold bands and roof garden.
    case 'cancer': {
      height=26.6;mass(0,0,w,d,8.9,'#d2cebc');
      gridGlass(0,f+.04,w-.4,5.8,14,4,2.2);
      for(let r=0;r<3;r++)box(0,8.25+r*.32,f+.16,w,.17,.2,'#cbb77f');
      cap(0,0,w,d,9.2,'#cad2c6');box(0,9.45,0,w-.4,.25,d-.4,'#89985b');
      const tw=w*.8,td=d*.65,tz=-d*.12;
      mass(0,tz,tw,td,15.8,'#91a6ad',9.5);
      gridGlass(-tw*.06,tz+td/2+.05,tw*.82,14.9,12,9,9.8);
      for(const x of [-tw/2+.25,tw/2-.25])box(x,17.5,tz,.5,16,td+.12,'#ccd4d3');
      box(tw*.39,17.5,tz+td/2+.11,tw*.18,15.7,.2,'#bfc9cb');
      cap(0,tz,tw,td,25.6,'#d9dfdb');box(0,9.85,tz+td/2+.18,tw-.5,.48,.17,C.dark);
      for(const x of [-w*.4,-w*.25,w*.27,w*.4]){
        box(x,9.65,f-.4,1.2,.4,.8,'#a6a284');box(x,10.15,f-.4,.85,.75,.7,'#7f9254');
      }
      box(-tw*.34,23,tz+td/2+.19,1.8,2.3,.16,'#315b79');
      box(-tw*.34,23.2,tz+td/2+.31,1,.65,.09,'#e6e9d9');
      door(-w*.08,f+.15,3.4,'#edeee5');break;
    }
    default: throw new Error(`No modern campus model for ${b.id}`);
  }
  return {height,door:{x:entranceX,z:b.d/2+1.4},description:DESCRIPTIONS[b.id]};
}
