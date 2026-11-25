// Wrecking-ball crane (free weapon, user decision 2026-10-18 "make the wrecking ball real"; mock 시안/새무기_후보_시안.html).
// Tap a building: a crawler crane stands beside that wall (outside every building box, clear of protected buildings, trees
// and lamps, on flat enough ground, preferring a spot the camera sees), its boom tip right above the tapped point. The ball
// is held back by a tag line on the crane's side of the swing plane (45 degrees off the wall normal), released, and swings
// in at ~45 degrees, raking up through the floors (campus.hit along the ball path, plus hits stacked above it) while the
// pieces it ploughs slow it down. First contact = slam: freeze + slow motion, dust, sparks, chunks, metallic ring.
// Same building again: the parked crane slews / drives to the new spot (round 3: pivot, boom down, accelerate, cruise, brake);
// farther: it drives off out of the frame while a crane drives in at the new spot.
// Protected buildings (hospitals, the SKKU hanok): the ball meets the shield and bounces back, no damage.
// Held: a crane remote (overlay pass like src/heavy-weapons.js). Sounds: chain rattle, cable creak, winch, whoosh, slam +
// metallic ring, diesel idle while parked (stops when the weapon is put away / the page is hidden).
// Damage only through campus.hit. Effects are pooled at creation; update() does not allocate (WebAudio nodes aside).
import { WEAPON_TUNING } from './weapon-tuning.js?v=sn130';
import { buildCrane, buildRemote, cloneCrane, dataTexture } from './wrecking-ball-models.js?v=wreck46';

export const WRECK_ID = 'wrecking-ball';
const DEG = Math.PI / 180;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const angleLerp = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
// travel profile from rest to rest over distance d (accelerate A, cruise at most V, brake A): time, and position / speed /
// acceleration at time t (into `out`; also run by the check)
export function travelTime(d, A, V) { const ta = Math.min(V / A, Math.sqrt(Math.max(0, d) / A)), vp = A * ta; return 2 * ta + (vp > 0 ? Math.max(0, (d - vp * ta) / vp) : 0); }
export function travelAt(t, d, A, V, out = { s: 0, v: 0, a: 0 }) {
  const ta = Math.min(V / A, Math.sqrt(Math.max(0, d) / A)), vp = A * ta, tc = vp > 0 ? Math.max(0, (d - vp * ta) / vp) : 0, T2 = 2 * ta + tc;
  if (t <= 0) { out.s = 0; out.v = 0; out.a = 0; } else if (t < ta) { out.s = A * t * t / 2; out.v = A * t; out.a = A; }
  else if (t < ta + tc) { out.s = A * ta * ta / 2 + vp * (t - ta); out.v = vp; out.a = 0; } else if (t < T2) { const u = T2 - t; out.s = d - A * u * u / 2; out.v = A * u; out.a = -A; }
  else { out.s = d; out.v = 0; out.a = 0; }
  return out;
}

// ---------- swing timing (pure; also run by 검증/wrecking-ball-check.mjs) ----------
// Release from the pull angle; returns seconds until the ball passes straight down (theta 0 = the tapped wall point) and
// its speed there. Same rope pendulum as the live ball (gravity + air drag).
export function swingTiming(T = WEAPON_TUNING.wreckingBall, L = T.cable, pull = T.pull * DEG) {
  let th = pull, om = 0, t = 0; const h = 1 / 240, k = T.gravity / L;
  while (th > 0 && t < 5) { om += (-k * Math.sin(th) - T.damping * om) * h; th += om * h; t += h; }
  return { impact: t, speed: Math.abs(om) * L };
}

