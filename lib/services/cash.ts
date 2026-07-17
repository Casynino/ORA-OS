import { prisma } from "@/lib/db";

/**
 * Cash-on-Hand & Deposits — the money finance has physically received from reps
 * but not yet banked, plus the record of bank deposits that banked it.
 *
 * Money convention: a cash sale/collection becomes revenue when finance confirms
 * it (financeStatus APPROVED). Physical cash then sits as cashStatus=RECEIVED
 * ("on hand") until finance batches it into a CashDeposit (cashStatus=DEPOSITED).
 * Bank/mobile/cheque money never enters this ledger (it lands in an account).
 */

export type CashOnHandItem = {
  id: string;
  kind: "sale" | "collection";
  saleCode: string;
  label: string; // customer / who
  amount: number;
  method: string | null;
  rep: string;
  receivedAt: Date;
};

export type CashDepositLine = {
  kind: "sale" | "collection";
  saleCode: string;
  label: string;
  amount: number;
  who: string;
};

export type CashDepositRow = {
  id: string;
  code: string;
  accountName: string;
  total: number;
  depositDate: Date;
  slipRef: string | null;
  slipUrl: string | null;
  note: string | null;
  depositedBy: string;
  itemCount: number;
  createdAt: Date;
  lines: CashDepositLine[];
};

function windows() {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Week starts Monday.
  const day = (now.getDay() + 6) % 7;
  const startWeek = new Date(startToday);
  startWeek.setDate(startToday.getDate() - day);
  return { startToday, startWeek };
}

/** Everything the Cash-on-Hand & Deposits surfaces need, in one round. */
export async function getCashSummary() {
  const [onHandSales, onHandPayments, deposits] = await Promise.all([
    prisma.fieldSale.findMany({
      where: { cashStatus: "RECEIVED", financeStatus: "APPROVED", voided: false },
      select: {
        id: true,
        code: true,
        total: true,
        paymentMethod: true,
        cashReceivedAt: true,
        createdAt: true,
        rep: { select: { name: true } },
        customer: { select: { name: true, businessName: true } },
        customerName: true,
      },
      orderBy: { cashReceivedAt: "asc" },
    }),
    prisma.fieldPayment.findMany({
      where: { cashStatus: "RECEIVED", financeStatus: "APPROVED", sale: { is: { voided: false } } },
      select: {
        id: true,
        amount: true,
        method: true,
        cashReceivedAt: true,
        createdAt: true,
        recordedBy: { select: { name: true } },
        sale: {
          select: {
            code: true,
            voided: true,
            customer: { select: { name: true, businessName: true } },
            customerName: true,
          },
        },
      },
      orderBy: { cashReceivedAt: "asc" },
    }),
    prisma.cashDeposit.findMany({
      include: {
        depositAccount: { select: { name: true } },
        depositedBy: { select: { name: true } },
        _count: { select: { fieldSales: true, fieldPayments: true } },
        fieldSales: {
          select: {
            code: true,
            total: true,
            rep: { select: { name: true } },
            customer: { select: { name: true, businessName: true } },
            customerName: true,
          },
        },
        fieldPayments: {
          select: {
            amount: true,
            recordedBy: { select: { name: true } },
            sale: { select: { code: true, customer: { select: { name: true, businessName: true } }, customerName: true } },
          },
        },
      },
      orderBy: [{ depositDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const items: CashOnHandItem[] = [
    ...onHandSales.map((s) => ({
      id: s.id,
      kind: "sale" as const,
      saleCode: s.code,
      label: s.customer?.businessName ?? s.customer?.name ?? s.customerName ?? "walk-in customer",
      amount: s.total,
      method: s.paymentMethod,
      rep: s.rep.name,
      receivedAt: s.cashReceivedAt ?? s.createdAt,
    })),
    ...onHandPayments
      // Guard: a voided sale's collection shouldn't ride along.
      .filter((p) => !p.sale.voided)
      .map((p) => ({
        id: p.id,
        kind: "collection" as const,
        saleCode: p.sale.code,
        label: p.sale.customer?.businessName ?? p.sale.customer?.name ?? p.sale.customerName ?? "customer",
        amount: p.amount,
        method: p.method,
        rep: p.recordedBy.name,
        receivedAt: p.cashReceivedAt ?? p.createdAt,
      })),
  ].sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());

  const { startToday, startWeek } = windows();
  const total = items.reduce((a, i) => a + i.amount, 0);
  const today = items.filter((i) => i.receivedAt >= startToday).reduce((a, i) => a + i.amount, 0);
  const week = items.filter((i) => i.receivedAt >= startWeek).reduce((a, i) => a + i.amount, 0);

  const depositRows: CashDepositRow[] = deposits.map((d) => ({
    id: d.id,
    code: d.code,
    accountName: d.depositAccount.name,
    total: d.total,
    depositDate: d.depositDate,
    slipRef: d.slipRef,
    slipUrl: d.slipUrl,
    note: d.note,
    depositedBy: d.depositedBy.name,
    itemCount: d._count.fieldSales + d._count.fieldPayments,
    createdAt: d.createdAt,
    lines: [
      ...d.fieldSales.map((s) => ({
        kind: "sale" as const,
        saleCode: s.code,
        label: s.customer?.businessName ?? s.customer?.name ?? s.customerName ?? "walk-in customer",
        amount: s.total,
        who: s.rep.name,
      })),
      ...d.fieldPayments.map((pp) => ({
        kind: "collection" as const,
        saleCode: pp.sale.code,
        label: pp.sale.customer?.businessName ?? pp.sale.customer?.name ?? pp.sale.customerName ?? "customer",
        amount: pp.amount,
        who: pp.recordedBy.name,
      })),
    ],
  }));

  return {
    onHand: { total, today, week, count: items.length },
    items,
    deposits: depositRows,
    depositedTotal: depositRows.reduce((a, d) => a + d.total, 0),
  };
}
