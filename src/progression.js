export const TOOLS = Object.freeze([
  { id: 'fist', name: '분노의 주먹', category: 'basic', price: 0, radius: 1.65, force: 6, cooldown: .17, label: 'POW!', color: 0xd5ef62, description: '잔액은 0, 분노는 만땅. 맨손으로 코인을 벌어요.' },
  { id: 'hammer', name: '출석 뿅망치', category: 'basic', price: 60, radius: 2.8, force: 10, cooldown: .27, label: 'BONK!', color: 0xd5ef62, description: '출석 체크 대신 벽을 체크! 뿅 소리 나게 때려요.' },
  { id: 'bat', name: '종강 홈런 방망이', category: 'basic', price: 120, radius: 3.5, force: 12, cooldown: .25, label: 'HOME RUN!', color: 0xf7b661, description: '강의실 담장 너머로 홈런! 과제도 같이 날려요.' },
  { id: 'wave', name: '과제 삭제빔', category: 'chaos', price: 220, radius: 5, force: 15, cooldown: .65, label: 'BOOM!', color: 0x80c4ba, description: '과제와 함께 벽도 날아갔어요. 주변까지 싹 정리해요.' },
  { id: 'drill', name: '벼락치기 드릴', category: 'chaos', price: 360, radius: 2.1, force: 8, cooldown: .09, label: 'DRRR!', color: 0x76caed, description: '좁고 빠르게 드르르륵! 시험 범위 대신 벽을 뚫어요.' },
  { id: 'ball', name: '왕만두', category: 'chaos', price: 550, radius: 7.2, force: 21, cooldown: .9, label: 'CRASH!', color: 0xf4a177, description: '속이 꽉 찬 캠퍼스 철거용 만두. 한 입에 건물 한쪽!' },
  { id: 'bomb', name: '과제 마감 폭탄', category: 'chaos', price: 650, radius: 8.5, force: 24, cooldown: 1.1, label: 'BANG!', color: 0xeb799a, description: '마감 1초 전, 펑! 제출 버튼보다 폭발이 빨라요.' },
  { id: 'excavator', name: '학점 퍼먹는 포크레인', category: 'chaos', price: 850, radius: 8, force: 22, cooldown: .85, label: 'SCOOP!', color: 0xf2cf58, description: '크게 한 삽! 학점은 못 퍼도 건물은 잘 퍼요.' },
  { id: 'meteor', name: 'F학점 운석', category: 'cosmic', price: 1200, radius: 11, force: 26, cooldown: 1.3, label: 'KABOOM!', color: 0xeeb871, description: '하늘에서 떨어지는 성적표. 묵직한 광역 충격으로 벽을 날려요.' },
  { id: 'nuke', name: '휴강 만화 핵폭탄', category: 'cosmic', price: 2400, radius: 20, force: 30, cooldown: 2, label: 'TOON BOOM!', color: 0xc7a4f5, description: '황당함 최종 단계! 만화 속 버섯구름으로 휴강을 외쳐요.' },
  { id: 'bomber', name: '종강 폭격 편대', category: 'cosmic', price: 3200, radius: 6, force: 22, cooldown: 3, label: 'AIR RAID!', color: 0x8195b6, description: '폭격기 3대가 날아와 차례로 투하! 종강까지 세 번의 쿵!' },
].map(tool => Object.freeze(tool)));

const KEY = 'beat-school-progression-v2';
const LIMIT = 1_000_000_000;
const byId = new Map(TOOLS.map(tool => [tool.id, tool]));
const integer = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
  ? Math.min(LIMIT, Math.floor(value)) : 0;

function sanitize(value) {
  const data = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const unlocked = new Set(['fist']);
  if (Array.isArray(data.unlocked)) for (const id of data.unlocked) {
    if (typeof id === 'string' && byId.has(id)) unlocked.add(id);
  }
  const coins = integer(data.coins);
  return {
    coins, unlocked: TOOLS.filter(tool => unlocked.has(tool.id)).map(tool => tool.id),
    selected: typeof data.selected === 'string' && unlocked.has(data.selected) ? data.selected : 'fist',
    lifetimeCoins: Math.max(coins, integer(data.lifetimeCoins)), totalHits: integer(data.totalHits),
  };
}

