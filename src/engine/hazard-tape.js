// Hazard tape (발밑 테이프, user decision 2026-10-18): a yellow / black construction-tape band on the ground around every
// DESTRUCTIBLE building, so targets read apart from the colourful non-destructible backdrop without touching its colours.
// Built once at campus assembly (src/engine/campus-engine.js) and only when the package asks for it:
//   pkg.hazardTape = { footprints }   outlines from the build script (scripts/lib/tape-footprints.mjs has the contract:
//                                      { id: [[e0, n0, e1, n1, ...], ...] } metres E / N of GEO_ORIGIN, rings unioned per building);
//   pkg.hazardTape = true             outlines derived from each model's ground-level geometry (for packages without footprints);
//   optional: inner_m / outer_m (band distance from the wall), exclude: [ids], lift_m.
// The band follows an iso-line of the distance to the real outline (so ㄷ / L shapes keep their courtyards, masses are unioned),
// sits on the visible baked ground (falls back to terrain.heightAt) with a small lift + polygon offset, is one merged mesh
// (one draw call, no shadows cast, not hit-testable) and dissolves away once its building is cleared (완파).
const DEFAULTS = Object.freeze({ inner_m: .7, outer_m: 2.3, lift_m: .06, cell_m: .4, fade_s: .55, modelBand_m: 3, closing_m: 1.2, maxStep_m: 1.1 });
const STRIPE_PERIOD = 1.7;   // one black + one yellow stripe = 1.7 x the band width, 45 degrees

