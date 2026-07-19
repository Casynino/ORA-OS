import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cronAuthorized } from "@/lib/reports/cron-auth";
import { sendWhatsApp } from "@/lib/notifications/whatsapp";
import { eatDayRange } from "@/lib/reports/daily-data";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Morning credit-collection reminder (external scheduler, secret-gated).
 * Checks credit accounts due today or already overdue; WhatsApps the CEO a
 * short nudge. No message is sent when nothing is due.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new NextResponse("Unauthorized", { status: 401 });

  const settings = await prisma.reportSettings.findUnique({ where: { id: "singleton" } });
  if (settings && !settings.creditReminderEnabled) return NextResponse.json({ skipped: "credit reminders disabled" });

  const { start, end } = eatDayRange();
  const sales = await prisma.fieldSale.findMany({
    where: {
      type: "CREDIT", voided: false, financeStatus: "APPROVED",
      creditStatus: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      OR: [{ creditStatus: "OVERDUE" }, { dueDate: { gte: start, lt: end } }],
    },
    select: { customerId: true, total: true, amountPaid: true, creditStatus: true },
  });

  const byCustomer = new Map<string, number>();
  let totalDue = 0, overdue = 0;
  for (const s of sales) {
    const bal = Math.max(0, s.total - s.amountPaid);
    if (bal <= 0) continue;
    totalDue += bal;
    if (s.creditStatus === "OVERDUE") overdue += 1;
    const key = s.customerId ?? "walk-in";
    byCustomer.set(key, (byCustomer.get(key) ?? 0) + bal);
  }
  const customers = byCustomer.size;
  if (customers === 0) return NextResponse.json({ skipped: "nothing due today" });

  const text =
    `💳 Credit Collection Reminder\n\n` +
    `${customers} customer${customers === 1 ? "" : "s"} ${overdue > 0 ? `(${overdue} overdue) ` : ""}need follow-up today.\n` +
    `Total Due: ${formatCurrency(totalDue)}\n\n` +
    `Finance should follow up on these accounts.\nOpen ORA OS for details.`;

  const whatsapp = await sendWhatsApp(text);
  return NextResponse.json({ ok: true, customers, totalDue, overdue, whatsapp });
}
