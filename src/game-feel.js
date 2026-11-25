import { WEAPON_TUNING } from './weapon-tuning.js?v=sn130';
export const RHYTHM_TOOLS = Object.freeze(['fist', 'hammer', 'bat']);
const WINDOW = 1.6;

// Only confirmed damage advances the three-hit rhythm. Delayed attacks inspect
// the current chain when they land, so cancelling a queued attack earns nothing.
export function createHitRhythm() {
  let charge = 0, last = -Infinity, weapon = null, finishers = 0;
  const breakChain = () => { charge = 0; last = -Infinity; weapon = null; };
  function state(now) {
    if (!Number.isFinite(now) || now - last > WINDOW || now < last) breakChain();
    return { charge, weapon, finishers, remaining: charge ? Math.max(0, 1 - (now - last) / WINDOW) : 0 };
  }
  function prepare(toolId, now) {
    const current = state(now), eligible = RHYTHM_TOOLS.includes(toolId);
    const finisher = eligible && current.weapon === toolId && current.charge === 2;
    return { eligible, finisher, radiusMultiplier: finisher ? 1.45 : 1, forceMultiplier: finisher ? 1.35 : 1 };
  }
  return {
    state, prepare, breakChain,
    confirm(toolId, now, count) {
      if (!Number.isFinite(now) || !Number.isInteger(count) || count <= 0) { breakChain(); return null; }
      const hit = prepare(toolId, now);
      if (!hit.eligible) { breakChain(); return hit; }
      if (weapon !== toolId) charge = 0;
      weapon = toolId; last = now;
      if (hit.finisher) { charge = 0; finishers++; } else charge++;
      return hit;
    },
    reset() { breakChain(); finishers = 0; },
  };
}

// Pixel-space impulse keeps a small hit legible both in overview and close-up.
// Freeze applies to debris simulation only; weapon fuses stay on real time.
// Rumble (user 10-23): big blasts also get a longer, lower ground shake under the short kick — px, seconds, rise seconds.
// ?shake=classic keeps only the old kick (comparison).
const RUMBLES = { nuke: { px: 7, life: 1.9, rise: .12 }, bazooka: { px: 2.6, life: .55, rise: .03 }, 'mini-bomb': { px: 2.2, life: .5, rise: .03 } };
const classicShake = () => { try { return new URLSearchParams(globalThis.location?.search || '').get('shake') === 'classic'; } catch { return false; } };
export function createScreenImpact({ reducedMotion = false } = {}) {
  let start = -Infinity, amplitude = 0, hold = 0, direction = 1;
  let rumbleStart = -Infinity, rumble = null, seed = 0;
  const rumbles = classicShake() ? {} : RUMBLES;
  const strengths = { fist: 3.2, hammer: 4.3, bat: 4.8, shotgun: 6.2, drill: 1.1, wave: 5.5,
    ball: 6, bomb: 7, 'mini-bomb': 8.2, excavator: 5.8, meteor: 8, nuke: 11, bomber: 6.5,
    // heavy weapons (src/weapon-tuning.js) and the hospital shield
    bazooka: WEAPON_TUNING.bazooka.shake, 'bazooka-launch': 2.2, 'bazooka-shield': 3.5, minigun: 1.1, flamethrower: .7, shield: 3 };
  const NO_HOLD = new Set(['drill', 'minigun', 'flamethrower', 'bazooka-launch', 'bazooka-shield', 'shield']);
  return {
    trigger({ time, toolId, finisher = false, cleared = 0 } = {}) {
      if (reducedMotion || !Number.isFinite(time)) return;
      start = time; direction *= -1;
      amplitude = Math.min(12, (strengths[toolId] || 3) + (finisher ? 2.8 : 0) + (cleared ? 2 : 0));
      hold = NO_HOLD.has(toolId) ? 0 : toolId === 'mini-bomb' ? .045 : toolId === 'bazooka' ? WEAPON_TUNING.bazooka.hitstop : cleared ? .065 : finisher ? .05 : .028;
      // a new rumble replaces a weaker running one, never a stronger one (a bazooka during the nuke rumble keeps the nuke's)
      const next = rumbles[toolId], left = rumble ? rumble.px * Math.max(0, 1 - (time - rumbleStart) / rumble.life) : 0;
      if (next && next.px >= left) { rumble = next; rumbleStart = time; seed = (seed + 1.7) % 6.283; }
    },
    sample(time) {
      if (reducedMotion) return { x: 0, y: 0, freeze: false };
      const age = time - start, rAge = time - rumbleStart;
      let x = 0, y = 0, freeze = false;
      if (Number.isFinite(age) && age >= 0 && age <= .42) {
        const decay = Math.exp(-age * 13), kick = amplitude * decay;
        x = direction * kick * Math.cos(age * 36); y = kick * .65 * Math.cos(age * 29); freeze = age < hold;
      }
      if (rumble && Number.isFinite(rAge) && rAge >= 0 && rAge <= rumble.life) {
        // quick rise, then a slowing fade; two uneven low frequencies per axis so it reads as ground shake, not a wobble
        const env = rumble.px * Math.min(1, rAge / rumble.rise) * (1 - rAge / rumble.life) ** 1.6;
        x += env * (.62 * Math.sin(rAge * 57 + seed) + .38 * Math.sin(rAge * 83 + seed * 2.3));
        y += env * .8 * (.6 * Math.sin(rAge * 49 + seed * 1.7) + .4 * Math.sin(rAge * 91 + seed * .6));
      }
      return { x, y, freeze };
    },
    reset() { start = -Infinity; amplitude = 0; hold = 0; rumbleStart = -Infinity; rumble = null; },
  };
}
