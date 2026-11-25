// Lossless school-local encoding of little-endian signed centimetre grids.
// The predictor uses left + above - upper-left; zigzag varints store nonzero
// residuals and even tokens encode runs of zero residuals.
function bytesFromBase64(value) {
  if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(value, 'base64'));
  const binary = atob(value), bytes = new Uint8Array(binary.length);
  for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return bytes;
}
function base64FromBytes(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary='';
  for (let i=0;i<bytes.length;i+=16384) binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return btoa(binary);
}
function size(nx,nz) {
  if(!Number.isSafeInteger(nx)||!Number.isSafeInteger(nz)||nx<2||nz<2||nx*nz>10000000) throw Error('Invalid terrain grid dimensions');
  return nx*nz;
}
function predictor(a,k,nx) {
  const i=k%nx,j=Math.floor(k/nx),left=i?a[k-1]:0,up=j?a[k-nx]:0;
  return i&&j?left+up-a[k-nx-1]:i?left:j?up:0;
}
function put(out,v) { do {const b=v%128;v=Math.floor(v/128);out.push(b+(v?128:0));} while(v); }

/** Offline builder: returns compressed base64 while preserving all int16 values. */
export function encodeHeightGrid(rawBase64,nx,nz) {
  const count=size(nx,nz),bytes=bytesFromBase64(rawBase64);
  if(bytes.length!==count*2) throw Error('Wrong terrain grid byte length');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),a=new Int16Array(count),res=new Int32Array(count);
  for(let k=0;k<count;k++){a[k]=view.getInt16(k*2,true);res[k]=a[k]-predictor(a,k,nx);}
  const out=[];
  for(let k=0;k<count;){
    if(res[k]===0){let run=1;while(k+run<count&&res[k+run]===0)run++;put(out,run*2);k+=run;continue;}
    const d=res[k++],zig=d>=0?d*2:-d*2-1;put(out,zig*2+1);
  }
  return base64FromBytes(Uint8Array.from(out));
}

/** Browser / Node: restores the engine's existing centimetresBase64 format. */
export function decodeHeightGrid(encodedBase64,nx,nz) {
  const count=size(nx,nz),bytes=bytesFromBase64(encodedBase64),a=new Int16Array(count),raw=new Uint8Array(count*2),view=new DataView(raw.buffer);
  let cursor=0,k=0;
  function token(){let value=0,multiplier=1;for(let i=0;i<5;i++){if(cursor>=bytes.length)throw Error('Truncated terrain grid');const b=bytes[cursor++];value+=(b%128)*multiplier;if(b<128)return value;multiplier*=128;}throw Error('Terrain token too large');}
  function emit(delta){const v=predictor(a,k,nx)+delta;if(v < -32768||v > 32767)throw Error('Terrain height outside int16 range');a[k]=v;view.setInt16(k*2,v,true);k++;}
  while(k<count){const t=token();if(t%2===0){const run=t/2;if(!run||run>count-k)throw Error('Invalid terrain zero run');for(let i=0;i<run;i++)emit(0);}
    else {const zig=(t-1)/2;emit(zig%2?-(zig+1)/2:zig/2);}}
  if(cursor!==bytes.length)throw Error('Trailing terrain grid data');
  return base64FromBytes(raw);
}