export function createHazardTape(THREE, { entries, spec, terrain, surfaceRoots = [], worldUnitsPerMeter: W }) {
  if (!spec || !entries?.length) return null;
  const started = (globalThis.performance ?? Date).now();
  const opt = { ...DEFAULTS, ...(typeof spec === 'object' ? spec : {}) };
  const footprints = typeof spec === 'object' ? spec.footprints || null : null, exclude = new Set(opt.exclude || []);
  const level = (opt.inner_m + opt.outer_m) / 2, half = (opt.outer_m - opt.inner_m) / 2;
  // ---- 1. centre lines (metres, X = world x / W, Z = world z / W) per building
  const lines = [];
  for (const entry of entries) {
    if (exclude.has(entry.id)) continue;
    let outline = null;
    if (footprints) { const rings = footprints[entry.id]; if (!rings?.length) continue; outline = { rings: rings.map(r => { const out = []; for (let i = 0; i + 1 < r.length; i += 2) out.push([r[i], -r[i + 1]]); return out; }) }; }
    else outline = modelOutline(THREE, entry, W, opt);
    if (!outline) continue;
    const loops = isoLoops(outline, level, opt);
    if (loops.length) lines.push({ entry, loops });
  }
  if (!lines.length) return null;
  const now = () => (globalThis.performance ?? Date).now(), tOutline = now();
  // ---- 2. ribbon vertices (x, z in world units) + ground heights
  const xs = [], zs = [], us = [], vs = [], ranges = [], quads = [];
  for (const { entry, loops } of lines) {
    const start = xs.length;
    for (const { pts, outward } of loops) {
      const n = pts.length, base = xs.length;
      let L = 0; const along = [0];
      for (let i = 1; i <= n; i++) { const a = pts[i - 1], b = pts[i % n]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); along.push(L); }
      const repeats = Math.max(1, Math.round(L / (STRIPE_PERIOD * 2 * half)));
      for (let i = 0; i <= n; i++) {     // the seam vertex is duplicated so the stripes wrap with a whole number of periods
        const p = pts[i % n], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
        const n1 = segNormal(a, p, outward), n2 = segNormal(p, b, outward);
        let mx = n1[0] + n2[0], mz = n1[1] + n2[1]; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
        const k = half / Math.max(.55, mx * n1[0] + mz * n1[1]), u = along[i] / L * repeats;
        for (const [s, v] of [[-1, 0], [1, 1]]) { xs.push((p[0] + mx * k * s) * W); zs.push((p[1] + mz * k * s) * W); us.push(u); vs.push(v); }
      }
      quads.push([base, n]);
    }
    ranges.push({ entry, start, count: xs.length - start, alive: 1 });
  }
  // ground under every vertex, plus probes between them (pair middles, quad centres) for the step test below
  const nv = xs.length, px = xs.slice(), pz = zs.slice();
  for (let k = 0; k < nv; k += 2) { px.push((xs[k] + xs[k + 1]) / 2); pz.push((zs[k] + zs[k + 1]) / 2); }
  const centreAt = new Map();
  for (const [base, n] of quads) for (let i = 0; i < n; i++) { const a = base + i * 2; centreAt.set(a, px.length); px.push((xs[a] + xs[a + 1] + xs[a + 2] + xs[a + 3]) / 4); pz.push((zs[a] + zs[a + 1] + zs[a + 2] + zs[a + 3]) / 4); }
  const groundStats = {}, all = groundHeights(THREE, px, pz, { terrain, surfaceRoots, W, lift: opt.lift_m * W, stats: groundStats }), ys = all.subarray(0, nv), tGround = now();
  // ---- 3. one merged mesh
  const count = xs.length, position = new Float32Array(count * 3), uv = new Float32Array(count * 2), alive = new Float32Array(count).fill(1);
  for (let i = 0; i < count; i++) { position.set([xs[i], ys[i], zs[i]], i * 3); uv[i * 2] = us[i]; uv[i * 2 + 1] = vs[i]; }
  const index = [], step = opt.maxStep_m * W;   // world units
  let dropped = 0;
  for (const [base, n] of quads) for (let i = 0; i < n; i++) {
    const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;          // a,c inner; b,d outer
    // a quad across a terrace edge / retaining wall would cut through it or hang over the drop: leave a gap instead
    // A steep but continuous slope keeps its tape; a step (wall, terrace edge, kerb of an apron) shows as the probes
    // leaving the plane of the corners.
    const lo = Math.min(ys[a], ys[b], ys[c], ys[d]), hi = Math.max(ys[a], ys[b], ys[c], ys[d]);
    if (hi - lo > step * .55) {
      const mid = k => all[nv + k / 2], off = Math.max(Math.abs(mid(a) - (ys[a] + ys[b]) / 2), Math.abs(mid(c) - (ys[c] + ys[d]) / 2), Math.abs(all[centreAt.get(a)] - (ys[a] + ys[b] + ys[c] + ys[d]) / 4));
      if (off > step * .3 || hi - lo > step * 3) { dropped++; continue; }
    }
    // keep every face pointing up whichever way the loop runs
    const up = (xs[c] - xs[a]) * (zs[b] - zs[a]) - (zs[c] - zs[a]) * (xs[b] - xs[a]) > 0;
    if (up) index.push(a, b, c, b, d, c); else index.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const aliveAttr = new THREE.BufferAttribute(alive, 1); aliveAttr.setUsage(THREE.DynamicDrawUsage); geometry.setAttribute('tapeAlive', aliveAttr);
  geometry.setIndex(index); geometry.computeVertexNormals(); geometry.computeBoundingSphere(); geometry.computeBoundingBox();
  const texture = stripeTexture(THREE);
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: .86, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -10, depthWrite: false });
  material.name = 'hazard-tape';
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float tapeAlive;\nvarying float vTapeAlive;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n\tvTapeAlive = tapeAlive;\n\tif (tapeAlive <= 0.0) transformed = vec3(0.0);');
    shader.fragmentShader = 'varying float vTapeAlive;\n' + shader.fragmentShader.replace('#include <clipping_planes_fragment>',
      '#include <clipping_planes_fragment>\n\tif (vTapeAlive < .999 && fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) >= vTapeAlive) discard;');
  };
  material.customProgramCacheKey = () => 'hazard-tape-1';
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'hazard-tape'; mesh.renderOrder = 3; mesh.castShadow = false; mesh.receiveShadow = true;
  mesh.raycast = () => {};            // never a hit target (weapons, camera picks, shield proxies)
  mesh.userData.hazardTape = true;
  const stats = { buildings: ranges.length, loops: quads.length, triangles: index.length / 3, vertices: count, drawCalls: 1, droppedAtSteps: dropped,
    source: footprints ? 'footprints' : 'model', band_m: [opt.inner_m, opt.outer_m], ...groundStats, buildMilliseconds: 0 };
  stats.buildMilliseconds = Math.round(now() - started);
  stats.parts = { outlines: Math.round(tOutline - started), ground: Math.round(tGround - tOutline), mesh: Math.round(now() - tGround) };
  const write = r => { alive.fill(r.alive, r.start, r.start + r.count); aliveAttr.addUpdateRange?.(r.start, r.count); aliveAttr.needsUpdate = true; };
  let disposed = false;
  return { mesh, stats,
    get visibleBuildings() { return ranges.filter(r => r.alive > 0).length; },
    update(dt) {
      if (disposed) return;
      for (const r of ranges) {
        if (!r.entry.cleared || r.alive <= 0) continue;
        r.alive = Math.max(0, r.alive - (Number.isFinite(dt) && dt > 0 ? dt : 1 / 60) / opt.fade_s); write(r);
      }
    },
    reset() { if (disposed) return; for (const r of ranges) if (r.alive !== 1) { r.alive = 1; write(r); } },
    dispose() { if (disposed) return; disposed = true; mesh.removeFromParent(); geometry.dispose(); material.dispose(); texture.dispose(); },
  };
}

