// One place for the hand-feel numbers of the three heavy weapons and the hospital shield. Start values are the defaults of
// 시안/새무기_시안.html (user decision 2026-10-18: ship the mock defaults, tune after playing). Units: world units (0.5 per
// metre, the same as the other tools in src/demo-weapons.js), seconds, shots per second.
export const WEAPON_TUNING = Object.freeze({
  // Visuals only; countdown, impact, destruction and audio clocks stay in their existing owners.
  nuke: Object.freeze({
    capRing: 12, capRingPhone: 9, stem: 22, stemPhone: 15,
    skirt: 14, skirtPhone: 10, wallPuffs: 40, wallPuffsPhone: 16,
    bandAngles: 128, bandAnglesPhone: 72, rings: 3,
    pixelRatio: 1.5, pixelRatioPhone: 1, pixels: 2200000, pixelsPhone: 500000,
    whiteSeconds: .16, warmSeconds: 1.25, exposure: 1.8,
    ballSeconds: 1.35, ringStart: .65, ringFade: 3.7,
    domeStart: 2.7, domeEnd: 5.7,
  }),
  // Black hole: world units, seconds. One active hole; bounded real-fragment animation, no screen render target.
  blackhole: Object.freeze({
    // Reference scale .5 world units / metre; blackhole.js adapts to campus.worldUnitsPerMeter.
    radius: 45, duration: 7.8, cooldown: 0, core: 12, disk: 40, height: 25,
    anticipation: 2, peel: 2.1, wave: .18, darkness: .3,
    batch: 10, batchPhone: 4, pieces: 96, piecesPhone: 40,
    particles: 64, particlesPhone: 24,
    travel: 1.1, orbit: 1.05, turns: 1.5, pop: .7,
    lens: .92, lensPhone: .70, lensSamplesPhone: 2, lensSamples: 4,
    hum: .24, wind: .12, popGain: .32,
  }),
  bazooka: Object.freeze({
    // Round 3 (user 2026-10-18 "bigger, punchier, bigger bite — still below the mini bomb"): radius 4.6 -> 6.2,
    // force 22 -> 27, blast look 1 -> 1.15, hitstop .07 -> .1, shake 7.2 -> 9.6. Mini bomb stays 9.2 / 28.
    radius: 6.2,      // blast radius (shotgun 1.8 · mini bomb 9.2)
    force: 27,        // blast force (mini bomb 28)
    cooldown: 1.0,    // reload, seconds
    flight: .32,      // rocket flight time at 45 units; scaled .78-1.25x by distance
    blast: 1.15,      // fireball / smoke / ring size multiplier (look only)
    hitstop: .1,      // world freeze on impact, seconds
    shake: 9.6,       // screen kick in pixels
    debris: 22,       // flying chunks per explosion (desktop)
    debrisPhone: 14,  // flying chunks per explosion (phone)
    flash: 1,         // light flash on the hit surface and the ground (size multiplier)
  }),
  minigun: Object.freeze({
    rate: 11,         // shots per second while held
    radius: .8,       // damage radius per shot
    force: 4,         // force per shot
    // Round 5 (user 2026-10-18): no overheat stop - it fires for as long as it is held. Heat is look only now.
    heatUp: 3.2,      // seconds of continuous fire until the barrels glow fully (look only, never stops the fire)
    cool: 1.6,        // seconds for the glow to fade from full heat
    spread: 1,        // aim jitter, degrees
    spinUp: .12,      // barrel spin-up before the first shot, seconds
    // Round 3 impact detail (look only)
    decals: 40,       // bullet-hole decals alive at once (desktop; oldest is reused)
    decalsPhone: 28,  // same on phones
    decalLife: 5,     // seconds a bullet hole stays (fades over the last third)
    chips: 2,         // tiny chips flying off per hit
    ricochet: .3,     // share of hits that throw a long ricochet spark
    impactTicks: 7,   // impact sound ticks per second at most
  }),
  flamethrower: Object.freeze({
    // Round 2: radius 2.4 -> 3.0, char 1.1, spread ring. Round 3 ("far too weak"): radius 3.4, char 2.4, ring 5 x .6, depth
    // 2 x .7, follow-through 1.4 s, afterburn .3 - measured 2 s held 0.39-0.45 % of the campus (≈ 0.8 bazooka), sweep 0.63 %.
    // Round 4 (user 2026-10-18 "now TOO strong"): between round 2 and round 3. On Underwood the tower falls as one piece
    // (~0.3 % of the campus) once enough char reaches it, so the lever is WHEN: round 3 dropped it at ~0.3 s of contact,
    // round 2 never within 2 s, now ~1-2 s (char 1.0, no depth points, shorter follow-through). Measured (1280, same session):
    // held 2 s 0.31-0.35 % (settled 0.38-0.40), sweep 2 s 0.26 % (round 3 0.61-0.66, round 2 0.15), bazooka 0.50, mini bomb
    // 0.68 - reports/2026-10-18_새무기_4차/final/results.json (variant V7).
    radius: 3.2,      // scorch radius at the aimed surface (and at each spread / depth point)
    charPerSecond: 1,   // char added per second at the centre (1 = crumbles); falloff to 35 % at the radius edge
    spreadPoints: 4,  // points on a ring around the contact that also char each tick (char spreads to the neighbours)
    spreadRadius: 2.1, // ring radius, world units (0.5 per metre)
    spreadShare: .5,  // char at each ring point as a share of the centre's
    depthPoints: 0,   // points behind the contact along the stream (eats into the building, not only its skin)
    depthStep: 2.2,   // spacing of the depth points, world units
    depthShare: .6,   // char at each depth point as a share of the centre's
    followTime: .5,   // after the stream punches through, keep burning deeper along it this long (seconds)
    burrowSpeed: 6,   // how fast the follow-through point moves deeper (units per second)
    burrowMax: 4,     // how deep it goes behind the last contact (units)
    burrowShare: .7,  // char rate while following through, as a share of charPerSecond
    afterburn: .15,   // burnt spots keep charring at this share of charPerSecond (x their heat) after the stream leaves
    burnSpots: 8,     // burning spots remembered (smoke + afterburn)
    smokeLinger: 3.5, // seconds a spot keeps smoking after the stream leaves
    smokeRate: 6,     // smoke puffs per second from a fully hot spot
    smokeCap: 96,     // flame smoke particle cap (desktop)
    smokeCapPhone: 64, // flame smoke particle cap (phone)
    tipSmoke: .1,     // chance that a dying flame tongue leaves a thin curling smoke wisp
    size: 1,          // flame size multiplier
    cone: .03,        // stream half-spread: target jitter as a share of the reach
    flight: .26,      // seconds the fire takes from the nozzle to the wall (even speed on screen)
    lift: 3,          // buoyancy of the tongues once they leave the stream (units/s^2; x3 after they spread over a wall)
    particles: 150,   // flame tongue cap (desktop)
    particlesPhone: 120, // flame tongue cap (phone)
    linger: .3,       // flames die out this long after release
    tick: 1 / 15,     // scorch / aim probe interval, seconds
    // Round 4 look (real fire): continuous stream strip + shader tongues
    nozzleWidth: .045, // stream half-width at the nozzle, in gun-model units (the nozzle bore)
    streamWidth: 1.05, // stream half-width at the wall, world units (x reach factor .6-2)
    streamShare: .8,  // share of the tongue budget that rides the stream (the rest licks off the surface / burnt spots)
    surfaceLicks: 30, // tongues per second rolling over the hit surface and licking upward (desktop; phones x .65)
    occlusion: .5,    // how much the cooler fire darkens what is behind it (0 = purely additive glow)
    occlusionPhone: .28, // phones: see-through so the target stays visible
    alphaPhone: .62,  // phones: overall fire opacity
    widthPhone: .6,   // phones: stream / tongue width (the target must stay visible)
  }),
  // Laser cutter (src/laser-cutter.js; free, user decisions 2026-10-22 on 시안/무기_레이저절단기_시안.html: hand-held cutter view B,
  // red, width 'mid', long afterglow). Hold and draw a line over a building: the beam scores the wall along it; on release the
  // stroke and the wall normal give a plane, the cells on it are cut out as a groove and the part above slides off along it.
  laser: Object.freeze({
    core: '#fff1ea',    // beam core colour (mock red)
    glow: '#ff2414',    // beam glow colour
    coreWidth: 3.6,     // beam core, screen pixels (mock 'mid')
    glowWidth: 17,      // beam glow, screen pixels
    beamFade: .4,       // beam fades out this long after release (mock 'long')
    glowTau: 2.6,       // heat decay of the scored line, seconds (mock 'long'); cut faces cool x1.7 slower (as in the mock)
    markWidth: .12,     // scored line half-width at the wall, world units (0.5 per metre; the mock's .45 m line) ...
    markPixels: 1.6,    // ... but never thinner than this many screen pixels (half-width); its glow is 3.6x wider
    markLife: 9,        // scored line fades out over the last 40 % of this (seconds)
    marks: 900, marksPhone: 600, // scored segments alive at once (oldest reused)
    // cut
    minStroke: .75,     // path on the building at least this long (world units; 1.5 m), else only the groove under it
    straight: .08,      // a path that strays at most this share of its chord from it is straight: the part slides down the face;
                        // a zigzag / curve: the part trembles and drops (round 2, user 10-22: cut along the drawn path)
    minSamples: 3,      // probe hits on that building
    kerfCells: 1,       // groove thickness, in fragment cells
    kerfForce: 5,       // groove fragments leave with this force (ordinary debris path)
    cooldown: .3,       // after a cut, the next press waits this long
    maxChunks: 3, maxChunksPhone: 2, // sliding parts at once; one more ends the oldest at once (rubble)
    shudder: .14,       // the cut part trembles this long before it moves
    slideAccel: 15,     // slide acceleration from gravity along the cut face (x the slope), units / s^2 ...
    slidePush: 4,       // ... plus a push out of the wall, so a level cut still slides off
    gravity: 19,        // free fall once it has slid off (the debris gravity in model-destruction.js)
    spin: 2.2,          // tumble rate at most, radians / s
    toppleRate: 3.4,    // steep cut: the lighter side tips over away from the cut (angular acceleration, rad / s^2)
    maxFall: 6,         // seconds at most from release to rubble (a safety net)
    landFly: 28, landFlyPhone: 16, // fragments that fly off as debris when it lands (the rest sinks into the dust)
    kerfFly: 10, kerfFlyPhone: 6, // groove fragments nearest the stroke that fly as chips (the rest of the groove vaporises)
    heatCells: .6,      // cut faces: fragments within this many cells of the groove glow (both sides, the falling part too) ...
    heatPeak: .9,       // ... this hot at the groove (1 = orange, .5 red, 0 dull; the far side of the band x .45; model-destruction.js shader) ...
    char: .35,          // ... cool with glowTau x 1.7 and keep this char tint
    // A + C preview (?laser=new), metres, seconds and linear-light colours. Old look above is unchanged.
    meltWidth: .35, charWidth: .3, // measured inward from the actual exposed cut edge (not the removed cell centre)
    meltTau: 2.8, meltPeak: 1, meltEmission: 3.2, charStrength: .88,
    meltWhite: [1, .94, .78], meltYellow: [1, .62, .08], meltOrange: [1, .16, .008],
    meltRed: [.32, .012, .002], meltChar: [.018, .012, .009],
    cutSparkRate: 65, cutSparks: 120, cutSparksPhone: 64,
    dropletRate: 7, dropletLife: 1.1, dropletGravity: 9, dropletSize: .1,
    cutSmokeRate: 7, cutSmoke: 64, cutSmokePhone: 36, cutSmokeAlpha: .16,
    cutWorkMs: .6, cutWorkMsPhone: 1.8, // per-frame wall-time budget for cut-distance baking; never block pointerup
    // look while cutting
    sparkRate: 150, sparks: 380, sparksPhone: 240,
    smokeRate: 11, smoke: 140, smokePhone: 90,
    probeGap: 14,       // screen pixels between interpolated aim probes while the pointer moves fast
    shieldPing: .45,    // protected building: shield flash at most this often while the beam is on it
  }),
  shield: Object.freeze({
    pingInterval: .45, // held contact (drill / flamethrower) re-plays the shield "ting" at most this often
    domeSeconds: 4.2,  // nuke dome life
  }),
  // Ad-reward blast demolition (src/blast-demolition.js; user decisions 2026-10-22, 시안/광고무기_발파·불도저_시안.html variant
  // "직접 설치 + 순서대로"). Lengths in metres (x worldUnitsPerMeter at runtime). Setting up the charges is its
  // price: a building comes down whole only once enough of its ground floor is cut, so it never beats the free weapons outright.
  blast: Object.freeze({
    maxCharges: 8,      // charges placed at once (all buildings together)
    floor: 4.2,         // ground-floor band: fragments whose centre is at most this high above the building's base
    halfWidth: 4,       // each charge cuts a strip of the band this wide either side ...
    reach: 24,          // ... running this far into the building
    doom: .45,          // share (by weight) of the band gone after a building's last charge -> the whole building comes down
    step: .22,          // seconds between charges, in placement order
    settle: .45,        // after a building's last charge it waits this long, then comes down (or only the cut side drops)
    chips: 12,          // fragments per charge that fly as chips (the rest of the strip vanishes in the blast)
    force: 14,          // chip throw force
    snap: 2.5,          // a tap this close to a charge on the same building takes it off again
    // collapse look (model-destruction.js split `drop`): tremble, then each fragment falls to the base and sinks into the dust
    shake: .3,          // tremble before the fall, seconds
    spread: .25,        // upper fragments let go up to this much later than the base
    gravity: .6,        // fall acceleration, x the debris gravity
    fly: .05,           // share that is thrown off as debris when it lands (the rest sinks)
    linger: 1.3,        // seconds the landed heap takes to sink away
    size: 1.4,          // charge / detonator model size, x the mock's metres
  }),
  // Ad-reward bulldozer (src/bulldozer.js; user decisions 2026-10-22, 시안/광고무기_발파·불도저_시안.html variant B, icon B1).
  // Lengths in metres (x worldUnitsPerMeter at runtime), speeds in metres per second. Like the blast it brings a building down
  // whole only once enough of its ground floor is gone; the price is driving the blade through it.
  bulldozer: Object.freeze({
    size: 1.3,          // model scale x real metres (a ~6 m machine, slightly oversized so it reads at campus distance)
    blade: 4,           // blade width, metres before `size` (narrow, mock note)
    floor: 4.2,         // scraped band: this high above the ground the dozer stands on; also the building's ground-floor band (as blast)
    bite: 1.4,          // the blade takes fragments whose centre is up to this far ahead of its face ...
    margin: .4,         // ... and up to this much wider than the blade on each side
    speed: 8,           // top speed on open ground
    pushSpeed: 3.4,     // top speed while the blade is scraping a building
    accel: 7,           // speeding up, m/s per second
    brake: 14,          // slowing down (letting go, arriving)
    turn: 1.7,          // steering, radians per second
    slow: 5,            // eases off within this distance of where it is heading
    arrive: 1.2,        // closer than this to the pointed spot it stops
    push: 30,           // held on a building: it heads this far past the pointed spot, in the direction it went in
    tapDrive: 24,       // a quick tap drives at most this far (then stops by itself)
    spawnBack: 12,      // pressed on a building: the dozer appears this far out from the wall, facing it
    reuse: 70,          // a press farther than this from the parked dozer brings a new one there
    minPixels: 36,      // look only: zoomed far out the model grows so it stays at least this many CSS px long ...
    maxLook: 3.4,       // ... up to this many times its size (the scraped strip stays the real blade width)
    touchLift: 64,      // CSS px: on touch it heads for a point this far above the finger, so the finger does not cover it
    maxStep: 2.5,       // it will not drive up a step higher than this (retaining walls); pads and kerbs are fine
    rate: 12,           // scrapes per second while moving
    chips: 4,           // fragments per scrape that fly forward as chips (the rest of the scraped band vanishes)
    force: 9,           // chip throw force
    // A building comes down whole once this share (by weight) of its ground-floor band is gone: doomScale / sqrt(footprint m²),
    // kept within doomMin .. doom - a bigger building needs a smaller share but more scraped metres. Measured 10-22 (real
    // Chromium): Underwood 987 m² -> .115, one push through (~.12); KAIST KI빌딩 5,120 m² -> .05, two to three pushes (~.025 each).
    doom: .3,           // at most (small buildings)
    doomMin: .03,       // at least (the biggest buildings)
    doomScale: 3.2,
    doomDelay: .35,     // ... this long after the scrape that reached it (the dozer keeps going)
    settle: .7,         // a building not scraped for this long (and below doom) drops only the part above the scraped strip
    shieldGap: 1,       // a protected building this close in front of the blade stops the dozer (shield lights, no damage)
    shieldPing: .45,    // shield flash at most this often while it is held against one
    // collapse look: same split `drop` as the blast
    shake: .3, spread: .25, gravity: .6, fly: .05, linger: 1.3,
  }),
  // SKKU-only bowling-ball bomb (src/bowling-ball.js; user decisions 2026-10-18: option A "drop it up the slope", classic black
  // ball, "smash far more as it passes", and it explodes when it stops). Start = the mock's tuned panel (시안/성대_볼링공_시안.html),
  // then the plough was widened (radius x1.35-1.75, two hits higher up the facade), each first contact got a strike blast +
  // shock + flying chunks, and momentum loss only counts the ploughed pieces (capped per hit).
  bowling: Object.freeze({
    cooldown: 2,        // seconds between throws (the final blast makes each throw a big payoff)
    maxBalls: 3,        // live balls; a 4th throw makes the oldest blow up early
    radius: 3.2,        // ball radius, world units (0.5 per metre)
    mass: 1,
    // Round 2 (user 10-18 "too slow; can't tell where it starts"): stronger gravity, less friction, a downhill shove at release,
    // a shorter walk up the slope and a lower drop, so a typical throw reaches the tapped spot in ~1.5-2.5 s.
    friction: .022,     // rolling friction (x gravity); plus a small speed-squared drag   (round 1: .035)
    drag: .0004,        // (round 1: .0007)
    gravity: 26,        // (round 1: 18)
    maxSpeed: 42,       // speed cap, units per second (the plough / tunnelling stay safe at 120 Hz substeps)
    push: Object.freeze([20, 28]), // release shove towards the spot, tried in this order (round 1: 10, 16)
    spawnHeight: 10,    // drop point: walk uphill from the spot until the ground is this much higher ... (round 1: 18)
    walkMin: 18,        // ... but at least this far (round 1: 24) ...
    walkMax: 52,        // ... and at most this far (round 1: 80)
    drop: 4,            // the ball is let go this high above the ground there (round 1: 9)
    uphill: Object.freeze([-.5, -.866]), // fallback uphill direction on the SKKU slope (x, z)
    breakSpeed: 4,      // slower than this the ball only bumps walls
    strikeSpeed: 12,    // first contact with a building at this speed or more is a strike
    // rolling plough (campus.hit every 1/ploughRate s while touching a building)
    ploughRate: 40,
    ploughRadius: 1.35, // hit radius = ball radius x (ploughRadius + ploughGrow x speed / 22)
    ploughGrow: .4,
    ploughForce: 8,     // force = ploughForce + speed x ploughForcePerSpeed (capped at 30)
    ploughForcePerSpeed: .9,
    columnHits: 2,      // extra hits stacked above the ball (floors above the path go too)
    columnStep: 1.6,    // spacing of those, x ball radius
    eat: 260,           // momentum: speed x exp(-ploughed pieces / (eat x mass)) per hit ...
    maxLoss: .1,        // ... but never more than this share of the speed per hit
    // strike (first contact with each building at strikeSpeed or more)
    strikeRadius: 2.2,  // x ball radius
    strikeForce: 27,
    shockReach: 16,     // other buildings this close to the strike get a shock hit on their near side
    shockRadius: 3.6,
    shockForce: 15,
    shrapnel: 9,        // flying chunks per strike that break what they fly into (phones: shrapnelPhone)
    shrapnelPhone: 6,
    shrapnelRadius: 2.4,
    shrapnelForce: 16,
    hitstop: .09,       // strike freeze, seconds
    slowmo: .3,         // then slow motion easing back to full speed, seconds
    // bomb
    armDelay: .9,       // no stop check in the first moments after the drop
    stopSpeed: 1.4,     // below this speed for stopTime seconds -> the fuse burns down
    stopTime: .4,
    fuse: .7,           // burn-down, seconds
    maxLife: 4.3,       // seconds; then it burns down wherever it is -> release to blast <= 5 s (round 1: 20, round 2: 12)
    // Round 3 (user 10-18 "it sometimes crawls for a long time"): end the slow tail. Before it has reached the spot only a real
    // crawl counts; after that (or after its first building) slower than crawlShare of its peak speed also counts.
    crawlSpeed: 6,      // units per second
    crawlShare: .42,    // x the throw's peak speed (while it ploughs a building: x .6 of that)
    crawlTime: .45,     // seconds below the line -> the fuse burns down
    passMargin: 6,      // "past the spot" = this much further than its closest pass ...
    passDecel: .8,      // ... and losing speed faster than this (units / s^2) ...
    passSlowTime: .3,   // ... for this long (not while ploughing) -> the fuse burns down
    fuseBrake: 2.5,     // while the fuse burns the ball brakes (per second), so it blows up where it was armed
    // Round 3 (user 10-18): the play-area edge is an invisible wall (the village beyond cannot be damaged)
    wallBounce: .55,    // restitution of the bounce off the edge
    wallKeep: .85,      // share of the speed kept along the edge on a bounce
    // Round 3 (user 10-18 "hidden behind buildings before it blows"): x-ray silhouette where walls hide the ball
    xray: .55,          // silhouette opacity when the ball is hidden behind a building
    xrayTerrain: .4,    // x that when no building is in the way (hills / trees only)
    xrayFar: 420,       // camera distance where the silhouette has faded to its far level
    fuseOnTop: .7,      // last seconds of the fuse: spark + glow are drawn over everything
    nudgeAfter: .3,     // follow camera: hidden this long -> it lifts a little higher, if that clears the view ...
    nudgeMax: .45,      // ... by at most this much elevation (radians)
    runOut: 25,         // once this far past the closest pass to the spot ...
    runOutBrake: .9,    // ... it brakes (per second), so the run-out stays short with the round-2 low friction
    outTime: .35,       // safety net only (round 3 edge wall): seconds outside the play area before it burns down
    blastRadius: 9.2,   // = mini bomb
    blastForce: 28,     // = mini bomb
    // look
    dust: 900,          // dust particle cap (phones: dustPhone)
    dustPhone: 420,
  }),
  // Wrecking-ball crane (src/wrecking-ball.js; user decision 2026-10-18 "make the wrecking ball real", mock
  // 시안/새무기_후보_시안.html). Tap a building: a crawler crane stands beside that wall (outside buildings, clear of trees /
  // lamps / protected buildings, on flat enough ground), the ball is held back by a tag line and swings in at ~45 degrees,
  // raking up through the floors. Same building = the parked crane turns / slides; another building = it drops in there.
  wreckingBall: Object.freeze({
    ballRadius: 2.4,    // steel ball radius, world units (0.5 per metre; cartoon scale, the mock had 3)
    cable: 19,          // boom tip sheave to the ball centre
    shortCable: .72,    // narrow spots (alleys) may use a shorter cable: x cable
    pull: 58,           // pull-back angle, degrees from hanging straight down
    gravity: 200,       // ball gravity (game time: release -> wall ~.53 s)
    damping: .22,       // air drag on the swing (per second) ...
    restDamp: 2,        // ... and once the follow-through has had 1.4 s (it settles hanging under the tip in ~3 s)
    planeAngle: 45,     // (round 1) swing plane vs the wall normal; round 2 prefers the plane parallel to the screen
    // damage (campus.hit along the ball path while it moves through a building, in any direction, faster than breakSpeed)
    hitRate: 45,        // hits per second while touching a building
    bite: 2.5,          // hit radius = ball radius x bite
    force: 27,          // force at full speed (scaled by speed / 30, .55-1.2)
    column: 3,          // extra hits stacked above the ball (floors above the path) ...
    columnStep: 1.4,    // ... this far apart (x ball radius), radius x .85
    below: 1,           // and hits below the ball (while above the ground)
    breakSpeed: 7,      // slower than this the ball only nudges
    slamSpeed: 20,      // first contact with a building at this speed or more is a slam: one wider punch ...
    slamRadius: 3,      // ... of this radius (x ball radius) ...
    slamForce: 28,      // ... and force
    slamKick: .4,       // the wall shoves the ball back up its rope (x speed): it goes slack and jerks taut
    eat: 300,           // momentum: speed x exp(-pieces / eat) per hit ...
    maxLoss: .12,       // ... never more than this share per hit
    shieldBounce: .45,  // protected building: the ball bounces back with this share of its speed
    // feel
    hitstop: .07,       // module freeze on the first slam (the host adds the bazooka screen kick + hold)
    slowmo: .16,        // then eases back to full speed
    // timing (round 2, user 10-19: drive in along the ground instead of dropping from the sky; haul the hanging ball back)
    driveMin: .4,       // drive-in time, at least ...
    driveMax: .5,       // ... at most
    driveSpeed: 120,    // ... units per second of approach (the crawler eases out as it arrives)
    lowerIn: .34,       // no ground route: the crane is lowered in this fast (with a dust puff)
    settle: .28,        // after arriving: the boom raises to the wall and the tag line hauls the ball back
    haul: .36,          // a parked crane hauls the hanging ball back to the pull-back pose
    windup: .05,        // held, a last tightening before the release
    moveMax: 26,        // another spot this close (straight drivable): the parked crane drives there (round 3, user 10-19
                        // "멀리 있는 걸 고르면 이동이 어색해") - pivot the tracks, boom down, accelerate / cruise / brake ...
    travelSpeed: 75,    // ... cruising at most this fast (units / s; round 2 glided at up to ~120) ...
    travelAccel: 200,   // ... speeding up / braking this hard (units / s^2) ...
    pivotRate: 220,     // ... tracks pivoting on the spot at this average rate (deg / s; round 2 snapped at 1200-2700) ...
    slewRate: 240,      // ... the house slewing straight to its next working direction at most this fast on average (deg / s) ...
    lowerTime: .4,      // ... the boom going up to the travel pose in this long ...
    travelLuff: 72,     // ... this steep (degrees): tip and ball drawn in toward the crane, clear of the walls on the way
    travelHold: 120,    // the tag line holds the hanging ball under the tip while travelling: spring (1 / s^2) ...
    travelHoldDamp: 12, // ... and damping (1 / s): it lags and sways a little, it does not fly round the boom
    pitchDip: .00025,   // body pitch per unit of acceleration (rad per unit / s^2): rocks back pulling away, dips braking
    // farther / blocked: the parked crane drives off out of sight (out of the frame or behind a building) while a crane drives
    // in at the new spot at once (skipped when the parked crane is already out of sight); also when the weapon is put away
    exitSpeed: 80,
    exitAccel: 160,
    exitBudget: 1.3,    // ... when that takes at most this long; otherwise it backs off a short clear way and parks as a spare
    parkRun: 16,        // ... this far at most (it goes once the camera no longer sees it)
    exitMax: 3,         // seconds at most on the way out before it is taken away (a safety net)
    driveFar: .6,       // drive-in from farther out (where every near start is inside the frame): at most this long
    refire: .22,        // after an impact a new tap is taken this soon (hauled from wherever the ball is)
    // placement
    footprint: 5.6,     // crane swing radius (tracks + rotating house tail), world units
    margin: 1,          // extra clearance from building boxes
    treeCore: 6,        // strict: no tree / lamp edge closer than this to the crane centre (round 1: 5.2) ...
    treeSoft: 8,        // ... and fewer is better up to here; relaxed spots push trees over (lamps still keep clear)
    maxSlope: 3.2,      // height difference across the tracks, world units (the crane tilts with the ground)
    liftMax: 7,         // on a slope the ball may swing in up to this much higher than the tapped point
    reachMin: 9,        // horizontal boom reach range
    reachMax: 62,
    // camera (round 2, user 10-19): the held ball never nearer the lens than the wall, never covering more than coverMax of
    // the screen (strict levels); the swing plane prefers being parallel to the screen (weight x |plane . view|)
    coverMax: .12,
    parallel: 2,
    // look
    dust: 700, dustPhone: 360,
    sparks: 160, sparksPhone: 110,
    chunks: 48, chunksPhone: 30,
    idle: 1,            // diesel idle loudness (x the mock level)
  }),
  // Ruyi staff 여의봉 (src/ruyi-staff.js; user request 2026-10-26 "위에서 아래로 내려찍고 막 길어지게"). Tap: a short golden
  // staff appears high above the spot, then stretches (bottom end shoots down, top end shoots up into the sky) through the
  // building to the ground, rests a moment and shrinks back up. Units: world units at .5 per metre (scaled to the campus).
  ruyi: Object.freeze({
    radius: 1.25,       // staff radius (2.5 m thick; nearly constant while it stretches)
    bite: 3.2,          // column hit radius = radius x bite (top -> bottom, while the tip passes)
    force: 24,          // column hit force
    step: .8,           // column hits this far apart (x hit radius)
    perFrame: 5,        // at most this many column hits a frame (the rest follow on the next frames) ...
    perFramePhone: 3,   // ... on a phone
    slamRadius: 5,      // ground slam: one wider punch of this radius (x staff radius) just above the ground ... (10-26: 7
                        // levelled 3-4 storey halls in one tap; 5 = about half of one, a hole through the big ones)
    slamForce: 27,      // ... and force
    cooldown: .8,       // a new tap after this long (two staffs may be out at once)
    // timing (seconds)
    appear: .16,        // short staff glints in high above the target (lowered into the frame when the camera is close)
    extend: .3,         // stretch: tip from the sky to the ground (accelerating), top up out of the frame
    hold: .34,          // stuck in the ground, ringing
    retract: .42,       // shrinks back up into the sky
    // shape
    startLen: 16,       // length when it appears
    above: 36,          // its tip starts this far above the highest roof under it
    topRise: 150,       // the top end climbs this much while stretching
    sink: .7,           // the tip ends this far below the ground (10-26: 2.2 buried the bottom band)
    // look (phone caps in brackets)
    dust: 90, dustPhone: 44,
    chunks: 24, chunksPhone: 12,
  }),
  // Robot vacuum 로봇청소기 (src/robot-vacuum.js; user decisions 2026-10-26, mock 시안/로봇청소기_시안.html look A). Tap: it
  // drops in, roams `roam` seconds (straight -> bump -> back off -> turn, now and then along the wall), swallows rubble near
  // it and bites the bottom of walls it bumps, then sparkles away. Units: world units at .5 per metre (scaled to the campus);
  // shares marked "x D" are of the diameter.
  robovac: Object.freeze({
    diameter: 16,       // 32 m across: about half a 4-5 storey block's length, wider than it is deep (bowling ball 6.4; 10-26 r1: 13
                        // was 40-48 % of the median building length on skku / yonsei / bundangjungang)
    band: .2,           // wall test height (x D): fragments lower than this above the ground are walls to it
    speed: .7,          // x D per second
    turn: 4.2,          // turn rate, radians per second
    roam: 10,           // seconds of cleaning, then it sparkles away (no dock)
    vanish: .6,         // shrink-and-spin time
    maxLive: 3,         // at once; another tap sends the oldest away
    cooldown: .45,      // between taps
    dropHeight: 2.4,    // dropped from this high (x D) ...
    gravity: 7,         // ... falling at this (x D / s^2)
    maxSlope: .5,       // ground rising faster than this (rise / run) is a wall
    // ground-floor bite (campus.hit spheres just above the ground)
    chewRadius: .13,    // bump: hit radius (x D) ...
    chewHits: 3,        // ... this many across the bumper ...
    chewLift: .1,       // ... centred this high (x D) above the ground ...
    chewForce: 10,      // ... at this force
    scrapeRadius: .09,  // wall following: a lighter scrape (x D) ...
    scrapeForce: 7,
    scrapeEvery: .45,   // ... every this many seconds
    followChance: .38,  // after a building bump, the chance it follows the wall ...
    followTime: Object.freeze([2, 3.2]), // ... for this long (seconds)
    // rubble (released fragments that are not yet retired)
    pullRadius: 1.9,    // swallowed within this (x radius) ...
    holdRadius: 4,      // ... kept from fading within this ...
    seekRange: 5,       // ... and the nearest within this pulls its heading (x radius) ...
    seek: 1.1,          // ... at this many radians per second
    suckTime: .42,      // swirl-in time of a stand-in chunk
    suckMax: 24, suckMaxPhone: 14, // stand-ins at once; the rest are removed at once
    scanEvery: .1, scanEveryPhone: .15, // rubble search interval (seconds)
    // look (phone caps)
    dust: 80, dustPhone: 40,
    dustPatches: 14,    // PC only: floor dust left by impacts that it wipes clean (0 = off)
    dustTexture: 256,
  }),
});
