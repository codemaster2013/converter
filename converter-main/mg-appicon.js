/* MediaGrabber Pro - app icon pack and picker. Choosing an icon and tapping Update refreshes the app and applies the chosen icon. */
(function (root) {
  'use strict';

  var KEY = 'mgp_appicon';
  var PACK = [['classic', 'Classic'], ['forest', 'Forest'], ['green', 'Green'], ['space', 'Space'], ['paper', 'Paper'], ['galaxy', 'Galaxy'], ['fire', 'Fire'], ['marble', 'Marble'],
              ['fur', 'Fur'], ['glow', 'Glow'], ['lilac', 'Lilac'], ['sky', 'Sky'], ['peach', 'Peach'], ['mint', 'Mint'], ['lime', 'Lime'], ['outline', 'Outline']];

  /* ---------------- pure logic (testable without a browser) ---------------- */
  function valid(id) { for (var i = 0; i < PACK.length; i++) if (PACK[i][0] === id) return true; return false; }
  function nameOf(id) { for (var i = 0; i < PACK.length; i++) if (PACK[i][0] === id) return PACK[i][1]; return ''; }
  /* which files the page should point at; null means "put the original ones back" */
  function plan(id) {
    if (!valid(id) || id === 'classic') return null;
    var d = 'appicon-' + id + '-';
    return { manifest: d + 'manifest.webmanifest', icon: d + 'favicon-32.png', apple: d + 'apple-touch-icon.png', image: d + 'icon-512.png', thumb: d + 'thumb.png' };
  }
  var API = { PACK: PACK, KEY: KEY, valid: valid, nameOf: nameOf, plan: plan };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  root.mgAppIcon = API;

  /* ---------------- applying an icon to the page ---------------- */
  var doc = root.document, originals = null, added = [];
  function get() { try { return root.localStorage.getItem(KEY); } catch (e) { return null; } }
  function put(v) { try { root.localStorage.setItem(KEY, v); } catch (e) {} }
  function all(sel) { return [].slice.call(doc.head.querySelectorAll(sel)); }
  function capture() {
    if (originals) return;
    var m = doc.head.querySelector('link[rel="manifest"]');
    originals = { manifestEl: m, manifestHref: m ? m.getAttribute('href') : null, icons: all('link[rel~="icon"]'), apple: all('link[rel="apple-touch-icon"]'), removed: false };
  }
  function addLink(rel, href, extra) {
    var l = doc.createElement('link'); l.setAttribute('rel', rel); l.setAttribute('href', href); l.setAttribute('data-mgap', '1');
    if (extra) for (var k in extra) l.setAttribute(k, extra[k]);
    doc.head.appendChild(l); added.push(l); return l;
  }
  function apply(id) {
    capture(); var p = plan(id);
    added.forEach(function (l) { if (l.remove) l.remove(); }); added = [];
    if (!p) {                                                              // back to the original icon
      if (originals.removed) { originals.icons.concat(originals.apple).forEach(function (l) { doc.head.appendChild(l); }); originals.removed = false; }
      if (originals.manifestEl && originals.manifestHref) originals.manifestEl.setAttribute('href', originals.manifestHref);
      return;
    }
    if (!originals.removed) { originals.icons.concat(originals.apple).forEach(function (l) { if (l.remove) l.remove(); }); originals.removed = true; }
    addLink('icon', p.icon, { type: 'image/png', sizes: '32x32' }); addLink('apple-touch-icon', p.apple, { sizes: '180x180' });
    if (originals.manifestEl) originals.manifestEl.setAttribute('href', p.manifest);
  }
  function choose(id) { if (!valid(id)) return; put(id); apply(id); root.__mgAppIconId = id; }
  function current() { var s = get(); return valid(s) ? s : 'classic'; }

  /* ---------------- the picker ---------------- */
  var CSS = '#mgap,#mgap *{-webkit-touch-callout:none}#mgap{position:fixed;inset:0;z-index:2147482000;background:rgba(5,7,15,.82);display:flex;align-items:flex-end;justify-content:center;font-family:Poppins,Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#f3f0ff}' +
    '#mgap .mgap-sheet{width:min(100%,520px);max-height:92vh;overflow:auto;background:#12131f;border:1px solid rgba(167,139,250,.4);border-radius:22px 22px 0 0;padding:18px 18px max(18px,env(safe-area-inset-bottom));box-sizing:border-box}' +
    '@media (min-width:560px){#mgap{align-items:center}#mgap .mgap-sheet{border-radius:22px}}' +
    '#mgap h2{margin:0 0 4px;font-size:20px}#mgap .mgap-sub{margin:0 0 14px;color:#b9b2d8;font-size:13px;line-height:1.45}' +
    '#mgap .mgap-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}' +
    '#mgap .mgap-it{all:unset;box-sizing:border-box;cursor:pointer;position:relative;display:block;aspect-ratio:1;border-radius:50%;padding:0;-webkit-tap-highlight-color:transparent}' +
    '#mgap .mgap-it img{pointer-events:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;-webkit-user-drag:none;display:block;width:100%;height:100%;border-radius:50%;box-shadow:0 0 0 1px rgba(255,255,255,.16)}' +
    '#mgap .mgap-it[aria-pressed="true"]{box-shadow:0 0 0 3px #12131f,0 0 0 6px #a78bfa;border-radius:50%}' +
    '#mgap .mgap-it .mgap-ck{display:none;position:absolute;right:-2px;bottom:-2px;width:24px;height:24px;border-radius:50%;background:#7c3aed;border:2px solid #12131f;align-items:center;justify-content:center}' +
    '#mgap .mgap-it[aria-pressed="true"] .mgap-ck{display:flex}#mgap :focus-visible{outline:3px solid #fff;outline-offset:3px}' +
    '#mgap .mgap-note{margin:0 0 14px;color:#cfc8ee;font-size:13px;line-height:1.5}#mgap .mgap-note:empty{display:none}#mgap .mgap-name{margin:14px 0 14px;font-weight:700;font-size:15px}' +
    '#mgap .mgap-row{display:flex;flex-direction:column;gap:8px}' +
    '#mgap .mgap-btn{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;padding:13px 16px;border-radius:14px;font-weight:700;font-size:15px;border:1px solid rgba(167,139,250,.5);background:rgba(139,92,246,.14);color:#fff}' +
    '#mgap .mgap-pri{background:linear-gradient(135deg,#8b5cf6,#6366f1);border-color:transparent}#mgap .mgap-btn[disabled]{opacity:.45;pointer-events:none}';

  var CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

  /* choose the icon, re-fetch its files and update the service worker, so the app really refreshes */
  function refresh(id) {
    choose(id);
    var p = plan(id), d = p ? null : 'appicon-classic-';
    var urls = p ? [p.manifest, p.icon, p.apple, p.image, p.thumb] : ['site.webmanifest', d + 'favicon-32.png', d + 'apple-touch-icon.png', d + 'icon-512.png', d + 'thumb.png'];
    var jobs = urls.map(function (u) { return root.fetch(u, { cache: 'reload' }).catch(function () {}); });
    var sw = root.navigator.serviceWorker;
    if (sw && sw.getRegistration) jobs.push(sw.getRegistration().then(function (reg) {
      if (!reg) return;
      return reg.update().catch(function () {}).then(function () { if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING'); });
    }).catch(function () {}));
    var done = Promise.all(jobs).catch(function () {});
    var cap = new Promise(function (r) { root.setTimeout(r, 6000); });
    return Promise.race([done, cap]);
  }

  function open() {
    if (doc.getElementById('mgap')) return;
    var sel = current(), style = doc.createElement('style'); style.textContent = CSS; doc.head.appendChild(style);
    var ov = doc.createElement('div'); ov.id = 'mgap'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'App icon');
    var items = '';
    for (var i = 0; i < PACK.length; i++) {
      var id = PACK[i][0], thumb = id === 'classic' ? 'appicon-classic-thumb.png' : plan(id).thumb;
      items += '<button type="button" class="mgap-it" data-id="' + id + '" aria-label="' + PACK[i][1] + '" aria-pressed="' + (id === sel) + '"><img src="' + thumb + '" alt="" width="96" height="96" draggable="false" loading="lazy"><span class="mgap-ck">' + CHECK + '</span></button>';
    }
    ov.innerHTML = '<div class="mgap-sheet"><h2>App icon</h2><p class="mgap-sub">Pick the look you like best.</p><div class="mgap-grid">' + items + '</div>' +
      '<p class="mgap-name" id="mgap-name"></p><p class="mgap-note" id="mgap-note"></p><div class="mgap-row">' +
      '<button type="button" class="mgap-btn mgap-pri" id="mgap-use">Use this icon</button>' +
      '<button type="button" class="mgap-btn" id="mgap-close">Close</button></div></div>';
    doc.body.appendChild(ov);
    var nameEl = doc.getElementById('mgap-name'), useBtn = doc.getElementById('mgap-use'), noteEl = doc.getElementById('mgap-note'), busy = false;
    function paint() {
      [].forEach.call(ov.querySelectorAll('.mgap-it'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-id') === sel ? 'true' : 'false'); });
      nameEl.textContent = nameOf(sel) + (sel === current() ? ' (in use)' : ''); useBtn.disabled = sel === current();
    }
    function close() { ov.remove(); style.remove(); doc.removeEventListener('keydown', onKey, true); }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { close(); return; }
      var b = e.target.closest ? e.target.closest('button') : null; if (!b) return;
      if (b.classList.contains('mgap-it')) { sel = b.getAttribute('data-id'); paint(); return; }
      if (b.id === 'mgap-close') close();
            else if (b.id === 'mgap-use') { if (busy || sel === current()) return; busy = true; refresh(sel).then(function () { busy = false; paint(); noteEl.textContent = 'To use this icon in your app, delete this app and install it again from the VIP version. VIP is free.'; }); }
    });
    ov.addEventListener('contextmenu', function (e) { e.preventDefault(); }); ov.addEventListener('dragstart', function (e) { e.preventDefault(); });
    doc.addEventListener('keydown', onKey, true); paint();
    var first = ov.querySelector('.mgap-it[aria-pressed="true"]'); if (first && first.focus) first.focus();
  }
  API.open = open; API.choose = choose; API.current = current; API.apply = apply;

  /* ---------------- start-up ---------------- */
  function start() {
    var s = get(); if (valid(s) && s !== 'classic') { apply(s); root.__mgAppIconId = s; }
    var host = doc.getElementById('settingsModalInner');                    // an "App icon" button in Settings (main page and VIP)
    if (host && !doc.getElementById('mgap-open')) {
      var d = doc.createElement('div'); d.style.cssText = 'margin:14px 0 4px;';
      var b = doc.createElement('button'); b.type = 'button'; b.id = 'mgap-open'; b.textContent = 'App icon';
      b.style.cssText = 'all:unset;box-sizing:border-box;width:100%;text-align:center;cursor:pointer;padding:12px 14px;border-radius:12px;color:#fff;font-weight:700;border:1px solid rgba(167,139,250,.55);background:rgba(139,92,246,.14)';
      b.addEventListener('click', open); d.appendChild(b); host.appendChild(d);
    }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : this);
