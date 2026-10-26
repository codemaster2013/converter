/* MediaGrabber Pro – all-in-one PDF converter engine (runs fully in the browser, nothing is uploaded).
   Word (.docx) · PowerPoint (.pptx) · images · text / HTML  ->  PDF
   PDF  ->  Word (.docx) · PowerPoint (.pptx) · images (JPG/PNG) · text
   Excel files are intentionally not supported.
   Needs: JSZip, jsPDF (window.jspdf), pdf.js (pdfjsLib) – all already loaded by index.html.
   window.MGDocConv = { detect, targetsFor, convert }                                                    */
(function (root) {
  'use strict';

  /* ======================= small helpers ======================= */
  var EXT = function (n) { var m = /\.([a-z0-9]+)$/i.exec(n || ''); return m ? m[1].toLowerCase() : ''; };
  var BASE = function (n) { return (n || 'file').replace(/\.[^.]+$/, ''); };
  function parseXml(s) { return new DOMParser().parseFromString(s, 'application/xml'); }
  function chs(el, name) { var o = []; if (!el) return o; for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (!name || c.localName === name) o.push(c); return o; }
  function ch(el, name) { if (!el) return null; for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === name) return c; return null; }
  function path(el, names) { for (var i = 0; i < names.length && el; i++) el = ch(el, names[i]); return el; }
  function at(el, name) { if (!el) return null; var a = el.attributes; for (var i = 0; i < a.length; i++) if (a[i].localName === name) return a[i].value; return null; }
  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }
  function zipText(zip, p) { var f = zip.file(p); return f ? f.async('string') : Promise.resolve(null); }
  function dirOf(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i + 1); }
  function resolve(base, target) {
    if (/^\//.test(target)) return target.slice(1);
    var parts = (dirOf(base) + target).split('/'), out = [];
    parts.forEach(function (s) { if (s === '..') out.pop(); else if (s !== '.' && s !== '') out.push(s); });
    return out.join('/');
  }
  async function readRels(zip, partPath) {
    var rp = dirOf(partPath) + '_rels/' + partPath.slice(partPath.lastIndexOf('/') + 1) + '.rels', xml = await zipText(zip, rp), map = {};
    if (!xml) return map;
    chs(parseXml(xml).documentElement, 'Relationship').forEach(function (r) {
      var t = at(r, 'Target'); if (at(r, 'TargetMode') === 'External') return;
      map[at(r, 'Id')] = { target: resolve(partPath, t), type: (at(r, 'Type') || '').split('/').pop() };
    });
    return map;
  }
  function esc(s) { return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function canvasOf(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function toBlob(c, type, q) { return new Promise(function (res) { c.toBlob(res, type, q); }); }
  function mimeOfBytes(u) {
    if (u[0] === 0xFF && u[1] === 0xD8) return 'image/jpeg';
    if (u[0] === 0x89 && u[1] === 0x50) return 'image/png';
    if (u[0] === 0x47 && u[1] === 0x49) return 'image/gif';
    if (u[0] === 0x42 && u[1] === 0x4D) return 'image/bmp';
    if (u[0] === 0x52 && u[1] === 0x49 && u[8] === 0x57) return 'image/webp';
    if (u[0] === 0x3C) return 'image/svg+xml';
    return '';
  }
  function loadImage(blob) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(blob), i = new Image();
      i.onload = function () { URL.revokeObjectURL(url); res(i); };
      i.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Could not read an image inside the file.')); };
      i.src = url;
    });
  }
  /* decodes image bytes into a canvas (so any browser-supported format works, and cropping is easy) */
  async function bytesToCanvas(bytes, mime, crop) {
    var m = mime || mimeOfBytes(bytes); if (!m) throw new Error('unsupported image');
    var img = await loadImage(new Blob([bytes], { type: m }));
    var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, sx = 0, sy = 0, sw = W, sh = H;
    if (crop) { sx = W * crop.l; sy = H * crop.t; sw = W * (1 - crop.l - crop.r); sh = H * (1 - crop.t - crop.b); if (sw < 1 || sh < 1) { sx = 0; sy = 0; sw = W; sh = H; } }
    var maxSide = 3000, k = Math.min(1, maxSide / Math.max(sw, sh)), c = canvasOf(sw * k, sh * k);
    c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    c.__mime = m; return c;
  }
  function hasAlpha(c) { try { var d = c.getContext('2d').getImageData(0, 0, Math.min(c.width, 64), Math.min(c.height, 64)).data; for (var i = 3; i < d.length; i += 4) if (d[i] < 250) return true; } catch (e) {} return false; }
  function canvasData(c) { return (c.__mime === 'image/png' || c.__mime === 'image/gif' || c.__mime === 'image/webp' || c.__mime === 'image/svg+xml') && hasAlpha(c) ? { url: c.toDataURL('image/png'), fmt: 'PNG' } : { url: c.toDataURL('image/jpeg', 0.9), fmt: 'JPEG' }; }

  /* characters jsPDF's built-in fonts can draw (Latin-1 + common Windows-1252 punctuation) */
  var CP1252 = '\u2018\u2019\u201C\u201D\u2013\u2014\u2022\u2026\u20AC\u2122\u201A\u201E\u2020\u2021\u2030\u2039\u203A\u02C6\u02DC\u0160\u0161\u017D\u017E\u0152\u0153\u0178';
  function needsUnicode(str) { for (var i = 0; i < str.length; i++) { var c = str.charCodeAt(i); if (c > 255 && CP1252.indexOf(str.charAt(i)) < 0 && c !== 0x2009 && c !== 0x202F && c !== 0x2011 && c !== 0x200B) return true; } return false; }
  function cleanText(s) { return String(s).replace(/[\u2009\u202F\u00A0\u2002\u2003]/g, ' ').replace(/\u2011/g, '-').replace(/[\u200B\u200C\u200D\uFEFF]/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); }
  function hexRgb(h) { h = (h || '#000000').replace('#', ''); if (h.length === 3) h = h.replace(/(.)/g, '$1$1'); return [parseInt(h.substr(0, 2), 16) || 0, parseInt(h.substr(2, 2), 16) || 0, parseInt(h.substr(4, 2), 16) || 0]; }

  /* ======================= output backends ======================= */
  /* Vector: real, selectable text through jsPDF's standard fonts. */
  function VecBackend() {
    var J = root.jspdf && root.jspdf.jsPDF; if (!J) throw new Error('PDF library is not loaded.');
    var doc = null, self = { unicode: false };
    function style(b, i) { return b && i ? 'bolditalic' : b ? 'bold' : i ? 'italic' : 'normal'; }
    self.newPage = function (w, h) {
      var o = w > h ? 'l' : 'p';
      if (!doc) doc = new J({ unit: 'pt', format: [w, h], orientation: o, compress: true }); else doc.addPage([w, h], o);
      self.w = w; self.h = h;
    };
    self.measure = function (t, size, b, i) { doc.setFont('helvetica', style(b, i)); doc.setFontSize(size); return doc.getTextWidth(t); };
    self.text = function (x, y, t, size, b, i, color, u) {
      var c = hexRgb(color); doc.setTextColor(c[0], c[1], c[2]); doc.setFont('helvetica', style(b, i)); doc.setFontSize(size);
      doc.text(t, x, y, { baseline: 'alphabetic' });
      if (u) { var w = doc.getTextWidth(t); doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(Math.max(0.5, size / 18)); doc.line(x, y + size * 0.12, x + w, y + size * 0.12); }
    };
    self.rect = function (x, y, w, h, fill, stroke, lw, round) {
      if (fill) { var f = hexRgb(fill); doc.setFillColor(f[0], f[1], f[2]); }
      if (stroke) { var s = hexRgb(stroke); doc.setDrawColor(s[0], s[1], s[2]); doc.setLineWidth(lw || 0.75); }
      var mode = fill && stroke ? 'FD' : fill ? 'F' : stroke ? 'S' : null; if (!mode) return;
      if (round) doc.roundedRect(x, y, w, h, round, round, mode); else doc.rect(x, y, w, h, mode);
    };
    self.ellipse = function (x, y, w, h, fill, stroke, lw) {
      if (fill) { var f = hexRgb(fill); doc.setFillColor(f[0], f[1], f[2]); }
      if (stroke) { var s = hexRgb(stroke); doc.setDrawColor(s[0], s[1], s[2]); doc.setLineWidth(lw || 0.75); }
      var mode = fill && stroke ? 'FD' : fill ? 'F' : stroke ? 'S' : null; if (mode) doc.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, mode);
    };
    self.line = function (x1, y1, x2, y2, color, lw) { var c = hexRgb(color); doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(lw || 0.75); doc.line(x1, y1, x2, y2); };
    self.image = function (canvas, x, y, w, h) { var d = canvasData(canvas); doc.addImage(d.url, d.fmt, x, y, w, h, undefined, 'FAST'); };
    self.finish = function () { return doc ? doc.output('blob') : null; };
    return self;
  }
  /* Raster: every page is drawn on a canvas (works for any language – Hindi, Gujarati, Arabic, Chinese…). */
  function CanvasBackend() {
    var J = root.jspdf && root.jspdf.jsPDF; if (!J) throw new Error('PDF library is not loaded.');
    var pages = [], cv = null, g = null, K = 2, self = { unicode: true };
    var FAM = '"Noto Sans","Segoe UI","Nirmala UI","Mangal",Roboto,Arial,"Helvetica Neue",sans-serif';
    function font(size, b, i) { return (i ? 'italic ' : '') + (b ? 'bold ' : '') + (size * K) + 'px ' + FAM; }
    self.newPage = function (w, h) {
      K = Math.min(2, 2600 / Math.max(w, h));
      cv = canvasOf(w * K, h * K); g = cv.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height);
      pages.push({ c: cv, w: w, h: h }); self.w = w; self.h = h;
    };
    self.measure = function (t, size, b, i) { g.font = font(size, b, i); return g.measureText(t).width / K; };
    self.text = function (x, y, t, size, b, i, color, u) {
      g.font = font(size, b, i); g.fillStyle = color || '#000'; g.textBaseline = 'alphabetic'; g.fillText(t, x * K, y * K);
      if (u) { var w = g.measureText(t).width; g.fillRect(x * K, (y + size * 0.1) * K, w, Math.max(1, size * K / 18)); }
    };
    function path(round, x, y, w, h) {
      g.beginPath();
      if (round && g.roundRect) g.roundRect(x * K, y * K, w * K, h * K, round * K); else g.rect(x * K, y * K, w * K, h * K);
    }
    self.rect = function (x, y, w, h, fill, stroke, lw, round) {
      path(round, x, y, w, h); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = (lw || 0.75) * K; g.stroke(); }
    };
    self.ellipse = function (x, y, w, h, fill, stroke, lw) {
      g.beginPath(); g.ellipse((x + w / 2) * K, (y + h / 2) * K, w / 2 * K, h / 2 * K, 0, 0, Math.PI * 2);
      if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = (lw || 0.75) * K; g.stroke(); }
    };
    self.line = function (x1, y1, x2, y2, color, lw) { g.beginPath(); g.moveTo(x1 * K, y1 * K); g.lineTo(x2 * K, y2 * K); g.strokeStyle = color || '#000'; g.lineWidth = (lw || 0.75) * K; g.stroke(); };
    self.image = function (canvas, x, y, w, h) { g.drawImage(canvas, x * K, y * K, w * K, h * K); };
    self.finish = function () {
      var doc = null;
      pages.forEach(function (p) {
        var o = p.w > p.h ? 'l' : 'p';
        if (!doc) doc = new J({ unit: 'pt', format: [p.w, p.h], orientation: o, compress: true }); else doc.addPage([p.w, p.h], o);
        doc.addImage(p.c.toDataURL('image/jpeg', 0.88), 'JPEG', 0, 0, p.w, p.h, undefined, 'FAST');
      });
      return doc ? doc.output('blob') : null;
    };
    return self;
  }
  function makeBackend(allText) { return needsUnicode(allText) ? CanvasBackend() : VecBackend(); }

  /* ======================= flowing-text layout (Word, text, HTML) ======================= */
  function Flow(bk, pw, ph, mg) {
    var f = { y: 0, page: 0 }; mg = mg || { l: 54, r: 54, t: 54, b: 54 };
    f.contentW = pw - mg.l - mg.r;
    f.newPage = function () { bk.newPage(pw, ph); f.y = mg.t; f.page++; f.atTop = true; };
    f.ensure = function (h) { if (!f.page || f.y + h > ph - mg.b) { if (f.page && f.atTop) return; f.newPage(); } };
    f.mg = mg;
    /* items: [{t,size,b,i,u,color} | {br:true} | {tab:true} | {img:canvas,w,h} | {pagebreak:true}] */
    f.para = function (items, p) {
      p = p || {};
      var left = p.left || 0, first = p.first || 0, mkFirst = first, before = p.before || 0, after = p.after || 0, mult = p.mult || 1.15, exact = p.exact || 0, align = p.align || 'left';
      if (!f.page) f.newPage();
      if (p.marker) first = 0;                                 // with a bullet/number the text starts at the indent, the marker hangs to its left
      if (!f.atTop) f.y += before;
      var tokens = [], defSize = p.size || 11;
      items.forEach(function (it) {
        if (it.pagebreak) { tokens.push({ pb: true }); return; }
        if (it.br) { tokens.push({ nl: true, size: it.size || defSize }); return; }
        if (it.img) { tokens.push({ img: it }); return; }
        if (it.tab) { tokens.push({ tab: true, run: it }); return; }
        var parts = cleanText(it.t).split(/( +)/);
        parts.forEach(function (s) { if (s !== '') tokens.push({ t: s, run: it, space: /^ +$/.test(s) }); });
      });
      var lines = [], cur = null;
      function startLine() { cur = { toks: [], w: 0, size: 0, avail: f.contentW - left - (lines.length ? 0 : first) - 0 }; lines.push(cur); }
      function endLine() { cur = null; }
      var i, x0;
      startLine();
      for (i = 0; i < tokens.length; i++) {
        var tk = tokens[i];
        if (tk.pb) { cur.pbAfter = true; endLine(); startLine(); continue; }
        if (tk.nl) { cur.size = Math.max(cur.size, tk.size); endLine(); startLine(); continue; }
        if (tk.img) { if (cur.toks.length) { endLine(); startLine(); } cur.img = tk.img; endLine(); startLine(); continue; }
        if (tk.tab) { var tw = 36 - ((left + cur.w) % 36 || 0); cur.toks.push({ t: '', w: tw, run: tk.run, tab: true }); cur.w += tw; cur.size = Math.max(cur.size, tk.run.size || defSize); continue; }
        var r = tk.run, size = r.size || defSize, w = bk.measure(tk.t, size, r.b, r.i);
        if (tk.space) { if (!cur.toks.length) continue; cur.toks.push({ t: tk.t, w: w, run: r, space: true }); cur.w += w; continue; }
        if (cur.w + w > cur.avail && cur.toks.length) {
          while (cur.toks.length && cur.toks[cur.toks.length - 1].space) { cur.w -= cur.toks.pop().w; }
          endLine(); startLine();
        }
        if (w > cur.avail) {                                   // a single word wider than the line: split by characters
          var piece = '', pw2 = 0;
          for (var k = 0; k < tk.t.length; k++) {
            var cw = bk.measure(tk.t.charAt(k), size, r.b, r.i);
            if (pw2 + cw > cur.avail - cur.w && piece) { cur.toks.push({ t: piece, w: pw2, run: r }); cur.w += pw2; cur.size = Math.max(cur.size, size); endLine(); startLine(); piece = ''; pw2 = 0; }
            piece += tk.t.charAt(k); pw2 += cw;
          }
          if (piece) { cur.toks.push({ t: piece, w: pw2, run: r }); cur.w += pw2; cur.size = Math.max(cur.size, size); }
          continue;
        }
        cur.toks.push({ t: tk.t, w: w, run: r }); cur.w += w; cur.size = Math.max(cur.size, size);
      }
      lines.forEach(function (ln, li) {
        if (ln.img) {
          var im = ln.img, iw = im.w, ih = im.h, maxW = f.contentW - left, maxH = ph - mg.t - mg.b;
          var k2 = Math.min(1, maxW / iw, maxH / ih); iw *= k2; ih *= k2;
          f.ensure(ih); var ix = mg.l + left + (align === 'center' ? (maxW - iw) / 2 : align === 'right' ? maxW - iw : 0);
          bk.image(im.img, ix, f.y, iw, ih); f.y += ih + 4; f.atTop = false; return;
        }
        var size2 = ln.size || defSize, lh = exact ? exact : size2 * 1.2 * mult;
        if (!ln.toks.length && !ln.pbAfter && li === lines.length - 1 && lines.length > 1) return;
        f.ensure(lh);
        while (ln.toks.length && ln.toks[ln.toks.length - 1].space) ln.w -= ln.toks.pop().w;
        var avail = f.contentW - left - (li ? 0 : first);
        x0 = mg.l + left + (li ? 0 : first);
        if (align === 'center') x0 += (avail - ln.w) / 2; else if (align === 'right') x0 += avail - ln.w;
        var gap = 0;
        if (align === 'justify' && li < lines.length - 1 && !ln.pbAfter) { var sp = ln.toks.filter(function (t) { return t.space; }).length; if (sp) gap = (avail - ln.w) / sp; }
        var base = f.y + lh * 0.78, x = x0;
        if (li === 0 && p.marker) bk.text(mg.l + left + mkFirst, base, cleanText(p.marker.t), p.marker.size || size2, p.marker.b, false, p.marker.color || '#000000', false);
        ln.toks.forEach(function (t) {
          if (!t.space && !t.tab && t.t) bk.text(x, base, t.t, t.run.size || defSize, t.run.b, t.run.i, t.run.color || '#000000', t.run.u);
          x += t.w + (t.space ? gap : 0);
        });
        f.y += lh; f.atTop = false;
        if (ln.pbAfter) { f.newPage(); }
      });
      f.y += after;
    };
    f.rule = function (color) { f.ensure(6); bk.line(mg.l, f.y + 3, pw - mg.r, f.y + 3, color || '#999999', 0.75); f.y += 8; };
    return f;
  }

  /* ======================= WORD (.docx) -> PDF ======================= */
  var TW = 20;                                                   // twips per point
  function on(el) { if (!el) return false; var v = at(el, 'val'); return !(v === '0' || v === 'false' || v === 'off' || v === 'none'); }
  function readR(rPr) {
    var o = {}; if (!rPr) return o;
    var b = ch(rPr, 'b'), i = ch(rPr, 'i'), u = ch(rPr, 'u'), sz = ch(rPr, 'sz'), c = ch(rPr, 'color'), caps = ch(rPr, 'caps'), hl = ch(rPr, 'highlight');
    if (b) o.b = on(b); if (i) o.i = on(i); if (u) o.u = on(u); if (sz) o.size = num(at(sz, 'val'), 22) / 2;
    if (c && at(c, 'val') && at(c, 'val') !== 'auto') o.color = '#' + at(c, 'val');
    if (caps) o.caps = on(caps);
    var va = ch(rPr, 'vertAlign'); if (va && at(va, 'val') !== 'baseline') o.sup = true;
    return o;
  }
  function readP(pPr) {
    var o = {}; if (!pPr) return o;
    var jc = ch(pPr, 'jc'), sp = ch(pPr, 'spacing'), ind = ch(pPr, 'ind'), np = ch(pPr, 'numPr'), st = ch(pPr, 'pStyle');
    if (jc) { var v = at(jc, 'val'); o.align = v === 'both' || v === 'distribute' ? 'justify' : v === 'center' ? 'center' : (v === 'right' || v === 'end') ? 'right' : 'left'; }
    if (sp) {
      if (at(sp, 'before') != null) o.before = num(at(sp, 'before'), 0) / TW;
      if (at(sp, 'after') != null) o.after = num(at(sp, 'after'), 0) / TW;
      if (at(sp, 'line') != null) { var ln = num(at(sp, 'line'), 240), rule = at(sp, 'lineRule') || 'auto'; if (rule === 'auto') o.mult = ln / 240; else if (rule === 'exact') o.exact = ln / TW; else o.minLine = ln / TW; }
    }
    if (ind) {
      var l = at(ind, 'left') != null ? at(ind, 'left') : at(ind, 'start');
      if (l != null) o.left = num(l, 0) / TW;
      if (at(ind, 'firstLine') != null) o.first = num(at(ind, 'firstLine'), 0) / TW;
      if (at(ind, 'hanging') != null) o.first = -num(at(ind, 'hanging'), 0) / TW;
    }
    if (np) { var ni = ch(np, 'numId'), il = ch(np, 'ilvl'); if (ni) o.numId = at(ni, 'val'); if (il) o.ilvl = num(at(il, 'val'), 0); }
    if (st) o.style = at(st, 'val');
    if (ch(pPr, 'pageBreakBefore') && on(ch(pPr, 'pageBreakBefore'))) o.pbBefore = true;
    return o;
  }
  function roman(n, lower) { var r = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']], s = ''; r.forEach(function (p) { while (n >= p[0]) { s += p[1]; n -= p[0]; } }); return lower ? s.toLowerCase() : s; }
  function fmtNum(n, f) {
    if (f === 'lowerLetter') return String.fromCharCode(96 + ((n - 1) % 26) + 1); if (f === 'upperLetter') return String.fromCharCode(64 + ((n - 1) % 26) + 1);
    if (f === 'lowerRoman') return roman(n, true); if (f === 'upperRoman') return roman(n, false); return String(n);
  }
  async function docxToPdf(file, progress) {
    if (!root.JSZip) throw new Error('ZIP library is not loaded.');
    var zip; try { zip = await JSZip.loadAsync(file); } catch (e) { throw new Error('This is not a valid .docx file. (Old .doc files must be saved as .docx first.)'); }
    var docXml = await zipText(zip, 'word/document.xml'); if (!docXml) throw new Error('This is not a valid .docx file. (Old .doc files must be saved as .docx first.)');
    var dom = parseXml(docXml), body = ch(dom.documentElement, 'body'), rels = await readRels(zip, 'word/document.xml');
    var stXml = await zipText(zip, 'word/styles.xml'), numXml = await zipText(zip, 'word/numbering.xml');
    var styles = {}, defR = { size: 11 }, defP = { mult: 1.15, after: 0, before: 0 };
    if (stXml) {
      var sd = parseXml(stXml).documentElement, dd = ch(sd, 'docDefaults');
      if (dd) { Object.assign(defR, readR(path(dd, ['rPrDefault', 'rPr']))); Object.assign(defP, readP(path(dd, ['pPrDefault', 'pPr']))); }
      chs(sd, 'style').forEach(function (s) { styles[at(s, 'styleId')] = { type: at(s, 'type'), based: at(ch(s, 'basedOn'), 'val'), name: at(ch(s, 'name'), 'val') || '', p: readP(ch(s, 'pPr')), r: readR(ch(s, 'rPr')) }; });
    }
    function styleChain(id, kind) { var list = [], seen = 0; while (id && styles[id] && seen++ < 12) { list.unshift(styles[id][kind]); id = styles[id].based; } return list; }
    var HEAD = { 1: 20, 2: 16, 3: 14, 4: 12, 5: 11, 6: 11 };
    function styleDefaults(id) {
      var st = styles[id], nm = ((st && st.name) || id || '').toLowerCase(), m = /^heading\s*(\d)/.exec(nm) || /^heading(\d)$/i.exec(id || '');
      if (m) return { r: { b: true, size: HEAD[m[1]] || 12 }, p: { before: 10, after: 4 } };
      if (nm === 'title') return { r: { size: 26, b: true }, p: { after: 8 } };
      if (nm === 'subtitle') return { r: { size: 15, i: true }, p: { after: 6 } };
      return null;
    }
    var nums = {}, abs = {};
    if (numXml) {
      var nd = parseXml(numXml).documentElement;
      chs(nd, 'abstractNum').forEach(function (a) { var lv = {}; chs(a, 'lvl').forEach(function (l) { var ind = readP(ch(l, 'pPr')); lv[at(l, 'ilvl')] = { fmt: at(ch(l, 'numFmt'), 'val') || 'decimal', text: at(ch(l, 'lvlText'), 'val') || '', start: num(at(ch(l, 'start'), 'val'), 1), left: ind.left, first: ind.first }; }); abs[at(a, 'abstractNumId')] = lv; });
      chs(nd, 'num').forEach(function (n) { nums[at(n, 'numId')] = at(ch(n, 'abstractNumId'), 'val'); });
    }
    var counters = {};
    function marker(numId, ilvl) {
      var a = abs[nums[numId]]; if (!a) return null; var lv = a[ilvl] || a[0]; if (!lv) return null;
      var c = counters[numId] || (counters[numId] = []);
      c[ilvl] = (c[ilvl] == null ? lv.start : c[ilvl] + 1); for (var d = ilvl + 1; d < 10; d++) c[d] = null;
      if (lv.fmt === 'bullet') return { t: ilvl === 0 ? '\u2022' : '-', left: lv.left, first: lv.first };
      var txt = lv.text.replace(/%(\d)/g, function (m0, n) { var k = +n - 1, l2 = a[k] || lv; return fmtNum(c[k] == null ? l2.start : c[k], l2.fmt); });
      return { t: txt || String(c[ilvl]), left: lv.left, first: lv.first };
    }
    /* page setup */
    var sect = null; chs(body, 'sectPr').forEach(function (s) { sect = s; });
    var pw = 595, ph = 842, mg = { l: 72, r: 72, t: 72, b: 72 };
    if (sect) {
      var sz = ch(sect, 'pgSize') || ch(sect, 'pgSz'), pm = ch(sect, 'pgMar');
      if (sz) { pw = num(at(sz, 'w'), 11906) / TW; ph = num(at(sz, 'h'), 16838) / TW; if (at(sz, 'orient') === 'landscape' && pw < ph) { var t0 = pw; pw = ph; ph = t0; } }
      if (pm) { mg = { l: num(at(pm, 'left'), 1440) / TW, r: num(at(pm, 'right'), 1440) / TW, t: num(at(pm, 'top'), 1440) / TW, b: num(at(pm, 'bottom'), 1440) / TW }; }
    }
    if (pw < 100 || ph < 100) { pw = 595; ph = 842; }
    mg.l = Math.min(mg.l, pw / 3); mg.r = Math.min(mg.r, pw / 3); mg.t = Math.min(mg.t, ph / 3); mg.b = Math.min(mg.b, ph / 3);
    /* all text first -> choose the right output engine */
    var allText = ''; Array.prototype.forEach.call(dom.getElementsByTagName('*'), function (e) { if (e.localName === 't') allText += e.textContent; });
    var bk = makeBackend(allText), flow = Flow(bk, pw, ph, mg);

    var imgCache = {};
    async function getImg(rid, crop) {
      var key = rid + (crop ? JSON.stringify(crop) : ''); if (imgCache[key]) return imgCache[key];
      var rel = rels[rid]; if (!rel) return null; var f = zip.file(rel.target); if (!f) return null;
      try { var c = await bytesToCanvas(await f.async('uint8array'), '', crop); imgCache[key] = c; return c; } catch (e) { return null; }
    }
    function runProps(pStyleId, rPr, rStyleChainList) {
      var o = Object.assign({}, defR);
      styleChain(pStyleId, 'r').forEach(function (s) { Object.assign(o, s); });
      var sd2 = styleDefaults(pStyleId); if (sd2) { var base = {}; Object.assign(base, sd2.r); Object.keys(base).forEach(function (k) { if (!(styles[pStyleId] && styles[pStyleId].r[k] != null)) o[k] = base[k]; }); }
      (rStyleChainList || []).forEach(function (s) { Object.assign(o, s); });
      Object.assign(o, readR(rPr)); return o;
    }
    async function paraItems(pEl, pStyleId) {
      var items = [];
      async function walk(node) {
        for (var c = node.firstElementChild; c; c = c.nextElementSibling) {
          var n = c.localName;
          if (n === 'r') {
            var rPr = ch(c, 'rPr'), rs = rPr && ch(rPr, 'rStyle'), rsl = rs ? styleChain(at(rs, 'val'), 'r') : [], rp = runProps(pStyleId, rPr, rsl);
            for (var k = c.firstElementChild; k; k = k.nextElementSibling) {
              var kn = k.localName;
              if (kn === 't') { var tx = k.textContent; if (rp.caps) tx = tx.toUpperCase(); items.push(Object.assign({ t: tx }, rp)); }
              else if (kn === 'tab') items.push(Object.assign({ tab: true }, rp));
              else if (kn === 'br' || kn === 'cr') { if (at(k, 'type') === 'page') items.push({ pagebreak: true }); else items.push({ br: true, size: rp.size }); }
              else if (kn === 'noBreakHyphen') items.push(Object.assign({ t: '-' }, rp));
              else if (kn === 'drawing' || kn === 'pict') {
                var blip = null, ext = null, all = k.getElementsByTagName('*');
                for (var q = 0; q < all.length; q++) {
                  if (all[q].localName === 'blip' && !blip) blip = all[q];
                  if (all[q].localName === 'imagedata' && !blip) blip = all[q];
                  if ((all[q].localName === 'extent') && !ext) ext = all[q];
                }
                if (blip) {
                  var rid = at(blip, 'embed') || at(blip, 'id'), sr = null, aa = k.getElementsByTagName('*');
                  for (var q2 = 0; q2 < aa.length; q2++) if (aa[q2].localName === 'srcRect') sr = aa[q2];
                  var crop = sr ? { l: num(at(sr, 'l'), 0) / 100000, t: num(at(sr, 't'), 0) / 100000, r: num(at(sr, 'r'), 0) / 100000, b: num(at(sr, 'b'), 0) / 100000 } : null;
                  var cv = await getImg(rid, crop);
                  if (cv) { var w = ext ? num(at(ext, 'cx'), 0) / 12700 : cv.width * 0.75, h = ext ? num(at(ext, 'cy'), 0) / 12700 : cv.height * 0.75; if (!w || !h) { w = cv.width * 0.75; h = cv.height * 0.75; } items.push({ img: cv, w: w, h: h }); }
                }
              }
            }
          } else if (n === 'hyperlink' || n === 'ins' || n === 'smartTag' || n === 'sdt' || n === 'sdtContent' || n === 'fldSimple' || n === 'customXml' || n === 'moveTo') await walk(c);
          else if (n === 'AlternateContent') { var choice = ch(c, 'Choice') || ch(c, 'Fallback'); if (choice) await walk(choice); }
        }
      }
      await walk(pEl); return items;
    }
    async function paragraph(pEl, opts) {
      opts = opts || {};
      var pPr = ch(pEl, 'pPr'), direct = readP(pPr), sid = direct.style || null;
      var p = Object.assign({}, defP); styleChain(sid, 'p').forEach(function (s) { Object.assign(p, s); });
      var sdf = styleDefaults(sid); if (sdf) Object.keys(sdf.p).forEach(function (k) { if (!(styles[sid] && styles[sid].p[k] != null)) p[k] = sdf.p[k]; });
      Object.assign(p, direct);
      var items = await paraItems(pEl, sid);
      var rBase = runProps(sid, null, []), fp = { align: p.align, left: p.left || 0, first: p.first || 0, before: p.before || 0, after: p.after || 0, mult: p.mult || 1.15, exact: p.exact || 0, size: rBase.size };
      if (p.minLine) fp.exact = 0;
      if (p.numId && p.numId !== '0') {
        var mk = marker(p.numId, p.ilvl || 0);
        if (mk) {
          var lvLeft = mk.left != null ? mk.left : 36 * ((p.ilvl || 0) + 1), lvFirst = mk.first != null ? mk.first : -18;
          if (direct.left == null) fp.left = lvLeft; if (direct.first == null) fp.first = lvFirst;
          fp.marker = { t: mk.t + ((/^\d|^[a-z]\)|^\(?[a-z0-9]+[.)]?$/i.test(mk.t) && mk.t !== '\u2022' && mk.t !== '-') ? '' : ''), size: rBase.size, b: rBase.b };
          if (fp.first >= 0) fp.first = -18;
        }
      }
      if (opts.width) fp.width = opts.width;
      if (p.pbBefore && flow.page && !flow.atTop) flow.newPage();
      if (!items.length) items = [{ t: ' ', size: rBase.size }];
      if (opts.measureOnly) return { items: items, fp: fp };
      flow.para(items, fp);
    }
    /* tables */
    async function table(tblEl) {
      var grid = chs(ch(tblEl, 'tblGrid'), 'gridCol').map(function (g) { return num(at(g, 'w'), 2000) / TW; }), rows = chs(tblEl, 'tr'), total = grid.reduce(function (a, b) { return a + b; }, 0) || 1;
      var W = flow.contentW; if (total > W || !grid.length) { var k = W / (total || 1); grid = grid.map(function (g) { return g * k; }); }
      if (!grid.length) { var cols = Math.max.apply(null, rows.map(function (r) { return chs(r, 'tc').length; }).concat([1])); for (var q = 0; q < cols; q++) grid.push(W / cols); }
      var PAD = 4;
      for (var r = 0; r < rows.length; r++) {
        var cells = chs(rows[r], 'tc'), col = 0, spec = [];
        for (var c = 0; c < cells.length; c++) {
          var tcPr = ch(cells[c], 'tcPr'), span = tcPr && ch(tcPr, 'gridSpan') ? num(at(ch(tcPr, 'gridSpan'), 'val'), 1) : 1, w = 0;
          for (var s = 0; s < span; s++) w += grid[col + s] || 0; if (!w) w = grid[grid.length - 1] || 60;
          var vm = tcPr && ch(tcPr, 'vMerge'); var shd = tcPr && ch(tcPr, 'shd'), fill = shd && at(shd, 'fill') && at(shd, 'fill') !== 'auto' ? '#' + at(shd, 'fill') : null;
          var paras = []; for (var pe = cells[c].firstElementChild; pe; pe = pe.nextElementSibling) if (pe.localName === 'p') paras.push(await paragraph(pe, { measureOnly: true }));
          spec.push({ x: 0, w: w, paras: paras, fill: fill, skip: vm && !at(vm, 'val') }); col += span;
        }
        /* measure the height of the row with a dry-run on the same backend */
        var rowH = 0;
        spec.forEach(function (cs) {
          var h = PAD * 2;
          cs.paras.forEach(function (pp) {
            var tmp = { y: 0 }; var sizeMax = pp.fp.size || 11, lines = 1, x = 0, avail = cs.w - PAD * 2 - (pp.fp.left || 0);
            pp.items.forEach(function (it) { if (it.img) { h += Math.min(it.h, 200); return; } if (it.br) { lines++; x = 0; return; } if (it.t == null) return; sizeMax = Math.max(sizeMax, it.size || 0); cleanText(it.t).split(/( +)/).forEach(function (wd) { if (!wd) return; var ww = bk.measure(wd, it.size || pp.fp.size || 11, it.b, it.i); if (x + ww > avail && x > 0 && !/^ +$/.test(wd)) { lines++; x = 0; } x += ww; }); });
            h += lines * sizeMax * 1.2 * (pp.fp.mult || 1.15) + (pp.fp.after || 0);
          });
          rowH = Math.max(rowH, h);
        });
        flow.ensure(Math.min(rowH, ph - mg.t - mg.b));
        var x = mg.l, y0 = flow.y, hh = Math.min(rowH, ph - mg.t - mg.b);
        spec.forEach(function (cs) {
          if (cs.fill) bk.rect(x, y0, cs.w, hh, cs.fill, null, 0);
          bk.rect(x, y0, cs.w, hh, null, '#9a9a9a', 0.6);
          var sub = Flow(bk, pw, ph, { l: x + PAD, r: pw - (x + cs.w - PAD), t: y0 + PAD, b: mg.b }); sub.page = 1; sub.y = y0 + PAD; sub.atTop = true;
          cs.paras.forEach(function (pp) { var fp = Object.assign({}, pp.fp); sub.para(pp.items, fp); });
          x += cs.w;
        });
        flow.y = y0 + hh; flow.atTop = false;
        if (progress) progress(r / rows.length);
      }
      flow.y += 6;
    }
    var kids = chs(body); var total = kids.length;
    for (var bi = 0; bi < kids.length; bi++) {
      var e = kids[bi];
      if (e.localName === 'p') await paragraph(e);
      else if (e.localName === 'tbl') await table(e);
      else if (e.localName === 'sdt') { var sc = ch(e, 'sdtContent'); if (sc) for (var z = sc.firstElementChild; z; z = z.nextElementSibling) { if (z.localName === 'p') await paragraph(z); else if (z.localName === 'tbl') await table(z); } }
      if (progress && bi % 20 === 0) progress(bi / total);
    }
    if (!flow.page) flow.newPage();
    var blob = bk.finish(); if (!blob) throw new Error('The document is empty.');
    return [{ name: BASE(file.name) + '.pdf', blob: blob, note: bk.unicode ? 'Pages saved as images (needed for your language).' : '' }];
  }

  /* ======================= text / HTML -> PDF ======================= */
  async function textToPdf(file, kind) {
    var raw = await file.text(), blocks = [];
    if (kind === 'html') {
      var d = new DOMParser().parseFromString(raw, 'text/html');
      Array.prototype.forEach.call(d.querySelectorAll('script,style,noscript,template,head'), function (n) { n.remove(); });
      var HS = { H1: 22, H2: 18, H3: 15, H4: 13, H5: 12, H6: 11 };
      (function walk(n) {
        for (var c = n.firstChild; c; c = c.nextSibling) {
          if (c.nodeType === 3) { var t = c.nodeValue.replace(/\s+/g, ' '); if (t.trim()) blocks.push({ t: t, inline: true }); }
          else if (c.nodeType === 1) {
            var tg = c.tagName;
            if (HS[tg]) blocks.push({ t: c.textContent.replace(/\s+/g, ' ').trim(), size: HS[tg], b: true, before: 10, after: 4 });
            else if (tg === 'LI') blocks.push({ t: c.textContent.replace(/\s+/g, ' ').trim(), bullet: true });
            else if (tg === 'P' || tg === 'PRE' || tg === 'BLOCKQUOTE' || tg === 'TR') blocks.push({ t: c.textContent.replace(/[ \t]+/g, ' ').trim(), after: 6 });
            else if (tg === 'BR') blocks.push({ t: '' });
            else if (tg === 'IMG') { /* images are skipped for plain HTML */ }
            else walk(c);
          }
        }
      })(d.body || d);
      var merged = [], buf = '';
      blocks.forEach(function (b) { if (b.inline) buf += b.t; else { if (buf.trim()) merged.push({ t: buf.trim(), after: 6 }); buf = ''; merged.push(b); } });
      if (buf.trim()) merged.push({ t: buf.trim(), after: 6 }); blocks = merged;
    } else {
      raw.replace(/\r\n?/g, '\n').split('\n').forEach(function (l) { blocks.push({ t: l.replace(/\t/g, '    '), mono: false }); });
    }
    var all = blocks.map(function (b) { return b.t; }).join('\n'), bk = makeBackend(all), flow = Flow(bk, 595, 842, { l: 54, r: 54, t: 54, b: 54 });
    flow.newPage();
    blocks.forEach(function (b) {
      flow.para([{ t: b.t || ' ', size: b.size || 11, b: !!b.b }], { size: b.size || 11, mult: kind === 'html' ? 1.2 : 1.1, before: b.before || 0, after: b.after || 0, left: b.bullet ? 18 : 0, first: b.bullet ? -12 : 0, marker: b.bullet ? { t: '\u2022' } : null });
    });
    return [{ name: BASE(file.name) + '.pdf', blob: bk.finish(), note: bk.unicode ? 'Pages saved as images (needed for your language).' : '' }];
  }

  /* ======================= images -> PDF ======================= */
  async function imagesToPdf(files) {
    var J = root.jspdf && root.jspdf.jsPDF, doc = null;
    for (var i = 0; i < files.length; i++) {
      var f = files[i], buf = new Uint8Array(await f.arrayBuffer()), cv;
      try { cv = await bytesToCanvas(buf, f.type && /^image\//.test(f.type) ? f.type : ''); } catch (e) { throw new Error('"' + f.name + '" could not be read as an image.'); }
      var k = Math.min(1, 842 / Math.max(cv.width * 0.75, cv.height * 0.75)), w = cv.width * 0.75 * k, h = cv.height * 0.75 * k, o = w > h ? 'l' : 'p', d = canvasData(cv);
      if (!doc) doc = new J({ unit: 'pt', format: [w, h], orientation: o, compress: true }); else doc.addPage([w, h], o);
      doc.addImage(d.url, d.fmt, 0, 0, w, h, undefined, 'FAST');
    }
    return [{ name: (files.length === 1 ? BASE(files[0].name) : 'images') + '.pdf', blob: doc.output('blob') }];
  }

  /* ======================= POWERPOINT (.pptx) -> PDF ======================= */
  var EMU = 12700;
  var SCHEME = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' };
  function rgb2hsl(r, g, b) { r /= 255; g /= 255; b /= 255; var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2; if (mx !== mn) { var d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
  function hsl2rgb(h, s, l) { function f(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; } if (!s) return [l * 255, l * 255, l * 255]; var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255]; }
  function toHex(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  var PRST = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080', grey: '808080', orange: 'FFA500', purple: '800080', cyan: '00FFFF', magenta: 'FF00FF' };
  function colorOf(el, theme, clrMap) {
    if (!el) return null; var c = null, base;
    for (var k = el.firstElementChild; k; k = k.nextElementSibling) { if (/^(srgbClr|schemeClr|sysClr|prstClr|scrgbClr|hslClr)$/.test(k.localName)) { c = k; break; } }
    if (!c) return null;
    if (c.localName === 'srgbClr') base = at(c, 'val');
    else if (c.localName === 'sysClr') base = at(c, 'lastClr') || (at(c, 'val') === 'window' ? 'FFFFFF' : '000000');
    else if (c.localName === 'prstClr') base = PRST[(at(c, 'val') || '').toLowerCase()] || '000000';
    else if (c.localName === 'schemeClr') {
      var v = at(c, 'val'); if (clrMap && clrMap[v]) v = clrMap[v]; else if (SCHEME[v]) v = SCHEME[v];
      base = (theme && theme[v]) || (v === 'lt1' ? 'FFFFFF' : v === 'dk1' ? '000000' : '808080');
    } else return null;
    var rgb = hexRgb(base);
    chs(c).forEach(function (m) {
      var n = m.localName, v = num(at(m, 'val'), 100000) / 100000;
      if (n === 'lumMod' || n === 'lumOff' || n === 'satMod') { var hsl = rgb2hsl(rgb[0], rgb[1], rgb[2]); if (n === 'lumMod') hsl[2] *= v; else if (n === 'lumOff') hsl[2] += v; else hsl[1] *= v; hsl[2] = Math.max(0, Math.min(1, hsl[2])); hsl[1] = Math.max(0, Math.min(1, hsl[1])); rgb = hsl2rgb(hsl[0], hsl[1], hsl[2]); }
      else if (n === 'tint') rgb = rgb.map(function (x) { return x + (255 - x) * (1 - v); });
      else if (n === 'shade') rgb = rgb.map(function (x) { return x * v; });
    });
    return toHex(rgb);
  }
  function fillOf(spPr, theme, clrMap) {                         // returns {color} | {none:true} | null (inherit)
    if (!spPr) return null;
    if (ch(spPr, 'noFill')) return { none: true };
    var sf = ch(spPr, 'solidFill'); if (sf) { var c = colorOf(sf, theme, clrMap); return c ? { color: c } : null; }
    var gf = ch(spPr, 'gradFill'); if (gf) { var gl = ch(gf, 'gsLst'), g0 = gl && chs(gl, 'gs')[0]; var c2 = g0 && colorOf(g0, theme, clrMap); return c2 ? { color: c2 } : null; }
    return null;
  }
  function nodeXfrm(spPr) {
    var x = spPr && ch(spPr, 'xfrm'); if (!x) return null; var off = ch(x, 'off'), ext = ch(x, 'ext'); if (!off || !ext) return null;
    return { x: num(at(off, 'x'), 0), y: num(at(off, 'y'), 0), w: num(at(ext, 'cx'), 0), h: num(at(ext, 'cy'), 0), rot: num(at(x, 'rot'), 0) / 60000 };
  }
  function phOf(sp) { var nv = ch(sp, 'nvSpPr') || ch(sp, 'nvPicPr'); var nvPr = nv && ch(nv, 'nvPr'); var ph = nvPr && ch(nvPr, 'ph'); return ph ? { type: at(ph, 'type') || 'body', idx: at(ph, 'idx') } : null; }

  async function pptxToPdf(file, progress) {
    var zip; try { zip = await JSZip.loadAsync(file); } catch (e) { throw new Error('This is not a valid .pptx file. (Old .ppt files must be saved as .pptx first.)'); }
    var presXml = await zipText(zip, 'ppt/presentation.xml'); if (!presXml) throw new Error('This is not a valid .pptx file. (Old .ppt files must be saved as .pptx first.)');
    var pres = parseXml(presXml).documentElement, prels = await readRels(zip, 'ppt/presentation.xml');
    var sz = ch(pres, 'sldSz'), SW = num(at(sz, 'cx'), 9144000), SH = num(at(sz, 'cy'), 6858000), pw = SW / EMU, ph = SH / EMU;
    var RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    var slideIds = chs(ch(pres, 'sldIdLst'), 'sldId').map(function (s) { var r = prels[s.getAttributeNS(RNS, 'id') || at(s, 'id')]; return r && r.target; }).filter(Boolean);
    if (!slideIds.length) throw new Error('No slides were found in this file.');
    var themeCache = {}, partCache = {};
    async function part(p) { if (partCache[p] !== undefined) return partCache[p]; var x = await zipText(zip, p); return (partCache[p] = x ? parseXml(x).documentElement : null); }
    async function themeFor(masterPath) {
      if (themeCache[masterPath]) return themeCache[masterPath];
      var mr = await readRels(zip, masterPath), t = {}, tp = Object.keys(mr).map(function (k) { return mr[k]; }).filter(function (r) { return r.type === 'theme'; })[0];
      if (tp) { var td = await part(tp.target), cs = td && path(td, ['themeElements', 'clrScheme']); if (cs) chs(cs).forEach(function (c) { var k = c.firstElementChild; if (k) t[c.localName] = at(k, 'val') === 'window' ? 'FFFFFF' : at(k, 'val') === 'windowText' ? '000000' : (at(k, 'lastClr') || at(k, 'val')); }); }
      return (themeCache[masterPath] = t);
    }
    /* collect all text for the engine choice */
    var all = '';
    for (var si = 0; si < slideIds.length; si++) { var sx = await zipText(zip, slideIds[si]); if (sx) sx.replace(/<a:t(?: [^>]*)?>([^<]*)<\/a:t>/g, function (m0, t) { all += t; return ''; }); }
    var bk = makeBackend(all.replace(/&[a-z#0-9]+;/gi, ' '));
    var imgCache = {};
    async function getImg(rels, rid, crop) {
      var rel = rels[rid]; if (!rel) return null; var key = rel.target + (crop ? JSON.stringify(crop) : ''); if (imgCache[key] !== undefined) return imgCache[key];
      var f = zip.file(rel.target), c = null; if (f) { try { c = await bytesToCanvas(await f.async('uint8array'), '', crop); } catch (e) { c = null; } } return (imgCache[key] = c);
    }
    function lvlStyleFrom(txStyles, kind, lvl) { var st = txStyles && ch(txStyles, kind); return st ? ch(st, 'lvl' + (lvl + 1) + 'pPr') : null; }

    for (var s = 0; s < slideIds.length; s++) {
      var sp = slideIds[s], sd = await part(sp); if (!sd) continue;
      var srels = await readRels(zip, sp), layRel = Object.keys(srels).map(function (k) { return srels[k]; }).filter(function (r) { return r.type === 'slideLayout'; })[0];
      var layPath = layRel && layRel.target, lay = layPath ? await part(layPath) : null, lrels = layPath ? await readRels(zip, layPath) : {};
      var masRel = Object.keys(lrels).map(function (k) { return lrels[k]; }).filter(function (r) { return r.type === 'slideMaster'; })[0];
      var masPath = masRel && masRel.target, mas = masPath ? await part(masPath) : null, mrels = masPath ? await readRels(zip, masPath) : {};
      var theme = masPath ? await themeFor(masPath) : {}, clrMap = {}; if (mas) { var cm = ch(mas, 'clrMap'); if (cm) for (var ai = 0; ai < cm.attributes.length; ai++) clrMap[cm.attributes[ai].localName] = cm.attributes[ai].value; }
      var txStyles = mas && ch(mas, 'txStyles');
      bk.newPage(pw, ph);
      /* background */
      var bgDone = false;
      async function paintBg(doc2, rels2) {
        var bg = doc2 && path(doc2, ['cSld', 'bg']); if (!bg) return false;
        var bgPr = ch(bg, 'bgPr'), bgRef = ch(bg, 'bgRef'), col = null;
        if (bgPr) {
          var f = fillOf(bgPr, theme, clrMap); if (f && f.color) col = f.color;
          var bf = ch(bgPr, 'blipFill'), bl = bf && ch(bf, 'blip'); if (bl) { var cv = await getImg(rels2, at(bl, 'embed')); if (cv) { bk.image(cv, 0, 0, pw, ph); return true; } }
        } else if (bgRef) col = colorOf(bgRef, theme, clrMap);
        if (col) { bk.rect(0, 0, pw, ph, col, null, 0); return true; } return false;
      }
      bgDone = (await paintBg(sd, srels)) || (await paintBg(lay, lrels)) || (await paintBg(mas, mrels));
      /* placeholder geometry / text defaults inherited from layout and master */
      function findPh(doc2, ph0) {
        var tree = doc2 && path(doc2, ['cSld', 'spTree']); if (!tree || !ph0) return null; var hit = null;
        chs(tree, 'sp').forEach(function (cand) { var p2 = phOf(cand); if (!p2 || hit) return; if (ph0.idx != null && p2.idx === ph0.idx) hit = cand; });
        if (!hit) chs(tree, 'sp').forEach(function (cand) { var p2 = phOf(cand); if (!p2 || hit) return; var t1 = ph0.type === 'ctrTitle' ? 'title' : ph0.type, t2 = p2.type === 'ctrTitle' ? 'title' : p2.type; if (t1 === t2 || (t1 === 'body' && p2.type === 'body')) hit = cand; });
        return hit;
      }
      function inheritedXfrm(spEl, ph0) { var a = findPh(lay, ph0), x = a && nodeXfrm(ch(a, 'spPr')); if (x) return x; var b = findPh(mas, ph0); return b && nodeXfrm(ch(b, 'spPr')); }
      function lstLevel(spEl, lvl) { var tb = ch(spEl, 'txBody'), ls = tb && ch(tb, 'lstStyle'); return ls ? ch(ls, 'lvl' + (lvl + 1) + 'pPr') : null; }
      function phLevel(ph0, lvl) {
        var out = []; if (!ph0) return out;
        var m = lvlStyleFrom(txStyles, (ph0.type === 'title' || ph0.type === 'ctrTitle') ? 'titleStyle' : (ph0.type === 'body' || ph0.type === 'subTitle' || ph0.idx != null && ph0.type !== 'dt' && ph0.type !== 'ftr' && ph0.type !== 'sldNum') ? 'bodyStyle' : 'otherStyle', lvl); if (m) out.push(m);
        var mp = findPh(mas, ph0); if (mp) { var l1 = lstLevel(mp, lvl); if (l1) out.push(l1); }
        var lp = findPh(lay, ph0); if (lp) { var l2 = lstLevel(lp, lvl); if (l2) out.push(l2); }
        return out;
      }
      var DEFSZ = { title: 44, ctrTitle: 44, subTitle: 24, body: 28 };
      /* ---- draw one shape tree (group-aware) ---- */
      async function drawTree(tree, rels, T, isSlide) {
        for (var n = tree.firstElementChild; n; n = n.nextElementSibling) {
          var ln = n.localName;
          if (ln === 'grpSp') {
            var gp = ch(n, 'grpSpPr'), gx = gp && ch(gp, 'xfrm'), T2 = T;
            if (gx) { var off = ch(gx, 'off'), ext = ch(gx, 'ext'), co = ch(gx, 'chOff'), ce = ch(gx, 'chExt');
              var ox = num(at(off, 'x'), 0), oy = num(at(off, 'y'), 0), ew = num(at(ext, 'cx'), 1), eh = num(at(ext, 'cy'), 1), cx0 = num(at(co, 'x'), 0), cy0 = num(at(co, 'y'), 0), cw = num(at(ce, 'cx'), ew) || 1, chh = num(at(ce, 'cy'), eh) || 1;
              var gsx = ew / cw, gsy = eh / chh; T2 = { sx: T.sx * gsx, sy: T.sy * gsy, tx: T.tx + T.sx * (ox - cx0 * gsx), ty: T.ty + T.sy * (oy - cy0 * gsy) }; }
            await drawTree(n, rels, T2, isSlide); continue;
          }
          if (ln !== 'sp' && ln !== 'pic' && ln !== 'cxnSp' && ln !== 'graphicFrame') continue;
          var ph0 = phOf(n);
          if (!isSlide && ph0) continue;                          // layout/master placeholders are templates, not content
          if (ph0 && (ph0.type === 'dt' || ph0.type === 'ftr' || ph0.type === 'sldNum')) { if (ph0.type !== 'sldNum') continue; }
          var spPr = ch(n, 'spPr') || ch(n, 'grpSpPr'), xf = nodeXfrm(spPr) || (ln === 'graphicFrame' ? (function () { var x = ch(n, 'xfrm'); if (!x) return null; var o2 = ch(x, 'off'), e2 = ch(x, 'ext'); return o2 && e2 ? { x: num(at(o2, 'x'), 0), y: num(at(o2, 'y'), 0), w: num(at(e2, 'cx'), 0), h: num(at(e2, 'cy'), 0) } : null; })() : null);
          if (!xf && ph0) xf = inheritedXfrm(n, ph0);
          if (!xf) { if (ln === 'sp' && ph0) xf = { x: SW * 0.08, y: SH * 0.08, w: SW * 0.84, h: SH * 0.2 }; else continue; }
          var X = (T.tx + T.sx * xf.x) / EMU, Y = (T.ty + T.sy * xf.y) / EMU, W = T.sx * xf.w / EMU, H = T.sy * xf.h / EMU;
          if (ln === 'pic') {
            var bf = ch(n, 'blipFill'), bl = bf && ch(bf, 'blip'), sr = bf && ch(bf, 'srcRect'), crop = sr ? { l: num(at(sr, 'l'), 0) / 100000, t: num(at(sr, 't'), 0) / 100000, r: num(at(sr, 'r'), 0) / 100000, b: num(at(sr, 'b'), 0) / 100000 } : null;
            var cv = bl && await getImg(rels, at(bl, 'embed'), crop); if (cv && W > 0 && H > 0) bk.image(cv, X, Y, W, H); continue;
          }
          if (ln === 'cxnSp') { var lnE = spPr && ch(spPr, 'ln'), lc = lnE && fillOf(lnE, theme, clrMap); bk.line(X, Y, X + W, Y + H, (lc && lc.color) || '#555555', lnE ? Math.max(0.5, num(at(lnE, 'w'), 9525) / EMU) : 1); continue; }
          if (ln === 'graphicFrame') {
            var tbl = null, all2 = n.getElementsByTagName('*'); for (var q = 0; q < all2.length; q++) if (all2[q].localName === 'tbl') { tbl = all2[q]; break; }
            if (tbl) await drawTable(tbl, X, Y, W, T);
            continue;
          }
          /* ordinary shape */
          var f = fillOf(spPr, theme, clrMap), lnEl = spPr && ch(spPr, 'ln'), stroke = null, lw = 0.75;
          if (lnEl && !ch(lnEl, 'noFill')) { var lf = fillOf(lnEl, theme, clrMap); if (lf && lf.color) { stroke = lf.color; lw = Math.max(0.5, num(at(lnEl, 'w'), 9525) / EMU); } }
          var geom = spPr && ch(spPr, 'prstGeom'), prst = geom ? at(geom, 'prst') : 'rect';
          if (!f) { var style = ch(n, 'style'), fr = style && ch(style, 'fillRef'); if (fr && ln === 'sp' && !ph0) { var sc2 = colorOf(fr, theme, clrMap); if (sc2) f = { color: sc2 }; } }
          if ((f && f.color) || stroke) {
            if (prst === 'ellipse') bk.ellipse(X, Y, W, H, f && f.color, stroke, lw);
            else if (prst === 'roundRect') bk.rect(X, Y, W, H, f && f.color, stroke, lw, Math.min(W, H) * 0.16);
            else bk.rect(X, Y, W, H, f && f.color, stroke, lw);
          }
          var tb = ch(n, 'txBody'); if (tb) drawText(n, tb, ph0, X, Y, W, H, T);
        }
      }
      function textColor(spPrEl) { var f = spPrEl && ch(spPrEl, 'solidFill'); return f ? colorOf(f, theme, clrMap) : null; }
      function drawText(spEl, tb, ph0, X, Y, W, H, T) {
        var bp = ch(tb, 'bodyPr'), lI = num(at(bp, 'lIns'), 91440) / EMU, tI = num(at(bp, 'tIns'), 45720) / EMU, rI = num(at(bp, 'rIns'), 91440) / EMU, bI = num(at(bp, 'bIns'), 45720) / EMU;
        var anchor = at(bp, 'anchor') || (ph0 && (ph0.type === 'title' || ph0.type === 'ctrTitle') ? 'ctr' : 't');
        if (ph0 && !at(bp, 'anchor')) { var lp = findPh(lay, ph0), lbp = lp && ch(ch(lp, 'txBody'), 'bodyPr'); if (lbp && at(lbp, 'anchor')) anchor = at(lbp, 'anchor'); }
        var na = bp && ch(bp, 'normAutofit'), fscale = na && at(na, 'fontScale') ? num(at(na, 'fontScale'), 100000) / 100000 : 1;
        var paras = chs(tb, 'p'), blocks = [], totalH = 0, boxW = Math.max(10, W - lI - rI);
        var sandbox = Flow(bk, pw, ph, { l: 0, r: 0, t: 0, b: 0 });
        paras.forEach(function (p) {
          var pPr = ch(p, 'pPr'), lvl = pPr ? num(at(pPr, 'lvl'), 0) : 0, chain = phOf(spEl) ? phLevel(ph0, lvl) : [];
          var own = lstLevel(spEl, lvl); if (own) chain.push(own); if (pPr) chain.push(pPr);
          var algn = null, marL = null, indent = null, bu = null, defR = null, spcBef = null, spcAft = null, lnPct = null;
          chain.forEach(function (c) {
            if (at(c, 'algn')) algn = at(c, 'algn'); if (at(c, 'marL') != null) marL = num(at(c, 'marL'), 0); if (at(c, 'indent') != null) indent = num(at(c, 'indent'), 0);
            if (ch(c, 'buNone')) bu = { none: true }; var bc = ch(c, 'buChar'); if (bc) bu = { ch: at(bc, 'char') }; var ba = ch(c, 'buAutoNum'); if (ba) bu = { auto: at(ba, 'type') };
            var d = ch(c, 'defRPr'); if (d) { defR = defR || {}; if (at(d, 'sz')) defR.sz = num(at(d, 'sz'), 1800) / 100; if (at(d, 'b') != null) defR.b = at(d, 'b') === '1'; if (at(d, 'i') != null) defR.i = at(d, 'i') === '1'; var tc = textColor(d); if (tc) defR.color = tc; }
            var sb = path(c, ['spcBef', 'spcPct']), sbp = path(c, ['spcBef', 'spcPts']); if (sbp) spcBef = num(at(sbp, 'val'), 0) / 100; else if (sb) spcBef = null;
            var sa = path(c, ['spcAft', 'spcPts']); if (sa) spcAft = num(at(sa, 'val'), 0) / 100;
            var lp2 = path(c, ['lnSpc', 'spcPct']); if (lp2) lnPct = num(at(lp2, 'val'), 100000) / 100000;
          });
          var baseSz = (defR && defR.sz) || (ph0 ? (DEFSZ[ph0.type] || (ph0.type === 'body' ? DEFSZ.body - lvl * 4 : 18)) : 18);
          if (ph0 && !(defR && defR.sz) && ph0.type === 'body' && lvl === 0) baseSz = 28;
          var items = [], pcolor = (defR && defR.color) || (ph0 ? theme[clrMap.tx1 || 'dk1'] && ('#' + theme[clrMap.tx1 || 'dk1']) : null) || '#000000';
          if (!ph0) { var stl = ch(spEl, 'style'), fnt = stl && ch(stl, 'fontRef'), fc = fnt && colorOf(fnt, theme, clrMap); if (fc && !(defR && defR.color)) pcolor = fc; }
          Array.prototype.forEach.call(p.children, function (r) {
            var rn = r.localName;
            if (rn === 'r' || rn === 'fld') {
              var rp = ch(r, 'rPr'), t = ch(r, 't'), tx = t ? t.textContent : ''; var sz2 = rp && at(rp, 'sz') ? num(at(rp, 'sz'), 1800) / 100 : baseSz, col = (rp && textColor(rp)) || pcolor;
              var b = rp && at(rp, 'b') != null ? at(rp, 'b') === '1' : !!(defR && defR.b), i = rp && at(rp, 'i') != null ? at(rp, 'i') === '1' : !!(defR && defR.i), u = rp && at(rp, 'u') && at(rp, 'u') !== 'none';
              items.push({ t: tx, size: Math.max(4, sz2 * fscale), b: b, i: i, u: !!u, color: col });
            } else if (rn === 'br') items.push({ br: true, size: baseSz * fscale });
          });
          var isEmpty = !items.some(function (x) { return x.t; });
          if (!items.length) items.push({ t: ' ', size: baseSz * fscale, color: pcolor });
          var left = (marL != null ? marL : (bu && !bu.none ? 342900 * (lvl + 1) : 0)) / EMU, first = (indent != null ? indent : (bu && !bu.none ? -342900 : 0)) / EMU;
          var marker = null; if (bu && !bu.none && !isEmpty) marker = { t: bu.ch ? (needsUnicodeChar(bu.ch) ? '\u2022' : bu.ch) : String(blocks.filter(function (x) { return x.auto && x.lvl === lvl; }).length + 1) + '.', size: baseSz * fscale, color: pcolor };
          if (marker && bu.ch === '\u00A7') marker.t = '\u2022';
          blocks.push({ items: items, p: { align: algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : algn === 'just' ? 'justify' : 'left', left: left, first: first, before: (spcBef || 0) * fscale, after: (spcAft || 0) * fscale, mult: (lnPct || 1) * 0.95, size: baseSz * fscale, marker: marker }, auto: bu && bu.auto, lvl: lvl });
        });
        /* measure total height */
        function lines() { return 0; }
        var meas = { h: 0 };
        blocks.forEach(function (b) {
          var tmpBk = { newPage: function () {}, measure: bk.measure, text: function () {}, rect: function () {}, line: function () {}, image: function () {}, ellipse: function () {} };
          var f2 = Flow(tmpBk, boxW + 0, 100000, { l: 0, r: 0, t: 0, b: 0 }); f2.newPage(); f2.atTop = false; f2.y = 0; f2.page = 1;
          f2.para(b.items, Object.assign({}, b.p)); meas.h += f2.y;
        });
        var startY = anchor === 'ctr' ? Y + tI + Math.max(0, (H - tI - bI - meas.h) / 2) : anchor === 'b' ? Y + H - bI - meas.h : Y + tI;
        var f3 = Flow(bk, pw, ph, { l: X + lI, r: pw - (X + lI + boxW), t: startY, b: -100000 }); f3.page = 1; f3.y = startY; f3.atTop = true;
        blocks.forEach(function (b) { f3.para(b.items, Object.assign({}, b.p)); });
      }
      function needsUnicodeChar(c) { return c.charCodeAt(0) > 255 && CP1252.indexOf(c) < 0 && !bk.unicode; }
      async function drawTable(tbl, X, Y, W, T) {
        var grid = chs(ch(tbl, 'tblGrid'), 'gridCol').map(function (g) { return num(at(g, 'w'), 914400) * T.sx / EMU; }), rows = chs(tbl, 'tr'), y = Y;
        for (var r = 0; r < rows.length; r++) {
          var rh = num(at(rows[r], 'h'), 370840) * T.sy / EMU, x = X, cells = chs(rows[r], 'tc');
          for (var c = 0; c < cells.length; c++) {
            var span = num(at(cells[c], 'gridSpan'), 1), w = 0; for (var k = 0; k < span; k++) w += grid[c + k] || 0; if (!w) w = grid[0] || 80;
            var tcPr = ch(cells[c], 'tcPr'), f = fillOf(tcPr, theme, clrMap);
            if (f && f.color) bk.rect(x, y, w, rh, f.color, null, 0);
            bk.rect(x, y, w, rh, null, '#9a9a9a', 0.5);
            var tb = ch(cells[c], 'txBody'); if (tb) { var fake = parseXml('<a:sp xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>').documentElement; drawText(fake, tb, null, x, y, w, rh, T); }
            x += w;
          }
          y += rh;
        }
      }
      var T0 = { sx: 1, sy: 1, tx: 0, ty: 0 };
      var showMaster = at(sd, 'showMasterSp') !== '0' && !(lay && at(lay, 'showMasterSp') === '0');
      if (mas && showMaster) await drawTree(path(mas, ['cSld', 'spTree']), mrels, T0, false);
      if (lay) await drawTree(path(lay, ['cSld', 'spTree']), lrels, T0, false);
      await drawTree(path(sd, ['cSld', 'spTree']), srels, T0, true);
      if (progress) progress((s + 1) / slideIds.length);
    }
    return [{ name: BASE(file.name) + '.pdf', blob: bk.finish(), note: 'Complex animations, charts and special fonts may look different.' + (bk.unicode ? ' Pages saved as images (needed for your language).' : '') }];
  }

  /* ======================= PDF -> text / images / Word / PowerPoint ======================= */
  async function openPdf(file) {
    if (!root.pdfjsLib) throw new Error('PDF reader is not loaded.');
    var bytes = new Uint8Array(await file.arrayBuffer());
    try { return await pdfjsLib.getDocument({ isEvalSupported: false, data: bytes }).promise; }
    catch (e) { if (e && e.name === 'PasswordException') throw new Error('This PDF is password protected. Use "Remove PDF Password" first.'); throw new Error('Could not read this PDF. It may be damaged.'); }
  }
  async function pageLines(page) {
    var vp = page.getViewport({ scale: 1 }), tc = await page.getTextContent(), items = [];
    tc.items.forEach(function (it) { if (!it.str || !it.str.trim() && it.str.length === 0) return; var t = it.transform, size = Math.hypot(t[0], t[1]) || Math.abs(t[3]) || 10; items.push({ s: it.str, x: t[4], y: vp.height - t[5], size: size, w: it.width }); });
    items.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    var lines = [];
    items.forEach(function (it) {
      var ln = lines[lines.length - 1];
      if (ln && Math.abs(it.y - ln.y) <= Math.max(ln.size, it.size) * 0.45) { ln.items.push(it); ln.size = Math.max(ln.size, it.size); }
      else lines.push({ y: it.y, size: it.size, items: [it] });
    });
    lines.forEach(function (ln) {
      ln.items.sort(function (a, b) { return a.x - b.x; });
      var s = '', end = null; ln.items.forEach(function (it) { if (end != null && it.x - end > it.size * 0.15 && !/\s$/.test(s) && !/^\s/.test(it.s)) s += ' '; s += it.s; end = it.x + it.w; });
      ln.text = s.replace(/\s+$/, ''); ln.x = ln.items[0].x; ln.xEnd = end; ln.y = ln.items.reduce(function (a, b) { return a + b.y; }, 0) / ln.items.length;
    });
    return { lines: lines.filter(function (l) { return l.text.trim(); }), w: vp.width, h: vp.height };
  }
  function medianSize(all) { var a = all.map(function (l) { return l.size; }).sort(function (x, y) { return x - y; }); return a.length ? a[Math.floor(a.length / 2)] : 11; }
  function paragraphsOf(lines, med) {
    var paras = [], cur = null, prev = null;
    lines.forEach(function (l) {
      var bullet = /^\s*([\u2022\u25CF\u25AA\u2013\u2014\-\*]|\d{1,2}[.)])\s+/.test(l.text);
      var newP = !cur || bullet || (l.y - prev.y) > Math.max(prev.size, l.size) * 1.65 || Math.abs(l.size - prev.size) > med * 0.2 || (l.x - prev.x) > med * 2.5 && prev.xEnd < (prev.xEnd || 0);
      if (newP) { cur = { text: l.text, size: l.size, x: l.x, y: l.y, xEnd: l.xEnd, lines: [l] }; paras.push(cur); }
      else { cur.text += (/-$/.test(cur.text) && /^[a-z]/.test(l.text) ? '' : ' ') + l.text; cur.xEnd = Math.max(cur.xEnd, l.xEnd); cur.lines.push(l); }
      prev = l;
    });
    return paras;
  }
  async function renderPage(page, scale) { var vp = page.getViewport({ scale: scale }), c = canvasOf(vp.width, vp.height); var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); await page.render({ canvasContext: g, viewport: vp }).promise; return c; }

  async function pdfToText(file, progress) {
    var pdf = await openPdf(file), out = [], empty = 0;
    for (var i = 1; i <= pdf.numPages; i++) {
      var pg = await pdf.getPage(i), L = await pageLines(pg); if (!L.lines.length) empty++;
      out.push(paragraphsOf(L.lines, medianSize(L.lines)).map(function (p) { return p.text; }).join('\n\n')); if (progress) progress(i / pdf.numPages);
    }
    var text = out.join('\n\n\u2014\u2014\u2014\n\n');
    if (empty === pdf.numPages) throw new Error('This PDF has no selectable text (it looks scanned). Use "Smart OCR" to read text from it.');
    return [{ name: BASE(file.name) + '.txt', blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), note: empty ? empty + ' page(s) had no text.' : '' }];
  }
  async function pdfToImages(file, fmt, progress) {
    var pdf = await openPdf(file), res = [], mime = fmt === 'png' ? 'image/png' : 'image/jpeg', ext = fmt === 'png' ? 'png' : 'jpg', pad = String(pdf.numPages).length;
    for (var i = 1; i <= pdf.numPages; i++) {
      var pg = await pdf.getPage(i), vp1 = pg.getViewport({ scale: 1 }), sc = Math.min(2.5, 2400 / Math.max(vp1.width, vp1.height)), c = await renderPage(pg, Math.max(1, sc));
      res.push({ name: BASE(file.name) + '-page-' + String(i).padStart(pad, '0') + '.' + ext, blob: await toBlob(c, mime, 0.92) }); if (progress) progress(i / pdf.numPages);
    }
    return res;
  }

  /* --- minimal OOXML packaging --- */
  function xmlHead() { return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'; }
  async function pdfToDocx(file, progress) {
    var pdf = await openPdf(file), zip = new JSZip(), body = '', rels = '', media = 0, firstW = 595, firstH = 842, textPages = 0, rid = 1;
    for (var i = 1; i <= pdf.numPages; i++) {
      var pg = await pdf.getPage(i), L = await pageLines(pg), med = medianSize(L.lines), chars = L.lines.reduce(function (a, l) { return a + l.text.length; }, 0);
      if (i === 1) { firstW = L.w; firstH = L.h; }
      if (chars < 15) {                                           // scanned / picture page -> keep it as a picture so nothing is lost
        var vp1 = pg.getViewport({ scale: 1 }), c = await renderPage(pg, Math.min(2, 1600 / Math.max(vp1.width, vp1.height))), blob = await toBlob(c, 'image/jpeg', 0.85);
        media++; zip.file('word/media/image' + media + '.jpg', blob); var id = 'rId' + (++rid); rels += '<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image' + media + '.jpg"/>';
        var cw = Math.round(Math.min(L.w - 72, L.w) * 12700), chh = Math.round(cw * (c.height / c.width));
        if (chh > (L.h - 72) * 12700) { chh = Math.round((L.h - 72) * 12700); cw = Math.round(chh * c.width / c.height); }
        body += '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cw + '" cy="' + chh + '"/><wp:docPr id="' + media + '" name="Page ' + i + '"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + media + '" name="image' + media + '.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="' + id + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cw + '" cy="' + chh + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
      } else {
        textPages++;
        paragraphsOf(L.lines, med).forEach(function (p) {
          var big = p.size > med * 1.25, sz = Math.max(16, Math.min(72, Math.round((big ? Math.min(p.size, 30) : Math.min(p.size, 14)) * 2))), text = p.text.replace(/^\s*[\u2022\u25CF\u25AA]\s*/, '\u2022 ');
          body += '<w:p><w:pPr><w:spacing w:after="' + (big ? 120 : 100) + '"/></w:pPr><w:r><w:rPr>' + (big ? '<w:b/>' : '') + '<w:sz w:val="' + sz + '"/></w:rPr><w:t xml:space="preserve">' + esc(text) + '</w:t></w:r></w:p>';
        });
      }
      if (i < pdf.numPages) body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      if (progress) progress(i / pdf.numPages);
    }
    var W = Math.round(firstW * 20), H = Math.round(firstH * 20);
    zip.file('[Content_Types].xml', xmlHead() + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', xmlHead() + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', xmlHead() + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + '</Relationships>');
    zip.file('word/document.xml', xmlHead() + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>' + body + '<w:sectPr><w:pgSz w:w="' + W + '" w:h="' + H + '"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>');
    var blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
    return [{ name: BASE(file.name) + '.docx', blob: blob, note: textPages ? 'Text is editable. Complex layouts (columns, tables) are simplified.' : 'Scanned pages were kept as pictures. Use Smart OCR to get editable text.' }];
  }

  var THEME = '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>';
  var NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  var GRP = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
  async function pdfToPptx(file, mode, progress) {
    var pdf = await openPdf(file), zip = new JSZip(), slides = [], ct = '', prelRels = '', sldIds = '', first = null;
    for (var i = 1; i <= pdf.numPages; i++) {
      var pg = await pdf.getPage(i), vp = pg.getViewport({ scale: 1 }); if (!first) first = vp;
      var cx = Math.round(vp.width * EMU), cy = Math.round(vp.height * EMU), shapes = '', srel = '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>';
      if (mode === 'image') {
        var c = await renderPage(pg, Math.min(2.5, 2000 / Math.max(vp.width, vp.height))), blob = await toBlob(c, 'image/jpeg', 0.88); zip.file('ppt/media/image' + i + '.jpg', blob);
        srel += '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image' + i + '.jpg"/>';
        shapes = '<p:pic><p:nvPicPr><p:cNvPr id="2" name="Page ' + i + '"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
      } else {
        var L = await pageLines(pg), med = medianSize(L.lines), id = 2;
        if (!L.lines.length) {                                  // scanned page: keep as picture
          var c2 = await renderPage(pg, Math.min(2, 1600 / Math.max(vp.width, vp.height))); zip.file('ppt/media/image' + i + '.jpg', await toBlob(c2, 'image/jpeg', 0.85));
          srel += '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image' + i + '.jpg"/>';
          shapes = '<p:pic><p:nvPicPr><p:cNvPr id="2" name="Page ' + i + '"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
        }
        paragraphsOf(L.lines, med).forEach(function (p) {
          id++; var bx = Math.max(0, p.x), bw = Math.min(vp.width - bx, Math.max(p.xEnd - p.x, p.size * 4) + p.size * 1.5), by = Math.max(0, p.y - p.size * 1.05), bh = Math.max(p.size * 1.3, p.lines.length * p.size * 1.25), sz = Math.max(600, Math.min(7200, Math.round(p.size * 100)));
          shapes += '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="Text ' + id + '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + Math.round(bx * EMU) + '" y="' + Math.round(by * EMU) + '"/><a:ext cx="' + Math.round(bw * EMU) + '" cy="' + Math.round(bh * EMU) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="' + sz + '"' + (p.size > med * 1.25 ? ' b="1"' : '') + ' dirty="0"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>' + esc(p.text) + '</a:t></a:r></a:p></p:txBody></p:sp>';
        });
      }
      zip.file('ppt/slides/slide' + i + '.xml', xmlHead() + '<p:sld ' + NS + '><p:cSld><p:spTree>' + GRP + shapes + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>');
      zip.file('ppt/slides/_rels/slide' + i + '.xml.rels', xmlHead() + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + srel + '</Relationships>');
      ct += '<Override PartName="/ppt/slides/slide' + i + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>';
      prelRels += '<Relationship Id="rId' + (i + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide' + i + '.xml"/>';
      sldIds += '<p:sldId id="' + (255 + i) + '" r:id="rId' + (i + 2) + '"/>';
      if (progress) progress(i / pdf.numPages);
    }
    var SCX = Math.round(first.width * EMU), SCY = Math.round(first.height * EMU);
    zip.file('[Content_Types].xml', xmlHead() + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' + ct + '</Types>');
    zip.file('_rels/.rels', xmlHead() + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>');
    zip.file('ppt/presentation.xml', xmlHead() + '<p:presentation ' + NS + '><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>' + sldIds + '</p:sldIdLst><p:sldSz cx="' + SCX + '" cy="' + SCY + '"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>');
    zip.file('ppt/_rels/presentation.xml.rels', xmlHead() + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>' + prelRels + '</Relationships>');
    zip.file('ppt/slideMasters/slideMaster1.xml', xmlHead() + '<p:sldMaster ' + NS + '><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>' + GRP + '</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>');
    zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', xmlHead() + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>');
    zip.file('ppt/slideLayouts/slideLayout1.xml', xmlHead() + '<p:sldLayout ' + NS + ' type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>' + GRP + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>');
    zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', xmlHead() + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>');
    zip.file('ppt/theme/theme1.xml', xmlHead() + THEME);
    var blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', compression: 'DEFLATE' });
    return [{ name: BASE(file.name) + '.pptx', blob: blob, note: mode === 'image' ? 'Each page is a slide picture (exact look, not editable).' : 'Text is editable; pictures and drawings are not included.' }];
  }

  /* ======================= public API ======================= */
  function detect(file) {
    var e = EXT(file.name), t = (file.type || '').toLowerCase();
    if (/^(xls|xlsx|xlsm|xlsb|xltx|ods|csv|tsv|numbers)$/.test(e) || /spreadsheet|ms-excel|csv/.test(t)) return 'excel';
    if (e === 'pdf' || t === 'application/pdf') return 'pdf';
    if (e === 'docx' || e === 'docm' || e === 'dotx' || /wordprocessingml/.test(t)) return 'docx';
    if (e === 'pptx' || e === 'pptm' || e === 'ppsx' || /presentationml/.test(t)) return 'pptx';
    if (e === 'doc' || e === 'ppt' || e === 'pps' || e === 'rtf' || e === 'odt' || e === 'odp' || t === 'application/msword' || t === 'application/vnd.ms-powerpoint') return 'legacy';
    if (/^image\//.test(t) || /^(jpg|jpeg|png|webp|gif|bmp|avif)$/.test(e)) return 'image';
    if (/^(html|htm)$/.test(e) || t === 'text/html') return 'html';
    if (/^(txt|text|md|log|json|xml|ini|cfg|yml|yaml)$/.test(e) || t === 'text/plain') return 'text';
    return 'unknown';
  }
  var TARGETS = {
    pdf: [{ id: 'docx', label: 'Word (.docx)' }, { id: 'pptx-img', label: 'PowerPoint – exact look (.pptx)' }, { id: 'pptx-txt', label: 'PowerPoint – editable text (.pptx)' }, { id: 'jpg', label: 'JPG images' }, { id: 'png', label: 'PNG images' }, { id: 'txt', label: 'Text (.txt)' }],
    docx: [{ id: 'pdf', label: 'PDF' }], pptx: [{ id: 'pdf', label: 'PDF' }], image: [{ id: 'pdf', label: 'PDF' }], html: [{ id: 'pdf', label: 'PDF' }], text: [{ id: 'pdf', label: 'PDF' }]
  };
  var MSG = {
    excel: 'Excel and spreadsheet files are not supported in this converter.',
    legacy: 'Old Office formats (.doc, .ppt, .rtf, .odt) cannot be read in the browser. Open the file in Word/PowerPoint and save it as .docx / .pptx first.',
    unknown: 'This file type is not supported. Use PDF, Word (.docx), PowerPoint (.pptx), images, HTML or text files.'
  };
  async function convert(files, target, opts) {
    opts = opts || {}; var prog = opts.progress || function () {}, out = [];
    var kinds = files.map(detect);
    for (var i = 0; i < files.length; i++) if (MSG[kinds[i]]) throw new Error('"' + files[i].name + '": ' + MSG[kinds[i]]);
    if (target === 'pdf' && kinds.every(function (k) { return k === 'image'; }) && opts.combine !== false && files.length > 1) return await imagesToPdf(files);
    for (var j = 0; j < files.length; j++) {
      var f = files[j], k = kinds[j], p = function (v) { prog((j + v) / files.length); }, r;
      if (k === 'pdf') {
        if (target === 'docx') r = await pdfToDocx(f, p);
        else if (target === 'pptx-img') r = await pdfToPptx(f, 'image', p);
        else if (target === 'pptx-txt') r = await pdfToPptx(f, 'text', p);
        else if (target === 'jpg' || target === 'png') r = await pdfToImages(f, target, p);
        else if (target === 'txt') r = await pdfToText(f, p);
        else throw new Error('Choose what to convert the PDF into.');
      } else if (target !== 'pdf') throw new Error('"' + f.name + '" can only be converted to PDF.');
      else if (k === 'docx') r = await docxToPdf(f, p);
      else if (k === 'pptx') r = await pptxToPdf(f, p);
      else if (k === 'image') r = await imagesToPdf([f]);
      else if (k === 'html') r = await textToPdf(f, 'html');
      else r = await textToPdf(f, 'text');
      out = out.concat(r); prog((j + 1) / files.length);
    }
    return out;
  }
  function targetsFor(files) {
    var kinds = files.map(detect).filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (!kinds.length) return [];
    if (kinds.some(function (k) { return MSG[k]; })) return [];
    if (kinds.length === 1) return TARGETS[kinds[0]] || [];
    if (kinds.indexOf('pdf') >= 0) return [];                  // PDFs cannot be mixed with other kinds in one run
    return TARGETS.docx;
  }
  root.MGDocConv = { detect: detect, targetsFor: targetsFor, convert: convert, message: function (file) { return MSG[detect(file)] || ''; }, _internal: { Flow: Flow, VecBackend: VecBackend, CanvasBackend: CanvasBackend } };
})(window);