function segNormal(a, b, outward) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
  return [-dz / l * outward, dx / l * outward];
}

// 128 x 32 tile, 45 degree stripes when one repeat spans STRIPE_PERIOD band widths; 4 x 4 supersampled edges. The mip chain is drawn
// by hand with less black per level, so a far tape (wide / phone view) reads as a bright yellow ring instead of olive mush.
const MIP_DARK = [.5, .5, .42, .32, .22, .15, .12, .1];
function stripeTexture(THREE) {
  const yellow = [246, 196, 28], black = [28, 27, 26], level = (w, h, duty) => {
    const data = new Uint8Array(w * h * 4);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let dark = 0;
      for (let sj = 0; sj < 4; sj++) for (let si = 0; si < 4; si++) {
        const u = (i + (si + .5) / 4) / w, v = (j + (sj + .5) / 4) / h, s = u + v / STRIPE_PERIOD;
        if (s - Math.floor(s) < duty) dark++;
      }
      const t = dark / 16, k = (j * w + i) * 4;
      for (let c = 0; c < 3; c++) data[k + c] = Math.round(yellow[c] * (1 - t) + black[c] * t);
      data[k + 3] = 255;
    }
    return { data, width: w, height: h };
  };
  const mipmaps = [];
  for (let w = 128, h = 32, l = 0; ; w = Math.max(1, w >> 1), h = Math.max(1, h >> 1), l++) { mipmaps.push(level(w, h, MIP_DARK[Math.min(l, MIP_DARK.length - 1)])); if (w === 1 && h === 1) break; }
  const texture = new THREE.DataTexture(mipmaps[0].data, 128, 32, THREE.RGBAFormat);
  texture.mipmaps = mipmaps; texture.generateMipmaps = false;
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 8; texture.colorSpace = THREE.SRGBColorSpace; texture.name = 'hazard-tape-stripes'; texture.needsUpdate = true;
  return texture;
}

