/* MediaGrabber Pro – deep links & search-driven navigation (shared by index.html and the VIP page).

   Supported entry points (all resolve to the same tool):
     /converter/#image-to-pdf        /converter/?tool=image-to-pdf        /converter/?q=jpg to pdf
     /converter/#base64              (also reachable from a search result, a shortcut or a shared link)

   Behaviour
   - Runs only when a tool is explicitly requested. A normal visit to the homepage never scrolls.
   - If the requested tool lives in the VIP area, the main page forwards the visitor to the VIP page
     and keeps the request (so nobody lands on a generic page and has to search again).
   - Waits until the tool's section exists (tools.js builds some sections after load), then smooth-scrolls
     to it and briefly highlights it.
   - Everything runs locally; nothing about the visit is sent anywhere. */
(function () {
  'use strict';

  var VIP_PAGE = 'index (3).html';

  /* id = section id on the main page (free) / card id on the VIP page (vip). `vipOnly` tools exist only in VIP.
     `words` are the slugs and phrases people type or link with. */
  var TOOLS = [
    { key: 'converter',  free: 'converter', vip: 'vip-converter',
      words: ['image-converter', 'converter', 'image converter', 'convert image', 'jpg to png', 'png to jpg', 'png to webp', 'webp converter', 'image format converter', 'batch image converter'] },
    { key: 'pdf',        free: 'pdf', vip: 'proPdfBuilderCard',
      words: ['image-to-pdf', 'pdf', 'jpg-to-pdf', 'image to pdf', 'convert image to pdf', 'jpg to pdf', 'jpeg to pdf', 'png to pdf', 'photo to pdf', 'picture to pdf', 'pdf converter', 'free pdf converter', 'pdf builder', 'image to pdf online', 'convert jpg to pdf'] },
    { key: 'pdfmerge',   free: 'pdfmerge',
      words: ['merge-pdf', 'pdfmerge', 'merge pdf', 'combine pdf', 'join pdf', 'pdf merger'] },
    { key: 'ocr',        free: 'ocr', vip: 'vip-ocr',
      words: ['ocr', 'smart-ocr', 'smart ocr', 'ocr converter', 'ocr tool', 'image to text', 'extract text', 'text extractor', 'scan to text', 'pdf to text'] },
    { key: 'unlocker',   free: 'unlocker', vip: 'vip-unlocker',
      words: ['pdf-password-remover', 'pdf-password-removal', 'unlocker', 'pdfunlock', 'unlock-pdf', 'remove-pdf-password', 'pdf password remover', 'remove pdf password', 'unlock pdf', 'pdf unlocker', 'pdf password removal', 'decrypt pdf'] },
    { key: 'pdfreader',  vip: 'vip-pdf-reader', vipOnly: true, reader: true,
      words: ['pdf-reader', 'pdfreader', 'pdf reader', 'read pdf', 'pdf viewer', 'annotate pdf'] },
    { key: 'heic2jpg',   free: 'heic2jpg',
      words: ['heic-to-jpg', 'heic2jpg', 'heic', 'heic to jpg', 'heic converter', 'iphone photo to jpg', 'heif to jpg'] },
    { key: 'qrcode',     free: 'qrcode',
      words: ['qr-code-generator', 'qrcode', 'qr code', 'qr generator', 'qr code generator', 'make qr code'] },
    { key: 'qrscan',     free: 'qrscan',
      words: ['qr-code-scanner', 'qrscan', 'qr scanner', 'scan qr code', 'qr code scanner'] },
    { key: 'compress',   free: 'compress', vip: 'vip-image-compressor',
      words: ['compress', 'compress-image', 'image-compressor', 'compress image', 'image compressor', 'compress image to 100kb', 'reduce image size', 'compress jpg', 'compress photo'] },
    { key: 'photoprep',  free: 'photoprep',
      words: ['photoprep', 'passport-size-photo', 'photo-signature-size', 'passport size photo', 'signature size', 'photo and signature size', 'exam photo size'] },
    { key: 'scanner',    free: 'scanner',
      words: ['scanner', 'document-scanner', 'document scanner', 'scan document', 'scan to pdf', 'camera scanner'] },
    { key: 'pagetools',  free: 'pagetools', vip: 'vip-page-extractor',
      words: ['pagetools', 'pdf-page-tools', 'pdf-page-organizer', 'pdf page tools', 'organize pdf', 'rotate pdf', 'split pdf', 'extract pdf pages', 'pdf page extractor', 'pdfextract'] },
    { key: 'signpdf',    free: 'signpdf',
      words: ['signpdf', 'sign-pdf', 'sign pdf', 'sign pdf online', 'pdf signature', 'e-sign pdf'] },
    { key: 'exif',       free: 'exif',
      words: ['exif', 'remove-exif', 'remove exif', 'remove photo location', 'remove gps from photo', 'strip metadata', 'remove photo metadata'] },
    /* VIP-only tools */
    { key: 'base64',     vip: 'vip-base64', vipOnly: true,
      words: ['base64', 'base-64', 'base64-converter', 'base64 converter', 'base64 encoder', 'base64 decoder', 'image to base64', 'base64 to image', 'binary converter', 'text to binary'] },
    { key: 'palette',    vip: 'vip-color-palette', vipOnly: true,
      words: ['palette', 'color-palette', 'colour-palette', 'color palette', 'color palette extractor', 'extract colors', 'dominant colors', 'hex color picker', 'image colors'] },
    { key: 'meta',       vip: 'vip-metadata', vipOnly: true,
      words: ['meta', 'metadata', 'image-metadata', 'metadata inspector', 'image metadata', 'image info', 'exif viewer'] },
    { key: 'resizer',    vip: 'vip-bulk-resizer', vipOnly: true,
      words: ['resizer', 'bulk-resizer', 'image-resizer', 'resize image', 'bulk image resizer', 'image resizer', 'resize photos'] },
    { key: 'pdfcomp',    vip: 'vip-pdf-compressor', vipOnly: true,
      words: ['pdfcomp', 'pdf-compressor', 'compress pdf', 'pdf compressor', 'reduce pdf size', 'shrink pdf'] }
  ];

  function norm(s) {
    return String(s || '').toLowerCase().replace(/[+_]+/g, ' ').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  var INDEX = {};
  TOOLS.forEach(function (t) {
    [t.key, t.free, t.vip].concat(t.words).forEach(function (w) { if (w) INDEX[norm(w)] = t; });
  });

  /* Resolve a slug or a free-text search ("Base64 Converter", "convert image to pdf") to a tool. */
  function resolve(raw) {
    var q = norm(decodeURIComponent(String(raw || '').replace(/\+/g, ' ')));
    if (!q) return null;
    if (INDEX[q]) return INDEX[q];
    var qd = q.replace(/-/g, ' ');
    if (INDEX[qd]) return INDEX[qd];
    var best = null, bestLen = 0;
    Object.keys(INDEX).forEach(function (w) {                   // longest phrase contained in the query wins
      var wd = w.replace(/-/g, ' ');
      if (wd.length > 2 && (' ' + qd + ' ').indexOf(' ' + wd + ' ') > -1 && wd.length > bestLen) { best = INDEX[w]; bestLen = wd.length; }
    });
    return best;
  }

  function requested() {
    var loc = window.location, m;
    if ((m = /[?&](?:tool|open|go|q|search|utm_term)=([^&#]+)/i.exec(loc.search))) { var t = resolve(m[1]); if (t) return t; }
    if (loc.hash && loc.hash.length > 1) { var h = resolve(loc.hash.slice(1)); if (h) return h; }
    return null;
  }

  var isVipPage = /index(?:%20|\s)\(3\)\.html/i.test(window.location.pathname);

  /* ---------- main page: forward VIP-only requests ---------- */
  if (!isVipPage) {
    var want = requested();
    var vipDefault = false;
    try { vipDefault = localStorage.getItem('mgp_vip_default') === '1' && localStorage.getItem('mgp_skip_once') !== '1'; } catch (e) {}
    if (want && want.vip && (want.vipOnly || (vipDefault && want.vip))) {
      var target = VIP_PAGE + '?tool=' + encodeURIComponent(want.key) + '#' + encodeURIComponent(want.key);
      try { window.location.replace(target); } catch (e) { window.location.href = target; }
      return;
    }
  }

  /* ---------- scroll + highlight (both pages) ---------- */
  var CSS = '.mg-deeplink-hit{outline:2px solid #a78bfa;outline-offset:6px;border-radius:14px;box-shadow:0 0 0 6px rgba(167,139,250,.18),0 0 34px rgba(167,139,250,.55)!important;transition:box-shadow .3s,outline-color .3s}' +
    '.mg-deeplink-hit.mg-vip-hit{outline-color:#ffd700;box-shadow:0 0 0 6px rgba(255,215,0,.16),0 0 34px rgba(255,215,0,.5)!important}' +
    '@media (prefers-reduced-motion:reduce){.mg-deeplink-hit{transition:none}}';
  function addCss() {
    if (document.getElementById('mg-deeplink-css')) return;
    var st = document.createElement('style'); st.id = 'mg-deeplink-css'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st);
  }
  function headerOffset() {
    var off = 16, n = document.getElementById('glassNav') || document.querySelector('nav, header');
    if (n) { var r = n.getBoundingClientRect(); if (r.height && (getComputedStyle(n).position === 'fixed' || getComputedStyle(n).position === 'sticky')) off += r.height; }
    var tabs = document.querySelector('.tool-tabs, #toolTabBar');
    if (isVipPage && tabs) { var tr = tabs.getBoundingClientRect(); if (tr.height) off += tr.height; }
    return off;
  }
  function cardFor(el) {
    if (!el) return null;
    if (isVipPage) return (el.closest && el.closest('.vip-card')) || el;
    if (el.tagName === 'H2') { var n = el.nextElementSibling; return n && /card/.test(n.className) ? n : el; }
    return el;
  }
  var done = false;
  function go(t, tries) {
    if (done) return;
    var id = isVipPage ? t.vip : t.free;
    var el = id && document.getElementById(id);
    if (!el) { if (tries < 60) setTimeout(function () { go(t, tries + 1); }, 200); return; }   // wait up to ~12 s for late-built tools
    done = true;
    addCss();
    function jump() {
      var top = el.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) - headerOffset();
      try { window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); } catch (e) { window.scrollTo(0, Math.max(0, top)); }
    }
    jump();
    setTimeout(jump, 700);                                  // layout may shift while fonts / sections finish loading
    var card = cardFor(el);
    card.classList.add('mg-deeplink-hit'); if (isVipPage) card.classList.add('mg-vip-hit');
    setTimeout(function () { card.classList.remove('mg-deeplink-hit', 'mg-vip-hit'); }, 2800);
    try { document.title = (isVipPage ? 'MediaGrabber VIP' : 'MediaGrabber Pro') + ' – ' + (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40); } catch (e) {}
  }

  function start() {
    var t = requested(); if (!t) return;
    var begin = function () { setTimeout(function () { go(t, 0); }, isVipPage ? 1700 : 350); };   // VIP shows a short intro first
    if (document.readyState === 'complete') begin(); else window.addEventListener('load', begin);
  }
  start();
  window.addEventListener('hashchange', function () { var t = requested(); if (t) { done = false; go(t, 0); } });

  window.mgDeepLink = { resolve: resolve, tools: TOOLS, open: function (name) { var t = resolve(name); if (t) { done = false; go(t, 0); } return !!t; } };
})();
