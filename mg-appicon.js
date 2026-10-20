/* MediaGrabber Pro - app icon pack and picker.

   What choosing an icon really does (and does not do):
     - It changes the icon in this browser (tab icon, "Add to home screen" icon) straight away.
     - It points the web app manifest at that icon's own manifest, so the NEXT time the app is installed it uses the chosen icon.
     - It can NOT change the home-screen icon of an app that is already installed: websites have no way to do that. To use a new icon
       on the home screen, remove the app and install it again after choosing. Some Android versions refresh an installed icon
       by themselves after a while, but that is up to the system.
   The chosen icon is remembered on this device. "Save icon image" downloads the picture so it can be used by hand (for example
   as a shortcut icon from a launcher). */
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
    var d = 'icons/' + id + '/';
    return { manifest: d + 'manifest.webmanifest', icon: d + 'favicon-32.png', apple: d + 'apple-touch-icon.png', image: d + 'icon-512.png', thumb: d + 'thumb.png' };
  }
  function hint(standalone) {
    return standalone
      ? 'This app is already installed, and a website cannot change the icon on your home screen. To use a new icon there, remove the app and install it again after choosing one here.'
      : 'Your choice is used in this browser and the next time you install the app. An app that is already on your home screen keeps its icon until you remove it and install it again.';
  }
  var API = { PACK: PACK, KEY: KEY, valid: valid, nameOf: nameOf, plan: plan, hint: hint };
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
  var CSS = '#mgap{position:fixed;inset:0;z-index:2147482000;background:rgba(5,7,15,.82);display:flex;align-items:flex-end;justify-content:center;font-family:Poppins,Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#f3f0ff}' +
    '#mgap .mgap-sheet{width:min(100%,520px);max-height:92vh;overflow:auto;background:#12131f;border:1px solid rgba(167,139,250,.4);border-radius:22px 22px 0 0;padding:18px 18px max(18px,env(safe-area-inset-bottom));box-sizing:border-box}' +
    '@media (min-width:560px){#mgap{align-items:center}#mgap .mgap-sheet{border-radius:22px}}' +
    '#mgap h2{margin:0 0 4px;font-size:20px}#mgap .mgap-sub{margin:0 0 14px;color:#b9b2d8;font-size:13px;line-height:1.45}' +
    '#mgap .mgap-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}' +
    '#mgap .mgap-it{all:unset;box-sizing:border-box;cursor:pointer;position:relative;display:block;aspect-ratio:1;border-radius:50%;padding:0;-webkit-tap-highlight-color:transparent}' +
    '#mgap .mgap-it img{display:block;width:100%;height:100%;border-radius:50%;box-shadow:0 0 0 1px rgba(255,255,255,.16)}' +
    '#mgap .mgap-it[aria-pressed="true"]{box-shadow:0 0 0 3px #12131f,0 0 0 6px #a78bfa;border-radius:50%}' +
    '#mgap .mgap-it .mgap-ck{display:none;position:absolute;right:-2px;bottom:-2px;width:24px;height:24px;border-radius:50%;background:#7c3aed;border:2px solid #12131f;align-items:center;justify-content:center}' +
    '#mgap .mgap-it[aria-pressed="true"] .mgap-ck{display:flex}#mgap :focus-visible{outline:3px solid #fff;outline-offset:3px}' +
    '#mgap .mgap-name{margin:14px 0 4px;font-weight:700;font-size:15px}#mgap .mgap-note{margin:0 0 14px;color:#9d96bd;font-size:12.5px;line-height:1.5;min-height:36px}' +
    '#mgap .mgap-row{display:flex;flex-direction:column;gap:8px}' +
    '#mgap .mgap-btn{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;padding:13px 16px;border-radius:14px;font-weight:700;font-size:15px;border:1px solid rgba(167,139,250,.5);background:rgba(139,92,246,.14);color:#fff}' +
    '#mgap .mgap-pri{background:linear-gradient(135deg,#8b5cf6,#6366f1);border-color:transparent}#mgap .mgap-btn[disabled]{opacity:.45;pointer-events:none}';

  var CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
  function isStandalone() { return !!((root.matchMedia && root.matchMedia('(display-mode: standalone)').matches) || root.navigator.standalone === true); }

  function open() {
    if (doc.getElementById('mgap')) return;
    var sel = current(), style = doc.createElement('style'); style.textContent = CSS; doc.head.appendChild(style);
    var ov = doc.createElement('div'); ov.id = 'mgap'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'App icon');
    var items = '';
    for (var i = 0; i < PACK.length; i++) {
      var id = PACK[i][0], thumb = id === 'classic' ? 'icons/classic/thumb.png' : plan(id).thumb;
      items += '<button type="button" class="mgap-it" data-id="' + id + '" aria-label="' + PACK[i][1] + '" aria-pressed="' + (id === sel) + '"><img src="' + thumb + '" alt="" width="96" height="96" loading="lazy"><span class="mgap-ck">' + CHECK + '</span></button>';
    }
    ov.innerHTML = '<div class="mgap-sheet"><h2>App icon</h2><p class="mgap-sub">Pick the look you like best.</p><div class="mgap-grid">' + items + '</div>' +
      '<p class="mgap-name" id="mgap-name"></p><p class="mgap-note" id="mgap-note"></p><div class="mgap-row">' +
      '<button type="button" class="mgap-btn mgap-pri" id="mgap-use">Use this icon</button>' +
      (root.mgInstallApp && !isStandalone() ? '<button type="button" class="mgap-btn" id="mgap-install">Install with this icon</button>' : '') +
      '<button type="button" class="mgap-btn" id="mgap-save">Save icon image</button><button type="button" class="mgap-btn" id="mgap-close">Close</button></div></div>';
    doc.body.appendChild(ov);
    var nameEl = doc.getElementById('mgap-name'), noteEl = doc.getElementById('mgap-note'), useBtn = doc.getElementById('mgap-use');
    function paint() {
      [].forEach.call(ov.querySelectorAll('.mgap-it'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-id') === sel ? 'true' : 'false'); });
      nameEl.textContent = nameOf(sel) + (sel === current() ? ' (in use)' : ''); useBtn.disabled = sel === current();
    }
    noteEl.textContent = hint(isStandalone());
    function close() { ov.remove(); style.remove(); doc.removeEventListener('keydown', onKey, true); }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { close(); return; }
      var b = e.target.closest ? e.target.closest('button') : null; if (!b) return;
      if (b.classList.contains('mgap-it')) { sel = b.getAttribute('data-id'); paint(); return; }
      if (b.id === 'mgap-close') close();
      else if (b.id === 'mgap-use') { choose(sel); paint(); noteEl.textContent = 'Saved. ' + hint(isStandalone()); }
      else if (b.id === 'mgap-install') { choose(sel); paint(); noteEl.textContent = 'Starting the install with the ' + nameOf(sel) + ' icon...'; root.setTimeout(function () { try { root.mgInstallApp(); } catch (x) {} }, 700); }
      else if (b.id === 'mgap-save') { var img = sel === 'classic' ? 'icons/classic/icon-512.png' : plan(sel).image, a = doc.createElement('a'); a.href = img; a.download = 'app-icon-' + sel + '.png'; doc.body.appendChild(a); a.click(); a.remove(); }
    });
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
