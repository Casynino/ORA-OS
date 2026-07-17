import { prisma } from "@/lib/db";

/**
 * One complete customer record, assembled once and shared by the Sales Rep,
 * Admin and Finance customer profiles. A field customer exists once in the
 * system; every department reads the same 360° view from here.
 *
 * Money convention: a sale counts toward the customer's book as soon as the rep
 * records it — we exclude only VOIDED and finance-REJECTED sales (PENDING stays
 * visible), matching the rest of the rep/customer surfaces.
 */

export type TimelineKind =
  | "registered"
  | "cash"
  | "credit"
  | "payment"
  | "return"
  | "credit-event"
  | "note";

export type TimelineEntry = {
  id: string;
  kind: TimelineKind;
  label: string;
  detail?: string | null;
  amount?: number | null;
  date: Date;
  status?: string | null;
};

export type CustomerProfile = {
  id: string;
  businessName: string;
  email: string | null;
  phone: string | null;
  region: string | null;
  district: string | null;
  location: string | null;
  customerType: string | null;
  taxId: string | null;
  expectedVolume: string | null;
  preferredPayment: string | null;
  businessLicense: string | null;
  notes: string | null;
  createdAt: Date;
  creditSuspended: boolean;
  creditLimit: number | null;
  active: boolean;
  rep: { id: string; name: string; region: string | null };
  finance: {
    totalPurchases: number;
    totalCash: number;
    totalCredit: number;
    totalPayments: number;
    outstanding: number;
    overdue: number;
    creditLimit: number | null;
    availableCredit: number | null;
    creditScore: number | null;
    lastPurchaseDate: Date | null;
    lastPaymentDate: Date | null;
  };
  inventory: {
    onCredit: { name: string; quantity: number }[];
    totalUnitsPurchased: number;
    totalReturns: number;
  };
  sales: {
    id: string;
    code: string;
    type: string;
    total: number;
    amountPaid: number;
    balance: number;
    creditStatus: string | null;
    financeStatus: string;
    dueDate: Date | null;
    createdAt: Date;
    items: { name: string; quantity: number }[];
  }[];
  timeline: TimelineEntry[];
};

const ACTIVE_WINDOW_DAYS = 90;

export type CustomerRow = {
  id: string;
  businessName: string;
  phone: string | null;
  region: string | null;
  active: boolean;
  creditSuspended: boolean;
  outstanding: number;
  creditLimit: number | null;
  availableCredit: number | null;
  overdue: boolean;
  lastPurchase: Date | null;
  lastPayment: Date | null;
  orders: number;
};

/** Row-per-customer summary for the "My Customers" list (rep) or any customer
 * table. Excludes voided + finance-rejected sales, matching the profile. */
export async function getFieldCustomerRows(where: {
  repId?: string;
}): Promise<CustomerRow[]> {
  const customers = await prisma.fieldCustomer.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      sales: {
        where: { voided: false, financeStatus: { not: "REJECTED" } },
        select: {
          total: true,
          amountPaid: true,
          type: true,
          creditStatus: true,
          createdAt: true,
          payments: { select: { createdAt: true, financeStatus: true } },
        },
      },
    },
  });

  const now = Date.now();
  return customers.map((c) => {
    const credit = c.sales.filter((s) => s.type === "CREDIT");
    const outstanding = credit.reduce((a, s) => a + Math.max(0, s.total - s.amountPaid), 0);
    const overdue = credit.some((s) => s.creditStatus === "OVERDUE");
    const purchaseDates = c.sales.map((s) => s.createdAt.getTime());
    const lastPurchase = purchaseDates.length ? new Date(Math.max(...purchaseDates)) : null;
    const payDates = [
      ...c.sales.filter((s) => s.type === "CASH").map((s) => s.createdAt.getTime()),
      ...c.sales.flatMap((s) =>
        s.payments.filter((p) => p.financeStatus !== "REJECTED").map((p) => p.createdAt.getTime()),
      ),
    ];
    const lastPayment = payDates.length ? new Date(Math.max(...payDates)) : null;
    const ref = (lastPurchase ?? c.createdAt).getTime();
    const active = now - ref < ACTIVE_WINDOW_DAYS * 86400000;
    const availableCredit =
      c.creditLimit != null ? Math.max(0, c.creditLimit - outstanding) : null;
    return {
      id: c.id,
      businessName: c.businessName ?? c.name,
      phone: c.phone,
      region: c.region,
      active,
      creditSuspended: c.creditSuspended,
      outstanding,
      creditLimit: c.creditLimit,
      availableCredit,
      overdue,
      lastPurchase,
      lastPayment,
      orders: c.sales.length,
    };
  });
}

