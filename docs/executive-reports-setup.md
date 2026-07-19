# Executive WhatsApp Reports — Setup

ORA OS now generates executive PDF reports, archives them, and WhatsApps the CEO
via **CallMeBot**. Scheduling is done by an **external cron** (e.g. cron-job.org)
hitting secure routes. Two setup steps: (1) Vercel env vars, (2) cron schedules.

## 1. Vercel environment variables

Project → Settings → Environment Variables (Production), then **redeploy**:

| Variable | Value |
|---|---|
| `CALLMEBOT_PHONE` | CEO number, international, no `+` — e.g. `255766790794` |
| `CALLMEBOT_APIKEY` | Your CallMeBot API key |
| `CRON_SECRET` | A random secret — generate with `openssl rand -hex 24` |
| `BLOB_READ_WRITE_TOKEN` | Already set (used for PDF storage). Add a Vercel Blob store if missing. |
| `NEXT_PUBLIC_APP_URL` | `https://ora-os-eight.vercel.app` (used to build report links) |

> To pause all WhatsApp sending, set `NOTIFICATIONS_DISABLED=1`. Or toggle
> individual notifications in **Admin → Reports → Notification settings**.

## 2. Schedule the routes (cron-job.org)

Create 3 cron jobs. Each URL must include `?secret=<CRON_SECRET>` (same value as
the Vercel env var). Times below are **EAT (UTC+3)** — set cron-job.org's timezone
to Africa/Dar_es_Salaam.

| Report | URL | Schedule |
|---|---|---|
| **Daily** | `https://ora-os-eight.vercel.app/api/cron/daily-report?secret=SECRET` | Daily at 19:00 |
| **Credit reminder** | `https://ora-os-eight.vercel.app/api/cron/credit-reminder?secret=SECRET` | Daily at 08:00 |
| **Monthly** | `https://ora-os-eight.vercel.app/api/cron/monthly-report?secret=SECRET` | Daily at 20:00 (it self-fires only on the last day of the month) |

**Configurable daily time:** to change the daily send time from the app instead
of the schedule, run the daily job **hourly** with `&checkHour=1`
(`…/daily-report?secret=SECRET&checkHour=1`). It then sends only at the hour set
in Admin → Reports → *Daily send time (EAT)*.

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
