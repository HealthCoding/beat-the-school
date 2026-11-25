// Sungeui nuke-scorch mask, binary form (assets/campuses/sungeui/scorch-mask.bin), shared by
// scripts/campuses/sungeui/make-scorch-mask.mjs (encode) and baked-ground.js (decode, fetched after the game is ready).
// Layout (little endian): 'SCM3' | u32 header bytes | header JSON (utf-8) | varint stream:
//   per header.dropKeys / header.coverKeys: varint run count, then the runs [start delta, length] as varints;
//   piece polygon vertex counts - 3: header.nPoly nibbles (two per byte, low first; 15 = escape: the real counts follow
//   as varints after the nibbles, in order);
//   polygon vertices in order: one varint token t: odd = the ((t + 1) / 2)-th last new vertex again; even = a new vertex
//   with zigzag(dx) = t / 2, then zigzag dz and dy varints (millimetres from the polygon's previous vertex; the first
//   one: from the previous polygon's first vertex); from the polygon's 4th vertex on, dy is the rest after the height of
//   the plane through its first three vertices (the pieces are planar: mostly 0).
// Piece vertices are rounded to the millimetre (the float32 metres before differ by <= 0.5 mm).
const MAGIC = 0x334d4353;
// rounded height at (x, z) of the plane through the first three vertices of a polygon (integer mm; the same doubles on
// both sides); `fallback` when they are (nearly) collinear in plan
function planeY(p, x, z, fallback) {
  const a = p[0], b = p[1], c = p[2], d = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]);
  if (Math.abs(d) < 1) return fallback;
  const u = ((x - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (z - a[2])) / d, v = ((b[0] - a[0]) * (z - a[2]) - (x - a[0]) * (b[2] - a[2])) / d;
  return Math.round(a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]));
}
export function encodeScorchMask({head, drop, cover, polyN, pieces}) {
  const bytes = []; const vu = n => { while (n > 127) { bytes.push((n & 127) | 128); n = Math.floor(n / 128); } bytes.push(n); };
  const vz = n => vu(n < 0 ? -2 * n - 1 : 2 * n);
  const dropKeys = Object.keys(drop), coverKeys = Object.keys(cover);
  for (const k of dropKeys) { vu(drop[k].length); for (const r of drop[k]) vu(r); }
  for (const k of coverKeys) { vu(cover[k].length); for (const r of cover[k]) vu(r); }
  const esc = [];
  for (let i = 0; i < polyN.length; i += 2) {
    const a = Math.min(15, polyN[i] - 3), b = i + 1 < polyN.length ? Math.min(15, polyN[i + 1] - 3) : 0;
    if (a === 15) esc.push(polyN[i]); if (b === 15) esc.push(polyN[i + 1]); bytes.push(a | b << 4);
  }
  for (const n of esc) vu(n);
  const table = new Map(); let nVert = 0, k = 0, s0 = [0, 0, 0];
  for (const n of polyN) {
    const poly = [];
    for (let j = 0; j < n; j++, k++) {
      const v = [Math.round(pieces[k * 3] * 1000), Math.round(pieces[k * 3 + 1] * 1000), Math.round(pieces[k * 3 + 2] * 1000)], key = v.join(','), id = table.get(key);
      if (id !== undefined) vu(2 * (nVert - id) - 1);
      else {
        table.set(key, nVert++); const base = j ? poly[j - 1] : s0, dx = v[0] - base[0];
        vu(2 * (dx < 0 ? -2 * dx - 1 : 2 * dx)); vz(v[2] - base[2]); vz(v[1] - (j >= 3 ? planeY(poly, v[0], v[2], base[1]) : base[1]));
      }
      poly.push(v);
    }
    s0 = poly[0];
  }
  const header = new TextEncoder().encode(JSON.stringify({...head, version: 3, units: 'mm', dropKeys, coverKeys, nPoly: polyN.length, nVert, nRef: pieces.length / 3}));
  const out = new Uint8Array(8 + header.length + bytes.length), dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true); dv.setUint32(4, header.length, true); out.set(header, 8); out.set(bytes, 8 + header.length);
  return out;
}
// -> {drop, cover (run arrays by fingerprint), pieceCounts: Uint8Array, pieces: Float32Array (metres), header}
export function decodeScorchMask(buffer) {
  const u = new Uint8Array(buffer), dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  if (u.length < 8 || dv.getUint32(0, true) !== MAGIC) throw Error('scorch mask: bad magic');
  const hl = dv.getUint32(4, true), header = JSON.parse(new TextDecoder().decode(u.subarray(8, 8 + hl)));
  if (header.version !== 3) throw Error('scorch mask: version ' + header.version);
  let o = 8 + hl;
  const vu = () => { let n = 0, m = 1, b; do { b = u[o++]; n += (b & 127) * m; m *= 128; } while (b & 128); return n; };
  const vz = () => { const n = vu(); return n % 2 ? -(n + 1) / 2 : n / 2; };
  const runs = keys => { const r = {}; for (const k of keys) { const n = vu(), a = new Array(n); for (let i = 0; i < n; i++) a[i] = vu(); r[k] = a; } return r; };
  const drop = runs(header.dropKeys), cover = runs(header.coverKeys);
  const pieceCounts = new Uint8Array(header.nPoly), esc = [];
  for (let i = 0; i < header.nPoly; i += 2) {
    const b = u[o++]; pieceCounts[i] = (b & 15) + 3; if ((b & 15) === 15) esc.push(i);
    if (i + 1 < header.nPoly) { pieceCounts[i + 1] = (b >> 4) + 3; if (b >> 4 === 15) esc.push(i + 1); }
  }
  for (const i of esc) pieceCounts[i] = vu();
  const V = new Int32Array(header.nVert * 3), pieces = new Float32Array(header.nRef * 3); let next = 0, k = 0, s0 = [0, 0, 0];
  for (const n of pieceCounts) {
    const poly = [];
    for (let j = 0; j < n; j++, k++) {
      const t = vu(); let v;
      if (t % 2) { const q = (next - (t + 1) / 2) * 3; v = [V[q], V[q + 1], V[q + 2]]; }
      else {
        const h = t / 2, base = j ? poly[j - 1] : s0, x = base[0] + (h % 2 ? -(h + 1) / 2 : h / 2), z = base[2] + vz(), y = vz() + (j >= 3 ? planeY(poly, x, z, base[1]) : base[1]);
        v = [x, y, z]; V[next * 3] = x; V[next * 3 + 1] = y; V[next * 3 + 2] = z; next++;
      }
      poly.push(v); pieces[k * 3] = v[0] / 1000; pieces[k * 3 + 1] = v[1] / 1000; pieces[k * 3 + 2] = v[2] / 1000;
    }
    s0 = poly[0];
  }
  if (o !== u.length || next !== header.nVert || k !== header.nRef) throw Error('scorch mask: length mismatch');
  return {drop, cover, pieceCounts, pieces, header};
}
