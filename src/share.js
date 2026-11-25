import { KAKAO_JS_KEY } from './share-config.js';

// Share (user 10-25, 시안/공유확산_시안.html C): the "친구한테 자랑하기" button on the campus-complete card and the share icon
// beside the settings button both open our own chooser — a bottom sheet on phones, a small popover beside the button on wider
// screens. Choices: KakaoTalk · Instagram · X · Threads · copy link. Text + link only (no result image). Each choice tags the
// link with utm_source=share&utm_medium=<choice> so arrivals can be told apart.
const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v8h14v-8"/></svg>';
const CHAIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>';
// official logos: Simple Icons 16.35.0 paths (CC0), copied from the 시안; the marks are their owners' trademarks
const LOGOS = {
  kakao: '<svg class="lg" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" fill="#000"/><path fill="#FFCD00" d="M22.125 0H1.875C.8394 0 0 .8394 0 1.875v20.25C0 23.1606.8394 24 1.875 24h20.25C23.1606 24 24 23.1606 24 22.125V1.875C24 .8394 23.1606 0 22.125 0zM12 18.75c-.591 0-1.1697-.0413-1.7317-.1209-.5626.3965-3.813 2.6797-4.1198 2.7225 0 0-.1258.0489-.2328-.0141s-.0876-.2282-.0876-.2282c.0322-.2198.8426-3.0183.992-3.5333-2.7452-1.36-4.5701-3.7686-4.5701-6.5135C2.25 6.8168 6.6152 3.375 12 3.375s9.75 3.4418 9.75 7.6875c0 4.2457-4.3652 7.6875-9.75 7.6875zM8.0496 9.8672h-.8777v3.3417c0 .2963-.2523.5372-.5625.5372s-.5625-.2409-.5625-.5372V9.8672h-.8777c-.3044 0-.552-.2471-.552-.5508s.2477-.5508.552-.5508h2.8804c.3044 0 .552.2471.552.5508s-.2477.5508-.552.5508zm10.9879 2.9566a.558.558 0 0 1 .108.4167.5588.5588 0 0 1-.2183.371.5572.5572 0 0 1-.3383.1135.558.558 0 0 1-.4493-.2236l-1.3192-1.7479-.1952.1952v1.2273a.5635.5635 0 0 1-.5627.5628.563.563 0 0 1-.5625-.5625V9.3281c0-.3102.2523-.5625.5625-.5625s.5625.2523.5625.5625v1.209l1.5694-1.5694c.0807-.0807.1916-.1252.312-.1252.1404 0 .2814.0606.3871.1661.0985.0984.1573.2251.1654.3566.0082.1327-.036.2542-.1241.3425l-1.2818 1.2817 1.3845 1.8344zm-8.3502-3.5023c-.095-.2699-.3829-.5475-.7503-.5557-.3663.0083-.6542.2858-.749.5551l-1.3455 3.5415c-.1708.5305-.0217.7272.1333.7988a.8568.8568 0 0 0 .3576.0776c.2346 0 .4139-.0952.4678-.2481l.2787-.7297 1.7152.0001.2785.7292c.0541.1532.2335.2484.4681.2484a.8601.8601 0 0 0 .3576-.0775c.1551-.0713.3041-.2681.1329-.7999l-1.3449-3.5398zm-1.3116 2.4433l.5618-1.5961.5618 1.5961H9.3757zm5.9056 1.3836c0 .2843-.2418.5156-.5391.5156h-1.8047c-.2973 0-.5391-.2314-.5391-.5156V9.3281c0-.3102.2576-.5625.5742-.5625s.5742.2523.5742.5625v3.3047h1.1953c.2974 0 .5392.2314.5392.5156z"/></svg>',
  instagram: '<svg class="lg" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="share-ig-grad" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FEDA75"/><stop offset=".3" stop-color="#FA7E1E"/><stop offset=".6" stop-color="#D62976"/><stop offset=".8" stop-color="#962FBF"/><stop offset="1" stop-color="#4F5BD5"/></linearGradient></defs><path fill="url(#share-ig-grad)" d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/></svg>',
  x: '<svg class="lg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/></svg>',
  threads: '<svg class="lg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z"/></svg>',
};
const CHOICES = [
  { id: 'kakao', label: '카카오톡', logo: LOGOS.kakao, tile: 'logo kakao', via: 'sheet', app: 'kakaotalk://' },
  { id: 'instagram', label: '인스타그램', logo: LOGOS.instagram, tile: 'logo', via: 'sheet', app: 'instagram://direct-inbox' },
  { id: 'x', label: 'X', logo: LOGOS.x, tile: 'logo', via: 'x' },
  { id: 'threads', label: '스레드', logo: LOGOS.threads, tile: 'logo', via: 'threads' },
  { id: 'copy', label: '링크 복사', logo: CHAIN, tile: '', via: 'copy' },
];

