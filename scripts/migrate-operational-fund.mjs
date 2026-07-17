// One-time migration to the unified Operational Fund model.
//
// OLD model: approving an office-fund request auto-booked the FULL allocation as
// Expense rows ("Office fund PC-… "), and actual spend was recorded separately
// as PettyCashExpense (which was NOT money-out). So reports counted float, not
// spend. NEW model: funding never creates an Expense; only actual spend does,
// tagged source=OPERATIONAL_FUND. Balance = approved funding − operational spend.
//
// This script: (1) tags every Expense.source; (2) deletes the float-allocation
// Expense rows; (3) re-inserts each PettyCashExpense as an OPERATIONAL_FUND
// Expense. Net effect on money-out: unchanged for reconciled floats; for open
// floats, net profit rises by the unspent amount (the intended correction).
//
// Run: DATABASE_URL=<url> DIRECT_URL=<url> node scripts/migrate-operational-fund.mjs [--commit]
import { PrismaClient } from "@prisma/client";

const COMMIT = process.argv.includes("--commit");
const p = new PrismaClient();

const FLOAT = ["Office fund PC-", "Petty cash PC-"]; // legacy allocation-expense prefixes
function code() {
  const s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < 6; i++) r += s[Math.floor(Math.random() * s.length)];
  return `EXP-${r}`;
}

// Already migrated? (an OPERATIONAL_FUND expense exists)
const already = await p.expense.count({ where: { source: "OPERATIONAL_FUND" } });
if (already > 0) {
  console.log(`Already migrated — ${already} OPERATIONAL_FUND expense(s) exist. Aborting to avoid duplicates.`);
  await p.$disconnect();
  process.exit(0);
}

const allExpenses = await p.expense.findMany({ select: { id: true, code: true, category: true, amount: true, purpose: true } });
const floatRows = allExpenses.filter((e) => FLOAT.some((f) => (e.purpose ?? "").startsWith(f)));
const payrollRows = allExpenses.filter((e) => !floatRows.includes(e) && ((e.purpose ?? "").startsWith("Payroll PAY-") || e.category === "SALARIES"));
const directRows = allExpenses.filter((e) => !floatRows.includes(e) && !payrollRows.includes(e));

const pettyExpenses = await p.pettyCashExpense.findMany({
  include: { request: { select: { category: true, code: true } } },
});

console.log(`Expense rows: ${allExpenses.length} → float(delete) ${floatRows.length}, payroll ${payrollRows.length}, direct ${directRows.length}`);
console.log(`PettyCashExpense → operational Expense: ${pettyExpenses.length} (Σ ${pettyExpenses.reduce((a, e) => a + e.amount, 0).toLocaleString()})`);
console.log(`Float allocation rows to DELETE: Σ ${floatRows.reduce((a, e) => a + e.amount, 0).toLocaleString()}`);

if (!COMMIT) {
  console.log("\nDRY RUN — pass --commit to migrate.");
  await p.$disconnect();
  process.exit(0);
}

await p.$transaction(async (tx) => {
  // 1) Tag sources
  if (payrollRows.length)
    await tx.expense.updateMany({ where: { id: { in: payrollRows.map((e) => e.id) } }, data: { source: "PAYROLL" } });
  if (directRows.length)
    await tx.expense.updateMany({ where: { id: { in: directRows.map((e) => e.id) } }, data: { source: "DIRECT" } });
  // 2) Delete the float-allocation Expense rows (float ≠ money-out anymore)
  if (floatRows.length)
    await tx.expense.deleteMany({ where: { id: { in: floatRows.map((e) => e.id) } } });
  // 3) Re-insert actual office-fund spend as OPERATIONAL_FUND expenses
  for (const e of pettyExpenses) {
    await tx.expense.create({
      data: {
        code: code(),
        category: e.request.category ?? "OFFICE",
        amount: e.amount,
        purpose: e.description,
        source: "OPERATIONAL_FUND",
        receiptRef: e.receiptRef ?? null,
        receiptUrl: e.receiptUrl ?? null,
        expenseDate: e.createdAt,
        recordedById: e.recordedById,
      },
    });
  }
}, { timeout: 60000 });

const funded = (await p.pettyCashRequest.aggregate({ _sum: { amount: true }, where: { status: "APPROVED" } }))._sum.amount ?? 0;
const spent = (await p.expense.aggregate({ _sum: { amount: true }, where: { source: "OPERATIONAL_FUND" } }))._sum.amount ?? 0;
console.log(`\nMigration complete. Operational Fund balance = ${funded.toLocaleString()} funded − ${spent.toLocaleString()} spent = ${(funded - spent).toLocaleString()}.`);
await p.$disconnect();
