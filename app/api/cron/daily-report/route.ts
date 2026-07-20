import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cronAuthorized } from "@/lib/reports/cron-auth";
import { generateDailyReport } from "@/lib/reports/generate-daily";
import { generateMonthlyReport } from "@/lib/reports/generate-monthly";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily Executive Report trigger (Vercel Cron, secret-gated). Scheduled once/day
 * at 16:00 UTC = 19:00 EAT.
 *
 * The MONTHLY report is folded in here (it fires only on the last EAT day of the
 * month) so the whole schedule needs just two cron jobs — valid on every Vercel
 * plan (Hobby allows two, daily-only). `&checkHour=1` lets a Pro account instead
 * schedule this hourly and only send at the EAT hour configured in settings.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new NextResponse("Unauthorized", { status: 401 });

  const settings = await prisma.reportSettings.findUnique({ where: { id: "singleton" } });
  const url = new URL(req.url);

  // Optional hourly-mode gate: only send the DAILY report at the configured EAT
  // hour. (The month-end monthly below still runs regardless.)
  let dailySkip: string | null = null;
  if (settings && !settings.dailyEnabled) {
    dailySkip = "daily reports disabled";
  } else if (url.searchParams.get("checkHour") === "1") {
    const eatHour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Dar_es_Salaam",
        hour: "2-digit",
        hour12: false,
      }).format(new Date()),
    );
    const target = settings?.dailyHourEat ?? 19;
    if (eatHour !== target) dailySkip = `EAT hour ${eatHour} != configured ${target}`;
  }

  const daily = dailySkip ? null : await generateDailyReport();

  // Month-end: also generate the monthly report (when tomorrow, in EAT, is a new
  // month). The monthly generator is idempotent/self-contained.
  const OFFSET = 3 * 60 * 60 * 1000; // EAT (UTC+3)
  const nowEat = new Date(Date.now() + OFFSET);
  const tomorrowEat = new Date(Date.now() + OFFSET + 24 * 60 * 60 * 1000);
  const isLastEatDay = nowEat.getUTCMonth() !== tomorrowEat.getUTCMonth();
  const monthly =
    isLastEatDay && (!settings || settings.monthlyEnabled)
      ? await generateMonthlyReport()
      : null;

  return NextResponse.json({
    ok: true,
    daily: daily ? { reportId: daily.report.id, link: daily.link, whatsapp: daily.whatsapp } : dailySkip,
    monthly: monthly ? { reportId: monthly.report.id, link: monthly.link, whatsapp: monthly.whatsapp } : "not month-end",
  });
}