// Synchronous copying lets an app launch remain in the same click gesture.
function copyNow(text) {
  const area = document.createElement('textarea');
  area.value = text; area.setAttribute('readonly', ''); area.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.append(area); area.select();
  let ok = false;
  try { ok = Boolean(document.execCommand?.('copy')); } catch { /* Clipboard may be unavailable. */ }
  area.remove();
  return ok;
}
function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return copyNow(text) ? Promise.resolve() : Promise.reject(Error('copy failed'));
}

let kakaoLoading;
function loadKakao() {
  if (window.Kakao?.init) return Promise.resolve(window.Kakao);
  if (!kakaoLoading) {
    kakaoLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.4/kakao.min.js';
      script.integrity = 'sha384-BGX7Wb16GmRFagri4bLJV2DgipVZaU2AI812GZtHtHzzDQJnfHasDXN5houxv45w';
      script.crossOrigin = 'anonymous';
      const timeout = setTimeout(() => { script.remove(); reject(Error('Kakao SDK timed out')); }, 12000);
      script.onload = () => { clearTimeout(timeout); window.Kakao?.init ? resolve(window.Kakao) : reject(Error('Kakao SDK missing')); };
      script.onerror = () => { clearTimeout(timeout); script.remove(); reject(Error('Kakao SDK failed')); };
      document.head.append(script);
    }).catch(error => { kakaoLoading = null; throw error; });
  }
  return kakaoLoading;
}

