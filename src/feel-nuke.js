// Tsar Bomba footage-inspired visual sequence, generated entirely in shaders/geometry.
// Reuses the original projectile, impact clock, destruction and seven-second aftermath.
// One sorted puff batch + dust band + sphere + three translucent Wilson cloud disks + dome + halo + flash.
// Separate phone budgets; no texture files, render targets, or per-frame GPU allocations.
import { getNuclearCloudEnvelope } from './nuclear-effects.js?v=mini24b';
import { WEAPON_TUNING } from './weapon-tuning.js?v=sn130';
const T = WEAPON_TUNING.nuke;
const TABLE_R = 48;
// Wall cross-section: trailing dust → steep advancing front.
const BAND_P = [0, .3, .55, .74, .86, .94, 1];
const BAND_H = [0, .22, .5, .82, 1, .78, .08];
const BAND_A = [0, .3, .55, .82, 1, .9, 0];
const ROWS = BAND_P.length;
const SUN = [-310, 85, 125]; // default golden hour; runtime passes the live time-of-day offset
const smooth01 = x => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

// Render-only envelope: exposure is restored immediately after rendering, never saved as a setting.
export function nukeScreenState(post, reducedMotion = false) {
  if (!Number.isFinite(post) || post < 0 || post > T.warmSeconds) return { white: 0, warm: 0, exposure: 1 };
  const white = 1 - smooth01(post / T.whiteSeconds);
  const warm = smooth01(post / .055) * (1 - smooth01(post / T.warmSeconds));
  return { white: white * (reducedMotion ? .06 : .97), warm: warm * (reducedMotion ? .05 : .48),
    exposure: 1 + (reducedMotion ? .06 : T.exposure) * Math.exp(-post / .22) };
}

export function nukePixelRatio(ratio, width, height, mobile) {
  return Math.min(ratio, mobile ? T.pixelRatioPhone : T.pixelRatio,
    Math.sqrt((mobile ? T.pixelsPhone : T.pixels) / Math.max(1, width * height)));
}

// Preserve the fall/close blast, then compose the cap above a low campus foreground.
// This replaces the base rig's late distance; the growing dome never drives the camera.
export function frameNukeCloud(camera, shot, post, reducedMotion, framing) {
  if (!shot || post < 0 || reducedMotion) return;
  const lift = shot.distance * .13 * (1 - smooth01(post / 2.7));
  shot.target.y += lift; shot.position.y += lift;
  const dx = shot.position.x - shot.target.x, dz = shot.position.z - shot.target.z;
  const azimuth = Math.atan2(dx, dz);
  let elevation = shot.elevation, d = shot.distance;
  if (framing && post > 1.5) {
    const u = getNuclearCloudEnvelope(framing.worldRadius).unit;
    const tan = Math.tan(camera.fov * Math.PI / 360);
    const portrait = camera.aspect < 1;
    const endElevation = portrait ? .28 : .24;
    const sin = Math.sin(endElevation), cos = Math.cos(endElevation);
    // Place the impact foot at 78% (desktop) / 72% (portrait) of screen height.
    // Include the existing HUD view offset instead of changing the projection on return.
    const offset = camera.projectionMatrix.elements[9];
    const foot = (portrait ? .44 : .56) - offset;
    const targetSlope = foot * tan / (cos - foot * tan * sin);
    // Conservative cap envelope: centre 2.1u, half-width 1.65u, depth 1.35u,
    // top 3.1u. Only the cap must fit; peripheral condensation may leave the viewport.
    const horizontal = (1.65 / (tan * camera.aspect * (portrait ? .99 : .92)) + 2.1 * sin + 1.35 * cos) / (1 + targetSlope * sin);
    const top = .78 + offset;
    const vertical = (3.1 * (cos + top * tan * sin) + 1.35 * Math.abs(top * tan * cos - sin)) /
      (targetSlope * cos + top * tan * (1 + targetSlope * sin));
    const endDistance = u * Math.max(horizontal, vertical);
    const compose = smooth01((post - 1.5) / 1.9);
    d += (endDistance - d) * compose;
    elevation += (endElevation - elevation) * compose;
    shot.target.y += (framing.groundY + endDistance * targetSlope - shot.target.y) * compose;
  }
  shot.distance = d; shot.elevation = elevation;
  shot.position.set(shot.target.x + Math.sin(azimuth) * Math.cos(elevation) * d,
    shot.target.y + Math.sin(elevation) * d, shot.target.z + Math.cos(azimuth) * Math.cos(elevation) * d);
  camera.position.copy(shot.position); camera.lookAt(shot.target); camera.updateMatrixWorld(true);
}

const NOISE = `
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
`;
const FOG = `uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform float uFogAmount;`;

