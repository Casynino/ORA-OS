import type { MonthlyReportData } from "./monthly-data";
import { newReportDoc, kvSection, tableSection, noteBlock, finalizeDoc, tsh } from "./pdf-kit";

/** Render the monthly executive report — the official monthly business report. */
export function buildMonthlyReportPdf(d: MonthlyReportData): Uint8Array {
  const doc = newReportDoc("ORA Monthly Executive Report", d.monthLabel);
  let y = 36;

  y = noteBlock(doc, y, "Executive Summary", [
    `${d.monthLabel} generated total revenue of ${tsh(d.revenue.total)} on ${d.revenue.unitsSold.toLocaleString()} units, closing at an operating ${d.profit >= 0 ? "profit" : "loss"} of ${tsh(Math.abs(d.profit))}. ${tsh(d.collections)} was collected from customers and ${d.newCustomers} new customer${d.newCustomers === 1 ? "" : "s"} joined. Outstanding credit stands at ${tsh(d.outstanding)}.`,
  ]);

  y = kvSection(doc, y, "Revenue", [
    ["Cash revenue", tsh(d.revenue.cash)],
    ["Credit revenue", tsh(d.revenue.credit)],
    ["Partner orders", tsh(d.revenue.partnerOrders)],
    ["Total revenue", tsh(d.revenue.total)],
    ["Units sold", d.revenue.unitsSold.toLocaleString()],
    ["Growth vs last month", d.growthPct == null ? "—" : `${d.growthPct >= 0 ? "+" : ""}${d.growthPct}%`],
  ]);

  y = kvSection(doc, y, "Financial Performance", [
    ["Collections", tsh(d.collections)],
    ["Expenses", tsh(d.expenses)],
    ["Operating profit", tsh(d.profit)],
    ["Outstanding credit", tsh(d.outstanding)],
  ]);

  y = kvSection(doc, y, "Customers & Inventory", [
    ["New customers", String(d.newCustomers)],
    ["Units dispatched", `${d.inventory.dispatched.toLocaleString()} pcs`],
    ["Current stock", `${d.inventory.current.toLocaleString()} pcs`],
  ]);

  y = tableSection(doc, y, "Top Products", ["#", "Product", "Units sold"],
    d.topProducts.map((p, i) => [i + 1, p.name, p.units.toLocaleString()]));

  y = tableSection(doc, y, "Top Customers", ["#", "Customer", "Revenue"],
    d.topCustomers.map((c, i) => [i + 1, c.name, tsh(c.revenue)]));

  if (d.topRep)
    y = kvSection(doc, y, "Top Sales Representative", [
      ["Name", d.topRep.name],
      ["Revenue", tsh(d.topRep.revenue)],
      ["Sales", String(d.topRep.sales)],
    ]);

  noteBlock(doc, y, "Business Insights", d.insights);
  return finalizeDoc(doc);
}
