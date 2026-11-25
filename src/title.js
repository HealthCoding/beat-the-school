// URL font preview, shared preference across title and school pages; blocked storage is harmless.
(()=>{const root=document.documentElement;if(!root)return;const key='beat-school-font',valid=v=>['c','a','b','b2'].includes(v);let font=new URLSearchParams(window.location.search).get('font');if(valid(font)){try{localStorage.setItem(key,font);}catch{}}else{try{font=localStorage.getItem(key);}catch{}}root.classList.remove('font-c','font-a','font-b','font-b2');root.classList.add('font-'+(valid(font)?font:'c'));})();
// Title screen: campus select (stencils on the construction hoarding) from the shared registry, resume-last-campus, and a quality setting
// that the game reads on start. No 3D here; the game page loads only after a campus is chosen.
import { CAMPUSES, LAST_CAMPUS_KEY } from './campuses/registry.js?v=sg01';
import { playTick, tickOnPress, soundPreference, saveSoundPreference } from './ui-sound.js?v=sound34';

import { createBackgroundMusic, musicPreference, saveMusicPreference } from './background-music.js?v=sn119';

const titleMusic = createBackgroundMusic({ scene: 'title', ready: true });
const VERSION = 'v0.33';
const QUALITY_KEY = 'beat-school-render-quality';
const QUALITY = [['auto', '자동'], ['high', '선명하게'], ['smooth', '부드럽게']];
const SPLASH = ['와장창!', '학점은 안 부서져요!', '시험기간 한정 처방!', '100% 가상 파괴!', '원조 Beat the School!', '드릴은 꾹 누르기!', '백양로 조심!'];
const $ = id => document.getElementById(id);
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const campuses = Object.entries(CAMPUSES).map(([id, c]) => ({ id, ...c }));
const pageOf = c => new URL(`../${c.page}`, import.meta.url).href;

$('version').textContent = VERSION;
$('campus-count').textContent = `${campuses.filter(c => c.status === 'ready').length}개 캠퍼스`;

// Splash: a random line, click the title for the next one. Building count comes from the registry.
const lines = [...SPLASH, ...campuses.filter(c => c.status === 'ready' && c.buildings).map(c => `${c.short} ${c.buildings}동!`)];
let splashIndex = Math.floor(Math.random() * lines.length);
// The line is drawn by CSS (::after) so it stays out of the h1 text that search engines show as the page title.
const showSplash = () => { $('splash').dataset.line = lines[splashIndex % lines.length]; };
showSplash();
const nextSplash = () => { splashIndex++; showSplash(); };
document.querySelector('.logo').addEventListener('click', nextSplash);
document.querySelector('.logo').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextSplash(); } });

// Resume: the game stores the last campus it finished loading.
const last = CAMPUSES[store.get(LAST_CAMPUS_KEY)];
if (last?.status === 'ready') {
  const resume = $('resume');
  resume.innerHTML = `<span>이어서 · ${esc(last.short)}</span><small aria-hidden="true">→</small>`;
  resume.href = pageOf(last);
  resume.hidden = false;
}

// Screens
let opener = null;
function openScreen(id, from) { opener = from; $('home').inert = true; $(id).hidden = false; if (id !== 'select') $(id).querySelector('.btn')?.focus(); }
function closeScreens() { for (const id of ['select', 'settings', 'credits']) $(id).hidden = true; $('home').inert = false; opener?.focus(); }
for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', closeScreens);
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || going) return;
  if (!$('select').hidden && document.activeElement === searchInput && searchInput.value) {
    searchInput.value = '';
    searchClear.hidden = true;
    query = '';
    buildRows(selected?.dataset.id);
    return;
  }
  if (!$('select').hidden || !$('settings').hidden || !$('credits').hidden) closeScreens();
});