const PUFF_VERTEX = `
attribute vec4 iPos; attribute vec4 iA; attribute vec4 iC;
varying vec2 vUv; varying vec4 vA; varying vec4 vC; varying float vDepth;
void main(){
  vUv=uv; vC=iC;
  vec4 mv=modelViewMatrix*vec4(iPos.xyz,1.0);
  float s=sin(iA.w),c=cos(iA.w); vec2 q=position.xy*vec2(iA.x,iA.x*iPos.w); // w: vertical squash
  mv.xy+=vec2(c*q.x-s*q.y,s*q.x+c*q.y);
  float depth=-mv.z; mv.z+=min(iA.x*.45,depth*.3); // keeps low puffs from slicing into the ground
  vA=vec4(iA.y*smoothstep(iA.x*.6,iA.x*2.6,depth),iA.z,s,c); // thinner when the camera is inside
  vDepth=depth;
  gl_Position=projectionMatrix*mv;
}`;
const PUFF_FRAGMENT = `
uniform float uTime; uniform vec3 uSun; ${FOG}
varying vec2 vUv; varying vec4 vA; varying vec4 vC; varying float vDepth;
${NOISE}
void main(){
  vec2 c=vUv*2.0-1.0; float r2=dot(c,c); if(r2>1.0)discard;
  float seed=vA.y;
  vec2 np=c*3.1+seed*vec2(37.1,91.7)+vec2(sin(uTime*.4+c.y)*.22,-uTime*.23);
  float n=vnoise(np)*.46+vnoise(np*2.07+vec2(17.0,9.0))*.29+vnoise(np*4.3+vec2(3.0,41.0))*.16+vnoise(np*8.6)*.09;
  float body=(1.0-r2)*1.3+(n-.5)*1.65-.12;
  float a=smoothstep(0.0,.36,body)*(1.0-smoothstep(.72,1.0,r2));
  // Lumpy-sphere normal in view space (quad roll undone), lit by the scene sun + sky.
  vec2 cs=vec2(c.x*vA.w-c.y*vA.z,c.x*vA.z+c.y*vA.w);
  float dz=sqrt(max(0.0,1.0-r2));
  vec3 nrm=normalize(vec3(cs*(.55+(n-.5)*1.1),dz+.35));
  float sun=clamp(dot(nrm,uSun),0.0,1.0);
  float shade=vC.x, dirt=vC.w;
  // Sun wrap + sky from above, scaled by the puff's place in the cloud (top lit, underside/inside in shade).
  float sunWrap=clamp(sun*.75+.25*(nrm.y*.5+.5),0.0,1.0);
  float lit=clamp(mix(.1,1.0,shade)*(.3+.7*sunWrap)+(n-.5)*.2*shade,0.0,1.0);
  // A displaced noise sample approximates self-occlusion along the light direction.
  float occlusion=clamp((vnoise(np+uSun.xy*.3)-n)*2.4,0.0,.7);
  lit*=(1.0-occlusion)*(.14+.86*smoothstep(.27,.76,n));
  vec3 dark=mix(vec3(.075,.042,.025),vec3(.14,.095,.065),dirt);
  vec3 light=mix(vec3(.76,.43,.22),vec3(.66,.53,.37),dirt);
  vec3 col=mix(dark,light,lit);
  // Orange light from the fireball below/inside the cap, on downward-facing surfaces only.
  col+=vec3(1.18,.30,.045)*vC.z*clamp(.4-nrm.y*.8,0.0,1.0)*(.35+n*.9);
  // Incandescence: white → yellow → orange → dark red → (cool smoke); hot cores are uneven.
  float h=clamp(vC.y*(.6+.8*n)*(1.0-r2*.4),0.0,1.0);
  vec3 fire=h>.66?mix(vec3(2.6,1.25,.38),vec3(3.6,3.1,2.3),(h-.66)/.34)
          :h>.33?mix(vec3(.75,.12,.03),vec3(2.6,1.25,.38),(h-.33)/.33)
          :vec3(.75,.12,.03)*smoothstep(.04,.33,h);
  col=col*(1.0-clamp(vC.y*1.4,0.0,1.0))+fire;
  a*=vA.x*(1.0+vC.y*.15);
  col=mix(col,fogColor,smoothstep(fogNear,fogFar,vDepth)*uFogAmount);
  if(a<.004)discard;
  gl_FragColor=vec4(col,min(a,1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const BAND_VERTEX = `