// ---------------------------------------------------------------- outline -> distance field -> iso-line loops
// Grid of cell centres over the outline bbox. Rings: exact distance to the nearest edge near the outline, sign from a scanline
// fill of the union. Model outlines: Euclidean distance transform of the filled mask.
function isoLoops(outline, level, opt) {
  const c = opt.cell_m, margin = opt.outer_m + (outline.extra_m || 0) + 3 * c;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const r of outline.rings || []) for (const [x, z] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  if (outline.box) [x0, z0, x1, z1] = outline.box;
  if (!(x1 > x0 && z1 > z0)) return [];
  x0 -= margin; z0 -= margin; x1 += margin; z1 += margin;
  const nx = Math.ceil((x1 - x0) / c) + 1, nz = Math.ceil((z1 - z0) / c) + 1;
  if (nx * nz > 4e6) return [];
  const grid = { x0, z0, c, nx, nz };
  let F;
  if (outline.rings) {
    // exact distance to the outline edges in a narrow band (cells farther than R keep R); negative inside the union
    const R = opt.outer_m + c * 2, inside = new Uint8Array(nx * nz); F = new Float32Array(nx * nz).fill(R);
    for (const r of outline.rings) {
      fillRing(inside, grid, r);
      for (let e = 0, f = r.length - 1; e < r.length; f = e++) {
        const [ax, az] = r[f], [bx, bz] = r[e], dx = bx - ax, dz = bz - az, ll = dx * dx + dz * dz || 1e-12;
        const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - R - x0) / c)), i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx) + R - x0) / c));
        const j0 = Math.max(0, Math.floor((Math.min(az, bz) - R - z0) / c)), j1 = Math.min(nz - 1, Math.ceil((Math.max(az, bz) + R - z0) / c));
        for (let j = j0; j <= j1; j++) { const pz = z0 + j * c; for (let i = i0; i <= i1; i++) {
          const px = x0 + i * c, u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / ll)), qx = ax + dx * u - px, qz = az + dz * u - pz, d = Math.sqrt(qx * qx + qz * qz), k = j * nx + i;
          if (d < F[k]) F[k] = d; } }
      }
    }
    for (let k = 0; k < F.length; k++) if (inside[k]) F[k] = -F[k];
  } else {
    const inside = outline.fill(grid), d2 = edt(inside, nx, nz), extra = outline.extra_m || 0; F = new Float32Array(nx * nz);
    for (let k = 0; k < F.length; k++) F[k] = inside[k] ? -c : Math.sqrt(d2[k]) * c - c / 2 + extra;
  }
  return march(F, grid, level).filter(l => l.length > 6).map(loop => {
    const pts = resample(simplifyClosed(loop, .035), .9);
    // outward = the side where the distance grows (tested at the longest segment)
    let best = 0, bl = -1; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > bl) { bl = l; best = i; } }
    const a = pts[best], b = pts[(best + 1) % pts.length], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], nrm = segNormal(a, b, 1), e = c * 1.5;
    const outward = sample(F, grid, m[0] + nrm[0] * e, m[1] + nrm[1] * e) >= sample(F, grid, m[0] - nrm[0] * e, m[1] - nrm[1] * e) ? 1 : -1;
    return { pts, outward };
  }).filter(l => l.pts.length >= 3);
}

function fillRing(mask, { x0, z0, c, nx, nz }, ring) {
  const xs = [];
  for (let j = 0; j < nz; j++) {
    const z = z0 + j * c; xs.length = 0;
    for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) {
      const [xa, za] = ring[k], [xb, zb] = ring[i];
      if ((za > z) !== (zb > z)) xs.push(xa + (z - za) / (zb - za) * (xb - xa));
    }
    xs.sort((a, b) => a - b);
    for (let p = 0; p + 1 < xs.length; p += 2) {
      const ia = Math.max(0, Math.ceil((xs[p] - x0) / c)), ib = Math.min(nx - 1, Math.floor((xs[p + 1] - x0) / c));
      for (let i = ia; i <= ib; i++) mask[j * nx + i] = 1;
    }
  }
}

// Squared Euclidean distance (in cells) to the nearest set cell (Felzenszwalb & Huttenlocher, separable).
function edt(mask, nx, nz) {
  const INF = 1e20, out = new Float64Array(nx * nz), n = Math.max(nx, nz), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const pass = len => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0; for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  };
  for (let i = 0; i < nx; i++) { for (let j = 0; j < nz; j++) f[j] = mask[j * nx + i] ? 0 : INF; pass(nz); for (let j = 0; j < nz; j++) out[j * nx + i] = d[j]; }
  for (let j = 0; j < nz; j++) { for (let i = 0; i < nx; i++) f[i] = out[j * nx + i]; pass(nx); for (let i = 0; i < nx; i++) out[j * nx + i] = d[i]; }
  return out;
}