// ---------- crane placement (pure math; THREE-free so the check can run it on real campuses) ----------
// boxes: [{ id, inv: number[16] (column-major world -> building local), min: [x,y,z], max: [x,y,z], scale }]
// rings: [{ ring: [{x, z}], minX, maxX, minZ, maxZ }] (protected outlines)
// obstacles: [{ x, z, r, k }] (trees, lamps, benches ... standing on the ground; k = can be knocked over (instanced))
// view (per call): { project(x, y, z) -> [ndcX, ndcY, inFront, depth], fx, fz (horizontal camera forward), p0, p5 } or null
export function createCranePlanner({ heightAt, boxes = [], rings = [], obstacles = [], area = null, tuning = WEAPON_TUNING.wreckingBall }) {
  const T = tuning, CELL = 8, grid = new Map(), key = (cx, cz) => cx * 73856093 ^ cz * 19349663;
  let maxR = 0;
  for (const o of obstacles) { maxR = Math.max(maxR, o.r); const k = key(Math.floor(o.x / CELL), Math.floor(o.z / CELL)); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(o); }
  // clearance from the nearest obstacle edge (d: any, hard: ones that cannot be knocked over) and a soft crowding score;
  // with `list`, the knockable ones closer than `knockReach` are added to it
  const near = { d: Infinity, hard: Infinity, soft: 0 };
  function obstaclesAt(x, z, reach, list = null, knockReach = 0) {
    near.d = near.hard = Infinity; near.soft = 0; const R = reach + maxR, c0x = Math.floor((x - R) / CELL), c1x = Math.floor((x + R) / CELL), c0z = Math.floor((z - R) / CELL), c1z = Math.floor((z + R) / CELL);
    for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) {
      const l = grid.get(key(cx, cz)); if (!l) continue;
      for (const o of l) {
        if (o.down) continue; const d = Math.hypot(o.x - x, o.z - z) - o.r; if (d < near.d) near.d = d; if (!o.k && d < near.hard) near.hard = d;
        if (d < reach) near.soft += (reach - d) / reach;
        if (list && o.k && d < knockReach && !list.includes(o)) list.push(o);
      }
    }
    return near;
  }
  function inBox(b, x, y, z, m) {
    const e = b.inv, lx = e[0] * x + e[4] * y + e[8] * z + e[12], ly = e[1] * x + e[5] * y + e[9] * z + e[13], lz = e[2] * x + e[6] * y + e[10] * z + e[14], ml = m / b.scale;
    return lx > b.min[0] - ml && lx < b.max[0] + ml && ly > b.min[1] - ml && ly < b.max[1] + ml && lz > b.min[2] - ml && lz < b.max[2] + ml;
  }
  function inRing(r, x, z, m) {
    if (x < r.minX - m || x > r.maxX + m || z < r.minZ - m || z > r.maxZ + m) return false;
    const p = r.ring; let yes = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], q = p[j]; if ((a.z > z) !== (q.z > z) && x < (q.x - a.x) * (z - a.z) / (q.z - a.z) + a.x) yes = !yes; }
    if (yes || m <= 0) return yes;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], q = p[j], ex = q.x - a.x, ez = q.z - a.z, l2 = ex * ex + ez * ez || 1, t = clamp(((x - a.x) * ex + (z - a.z) * ez) / l2, 0, 1); if (Math.hypot(x - a.x - ex * t, z - a.z - ez * t) < m) return true; }
    return false;
  }
  // building boxes carry a world bounding circle (cx, cz, rad): most boxes are rejected with two multiplies
  for (const b of boxes) if (!(b.rad > 0)) {
    const e = b.inv, m = new Array(9); // invert the 3x3 part (world <- local) to find the world corners
    const a00 = e[0], a01 = e[4], a02 = e[8], a10 = e[1], a11 = e[5], a12 = e[9], a20 = e[2], a21 = e[6], a22 = e[10];
    const det = a00 * (a11 * a22 - a12 * a21) - a01 * (a10 * a22 - a12 * a20) + a02 * (a10 * a21 - a11 * a20) || 1e-9;
    m[0] = (a11 * a22 - a12 * a21) / det; m[1] = (a02 * a21 - a01 * a22) / det; m[2] = (a01 * a12 - a02 * a11) / det;
    m[3] = (a12 * a20 - a10 * a22) / det; m[4] = (a00 * a22 - a02 * a20) / det; m[5] = (a02 * a10 - a00 * a12) / det;
    m[6] = (a10 * a21 - a11 * a20) / det; m[7] = (a01 * a20 - a00 * a21) / det; m[8] = (a00 * a11 - a01 * a10) / det;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const lx of [b.min[0], b.max[0]]) for (const ly of [b.min[1], b.max[1]]) for (const lz of [b.min[2], b.max[2]]) {
      const qx = lx - e[12], qy = ly - e[13], qz = lz - e[14], wx = m[0] * qx + m[1] * qy + m[2] * qz, wz = m[6] * qx + m[7] * qy + m[8] * qz;
      if (wx < minX) minX = wx; if (wx > maxX) maxX = wx; if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
    }
    b.cx = (minX + maxX) / 2; b.cz = (minZ + maxZ) / 2; b.rad = Math.hypot(maxX - minX, maxZ - minZ) / 2;
  }
  // first blocking building box (skip = target id), or null
  function blocked(x, y, z, m, skip = null, list = boxes) {
    for (const b of list) { const dx = x - b.cx, dz = z - b.cz, r = b.rad + m; if (dx * dx + dz * dz > r * r || b.id === skip) continue; if (inBox(b, x, y, z, m)) return b; }
    return null;
  }
  const nearList = [];
  function boxesNear(x, z, reach) { nearList.length = 0; for (const b of boxes) { const r = b.rad + reach; if ((x - b.cx) ** 2 + (z - b.cz) ** 2 < r * r) nearList.push(b); } return nearList; }
  function blockedProtected(x, z, m) { for (const r of rings) if (inRing(r, x, z, m)) return true; return false; }
  const why = {}, no = r => { why[r] = (why[r] || 0) + 1; return null; };
  const RING = Array.from({ length: 12 }, (_, i) => [Math.cos(i / 12 * Math.PI * 2), Math.sin(i / 12 * Math.PI * 2)]);
  // Can the crane stand at (x, z) with its tracks along yaw? Returns null (no) or { y, pitch, roll, slope, soft, clear, knock }.
  // relaxed: strict = no tree / lamp within treeCore; relaxed = lamps / non-instanced scenery still keep clear, trees inside
  // the footprint are listed in `knock` (the crane pushes them over), tighter building margin, a little steeper ground.
  function footprint(x, z, yaw, relaxed = false) {
    const g = heightAt(x, z); if (!Number.isFinite(g)) return no('ground');
    if (area && (x < area.minX || x > area.maxX || z < area.minZ || z > area.maxZ)) return no('area');
    const F = T.footprint, M = relaxed ? T.margin * .5 : T.margin, nb = boxesNear(x, z, F + M + .5);
    if (blocked(x, g + 1.2, z, M, null, nb) || blocked(x, g + 4.5, z, M, null, nb) || blockedProtected(x, z, F + M)) return no('building');
    if (nb.length) for (const [c, s] of RING) for (const k of [1, .55]) { const px = x + c * F * k, pz = z + s * F * k, gy = heightAt(px, pz); if (!Number.isFinite(gy) || blocked(px, gy + 1.2, pz, M, null, nb) || blocked(px, gy + 4.5, pz, M, null, nb)) return no('building'); }
    const sy = Math.sin(yaw), cy = Math.cos(yaw), hw = 3.5, hl = 5;
    const h = (a, b) => heightAt(x + cy * a + sy * b, z - sy * a + cy * b);
    const fl = h(-hw, hl), fr = h(hw, hl), bl = h(-hw, -hl), br = h(hw, -hl);
    const lo = Math.min(fl, fr, bl, br, g), hi = Math.max(fl, fr, bl, br, g), slope = hi - lo;
    if (!(slope <= T.maxSlope * (relaxed ? 1.4 : 1))) return no('slope');
    const knock = relaxed ? [] : null, ob = obstaclesAt(x, z, T.treeSoft, knock, F * .95);
    if (!relaxed && ob.d < T.treeCore) return no('tree');
    if (relaxed && ob.hard < F * .8) return no('lamp');
    return { y: (fl + fr + bl + br) / 4, pitch: Math.atan2((fl + fr) - (bl + br), 4 * hl), roll: Math.atan2((fr + br) - (fl + bl), 4 * hw), slope, soft: ob.soft, clear: ob.d, knock };
  }
  // one point of a drive path (tracks along yaw): no building, protected outline or lamp; trees are pushed over (listed)
  function pathPoint(x, z, knock, F = T.footprint * .85) {
    const g = heightAt(x, z); if (!Number.isFinite(g)) return false;
    if (area && (x < area.minX - 20 || x > area.maxX + 20 || z < area.minZ - 20 || z > area.maxZ + 20)) return false;
    const nb = boxesNear(x, z, F + .6);
    if (blocked(x, g + 1.2, z, .4, null, nb) || blockedProtected(x, z, F + .4)) return false;
    if (nb.length) for (const [c, s] of RING) { const px = x + c * F, pz = z + s * F, gy = heightAt(px, pz); if (!Number.isFinite(gy) || blocked(px, gy + 1.2, pz, .4, null, nb)) return false; }
    const ob = obstaclesAt(x, z, F, knock, F * .9); return ob.hard >= F * .7;
  }
  // straight drive from (ax, az) to (bx, bz): the trees it pushes over, or null when it cannot drive there
  function drivable(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / 2.5)), knock = [];
    for (let i = 0; i < n; i++) { const t = i / n; if (!pathPoint(ax + (bx - ax) * t, az + (bz - az) * t, knock)) return null; }
    // ground along the way must not jump (kerbs / retaining walls)
    let prev = heightAt(ax, az); for (let i = 1; i <= n; i++) { const t = i / n, y = heightAt(ax + (bx - ax) * t, az + (bz - az) * t); if (Math.abs(y - prev) > T.maxSlope * .9) return null; prev = y; }
    return knock;
  }
  // round 3, the departing crane: how far it can drive straight from (ax, az) along (dx, dz), up to maxS (a little narrower
  // clearance than an arrival: it starts from where it stood); the trees on the way are added to `knock`
  function drivableRun(ax, az, dx, dz, maxS, knock) {
    let prev = heightAt(ax, az), run = 0;
    for (let s = 0; s <= maxS + 1e-6; s += 2.5) {
      const x = ax + dx * s, z = az + dz * s; if (!pathPoint(x, z, knock, T.footprint * .7)) break;
      const y = heightAt(x, z); if (s > 0 && Math.abs(y - prev) > T.maxSlope * 1.2) break; prev = y; run = s;
    }
    return run;
  }
  // Entrance: the crane drives in along the ground from a point just off the frame (or as far out as the ground allows).
  // Returns { x, z, yaw (tracks, along the drive), dist, knock } or null (then it is lowered in).
  // Round 3: where every start up to 32 is inside the frame (a wide view), starts at 44 / 56 are tried too, so the crane does
  // not appear out of nothing in the middle of the picture.
  function approach(bx, bz, ix, iz, view = null) {
    let best = null; const ox = bx - ix, oz = bz - iz, ol = Math.hypot(ox, oz) || 1;
    for (const DS of [[20, 26, 15, 32], [44, 56]]) {
    if (DS[0] > 40 && (!view || !best || best.out)) break;
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      for (const D of DS) {
        const sx = bx + dx * D, sz = bz + dz * D, knock = drivable(sx, sz, bx, bz); if (!knock) continue;
        let score = knock.length * .7 + D * .025 + (1 - (dx * ox + dz * oz) / ol) * .8, out = false;   // few trees, short, coming from the open side
        if (view) {
          const g = heightAt(sx, sz), p = view.project(sx, (Number.isFinite(g) ? g : 0) + 3, sz), m = Math.max(Math.abs(p[0]), Math.abs(p[1]));
          out = !p[2] || m > 1.08; score += out ? -1.6 : (1.08 - m) * 2.5;   // starts out of the frame (or as close to its edge as possible)
        }
        if (!best || score < best.score) best = { x: sx, z: sz, yaw: Math.atan2(bx - sx, bz - sz), dist: D, knock, score, out };
      }
    }
    }
    return best;
  }
  let lift = Infinity; // arc-ground: how much higher the wall point would have to be for the arc to clear the ground
  const HOUSE_FOOT = 3.05, FOOT_Y = 4.3; // boom foot: this far ahead of the slewing centre and above the ground
  const off = p => (p[2] ? 0 : 2.5) + Math.max(0, Math.abs(p[0]) - .8) * 4 + Math.max(0, Math.abs(p[1]) - .8) * 4;
  // Evaluate one crane spot for a swing into I (ball centre at the wall) with outward wall normal (nx, nz).
  // side: which way along the wall the crane stands (and the ball is pulled back); a: swing plane vs the normal (radians).
  // level: 0 strict, 1 the swing path may pass closer to a neighbour, 2 the camera rules become preferences, 3 relaxed spot
  // the parts of a spot that do not depend on the swing plane: boom reach / angle, boom and cable clear of other buildings
  const spotOut = { yaw: 0, reach: 0, luff: 0 };
  function spotCheck(I, bx, bz, fp, L, skip) {
    const px = I.x, py = I.y + L, pz = I.z, yaw = Math.atan2(px - bx, pz - bz);
    const footX = bx + Math.sin(yaw) * HOUSE_FOOT, footZ = bz + Math.cos(yaw) * HOUSE_FOOT, footY = fp.y + FOOT_Y;
    const reach = Math.hypot(px - footX, pz - footZ), rise = py - footY;
    if (reach < T.reachMin || reach > T.reachMax || rise < 4) return no('reach');
    const luff = Math.atan2(rise, reach); if (luff < 28 * DEG || luff > 80 * DEG) return no('luff');
    // cable from the tip down to the wall point: not through another building
    for (let i = 1; i < 5; i++) if (blocked(px, py - L * i / 5, pz, .4, skip)) return no('cable');
    // boom: clear of other buildings all along; of the target only near the crane (its box can reach past a recessed wall)
    for (let i = 1; i <= 8; i++) { const t = i / 9, x = footX + (px - footX) * t, y = footY + (py - footY) * t, z = footZ + (pz - footZ) * t; if (blocked(x, y, z, .6, t < .62 ? null : skip)) return no('boom'); }
    spotOut.yaw = yaw; spotOut.reach = reach; spotOut.luff = luff; return spotOut;
  }
  function evaluate(I, nx, nz, side, a, bx, bz, opts, fpIn = null, pre = null) {
    const { L, R, pull, skip, level, view, current } = opts;
    const px = I.x, py = I.y + L, pz = I.z;
    const fp = fpIn || footprint(bx, bz, Math.atan2(px - bx, pz - bz), level >= 3); if (!fp) return null;
    const sp = pre || spotCheck(I, bx, bz, fp, L, skip); if (!sp) return null;
    const yaw = sp.yaw, reach = sp.reach, luff = sp.luff;
    const ca = Math.cos(side * a), sa = Math.sin(side * a), wx = nx * ca + nz * sa, wz = -nx * sa + nz * ca;
    // the view (user 10-19): the crane body inside the frame, the swing plane roughly parallel to the screen (the ball is pulled
    // back sideways, not toward the lens), the held ball never nearer the camera than the wall and never covering > coverMax
    let ix = 0, iy = 0, id = 1, view0 = 0;
    if (view) {
      const pI = view.project(I.x, I.y, I.z); ix = pI[0]; iy = pI[1]; id = pI[3];
      view0 = off(view.project(bx, fp.y + 4, bz)) * 2 + off(view.project(px, py, pz)) * .35 + Math.abs(wx * view.fx + wz * view.fz) * T.parallel;
      // a crane hidden behind a building only shows its boom
      for (let i = 1; i < 8; i++) { const t = i / 8, x = view.cx + (bx - view.cx) * t, y = view.cy + (fp.y + 4 - view.cy) * t, z = view.cz + (bz - view.cz) * t; if (blocked(x, y, z, 0)) { view0 += 1.2; break; } }
    }
    let best = Infinity, pullUsed = pull, cover = 0, nearer = false; lift = Infinity;
    for (const share of level >= 3 ? [1, .82, .66, .5] : [1, .82, .66]) {
      const pl = pull * share; let pen = share < 1 ? (1 - share) * 9 : 0, bad = null, need = 0;
      for (let i = 0; i <= 6 && !bad; i++) {
        const th = pl * (1 - i / 6) * .98 + .02 * pl, x = px + wx * Math.sin(th) * L, y = py - Math.cos(th) * L, z = pz + wz * Math.sin(th) * L;
        const gy = heightAt(x, z); if (Number.isFinite(gy) && y - R < gy - .3 * R) { bad = 'arc-ground'; need = Math.max(need, gy - .3 * R - (y - R)); for (let j = i + 1; j <= 6; j++) { const t2 = pl * (1 - j / 6) * .98 + .02 * pl, x2 = px + wx * Math.sin(t2) * L, z2 = pz + wz * Math.sin(t2) * L, g2 = heightAt(x2, z2); if (Number.isFinite(g2)) need = Math.max(need, g2 - .3 * R - (py - Math.cos(t2) * L - R)); } } // would plough the ground
        else if (i < 5 && blocked(x, y, z, level >= 1 ? R * .6 : R * T.bite * .85, skip)) bad = 'arc-building';     // another building in the way (its damage reach)
        else if (Math.hypot(x - bx, z - bz) < T.footprint + R * .8 && y < fp.y + 9 + R) bad = 'arc-crane';         // would hit its own crane
        else if (i < 3 && blocked(x, y, z, R * .3)) pen += i ? 2.5 : 6;                                              // held / starts inside the target's box
      }
      if (!bad && view) {
        const hx = px + wx * Math.sin(pl) * L, hy = py - Math.cos(pl) * L, hz = pz + wz * Math.sin(pl) * L, pB = [...view.project(hx, hy, hz)];
        // nearer = pulled toward the lens on the ground plan (the held ball is always higher than the wall point, so depth would
        // count the lift as 'nearer' from an elevated camera)
        const hdB = Math.hypot(hx - view.cx, hz - view.cz), hdI = Math.hypot(I.x - view.cx, I.z - view.cz);
        const cov = pB[2] ? Math.PI * (R * view.p0 / pB[3]) * (R * view.p5 / pB[3]) / 4 : 1, closer = !pB[2] || hdB < hdI - Math.max(2 * R, .08 * hdI);
        if (level < 2 && (closer || cov > T.coverMax)) bad = closer ? 'cam-near' : 'cam-big';
        else { pen += off(pB) * 2.4 + (closer ? 6 : 0) + Math.max(0, cov - T.coverMax) * 40 - Math.min(.6, Math.hypot(pB[0] - ix, pB[1] - iy)) * 1.2; if (pen < best) { cover = cov; nearer = closer; } }
      }
      if (bad) { no(bad); if (bad === 'arc-ground') lift = Math.min(lift, need); continue; }
      const hx = px + wx * Math.sin(pl) * L, hy = py - Math.cos(pl) * L, hz = pz + wz * Math.sin(pl) * L;
      // tag line from the crane to the held ball should not cross other buildings
      for (let i = 1; i < 6; i++) { const t = i / 6; if (blocked(bx + (hx - bx) * t, fp.y + 3 + (hy - fp.y - 3) * t, bz + (hz - bz) * t, .3, skip)) { pen += .8; break; } }
      if (pen < best) { best = pen; pullUsed = pl; }
    }
    if (best === Infinity) return null;
    let score = fp.slope * .25 + fp.soft * .5 + (fp.knock?.length || 0) * 1.5 + best + view0 + Math.abs(luff - 60 * DEG) * 1.2;
    if (current) score += Math.hypot(bx - current.x, bz - current.z) * .015;
    return { x: bx, y: fp.y, z: bz, yaw, pitch: fp.pitch, roll: fp.roll, slope: fp.slope, clear: fp.clear, knock: fp.knock || [], pivot: { x: px, y: py, z: pz }, w: { x: wx, z: wz }, side, plane: a, pull: pullUsed, L, reach, luff, score, level, cover, nearer };
  }
  // candidates: crane spots on a polar grid around the wall point (direction c off the wall normal, both sides, and distance),
  // each with the swing planes a < c (the crane stands further round toward the wall line than the ball is pulled back).
  // The last level also tries planes nearly along the wall, spots past the wall line (building corners) and a shorter cable
  // (a narrower arc for alleys).
  // planes past 68 degrees graze along the wall (little bite): only for the relaxed level
  const PLANES = [60, 68, 52, 45, 38, 30].map(d => d * DEG), PLANES3 = [...PLANES, 76 * DEG, 84 * DEG], CRANES = [], CRANES3 = [], DISTS = [];
  // up to 176: behind the building, the boom reaching over its roof (where a close camera sees nothing beside the wall)
  for (let d = 24; d <= 176; d += 8) CRANES.push(d * DEG);
  for (let d = 24; d <= 176; d += 8) CRANES3.push(d * DEG);
  for (let r = 11; r <= 62; r += 4.25) DISTS.push(r);
  // Best crane spot for a swing into I with outward wall normal n (horizontal unit). Returns a candidate or null.
  function plan(I, n, { L = T.cable, R = T.ballRadius, pull = T.pull * DEG, skip = null, view = null, current = null, top = Infinity } = {}) {
    const opts = { L, R, pull, skip, level: 0, view, current };
    let best = null; const strict = [], loose = [], pre = [];   // levels 0-2 share the strict footprints and spot checks
    for (const level of [0, 1, 2, 3]) {
      opts.level = level;
      for (const cable of level >= 3 ? [L, L * T.shortCable] : [L]) {
        opts.L = cable; let k = 0;
        for (const side of [1, -1]) for (const c of level >= 3 ? CRANES3 : CRANES) for (const r of DISTS) {
          const d = side * c, dx = n.x * Math.cos(d) + n.z * Math.sin(d), dz = -n.x * Math.sin(d) + n.z * Math.cos(d);
          const bx = I.x + dx * r, bz = I.z + dz * r, slot = k++;
          let fp, sp;
          if (level < 3) {
            if (level === 0) { fp = strict[slot] = footprint(bx, bz, Math.atan2(I.x - bx, I.z - bz), false); pre[slot] = fp ? (spotCheck(I, bx, bz, fp, cable, skip) ? { ...spotOut } : null) : null; }
            else fp = strict[slot];
            sp = pre[slot];
          } else {
            fp = cable === L ? (loose[slot] = footprint(bx, bz, Math.atan2(I.x - bx, I.z - bz), true)) : loose[slot];
            sp = fp && spotCheck(I, bx, bz, fp, cable, skip) ? { ...spotOut } : null;
          }
          if (!fp || !sp) continue;
          // the ball is pulled back on the crane's side (plane a < c) or, for a crane standing out in front (where a close
          // camera still sees it), across to the other side of the boom - either way sideways to the screen when possible
          for (const ps of [side, -side]) for (const a of level >= 3 ? PLANES3 : PLANES) {
            if (ps === side ? a > c - 8 * DEG : c > 70 * DEG) continue;
            let cand = evaluate(I, n.x, n.z, ps, a, bx, bz, opts, fp, sp);
            // a slope rising on the pull-back side: swing in a little higher up the wall (never above its top)
            if (!cand && lift < Infinity && lift <= T.liftMax && I.y + lift + .3 <= top - R * .6) { const up = lift + .3; cand = evaluate({ x: I.x, y: I.y + up, z: I.z }, n.x, n.z, ps, a, bx, bz, opts, fp); if (cand) { cand.raised = up; cand.score += up * .25; } }
            if (!cand) continue;
            cand.score += Math.abs(a - 60 * DEG) * .8 + (ps === side ? Math.abs(c - 76 * DEG) * .6 : .6) + Math.max(0, r - 30) * .03 + level * 6 + (cable < L ? 2 : 0);
            if (!best || cand.score < best.score) best = cand;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }
  // Keep the parked crane where it is (only the house slews) if it can swing into I from there (strict and camera rules).
  function stay(I, n, cur, { L = T.cable, R = T.ballRadius, pull = T.pull * DEG, skip = null, view = null, top = Infinity } = {}) {
    const bx = cur.x, bz = cur.z, ex = bx - I.x, ez = bz - I.z, l = Math.hypot(ex, ez) || 1;
    const cross = n.x * ez - n.z * ex, dot = (n.x * ex + n.z * ez) / l, side = cross > 0 ? -1 : 1, ang = Math.acos(clamp(dot, -1, 1));
    if (ang < 20 * DEG || ang > 120 * DEG) return null;
    let best = null; const opts = { L, R, pull, skip, level: 1, view, current: null };
    for (const ps of [side, -side]) for (const a of PLANES) { if (ps === side ? a >= ang - 8 * DEG : ang > 70 * DEG) continue; const c = evaluate(I, n.x, n.z, ps, a, bx, bz, opts); if (c && (!best || c.score < best.score)) best = c; }
    if (!best && lift < Infinity && lift <= T.liftMax && I.y + lift + .3 <= top - R * .6) for (const a of PLANES) { if (a >= ang - 8 * DEG) continue; const c = evaluate({ x: I.x, y: I.y + lift + .3, z: I.z }, n.x, n.z, side, a, bx, bz, opts); if (c && (!best || c.score < best.score)) { best = c; c.raised = lift + .3; } }
    return best;
  }
  return { plan, stay, evaluate, footprint, drivable, drivableRun, approach, blocked, blockedProtected, inBox, why, get obstacleCount() { return obstacles.length; } };
}

// Scenery that stands on the ground (trees, lamps, benches, bollards ...): every mesh / instance in the campus group outside
// the building models that is taller than ~2 m and smaller than 18 units across. Instanced ones can be knocked over (k).
// `parts` (with `out.parts`) also lists every instanced piece taller than 0.6 (crowns, lobes, lamp heads) for the knockdown.
export function collectObstacles(THREE, campus, extraSkip = []) {
  const out = [], parts = [], skip = new Set([...campus.entries.map(e => e.model.group), ...extraSkip]), m = new THREE.Matrix4(), im = new THREE.Matrix4(), c = new THREE.Vector3(), h = new THREE.Vector3();
  campus.group.updateMatrixWorld(true);
  const visit = o => {
    if (skip.has(o)) return;
    if (o.isMesh && o.geometry?.attributes?.position && o.visible !== false) {
      const geo = o.geometry; if (!geo.boundingBox) geo.computeBoundingBox(); const bb = geo.boundingBox;
      bb.getCenter(c); bb.getSize(h).multiplyScalar(.5);
      const cx = c.x, cy = c.y, cz = c.z, hx = h.x, hy = h.y, hz = h.z;
      const one = (M, i) => {
        const e = M.elements; if (Math.abs(M.determinant()) < 1e-9) return;
        const wx = e[0] * cx + e[4] * cy + e[8] * cz + e[12], wy = e[1] * cx + e[5] * cy + e[9] * cz + e[13], wz = e[2] * cx + e[6] * cy + e[10] * cz + e[14];
        const ex = Math.abs(e[0]) * hx + Math.abs(e[4]) * hy + Math.abs(e[8]) * hz, ey = Math.abs(e[1]) * hx + Math.abs(e[5]) * hy + Math.abs(e[9]) * hz, ez = Math.abs(e[2]) * hx + Math.abs(e[6]) * hy + Math.abs(e[10]) * hz;
        if (Math.max(ex, ez) > 9) return;
        if (i >= 0 && ey * 2 >= .6 && ey * 2 < 16) parts.push({ mesh: o, i, x: wx, z: wz, bottom: wy - ey, top: wy + ey });
        if (ey * 2 < 1.1) return;
        out.push({ x: wx, z: wz, r: clamp(Math.min(ex, ez) * .9, .3, 4), k: i >= 0 });
      };
      if (o.isInstancedMesh) for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, im); one(m.multiplyMatrices(o.matrixWorld, im), i); }
      else one(o.matrixWorld, -1);
    }
    for (const ch of o.children) visit(ch);
  };
  visit(campus.group);
  out.parts = parts;
  return out;
}

export function buildingBoxes(THREE, entries) {
  const inv = new THREE.Matrix4(), s = new THREE.Vector3();
  return entries.filter(e => !e.cleared && e.model?.group && e.model.bounds).map(e => {
    e.model.group.updateWorldMatrix(true, false); inv.copy(e.model.group.matrixWorld).invert(); s.setFromMatrixScale(e.model.group.matrixWorld);
    const b = e.model.bounds; return { id: e.id, inv: [...inv.elements], min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z], scale: Math.max(1e-6, Math.max(s.x, s.y, s.z)) };
  });
}

