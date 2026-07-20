# Executive WhatsApp Reports — Setup

ORA OS generates executive PDF reports, archives them, and WhatsApps the CEO via
**CallMeBot**.

**Two kinds of notification — only one is scheduled:**
- **Event alerts fire instantly, no scheduler** — a fund request, a confirmed
  payment, or a rep's daily report is sent the moment it happens, straight from
  the server action. Nothing to configure.
- **Time-of-day reports are scheduled** — the daily 7pm summary, the month-end
  report, and the morning credit reminder. These run on **Vercel Cron**
  (declared in `vercel.json`), triggered automatically by Vercel — no external
  service. Setup is just the env vars below + a redeploy.

## 1. Vercel environment variables

Project → Settings → Environment Variables (Production), then **redeploy**:

| Variable | Value |
|---|---|
| `CALLMEBOT_PHONE` | Admin WhatsApp number, international, no `+` — e.g. `447516239665` |
| `CALLMEBOT_APIKEY` | Your CallMeBot API key |
| `CRON_SECRET` | A random secret — generate with `openssl rand -hex 24` |
| `BLOB_READ_WRITE_TOKEN` | Already set (used for PDF storage). Add a Vercel Blob store if missing. |
| `NEXT_PUBLIC_APP_URL` | `https://ora-os-eight.vercel.app` (used to build report links) |

> To pause all WhatsApp sending, set `NOTIFICATIONS_DISABLED=1`. Or toggle
> individual notifications in **Admin → Reports → Notification settings**.

## 2. Scheduling — Vercel Cron (automatic, no external service)

The schedules live in **`vercel.json`** (`crons`) and run on Vercel itself. When
`CRON_SECRET` is set in the project env, **Vercel automatically sends it as
`Authorization: Bearer <CRON_SECRET>`** on every cron request, which the routes
verify — so there's nothing to keep in sync and no public `?secret=` URL. Just
have `CRON_SECRET` set and **redeploy**; the crons register on deploy.

> **Vercel Cron runs in UTC**, and ORA operates in **EAT (UTC+3)**. The schedules
> below are already converted, and the routes double-check the EAT clock/date
> themselves (via `Africa/Dar_es_Salaam`), so the send times are timezone-correct.

| Report | `vercel.json` path | Schedule (UTC) | Effect |
|---|---|---|---|
| **Daily** | `/api/cron/daily-report?checkHour=1` | `0 * * * *` (hourly) | Sends only at the EAT hour set in **Admin → Reports → Daily send time** (default 19:00 EAT). Change it in the app — no redeploy. |
| **Monthly** | `/api/cron/monthly-report` | `0 18 * * *` (21:00 EAT daily) | Self-fires only on the **last EAT day** of the month. |
| **Credit reminder** | `/api/cron/credit-reminder` | `0 4 * * *` (07:00 EAT) | Morning list of customers due/overdue (silent if nothing is due). |

To change a fixed time, edit `vercel.json` and redeploy. The daily send time is
adjustable in-app without a redeploy (hourly cron + the `checkHour` gate).

> Verify in the Vercel dashboard: **Project → Settings → Cron Jobs** lists the
> three jobs and their last run. You can **Run** any of them manually there.

## Testing

- **Admin → Reports** has **Generate & send daily**, **Generate & send monthly**,
  and **Send test WhatsApp** buttons. Every generated report is archived there
  with a **View PDF** link (also the link sent over WhatsApp — public, no login).
- Manually trigger a route: open its URL with the `?secret=` in a browser.

## What triggers a WhatsApp

- **Daily report** (scheduled) · **Monthly report** (last day of month)
- **Credit reminder** (morning, only if something's due)
- **Operational fund request** submitted by Finance
- **Field report** submitted by a Sales Rep

All are toggleable in Admin → Reports → Notification settings.