export function createShare({ meta, campusId, track, notify }) {
  const linkFor = medium => `${location.origin}${location.pathname}?utm_source=share&utm_medium=${medium}`;
  const textFor = place => place === 'complete' ? `${meta.short} 다 부숴버림 💥 @beattheschool` : `${meta.short} 부수는 중 💥 @beattheschool`;
  const openWindow = href => window.open(href, '_blank', 'noopener');
  const inApp = () => /Instagram|KAKAOTALK|FBAN|FBAV|FB_IAB/i.test(navigator.userAgent);
  const onPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)) || inApp();
  const appUrl = choice => {
    if (!/Android/i.test(navigator.userAgent)) return choice.app;
    const instagram = choice.id === 'instagram';
    const fallback = instagram ? 'https://play.google.com/store/apps/details?id=com.instagram.android' : 'https://play.google.com/store/apps/details?id=com.kakao.talk';
    return `intent://${instagram ? 'direct-inbox' : ''}#Intent;scheme=${instagram ? 'instagram' : 'kakaotalk'};package=${instagram ? 'com.instagram.android' : 'com.kakao.talk'};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
  };

  // A rejected share or a lazy SDK load no longer has a reliable user activation.
  // A new button provides a fresh gesture instead of launching an app from a promise callback.
  function offerAction(message, label, action) {
    const dialog = document.createElement('dialog');
    dialog.className = 'share-chooser share-followup'; dialog.setAttribute('aria-label', '공유');
    const note = document.createElement('p'); note.textContent = message; note.setAttribute('role', 'status');
    const go = document.createElement('button'); go.type = 'button'; go.className = 'primary-button'; go.textContent = label;
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'primary-button'; cancel.textContent = '닫기';
    go.addEventListener('click', () => { dialog.close(); action(); });
    cancel.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    dialog.append(note, go, cancel); document.body.append(dialog); dialog.showModal(); go.focus();
  }

  function send(choice, place, onResult) {
    const text = textFor(place), url = linkFor(choice.id);
    const done = () => track('share', { place, campus: campusId, method: choice.id });
    if (choice.via === 'x') { openWindow(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`); done(); return; }
    if (choice.via === 'threads') { openWindow(`https://www.threads.net/intent/post?text=${encodeURIComponent(`${text} ${url}`)}`); done(); return; }
    const copy = () => copyText(`${text} ${url}`).then(() => { done(); onResult('주소를 복사했어요'); }, () => onResult('복사하지 못했어요 · 주소창 링크를 보내 주세요'));
    const openApp = () => {
      const copied = copyNow(`${text} ${url}`);
      done();
      onResult(copied ? `${choice.label} 열기를 시도했어요 · 복사한 링크를 붙여 넣어 주세요` : `${choice.label} 열기를 시도했어요 · 링크 복사는 안 됐어요`);
      location.href = appUrl(choice);
    };
    const offerFallback = message => {
      if (onPhone()) offerAction(message, `${choice.label} 열기`, openApp);
      else copy();
    };
    if (choice.via === 'copy') { copy(); return; }
    if (choice.id === 'kakao' && KAKAO_JS_KEY.trim()) {
      onResult('카카오톡 공유를 준비하고 있어요');
      loadKakao().then(kakao => {
        try {
          if (!kakao.isInitialized()) kakao.init(KAKAO_JS_KEY.trim());
          offerAction('카카오톡 공유가 준비됐어요.', '카카오톡 공유하기', () => {
            try {
              const imageUrl = document.querySelector('meta[property="og:image"]')?.content || 'https://beattheschool.com/assets/ui/og-home-2.jpg';
              kakao.Share.sendDefault({ objectType: 'feed', content: { title: `${meta.short} · Beat the School`, description: text, imageUrl, link: { mobileWebUrl: url, webUrl: url } }, buttons: [{ title: '게임하러 가기', link: { mobileWebUrl: url, webUrl: url } }] });
              done(); onResult('카카오톡 공유를 요청했어요');
            } catch { offerFallback('카카오톡 공유를 시작하지 못했어요.'); }
          });
        } catch { offerFallback('카카오톡 공유를 준비하지 못했어요.'); }
      }).catch(() => offerFallback('카카오톡 공유를 불러오지 못했어요.'));
      return;
    }
    const data = { title: `${meta.short} · Beat the School`, text, url };
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
        const sharing = navigator.share(data);
        onResult('공유창을 요청했어요');
        Promise.resolve(sharing).then(done, () => offerFallback('공유가 취소되었거나 시작되지 않았어요.'));
        return;
      }
    } catch { /* Try the app directly on this click. */ }
    if (onPhone()) openApp(); else copy();
  }

  // The chooser is a modal <dialog> so it stacks above the complete card (also a modal dialog) and the game's key handler
  // stands down while it is open. Built on first use.
  let chooser = null, opener = null, place = 'corner', onResult = notify;
  function build() {
    const dialog = document.createElement('dialog');
    dialog.id = 'share-chooser'; dialog.className = 'share-chooser'; dialog.setAttribute('aria-label', '공유');
    dialog.innerHTML = `<div class="share-grab" aria-hidden="true"></div><div class="share-choices">${CHOICES.map(choice =>
      `<button class="share-choice" type="button" data-choice="${choice.id}"><i class="${choice.tile}">${choice.logo}</i><span>${choice.label}</span></button>`).join('')}</div><button class="primary-button share-close" type="button">닫기</button>`;
    dialog.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => {
      const choice = CHOICES.find(entry => entry.id === button.dataset.choice), at = place, report = onResult;
      close(); send(choice, at, report);
    }));
    dialog.querySelector('.share-close').addEventListener('click', close);
    // a click on the backdrop lands on the dialog itself, outside its box
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
    });
    dialog.addEventListener('close', () => { opener?.focus(); opener = null; });
    // a popover pinned to its button would drift on resize/rotation; the sheet stays put
    window.addEventListener('resize', () => { if (dialog.dataset.mode === 'popover') close(); });
    document.body.append(dialog);
    return dialog;
  }
  function close() { if (chooser?.open) chooser.close(); }
  function setMode() {
    const sheet = matchMedia('(max-width: 600px)').matches;
    chooser.dataset.mode = sheet ? 'sheet' : 'popover';
    chooser.style.left = chooser.style.top = '';
    return sheet;
  }
  function position(anchor) {
    const a = anchor.getBoundingClientRect(), box = chooser.getBoundingClientRect(), gap = 14, edge = 12;
    let left = a.right + gap, top = a.top - 14, side = 'right';
    if (left + box.width > innerWidth - edge) {
      side = 'below'; top = a.bottom + gap;
      left = Math.max(edge, Math.min(a.right - box.width, innerWidth - edge - box.width));
    }
    top = Math.max(edge, Math.min(top, innerHeight - edge - box.height));
    chooser.dataset.side = side;
    chooser.style.left = `${Math.round(left)}px`; chooser.style.top = `${Math.round(top)}px`;
    chooser.style.setProperty('--arrow', side === 'right' ? `${Math.round(a.top + a.height / 2 - top - 9)}px` : `${Math.round(a.left + a.width / 2 - left - 9)}px`);
  }
  function open(anchor, at, report) {
    chooser ??= build();
    if (chooser.open) { close(); return; }
    opener = anchor; place = at; onResult = report;
    const sheet = setMode();
    chooser.showModal();
    if (!sheet) position(anchor);
    chooser.querySelector('[data-choice]').focus();
  }

  // icon left of the settings button
  const corner = document.createElement('button');
  corner.id = 'share-open'; corner.className = 'share-open'; corner.type = 'button';
  corner.setAttribute('aria-label', '친구한테 공유'); corner.setAttribute('aria-haspopup', 'dialog'); corner.title = '친구한테 공유'; corner.innerHTML = ICON;
  // optional calls: the game-check DOM stub has no addEventListener/before on every element
  corner.addEventListener?.('click', () => open(corner, 'corner', notify));
  document.getElementById('settings-open').before?.(corner);

  // first button of the complete card; a copy result shows on the button itself (the card covers the game toast)
  const button = document.createElement('button');
  button.id = 'share-complete'; button.className = 'primary-button share-button'; button.type = 'button';
  button.setAttribute('aria-haspopup', 'dialog');
  const label = '친구한테 자랑하기';
  button.innerHTML = `${ICON}<span>${label}</span>`;
  let timer = 0;
  button.addEventListener?.('click', () => open(button, 'complete', message => {
    button.querySelector('span').textContent = message; clearTimeout(timer);
    timer = setTimeout(() => { button.querySelector('span').textContent = label; }, 2400);
  }));
  document.getElementById('play-again').before?.(button);
  return { open, close };
}
