// Campus-local lookup of the final baked ground. All inputs are in metres.
import {GWG_HEIGHT_GRIDS} from './data.js';
import {SURFACE_PACKED as SP} from './surface-data.js';
// 6차b: unpack the packed ground (Int32 mm vertices + Uint32 indices) into the same triangle list as before.
const b64=s=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u.buffer;};
const VM=new Int32Array(b64(SP.verticesMmBase64)),TI=new Uint32Array(b64(SP.indicesBase64)),VS=[];
for(let i=0;i<SP.vertexCount;i++)VS.push([VM[3*i]/1000,VM[3*i+1]/1000,VM[3*i+2]/1000]);
const SURFACE={cuts:SP.cuts,triangles:[]};for(let i=0;i<SP.triangleCount;i++)SURFACE.triangles.push([VS[TI[3*i]],VS[TI[3*i+1]],VS[TI[3*i+2]]]);
const g=GWG_HEIGHT_GRIDS[0],bytes=Uint8Array.from(atob(g.centimetresBase64),c=>c.charCodeAt(0)),H=new Int16Array(bytes.buffer),minN=-(g.minZ+(g.nz-1)*g.step);
const inside=(e,n,rings)=>{let hit=false;for(const r of rings)for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[j],b=r[i];if((a[1]>n)!==(b[1]>n)&&e<(b[0]-a[0])*(n-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
const buckets=new Map(),step=12,key=(x,y)=>`${x},${y}`;
for(const t of SURFACE.triangles){const xs=t.map(v=>v[0]),ns=t.map(v=>v[1]);for(let x=Math.floor(Math.min(...xs)/step);x<=Math.floor(Math.max(...xs)/step);x++)for(let y=Math.floor(Math.min(...ns)/step);y<=Math.floor(Math.max(...ns)/step);y++){const k=key(x,y);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(t);}}
export function exactHeightAt(e,n){
 for(const c of SURFACE.cuts)if(inside(e,n,c.rings))return c.base;
 for(const [a,b,c] of buckets.get(key(Math.floor(e/step),Math.floor(n/step)))||[]){const d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-10)continue;const u=((b[1]-c[1])*(e-c[0])+(c[0]-b[0])*(n-c[1]))/d,v=((c[1]-a[1])*(e-c[0])+(a[0]-c[0])*(n-c[1]))/d,w=1-u-v;if(Math.min(u,v,w)>=-1e-7)return u*a[2]+v*b[2]+w*c[2];}
 const x=Math.max(0,Math.min(g.nx-1.000001,(e-g.minE)/g.step)),y=Math.max(0,Math.min(g.nz-1.000001,(n-minN)/g.step)),i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j;
 const at=(i,j)=>H[(g.nz-1-j)*g.nx+i]/100,a=at(i,j),b=at(i+1,j),c=at(i,j+1),d=at(i+1,j+1);
 return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}
