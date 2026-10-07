/* MediaGrabber Pro – PWA bootstrap
   A) PWA-ONLY (installed app, normal website untouched): lighter animations, no zoom, no text selection,
      no overscroll bounce, theme-colour follows dark/light, haptics, "file ready" notification + badge.
   B) ALL VISITORS: service worker + update notice, offline status, install button, iOS install tip,
      "Share to MG Pro" and "Open with MG Pro" file intake.                                          */
(function () {
  'use strict';

  var root = document.documentElement;
  var standalone = window.matchMedia('(display-mode: standalone)').matches ||
                   window.matchMedia('(display-mode: fullscreen)').matches ||
                   window.matchMedia('(display-mode: minimal-ui)').matches ||
                   window.navigator.standalone === true;
  var hadController = !!(navigator.serviceWorker && navigator.serviceWorker.controller);

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn();
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* =====================================================================
     A) PWA-ONLY
     ===================================================================== */
  if (standalone) {
    root.classList.add('is-pwa');

    // --- viewport: no zoom ---
    var vp = document.querySelector('meta[name="viewport"]');
    if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
    vp.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

    // Decorative infinite animations run once; loaders/spinners are kept
    var KEEP = ['.loader', '.loader-dot', '.loader-dot-shadow', '.trail-dot', '.mg-spin', '.vl-spinner'];
    var notKeep = KEEP.map(function (k) { return ':not(' + k + ')'; }).join('') + ':not(.vl-spinner *)';
    var css = [
      'html.is-pwa, html.is-pwa body { touch-action: pan-x pan-y; -webkit-text-size-adjust: 100%; overscroll-behavior: none; }',
      'html.is-pwa, html.is-pwa * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }',
      'html.is-pwa input, html.is-pwa textarea, html.is-pwa [contenteditable="true"], html.is-pwa .allow-select, html.is-pwa .allow-select * { -webkit-user-select: text; user-select: text; -webkit-touch-callout: default; }',
      'html.is-pwa img, html.is-pwa a { -webkit-user-drag: none; user-drag: none; }',
      'html.is-pwa *, html.is-pwa *::before, html.is-pwa *::after { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }',
      'html.is-pwa *' + notKeep + ', html.is-pwa *' + notKeep + '::before, html.is-pwa *' + notKeep + '::after { animation-iteration-count: 1 !important; }',
      'html.is-pwa #three-canvas { display: none !important; }'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'pwa-only-styles'; st.textContent = css;
    document.head.appendChild(st);

    // --- zoom / select / context-menu blockers (iOS + desktop PWA) ---
    var opt = { passive: false };
    var isEditable = function (t) { return t && t.closest && t.closest('input, textarea, [contenteditable="true"], .allow-select'); };
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) {
      document.addEventListener(n, function (e) { e.preventDefault(); }, opt);
    });
    document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) e.preventDefault(); }, opt);
    var lastTap = 0;
    document.addEventListener('touchend', function (e) {
      var now = Date.now();
      if (now - lastTap < 300 && !isEditable(e.target)) e.preventDefault();
      lastTap = now;
    }, opt);
    window.addEventListener('wheel', function (e) { if (e.ctrlKey) e.preventDefault(); }, opt);
    window.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].indexOf(e.key) > -1) e.preventDefault();
    });
    document.addEventListener('contextmenu', function (e) { if (!isEditable(e.target)) e.preventDefault(); });
    document.addEventListener('selectstart', function (e) { if (!isEditable(e.target)) e.preventDefault(); });
    document.addEventListener('dragstart', function (e) { if (e.target && e.target.tagName === 'IMG') e.preventDefault(); });

    // --- keep browser from evicting cached tools / OCR data ---
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});

    // --- status-bar / title-bar colour follows the in-app theme ---
    onReady(function () {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
      var apply = function () {
        var c = document.body.classList;
        meta.content = c.contains('light-mode') ? '#ffffff' : (c.contains('black-mode') ? '#000000' : '#05070f');
      };
      apply();
      new MutationObserver(apply).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    });

    // --- haptics + "file ready" notification/badge (hooks the site's mgBusy helper) ---
    var buzz = function (p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };
    var notifyDone = function () {
      if (navigator.setAppBadge) navigator.setAppBadge(1).catch(function () {});
      if (!('Notification' in window) || Notification.permission !== 'granted' || !navigator.serviceWorker) return;
      navigator.serviceWorker.ready.then(function (reg) {
        reg.showNotification('MediaGrabber Pro', {
          body: 'Your file is ready. Tap to open.', icon: 'android-chrome-192x192.png',
          badge: 'favicon-48x48.png', tag: 'mg-done'
        });
      }).catch(function () {});
    };
    var clearBadge = function () { if (!document.hidden && navigator.clearAppBadge) navigator.clearAppBadge().catch(function () {}); };
    document.addEventListener('visibilitychange', clearBadge);
    window.addEventListener('focus', clearBadge);

    window.addEventListener('load', function () {
      var orig = window.mgBusy;
      if (typeof orig !== 'function') return;
      window.mgBusy = function () {
        var t0 = Date.now();
        buzz(12);
        if ('Notification' in window && Notification.permission === 'default' && !lsGet('mg_notif_asked')) {
          lsSet('mg_notif_asked', '1');
          try { Notification.requestPermission(); } catch (e) {}
        }
        var done = orig.apply(this, arguments), fired = false;
        var wrapped = function () {
          var r = done.apply(this, arguments);
          if (!fired) {
            fired = true;
            buzz([25, 40, 25]);
            if (document.hidden && Date.now() - t0 > 3000) notifyDone();
          }
          return r;
        };
        wrapped.update = done.update;
        return wrapped;
      };
    });
  }

  /* =====================================================================
     B) ALL VISITORS
     ===================================================================== */
  var FONT = 'font:600 14px Poppins,Inter,system-ui,sans-serif;';

  function makeBar(id, text, color, pos, buttons) {
    var old = document.getElementById(id); if (old) old.remove();
    var b = document.createElement('div');
    b.id = id;
    b.style.cssText = 'position:fixed;left:12px;right:12px;margin:0 auto;max-width:520px;z-index:100002;display:flex;align-items:center;gap:8px;' +
      'padding:10px 14px;border-radius:14px;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.45);background:' + color + ';' + FONT +
      (pos === 'top' ? 'top:calc(env(safe-area-inset-top,0px) + 10px);' : 'bottom:calc(env(safe-area-inset-bottom,0px) + 14px);');
    var t = document.createElement('span'); t.style.cssText = 'flex:1;line-height:1.4'; t.textContent = text; b.appendChild(t);
    (buttons || []).forEach(function (bt) {
      var x = document.createElement('button');
      x.textContent = bt.label;
      x.style.cssText = 'all:unset;cursor:pointer;padding:6px 12px;border-radius:10px;background:rgba(255,255,255,.2);' + FONT;
      x.onclick = bt.fn; b.appendChild(x);
    });
    document.body.appendChild(b);
    return b;
  }

  /* ---------- service worker + update notice ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        setInterval(function () { reg.update().catch(function () {}); }, 30 * 60 * 1000);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update().catch(function () {}); });
      }).catch(function (e) { console.warn('SW registration failed', e); });
    });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) return;                     // first ever install – nothing to refresh
      onReady(function () {
        makeBar('mg-update-bar', '🔄 New version ready', 'linear-gradient(135deg,#7c3aed,#4f46e5)', 'bottom', [
          { label: 'Refresh', fn: function () { location.reload(); } },
          { label: '✕', fn: function () { var b = document.getElementById('mg-update-bar'); if (b) b.remove(); } }
        ]);
      });
    });
  }

  /* ---------- offline / online status ---------- */
  var offTimer;
  function hideOff() { var b = document.getElementById('mg-offline-bar'); if (b) b.remove(); }
  window.addEventListener('offline', function () {
    clearTimeout(offTimer);
    onReady(function () { makeBar('mg-offline-bar', "📡 You're offline — converters still work. Feedback & VIP need internet.", '#b45309', 'top'); });
  });
  window.addEventListener('online', function () {
    clearTimeout(offTimer);
    onReady(function () { makeBar('mg-offline-bar', '✓ Back online', '#15803d', 'top'); offTimer = setTimeout(hideOff, 2500); });
  });
  onReady(function () { if (navigator.onLine === false) window.dispatchEvent(new Event('offline')); });

  /* ---------- install button (Android / desktop Chrome) ---------- */
  var deferred = null, installBtn = null, DISMISS_KEY = 'mg_pwa_dismissed', WEEK = 7 * 24 * 3600 * 1000;
  function recentlyDismissed() { return Date.now() - Number(lsGet(DISMISS_KEY) || 0) < WEEK; }
  function removeInstallBtn() { if (installBtn) { installBtn.remove(); installBtn = null; } }
  window.mgInstallApp = function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.finally(function () { deferred = null; removeInstallBtn(); });
  };
  function showInstallBtn() {
    if (installBtn || standalone || recentlyDismissed()) return;
    installBtn = document.createElement('div');
    installBtn.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:100000;display:flex;align-items:center;gap:4px;' +
      'background:linear-gradient(135deg,#a855f7,#6366f1);color:#fff;border-radius:999px;padding:4px 6px 4px 4px;box-shadow:0 8px 24px rgba(124,58,237,.45);' + FONT;
    var go = document.createElement('button');
    go.textContent = '⬇ Install App'; go.style.cssText = 'all:unset;cursor:pointer;padding:10px 14px;'; go.onclick = window.mgInstallApp;
    var x = document.createElement('button');
    x.textContent = '✕'; x.setAttribute('aria-label', 'Dismiss'); x.style.cssText = 'all:unset;cursor:pointer;padding:10px 12px;opacity:.8;';
    x.onclick = function () { lsSet(DISMISS_KEY, String(Date.now())); removeInstallBtn(); };
    installBtn.appendChild(go); installBtn.appendChild(x);
    document.body.appendChild(installBtn);
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; onReady(showInstallBtn); });
  window.addEventListener('appinstalled', function () { deferred = null; removeInstallBtn(); });

  /* ---------- iOS: one-time "Add to Home Screen" tip ---------- */
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS && !standalone && !lsGet('mg_ios_hint')) {
    onReady(function () {
      setTimeout(function () {
        makeBar('mg-ios-hint', '📲 Install MG Pro: tap the Share button, then "Add to Home Screen".', 'linear-gradient(135deg,#7c3aed,#4f46e5)', 'bottom', [
          { label: 'Got it', fn: function () { lsSet('mg_ios_hint', '1'); var b = document.getElementById('mg-ios-hint'); if (b) b.remove(); } }
        ]);
      }, 4000);
    });
  }

  /* ---------- incoming files: Share target + "Open with" ---------- */
  var isHeic = function (f) { return /image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name); };
  var isPdf = function (f) { return f.type === 'application/pdf' || /\.pdf$/i.test(f.name); };
  var isImg = function (f) { return /^image\//i.test(f.type) && !isHeic(f); };
  var TOOLS = [
    { id: 'converter', name: 'Image Converter',     input: 'imgInput',      multi: true,  test: isImg },
    { id: 'pdf',       name: 'Image to PDF',        input: 'pdfImgs',       multi: true,  test: isImg },
    { id: 'heic2jpg',  name: 'HEIC to JPG',         input: 'heicInput',     multi: true,  test: isHeic },
    { id: 'pdfmerge',  name: 'Merge PDF',           input: 'pdfMergeInput', multi: true,  test: isPdf },
    { id: 'ocr',       name: 'Smart OCR',           input: 'ocrInput',      multi: false, test: function (f) { return isImg(f) || isPdf(f); } },
    { id: 'unlocker',  name: 'Remove PDF Password', input: 'unlockInput',   multi: false, test: isPdf }
  ];

  function applyTool(tool, files) {
    var input = document.getElementById(tool.input);
    if (!input || typeof DataTransfer === 'undefined') return;
    var list = files.filter(tool.test);
    if (!tool.multi) list = list.slice(0, 1);
    var dt = new DataTransfer();
    list.forEach(function (f) { dt.items.add(f); });
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    var sec = document.getElementById(tool.id);
    if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: 'start' });
  }

  function offerFiles(files) {
    if (!files || !files.length) return;
    var old = document.getElementById('mg-share-modal'); if (old) old.remove();
    var options = TOOLS.filter(function (t) { return document.getElementById(t.input) && files.some(t.test); });
    var ov = document.createElement('div');
    ov.id = 'mg-share-modal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100003;background:rgba(0,0,0,.65);display:flex;align-items:flex-end;justify-content:center;padding:16px;' + FONT;
    var box = document.createElement('div');
    box.style.cssText = 'width:100%;max-width:440px;background:#0c1326;color:#e5e7eb;border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:20px;' +
      'padding-bottom:calc(20px + env(safe-area-inset-bottom,0px));box-shadow:0 20px 50px rgba(0,0,0,.6);';
    var h = document.createElement('div');
    h.style.cssText = 'font-size:16px;font-weight:700;margin-bottom:4px;';
    h.textContent = files.length + ' file' + (files.length > 1 ? 's' : '') + ' received';
    var sub = document.createElement('div');
    sub.style.cssText = 'font-size:13px;color:#9ca3af;margin-bottom:14px;font-weight:400;';
    sub.textContent = options.length ? 'What would you like to do?' : 'These file types are not supported (use images or PDFs).';
    box.appendChild(h); box.appendChild(sub);
    options.forEach(function (t) {
      var b = document.createElement('button');
      b.textContent = t.name;
      b.style.cssText = 'all:unset;box-sizing:border-box;display:block;width:100%;cursor:pointer;text-align:center;padding:13px;margin-bottom:8px;border-radius:14px;color:#fff;' +
        'background:linear-gradient(135deg,#a855f7,#6366f1);' + FONT;
      b.onclick = function () { ov.remove(); applyTool(t, files); };
      box.appendChild(b);
    });
    var c = document.createElement('button');
    c.textContent = 'Cancel';
    c.style.cssText = 'all:unset;box-sizing:border-box;display:block;width:100%;cursor:pointer;text-align:center;padding:12px;border-radius:14px;color:#9ca3af;' + FONT;
    c.onclick = function () { ov.remove(); };
    box.appendChild(c); ov.appendChild(box);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  }
  window.mgOfferFiles = offerFiles;

  // Files shared from the phone's Share sheet (stored by the service worker)
  async function readShared() {
    if (!('caches' in window)) return [];
    var cache = await caches.open('mgpro-share');
    var keys = await cache.keys(), files = [];
    for (var i = 0; i < keys.length; i++) {
      var r = await cache.match(keys[i]);
      if (!r) continue;
      var blob = await r.blob();
      var name = decodeURIComponent(r.headers.get('X-Name') || 'file');
      files.push(new File([blob], name, { type: blob.type || r.headers.get('Content-Type') || '' }));
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

  // Files opened with "Open with MG Pro" (desktop Chrome / Edge)
  if ('launchQueue' in window && window.launchQueue && window.launchQueue.setConsumer) {
    window.launchQueue.setConsumer(function (params) {
      if (!params || !params.files || !params.files.length) return;
      Promise.all(params.files.map(function (h) { return h.getFile(); })).then(function (files) {
        window.addEventListener('load', function () { setTimeout(function () { offerFiles(files); }, 400); });
        if (document.readyState === 'complete') setTimeout(function () { offerFiles(files); }, 400);
      });
    });
  }
})();
