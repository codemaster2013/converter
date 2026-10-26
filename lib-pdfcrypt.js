/* MediaGrabber Pro – PDF password engine (runs fully in the browser).
   Encrypts a PDF with the PDF "Standard Security Handler" revision 4 (AES-128, AESV2) – opens in Adobe Reader, Chrome,
   Edge, Firefox, Preview, Android/iOS viewers.  Needs the global PDFLib (lib-pdf-lib.min.js) and WebCrypto.

   window.MGPdfCrypt.lock(bytes, { userPassword, ownerPassword, allow: { print, copy, modify, annotate } }) -> Promise<Uint8Array>   */
(function (root) {
  'use strict';

  /* ---------------- MD5 ---------------- */
  function md5(bytes) {
    var K = [], S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21], i;
    for (i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
    var len = bytes.length, n = ((len + 8) >> 6) + 1, w = new Uint32Array(n * 16);
    for (i = 0; i < len; i++) w[i >> 2] |= bytes[i] << ((i % 4) * 8);
    w[len >> 2] |= 0x80 << ((len % 4) * 8);
    w[n * 16 - 2] = (len * 8) >>> 0; w[n * 16 - 1] = Math.floor(len / 536870912) >>> 0;
    var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (var o = 0; o < n * 16; o += 16) {
      var A = a0, B = b0, C = c0, D = d0;
      for (i = 0; i < 64; i++) {
        var F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + w[o + g]) >>> 0;
        A = D; D = C; C = B;
        var s = S[(i >> 4) * 4 + (i % 4)];
        B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    var out = new Uint8Array(16);
    [a0, b0, c0, d0].forEach(function (v, j) { for (var k = 0; k < 4; k++) out[j * 4 + k] = (v >>> (8 * k)) & 255; });
    return out;
  }

  /* ---------------- RC4 (only used for the /O and /U check values, as the spec requires) ---------------- */
  function rc4(key, data) {
    var s = new Uint8Array(256), i, j = 0, t;
    for (i = 0; i < 256; i++) s[i] = i;
    for (i = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) & 255; t = s[i]; s[i] = s[j]; s[j] = t; }
    var out = new Uint8Array(data.length); i = 0; j = 0;
    for (var k = 0; k < data.length; k++) {
      i = (i + 1) & 255; j = (j + s[i]) & 255; t = s[i]; s[i] = s[j]; s[j] = t;
      out[k] = data[k] ^ s[(s[i] + s[j]) & 255];
    }
    return out;
  }

  var PAD = new Uint8Array([0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41, 0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
    0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80, 0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A]);

  function concat() {
    var n = 0, a = arguments, i; for (i = 0; i < a.length; i++) n += a[i].length;
    var o = new Uint8Array(n), p = 0; for (i = 0; i < a.length; i++) { o.set(a[i], p); p += a[i].length; } return o;
  }
  function padPw(str) {
    /* PDF passwords are Latin-1 in revision 4; characters above U+00FF are not representable, so refuse them early */
    var b = new Uint8Array(Math.min(str.length, 32));
    for (var i = 0; i < b.length; i++) {
      var c = str.charCodeAt(i);
      if (c > 255) throw new Error('This password has a character that older PDF viewers cannot read. Use letters, numbers and common symbols only.');
      b[i] = c;
    }
    var o = new Uint8Array(32); o.set(b); o.set(PAD.subarray(0, 32 - b.length), b.length); return o;
  }
  function le32(n) { return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]); }
  function hex(u) { var s = ''; for (var i = 0; i < u.length; i++) s += (u[i] < 16 ? '0' : '') + u[i].toString(16); return s; }
  function rnd(n) { var u = new Uint8Array(n); (root.crypto || self.crypto).getRandomValues(u); return u; }

  function computeO(ownerPw, userPw) {                       // algorithm 3 (R3/R4)
    var h = md5(padPw(ownerPw || userPw)); for (var i = 0; i < 50; i++) h = md5(h);
    var key = h.subarray(0, 16), x = rc4(key, padPw(userPw));
    for (var k = 1; k <= 19; k++) x = rc4(key.map(function (v) { return v ^ k; }), x);
    return x;
  }
  function computeKey(userPw, O, P, id0) {                    // algorithm 2 (R3/R4, metadata encrypted)
    var h = md5(concat(padPw(userPw), O, le32(P), id0));
    for (var i = 0; i < 50; i++) h = md5(h.subarray(0, 16));
    return h.subarray(0, 16);
  }
  function computeU(key, id0) {                               // algorithm 5
    var x = rc4(key, md5(concat(PAD, id0)));
    for (var k = 1; k <= 19; k++) x = rc4(key.map(function (v) { return v ^ k; }), x);
    return concat(x, rnd(16));
  }
  function objKey(key, num, gen) {
    return md5(concat(key, new Uint8Array([num & 255, (num >> 8) & 255, (num >> 16) & 255, gen & 255, (gen >> 8) & 255, 0x73, 0x41, 0x6C, 0x54]))).subarray(0, 16);
  }
  async function aes(key, data) {                             // IV + AES-128-CBC (PKCS#7)
    var iv = rnd(16), k = await crypto.subtle.importKey('raw', key, { name: 'AES-CBC' }, false, ['encrypt']);
    var ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv }, k, data));
    return concat(iv, ct);
  }

  async function lock(bytes, opts) {
    var PL = root.PDFLib; if (!PL) throw new Error('PDF library is not loaded.');
    if (!root.crypto || !root.crypto.subtle) throw new Error('Your browser cannot encrypt files here. Open the site over HTTPS or use a newer browser.');
    opts = opts || {}; var userPw = String(opts.userPassword || ''), ownerPw = String(opts.ownerPassword || '');
    if (!userPw) throw new Error('Enter a password.');
    var allow = opts.allow || {};
    var P = -3904;                                             // 0xFFFFF0C0 – reserved bits set, nothing allowed yet
    if (allow.print !== false) P |= 4 | 2048;                  // print (+ high quality)
    if (allow.modify !== false) P |= 8 | 256 | 1024;           // modify, fill forms, assemble
    P |= 512;                                                  // screen readers may always read the text (accessibility)
    if (allow.copy !== false) P |= 16;                         // copy text
    if (allow.annotate !== false) P |= 32;                     // comments / annotations
    P = P | 0;

    var doc = await PL.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    if (doc.isEncrypted) throw new Error('This PDF already has a password. Use "Remove PDF Password" first.');
    var ctx = doc.context, id0 = rnd(16);
    var O = computeO(ownerPw || hex(rnd(12)), userPw), key = computeKey(userPw, O, P, id0), U = computeU(key, id0);

    var entries = ctx.enumerateIndirectObjects(), i, ref, obj;
    for (i = 0; i < entries.length; i++) {
      ref = entries[i][0]; obj = entries[i][1];
      if (obj instanceof PL.PDFRawStream || (obj && typeof obj.getContents === 'function' && obj.dict)) {
        var type = obj.dict.get(PL.PDFName.of('Type'));
        if (type && (type.toString() === '/XRef' || type.toString() === '/ObjStm')) { ctx.delete(ref); continue; }
      }
    }
    entries = ctx.enumerateIndirectObjects();
    for (i = 0; i < entries.length; i++) {
      ref = entries[i][0]; obj = entries[i][1];
      var k = objKey(key, ref.objectNumber, ref.generationNumber);
      if (obj && obj.dict && typeof obj.getContents === 'function') {            // stream
        await encStrings(obj.dict, k, PL);
        var raw = obj.getContents(), enc = await aes(k, raw);
        ctx.assign(ref, PL.PDFRawStream.of(obj.dict, enc));
      } else {
        var rep = await encStrings(obj, k, PL);
        if (rep) ctx.assign(ref, rep);
      }
    }

    var N = PL.PDFName.of, enc = ctx.obj({
      Filter: N('Standard'), V: 4, R: 4, Length: 128,
      CF: { StdCF: { AuthEvent: N('DocOpen'), CFM: N('AESV2'), Length: 16 } },
      StmF: N('StdCF'), StrF: N('StdCF'),
      O: PL.PDFHexString.of(hex(O)), U: PL.PDFHexString.of(hex(U)), P: P
    });
    ctx.trailerInfo.Encrypt = ctx.register(enc);
    ctx.trailerInfo.ID = ctx.obj([PL.PDFHexString.of(hex(id0)), PL.PDFHexString.of(hex(id0))]);
    return await doc.save({ useObjectStreams: false });
  }

  /* encrypts every string inside an object (in place for dicts / arrays); returns a replacement for a bare string */
  async function encStrings(o, k, PL) {
    if (!o) return null;
    if (o instanceof PL.PDFString || o instanceof PL.PDFHexString) return PL.PDFHexString.of(hex(await aes(k, o.asBytes())));
    if (o instanceof PL.PDFDict) {
      var ents = o.entries();
      for (var i = 0; i < ents.length; i++) {
        var v = ents[i][1];
        if (v instanceof PL.PDFString || v instanceof PL.PDFHexString || v instanceof PL.PDFDict || v instanceof PL.PDFArray) {
          var r = await encStrings(v, k, PL); if (r) o.set(ents[i][0], r);
        }
      }
      return null;
    }
    if (o instanceof PL.PDFArray) {
      for (var j = 0; j < o.size(); j++) {
        var e = o.get(j);
        if (e instanceof PL.PDFString || e instanceof PL.PDFHexString || e instanceof PL.PDFDict || e instanceof PL.PDFArray) {
          var r2 = await encStrings(e, k, PL); if (r2) o.set(j, r2);
        }
      }
    }
    return null;
  }

  root.MGPdfCrypt = { lock: lock, md5: md5, rc4: rc4 };
})(typeof window !== 'undefined' ? window : globalThis);