function sample(F, { x0, z0, c, nx, nz }, x, z) {
  const fx = Math.max(0, Math.min(nx - 1.0001, (x - x0) / c)), fz = Math.max(0, Math.min(nz - 1.0001, (z - z0) / c)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, t = fz - j;
  const a = F[j * nx + i], b = F[j * nx + i + 1], d = F[(j + 1) * nx + i], e = F[(j + 1) * nx + i + 1];
  return (a * (1 - u) + b * u) * (1 - t) + (d * (1 - u) + e * u) * t;
}

// Marching squares on cell-centre values; returns closed loops of [x, z] (saddles resolved by the cell average).
function march(F, { x0, z0, c, nx, nz }, L) {
  const pt = new Map(), links = new Map();
  const H = (i, j) => (j * nx + i) * 2, V = (i, j) => (j * nx + i) * 2 + 1;
  const point = key => {
    let p = pt.get(key); if (p) return p;
    const cell = key >> 1, i = cell % nx, j = (cell - i) / nx, i2 = key & 1 ? i : i + 1, j2 = key & 1 ? j + 1 : j;
    const a = F[j * nx + i], b = F[j2 * nx + i2], t = Math.max(0, Math.min(1, (L - a) / (b - a || 1e-9)));
    p = [x0 + (i + (i2 - i) * t) * c, z0 + (j + (j2 - j) * t) * c]; pt.set(key, p); return p;
  };
  const link = (a, b) => { for (const [p, q] of [[a, b], [b, a]]) { const l = links.get(p); if (l) l.push(q); else links.set(p, [q]); } };
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = F[j * nx + i] < L, b = F[j * nx + i + 1] < L, cc = F[(j + 1) * nx + i + 1] < L, d = F[(j + 1) * nx + i] < L;
    const code = (a ? 1 : 0) | (b ? 2 : 0) | (cc ? 4 : 0) | (d ? 8 : 0);
    if (code === 0 || code === 15) continue;
    const bottom = H(i, j), right = V(i + 1, j), top = H(i, j + 1), left = V(i, j);
    const centreIn = (F[j * nx + i] + F[j * nx + i + 1] + F[(j + 1) * nx + i + 1] + F[(j + 1) * nx + i]) / 4 < L;
    switch (code) {
      case 1: case 14: link(left, bottom); break;
      case 2: case 13: link(bottom, right); break;
      case 3: case 12: link(left, right); break;
      case 4: case 11: link(right, top); break;
      case 6: case 9: link(bottom, top); break;
      case 7: case 8: link(left, top); break;
      case 5: if (centreIn) { link(bottom, right); link(top, left); } else { link(left, bottom); link(right, top); } break;
      case 10: if (centreIn) { link(left, bottom); link(right, top); } else { link(bottom, right); link(top, left); } break;
    }
  }
  const loops = [], used = new Set();
  for (const startKey of links.keys()) {
    if (used.has(startKey)) continue;
    const loop = []; let prev = -1, cur = startKey;
    while (cur !== undefined && !used.has(cur)) {
      used.add(cur); loop.push(point(cur));
      const next = (links.get(cur) || []).find(k => k !== prev && !used.has(k)); prev = cur; cur = next;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

function simplifyClosed(pts, tol) {
  const n = pts.length; if (n < 8) return pts;
  // split at the two farthest-apart points, Douglas-Peucker each half
  let far = 0, fd = -1; for (let i = 1; i < n; i++) { const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2; if (d > fd) { fd = d; far = i; } }
  const dp = (a, b, keep) => {
    let best = -1, bd = tol;
    const [ax, az] = pts[a], [bx, bz] = pts[b % n], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1e-9;
    for (let i = a + 1; i < b; i++) { const [px, pz] = pts[i % n], d = Math.abs((px - ax) * dz - (pz - az) * dx) / l; if (d > bd) { bd = d; best = i; } }
    if (best < 0) return; dp(a, best, keep); keep.push(best % n); dp(best, b, keep);
  };
  const keep = [0]; dp(0, far, keep); keep.push(far); dp(far, n, keep);
  return keep.map(i => pts[i]);
}

function resample(pts, maxLen) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxLen));
    for (let s = 0; s < n; s++) out.push([a[0] + (b[0] - a[0]) * s / n, a[1] + (b[1] - a[1]) * s / n]);
  }
  return out;
}