// ---------- sound (WebAudio synthesis into the game's comic-audio master; same bus level as the bowling ball) ----------
export function createWreckAudio({ output = () => null, heavy = null, lite = false, idle = 1 } = {}) {
  let ctx = null, bus = null, brown = null, white = null, voices = 0;
  const MAX = lite ? 26 : 44, rnd = (a, b) => a + Math.random() * (b - a);
  function ready() {
    const out = output(); if (!out?.context || !out.destination) return null;
    if (out.context !== ctx) {
      ctx = out.context; voices = 0;
      try {
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
        bus = ctx.createGain(); bus.gain.value = .7; bus.connect(comp).connect(out.destination);
        brown = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate); { const d = brown.getChannelData(0); let l = 0, top = 0; for (let i = 0; i < d.length; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l; top = Math.max(top, Math.abs(l)); } for (let i = 0; i < d.length; i++) d[i] /= top || 1; }
        white = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); { const d = white.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      } catch { ctx = null; bus = null; return null; }
    }
    return ctx;
  }
  const track = s => { voices++; s.onended = () => { voices = Math.max(0, voices - 1); }; };
  function noise(buf, dur, peak, type, f0, f1, q = 1, delay = 0, att = .004) {
    if (!ctx || voices >= MAX) return;
    try {
      const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = buf; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + att + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + att + dur);
      s.connect(f).connect(g).connect(bus); track(s); s.start(t, Math.random() * Math.max(0, buf.duration - dur - .2)); s.stop(t + att + dur + .05);
    } catch {}
  }
  function tone(type, f0, f1, dur, peak, delay = 0, att = .005) {
    if (!ctx || voices >= MAX) return;
    try {
      const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + att + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + att + dur);
      o.connect(g).connect(bus); track(o); o.start(t); o.stop(t + att + dur + .05);
    } catch {}
  }
  // steel cable strain: a slow wobbly saw through a narrow band
  function creak(dur = .6, k = 1, delay = 0) {
    if (!ctx || voices >= MAX - 2) return;
    try {
      const t = ctx.currentTime + delay, o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(rnd(86, 104), t); o.frequency.linearRampToValueAtTime(rnd(66, 80), t + dur);
      lfo.frequency.value = rnd(5, 9); lg.gain.value = 7; lfo.connect(lg).connect(o.frequency);
      f.type = 'bandpass'; f.frequency.value = rnd(600, 900); f.Q.value = 9;
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.085 * k, t + dur * .3); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(f).connect(g).connect(bus); track(o); o.start(t); lfo.start(t); o.stop(t + dur + .05); lfo.stop(t + dur + .05);
    } catch {}
  }
  const cues = {
    chain(k = 1, dur = .45, delay = 0) { for (let i = 0, n = Math.round((lite ? 7 : 11) * k); i < n; i++) { const d = delay + Math.pow(Math.random(), 1.3) * dur, f = rnd(2300, 5600); noise(white, .02, .09 * k, 'bandpass', f, f * .92, 10, d, .001); if (Math.random() < .5) tone('triangle', rnd(1500, 3000), rnd(1100, 2200), .05, .02 * k, d, .001); } },
    winch(dur = .45) { tone('sawtooth', 62, 104, dur, .045, 0, .05); noise(white, dur, .025, 'bandpass', 900, 1500, 3, 0, .05); cues.chain(.55, dur); },
    creak(dur = .55, k = 1) { creak(dur, k); },
    snap() { tone('square', 1900, 800, .04, .05); noise(white, .05, .1, 'highpass', 3000, 2500, .7); cues.chain(.7, .25, .02); },
    whoosh(dur = .55, k = 1) { noise(white, dur * .55, .2 * k, 'bandpass', 220, 1100, 1.1, 0, dur * .45); noise(brown, dur * .6, .26 * k, 'lowpass', 160, 380, .8, 0, dur * .4); },
    crunch(k = 1) { const a = clamp(k, .2, 1.3); noise(brown, .32, .42 * a, 'lowpass', 900, 160, .9); for (let i = 0; i < 3; i++) { const f = rnd(300, 1400); noise(white, .11, .15 * a, 'bandpass', f, f * .7, 1.8, i * .03 + rnd(0, .02)); } },
    // the slam: the bazooka body under a sub drop, rubble crunch and a ringing steel ball (inharmonic partials, slow decay)
    slam(k = 1) {
      heavy?.play('boom', clamp(.8 + k * .35, .8, 1.5)); tone('sine', 50, 22, .9, .6 * k); noise(brown, .6, .55 * k, 'lowpass', 520, 80, .8); cues.crunch(k);
      tone('triangle', 410, 300, .55, .1); tone('sine', 1240, 1120, .9, .05); tone('sine', 1870, 1700, .7, .03); tone('sine', 2730, 2600, .5, .018); cues.chain(1, .6, .05);
    },
    // ball on the protected-building shield: brighter ring, no crunch (the host plays the shield "ting")
    clang(k = 1) { tone('triangle', 520, 380, .45, .12 * k); tone('sine', 1560, 1500, .8, .05 * k); tone('sine', 2340, 2280, .6, .03 * k); noise(white, .05, .18 * k, 'bandpass', 2400, 1800, 2, 0, .001); cues.chain(.8, .45, .04); },
    land(k = 1) { const a = clamp(k, .3, 1.3); tone('sine', 72, 30, .45, .5 * a); noise(brown, .4, .5 * a, 'lowpass', 500, 90, .8); noise(white, .07, .14 * a, 'bandpass', 1300, 700, 1.4); cues.chain(.6, .3, .03); },
    lift() { noise(white, .3, .1, 'bandpass', 300, 1200, 1.2, 0, .12); tone('sawtooth', 70, 120, .3, .03, 0, .05); },
    // a tree / lamp pushed over: a woody crack and a rustle
    timber() { noise(white, .05, .16, 'bandpass', 1800, 900, 2, 0, .001); noise(brown, .35, .22, 'lowpass', 700, 150, .8, .03); noise(white, .5, .06, 'bandpass', 3200, 2400, .8, .08, .05); },
    // the rope snapping taut after going slack: a twang and a chain clank
    jerk(k = 1) { tone('triangle', 180, 120, .25, .08 * k); tone('sine', 640, 600, .3, .03 * k); cues.chain(.8 * k, .25); },
    drive(dur = .4) { for (let i = 0, n = Math.round(dur * 22); i < n; i++) { const d = i / 22 + rnd(0, .02); noise(white, .03, .05, 'bandpass', rnd(900, 1600), 700, 3, d, .002); noise(brown, .05, .08, 'lowpass', 300, 120, .8, d); } },
  };
  // diesel idle: two detuned oscillators through a low-pass with a chugging amplitude LFO; rev raises pitch / brightness
  function engine() {
    if (!ready()) return null;
    try {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), am = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), out = ctx.createGain(), g2 = ctx.createGain();
      o1.type = 'sawtooth'; o1.frequency.value = 32; o2.type = 'square'; o2.frequency.value = 64; g2.gain.value = .25;
      lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 2; am.gain.value = .6; lfo.type = 'square'; lfo.frequency.value = 9; lg.gain.value = .35; lfo.connect(lg).connect(am.gain);
      out.gain.value = 0; o1.connect(lp); o2.connect(g2).connect(lp); lp.connect(am).connect(out).connect(bus); o1.start(); o2.start(); lfo.start();
      let stopped = false; const myCtx = ctx;
      return {
        set(level, rev = 0) { if (stopped) return; const t = myCtx.currentTime; out.gain.setTargetAtTime(.075 * idle * level, t, .1); o1.frequency.setTargetAtTime(30 + rev * 18, t, .12); o2.frequency.setTargetAtTime(60 + rev * 36, t, .12); lfo.frequency.setTargetAtTime(8 + rev * 8, t, .12); lp.frequency.setTargetAtTime(240 + rev * 260, t, .1); },
        stop() { if (stopped) return; stopped = true; const t = myCtx.currentTime; out.gain.setTargetAtTime(0, t, .08); for (const s of [o1, o2, lfo]) { try { s.stop(t + .6); } catch {} } },
        get context() { return myCtx; },
      };
    } catch { return null; }
  }
  return { play(id, a, b, c) { if (!ready() || !cues[id]) return false; cues[id](a, b, c); return true; }, engine, get voices() { return voices; }, get live() { return !!output(); } };
}

