// Exact top surface of the school-specific steep boundary regions. Coordinates
// and return value are metres east / north / height. Outside a region, or if a
// ray has no triangle, return null so the shared engine retains grid fallback.
import { EXACT_GROUND_PATCHES } from './exact-ground-data.js';
// Local browser verification can count actual calls made by the live game.
// No counters or global state are created during normal play.
export const exactGroundDiagnostics = globalThis.location && /^(localhost|127\.0\.0\.1)$/.test(globalThis.location.hostname) && new URLSearchParams(globalThis.location.search).has('kyungheeGroundTest') ? { calls:0, hits:0 } : null;
const CELL=4;
const regions=EXACT_GROUND_PATCHES.map(p=>{
  const raw=atob(p.base64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  const data=new Float32Array(bytes.buffer),bins=new Map(),[x0,n0,x1,n1]=p.box;
  for(let k=0;k<data.length;k+=9){const xs=[data[k],data[k+3],data[k+6]],ns=[data[k+2],data[k+5],data[k+8]];
    const loX=Math.floor((Math.max(x0,Math.min(...xs))-x0)/CELL),hiX=Math.floor((Math.min(x1,Math.max(...xs))-x0)/CELL),loN=Math.floor((Math.max(n0,Math.min(...ns))-n0)/CELL),hiN=Math.floor((Math.min(n1,Math.max(...ns))-n0)/CELL);
    for(let x=loX;x<=hiX;x++)for(let n=loN;n<=hiN;n++){const key=x+','+n;let bin=bins.get(key);if(!bin)bins.set(key,bin=[]);bin.push(k)}
  }
  return {box:p.box,data,bins,id:p.id};
});
export function exactHeightAt(e,n){
 if(exactGroundDiagnostics)exactGroundDiagnostics.calls++;
 if(!Number.isFinite(e)||!Number.isFinite(n))return null;
 for(const r of regions){const [x0,n0,x1,n1]=r.box;if(e<x0||e>x1||n<n0||n>n1)continue;
  const candidates=r.bins.get(Math.floor((e-x0)/CELL)+','+Math.floor((n-n0)/CELL))||[];let best=-Infinity;
  for(const k of candidates){const d=r.data,ax=d[k],ay=d[k+1],az=d[k+2],bx=d[k+3],by=d[k+4],bz=d[k+5],cx=d[k+6],cy=d[k+7],cz=d[k+8];
   const den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(den)<1e-9)continue;
   const u=((bz-cz)*(e-cx)+(cx-bx)*(n-cz))/den,v=((cz-az)*(e-cx)+(ax-cx)*(n-cz))/den,w=1-u-v;
   if(Math.min(u,v,w)<-1e-7)continue;best=Math.max(best,u*ay+v*by+w*cy);
  }
  if(Number.isFinite(best)){if(exactGroundDiagnostics){exactGroundDiagnostics.hits++;exactGroundDiagnostics.lastHit={e,n,height_m:best};}return best;}
 }
 return null;
}
