import { createNuclearEffect } from './nuclear-effects.js?v=mini24b';
import { createMiniBombEffect } from './mini-bomb-effects.js?v=mini24b';
import { BOMBER_IMPACTS } from './weapon-actions.js?v=mini24b';

// Temporary comic props only; campus art and destruction geometry stay separate.
export function createComicEffects(THREE, scene, { reducedMotion = false } = {}) {
  const active = [];
  // Twelve armed actions can coexist; each plant stays below fifty scene nodes.
  const CAP = 600, MAX_PENDING = 12;
  let liveObjects = 0, sustainedDrill = null, drillCreates = 0, nuclearLook = null; // ?feel: main.js may install a nuke look
  const ease = t => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;
  const DELAYS = { fist: .07, hammer: .16, bat: .18, wave: .2, drill: .025,
    ball: .4, excavator: .45, meteor: .65, bomb: 2, nuke: 3, bomber: 1.4 };

  function remove(effect) {
    effect.group.removeFromParent();
    effect.group.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
    for (const geometry of effect.geometries) geometry.dispose();
    for (const material of effect.materials) material.dispose();
    for (const texture of effect.textures || []) texture.dispose();
    effect.group.clear();
    if (effect.registered) liveObjects -= effect.objects;
    effect.disposed = true;
  }

  function build({ point, camera, tool, coins, impactDelay, worldRadius, groundHeight, normal }) {
    if (tool.id === 'mini-bomb') return createMiniBombEffect(THREE, { point, camera, impactDelay, normal }, { reducedMotion });
    if (tool.id === 'nuke') return nuclearLook ? nuclearLook({ point, camera, impactDelay, worldRadius, groundHeight }, { reducedMotion }, createNuclearEffect) : createNuclearEffect(THREE, { point, camera, impactDelay, worldRadius, groundHeight }, { reducedMotion });
    const impact = Number.isFinite(impactDelay) && impactDelay >= 0 ? impactDelay : DELAYS[tool.id] ?? .2;
    const planted = tool.id === 'bomb', bomber = tool.id === 'bomber';
    const protectedUntil = bomber ? BOMBER_IMPACTS.at(-1).at : impact;
    const group = new THREE.Group();
    group.name = `comic-hit-${tool.id}`;
    group.position.copy(point);
    if (camera && !bomber) group.rotation.y = Math.atan2(camera.position.x - point.x, camera.position.z - point.z);
    const geometries = new Set(), materials = new Set(), geometryCache = new Map(), materialCache = new Map(), edgeCache = new Map();
    function geometry(key, create) {
      if (!geometryCache.has(key)) {
        const value = create(); geometries.add(value); geometryCache.set(key, value);
      }
      return geometryCache.get(key);
    }
    function material(color, transparent = false) {
      const key = `${color}/${transparent}`;
      if (!materialCache.has(key)) {
        const value = new THREE.MeshStandardMaterial({ color, roughness: .7, metalness: .03,
          transparent, opacity: transparent ? .38 : 1, depthWrite: !transparent });
        materials.add(value); materialCache.set(key, value);
      }
      return materialCache.get(key);
    }
    const outline = new THREE.LineBasicMaterial({ color: '#29243e' }); materials.add(outline);
    const boxGeo = geometry('box', () => new THREE.BoxGeometry(1, 1, 1));
    const sphereGeo = geometry('sphere', () => new THREE.SphereGeometry(1, 12, 8));
    const cylinderGeo = geometry('cylinder', () => new THREE.CylinderGeometry(1, 1, 1, 12));
    function shape(parent, geo, color, position, scale, outlined = true, transparent = false) {
      const mesh = new THREE.Mesh(geo, material(color, transparent));
      mesh.position.set(...position); mesh.scale.set(...scale); parent.add(mesh);
      if (outlined) {
        if (!edgeCache.has(geo)) {
          const edges = new THREE.EdgesGeometry(geo, 28); geometries.add(edges); edgeCache.set(geo, edges);
        }
        const edges = new THREE.LineSegments(edgeCache.get(geo), outline); mesh.add(edges);
      }
      return mesh;
    }
    const box = (p, c, xyz, size) => shape(p, boxGeo, c, xyz, size);
    const sphere = (p, c, xyz, size) => shape(p, sphereGeo, c, xyz, size);
    const weapon = new THREE.Group(); weapon.name = `weapon-${tool.id}`; group.add(weapon);
    let beam = null, drillBit = null, excavatorArm = null, mushroom = null, gripPivot = null, countdown = null;
    let flash = null, dust = null, shadow = null, target = null;
    const planes = [], airBombs = [], airBursts = [];
    switch (tool.id) {
      case 'fist': {
        box(weapon, '#f49c63', [0, 0, 0], [4.8, 3.6, 3.8]);
        for (let i = 0; i < 4; i++) sphere(weapon, '#ffc085', [-1.8 + i * 1.2, 1.8, .3], [.7, 1, 1.6]);
        const thumb = box(weapon, '#ffb475', [2.3, -.25, 1.4], [1.8, 2.6, 1.6]); thumb.rotation.z = -.4;
        box(weapon, '#ff4e77', [0, -2.2, -.1], [4.3, 1.2, 3.5]);
        box(weapon, '#fff8d6', [0, -2.2, 1.73], [1.7, .7, .12]);
        break;
      }
      case 'hammer': {
        box(weapon, '#a56ce1', [0, -4.4, 0], [1.1, 8.8, 1.1]);
        box(weapon, '#ffe274', [0, -7.7, 0], [1.5, 2.2, 1.5]);
        box(weapon, '#ff6da3', [0, 0, 0], [7.2, 4.2, 4.2]);
        for (const sign of [-1, 1]) {
          const face = shape(weapon, cylinderGeo, '#ffdf4e', [sign * 4, 0, 0], [2.55, 1, 2.55]);
          face.rotation.z = Math.PI / 2;
          box(weapon, '#fff9df', [sign * 2.4, .1, 2.15], [.65, 2.8, .12]);
        }
        box(weapon, '#fff9df', [0, 0, 2.18], [1.9, 1.9, .1]);
        break;
      }
      case 'bat': {
        // A satin aluminium barrel and wrapped grip; the barrel centre stays at local (0,1,0).
        const taper = geometry('bat-taper', () => new THREE.CylinderGeometry(1.25, .59, 8, 16));
        const barrel = shape(weapon, taper, '#a8b1b6', [0, 1, 0], [1, 1, 1]);
        barrel.name = 'bat-barrel'; barrel.material.metalness = .72; barrel.material.roughness = .34;
        shape(weapon, cylinderGeo, '#b7bfc5', [0, -5, 0], [.58, 4, .58]);
        shape(weapon, cylinderGeo, '#283344', [0, -6.1, 0], [.65, 2.3, .65]);
        shape(weapon, cylinderGeo, '#4b5865', [0, -7.4, 0], [.85, .3, .85]);
        sphere(weapon, '#b7bfc5', [0, 5, 0], [1.25, .45, 1.25]);
        for (let i = 0; i < 4; i++) shape(weapon, cylinderGeo, '#626a77', [0, -5.25 - i * .5, 0], [.67, .08, .67], false);
        box(weapon, '#283344', [0, 1.4, 1.2], [.32, 1.6, .07]);
        break;
      }
      case 'drill': {
        box(weapon, '#e8b942', [0, 3.6, 0], [3.7, 4.2, 3.4]);
        box(weapon, '#27333f', [0, 5.7, 0], [3.1, .5, 2.9]);
        const handle = box(weapon, '#344250', [2.1, 2.6, 0], [1.1, 4.4, 1.6]); handle.rotation.z = -.1;
        box(weapon, '#ff754e', [2.65, 3.2, .85], [.35, .85, .2]);
        shape(weapon, cylinderGeo, '#606e7c', [0, 1.1, 0], [1.35, 1.1, 1.35]);
        for (let i = 0; i < 3; i++) box(weapon, '#27333f', [-.8 + i * .8, 4.3, 1.73], [.24, 1.3, .08]);
        drillBit = new THREE.Group(); drillBit.name = 'drill-bit'; weapon.add(drillBit);
        const cone = geometry('drill-cone', () => new THREE.ConeGeometry(.95, 5, 12));
        const tip = shape(drillBit, cone, '#b4bec7', [0, -1.6, 0], [1, 1, 1]); tip.rotation.z = Math.PI;
        for (let i = 0; i < 5; i++) {
          const rib = box(drillBit, '#627685', [0, -.2 - i * .7, 0], [1.9 - i * .28, .24, .5]); rib.rotation.y = i * 1.1;
        }
        break;
      }
      case 'excavator': {
        box(weapon, '#293249', [-3, -1, 0], [7.5, 1.8, 5.2]);
        for (const z of [-2.7, 2.7]) for (const x of [-5, -3, -1]) {
          const wheel = shape(weapon, cylinderGeo, '#68728d', [x, -1, z], [.55, .18, .55]); wheel.rotation.x = Math.PI / 2;
        }
        box(weapon, '#ffd356', [-3, .6, 0], [6, 2, 4.8]);
        box(weapon, '#ffbd43', [-4, 3.1, 0], [3.4, 3.5, 3.8]);
        box(weapon, '#96e5f0', [-4, 3.3, 1.95], [2.5, 2, .12]);
        excavatorArm = new THREE.Group(); excavatorArm.position.set(-1, -.4, 0); weapon.add(excavatorArm);
        excavatorArm.name = 'scooping-arm';
        const upper = box(excavatorArm, '#ffe175', [2, 2.5, 0], [1.5, 7, 1.7]); upper.rotation.z = -.65;
        const lower = box(excavatorArm, '#ffd356', [5.2, 2.3, 0], [1.3, 5.8, 1.5]); lower.rotation.z = .5;
        box(excavatorArm, '#ffad4a', [6.5, -.4, 0], [3.5, 2.2, 4.4]);
        for (const z of [-1.5, 0, 1.5]) box(excavatorArm, '#fff1b4', [7.8, -1.5, z], [1.5, .5, .6]);
        break;
      }
      case 'bomb': {
        sphere(weapon, '#3c3858', [0, 0, 0], [3.8, 3.8, 3.8]);
        shape(weapon, cylinderGeo, '#ffc96b', [0, 3.7, 0], [.7, 1.1, .7]);
        const fuse = box(weapon, '#ffe6b9', [.5, 4.9, 0], [.35, 2, .35]); fuse.rotation.z = -.55;
        for (let i = 0; i < 3; i++) {
          const spark = box(weapon, '#ff8c62', [1, 5.8, 0], [.35, 2.2, .35]); spark.rotation.z = i * Math.PI / 3;
        }
        for (const x of [-1, 1]) sphere(weapon, '#fff3d6', [x, .3, 3.55], [.6, .75, .22]);
        for (const x of [-.85, 1.15]) sphere(weapon, '#29243e', [x, .3, 3.77], [.2, .3, .12]);
        break;
      }
      case 'bomber': {
        for (let i = 0; i < BOMBER_IMPACTS.length; i++) {
          const plane = new THREE.Group(); plane.name = `bomber-plane-${i}`; weapon.add(plane);
          shape(plane, boxGeo, '#80baca', [0, 0, 0], [8, 1.6, 1.6], false);
          box(plane, '#e5f0ce', [-.8, 0, 0], [2.3, .5, 11]);
          shape(plane, boxGeo, '#334657', [1.8, .8, 0], [2.1, .7, 1.2], false);
          shape(plane, boxGeo, '#f0c568', [-3, .6, 0], [1, 1.8, 3.1], false);
          planes.push(plane);
          const bomb = new THREE.Group(); bomb.name = `bomber-bomb-${i}`; group.add(bomb);
          shape(bomb, cylinderGeo, '#555067', [0, 0, 0], [.75, 2.8, .75], false);
          shape(bomb, sphereGeo, '#efbd68', [0, -.9, 0], [.8, .9, .8], false);
          airBombs.push(bomb);
          const burst = new THREE.Group(); burst.name = `bomber-impact-${i}`; burst.position.set(...BOMBER_IMPACTS[i].offset); group.add(burst);
          const fire = new THREE.Group(); fire.name = `bomber-fire-${i}`; burst.add(fire);
          shape(fire, sphereGeo, '#ffc57a', [-1.5, 2.3, 0], [3.4, 3.5, 3.4], false);
          shape(fire, sphereGeo, '#8a6875', [1.7, 3.1, 0], [3.8, 4, 3.8], false);
          const airRingGeo = geometry('air-shock', () => new THREE.TorusGeometry(1, .07, 4, 24));
          const airRing = shape(burst, airRingGeo, '#ffe6a3', [0, .15, 0], [1, 1, 1], false);
          airRing.rotation.x = -Math.PI / 2; airRing.name = `bomber-shock-${i}`;
          const coin = shape(burst, cylinderGeo, '#ffd84f', [0, 1, 0], [.5, .16, .5], false);
          coin.rotation.x = Math.PI / 2; coin.name = `collectible-coin-${i}`;
          airBursts.push({ burst, fire, ring: airRing, coin });
        }
        break;
      }
      case 'wave': {
        box(weapon, '#ff94b9', [0, 0, 0], [7.8, 3.4, 4]);
        box(weapon, '#fff8eb', [2.5, .02, .01], [2.9, 3.65, 4.2]);
        box(weapon, '#4fcfe8', [-1.1, 0, 0], [3.5, 3.6, 4.25]);
        for (let i = 0; i < 3; i++) box(weapon, '#fff8eb', [-2.1 + i * .8, 0, 2.17], [.35, 2.2, .1]);
        const coneGeo = geometry('beam', () => new THREE.ConeGeometry(4.5, 12, 10, 1, true));
        beam = shape(group, coneGeo, '#6df1ff', [0, 6, 0], [1, 1, 1], false, true);
        beam.name = 'homework-delete-ray';
        break;
      }
      case 'ball': {
        sphere(weapon, '#fff2d4', [0, 0, 0], [4, 3.25, 3.8]);
        sphere(weapon, '#ffe5ac', [0, 2.6, 0], [1.6, 1, 1.5]);
        const pleatGeo = geometry('pleat', () => new THREE.TorusGeometry(2.65, .09, 4, 14, Math.PI));
        for (let i = 0; i < 5; i++) {
          const fold = shape(weapon, pleatGeo, '#d4ab73', [0, .3, 0], [1, 1, 1], false);
          fold.rotation.y = i * Math.PI / 5; fold.rotation.z = .12;
        }
        for (const x of [-.9, .9]) sphere(weapon, '#29243e', [x, -.2, 3.55], [.2, .32, .13]);
        for (const x of [-1.6, 1.6]) sphere(weapon, '#ff9fab', [x, -.7, 3.45], [.5, .2, .12]);
        box(weapon, '#29243e', [0, -.95, 3.72], [.7, .13, .1]);
        break;
      }
      case 'meteor': {
        const core = box(weapon, '#ff6b45', [0, 0, 0], [7, 7.8, 4.4]); core.rotation.z = -.12;
        // The grade is actual chunky geometry, readable without canvas textures.
        box(weapon, '#fff2b9', [-1.2, 0, 2.5], [.8, 5.4, .4]);
        box(weapon, '#fff2b9', [.3, 2.3, 2.5], [3.8, .8, .4]);
        box(weapon, '#fff2b9', [.1, .2, 2.5], [3.4, .8, .4]);
        for (let i = 0; i < 3; i++) {
          const flame = box(weapon, i % 2 ? '#ffcb49' : '#ff924d', [-2.4 + i * 2.4, 5.4 + i % 2, -.4], [1.8, 4.8, 2.2]);
          flame.rotation.z = (i - 1) * -.25;
        }
        break;
      }
      default: box(weapon, tool.color || '#ff8eae', [0, 0, 0], [4, 4, 4]);
    }
    // Grip pivots keep the hand stationary while the striking head follows an arc.
    if (tool.id === 'hammer' || tool.id === 'bat') {
      gripPivot = new THREE.Group(); gripPivot.name = `grip-pivot-${tool.id}`;
      group.add(gripPivot); gripPivot.add(weapon);
      if (tool.id === 'hammer') {
        weapon.position.set(0, 8, 0); gripPivot.position.set(-8, 0, 0);
      } else {
        weapon.position.set(6, .6, 0); weapon.rotation.z = -Math.PI / 2;
        gripPivot.position.set(0, -.6, 7);
      }
    }
    if (tool.id === 'bomb') {
      mushroom = new THREE.Group(); mushroom.name = 'bomb-explosion'; group.add(mushroom);
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        shape(mushroom, sphereGeo, i % 2 ? '#ffd581' : '#ff945d', [Math.cos(a) * 2.2, 2.4, Math.sin(a) * 2.2], [2.6, 2.5, 2.6], false);
      }
    }
    if (planted) {
      const countdownGeo = geometry('countdown', () => new THREE.RingGeometry(3.7, 4.1, 48));
      countdown = shape(group, countdownGeo, '#ff668a', [0, tool.id === 'bomb' ? 10.5 : 12, 0], [1, 1, 1], false);
      countdown.name = 'armed-countdown'; countdown.rotation.x = -Math.PI / 2;
      countdown.material.side = THREE.DoubleSide;
    }
    const ringGeo = geometry('shock-ring', () => new THREE.TorusGeometry(1, .055, 4, 32));
    const ring = shape(group, ringGeo, tool.color || '#ffd25f', [0, .18, 0], [1, 1, 1], false);
    ring.rotation.x = -Math.PI / 2; ring.name = 'comic-shock-ring';
    const coinGroup = new THREE.Group(); coinGroup.name = 'coin-pop'; group.add(coinGroup);
    const coinMeshes = [];
    const coinCount = bomber ? 0 : reducedMotion ? 2 : planted ? 3 : Math.max(3, Math.min(7, Math.ceil(Number(coins) / 5) || 3));
    for (let i = 0; i < coinCount; i++) {
      const coin = shape(coinGroup, cylinderGeo, '#ffd84f', [0, 0, 0], [.42, .13, .42]);
      coin.name = 'collectible-coin'; coin.rotation.x = Math.PI / 2;
      coinMeshes.push(coin);
    }
    let objects = 0; group.traverse(() => objects++);
    const postDuration = tool.id === 'drill' ? .25 : planted ? 1.05 : reducedMotion ? .45 : .85;
    const duration = bomber ? Math.max(3.1, protectedUntil + .9) : impact + postDuration;
    const effect = { group, weapon, drillBit, toolId: tool.id, geometries, materials, objects, age: 0, duration,
      impact, protectedUntil, reward: Number.isFinite(coins) ? Math.max(0, coins) : 0,
      airRewards: BOMBER_IMPACTS.map(() => Number.isFinite(coins) ? Math.max(0, coins) : 0), registered: false, disposed: false,
      animate(t) {
        const u = impact ? Math.min(1, t / impact) : 1;
        const arrival = ease(u), post = Math.max(0, t - impact);
        const contacted = t >= impact;
        const bounce = reducedMotion ? 0 : Math.sin(Math.min(1, post / .46) * Math.PI) * Math.exp(-post * 3) * 2.5;
        if (bomber) {
          ring.visible = false;
          for (let i = 0; i < planes.length; i++) {
            const planned = BOMBER_IMPACTS[i], release = planned.at - .7;
            const slotX = i === 1 ? 0 : -6, slotZ = (i - 1) * 10;
            planes[i].position.set((t - 1.05) * 24 + slotX, 32, slotZ);
            planes[i].visible = t < 3;
            const drop = Math.max(0, Math.min(1, (t - release) / .7));
            const startX = (release - 1.05) * 24 + slotX;
            const [x, y, z] = planned.offset;
            airBombs[i].position.set(startX + (x - startX) * drop, y + 1.8 + 30.2 * (1 - drop * drop), slotZ + (z - slotZ) * drop);
            airBombs[i].visible = t >= release && t < planned.at;
            const elapsed = Math.max(0, t - planned.at), arrived = t >= planned.at;
            const parts = airBursts[i], fade = Math.max(.001, Math.min(1, (.85 - elapsed) / .25));
            parts.burst.visible = arrived && elapsed < .85;
            const bloom = reducedMotion ? 1 : Math.min(1, elapsed / .16);
            parts.fire.scale.setScalar(Math.max(.001, bloom * fade));
            const wave = Math.min(1, elapsed / .6), radius = 1 + wave * 12;
            parts.ring.scale.set(radius, radius, Math.max(.001, 1 - wave)); parts.ring.visible = wave < 1;
            parts.coin.visible = arrived && effect.airRewards[i] > 0 && elapsed < .85;
            parts.coin.position.set(reducedMotion ? 0 : elapsed * 2, 1 + elapsed * 7 - elapsed * elapsed * 4, 0);
            parts.coin.scale.set(.5 * fade, .16 * fade, .5 * fade);
          }
          return;
        }
        switch (tool.id) {
          case 'hammer': {
            // Head offset +8y sweeps around the bottom of its handle to the target.
            const swing = Math.PI / 2 * arrival;
            gripPivot.rotation.z = -swing + (contacted && !reducedMotion ? Math.min(.27, post) : 0);
            break;
          }
          case 'fist': {
            const retreat = contacted ? Math.min(1, post / .3) * 5 : 0;
            weapon.position.set(-3.2 - 9 * (1 - arrival) - retreat, 0, 0);
            weapon.rotation.z = 0; break;
          }
          case 'bat': {
            // Brief anticipation, accelerated swing, exact contact hold, then follow-through.
            // The hold is deliberate: visual impact remains at the damage point for 45 ms.
            if (!contacted) {
              const windup = u < .22 ? -1.6 - .16 * Math.sin(u / .22 * Math.PI) : -1.6;
              const swing = Math.max(0, (u - .22) / .78);
              gripPivot.rotation.y = Math.PI / 2 - windup * (1 - swing * swing);
            } else {
              const follow = Math.max(0, post - .045);
              gripPivot.rotation.y = Math.PI / 2 - (reducedMotion ? 0 : .88 * ease(follow / .22) - .18 * ease(Math.max(0, follow - .23) / .25));
            }
            break;
          }
          case 'drill':
            weapon.position.set(0, 4.1 + .3 * (1 - arrival) + (contacted && !reducedMotion ? Math.sin(post * 75) * .12 : 0), 0);
            drillBit.rotation.y = reducedMotion ? 0 : t * 38; break;
          case 'excavator': {
            // The tracked body sits beside the point; only its articulated arm scoops.
            const scoop = contacted ? Math.sin(Math.min(1, post / .55) * Math.PI / 2) * 1.15 : .9 * (1 - arrival);
            weapon.position.set(-6.8, 1.9, 0);
            excavatorArm.rotation.z = scoop;
            break;
          }
          case 'bomb': weapon.position.set(0, 3.8, 0); break;
          case 'wave':
            weapon.position.set(0, 13 + (reducedMotion ? 0 : Math.sin(t * 8) * .6), 0);
            weapon.rotation.z = reducedMotion ? 0 : Math.sin(t * 10) * .1;
            // The thin ray extends from the eraser to the point at exactly contact.
            beam.visible = t > 0;
            beam.scale.set(1, Math.max(.001, arrival), 1);
            beam.position.y = 12 - 6 * arrival; break;
          case 'ball':
            weapon.position.set(-16 * (1 - u), reducedMotion ? 0 : Math.sin(u * Math.PI) * 9 + bounce, 0);
            weapon.rotation.z = reducedMotion ? 0 : (1 - u) * 1.1 - post * .65; break;
          case 'meteor':
            weapon.position.set(3 * (1 - u), reducedMotion ? 0 : 26 * (1 - u * u) + bounce, 0);
            weapon.rotation.z = reducedMotion ? 0 : .3 * (1 - u) + post * .12; break;
        }
        const fade = Math.max(.001, Math.min(1, (duration - t) / .25));
        weapon.scale.setScalar(fade);
        if (planted) {
          weapon.visible = !contacted;
          countdown.visible = !contacted;
          countdown.geometry.setDrawRange(0, Math.max(0, Math.ceil((1 - u) * 48) * 6));
          mushroom.visible = contacted;
          const puff = reducedMotion ? 1 : Math.min(1, post / .35);
          mushroom.scale.setScalar(Math.max(.001, puff * fade));
        }
        const shock = Math.min(1, post / .55);
        const radius = 1 + shock * (Math.max(3, Math.min(13, Number(tool.radius) || 6)));
        ring.scale.set(radius, radius, Math.max(.001, 1 - shock));
        ring.visible = contacted && shock < 1;
        for (let i = 0; i < coinMeshes.length; i++) {
          const coin = coinMeshes[i], a = i / coinMeshes.length * Math.PI * 2;
          const life = Math.max(0, t - impact), spread = reducedMotion ? .5 : life * 5;
          coin.visible = contacted && effect.reward > 0;
          coin.position.set(Math.cos(a) * spread, 1 + (reducedMotion ? life : life * 9 - life * life * 4), Math.sin(a) * spread);
          coin.rotation.y = reducedMotion ? 0 : life * 8 + i;
          coin.scale.set(.42 * fade, .13 * fade, .42 * fade);
        }
      },
    };
    effect.animate(0);
    return effect;
  }

  const validPoint = point => point && [point.x, point.y, point.z].every(Number.isFinite);
  const upAxis = new THREE.Vector3(0, 1, 0), drillNormal = new THREE.Vector3();
  function updateDrill({ point, normal, contact = false, running = false } = {}) {
    if (!sustainedDrill) return false;
    // A missed ray is an aiming state, never a request to remove the equipped tool.
    sustainedDrill.running = !!running;
    sustainedDrill.contact = !!contact;
    if (validPoint(point)) sustainedDrill.targetPosition.copy(point);
    if (validPoint(normal)) {
      drillNormal.copy(normal);
      if (drillNormal.lengthSq() < .000001) drillNormal.copy(upAxis);
      drillNormal.normalize();
      sustainedDrill.targetQuaternion.setFromUnitVectors(upAxis, drillNormal);
    }
    return true;
  }
  function stopDrill() {
    if (!sustainedDrill) return;
    remove(sustainedDrill); sustainedDrill = null;
  }
  function startDrill(data = {}) {
    if (!validPoint(data.point)) return { accepted: false };
    if (sustainedDrill) { updateDrill(data); return { accepted: true }; }
    const effect = build({ ...data, tool: { ...data.tool, id: 'drill' }, coins: 0 });
    while (liveObjects + effect.objects > CAP) {
      const old = active.findIndex(item => item.age >= item.protectedUntil);
      if (old < 0) { remove(effect); return { accepted: false }; }
      remove(active.splice(old, 1)[0]);
    }
    // One permanent prop for this press; no coins, transient impact rings or timed disposal.
    effect.group.name = 'sustained-drill';
    effect.group.getObjectByName('comic-shock-ring').visible = false;
    effect.group.getObjectByName('coin-pop').visible = false;
    effect.weapon.position.set(0, 4.1, 0);
    scene.add(effect.group); effect.registered = true; liveObjects += effect.objects;
    effect.targetPosition = data.point.clone(); effect.targetQuaternion = new THREE.Quaternion();
    effect.running = false; effect.contact = false; effect.spinAge = 0; effect.bitPhase = 0;
    sustainedDrill = effect; drillCreates++; updateDrill(data);
    effect.group.position.copy(effect.targetPosition); effect.group.quaternion.copy(effect.targetQuaternion);
    return { accepted: true };
  }

  return {
    startDrill, updateDrill, stopDrill,
    setNuclearLook(look) { nuclearLook = typeof look === 'function' ? look : null; },
    hit(data) {
      const rejected = { accepted: false, resolve() {} };
      if (!data?.point || ![data.point.x, data.point.y, data.point.z].every(Number.isFinite) || !data.tool?.id) return rejected;
      if (active.filter(effect => effect.age < effect.protectedUntil).length >= MAX_PENDING) return rejected;
      const effect = build(data);
      // Rapid drilling keeps one visible prop while older coins finish their hop.
      if(data.tool.id==='drill')for(const old of active)if(old.toolId==='drill')old.weapon.visible=false;
      while (liveObjects + effect.objects > CAP) {
        const oldestResolved = active.findIndex(old => old.age >= old.protectedUntil);
        if (oldestResolved < 0) { remove(effect); return rejected; }
        remove(active.splice(oldestResolved, 1)[0]);
      }
      scene.add(effect.group); active.push(effect); effect.registered = true; liveObjects += effect.objects;
      return { accepted: true, resolve({ coins = 0, impactIndex = 0 } = {}) {
        if (effect.disposed) return;
        const reward = Number.isFinite(coins) ? Math.max(0, coins) : 0;
        if (effect.toolId === 'bomber') {
          if (Number.isInteger(impactIndex) && impactIndex >= 0 && impactIndex < effect.airRewards.length) effect.airRewards[impactIndex] = reward;
        } else effect.reward = reward;
      } };
    },
    update(dt) {
      if (!Number.isFinite(dt) || dt < 0) return;
      if (sustainedDrill) {
        const mounted = sustainedDrill;
        // 35 ms follow smoothing avoids jumps between wall and sky rays; no hide/rebuild cycle.
        const follow = 1 - Math.exp(-Math.min(dt, .1) / .035);
        mounted.group.position.lerp(mounted.targetPosition, follow);
        mounted.group.quaternion.slerp(mounted.targetQuaternion, follow);
        if (mounted.running) { mounted.spinAge += dt; mounted.bitPhase += dt * (mounted.contact ? 48 : 65); }
        mounted.drillBit.rotation.y = reducedMotion ? 0 : mounted.bitPhase;
        const shake = reducedMotion || !mounted.running ? 0 : Math.sin(mounted.spinAge * 110) * (mounted.contact ? .006 : .002);
        mounted.weapon.scale.y = 1 + shake;
        mounted.weapon.position.y = 4.1 * (1 + shake);
      }
      for (let i = active.length - 1; i >= 0; i--) {
        const effect = active[i]; effect.age += dt;
        if (effect.age >= effect.duration) { remove(effect); active.splice(i, 1); }
        else effect.animate(effect.age);
      }
    },
    clear() { stopDrill(); while (active.length) remove(active.pop()); },
    get stats() { return { miniBombs:active.filter(e=>e.toolId==='mini-bomb').map(e=>({age:e.age,phase:e.group.userData.phase})),drillCreates, drillActive: !!sustainedDrill, drillRunning: !!sustainedDrill?.running, drillVisible: !!sustainedDrill?.group.visible, drillPoint: sustainedDrill?.group.position.toArray() || null, liveObjects }; },
    get animating() { return active.length > 0 || !!sustainedDrill?.running; },
    get count() { return liveObjects; },
  };
}