// Campus select: metal nameplates on the hoarding wall with search (Korean chosung supported) and sort.
// Ready campuses are links with button selection semantics (aria-pressed); 'soon' ones are taped over and not selectable.
const selectScreen = $('select'), list = $('campus-list'), play = $('play');
const searchInput = $('campus-search'), searchClear = $('campus-search-clear'), sortButtons = [...document.querySelectorAll('#campus-sorts .sort-btn')];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let rows = [], selected = null, going = false, query = '', sortMode = 'default', levelMode = 'all';
// School level tabs (시안 B, 10-23; 중학교 user 10-25): registry level 'high' / 'middle' / 'elem' (초등학교 user 10-30), everything else is a university.
// The tab row only shows when a non-university school is registered, and a level's tab only when it has schools;
// counts come from the registry (not the search).
// The chosen tab is not remembered: opening on '전체' every time means no campus ever looks missing.
const LEVELS = ['uni', 'high', 'middle', 'elem'], LEVEL_NAME = { high: '고등학교', middle: '중학교', elem: '초등학교' };
const levelOf = c => LEVELS.includes(c.level) ? c.level : 'uni';
const levelTabs = $('campus-levels'), levelButtons = [...levelTabs.querySelectorAll('.lv-btn')];
const levelCount = { all: campuses.length, ...Object.fromEntries(LEVELS.map(l => [l, campuses.filter(c => levelOf(c) === l).length])) };
levelTabs.hidden = levelCount.uni === campuses.length;
for (const b of levelButtons) if (b.dataset.level !== 'all') b.hidden = !levelCount[b.dataset.level];
for (const el of levelTabs.querySelectorAll('[data-count]')) el.textContent = levelCount[el.dataset.count];
// Campuses without a photo show neutral pixel buildings (no school marks).
const PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'><rect width='16' height='16' fill='#646f7c'/><path d='M1 16V9h4v7zM6 16V5h2V3h1v2h2v11zM12 16v-6h3v6z' fill='#3b4350'/></svg>")}`;
const iconURL = c => c.thumb ? new URL(`../${c.thumb}`, import.meta.url).href : PLACEHOLDER;
function esc(t) { return String(t ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]); }
const nameOf = c => c.short || `${c.school} ${c.campus}`;
const schoolOf = c => c.school ? c.school.replace(/여자대학교$/, '여대').replace(/대학교$/, '대').replace(/고등학교$/, '고').replace(/중학교$/, '중').replace(/초등학교$/, '초') : (c.short || '').split(' ')[0];
const branchOf = c => {
  if (c.branch) return c.branch;
  const cp = c.campus || '';
  if (cp.includes('안암') && cp.includes('인문')) return '안암·인문';
  if (cp.includes('안암') && cp.includes('자연')) return '안암·자연';
  if (cp.includes('국제') && cp.includes('송도')) return '송도·국제';
  const m = /\(([^)]+)\)/.exec(cp);
  if (m) return m[1];
  return cp.replace(/캠퍼스$/, '').trim();
};
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const chosung = s => [...String(s ?? '')].map(ch => {
  const code = ch.charCodeAt(0) - 0xac00;
  return code >= 0 && code < 11172 ? CHO[Math.floor(code / 588)] : ch;
}).join('');
const matchesQuery = (c, tokens) => {
  if (!tokens.length) return true;
  const words = [c.school, schoolOf(c), branchOf(c), c.short, c.campus, c.district, c.id]
    .filter(Boolean).join(' ').toLowerCase().split(/[\s·()]+/).filter(Boolean);
  const choWords = words.map(chosung);
  return tokens.every(t => /^[ㄱ-ㅎ]+$/.test(t)
    ? choWords.some(cw => cw.startsWith(t))
    : words.some(w => w.includes(t)) || choWords.some(cw => cw.includes(t)));
};
const filteredCampuses = () => {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const items = campuses.filter(c => (levelMode === 'all' || levelOf(c) === levelMode) && matchesQuery(c, tokens));
  return items.sort((a, b) => {
    const al = LEVELS.indexOf(levelOf(a)), bl = LEVELS.indexOf(levelOf(b));
    if (al !== bl) return al - bl;
    const ar = a.status === 'ready' ? 0 : 1, br = b.status === 'ready' ? 0 : 1;
    if (ar !== br) return ar - br;
    if (sortMode === 'name') return `${schoolOf(a)} ${branchOf(a)}`.localeCompare(`${schoolOf(b)} ${branchOf(b)}`, 'ko');
    if (sortMode === 'buildings') return (b.buildings || 0) - (a.buildings || 0) || `${schoolOf(a)} ${branchOf(a)}`.localeCompare(`${schoolOf(b)} ${branchOf(b)}`, 'ko');
    return 0;
  });
};
function buildRows(preferId = selected?.dataset.id ?? store.get(LAST_CAMPUS_KEY)) {
  const items = filteredCampuses();
  if (!items.length) {
    list.innerHTML = `<p class="empty-msg">검색 결과가 없어요.</p>`;
    rows = [];
    choose(null);
    return;
  }
  const firsts = levelMode === 'all' && !levelTabs.hidden ? new Set(['high', 'middle'].map(l => items.find(c => levelOf(c) === l)).filter(Boolean)) : new Set();
  list.innerHTML = items.map(c => {
    const school = esc(schoolOf(c)), branch = esc(branchOf(c));
    const info = esc([c.district, c.campus].filter(Boolean).join(' · '));
    const badge = branch ? `<span class="cp-tag">${branch}</span>` : '';
    const inner = right => `<span class="po"><img loading="lazy" src="${esc(iconURL(c))}" alt="" width="56" height="56" decoding="async"></span><span class="tx"><span class="top"><span class="nm">${school}</span>${badge}</span><span class="ds">${info}</span></span>${right}`;
    const head = firsts.has(c) ? `<p class="lv-sec">${LEVEL_NAME[levelOf(c)]}</p>` : '';
    return head + (c.status === 'ready'
      ? `<a class="row" href="./${esc(c.page)}" role="button" id="campus-${c.id}" data-id="${c.id}" aria-pressed="false">${inner(c.buildings ? `<span class="cnt">${c.buildings}동</span>` : '')}</a>`
      : `<div class="row soon" id="campus-${c.id}" data-id="${c.id}" aria-disabled="true">${inner('<b class="tag">공사 중</b>')}<span class="tape" aria-hidden="true"></span></div>`);
  }).join('');
  rows = [...list.querySelectorAll('a.row')];
  for (const row of rows) {
    row.addEventListener('click', e => { e.preventDefault(); if (!going) choose(row); });
    row.addEventListener('dblclick', e => { e.preventDefault(); if (!going) { choose(row); enter(); } });
  }
  choose(rows.find(r => r.dataset.id === preferId) ?? rows[0] ?? null);
}
function choose(row) {
  selected = row ?? null;
  for (const r of rows) r.setAttribute('aria-pressed', String(r === row));
  play.disabled = !selected;
}
searchInput.addEventListener('input', () => {
  query = searchInput.value;
  searchClear.hidden = !query;
  buildRows();
});
searchInput.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' && rows[0]) { e.preventDefault(); rows[0].focus(); choose(rows[0]); }
  else if (e.key === 'Enter' && selected) { e.preventDefault(); enter(); }
});
searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.hidden = true;
  query = '';
  buildRows();
  searchInput.focus();
});
for (const btn of sortButtons) {
  btn.addEventListener('click', () => {
    sortMode = btn.dataset.sort;
    for (const b of sortButtons) b.setAttribute('aria-pressed', String(b === btn));
    buildRows();
  });
}
for (const btn of levelButtons) {
  btn.addEventListener('click', () => {
    levelMode = btn.dataset.level;
    for (const b of levelButtons) b.setAttribute('aria-pressed', String(b === btn));
    buildRows();
    list.parentElement.scrollTop = 0;
  });
}
// Arrow keys follow the wall's layout: left/right step through the order, up/down go to the nearest row above/below.
function neighbour(from, key) {
  const i = rows.indexOf(from);
  if (key === 'Home') return rows[0];
  if (key === 'End') return rows.at(-1);
  if (i < 0) return rows[0];
  if (key === 'ArrowLeft' || key === 'ArrowRight') return rows[Math.max(0, Math.min(rows.length - 1, i + (key === 'ArrowRight' ? 1 : -1)))];
  const a = from.getBoundingClientRect(), ax = a.left + a.width / 2, down = key === 'ArrowDown';
  let best = null, score = Infinity;
  for (const r of rows) {
    const b = r.getBoundingClientRect(), dy = down ? b.top - a.top : a.top - b.top;
    if (dy < a.height / 2) continue;
    const s = dy * 4 + Math.abs(b.left + b.width / 2 - ax);
    if (s < score) { score = s; best = r; }
  }
  return best ?? from;
}
list.addEventListener('keydown', e => {
  const row = e.target.closest?.('a.row');
  if (!row || going) return;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(row); enter(); return; }
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const next = neighbour(row, e.key);
  if (next && next !== row) { next.focus(); choose(next); }
});
// Enter: hand the stencilled name to the loading screen (same wall, same spot), then change page.
function enter() {
  if (!selected || going) return;
  going = true;
  const enterName = nameOf(CAMPUSES[selected.dataset.id]);
  $('enter-name').textContent = enterName;
  // Same rule as the loading page (main.js): long names get the smaller phone size there, so match it here.
  $('enter-name').toggleAttribute('data-long', enterName.length > 7);
  selectScreen.classList.add('going');
  const href = pageOf(CAMPUSES[selected.dataset.id]);
  setTimeout(() => { titleMusic.saveHandoff(); location.href = href; }, reduceMotion.matches ? 380 : 480);
}
play.addEventListener('click', enter);
// Links exist before the user opens the selector; lazy images preserve the initial download budget.
buildRows();
$('open-select').addEventListener('click', e => {
  if (!rows.length && !query) buildRows(store.get(LAST_CAMPUS_KEY));
  openScreen('select', e.currentTarget);
  const row = rows.find(r => r.dataset.id === store.get(LAST_CAMPUS_KEY)) ?? rows[0];
  choose(row);
  (row ?? searchInput).focus({ preventScroll: true });
  row?.scrollIntoView({ block: 'nearest' });
});
// Coming back with the browser's back button restores the page from cache: drop the hand-off state.
addEventListener('pageshow', e => { if (e.persisted && going) { going = false; selectScreen.classList.remove('going'); selected?.focus({ preventScroll: true }); } });

