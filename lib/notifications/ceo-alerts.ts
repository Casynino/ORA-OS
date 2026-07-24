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
    const purpose = items.slice(0, 12).map((i) => `• ${i}`).join("\n");
    await sendWhatsApp(
      `💰 ORA Fund Request\n\n${requesterName || "Finance"} has submitted a fund request.\n\nTotal Amount:\n${formatCurrency(amount)}\n\nPurpose:\n${purpose}\n\nPlease review in ORA OS.`,
    );
  } catch (e) {
    console.error("[notifyFundRequest]", e);
  }
}

/** Notify the CEO that Finance recorded COMPLETED expenses awaiting allocation.
 *  Deliberately says "recorded", not "requested" — the money is already spent. */
export async function notifyExpensesRecorded(
  recorderName: string | null | undefined,
  count: number,
  total: number,
) {
  try {
    const s = await reportSettings();
    // Reuses the fund-request alert toggle — same class of finance→CEO alert.
    if (s && !s.fundRequestAlerts) return;
    await sendWhatsApp(
      `🧾 ORA Expenses Recorded\n\n${recorderName || "Finance"} has recorded ${count} ORA ${count === 1 ? "expense" : "expenses"} totaling ${formatCurrency(total)}.\n\nPlease review and allocate the expenses to a company account in ORA OS.`,
    );
  } catch (e) {
    console.error("[notifyExpensesRecorded]", e);
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

/** Notify the CEO that Finance verified a payment (cash / bank / mobile / credit). */
export async function notifyPaymentConfirmed(opts: {
  customer: string;
  amount: number;
  method: string | null | undefined;
  verifiedBy: string | null | undefined;
}) {
  try {
    const s = await reportSettings();
    if (s && !s.paymentConfirmAlerts) return;
    await sendWhatsApp(
      `✅ Payment Confirmed\n\nCustomer:\n${opts.customer}\n\nAmount:\n${formatCurrency(opts.amount)}\n\nMethod:\n${opts.method || "—"}\n\nVerified by:\n${opts.verifiedBy || "Finance"}`,
    );
  } catch (e) {
    console.error("[notifyPaymentConfirmed]", e);
  }
}
