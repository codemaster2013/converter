/* ============================================================================
   MediaGrabber Pro — maintenance screen configuration
   ----------------------------------------------------------------------------
   This file is the ONLY place the maintenance copy and timestamps live.
   maintenance.html reads it; nothing else needs editing.

   MODE SWITCH (added 2026-11-08)
   ------------------------------
   `mode` selects which wording the maintenance screen shows. Two values:

     'maintenance'  -> "Under maintenance"   (DEFAULT — used when nothing else
                        is said; scope: "Conversion engine & API")
     'server_down'  -> "Server down error"   (used ONLY when the admin
                        explicitly selects "Server down"; scope: "fixing website")

   The default is 'maintenance'. The mode can be flipped two ways:
     1. One-click: admin.html -> "Maintenance" / "Server down" selector
        (writes site_settings.config.mode in Supabase).
     2. One line:  set `mode` below and commit, or set the Supabase
        site_settings.config.mode value to 'server_down' / 'maintenance'.

   Resolution order on the screen: ?mode= / ?state= in the URL  >
   Supabase config.mode  >  this file's `mode`  >  'maintenance'.

   TIMING MODEL (important)
   ------------------------
   `opened_at` is the real incident timestamp (absolute, ISO-8601, UTC).
   `restore_in_minutes` is a ROLLING window measured from "now", so the
   expected-return time is always computed from the incident start and never
   decays into a stale/past date.

   There is NO time limit: the screen is never removed by a timer. It is
   removed only when the admin switch is explicitly set back to Live.
   ========================================================================== */

window.MAINTENANCE_OVERRIDE = {
  /* LIVE OVERRIDE (added 2026-11-19, second pass)
     ------------------------------------------------------------------------
     The site is declared LIVE in code. The Supabase site_settings row was left
     at maintenance:true after the incident was closed and the anon key cannot
     PATCH it (401 / RLS), so the switch alone kept pinning every visitor to
     this screen. While `live_override` is true, maintenance.html sends the
     visitor straight back to the app and clears the remembered flags.

     To deliberately declare an incident again: set this to false AND set
     FORCE_ON = true in mg-maint-guard.js (or turn the Supabase switch on). */
  live_override: true,

  /* Which wording to show. 'maintenance' (default) | 'server_down' */
  mode: 'maintenance',

  state: 'maintenance',
  preview: false,
  brand: 'MediaGrabber Pro',
  contact_email: 'singh.darshil2013@gmail.com',
  timezone: 'Asia/Kolkata',

  /* No auto-recovery: the switch is the only thing that lifts the screen. */
  healthcheck: { enabled: false, url: '', interval_ms: 60000 },

  states: {
    maintenance: {
      title: 'Under maintenance — MediaGrabber Pro',
      badge: 'Maintenance in progress',
      headline: 'Under maintenance',
      lede: 'MediaGrabber Pro is offline while we carry out scheduled maintenance on the conversion engine. Nothing is wrong with your account, and no files are at risk. We will be back shortly.',
      status: 'Scheduled maintenance',
      scope: 'Conversion engine & API',

      /* Incident start — the real timestamp the window opened. */
      opened_at: '2026-11-08T13:05:00Z',

      /* Expected return window, measured from now (rolling, never expires). */
      restore_in_minutes: 180,

      meter_label: 'Maintenance window',
      eta_noun: 'remaining',
      signoff: '— The Convert Team',
      ref: 'INC-2026-1108-M'
    },

    /* Explicit "Server down" wording. Selected only when the admin says so. */
    server_down: {
      title: 'Server down error — MediaGrabber Pro',
      badge: 'Server down',
      headline: 'Server down error',
      lede: 'MediaGrabber Pro is temporarily unavailable while we fix the website. Nothing is wrong with your account, and no files are at risk. We will be back shortly.',
      status: 'Server down',
      scope: 'fixing website',

      /* Incident start — the real timestamp the window opened. */
      opened_at: '2026-11-19T06:40:00Z',

      /* Expected return window, measured from now (rolling, never expires). */
      restore_in_minutes: 180,

      meter_label: 'Repair window',
      eta_noun: 'remaining',
      signoff: '— The Convert Team',
      ref: 'INC-2026-1119-D'
    },

    security: {
      title: 'Security review — MediaGrabber Pro',
      badge: 'Security review in progress',
      headline: 'Temporarily locked',
      lede: 'We have taken MediaGrabber Pro offline as a precaution while our response team completes a security review of the upload and conversion pipeline. Your files are secure, nothing has been lost, and no action is needed from you.',
      status: 'Investigation open',
      scope: 'Upload & conversion pipeline',
      opened_at: '2026-11-08T10:55:00Z',
      restore_in_minutes: 180,
      next_update_in_minutes: 45,
      meter_label: 'Review progress',
      eta_noun: 'to restore',
      owner: 'Quick Response Team',
      signoff: '— The Convert Team · Quick Response Team',
      ref: 'INC-2026-1108-S'
    }
  }
};

/* ---------------------------------------------------------------------------
   LIVE OVERRIDE — redirect back to the app (added 2026-11-19, second pass)
   ---------------------------------------------------------------------------
   maintenance.html loads this file, so the redirect lives here: one small file
   instead of editing the 38 KB page. While `live_override` is true, anyone who
   still lands on the maintenance screen (stale bookmark, old service worker,
   or the stale Supabase switch) is sent straight back to the app and the
   remembered flags are cleared.

   This cannot loop: mg-maint-guard.js never runs on maintenance.html, and with
   LIVE_OVERRIDE = true it returns immediately on every other page.

   To deliberately declare an incident again: set `live_override: false` above
   AND set FORCE_ON = true in mg-maint-guard.js (or turn the Supabase switch on).
   --------------------------------------------------------------------------- */
(function () {
  'use strict';
  var cfg = window.MAINTENANCE_OVERRIDE || {};
  if (cfg.live_override !== true) { return; }
  try {
    localStorage.removeItem('mg_maint');
    localStorage.removeItem('mg_maint_mode');
  } catch (e) {}
  try { window.location.replace('./'); } catch (e) {}
})();
