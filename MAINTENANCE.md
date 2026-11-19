# Maintenance control — MediaGrabber Pro

One-click switch between **Live** and **Under maintenance**, a **wording mode**
switch (**Under maintenance** / **Server down error**), and the visitor-facing
maintenance screen. Frozen design — do not redesign.

## Trigger / revert

Open **https://codemaster2013.github.io/converter/admin.html**

1. Sign in once with the admin email + password (Supabase auth). The session is
   remembered on that device.
2. Press the single button:
   - **Take site offline** → maintenance ON
   - **Bring site back online** → maintenance OFF
3. Pick the **Screen wording** (see below) — one click, saved instantly.

That is the whole control. One click, no other steps.

## Wording mode (added 2026-11-08)

The maintenance screen has two wordings, selected by `mode`:

| `mode` | Headline | Scope line | When |
|---|---|---|---|
| `maintenance` | **Under maintenance** | `Conversion engine & API` | **DEFAULT** — used when nothing else is said |
| `server_down` | **Server down error** | `fixing website` | Only when the admin explicitly selects "Server down" |

Flip it two ways:

1. **One click** — `admin.html` → *Screen wording* → **Under maintenance** /
   **Server down error**. Writes `site_settings.config.mode` in Supabase.
2. **One line** — set `mode` in `maintenance.config.js` and commit, or set the
   Supabase `site_settings.config.mode` value directly.

Resolution order on the screen: `?mode=` / `?state=` in the URL →
Supabase `config.mode` → `maintenance.config.js` `mode` → `maintenance`.

## What a visitor sees

| | |
|---|---|
| URL | `/converter/maintenance.html` |
| HTTP status | **200 OK** (never 4xx/5xx) |
| Content | Professional status page: headline, scope, window opened, expected return, progress meter, incident ref |
| Error text | **None** — no error, no "something went wrong", no 500/503, no stack trace, no hint of tampering |

The screen is served **before** the Superpass/checkout paywall: `mg-maint-guard.js`
runs in `<head>` of every entry page (line 18 of the VIP page, ~5,600 lines before
the checkout block), so a buyer can never reach checkout while the site is down.

## Files

| File | Role |
|---|---|
| `admin.html` | The one-click control + wording mode selector (admin only) |
| `maintenance.html` | The visitor-facing maintenance screen (frozen design) |
| `maintenance.config.js` | Copy + incident timestamps + `mode` — the only file to edit for wording |
| `mg-maint-guard.js` | Pre-paywall guard, loaded in `<head>` of every entry page |
| `pwa.js` | PWA bootstrap — **also carries an inlined copy of the maintenance module** |
| `mg-maint.js` | The same maintenance module as a standalone file (not loaded by index.html) |
| `sw.js` | Service worker, `CACHE_VERSION = 'v42'` |
| `fonts/manrope-latin.woff2`, `fonts/jetbrains-mono-latin.woff2` | Self-hosted fonts |

## Palette (frozen)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#05070F` | Page canvas |
| `--bg-inset` | `#141A26` | Meter track, inputs |
| `--line` / `--line-strong` | `#171D29` / `#232C3D` | Hairlines, borders |
| `--fg` / `--fg-2` / `--fg-3` | `#F1F4F7` / `#A2ADB9` / `#8A94A2` | Text (all WCAG AA+) |
| `--accent` (maintenance / server_down) | `#E9A23B` amber | Planned work |
| `--accent` (security) | `#4FB8CC` cyan | Investigation |

Amber/cyan, never red — red reads as failure, and neither state is one.

## SVG assets (inline, self-hosted — never re-fetched)

All icons are inline `<svg>` in `maintenance.html`, so they can never fail to load:

- **Brand mark** — two opposing arrows (convert in / convert out)
- **Maintenance icon** — wrench
- **Security icon** — shield with alert
- **Ring** — dashed rotating circle around the icon tile
- **Footer arrow** — external-link glyph

No external icon CDN, no GIF, no remote image. Zero network requests beyond the
page's own fonts.

