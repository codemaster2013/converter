/* MediaGrabber Pro – extra tools (loaded on index.html).
   Compress to size · Photo & signature size · Document scanner · PDF page tools · Sign PDF ·
   Remove photo location (EXIF) · QR scanner.
   Everything runs in the browser; files never leave the device. */
(function () {
  'use strict';
  var T = window.__mgt = {};                       // internals exposed for testing
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- tiny helpers ---------------- */
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (k === 'style') e.style.cssText = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function busy(btn, text) {
    if (typeof window.mgBusy === 'function') return window.mgBusy(btn, text);
    var old = btn.textContent; btn.disabled = true; btn.textContent = text;
    var f = function () { btn.disabled = false; btn.textContent = old; }; f.update = function (t) { btn.textContent = t; }; return f;
  }
  function notify(msg, title, icon) {
    if (typeof window.mgAlert === 'function') window.mgAlert(msg, { title: title || 'Notice', icon: icon || 'error' }); else alert(msg);
  }
  function fmtSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function saveBlob(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
  }
  function baseName(n) { return (n || 'file').replace(/\.[^.]+$/, ''); }
  function done() { try { if (typeof redirectToFeedback === 'function') redirectToFeedback(); } catch (e) {} }
  /* Reads the first bytes of a file to find its real format (a wrong/empty MIME type is the usual reason
     a phone photo "could not be decoded"). */
  function sniffType(u) {
    var s4 = String.fromCharCode(u[0], u[1], u[2], u[3]);
    if (u[0] === 0xFF && u[1] === 0xD8 && u[2] === 0xFF) return 'image/jpeg';
    if (u[0] === 0x89 && s4.slice(1) === 'PNG') return 'image/png';
    if (s4 === 'GIF8') return 'image/gif';
    if (s4 === 'RIFF' && String.fromCharCode(u[8], u[9], u[10], u[11]) === 'WEBP') return 'image/webp';
    if (u[0] === 0x42 && u[1] === 0x4D) return 'image/bmp';
    if (String.fromCharCode(u[4], u[5], u[6], u[7]) === 'ftyp') {
      var brand = String.fromCharCode(u[8], u[9], u[10], u[11]);
      if (/^(avif|avis)$/.test(brand)) return 'image/avif';
      if (/^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand)) return 'image/heic';
    }
    return '';
  }
  function imgElement(blob) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(blob), i = new Image();
      i.onload = function () { URL.revokeObjectURL(url); res(i); };
      i.onerror = function () { URL.revokeObjectURL(url); rej(new Error('decode')); };
      i.src = url;
    });
  }
  async function loadBitmap(file) {
    // 1) fast path
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) {}
      try { return await createImageBitmap(file); } catch (e) {}
    }
    // 2) read the bytes ourselves and try again with the real format
    var buf;
    try { buf = await file.arrayBuffer(); }
    catch (e) { throw new Error('This file could not be read. Please choose it again.'); }
    if (!buf.byteLength) throw new Error('This file is empty (0 bytes). Please choose it again.');
    var kind = sniffType(new Uint8Array(buf, 0, Math.min(16, buf.byteLength)));
    if (kind === 'image/heic') {
      if (typeof window.heic2any === 'function') {
        try {
          var out = await window.heic2any({ blob: new Blob([buf], { type: 'image/heic' }), toType: 'image/jpeg', quality: 0.95 });
          out = Array.isArray(out) ? out[0] : out;
          return window.createImageBitmap ? await createImageBitmap(out) : await imgElement(out);
        } catch (e) { throw new Error('This HEIC photo could not be converted. Try the HEIC to JPG tool first.'); }
      }
      throw new Error('HEIC photos are not supported here. Use the HEIC to JPG tool first.');
    }
    var fixed = new Blob([buf], { type: kind || (/^image\//.test(file.type) ? file.type : 'image/jpeg') });
    if (window.createImageBitmap) { try { return await createImageBitmap(fixed); } catch (e) {} }
    try { var im = await imgElement(fixed); if (im.decode) { try { await im.decode(); } catch (e) {} } return im; }
    catch (e) { throw new Error('This file is not a readable image (' + (kind ? kind.replace('image/', '').toUpperCase() : (file.type || 'unknown format')) + ').'); }
  }
  function newCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function drawScaled(src, w, h, bg) {
    var c = newCanvas(w, h), x = c.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
    x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, w, h); return c;
  }
  function toBlob(canvas, type, q) { return new Promise(function (res) { canvas.toBlob(res, type, q); }); }
  function webpOK() { try { return newCanvas(1, 1).toDataURL('image/webp').indexOf('data:image/webp') === 0; } catch (e) { return false; } }
  function readBytes(file) { return file.arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  T.helpers = { fmtSize: fmtSize };

  /* ---------------- results list (download / ZIP) ---------------- */
  function ResultList(host) {
    var items = [];
    var list = el('div', { 'class': 'mgt-list' }), zipBtn = el('button', { 'class': 'btn-primary', style: 'display:none;margin-top:12px', text: 'Download all as ZIP' });
    host.appendChild(list); host.appendChild(zipBtn);
    zipBtn.onclick = function () {
      if (!window.JSZip || !items.length) return;
      var z = new JSZip(); items.forEach(function (i) { z.file(i.name, i.blob); });
      z.generateAsync({ type: 'blob' }).then(function (b) { saveBlob(b, 'mediagrabber-files.zip'); });
    };
    return {
      clear: function () { items = []; list.innerHTML = ''; zipBtn.style.display = 'none'; },
      add: function (name, blob, note) {
        items.push({ name: name, blob: blob });
        list.appendChild(el('div', { 'class': 'mgt-item' }, [
          el('div', { style: 'flex:1;min-width:0;word-break:break-all' }, [el('div', { text: name, style: 'font-weight:600' }), el('div', { text: fmtSize(blob.size) + (note ? ' · ' + note : ''), style: 'opacity:.7;font-size:12px' })]),
          el('button', { 'class': 'mgt-chip on', text: 'Download', onclick: function () { saveBlob(blob, name); } })
        ]));
        zipBtn.style.display = items.length > 1 ? 'block' : 'none';
      },
      count: function () { return items.length; }
    };
  }

  /* ---------------- section / chip registration ---------------- */
  var TOOLS_META = [];
  function addTool(id, title, chip, icon, sub, build) {
    TOOLS_META.push({ id: id, title: title, chip: chip, icon: icon, sub: sub, build: build });
  }
  T.tools = TOOLS_META;

  var ICON = function (p) { return '<svg class="chip-ico" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };

  /* =================================================================
     1. COMPRESS TO EXACT SIZE
     ================================================================= */
  T.compressToTarget = async function (bmp, target, mime) {
    var W = bmp.width, H = bmp.height, scale = 1, maxSide = Math.max(W, H);
    if (maxSide > 4096) scale = 4096 / maxSide;
    var smallest = null;
    for (var round = 0; round < 14; round++) {
      var w = Math.max(16, Math.round(W * scale)), h = Math.max(16, Math.round(H * scale));
      var c = drawScaled(bmp, w, h, '#ffffff');
      var lo = 0.08, hi = 0.95, minB = await toBlob(c, mime, lo);
      if (!smallest || minB.size < smallest.blob.size) smallest = { blob: minB, width: w, height: h, quality: lo, scaled: scale < 1 };
      if (minB.size > target) {
        if (w <= 16 || h <= 16) break;
        scale *= Math.max(0.5, Math.min(0.92, Math.sqrt(target / minB.size) * 0.96)); continue;
      }
      var best = minB, bestQ = lo;
      for (var i = 0; i < 7; i++) {
        var mid = (lo + hi) / 2, b = await toBlob(c, mime, mid);
        if (b.size <= target) { best = b; bestQ = mid; lo = mid; } else hi = mid;
      }
      return { blob: best, width: w, height: h, quality: bestQ, scaled: scale < 1, ok: true };
    }
    smallest.ok = false; return smallest;
  };

  addTool('compress', 'Compress to Exact Size', 'Compress to Size',
    ICON('<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="m14 10 7-7"/><path d="m3 21 7-7"/>'),
    'Shrink photos below a size limit — perfect for exam forms and government portals (20 KB, 50 KB, 100 KB…).',
    function (card) {
      var targetKB = 100, mime = 'image/jpeg';
      var input = el('input', { type: 'file', id: 'cmpInput', accept: 'image/*', multiple: 'multiple', hidden: 'hidden' });
      var label = el('label', { 'class': 'upload-area', 'for': 'cmpInput' }, [el('p', { text: 'Click to upload images', style: 'font-weight:600' }), input]);
      var names = el('div', { 'class': 'mgt-note' });
      var row = el('div', { 'class': 'mgt-row' }), custom = el('input', { type: 'number', min: '5', max: '5000', placeholder: 'Custom KB', style: 'max-width:130px;margin:0' });
      [20, 50, 100, 200, 500].forEach(function (kb) {
        var b = el('button', { 'class': 'mgt-chip' + (kb === targetKB ? ' on' : ''), text: '≤ ' + kb + ' KB', type: 'button', onclick: function () { targetKB = kb; custom.value = ''; sync(); } }); b.dataset.kb = kb; row.appendChild(b);
      });
      row.appendChild(custom);
      function sync() { Array.prototype.forEach.call(row.querySelectorAll('.mgt-chip'), function (b) { b.classList.toggle('on', Number(b.dataset.kb) === targetKB); }); }
      custom.oninput = function () { var v = Number(custom.value); if (v >= 5) { targetKB = v; sync(); } };
      var fmtRow = el('div', { 'class': 'mgt-row' });
      var sel = el('select', { id: 'cmpFormat', style: 'margin:0;max-width:200px' }, [el('option', { value: 'image/jpeg', text: 'JPEG (works everywhere)' })]);
      if (webpOK()) sel.appendChild(el('option', { value: 'image/webp', text: 'WebP (smaller)' }));
      sel.onchange = function () { mime = sel.value; };
      fmtRow.appendChild(el('span', { text: 'Format:', style: 'font-size:13px;opacity:.8;align-self:center' })); fmtRow.appendChild(sel);
      var btn = el('button', { 'class': 'btn-primary', text: 'Compress', id: 'cmpBtn' }), status = el('div', { 'class': 'mgt-note', id: 'cmpStatus' });
      var results = ResultList(card);
      input.onchange = function () { names.textContent = input.files.length ? input.files.length + ' image(s) selected' : ''; };
      btn.onclick = async function () {
        if (!input.files.length) { notify('Please choose at least one image.', 'No image'); return; }
        var fin = busy(btn, 'Compressing…'); results.clear(); status.textContent = '';
        try {
          var files = Array.prototype.slice.call(input.files), warn = 0;
          for (var i = 0; i < files.length; i++) {
            fin.update('Compressing ' + (i + 1) + ' of ' + files.length + '…');
            var bmp = await loadBitmap(files[i]);
            var r = await T.compressToTarget(bmp, targetKB * 1024, mime);
            if (bmp.close) bmp.close();
            var ext = r.blob.type === 'image/webp' ? 'webp' : 'jpg';
            if (!r.ok) warn++;
            results.add(baseName(files[i].name) + '-' + targetKB + 'kb.' + ext, r.blob, r.width + '×' + r.height + (r.scaled ? ' (resized)' : '') + (r.ok ? '' : ' — could not reach the limit'));
          }
          if (warn) status.textContent = warn + ' image(s) could not get under ' + targetKB + ' KB; the smallest result is shown.';
          done();
        } catch (e) { notify('Could not compress: ' + e.message, 'Compression failed'); }
        fin();
      };
      card.insertBefore(label, card.firstChild);
      [names, row, fmtRow, btn, status].forEach(function (n) { card.insertBefore(n, results ? card.querySelector('.mgt-list') : null); });
    });

  /* =================================================================
     2. PHOTO & SIGNATURE SIZE
     ================================================================= */
  var PRESETS = [
    ['Passport photo 35×45 mm (413×531 px)', 413, 531, 0],
    ['PAN-style photo 25×35 mm (295×413 px)', 295, 413, 0],
    ['Visa / US photo 2×2 in (600×600 px)', 600, 600, 0],
    ['Exam photo 200×230 px · ≤ 50 KB', 200, 230, 50],
    ['Exam photo 100×120 px · ≤ 20 KB', 100, 120, 20],
    ['Signature 140×60 px · ≤ 20 KB', 140, 60, 20],
    ['Signature 256×64 px · ≤ 30 KB', 256, 64, 30],
    ['Custom size…', 0, 0, 0]
  ];
  T.cropRect = function (bw, bh, ow, oh, zoom, cx, cy) {
    var s = Math.max(ow / bw, oh / bh) * zoom, sw = ow / s, sh = oh / s;
    var x = Math.min(Math.max(cx - sw / 2, 0), bw - sw), y = Math.min(Math.max(cy - sh / 2, 0), bh - sh);
    return { x: x, y: y, w: sw, h: sh };
  };
  T.encodeFixed = async function (canvas, target, mime) {
    var hi = await toBlob(canvas, mime, 0.95);
    if (!target || hi.size <= target) return { blob: hi, ok: true, quality: 0.95 };
    var lo = 0.05, best = null, q = 0, low = await toBlob(canvas, mime, lo);
    if (low.size > target) return { blob: low, ok: false, quality: lo };
    best = low; q = lo; var h = 0.95;
    for (var i = 0; i < 8; i++) { var mid = (lo + h) / 2, b = await toBlob(canvas, mime, mid); if (b.size <= target) { best = b; q = mid; lo = mid; } else h = mid; }
    return { blob: best, ok: true, quality: q };
  };

  addTool('photoprep', 'Photo & Signature Size', 'Photo Size',
    ICON('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M6.2 19a6 6 0 0 1 11.6 0"/>'),
    'Crop and resize a photo or signature to the exact pixel size and file size a form asks for. Always double-check the size rules on your form.',
    function (card) {
      var bmp = null, state = { zoom: 1, cx: 0, cy: 0 }, ow = 413, oh = 531, maxKB = 0;
      var input = el('input', { type: 'file', id: 'ppInput', accept: 'image/*', hidden: 'hidden' });
      var label = el('label', { 'class': 'upload-area', 'for': 'ppInput' }, [el('p', { text: 'Click to upload a photo or signature', style: 'font-weight:600' }), input]);
      var sel = el('select', { id: 'ppPreset' }); PRESETS.forEach(function (p, i) { sel.appendChild(el('option', { value: i, text: p[0] })); });
      var wIn = el('input', { type: 'number', min: '16', max: '4000', placeholder: 'Width px', style: 'margin:0' }), hIn = el('input', { type: 'number', min: '16', max: '4000', placeholder: 'Height px', style: 'margin:0' }), kIn = el('input', { type: 'number', min: '5', max: '2000', placeholder: 'Max KB (optional)', style: 'margin:0' });
      var customRow = el('div', { 'class': 'mgt-grid3', style: 'display:none;margin-top:10px' }, [wIn, hIn, kIn]);
      var zoom = el('input', { type: 'range', min: '1', max: '3', step: '0.01', value: '1', style: 'width:100%;margin:6px 0' });
      var cv = el('canvas', { id: 'ppCanvas', style: 'display:none;max-width:100%;border-radius:10px;touch-action:none;margin:8px auto;background:repeating-conic-gradient(#8884 0 25%,#0000 0 50%) 50%/16px 16px;cursor:grab' });
      var hint = el('div', { 'class': 'mgt-note', text: 'Drag the picture to position it. Use the slider to zoom.' });
      var btn = el('button', { 'class': 'btn-primary', text: 'Create & download', id: 'ppBtn' }), status = el('div', { 'class': 'mgt-note', id: 'ppStatus' });
      var results = ResultList(card);
      function applyPreset() {
        var p = PRESETS[sel.value]; customRow.style.display = p[1] ? 'none' : 'grid';
        if (p[1]) { ow = p[1]; oh = p[2]; maxKB = p[3]; } else { ow = Number(wIn.value) || 413; oh = Number(hIn.value) || 531; maxKB = Number(kIn.value) || 0; }
        draw();
      }
      sel.onchange = applyPreset; [wIn, hIn, kIn].forEach(function (i) { i.oninput = applyPreset; });
      function rect() { return T.cropRect(bmp.width, bmp.height, ow, oh, state.zoom, state.cx, state.cy); }
      function draw() {
        if (!bmp) return; cv.style.display = 'block'; cv.width = ow; cv.height = oh;
        cv.style.width = Math.min(320, ow) + 'px'; cv.style.height = 'auto';
        var r = rect(), x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, ow, oh); x.imageSmoothingQuality = 'high';
        x.drawImage(bmp, r.x, r.y, r.w, r.h, 0, 0, ow, oh);
      }
      input.onchange = async function () {
        if (!input.files.length) return;
        try { bmp = await loadBitmap(input.files[0]); } catch (e) { notify((e && e.message) || 'This file is not a readable image.', 'Image error'); return; }
        state = { zoom: 1, cx: bmp.width / 2, cy: bmp.height / 2 }; zoom.value = 1; applyPreset();
      };
      zoom.oninput = function () { state.zoom = Number(zoom.value); draw(); };
      var drag = null;
      cv.onpointerdown = function (e) { if (!bmp) return; drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; };
      cv.onpointermove = function (e) {
        if (!drag || !bmp) return; var r = rect(), k = r.w / cv.getBoundingClientRect().width;
        state.cx -= (e.clientX - drag.x) * k; state.cy -= (e.clientY - drag.y) * k; drag = { x: e.clientX, y: e.clientY };
        var r2 = rect(); state.cx = r2.x + r2.w / 2; state.cy = r2.y + r2.h / 2; draw();
      };
      cv.onpointerup = cv.onpointercancel = function () { drag = null; cv.style.cursor = 'grab'; };
      btn.onclick = async function () {
        if (!bmp) { notify('Please choose a photo first.', 'No image'); return; }
        var fin = busy(btn, 'Creating…'); results.clear(); status.textContent = '';
        try {
          var r = await T.encodeFixed(cv, maxKB * 1024, 'image/jpeg');
          results.add('photo-' + ow + 'x' + oh + '.jpg', r.blob, ow + '×' + oh + ' px');
          if (!r.ok) status.textContent = 'Could not get under ' + maxKB + ' KB at this pixel size. Try a plainer background or a smaller size.';
          done();
        } catch (e) { notify('Could not create the image: ' + e.message, 'Failed'); }
        fin();
      };
      card.insertBefore(label, card.firstChild);
      var anchor = card.querySelector('.mgt-list');
      [el('p', { text: 'Size', style: 'font-size:13px;opacity:.8;margin:12px 0 4px' }), sel, customRow, zoom, cv, hint, btn, status].forEach(function (n) { card.insertBefore(n, anchor); });
      applyPreset();
    });

  /* =================================================================
     3. DOCUMENT SCANNER
     ================================================================= */
  function boxBlur(src, w, h, r) {
    var tmp = new Uint8Array(w * h), out = new Uint8Array(w * h), d = 2 * r + 1, x, y, sum;
    for (y = 0; y < h; y++) {
      sum = 0; for (x = -r; x <= r; x++) sum += src[y * w + Math.min(w - 1, Math.max(0, x))];
      for (x = 0; x < w; x++) { tmp[y * w + x] = sum / d; sum += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)]; }
    }
    for (x = 0; x < w; x++) {
      sum = 0; for (y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (y = 0; y < h; y++) { out[y * w + x] = sum / d; sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
    }
    return out;
  }
  function polyArea(q) { var a = 0; for (var i = 0; i < 4; i++) { var p = q[i], n = q[(i + 1) % 4]; a += p[0] * n[1] - n[0] * p[1]; } return Math.abs(a) / 2; }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  T.insetQuad = function (w, h, f) { f = f == null ? 0.06 : f; return [[w * f, h * f], [w * (1 - f), h * f], [w * (1 - f), h * (1 - f)], [w * f, h * (1 - f)]]; };

  /* finds the page corners (TL, TR, BR, BL) in an RGBA image; falls back to an inset rectangle */
  T.detectQuad = function (data, w, h) {
    var n = w * h, g = new Uint8Array(n), i, t;
    for (i = 0; i < n; i++) g[i] = (data[i * 4] * 77 + data[i * 4 + 1] * 150 + data[i * 4 + 2] * 29) >> 8;
    g = boxBlur(g, w, h, 2);
    var hist = new Array(256).fill(0); for (i = 0; i < n; i++) hist[g[i]]++;
    var sum = 0; for (t = 0; t < 256; t++) sum += t * hist[t];
    var sumB = 0, wB = 0, wF, max = -1, thr = 128;
    for (t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue; wF = n - wB; if (!wF) break; sumB += t * hist[t];
      var mB = sumB / wB, mF = (sum - sumB) / wF, bt = wB * wF * (mB - mF) * (mB - mF);
      if (bt > max) { max = bt; thr = t; }
    }
    var mask = new Uint8Array(n), bright = 0, bc = 0, x, y;
    for (i = 0; i < n; i++) mask[i] = g[i] > thr ? 1 : 0;
    for (x = 0; x < w; x++) { bright += mask[x] + mask[(h - 1) * w + x]; bc += 2; }
    for (y = 1; y < h - 1; y++) { bright += mask[y * w] + mask[y * w + w - 1]; bc += 2; }
    if (bright / bc > 0.5) for (i = 0; i < n; i++) mask[i] ^= 1;      // document is the darker area
    var visited = new Uint8Array(n), stack = new Int32Array(n), best = null;
    for (var s = 0; s < n; s++) {
      if (!mask[s] || visited[s]) continue;
      var sp = 0, area = 0, tl = 1e9, br = -1e9, tr = -1e9, bl = 1e9, ptl, ptr, pbr, pbl;
      stack[sp++] = s; visited[s] = 1;
      while (sp) {
        var p = stack[--sp]; x = p % w; y = (p / w) | 0; area++;
        var a = x + y, b = x - y;
        if (a < tl) { tl = a; ptl = [x, y]; } if (a > br) { br = a; pbr = [x, y]; }
        if (b > tr) { tr = b; ptr = [x, y]; } if (b < bl) { bl = b; pbl = [x, y]; }
        if (x > 0 && mask[p - 1] && !visited[p - 1]) { visited[p - 1] = 1; stack[sp++] = p - 1; }
        if (x < w - 1 && mask[p + 1] && !visited[p + 1]) { visited[p + 1] = 1; stack[sp++] = p + 1; }
        if (y > 0 && mask[p - w] && !visited[p - w]) { visited[p - w] = 1; stack[sp++] = p - w; }
        if (y < h - 1 && mask[p + w] && !visited[p + w]) { visited[p + w] = 1; stack[sp++] = p + w; }
      }
      if (!best || area > best.area) best = { area: area, quad: [ptl, ptr, pbr, pbl] };
    }
    if (best && best.area > 0.1 * n) {
      var q = best.quad, minSide = 0.15 * Math.min(w, h);
      if (polyArea(q) > 0.08 * n && dist(q[0], q[1]) > minSide && dist(q[1], q[2]) > minSide && dist(q[2], q[3]) > minSide && dist(q[3], q[0]) > minSide) return { quad: q, auto: true };
    }
    return { quad: T.insetQuad(w, h), auto: false };
  };

  function solve8(A, b) {
    var n = 8, M = A.map(function (r, i) { return r.concat([b[i]]); }), i, j, k;
    for (i = 0; i < n; i++) {
      var piv = i; for (j = i + 1; j < n; j++) if (Math.abs(M[j][i]) > Math.abs(M[piv][i])) piv = j;
      var tmp = M[i]; M[i] = M[piv]; M[piv] = tmp;
      if (Math.abs(M[i][i]) < 1e-12) return null;
      for (j = i + 1; j < n; j++) { var f = M[j][i] / M[i][i]; for (k = i; k <= n; k++) M[j][k] -= f * M[i][k]; }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) { var s = M[i][n]; for (j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
    return x;
  }
  T.homography = function (dst, src) {            // maps dst (u,v) -> src (x,y)
    var A = [], b = [];
    for (var i = 0; i < 4; i++) {
      var u = dst[i][0], v = dst[i][1], x = src[i][0], y = src[i][1];
      A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x);
      A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y);
    }
    return solve8(A, b);
  };
  /* straightens the page: returns a new canvas */
  T.warpQuad = function (srcCanvas, quad, maxSide) {
    var W = Math.max(dist(quad[0], quad[1]), dist(quad[3], quad[2])), H = Math.max(dist(quad[0], quad[3]), dist(quad[1], quad[2]));
    var k = Math.min(1, (maxSide || 2000) / Math.max(W, H)); W = Math.max(16, Math.round(W * k)); H = Math.max(16, Math.round(H * k));
    var hm = T.homography([[0, 0], [W, 0], [W, H], [0, H]], quad); if (!hm) return srcCanvas;
    var sw = srcCanvas.width, sh = srcCanvas.height, sd = srcCanvas.getContext('2d').getImageData(0, 0, sw, sh).data;
    var out = newCanvas(W, H), octx = out.getContext('2d'), od = octx.createImageData(W, H), o = od.data;
    for (var v = 0; v < H; v++) for (var u = 0; u < W; u++) {
      var den = hm[6] * u + hm[7] * v + 1, x = (hm[0] * u + hm[1] * v + hm[2]) / den, y = (hm[3] * u + hm[4] * v + hm[5]) / den, p = (v * W + u) * 4;
      if (x < 0 || y < 0 || x > sw - 1 || y > sh - 1) { o[p] = o[p + 1] = o[p + 2] = 255; o[p + 3] = 255; continue; }
      var x0 = x | 0, y0 = y | 0, x1 = Math.min(x0 + 1, sw - 1), y1 = Math.min(y0 + 1, sh - 1), fx = x - x0, fy = y - y0;
      var i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4, i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4;
      for (var c = 0; c < 3; c++) o[p + c] = (sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx) * (1 - fy) + (sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx) * fy;
      o[p + 3] = 255;
    }
    octx.putImageData(od, 0, 0); return out;
  };
  /* cleanup filters: original | magic (shadow removal, colour) | gray | bw */
  T.applyFilter = function (canvas, mode) {
    if (mode === 'original') return canvas;
    var w = canvas.width, h = canvas.height, ctx = canvas.getContext('2d'), img = ctx.getImageData(0, 0, w, h), d = img.data, n = w * h, L = new Uint8Array(n), i;
    for (i = 0; i < n; i++) L[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8;
    if (mode === 'bw') {
      var integral = new Float64Array((w + 1) * (h + 1)), x, y;
      for (y = 0; y < h; y++) { var row = 0; for (x = 0; x < w; x++) { row += L[y * w + x]; integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row; } }
      var s = Math.max(15, Math.round(w / 10)) | 1, r = (s - 1) / 2;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        var x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
        var mean = (integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
        var v = L[y * w + x] < mean * 0.92 ? 0 : 255, p = (y * w + x) * 4; d[p] = d[p + 1] = d[p + 2] = v;
      }
    } else {
      var rad = Math.max(8, Math.round(Math.max(w, h) / 40)), bg = boxBlur(boxBlur(L, w, h, rad), w, h, rad);
      for (i = 0; i < n; i++) {
        var f = 238 / Math.max(bg[i], 45), p4 = i * 4;
        if (mode === 'gray') { var gv = Math.min(255, L[i] * f); gv = Math.min(255, Math.max(0, (gv - 128) * 1.12 + 128)); d[p4] = d[p4 + 1] = d[p4 + 2] = gv; }
        else for (var c = 0; c < 3; c++) d[p4 + c] = Math.min(255, Math.max(0, (d[p4 + c] * f - 128) * 1.06 + 128));
      }
    }
    var out = newCanvas(w, h); out.getContext('2d').putImageData(img, 0, 0); return out;
  };

  addTool('scanner', 'Document Scanner', 'Doc Scanner',
    ICON('<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>'),
    'Scan paper with your camera: corners are detected automatically, the page is straightened and cleaned, and you can export a PDF.',
    function (card) {
      var src = null, quad = null, pages = [], filter = 'magic', stream = null, drag = -1;
      var input = el('input', { type: 'file', id: 'scInput', accept: 'image/*', multiple: 'multiple', hidden: 'hidden' });
      var label = el('label', { 'class': 'upload-area', 'for': 'scInput' }, [el('p', { text: 'Click to choose photos of documents', style: 'font-weight:600' }), input]);
      var camBtn = el('button', { 'class': 'btn-primary', type: 'button', text: '📷 Open camera', id: 'scCamBtn' });
      var video = el('video', { playsinline: '', muted: '', autoplay: '', style: 'display:none;width:100%;max-width:520px;border-radius:12px;margin:10px auto;background:#000' });
      var camRow = el('div', { 'class': 'mgt-row', style: 'display:none' });
      var shot = el('button', { 'class': 'btn-primary', type: 'button', text: 'Capture' }), close = el('button', { 'class': 'mgt-chip', type: 'button', text: 'Close camera' });
      camRow.appendChild(shot); camRow.appendChild(close);
      var editor = el('canvas', { id: 'scEditor', style: 'display:none;max-width:100%;touch-action:none;border-radius:10px;margin:10px auto' });
      var tip = el('div', { 'class': 'mgt-note', style: 'display:none', text: 'Drag the four corners onto the page edges, choose a look, then tap "Add page".' });
      var fRow = el('div', { 'class': 'mgt-row', style: 'display:none' });
      [['magic', 'Magic colour'], ['original', 'Original'], ['gray', 'Grey'], ['bw', 'Black & white']].forEach(function (f) {
        var b = el('button', { 'class': 'mgt-chip' + (f[0] === filter ? ' on' : ''), type: 'button', text: f[1], onclick: function () { filter = f[0]; Array.prototype.forEach.call(fRow.children, function (c) { c.classList.toggle('on', c === b); }); } }); fRow.appendChild(b);
      });
      var addBtn = el('button', { 'class': 'btn-primary', type: 'button', text: 'Add page', id: 'scAdd', style: 'display:none' });
      var strip = el('div', { 'class': 'mgt-grid', id: 'scPages' });
      var expRow = el('div', { 'class': 'mgt-row', style: 'display:none' });
      var pdfBtn = el('button', { 'class': 'btn-primary', type: 'button', text: 'Export PDF', id: 'scPdf' }), imgBtn = el('button', { 'class': 'mgt-chip', type: 'button', text: 'Save as images (ZIP)' });
      expRow.appendChild(pdfBtn); expRow.appendChild(imgBtn);
      var queue = [];

      function show(on) { editor.style.display = tip.style.display = on ? 'block' : 'none'; fRow.style.display = on ? 'flex' : 'none'; addBtn.style.display = on ? 'block' : 'none'; }
      function drawEditor() {
        if (!src) return; var maxW = Math.min(760, src.width), k = maxW / src.width;
        editor.width = Math.round(src.width * k); editor.height = Math.round(src.height * k);
        editor.style.width = Math.min(editor.width, 640) + 'px'; editor.style.height = 'auto';
        var x = editor.getContext('2d'); x.drawImage(src, 0, 0, editor.width, editor.height);
        x.lineWidth = 3; x.strokeStyle = '#a855f7'; x.fillStyle = 'rgba(168,85,247,.15)'; x.beginPath();
        quad.forEach(function (p, i) { var px = p[0] * k, py = p[1] * k; if (i) x.lineTo(px, py); else x.moveTo(px, py); }); x.closePath(); x.fill(); x.stroke();
        quad.forEach(function (p) { x.beginPath(); x.arc(p[0] * k, p[1] * k, 11, 0, 7); x.fillStyle = '#fff'; x.fill(); x.stroke(); });
      }
      function setSource(canvas) {
        src = canvas; var sc = 360 / Math.max(canvas.width, canvas.height), sw = Math.max(40, Math.round(canvas.width * sc)), sh = Math.max(40, Math.round(canvas.height * sc));
        var small = drawScaled(canvas, sw, sh), det = T.detectQuad(small.getContext('2d').getImageData(0, 0, sw, sh).data, sw, sh);
        quad = det.quad.map(function (p) { return [p[0] / sc, p[1] / sc]; });
        tip.textContent = det.auto ? 'Page found. Drag a corner if the outline is off, choose a look, then tap "Add page".' : 'Could not find the edges automatically — drag the four corners onto the page, then tap "Add page".';
        show(true); drawEditor();
      }
      T.scannerSetSource = setSource;
      function nextInQueue() { if (queue.length) setSource(queue.shift()); else show(false); }
      async function ingest(files) {
        queue = []; for (var i = 0; i < files.length; i++) {
          var b = await loadBitmap(files[i]), k = Math.min(1, 2200 / Math.max(b.width, b.height));
          queue.push(drawScaled(b, Math.round(b.width * k), Math.round(b.height * k))); if (b.close) b.close();
        }
        nextInQueue();
      }
      input.onchange = function () { if (input.files.length) ingest(Array.prototype.slice.call(input.files)).catch(function (e) { notify('Could not read the image: ' + e.message); }); };
      function pos(e) { var r = editor.getBoundingClientRect(), k = src.width / r.width; return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; }
      editor.onpointerdown = function (e) {
        if (!src) return; var p = pos(e), best = -1, bd = 1e9, r = editor.getBoundingClientRect(), reach = 34 * (src.width / r.width);
        quad.forEach(function (q, i) { var d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = i; } });
        if (bd <= reach) { drag = best; editor.setPointerCapture(e.pointerId); }
      };
      editor.onpointermove = function (e) { if (drag < 0) return; var p = pos(e); quad[drag] = [Math.min(src.width, Math.max(0, p[0])), Math.min(src.height, Math.max(0, p[1]))]; drawEditor(); };
      editor.onpointerup = editor.onpointercancel = function () { drag = -1; };
      function renderThumbs() {
        strip.innerHTML = ''; expRow.style.display = pages.length ? 'flex' : 'none';
        pages.forEach(function (pg, i) {
          var th = drawScaled(pg, 110, Math.max(20, Math.round(110 * pg.height / pg.width)));
          strip.appendChild(el('div', { 'class': 'mgt-page' }, [th, el('div', { text: 'Page ' + (i + 1) }),
            el('div', { 'class': 'mgt-row', style: 'justify-content:center;margin:4px 0 0' }, [
              el('button', { 'class': 'mgt-chip', type: 'button', text: '◀', onclick: function () { if (i > 0) { pages.splice(i - 1, 0, pages.splice(i, 1)[0]); renderThumbs(); } } }),
              el('button', { 'class': 'mgt-chip', type: 'button', text: '▶', onclick: function () { if (i < pages.length - 1) { pages.splice(i + 1, 0, pages.splice(i, 1)[0]); renderThumbs(); } } }),
              el('button', { 'class': 'mgt-chip', type: 'button', text: '🗑', onclick: function () { pages.splice(i, 1); renderThumbs(); } })])]));
        });
      }
      addBtn.onclick = function () {
        if (!src) return; var fin = busy(addBtn, 'Processing…');
        setTimeout(function () {
          try { pages.push(T.applyFilter(T.warpQuad(src, quad, 2000), filter)); renderThumbs(); nextInQueue(); }
          catch (e) { notify('Could not process this page: ' + e.message); }
          fin();
        }, 30);
      };
      T.scannerPages = function () { return pages; };
      pdfBtn.onclick = async function () {
        if (!pages.length || !window.jspdf) return; var fin = busy(pdfBtn, 'Building PDF…');
        try {
          var J = window.jspdf.jsPDF, pdf = null;
          pages.forEach(function (pg, i) {
            var o = pg.width > pg.height ? 'l' : 'p';
            if (!pdf) pdf = new J({ orientation: o, unit: 'pt', format: 'a4', compress: true }); else pdf.addPage('a4', o);
            var pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), k = Math.min(pw / pg.width, ph / pg.height);
            pdf.addImage(pg.toDataURL('image/jpeg', 0.85), 'JPEG', (pw - pg.width * k) / 2, (ph - pg.height * k) / 2, pg.width * k, pg.height * k);
          });
          saveBlob(pdf.output('blob'), 'scan-' + new Date().toISOString().slice(0, 10) + '.pdf'); done();
        } catch (e) { notify('Could not build the PDF: ' + e.message); }
        fin();
      };
      imgBtn.onclick = async function () {
        if (!pages.length || !window.JSZip) return; var z = new JSZip();
        for (var i = 0; i < pages.length; i++) { var b = await toBlob(pages[i], 'image/jpeg', 0.9); z.file('page-' + (i + 1) + '.jpg', b); }
        saveBlob(await z.generateAsync({ type: 'blob' }), 'scan-pages.zip'); done();
      };
      function stopCam() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } video.style.display = 'none'; camRow.style.display = 'none'; }
      camBtn.onclick = async function () {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { notify('Camera is not available in this browser. Use "choose photos" instead.', 'No camera'); return; }
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
          video.srcObject = stream; video.style.display = 'block'; camRow.style.display = 'flex'; video.play().catch(function () {});
        } catch (e) { notify('Camera permission was denied or the camera is busy.', 'Camera'); }
      };
      close.onclick = stopCam;
      shot.onclick = function () {
        if (!video.videoWidth) return; var k = Math.min(1, 2200 / Math.max(video.videoWidth, video.videoHeight));
        var c = newCanvas(Math.round(video.videoWidth * k), Math.round(video.videoHeight * k)); c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
        stopCam(); setSource(c);
      };
      window.addEventListener('pagehide', stopCam);
      [label, camBtn, video, camRow, editor, tip, fRow, addBtn, strip, expRow].forEach(function (n) { card.appendChild(n); });
    });

  /* =================================================================
     4 + 5. PDF PAGE TOOLS  &  SIGN PDF  (pdf-lib + pdf.js)
     ================================================================= */
  T.visualSize = function (r, W, H) { r = ((r % 360) + 360) % 360; return (r % 180) ? [H, W] : [W, H]; };
  /* visual (as displayed, origin bottom-left) -> PDF user space of a page rotated by r degrees */
  T.mapV = function (r, W, H, vx, vy) {
    r = ((r % 360) + 360) % 360;
    if (r === 90) return [W - vy, vx]; if (r === 180) return [W - vx, H - vy]; if (r === 270) return [vy, H - vx]; return [vx, vy];
  };
  async function openPdfLib(bytes) {
    var d = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    if (d.isEncrypted) throw new Error('This PDF is password protected. Use "Remove PDF Password" first.');
    return d;
  }
  async function pdfThumbs(bytes, scale, each) {
    var pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    for (var i = 1; i <= pdf.numPages; i++) {
      var pg = await pdf.getPage(i), vp = pg.getViewport({ scale: scale }), c = newCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
      await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; each(i - 1, c);
    }
    return pdf.numPages;
  }
  T.pdfThumbs = pdfThumbs;

  T.buildPdf = async function (srcBytes, list, opts) {
    opts = opts || {}; var PL = PDFLib, src = await openPdfLib(srcBytes), out = await PL.PDFDocument.create();
    var copied = await out.copyPages(src, list.map(function (l) { return l.src; }));
    var font = (opts.numbers || opts.watermark) ? await out.embedFont(PL.StandardFonts.Helvetica) : null;
    for (var i = 0; i < copied.length; i++) {
      var pg = copied[i], rot = (((pg.getRotation().angle + (list[i].rot || 0)) % 360) + 360) % 360;
      pg.setRotation(PL.degrees(rot)); out.addPage(pg);
      var sz = pg.getSize(), W = sz.width, H = sz.height, vis = T.visualSize(rot, W, H), u;
      if (opts.numbers) {
        var txt = String(i + 1), size = 10, tw = font.widthOfTextAtSize(txt, size), pos = opts.numPos || 'bc', vx, vy;
        vx = pos.charAt(1) === 'c' ? vis[0] / 2 - tw / 2 : (pos.charAt(1) === 'r' ? vis[0] - 36 - tw : 36);
        vy = pos.charAt(0) === 'b' ? 24 : vis[1] - 34;
        u = T.mapV(rot, W, H, vx, vy);
        pg.drawText(txt, { x: u[0], y: u[1], size: size, font: font, color: PL.rgb(0.2, 0.2, 0.2), rotate: PL.degrees(rot) });
      }
      if (opts.watermark) {
        var wt = opts.watermark, c45 = Math.SQRT1_2, wsize = Math.min(90, (Math.min(vis[0], vis[1]) * 0.85) / Math.max(0.01, font.widthOfTextAtSize(wt, 1) * c45));
        var wtw = font.widthOfTextAtSize(wt, wsize), cx = vis[0] / 2, cy = vis[1] / 2;
        u = T.mapV(rot, W, H, cx - (wtw / 2) * c45 + (wsize * 0.3) * c45, cy - (wtw / 2) * c45 - (wsize * 0.3) * c45);
        pg.drawText(wt, { x: u[0], y: u[1], size: wsize, font: font, color: PL.rgb(0.45, 0.45, 0.5), opacity: opts.wmOpacity || 0.2, rotate: PL.degrees(rot + 45) });
      }
    }
    return out.save();
  };

  addTool('pagetools', 'PDF Page Tools', 'PDF Pages',
    ICON('<rect x="4" y="3" width="9" height="12" rx="1.5"/><rect x="11" y="9" width="9" height="12" rx="1.5"/>'),
    'Reorder, rotate and delete pages, add page numbers or a watermark, extract pages, or split a PDF into parts.',
    function (card) {
      var bytes = null, pgs = [], name = 'document';
      var input = el('input', { type: 'file', id: 'ptInput', accept: 'application/pdf', hidden: 'hidden' });
      var label = el('label', { 'class': 'upload-area', 'for': 'ptInput' }, [el('p', { text: 'Click to upload a PDF', style: 'font-weight:600' }), input]);
      var info = el('div', { 'class': 'mgt-note', id: 'ptInfo' }), grid = el('div', { 'class': 'mgt-grid', id: 'ptGrid' });
      var numChk = el('input', { type: 'checkbox', id: 'ptNum', style: 'width:auto;margin:0 6px 0 0' });
      var numPos = el('select', { id: 'ptNumPos', style: 'margin:0;max-width:170px' }, [['bc', 'Bottom centre'], ['br', 'Bottom right'], ['bl', 'Bottom left'], ['tc', 'Top centre']].map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
      var wm = el('input', { type: 'text', id: 'ptWm', placeholder: 'Watermark text (optional)', maxlength: '40', style: 'margin:0' });
      var wmOp = el('select', { id: 'ptWmOp', style: 'margin:0;max-width:110px' }, [['0.12', 'Light'], ['0.2', 'Medium'], ['0.35', 'Strong']].map(function (o) { return el('option', { value: o[0], text: o[1], selected: o[0] === '0.2' ? 'selected' : null }); }));
      var opts = el('div', { 'class': 'mgt-opts', style: 'display:none' }, [
        el('label', { style: 'display:flex;align-items:center;gap:6px;font-size:14px' }, [numChk, 'Add page numbers', numPos]),
        el('div', { 'class': 'mgt-row', style: 'margin:8px 0 0' }, [wm, wmOp])]);
      var saveBtn = el('button', { 'class': 'btn-primary', text: 'Save PDF', id: 'ptSave', style: 'display:none' });
      var exRow = el('div', { 'class': 'mgt-row', style: 'display:none' });
      var exBtn = el('button', { 'class': 'mgt-chip', type: 'button', text: 'Extract selected pages' }), nIn = el('input', { type: 'number', min: '1', value: '1', style: 'width:70px;margin:0', id: 'ptN' });
      var spBtn = el('button', { 'class': 'mgt-chip', type: 'button', text: 'Split into parts (ZIP)' });
      exRow.appendChild(exBtn); exRow.appendChild(el('span', { text: 'or every', style: 'font-size:13px;opacity:.8' })); exRow.appendChild(nIn); exRow.appendChild(el('span', { text: 'pages →', style: 'font-size:13px;opacity:.8' })); exRow.appendChild(spBtn);
      function active() { return pgs.filter(function (p) { return !p.del; }); }
      function render() {
        grid.innerHTML = ''; var n = active().length;
        info.textContent = pgs.length ? n + ' of ' + pgs.length + ' pages kept' : '';
        pgs.forEach(function (p, i) {
          var th = p.thumb; th.style.cssText = 'max-width:100%;height:auto;transition:transform .2s;transform:rotate(' + p.rot + 'deg);' + (p.rot % 180 ? 'margin:14% 0;' : '');
          var chk = el('input', { type: 'checkbox', style: 'width:auto;margin:0', onchange: function () { p.sel = chk.checked; } }); chk.checked = p.sel;
          grid.appendChild(el('div', { 'class': 'mgt-page', style: p.del ? 'opacity:.35' : '' }, [
            el('div', { style: 'overflow:hidden;min-height:60px' }, [th]),
            el('div', { style: 'display:flex;align-items:center;justify-content:center;gap:6px;margin:4px 0' }, [chk, 'Page ' + (p.src + 1)]),
            el('div', { 'class': 'mgt-row', style: 'justify-content:center;margin:0;gap:4px' }, [
              el('button', { 'class': 'mgt-chip', type: 'button', title: 'Move earlier', text: '◀', onclick: function () { if (i > 0) { pgs.splice(i - 1, 0, pgs.splice(i, 1)[0]); render(); } } }),
              el('button', { 'class': 'mgt-chip', type: 'button', title: 'Rotate left', text: '⟲', onclick: function () { p.rot = (p.rot + 270) % 360; render(); } }),
              el('button', { 'class': 'mgt-chip', type: 'button', title: 'Rotate right', text: '⟳', onclick: function () { p.rot = (p.rot + 90) % 360; render(); } }),
              el('button', { 'class': 'mgt-chip', type: 'button', title: p.del ? 'Restore' : 'Delete', text: p.del ? '↩' : '🗑', onclick: function () { p.del = !p.del; render(); } }),
              el('button', { 'class': 'mgt-chip', type: 'button', title: 'Move later', text: '▶', onclick: function () { if (i < pgs.length - 1) { pgs.splice(i + 1, 0, pgs.splice(i, 1)[0]); render(); } } })])]));
        });
      }
      T.pageToolsState = function () { return pgs; };
      input.onchange = async function () {
        if (!input.files.length) return; var f = input.files[0]; name = baseName(f.name); info.textContent = 'Reading pages…'; grid.innerHTML = '';
        try {
          bytes = await readBytes(f); await openPdfLib(bytes); pgs = [];
          await pdfThumbs(bytes, 0.35, function (i, c) { pgs.push({ src: i, rot: 0, del: false, sel: false, thumb: c }); if (i < 60 || i % 10 === 0) render(); });
          render(); opts.style.display = 'block'; saveBtn.style.display = 'block'; exRow.style.display = 'flex';
        } catch (e) { bytes = null; pgs = []; info.textContent = ''; notify(e.message || 'Could not read this PDF.', 'PDF error'); }
      };
      function options() { return { numbers: numChk.checked, numPos: numPos.value, watermark: wm.value.trim(), wmOpacity: Number(wmOp.value) }; }
      function lst(list) { return list.map(function (p) { return { src: p.src, rot: p.rot }; }); }
      saveBtn.onclick = async function () {
        var l = active(); if (!bytes || !l.length) { notify('Keep at least one page.', 'No pages'); return; }
        var fin = busy(saveBtn, 'Saving…');
        try { saveBlob(new Blob([await T.buildPdf(bytes, lst(l), options())], { type: 'application/pdf' }), name + '-edited.pdf'); done(); }
        catch (e) { notify('Could not save: ' + e.message); } fin();
      };
      exBtn.onclick = async function () {
        var l = active().filter(function (p) { return p.sel; }); if (!l.length) { notify('Tick the pages you want to extract.', 'Nothing selected'); return; }
        var fin = busy(exBtn, 'Extracting…');
        try { saveBlob(new Blob([await T.buildPdf(bytes, lst(l), options())], { type: 'application/pdf' }), name + '-extract.pdf'); done(); } catch (e) { notify('Could not extract: ' + e.message); } fin();
      };
      spBtn.onclick = async function () {
        var l = active(), n = Math.max(1, Number(nIn.value) || 1); if (!l.length) return; var fin = busy(spBtn, 'Splitting…');
        try {
          var z = new JSZip(), part = 1;
          for (var i = 0; i < l.length; i += n) z.file(name + '-part' + (part++) + '.pdf', await T.buildPdf(bytes, lst(l.slice(i, i + n)), {}));
          saveBlob(await z.generateAsync({ type: 'blob' }), name + '-parts.zip'); done();
        } catch (e) { notify('Could not split: ' + e.message); } fin();
      };
      [label, info, grid, opts, saveBtn, exRow].forEach(function (n) { card.appendChild(n); });
    });

  /* ---------------- Sign PDF ---------------- */
  addTool('signpdf', 'Sign PDF', 'Sign PDF',
    ICON('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    'Draw your signature, drop it on the page where it belongs, and save the signed PDF.',
    function (card) {
      var bytes = null, pdfDoc = null, pageNo = 1, total = 0, viewScale = 1, sig = null, placed = [], name = 'document';
      var input = el('input', { type: 'file', id: 'sgInput', accept: 'application/pdf', hidden: 'hidden' });
      var label = el('label', { 'class': 'upload-area', 'for': 'sgInput' }, [el('p', { text: 'Click to upload a PDF to sign', style: 'font-weight:600' }), input]);
      // signature pad
      var pad = el('canvas', { id: 'sgPad', width: 600, height: 200, style: 'width:100%;max-width:420px;height:auto;border:1px dashed rgba(139,92,246,.6);border-radius:12px;background:#fff;touch-action:none;display:block;margin:10px 0' });
      var colour = el('select', { style: 'margin:0;max-width:110px' }, [['#111111', 'Black'], ['#1d4ed8', 'Blue']].map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
      var clearBtn = el('button', { 'class': 'mgt-chip', type: 'button', text: 'Clear' }), useBtn = el('button', { 'class': 'mgt-chip on', type: 'button', text: 'Use this signature', id: 'sgUse' });
      var upl = el('input', { type: 'file', accept: 'image/*', style: 'display:none' }), uplBtn = el('button', { 'class': 'mgt-chip', type: 'button', text: 'Upload image instead' });
      var padRow = el('div', { 'class': 'mgt-row' }, [colour, clearBtn, useBtn, uplBtn, upl]);
      var pg = el('div', { 'class': 'mgt-note', id: 'sgInfo' });
      var nav = el('div', { 'class': 'mgt-row', style: 'display:none;align-items:center' });
      var prev = el('button', { 'class': 'mgt-chip', type: 'button', text: '◀ Prev' }), next = el('button', { 'class': 'mgt-chip', type: 'button', text: 'Next ▶' }), pnum = el('span', { style: 'font-size:13px' });
      var size = el('input', { type: 'range', min: '8', max: '60', value: '24', style: 'flex:1;margin:0;min-width:120px' }), placeBtn = el('button', { 'class': 'btn-primary', type: 'button', text: 'Place on this page', id: 'sgPlace', style: 'margin:0;width:auto;padding:10px 16px' });
      [prev, pnum, next, el('span', { text: 'Size', style: 'font-size:13px;opacity:.8' }), size, placeBtn].forEach(function (n) { nav.appendChild(n); });
      var wrap = el('div', { id: 'sgWrap', style: 'position:relative;display:none;margin:10px auto;max-width:100%;touch-action:none;line-height:0' });
      var pageCv = el('canvas', { id: 'sgPage', style: 'max-width:100%;height:auto;border-radius:6px;box-shadow:0 4px 18px rgba(0,0,0,.35)' });
      var ghost = el('img', { id: 'sgGhost', style: 'position:absolute;left:10%;top:10%;width:24%;display:none;cursor:move;outline:2px dashed #a855f7;touch-action:none;user-select:none' });
      wrap.appendChild(pageCv); wrap.appendChild(ghost);
      var count = el('div', { 'class': 'mgt-note', id: 'sgCount' });
      var saveBtn = el('button', { 'class': 'btn-primary', type: 'button', text: 'Save signed PDF', id: 'sgSave', style: 'display:none' });

      // drawing
      var pctx = pad.getContext('2d'), down = false, last = null;
      function pp(e) { var r = pad.getBoundingClientRect(); return [(e.clientX - r.left) * pad.width / r.width, (e.clientY - r.top) * pad.height / r.height]; }
      pad.onpointerdown = function (e) { down = true; last = pp(e); pad.setPointerCapture(e.pointerId); pctx.fillStyle = colour.value; pctx.beginPath(); pctx.arc(last[0], last[1], 1.8, 0, 7); pctx.fill(); };
      pad.onpointermove = function (e) {
        if (!down) return; var p = pp(e); pctx.strokeStyle = colour.value; pctx.lineWidth = 3.6; pctx.lineCap = pctx.lineJoin = 'round';
        pctx.beginPath(); pctx.moveTo(last[0], last[1]); pctx.lineTo(p[0], p[1]); pctx.stroke(); last = p;
      };
      pad.onpointerup = pad.onpointercancel = function () { down = false; };
      clearBtn.onclick = function () { pctx.clearRect(0, 0, pad.width, pad.height); };
      function trimmed(canvas) {
        var w = canvas.width, h = canvas.height, d = canvas.getContext('2d').getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 < 0) return null; var pad8 = 6; x0 = Math.max(0, x0 - pad8); y0 = Math.max(0, y0 - pad8); x1 = Math.min(w - 1, x1 + pad8); y1 = Math.min(h - 1, y1 + pad8);
        var c = newCanvas(x1 - x0 + 1, y1 - y0 + 1); c.getContext('2d').drawImage(canvas, x0, y0, c.width, c.height, 0, 0, c.width, c.height); return c;
      }
      function setSig(canvas) {
        var t = trimmed(canvas); if (!t) { notify('Draw your signature first.', 'Empty'); return; }
        sig = { url: t.toDataURL('image/png'), ar: t.height / t.width }; ghost.src = sig.url; ghost.style.display = wrap.style.display === 'none' ? 'none' : 'block'; sizeGhost();
      }
      T.signSetFromPad = function () { setSig(pad); };
      useBtn.onclick = function () { setSig(pad); };
      uplBtn.onclick = function () { upl.click(); };
      upl.onchange = async function () {
        if (!upl.files.length) return; var b = await loadBitmap(upl.files[0]), k = Math.min(1, 700 / b.width), c = drawScaled(b, Math.round(b.width * k), Math.round(b.height * k)), x = c.getContext('2d'), im = x.getImageData(0, 0, c.width, c.height), d = im.data;
        for (var i = 0; i < d.length; i += 4) { var lum = (d[i] + d[i + 1] + d[i + 2]) / 3; if (lum > 225) d[i + 3] = 0; else if (lum > 170) d[i + 3] = Math.round((225 - lum) / 55 * 255); }
        x.putImageData(im, 0, 0); setSig(c);
      };
      function sizeGhost() { if (!sig) return; ghost.style.width = size.value + '%'; ghost.style.height = 'auto'; }
      size.oninput = sizeGhost;
      var gd = null;
      ghost.onpointerdown = function (e) { var r = wrap.getBoundingClientRect(), g = ghost.getBoundingClientRect(); gd = { dx: e.clientX - g.left, dy: e.clientY - g.top }; ghost.setPointerCapture(e.pointerId); e.preventDefault(); };
      ghost.onpointermove = function (e) {
        if (!gd) return; var r = wrap.getBoundingClientRect(), g = ghost.getBoundingClientRect();
        var x = Math.min(Math.max(0, e.clientX - gd.dx - r.left), r.width - g.width), y = Math.min(Math.max(0, e.clientY - gd.dy - r.top), r.height - g.height);
        ghost.style.left = (x / r.width * 100) + '%'; ghost.style.top = (y / r.height * 100) + '%';
      };
      ghost.onpointerup = ghost.onpointercancel = function () { gd = null; };

      async function showPage() {
        var p = await pdfDoc.getPage(pageNo), base = p.getViewport({ scale: 1 }); viewScale = Math.min(2, 760 / base.width);
        var vp = p.getViewport({ scale: viewScale }); pageCv.width = Math.ceil(vp.width); pageCv.height = Math.ceil(vp.height);
        await p.render({ canvasContext: pageCv.getContext('2d'), viewport: vp }).promise;
        pnum.textContent = 'Page ' + pageNo + ' of ' + total; wrap.style.display = 'block'; nav.style.display = 'flex';
        Array.prototype.slice.call(wrap.querySelectorAll('.sg-placed')).forEach(function (n) { n.remove(); });
        placed.forEach(function (pl) {
          if (pl.page !== pageNo) return;
          wrap.appendChild(el('img', { 'class': 'sg-placed', src: pl.url, style: 'position:absolute;pointer-events:none;left:' + pl.xr * 100 + '%;top:' + pl.yr * 100 + '%;width:' + pl.wr * 100 + '%;height:auto' }));
        });
        ghost.style.display = sig ? 'block' : 'none';
      }
      T.signShowPage = showPage;
      input.onchange = async function () {
        if (!input.files.length) return; var f = input.files[0]; name = baseName(f.name); placed = []; count.textContent = '';
        try {
          bytes = await readBytes(f); await openPdfLib(bytes); pdfDoc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise; total = pdfDoc.numPages; pageNo = 1;
          await showPage(); saveBtn.style.display = 'block'; pg.textContent = 'Draw a signature above, tap "Use this signature", drag it into place, then "Place on this page".';
        } catch (e) { notify(e.message || 'Could not open this PDF.', 'PDF error'); }
      };
      prev.onclick = function () { if (pageNo > 1) { pageNo--; showPage(); } };
      next.onclick = function () { if (pageNo < total) { pageNo++; showPage(); } };
      placeBtn.onclick = function () {
        if (!sig) { notify('Create your signature first (draw it and tap "Use this signature").', 'No signature'); return; }
        var r = wrap.getBoundingClientRect(), g = ghost.getBoundingClientRect();
        placed.push({ page: pageNo, url: sig.url, ar: sig.ar, xr: (g.left - r.left) / r.width, yr: (g.top - r.top) / r.height, wr: g.width / r.width });
        count.textContent = placed.length + ' signature(s) placed.'; showPage();
      };
      T.signPlaceholders = function () { return placed; };
      saveBtn.onclick = async function () {
        if (!placed.length) { notify('Tap "Place on this page" to put your signature on the PDF first.', 'Nothing placed'); return; }
        var fin = busy(saveBtn, 'Signing…');
        try {
          var doc = await openPdfLib(bytes), cache = {};
          for (var i = 0; i < placed.length; i++) {
            var pl = placed[i], img = cache[pl.url] || (cache[pl.url] = await doc.embedPng(pl.url)), page = doc.getPage(pl.page - 1), sz = page.getSize(), rot = page.getRotation().angle, vis = T.visualSize(rot, sz.width, sz.height);
            var vw = pl.wr * vis[0], vh = vw * pl.ar, vx = pl.xr * vis[0], vy = vis[1] - pl.yr * vis[1] - vh, u = T.mapV(rot, sz.width, sz.height, vx, vy);
            page.drawImage(img, { x: u[0], y: u[1], width: vw, height: vh, rotate: PDFLib.degrees(rot) });
          }
          saveBlob(new Blob([await doc.save()], { type: 'application/pdf' }), name + '-signed.pdf'); done();
        } catch (e) { notify('Could not sign the PDF: ' + e.message); }
        fin();
      };
      [label, el('p', { text: 'Your signature', style: 'font-size:13px;opacity:.8;margin:14px 0 0' }), pad, padRow, pg, nav, wrap, count, saveBtn].forEach(function (n) { card.appendChild(n); });
    });

  /* =================================================================
     6. REMOVE PHOTO LOCATION / METADATA (EXIF)
     ================================================================= */
  function readTiff(u8, base, res) {
    var le = u8[base] === 0x49;
    function r16(o) { return le ? (u8[o] | (u8[o + 1] << 8)) : ((u8[o] << 8) | u8[o + 1]); }
    function r32(o) { return (le ? (u8[o] | (u8[o + 1] << 8) | (u8[o + 2] << 16) | (u8[o + 3] << 24)) : ((u8[o] << 24) | (u8[o + 1] << 16) | (u8[o + 2] << 8) | u8[o + 3])) >>> 0; }
    function str(o, n) { var s = ''; for (var i = 0; i < n; i++) { var c = u8[o + i]; if (!c) break; s += String.fromCharCode(c); } return s.trim(); }
    function entries(off) {
      var o = base + off, n = r16(o), out = []; if (!n || n > 400) return out;
      for (var i = 0; i < n; i++) { var e = o + 2 + i * 12; if (e + 12 > u8.length) break; out.push({ tag: r16(e), type: r16(e + 2), cnt: r32(e + 4), at: e + 8 }); }
      return out;
    }
    function strVal(e) { return str(e.cnt > 4 ? base + r32(e.at) : e.at, e.cnt); }
    entries(r32(base + 4)).forEach(function (e) {
      if (e.tag === 0x010F) res.make = strVal(e); else if (e.tag === 0x0110) res.model = strVal(e);
      else if (e.tag === 0x0112) res.orientation = r16(e.at);
      else if (e.tag === 0x8825) entries(r32(e.at)).forEach(function (g) { if (g.tag === 0x0002 || g.tag === 0x0004) res.gps = true; });
      else if (e.tag === 0x8769) entries(r32(e.at)).forEach(function (x) { if (x.tag === 0x9003) res.date = strVal(x); });
    });
  }
  T.parseExif = function (u8) {
    var res = { gps: false, make: '', model: '', date: '', orientation: 1, hasMeta: false };
    if (u8[0] !== 0xFF || u8[1] !== 0xD8) return res;
    var off = 2;
    while (off + 4 < u8.length) {
      if (u8[off] !== 0xFF) { off++; continue; }
      var m = u8[off + 1]; if (m === 0xDA || m === 0xD9) break;
      if (m === 0xD8 || (m >= 0xD0 && m <= 0xD7) || m === 0x01) { off += 2; continue; }
      var len = (u8[off + 2] << 8) | u8[off + 3];
      if (m === 0xE1) {
        res.hasMeta = true;
        if (u8[off + 4] === 0x45 && u8[off + 5] === 0x78 && u8[off + 6] === 0x69 && u8[off + 7] === 0x66) { try { readTiff(u8, off + 10, res); } catch (e) {} }
      }
      off += 2 + len;
    }
    return res;
  };
  T.stripJpeg = function (u8) {
    var parts = [u8.subarray(0, 2)], off = 2;
    while (off < u8.length) {
      if (u8[off] !== 0xFF) { parts.push(u8.subarray(off)); break; }
      var m = u8[off + 1];
      if (m === 0xDA) { parts.push(u8.subarray(off)); break; }
      if (m === 0xD8 || (m >= 0xD0 && m <= 0xD7) || m === 0x01 || m === 0xD9) { parts.push(u8.subarray(off, off + 2)); off += 2; continue; }
      var len = (u8[off + 2] << 8) | u8[off + 3], drop = m === 0xE1 || m === 0xFE || (m >= 0xE3 && m <= 0xED);
      if (!drop) parts.push(u8.subarray(off, off + 2 + len));
      off += 2 + len;
    }
    var total = parts.reduce(function (s, p) { return s + p.length; }, 0), out = new Uint8Array(total), p0 = 0;
    parts.forEach(function (p) { out.set(p, p0); p0 += p.length; }); return out;
  };
  T.stripPng = function (u8) {
    var sig = [0x89, 0x50, 0x4E, 0x47]; for (var s = 0; s < 4; s++) if (u8[s] !== sig[s]) return null;
    var parts = [u8.subarray(0, 8)], off = 8, bad = { eXIf: 1, tEXt: 1, iTXt: 1, zTXt: 1, tIME: 1 };
    while (off + 8 <= u8.length) {
      var len = ((u8[off] << 24) | (u8[off + 1] << 16) | (u8[off + 2] << 8) | u8[off + 3]) >>> 0, type = String.fromCharCode(u8[off + 4], u8[off + 5], u8[off + 6], u8[off + 7]);
      if (!bad[type]) parts.push(u8.subarray(off, off + 12 + len));
      off += 12 + len; if (type === 'IEND') break;
    }
    var total = parts.reduce(function (s, p) { return s + p.length; }, 0), out = new Uint8Array(total), p0 = 0;
    parts.forEach(function (p) { out.set(p, p0); p0 += p.length; }); return out;
  };
  T.cleanImage = async function (file) {
    var u8 = await readBytes(file), type = file.type, ext = (file.name.split('.').pop() || '').toLowerCase();
    if (type === 'image/jpeg' || ext === 'jpg' || ext === 'jpeg') {
      var info = T.parseExif(u8);
      if (info.orientation <= 1) return { blob: new Blob([T.stripJpeg(u8)], { type: 'image/jpeg' }), ext: 'jpg', lossless: true };
    } else if (type === 'image/png' || ext === 'png') {
      var p = T.stripPng(u8); if (p) return { blob: new Blob([p], { type: 'image/png' }), ext: 'png', lossless: true };
    }
    var bmp = await loadBitmap(file), c = drawScaled(bmp, bmp.width, bmp.height), out = type === 'image/webp' && webpOK() ? 'image/webp' : (type === 'image/png' ? 'image/png' : 'image/jpeg');
    if (bmp.close) bmp.close(); return { blob: await toBlob(c, out, 0.95), ext: out === 'image/webp' ? 'webp' : (out === 'image/png' ? 'png' : 'jpg'), lossless: false };
  };

  addTool('exif', 'Remove Photo Location', 'Remove Location',
    ICON('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/><path d="m3 3 18 18"/>'),
    'Photos often hide your GPS location, phone model and time. Check what is inside and remove it before you share.',
    function (card) {
      var input = el('input', { type: 'file', id: 'exInput', accept: 'image/jpeg,image/png,image/webp', multiple: 'multiple', hidden: 'hidden' });
      var label = el('label', { 'class': 'upload-area', 'for': 'exInput' }, [el('p', { text: 'Click to upload photos (JPG, PNG, WebP)', style: 'font-weight:600' }), input]);
      var report = el('div', { id: 'exReport' }), btn = el('button', { 'class': 'btn-primary', text: 'Remove data & download', id: 'exBtn' }), results = ResultList(card);
      input.onchange = async function () {
        report.innerHTML = ''; results.clear();
        for (var i = 0; i < input.files.length; i++) {
          var f = input.files[i], badges = [];
          if (f.type === 'image/jpeg') {
            var inf = T.parseExif(await readBytes(f));
            if (inf.gps) badges.push('📍 GPS location found'); if (inf.make || inf.model) badges.push('📷 ' + (inf.make + ' ' + inf.model).trim()); if (inf.date) badges.push('🕒 ' + inf.date);
            if (!badges.length) badges.push(inf.hasMeta ? 'Other hidden data' : 'No location data found');
          } else badges.push('Metadata will be removed');
          report.appendChild(el('div', { 'class': 'mgt-item' }, [el('div', { style: 'flex:1;word-break:break-all' }, [el('div', { text: f.name, style: 'font-weight:600' }), el('div', { text: badges.join(' · '), style: 'opacity:.8;font-size:12px' })])]));
        }
      };
      btn.onclick = async function () {
        if (!input.files.length) { notify('Please choose at least one photo.', 'No photo'); return; }
        var fin = busy(btn, 'Cleaning…'); results.clear();
        try {
          for (var i = 0; i < input.files.length; i++) {
            var f = input.files[i]; fin.update('Cleaning ' + (i + 1) + ' of ' + input.files.length + '…');
            var r = await T.cleanImage(f); results.add(baseName(f.name) + '-clean.' + r.ext, r.blob, r.lossless ? 'quality unchanged' : 're-saved');
          }
          done();
        } catch (e) { notify('Could not clean this photo: ' + e.message); }
        fin();
      };
      card.insertBefore(label, card.firstChild); var a = card.querySelector('.mgt-list'); card.insertBefore(report, a); card.insertBefore(btn, a);
    });

  /* =================================================================
     8. QR SCANNER
     ================================================================= */
  T.decodeQR = async function (source) {
    if ('BarcodeDetector' in window) {
      try { var det = new BarcodeDetector({ formats: ['qr_code'] }), r = await det.detect(source); if (r.length) return r[0].rawValue; } catch (e) {}
    }
    await window.mgLoadScript('lib-jsqr.js');
    var w = source.width || source.videoWidth, h = source.height || source.videoHeight, k = Math.min(1, 900 / Math.max(w, h)), c = newCanvas(Math.round(w * k), Math.round(h * k)), x = c.getContext('2d');
    x.drawImage(source, 0, 0, c.width, c.height); var id = x.getImageData(0, 0, c.width, c.height), res = window.jsQR(id.data, id.width, id.height, { inversionAttempts: 'attemptBoth' });
    return res ? res.data : null;
  };
  addTool('qrscan', 'QR Code Scanner', 'QR Scanner',
    ICON('<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="8" y="8" width="3" height="3"/><rect x="13" y="13" width="3" height="3"/>'),
    'Scan a QR code with your camera or from a saved image. Nothing is uploaded.',
    function (card) {
      var stream = null, timer = null;
      var input = el('input', { type: 'file', id: 'qsInput', accept: 'image/*', hidden: 'hidden' });
      var label = el('label', { 'class': 'upload-area', 'for': 'qsInput' }, [el('p', { text: 'Click to choose an image with a QR code', style: 'font-weight:600' }), input]);
      var camBtn = el('button', { 'class': 'btn-primary', type: 'button', text: '📷 Scan with camera', id: 'qsCam' }), stopBtn = el('button', { 'class': 'mgt-chip', type: 'button', text: 'Stop camera', style: 'display:none' });
      var video = el('video', { playsinline: '', muted: '', autoplay: '', style: 'display:none;width:100%;max-width:420px;border-radius:12px;margin:10px auto;background:#000' });
      var out = el('div', { id: 'qsResult', style: 'margin-top:12px' });
      function show(text) {
        out.innerHTML = ''; var box = el('div', { 'class': 'mgt-item', style: 'flex-direction:column;align-items:stretch' });
        box.appendChild(el('div', { 'class': 'allow-select', id: 'qsText', text: text, style: 'word-break:break-all;font-weight:600' }));
        var r = el('div', { 'class': 'mgt-row', style: 'margin:8px 0 0' });
        r.appendChild(el('button', { 'class': 'mgt-chip on', type: 'button', text: 'Copy', onclick: function () { if (navigator.clipboard) navigator.clipboard.writeText(text); } }));
        if (/^https?:\/\//i.test(text)) { r.appendChild(el('a', { 'class': 'mgt-chip', href: text, target: '_blank', rel: 'noopener noreferrer', text: 'Open link', style: 'text-decoration:none' })); box.appendChild(el('div', { 'class': 'mgt-note', text: 'Check the address before you open it.' })); }
        box.appendChild(r); out.appendChild(box); done();
      }
      function stop() { clearInterval(timer); timer = null; if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } video.style.display = 'none'; stopBtn.style.display = 'none'; }
      input.onchange = async function () {
        if (!input.files.length) return; out.textContent = 'Reading…';
        try { var b = await loadBitmap(input.files[0]), txt = await T.decodeQR(b); if (txt) show(txt); else out.textContent = 'No QR code found in this image.'; } catch (e) { out.textContent = 'Could not read this image.'; }
      };
      camBtn.onclick = async function () {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { notify('Camera is not available here. Choose an image instead.', 'No camera'); return; }
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
          video.srcObject = stream; video.style.display = 'block'; stopBtn.style.display = 'inline-block'; video.play().catch(function () {}); out.textContent = 'Point the camera at a QR code…';
          var busyScan = false;
          timer = setInterval(async function () {
            if (busyScan || !video.videoWidth) return; busyScan = true;
            try { var t = await T.decodeQR(video); if (t) { stop(); show(t); } } catch (e) {} busyScan = false;
          }, 300);
        } catch (e) { notify('Camera permission was denied or the camera is busy.', 'Camera'); }
      };
      stopBtn.onclick = stop; window.addEventListener('pagehide', stop);
      [label, camBtn, stopBtn, video, out].forEach(function (n) { card.appendChild(n); });
    });

  /* =================================================================
     INIT – adds the chips + sections to the page
     ================================================================= */
  var CSS = '.mgt-row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;align-items:center}' +
    '.mgt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:10px}.mgt-grid3{grid-template-columns:repeat(3,1fr);gap:8px}' +
    '.mgt-chip{padding:8px 14px;border-radius:999px;border:1px solid rgba(139,92,246,.45);background:transparent;color:var(--text,#e5e7eb);cursor:pointer;font:600 13px/1.2 inherit;font-family:inherit}' +
    '.mgt-chip.on{background:var(--purple,#8b5cf6);color:#fff;border-color:var(--purple,#8b5cf6)}' +
    '.mgt-note{font-size:13px;opacity:.85;margin:8px 0;text-align:left}' +
    '.mgt-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid rgba(139,92,246,.25);border-radius:12px;margin-top:8px;font-size:13px;text-align:left}' +
    '.mgt-page{border:1px solid rgba(139,92,246,.25);border-radius:12px;padding:6px;text-align:center;font-size:12px;background:rgba(139,92,246,.05)}' +
    '.mgt-checker{background:repeating-conic-gradient(#8885 0 25%,#0000 0 50%) 50%/18px 18px}' +
    '#sgWrap img,#sgWrap canvas{user-select:none;-webkit-user-select:none}';
  function init() {
    var grid = $('allToolsGrid'), foot = document.querySelector('footer');
    if (!grid || !foot || $('compress')) return;
    document.head.appendChild(el('style', { id: 'mgt-css', text: CSS }));
    TOOLS_META.forEach(function (t) {
      var chip = el('a', { href: '#' + t.id, 'class': 'tool-chip', html: t.icon + '<span>' + t.chip + '</span>' });
      chip.addEventListener('click', function () { if (typeof window.recordToolUse === 'function') window.recordToolUse(t.title, '#' + t.id); });
      grid.appendChild(chip);
      var h2 = el('h2', { id: t.id, 'class': 'section-title', text: t.title }), card = el('div', { 'class': 'card' });
      card.appendChild(el('p', { 'class': 'subtitle', style: 'text-align:left;margin-bottom:15px', text: t.sub }));
      try { t.build(card); } catch (e) { console.error('Tool failed to build:', t.id, e); }
      foot.parentNode.insertBefore(h2, foot); foot.parentNode.insertBefore(card, foot);
    });
    window.mgToolIds = TOOLS_META.map(function (t) { return t.id; });
    T.ready = true; document.dispatchEvent(new Event('mgtools-ready'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
