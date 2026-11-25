// Public demo loadout. Earned progression from earlier prototypes stays untouched.
// Bag order (user decisions 2026-10-18, laser cutter 2026-10-22): bat · drill · shotgun · minigun · flamethrower · laser cutter ·
// bazooka · wrecking ball · mini bomb · nuke · blast · bowling · blackhole (all free).
// Laser cutter (free, user decision 2026-10-22): src/laser-cutter.js, numbers in weapon-tuning.js `laser`, icon A of
// 시안/무기_레이저절단기_시안.html (the hand-held cutter).
// Wrecking ball (free, user decision 2026-10-18 "make it real"): src/wrecking-ball.js, numbers in weapon-tuning.js `wreckingBall`.
// The three heavy weapons take their numbers from src/weapon-tuning.js; `icon` is the bag symbol markup (48 x 48,
// 시안/새무기_시안.html) for tools whose symbol is not in the page sprite.
import { WEAPON_TUNING as T } from './weapon-tuning.js?v=sn130';
import { AD_WEAPONS_ENABLED } from './ad-rewards.js';
export const DEMO_TOOLS = Object.freeze([
  { id: 'bat', category: 'melee', name: '야구방망이', radius: 3.8, force: 17, cooldown: .34,
    color: 0xf7b661, hint: '클릭·터치 · 3연타마다 강타',
    description: '벽 한쪽을 시원하게 날려요. 빠르게 세 번 맞히면 강타.' },
  { id: 'drill', category: 'melee', name: '전동 드릴', radius: 1.45, force: 6, cooldown: .10,
    color: 0x76caed, hint: '누르는 동안 작동 · 움직여 벽을 갈아요',
    description: '선택하면 드릴이 나타나요. 누르는 동안 벽을 따라 파고들어요.' },
  { id: 'shotgun', category: 'gun', name: '펌프 산탄총', radius: 1.8, force: 16, cooldown: .82,
    color: 0xb58b5c, hint: '클릭·터치 한 발 · 펌프 후 다시 발사',
    description: '일곱 발의 산탄으로 외벽을 뜯어내요. 한 발 쏘고 철컥, 다시 한 발.' },
  { id: 'minigun', category: 'gun', name: '연사 총', radius: T.minigun.radius, force: T.minigun.force, cooldown: 1 / T.minigun.rate,
    color: 0x9aa5ab, hint: '누르는 동안 연사',
    description: '누르고 있으면 드르륵 긁어내요. 3초 넘게 쏘면 총열이 달아올라 잠깐 식혀야 해요.',
    icon: '<path fill="#6f7f3d" d="M7 32h11v8H7z"/><path d="M10 33v6m4-6v6"/><rect fill="#414b51" x="4" y="18" width="16" height="15" rx="2"/><path d="M9 18v-5h8v5"/><path fill="#9aa5ab" d="M20 19h19v4H20zm0 4h22v4H20zm0 4h19v4H20z"/><path fill="#5d6870" d="M31 17h4v16h-4z"/><path stroke="#f49a32" d="m44 18 3-3m-2 9h3m-4 6 3 3"/>' },
  { id: 'flamethrower', category: 'gun', name: '화염방사기', radius: T.flamethrower.radius, force: T.flamethrower.charPerSecond, cooldown: T.flamethrower.tick,
    color: 0xe0574a, hint: '누르는 동안 불꽃 · 오래 지지면 와르르',
    description: '한 자리를 지지면 시커멓게 그을리다가 와르르 무너져요. 불은 번지지 않아요.',
    icon: '<rect fill="#e0574a" x="3" y="29" width="18" height="12" rx="6"/><path d="M8 29v-4h4"/><path fill="#414b51" d="M11 20h15v7H11z"/><path fill="#9aa5ab" d="M26 21h6v5h-6z"/><path fill="#39414b" d="m15 27-2 7h4l2-7"/><path fill="#f49a32" d="M33 23.5c1-4.5 4-7 6.5-5.5 1.5-2.5 5-1.5 5 1.5 2.5 1 2.5 5 0 6 .5 3-3 4.5-5 2.5-2.5 2-6 .5-6.5-4.5z"/><circle cx="39.5" cy="23.5" r="2.6" fill="#ffd950"/>' },
  { id: 'laser', category: 'melee', name: '레이저 절단기', radius: T.laser.markWidth * 4, force: T.laser.kerfForce, cooldown: T.laser.cooldown,
    color: 0xff2414, hint: '누른 채 그어요 · 떼면 잘린 위가 미끄러져요',
    description: '건물 위에 선을 그으면 빛줄기가 그대로 베어 내요. 손을 떼면 잘린 윗부분이 미끄러져 떨어져요.',
    icon: '<path fill="#b9b6ae" d="M40 9h6v31h-6z"/><path stroke="#c7c2b8" stroke-width="1.4" d="M41.5 15h3m-3 6h3m-3 12h3"/><path d="M4 41c4 0 5-4 5-9"/><path fill="#39414b" d="m12 30-3 10h6l2.5-10"/><rect fill="#ffd950" x="6" y="17" width="21" height="13" rx="2"/><path fill="#39414b" d="M6 19.5a2.5 2.5 0 0 1 2.5-2.5H27v4H6z"/><path d="M11 24.5v3m4-3v3m4-3v3"/><path fill="#9aa5ab" d="M27 19.5h4.5l3.5 4-3.5 4H27z"/><path stroke="#e8402f" stroke-width="4" d="M36 23.5h4"/><path stroke="#fff3e6" stroke-width="1.3" d="M36 23.5h4"/><path stroke="#f49a32" d="m37.5 17.5-2-3m3 13-2 3m-3-7h-1"/>' },
  { id: 'bazooka', category: 'explosive', name: '바주카', radius: T.bazooka.radius, force: T.bazooka.force, cooldown: T.bazooka.cooldown,
    color: 0x7c8c46, hint: '클릭·터치 한 발 · 1초 재장전',
    description: '로켓 한 발로 벽을 크게 한 칸 뚫어요. 산탄총보다 넓고 미니 폭탄보다 빨라요.',
    icon: '<path fill="#4a5228" d="M5.7 34.7 2.4 35.3l6.4 8.9 1.5-2.9z"/><path fill="#7c8c46" d="M5.7 34.7 33.7 14.7l4.6 6.6-28 20z"/><path fill="#ffd950" d="m21 23.5 2.5-1.7 4.8 6.8-2.4 1.8z"/><path fill="#e85a3c" d="m33.1 13.9 4.5-1.4 5.7.3-1.5 5.5-2.9 3.8z"/><path fill="#39414b" d="m19.6 35 2.4 8 4-1-1.4-8.6"/>' },
  { id: 'wrecking-ball', category: 'special', name: '철거 쇠공', radius: T.wreckingBall.ballRadius * T.wreckingBall.bite, force: T.wreckingBall.force, cooldown: T.wreckingBall.refire,
    color: 0x3d454c, hint: '건물 클릭·터치 · 크레인이 쇠공을 휘둘러요',
    description: '크레인이 쇠공을 당겼다 놓아 벽을 비스듬히 쓸고 들어가요. 같은 건물은 바로 다시 휘둘러요.',
    icon: '<path d="M24 1v9" stroke="#39414b" stroke-width="2"/><rect fill="#ffd950" x="18.5" y="8.5" width="11" height="7.5" rx="1.6"/><path fill="#39414b" d="M18.5 13.5h11V16h-11z"/><path d="M24 16v5.5" stroke="#9aa5ab" stroke-width="2.6"/><circle cx="24" cy="33" r="12.5" fill="#3d454c"/><path d="M15.8 29.5a9 9 0 0 1 5.2-5.6" stroke="#aeb7bd" stroke-width="2.4"/><circle cx="24" cy="21.3" r="1.9" fill="#3d454c" stroke="#9aa5ab" stroke-width="1.4"/><path stroke="#f49a32" d="m41 27 5-2m-4.5 8h5.5m-6.5 6 4 3"/>' },
  { id: 'mini-bomb', category: 'explosive', name: '미니 폭탄', radius: 9.2, force: 28, cooldown: .4,
    color: 0xf6ae54, hint: '터치해 붙이기 · 1.5초 뒤 폭발 · 최대 3개',
    description: '짧게 던져 붙이면 도화선이 타요. 1.5초 뒤 주변 외벽을 뜯어내요.' },
  { id: 'nuke', category: 'explosive', name: '핵폭탄', radius: 20, force: 30, cooldown: 8,
    color: 0xf0c74a, hint: '지점을 터치하면 캠퍼스 전체를 날려요',
    description: '3·2·1 카운트다운 뒤 투하해요. 건물과 조경을 모두 날리는 마지막 한 방.' },

].map(tool => Object.freeze(tool)));
// Campus variants retain their existing copy. Bowling is now shared, with one slot after blast on every campus.
// Bowling-ball bomb (SKKU, user decisions 2026-10-18): src/bowling-ball.js, numbers in src/weapon-tuning.js `bowling`.
export const CAMPUS_TOOLS = Object.freeze([
  { id: 'bowling', category: 'special', name: '볼링공', radius: T.bowling.blastRadius, force: T.bowling.blastForce, cooldown: T.bowling.cooldown,
    color: 0x1d2026, hint: '누른 곳으로 언덕 위에서 굴러 내려와요 · 멈추면 펑',
    description: '언덕 위에서 놓은 볼링공이 건물을 줄줄이 뚫고 내려가요. 멈추면 심지가 타들어 가 펑.',
    icon: '<circle cx="23" cy="26" r="17" fill="#1d2026"/><path d="M10.5 22a13.5 13.5 0 0 1 8-9" stroke="#8a939f" stroke-width="2.6"/><circle cx="18.5" cy="21" r="3.1" fill="#050608" stroke="#c7ccd2" stroke-width="1.2"/><circle cx="27" cy="20" r="3.1" fill="#050608" stroke="#c7ccd2" stroke-width="1.2"/><circle cx="23.5" cy="29.5" r="3.6" fill="#050608" stroke="#c7ccd2" stroke-width="1.2"/><path d="m36 14 3-6 5-1" stroke="#d8bd83" stroke-width="2.6"/><path d="m44 2 .5 3.5m3 0-3 2.5" stroke="#f49a32"/>' },
].map(tool => Object.freeze(tool)));
// Former ad-reward tools (user decision 2026-10-23): always in the bag, free while AD_WEAPONS_ENABLED is false.
// Keep the original order and reward metadata so one flag in src/ad-rewards.js can restore locks later.
// Blast demolition: src/blast-demolition.js, numbers in weapon-tuning.js `blast`, bag icon A1 (bundle of charges).
// Bulldozer: src/bulldozer.js, numbers in weapon-tuning.js `bulldozer`, bag icon B1 (side view), description bDesc[0].
export const BULLDOZER_ENABLED = false; // User hold, 2026-10-22. Keeps source; disables bag, shortcuts and runtime.
export const AD_TOOLS = Object.freeze([
  { id: 'blast', category: 'explosive', name: '발파 해체', ad: AD_WEAPONS_ENABLED, radius: T.blast.halfWidth, force: T.blast.force, cooldown: .12,
    color: 0xd2392c, hint: '건물을 눌러 폭약 설치 · 발파',
    description: '누른 곳에 폭약을 붙이고 발파하면 순서대로 터져요. 1층을 많이 끊으면 건물이 통째로 주저앉아요.',
    icon: '<rect fill="#d2392c" x="9" y="17" width="8.5" height="26" rx="1.5"/><rect fill="#d2392c" x="17.5" y="17" width="8.5" height="26" rx="1.5"/><rect fill="#d2392c" x="26" y="17" width="8.5" height="26" rx="1.5"/><path fill="#39414b" d="M8 26h28v8H8z"/><rect fill="#ffd950" x="15" y="27.5" width="14" height="5" rx=".5"/><path stroke-width="1.2" d="M18 30h2m2 0h2"/><path d="M21.5 17v-4c0-4 5-6 9-4s8 1 9-3" stroke="#d8bd83" stroke-width="2.4"/><path stroke="#f49a32" d="m40 1.5 1 3m3.5-1.5-2.5 2m3 3-3-.5"/>' },
  { id: 'bulldozer', category: 'special', name: '불도저', ad: AD_WEAPONS_ENABLED, radius: T.bulldozer.blade / 2, force: T.bulldozer.force, cooldown: .12,
    color: 0xf2c230, hint: '누른 쪽으로 밀기',
    description: '누른 쪽으로 밀고 나가며 1층을 긁어내요. 받친 데가 빠지면 위층이 내려앉아요.',
    icon: '<path fill="#d9a800" d="M3 21c3 5 3 15 0 21h5V21z"/><path d="M8 35l5-3"/><rect fill="#39414b" x="9" y="33" width="29" height="10" rx="5"/><circle cx="14" cy="38" r="2.2" fill="#9aa5ab"/><circle cx="23.5" cy="38" r="2" fill="#9aa5ab"/><circle cx="33" cy="38" r="2.2" fill="#9aa5ab"/><path fill="#ffd950" d="M11 33v-9h14V12h11l1 12v9z"/><path fill="#5f7c8f" d="M28 15h6v7h-6z"/><path d="M17 24v-7" stroke-width="2.4"/><path d="M37 36l5 1v5"/>' },
].filter(tool => BULLDOZER_ENABLED || tool.id !== 'bulldozer').map(tool => Object.freeze(tool)));
// SKKU keeps its hill copy; other campuses describe rolling across the ground. Never add the old exclusive slot twice.
export const AD_BOWLING = Object.freeze({ ...CAMPUS_TOOLS.find(tool => tool.id === 'bowling'), ad: AD_WEAPONS_ENABLED });
export const AD_BOWLING_ROLL = Object.freeze({ ...AD_BOWLING, hint: '누른 곳으로 굴러가요 · 멈추면 펑',
  description: '굴러온 볼링공이 건물을 줄줄이 뚫고 지나가요. 멈추면 심지가 타들어 가 펑.' });
