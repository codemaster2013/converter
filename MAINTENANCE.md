# Maintenance control — MediaGrabber Pro

One-click switch between **Live** and **Under maintenance**, plus the visitor-facing
maintenance screen. Frozen design — do not redesign.

## Trigger / revert

Open **https://codemaster2013.github.io/converter/admin.html**

1. Sign in once with the admin email + password (Supabase auth). The session is
   remembered on that device.
2. Press the single button:
   - **Take site offline** → maintenance ON
   - **Bring site back online** → maintenance OFF

That is the whole control. One click, no other steps.

## What a visitor sees

| | |
|---|---|
| URL | `/converter/maintenance.html` |
| HTTP status | **200 OK** (never 4xx/5xx) |
| Content | Professional status page: "Under maintenance", scope, window opened, expected return, progress meter, incident ref |
| Error text | **None** — no error, no "something went wrong", no 500/503, no stack trace, no hint of tampering |

The screen is served **before** the Superpass/checkout paywall: `mg-maint-guard.js`
runs in `<head>` of every entry page (line 18 of the VIP page, ~5,600 lines before
the checkout block), so a buyer can never reach checkout while the site is down.

## Files

| File | Role |
|---|---|
| `admin.html` | The one-click control (admin only) |
| `maintenance.html` | The visitor-facing maintenance screen (frozen design) |
| `maintenance.config.js` | Copy + incident timestamps — the only file to edit for wording |
| `mg-maint-guard.js` | Pre-paywall guard, loaded in `<head>` of every entry page |
| `sw.js` | Service worker, `CACHE_VERSION = 'v36'` |
| `fonts/manrope-latin.woff2`, `fonts/jetbrains-mono-latin.woff2` | Self-hosted fonts |

## Palette (frozen)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#05070F` | Page canvas |
| `--bg-inset` | `#141A26` | Meter track, inputs |
| `--line` / `--line-strong` | `#171D29` / `#232C3D` | Hairlines, borders |
| `--fg` / `--fg-2` / `--fg-3` | `#F1F4F7` / `#A2ADB9` / `#8A94A2` | Text (all WCAG AA+) |
| `--accent` (maintenance) | `#E9A23B` amber | Planned work |
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
re-installs — so a returning PWA visitor gets the new mode instead of a cached
live or error page.

## Reversibility

The switch is fully reversible. Nothing is deleted, unpublished or overwritten;
the live site and its history are untouched. The maintenance screen is an
additional file, and the guard is a no-op whenever the switch is OFF.
