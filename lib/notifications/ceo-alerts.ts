import "server-only";
import { prisma } from "@/lib/db";
import { sendWhatsApp } from "./whatsapp";
import { formatCurrency } from "@/lib/utils";

async function reportSettings() {
  return prisma.reportSettings.findUnique({ where: { id: "singleton" } });
}

/** Notify the CEO of a new operational-fund request. Fire-and-forget & safe. */
export async function notifyFundRequest(requesterName: string | null | undefined, amount: number, items: string[]) {
  try {
    const s = await reportSettings();
    if (s && !s.fundRequestAlerts) return;
    const list = items.slice(0, 10).map((i) => `• ${i}`).join("\n");
    await sendWhatsApp(
      `💼 Operational Fund Request\n${requesterName || "Finance"} has requested ${formatCurrency(amount)}\n\nItems Requested\n${list}\n\nOpen ORA OS to review and approve.`,
    );
  } catch (e) {
    console.error("[notifyFundRequest]", e);
  }
}

/** Notify the CEO that a sales rep submitted their daily field report. */
export async function notifyRepReport(repName: string | null | undefined, location?: string | null) {
  try {
    const s = await reportSettings();
    if (s && !s.repReportAlerts) return;
    await sendWhatsApp(
      `📋 Daily Report Submitted\n${repName || "A sales rep"} has submitted today's field report${location ? ` from ${location}` : ""}.\n\nReview inside ORA OS.`,
    );
  } catch (e) {
    console.error("[notifyRepReport]", e);
  }
}
