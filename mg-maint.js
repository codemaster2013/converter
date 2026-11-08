/* ===== MAINTENANCE MODE (visitor side) =====
   Reads ONE public on/off switch (+ message and the screen's look) from Supabase and shows the maintenance screen when it is ON.
   The look (wording, colours, fonts, sizes, icon) is chosen in the admin console and stored in the same row.
   Privacy: no cookies, no user id, no analytics, no referrer; nothing about the visitor is sent or stored.
   (Only the last on/off answer + look is kept on the device so the screen can appear instantly.) */
(function () {
  'use strict';
  var C = {
    url: 'https://vbawjzscjjakqlomqqpr.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiYXdqenNjampha3Fsb21xcXByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MTM3MDAsImV4cCI6MjEwODk4OTcwMH0.I869HC183sDYPcSZQZmMeFcGkOSb0hz54zWCLGAu0Co'
  };
  var CACHE_KEY = 'mg_maint', CFG_KEY = 'mg_maint_cfg', ID = 'mg-maint-overlay', POLL_MS = 30000;
  /* ---- screen renderer (shared look: validates every setting, so a bad value can never break the page) ---- */
  var MGV = (function () {
    var FONTS = {
      system: 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif',
      arial: 'Arial,Helvetica,sans-serif',
      verdana: 'Verdana,Geneva,sans-serif',
      trebuchet: '"Trebuchet MS",Helvetica,sans-serif',
      georgia: 'Georgia,serif',
      times: '"Times New Roman",Times,serif',
      courier: '"Courier New",Courier,monospace',
      mono: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
      impact: 'Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif',
      comic: '"Comic Sans MS","Comic Neue",cursive'
    };
    var DEF_MSG = 'MediaGrabber Pro is currently down for maintenance. Check back soon!';
    var WRENCH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
    var SVG_OK = { svg: 1, g: 1, path: 1, circle: 1, ellipse: 1, rect: 1, line: 1, polyline: 1, polygon: 1, defs: 1, lineargradient: 1, radialgradient: 1, stop: 1, clippath: 1, mask: 1, symbol: 1, use: 1, title: 1, desc: 1, text: 1, tspan: 1 };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function hex(v, d) { return (typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim())) ? v.trim() : d; }
    function num(v, d, lo, hi) { v = parseInt(v, 10); return isNaN(v) ? d : Math.max(lo, Math.min(hi, v)); }
    function txt(v, d, max) { return typeof v === 'string' ? v.slice(0, max) : d; }
    function fnt(v) { return (typeof v === 'string' && has(FONTS, v)) ? v : 'system'; }
    function obj(v) { return (v && typeof v === 'object') ? v : {}; }

    function clean(raw) {
      if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) { raw = null; } }
      raw = obj(raw);
      var i = obj(raw.icon), t = obj(raw.title), m = obj(raw.message), f = obj(raw.footer);
      return {
        bg: hex(raw.bg, '#080b14'),
        icon: { type: (typeof i.type === 'string' && /^(default|emoji|svg|none)$/.test(i.type)) ? i.type : 'default',
                value: txt(i.value, '', 16), svg: txt(i.svg, '', 20000), size: num(i.size, 76, 24, 200), color: hex(i.color, '#a78bfa') },
        title: { text: txt(t.text, 'Under Maintenance', 120), color: hex(t.color, '#ffffff'), font: fnt(t.font), size: num(t.size, 24, 12, 96) },
        message: { color: hex(m.color, '#7d86a8'), font: fnt(m.font), size: num(m.size, 15, 10, 60) },
        footer: { text: txt(f.text, '\u2014 The MediaGrabber Pro Team', 120), color: hex(f.color, '#7d86a8'), font: fnt(f.font), size: num(f.size, 13, 9, 48) }
      };
    }

    /* pasted SVG code -> safe SVG element (or null). Only drawing shapes are kept: no scripts, no event handlers, no outside links. */
    function cleanSvg(code) {
      try {
        code = String(code).slice(0, 20000).trim();
        if (!/xmlns\s*=/.test(code)) code = code.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
        var doc = new DOMParser().parseFromString(code, 'image/svg+xml');
        var root = doc.documentElement;
        if (!root || root.localName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
        (function walk(n) {
          Array.prototype.slice.call(n.children).forEach(function (c) {
            if (!has(SVG_OK, c.localName.toLowerCase())) { n.removeChild(c); return; }
            walk(c);
          });
          Array.prototype.slice.call(n.attributes).forEach(function (a) {
            var nm = a.name.toLowerCase(), v = a.value;
            if (/^on/.test(nm)) n.removeAttribute(a.name);
            else if ((nm === 'href' || nm === 'xlink:href') && v.trim().charAt(0) !== '#') n.removeAttribute(a.name);
            else if (/javascript:|data:|expression\(|@import/i.test(v)) n.removeAttribute(a.name);
            else if (/url\(\s*['"]?\s*[^#'"\s)]/i.test(v)) n.removeAttribute(a.name);
          });
        })(root);
        return root;
      } catch (e) { return null; }
    }
    function prepSvg(root, ic, isDef) {
      var s = document.importNode(root, true);
      var ow = parseFloat(s.getAttribute('width')), oh = parseFloat(s.getAttribute('height'));
      if (!s.getAttribute('viewBox') && ow > 0 && oh > 0) s.setAttribute('viewBox', '0 0 ' + ow + ' ' + oh);
      s.setAttribute('width', ic.size); s.setAttribute('height', ic.size); s.setAttribute('aria-hidden', 'true');
      s.style.color = ic.color; s.style.display = 'block';
      if (isDef) s.style.filter = 'drop-shadow(0 6px 20px rgba(124,58,237,.55))';
      return s;
    }
    function line(text, c, extra) {
      var d = document.createElement('div'); d.textContent = text;
      d.style.cssText = extra + 'color:' + c.color + ';font-family:' + FONTS[c.font] + ';font-size:' + c.size + 'px;overflow-wrap:anywhere;';
      return d;
    }
    function base(fixed) {
      return (fixed ? 'position:fixed;inset:0;z-index:2147483647;padding:32px;overflow:auto;'
                    : 'position:relative;padding:28px 16px;min-height:300px;border-radius:12px;overflow:hidden;border:1px solid #1e1e32;') +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#fff;box-sizing:border-box';
    }
    function fill(el, msg, cfg) {
      cfg = clean(cfg);
      el.className = 'mm-wrap'; el.style.background = cfg.bg; el.textContent = '';
      var st = document.createElement('style');
      st.textContent = '@keyframes mmPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}@media (prefers-reduced-motion:reduce){.mm-wrap .mm-i{animation:none!important}}';
      el.appendChild(st);
      var ic = cfg.icon, node = null, r;
      if (ic.type === 'emoji') {
        if (ic.value) { node = document.createElement('div'); node.textContent = ic.value; node.style.cssText = 'font-size:' + ic.size + 'px;line-height:1'; }
      } else if (ic.type === 'svg') {
        r = ic.svg && cleanSvg(ic.svg);
        node = r ? prepSvg(r, ic, false) : prepSvg(cleanSvg(WRENCH), ic, true);
      } else if (ic.type === 'default') { node = prepSvg(cleanSvg(WRENCH), ic, true); }
      if (node) {
        var w = document.createElement('div'); w.className = 'mm-i';
        w.style.cssText = 'margin-bottom:18px;line-height:0;animation:mmPulse 2s ease infinite';
        w.appendChild(node); el.appendChild(w);
      }
      if (cfg.title.text) el.appendChild(line(cfg.title.text, cfg.title, 'font-weight:900;letter-spacing:1px;line-height:1.25;margin-bottom:10px;'));
      el.appendChild(line((msg && String(msg).trim()) || DEF_MSG, cfg.message, 'line-height:1.6;max-width:min(92vw,420px);'));
      if (cfg.footer.text) el.appendChild(line(cfg.footer.text, cfg.footer, 'margin-top:22px;'));
    }
    function sig(msg, cfg) { return JSON.stringify([msg || '', clean(cfg)]); }
    return { clean: clean, fill: fill, base: base, sig: sig, cleanSvg: cleanSvg, FONTS: FONTS };
  })();

  var wanted = false, lastMsg = '', lastCfg = null, painted = '';   // wanted = the switch is ON, so the screen must stay up
  var confirmedOn = false;            // the SERVER told us ON during this visit (not just a remembered value)
  var busy = false, retryMs = 4000;   // one check at a time + gentle back-off when the network hiccups

  function show(msg, cfg) {
    wanted = true; lastMsg = msg; lastCfg = cfg;
    if (!document.getElementById('mg-maint-css')) {
      var st = document.createElement('style'); st.id = 'mg-maint-css';
      st.textContent = 'html.mg-maint-on body{display:none!important}';   // the page itself is hidden too, so removing the screen can never reveal it
      document.documentElement.appendChild(st);
    }
    document.documentElement.classList.add('mg-maint-on');
    var el = document.getElementById(ID);
    if (!el) {
      el = document.createElement('div'); el.id = ID; el.setAttribute('role', 'alert');
      el.style.cssText = MGV.base(true);
      document.documentElement.appendChild(el);
      document.documentElement.style.overflow = 'hidden';
      painted = '';
    }
    var sg = MGV.sig(msg, cfg);
    if (sg !== painted) { MGV.fill(el, msg, cfg); painted = sg; }   // only redraw when something really changed
  }

  function hide() {
    wanted = false; confirmedOn = false; painted = '';
    document.documentElement.classList.remove('mg-maint-on');
    var el = document.getElementById(ID);
    if (el) el.parentNode.removeChild(el);
    document.documentElement.style.overflow = '';
  }

  function remember(on, msg, cfg) {
    try {
      localStorage.setItem(CACHE_KEY, on ? '1' : '0');
      if (on) localStorage.setItem(CFG_KEY, JSON.stringify({ m: msg || '', c: cfg || null }));
    } catch (e) {}
  }

  function check() {
    if (busy) return; busy = true;
    fetch(C.url + '/rest/v1/site_settings?id=eq.1&select=maintenance,message,config', {
      headers: { apikey: C.anonKey, Authorization: 'Bearer ' + C.anonKey },
      cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors'
    })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (rows) {
        busy = false; retryMs = 4000;
        var row = rows && rows[0];
        if (!row) return;                                   // empty answer: leave the screen exactly as it is
        if (row.maintenance === true) { remember(true, row.message, row.config); confirmedOn = true; show(row.message, row.config); }
        else if (row.maintenance === false) { remember(false); hide(); }   // ONLY an explicit OFF from the server removes the screen
      })
      .catch(function () {
        busy = false;
        // A failed check never lifts a screen the server has confirmed. Only a screen that came from the remembered
        // value alone is dropped when the device is truly offline (so the installed app still works offline).
        if (navigator.onLine === false && !confirmedOn) { hide(); return; }
        setTimeout(check, retryMs); retryMs = Math.min(retryMs * 2, 60000);
      });
  }

  try {
    new MutationObserver(function () {
      if (wanted && !document.getElementById(ID)) show(lastMsg, lastCfg);
    }).observe(document.documentElement, { childList: true });
  } catch (e) {}

  var was = false; try { was = localStorage.getItem(CACHE_KEY) === '1'; } catch (e) {}
  if (was) {
    var cm = '', cc = null;
    try { var o = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); if (o) { cm = o.m; cc = o.c; } } catch (e) {}
    show(cm, cc);   // appears instantly, already in your custom look
  }
  check();
  setInterval(function () { if (!document.hidden) check(); }, POLL_MS);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  window.addEventListener('online', check);
  window.addEventListener('focus', check);
  window.addEventListener('pageshow', check);
})();
/* ===== END MAINTENANCE MODE ===== */
