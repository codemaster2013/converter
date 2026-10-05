/* MediaGrabber Pro – PWA bootstrap: registers the service worker + optional "Install app" button */
(function () {
  'use strict';

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('SW registration failed', e); });
    });
  }

  var deferred = null, btn = null;
  var DISMISS_KEY = 'mg_pwa_dismissed', WEEK = 7 * 24 * 3600 * 1000;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function recentlyDismissed() {
    try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < WEEK; } catch (e) { return false; }
  }
  function removeBtn() { if (btn) { btn.remove(); btn = null; } }

  // Call window.mgInstallApp() from your own button if you prefer
  window.mgInstallApp = function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.finally(function () { deferred = null; removeBtn(); });
  };

  function showBtn() {
    if (btn || isStandalone() || recentlyDismissed()) return;
    btn = document.createElement('div');
    btn.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:100000;display:flex;align-items:center;gap:4px;' +
      'background:linear-gradient(135deg,#a855f7,#6366f1);color:#fff;border-radius:999px;padding:4px 6px 4px 4px;' +
      'box-shadow:0 8px 24px rgba(124,58,237,.45);font:600 14px Inter,Poppins,sans-serif';
    var go = document.createElement('button');
    go.textContent = '⬇ Install App';
    go.style.cssText = 'all:unset;cursor:pointer;padding:10px 14px;';
    go.onclick = window.mgInstallApp;
    var x = document.createElement('button');
    x.textContent = '✕';
    x.setAttribute('aria-label', 'Dismiss');
    x.style.cssText = 'all:unset;cursor:pointer;padding:10px 12px;opacity:.8;';
    x.onclick = function () { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {} removeBtn(); };
    btn.appendChild(go); btn.appendChild(x);
    document.body.appendChild(btn);
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (document.body) showBtn(); else document.addEventListener('DOMContentLoaded', showBtn);
  });
  window.addEventListener('appinstalled', function () { deferred = null; removeBtn(); });
})();
