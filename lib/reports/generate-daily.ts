import { prisma } from "@/lib/db";
import { getDailyReportData, eatDayRange, type DailyReportData } from "./daily-data";
import { buildDailyReportPdf } from "./daily-pdf";
import { storeReportPdf } from "./store";
import { tsh } from "./pdf-kit";
import { sendWhatsApp, appBaseUrl, type WhatsAppResult } from "@/lib/notifications/whatsapp";

/** The short executive WhatsApp summary (minimal emoji, action-oriented). */
export function buildDailyWhatsApp(d: DailyReportData, link: string): string {
  const pendingColl = d.credit.overdueCount + d.credit.dueSoonCount;
  const lines = [
    "📊 ORA Daily Executive Report",
    `Date: ${d.dateLabel}`,
    "",
    "Today's Highlights",
    `• Revenue: ${tsh(d.sales.revenue)}`,
    `• Cash: ${tsh(d.sales.cash)} · Credit: ${tsh(d.sales.credit)}`,
    `• Collected: ${tsh(d.credit.collectedToday)}`,
    `• New customers: ${d.customers.newCount}`,
    `• Dispatched: ${d.inventory.dispatchedCartons} cartons`,
    `• Pending collections: ${pendingColl} customer${pendingColl === 1 ? "" : "s"}`,
    `• Warehouse requests: ${d.warehouse.pendingRequests}`,
    `• Office expenses: ${tsh(d.finance.officeExpenses)}`,
  ];
  if (d.team.reps[0]) lines.push(`• Top rep: ${d.team.reps[0].name} (${d.team.reps[0].a} sales)`);
  lines.push("", "Full report:", link);
  return lines.join("\n");
}

/**
 * Build the daily report PDF, archive it, and (unless send:false) WhatsApp the
 * CEO a summary + link. Returns the archived Report + the message.
 */
export async function generateDailyReport(ref: Date = new Date(), opts?: { send?: boolean }) {
  const data = await getDailyReportData(ref);
  const pdf = buildDailyReportPdf(data);
  const { start } = eatDayRange(ref);
  const stamp = start.toISOString().slice(0, 10);
  const url = await storeReportPdf(pdf, `daily-${stamp}.pdf`);

  const report = await prisma.report.create({
    data: {
      type: "DAILY",
      periodStart: start,
      title: `ORA Daily Executive Report — ${data.dateLabel}`,
      summary: data as unknown as object,
      pdfUrl: url,
      recipients: process.env.CALLMEBOT_PHONE ?? null,
    },
  });

  const link = `${appBaseUrl()}/r/${report.id}`;
  const message = buildDailyWhatsApp(data, link);
  let whatsapp: WhatsAppResult = { ok: false, skipped: true };
  if (opts?.send !== false) {
    whatsapp = await sendWhatsApp(message);
    if (whatsapp.ok) await prisma.report.update({ where: { id: report.id }, data: { whatsappSent: true } });
  }
  return { report, url, link, message, whatsapp };
}