/** Live = counts toward the customer's book (excludes voided + finance-rejected). */
function isLive(s: { voided: boolean; financeStatus: string }) {
  return !s.voided && s.financeStatus !== "REJECTED";
}

export async function getFieldCustomerProfile(
  id: string,
): Promise<CustomerProfile | null> {
  const [customer, events] = await Promise.all([
    prisma.fieldCustomer.findUnique({
      where: { id },
      include: {
        rep: { select: { id: true, name: true, region: true } },
        sales: {
          orderBy: { createdAt: "desc" },
          include: {
            items: { include: { product: { select: { name: true } } } },
            payments: { orderBy: { createdAt: "desc" } },
            returns: { select: { code: true, quantity: true, creditValue: true, status: true, createdAt: true } },
          },
        },
      },
    }),
    // Credit-limit / suspend / restore / note events are logged against the
    // FieldCustomer entity — they carry the non-sale part of the timeline.
    prisma.activityLog.findMany({
      where: { entity: "FieldCustomer", entityId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, action: true, summary: true, createdAt: true },
    }),
  ]);
  if (!customer) return null;

  const live = customer.sales.filter(isLive);
  const creditSales = live.filter((s) => s.type === "CREDIT");
  const cashSales = live.filter((s) => s.type === "CASH");

  const totalPurchases = live.reduce((a, s) => a + s.total, 0);
  const totalCash = cashSales.reduce((a, s) => a + s.total, 0);
  const totalCredit = creditSales.reduce((a, s) => a + s.total, 0);
  // Money actually collected: cash sales + non-rejected collections (FieldPayment
  // rows). Uses payment records — NOT amountPaid — so debt-recovery returns that
  // bump amountPaid aren't miscounted as cash, and a pending collection counts the
  // same whether the sale was cash or credit.
  const totalCollections = live.reduce(
    (a, s) =>
      a +
      s.payments
        .filter((p) => p.financeStatus !== "REJECTED")
        .reduce((x, p) => x + p.amount, 0),
    0,
  );
  const totalPayments = totalCash + totalCollections;
  const outstanding = creditSales.reduce(
    (a, s) => a + Math.max(0, s.total - s.amountPaid),
    0,
  );
  const overdue = creditSales
    .filter((s) => s.creditStatus === "OVERDUE")
    .reduce((a, s) => a + Math.max(0, s.total - s.amountPaid), 0);

  const availableCredit =
    customer.creditLimit != null
      ? Math.max(0, customer.creditLimit - outstanding)
      : null;

  // Simple 0–100 score: weighted mix of on-time (not overdue) and repaid ratio.
  let creditScore: number | null = null;
  if (totalCredit > 0) {
    const onTime = 1 - overdue / totalCredit;
    const repaid = (totalCredit - outstanding) / totalCredit;
    creditScore = Math.round(
      Math.max(0, Math.min(100, 100 * (0.6 * onTime + 0.4 * repaid))),
    );
  }

  const lastPurchaseDate = live[0]?.createdAt ?? null;
  const allPayDates = [
    ...cashSales.map((s) => s.createdAt),
    ...live.flatMap((s) =>
      s.payments.filter((p) => p.financeStatus !== "REJECTED").map((p) => p.createdAt),
    ),
  ];
  const lastPaymentDate = allPayDates.length
    ? new Date(Math.max(...allPayDates.map((d) => d.getTime())))
    : null;

  // Inventory: products still owed (in credit sales with a balance), aggregated.
  const onCreditMap = new Map<string, number>();
  for (const s of creditSales) {
    if (s.total - s.amountPaid <= 0) continue;
    for (const it of s.items)
      onCreditMap.set(it.product.name, (onCreditMap.get(it.product.name) ?? 0) + it.quantity);
  }
  const onCredit = [...onCreditMap.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity);
  const totalUnitsPurchased = live.reduce(
    (a, s) => a + s.items.reduce((x, i) => x + i.quantity, 0),
    0,
  );
  // Only COMPLETED returns are physically taken back — pending/in-transit/rejected
  // returns shouldn't inflate the total.
  const totalReturns = live.reduce(
    (a, s) =>
      a + s.returns.filter((r) => r.status === "COMPLETED").reduce((x, r) => x + r.quantity, 0),
    0,
  );

  const active = lastPurchaseDate
    ? Date.now() - lastPurchaseDate.getTime() < ACTIVE_WINDOW_DAYS * 86400000
    : Date.now() - customer.createdAt.getTime() < ACTIVE_WINDOW_DAYS * 86400000;

  // ── Timeline: registration + credit events + sales + payments + returns ──
  const timeline: TimelineEntry[] = [
    {
      id: `reg-${customer.id}`,
      kind: "registered",
      label: "Customer registered",
      detail: `by ${customer.rep.name}`,
      date: customer.createdAt,
    },
  ];
  for (const e of events) {
    timeline.push({
      id: e.id,
      kind: e.action.includes("NOTE") ? "note" : "credit-event",
      label: e.summary,
      date: e.createdAt,
    });
  }
  for (const s of live) {
    timeline.push({
      id: `sale-${s.id}`,
      kind: s.type === "CASH" ? "cash" : "credit",
      label: `${s.type === "CASH" ? "Cash" : "Credit"} sale ${s.code}`,
      detail: s.items.map((i) => `${i.product.name} ×${i.quantity}`).join(" · "),
      amount: s.total,
      date: s.createdAt,
      status: s.financeStatus === "PENDING" ? "awaiting finance" : s.creditStatus,
    });
    for (const p of s.payments.filter((p) => p.financeStatus !== "REJECTED")) {
      timeline.push({
        id: `pay-${p.id}`,
        kind: "payment",
        label: `Payment received on ${s.code}`,
        detail: p.method ? `by ${p.method.toLowerCase()}` : null,
        amount: p.amount,
        date: p.createdAt,
        status: p.financeStatus === "PENDING" ? "awaiting finance" : null,
      });
    }
    for (const r of s.returns) {
      timeline.push({
        id: `ret-${r.code}`,
        kind: "return",
        label: `Return ${r.code} on ${s.code}`,
        detail: `${r.quantity} unit(s)`,
        amount: r.creditValue,
        date: r.createdAt,
        status: r.status,
      });
    }
  }
  timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    id: customer.id,
    businessName: customer.businessName ?? customer.name,
    email: customer.email,
    phone: customer.phone,
    region: customer.region,
    district: customer.district,
    location: customer.location,
    customerType: customer.customerType,
    taxId: customer.taxId,
    expectedVolume: customer.expectedVolume,
    preferredPayment: customer.preferredPayment,
    businessLicense: customer.businessLicense,
    notes: customer.notes,
    createdAt: customer.createdAt,
    creditSuspended: customer.creditSuspended,
    creditLimit: customer.creditLimit,
    active,
    rep: customer.rep,
    finance: {
      totalPurchases,
      totalCash,
      totalCredit,
      totalPayments,
      outstanding,
      overdue,
      creditLimit: customer.creditLimit,
      availableCredit,
      creditScore,
      lastPurchaseDate,
      lastPaymentDate,
    },
    inventory: { onCredit, totalUnitsPurchased, totalReturns },
    sales: live.map((s) => ({
      id: s.id,
      code: s.code,
      type: s.type,
      total: s.total,
      amountPaid: s.amountPaid,
      balance: Math.max(0, s.total - s.amountPaid),
      creditStatus: s.creditStatus,
      financeStatus: s.financeStatus,
      dueDate: s.dueDate,
      createdAt: s.createdAt,
      items: s.items.map((i) => ({ name: i.product.name, quantity: i.quantity })),
    })),
    timeline,
  };
}
