/* MediaGrabber Pro – library loader.
   Heavy libraries (OCR engine, HEIC decoder, QR scanner) are fetched only when a tool first needs them.
   All files are hosted in this same folder (lib-*.js) so nothing third-party runs on your pages. */
(function () {
  'use strict';
  var cs = document.currentScript;
  var base = new URL('./', (cs && cs.src) || location.href).href;
  var cache = {};

  window.mgLoadScript = function (file) {
    if (cache[file]) return cache[file];
    cache[file] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = new URL(file, base).href;
      s.onload = function () { resolve(); };
      s.onerror = function () { delete cache[file]; reject(new Error('Could not load ' + file)); };
      document.head.appendChild(s);
    });
    return cache[file];
  };

  /* ---- Tesseract (OCR): stub until first use, then real library with self-hosted engine + language data ---- */
  var tessStub = {};
  function loadTesseract() {
    return window.mgLoadScript('lib-tesseract.min.js').then(function () {
      var T = window.Tesseract;
      if (T === tessStub) throw new Error('Tesseract failed to initialise');
      if (!T.__mgPatched) {
        var defaults = { workerPath: base + 'lib-tesseract-worker.min.js', corePath: base, langPath: base };
        var rec = T.recognize.bind(T), cw = T.createWorker.bind(T);
        T.recognize = function (img, langs, opts) { return rec(img, langs, Object.assign({}, defaults, opts || {})); };
        T.createWorker = function (langs, oem, opts, cfg) { return cw(langs, oem, Object.assign({}, defaults, opts || {}), cfg); };
        T.__mgPatched = true;
      }
      return T;
    });
  }
  ['recognize', 'createWorker'].forEach(function (fn) {
    tessStub[fn] = function () { var a = arguments; return loadTesseract().then(function (T) { return T[fn].apply(T, a); }); };
  });
  window.Tesseract = tessStub;

  /* ---- heic2any ---- */
  var heicStub = function () {
    var a = arguments;
    return window.mgLoadScript('lib-heic2any.min.js').then(function () {
      if (window.heic2any === heicStub) throw new Error('heic2any failed to initialise');
      return window.heic2any.apply(window, a);
    });
  };
  window.heic2any = heicStub;

  /* ---- warm up when the tool scrolls near ---- */
  window.addEventListener('DOMContentLoaded', function () {
    if (!('IntersectionObserver' in window)) return;
    var map = { ocr: loadTesseract, heic2jpg: function () { return window.mgLoadScript('lib-heic2any.min.js'); } };
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && map[e.target.id]) { var f = map[e.target.id]; delete map[e.target.id]; io.unobserve(e.target); f().catch(function () {}); }
      });
    }, { rootMargin: '600px 0px' });
    ['ocr', 'heic2jpg'].forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  });
})();
