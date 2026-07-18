import { prisma } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
//  Company-account balances — the single source of truth for "where ORA's money
//  sits" as a true bank view: balance = money IN − money OUT.
//
//    IN  = receipts routed to the account (approved cash sales, field
//          collections, partner payments, paid orders) + capital injected INTO it
//    OUT = expenses / fund allocations / payroll paid FROM it + owner withdrawals
//
//  Attribution only — the underlying amounts already flow through Business
//  Capital / P&L unchanged, so this never double-counts. Balances CAN go negative
//  when money predating ORA (untracked opening balance) is spent; that's a signal
//  to surface, not a movement to block.
// ─────────────────────────────────────────────────────────────────────────────

export type AccountBalance = {
  id: string;
  name: string;
  type: string; // CASH | BANK | MOBILE_MONEY
  accountName: string | null;
  accountNumber: string | null;
  isActive: boolean;
  inTotal: number;
  outTotal: number;
  balance: number;
};

export async function getAccountBalances(): Promise<AccountBalance[]> {
  const [
    accounts,
    cashSales,
    fieldPays,
    partnerPays,
    orderPays,
    capitalIn,
    capitalOut,
    expenses,
  ] = await Promise.all([
    prisma.paymentAccount.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] }),
    prisma.fieldSale.groupBy({
      by: ["paymentAccountId"],
      where: { voided: false, financeStatus: "APPROVED", type: "CASH", paymentAccountId: { not: null } },
      _sum: { total: true },
    }),
    prisma.fieldPayment.groupBy({
      by: ["paymentAccountId"],
      where: { financeStatus: "APPROVED", paymentAccountId: { not: null }, sale: { voided: false } },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ["paymentAccountId"],
      where: { paymentAccountId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.request.groupBy({
      by: ["paymentAccountId"],
      where: { paymentAccountId: { not: null }, paymentStatus: "PAID" },
      _sum: { totalAmount: true },
    }),
    // Investments (positive) add to the account; withdrawals (negative) leave it.
    // Split by sign so the in/out breakdown is exact, not just the net.
    prisma.capitalEntry.groupBy({
      by: ["paymentAccountId"],
      where: { paymentAccountId: { not: null }, amount: { gt: 0 } },
      _sum: { amount: true },
    }),
    prisma.capitalEntry.groupBy({
      by: ["paymentAccountId"],
      where: { paymentAccountId: { not: null }, amount: { lt: 0 } },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ["paymentAccountId"],
      where: { paymentAccountId: { not: null } },
      _sum: { amount: true },
    }),
  ]);

  const acc = new Map<string, { in: number; out: number }>();
  const bump = (id: string | null, inDelta: number, outDelta: number) => {
    if (!id) return;
    const s = acc.get(id) ?? { in: 0, out: 0 };
    s.in += inDelta;
    s.out += outDelta;
    acc.set(id, s);
  };
  for (const r of cashSales) bump(r.paymentAccountId, r._sum.total ?? 0, 0);
  for (const r of fieldPays) bump(r.paymentAccountId, r._sum.amount ?? 0, 0);
  for (const r of partnerPays) bump(r.paymentAccountId, r._sum.amount ?? 0, 0);
  for (const r of orderPays) bump(r.paymentAccountId, r._sum.totalAmount ?? 0, 0);
  for (const r of capitalIn) bump(r.paymentAccountId, r._sum.amount ?? 0, 0);
  for (const r of capitalOut) bump(r.paymentAccountId, 0, Math.abs(r._sum.amount ?? 0));
  for (const r of expenses) bump(r.paymentAccountId, 0, r._sum.amount ?? 0);

  return accounts.map((a) => {
    const s = acc.get(a.id) ?? { in: 0, out: 0 };
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      accountName: a.accountName,
      accountNumber: a.accountNumber,
      isActive: a.isActive,
      inTotal: s.in,
      outTotal: s.out,
      balance: s.in - s.out,
    };
  });
}

/** Active accounts with live balances, shaped for the money-movement pickers
 *  (CompanyAccountSelect) — so every form shows the CEO where money sits. */
export async function getSelectableAccounts() {
  const balances = await getAccountBalances();
  return balances
    .filter((a) => a.isActive)
    .map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      accountNumber: a.accountNumber,
      balance: a.balance,
    }));
}
