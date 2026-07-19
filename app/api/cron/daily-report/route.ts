import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cronAuthorized } from "@/lib/reports/cron-auth";
import { generateDailyReport } from "@/lib/reports/generate-daily";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily Executive Report trigger (external scheduler, secret-gated).
 * - Schedule it once/day at ~19:00 EAT (16:00 UTC), OR run it hourly with
 *   `&checkHour=1` and it only fires at the configured EAT hour (so the send
 *   time stays adjustable from settings without editing the schedule).
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new NextResponse("Unauthorized", { status: 401 });

  const settings = await prisma.reportSettings.findUnique({ where: { id: "singleton" } });
  if (settings && !settings.dailyEnabled) return NextResponse.json({ skipped: "daily reports disabled" });

  const url = new URL(req.url);
  if (url.searchParams.get("checkHour") === "1") {
    const eatHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Dar_es_Salaam", hour: "2-digit", hour12: false }).format(new Date()));
    const target = settings?.dailyHourEat ?? 19;
    if (eatHour !== target) return NextResponse.json({ skipped: `EAT hour ${eatHour} != configured ${target}` });
  }

  const result = await generateDailyReport();
  return NextResponse.json({ ok: true, reportId: result.report.id, link: result.link, whatsapp: result.whatsapp });
}