attribute vec4 aD; varying vec4 vD; varying vec3 vLocal; varying float vDepth;
void main(){
  vD=aD; vLocal=position;
  vec4 mv=modelViewMatrix*vec4(position,1.0); vDepth=-mv.z;
  gl_Position=projectionMatrix*mv;
}`;
const BAND_FRAGMENT = `
uniform float uTime; uniform float uAlpha; uniform float uFlash; uniform float uScale; ${FOG}
varying vec4 vD; varying vec3 vLocal; varying float vDepth;
${NOISE}
void main(){
  vec2 xz=(vLocal.xz+vec2(vLocal.y*1.7,-vLocal.y*1.3))*uScale; // height enters the noise: no vertical streaks
  float n=vnoise(xz*.9+vec2(uTime*.35,-uTime*.2))*.5+vnoise(xz*2.3+vec2(7.0,uTime*.6))*.32+vnoise(xz*6.1+vec2(2.0,5.0))*.18;
  float hgt=vD.y;
  float dens=vD.x*(.4+1.05*n)*smoothstep(0.0,.35,1.12-hgt+(n-.5)*1.1); // ragged crest
  float a=smoothstep(.12,.55,dens)*uAlpha;
  vec3 col=mix(vec3(.2,.17,.14),vec3(.62,.54,.43),clamp(.15+.7*hgt+(n-.5)*.6,0.0,1.0));
  // Very short bright condensation/refraction line riding the front.
  float ring=smoothstep(.84,.95,vD.z)*(1.0-smoothstep(.97,1.0,vD.z))*vD.w*uFlash;
  col=mix(col,vec3(2.3,2.25,2.15),ring); a=max(a,ring*.75);
  col=mix(col,fogColor,smoothstep(fogNear,fogFar,vDepth)*uFogAmount);
  if(a<.004)discard;
  gl_FragColor=vec4(col,a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const SHELL_VERTEX = `
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main(){
  vec4 mv=modelViewMatrix*vec4(position,1.0);
  vN=normalize(normalMatrix*normal); vV=-mv.xyz; vP=position;
  gl_Position=projectionMatrix*mv;
}`;
const SHELL_FRAGMENT = `
uniform float uAlpha; uniform float uTime;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
${NOISE}
void main(){
  float f=1.0-abs(dot(normalize(vN),normalize(vV)));
  float n=vnoise(vP.xz*3.1+vP.y*2.0+uTime*.4)*.6+vnoise(vP.xy*7.0+vec2(4.0,uTime))*.4;
  float a=(pow(f,2.0)*.85+.12)*(.5+.5*smoothstep(.2,.75,n))*uAlpha*smoothstep(-.12,.08,vP.y);
  if(a<.004)discard;
  gl_FragColor=vec4(vec3(.93,.94,.96)*mix(.78,1.08,vN.y*.5+.5),a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const GLOW_VERTEX = `
uniform float uSize; varying vec2 vUv;
void main(){
  vUv=uv; vec4 mv=modelViewMatrix*vec4(0.0,0.0,0.0,1.0); mv.xy+=position.xy*uSize;
  gl_Position=projectionMatrix*mv;
}`;
const GLOW_FRAGMENT = `
uniform vec3 uColor; varying vec2 vUv;
void main(){
  float r=length(vUv*2.0-1.0); float a=pow(max(0.0,1.0-r),2.2);
  if(a<.003)discard;
  gl_FragColor=vec4(uColor*a,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const BALL_VERTEX = `
uniform float uTime;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
${NOISE}
void main(){
  vec3 q=position;
  float boil=vnoise(q.xy*4.0+q.z*2.0+vec2(uTime*.7,-uTime*.9));
  float lobe=sin(q.x*8.0+uTime*2.3)*sin(q.y*7.0-uTime*1.7)*sin(q.z*6.0+uTime);
  vec3 p=q*(1.0+(boil-.5)*.045+lobe*.009);
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  vN=normalize(normalMatrix*normal);vV=-mv.xyz;vP=q;
  gl_Position=projectionMatrix*mv;
}`;
const BALL_FRAGMENT = `
uniform float uAlpha; uniform float uHeat; uniform float uTime;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
${NOISE}
void main(){
  vec2 p=vP.xy*6.0+vP.z*vec2(2.7,-3.1)+vec2(sin(uTime+vP.y)*.2,-uTime*.8);
  float n=vnoise(p)*.52+vnoise(p*2.13+uTime*.3)*.3+vnoise(p*4.7)*.18;
  float facing=max(0.0,dot(normalize(vN),normalize(vV)));
  float rim=pow(1.0-facing,.72);
  float cells=smoothstep(.25,.78,n);
  // White is confined to the core. The limb retains dark amber pockets and yellow rolling cells.
  vec3 limb=mix(vec3(.24,.025,.003),vec3(1.85,.52,.025),cells);
  vec3 inner=mix(vec3(1.2,.36,.035),vec3(3.2,1.6,.3),cells);
  vec3 c=mix(inner,limb,smoothstep(.22,.95,rim));
  float core=smoothstep(.85,.99,facing)*( .72+.28*cells);
  c=mix(c,vec3(7.0,5.8,3.6),core*uHeat);
  c*=.8+.2*uHeat;
  gl_FragColor=vec4(c,uAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
// User 10-24: the late expanding condensation dome and the Wilson ring disks around the rising cloud are off;
// ?nukedome=1 / ?nukerings=1 bring them back for comparison.
const NUKE_QUERY = new URLSearchParams(globalThis.location?.search || '');
const SHOW_DOME = NUKE_QUERY.get('nukedome') === '1', SHOW_RINGS = NUKE_QUERY.get('nukerings') === '1';
const RING_VERTEX = `
uniform float uTime; uniform float uSeed;
varying vec3 vP; varying float vNear; varying float vBottom;
void main(){
  vec3 p=position;float r=length(p.xy),angle=atan(p.y,p.x);
  p.xy*=1.0+sin(angle*7.0+uSeed+uTime*.3)*.024+sin(angle*13.0-uTime*.2)*.012;
  // A broad radial sheet, with a shallow billow instead of a torus tube.
  p.z=sin(clamp((r-.25)/.75,0.0,1.0)*3.14159)*(.028+.012*sin(angle*9.0+uSeed));
  vP=p;
  vec4 world=modelMatrix*vec4(p,1.0);vec3 center=modelMatrix[3].xyz;
  vNear=dot(normalize(cameraPosition.xz-center.xz),world.xz-center.xz);
  vBottom=step(cameraPosition.y,center.y);
  gl_Position=projectionMatrix*viewMatrix*world;
}`;
const RING_FRAGMENT = `
uniform float uTime; uniform float uAlpha; uniform float uSeed; uniform float uHalf;
varying vec3 vP; varying float vNear; varying float vBottom;
${NOISE}
void main(){
  // Far half behind the puff batch; near half in front. No opaque depth mask in the cloud.
  if(vNear*uHalf<0.0)discard;
  vec2 p=vP.xy*7.0+uSeed+vec2(uTime*.13,-uTime*.09);
  float n=vnoise(p)*.5+vnoise(p*2.3)*.3+vnoise(p*5.1)*.2;
  float r=length(vP.xy),distort=(n-.5)*.20;
  float outer=1.0-smoothstep(.74+distort,1.0+distort,r);
  float inner=smoothstep(.27+distort,.48+distort,r);
  float wisps=smoothstep(.20,.69,n);
  float a=outer*inner*(.18+.82*wisps)*uAlpha;
  if(a<.004)discard;
  float warm=(1.0-smoothstep(.38,.93,r))*(.5+.5*vBottom);
  vec3 col=mix(vec3(.52,.56,.59),vec3(1.02,.99,.88),n);
  col=mix(col,vec3(1.25,.40,.09),warm*.62);
  gl_FragColor=vec4(col,a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const FLASH_VERTEX = `void main(){gl_Position=vec4(position.xy,0.0,1.0);}`;
const FLASH_FRAGMENT = `uniform float uWhite; uniform float uWarm;
void main(){float a=uWhite+uWarm*(1.0-uWhite);
 gl_FragColor=vec4(mix(vec3(1.0,.39,.045),vec3(1.0,.99,.93),uWhite/max(a,.001)),a);}`;

/** Returns the nuclear look hook for effects.js: (args, options, baseFactory) → effect. */
export function createFeelNuke(THREE, { grid = null, mobile = false, sunOffset = SUN } = {}) {
  return function createFeelNuclearEffect(args, options = {}, base) {
    const effect = base(THREE, args, options);
    try { upgrade(THREE, effect, args, options, grid, mobile, sunOffset); } catch (error) { console.warn('feel-nuke fallback', error); }
    return effect;
  };
}

function upgrade(THREE, effect, { point, camera, groundHeight }, { reducedMotion = false }, grid, mobile, sunOffset) {
  const CAP_RING = mobile ? T.capRingPhone : T.capRing, CAP_TUBE = 3, CAP_FILL = 7;
  const STEM = mobile ? T.stemPhone : T.stem, SKIRT = mobile ? T.skirtPhone : T.skirt;
  const WALL_PUFFS = mobile ? T.wallPuffsPhone : T.wallPuffs;
  const PUFFS = CAP_RING * CAP_TUBE + CAP_FILL + STEM + SKIRT + WALL_PUFFS;
  const BAND_ANGLES = mobile ? T.bandAnglesPhone : T.bandAngles;
  const group = effect.group, impact = effect.impact, aftermath = effect.duration - impact;
  const u = group.userData.cloudUnit || 28;
  const old = ['nuclear-fireball', 'nuclear-rising-smoke', 'nuclear-ground-dust', 'nuclear-condensation'].map(name => group.getObjectByName(name)).filter(Boolean);
  for (const batch of old) { batch.count = 0; batch.visible = false; } // loops in the base animate become no-ops
  const heightAt = typeof groundHeight === 'function' ? groundHeight : () => point.y;
  const groundAt = (x, z) => { const h = heightAt(point.x + x, point.z + z); return Number.isFinite(h) ? h - point.y : 0; };
  const gb = groundAt(0, 0);
  const keep = (set, value) => (set.add(value), value);
  const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  const hash = (a, b) => { const n = Math.sin(a * 127.1 + b * 311.7 + 19.17) * 43758.5453; return n - Math.floor(n); };
  const fogUniforms = () => ({ fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 2000 }, fogDensity: { value: 0 } });
  const timeUniform = { value: 0 }, sunUniform = { value: new THREE.Vector3(0, 1, 0) };

  // Shock-front reach mirrors campus-finale's scorch radius (farthest terrain corner + 10).
  let reach = effect.blastRadius;
  const bounds = grid && [grid.minX, grid.maxX, grid.minZ, grid.maxZ].every(Number.isFinite) ? grid : null;
  if (bounds) { reach = 0; for (const x of [bounds.minX, bounds.maxX]) for (const z of [bounds.minZ, bounds.maxZ]) reach = Math.max(reach, Math.hypot(x - point.x, z - point.z)); reach += 10; }
  const WAVE_SECONDS = 1.4; // campus.startFinale duration in main.js
  const margin = bounds ? Math.max(8, (bounds.maxX - bounds.minX) * .035) : 1;
  const inside = (x, z) => bounds ? smooth((point.x + x - bounds.minX) / margin) * smooth((bounds.maxX - point.x - x) / margin) * smooth((point.z + z - bounds.minZ) / margin) * smooth((bounds.maxZ - point.z - z) / margin) : 1;
  // Polar terrain table, sampled once while the projectile is still falling.
  const tableMax = reach * 1.2, ground = new Float32Array(BAND_ANGLES * TABLE_R), dirs = new Float32Array(BAND_ANGLES * 2);
  for (let i = 0; i < BAND_ANGLES; i++) {
    const a = i / BAND_ANGLES * Math.PI * 2; dirs[i * 2] = Math.cos(a); dirs[i * 2 + 1] = Math.sin(a);
    for (let j = 0; j < TABLE_R; j++) { const r = j / (TABLE_R - 1) * tableMax; ground[i * TABLE_R + j] = groundAt(dirs[i * 2] * r, dirs[i * 2 + 1] * r); }
  }
  const groundPolar = (i, r) => { const f = Math.max(0, Math.min(TABLE_R - 1.001, r / tableMax * (TABLE_R - 1))), j = Math.floor(f), w = f - j, k = i * TABLE_R + j; return ground[k] + (ground[k + 1] - ground[k]) * w; };
  const groundAtAngle = (a, r) => { const f = ((a / (Math.PI * 2)) % 1 + 1) % 1 * BAND_ANGLES, i = Math.floor(f) % BAND_ANGLES, w = f - Math.floor(f); return groundPolar(i, r) * (1 - w) + groundPolar((i + 1) % BAND_ANGLES, r) * w; };

  // ── Puff pool (sorted back-to-front every frame) ──
  const plane = keep(effect.geometries, new THREE.PlaneGeometry(2, 2));
  const geometry = keep(effect.geometries, new THREE.InstancedBufferGeometry());
  geometry.index = plane.index; geometry.setAttribute('position', plane.getAttribute('position')); geometry.setAttribute('uv', plane.getAttribute('uv'));
  const attr = (size) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(PUFFS * size), size); a.setUsage(THREE.DynamicDrawUsage); return a; };
  const iPos = attr(4), iA = attr(4), iC = attr(4);
  geometry.setAttribute('iPos', iPos); geometry.setAttribute('iA', iA); geometry.setAttribute('iC', iC); geometry.instanceCount = 0;
  const puffMaterial = keep(effect.materials, new THREE.ShaderMaterial({ vertexShader: PUFF_VERTEX, fragmentShader: PUFF_FRAGMENT,
    uniforms: { uTime: timeUniform, uSun: sunUniform, uFogAmount: { value: .45 }, ...fogUniforms() }, transparent: true, depthWrite: false, fog: true }));
  const puffs = new THREE.Mesh(geometry, puffMaterial); puffs.name = 'feel-nuke-cloud'; puffs.frustumCulled = false; puffs.renderOrder = 4; group.add(puffs);
  // Logical state (local coordinates): position, radius, alpha, seed, roll, shade, heat, glow, dirt, view depth.
  const px = new Float32Array(PUFFS), py = new Float32Array(PUFFS), pz = new Float32Array(PUFFS), ps = new Float32Array(PUFFS), pa = new Float32Array(PUFFS), pq = new Float32Array(PUFFS);
  const proll = new Float32Array(PUFFS), pshade = new Float32Array(PUFFS), pheat = new Float32Array(PUFFS), pglow = new Float32Array(PUFFS), pdirt = new Float32Array(PUFFS);
  const depth = new Float32Array(PUFFS), order = new Uint16Array(PUFFS), live = new Uint16Array(PUFFS);
  for (let i = 0; i < PUFFS; i++) order[i] = i;
  const seedOf = i => hash(i, 3.7) * 10;

  // ── Dust wall band ──
  const bandVerts = BAND_ANGLES * ROWS, bandPos = new Float32Array(bandVerts * 3), bandData = new Float32Array(bandVerts * 4), bandIndex = [];
  for (let i = 0; i < BAND_ANGLES; i++) for (let k = 0; k < ROWS - 1; k++) {
    const a = i * ROWS + k, b = ((i + 1) % BAND_ANGLES) * ROWS + k; bandIndex.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const bandGeometry = keep(effect.geometries, new THREE.BufferGeometry());
  const bandPosAttr = new THREE.BufferAttribute(bandPos, 3), bandDataAttr = new THREE.BufferAttribute(bandData, 4);
  bandPosAttr.setUsage(THREE.DynamicDrawUsage); bandDataAttr.setUsage(THREE.DynamicDrawUsage);
  bandGeometry.setAttribute('position', bandPosAttr); bandGeometry.setAttribute('aD', bandDataAttr); bandGeometry.setIndex(bandIndex);
  const bandMaterial = keep(effect.materials, new THREE.ShaderMaterial({ vertexShader: BAND_VERTEX, fragmentShader: BAND_FRAGMENT,
    uniforms: { uTime: timeUniform, uAlpha: { value: 0 }, uFlash: { value: 0 }, uScale: { value: 1 / Math.max(8, u * .5) }, uFogAmount: { value: .55 }, ...fogUniforms() },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true }));
  const band = new THREE.Mesh(bandGeometry, bandMaterial); band.name = 'feel-nuke-shock-dust'; band.frustumCulled = false; band.renderOrder = 3; group.add(band);

  // ── Wilson condensation dome + fireball halo ──
  const shellMaterial = keep(effect.materials, new THREE.ShaderMaterial({ vertexShader: SHELL_VERTEX, fragmentShader: SHELL_FRAGMENT,
    uniforms: { uAlpha: { value: 0 }, uTime: timeUniform }, transparent: true, depthWrite: false, side: THREE.FrontSide }));
  const shell = new THREE.Mesh(keep(effect.geometries, new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI * .5)), shellMaterial);
  shell.name = 'feel-nuke-condensation-dome'; shell.renderOrder = 5; shell.frustumCulled = false; group.add(shell);
  const glowMaterial = keep(effect.materials, new THREE.ShaderMaterial({ vertexShader: GLOW_VERTEX, fragmentShader: GLOW_FRAGMENT,
    uniforms: { uSize: { value: 1 }, uColor: { value: new THREE.Color() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const glow = new THREE.Mesh(plane, glowMaterial); glow.name = 'feel-nuke-fire-glow'; glow.renderOrder = 6; glow.frustumCulled = false; group.add(glow);
  const ballMaterial = keep(effect.materials, new THREE.ShaderMaterial({ vertexShader: BALL_VERTEX, fragmentShader: BALL_FRAGMENT,
    uniforms: { uAlpha: { value: 0 }, uHeat: { value: 1 }, uTime: timeUniform }, transparent: true, depthWrite: false }));
  const fireball = new THREE.Mesh(keep(effect.geometries, new THREE.SphereGeometry(1, mobile ? 48 : 64, mobile ? 32 : 40)), ballMaterial);
  fireball.name = 'feel-nuke-white-fireball'; fireball.renderOrder = 5; fireball.frustumCulled = false; group.add(fireball);
  const ringGeometry = keep(effect.geometries, new THREE.RingGeometry(.25, 1.05, mobile ? 64 : 96, 8));
  const rings = [], ringBacks = [];
  for (let i = 0; i < (SHOW_RINGS ? T.rings : 0); i++) {
    const alpha = { value: 0 };
    for (const half of [-1, 1]) {
      const material = keep(effect.materials, new THREE.ShaderMaterial({ vertexShader: RING_VERTEX, fragmentShader: RING_FRAGMENT,
        uniforms: { uTime: timeUniform, uAlpha: alpha, uSeed: { value: i * 4.31 }, uHalf: { value: half } },
        transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      const ring = new THREE.Mesh(ringGeometry, material); ring.name = `feel-nuke-wilson-${i}${half < 0 ? '-back' : ''}`;
      ring.rotation.x = -Math.PI / 2; ring.renderOrder = half < 0 ? 3.5 : 4.5;
      ring.frustumCulled = false; group.add(ring); (half < 0 ? ringBacks : rings).push(ring);
    }
  }
  const flashMaterial = keep(effect.materials, new THREE.ShaderMaterial({ vertexShader: FLASH_VERTEX, fragmentShader: FLASH_FRAGMENT,
    uniforms: { uWhite: { value: 0 }, uWarm: { value: 0 } }, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false }));
  const flash = new THREE.Mesh(plane, flashMaterial); flash.name = 'feel-nuke-screen-flash'; flash.frustumCulled = false;
  flash.renderOrder = 100; group.add(flash);
  const own = [puffs, band, shell, glow, fireball, ...rings, ...ringBacks, flash];
  effect.objects += own.length;

  const camPos = new THREE.Vector3(), camDir = new THREE.Vector3(), sunWorld = new THREE.Vector3(...sunOffset).normalize();
  const fadeWindow = Math.min(2.1, aftermath * .3);
  let warm = 2; // draw everything (invisibly) on the first frames so shaders compile before impact
  const stats = { puffs: 0, puffCap: PUFFS, mobile, rings: 0, frontRadius: 0, domeRadius: 0, phase: 0 };
  group.userData.feelNuke = stats;

  function setPuff(n, x, y, z, s, a, shade, heat, glowAmount, dirt, roll, squash = 1) {
    pq[n] = squash; px[n] = x; py[n] = y; pz[n] = z; ps[n] = s; pa[n] = a; pshade[n] = shade; pheat[n] = heat; pglow[n] = glowAmount; pdirt[n] = dirt; proll[n] = roll;
  }

  function animateFeel(t) {
    const contacted = t >= impact, ph = Math.max(0, t - impact);
    if (!contacted) {
      for (const object of own) object.visible = warm > 0;
      if (warm > 0) { warm--; geometry.instanceCount = 1; iA.array[1] = 0; iA.needsUpdate = true; bandMaterial.uniforms.uAlpha.value = 0; shellMaterial.uniforms.uAlpha.value = 0; glowMaterial.uniforms.uColor.value.setScalar(0); }
      return;
    }
    for (const object of own) object.visible = true;
    timeUniform.value = reducedMotion ? 0 : ph;
    if (camera) { camera.getWorldPosition(camPos); camera.getWorldDirection(camDir); sunWorld.set(...sunOffset).normalize(); sunUniform.value.copy(sunWorld).transformDirection(camera.matrixWorldInverse); }
    const fade = smooth((aftermath - ph) / fadeWindow), motion = reducedMotion ? 0 : 1;
    const drift = u * Math.min(ph, 5) * .025;
    // Fireball → cap timeline (seconds after impact).
    const heatNow = reducedMotion ? .5 * Math.exp(-ph / .5) : Math.exp(-ph / .7);
    const ember = (reducedMotion ? .18 : .28) * Math.exp(-ph / 3.2); // dull red still glowing inside the cap
    const underGlow = (reducedMotion ? .22 : 1.05) * Math.exp(-ph / 3.0);
    const ball = u * (.12 + .47 * (1 - Math.exp(-ph / .16)));
    const centre = gb + u * (.32 + 1.88 * (1 - Math.exp(-ph / 1.8)));
    const torus = smooth((ph - .55) / 2.1);
    const major = u * (.04 + .58 * torus + .06 * smooth((ph - 2) / 4));
    const tube = ball * .82 * (1 - torus) + u * .46 * torus;
    const roll = motion * ph * .5;
    let n = 0;
    for (let ring = 0; ring < CAP_RING; ring++) for (let k = 0; k < CAP_TUBE; k++, n++) {
      const phi = ring / CAP_RING * Math.PI * 2 + (k % 2) * Math.PI / CAP_RING + (hash(n, 1) - .5) * .2;
      const theta = Math.PI / 2 - .35 + k * Math.PI * 2 / CAP_TUBE - roll + (hash(n, 2) - .5) * .4;
      const ct = Math.cos(theta), st = Math.sin(theta), cp = Math.cos(phi), sp = Math.sin(phi);
      // Sphere (fireball) → oblate torus (cap) with the tube rolling outward-and-down.
      const sx = ct * ball * .62, sy = st * ball * .62, rr = major + tube * ct, ty = tube * st * .72;
      const radial = sx + (rr - sx) * torus, y = centre + sy + (ty - sy) * torus;
      const lower = (1 - st) * .5, inner = Math.max(0, -ct);
      const size = (ball * .72 * (1 - torus) + u * (.4 + .06 * hash(n, 4)) * torus) * (.75 + .5 * hash(n, 5));
      setPuff(n, cp * radial + drift, y, sp * radial, size, .95 * fade * smooth((ph - .45) / .65),
        Math.max(.05, 1 - lower * .9 - inner * .4), Math.min(1, heatNow * (1 + .5 * lower) + ember * Math.max(lower, inner)),
        underGlow * lower, .15 + .25 * lower, hash(n, 6) * 6.28);
    }
    for (let k = 0; k < CAP_FILL; k++, n++) { // dome over the torus hole
      const phi = k / (CAP_FILL - 1) * Math.PI * 2, r = k === CAP_FILL - 1 ? 0 : major * .5;
      setPuff(n, Math.cos(phi) * r + drift, centre + tube * (.35 + .25 * torus) + (k === CAP_FILL - 1 ? tube * .2 : 0), Math.sin(phi) * r,
        Math.max(ball * .6, u * (.38 + .1 * torus)), .9 * fade * smooth((ph - .5) / .65), 1, heatNow * .8, 0, .12, hash(n, 6) * 6.28);
    }
    // Stem: puffs stream up from the ground into the cap; heavily overlapped so it never reads as beads.
    const stemTop = centre - tube * .45, stemGrow = smooth((ph - .2) / 1.7), stemLength = Math.max(0, stemTop - gb);
    for (let k = 0; k < STEM; k++, n++) {
      const s = (k / STEM + motion * ph * .11) % 1, visible = s <= stemGrow;
      const radius = u * (.22 * (1 - s) ** 6 + .14 + .24 * s ** 3);
      const a = k * 2.4 + motion * ph * .7, off = radius * .3;
      const edge = smooth(s / .07) * smooth((1 - s) / .1) * smooth((stemGrow - s) / .08 + .01);
      setPuff(n, Math.cos(a) * off + drift * s, gb + stemLength * s, Math.sin(a) * off, radius * 1.5 + u * .06,
        visible ? .88 * edge * fade : 0, .22 + .16 * s + .2 * (1 - s) ** 8, heatNow * .45 * s, underGlow * s * .7, .75 - .3 * s, hash(n, 6) * 6.28);
    }
    // Base skirt: debris dust thrown out around the stem foot, slowly rolling outward.
    const skirt = 1 - Math.exp(-ph / 1.9);
    for (let k = 0; k < SKIRT; k++, n++) {
      const a = k / SKIRT * Math.PI * 2 + (hash(n, 7) - .5) * .5, r = u * (.14 + .7 * skirt) * (k % 2 ? .55 : 1) * (.85 + .3 * hash(n, 8));
      const x = Math.cos(a) * r, z = Math.sin(a) * r, size = u * (.26 + .24 * skirt) * (.8 + .4 * hash(n, 9));
      setPuff(n, x, groundAt(x, z) + size * .3, z, size, .62 * fade * smooth((ph - .12) / .4), .42, heatNow * .2, underGlow * .3, 1, (hash(n, 6) - .5) * .3, .5);
    }
    // Shock front: fast start, decelerating (finale scorch is linear over the same 1.4 s, so the wall leads it).
    const w = Math.min(1, ph / WAVE_SECONDS), front = reach * (w ** .62) * (1 + .05 * Math.max(0, ph - WAVE_SECONDS));
    const wallAlpha = (reducedMotion ? .6 : 1) * smooth(ph / .06) * (1 - smooth((ph - 1.5) / 2.6));
    const wallHeight = u * .34 * (1 - .4 * Math.min(1, front / reach)) * (.35 + .65 * smooth(ph / .3)), thickness = u * .4 + front * .2;
    for (let k = 0; k < WALL_PUFFS; k++, n++) {
      const a = k / WALL_PUFFS * Math.PI * 2 + (hash(n, 10) - .5) * .12, r = front * (.985 + .03 * hash(n, 11)) - thickness * .18;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, size = (wallHeight * .9 + front * .025) * (.8 + .4 * hash(n, 12));
      setPuff(n, x, groundAtAngle(a, r) + size * .22, z, size, .6 * wallAlpha * inside(x, z) * smooth((front - u * 1.1) / (u * 1.4)), .45, 0, 0, 1, (hash(n, 6) - .5) * .25, .45);
    }
    // Band vertices: terrain-following cross-section with a noisy front line.
    for (let i = 0; i < BAND_ANGLES; i++) {
      const c = dirs[i * 2], s = dirs[i * 2 + 1], wobble = 1 + .03 * Math.sin(i * .9 + hash(i, 13) * 6) + .02 * Math.sin(i * 2.7 + ph * 2 * motion);
      for (let k = 0; k < ROWS; k++) {
        const r = Math.max(0, front * wobble - (1 - BAND_P[k]) * thickness), x = c * r, z = s * r, v = i * ROWS + k;
        const mask = inside(x, z);
        bandPos[v * 3] = x; bandPos[v * 3 + 1] = groundPolar(i, r) + .4 + BAND_H[k] * wallHeight; bandPos[v * 3 + 2] = z;
        bandData[v * 4] = BAND_A[k] * mask; bandData[v * 4 + 1] = BAND_H[k]; bandData[v * 4 + 2] = BAND_P[k]; bandData[v * 4 + 3] = mask;
      }
    }
    bandPosAttr.needsUpdate = true; bandDataAttr.needsUpdate = true;
    bandMaterial.uniforms.uAlpha.value = wallAlpha * .85;
    bandMaterial.uniforms.uFlash.value = reducedMotion ? 0 : 1 - smooth(ph / .45);
    band.visible = wallAlpha > .002;
    // A clipped white-hot sphere holds its silhouette before the cap starts rolling.
    const ballAlpha = (1 - smooth((ph - .65) / (T.ballSeconds - .65))) * fade;
    fireball.visible = ballAlpha > .002;
    fireball.position.set(drift, centre, 0); fireball.scale.setScalar(ball);
    ballMaterial.uniforms.uAlpha.value = ballAlpha * (reducedMotion ? .65 : 1);
    ballMaterial.uniforms.uHeat.value = 1 - smooth(ph / T.ballSeconds);
    let visibleRings = 0;
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i], age = ph - T.ringStart - i * .15;
      const alpha = smooth(age / .35) * (1 - smooth((ph - 2.1 - i * .14) / (T.ringFade - 2.1))) * fade;
      const radius = u * (.95 + i * .32 + Math.max(0, age) * .22);
      r.position.set(drift * .6, gb + u * (.53 + i * .53 + .13 * smooth(age / 1.5)), 0);
      // Thin radial cloud sheets grow wider with altitude and age.
      r.scale.set(radius, radius, u);
      r.material.uniforms.uAlpha.value = alpha * (reducedMotion ? .28 : .68);
      r.visible = alpha > .002; if (r.visible) visibleRings++;
      ringBacks[i].position.copy(r.position); ringBacks[i].scale.copy(r.scale); ringBacks[i].visible = r.visible;
    }
    // Delayed visible condensation follows the already-resolved damage wave; never drives damage.
    const domeAge = Math.max(0, ph - T.domeStart);
    const wilson = !SHOW_DOME || reducedMotion ? 0 : smooth(domeAge / .6) * (1 - smooth((ph - 4.2) / (T.domeEnd - 4.2))) * fade;
    const domeRadius = u * (1.3 + domeAge * .86);
    shell.visible = wilson > .002; shellMaterial.uniforms.uAlpha.value = wilson * .38;
    shell.position.set(0, gb, 0); shell.scale.set(domeRadius, domeRadius * .83, domeRadius);
    const screen = nukeScreenState(ph, reducedMotion);
    flashMaterial.uniforms.uWhite.value = screen.white; flashMaterial.uniforms.uWarm.value = screen.warm;
    flash.visible = screen.white + screen.warm > .002;
    stats.rings = visibleRings; stats.domeRadius = shell.visible ? domeRadius : 0;
    // Warm halo of the fireball (additive), fading as it cools.
    const halo = heatNow * (reducedMotion ? .18 : .48);
    glow.visible = halo > .01; glow.position.set(drift, centre, 0);
    glowMaterial.uniforms.uSize.value = ball * 1.9 + tube * torus; glowMaterial.uniforms.uColor.value.setRGB(.6 * halo, .26 * halo, .07 * halo);

    // Sort live puffs far → near (insertion sort on last frame's order: nearly sorted already).
    let count = 0;
    const ox = group.position.x - camPos.x, oy = group.position.y - camPos.y, oz = group.position.z - camPos.z;
    for (let k = 0; k < PUFFS; k++) depth[k] = (px[k] + ox) * camDir.x + (py[k] + oy) * camDir.y + (pz[k] + oz) * camDir.z;
    for (let k = 1; k < PUFFS; k++) { const v = order[k], d = depth[v]; let j = k - 1; while (j >= 0 && depth[order[j]] < d) { order[j + 1] = order[j]; j--; } order[j + 1] = v; }
    for (let k = 0; k < PUFFS; k++) { const m = order[k]; if (pa[m] > .003 && ps[m] > .01) live[count++] = m; }
    const P = iPos.array, A = iA.array, C = iC.array;
    for (let k = 0; k < count; k++) {
      const m = live[k];
      P[k * 4] = px[m]; P[k * 4 + 1] = py[m]; P[k * 4 + 2] = pz[m]; P[k * 4 + 3] = pq[m];
      A[k * 4] = ps[m]; A[k * 4 + 1] = Math.min(1, pa[m]); A[k * 4 + 2] = seedOf(m); A[k * 4 + 3] = proll[m];
      C[k * 4] = pshade[m]; C[k * 4 + 1] = pheat[m]; C[k * 4 + 2] = pglow[m]; C[k * 4 + 3] = pdirt[m];
    }
    geometry.instanceCount = count; puffs.visible = count > 0;
    iPos.needsUpdate = iA.needsUpdate = iC.needsUpdate = true;
    stats.puffs = count; stats.frontRadius = front; stats.phase = ph;
    group.userData.blastFront = front;
  }

  const baseAnimate = effect.animate;
  effect.animate = function animate(t) {
    baseAnimate.call(this, t);
    for (const batch of old) batch.visible = false;
    animateFeel(t);
  };
  effect.feelNuke = stats;
  effect.animate(0);
}