// Settings: cycles the same render-quality choice the game reads on start.
const qualityButton = $('quality');
const showQuality = () => { const v = store.get(QUALITY_KEY) || 'auto'; qualityButton.textContent = `화면 품질: ${(QUALITY.find(q => q[0] === v) ?? QUALITY[0])[1]}`; };
qualityButton.addEventListener('click', () => { const v = store.get(QUALITY_KEY) || 'auto', i = QUALITY.findIndex(q => q[0] === v); store.set(QUALITY_KEY, QUALITY[(i + 1) % QUALITY.length][0]); showQuality(); });
showQuality();
$('open-settings').addEventListener('click', e => openScreen('settings', e.currentTarget));

// Music is shared with the game; no media request precedes the first user gesture.
const TITLE_MUSIC = [['songs', '캠퍼스를 부수고 싶어'], ['calm', '잔잔한 기본'], ['off', '끄기']];
const musicSetting = document.createElement('button');
musicSetting.type = 'button'; musicSetting.id = 'title-music-choice'; musicSetting.className = 'btn';
const showMusic = () => { musicSetting.textContent = `배경음악 · ${TITLE_MUSIC.find(([id]) => id === musicPreference())[1]}`; };
musicSetting.addEventListener('click', () => {
  const index = TITLE_MUSIC.findIndex(([id]) => id === musicPreference());
  const value = TITLE_MUSIC[(index + 1) % TITLE_MUSIC.length][0];
  saveMusicPreference(value); titleMusic.setMode(value); syncTitleMusic(); showMusic();
});
showMusic();
$('settings').querySelector('.options').insertBefore(musicSetting, $('settings').querySelector('.hint'));
tickOnPress(document, '.btn, .sb, .row, .sort-btn, .lv-btn, .sound-toggle, .logo');
const soundToggle = $('sound-toggle');
const showSound = () => { const on = soundPreference(); soundToggle.setAttribute('aria-pressed', String(on)); soundToggle.setAttribute('aria-label', on ? '소리 끄기' : '소리 켜기'); };
showSound();
let started = false, titleFocused = true;
function syncTitleMusic() {
  titleMusic.setPaused(document.hidden || !titleFocused);
  if (started) void titleMusic.setEnabled(soundPreference());
}
soundToggle.addEventListener('click', () => { const on = !soundPreference(); saveSoundPreference(on); showSound(); syncTitleMusic(); if (on) playTick(); });
function unlockTitleMusic() { started = true; titleFocused = true; syncTitleMusic(); }
// iOS Safari grants audio only on touchend/click (not pointerdown from a touch): listen to every gesture end so the first tap anywhere starts the music.
for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(type, unlockTitleMusic, { capture: true, passive: true });
window.titleMusicState = () => titleMusic.stats;
// Focus moving into the 제작 정보 frame blurs this window but the page is still in front: keep the music playing.
addEventListener('blur', () => setTimeout(() => {
  titleFocused = document.activeElement?.id === 'credits-frame' && !$('credits').hidden; syncTitleMusic();
}, 0));
addEventListener('focus', () => { titleFocused = true; syncTitleMusic(); });
addEventListener('pagehide', () => titleMusic.setPaused(true));
addEventListener('pageshow', () => { titleFocused = true; titleMusic.resumeScene(); syncTitleMusic(); });
document.addEventListener('visibilitychange', syncTitleMusic);
// Save at navigation time so the loading page resumes the latest audible position.
$('resume').addEventListener('click', e => {
  if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  titleMusic.saveHandoff();
});