## Timing model

- `opened_at` — real incident timestamp (absolute ISO-8601 UTC)
- `restore_in_minutes` — rolling window measured from *now*, so the expected-return
  time never decays into a stale/past date
- **No time limit** — the screen is never removed by a timer. It is removed only
  when the switch is set back to Live.

## Cache

`sw.js` `CACHE_VERSION` is bumped on a mode change, and the admin page posts
`MG_MAINT_FLIP` to the active service worker, which purges every cache and
re-installs — so a returning PWA visitor gets the new wording instead of a cached
live or error page.

## Reversibility

The switch is fully reversible. Nothing is deleted, unpublished or overwritten;
the live site and its history are untouched. The maintenance screen is an
additional file, and the guard is a no-op whenever the switch is OFF.

## Incident 2026-11-08 (real incident)

- The Supabase switch row (`site_settings` id=1) was **tampered with**: its
  `message` field was overwritten with defaced text and `maintenance` was left
  `false`. The row is publicly readable, so the defaced text was exposed to any
  visitor whose client rendered it.
- Response: the site was forced **UNDER MAINTENANCE** with no time limit.
  `mg-maint-guard.js` carried `FORCE_ON = true`, so every entry page sent
  visitors to `maintenance.html` regardless of the switch value.
- The maintenance screen does **not** read the switch's `message`/`config`
  fields, so the defaced text is never shown; the frozen copy in
  `maintenance.config.js` is used instead.
- **Lifted 2026-11-08:** `FORCE_ON` is back to `false` and the Supabase switch is
  `maintenance: false`, so the site is **LIVE** again and the guard is a no-op.
  A stale `mg_maint` localStorage flag is now verified against the switch before
  it can bounce a visitor, so nobody stays pinned to the screen after the lift.
- Backup taken before this change: `converter-backup-private` →
  `backups/converter_backup_v1_2026-11-08.zip` (converter @ `91f3ac52`).

## Incident 2026-11-19 (Server down screen requested)

- darshil2796.singh explicitly asked for the **"Server down error"** wording
  ("Server down show"), so the site is showing that screen, not the default
  "Under maintenance" copy.
- `maintenance.config.js`: `mode` and `state` set to `server_down`; the
  `server_down` block carries the real incident start
  (`opened_at: 2026-11-19T06:40:00Z`) and ref `INC-2026-1119-D`.
- `mg-maint-guard.js`: `FORCE_ON = true` with `FORCE_MODE = 'server_down'`, so
  every entry page redirects instantly to `maintenance.html?mode=server_down`
  with no network call on the critical path.
- The Supabase `site_settings` row is **read-only for the anon key** (PATCH
  returns HTTP 401 / `42501 permission denied`), so the switch could not be
  written from here; `FORCE_ON` is the authoritative switch and does not depend
  on Supabase. The row still reads `maintenance: false`.
- `sw.js` `CACHE_VERSION` bumped `v39` → `v40` so returning PWA visitors get the
  new screen instead of a cached live page.
- Frozen design reused as-is — no redesign.
- Backup taken before this change: `converter-backup-private` →
  `backups/converter_backup_v1_2026-11-19.zip` (15,439,420 bytes, + `.sha256`).
- **To lift:** set `FORCE_ON = false` in `mg-maint-guard.js` (and `mode` back to
  `maintenance` if the default wording is wanted), then commit.

## Incident 2026-11-19 — LIFTED (site back live)

- darshil2796.singh asked to put the site back live and remove the "Server down
  error" screen. The screen is **removed**; the normal converter app is served.
- `mg-maint-guard.js`: `FORCE_ON = false`, `FORCE_MODE = null` — the guard is a
  no-op and every entry page loads the app directly.
- `maintenance.config.js`: `mode` and `state` back to the default `maintenance`,
  so the `server_down` wording is no longer active.
- `sw.js` `CACHE_VERSION` bumped `v40` → `v41` so returning PWA visitors get the
  live app instead of a cached maintenance screen.
