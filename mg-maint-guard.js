/* ============================================================================
   MediaGrabber Pro — maintenance guard
   ----------------------------------------------------------------------------
   Loaded in <head> of every entry page, BEFORE the app shell and BEFORE the
   Superpass / checkout paywall. Its only job: if maintenance is ON, send the
   visitor to maintenance.html instead of letting them reach the app or a
   checkout flow.

   Two-stage, so there is no flash of the live site or of a paywall:

     1. SYNCHRONOUS  — if this device already knows maintenance is ON
                       (localStorage flag written by a previous visit), redirect
                       immediately, before the body is parsed.
     2. ASYNC        — ask the switch (Supabase) for the truth and correct the
                       flag. ON  -> redirect.  OFF -> clear the flag so the next
                       visit is normal.

   Failure policy: if the switch cannot be reached, the guard does NOTHING.
   A network hiccup must never invent a maintenance screen, and must never
   surface an error to the visitor.
   ========================================================================== */
(function () {
  'use strict';

  var SB_URL = 'https://vbawjzscjjakqlomqqpr.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiYXdqenNjampha3Fsb21xcXByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MTM3MDAsImV4cCI6MjEwODk4OTcwMH0.I869HC183sDYPcSZQZmMeFcGkOSb0hz54zWCLGAu0Co';

  var FLAG = 'mg_maint';
  var PAGE = 'maintenance.html';

  /* Never guard the maintenance page itself — it has its own self-heal. */
  var here = String(location.pathname).split('/').pop().toLowerCase();
  if (here === PAGE) { return; }

  /* Resolve the site root so this works at /converter/ and at a domain root. */
  function root() {
    var p = location.pathname;
    var i = p.lastIndexOf('/');
    return p.slice(0, i + 1) || '/';
  }

  function go() {
    try { location.replace(root() + PAGE + location.search.replace(/^\?/, '?')); }
    catch (e) { location.replace(root() + PAGE); }
  }

  /* ---- 1. synchronous: remembered ON -------------------------------------- */
  var remembered = false;
  try { remembered = localStorage.getItem(FLAG) === '1'; } catch (e) {}
  if (remembered) { go(); return; }

  /* ---- 2. async: ask the switch ------------------------------------------- */
  try {
    fetch(SB_URL + '/rest/v1/site_settings?id=eq.1&select=maintenance', {
      headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON },
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      mode: 'cors'
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        var row = rows && rows[0];
        if (!row) { return; }                       /* unknown -> do nothing */
        if (row.maintenance === true) {
          try { localStorage.setItem(FLAG, '1'); } catch (e) {}
          go();
        } else if (row.maintenance === false) {
          try { localStorage.removeItem(FLAG); } catch (e) {}
        }
      })
      .catch(function () { /* unreachable -> stay on the live site */ });
  } catch (e) { /* no fetch -> stay on the live site */ }
})();
