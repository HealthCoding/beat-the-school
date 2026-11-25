// Shared B layout: category tabs, three-column tiles and one selected-tool description.
// Optional reward locks stay supported when the reward feature is enabled again.
const LOCK = '<svg class="demo-weapon-lock" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 7.5V5.2a3 3 0 0 1 6 0v2.3" fill="none" stroke="#1c1c1c" stroke-width="2"/><rect x="2.5" y="7" width="11" height="8" fill="#ffcf33" stroke="#1c1c1c" stroke-width="1.6"/><path d="M8 10v2" stroke="#1c1c1c" stroke-width="1.6"/></svg>';
const CATEGORIES = [['all', '전체'], ['melee', '근접'], ['gun', '총'], ['explosive', '폭발'], ['special', '특수']];
export function createDemoWeaponBag({ document, tools, getSelected, onEquip, isLocked = () => false, onLocked = () => {} }) {
  const $ = id => document.getElementById(id), dialog = $('shop-dialog'), items = $('shop-items'), cards = new Map(), tabs = new Map();
  let category = 'all', described;
  // Every school keeps its existing header and dialog. Generate the shared contents here.
  const nav = document.createElement('div'); nav.id = 'weapon-bag-tabs'; nav.className = 'weapon-bag-tabs';
  nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-label', '무기 종류');
  dialog.insertBefore(nav, items);
  items.setAttribute('role', 'tabpanel');
  const info = document.createElement('div'); info.className = 'weapon-bag-info'; info.setAttribute('aria-live', 'polite'); info.setAttribute('aria-atomic', 'true');
  const selectedName = document.createElement('strong'); selectedName.id = 'weapon-bag-selected';
  const description = document.createElement('span'); description.id = 'weapon-bag-description'; description.tabIndex = 0;
  description.setAttribute('aria-label', '장착 무기 설명');
  info.append(selectedName, description); dialog.append(info);
  function close() { dialog.close(); $('shop-open').setAttribute('aria-expanded', 'false'); }
  function render() {
    for (const [id, card] of cards) {
      const locked = Boolean(isLocked(id)), selected = !locked && id === getSelected();
      card.button.hidden = category !== 'all' && card.tool.category !== category;
      card.button.setAttribute('aria-pressed', String(selected));
      card.button.setAttribute('aria-label', `${card.tool.name} ${locked ? '잠금 해제' : '장착'}`);
      card.button.dataset.selected = String(selected);
      if (card.ad) { card.button.dataset.locked = String(locked); card.button.classList.toggle('locked', locked); }
      card.state.textContent = locked ? '잠김' : selected ? '✓' : '';
    }
    for (const [id, tab] of tabs) {
      tab.setAttribute('aria-selected', String(id === category)); tab.tabIndex = id === category ? 0 : -1;
    }
    items.setAttribute('aria-labelledby', `weapon-bag-tab-${category}`);
    const selected = tools.find(tool => tool.id === getSelected());
    if (selected && described !== selected.id) {
      selectedName.textContent = `장착 · ${selected.name}`;
      description.textContent = selected.description.replace(/\s*\n\s*/g, ' ');
      description.title = description.textContent; description.scrollLeft = 0; described = selected.id;
    }
  }
  function selectCategory(id) { category = id; items.scrollTop = 0; render(); }
  for (const [id, name] of CATEGORIES) {
    const tab = document.createElement('button'); tab.type = 'button'; tab.id = `weapon-bag-tab-${id}`; tab.textContent = name;
    tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', 'shop-items');
    tab.addEventListener('click', () => selectCategory(id));
    tab.addEventListener('keydown', event => {
      const at = CATEGORIES.findIndex(([key]) => key === id);
      const next = event.key === 'ArrowRight' ? (at + 1) % CATEGORIES.length : event.key === 'ArrowLeft' ? (at + CATEGORIES.length - 1) % CATEGORIES.length : event.key === 'Home' ? 0 : event.key === 'End' ? CATEGORIES.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault(); const key = CATEGORIES[next][0]; selectCategory(key); tabs.get(key).focus();
    });
    nav.append(tab); tabs.set(id, tab);
  }
  function open() {
    render(); if (!dialog.open) dialog.showModal(); $('shop-open').setAttribute('aria-expanded', 'true');
    $('shop-close').focus();
  }
  // New tool symbols join the page sprite once; school HTML stays unchanged.
  const defs = document.querySelector?.('.svg-defs defs');
  for (const tool of tools) if (tool.icon && defs && !document.querySelector(`#icon-${tool.id}`))
    defs.insertAdjacentHTML('beforeend', `<symbol id="icon-${tool.id}" viewBox="0 0 48 48">${tool.icon}</symbol>`);
  for (const tool of tools) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'demo-weapon'; button.dataset.weapon = tool.id;
    const icon = document.createElement('span'); icon.className = 'demo-weapon-icon'; icon.innerHTML = `<svg aria-hidden="true"><use href="#icon-${tool.id}"/></svg>${tool.ad ? LOCK : ''}`;
    const name = document.createElement('strong'); name.textContent = tool.name;
    const state = document.createElement('span'); state.className = 'demo-weapon-state'; state.setAttribute('aria-hidden', 'true');
    button.append(icon, name, state);
    button.addEventListener('click', () => {
      if (isLocked(tool.id)) { onLocked(tool.id); return; }
      // User 10-24: picking a weapon closes the bag at once (no extra tap on ×).
      if (onEquip(tool.id) !== false) { render(); close(); }
    });
    items.append(button); cards.set(tool.id, { button, state, tool, ad: Boolean(tool.ad) });
  }
  // Arrow navigation follows the visible three-column grid; Tab remains native to the modal.
  items.addEventListener('keydown', event => {
    const visible = [...cards.values()].filter(card => !card.button.hidden).map(card => card.button), at = visible.indexOf(event.target);
    if (at < 0) return;
    const next = event.key === 'ArrowRight' ? at + 1 : event.key === 'ArrowLeft' ? at - 1 : event.key === 'ArrowDown' ? at + 3 : event.key === 'ArrowUp' ? at - 3 : event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : -1;
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); visible[Math.max(0, Math.min(visible.length - 1, next))]?.focus();
  });
  // Keep Tab at the modal boundaries, including browsers that otherwise focus browser chrome.
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    if (event.shiftKey && document.activeElement === $('shop-close')) { event.preventDefault(); description.focus(); }
    else if (!event.shiftKey && document.activeElement === description) { event.preventDefault(); $('shop-close').focus(); }
  });
  $('shop-close').addEventListener('click', close);
  dialog.addEventListener('close', () => { $('shop-open').setAttribute('aria-expanded', 'false'); $('shop-open').focus(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
  });
  render(); return { open, close, render };
}