// The credits page itself, shown in a frame over the title (user 10-24: keep the original page look) so the title music keeps playing.
// Its own "첫 화면" links close the frame; other links leave through the top window.
let creditsLoaded = false;
function loadCredits() {
  const frame = $('credits-frame');
  if (!creditsLoaded) {
    creditsLoaded = true;
    frame.addEventListener('load', () => {
      let doc; try { doc = frame.contentDocument; } catch { return; }
      if (!doc) return;
      for (const link of doc.querySelectorAll('a[href]')) {
        const url = new URL(link.getAttribute('href'), frame.contentWindow.location.href);
        if (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname)) link.addEventListener('click', e => { e.preventDefault(); closeScreens(); });
        else if (url.origin !== location.origin) { link.target = '_blank'; link.rel = 'noopener'; }
        else link.target = '_top';
      }
      doc.addEventListener('keydown', e => { if (e.key === 'Escape') closeScreens(); });
      try { frame.contentWindow.focus(); } catch {}
    });
    frame.src = './credits.html';
  }
}
$('open-credits').addEventListener('click', e => {
  if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault(); openScreen('credits', e.currentTarget); void loadCredits();
});
// Keyboard focus stays inside the visible screen and returns to its opener on close.
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const screen = document.querySelector('.screen:not([hidden])');
  if (!screen) return;
  const items = [...screen.querySelectorAll('button, a[href], input, [tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
  const first = items[0], last = items.at(-1);
  if (e.shiftKey && (document.activeElement === first || !screen.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
  else if (!e.shiftKey && (document.activeElement === last || !screen.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
});

// The first panorama is the only critical image. Fetch the others serially after the first paint/load.
const PANORAMAS = ['korea', 'ewha', 'kaist', 'hanyang', 'skku', 'kyunghee'].map(id => new URL(`../assets/ui/title-pano-${id}.jpg`, import.meta.url).href);
const panoLayers = [...document.querySelectorAll('.pano')];
const loadedPanos = [new URL('../assets/ui/title-pano.jpg', import.meta.url).href];
let preloadIndex = 0, preloading = false, panoIndex = 0, frontLayer = 0, panoTimer = null, titleLoaded = false;
const idle = callback => 'requestIdleCallback' in window ? requestIdleCallback(callback, { timeout: 2000 }) : setTimeout(callback, 100);
function preloadPanorama() {
  if (!titleLoaded || preloading || reduceMotion.matches || document.hidden || preloadIndex >= PANORAMAS.length) return;
  preloading = true;
  const img = new Image(); img.decoding = 'async'; img.fetchPriority = 'low';
  const done = ok => {
    if (ok) loadedPanos.push(img.src);
    preloading = false; preloadIndex++; idle(preloadPanorama);
  };
  img.onload = () => done(true); img.onerror = () => done(false); img.src = PANORAMAS[preloadIndex];
}
function schedulePanorama() {
  clearTimeout(panoTimer);
  if (!titleLoaded || reduceMotion.matches || document.hidden) return;
  panoTimer = setTimeout(async () => {
    if (loadedPanos.length > 1) {
      const nextIndex = (panoIndex + 1) % loadedPanos.length;
      const next = new Image(); next.src = loadedPanos[nextIndex];
      try { await next.decode(); } catch { schedulePanorama(); return; }
      if (reduceMotion.matches || document.hidden) return;
      const back = 1 - frontLayer;
      panoLayers[back].style.backgroundImage = `url("${next.src}")`;
      panoLayers[back].style.opacity = '1'; panoLayers[frontLayer].style.opacity = '0';
      frontLayer = back; panoIndex = nextIndex;
    }
    schedulePanorama();
  }, 14000);
}
function syncPanorama() {
  if (reduceMotion.matches) {
    panoLayers[0].style.backgroundImage = `url("${loadedPanos[0]}")`;
    panoLayers[0].style.opacity = '1'; panoLayers[1].style.opacity = '0'; frontLayer = 0; panoIndex = 0;
  }
  schedulePanorama(); idle(preloadPanorama);
}
reduceMotion.addEventListener('change', syncPanorama);
document.addEventListener('visibilitychange', syncPanorama);
function beginPanoramas() { requestAnimationFrame(() => requestAnimationFrame(() => { titleLoaded = true; syncPanorama(); })); }
if (document.readyState === 'complete') beginPanoramas(); else addEventListener('load', beginPanoramas, { once: true });
