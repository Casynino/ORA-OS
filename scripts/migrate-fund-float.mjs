// One-time migration to the "controlled petty-cash float" accounting:
// - CEO approval books the allocation as a Company Expense (money-out).
// - Per-item spend is an OperationalSpend (accountability), NOT a company expense.
//
// Prior build had it inverted (approval booked NO expense; each spend WAS an
// OPERATIONAL_FUND Expense). This converts:
//   1. every existing OPERATIONAL_FUND Expense (which represented actual spend)
//      → an OperationalSpend record, then deletes the Expense.
//   2. every APPROVED funding request → a new allocation Expense (money-out).
//
// Run: DATABASE_URL=<url> DIRECT_URL=<url> node scripts/migrate-fund-float.mjs [--commit]
import { PrismaClient } from "@prisma/client";

const COMMIT = process.argv.includes("--commit");
const p = new PrismaClient();

function code(prefix) {
  const s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < 6; i++) r += s[Math.floor(Math.random() * s.length)];
  return `${prefix}-${r}`;
}

// Idempotency: if any OperationalSpend exists, assume already migrated.
if ((await p.operationalSpend.count()) > 0) {
  console.log("Already migrated — OperationalSpend rows exist. Aborting.");
  await p.$disconnect();
  process.exit(0);
}

// Existing OPERATIONAL_FUND expenses = actual spend under the OLD model.
const spendExpenses = await p.expense.findMany({ where: { source: "OPERATIONAL_FUND" } });
// Approved funding requests → each needs an allocation Expense (money-out).
const approved = await p.pettyCashRequest.findMany({
  where: { status: "APPROVED" },
  include: { requestedBy: { select: { name: true } } },
});

console.log(`Existing fund-spend Expenses → OperationalSpend: ${spendExpenses.length} (Σ ${spendExpenses.reduce((a, e) => a + e.amount, 0).toLocaleString()})`);
console.log(`Approved requests → allocation Expenses: ${approved.length} (Σ ${approved.reduce((a, r) => a + r.amount, 0).toLocaleString()})`);

if (!COMMIT) {
  console.log("\nDRY RUN — pass --commit to migrate.");
  await p.$disconnect();
  process.exit(0);
}

await p.$transaction(async (tx) => {
  // 1) spend Expenses → OperationalSpend, then delete the Expense
  for (const e of spendExpenses) {
    await tx.operationalSpend.create({
      data: {
        code: code("OS"),
        amount: e.amount,
        category: e.category,
        description: e.purpose,
        expenseDate: e.expenseDate,
        note: [e.vendor ? `Vendor: ${e.vendor}` : "", e.note ?? ""].filter(Boolean).join(" · ") || null,
        receiptRef: e.receiptRef ?? null,
        receiptUrl: e.receiptUrl ?? null,
        recordedById: e.recordedById,
      },
    });
    await tx.expense.delete({ where: { id: e.id } });
  }
  // 2) each approved request → allocation Expense (money-out at approval)
  for (const r of approved) {
    await tx.expense.create({
      data: {
        code: code("EXP"),
        source: "OPERATIONAL_FUND",
        category: r.category,
        amount: r.amount,
        purpose: `Operational Fund ${r.code} — ${r.purpose}`,
        note: `Allocated to ${r.requestedBy.name}`,
        expenseDate: r.approvedAt ?? r.createdAt,
        recordedById: r.approvedById ?? r.requestedById,
      },
    });
  }
}, { timeout: 60000 });

const funded = (await p.pettyCashRequest.aggregate({ _sum: { amount: true }, where: { status: "APPROVED" } }))._sum.amount ?? 0;
const spent = (await p.operationalSpend.aggregate({ _sum: { amount: true } }))._sum.amount ?? 0;
const moneyOut = (await p.expense.aggregate({ _sum: { amount: true }, where: { source: "OPERATIONAL_FUND" } }))._sum.amount ?? 0;
console.log(`\nDone. Allocation money-out (P&L) = ${moneyOut.toLocaleString()} · fund balance = ${funded.toLocaleString()} − ${spent.toLocaleString()} = ${(funded - spent).toLocaleString()}.`);
await p.$disconnect();
