// Ad-reward weapons (user decisions 2026-10-22, 시안/광고무기_발파·불도저_시안.html): watching one rewarded ad unlocks that
// weapon on this device for good. There is no account: the unlocked ids live in one localStorage key (UNLOCK_KEY).
// All weapons are free (user decision 2026-10-23). Set this one flag to true to restore reward locks; the slots stay visible.
// Query strings cannot re-enable locks. Nothing here throws: storage may be blocked or wiped at any time.
export const AD_WEAPONS_ENABLED = false;
export const UNLOCK_KEY = 'beat-school-unlocks';
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/;
// Unlocks made while storage refuses to save still last until the page closes.
const session = new Set();
function query() {
  try { return new URLSearchParams(globalThis.location?.search ?? ''); } catch { return new URLSearchParams(); }
}
export function adWeaponsVisible() { return true; }
export function unlockedWeapons() {
  let saved = {};
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(UNLOCK_KEY) || '{}');
    if (value && typeof value === 'object' && !Array.isArray(value)) saved = value;
  } catch { saved = {}; }
  const all = {};
  for (const [id, on] of Object.entries(saved)) if (on === true) all[id] = true;
  for (const id of session) all[id] = true;
  return all;
}
export function isUnlocked(id) { return !AD_WEAPONS_ENABLED || unlockedWeapons()[id] === true; }
export function saveUnlock(id) {
  session.add(id);
  try { globalThis.localStorage?.setItem(UNLOCK_KEY, JSON.stringify(unlockedWeapons())); return true; } catch { return false; }
}

// Asks for one rewarded ad. Resolves { ok: true } once the ad was watched to the end, otherwise { ok: false, reason }.
// With rewards disabled every request returns 'disabled'. If the flag is restored, requests take the 'noad' path.
// Local check only (localhost, with the flag on): ?adtest=grant plays a short stand-in for the complete unlock flow.
export function requestRewardedAd(weaponId) {
  if (!AD_WEAPONS_ENABLED) return Promise.resolve({ ok: false, reason: 'disabled', weapon: weaponId });
  const test = query().get('adtest');
  if (test === 'grant' && LOCAL_HOST.test(globalThis.location?.hostname ?? '')) {
    return new Promise(resolve => setTimeout(() => resolve({ ok: true, reason: 'test', weapon: weaponId }), 600));
  }
  /*
    After the ad approval, the H5 Games Ads rewarded break goes here (the adsbygoogle loader in the page <head>, then):
      adBreak({ type: 'reward', name: 'unlock-' + weaponId,
        beforeReward(showAdFn) { showAdFn(); },
        adViewed() { resolve({ ok: true }); },
        adDismissed() { resolve({ ok: false, reason: 'dismissed' }); },
        adBreakDone(info) { if (info.breakStatus !== 'viewed') resolve({ ok: false, reason: 'noad' }); } });
    Only adViewed may unlock. Until then every request answers that no ad is available.
  */
  return Promise.resolve({ ok: false, reason: 'noad', weapon: weaponId });
}