export const BLACKHOLE_TOOL = Object.freeze({
  id: 'blackhole', category: 'special', name: '블랙홀', radius: T.blackhole.radius, force: 1, cooldown: T.blackhole.cooldown,
  color: 0xf1b65c, hint: '하늘에 거대한 블랙홀 · 사라지면 바로 다시',
  description: '가까운 벽과 지붕부터 뜯어 소용돌이로 삼켜요. 남은 몸체는 무너져요.\n동시에 하나 · 쉬는 시간 없이 다시 설치해요.',
  icon: '<ellipse cx="24" cy="24" rx="22" ry="9" transform="rotate(-22 24 24)" fill="#d87934" stroke="#f49a32" stroke-width="1.8"/><ellipse cx="24" cy="24" rx="17" ry="5.5" transform="rotate(-22 24 24)" fill="#fff0bd" stroke="#ffd950" stroke-width="1.7"/><circle cx="24" cy="24" r="10.5" fill="#080a10" stroke="#ffd950" stroke-width="1.5"/><path d="M4.1 31.6c4.2 3.8 18.6 1.6 29.8-3.1 6.2-2.6 10-5.2 10.3-7.8" fill="none" stroke="#fff0bd" stroke-width="2.4"/><path d="m8 9 2 3m27 25 2 3m5-29-3 1" stroke="#f49a32" stroke-width="1.5"/>'
});
// Ruyi staff 여의봉 (free, user request 2026-10-26 "위에서 아래로 내려찍고 막 길어지게"): src/ruyi-staff.js, numbers in
// weapon-tuning.js `ruyi`. Last in the bag (after the black hole); the number keys stay on the first ten, Y equips it.
export const RUYI_TOOL = Object.freeze({
  id: 'ruyi', category: 'special', name: '여의봉', radius: T.ruyi.radius * T.ruyi.bite, force: T.ruyi.force, cooldown: T.ruyi.cooldown,
  color: 0xe8b13a, hint: '누른 곳을 하늘에서 내려찍어요',
  description: '하늘에서 쭉 늘어나 내려찍어요.',
  icon: '<path stroke="#f49a32" d="M12 9v9m24-13v9M9 24v5m30-8v6"/><rect fill="#f2b632" x="20.5" y="9" width="7" height="22"/><path stroke="#fff0b0" stroke-width="1.6" d="M22.6 11v18"/><rect fill="#c8322a" x="19.5" y="1.5" width="9" height="8" rx="1"/><rect fill="#ffd950" x="18.5" y="8" width="11" height="2.6" rx="1"/><rect fill="#c8322a" x="19.5" y="30.5" width="9" height="8" rx="1"/><rect fill="#ffd950" x="18.5" y="29.5" width="11" height="2.6" rx="1"/><path stroke-width="2.4" d="M4 43.5h40"/><path stroke="#f49a32" d="m17 39-6-3m20 3 6-3m-24 7-6 1m26-1 6 1"/>'
});
// Robot vacuum 로봇청소기 (15th weapon, user decisions 2026-10-26): src/robot-vacuum.js, numbers in weapon-tuning.js `robovac`.
// Last in the bag (after the ruyi staff); V equips it. Icon: look A of 시안/로봇청소기_시안.html (white shell, black bumper,
// LiDAR dome with the red dot, blue light ring, side brush).
export const ROBOVAC_TOOL = Object.freeze({
  id: 'robovac', category: 'special', name: '로봇청소기', radius: T.robovac.diameter / 2, force: T.robovac.chewForce, cooldown: T.robovac.cooldown,
  color: 0xf3f4f1, hint: '누른 곳에 내려놓아요',
  description: '돌아다니며 잔해를 빨아들이고, 부딪힌 건물 1층을 갉아요.',
  icon: '<path fill="#1b1d20" d="M4 26v5c0 6.1 9 11 20 11s20-4.9 20-11v-5z"/><ellipse cx="24" cy="26" rx="20" ry="11" fill="#f3f4f1"/><rect x="15.5" y="24.5" width="17" height="8" rx="3" stroke="#b3b8b8" stroke-width="1.2"/><path fill="#1b1d20" d="M19 17.5h10v5a5 2 0 0 1-10 0z"/><ellipse cx="24" cy="17.5" rx="5" ry="2" fill="#39414b"/><circle cx="26.8" cy="21.4" r="1.2" fill="#ff3b2f" stroke="none"/><ellipse cx="35" cy="28" rx="2.2" ry="1.2" stroke="#5cc8ff" stroke-width="1.4"/><path stroke="#39414b" stroke-width="1.5" d="m10.5 36.5-6.5.5m6.5-.5-2.5 5m2.5-5 5.5 2.5"/><path fill="#a59d8e" stroke-width="1.2" d="m39.5 40.5 3.5-1.2 1.2 3.4-3.5 1.2z"/><path stroke="#f49a32" d="m41 9 2.5-3m2 7.5h-3.5M8 8l2 3"/>'
});
// Robot vacuum (user 2026-10-26 "재미있고 좋은 것 같아, 배포 진행"): last in the bag after the ruyi staff, V equips it.
export function campusTools(pkg) {
  const own = pkg?.exclusiveTools ?? [];
  const extra = CAMPUS_TOOLS.filter(tool => own.includes(tool.id) && tool.id !== 'bowling');
  let tools = DEMO_TOOLS;
  if (extra.length) {
    const at = DEMO_TOOLS.findIndex(tool => tool.id === 'nuke');
    tools = Object.freeze([...DEMO_TOOLS.slice(0, at), ...extra, ...DEMO_TOOLS.slice(at)]);
  }
  const ad = [...AD_TOOLS], at = ad.findIndex(tool => tool.id === 'blast') + 1;
  ad.splice(at, 0, own.includes('bowling') ? AD_BOWLING : AD_BOWLING_ROLL);
  return Object.freeze([...tools, ...ad, BLACKHOLE_TOOL, RUYI_TOOL, ROBOVAC_TOOL]);
}
