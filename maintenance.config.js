/* ============================================================================
   MediaGrabber Pro — maintenance screen configuration
   ----------------------------------------------------------------------------
   This file is the ONLY place the maintenance copy and timestamps live.
   maintenance.html reads it; nothing else needs editing.

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
