import { prisma } from "@/lib/db";
import { getMonthlyReportData, eatMonthRange, type MonthlyReportData } from "./monthly-data";
import { buildMonthlyReportPdf } from "./monthly-pdf";
import { storeReportPdf } from "./store";
import { tsh } from "./pdf-kit";
import { sendWhatsApp, appBaseUrl, type WhatsAppResult } from "@/lib/notifications/whatsapp";

export function buildMonthlyWhatsApp(d: MonthlyReportData, link: string): string {
  return [
    "📈 ORA Monthly Report",
    d.monthLabel,
    "",
    `Revenue:\n${tsh(d.revenue.total)}`,
    "",
    `Cash Revenue:\n${tsh(d.revenue.cash)}`,
    "",
    `Credit Revenue:\n${tsh(d.revenue.credit)}`,
    "",
    `Collections:\n${tsh(d.collections)}`,
    "",
    `Outstanding Credit:\n${tsh(d.outstanding)}`,
    "",
    `Full Report:\n${link}`,
  ].join("\n");
}

export async function generateMonthlyReport(ref: Date = new Date(), opts?: { send?: boolean }) {
  const data = await getMonthlyReportData(ref);
  const pdf = buildMonthlyReportPdf(data);
  const { start } = eatMonthRange(ref);
  const url = await storeReportPdf(pdf, `monthly-${start.toISOString().slice(0, 7)}.pdf`);

  const report = await prisma.report.create({
    data: {
      type: "MONTHLY",
      periodStart: start,
      title: `ORA Monthly Executive Report — ${data.monthLabel}`,
      summary: data as unknown as object,
      pdfUrl: url,
      recipients: process.env.CALLMEBOT_PHONE ?? null,
    },
  });

  const link = `${appBaseUrl()}/r/${report.id}`;
  const message = buildMonthlyWhatsApp(data, link);
  let whatsapp: WhatsAppResult = { ok: false, skipped: true };
  if (opts?.send !== false) {
    whatsapp = await sendWhatsApp(message);
    if (whatsapp.ok) await prisma.report.update({ where: { id: report.id }, data: { whatsappSent: true } });
  }
  return { report, url, link, message, whatsapp };
}
