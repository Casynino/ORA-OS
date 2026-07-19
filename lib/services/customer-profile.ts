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
  rep: { id: string; name: string; region: string | null } | null;
  registeredBy: string | null;
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
    settledDate: Date | null;
    hasPendingExtension: boolean;
    isOpeningBalance: boolean;
    items: { name: string; quantity: number }[];
  }[];
  extensions: ExtensionEntry[];
  timeline: TimelineEntry[];
};

export type ExtensionEntry = {
  id: string;
  saleId: string;
  saleCode: string;
  saleDate: Date;
  originalDueDate: Date | null;
  requestedDueDate: Date;
  outstanding: number;
  reason: string;
  financeNotes: string | null;
  status: string;
  adminNote: string | null;
  requestedByName: string;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
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
          isOpeningBalance: true,
          payments: { select: { createdAt: true, financeStatus: true } },
        },
      },
    },
  });

  const now = Date.now();
  return customers.map((c) => {
    // Outstanding/overdue include opening balances (they're real debt); the
    // "orders" count and purchase dates count only actual sales.
    const credit = c.sales.filter((s) => s.type === "CREDIT");
    const realSales = c.sales.filter((s) => !s.isOpeningBalance);
    const outstanding = credit.reduce((a, s) => a + Math.max(0, s.total - s.amountPaid), 0);
    const overdue = credit.some((s) => s.creditStatus === "OVERDUE");
    const purchaseDates = realSales.map((s) => s.createdAt.getTime());
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
      orders: realSales.length,
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
        registeredBy: { select: { name: true } },
        sales: {
          orderBy: { createdAt: "desc" },
          include: {
            items: { include: { product: { select: { name: true } } } },
            payments: { orderBy: { createdAt: "desc" } },
            returns: { select: { code: true, quantity: true, creditValue: true, status: true, createdAt: true } },
          },
        },
        creditExtensions: {
          orderBy: { createdAt: "desc" },
          include: {
            sale: { select: { code: true, createdAt: true } },
            requestedBy: { select: { name: true } },
            reviewedBy: { select: { name: true } },
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
  // Opening balances are migrated debt: they count toward outstanding/overdue and
  // credit score (collections-facing), but NEVER toward revenue figures like
  // "lifetime purchases" or credit billed (revenue-facing). Split the two here.
  const creditSales = live.filter((s) => s.type === "CREDIT"); // incl. opening balances
  const cashSales = live.filter((s) => s.type === "CASH");
  const revenueLive = live.filter((s) => !s.isOpeningBalance);
  const revenueCreditSales = creditSales.filter((s) => !s.isOpeningBalance);

  const totalPurchases = revenueLive.reduce((a, s) => a + s.total, 0);
  const totalCash = cashSales.reduce((a, s) => a + s.total, 0);
  const totalCredit = revenueCreditSales.reduce((a, s) => a + s.total, 0); // revenue only
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
  // Denominator is ALL credit incl. opening balances (collections-facing), so a
  // migrated debt is scored on repayment — not excluded like the revenue total.
  const creditBilled = creditSales.reduce((a, s) => a + s.total, 0);
  let creditScore: number | null = null;
  if (creditBilled > 0) {
    const onTime = 1 - overdue / creditBilled;
    const repaid = (creditBilled - outstanding) / creditBilled;
    creditScore = Math.round(
      Math.max(0, Math.min(100, 100 * (0.6 * onTime + 0.4 * repaid))),
    );
  }

  const lastPurchaseDate = revenueLive[0]?.createdAt ?? null;
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
      detail: `by ${customer.registeredBy?.name ?? customer.rep?.name ?? "ORA"}`,
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
      label: s.isOpeningBalance
        ? `Opening balance ${s.code}`
        : `${s.type === "CASH" ? "Cash" : "Credit"} sale ${s.code}`,
      detail: s.isOpeningBalance
        ? "migrated debt (pre-ORA-OS)"
        : s.items.map((i) => `${i.product.name} ×${i.quantity}`).join(" · "),
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

  // ── Credit extension requests (their own history + timeline entries) ──
  const extensions: ExtensionEntry[] = customer.creditExtensions.map((x) => ({
    id: x.id,
    saleId: x.saleId,
    saleCode: x.sale.code,
    saleDate: x.sale.createdAt,
    originalDueDate: x.originalDueDate,
    requestedDueDate: x.requestedDueDate,
    outstanding: x.outstanding,
    reason: x.reason,
    financeNotes: x.financeNotes,
    status: x.status,
    adminNote: x.adminNote,
    requestedByName: x.requestedBy.name,
    reviewedByName: x.reviewedBy?.name ?? null,
    reviewedAt: x.reviewedAt,
    createdAt: x.createdAt,
  }));
  const pendingExtSaleIds = new Set(
    customer.creditExtensions.filter((x) => x.status === "PENDING").map((x) => x.saleId),
  );
  for (const x of customer.creditExtensions) {
    const verb =
      x.status === "APPROVED" ? "approved" : x.status === "REJECTED" ? "rejected" : "requested";
    timeline.push({
      id: `ext-${x.id}`,
      kind: "credit-event",
      label: `Credit extension ${verb} on ${x.sale.code}`,
      detail: `New date ${x.requestedDueDate.toLocaleDateString()} · ${x.reason}`,
      amount: x.outstanding,
      date: x.status === "PENDING" ? x.createdAt : x.reviewedAt ?? x.createdAt,
      status: x.status,
    });
  }
  timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

  // A credit sale's settlement date = when the last non-rejected payment cleared
  // its balance (only meaningful once fully paid).
  const settledDateFor = (s: (typeof live)[number]): Date | null => {
    if (s.type !== "CREDIT" || s.total - s.amountPaid > 0) return null;
    const dates = s.payments
      .filter((p) => p.financeStatus !== "REJECTED")
      .map((p) => p.createdAt.getTime());
    return dates.length ? new Date(Math.max(...dates)) : null;
  };

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
    registeredBy: customer.registeredBy?.name ?? null,
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
      settledDate: settledDateFor(s),
      hasPendingExtension: pendingExtSaleIds.has(s.id),
      isOpeningBalance: s.isOpeningBalance,
      items: s.items.map((i) => ({ name: i.product.name, quantity: i.quantity })),
    })),
    extensions,
    timeline,
  };
}