// Refresh must not replace a live wallet with a deleted, truncated or malformed save.
function isValidSnapshot(data) {
  return data !== null && typeof data === 'object' && !Array.isArray(data)
    && ['coins', 'lifetimeCoins', 'totalHits'].every(key =>
      typeof data[key] === 'number' && Number.isFinite(data[key]) && data[key] >= 0)
    && Array.isArray(data.unlocked) && data.unlocked.includes('fist')
    && data.unlocked.every(id => typeof id === 'string' && byId.has(id))
    && typeof data.selected === 'string' && data.unlocked.includes(data.selected);
}

export function createProgression(storage, { testMode = false } = {}) {
  let available = false, current = sanitize(null);
  let inTestMode = Boolean(testMode), testSelected = null;
  // Access to localStorage itself can throw when browser persistence is blocked.
  try {
    storage ??= globalThis.localStorage;
    available = typeof storage?.getItem === 'function' && typeof storage?.setItem === 'function';
    if (available) {
      const raw = storage.getItem(KEY);
      if (raw !== null && raw !== undefined) {
        try { current = sanitize(JSON.parse(raw)); } catch { current = sanitize(null); }
      }
    }
  } catch { available = false; }
  if (inTestMode) testSelected = current.selected;
  function save() {
    if (!available) return;
    try { storage.setItem(KEY, JSON.stringify(current)); } catch { available = false; }
  }
  function refresh() {
    if (!available) return false;
    try {
      const raw = storage.getItem(KEY);
      if (raw === null || raw === undefined) return false;
      let data;
      try { data = JSON.parse(raw); } catch { return false; }
      if (!isValidSnapshot(data)) return false;
      const next = sanitize(data);
      if (JSON.stringify(next) === JSON.stringify(current)) return false;
      current = next;
      return true;
    } catch { available = false; return false; }
  }
  // Replace malformed saves with a canonical snapshot, and discover write denial.
  save();
  return {
    // The earned save always keeps its normal owned selection. Test equipment
    // is a temporary overlay, so trying an expensive weapon never unlocks it.
    get state() { return { ...current, selected: inTestMode ? testSelected : current.selected, unlocked: [...current.unlocked] }; },
    get testMode() { return inTestMode; },
    setTestMode(value) {
      refresh();
      const next = Boolean(value);
      if (next !== inTestMode) { inTestMode = next; testSelected = next ? current.selected : null; }
      return inTestMode;
    },
    isAvailable(id) { return byId.has(id) && (inTestMode || current.unlocked.includes(id)); },
    get storageAvailable() { return available; },
    refresh,
    awardHit({ weight, count, clearedCount = 0 } = {}) {
      if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0
        || !Number.isInteger(count) || count <= 0) return 0;
      refresh();
      const clears = Number.isInteger(clearedCount) && clearedCount > 0 ? Math.min(29, clearedCount) : 0;
      const reward = Math.min(25, 3 + Math.floor(weight / 65)) + clears * 35;
      const earned = Math.min(reward, LIMIT - current.coins);
      current.coins += earned;
      current.lifetimeCoins = Math.min(LIMIT, current.lifetimeCoins + earned);
      current.totalHits = Math.min(LIMIT, current.totalHits + 1);
      save();
      return earned;
    },
    unlock(id) {
      const tool = byId.get(id);
      if (!tool) return { ok: false, reason: 'unknown', price: 0 };
      // Read the latest wallet immediately before checking funds. localStorage
      // has no transactional lock, so simultaneous cross-tab writes can still race.
      refresh();
      if (inTestMode) { testSelected = id; return { ok: true, reason: 'test', price: 0 }; }
      if (current.unlocked.includes(id)) return { ok: true, reason: 'owned', price: tool.price };
      if (current.coins < tool.price) return { ok: false, reason: 'funds', price: tool.price };
      current.coins -= tool.price;
      current.unlocked.push(id);
      current.unlocked = TOOLS.filter(item => current.unlocked.includes(item.id)).map(item => item.id);
      current.selected = id;
      save();
      return { ok: true, reason: 'purchased', price: tool.price };
    },
    select(id) {
      refresh();
      if (!byId.has(id)) return false;
      if (inTestMode) { testSelected = id; return true; }
      if (!current.unlocked.includes(id)) return false;
      current.selected = id;
      save();
      return true;
    },
    nextUnlock() { return TOOLS.find(tool => !current.unlocked.includes(tool.id)) ?? null; },
  };
}
