/* ============================================================================
   MediaGrabber Pro — maintenance guard  (v2 — instant, loop-free)
   ----------------------------------------------------------------------------
   Loaded in <head> of every entry page, BEFORE the app shell and BEFORE the
   Superpass / checkout paywall. Its only job: if maintenance is ON, send the
   visitor to maintenance.html instead of letting them reach the app or a
   checkout flow.

   WHY v2  (INCIDENT 2026-11-08 follow-up)
   ---------------------------------------
   v1 decided maintenance ASYNCHRONOUSLY: it waited for a Supabase fetch before
   redirecting, so on a first visit (or after the flag had been cleared) the
   visitor sat on the live site for as long as the network took — minutes when
   Supabase was slow or unreachable. That is the "many minutes" window.

   v2 makes the decision SYNCHRONOUS and INSTANT:

     1. FORCE_ON (baked into this file) -> redirect immediately, before any
        network call and before the body is parsed. No fetch on the critical
        path. This is the incident state: maintenance is ON with no time limit.
     2. Otherwise, a locally remembered flag (localStorage) -> redirect
        immediately, still with no network call.
     3. The Supabase switch is consulted ONLY in the background, and ONLY when
        FORCE_ON is false, to refresh the remembered flag for the next visit.
        It is never on the critical path.

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
  var PAGE = 'maintenance.html';

  /* INCIDENT 2026-11-08: the Supabase switch row was tampered with (its message
     field was defaced and maintenance was left OFF). Until the admin restores
     the switch, force the maintenance screen ON for every visitor, instantly.
     Set this back to false to return to switch-driven control. */
  var FORCE_ON = true;

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
      var out = q.toString();
      return out ? '?' + out : '';
    } catch (e) { return ''; }
  }

  function go() {
    try { location.replace(root() + PAGE + search()); }
    catch (e) { location.replace(root() + PAGE); }
  }

  /* ---- 1. INSTANT: forced on (incident state) ----------------------------- */
  if (FORCE_ON) { go(); return; }

  /* ---- 2. INSTANT: remembered on (no network) ----------------------------- */
  var remembered = false;
  try { remembered = localStorage.getItem(FLAG) === '1'; } catch (e) {}
  if (remembered) { go(); return; }

  /* ---- 3. BACKGROUND only: refresh the remembered flag for the next visit -- */
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
