export const ATTACKS = Object.freeze(Object.fromEntries([
  ['fist', .07, '펀치', '주먹이 닿으면 툭!'],
  ['hammer', .16, '스윙', '망치를 내려치며 뿅!'],
  ['bat', .18, '스윙', '방망이 스윙 끝에 홈런!'],
  ['wave', .2, '빔', '삭제빔이 닿으면 와르르!'],
  ['drill', .025, '지속', '누르고 있으면 드르르륵!'],
  ['ball', .4, '투척', '왕만두가 날아와 쿵!'],
  ['excavator', .45, '굴착', '버킷으로 크게 한 삽!'],
  ['meteor', .65, '낙하', '운석이 떨어질 때 충돌!'],
  ['bomb', 2, '설치', '폭탄 설치! 2초 뒤 펑!'],
  ['mini-bomb', 1.8, '투척·설치', '짧게 던져 붙이고 · 1.5초 뒤 펑!'],
  ['nuke', 3, '낙하', '하늘에서 낙하 · 착탄하면 대폭발'],
  ['bomber', 1.4, '폭격', '3대 편대 · 순차 폭격'],
].map(([id, delay, kind, hint]) => [id, Object.freeze({ delay, kind, hint })])));

export const BOMBER_IMPACTS = Object.freeze([
  { at: 1.4, offset: [-8, 0, -4] },
  { at: 1.75, offset: [0, 0, 0] },
  { at: 2.1, offset: [8, 0, 4] },
].map(impact => Object.freeze({ at: impact.at, offset: Object.freeze(impact.offset) })));

// Damage is scheduled independently of visual prop eviction. Hosts apply damage
// only in onImpact, and clear this queue when rebuilding the game world.
export function createWeaponActions({ onStart = () => {}, onLand = () => {}, onImpact = () => {} } = {}) {
  const pending = [];
  const records = new WeakMap();
  let nextId = 1, time = 0;
  return {
    start({ point, tool, normal } = {}) {
      const attack = tool && Object.hasOwn(ATTACKS, tool.id) ? ATTACKS[tool.id] : null;
      if (pending.length >= 12 || !attack || !point || typeof point.clone !== 'function'
        || ![point.x, point.y, point.z].every(Number.isFinite)) return null;
      if (tool.id === 'mini-bomb' && pending.filter(action => action.tool.id === 'mini-bomb').length >= 3) return null;
      const action = { id: `${tool.id}-${nextId++}`, point: point.clone(), tool: Object.freeze({ ...tool }),
        delay: attack.delay, age: 0 };
      if (normal?.clone && [normal.x, normal.y, normal.z].every(Number.isFinite)) action.normal = normal.clone();
      const plan = tool.id === 'bomber' ? BOMBER_IMPACTS : [{ at: attack.delay, offset: [0, 0, 0] }];
      action.impacts = Object.freeze(plan.map(impact => Object.freeze({ at: impact.at, offset: Object.freeze([...impact.offset]) })));
      records.set(action, { next: 0, started: time, origin: action.point.clone(), landed: false });
      pending.push(action);
      if (onStart(action) === false) {
        const index = pending.indexOf(action);
        if (index >= 0) pending.splice(index, 1);
        return null;
      }
      return action;
    },
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      time += dt;
      const ready = [];
      for (const action of [...pending]) {
        const record = records.get(action); action.age = time - record.started;
        if (action.tool.id === 'mini-bomb' && !record.landed && action.age + 1e-10 >= .3)
          ready.push({ action, index: -1, at: record.started + .3 });
        for (let index = record.next; index < action.impacts.length; index++) {
          const impact = action.impacts[index];
          if (action.age + 1e-10 < impact.at) break;
          ready.push({ action, index, at: record.started + impact.at });
        }
      }
      // A long frame still delivers impacts in their chronological world order.
      ready.sort((a, b) => a.at - b.at);
      for (const { action, index } of ready) {
        const record = records.get(action);
        if (!pending.includes(action)) continue;
        if (index === -1) {
          if (!record.landed) { record.landed = true; onLand(action); }
          continue;
        }
        if (!pending.includes(action) || record.next !== index) continue;
        const finalImpact = index === action.impacts.length - 1;
        // Advance before invoking the host so re-entrant callbacks cannot hit twice.
        record.next++;
        if (finalImpact) pending.splice(pending.indexOf(action), 1);
        const metadata = { impactIndex: index, impactCount: action.impacts.length, finalImpact };
        const offset = action.impacts[index].offset;
        const point = record.origin.clone(); point.x += offset[0]; point.y += offset[1]; point.z += offset[2];
        const event = action.impacts.length === 1 ? Object.assign(action, metadata) : { ...action, ...metadata, point };
        onImpact(event);
      }
    },
    clear() { pending.length = 0; },
    countFor(toolId) { return pending.filter(action => action.tool.id === toolId).length; },
    get count() { return pending.length; },
  };
}
