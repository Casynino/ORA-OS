import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cronAuthorized } from "@/lib/reports/cron-auth";
import { sendWhatsApp } from "@/lib/notifications/whatsapp";
import { eatDayRange } from "@/lib/reports/daily-data";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Morning credit-collection reminder (external scheduler, secret-gated).
 * Lists customers due today or overdue with their status + total outstanding.
 * No message is sent when nothing is due.
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
    select: {
      total: true, amountPaid: true, creditStatus: true, dueDate: true, customerName: true,
      customer: { select: { name: true, businessName: true } },
    },
  });

  // Aggregate per customer: balance owed + the most-overdue status.
  type Row = { name: string; balance: number; overdueDays: number };
  const byCustomer = new Map<string, Row>();
  let totalDue = 0;
  for (const s of sales) {
    const bal = Math.max(0, s.total - s.amountPaid);
    if (bal <= 0) continue;
    totalDue += bal;
    const name = s.customer?.businessName ?? s.customer?.name ?? s.customerName ?? "Customer";
    const overdueDays = s.creditStatus === "OVERDUE" && s.dueDate
      ? Math.max(1, Math.round((start.getTime() - s.dueDate.getTime()) / 86_400_000))
      : 0;
    const cur = byCustomer.get(name) ?? { name, balance: 0, overdueDays: 0 };
    cur.balance += bal;
    cur.overdueDays = Math.max(cur.overdueDays, overdueDays);
    byCustomer.set(name, cur);
  }

  const rows = [...byCustomer.values()];
  if (rows.length === 0) return NextResponse.json({ skipped: "nothing due today" });

  // Most urgent first (overdue by most days), then biggest balance.
  rows.sort((a, b) => b.overdueDays - a.overdueDays || b.balance - a.balance);
  const list = rows.slice(0, 10)
    .map((r) => `• ${r.name} — ${r.overdueDays > 0 ? `${r.overdueDays} day${r.overdueDays === 1 ? "" : "s"} overdue` : "Due today"}`)
    .join("\n");
  const more = rows.length > 10 ? `\n…and ${rows.length - 10} more` : "";

  const text =
    `⚠️ Credit Collection Reminder\n\n` +
    `${rows.length} customer${rows.length === 1 ? "" : "s"} require follow-up.\n\n` +
    `Total Outstanding:\n${formatCurrency(totalDue)}\n\n` +
    `Customers:\n${list}${more}\n\n` +
    `Finance follow-up required.`;

  const whatsapp = await sendWhatsApp(text);
  return NextResponse.json({ ok: true, customers: rows.length, totalDue, whatsapp });
}