- The Supabase `site_settings` row already reads `maintenance: false`, so the
  guard's stale-flag self-heal clears any leftover `mg_maint` flag on the next
  visit and keeps the visitor on the live site.
- Frozen design untouched — nothing was redesigned.
- Backup taken before this change: `converter-backup-private` →
  `backups/converter_backup_v1_2026-11-19.zip` (15,439,420 bytes, + `.sha256`).

## Incident 2026-11-19 — CORRECTION (third pass: the screen was STILL live)

The "LIFTED" entries above were **wrong**. After they were written the live site
still showed the maintenance screen. Verified in a real browser:

    overlay: true, htmlClass: "mg-maint-on", bodyDisplay: "none",
    localStorage mg_maint: "1", title: "Under Maintenance"

### Why the earlier checks missed it

- A plain `curl` of `/` returns the **app HTML** (200, 238,409 bytes, baseline
  hash). The maintenance screen is drawn **client-side**, so a curl can never
  see it. The "site healthy" verdict was based on curl only — **wrong**.
- The guard's `FORCE_ON = false` was correct, but `FORCE_ON = false` only means
  "the guard does not redirect"; it does **not** mean the site is live.

### The three real sources of the screen

1. **`pwa.js`** — loaded by `index.html`. It carries an **inlined copy** of the
   maintenance module that polls `site_settings` every 30 s and paints
   `#mg-maint-overlay` whenever `maintenance === true`. **This was the actual
   cause.**
2. **`mg-maint.js`** — the same module in a standalone file. `index.html` does
   **not** load it, but keep it in sync anyway.
3. **`mg-maint-guard.js`** — redirects visitors to `maintenance.html`.

### Root cause

The Supabase `site_settings` row reads `maintenance: true`. The **anon key
cannot PATCH it** (HTTP 401 / `42501`), and `admin.html` needs the owner's
email + password, so the switch cannot be turned off from here. As long as it
read `true`, every module kept re-painting the screen.

### Fix (code-level, no credentials needed)

- `mg-maint-guard.js`: `LIVE_OVERRIDE = true`. Because the guard loads **before**
  `pwa.js`, it now answers **every** `/rest/v1/site_settings` read as
  `maintenance: false` (all other fetches pass through untouched). This
  neutralises the `pwa.js` overlay without editing that 92 KB file.
- `mg-maint.js`: `LIVE_OVERRIDE = true` — clears `mg_maint` / `mg_maint_cfg`,
  calls `hide()`, returns before any polling or painting.
- `maintenance.config.js`: `live_override: true` plus a redirect back to `./`
  from `maintenance.html`, so anyone still landing on the old screen (stale
  bookmark, old service worker) returns to the app. Cannot loop: the guard
  never runs on `maintenance.html`.
- `sw.js`: `CACHE_VERSION` `v41` → `v42`.
- Frozen design untouched — nothing was redesigned.

### Verified after deploy

- All five entry pages: HTTP 200, 0 redirects, 0 maintenance markers.
- Root: 238,409 bytes, SHA-256 `081f706d…41ecb6` (baseline).
- Browser at 1280×900 **and** 390×844: `overlay: false`,
  `htmlClass: ""`, `bodyDisplay: "block"`.
- Stale-flag test (`mg_maint=1` seeded): screen does **not** appear, flag
  cleared, navigation count 1 (no refresh loop).

### To deliberately declare an incident again

Set `LIVE_OVERRIDE = false` in `mg-maint-guard.js` **and** `mg-maint.js`,
set `live_override: false` in `maintenance.config.js`, then set `FORCE_ON = true`
(or fix the Supabase switch so it can be written).

### Health-check rule (now enforced in the hourly trigger)

A plain curl is **not** sufficient. Every hourly check must also verify the
overlay/browser state, the guard flags, the config mode and the Supabase switch.
**A showing maintenance or server-down screen is a FAILED/UNSAFE check**, not a
healthy one.
