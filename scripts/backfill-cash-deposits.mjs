// One-time backfill: the cash workflow now separates "cash received" from
// "deposited". Pre-cutover APPROVED cash sales/collections were confirmed under
// the OLD combined modal (which recorded a deposit account + slip in the same
// step), so they are effectively ALREADY DEPOSITED. Mark them as such under a
// synthetic "legacy" CashDeposit per account, so Cash-on-Hand starts at zero and
// account balances are unchanged.
//
// Run:  DATABASE_URL=<url> DIRECT_URL=<url> node scripts/backfill-cash-deposits.mjs [--commit]
// Without --commit it prints a dry-run breakdown and writes nothing.
import { PrismaClient } from "@prisma/client";

const COMMIT = process.argv.includes("--commit");
const p = new PrismaClient();

// A payment method is "direct to an account" (bank / mobile / cheque) — NOT
// physical cash — if it matches this. Everything else on a CASH sale is cash.
const DIRECT = /bank|mobile|lipa|transfer|cheque|chek|m-?pesa|tigo|airtel|voda|halo|nmb/i;
const isCashMethod = (m) => !m || !DIRECT.test(m);

function code() {
  const s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < 6; i++) r += s[Math.floor(Math.random() * s.length)];
  return `DEP-${r}`;
}

const financeUser =
  (await p.user.findFirst({ where: { role: "FINANCE" }, select: { id: true, name: true } })) ??
  (await p.user.findFirst({ where: { role: "ADMIN" }, select: { id: true, name: true } }));
if (!financeUser) {
  console.error("No FINANCE/ADMIN user found — cannot attribute the legacy deposit.");
  process.exit(1);
}

// Only cash that was banked into a BANK/MOBILE account under the old flow is
// genuinely DEPOSITED. Cash "deposited into the Cash account" (or with no
// account) was never banked — it's still physical cash on hand → RECEIVED.
const bankAccounts = new Set(
  (await p.paymentAccount.findMany({ where: { type: { in: ["BANK", "MOBILE_MONEY"] } }, select: { id: true } })).map((a) => a.id),
);
const isBanked = (acctId) => acctId != null && bankAccounts.has(acctId);

// Candidate rows: APPROVED, not-yet-backfilled (cashStatus null), physical cash.
const sales = (
  await p.fieldSale.findMany({
    where: { type: "CASH", financeStatus: "APPROVED", voided: false, cashStatus: null },
    select: { id: true, total: true, paymentMethod: true, paymentAccountId: true, financeReviewedAt: true, createdAt: true },
  })
).filter((s) => isCashMethod(s.paymentMethod));

const payments = (
  await p.fieldPayment.findMany({
    where: { financeStatus: "APPROVED", cashStatus: null },
    select: { id: true, amount: true, method: true, paymentAccountId: true, financeReviewedAt: true, createdAt: true },
  })
).filter((pay) => isCashMethod(pay.method));

// Split: BANKED (into a real bank/mobile account) → synthetic deposit, DEPOSITED.
// ON HAND (into the Cash account / no account) → RECEIVED, no deposit.
const bankedSales = sales.filter((s) => isBanked(s.paymentAccountId));
const bankedPays = payments.filter((pay) => isBanked(pay.paymentAccountId));
const onHandSales = sales.filter((s) => !isBanked(s.paymentAccountId));
const onHandPays = payments.filter((pay) => !isBanked(pay.paymentAccountId));

// Banked rows grouped by their bank account (each becomes a legacy deposit).
const groups = new Map();
const bucket = (acctId) => {
  if (!groups.has(acctId)) groups.set(acctId, { accountId: acctId, sales: [], payments: [], total: 0 });
  return groups.get(acctId);
};
for (const s of bankedSales) { const g = bucket(s.paymentAccountId); g.sales.push(s); g.total += s.total; }
for (const pay of bankedPays) { const g = bucket(pay.paymentAccountId); g.payments.push(pay); g.total += pay.amount; }

const onHandTotal =
  onHandSales.reduce((a, s) => a + s.total, 0) + onHandPays.reduce((a, x) => a + x.amount, 0);

console.log(`Finance user: ${financeUser.name} (${financeUser.id})`);
console.log(`Cash-like APPROVED sales: ${sales.length} · collections: ${payments.length}`);
console.log(`→ BANKED (→ legacy deposits): ${bankedSales.length} sales + ${bankedPays.length} collections across ${groups.size} account(s)`);
for (const [k, g] of groups) console.log(`    account=${k} → TSh ${g.total.toLocaleString()}`);
console.log(`→ ON HAND (→ RECEIVED, cash-on-hand): ${onHandSales.length} sales + ${onHandPays.length} collections = TSh ${onHandTotal.toLocaleString()}`);
if (!COMMIT) {
  console.log("\nDRY RUN — pass --commit to write.");
  await p.$disconnect();
  process.exit(0);
}

// Banked → DEPOSITED under a synthetic legacy CashDeposit per bank account.
for (const [, g] of groups) {
  const when = g.sales.concat(g.payments).map((r) => r.financeReviewedAt ?? r.createdAt).sort((a, b) => b - a)[0] ?? new Date();
  const dep = await p.cashDeposit.create({
    data: { code: code(), depositAccountId: g.accountId, total: g.total, depositDate: when, note: "Backfilled — banked under the legacy cash-deposit flow.", depositedById: financeUser.id },
  });
  for (const s of g.sales) await p.fieldSale.update({ where: { id: s.id }, data: { cashStatus: "DEPOSITED", cashDepositId: dep.id, cashReceivedAt: s.financeReviewedAt ?? s.createdAt } });
  for (const pay of g.payments) await p.fieldPayment.update({ where: { id: pay.id }, data: { cashStatus: "DEPOSITED", cashDepositId: dep.id, cashReceivedAt: pay.financeReviewedAt ?? pay.createdAt } });
  console.log(`Created ${dep.code} (TSh ${g.total.toLocaleString()}) — ${g.sales.length} sales + ${g.payments.length} collections.`);
}
// On hand → RECEIVED (no deposit — still physical cash, will show as cash-on-hand).
for (const s of onHandSales) await p.fieldSale.update({ where: { id: s.id }, data: { cashStatus: "RECEIVED", cashReceivedAt: s.financeReviewedAt ?? s.createdAt } });
for (const pay of onHandPays) await p.fieldPayment.update({ where: { id: pay.id }, data: { cashStatus: "RECEIVED", cashReceivedAt: pay.financeReviewedAt ?? pay.createdAt } });
console.log(`Marked ${onHandSales.length + onHandPays.length} row(s) RECEIVED — cash-on-hand = TSh ${onHandTotal.toLocaleString()}.`);
console.log("\nBackfill complete.");
await p.$disconnect();
