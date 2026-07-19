import { prisma } from "@/lib/db";
import { getDailyReportData, eatDayRange, type DailyReportData } from "./daily-data";
import { buildDailyReportPdf } from "./daily-pdf";
import { storeReportPdf } from "./store";
import { tsh } from "./pdf-kit";
import { sendWhatsApp, appBaseUrl, type WhatsAppResult } from "@/lib/notifications/whatsapp";

/** The short executive WhatsApp summary (minimal emoji, action-oriented). */
export function buildDailyWhatsApp(d: DailyReportData, link: string): string {
  return [
    "📊 ORA Daily Report",
    d.dateLabel,
    "",
    "Today's Overview",
    "",
    `Sales:\n${tsh(d.sales.revenue)}`,
    "",
    `Cash Revenue:\n${tsh(d.sales.cash)}`,
    "",
    `Credit Revenue:\n${tsh(d.sales.credit)}`,
    "",
    `Collections:\n${tsh(d.credit.collectedToday)}`,
    "",
    `Expenses:\n${tsh(d.finance.officeExpenses)}`,
    "",
    `Stock Movement:\n${d.inventory.dispatchedCartons} cartons dispatched`,
    "",
    `Full Report:\n${link}`,
  ].join("\n");
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
