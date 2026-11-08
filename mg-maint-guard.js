/* ============================================================================
   MediaGrabber Pro — maintenance guard  (v3 — mode-aware, loop-free)
   ----------------------------------------------------------------------------
   Loaded in <head> of every entry page, BEFORE the app shell and BEFORE the
   Superpass / checkout paywall. Its only job: if maintenance is ON, send the
   visitor to maintenance.html instead of letting them reach the app or a
   checkout flow.

   WHY v3  (2026-11-08 — wording mode + maintenance lifted)
   --------------------------------------------------------
   v2 decided maintenance SYNCHRONOUSLY and INSTANTLY (FORCE_ON, then a
   remembered localStorage flag, then a background refresh). v3 keeps that
   shape and adds two things:

     1. FORCE_ON is now FALSE. The incident is over: the site is LIVE and the
        guard is a no-op unless the Supabase switch is turned back ON.
     2. The guard carries the admin-selected WORDING MODE through to the
        screen, so a visitor redirected to maintenance.html sees the right
        copy ("Under maintenance" by default, "Server down error" when the
        admin selected it). The mode is read from site_settings.config.mode.

   Decision order (unchanged in spirit):
     1. FORCE_ON (baked into this file) -> redirect immediately, no network.
     2. A locally remembered flag -> VERIFY in the background first; if the
        switch is now OFF, clear the flag and stay on the live site; if it is
        ON (or unreachable), redirect. This stops a stale flag from pinning a
        visitor to the maintenance screen after the incident is lifted.
     3. Otherwise the Supabase switch is consulted ONLY in the background, to
        refresh the remembered flag for the next visit. Never on the critical
        path.

   The guard never runs on maintenance.html (or admin.html), so it can never
   bounce a visitor back and forth with the maintenance page's own self-heal —
   that fight was the refresh loop.

   Failure policy: if the switch cannot be reached, the guard does NOTHING.
   A network hiccup must never invent a maintenance screen, and must never
   surface an error to the visitor.
   ========================================================================== */
(function () {
  'use strict';

  var SB_URL = 'https://vbawjzscjjakqlomqqpr.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiYXdqenNjampha3Fsb21xcXByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MTM3MDAsImV4cCI6MjEwODk4OTcwMH0.I869HC183sDYPcSZQZmMeFcGkOSb0hz54zWCLGAu0Co';

  var FLAG = 'mg_maint';
  var MODE_FLAG = 'mg_maint_mode';
  var PAGE = 'maintenance.html';

  /* INCIDENT 2026-11-08: the Supabase switch row was tampered with (its message
     field was defaced and maintenance was left OFF). The incident is now over
     and the site is LIVE, so the forced override is OFF. Set this back to true
     only to force the maintenance screen ON for every visitor, instantly. */
  var FORCE_ON = false;

  /* Never guard the maintenance page itself (it has its own self-heal) and never
     guard the admin console. This is what stops the refresh loop. */
  var here = String(location.pathname).split('/').pop().toLowerCase();
  if (here === PAGE || here === 'admin.html') { return; }

  /* Resolve the site root so this works at /converter/ and at a domain root. */
  function root() {
    var p = location.pathname;
    var i = p.lastIndexOf('/');
    return p.slice(0, i + 1) || '/';
  }

  /* Keep a requested tool (?tool=...) but never carry the QA preview switch. */
  function search() {
    var s = location.search || '';
    if (!s) { return ''; }
    try {
      var q = new URLSearchParams(s);
      q.delete('preview');
      q.delete('mode');
      q.delete('state');
      var out = q.toString();
      return out ? '?' + out : '';
    } catch (e) { return ''; }
  }

  /* Build the maintenance URL, carrying the selected wording mode when known. */
  function go(mode) {
    var q = search();
    var extra = (mode === 'server_down' || mode === 'maintenance') ? 'mode=' + mode : '';
    var url = root() + PAGE;
    if (q && extra) { url += q + '&' + extra; }
    else if (q) { url += q; }
    else if (extra) { url += '?' + extra; }
    try { location.replace(url); }
    catch (e) { location.replace(root() + PAGE); }
  }

  function readSwitch() {
    return fetch(SB_URL + '/rest/v1/site_settings?id=eq.1&select=maintenance,config', {
      headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON },
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      mode: 'cors'
    }).then(function (r) { return r.ok ? r.json() : null; });
  }

  function modeOf(row) {
    var m = row && row.config && row.config.mode;
    return (m === 'server_down' || m === 'maintenance') ? m : null;
  }

  /* ---- 1. INSTANT: forced on (incident state) ----------------------------- */
  if (FORCE_ON) { go(); return; }

  /* ---- 2. Remembered on: verify before bouncing --------------------------- */
  var remembered = false;
  var rememberedMode = null;
  try {
    remembered = localStorage.getItem(FLAG) === '1';
    rememberedMode = localStorage.getItem(MODE_FLAG);
  } catch (e) {}

  if (remembered) {
    try {
      readSwitch()
        .then(function (rows) {
          var row = rows && rows[0];
          if (row && row.maintenance === false) {
            /* The incident is over — clear the stale flag and stay live. */
            try { localStorage.removeItem(FLAG); localStorage.removeItem(MODE_FLAG); } catch (e) {}
            return;
          }
          go(modeOf(row) || rememberedMode);
        })
        .catch(function () { go(rememberedMode); });
    } catch (e) { go(rememberedMode); }
    return;
  }

  /* ---- 3. BACKGROUND only: refresh the remembered flag for the next visit -- */
  try {
    readSwitch()
      .then(function (rows) {
        var row = rows && rows[0];
        if (!row) { return; }                       /* unknown -> do nothing */
        if (row.maintenance === true) {
          var m = modeOf(row);
          try {
            localStorage.setItem(FLAG, '1');
            if (m) { localStorage.setItem(MODE_FLAG, m); }
          } catch (e) {}
          go(m);
        } else if (row.maintenance === false) {
          try { localStorage.removeItem(FLAG); localStorage.removeItem(MODE_FLAG); } catch (e) {}
        }
      })
      .catch(function () { /* unreachable -> stay on the live site */ });
  } catch (e) { /* no fetch -> stay on the live site */ }
})();