// ---------------------------------------------------------------- outline from the model (packages without footprints)
// Edges of the triangles in the lowest `modelBand_m` metres, projected to the ground, closed by `closing_m` (doors, pilotis),
// then everything the outside cannot reach = the building. The iso level is measured from the walls (extra_m = closing).
function modelOutline(THREE, entry, W, opt) {
  const segs = [], v = new THREE.Vector3(), floor = (entry.baseY ?? entry.worldBounds.min.y) / W, top = floor + opt.modelBand_m;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const mesh of entry.model.meshes) {
    mesh.updateWorldMatrix(true, false);
    const pos = mesh.geometry.getAttribute('position'), idx = mesh.geometry.index, tri = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const n = idx ? idx.count : pos.count;
    for (let k = 0; k + 2 < n; k += 3) {
      for (let q = 0; q < 3; q++) { v.fromBufferAttribute(pos, idx ? idx.getX(k + q) : k + q).applyMatrix4(mesh.matrixWorld); tri[q][0] = v.x / W; tri[q][1] = v.y / W; tri[q][2] = v.z / W; }
      if (Math.min(tri[0][1], tri[1][1], tri[2][1]) > top) continue;
      for (let q = 0; q < 3; q++) { const a = tri[q], b = tri[(q + 1) % 3]; segs.push(a[0], a[2], b[0], b[2]);
        x0 = Math.min(x0, a[0]); x1 = Math.max(x1, a[0]); z0 = Math.min(z0, a[2]); z1 = Math.max(z1, a[2]); }
    }
  }
  if (!segs.length) return null;
  const r = opt.closing_m;
  return { box: [x0, z0, x1, z1], extra_m: r, fill({ x0: gx, z0: gz, c, nx, nz }) {
    const wall = new Uint8Array(nx * nz);
    for (let s = 0; s < segs.length; s += 4) {
      const ax = (segs[s] - gx) / c, az = (segs[s + 1] - gz) / c, bx = (segs[s + 2] - gx) / c, bz = (segs[s + 3] - gz) / c, n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) * 2));
      for (let t = 0; t <= n; t++) { const i = Math.round(ax + (bx - ax) * t / n), j = Math.round(az + (bz - az) * t / n); if (i >= 0 && j >= 0 && i < nx && j < nz) wall[j * nx + i] = 1; }
    }
    const d2 = edt(wall, nx, nz), lim = (r / c) ** 2, outside = new Uint8Array(nx * nz), stack = [];
    const open = k => d2[k] > lim && !outside[k];
    for (let i = 0; i < nx; i++) for (const j of [0, nz - 1]) { const k = j * nx + i; if (open(k)) { outside[k] = 1; stack.push(k); } }
    for (let j = 0; j < nz; j++) for (const i of [0, nx - 1]) { const k = j * nx + i; if (open(k)) { outside[k] = 1; stack.push(k); } }
    while (stack.length) {
      const k = stack.pop(), i = k % nx, j = (k - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const q = b * nx + a; if (open(q)) { outside[q] = 1; stack.push(q); } }
    }
    for (let k = 0; k < outside.length; k++) outside[k] = outside[k] ? 0 : 1;   // now: inside (building + closing band)
    return outside;
  } };
}

