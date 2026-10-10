/* MediaGrabber Pro – PWA bootstrap
   A) PWA-ONLY (installed app): lighter animations, no zoom/selection/bounce, theme colour, desktop title bar, haptics, notifications.
   B) ALL VISITORS: service worker + update notice, offline bar, smart install button + install count, iOS tip,
      Share-to-app / Open-with / paste / drag-drop file intake, quick menu (recent files, share result, save folder, storage),
      keep-screen-awake, offline feedback queue, deep links, remember last tool, follow phone theme, reduced-motion.        */
(function () {
  'use strict';

  var root = document.documentElement;
  var mm = function (m) { return window.matchMedia && window.matchMedia('(display-mode: ' + m + ')').matches; };
  var standalone = mm('standalone') || mm('fullscreen') || mm('minimal-ui') || mm('window-controls-overlay') || window.navigator.standalone === true;
  var hadController = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  var DB = 'convertor-11437-default-rtdb.firebaseio.com';
  var SECTIONS = ['converter', 'pdf', 'pdfmerge', 'texttopdf', 'ocr', 'unlocker', 'heic2jpg', 'qrcode', 'compress', 'photoprep', 'scanner', 'pagetools', 'signpdf', 'exif', 'qrscan'];
  var BUILD = '10';
  window.MG_BUILD = BUILD;
  var FONT = 'font:600 14px Poppins,Inter,system-ui,sans-serif;';

  function onReady(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function hasTools() { return !!document.getElementById('imgInput'); }
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function platformName() { return /android/i.test(navigator.userAgent) ? 'android' : (isIOS ? 'ios' : 'desktop'); }

  /* ---------------- text (English / Hindi / Gujarati) ---------------- */
  var EN = { update: '🔄 New version ready', refresh: 'Refresh', updateNow: 'Update', installApp: 'Install app', clearRecent: 'Clear recent files', installHow: 'Open your browser menu and choose “Install app” or “Add to Home screen”.', updating: 'Updating…',
    offline: "📡 You're offline — converters still work. Feedback & VIP need internet.", online: '✓ Back online',
    install: '⬇ Install App', iosTip: '📲 Install MG Pro: tap the Share button, then "Add to Home Screen".', gotIt: 'Got it',
    filesReceived: 'file(s) received', chooseTool: 'What would you like to do?', unsupported: 'Videos and other file types are not supported here. Please share an image or a PDF.',
    cancel: 'Cancel', menu: 'Quick menu', paste: '📋 Paste image', recent: '🕘 Recent files', noRecent: 'Nothing yet — finished files will appear here.',
    shareLast: '📤 Share last result', saveFolder: '📁 Save folder', folderNone: 'Choose a folder to save results into (desktop)',
    folderUse: 'Saving to: ', folderOff: 'Use normal downloads', folderAllow: 'Allow folder access', storage: '💾 Storage', storageUsing: 'Using',
    offlineReady: 'Offline ready ✓', offlineNot: 'Not cached yet — open the site once while online', clearCache: 'Clear cache', cleared: 'Cache cleared',
    shareBtn: 'Share', saved: 'saved', pasteNone: 'No image found on the clipboard.', dropHint: 'Drop files to open them', close: 'Close',
    savedToFolder: 'Saved to your folder', batchOn: '📦 Batch mode: collect results into one ZIP', batchOff: '📦 Batch mode is ON — tap to turn off', batchBar: 'file(s) in your ZIP', batchGet: 'Download ZIP', batchClear: 'Clear',
    a11y: '♿ Accessibility', textSize: 'Text size', hc: 'High contrast', shortcuts: '⌨ Keyboard shortcuts', privacy: '🔒 Privacy',
    rateQ: '⭐ Enjoying MG Pro? Tell us in 20 seconds.', rate: 'Rate us', later: 'Later', fav: '★ Favourites', build: 'Build', queued: 'Saved offline — it will be sent when you are back online.' };
  var I18N = {
    hi: { update: '🔄 नया संस्करण तैयार है', refresh: 'रीफ़्रेश', offline: '📡 आप ऑफ़लाइन हैं — कन्वर्टर चलते रहेंगे। फ़ीडबैक और VIP के लिए इंटरनेट चाहिए।',
      online: '✓ फिर से ऑनलाइन', install: '⬇ ऐप इंस्टॉल करें', iosTip: '📲 MG Pro इंस्टॉल करें: Share बटन दबाएँ, फिर "Add to Home Screen" चुनें।', gotIt: 'ठीक है',
      filesReceived: 'फ़ाइल मिलीं', chooseTool: 'आप क्या करना चाहेंगे?', unsupported: 'ये फ़ाइल प्रकार समर्थित नहीं हैं (इमेज या PDF उपयोग करें)।', cancel: 'रद्द करें',
      menu: 'क्विक मेन्यू', paste: '📋 इमेज पेस्ट करें', recent: '🕘 हाल की फ़ाइलें', noRecent: 'अभी कुछ नहीं — तैयार फ़ाइलें यहाँ दिखेंगी।',
      shareLast: '📤 अंतिम परिणाम शेयर करें', saveFolder: '📁 सेव फ़ोल्डर', folderNone: 'परिणाम सेव करने के लिए फ़ोल्डर चुनें (डेस्कटॉप)', folderUse: 'सेव हो रहा है: ',
      folderOff: 'सामान्य डाउनलोड उपयोग करें', folderAllow: 'फ़ोल्डर एक्सेस की अनुमति दें', storage: '💾 स्टोरेज', storageUsing: 'उपयोग', offlineReady: 'ऑफ़लाइन तैयार ✓',
      offlineNot: 'अभी कैश नहीं — साइट एक बार ऑनलाइन खोलें', clearCache: 'कैश साफ़ करें', cleared: 'कैश साफ़ हो गया', shareBtn: 'शेयर', saved: 'सेव हुई',
      pasteNone: 'क्लिपबोर्ड में इमेज नहीं मिली।', dropHint: 'खोलने के लिए फ़ाइलें यहाँ छोड़ें', close: 'बंद करें', savedToFolder: 'आपके फ़ोल्डर में सेव हुई',
      queued: 'ऑफ़लाइन सेव हुआ — इंटरनेट आते ही भेजा जाएगा।' },
    gu: { update: '🔄 નવી આવૃત્તિ તૈયાર છે', refresh: 'રીફ્રેશ', offline: '📡 તમે ઑફલાઇન છો — કન્વર્ટર ચાલુ રહેશે. ફીડબેક અને VIP માટે ઇન્ટરનેટ જોઈએ.',
      online: '✓ ફરી ઑનલાઇન', install: '⬇ એપ ઇન્સ્ટોલ કરો', iosTip: '📲 MG Pro ઇન્સ્ટોલ કરો: Share બટન દબાવો, પછી "Add to Home Screen" પસંદ કરો.', gotIt: 'બરાબર',
      filesReceived: 'ફાઇલ મળી', chooseTool: 'તમે શું કરવા માંગો છો?', unsupported: 'આ ફાઇલ પ્રકાર સપોર્ટેડ નથી (ઇમેજ અથવા PDF વાપરો).', cancel: 'રદ કરો',
      menu: 'ક્વિક મેનૂ', paste: '📋 ઇમેજ પેસ્ટ કરો', recent: '🕘 તાજેતરની ફાઇલો', noRecent: 'હજી કંઈ નથી — તૈયાર ફાઇલો અહીં દેખાશે.',
      shareLast: '📤 છેલ્લું પરિણામ શેર કરો', saveFolder: '📁 સેવ ફોલ્ડર', folderNone: 'પરિણામ સેવ કરવા ફોલ્ડર પસંદ કરો (ડેસ્કટોપ)', folderUse: 'સેવ થઈ રહ્યું છે: ',
      folderOff: 'સામાન્ય ડાઉનલોડ વાપરો', folderAllow: 'ફોલ્ડર એક્સેસની મંજૂરી આપો', storage: '💾 સ્ટોરેજ', storageUsing: 'ઉપયોગ', offlineReady: 'ઑફલાઇન તૈયાર ✓',
      offlineNot: 'હજી કેશ નથી — સાઇટ એકવાર ઑનલાઇન ખોલો', clearCache: 'કેશ સાફ કરો', cleared: 'કેશ સાફ થઈ ગયું', shareBtn: 'શેર', saved: 'સેવ થઈ',
      pasteNone: 'ક્લિપબોર્ડમાં ઇમેજ મળી નથી.', dropHint: 'ખોલવા માટે ફાઇલો અહીં છોડો', close: 'બંધ કરો', savedToFolder: 'તમારા ફોલ્ડરમાં સેવ થઈ',
      queued: 'ઑફલાઇન સેવ થયું — ઇન્ટરનેટ આવતા જ મોકલાશે.' } };
  var LANG = ((navigator.language || 'en') + '').slice(0, 2).toLowerCase();
  function t(k) { return (I18N[LANG] && I18N[LANG][k]) || EN[k] || k; }

  /* ---------------- shared UI helpers ---------------- */
  function makeBar(id, text, color, pos, buttons) {
    var old = document.getElementById(id); if (old) old.remove();
    var b = document.createElement('div');
    b.id = id;
    b.style.cssText = 'position:fixed;left:12px;right:12px;margin:0 auto;max-width:520px;z-index:100002;display:flex;align-items:center;gap:8px;' +
      'padding:10px 14px;border-radius:14px;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.45);background:' + color + ';' + FONT +
      (pos === 'top' ? 'top:calc(env(safe-area-inset-top,0px) + 10px);' : 'bottom:calc(env(safe-area-inset-bottom,0px) + 14px);');
    var s = document.createElement('span'); s.style.cssText = 'flex:1;line-height:1.4;word-break:break-word'; s.textContent = text; b.appendChild(s);
    (buttons || []).forEach(function (bt) {
      var x = document.createElement('button');
      x.textContent = bt.label;
      x.style.cssText = 'all:unset;cursor:pointer;padding:6px 12px;border-radius:10px;background:rgba(255,255,255,.2);' + FONT;
      x.onclick = bt.fn; b.appendChild(x);
    });
    document.body.appendChild(b);
    return b;
  }
  function removeEl(id) { var e = document.getElementById(id); if (e) e.remove(); }
  function toast(text) {
    onReady(function () { makeBar('mg-toast', text, '#1f2937', 'bottom'); setTimeout(function () { removeEl('mg-toast'); }, 2800); });
  }
  function isEditable(el) { return el && el.closest && el.closest('input, textarea, [contenteditable="true"], .allow-select'); }
  function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

  /* ---------------- haptics / notifications / badge ---------------- */
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function askNotif() {
    if ('Notification' in window && Notification.permission === 'default' && !lsGet('mg_notif_asked')) {
      lsSet('mg_notif_asked', '1');
      try { Notification.requestPermission(); } catch (e) {}
    }
  }
  function notifyDone() {
    if (navigator.setAppBadge) navigator.setAppBadge(1).catch(function () {});
    if (!('Notification' in window) || Notification.permission !== 'granted' || !navigator.serviceWorker) return;
    navigator.serviceWorker.ready.then(function (reg) {
      reg.showNotification('MediaGrabber Pro', { body: 'Your file is ready. Tap to open.', icon: 'android-chrome-192x192.png', badge: 'favicon-48x48.png', tag: 'mg-done' });
    }).catch(function () {});
  }
  function clearBadge() { if (!document.hidden && navigator.clearAppBadge) navigator.clearAppBadge().catch(function () {}); }

  /* =====================================================================
     A) PWA-ONLY
     ===================================================================== */
  var KEEP = ['.loader', '.loader-dot', '.loader-dot-shadow', '.trail-dot', '.mg-spin', '.vl-spinner'];
  var notKeep = KEEP.map(function (k) { return ':not(' + k + ')'; }).join('') + ':not(.vl-spinner *)';

  if (standalone) {
    root.classList.add('is-pwa');

    var vp = document.querySelector('meta[name="viewport"]');
    if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
    vp.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

    var css = [
      'html.is-pwa, html.is-pwa body { touch-action: pan-x pan-y; -webkit-text-size-adjust: 100%; }',
      'html.is-pwa { overscroll-behavior-y: contain; }',
      'html.is-pwa, html.is-pwa * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }',
      'html.is-pwa input, html.is-pwa textarea, html.is-pwa [contenteditable="true"], html.is-pwa .allow-select, html.is-pwa .allow-select * { -webkit-user-select: text; user-select: text; -webkit-touch-callout: default; }',
      'html.is-pwa img, html.is-pwa a { -webkit-user-drag: none; user-drag: none; }',
      'html.is-pwa *, html.is-pwa *::before, html.is-pwa *::after { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }',
      'html.is-pwa *' + notKeep + ', html.is-pwa *' + notKeep + '::before, html.is-pwa *' + notKeep + '::after { animation-iteration-count: 1 !important; }',
      '',
      /* desktop installed app: use the top bar of the site as the title bar */
      '@media (display-mode: window-controls-overlay) {',
      '  html.is-pwa nav { -webkit-app-region: drag; app-region: drag; min-height: env(titlebar-area-height, 48px); padding-top: 0; padding-bottom: 0;',
      '    padding-left: max(1%, env(titlebar-area-x, 0px)); padding-right: calc(100% - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100%) + 12px); }',
      '  html.is-pwa nav a, html.is-pwa nav button, html.is-pwa nav input { -webkit-app-region: no-drag; app-region: no-drag; }',
      '}'
    ].join('\n');
    var st = document.createElement('style'); st.id = 'pwa-only-styles'; st.textContent = css; document.head.appendChild(st);

    /* Zoom is blocked by the viewport + CSS touch-action below. No global touch/wheel listeners here:
       a non-passive listener on the document forces every scroll through the main thread and makes
       scrolling stall in the installed app. */
    var opt = { passive: false };
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) { document.addEventListener(n, function (e) { e.preventDefault(); }, opt); });
    window.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].indexOf(e.key) > -1) e.preventDefault(); });
    document.addEventListener('contextmenu', function (e) { if (!isEditable(e.target)) e.preventDefault(); });
    document.addEventListener('selectstart', function (e) { if (!isEditable(e.target)) e.preventDefault(); });
    document.addEventListener('dragstart', function (e) { if (e.target && e.target.tagName === 'IMG') e.preventDefault(); });

    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    document.addEventListener('visibilitychange', clearBadge);
    window.addEventListener('focus', clearBadge);

    onReady(function () {                       // status/title-bar colour follows the in-app theme
      var meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
      var apply = function () {
        var c = document.body.classList;
        meta.content = c.contains('light-mode') ? '#ffffff' : (c.contains('black-mode') ? '#000000' : '#05070f');
      };
      apply();
      new MutationObserver(apply).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    });
  }

  /* =====================================================================
     B) ALL VISITORS
     ===================================================================== */

  /* ---- reduced motion (respects the phone / OS setting) ---- */
  (function () {
    var s = document.createElement('style'); s.id = 'mg-a11y';
    s.textContent = '@media (prefers-reduced-motion: reduce) {\n' +
      '  html *' + notKeep + ', html *' + notKeep + '::before, html *' + notKeep + '::after { animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }\n}';
    document.head.appendChild(s);
  })();

  /* ---- Firebase writes are queued while offline (feedback etc.) ---- */
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  function qGet() { try { return JSON.parse(lsGet('mg_fb_queue') || '[]'); } catch (e) { return []; } }
  function qPush(it) { var q = qGet(); q.push(it); lsSet('mg_fb_queue', JSON.stringify(q.slice(-50))); }
  if (origFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : ((input && input.url) || '');
      var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      if (url.indexOf(DB) > -1 && method !== 'GET' && init && typeof init.body === 'string') {
        return origFetch(input, init).catch(function (err) {
          if (url.indexOf('/feedback') > -1) toast(t('queued'));
          qPush({ u: url, m: method, b: init.body });
          return new Response('{"name":"queued"}', { status: 200, headers: { 'Content-Type': 'application/json' } });
        });
      }
      return origFetch(input, init);
    };
  }
  function flushQueue() {
    var q = qGet();
    if (!q.length || !navigator.onLine || !origFetch) return;
    lsSet('mg_fb_queue', '[]');
    q.reduce(function (p, it) {
      return p.then(function () {
        return origFetch(it.u, { method: it.m, headers: { 'Content-Type': 'application/json' }, body: it.b })
          .then(function (r) { if (r.status >= 500) throw new Error('retry'); })
          .catch(function () { qPush(it); });
      });
    }, Promise.resolve());
  }
  window.addEventListener('load', function () { setTimeout(flushQueue, 1500); });
  window.addEventListener('online', flushQueue);

  /* tap "Update": small spinner on the button, then a quick reload with no loading screen */
  function applyUpdate() {
    var bar = document.getElementById('mg-update-bar'); var btn = bar && bar.querySelector('button');
    if (!document.getElementById('mg-upd-css')) {
      var st = document.createElement('style'); st.id = 'mg-upd-css';
      st.textContent = '@keyframes mgUpdSpin{to{transform:rotate(360deg)}}.mg-upd-spin{display:inline-block;width:12px;height:12px;margin-right:8px;vertical-align:-2px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:mgUpdSpin .6s linear infinite}#mg-update-bar{transition:opacity .25s}';
      document.head.appendChild(st);
    }
    if (btn) { btn.innerHTML = '<span class="mg-upd-spin"></span>' + t('updating'); btn.style.pointerEvents = 'none'; }
    try { sessionStorage.setItem('mg_updating', '1'); } catch (e) {}
    setTimeout(function () { if (bar) bar.style.opacity = '0'; setTimeout(function () { location.reload(); }, 220); }, 2800);
  }

  /* ---- service worker + update notice ---- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        setInterval(function () { reg.update().catch(function () {}); }, 30 * 60 * 1000);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update().catch(function () {}); });
      }).catch(function (e) { console.warn('SW registration failed', e); });
    });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) return;
      onReady(function () {
        makeBar('mg-update-bar', t('update'), 'linear-gradient(135deg,#7c3aed,#4f46e5)', 'bottom', [
          { label: t('updateNow'), fn: function () { applyUpdate(); } }, { label: '✕', fn: function () { removeEl('mg-update-bar'); } }]);
      });
    });
  }

  /* ---- offline / online bar ---- */
  var offTimer;
  window.addEventListener('offline', function () {
    clearTimeout(offTimer);
    onReady(function () { makeBar('mg-offline-bar', t('offline'), '#b45309', 'top'); });
  });
  window.addEventListener('online', function () {
    clearTimeout(offTimer);
    onReady(function () { makeBar('mg-offline-bar', t('online'), '#15803d', 'top'); offTimer = setTimeout(function () { removeEl('mg-offline-bar'); }, 2500); });
  });
  onReady(function () { if (navigator.onLine === false) window.dispatchEvent(new Event('offline')); });

  /* ---- keep the screen awake while a task runs + count conversions + haptics ---- */
  var busyCount = 0, wake = null;
  function acquireWake() {
    if (!navigator.wakeLock || wake) return;
    navigator.wakeLock.request('screen').then(function (l) { wake = l; l.addEventListener('release', function () { wake = null; }); }).catch(function () {});
  }
  function releaseWake() { if (wake) { wake.release().catch(function () {}); wake = null; } }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && busyCount > 0) acquireWake(); });

  window.addEventListener('load', function () {
    var orig = window.mgBusy;
    if (typeof orig !== 'function') return;
    window.mgBusy = function () {
      var t0 = Date.now(), fired = false;
      busyCount++; acquireWake();
      if (standalone) { buzz(12); askNotif(); }
      var done = orig.apply(this, arguments);
      var wrapped = function () {
        var r = done.apply(this, arguments);
        if (!fired) {
          fired = true;
          busyCount = Math.max(0, busyCount - 1);
          if (!busyCount) releaseWake();
          lsSet('mg_conversions', String(Number(lsGet('mg_conversions') || 0) + 1));
          maybeShowInstall();
          if (standalone) { buzz([25, 40, 25]); if (document.hidden && Date.now() - t0 > 3000) notifyDone(); }
        }
        return r;
      };
      wrapped.update = done.update;
      return wrapped;
    };
  });

  /* ---- smart install button (after the first finished task) + install count ---- */
  var deferred = null, installBtn = null, DISMISS_KEY = 'mg_pwa_dismissed', WEEK = 7 * 24 * 3600 * 1000;
  function removeInstallBtn() { if (installBtn) { installBtn.remove(); installBtn = null; } }
  window.mgInstallApp = function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.finally(function () { deferred = null; removeInstallBtn(); });
  };
  function maybeShowInstall() {
    if (!deferred || installBtn || standalone || !document.body) return;
    if (Date.now() - Number(lsGet(DISMISS_KEY) || 0) < WEEK) return;
    installBtn = document.createElement('div');
    installBtn.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:100000;display:flex;align-items:center;gap:4px;' +
      'background:linear-gradient(135deg,#a855f7,#6366f1);color:#fff;border-radius:999px;padding:4px 6px 4px 4px;box-shadow:0 8px 24px rgba(124,58,237,.45);' + FONT;
    var go = document.createElement('button');
    go.textContent = t('install'); go.style.cssText = 'all:unset;cursor:pointer;padding:10px 14px;'; go.onclick = window.mgInstallApp;
    var x = document.createElement('button');
    x.textContent = '✕'; x.setAttribute('aria-label', t('close')); x.style.cssText = 'all:unset;cursor:pointer;padding:10px 12px;opacity:.8;';
    x.onclick = function () { lsSet(DISMISS_KEY, String(Date.now())); removeInstallBtn(); };
    installBtn.appendChild(go); installBtn.appendChild(x); document.body.appendChild(installBtn);
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; onReady(function () { setTimeout(maybeShowInstall, 2500); }); });
  window.addEventListener('appinstalled', function () {
    deferred = null; removeInstallBtn();
    if (lsGet('mg_install_counted') || !window.fetch) return;       // anonymous install counter: timestamp + platform only
    lsSet('mg_install_counted', '1');
    window.fetch('https://' + DB + '/installs.json', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t: { '.sv': 'timestamp' }, p: platformName() }), keepalive: true }).catch(function () {});
  });

  /* ---- iOS: one-time "Add to Home Screen" tip ---- */
  if (isIOS && !standalone && !lsGet('mg_ios_hint')) {
    onReady(function () {
      setTimeout(function () {
        makeBar('mg-ios-hint', t('iosTip'), 'linear-gradient(135deg,#7c3aed,#4f46e5)', 'bottom', [
          { label: t('gotIt'), fn: function () { lsSet('mg_ios_hint', '1'); removeEl('mg-ios-hint'); } }]);
      }, 4000);
    });
  }

  /* ---- downloads: remember them, offer Share, optionally save into a chosen folder ---- */
  var lastResult = null, folderHandle = null, folderReady = false, inFallback = false;
  function idb(mode, val) {
    return new Promise(function (res) {
      try {
        var rq = indexedDB.open('mgpro-pwa', 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('kv'); };
        rq.onerror = function () { res(null); };
        rq.onsuccess = function () {
          var tx = rq.result.transaction('kv', mode === 'get' ? 'readonly' : 'readwrite'), os = tx.objectStore('kv');
          var r = mode === 'get' ? os.get('folder') : (mode === 'set' ? os.put(val, 'folder') : os.delete('folder'));
          r.onsuccess = function () { res(r.result || null); }; r.onerror = function () { res(null); };
        };
      } catch (e) { res(null); }
    });
  }
  function recents() { try { return JSON.parse(lsGet('mg_recent') || '[]'); } catch (e) { return []; } }
  function record(name, blob) {
    lastResult = { name: name, blob: blob };
    var r = recents(); r.unshift({ n: name, s: blob.size, t: Date.now() }); lsSet('mg_recent', JSON.stringify(r.slice(0, 12)));
  }
  function canShareFile(f) { try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [f] })); } catch (e) { return false; } }
  function shareLast() {
    if (!lastResult) return;
    var f = new File([lastResult.blob], lastResult.name, { type: lastResult.blob.type || 'application/octet-stream' });
    if (canShareFile(f)) navigator.share({ files: [f], title: lastResult.name }).catch(function () {});
  }
  function offerShare() {
    if (!lastResult) return;
    var f = new File([lastResult.blob], lastResult.name, { type: lastResult.blob.type || 'application/octet-stream' });
    if (!canShareFile(f)) return;
    makeBar('mg-share-bar', '✓ ' + lastResult.name + ' ' + t('saved'), '#15803d', 'bottom', [
      { label: t('shareBtn'), fn: function () { removeEl('mg-share-bar'); shareLast(); } }, { label: '✕', fn: function () { removeEl('mg-share-bar'); } }]);
    setTimeout(function () { removeEl('mg-share-bar'); }, 10000);
  }
  function writeToFolder(name, blob) {
    return (async function () {
      try {
        var dot = name.lastIndexOf('.'), base = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '', n = name, i = 0;
        while (i < 50) {
          try { await folderHandle.getFileHandle(n); i++; n = base + ' (' + i + ')' + ext; } catch (e) { break; }
        }
        var fh = await folderHandle.getFileHandle(n, { create: true }), w = await fh.createWritable();
        await w.write(blob); await w.close(); return true;
      } catch (e) { return false; }
    })();
  }
  var isBlobDownload = function (a) { return a && a.hasAttribute && a.hasAttribute('download') && /^blob:/.test(a.href); };
  var batch = { on: lsGet('mg_batch') === '1', files: [] };
  function plainDownload(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.style.display = 'none'; document.body.appendChild(a);
    inFallback = true; HTMLAnchorElement.prototype.click === origClick ? origClick.call(a) : a.click(); inFallback = false;
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
  }
  function uniqueName(name, taken) {
    var dot = name.lastIndexOf('.'), base = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '', n = name, i = 0;
    while (taken.indexOf(n) > -1) { i++; n = base + ' (' + i + ')' + ext; } return n;
  }
  function batchBar() {
    if (!batch.files.length) { removeEl('mg-batch-bar'); return; }
    makeBar('mg-batch-bar', '📦 ' + batch.files.length + ' ' + t('batchBar'), 'linear-gradient(135deg,#7c3aed,#4f46e5)', 'bottom', [
      { label: t('batchGet'), fn: function () {
          var z = new window.JSZip(); batch.files.forEach(function (f) { z.file(f.name, f.blob); });
          z.generateAsync({ type: 'blob' }).then(function (b) { plainDownload(b, 'mediagrabber-batch.zip'); batch.files = []; batchBar(); }); } },
      { label: t('batchClear'), fn: function () { batch.files = []; batchBar(); } }]);
  }
  window.mgBatchCount = function () { return batch.files.length; };
  function handleDownload(a, replay) {
    var name = a.getAttribute('download') || 'download';
    var useBatch = batch.on && typeof window.JSZip !== 'undefined' && !/\.zip$/i.test(name);
    var take = useBatch || !!(folderHandle && folderReady);
    fetch(a.href).then(function (r) { return r.blob(); }).then(function (blob) {
      record(name, blob);
      if (useBatch) { batch.files.push({ name: uniqueName(name, batch.files.map(function (f) { return f.name; })), blob: blob }); batchBar(); return; }
      if (take) return writeToFolder(name, blob).then(function (ok) { if (ok) toast(t('savedToFolder')); else replay(); });
      offerShare();
    }).catch(function () { if (take) replay(); });
    return take;                                   // true -> we handle saving, skip the normal download
  }
  /* One-time cleanup: earlier builds kept private copies of results in the browser's private file area.
     That feature has been removed, so wipe anything it left behind. */
  try {
    if (navigator.storage && navigator.storage.getDirectory) {
      navigator.storage.getDirectory().then(function (r) { return r.removeEntry('results', { recursive: true }); }).catch(function () {});
    }
  } catch (e) {}
  window.__mg = { last: function () { return lastResult; }, batch: batch };
  if (typeof HTMLAnchorElement !== 'undefined') {
    var origClick = HTMLAnchorElement.prototype.click, origDispatch = EventTarget.prototype.dispatchEvent;
    HTMLAnchorElement.prototype.click = function () {
      var a = this;
      if (!inFallback && isBlobDownload(a) && handleDownload(a, function () { inFallback = true; origClick.call(a); inFallback = false; })) return;
      return origClick.call(a);
    };
    EventTarget.prototype.dispatchEvent = function (ev) {
      var a = this;
      if (!inFallback && ev && ev.type === 'click' && a instanceof HTMLAnchorElement && isBlobDownload(a) &&
          handleDownload(a, function () { inFallback = true; origDispatch.call(a, ev); inFallback = false; })) return true;
      return origDispatch.call(a, ev);
    };
  }
  if (window.showDirectoryPicker) {
    idb('get').then(function (h) {
      if (!h) return;
      folderHandle = h;
      if (h.queryPermission) h.queryPermission({ mode: 'readwrite' }).then(function (p) { folderReady = p === 'granted'; }).catch(function () {});
    });
  }

  /* ---- incoming files: Share target, Open with, paste, drag & drop ---- */
  var isHeic = function (f) { return /image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name); };
  var isPdf = function (f) { return f.type === 'application/pdf' || /\.pdf$/i.test(f.name); };
  var isImg = function (f) { return /^image\//i.test(f.type) && !isHeic(f); };
  var TOOLS = [
    { id: 'converter', name: 'Image Converter',     input: 'imgInput',      multi: true,  test: isImg },
    { id: 'pdf',       name: 'Image to PDF',        input: 'pdfImgs',       multi: true,  test: isImg },
    { id: 'heic2jpg',  name: 'HEIC to JPG',         input: 'heicInput',     multi: true,  test: isHeic },
    { id: 'pdfmerge',  name: 'Merge PDF',           input: 'pdfMergeInput', multi: true,  test: isPdf },
    { id: 'ocr',       name: 'Smart OCR',           input: 'ocrInput',      multi: false, test: function (f) { return isImg(f) || isPdf(f); } },
    { id: 'unlocker',  name: 'Remove PDF Password', input: 'unlockInput',   multi: false, test: isPdf },
    { id: 'compress',  name: 'Compress to Size',    input: 'cmpInput',      multi: true,  test: isImg },
    { id: 'photoprep', name: 'Photo & Signature Size', input: 'ppInput',    multi: false, test: isImg },
    { id: 'scanner',   name: 'Document Scanner',    input: 'scInput',       multi: true,  test: isImg },
    { id: 'pagetools', name: 'PDF Page Tools',      input: 'ptInput',       multi: false, test: isPdf },
    { id: 'signpdf',   name: 'Sign PDF',            input: 'sgInput',       multi: false, test: isPdf },
    { id: 'exif',      name: 'Remove Photo Location', input: 'exInput',     multi: true,  test: isImg },
    { id: 'qrscan',    name: 'QR Code Scanner',     input: 'qsInput',       multi: false, test: isImg }
  ];
  function scrollToTool(id) { var s = document.getElementById(id); if (s && s.scrollIntoView) s.scrollIntoView({ block: 'start' }); }
  function applyTool(tool, files) {
    var input = document.getElementById(tool.input);
    if (!input || typeof DataTransfer === 'undefined') return;
    var list = files.filter(tool.test); if (!tool.multi) list = list.slice(0, 1);
    var dt = new DataTransfer(); list.forEach(function (f) { dt.items.add(f); });
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    scrollToTool(tool.id);
  }
  function sheet(id) {
    removeEl(id);
    var ov = document.createElement('div'); ov.id = id;
    ov.style.cssText = 'position:fixed;inset:0;z-index:100003;background:rgba(0,0,0,.65);display:flex;align-items:flex-end;justify-content:center;padding:16px;' + FONT;
    var box = document.createElement('div');
    box.style.cssText = 'width:100%;max-width:440px;max-height:85vh;overflow:auto;background:#0c1326;color:#e5e7eb;border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:20px;' +
      'padding-bottom:calc(20px + env(safe-area-inset-bottom,0px));box-shadow:0 20px 50px rgba(0,0,0,.6);';
    ov.appendChild(box);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    return { ov: ov, box: box };
  }
  function line(box, text, css) { var d = document.createElement('div'); d.style.cssText = css || ''; d.textContent = text; box.appendChild(d); return d; }
  function sbtn(box, label, fn, ghost) {
    var b = document.createElement('button'); b.textContent = label;
    b.style.cssText = 'all:unset;box-sizing:border-box;display:block;width:100%;cursor:pointer;text-align:center;padding:13px;margin-bottom:8px;border-radius:14px;' +
      (ghost ? 'color:#9ca3af;background:rgba(255,255,255,.06);' : 'color:#fff;background:linear-gradient(135deg,#a855f7,#6366f1);') + FONT;
    b.onclick = fn; box.appendChild(b); return b;
  }
  function offerFiles(files) {
    if (!files || !files.length) return;
    var options = TOOLS.filter(function (tl) { return document.getElementById(tl.input) && files.some(tl.test); });
    var s = sheet('mg-share-modal');
    line(s.box, files.length + ' ' + t('filesReceived'), 'font-size:16px;font-weight:700;margin-bottom:4px;');
    line(s.box, options.length ? t('chooseTool') : t('unsupported'), 'font-size:13px;color:#9ca3af;margin-bottom:14px;font-weight:400;');
    options.forEach(function (tl) { sbtn(s.box, tl.name, function () { s.ov.remove(); applyTool(tl, files); }); });
    sbtn(s.box, t('cancel'), function () { s.ov.remove(); }, true);
  }
  window.mgOfferFiles = offerFiles;

  async function readShared() {
    if (!('caches' in window)) return [];
    var cache = await caches.open('mgpro-share'), keys = await cache.keys(), files = [];
    for (var i = 0; i < keys.length; i++) {
      var r = await cache.match(keys[i]); if (!r) continue;
      var blob = await r.blob();
      files.push(new File([blob], decodeURIComponent(r.headers.get('X-Name') || 'file'), { type: blob.type || r.headers.get('Content-Type') || '' }));
    }
    await Promise.all(keys.map(function (k) { return cache.delete(k); }));
    return files;
  }
  if (/[?&]shared=/.test(location.search)) {
    window.addEventListener('load', function () {
      setTimeout(function () {
        readShared().then(offerFiles).catch(function () {});
        try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
      }, 400);
    });
  }
  if ('launchQueue' in window && window.launchQueue && window.launchQueue.setConsumer) {
    window.launchQueue.setConsumer(function (params) {
      if (!params || !params.files || !params.files.length) return;
      Promise.all(params.files.map(function (h) { return h.getFile(); })).then(function (files) {
        if (document.readyState === 'complete') setTimeout(function () { offerFiles(files); }, 400);
        else window.addEventListener('load', function () { setTimeout(function () { offerFiles(files); }, 400); });
      });
    });
  }

  function pasteFromClipboard() {
    if (!navigator.clipboard || !navigator.clipboard.read) { toast(t('pasteNone')); return; }
    navigator.clipboard.read().then(async function (items) {
      var files = [];
      for (var i = 0; i < items.length; i++) for (var j = 0; j < items[i].types.length; j++) {
        var type = items[i].types[j];
        if (/^image\//.test(type)) { var b = await items[i].getType(type); files.push(new File([b], 'pasted-' + Date.now() + '.' + (type.split('/')[1] || 'png'), { type: type })); }
      }
      if (files.length) offerFiles(files); else toast(t('pasteNone'));
    }).catch(function () { toast(t('pasteNone')); });
  }
  document.addEventListener('paste', function (e) {
    if (!hasTools() || isEditable(e.target) || !e.clipboardData || !e.clipboardData.files || !e.clipboardData.files.length) return;
    e.preventDefault(); offerFiles(Array.prototype.slice.call(e.clipboardData.files));
  });

  var dragDepth = 0;
  var hasFiles = function (e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') > -1; };
  window.addEventListener('dragenter', function (e) {
    if (!hasTools() || !hasFiles(e)) return;
    if (++dragDepth === 1) {
      var d = document.createElement('div'); d.id = 'mg-drop-hint';
      d.style.cssText = 'position:fixed;inset:0;z-index:100004;pointer-events:none;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,.25);' +
        'border:3px dashed #a855f7;color:#fff;font:700 20px Poppins,system-ui,sans-serif;text-shadow:0 2px 10px #000;';
      d.textContent = '⬇ ' + t('dropHint'); document.body.appendChild(d);
    }
  });
  window.addEventListener('dragleave', function (e) { if (hasTools() && hasFiles(e) && --dragDepth <= 0) { dragDepth = 0; removeEl('mg-drop-hint'); } });
  window.addEventListener('dragover', function (e) { if (hasTools() && hasFiles(e) && !(e.target.closest && e.target.closest('input[type=file]'))) e.preventDefault(); });
  window.addEventListener('drop', function (e) {
    dragDepth = 0; removeEl('mg-drop-hint');
    if (!hasTools() || !hasFiles(e) || e.defaultPrevented || (e.target.closest && e.target.closest('input[type=file]'))) return;
    e.preventDefault(); offerFiles(Array.prototype.slice.call(e.dataTransfer.files));
  });

  /* ---- quick menu (⚡): paste, recent files, share result, save folder, storage ---- */
  function timeAgo(ts) { try { return new Date(ts).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return ''; } }
  function sect(box, text) { line(box, text, 'font-size:13px;color:#a855f7;margin:16px 0 6px;'); }
  function toggleBtn(box, isOn, onLabel, offLabel, fn) {
    var b = sbtn(box, isOn ? onLabel : offLabel, function () { fn(); }, !isOn); return b;
  }
  function openMenu() {
    var s = sheet('mg-menu'), box = s.box, reopen = function () { s.ov.remove(); openMenu(); };
    line(box, '⚡ ' + t('menu'), 'font-size:16px;font-weight:700;margin-bottom:12px;');
    sbtn(box, t('paste'), function () { s.ov.remove(); pasteFromClipboard(); });
    if (!standalone) sbtn(box, '📲 ' + t('installApp'), function () { s.ov.remove(); if (deferred) window.mgInstallApp(); else toast(isIOS ? t('installHow').replace('Install app', 'Share → Add to Home Screen') : t('installHow')); });
    if (lastResult && canShareFile(new File([lastResult.blob], lastResult.name))) sbtn(box, t('shareLast') + ' (' + lastResult.name + ')', function () { s.ov.remove(); shareLast(); });
    if (typeof window.JSZip !== 'undefined') toggleBtn(box, batch.on, t('batchOff'), t('batchOn'), function () { batch.on = !batch.on; lsSet('mg_batch', batch.on ? '1' : '0'); reopen(); });

    sect(box, t('recent'));
    var listBox = document.createElement('div'); box.appendChild(listBox);
    var rc = recents();
    if (!rc.length) line(listBox, t('noRecent'), 'font-size:13px;color:#9ca3af;font-weight:400;');
    rc.slice(0, 8).forEach(function (r, idx) {
      var row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.06);';
      var tx = document.createElement('span'); tx.style.cssText = 'flex:1;font-size:12px;color:#cbd5e1;word-break:break-all;'; tx.textContent = r.n + ' · ' + fmtSize(r.s) + ' · ' + timeAgo(r.t);
      var x = document.createElement('button'); x.textContent = '✕'; x.setAttribute('aria-label', 'Delete'); x.style.cssText = 'all:unset;cursor:pointer;padding:8px 10px;color:#f87171;font-size:14px;';
      x.onclick = function () { var l = recents(); l.splice(idx, 1); lsSet('mg_recent', JSON.stringify(l)); reopen(); };
      row.appendChild(tx); row.appendChild(x); listBox.appendChild(row);
    });
    if (rc.length) sbtn(box, '🗑 ' + t('clearRecent'), function () { lsSet('mg_recent', '[]'); reopen(); }, true);

    if (window.showDirectoryPicker) {
      sect(box, t('saveFolder'));
      if (folderHandle) {
        line(box, t('folderUse') + folderHandle.name, 'font-size:13px;color:#cbd5e1;font-weight:400;margin-bottom:8px;');
        if (!folderReady) sbtn(box, t('folderAllow'), function () { folderHandle.requestPermission({ mode: 'readwrite' }).then(function (p) { folderReady = p === 'granted'; s.ov.remove(); }).catch(function () {}); });
        sbtn(box, t('folderOff'), function () { folderHandle = null; folderReady = false; idb('del'); s.ov.remove(); }, true);
      } else {
        sbtn(box, t('folderNone'), function () {
          window.showDirectoryPicker({ mode: 'readwrite', id: 'mgpro' }).then(function (h) { folderHandle = h; folderReady = true; idb('set', h); s.ov.remove(); }).catch(function () {});
        }, true);
      }
    }

    sect(box, t('storage'));
    var info = line(box, '…', 'font-size:13px;color:#cbd5e1;font-weight:400;margin-bottom:8px;');
    var refresh = function () {
      var parts = [];
      (navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve({})).then(function (e) {
        if (e && e.usage != null) parts.push(t('storageUsing') + ' ' + fmtSize(e.usage));
        return window.caches ? caches.match(new URL('index.html', document.baseURI).href) : null;
      }).then(function (hit) { parts.push(hit ? t('offlineReady') : t('offlineNot')); info.textContent = parts.join(' · '); }).catch(function () { info.textContent = ''; });
    };
    refresh();
    sbtn(box, t('clearCache'), function () {
      if (!window.caches) return;
      caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('mgpro-runtime') === 0; }).map(function (k) { return caches.delete(k); })); }).then(function () { toast(t('cleared')); refresh(); });
    }, true);

    sbtn(box, t('close'), function () { s.ov.remove(); }, true);
  }
  window.mgOpenMenu = openMenu;
  onReady(function () {
    if (!hasTools()) return;
    var fab = document.createElement('button');
    fab.id = 'mg-fab'; fab.textContent = '⚡'; fab.setAttribute('aria-label', t('menu')); fab.title = t('menu');
    fab.style.cssText = 'position:fixed;left:14px;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);z-index:99990;width:44px;height:44px;border-radius:50%;border:0;cursor:pointer;' +
      'font-size:20px;color:#fff;background:linear-gradient(135deg,#a855f7,#6366f1);box-shadow:0 8px 22px rgba(124,58,237,.45);';
    fab.onclick = openMenu; document.body.appendChild(fab);
  });

  /* ---- remember last tool, follow phone theme  (deep links are handled by mg-deeplink.js) ---- */
  onReady(function () {
    if (!hasTools()) return;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) lsSet('mg_last_tool', en.target.id); });
      }, { rootMargin: '-40% 0px -50% 0px' });
      SECTIONS.forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
    }
    if (!lsGet('mgp_theme') && window.matchMedia) {                 // no manual choice yet -> follow the phone
      var mq = window.matchMedia('(prefers-color-scheme: light)');
      var follow = function () {
        if (lsGet('mgp_theme') || typeof window.setTheme !== 'function') return;
        window.setTheme(mq.matches ? 'light' : 'dark');
        try { localStorage.removeItem('mgp_theme'); } catch (e) {}
      };
      follow();
      if (mq.addEventListener) mq.addEventListener('change', follow);
    }
  });

  /* =====================================================================
     ACCESSIBILITY: text size, high contrast, focus outlines, labels, shortcuts
     ===================================================================== */
  (function () {
    var st = document.createElement('style'); st.id = 'mg-a11y-extra';
    st.textContent =
      ':focus-visible { outline: 2px solid #a855f7; outline-offset: 2px; }\n' +
      '.mg-star { position:absolute; top:2px; right:4px; z-index:2; all:unset; cursor:pointer; padding:4px 6px; font-size:15px; line-height:1; opacity:.75; }\n' +
      '.mg-star:hover { opacity:1; } .tool-chip { position: relative; }';
    document.head.appendChild(st);
  })();
  try { localStorage.removeItem('mg_zoom'); localStorage.removeItem('mg_hc'); } catch (e) {}   // accessibility options were removed

  function accName(e) {
    var lab = e.id && document.querySelector('label[for="' + e.id + '"]'), wrap = e.closest && e.closest('label');
    return (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title') || (lab && lab.textContent.trim()) || (wrap && wrap.textContent.trim()) ||
            (/^(BUTTON|A)$/.test(e.tagName) ? e.textContent.trim() : '') || e.getAttribute('placeholder') || '').trim();
  }
  function labelPass() {
    Array.prototype.forEach.call(document.querySelectorAll('input,select,textarea,button,a[href]'), function (e) {
      if (e.type === 'hidden' || accName(e)) return;
      var g = (e.id || e.name || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').trim();
      e.setAttribute('aria-label', g || (e.type === 'file' ? 'Choose file' : e.tagName.toLowerCase()));
    });
    Array.prototype.forEach.call(document.querySelectorAll('img:not([alt])'), function (i) { i.setAttribute('alt', ''); });
    Array.prototype.forEach.call(document.querySelectorAll('svg:not([aria-hidden]):not([role])'), function (v) { v.setAttribute('aria-hidden', 'true'); });
    ['ocrStatus', 'unlockStatus', 'cmpStatus', 'ppStatus', 'bgStatus', 'ocrTrStatus', 'sgCount'].forEach(function (id) {
      var e = document.getElementById(id); if (e && !e.getAttribute('aria-live')) { e.setAttribute('role', 'status'); e.setAttribute('aria-live', 'polite'); }
    });
  }
  onReady(function () {
    setTimeout(labelPass, 400);
    var tmr; if ('MutationObserver' in window) new MutationObserver(function () { clearTimeout(tmr); tmr = setTimeout(labelPass, 500); }).observe(document.body, { childList: true, subtree: true });
  });
  function allToolIds() { return SECTIONS.filter(function (id) { return id !== 'texttopdf' && document.getElementById(id); }); }
  function showShortcuts() {
    var s = sheet('mg-keys'), ids = allToolIds().slice(0, 9);
    line(s.box, t('shortcuts'), 'font-size:16px;font-weight:700;margin-bottom:10px;');
    [['Alt + M', t('menu')], ['?', t('shortcuts')], ['Esc', t('close')]].concat(ids.map(function (id, i) {
      var h = document.getElementById(id), nm = h ? h.textContent.replace(/BETA/, '').trim() : id; return ['Alt + ' + (i + 1), nm];
    })).forEach(function (r) { line(s.box, r[0] + '   —   ' + r[1], 'font-size:13px;font-weight:400;color:#cbd5e1;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06);'); });
    sbtn(s.box, t('close'), function () { s.ov.remove(); }, true);
  }
  document.addEventListener('keydown', function (e) {
    if (!hasTools()) return;
    if (e.key === 'Escape') { ['mg-menu', 'mg-keys', 'mg-share-modal', 'mg-tour'].forEach(removeEl); return; }
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      if (/^[1-9]$/.test(e.key)) { var id = allToolIds()[Number(e.key) - 1]; if (id) { e.preventDefault(); scrollToTool(id); } }
      else if (e.key.toLowerCase() === 'm') { e.preventDefault(); openMenu(); }
    } else if (e.key === '?' && !isEditable(e.target)) showShortcuts();
  });

  /* =====================================================================
     FAVOURITES (★ on any tool chip; pinned row on top)
     ===================================================================== */
  function favs() { try { return JSON.parse(lsGet('mg_fav') || '[]'); } catch (e) { return []; } }
  function buildFavs() {
    var grid = document.getElementById('allToolsGrid'); if (!grid) return;
    var wrap = document.getElementById('mgFavWrap');
    if (!wrap) {
      wrap = document.createElement('div'); wrap.id = 'mgFavWrap'; wrap.style.cssText = 'margin-top:22px;text-align:left;';
      var lbl = document.createElement('p'); lbl.textContent = t('fav'); lbl.style.cssText = 'font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#8b7cb8;margin-bottom:8px;';
      var row = document.createElement('div'); row.id = 'mgFavRow'; row.style.cssText = 'display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;';
      wrap.appendChild(lbl); wrap.appendChild(row); grid.parentNode.insertBefore(wrap, grid);
    }
    var list = favs(), row2 = document.getElementById('mgFavRow'); row2.innerHTML = '';
    wrap.style.display = list.length ? 'block' : 'none';
    list.forEach(function (href) {
      var chip = grid.querySelector('.tool-chip[href="' + href + '"]'); if (!chip) return;
      var c = chip.cloneNode(true); var st = c.querySelector('.mg-star'); if (st) st.remove(); c.style.flex = '0 0 auto'; row2.appendChild(c);
    });
    Array.prototype.forEach.call(grid.querySelectorAll('.tool-chip'), function (chip) {
      var href = chip.getAttribute('href'), on = list.indexOf(href) > -1, star = chip.querySelector('.mg-star');
      if (!star) {
        star = document.createElement('button'); star.type = 'button'; star.className = 'mg-star'; chip.appendChild(star);
        star.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation(); var l = favs(), i = l.indexOf(href);
          if (i > -1) l.splice(i, 1); else l.push(href); lsSet('mg_fav', JSON.stringify(l)); buildFavs();
        });
      }
      star.textContent = on ? '★' : '☆'; star.setAttribute('aria-label', (on ? 'Remove from favourites: ' : 'Add to favourites: ') + (chip.textContent || '').replace(/[★☆]/g, '').trim()); star.style.color = on ? '#fbbf24' : 'inherit';
    });
  }
  onReady(function () { if (hasTools()) buildFavs(); });
  document.addEventListener('mgtools-ready', function () { if (hasTools()) buildFavs(); });

  /* =====================================================================
     FIRST-RUN TOUR (once, only for brand-new visitors)
     ===================================================================== */
  window.addEventListener('load', function () {
    if (!hasTools() || lsGet('mg_tour_done') || lsGet('mg_feedback_done') === 'true' || lsGet('mgp_recent_tools') || location.hash || /[?&](shared|tool)=/.test(location.search)) return;
    setTimeout(function () {
      var steps = [['🔒 Private by design', 'Your files are processed on your device. They are not uploaded.'],
                   ['📥 Easy to start', 'Drop files anywhere, paste an image with Ctrl+V, or use "Share → MG Pro" from your gallery.'],
                   ['📲 Works offline', 'Install the app (browser menu → Install, or Add to Home Screen) and your tools work without internet.']], i = 0;
      var s = sheet('mg-tour'), body = document.createElement('div'); s.box.appendChild(body);
      function paint() {
        body.innerHTML = ''; line(body, steps[i][0], 'font-size:18px;font-weight:700;margin-bottom:8px;'); line(body, steps[i][1], 'font-size:14px;font-weight:400;color:#cbd5e1;margin-bottom:16px;line-height:1.5;');
        line(body, (i + 1) + ' / ' + steps.length, 'font-size:12px;color:#9ca3af;text-align:center;margin-bottom:10px;');
        sbtn(body, i === steps.length - 1 ? t('gotIt') : 'Next', function () { if (i === steps.length - 1) { lsSet('mg_tour_done', '1'); s.ov.remove(); } else { i++; paint(); } });
        if (i < steps.length - 1) sbtn(body, 'Skip', function () { lsSet('mg_tour_done', '1'); s.ov.remove(); }, true);
      }
      paint(); lsSet('mg_tour_done', '1');
    }, 1800);
  });

  /* =====================================================================
     RATING PROMPT (soft: after 3 finished tasks, instead of an instant redirect)
     ===================================================================== */
  window.mgAskRating = function () {
    if (lsGet('mg_feedback_done') === 'true') return;
    var n = Number(lsGet('mg_uses') || 0) + 1; lsSet('mg_uses', String(n));
    if (n < 3 || Date.now() < Number(lsGet('mg_rate_snooze') || 0) || Number(lsGet('mg_rate_later') || 0) >= 3) return;
    onReady(function () {
      makeBar('mg-rate-bar', t('rateQ'), 'linear-gradient(135deg,#7c3aed,#4f46e5)', 'bottom', [
        { label: t('rate'), fn: function () { removeEl('mg-rate-bar'); location.href = 'index (2).html'; } },
        { label: t('later'), fn: function () { removeEl('mg-rate-bar'); lsSet('mg_rate_snooze', String(Date.now() + 7 * 24 * 3600 * 1000)); lsSet('mg_rate_later', String(Number(lsGet('mg_rate_later') || 0) + 1)); } }]);
    });
  };
})();
