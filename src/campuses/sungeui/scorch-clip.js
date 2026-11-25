// Sungeui Finish-19 (Astra 19 SUN-53): exact plan clipping of one scorch-copy triangle against the site surfaces above it.
// Shared by scripts/campuses/sungeui/make-scorch-mask.mjs (precomputed mask) and baked-ground.js legacyFit (the same fit
// at load), so both give the same pieces.
// G = [x0,y0,z0, x1,y1,z1, x2,y2,z2] (y up, plan = x,z); covers = triangles in the same layout.  The part of G lying under
// a cover by lo..hi (cover height - G height, both planes) is removed; what stays is returned as convex polygons on G's own
// plane with G's winding.  null = nothing removed (keep G as it is), [] = all of G removed.
// The removed region of one cover is convex (its triangle cut by the two height bounds: the gap is affine over it), so
// G minus it is done piece by piece with convex half-plane splits (Sutherland-Hodgman); pieces under eps area are dropped.
const cross = (ax, az, bx, bz, px, pz) => (bx - ax) * (pz - az) - (bz - az) * (px - ax);
function area(poly) { let s = 0; for (let i = 0, n = poly.length; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
// keep the side of line a->b where sign * cross >= 0 (plan points [x, z, ...extra linear values])
function half(poly, ax, az, bx, bz, sign) {
  const out = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n], sp = sign * cross(ax, az, bx, bz, p[0], p[1]), sq = sign * cross(ax, az, bx, bz, q[0], q[1]);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push(p.map((v, k) => v + (q[k] - v) * t)); }
  }
  return out;
}
// keep where sign * (p[2] - v) >= 0 (the third value is the affine gap d)
function bound(poly, v, sign) {
  const out = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n], sp = sign * (p[2] - v), sq = sign * (q[2] - v);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]); }
  }
  return out;
}
export function clipExposed(G, covers, lo, hi, eps) {
  const x0 = G[0], y0 = G[1], z0 = G[2], x1 = G[3], y1 = G[4], z1 = G[5], x2 = G[6], y2 = G[7], z2 = G[8];
  const a2 = (x1 - x0) * (z2 - z0) - (x2 - x0) * (z1 - z0);
  if (!(Math.abs(a2) > 2 * eps) || !covers.length) return null;
  // height of G's plane at (x, z)
  const hG = (x, z) => { const u = ((x - x0) * (z2 - z0) - (x2 - x0) * (z - z0)) / a2, v = ((x1 - x0) * (z - z0) - (x - x0) * (z1 - z0)) / a2; return y0 + u * (y1 - y0) + v * (y2 - y0); };
  let pieces = [a2 > 0 ? [[x0, z0], [x1, z1], [x2, z2]] : [[x0, z0], [x2, z2], [x1, z1]]], removed = false;
  for (const T of covers) {
    // a cover may carry its own lower bound as a 10th value (ground over ground / site under ground use +0.5 cm)
    const L = T.length > 9 ? T[9] : lo;
    let R = [[T[0], T[2], T[1] - hG(T[0], T[2])], [T[3], T[5], T[4] - hG(T[3], T[5])], [T[6], T[8], T[7] - hG(T[6], T[8])]];
    if (R.every(p => p[2] < L) || R.every(p => p[2] > hi)) continue;
    R = bound(bound(R, L, 1), hi, -1);
    if (R.length < 3) continue;
    let ar = area(R); if (Math.abs(ar) <= eps) continue;
    if (ar < 0) R.reverse();
    let rx0 = Infinity, rx1 = -Infinity, rz0 = Infinity, rz1 = -Infinity; for (const p of R) { rx0 = Math.min(rx0, p[0]); rx1 = Math.max(rx1, p[0]); rz0 = Math.min(rz0, p[1]); rz1 = Math.max(rz1, p[1]); }
    const next = [];
    for (const P of pieces) {
      let px0 = Infinity, px1 = -Infinity, pz0 = Infinity, pz1 = -Infinity; for (const p of P) { px0 = Math.min(px0, p[0]); px1 = Math.max(px1, p[0]); pz0 = Math.min(pz0, p[1]); pz1 = Math.max(pz1, p[1]); }
      if (px1 <= rx0 || px0 >= rx1 || pz1 <= rz0 || pz0 >= rz1) { next.push(P); continue; }
      const outs = []; let rem = P.map(p => [p[0], p[1]]);
      for (let i = 0, n = R.length; i < n && rem.length >= 3; i++) {
        const a = R[i], b = R[(i + 1) % n];
        const o = half(rem, a[0], a[1], b[0], b[1], -1); if (o.length >= 3 && area(o) > eps) outs.push(o);
        rem = half(rem, a[0], a[1], b[0], b[1], 1);
      }
      const inside = rem.length >= 3 ? area(rem) : 0;
      if (inside > eps) { removed = true; next.push(...outs); } else next.push(P);
    }
    pieces = next;
    if (!pieces.length) break;
  }
  if (!removed) return null;
  // exposed pieces as convex polygons [x,y,z, x,y,z, ...] on G's plane, wound like G (callers fan them: fanPolygon)
  const out = [];
  for (const P of pieces) { const Q = a2 > 0 ? P : [P[0], ...P.slice(1).reverse()], f = []; for (const q of Q) f.push(q[0], hG(q[0], q[1]), q[1]); out.push(f); }
  return out;
}
// fan of one polygon from clipExposed -> triangle vertex triples appended to `to` (flat x,y,z)
export function fanPolygon(f, to) { for (let k = 3; k + 3 < f.length; k += 3) to.push(f[0], f[1], f[2], f[k], f[k + 1], f[k + 2], f[k + 3], f[k + 4], f[k + 5]); return to; }
