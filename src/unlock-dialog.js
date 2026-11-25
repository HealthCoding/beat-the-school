// Unlock dialog for an ad-reward weapon (시안/광고무기_발파·불도저_시안.html "해금 창", user decisions 2026-10-22).
// States: offer (watch / later / one-line note) -> wait (ad running) -> done (unlocked / use now) or noad (no ad / close).
// Copy is the mock's, nothing added. The ad request and the saved unlock live in src/ad-rewards.js.
import { AD_WEAPONS_ENABLED, requestRewardedAd, saveUnlock } from './ad-rewards.js';

const LOCK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 7.5V5.2a3 3 0 0 1 6 0v2.3" fill="none" stroke="#1c1c1c" stroke-width="2"/><rect x="2.5" y="7" width="11" height="8" fill="#ffcf33" stroke="#1c1c1c" stroke-width="1.6"/><path d="M8 10v2" stroke="#1c1c1c" stroke-width="1.6"/></svg>';
const PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="#1c1c1c"/></svg>';

export function createUnlockDialog({ document, track = () => {}, request = requestRewardedAd, onUnlocked = () => {}, onUse = () => {} }) {
  const make = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text) el.textContent = text; return el; };
  const dialog = make('dialog', 'game-dialog unlock-dialog');
  dialog.setAttribute('aria-labelledby', 'unlock-title'); dialog.dataset.state = 'offer';
  const title = make('h2'); title.id = 'unlock-title';
  const lock = make('span', 'unlock-lock'); lock.innerHTML = LOCK;
  const name = make('span', 'unlock-name'); title.append(lock, name);
  const body = make('div', 'unlock-body');
  const who = make('div', 'unlock-who'), icon = make('span', 'unlock-icon'), desc = make('p', 'unlock-desc'); who.append(icon, desc);
  const watch = make('button', 'unlock-button unlock-watch'); watch.type = 'button'; watch.innerHTML = `${PLAY}<span>광고 보고 해금</span>`; watch.dataset.show = 'offer wait';
  const noad = make('p', 'unlock-msg', '지금은 볼 수 있는 광고가 없어요. 잠시 뒤 다시 눌러 주세요.'); noad.dataset.show = 'noad';
  const done = make('p', 'unlock-msg', '해금됐어요'); done.dataset.show = 'done';
  const use = make('button', 'unlock-button unlock-use', '바로 쓰기'); use.type = 'button'; use.dataset.show = 'done';
  const later = make('button', 'secondary-button unlock-later', '다음에'); later.type = 'button'; later.dataset.show = 'offer wait';
  const close = make('button', 'secondary-button unlock-close', '닫기'); close.type = 'button'; close.dataset.show = 'noad';
  const note = make('p', 'unlock-note', '이 기기에 저장돼요. 브라우저 기록을 지우면 다시 잠겨요.'); note.dataset.show = 'offer wait';
  body.append(who, watch, noad, done, use, later, close, note); dialog.append(title, body);
  document.body?.append(dialog);
  let tool = null, serial = 0;
  function setState(state) { dialog.dataset.state = state; watch.disabled = state === 'wait'; }
  function open(next) {
    if (!AD_WEAPONS_ENABLED || !next) return;
    tool = next; serial++; name.textContent = next.name; desc.textContent = next.description;
    icon.innerHTML = `<svg aria-hidden="true"><use href="#icon-${next.id}"/></svg>`;
    setState('offer'); if (!dialog.open) dialog.showModal(); watch.focus?.({ preventScroll: true });
    track('unlock_open', { weapon: next.id });
  }
  function shut() { serial++; if (dialog.open) dialog.close(); }
  watch.addEventListener('click', async () => {
    if (!tool || dialog.dataset.state === 'wait') return;
    const id = tool.id, ticket = ++serial; setState('wait');
    let answer;
    try { answer = await request(id); } catch { answer = { ok: false, reason: 'error' }; }
    // A watched ad always unlocks, even when the dialog was closed meanwhile.
    if (answer?.ok) { saveUnlock(id); track('unlock_done', { weapon: id }); onUnlocked(id); }
    if (ticket !== serial || !dialog.open) return;
    setState(answer?.ok ? 'done' : 'noad');
    (answer?.ok ? use : close).focus?.({ preventScroll: true });
  });
  later.addEventListener('click', shut); close.addEventListener('click', shut);
  use.addEventListener('click', () => { const id = tool?.id; shut(); if (id) onUse(id); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog || dialog.dataset.state === 'wait') return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) shut();
  });
  dialog.addEventListener('cancel', event => { if (dialog.dataset.state === 'wait') event.preventDefault?.(); });
  return { open, close: shut, dialog, elements: { watch, later, close, use, noad, done, note },
    get state() { return dialog.dataset.state; }, get isOpen() { return Boolean(dialog.open); }, get tool() { return tool?.id ?? null; } };
}
