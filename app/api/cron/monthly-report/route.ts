import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cronAuthorized } from "@/lib/reports/cron-auth";
import { generateMonthlyReport } from "@/lib/reports/generate-monthly";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Monthly Executive Report trigger (external scheduler, secret-gated).
 * Run it daily — it only fires on the LAST day of the EAT month (when tomorrow
 * is a new month), so it always reports the month that just ended. `&force=1`
 * generates on demand for testing.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new NextResponse("Unauthorized", { status: 401 });

  const settings = await prisma.reportSettings.findUnique({ where: { id: "singleton" } });
  if (settings && !settings.monthlyEnabled) return NextResponse.json({ skipped: "monthly reports disabled" });

  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!force) {
    const OFFSET = 3 * 60 * 60 * 1000; // EAT
    const nowEat = new Date(Date.now() + OFFSET);
    const tomorrowEat = new Date(Date.now() + OFFSET + 24 * 60 * 60 * 1000);
    if (nowEat.getUTCMonth() === tomorrowEat.getUTCMonth()) {
      return NextResponse.json({ skipped: "not the last day of the month" });
    }
  }

  const result = await generateMonthlyReport();
  return NextResponse.json({ ok: true, reportId: result.report.id, link: result.link, whatsapp: result.whatsapp });
}