// ---------------------------------------------------------------- heights: the visible ground under each vertex
// Topmost non-vertical triangle of the baked ground / site meshes (terraces, aprons, place pads included) within a window around
// terrain.heightAt; heightAt where none.
// Triangles are bucketed on a 2 m grid over the tape's bounding box (typed arrays, two passes: count, then fill).
function groundHeights(THREE, xs, zs, { terrain, surfaceRoots, W, lift, stats }) {
  const n = xs.length, ys = new Float64Array(n), hT = new Float64Array(n);
  for (let k = 0; k < n; k++) hT[k] = terrain?.heightAt ? terrain.heightAt(xs[k], zs[k]) : 0;
  let bx0 = Infinity, bz0 = Infinity, bx1 = -Infinity, bz1 = -Infinity;
  for (let k = 0; k < n; k++) { bx0 = Math.min(bx0, xs[k]); bx1 = Math.max(bx1, xs[k]); bz0 = Math.min(bz0, zs[k]); bz1 = Math.max(bz1, zs[k]); }
  const cell = 2 * W, gx = Math.floor(bx1 / cell) - Math.floor(bx0 / cell) + 1, gz = Math.floor(bz1 / cell) - Math.floor(bz0 / cell) + 1, ox = Math.floor(bx0 / cell), oz = Math.floor(bz0 / cell);
  const want = new Uint8Array(gx * gz);
  for (let k = 0; k < n; k++) want[(Math.floor(zs[k] / cell) - oz) * gx + Math.floor(xs[k] / cell) - ox] = 1;
  // pass over every candidate triangle: keep those touching a wanted cell (world coordinates in `tris`, 9 floats each)
  const tris = [], refs = [];   // refs: [cell, triangle] pairs
  const t = new Float64Array(9), box = new THREE.Box3();
  for (const root of surfaceRoots) root?.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry) return;
    const p = o.geometry.getAttribute('position'); if (!p || p.isInterleavedBufferAttribute || p.normalized) return;
    o.updateWorldMatrix(true, false);
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    if (box.max.x < bx0 || box.min.x > bx1 || box.max.z < bz0 || box.min.z > bz1) return;   // whole bucket away from the tape
    const idx = o.geometry.index, m = idx ? idx.count : p.count, e = o.matrixWorld.elements, a = p.array, ix = idx?.array;
    for (let k = 0; k + 2 < m; k += 3) {
      for (let q = 0; q < 3; q++) { const r = (ix ? ix[k + q] : k + q) * 3, x = a[r], y = a[r + 1], z = a[r + 2];
        t[q * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; t[q * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; t[q * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
      const xa = Math.min(t[0], t[3], t[6]), xb = Math.max(t[0], t[3], t[6]), za = Math.min(t[2], t[5], t[8]), zb = Math.max(t[2], t[5], t[8]);
      if (xb < bx0 || xa > bx1 || zb < bz0 || za > bz1) continue;
      if (Math.abs((t[3] - t[0]) * (t[8] - t[2]) - (t[6] - t[0]) * (t[5] - t[2])) < 1e-6) continue;   // vertical / degenerate
      const i0 = Math.max(0, Math.floor(xa / cell) - ox), i1 = Math.min(gx - 1, Math.floor(xb / cell) - ox), j0 = Math.max(0, Math.floor(za / cell) - oz), j1 = Math.min(gz - 1, Math.floor(zb / cell) - oz);
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > 400) continue;
      let id = -1;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const c = j * gx + i; if (!want[c]) continue; if (id < 0) { id = tris.length / 9; for (let q = 0; q < 9; q++) tris.push(t[q]); } refs.push(c, id); }
    }
  });
  const start = new Int32Array(gx * gz + 1), list = new Int32Array(refs.length / 2);
  for (let r = 0; r < refs.length; r += 2) start[refs[r] + 1]++;
  for (let c = 0; c < gx * gz; c++) start[c + 1] += start[c];
  { const fill = start.slice(0, gx * gz); for (let r = 0; r < refs.length; r += 2) list[fill[refs[r]]++] = refs[r + 1]; }
  let onSurface = 0;
  for (let k = 0; k < n; k++) {
    const x = xs[k], z = zs[k], c = (Math.floor(z / cell) - oz) * gx + Math.floor(x / cell) - ox, lo = hT[k] - 4 * W, hi = hT[k] + 6 * W;   // 4 m below .. 6 m above (terraces / aprons the grid does not carry)
    let best = -Infinity;
    for (let r = start[c]; r < start[c + 1]; r++) {
      const T = list[r] * 9, x0 = tris[T], y0 = tris[T + 1], z0 = tris[T + 2], x1 = tris[T + 3], y1 = tris[T + 4], z1 = tris[T + 5], x2 = tris[T + 6], y2 = tris[T + 7], z2 = tris[T + 8];
      const d = (x1 - x0) * (z2 - z0) - (x2 - x0) * (z1 - z0);
      const a = ((x1 - x) * (z2 - z) - (x2 - x) * (z1 - z)) / d, b = ((x2 - x) * (z0 - z) - (x0 - x) * (z2 - z)) / d, w = 1 - a - b;
      if (a < -1e-6 || b < -1e-6 || w < -1e-6) continue;
      const y = a * y0 + b * y1 + w * y2;
      if (y > best && y >= lo && y <= hi) best = y;
    }
    if (Number.isFinite(best)) onSurface++;
    ys[k] = (Number.isFinite(best) ? best : hT[k]) + lift;
  }
  if (stats) { stats.visibleGroundShare = +(onSurface / Math.max(1, n)).toFixed(3); stats.surfaceTriangles = tris.length / 9; }
  return ys;
}