// ---------- the weapon ----------
export function createWreckingBall(THREE, scene, camera, {
  campus, protectedSet = null, tuning = WEAPON_TUNING.wreckingBall, reducedMotion = false, mobile = false,
  output = () => null, heavyAudio = null, pixelRatio = () => 1,
  onDamage = () => {}, onSlam = () => {}, onShield = () => {}, onKick = () => {},
} = {}) {
  const T = tuning, V3 = THREE.Vector3, heightAt = (x, z) => campus.terrain.heightAt(x, z);
  const audio = createWreckAudio({ output, heavy: heavyAudio, lite: mobile, idle: T.idle });
  const rnd = (a, b) => a + Math.random() * (b - a);
  const owned = [], own = o => (owned.push(o), o);
  const entries = campus.entries, UP = new V3(0, 1, 0);
  const pieceWeight = campus.totalWeight / Math.max(1, entries.reduce((s, e) => s + (e.model.pieces?.length || 0), 0));
  const tA = new V3(), tB = new V3(), tC = new V3(), tD = new V3(), tQ = new THREE.Quaternion(), tM = new THREE.Matrix4(), tS = new V3(), ZAX = new V3(0, 0, 1), YAX = new V3(0, 1, 0);

  // ---------- placement data ----------
  let obstacles = null; // trees / lamps etc., read on first use (the weapon picked or the first tap), not at boot
  const siteRings = (protectedSet?.sites || []).map(s => ({ ring: s.ring, minX: s.box.min.x, maxX: s.box.max.x, minZ: s.box.min.z, maxZ: s.box.max.z }));
  const playBox = new THREE.Box3(); for (const e of entries) playBox.union(e.worldBounds); for (const s of protectedSet?.sites || []) playBox.union(s.box);
  const G = campus.terrain.grid;
  const area = { minX: playBox.min.x - 34, maxX: playBox.max.x + 34, minZ: playBox.min.z - 34, maxZ: playBox.max.z + 34 };
  if (G) { area.minX = Math.max(area.minX, G.minX + 8); area.minZ = Math.max(area.minZ, G.minZ + 8); area.maxX = Math.min(area.maxX, G.minX + G.step * (G.nx - 1) - 8); area.maxZ = Math.min(area.maxZ, G.minZ + G.step * (G.nz - 1) - 8); }
  let boxes = null, boxesCleared = -1, planner = null;
  // building boxes follow cleared buildings; everything is built lazily so the boot does not pay for it
  function refreshBoxes() {
    if (!obstacles) obstacles = collectObstacles(THREE, campus);
    if (planner && campus.clearedCount === boxesCleared) return;
    boxesCleared = campus.clearedCount; boxes = buildingBoxes(THREE, entries); planner = createCranePlanner({ heightAt, boxes, rings: siteRings, obstacles, area, tuning: T });
  }
  const projV = new V3(), projOut = [0, 0, 0, 0];
  function project(x, y, z) { projV.set(x, y, z).applyMatrix4(camera.matrixWorldInverse); const front = projV.z < -1, depth = -projV.z; projV.set(x, y, z).project(camera); projOut[0] = projV.x; projOut[1] = projV.y; projOut[2] = front ? 1 : 0; projOut[3] = depth; return projOut; }

  // ---------- textures (plain JS) ----------
  const nz = (() => { const h = (x, y) => { let n = (x * 374761393 + y * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }; return h; })();
  const vn = (x, y, f) => { const xi = Math.floor(x * f), yi = Math.floor(y * f), xf = x * f - xi, yf = y * f - yi, sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf), w = f; const h = (i, j) => nz(((i % w) + w) % w, j); return h(xi, yi) * (1 - sx) * (1 - sy) + h(xi + 1, yi) * sx * (1 - sy) + h(xi, yi + 1) * (1 - sx) * sy + h(xi + 1, yi + 1) * sx * sy; };
  const rustTex = dataTexture(THREE, 128, 64, (u, v, x, y) => {
    const grain = nz(x, y + 77), cloud = vn(u, v, 6) * .6 + vn(u, v, 14) * .4;
    const rust = Math.max(0, vn(u + .37, v, 10) - .62) * 2.6 * (.5 + .5 * vn(u, v, 40)), scuff = Math.max(0, vn(u, v * 3, 90) - .8) * 2.2;
    const base = 46 + cloud * 22 + grain * 10 + scuff * 34;
    return [base + rust * 42, base + rust * 18, base + rust * 4 + 3];
  }, own);
  const soft = dataTexture(THREE, 64, 64, (u, v) => { const r = Math.hypot(u * 2 - 1, v * 2 - 1), a = Math.max(0, 1 - r); return [0, 0, 0, Math.round(Math.min(1, a * a * 1.6) * 210)]; }, own, false);
  const glow = dataTexture(THREE, 64, 64, (u, v) => { const r = Math.hypot(u * 2 - 1, v * 2 - 1), a = Math.max(0, 1 - r); return [255, 236, 200, Math.round(a * a * 255)]; }, own);
  const crack = dataTexture(THREE, 96, 96, (u, v, x, y) => {
    const dx = u * 2 - 1, dy = v * 2 - 1, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx), spoke = Math.pow(Math.abs(Math.sin(a * 5.5 + nz(Math.round(r * 9), 3) * 2)), 18) * (r < .85 ? 1 : 0) * (1 - r);
    const dark = Math.max(0, .55 - r) * 1.1 + spoke * .9; return [40, 32, 24, Math.round(Math.min(1, dark) * 220)];
  }, own, false);
  const ringTex = dataTexture(THREE, 64, 64, (u, v) => { const r = Math.hypot(u * 2 - 1, v * 2 - 1), a = Math.max(0, 1 - Math.abs(r - .78) / .2); return [255, 248, 232, Math.round(a * a * 230 * (r < 1 ? 1 : 0))]; }, own);
  for (const t of [soft, glow, crack, ringTex]) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }

  // ---------- crane + ball ----------
  const C = buildCrane(THREE, own); C.root.visible = false; scene.add(C.root);
  const BOOM_MAX = 260, unitBox = own(new THREE.BoxGeometry(1, 1, 1));
  const boomMat = own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .6, metalness: 0 }));
  const boom = new THREE.InstancedMesh(unitBox, boomMat, BOOM_MAX); boom.count = 0; boom.frustumCulled = false; boom.visible = false;
  boom.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BOOM_MAX * 3), 3); scene.add(boom);
  const chordCol = new THREE.Color('#f2b51e'), laceCol = new THREE.Color('#d39a14'), headCol = new THREE.Color('#2f3134');
  const cableMat = own(new THREE.MeshStandardMaterial({ color: '#1f2123', roughness: .55, metalness: 0 }));
  const cylZ = own(new THREE.CylinderGeometry(1, 1, 1, 6).rotateX(Math.PI / 2));
  const line = () => { const m = new THREE.Mesh(cylZ, cableMat); m.frustumCulled = false; m.visible = false; scene.add(m); return m; };
  const pendL = line(), pendR = line(), tag = line(), ropeUp = line();
  const hangSeg = new THREE.InstancedMesh(cylZ, cableMat, 8); hangSeg.frustumCulled = false; hangSeg.visible = false; scene.add(hangSeg);
  const steelMat = own(new THREE.MeshStandardMaterial({ color: '#8e979d', roughness: .42, metalness: 0 }));
  const hook = new THREE.Group(); hook.visible = false; scene.add(hook);
  { const yel = own(new THREE.MeshStandardMaterial({ color: '#f2b51e', roughness: .6, metalness: 0 })), dark = own(new THREE.MeshStandardMaterial({ color: '#2c2e31', roughness: .8, metalness: 0 }));
    const a = new THREE.Mesh(own(new THREE.BoxGeometry(1.1, 1.4, .7)), yel); hook.add(a); const b = new THREE.Mesh(own(new THREE.BoxGeometry(1.14, .32, .74)), dark); b.position.y = -.42; hook.add(b);
    const s = new THREE.Mesh(own(new THREE.CylinderGeometry(.42, .42, .8, 14).rotateZ(Math.PI / 2)), dark); s.position.y = .28; hook.add(s);
    const sh = new THREE.Mesh(own(new THREE.TorusGeometry(.28, .09, 8, 14, Math.PI * 1.3)), steelMat); sh.position.y = -.82; sh.rotation.z = Math.PI * .85; hook.add(sh); }
  const LINKS = 8, chain = new THREE.InstancedMesh(own(new THREE.TorusGeometry(1, .26, 6, 12)), steelMat, LINKS); chain.frustumCulled = false; chain.visible = false; scene.add(chain);
  const ballMat = own(new THREE.MeshStandardMaterial({ map: rustTex, roughness: .5, metalness: 0, color: '#d8d8d8' }));
  const ball = new THREE.Mesh(own(new THREE.SphereGeometry(1, mobile ? 28 : 40, mobile ? 18 : 28)), ballMat); ball.visible = false; ball.frustumCulled = false; scene.add(ball);
  { const eye = new THREE.Mesh(own(new THREE.TorusGeometry(.26, .08, 8, 16)), steelMat); eye.position.y = 1.04; ball.add(eye); const lug = new THREE.Mesh(own(new THREE.CylinderGeometry(.2, .3, .16, 12)), steelMat); lug.position.y = .97; ball.add(lug);
    const seam = new THREE.Mesh(own(new THREE.TorusGeometry(1.002, .018, 4, 48)), own(new THREE.MeshStandardMaterial({ color: '#3a3c3e', roughness: .7, metalness: 0 }))); seam.rotation.x = Math.PI / 2; ball.add(seam); }

  // ground-hugging patches: crane shadow, ball shadow, landing cracks, shock rings
  function groundPatch(tex, segs, { opacity = 1, offset = -4, additive = false, color = '#ffffff' } = {}) {
    const geo = own(new THREE.PlaneGeometry(1, 1, segs, segs)); geo.rotateX(-Math.PI / 2);
    const mat = own(new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, depthWrite: false, opacity, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset, ...(additive ? { blending: THREE.AdditiveBlending } : {}) }));
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.visible = false;
    const base = Float32Array.from(geo.attributes.position.array); mesh.userData.born = -1e9;
    mesh.userData.place = (x, z, sx, sz, yaw = 0, lift = .08) => {
      const a = geo.attributes.position.array, c = Math.cos(yaw), s = Math.sin(yaw);
      for (let i = 0; i < a.length; i += 3) { const lx = base[i] * sx, lz = base[i + 2] * sz, wx = x + lx * c + lz * s, wz = z - lx * s + lz * c; a[i] = wx; a[i + 1] = heightAt(wx, wz) + lift; a[i + 2] = wz; }
      geo.attributes.position.needsUpdate = true;
    };
    scene.add(mesh); return mesh;
  }
  const craneShadow = groundPatch(soft, 8, { opacity: .55 }), ballShadow = groundPatch(soft, 6, { opacity: .45 });
  const cracks = Array.from({ length: 3 }, () => groundPatch(crack, 8, { offset: -3 })), rings = Array.from({ length: 3 }, () => groundPatch(ringTex, 12, { offset: -5 }));
  const oldest = list => { let o = list[0]; for (const m of list) if (m.userData.born < o.userData.born) o = m; return o; };
  function crackAt(x, z, size, now) { const d = oldest(cracks); d.userData.place(x, z, size, size, rnd(0, 6.28), .07); d.userData.born = now; d.material.opacity = 1; d.visible = true; }
  function shock(x, z, size, now) { const g = oldest(rings); g.userData.born = now; g.userData.x = x; g.userData.z = z; g.userData.size = size; g.visible = true; }

  // ---------- particles: dust / exhaust (soft, normal blend) and sparks (additive) ----------
  const ATTRS = ['position', 'size', 'alpha', 'tint'];
  function createPoints(max, additive) {
    const geo = own(new THREE.BufferGeometry()), pos = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max), tint = new Float32Array(max * 3);
    const vel = new Float32Array(max * 3), age = new Float32Array(max), life = new Float32Array(max), grow = new Float32Array(max), a0 = new Float32Array(max), drag = new Float32Array(max), lift = new Float32Array(max);
    for (const [k, a, n] of [['position', pos, 3], ['size', size, 1], ['alpha', alpha, 1], ['tint', tint, 3]]) geo.setAttribute(k, new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage));
    const mat = own(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, ...(additive ? { blending: THREE.AdditiveBlending } : {}), uniforms: { uScale: { value: 400 } },
      vertexShader: 'attribute float size, alpha; attribute vec3 tint; uniform float uScale; varying float vA; varying vec3 vC; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv; gl_PointSize = min(512., size * uScale / max(.5, -mv.z)); vA = alpha; vC = tint; }',
      fragmentShader: additive
        ? 'varying float vA; varying vec3 vC; void main(){ vec2 q = gl_PointCoord * 2. - 1.; float d = dot(q,q); if (d > 1.) discard; float a = (1. - d); a *= a; gl_FragColor = vec4(vC * a * vA, a * vA); }'
        : 'varying float vA; varying vec3 vC; void main(){ vec2 q = gl_PointCoord * 2. - 1.; float d = dot(q,q); if (d > 1.) discard; float n = fract(sin(dot(floor(gl_PointCoord * 6.), vec2(12.9898,78.233))) * 43758.5453); float a = (1. - d); a = a * a * (.82 + .18 * n); gl_FragColor = vec4(vC * (.92 + .08 * (1. - q.y)), a * vA); }' }));
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 4; scene.add(pts);
    let n = 0, drawn = -1;
    function spawn(x, y, z, vx, vy, vz, s, g, l, a, r, gg, b, dr = 1.6, up = .8) {
      const i = n < max ? n++ : (Math.random() * max) | 0;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz; size[i] = s; grow[i] = g; life[i] = l; age[i] = 0; a0[i] = a; alpha[i] = 0; drag[i] = dr; lift[i] = up;
      tint[i * 3] = r; tint[i * 3 + 1] = gg; tint[i * 3 + 2] = b;
    }
    function copy(d, s) {
      for (let k = 0; k < 3; k++) { pos[d * 3 + k] = pos[s * 3 + k]; vel[d * 3 + k] = vel[s * 3 + k]; tint[d * 3 + k] = tint[s * 3 + k]; }
      size[d] = size[s]; grow[d] = grow[s]; life[d] = life[s]; age[d] = age[s]; a0[d] = a0[s]; alpha[d] = alpha[s]; drag[d] = drag[s]; lift[d] = lift[s];
    }
    function update(dt) {
      if (!n && !drawn) return;
      if (dt > 0) for (let i = 0; i < n; i++) {
        age[i] += dt; if (age[i] >= life[i]) { copy(i, --n); i--; continue; }
        const k = Math.exp(-drag[i] * dt); vel[i * 3] *= k; vel[i * 3 + 1] = vel[i * 3 + 1] * k + lift[i] * dt; vel[i * 3 + 2] *= k;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; size[i] += grow[i] * dt;
        const t = age[i] / life[i]; alpha[i] = a0[i] * Math.min(1, age[i] * (additive ? 40 : 10)) * Math.pow(1 - t, 1.4);
      }
      geo.setDrawRange(0, n); drawn = n; for (const k of ATTRS) geo.attributes[k].needsUpdate = true;
    }
    return { points: pts, spawn, update, clear() { n = 0; geo.setDrawRange(0, 0); drawn = 0; }, get count() { return n; } };
  }
  const dust = createPoints(mobile ? T.dustPhone : T.dust, false), sparks = createPoints(mobile ? T.sparksPhone : T.sparks, true);

  // flying chunks (look only; the real pieces fly inside campus.hit)
  const CH = mobile ? T.chunksPhone : T.chunks;
  const chunkMesh = new THREE.InstancedMesh(unitBox, own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .92, metalness: 0 })), CH);
  chunkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); chunkMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CH * 3), 3); chunkMesh.frustumCulled = false; chunkMesh.count = 0; scene.add(chunkMesh);
  const chunkColors = ['#a59d8e', '#8c8478', '#b9ab95', '#6f6a62', '#c4b8a4', '#7b6a58'].map(c => new THREE.Color(c));
  const chunks = Array.from({ length: CH }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 2, s: 1, ax: 0, ay: 1, az: 0, spin: 0, ang: 0, bounced: 0, color: 0 }));
  let chunkNext = 0;
  function addChunk(x, y, z, vx, vy, vz, s) {
    const c = chunks[chunkNext++ % CH];
    c.on = true; c.x = x; c.y = y; c.z = z; c.vx = vx; c.vy = vy; c.vz = vz; c.age = 0; c.life = rnd(1.6, 2.6); c.s = s; c.spin = rnd(4, 12); c.ang = rnd(0, 6.28); c.bounced = 0; c.color = (Math.random() * chunkColors.length) | 0;
    c.ax = rnd(-1, 1); c.ay = rnd(-1, 1); c.az = rnd(-1, 1); const l = Math.hypot(c.ax, c.ay, c.az) || 1; c.ax /= l; c.ay /= l; c.az /= l;
  }
  function updateChunks(dt) {
    let n = 0;
    for (const c of chunks) {
      if (!c.on) continue;
      if (dt > 0) {
        c.age += dt; if (c.age >= c.life) { c.on = false; continue; }
        c.vy -= 24 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.ang += c.spin * dt;
        const gy = heightAt(c.x, c.z) + c.s * .4;
        if (c.y < gy) { c.y = gy; if (c.bounced++ < 2 && c.vy < -3) { c.vy *= -.3; c.vx *= .55; c.vz *= .55; c.spin *= .5; if (c.bounced === 1) dust.spawn(c.x, gy, c.z, 0, 1, 0, c.s * 1.6, c.s * 2, .9, .45, .78, .73, .66, 2, .4); } else { c.vx *= .8; c.vz *= .8; c.vy = 0; c.spin *= .8; } }
      }
      const fade = Math.min(1, (c.life - c.age) / .4);
      tQ.setFromAxisAngle(tC.set(c.ax, c.ay, c.az), c.ang);
      chunkMesh.setColorAt(n, chunkColors[c.color]); chunkMesh.setMatrixAt(n++, tM.compose(tD.set(c.x, c.y, c.z), tQ, tS.set(c.s * fade, c.s * .8 * fade, c.s * .9 * fade)));
    }
    chunkMesh.count = n; if (n) { chunkMesh.instanceMatrix.needsUpdate = true; chunkMesh.instanceColor.needsUpdate = true; }
  }
  // additive flash over the slam (drawn over the wall it is in)
  const flashes = Array.from({ length: 2 }, () => { const m = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: glow, color: '#fff1cf', transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }))); m.visible = false; m.renderOrder = 6; m.userData = { age: 0, life: .3, s0: 1, s1: 2, peak: 1 }; scene.add(m); return m; });
  let flashNext = 0;
  function flash(x, y, z, s0, s1, life, peak) { const m = flashes[flashNext++ % flashes.length]; m.position.set(x, y, z); const u = m.userData; u.age = 0; u.life = life; u.s0 = s0; u.s1 = s1; u.peak = peak; m.visible = true; }
  function updateFlashes(dt) { for (const m of flashes) { if (!m.visible) continue; const u = m.userData; u.age += dt; const k = u.age / u.life; if (k >= 1) { m.visible = false; continue; } m.scale.setScalar(u.s0 + (u.s1 - u.s0) * Math.sqrt(k)); m.material.opacity = u.peak * (1 - k) * (1 - k); } }

  // ---------- held remote (overlay pass, camera space) ----------
  const overlayScene = new THREE.Scene(), overlayCamera = new THREE.PerspectiveCamera();
  overlayCamera.matrixAutoUpdate = false; overlayCamera.matrixWorldAutoUpdate = false;
  const vmRoot = new THREE.Group(); vmRoot.visible = false; overlayScene.add(vmRoot);
  const holder = new THREE.Group(); vmRoot.add(holder);
  vmRoot.add(new THREE.HemisphereLight('#e1edf5', '#4b3430', 1.8));
  { const key = new THREE.DirectionalLight('#ffefd8', 2.4); key.position.set(-2, 3, 3); vmRoot.add(key); key.target = holder; const fill = new THREE.DirectionalLight('#b7d5ef', 1.2); fill.position.set(2, 1, -2); vmRoot.add(fill); fill.target = holder; }
  const RM = buildRemote(THREE, own); holder.add(RM.g);
  RM.g.rotation.set(.95, -.42, .1);
  const camQ = new THREE.Quaternion(), camPos = new V3();
  const vm = { sx: 0, sy: 0, vx: 0, vy: 0, t: 0, press: 0, flick: 0, prevFwd: new V3(0, 0, -1), has: false };
  function poseRemote(dt) {
    const p = camera.projectionMatrix.elements, depth = 2, halfX = depth / p[0], halfY = depth / p[5], F = halfX < halfY ? RM.frameTall : RM.frame;
    camera.getWorldQuaternion(camQ); camera.getWorldPosition(camPos); vmRoot.position.copy(camPos); vmRoot.quaternion.copy(camQ);
    if (dt > 0) {
      tA.copy(vm.prevFwd).applyQuaternion(tQ.copy(camQ).invert());
      if (vm.has && !reducedMotion) { vm.vx += clamp(tA.x, -.3, .3) * 5 * 60 * dt; vm.vy += clamp(tA.y, -.3, .3) * 5 * 60 * dt; }
      vm.prevFwd.set(0, 0, -1).applyQuaternion(camQ); vm.has = true;
      vm.vx += (-55 * vm.sx - 10 * vm.vx) * dt; vm.vy += (-55 * vm.sy - 10 * vm.vy) * dt; vm.sx = clamp(vm.sx + vm.vx * dt, -.15, .15); vm.sy = clamp(vm.sy + vm.vy * dt, -.15, .15); vm.t += dt;
      vm.press = Math.max(0, vm.press - dt * 5); vm.flick = Math.max(0, vm.flick - dt * 3.2);
    }
    const breathe = reducedMotion ? 0 : 1, bob = Math.sin(vm.t * 1.6) * .006 * breathe, push = vm.press * .05;
    holder.position.set((F.x + p[8] + vm.sx * .45) * halfX, (F.y + p[9] + vm.sy * .45 + bob - push * .4) * halfY, -depth);
    holder.scale.setScalar(Math.min(halfX, halfY) * F.s);
    holder.rotation.set(-vm.sy * .5 + push * .6, vm.sx * .6, Math.sin(vm.t * .7) * .012 * breathe - vm.sx * .25);
    // sticks: left drives / slews while the crane moves, right flicks forward at the release
    const moving = MOVING.has(phase);
    const [l, r] = RM.sticks, k = dt > 0 ? 1 - Math.exp(-dt * 16) : 1;
    l.rotation.x += ((moving ? Math.sin(vm.t * 7) * .32 : 0) - l.rotation.x) * k; l.rotation.z += ((moving ? Math.cos(vm.t * 5) * .28 : 0) - l.rotation.z) * k;
    r.rotation.x += ((phase === 'windup' ? .3 : vm.flick > 0 ? -.5 * vm.flick : 0) - r.rotation.x) * k;
    RM.button.position.y = .285 - vm.press * .03;
    const busy = phase !== 'none' && phase !== 'rest' && phase !== 'gone';
    RM.ledMat.color.set(busy ? (Math.sin(vm.t * 18) > 0 ? '#7dff6a' : '#2f4a25') : '#4fd43c');
    vmRoot.updateMatrixWorld(true);
  }

  // ---------- knocked-over trees / lamps (instanced scenery the crane drives into; restored on reset) ----------
  // A knock tips every instanced part standing within 1.8 of the trunk (crown, lobes, lamp head) about the trunk's foot.
  let partGrid = null; const PCELL = 6, pkey = (cx, cz) => cx * 73856093 ^ cz * 19349663;
  const falling = [], fallen = [], invCache = new Map();
  const fM = new THREE.Matrix4(), fR = new THREE.Matrix4(), fR2 = new THREE.Matrix4(), fT = new THREE.Matrix4(), fAxis = new V3();
  function knock(o, awayX, awayZ, now) {
    if (o.down) return; o.down = true; if (!partGrid) { partGrid = new Map(); for (const p of obstacles.parts) { const k = pkey(Math.floor(p.x / PCELL), Math.floor(p.z / PCELL)); let l = partGrid.get(k); if (!l) partGrid.set(k, l = []); l.push(p); } }
    const gy = heightAt(o.x, o.z), dx = o.x - awayX, dz = o.z - awayZ, l = Math.hypot(dx, dz) || 1, fx = dx / l, fz = dz / l;
    for (let cx = Math.floor((o.x - 2) / PCELL); cx <= Math.floor((o.x + 2) / PCELL); cx++) for (let cz = Math.floor((o.z - 2) / PCELL); cz <= Math.floor((o.z + 2) / PCELL); cz++) {
      for (const p of partGrid.get(pkey(cx, cz)) || []) {
        if (p.fall || Math.hypot(p.x - o.x, p.z - o.z) > 1.8 || p.bottom > gy + 9) continue;
        if (!p.base) { p.base = new THREE.Matrix4(); p.mesh.getMatrixAt(p.i, p.base); }
        if (!invCache.has(p.mesh)) invCache.set(p.mesh, p.mesh.matrixWorld.clone().invert());
        p.fall = { t: 0, px: o.x, py: gy, pz: o.z, ax: fz, az: -fx, k: .85 + Math.random() * .3 }; falling.push(p); fallen.push(p);
      }
    }
    knocked++;
    if (Math.random() < .9) for (let i = 0; i < (mobile ? 6 : 10); i++) dust.spawn(o.x + rnd(-1, 1), gy + rnd(.3, 2), o.z + rnd(-1, 1), fx * rnd(1, 4), rnd(.5, 2), fz * rnd(1, 4), 1.4, 2, rnd(.8, 1.4), .45, .64, .66, .5, 2, .4);
    audio.play('timber');
  }
  function updateFalling(dt) {
    for (let j = falling.length - 1; j >= 0; j--) {
      const p = falling[j], f = p.fall; f.t += dt; const k = Math.min(1, f.t / (.6 / f.k)), ang = 1.45 * k * k;
      fAxis.set(f.ax, 0, f.az);
      fM.multiplyMatrices(p.mesh.matrixWorld, p.base);
      fT.makeTranslation(f.px, f.py, f.pz).multiply(fR.makeRotationAxis(fAxis, ang)).multiply(fR2.makeTranslation(-f.px, -f.py, -f.pz));
      fM.premultiply(fT).premultiply(invCache.get(p.mesh));
      p.mesh.setMatrixAt(p.i, fM); p.mesh.instanceMatrix.needsUpdate = true;
      if (k >= 1) falling.splice(j, 1);
    }
  }
  function standAll() {
    falling.length = 0;
    for (const p of fallen) { p.mesh.setMatrixAt(p.i, p.base); p.mesh.instanceMatrix.needsUpdate = true; p.fall = null; }
    fallen.length = 0; if (obstacles) for (const o of obstacles) o.down = false;
  }
  let knocked = 0, knockQueue = [];
  // trees on the drive path / under the final spot fall as the crane reaches them
  function knockAlong(now) {
    for (let j = knockQueue.length - 1; j >= 0; j--) { const o = knockQueue[j]; if (Math.hypot(o.x - cr.base.x, o.z - cr.base.z) < T.footprint + o.r + .5) { knock(o, cr.base.x, cr.base.z, now); knockQueue.splice(j, 1); } }
  }

  // ---------- state ----------
  // Ball: a point mass on an inextensible rope from the boom tip (it can go slack). Held / hauled poses are kinematic.
  const cr = { pull: T.pull * DEG, base: new V3(), y: 0, lowerYaw: 0, pitch: 0, roll: 0, houseYaw: 0, P: new V3(), tip: new V3(), w: new V3(1, 0, 0), L: T.cable, R: T.ballRadius,
    lift: 0, squash: 0, entryId: null, siteId: null, ap: null, trackL: 0, trackR: 0 };
  const bp = new V3(), bv = new V3(), prevB = new V3();
  const from = { base: new V3(), y: 0, lowerYaw: 0, houseYaw: 0, P: new V3(), tip: new V3(), w: new V3(), dir: new V3(), len: 0 };
  const to = { base: new V3(), y: 0, lowerYaw: 0, houseYaw: 0, P: new V3(), w: new V3(), pitch: 0, roll: 0 };
  let phase = 'none', pt = 0, dur = 0, active = false, visible = false, next = null, enterMode = 'drive', slack = false, lastContact = -9;
  let freezeUntil = -1, slowUntil = -1, lastNow = 0, engine = null, engineCheck = 0, exhaustAcc = 0, boomDirty = true, releaseClock = 0;
  const swing = { rec: null, recorded: 0, site: false, id: 0, tapAt: 0, releaseAt: -1, impactAt: -1, hitClock: 0, crunchClock: 0, struck: new Set(), weight: 0, pieces: 0, slams: 0, shield: 0, buildings: [], mode: '', whooshed: false, target: null, contacted: false, plan: null, passed: false, crossings: 0, side: 0, haulStep: 0, jerks: 0 };
  const history = []; let swings = 0, slams = 0, shieldHits = 0, rejected = 0, noSpot = 0, lastPlan = null, departs = 0, departPops = 0, moveLog = null;
  const agg = { count: 0, weight: 0, affected: [], cleared: [] }, aggPoint = new V3(), aggNormal = new V3();
  const HELD = new Set(['settle', 'turn', 'windup']), MOVING = new Set(['enter', 'move', 'turn', 'settle']);

  function setCraneVisible(v) { C.root.visible = v; boom.visible = v; for (const m of [pendL, pendR, ropeUp]) m.visible = v; hangSeg.visible = hook.visible = chain.visible = ball.visible = v; craneShadow.visible = ballShadow.visible = v; if (!v) tag.visible = false; }
  // ground tilt under the tracks at (x, z) with tracks along yaw
  function tilt(x, z, yaw, out) {
    const sy = Math.sin(yaw), cy = Math.cos(yaw), hw = 3.5, hl = 5, h = (a, b) => heightAt(x + cy * a + sy * b, z - sy * a + cy * b);
    const fl = h(-hw, hl), fr = h(hw, hl), bl = h(-hw, -hl), br = h(hw, -hl);
    out.y = (fl + fr + bl + br) / 4; out.pitch = Math.atan2((fl + fr) - (bl + br), 4 * hl); out.roll = Math.atan2((fr + br) - (fl + bl), 4 * hw); return out;
  }
  const tl = { y: 0, pitch: 0, roll: 0 };
  // boom tip in the travel pose: boom forward over the cab at 40 degrees, the length it will work at
  const footW = new V3(), carried = new V3();
  function carriedTip(out, len, luff = 40 * DEG) {
    C.root.position.set(cr.base.x, cr.y + cr.lift, cr.base.z); euler.set(-cr.pitch, cr.lowerYaw, cr.roll); C.root.quaternion.setFromEuler(euler);
    C.house.rotation.y = Math.atan2(Math.sin(cr.houseYaw - cr.lowerYaw), Math.cos(cr.houseYaw - cr.lowerYaw)); C.root.updateMatrixWorld(true);
    C.house.localToWorld(footW.copy(C.foot));
    const c = Math.cos(luff) * len; return out.set(footW.x + Math.sin(cr.houseYaw) * c, footW.y + Math.sin(luff) * len, footW.z + Math.cos(cr.houseYaw) * c);
  }
  let boomLen = 30;
  function boomLength(pl) { const fx = pl.x + Math.sin(pl.yaw) * 3.05, fz = pl.z + Math.cos(pl.yaw) * 3.05; return Math.hypot(pl.pivot.x - fx, pl.pivot.y - (pl.y + 4.3), pl.pivot.z - fz); }
  // the held pose of the ball for the current tip / plane / pull
  const holdAt = new V3();
  function holdPose(out, extra = 0) { const th = cr.pull + extra; return out.copy(cr.tip).addScaledVector(cr.w, Math.sin(th) * cr.L).addScaledVector(UP, -Math.cos(th) * cr.L); }
  // kinematic haul from the ball's position at the phase start toward the held pose, keeping to the rope circle
  const hDir = new V3(), hTarget = new V3();
  function startHaul() { from.dir.subVectors(bp, cr.tip); from.len = Math.max(1, from.dir.length()); from.dir.divideScalar(from.len); }
  function slerpDir(out, a, b, k) {
    const d = clamp(a.dot(b), -1, 1), th = Math.acos(d); if (th < 1e-4) return out.copy(b);
    const s = Math.sin(th); return out.copy(a).multiplyScalar(Math.sin((1 - k) * th) / s).addScaledVector(b, Math.sin(k * th) / s);
  }
  function haul(k, extra = 0) {
    holdPose(hTarget, extra); hDir.subVectors(hTarget, cr.tip).normalize();
    slerpDir(tB, from.dir, hDir, k); prevB.copy(bp);
    bp.copy(cr.tip).addScaledVector(tB, from.len + (cr.L - from.len) * k); bv.set(0, 0, 0);
    const step = prevB.distanceTo(bp); if (step > swing.haulStep) swing.haulStep = step;
  }
  // rope pendulum step (gravity, drag, inextensible rope that can go slack, the ground); damage when `hit`
  // while the crane travels the tag line holds the ball toward the spot under the tip (spring + damping relative to the tip's
  // own motion): it lags and sways, it does not fly round the boom (round 3)
  const hold = { on: false, v: new V3() }, tipPrev = new V3();
  function holdBall(P, V, tip, tv, h) {
    const ox = P.x - tip.x, oz = P.z - tip.z, rx = V.x - tv.x, rz = V.z - tv.z;
    V.x += (-T.travelHold * ox - T.travelHoldDamp * rx) * h; V.z += (-T.travelHold * oz - T.travelHoldDamp * rz) * h;
  }
  function stepBall(h, damp, hit, now) {
    if (hold.on) holdBall(bp, bv, cr.tip, hold.v, h);
    bv.y -= T.gravity * h; bv.multiplyScalar(Math.exp(-damp * h)); bp.addScaledVector(bv, h);
    tA.subVectors(bp, cr.tip); const len = tA.length();
    if (len > cr.L) {
      tA.divideScalar(len); bp.copy(cr.tip).addScaledVector(tA, cr.L); const vr = bv.dot(tA);
      if (vr > 0) { if (slack && vr > 2.5) { swing.jerks++; audio.play('jerk', clamp(vr / 18, .3, 1.2)); if (vr > 9) for (let i = 0; i < 4; i++) addChunk(bp.x + rnd(-1, 1), bp.y + cr.R * .8, bp.z + rnd(-1, 1), bv.x * .3 + rnd(-2, 2), rnd(2, 5), bv.z * .3 + rnd(-2, 2), rnd(.3, .6)); } bv.addScaledVector(tA, -vr * (slack ? 1.15 : 1)); }
      slack = false;
    } else slack = len < cr.L - .2;
    // the ground: a sloped contact (terrain normal), a small bounce on hard hits, rolling friction otherwise, so a ball that
    // lands on a slope rolls back down under the boom tip instead of sticking where it touched
    const gy = heightAt(bp.x, bp.z);
    if (Number.isFinite(gy) && bp.y - cr.R < gy) {
      const e = .8, gx = (heightAt(bp.x + e, bp.z) - heightAt(bp.x - e, bp.z)) / (2 * e), gz = (heightAt(bp.x, bp.z + e) - heightAt(bp.x, bp.z - e)) / (2 * e), nl = Math.hypot(gx, 1, gz);
      const nx = -gx / nl, ny = 1 / nl, nzz = -gz / nl; bp.y = gy + cr.R;
      const vn = bv.x * nx + bv.y * ny + bv.z * nzz;
      if (vn < 0) { const k = vn < -6 ? 1.15 : 1; if (vn < -8) audio.play('crunch', .5); bv.x -= k * vn * nx; bv.y -= k * vn * ny; bv.z -= k * vn * nzz; }
      bv.multiplyScalar(Math.exp(-1.2 * h));
    }
    if (hit) wallContact(now);
  }

  // ---------- drawing ----------
  const foot = new V3(), gantry = new V3(), drum = new V3(), tagAt = new V3(), sv = new V3(), sideV = new V3(), up2 = new V3(), cA = new V3(), cB = new V3(), hookAt = new V3(), hangDir = new V3();
  const ca = new V3(), cb = new V3(), boomDir = new V3(), FACES = [[0, 1], [1, 3], [3, 2], [2, 0]];
  function strut(i, a, b, t, color, mesh = boom) { sv.subVectors(b, a); const len = sv.length() || 1e-4; tQ.setFromUnitVectors(ZAX, sv.divideScalar(len)); mesh.setMatrixAt(i, tM.compose(tD.copy(a).add(b).multiplyScalar(.5), tQ, tS.set(t, t, len))); mesh.setColorAt(i, color); }
  // lattice corner i (bit 0: side, bit 1: up) at t along the boom; the section tapers from 0.95 to 0.45 half width
  function corner(out, f, t, i, len) { const w = .95 - .5 * t; return out.copy(f).addScaledVector(boomDir, t * len).addScaledVector(sideV, (i & 1 ? 1 : -1) * w).addScaledVector(up2, (i & 2 ? 1 : -1) * w); }
  function drawBoom(f, tip, mesh = boom) {
    boomDir.subVectors(tip, f); const len = boomDir.length(); boomDir.divideScalar(len || 1);
    sideV.crossVectors(UP, boomDir).normalize(); up2.crossVectors(boomDir, sideV).normalize();
    const n = Math.max(4, Math.round(len / 2.8)); let k = 0;
    for (let s = 0; s < n && k < BOOM_MAX - 14; s++) {
      const t0 = s / n, t1 = (s + 1) / n;
      for (let i = 0; i < 4; i++) strut(k++, corner(ca, f, t0, i, len), corner(cb, f, t1, i, len), .24 - .08 * t0, chordCol, mesh);
      for (const [a, b] of FACES) strut(k++, corner(ca, f, t0, s % 2 ? a : b, len), corner(cb, f, t1, s % 2 ? b : a, len), .1, laceCol, mesh);
      if (s % 3 === 0) for (const [a, b] of FACES) strut(k++, corner(ca, f, t0, a, len), corner(cb, f, t0, b, len), .09, laceCol, mesh);
    }
    // sheave head across the tip + a short nose plate
    strut(k++, ca.copy(tip).addScaledVector(sideV, -.75), cb.copy(tip).addScaledVector(sideV, .75), 1.0, headCol, mesh);
    strut(k++, ca.copy(tip).addScaledVector(boomDir, -1.2).addScaledVector(up2, .55), cb.copy(tip).addScaledVector(up2, .25), .5, chordCol, mesh);
    mesh.count = k; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  }
  function setLine(m, a, b, r) { sv.subVectors(b, a); const len = Math.max(1e-4, sv.length()); m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(ZAX, sv.divideScalar(len)); m.scale.set(r, r, len); }
  // hoist rope from the tip to the hook block: straight when taut, a sagging curve when slack
  const SEG = 8, segA = new V3(), segB = new V3(), segC = new V3();
  function drawRope(a, b, sag) {
    for (let i = 0; i < SEG; i++) {
      const t0 = i / SEG, t1 = (i + 1) / SEG;
      segA.lerpVectors(a, b, t0); segA.y -= sag * 4 * t0 * (1 - t0); segB.lerpVectors(a, b, t1); segB.y -= sag * 4 * t1 * (1 - t1);
      sv.subVectors(segB, segA); const len = Math.max(1e-4, sv.length()); tQ.setFromUnitVectors(ZAX, sv.divideScalar(len));
      hangSeg.setMatrixAt(i, tM.compose(segC.copy(segA).add(segB).multiplyScalar(.5), tQ, tS.set(.09, .09, len + .02)));
    }
    hangSeg.instanceMatrix.needsUpdate = true;
  }
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  function draw() {
    if (phase === 'none' || phase === 'gone') return;
    C.root.position.set(cr.base.x, cr.y + cr.lift, cr.base.z);
    euler.set(-cr.pitch, cr.lowerYaw, cr.roll); C.root.quaternion.setFromEuler(euler);
    const sq = cr.squash; C.lower.scale.set(1 + sq * .03, 1 - sq * .08, 1 + sq * .03);
    C.house.rotation.y = Math.atan2(Math.sin(cr.houseYaw - cr.lowerYaw), Math.cos(cr.houseYaw - cr.lowerYaw)); C.house.position.y = 2.15 * (1 - sq * .08);
    C.root.updateMatrixWorld(true);
    C.beltTexes[0].offset.y = cr.trackL; C.beltTexes[1].offset.y = cr.trackR;
    C.house.localToWorld(foot.copy(C.foot)); C.house.localToWorld(gantry.copy(C.gantry)); C.house.localToWorld(drum.copy(C.drum));
    tD.copy(cr.tip);
    if (boomDirty) { drawBoom(foot, tD); boomDirty = false; }
    sideV.crossVectors(UP, boomDir).normalize();
    setLine(pendL, cA.copy(gantry).addScaledVector(sideV, -.45), cB.copy(tD).addScaledVector(sideV, -.4).addScaledVector(boomDir, -1.4), .07);
    setLine(pendR, cA.copy(gantry).addScaledVector(sideV, .45), cB.copy(tD).addScaledVector(sideV, .4).addScaledVector(boomDir, -1.4), .07);
    setLine(ropeUp, drum, cB.copy(tD).addScaledVector(boomDir, -.6), .06);
    // ball, hook, chain (the chain hangs from the hook toward the ball; the rope sags when slack)
    hangDir.subVectors(bp, tD); const len = hangDir.length(); hangDir.divideScalar(len || 1);
    const chainLen = 2.6, ropeLen = Math.max(1, cr.L - cr.R - chainLen - 1.0), dist = Math.max(1, len - cr.R - chainLen - 1.0);
    hookAt.copy(tD).addScaledVector(hangDir, Math.min(dist, ropeLen));
    drawRope(tD, hookAt, Math.min(4, Math.max(0, ropeLen - dist) * 1.5));
    hook.position.copy(hookAt).addScaledVector(hangDir, .5); hook.quaternion.setFromUnitVectors(YAX, tA.copy(hangDir).negate());
    tQ.setFromUnitVectors(YAX, hangDir);
    for (let i = 0; i < LINKS; i++) { const qq = qLink[i].copy(tQ); if (i % 2) qq.premultiply(qTurn.setFromAxisAngle(hangDir, Math.PI / 2)); chain.setMatrixAt(i, tM.compose(tC.copy(hookAt).addScaledVector(hangDir, 1.25 + i * chainLen / LINKS), qq, tS.set(.3, .44, .3))); }
    chain.instanceMatrix.needsUpdate = true;
    ball.position.copy(bp); ball.scale.setScalar(cr.R); ball.quaternion.setFromUnitVectors(YAX, tA.copy(hangDir).negate());
    // tag line while the ball is hauled back and held
    tag.visible = HELD.has(phase) && C.root.visible;
    if (tag.visible) { C.house.localToWorld(tagAt.copy(C.tag)); setLine(tag, tagAt, tA.copy(bp).addScaledVector(UP, cr.R * .2), .05); }
    // shadows (a soft oriented rectangle under the tracks, a disc under the ball fading with height)
    const liftK = clamp(1 - cr.lift / 12, 0, 1);
    if (shadowAt.x !== cr.base.x || shadowAt.z !== cr.base.z || shadowAt.yaw !== cr.lowerYaw) { shadowAt.x = cr.base.x; shadowAt.z = cr.base.z; shadowAt.yaw = cr.lowerYaw; craneShadow.userData.place(cr.base.x, cr.base.z, 8.6, 11.5, cr.lowerYaw, .06); }
    craneShadow.material.opacity = .5 * liftK;
    const gb = heightAt(bp.x, bp.z), above = bp.y - cr.R - gb;
    ballShadow.userData.place(bp.x, bp.z, cr.R * 2.4, cr.R * 2.4, 0, .07); ballShadow.material.opacity = .45 * clamp(1 - above / (cr.R * 7), .08, 1);
    C.beaconMat.color.set(phase !== 'rest' && Math.sin(lastNow * 12) > 0 ? '#ffb02a' : '#7a4a10');
  }
  const qLink = Array.from({ length: LINKS }, () => new THREE.Quaternion()), qTurn = new THREE.Quaternion(), shadowAt = { x: NaN, z: NaN, yaw: NaN };

  // ---------- engine voice ----------
  function engineSync(now, rev) {
    const want = active && visible && phase !== 'none' && phase !== 'gone';
    if (!want) { if (engine) { engine.stop(); engine = null; } return; }
    if (now - engineCheck > .5) { engineCheck = now; if (!audio.live) { if (engine) { engine.stop(); engine = null; } return; } }
    if (!engine) { engine = audio.engine(); if (!engine) return; }
    engine.set(1, rev);
  }

  // ---------- taps ----------
  // point / normal: the tapped surface (pick + its outward normal); entry: the building (null for a protected site); site.
  // Returns true (taken), 'busy' (the crane is moving / the ball has not reached the wall yet), 'no-spot' (no place for the
  // crane beside that wall, e.g. a narrow alley) or 'no-target'.
  function viewInfo() {
    camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    camera.getWorldDirection(tA); const l = Math.hypot(tA.x, tA.z) || 1, e = camera.projectionMatrix.elements;
    return { project, fx: tA.x / l, fz: tA.z / l, p0: e[0], p5: e[5], cx: camera.position.x, cy: camera.position.y, cz: camera.position.z };
  }
  function onScreen(x, y, z, margin = 1) { const p = project(x, y, z); return p[2] && Math.abs(p[0]) < margin && Math.abs(p[1]) < margin; }
  // in the frame and not behind a building (round 3: the departing crane may also leave the picture behind one)
  function inView(x, y, z, margin = 1.05) {
    if (!onScreen(x, y, z, margin)) return false;
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    for (let i = 1; i < 10; i++) { const t = i / 10; if (planner.blocked(cx + (x - cx) * t, cy + (y - cy) * t, cz + (z - cz) * t, 0)) return false; }
    return true;
  }
  function swingAt({ point, normal, entry = null, site = null, now = performance.now() / 1000 } = {}) {
    if (!point || ![point.x, point.y, point.z].every(Number.isFinite) || (!entry && !site)) { rejected++; return 'no-target'; }
    if (phase === 'swing' && !(swing.contacted || swing.passed)) { rejected++; return 'busy'; }
    if (phase === 'swing' && now - (swing.impactAt >= 0 ? swing.impactAt : swing.releaseAt) < T.refire) { rejected++; return 'busy'; }
    if (phase !== 'none' && phase !== 'gone' && phase !== 'rest' && phase !== 'swing') { rejected++; return 'busy'; }
    refreshBoxes(); const view = viewInfo();
    // outward horizontal wall normal (roof taps: toward the camera)
    let nx = normal?.x || 0, nzv = normal?.z || 0; const nl = Math.hypot(nx, nzv);
    if (!normal || Math.abs(normal.y) > .8 || nl < .2) { nx = camera.position.x - point.x; nzv = camera.position.z - point.z; } const l = Math.hypot(nx, nzv) || 1; nx /= l; nzv /= l;
    const R = T.ballRadius, g = heightAt(point.x, point.z), skip = entry?.id ?? null;
    const I = { x: point.x + nx * R * .9, y: Math.max(point.y, (Number.isFinite(g) ? g : point.y) + R + .5), z: point.z + nzv * R * .9 };
    // roof taps: the swing comes in just under the roof line
    if (normal && normal.y > .8 && entry) I.y = Math.max((Number.isFinite(g) ? g : point.y) + R + .5, point.y - R * 1.1);
    if (site) I.y = Math.min(I.y, site.topY - R * .4);
    { const gI = heightAt(I.x, I.z); if (Number.isFinite(gI)) I.y = Math.max(I.y, gI + R + .6); } // it comes to rest hanging here, clear of the ground
    const n = { x: nx, z: nzv }, opts = { skip, view, top: entry ? entry.worldBounds.max.y : site ? site.topY : Infinity };
    const parked = phase === 'rest' || phase === 'swing';
    let pl = null, mode = 'drive', ap = null, path = null;
    if (parked) { const st = planner.stay(I, n, { x: cr.base.x, z: cr.base.z }, opts); if (st) { pl = st; mode = 'turn'; } }
    if (!pl) {
      pl = planner.plan(I, n, { ...opts, current: parked ? { x: cr.base.x, z: cr.base.z } : null });
      // no room in front of that spot (an alley): try the same wall a little further along, toward its open end / corner
      if (!pl && entry) {
        const box = boxes.find(b => b.id === skip), tx = -nzv, tz = nx;
        for (const sh of [6, -6, 11, -11, 16, -16]) {
          const I2 = { x: I.x + tx * sh, y: I.y, z: I.z + tz * sh }, wx = I2.x - nx * (R * .9 + .6), wz = I2.z - nzv * (R * .9 + .6);
          if (!box || !planner.inBox(box, wx, I2.y, wz, .5)) continue;   // still on this building's wall
          const g2 = heightAt(I2.x, I2.z); if (Number.isFinite(g2)) I2.y = Math.max(I2.y, g2 + R + .6);
          pl = planner.plan(I2, n, { ...opts, current: parked ? { x: cr.base.x, z: cr.base.z } : null });
          if (pl) { pl.shifted = sh; I.x = I2.x; I.y = I2.y; I.z = I2.z; break; }
        }
      }
      if (!pl) { rejected++; noSpot++; lastPlan = { failed: true, I: [+I.x.toFixed(2), +I.y.toFixed(2), +I.z.toFixed(2)], target: skip || site?.id }; return 'no-spot'; }
      // round 3: a short straight hop is driven; anything farther (or blocked) is a drive-off + a new crane driving in
      if (parked) {
        const d = Math.hypot(pl.x - cr.base.x, pl.z - cr.base.z);
        path = d <= T.moveMax ? planner.drivable(cr.base.x, cr.base.z, pl.x, pl.z) : null;
        mode = path ? 'move' : 'relocate';
      }
      if (mode !== 'move') { ap = planner.approach(pl.x, pl.z, I.x, I.z, view); if (!ap) mode = parked ? 'relocate-lower' : 'lower'; else if (parked) mode = 'relocate'; }
    }
    if (parked && swing.releaseAt >= 0) finishRecord(now);
    // a spare crane parked where this one is going makes room
    for (const g of departers) if (g.on && g.parked && Math.hypot(g.x - pl.x, g.z - pl.z) < T.footprint * 2.5) retire(g, now);
    lastPlan = { mode, pull: +(pl.pull / DEG).toFixed(0), L: +pl.L.toFixed(1), x: +pl.x.toFixed(2), y: +pl.y.toFixed(2), z: +pl.z.toFixed(2), yaw: +pl.yaw.toFixed(3), side: pl.side, plane: +(pl.plane / DEG).toFixed(0), luff: +(pl.luff / DEG).toFixed(0), reach: +pl.reach.toFixed(1), slope: +pl.slope.toFixed(2),
      clear: Number.isFinite(pl.clear) ? +pl.clear.toFixed(1) : null, level: pl.level, cover: +pl.cover.toFixed(3), nearer: pl.nearer, knock: pl.knock.length + (ap?.knock.length || 0) + (path?.length || 0), shifted: pl.shifted || 0, raised: +(pl.raised || 0).toFixed(2),
      I: [+I.x.toFixed(2), +(I.y + (pl.raised || 0)).toFixed(2), +I.z.toFixed(2)], target: skip || site?.id, approach: ap ? { x: +ap.x.toFixed(1), z: +ap.z.toFixed(1), dist: ap.dist } : null };
    // start the swing record
    Object.assign(swing, { id: ++swings, tapAt: now, releaseAt: -1, impactAt: -1, weight: 0, pieces: 0, slams: 0, shield: 0, mode, contacted: false, passed: false, target: skip || site?.id, plan: lastPlan, site: !!site, crossings: 0, side: 0, haulStep: 0, jerks: 0 });
    swing.buildings.length = 0; swing.struck.clear();
    vm.press = 1; cr.entryId = skip; cr.siteId = site?.id ?? null;
    knockQueue = [...pl.knock, ...(ap?.knock || []), ...(path || [])];
    next = { pl, ap };
    if (phase === 'none' || phase === 'gone') beginEnter(now);
    else if (mode === 'turn') {
      snapshotFrom(); setTarget(pl);
      const slew = Math.abs(Math.atan2(Math.sin(to.houseYaw - cr.houseYaw), Math.cos(to.houseYaw - cr.houseYaw)));
      // haul time follows how far the ball has to travel (a hand-over-hand pull, never a snap): about 65 units a second
      tB.copy(to.P).addScaledVector(to.w, Math.sin(cr.pull) * cr.L).addScaledVector(UP, -Math.cos(cr.pull) * cr.L);
      startPhase('turn', clamp(Math.max(slew * .3 + .12, (bp.distanceTo(tB) + cr.P.distanceTo(to.P) * .5) / 65), T.haul, .7)); startHaul(); audio.play('winch', dur); audio.play('creak', .4, .6);
    } else if (mode === 'move') {
      snapshotFrom(); setTarget(pl); planMove(pl); startPhase('move', mv.total); audio.play('drive', dur);
      moveLog = { d: +mv.d.toFixed(1), pivot: +(mv.pivot / DEG).toFixed(0), reverse: mv.rev < 0, time: +mv.total.toFixed(3), peak: 0, sway: 0, pivotRate: 0, slewRate: 0 };
      lastPlan.move = moveLog;
    } else {
      // relocation: the parked crane drives off out of the frame (if the camera sees it) while a crane drives in at the new spot
      const g = spawnDeparter(now, pl.x, pl.z); lastPlan.depart = g ? { out: g.final, run: +g.len.toFixed(1), pivot: +(Math.abs(angDiff(g.yaw0, g.trackYaw)) / DEG).toFixed(0), reverse: !g.fwd, ms: +g.ms.toFixed(1) } : null;
      beginEnter(now);
    }
    return true;
  }
  // ---------- a short drive (round 3) ----------
  // Tracks pivot toward the heading (or the crane backs up when that turns less), the boom goes up to the travel pose (tip and
  // ball drawn in toward the crane, clear of the walls) while the house slews straight to its next working direction, the crane
  // speeds up, cruises and brakes (the body rocks), then 'settle' lowers the boom to the new wall. The belts run with the
  // motion (against each other while pivoting); the tag line holds the ball, so it lags and sways a little.
  const mv = { ux: 0, uz: 1, d: 0, heading: 0, houseTo: 0, trackYaw: 0, fromYaw: 0, rev: 1, pivot: 0, tp: 0, t0: 0, ths: 0, total: 0 }, prof = { s: 0, v: 0, a: 0 };
  function planMove(pl) {
    const dx = pl.x - cr.base.x, dz = pl.z - cr.base.z, d = Math.hypot(dx, dz) || 1e-6, h = Math.atan2(dx, dz);
    const dF = Math.abs(angDiff(cr.lowerYaw, h)), dR = Math.abs(angDiff(cr.lowerYaw, h + Math.PI));
    mv.ux = dx / d; mv.uz = dz / d; mv.d = d; mv.heading = h; mv.rev = dR + .35 < dF ? -1 : 1; mv.trackYaw = mv.rev < 0 ? h + Math.PI : h; mv.fromYaw = cr.lowerYaw;
    mv.pivot = Math.min(dF, dR); mv.tp = mv.pivot / (T.pivotRate * DEG); mv.t0 = mv.tp * .75;
    mv.houseTo = Math.atan2(to.P.x - pl.x, to.P.z - pl.z); mv.ths = Math.max(T.lowerTime, Math.abs(angDiff(cr.houseYaw, mv.houseTo)) / (T.slewRate * DEG));
    mv.total = Math.max(mv.t0 + travelTime(d, T.travelAccel, T.travelSpeed), mv.ths);
  }

  // ---------- departing cranes (round 3) ----------
  // On a far tap the parked crane hands over: a second crane sharing the geometry takes its pose and drives off while the
  // crane drives in at the new spot. It leaves the picture (out of the frame or behind a building: body, raised boom tip and
  // ball) on a clear straight run when that takes at most exitBudget; otherwise it backs off a short clear way, brakes and
  // stays parked as a spare (boom up, ball hanging) until the camera no longer sees it. Boom up to the travel pose, pivot,
  // accelerate (body rocks), belts running, ball held by the tag line. Two of them at most: a third retires the oldest
  // (out of sight right away, or with a dust puff on screen - counted as a pop). Reset / clear takes them away.
  const legKnock = [], exits = Array.from({ length: 16 }, () => ({ a: 0, dx: 0, dz: 0, fwd: true, piv: 0, sOff: 0, time: 0, cost: 0 }));
  function makeDeparter() {
    const GC = cloneCrane(THREE, C, own); GC.root.visible = false; scene.add(GC.root);
    const pivot = new THREE.Group(); pivot.position.copy(C.foot); GC.house.add(pivot);
    const boomI = new THREE.InstancedMesh(unitBox, boomMat, BOOM_MAX); boomI.count = 0; boomI.frustumCulled = false;
    boomI.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BOOM_MAX * 3), 3); pivot.add(boomI);
    const pendL2 = line(), pendR2 = line(), rope = line(), chain2 = line(), up = line();
    const hk = hook.clone(); hk.visible = false; scene.add(hk);
    const bl = ball.clone(); bl.visible = false; scene.add(bl);
    const shadow = groundPatch(soft, 8, { opacity: .5 });
    const parts = [GC.root, pendL2, pendR2, rope, chain2, up, hk, bl, shadow];
    return { GC, pivot, boomI, pendL2, pendR2, rope, chain2, up, hk, bl, shadow, parts, on: false, born: 0, t: 0, lt: 0, x: 0, z: 0, y: 0, x0: 0, z0: 0, dx: 0, dz: 1, len: 0, final: false, fwd: true,
      yaw0: 0, yaw: 0, trackYaw: 0, prevYaw: 0, house: 0, luff0: 0, blen: 30, L: 19, R: 2.4, s: 0, v: 0, tp: 0, t0: 0, knock: [], tip: new V3(), tipPrev: new V3(), tv: new V3(), bp: new V3(), bv: new V3(),
      trackL: 0, trackR: 0, peak: 0, sway: 0, parked: false, hidden: false };
  }
  const departers = [makeDeparter(), makeDeparter()];
  function setDeparterVisible(g, v) { for (const m of g.parts) m.visible = v; }
  function retire(g, now) {
    if (!g.on) return; g.on = false;
    if (inSight(g)) { departPops++; for (let i = 0; i < (mobile ? 10 : 16); i++) { const an = rnd(0, 6.28), x = g.x + Math.cos(an) * 5, z = g.z + Math.sin(an) * 5; dust.spawn(x, heightAt(x, z) + .5, z, Math.cos(an) * 4, rnd(.5, 2), Math.sin(an) * 4, 2.2, 3, rnd(1, 1.6), .5, .8, .76, .66, 2.2, .4); } }
    setDeparterVisible(g, false);
  }
  const inSight = g => inView(g.x, g.y + 4, g.z) || inView(g.tip.x, g.tip.y, g.tip.z) || inView(g.bp.x, g.bp.y, g.bp.z) || inView(g.x - Math.sin(g.yaw) * 5, g.y + 3, g.z - Math.cos(g.yaw) * 5) || inView((g.x + g.tip.x) / 2, (g.y + 4 + g.tip.y) / 2, (g.z + g.tip.z) / 2);
  // the way: 16 headings (forward or backing up, whichever pivots less); the cheapest clear run out of sight within exitBudget,
  // else the best short clear run (away from the lens and the new spot) to park on
  function chooseWay(g, ax, az) {
    const x0 = g.x, z0 = g.z, yaw = g.yaw, reach = g.blen * Math.cos(T.travelLuff * DEG), rise = 4.3 + g.blen * Math.sin(T.travelLuff * DEG), hx = Math.sin(g.house), hz = Math.cos(g.house);
    const vx = camera.position.x - x0, vz = camera.position.z - z0, vl = Math.hypot(vx, vz) || 1;
    for (let k = 0; k < 16; k++) {
      const e = exits[k], a = yaw + k / 16 * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a), dy = Math.abs(angDiff(yaw, a));
      e.a = a; e.dx = dx; e.dz = dz; e.fwd = dy <= Math.PI / 2 + .01; e.piv = e.fwd ? dy : Math.PI - dy; e.sOff = Infinity;
      for (let s2 = 6; s2 <= 120; s2 += 6) {
        const x = x0 + dx * s2, z = z0 + dz * s2, gy = heightAt(x, z); if (!Number.isFinite(gy)) break;
        if (!inView(x, gy + 4, z, 1.06) && !inView(x + hx * reach, gy + rise, z + hz * reach, 1.06) && !inView(x + hx * reach, gy + rise - g.L, z + hz * reach, 1.06) && !inView(x - dx * 6, gy + 3, z - dz * 6, 1.06) && !inView(x + hx * reach / 2, gy + rise / 2 + 2, z + hz * reach / 2, 1.06)) { e.sOff = s2 + 6; break; }
      }
      e.time = e.piv / (T.pivotRate * DEG) * .75 + (Number.isFinite(e.sOff) ? travelTime(e.sOff, T.exitAccel, 1e9) : 9);
      // not toward the lens (it would loom over the picture) and not across the new spot (the new crane drives in there)
      const tw = (dx * vx + dz * vz) / vl; let pen = tw > .1 ? (tw - .1) * 4 : 0;   // (frames 10-19: a crane backing toward the lens looms huge)
      if (Number.isFinite(ax)) { const tx = ax - x0, tz = az - z0, tl = Math.hypot(tx, tz) || 1, c = (tx * dx + tz * dz) / tl; if (tl < 110 && c > .3) pen += 1.2 * c; }
      e.cost = e.time + pen;
    }
    const order = exits.slice().sort((p, q) => p.cost - q.cost);
    for (const e of order) {
      if (e.time > T.exitBudget) continue;
      legKnock.length = 0; const run = planner.drivableRun(x0, z0, e.dx, e.dz, e.sOff, legKnock);
      if (run >= e.sOff - 1e-6) return setWay(g, e, e.sOff, true);
    }
    // park: a short clear run, preferring little pivot, away from the lens and the new spot
    let best = null, bestScore = -Infinity, bestRun = 0, bestKnock = [];
    for (const e of order.slice(0, 10)) {
      legKnock.length = 0; const run = planner.drivableRun(x0, z0, e.dx, e.dz, T.parkRun, legKnock);
      const score = Math.min(run, T.parkRun) * .08 - (e.cost - e.time) - e.piv; if (run >= 7.5 && score > bestScore) { bestScore = score; best = e; bestRun = run; bestKnock = legKnock.slice(); }
    }
    if (!best) return setWay(g, null, 0, false);
    legKnock.length = 0; legKnock.push(...bestKnock); return setWay(g, best, bestRun, false);
  }
  function setWay(g, e, len, final) {
    g.final = final; g.len = len; g.knock = legKnock.slice();
    if (e) { g.dx = e.dx; g.dz = e.dz; g.fwd = e.fwd; g.trackYaw = e.fwd ? e.a : e.a + Math.PI; } else { g.dx = Math.sin(g.yaw); g.dz = Math.cos(g.yaw); g.fwd = true; g.trackYaw = g.yaw; }
    g.tp = Math.abs(angDiff(g.yaw, g.trackYaw)) / (T.pivotRate * DEG); g.t0 = g.tp * .75; return g;
  }
  const gOrigin = new V3(), gTipLocal = new V3();
  function spawnDeparter(now, ax = NaN, az = NaN) {
    // a crane the camera does not see (out of the frame / behind a building) just goes
    C.house.localToWorld(footW.copy(C.foot));
    if (!inView(cr.base.x, cr.y + 4, cr.base.z) && !inView(cr.tip.x, cr.tip.y, cr.tip.z) && !inView(bp.x, bp.y, bp.z) && !inView((footW.x + cr.tip.x) / 2, (footW.y + cr.tip.y) / 2, (footW.z + cr.tip.z) / 2)) return null;
    const t0 = globalThis.performance?.now?.() ?? 0;
    let g = departers.find(d => !d.on); if (!g) { g = departers.reduce((o, d) => d.born < o.born ? d : o); retire(g, now); }
    C.house.localToWorld(footW.copy(C.foot)); g.blen = Math.max(8, footW.distanceTo(cr.tip)); g.luff0 = Math.asin(clamp((cr.tip.y - footW.y) / g.blen, -1, 1));
    g.x0 = g.x = cr.base.x; g.z0 = g.z = cr.base.z; g.y = cr.y; g.yaw0 = g.yaw = g.prevYaw = cr.lowerYaw; g.house = cr.houseYaw; g.L = cr.L; g.R = cr.R;
    g.bp.copy(bp); g.bv.copy(bv); g.tip.copy(cr.tip); g.tipPrev.copy(cr.tip); g.trackL = cr.trackL; g.trackR = cr.trackR; g.peak = 0; g.sway = 0; g.parked = false;
    chooseWay(g, ax, az);
    g.t = 0; g.s = 0; g.v = 0; g.on = true; g.born = now; departs++;
    drawBoom(gOrigin.set(0, 0, 0), gTipLocal.set(0, 0, g.blen), g.boomI); boomDirty = true; // drawBoom shares the scratch vectors with the main boom
    g.bl.scale.setScalar(g.R); setDeparterVisible(g, true); audio.play('drive', .7);
    g.ms = (globalThis.performance?.now?.() ?? 0) - t0;
    return g;
  }
  function clearDeparters() { for (const g of departers) if (g.on) { g.on = false; setDeparterVisible(g, false); } }
  const gA = new V3(), gB = new V3(), gHang = new V3(), gHookAt = new V3(), gl = { y: 0, pitch: 0, roll: 0 };
  function updateDeparter(g, dt, now) {
    if (!g.on || dt <= 0) return;
    g.t += dt; const t = g.t, px = g.x, pz = g.z, GC = g.GC;
    g.yaw = g.tp > 0 ? angleLerp(g.yaw0, g.trackYaw, smooth(t / g.tp)) : g.trackYaw;
    const luff = g.luff0 + (T.travelLuff * DEG - g.luff0) * smooth(t / T.lowerTime); // the house keeps its heading, the boom goes up
    let a = 0;
    if (t > g.t0 && !g.parked) {
      // speed up to exitSpeed; on a parking run brake to stop at its end
      let v = Math.min(T.exitSpeed, g.v + T.exitAccel * dt); if (!g.final) v = Math.min(v, Math.sqrt(Math.max(0, 2 * T.exitAccel * (g.len - g.s))));
      a = (v - g.v) / dt; g.v = v; g.s += v * dt; if (!g.final && g.s >= g.len - .05) { g.s = g.len; g.v = 0; g.parked = true; }
    }
    g.peak = Math.max(g.peak, g.v);
    g.x = g.x0 + g.dx * g.s; g.z = g.z0 + g.dz * g.s;
    tilt(g.x, g.z, g.yaw, gl); g.y = gl.y;
    GC.root.position.set(g.x, gl.y, g.z); euler.set(-(gl.pitch + a * T.pitchDip * (g.fwd ? 1 : -1)), g.yaw, gl.roll); GC.root.quaternion.setFromEuler(euler);
    GC.house.rotation.y = angDiff(g.yaw, g.house); g.pivot.rotation.x = -luff; GC.root.updateMatrixWorld(true);
    g.pivot.localToWorld(g.tip.set(0, 0, g.blen));
    // belts: with the motion, against each other while pivoting
    const along = (g.x - px) * Math.sin(g.yaw) + (g.z - pz) * Math.cos(g.yaw), turn = angDiff(g.prevYaw, g.yaw) * 2.65; g.prevYaw = g.yaw;
    g.trackL += (along + turn) * 7 / 8.6; g.trackR += (along - turn) * 7 / 8.6; GC.beltTexes[0].offset.y = g.trackL; GC.beltTexes[1].offset.y = g.trackR;
    // the ball on its rope, held by the tag line
    g.tv.subVectors(g.tip, g.tipPrev).divideScalar(dt); g.tipPrev.copy(g.tip);
    for (let left = dt; left > 1e-6;) {
      const h = Math.min(1 / 240, left); left -= h;
      holdBall(g.bp, g.bv, g.tip, g.tv, h); g.bv.y -= T.gravity * h; g.bv.multiplyScalar(Math.exp(-T.damping * 3 * h)); g.bp.addScaledVector(g.bv, h);
      gA.subVectors(g.bp, g.tip); const len = gA.length(); if (len > g.L) { gA.divideScalar(len); g.bp.copy(g.tip).addScaledVector(gA, g.L); const vr = g.bv.dot(gA); if (vr > 0) g.bv.addScaledVector(gA, -vr); }
      const gy = heightAt(g.bp.x, g.bp.z); if (Number.isFinite(gy) && g.bp.y - g.R < gy) { g.bp.y = gy + g.R; if (g.bv.y < 0) g.bv.y = 0; }
    }
    if (t > T.lowerTime) g.sway = Math.max(g.sway, Math.atan2(Math.hypot(g.bp.x - g.tip.x, g.bp.z - g.tip.z), g.tip.y - g.bp.y) / DEG);
    // lines, hook, ball, shadow
    GC.house.localToWorld(gA.copy(C.gantry)); sideV.set(Math.cos(g.house), 0, -Math.sin(g.house));
    gB.copy(g.tip).addScaledVector(gHang.set(Math.sin(g.house), 0, Math.cos(g.house)), -1.4);
    setLine(g.pendL2, cA.copy(gA).addScaledVector(sideV, -.45), cB.copy(gB).addScaledVector(sideV, -.4), .07); setLine(g.pendR2, cA.copy(gA).addScaledVector(sideV, .45), cB.copy(gB).addScaledVector(sideV, .4), .07);
    GC.house.localToWorld(gA.copy(C.drum)); setLine(g.up, gA, gB, .06);
    gHang.subVectors(g.bp, g.tip); const hl = gHang.length() || 1; gHang.divideScalar(hl);
    gHookAt.copy(g.tip).addScaledVector(gHang, Math.max(1, hl - g.R - 3.6)); setLine(g.rope, g.tip, gHookAt, .09); setLine(g.chain2, gHookAt, g.bp, .14);
    g.hk.position.copy(gHookAt).addScaledVector(gHang, .5); g.hk.quaternion.setFromUnitVectors(YAX, gA.copy(gHang).negate());
    g.bl.position.copy(g.bp); g.bl.quaternion.setFromUnitVectors(YAX, gA.copy(gHang).negate());
    if (!g.parked || along) g.shadow.userData.place(g.x, g.z, 8.6, 11.5, g.yaw, .06);
    for (let j = g.knock.length - 1; j >= 0; j--) { const o = g.knock[j]; if (Math.hypot(o.x - g.x, o.z - g.z) < T.footprint + o.r + .5) { knock(o, g.x, g.z, now); g.knock.splice(j, 1); } }
    if (Math.abs(along) > .02 && Math.random() < Math.min(1, Math.abs(along) * 3)) { const sy = Math.sin(g.yaw), cy = Math.cos(g.yaw), back = along > 0 ? -1 : 1; for (const sd of [-1, 1]) { const x = g.x + cy * sd * 2.65 + sy * back * 4.4, z = g.z - sy * sd * 2.65 + cy * back * 4.4; dust.spawn(x, heightAt(x, z) + .4, z, sy * back * 3 + rnd(-1, 1), rnd(.5, 1.6), cy * back * 3 + rnd(-1, 1), 1.3, 2.2, rnd(.8, 1.4), .4, .76, .72, .64, 2.2, .35); } }
    // gone once out of sight (a parked spare: checked a few times a second)
    if (g.s > 1 && (!g.parked || Math.random() < dt * 4) && !inSight(g)) { g.on = false; setDeparterVisible(g, false); }
    else if (!g.parked && t > T.exitMax) retire(g, now);
  }
  function startPhase(p, d) { phase = p; pt = 0; dur = Math.max(.01, d); }
  // boom up to the wall + haul-back: the time follows how far the tip and the ball travel (about 80 units a second)
  function startSettle(afterMove = false) {
    tB.copy(cr.P).addScaledVector(cr.w, Math.sin(cr.pull) * cr.L).addScaledVector(UP, -Math.cos(cr.pull) * cr.L);
    // round 3: after a drive the house never slews faster than slewRate on average (the drive-in keeps its round 2 timing)
    const slew = afterMove ? Math.abs(angDiff(cr.houseYaw, to.houseYaw)) / (T.slewRate * DEG) : 0;
    startPhase('settle', clamp(Math.max((cr.tip.distanceTo(cr.P) + bp.distanceTo(tB)) / 80, slew), T.settle, afterMove ? .65 : .55)); startHaul(); audio.play('winch', dur + .1);
  }
  function snapshotFrom() { from.base.copy(cr.base); from.y = cr.y; from.lowerYaw = cr.lowerYaw; from.houseYaw = cr.houseYaw; from.P.copy(cr.P); from.tip.copy(cr.tip); from.w.copy(cr.w); }
  function setTarget(pl) { to.base.set(pl.x, pl.y, pl.z); to.y = pl.y; to.lowerYaw = cr.lowerYaw; to.houseYaw = pl.yaw; to.P.set(pl.pivot.x, pl.pivot.y, pl.pivot.z); to.w.set(pl.w.x, 0, pl.w.z); to.pitch = pl.pitch; to.roll = pl.roll; cr.L = pl.L; cr.pull = pl.pull; boomLen = boomLength(pl); }
  const wTmp = new V3();
  function lerpW(k) { const a0 = Math.atan2(from.w.x, from.w.z), a1 = Math.atan2(to.w.x, to.w.z), a = angleLerp(a0, a1, k); cr.w.set(Math.sin(a), 0, Math.cos(a)); }
  // a fresh crane: drive in from the approach point (or lower in where no ground route exists)
  function beginEnter(now) {
    const { pl, ap } = next; next = null; setCraneVisible(true);
    setTarget(pl); cr.P.copy(to.P); cr.w.copy(to.w);
    if (ap) {
      enterMode = 'drive'; cr.ap = { x: ap.x, z: ap.z, yaw: ap.yaw };
      from.base.set(ap.x, 0, ap.z); to.base.set(pl.x, pl.y, pl.z); cr.lowerYaw = cr.houseYaw = ap.yaw; cr.base.copy(from.base); tilt(ap.x, ap.z, ap.yaw, tl); cr.y = tl.y; cr.pitch = tl.pitch; cr.roll = tl.roll; cr.lift = 0;
      startPhase('enter', clamp(T.driveMin + ap.dist / T.driveSpeed, T.driveMin, ap.dist > 32 ? T.driveFar : T.driveMax)); audio.play('drive', dur);
    } else {
      enterMode = 'lower'; cr.ap = null; cr.base.set(pl.x, pl.y, pl.z); from.base.copy(cr.base); to.base.copy(cr.base); cr.lowerYaw = cr.houseYaw = pl.yaw; tilt(pl.x, pl.z, pl.yaw, tl); cr.y = tl.y; cr.pitch = tl.pitch; cr.roll = tl.roll; cr.lift = 7;
      startPhase('enter', T.lowerIn); audio.play('lift');
    }
    carriedTip(cr.tip, boomLen); bp.copy(cr.tip).addScaledVector(UP, -cr.L); bv.set(0, 0, 0); slack = false; boomDirty = true; trackPrev.set(cr.base.x, cr.lowerYaw, cr.base.z); tipPrev.copy(cr.tip);
  }

  // ---------- the swing ----------
  const front = new V3(), moveDir = new V3(), hitDir = new V3(), hitOpt = { direction: hitDir };
  function wallContact(now) {
    const speed = bv.length(), R = cr.R; if (speed < 1e-3) return;
    moveDir.copy(bv).divideScalar(speed);
    // protected: the shield stops it (bounces it back), no damage
    if (protectedSet) {
      const near = protectedSet.nearestSurface(bp, R * 1.3);
      if (near && near.distance < R) {
        const nx = near.normal.x, ny = near.normal.y, nzz = near.normal.z, vn = bv.x * nx + bv.y * ny + bv.z * nzz;
        if (vn < 0) {
          bv.x -= (1 + T.shieldBounce) * vn * nx; bv.y -= (1 + T.shieldBounce) * vn * ny; bv.z -= (1 + T.shieldBounce) * vn * nzz;
          bp.set(near.point.x + nx * (R + .05), Math.max(bp.y, near.point.y + ny * (R + .05)), near.point.z + nzz * (R + .05));
          swing.shield++; shieldHits++; if (swing.impactAt < 0) swing.impactAt = now;
          if (-vn > 4) {
            const p = near.point.clone(), n2 = near.normal.clone();
            onShield(p, n2, true, Math.max(10, R * 4)); audio.play('clang', clamp(-vn / 30, .4, 1.3));
            for (let i = 0; i < (mobile ? 14 : 22); i++) sparks.spawn(p.x, p.y, p.z, n2.x * rnd(4, 12) + rnd(-6, 6), rnd(2, 10) + n2.y * 6, n2.z * rnd(4, 12) + rnd(-6, 6), rnd(.3, .55), -.3, rnd(.25, .5), 1, .75, .93, 1, 1.4, -18);
            flash(p.x, p.y, p.z, R, R * 3.5, .22, reducedMotion ? .3 : .55);
            if (-vn > 15) { freezeUntil = now + T.hitstop * .7; slowUntil = freezeUntil + T.slowmo * .5; }
          }
        }
        return;
      }
    }
    if (speed < T.breakSpeed || swing.hitClock > 0) return;
    let nearAny = false; for (const e of entries) if (!e.cleared && e.worldBounds.distanceToPoint(bp) < R * T.bite + 1) { nearAny = true; break; }
    if (!nearAny) return;
    swing.hitClock = 1 / T.hitRate;
    const r = R * T.bite, f = clamp(T.force * clamp(speed / 30, .55, 1.2), 4, 32);
    const dirOpt = hitDir.copy(moveDir); dirOpt.y += .25; dirOpt.normalize(); const opt = hitOpt;
    let count = 0, weight = 0, first = null;
    for (let k = 0; k <= T.column + T.below; k++) {
      const up = k <= T.column ? k : -(k - T.column), p = tB.copy(bp).addScaledVector(UP, up * R * T.columnStep);
      if (up < 0 && p.y - R * .5 < heightAt(p.x, p.z)) continue;
      const res = campus.hit(p, k ? r * .85 : r, k ? f * .85 : f, opt);
      if (!res.count) continue;
      count += res.count; weight += res.weight; agg.count += res.count; agg.weight += res.weight;
      for (const e of res.affected) { if (!agg.affected.includes(e)) agg.affected.push(e); if (!swing.buildings.includes(e.id)) swing.buildings.push(e.id); if (!first && !swing.struck.has(e.id)) first = e; }
      for (const e of res.cleared) if (!agg.cleared.includes(e)) agg.cleared.push(e);
    }
    if (!count) return;
    swing.weight += weight; swing.pieces += count; swing.contacted = true; lastContact = now;
    // momentum: only the ploughed pieces slow it, at most maxLoss per hit
    bv.multiplyScalar(Math.max(1 - T.maxLoss, Math.exp(-(weight / pieceWeight) / T.eat)));
    front.copy(bp).addScaledVector(moveDir, R * .8); aggPoint.copy(front); aggNormal.copy(moveDir).negate();
    if (first) {
      for (const e of agg.affected) swing.struck.add(e.id);
      const k = clamp(speed / 30, .6, 1.5); swing.slams++; slams++; if (swing.impactAt < 0) swing.impactAt = now;
      // the slam itself: one wider punch where the ball first meets each building (a fast ball only)
      if (speed >= T.slamSpeed) {
        const res = campus.hit(front, R * T.slamRadius, T.slamForce, opt);
        if (res.count) { swing.weight += res.weight; swing.pieces += res.count; agg.count += res.count; agg.weight += res.weight; for (const e of res.affected) if (!agg.affected.includes(e)) agg.affected.push(e); for (const e of res.cleared) if (!agg.cleared.includes(e)) agg.cleared.push(e); }
        // the wall shoves back: the ball loses a little more and jumps up on its rope (it goes slack, then jerks taut)
        bv.multiplyScalar(.85); bv.y += speed * T.slamKick;
      }
      freezeUntil = now + (reducedMotion ? T.hitstop * .5 : T.hitstop); slowUntil = freezeUntil + (reducedMotion ? 0 : T.slowmo);
      audio.play('slam', k); onSlam({ point: front, speed, cleared: agg.cleared.length });
      if (!reducedMotion) { vm.vy -= .7; vm.vx += (Math.random() - .5) * .6; } // a small jolt in the hand, not the screen kick
      const nx2 = -moveDir.x, nz2 = -moveDir.z;
      for (let i = 0; i < (mobile ? 26 : 42); i++) { const a = rnd(0, 6.28), s = rnd(3, 11) * k; dust.spawn(front.x + rnd(-R, R) * .5, front.y + rnd(-R, R) * .5, front.z + rnd(-R, R) * .5, nx2 * rnd(4, 12) + Math.cos(a) * s, rnd(0, 5), nz2 * rnd(4, 12) + Math.sin(a) * s, rnd(1.6, 2.6) * R * .5, R * 1.1, rnd(1.6, 3), .7, .78, .75, .7, 1.6, .6); }
      for (let i = 0; i < (mobile ? 20 : 32); i++) sparks.spawn(front.x, front.y, front.z, nx2 * rnd(6, 18) + rnd(-9, 9), rnd(2, 14), nz2 * rnd(6, 18) + rnd(-9, 9), rnd(.25, .45), -.2, rnd(.3, .6), 1, 1, .78, .42, 1.2, -20);
      for (let i = 0; i < (mobile ? 9 : 15); i++) addChunk(front.x + rnd(-R, R) * .4, front.y + rnd(-R, R) * .4, front.z + rnd(-R, R) * .4, nx2 * rnd(6, 16) + rnd(-5, 5), rnd(4, 13), nz2 * rnd(6, 16) + rnd(-5, 5), rnd(.5, 1.3));
      flash(front.x, front.y, front.z, R * 1.5, R * 5 * k, .26, reducedMotion ? .35 : .75);
      const gy = heightAt(front.x, front.z); if (front.y - gy < R * 4) shock(front.x, front.z, R * 6, now);
    } else {
      if (swing.crunchClock <= 0) { swing.crunchClock = .1; audio.play('crunch', Math.min(1.2, count / 40 + speed / 50)); }
      for (let i = 0, m = Math.min(mobile ? 6 : 10, 2 + count / 8); i < m; i++) dust.spawn(front.x + rnd(-R, R) * .6, front.y + rnd(-R, R) * .6, front.z + rnd(-R, R) * .6, -moveDir.x * speed * .15 + rnd(-3, 3), rnd(1, 4), -moveDir.z * speed * .15 + rnd(-3, 3), rnd(2, 3.4) * R * .5, R * .9, rnd(1.6, 2.8), .55, .74, .72, .69, 1.4, .5);
      if (Math.random() < .45) addChunk(front.x, front.y, front.z, -moveDir.x * rnd(5, 10) + rnd(-3, 3), rnd(3, 9), -moveDir.z * rnd(5, 10) + rnd(-3, 3), rnd(.4, .9));
      if (Math.random() < .3) sparks.spawn(front.x, front.y, front.z, rnd(-6, 6), rnd(2, 8), rnd(-6, 6), .3, -.2, .3, 1, 1, .78, .42, 1.2, -20);
    }
  }
  function flushDamage() {
    if (!agg.count) return;
    const res = { count: agg.count, weight: agg.weight, affected: agg.affected.slice(), cleared: agg.cleared.slice() };
    agg.count = 0; agg.weight = 0; agg.affected.length = 0; agg.cleared.length = 0;
    onDamage(res, { kind: 'swing', point: aggPoint, normal: aggNormal, radius: cr.R * T.bite, force: T.force, feedback: true });
  }
  function finishRecord(now) {
    if (swing.recorded === swing.id || swing.releaseAt < 0) return; swing.recorded = swing.id;
    history.push(swing.rec = { id: swing.id, mode: swing.mode, target: swing.target, tapToRelease: +(swing.releaseAt - swing.tapAt).toFixed(3), tapToImpact: swing.impactAt >= 0 ? +(swing.impactAt - swing.tapAt).toFixed(3) : null,
      pct: +(swing.weight / campus.totalWeight * 100).toFixed(3), pieces: swing.pieces, slams: swing.slams, shield: swing.shield, buildings: swing.buildings.slice(), plan: swing.plan,
      crossings: swing.crossings, jerks: swing.jerks, haulStep: +swing.haulStep.toFixed(3), restOffset: +Math.hypot(bp.x - cr.tip.x, bp.z - cr.tip.z).toFixed(3), restSpeed: +bv.length().toFixed(3) });
    if (history.length > 16) history.shift();
  }

  // ---------- update ----------
  function timeScale(now) {
    if (now < freezeUntil) return 0;
    if (now < slowUntil) { const t = 1 - (slowUntil - now) / Math.max(.01, T.slowmo); return .35 + .65 * t * t; }
    return 1;
  }
  const trackPrev = new V3();
  function moveTracks(dt) {
    const dx = cr.base.x - trackPrev.x, dz = cr.base.z - trackPrev.z, along = dx * Math.sin(cr.lowerYaw) + dz * Math.cos(cr.lowerYaw), turn = angDiff(trackPrev.y, cr.lowerYaw) * 2.65;
    trackPrev.set(cr.base.x, cr.lowerYaw, cr.base.z); cr.trackL += (along + turn) * 7 / 8.6; cr.trackR += (along - turn) * 7 / 8.6; // trackPrev.y = the yaw
    // dust kicked up behind the tracks while driving
    if (Math.abs(along) > .02 && dt > 0 && Math.random() < Math.min(1, Math.abs(along) * 3)) {
      const sy = Math.sin(cr.lowerYaw), cy = Math.cos(cr.lowerYaw), back = along > 0 ? -1 : 1;
      for (const s of [-1, 1]) { const x = cr.base.x + cy * s * 2.65 + sy * back * 4.4, z = cr.base.z - sy * s * 2.65 + cy * back * 4.4; dust.spawn(x, heightAt(x, z) + .4, z, sy * back * 3 + rnd(-1, 1), rnd(.5, 1.6), cy * back * 3 + rnd(-1, 1), 1.3, 2.2, rnd(.8, 1.4), .4, .76, .72, .64, 2.2, .35); }
    }
  }
  function settleDust(now, squash = true) {
    if (squash) cr.squash = 1;
    for (let i = 0; i < (mobile ? 14 : 22); i++) { const a = rnd(0, 6.28), rr = rnd(4, 6), x = cr.base.x + Math.cos(a) * rr, z = cr.base.z + Math.sin(a) * rr, gy = heightAt(x, z); dust.spawn(x, gy + .4, z, Math.cos(a) * rnd(3, 7), rnd(.3, 1.4), Math.sin(a) * rnd(3, 7), rnd(1.2, 2), 2, rnd(.9, 1.5), .45, .8, .76, .66, 2.4, .4); }
  }
  function stepPhase(dt, now) {
    if (phase === 'none' || phase === 'gone') return;
    pt += dt; const k = clamp(pt / dur, 0, 1), SUB = 1 / 240;
    const physics = (damp, hit) => { if (dt > 0) hold.v.subVectors(cr.tip, tipPrev).divideScalar(dt); let left = dt; while (left > 1e-6) { const h = Math.min(SUB, left); left -= h; swing.hitClock -= h; swing.crunchClock -= h; stepBall(h, damp, hit, now); } };
    switch (phase) {
      case 'enter': {
        if (enterMode === 'drive') {
          const e = 1 - Math.pow(1 - k, 2.2); cr.base.lerpVectors(from.base, to.base, e); tilt(cr.base.x, cr.base.z, cr.lowerYaw, tl); cr.y = tl.y; cr.pitch = tl.pitch; cr.roll = tl.roll; knockAlong(now);
        } else { cr.lift = 7 * Math.pow(1 - k, 2); }
        carriedTip(cr.tip, boomLen); cr.tip.y += cr.lift; boomDirty = true; hold.on = true; physics(T.damping * 3, false); hold.on = false;
        if (k >= 1) { cr.lift = 0; settleDust(now); knockAlong(now); for (const o of knockQueue.splice(0)) knock(o, cr.base.x, cr.base.z, now); audio.play('land', enterMode === 'drive' ? .5 : .8); if (enterMode === 'lower') onKick('land');
          snapshotFrom(); to.houseYaw = Math.atan2(cr.P.x - cr.base.x, cr.P.z - cr.base.z); startSettle(); }
        break;
      }
      case 'settle': {
        const kk = smooth(k); cr.houseYaw = angleLerp(from.houseYaw, to.houseYaw, kk); cr.tip.lerpVectors(from.tip, cr.P, kk); boomDirty = true; haul(smooth(Math.min(1, k * 1.1)));
        if (k >= 1) { cr.tip.copy(cr.P); startPhase('windup', T.windup); }
        break;
      }
      case 'turn': {
        const kk = smooth(k); cr.houseYaw = angleLerp(from.houseYaw, to.houseYaw, kk); cr.P.lerpVectors(from.P, to.P, kk); cr.tip.copy(cr.P); lerpW(kk); boomDirty = true; haul(kk);
        if (k >= 1) { cr.P.copy(to.P); cr.tip.copy(cr.P); cr.w.copy(to.w); startPhase('windup', T.windup); }
        break;
      }
      case 'move': {
        // round 3: pivot (or back up), boom down over the heading, accelerate / cruise / brake, then 'settle' raises it
        const t = pt, y0 = cr.lowerYaw, h0 = cr.houseYaw;
        cr.lowerYaw = mv.tp > 0 ? angleLerp(mv.fromYaw, mv.trackYaw, smooth(t / mv.tp)) : mv.trackYaw;
        cr.houseYaw = angleLerp(from.houseYaw, mv.houseTo, smooth(t / mv.ths));
        travelAt(t - mv.t0, mv.d, T.travelAccel, T.travelSpeed, prof);
        cr.base.set(from.base.x + mv.ux * prof.s, 0, from.base.z + mv.uz * prof.s); tilt(cr.base.x, cr.base.z, cr.lowerYaw, tl);
        cr.y = tl.y; cr.pitch = tl.pitch + prof.a * T.pitchDip * mv.rev; cr.roll = tl.roll;
        carriedTip(carried, boomLen, T.travelLuff * DEG); cr.tip.lerpVectors(from.tip, carried, smooth(t / T.lowerTime)); boomDirty = true; knockAlong(now);
        hold.on = true; physics(T.damping * 3, false); hold.on = false;
        if (moveLog && dt > 0) { moveLog.peak = Math.max(moveLog.peak, +prof.v.toFixed(1)); moveLog.pivotRate = Math.max(moveLog.pivotRate, Math.round(Math.abs(angDiff(y0, cr.lowerYaw)) / dt / DEG)); moveLog.slewRate = Math.max(moveLog.slewRate, Math.round(Math.abs(angDiff(h0, cr.houseYaw)) / dt / DEG));
          if (t > T.lowerTime) moveLog.sway = Math.max(moveLog.sway, +(Math.atan2(Math.hypot(bp.x - cr.tip.x, bp.z - cr.tip.z), cr.tip.y - bp.y) / DEG).toFixed(1)); }
        if (k >= 1) { cr.base.set(to.base.x, 0, to.base.z); cr.lowerYaw = mv.trackYaw; cr.pitch = tl.pitch; cr.P.copy(to.P); cr.w.copy(to.w); settleDust(now, false); snapshotFrom(); to.houseYaw = Math.atan2(cr.P.x - cr.base.x, cr.P.z - cr.base.z); startSettle(true); }
        break;
      }
      case 'windup': {
        haul(1, 3 * DEG * smooth(k));
        if (k >= 1) release(now);
        break;
      }
      case 'swing': case 'rest': {
        const since = now - swing.releaseAt;
        if (phase === 'rest') { bv.addScaledVector(cr.w, Math.sin(now * 1.3) * .35 * dt); } // a breath of sway
        physics(since < 1.4 ? T.damping : T.restDamp, true);
        // vertical crossings of the follow-through (for the check) and debris shaken off the ball after it came out of a wall
        // (sign changes with a little hysteresis; the finished record keeps counting while the ball settles)
        const sd = (bp.x - cr.tip.x) * cr.w.x + (bp.z - cr.tip.z) * cr.w.z, s = sd > .15 ? 1 : sd < -.15 ? -1 : 0;
        if (s && s !== swing.side) { if (swing.side) { swing.crossings++; if (swing.rec && swing.recorded === swing.id) swing.rec.crossings = swing.crossings; } swing.side = s; }
        if (!swing.passed && s < 0) swing.passed = true;
        if (!swing.whooshed && phase === 'swing') { swing.whooshed = true; audio.play('whoosh', .55, 1); }
        if (now - lastContact < 1.4 && now - lastContact > .1 && bv.lengthSq() > 9 && Math.random() < dt * 9) addChunk(bp.x + rnd(-1, 1) * cr.R * .6, bp.y + cr.R * rnd(.2, .8), bp.z + rnd(-1, 1) * cr.R * .6, bv.x * .4 + rnd(-1.5, 1.5), rnd(0, 2), bv.z * .4 + rnd(-1.5, 1.5), rnd(.25, .55));
        if (now - lastContact < 1.4 && Math.random() < dt * 6) dust.spawn(bp.x, bp.y + cr.R * .6, bp.z, bv.x * .2, -1, bv.z * .2, 1.2, 1.6, rnd(.8, 1.3), .35, .74, .72, .69, 1.4, -1);
        if (phase === 'swing' && (since > 3 || (since > 1.2 && bv.length() < 2.5))) { finishRecord(now); phase = 'rest'; pt = 0; }
        if (phase === 'rest' && !active) { finishRecord(now); spawnDeparter(now); phase = 'gone'; setCraneVisible(false); } // put away: it drives off
        break;
      }
    }
  }
  function release(now) {
    phase = 'swing'; pt = 0; bv.set(0, 0, 0); swing.releaseAt = now; swing.whooshed = false; swing.hitClock = 0; swing.crunchClock = 0; swing.side = 0; slack = false;
    audio.play('snap'); vm.flick = 1;
  }
  function update(simDt, realDt, now = performance.now() / 1000) {
    lastNow = now;
    const scale = timeScale(now), dt = Math.max(0, Math.min(.05, (Number.isFinite(simDt) ? simDt : 0) * scale)), rdt = Math.max(0, Math.min(.1, Number.isFinite(realDt) ? realDt : 0));
    if (phase !== 'none' && phase !== 'gone') {
      stepPhase(dt, now);
      if (cr.squash > 0) cr.squash = Math.max(0, cr.squash - rdt * 6);
      moveTracks(dt);
      if (phase !== 'gone' && phase !== 'none') draw();
      flushDamage();
      // exhaust: a few dark puffs, more when the engine revs
      const rev = phase === 'rest' ? 0 : phase === 'swing' ? .2 : 1;
      if (C.root.visible) {
        exhaustAcc += dt * (rev > .5 ? 14 : 2.5);
        while (exhaustAcc >= 1) { exhaustAcc--; C.house.localToWorld(tA.copy(C.exhaust)); const c = .26 + Math.random() * .1; dust.spawn(tA.x, tA.y, tA.z, rnd(-.4, .4) + .8, rnd(2.5, 4) + rev * 2, rnd(-.4, .4) + .4, rev > .5 ? .9 : .6, 1.3, rnd(1.1, 1.8), rev > .5 ? .5 : .32, c, c, c * 1.05, .8, .6); }
      }
      engineSync(now, rev);
    } else engineSync(now, 0);
    tipPrev.copy(cr.tip); for (const g of departers) updateDeparter(g, dt, now);
    updateChunks(dt); updateFlashes(rdt); if (falling.length) updateFalling(dt);
    dust.points.material.uniforms.uScale.value = sparks.points.material.uniforms.uScale.value = (globalThis.innerHeight || 800) * pixelRatio() / (2 * Math.tan(camera.fov * Math.PI / 360));
    dust.update(dt); sparks.update(dt);
    for (const d of cracks) if (d.visible) { const age = now - d.userData.born; d.material.opacity = age < 12 ? 1 : Math.max(0, 1 - (age - 12) / 5); if (d.material.opacity <= 0) d.visible = false; }
    for (const g of rings) if (g.visible) { const t = (now - g.userData.born) / .6; if (t >= 1) { g.visible = false; continue; } g.userData.place(g.userData.x, g.userData.z, g.userData.size * (.25 + .75 * Math.sqrt(t)), g.userData.size * (.25 + .75 * Math.sqrt(t)), 0, .3); g.material.opacity = (1 - t) * .85; }
    if (visible) poseRemote(rdt);
  }
  // selected: the wrecking ball is the weapon in hand; free: no dialog / nuke / hidden page (held remote + idle sound)
  function setState(selected, free) {
    const a = !!selected, v = a && !!free;
    if (v !== visible) { visible = v; vmRoot.visible = v; vm.has = false; if (v) poseRemote(0); }
    if (a !== active) {
      active = a; if (a) refreshBoxes();
      // put away (another weapon, nuke): every crane on the campus vanishes at once; debris already flying keeps falling
      if (!a) { next = null; if (phase !== 'none' && phase !== 'gone') { if (swing.releaseAt >= 0) finishRecord(lastNow); phase = 'gone'; setCraneVisible(false); } clearDeparters(); knockQueue = []; }
    }
    if (!v && engine) { engine.stop(); engine = null; }
  }
  function render(renderer) {
    if (!visible) return false;
    // follow the camera as rendered: the screen kick moves it after update(), and a remote posed 2 units in front of the
    // un-kicked camera would jump by the kick scaled to that short depth (user 10-19: the remote shook too much on impact)
    camera.getWorldQuaternion(camQ); camera.getWorldPosition(camPos); vmRoot.position.copy(camPos); vmRoot.quaternion.copy(camQ); vmRoot.updateMatrixWorld(true);
    overlayCamera.projectionMatrix.copy(camera.projectionMatrix); overlayCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    overlayCamera.matrixWorld.copy(camera.matrixWorld); overlayCamera.matrixWorldInverse.copy(camera.matrixWorldInverse);
    const autoClear = renderer.autoClear;
    try { renderer.autoClear = false; renderer.clearDepth(); renderer.render(overlayScene, overlayCamera); } finally { renderer.autoClear = autoClear; }
    return true;
  }
  function clear() {
    if (engine) { engine.stop(); engine = null; }
    phase = 'none'; pt = 0; next = null; setCraneVisible(false); clearDeparters(); cr.lift = 0; cr.squash = 0; bv.set(0, 0, 0); knockQueue = [];
    for (const c of chunks) c.on = false; chunkMesh.count = 0; dust.clear(); sparks.clear();
    for (const d of [...cracks, ...rings]) { d.visible = false; d.userData.born = -1e9; } for (const m of flashes) m.visible = false;
    freezeUntil = slowUntil = -1; agg.count = 0; agg.weight = 0; agg.affected.length = 0; agg.cleared.length = 0;
    standAll(); if (planner) refreshBoxes();
  }
  return {
    swing: swingAt, update, timeScale, setState, render, clear,
    // check / diagnostics: the planner on the live campus (building boxes refreshed for cleared buildings)
    planner() { refreshBoxes(); return planner; },
    get phase() { return phase; },
    get busy() { return phase !== 'none' && phase !== 'gone' && phase !== 'rest'; },
    get animating() { return visible || departers.some(g => g.on) || (phase !== 'none' && phase !== 'gone') || dust.count > 0 || sparks.count > 0 || chunkMesh.count > 0 || falling.length > 0 || flashes.some(m => m.visible) || rings.some(r => r.visible); },
    get stats() {
      const off = Math.hypot(bp.x - cr.tip.x, bp.z - cr.tip.z), hang = Math.atan2(off, cr.tip.y - bp.y) / DEG;
      return { phase, active, visible, swings, slams, shieldHits, rejected, noSpot, knocked, departs, departPops,
        departing: departers.filter(g => g.on).map(g => ({ x: +g.x.toFixed(2), z: +g.z.toFixed(2), s: +g.s.toFixed(1), len: +g.len.toFixed(1), out: g.final, parked: g.parked, v: +g.v.toFixed(1), t: +g.t.toFixed(2), sway: +g.sway.toFixed(1) })),
        obstacles: obstacles?.length ?? null, boxes: boxes?.length ?? null, plan: lastPlan, last: history.at(-1) || null, history: history.slice(),
        crane: phase === 'none' || phase === 'gone' ? null : { x: +cr.base.x.toFixed(2), y: +cr.y.toFixed(2), z: +cr.base.z.toFixed(2), yaw: +cr.lowerYaw.toFixed(3), houseYaw: +cr.houseYaw.toFixed(3), lift: +cr.lift.toFixed(2), enter: enterMode,
          theta: +hang.toFixed(1), slack, grounded: bp.y - cr.R <= heightAt(bp.x, bp.z) + .05, ball: [+bp.x.toFixed(2), +bp.y.toFixed(2), +bp.z.toFixed(2)], speed: +bv.length().toFixed(2), tip: [+cr.tip.x.toFixed(2), +cr.tip.y.toFixed(2), +cr.tip.z.toFixed(2)] },
        particles: { dust: dust.count, sparks: sparks.count, chunks: chunkMesh.count, boom: boom.count, falling: falling.length }, engine: !!engine, voices: audio.voices, timing: swingTiming(T) };
    },
    dispose() { clear(); for (const o of [C.root, ...departers.flatMap(g => g.parts), boom, pendL, pendR, hangSeg, tag, ropeUp, hook, chain, ball, craneShadow, ballShadow, ...cracks, ...rings, dust.points, sparks.points, chunkMesh, ...flashes]) scene.remove(o); overlayScene.clear(); for (const o of owned) o.dispose?.(); },
  };
}
