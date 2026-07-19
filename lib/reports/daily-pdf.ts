import type { DailyReportData } from "./daily-data";
import { newReportDoc, kvSection, tableSection, noteBlock, finalizeDoc, tsh } from "./pdf-kit";

/** Render the daily executive report to PDF bytes. */
export function buildDailyReportPdf(d: DailyReportData): Uint8Array {
  const doc = newReportDoc("ORA Daily Executive Report", d.dateLabel);
  let y = 36;

  y = noteBlock(doc, y, "Executive Summary", [
    `Revenue of ${tsh(d.sales.revenue)} across ${d.sales.orderCount} orders. ${tsh(d.credit.collectedToday)} collected from customers, ${d.customers.newCount} new customer${d.customers.newCount === 1 ? "" : "s"} onboarded, and ${d.inventory.dispatchedPieces.toLocaleString()} units dispatched. Outstanding credit stands at ${tsh(d.credit.outstanding)}.`,
  ]);

  y = kvSection(doc, y, "Sales Summary", [
    ["Cash sales", tsh(d.sales.cash)],
    ["Credit sales", tsh(d.sales.credit)],
    ["Partner orders", tsh(d.sales.partnerOrders)],
    ["Total revenue", tsh(d.sales.revenue)],
    ["Units sold", d.sales.unitsSold.toLocaleString()],
    ["Best-selling product", d.sales.bestSeller ? `${d.sales.bestSeller} (${d.sales.bestSellerUnits} units)` : "—"],
  ]);

  y = kvSection(doc, y, "Customer Activity", [
    ["New customers", String(d.customers.newCount)],
    ["Active customers today", String(d.customers.activeCount)],
    ["Credit customers", String(d.customers.creditCount)],
    ["Payments received", tsh(d.customers.paymentsReceived)],
  ]);

  y = kvSection(doc, y, "Credit Overview", [
    ["Outstanding credit", tsh(d.credit.outstanding)],
    ["Collections today", tsh(d.credit.collectedToday)],
    ["Overdue customers", String(d.credit.overdueCount)],
    ["Nearing due date (next 3 days)", String(d.credit.dueSoonCount)],
  ]);

  y = kvSection(doc, y, "Inventory", [
    ["Opening stock", `${d.inventory.openingPieces.toLocaleString()} pcs`],
    ["Dispatched", `${d.inventory.dispatchedPieces.toLocaleString()} pcs (${d.inventory.dispatchedCartons} cartons)`],
    ["Returned", `${d.inventory.returnedPieces.toLocaleString()} pcs`],
    ["Current stock", `${d.inventory.currentPieces.toLocaleString()} pcs`],
  ]);

  y = kvSection(doc, y, "Warehouse Activity", [
    ["Units dispatched", `${d.warehouse.dispatches.toLocaleString()} pcs`],
    ["Units returned", `${d.warehouse.returns.toLocaleString()} pcs`],
    ["Transfers", String(d.warehouse.transfers)],
    ["Pending stock requests", String(d.warehouse.pendingRequests)],
  ]);

  y = kvSection(doc, y, "Finance Activity", [
    ["Payments verified", String(d.finance.paymentsVerified)],
    ["Cash received", tsh(d.finance.cashReceived)],
    ["Deposits made", tsh(d.finance.deposits)],
    ["Office expenses", tsh(d.finance.officeExpenses)],
  ]);

  y = tableSection(doc, y, "Team Performance — Sales Representatives",
    ["Representative", "Sales", "Customers", "Revenue"],
    d.team.reps.map((r) => [r.name, r.a, r.b, tsh(r.c)]));

  if (d.team.finance.length)
    y = tableSection(doc, y, "Team Performance — Finance",
      ["Staff", "Payments verified", "Amount verified"],
      d.team.finance.map((r) => [r.name, r.a, tsh(r.b)]));

  if (d.team.warehouse.length)
    y = tableSection(doc, y, "Team Performance — Warehouse",
      ["Staff", "Dispatches", "Units moved"],
      d.team.warehouse.map((r) => [r.name, r.a, r.b]));

  noteBlock(doc, y, "Business Insights", d.insights);
  return finalizeDoc(doc);
}
