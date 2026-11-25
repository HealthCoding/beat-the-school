// Match the responsive HUD; safe-area values come from CSS only on resize.
export function campusViewInsets(width, height, safeArea = {}) {
  const landscape = width >= 600 && height <= 600;
  const safe = key => Number.isFinite(safeArea[key]) ? Math.max(0, safeArea[key]) : 0;
  return { top: (landscape ? 64 : 96) + safe('top'),
    bottom: (landscape ? 72 : 88) + safe('bottom') };
}

// Map-app tilt (user decision 2026-10-23, 시안/시점_시안.html): the overview stays at .91 rad; the play view starts lower
// (`play` degrees) and lies down further as you zoom in past the building fit, reaching `near` degrees at `range` times
// the fit zoom. A drag that changes the angle by hand switches the automatic tilt off until the next focus/overview,
// so it never fights the player. ?tilt=off = the earlier fixed 25 degree play view (comparison).
export const CAMERA_TILT = Object.freeze({ play: 20, near: 14, range: 3 });
const LEGACY_TILT = Object.freeze({ play: 25, near: 25, range: 3 });

// One perspective camera: a high overview for navigation, a lower close view for play.
// angles (optional, a package's pkg.camera, degrees: { overviewElevation, playElevation, tiltNear }): the auto high-school packages
// (scripts/auto-school/build.mjs) set them from a measured occlusion by the surrounding blocks; without it (every university) or
// with ?tilt=off the defaults above are used unchanged.
export function createCampusCamera(THREE, camera, bounds, { overviewAzimuth = .16, angles = null,
  tilt = new URLSearchParams(globalThis.location?.search ?? '').get('tilt') === 'off' ? LEGACY_TILT : CAMERA_TILT } = {}) {
  const HOME_AZIMUTH = Number.isFinite(overviewAzimuth) ? overviewAzimuth : .16;
  if (!camera.isPerspectiveCamera) throw new TypeError('Campus camera requires a PerspectiveCamera');
  const own = angles && tilt !== LEGACY_TILT ? angles : null, deg = (v, d) => Number.isFinite(v) ? v : d;
  if (own) tilt = { play: deg(own.playElevation, tilt.play), near: deg(own.tiltNear, tilt.near), range: tilt.range };
  const OVERVIEW_ELEVATION = own && Number.isFinite(own.overviewElevation) ? Math.PI * own.overviewElevation / 180 : .91, PLAY_ELEVATION = Math.PI * tilt.play / 180, NEAR_ELEVATION = Math.PI * tilt.near / 180, MAX_ZOOM = 64;
  // Fit zoom of the last focus(); null = no automatic tilt (overview start, after a hand tilt or an adopted pose).
  // angles.minElevation (degrees, opt-in, 11-10 liraart 남산타워): how low a hand drag may tilt; default .22 rad unchanged.
  const MIN_ELEVATION = own && Number.isFinite(own.minElevation) ? Math.PI * own.minElevation / 180 : .22;
  // angles.maxLookUp (degrees, opt-in, 11-10 liraart 남산타워): once a hand drag has reached the elevation floor, dragging on pitches
  // the view up by at most this much (the camera stays where it is, above the ground; only the look direction rises), and dragging
  // back first undoes the pitch. Default 0 = no look-up, the pose is exactly as before.
  const MAX_LOOKUP = own && Number.isFinite(own.maxLookUp) ? Math.PI * Math.max(0, own.maxLookUp) / 180 : 0;
  let lookUp = 0;
  let tiltAnchor = null;
  let focusPlayElevation = PLAY_ELEVATION, focusNearElevation = NEAR_ELEVATION;
  const autoElevation = z => {
    const t = THREE.MathUtils.clamp(Math.log(z / tiltAnchor) / Math.log(tilt.range), 0, 1);
    return THREE.MathUtils.lerp(focusPlayElevation, focusNearElevation, t * t * (3 - 2 * t));
  };
  const OVERVIEW_TRANSITION_ZOOM = 2.2;
  let overviewTransition = null;
  let safeArea = {};
  let width = 1, height = 1, azimuth = HOME_AZIMUTH, elevation = OVERVIEW_ELEVATION;
  let zoom = 1, baseDistance = 600, distance = 600, focusBox = null, focusPoints = null, groundLevel = 0, framing = 'overview';
  const target = bounds.getCenter(new THREE.Vector3()), initialTarget = target.clone();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  camera.fov = 40; camera.zoom = 1; camera.near = .1;
  const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const points = box => {
    const result = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) result.push(new THREE.Vector3(x, y, z));
    return result;
  };
  function minimumDistance() {
    if (!focusBox) return 2;
    const backward = new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation),
      Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
    return Math.max(2, ...focusPoints.map(p => p.clone().sub(target).dot(backward) + 1));
  }
  function pose() {
    distance = Math.max(minimumDistance(), baseDistance / zoom);
    camera.position.set(target.x + Math.sin(azimuth) * Math.cos(elevation) * distance,
      target.y + Math.sin(elevation) * distance, target.z + Math.cos(azimuth) * Math.cos(elevation) * distance);
    if (lookUp > 0) { const flat = Math.cos(elevation) * distance; camera.lookAt(target.x, camera.position.y + flat * Math.tan(lookUp - elevation), target.z); }
    else camera.lookAt(target);
    camera.updateMatrixWorld(true);
  }
  function clampTarget() {
    target.x = THREE.MathUtils.clamp(target.x, bounds.min.x - 15, bounds.max.x + 15);
    target.z = THREE.MathUtils.clamp(target.z, bounds.min.z - 15, bounds.max.z + 15);
  }
  function projection() {
    zoom = Math.min(zoom, baseDistance / minimumDistance());
    camera.aspect = width / height;
    camera.far = Math.max(4000, baseDistance * 4 + bounds.getSize(new THREE.Vector3()).length() * 2);
    const insets = campusViewInsets(width, height, safeArea);
    const top = insets.top, bottom = height - insets.bottom;
    camera.setViewOffset(width, height, 0, height / 2 - (top + bottom) / 2, width, height);
    camera.updateProjectionMatrix(); pose();
  }
  function fitDistance(corners, horizontal, vertical) {
    pose();
    const inverseRotation = camera.quaternion.clone().invert();
    let required = 2;
    // Perspective projected size also depends on each corner's depth. Solving
    // all eight inequalities keeps the near roof/front corners inside the HUD.
    for (const corner of corners) {
      const p = corner.clone().sub(target).applyQuaternion(inverseRotation);
      required = Math.max(required, p.z + Math.abs(p.x) / (tangent * width / height * horizontal),
        p.z + Math.abs(p.y) / (tangent * vertical), p.z + camera.near * 2);
    }
    return required;
  }
  function fitOverview() {
    const savedTarget = target.clone(), savedElevation = elevation, savedAzimuth = azimuth;
    target.copy(initialTarget); elevation = OVERVIEW_ELEVATION; azimuth = HOME_AZIMUTH;
    const insets = campusViewInsets(width, height, safeArea);
    const available = Math.max(.05, (height - insets.top - insets.bottom) / height);
    baseDistance = fitDistance(points(bounds), width <= 760 ? .89 : .83, available * .96);
    target.copy(savedTarget); elevation = savedElevation; azimuth = savedAzimuth;
  }
  function fitFocus() {
    const insets = campusViewInsets(width, height, safeArea);
    const available = Math.max(.05, (height - insets.top - insets.bottom) / height);
    const desired = fitDistance(focusPoints, .86, available * .96);
    zoom = THREE.MathUtils.clamp(baseDistance / desired, 1, MAX_ZOOM);
  }
  function groundPoint(x, y) {
    ndc.set(x / width * 2 - 1, -y / height * 2 + 1); raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  }
  function pointerZoom(nextZoom, x, y) {
    const before = groundPoint(x, y);
    zoom = nextZoom; if (tiltAnchor) elevation = autoElevation(zoom); projection();
    const after = groundPoint(x, y);
    if (before && after) { target.add(before.sub(after)); clampTarget(); projection(); }
  }
  function applyOverviewTransition(nextZoom) {
    const origin = overviewTransition;
    const ratio = THREE.MathUtils.clamp((nextZoom - 1) / (origin.zoom - 1), 0, 1);
    const blend = ratio * ratio * (3 - 2 * ratio);
    zoom = nextZoom;
    target.copy(initialTarget).lerp(origin.target, blend);
    // Use the shortest angle so a previously rotated view cannot spin around.
    const heading = Math.atan2(Math.sin(origin.azimuth - HOME_AZIMUTH), Math.cos(origin.azimuth - HOME_AZIMUTH));
    azimuth = HOME_AZIMUTH + heading * blend;
    elevation = THREE.MathUtils.lerp(OVERVIEW_ELEVATION, origin.elevation, blend);
    groundLevel = origin.groundLevel * blend; plane.constant = -groundLevel;
    projection();
  }
  function zoomBy(factor, x = width / 2, y = height / 2) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    framing = 'free';
    const requested = THREE.MathUtils.clamp(zoom * factor, 1, Math.min(MAX_ZOOM, baseDistance / minimumDistance()));
    if (overviewTransition) {
      if (requested <= overviewTransition.zoom) { applyOverviewTransition(requested); return; }
      applyOverviewTransition(overviewTransition.zoom);
      focusBox = overviewTransition.focusBox; focusPoints = overviewTransition.focusPoints; overviewTransition = null;
    }
    if (requested < zoom && requested < OVERVIEW_TRANSITION_ZOOM) {
      if (zoom > OVERVIEW_TRANSITION_ZOOM) pointerZoom(OVERVIEW_TRANSITION_ZOOM, x, y);
      lookUp = 0;   // zooming out to the overview levels a look-up (only ever non-zero with angles.maxLookUp)
      overviewTransition = { zoom, target: target.clone(), azimuth, elevation, groundLevel, focusBox, focusPoints };
      // The distant overview needs no near-building guard or raised pad plane.
      focusBox = null; focusPoints = null;
      applyOverviewTransition(requested); return;
    }
    pointerZoom(requested, x, y);
  }
  // gentle (opt-in caller, 11-10 liraart: the small midpoint drift of a two-finger pinch): while looking up past the horizon the move is
  // ignored instead of levelling the view, so zooming keeps the look-up. Without look-up (every other package) it is the same pan.
  function pan(dx, dy, gentle = false) {
    if (![dx, dy].every(Number.isFinite)) return;
    const before = groundPoint(width / 2, height / 2), after = groundPoint(width / 2 + dx, height / 2 + dy);
    if (lookUp > 0 && !(before && after)) { if (!gentle) { lookUp = 0; projection(); } return; }   // looking up past the horizon: a pan first levels the view
    if (before && after) {
      framing = 'free'; focusBox = null; focusPoints = null;
      if (overviewTransition) {
        // A pinch also pans its midpoint every frame. Keep the transition's
        // origin stable instead of restarting the fit on every pointer move.
        if (dx !== 0 || dy !== 0) { overviewTransition.focusBox = null; overviewTransition.focusPoints = null; }
        overviewTransition.target.add(before.sub(after));
        overviewTransition.target.x = THREE.MathUtils.clamp(overviewTransition.target.x, bounds.min.x - 15, bounds.max.x + 15);
        overviewTransition.target.z = THREE.MathUtils.clamp(overviewTransition.target.z, bounds.min.z - 15, bounds.max.z + 15);
        applyOverviewTransition(zoom);
      } else { target.add(before.sub(after)); clampTarget(); projection(); }
    }
  }
  return {
    resize(w, h, suppliedSafeArea = safeArea) {
      safeArea = { ...suppliedSafeArea };
      width = Math.max(1, w); height = Math.max(1, h); fitOverview();
      if (framing === 'focus' && focusBox) fitFocus();
      projection();
    },
    overview() {
      overviewTransition = null; framing = 'overview'; focusBox = null; focusPoints = null; groundLevel = 0; plane.constant = 0; azimuth = HOME_AZIMUTH; elevation = OVERVIEW_ELEVATION; tiltAnchor = null; lookUp = 0;
      zoom = 1; target.copy(initialTarget); fitOverview(); projection();
    },
    focus(box, { azimuth: requestedAzimuth = .16, points: suppliedPoints, groundLevel: suppliedGroundLevel = 0, elevationDegrees = null } = {}) {
      if (!box || box.isEmpty()) return;
      focusPlayElevation = Number.isFinite(elevationDegrees) ? THREE.MathUtils.degToRad(THREE.MathUtils.clamp(elevationDegrees, 5, 75)) : PLAY_ELEVATION;
      focusNearElevation = Number.isFinite(elevationDegrees) ? Math.min(NEAR_ELEVATION, focusPlayElevation) : NEAR_ELEVATION;
      overviewTransition = null; framing = 'focus'; focusBox = box.clone(); azimuth = Number.isFinite(requestedAzimuth) ? requestedAzimuth : .16; elevation = focusPlayElevation; lookUp = 0;
      focusPoints = Array.isArray(suppliedPoints) && suppliedPoints.length >= 4 && suppliedPoints.every(p =>
        p?.isVector3 && [p.x, p.y, p.z].every(Number.isFinite)) ? suppliedPoints.map(p => p.clone()) : points(box);
      groundLevel = Number.isFinite(suppliedGroundLevel) ? suppliedGroundLevel : 0; plane.constant = -groundLevel;
      target.copy(box.getCenter(new THREE.Vector3())); fitFocus(); tiltAnchor = zoom; projection();
    },
    adoptPose(position,lookAt,{groundLevel:nextGround=0}={}) {
      if(!position?.isVector3||!lookAt?.isVector3)return;
      const delta=position.clone().sub(lookAt),nextDistance=delta.length();
      if(!Number.isFinite(nextDistance)||nextDistance<2)return;
      overviewTransition=null;focusBox=null;focusPoints=null;framing='free';tiltAnchor=null;lookUp=0;
      target.copy(lookAt);azimuth=Math.atan2(delta.x,delta.z);elevation=Math.asin(THREE.MathUtils.clamp(delta.y/nextDistance,-1,1));
      groundLevel=nextGround;plane.constant=-groundLevel;zoom=THREE.MathUtils.clamp(baseDistance/nextDistance,1,MAX_ZOOM);projection();
    },
    zoomBy, pan,
    orbit(dx, dy = 0) {
      if (![dx, dy].every(Number.isFinite)) return;
      overviewTransition = null; framing = 'free'; azimuth -= dx * .006;
      if (dy !== 0) tiltAnchor = null; // a hand-set angle wins over the automatic tilt
      let next = elevation + dy * .003;
      if (MAX_LOOKUP > 0) {
        if (lookUp > 0 && next > elevation) { const undo = Math.min(lookUp, next - elevation); lookUp -= undo; next -= undo; }
        if (next < MIN_ELEVATION) { lookUp = Math.min(MAX_LOOKUP, lookUp + (MIN_ELEVATION - next)); }
      }
      elevation = THREE.MathUtils.clamp(next, MIN_ELEVATION, 1.35); projection();
    },
    update: pose,
    worldUnitsPerPixelAt(point = target) {
      camera.updateMatrixWorld(true);
      const depth = Math.max(camera.near, -point.clone().applyMatrix4(camera.matrixWorldInverse).z);
      return 2 * depth * tangent / height;
    },
    get zoom() { return zoom; },
    get target() { return target.clone(); },
    get state() { return { zoom, azimuth, elevation, target: target.toArray(), baseVertical: 2 * tangent * baseDistance,
      baseDistance, distance, groundLevel, lookUp, autoTilt: tiltAnchor !== null, maxZoom: Math.min(MAX_ZOOM, baseDistance / minimumDistance()), framing, width, height, projection: 'perspective' }; },
  };
}
