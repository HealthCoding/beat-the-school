// The reviewed local rectangles use the same triangles as the displayed ground.
// Elsewhere retain the original campus grid until each location is reviewed.
import { EXACT_GROUND_PATCHES } from './exact-ground-data.js';
import { YM_HEIGHT_GRIDS } from './data.js';
const CELL=4;
const coarse=YM_HEIGHT_GRIDS[0], coarseBytes=Uint8Array.from(atob(coarse.centimetresBase64),c=>c.charCodeAt(0)), coarseHeights=new Int16Array(coarseBytes.buffer);
function coarseHeight(e,n){
  const x=(e-coarse.minE)/coarse.step,z=(-n-coarse.minZ)/coarse.step,i=Math.floor(x),j=Math.floor(z),u=x-i,v=z-j,k=j*coarse.nx+i;
  const [a,b,c,d]=[coarseHeights[k],coarseHeights[k+1],coarseHeights[k+coarse.nx],coarseHeights[k+coarse.nx+1]].map(h=>h/100);
  return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}
const regions=EXACT_GROUND_PATCHES.map(p=>{
  const raw=atob(p.base64), bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  const data=new Float32Array(bytes.buffer), bins=new Map(), [x0,n0,x1,n1]=p.box;
  for(let k=0;k<data.length;k+=9){
    const xs=[data[k],data[k+3],data[k+6]], ns=[data[k+2],data[k+5],data[k+8]];
    const loX=Math.floor((Math.max(x0,Math.min(...xs))-x0)/CELL), hiX=Math.floor((Math.min(x1,Math.max(...xs))-x0)/CELL);
    const loN=Math.floor((Math.max(n0,Math.min(...ns))-n0)/CELL), hiN=Math.floor((Math.min(n1,Math.max(...ns))-n0)/CELL);
    for(let x=loX;x<=hiX;x++)for(let n=loN;n<=hiN;n++){const key=x+','+n;let list=bins.get(key);if(!list)bins.set(key,list=[]);list.push(k)}
  }
  return {id:p.id,box:p.box,coverage:p.coverage,data,bins};
});
export function exactHeightAt(e,n){
  if(!Number.isFinite(e)||!Number.isFinite(n))return null;
  for(const r of regions){const [x0,n0,x1,n1]=r.box;if(e<x0||e>x1||n<n0||n>n1)continue;
    if(r.coverage&&!r.coverage.some(b=>e>=b[0]&&e<=b[2]&&n>=b[1]&&n<=b[3]))continue;
    const candidates=r.bins.get(Math.floor((e-x0)/CELL)+','+Math.floor((n-n0)/CELL))||[];let best=-Infinity;
    for(const k of candidates){const d=r.data,ax=d[k],ay=d[k+1],az=d[k+2],bx=d[k+3],by=d[k+4],bz=d[k+5],cx=d[k+6],cy=d[k+7],cz=d[k+8];
      const den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(den)<1e-9)continue;
      const u=((bz-cz)*(e-cx)+(cx-bx)*(n-cz))/den,v=((cz-az)*(e-cx)+(ax-cx)*(n-cz))/den,w=1-u-v;
      if(Math.min(u,v,w)>=-1e-7)best=Math.max(best,u*ay+v*by+w*cy);
    }
    if(Number.isFinite(best)){
      // A neighbouring edited slope reaches one edge of the Hyeonunjae
      // rectangle. Fade to the original grid at the boundary, avoiding a
      // sudden collision-height step. The tape itself is well inside it.
      if(r.id==='hyeonunjae' || r.id==='baegun' || r.id==='old-museum'){
        const t=Math.max(0,Math.min(1,Math.min(e-x0,x1-e,n-n0,n1-n)/8));
        const blend=t*t*(3-2*t), old=coarseHeight(e,n);
        return old+(best-old)*blend;
      }
      return best;
    }
  }
  return null;
}
