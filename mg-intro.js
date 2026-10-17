/* MediaGrabber Pro - first-run intro (installed app).
   Shown on the first launch after EVERY new install of the app: the first time it is installed, and again if it was deleted and
   installed again. Two signals are used:
     1. the browser's "appinstalled" event (see pwa.js) leaves a marker, and the next launch of the installed app shows the intro
        and clears the marker. This works even if the browser still holds data from earlier website visits, which an uninstall
        does not always remove;
     2. as a backup for browsers that do not announce installs: the very first launch with no saved app data, or after the site
        data was cleared (the "seen it" mark lives in site storage).

   Flow:  welcome screen -> "Getting started" -> 4 tutorial slides (Skip on every screen)
          last slide: "VIP is free" with two buttons
              Go to VIP  -> opens VIP  (the ONLY way this intro sends anyone to VIP)
              Go to main -> "That's OK, you can switch to VIP any time." -> main page
          Skip, or finishing -> main page.

   Not shown when: it is the normal website (not the installed app), the person came from a search result or shared file
   (a tool was requested), or the app has been used before (so existing users are not interrupted by an update).
   Preview it in any browser with  ?intro=1  on the page address.

   The decision and the screen logic are plain functions (decide, reduce, view) so they can be tested without a browser. */
(function (root) {
  'use strict';

  var KEY = 'mgp_onboarded';
  // Any of these means the app was used before. They are read BEFORE the app writes anything of its own on this launch.
  var USED_KEYS = ['mg_tour_done', 'mg_uses', 'mg_conversions', 'mg_recent', 'mg_last_tool', 'mg_fav', 'mgp_recent_tools', 'mgp_vip_default', 'mgp_theme', 'mg_feedback_done', 'mgp_updates_enabled', 'mgp_beta_main'];

  /* ---------------- pure logic ---------------- */
  function decide(env) {            // env: { standalone, force, pending, done, used, deep }
    if (env.force) return true;
    if (!env.standalone || env.deep) return false;       // only the installed app, and not when a tool was asked for
    return !!env.pending || (!env.done && !env.used);    // a new install, or a first launch on a device with no saved data
  }

  var SLIDES = [
    { id: 'tools', title: 'Pick a tool', text: 'Image, PDF and QR tools in one place. Tap a tool name at the top to jump straight to it.' },
    { id: 'files', title: 'Add your files', text: 'Choose files, drop them in, or paste an image. Everything is processed on your device and nothing is uploaded.' },
    { id: 'save', title: 'Save your result', text: 'Tap Download when it is ready. Your recent files are listed under the lightning button, and the app works offline after the first visit.' },
    { id: 'vip', title: 'VIP is free for you', text: 'VIP has more tools than the simple version, such as the PDF Reader, Metadata Inspector, Bulk Resizer, Colour Extractor and Base64. It costs nothing.' }
  ];
  var LAST = SLIDES.length - 1;

  /* state: { screen: 'welcome' } | { screen: 'slide', i } | { screen: 'ok' }      effect: null | 'main' | 'vip' */
  function reduce(st, ev) {
    switch (ev) {
      case 'skip': return { state: st, effect: 'main' };
      case 'start': return st.screen === 'welcome' ? { state: { screen: 'slide', i: 0 }, effect: null } : { state: st, effect: null };
      case 'next': return st.screen === 'slide' && st.i < LAST ? { state: { screen: 'slide', i: st.i + 1 }, effect: null } : { state: st, effect: null };
      case 'back':
        if (st.screen !== 'slide') return { state: st, effect: null };
        return st.i > 0 ? { state: { screen: 'slide', i: st.i - 1 }, effect: null } : { state: { screen: 'welcome' }, effect: null };
      case 'vip': return st.screen === 'slide' && st.i === LAST ? { state: st, effect: 'vip' } : { state: st, effect: null };   // only the button on the last slide
      case 'main': return st.screen === 'slide' && st.i === LAST ? { state: { screen: 'ok' }, effect: null } : { state: st, effect: null };
      case 'done': return st.screen === 'ok' ? { state: st, effect: 'main' } : { state: st, effect: null };
      default: return { state: st, effect: null };
    }
  }

  /* ---------------- pictures (inline SVG, no emoji) ---------------- */
  var IC = {
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    clip: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
    down: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    crown: '<path d="M2 18l2-10 5 5 3-9 3 9 5-5 2 10z"/><line x1="2" y1="21" x2="22" y2="21"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h3M21 17v4"/>'
  };
  function icon(name, x, y, size, color) {
    var k = size / 24;
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + k + ')" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + IC[name] + '</g>';
  }
  function card(y, bars, ic, tint) {                                  // a row like the SmartThings picture: grey bars + an icon tile
    var b = '', i;
    for (i = 0; i < bars.length; i++) b += '<rect x="34" y="' + (y + 20 + i * 18) + '" width="' + bars[i] + '" height="10" rx="5" fill="rgba(255,255,255,.22)"/>';
    return '<rect x="14" y="' + y + '" width="272" height="78" rx="39" fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.14)"/>' + b +
      '<rect x="206" y="' + (y + 11) + '" width="56" height="56" rx="28" fill="rgba(255,255,255,.1)"/>' + icon(ic, 220, y + 25, 28, tint);
  }
  function picture(id) {
    var body;
    if (id === 'tools') body = card(10, [110, 96, 60], 'image', '#c4b5fd') + card(104, [128, 74], 'file', '#67e8f9') + card(198, [92, 120, 56], 'qr', '#fcd34d');
    else if (id === 'files') body = '<rect x="24" y="14" width="252" height="170" rx="26" fill="rgba(255,255,255,.05)" stroke="rgba(167,139,250,.7)" stroke-width="2" stroke-dasharray="9 8"/>' + icon('upload', 124, 52, 52, '#c4b5fd') +
      '<rect x="92" y="122" width="116" height="10" rx="5" fill="rgba(255,255,255,.22)"/><rect x="112" y="142" width="76" height="10" rx="5" fill="rgba(255,255,255,.14)"/>' +
      '<rect x="70" y="204" width="160" height="42" rx="21" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.16)"/>' + icon('clip', 88, 214, 22, '#e9e3ff') + '<rect x="122" y="220" width="86" height="10" rx="5" fill="rgba(255,255,255,.28)"/>';
    else if (id === 'save') body = card(14, [120, 96, 64], 'file', '#c4b5fd') + '<circle cx="150" cy="150" r="30" fill="rgba(34,197,94,.18)" stroke="rgba(34,197,94,.7)" stroke-width="2"/>' + icon('check', 134, 134, 32, '#4ade80') +
      '<rect x="62" y="206" width="176" height="52" rx="26" fill="url(#mgiG)"/>' + icon('down', 90, 220, 24, '#ffffff') + '<rect x="128" y="227" width="84" height="10" rx="5" fill="rgba(255,255,255,.85)"/>';
    else body = '<rect x="30" y="14" width="240" height="132" rx="30" fill="rgba(255,215,0,.07)" stroke="rgba(255,215,0,.55)" stroke-width="2"/>' + icon('crown', 118, 34, 64, '#fcd34d') +
      '<rect x="108" y="108" width="84" height="26" rx="13" fill="rgba(255,215,0,.2)"/><text x="150" y="126" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#fcd34d">FREE</text>' +
      '<rect x="30" y="166" width="112" height="34" rx="17" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.14)"/><rect x="158" y="166" width="112" height="34" rx="17" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.14)"/>' +
      '<rect x="30" y="212" width="112" height="34" rx="17" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.14)"/><rect x="158" y="212" width="112" height="34" rx="17" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.14)"/>' +
      '<rect x="46" y="181" width="80" height="8" rx="4" fill="rgba(255,255,255,.3)"/><rect x="174" y="181" width="80" height="8" rx="4" fill="rgba(255,255,255,.3)"/><rect x="46" y="227" width="80" height="8" rx="4" fill="rgba(255,255,255,.3)"/><rect x="174" y="227" width="80" height="8" rx="4" fill="rgba(255,255,255,.3)"/>';
    return '<svg class="mgi-pic" viewBox="0 0 300 276" aria-hidden="true" focusable="false"><defs><linearGradient id="mgiG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#6366f1"/></linearGradient></defs>' + body + '</svg>';
  }

  /* ---------------- screens ---------------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function btn(act, label, kind) { return '<button type="button" class="mgi-btn mgi-' + kind + '" data-act="' + act + '" data-focus="1">' + esc(label) + '</button>'; }
  function view(st) {
    var top, main, bottom, i;
    if (st.screen === 'welcome') {
      top = '<div class="mgi-bar"><span></span><button type="button" class="mgi-skip" data-act="skip">Skip</button></div>';
      main = '<div class="mgi-main mgi-in mgi-center"><h1 class="mgi-h mgi-big">Introducing the new PDF&nbsp;Converter</h1><p class="mgi-p">Free, private file tools that run on your own device.</p></div>';
      bottom = '<div class="mgi-bottom">' + btn('start', 'Getting started', 'pri') + '</div>';
    } else if (st.screen === 'ok') {
      top = '<div class="mgi-bar"><span></span><span></span></div>';
      main = '<div class="mgi-main mgi-in mgi-center"><h1 class="mgi-h">That&#39;s OK!</h1><p class="mgi-p">You can switch to VIP at any time from the main page.</p></div>';
      bottom = '<div class="mgi-bottom">' + btn('done', 'Continue', 'pri') + '</div>';
    } else {
      var s = SLIDES[st.i], seg = '';
      for (i = 0; i <= LAST; i++) seg += '<i class="' + (i <= st.i ? 'on' : '') + '"></i>';
      top = '<div class="mgi-prog" aria-label="Step ' + (st.i + 1) + ' of ' + SLIDES.length + '">' + seg + '</div><div class="mgi-bar"><span></span><button type="button" class="mgi-skip" data-act="skip">Skip</button></div>';
      main = '<div class="mgi-main mgi-in"><h1 class="mgi-h">' + esc(s.title) + '</h1><p class="mgi-p">' + esc(s.text) + '</p>' + picture(s.id) + '</div>';
      bottom = st.i === LAST
        ? '<div class="mgi-bottom">' + btn('vip', 'Go to VIP', 'pri') + btn('main', 'Go to main', 'sec') + '</div>'
        : '<div class="mgi-bottom">' + btn('next', 'Next', 'pri') + (st.i > 0 ? btn('back', 'Back', 'ghost') : '') + '</div>';
    }
    return top + main + bottom;
  }

  var CSS = '#mgi{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;color:#fff;font-family:Poppins,Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
    'background:radial-gradient(70% 38% at 50% 64%,rgba(99,102,241,.36),rgba(34,211,238,.1) 55%,rgba(5,7,15,0) 78%),#05070f;' +
    'padding:max(14px,env(safe-area-inset-top)) 22px max(22px,env(safe-area-inset-bottom));-webkit-user-select:none;user-select:none;touch-action:pan-y;overflow:hidden}' +
    '#mgi .mgi-prog{display:flex;gap:6px}#mgi .mgi-prog i{flex:1;height:3px;border-radius:3px;background:rgba(255,255,255,.18)}#mgi .mgi-prog i.on{background:#a78bfa}' +
    '#mgi .mgi-bar{display:flex;justify-content:space-between;align-items:center;min-height:48px;margin-top:6px}' +
    '#mgi .mgi-skip{all:unset;box-sizing:border-box;cursor:pointer;padding:10px 6px;font-weight:600;font-size:16px;color:#fff}' +
    '#mgi .mgi-main{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;justify-content:center;min-height:0;padding:6px 4px}' +
    '#mgi .mgi-h{margin:0 0 10px;font-size:clamp(25px,7.2vw,34px);line-height:1.18;font-weight:800;letter-spacing:-.2px}#mgi .mgi-big{font-size:clamp(30px,9vw,42px)}' +
    '#mgi .mgi-p{margin:0 auto 18px;max-width:340px;font-size:15px;line-height:1.5;color:#b9b2d8}' +
    '#mgi .mgi-pic{width:min(76vw,300px);max-height:34vh;height:auto;flex:none}' +
    '#mgi .mgi-bottom{display:flex;flex-direction:column;gap:10px;align-items:center}' +
    '#mgi .mgi-btn{all:unset;box-sizing:border-box;cursor:pointer;width:min(100%,340px);text-align:center;padding:16px 18px;border-radius:999px;font-weight:700;font-size:16px}' +
    '#mgi .mgi-pri{background:linear-gradient(135deg,#8b5cf6,#6366f1);box-shadow:0 8px 26px rgba(99,102,241,.4)}' +
    '#mgi .mgi-sec{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.22)}#mgi .mgi-ghost{padding:10px;color:#c4b5fd;font-weight:600}' +
    '#mgi .mgi-btn:active,#mgi .mgi-skip:active{opacity:.75}#mgi :focus-visible{outline:3px solid #fff;outline-offset:3px}' +
    '#mgi .mgi-in{animation:mgiIn .38s ease both}@keyframes mgiIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}' +
    '@media (prefers-reduced-motion:reduce){#mgi .mgi-in{animation:none}}@media (max-height:640px){#mgi .mgi-pic{max-height:26vh}#mgi .mgi-p{margin-bottom:10px}}';

  /* ---------------- start-up ---------------- */
  function boot() {
    var ls = function () { try { return root.localStorage; } catch (e) { return null; } }();
    var get = function (k) { try { return ls ? ls.getItem(k) : null; } catch (e) { return null; } };
    var set = function (k, v) { try { if (ls) ls.setItem(k, v); } catch (e) {} };
    var q = root.location.search || '', h = root.location.hash || '';
    var standalone = !!((root.matchMedia && (root.matchMedia('(display-mode: standalone)').matches || root.matchMedia('(display-mode: fullscreen)').matches || root.matchMedia('(display-mode: minimal-ui)').matches)) || root.navigator.standalone === true);
    var used = false; for (var i = 0; i < USED_KEYS.length; i++) if (get(USED_KEYS[i]) !== null) { used = true; break; }   // read NOW, before the app writes anything
    var pending = get('mgp_intro_pending') !== null;
    var show = decide({ standalone: standalone, force: /[?&]intro=1(&|$)/.test(q), pending: pending, done: get(KEY) !== null, used: used, deep: /[?&](tool|shared|q|open|go|search)=/.test(q) || h.length > 1 });
    if (!show) return;
    root.__mgIntroShown = true;
    try { if (ls) ls.removeItem('mgp_intro_pending'); } catch (e) {}      // consumed: it will not show again until the next new install

    function start() {
      var doc = root.document, st = { screen: 'welcome' }, timer = 0, el = doc.createElement('div'), x0 = null;
      var style = doc.createElement('style'); style.textContent = CSS; doc.head.appendChild(style);
      el.id = 'mgi'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Welcome to PDF Converter');
      var prevOverflow = doc.documentElement.style.overflow; doc.documentElement.style.overflow = 'hidden';
      set(KEY, '1'); set('mg_tour_done', '1');                                // seen: never again, and the older small tour is not needed
      function close() {
        clearTimeout(timer); el.remove(); style.remove(); doc.documentElement.style.overflow = prevOverflow;
        try { if (/[?&]intro=1/.test(root.location.search)) root.history.replaceState(null, '', root.location.pathname + root.location.hash); } catch (e) {}
        doc.removeEventListener('keydown', onKey, true);
      }
      function apply(ev) {
        var r = reduce(st, ev); st = r.state;
        if (r.effect === 'vip') { close(); root.location.href = 'index (3).html'; return; }     // the ONLY route to VIP
        if (r.effect === 'main') { close(); return; }
        render();
      }
      function render() {
        clearTimeout(timer); el.innerHTML = view(st);
        var f = el.querySelector('[data-focus]'); if (f && f.focus) { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } }
        if (st.screen === 'ok') timer = setTimeout(function () { apply('done'); }, 2600);         // "That's OK" shows for a moment, then the main page
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); apply('skip'); }
        else if (e.key === 'ArrowRight') apply('next'); else if (e.key === 'ArrowLeft') apply('back');
      }
      el.addEventListener('click', function (e) { var b = e.target.closest ? e.target.closest('[data-act]') : null; if (b) apply(b.getAttribute('data-act')); });
      el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      el.addEventListener('touchend', function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) apply(dx < 0 ? (st.screen === 'welcome' ? 'start' : 'next') : 'back'); }, { passive: true });
      doc.addEventListener('keydown', onKey, true);
      doc.body.appendChild(el); render();
    }
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start); else start();
  }

  var API = { decide: decide, reduce: reduce, view: view, SLIDES: SLIDES, KEY: KEY, USED_KEYS: USED_KEYS };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof window !== 'undefined' && typeof document !== 'undefined') { root.mgIntro = API; boot(); }
})(typeof window !== 'undefined' ? window : this);
