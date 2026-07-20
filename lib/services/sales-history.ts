import { prisma } from "@/lib/db";
import { WALKIN_EMAIL } from "@/lib/constants";

// ─────────────────────────────────────────────────────────────────────────────
//  Unified Sales History — the single source of truth for EVERY sale, across all
//  channels: field sales (rep + Admin/Finance office/direct) AND partner /
//  walk-in orders. Every row carries its full audit trail: who created it, their
//  role, when, how it was paid, and whether the money is confirmed/banked.
// ─────────────────────────────────────────────────────────────────────────────

export type SalesHistoryItem = {
  name: string;
  quantity: number; // pieces
  cartons: number;
  pieces: number; // remainder pieces (quantity = cartons*unitsPerCarton + pieces)
  unitPrice: number;
};

export type SalesHistoryRow = {
  id: string;
  code: string;
  channel: "FIELD" | "PARTNER";
  channelLabel: string; // Field sale · Office sale · Partner order · Direct sale
  dateISO: string;
  customer: string;
  createdBy: string;
  createdByRole: string; // Sales rep · Admin · Finance · Partner · Direct sale
  paymentType: "CASH" | "CREDIT";
  paymentMethod: string | null;
  total: number;
  amountPaid: number;
  balance: number;
  totalPieces: number;
  totalCartons: number;
  status: string;
  statusTone: "success" | "warning" | "info" | "destructive" | "secondary";
  confirmed: boolean;
  confirmedBy: string | null;
  items: SalesHistoryItem[];
};

function splitUnits(qty: number, unitsPerCarton: number | null | undefined) {
  const upc = unitsPerCarton && unitsPerCarton > 0 ? unitsPerCarton : 1;
  return { cartons: Math.floor(qty / upc), pieces: qty % upc };
}

function roleLabel(role: string): string {
  switch (role) {
    case "SALES_REP": return "Sales rep";
    case "ADMIN": return "Admin";
    case "FINANCE": return "Finance";
    case "WAREHOUSE": return "Warehouse";
    case "PARTNER": return "Partner";
    default: return role;
  }
}

/**
 * All sales, newest first. Pass `repId` to scope to one rep's own field sales
 * (their "My sales history" — partner orders are excluded from a rep view).
 * Pass `confirmedOnly` for the "completed sales" source of truth.
 */
export async function getSalesHistory(opts?: {
  repId?: string;
  confirmedOnly?: boolean;
}): Promise<SalesHistoryRow[]> {
  const [fieldSales, requests] = await Promise.all([
    prisma.fieldSale.findMany({
      where: {
        voided: false,
        isOpeningBalance: false, // migrated debt is a receivable, not a sale
        ...(opts?.repId ? { repId: opts.repId } : {}),
        ...(opts?.confirmedOnly ? { financeStatus: "APPROVED" } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        rep: { select: { name: true, role: true } },
        customer: { select: { name: true, businessName: true } },
        financeReviewedBy: { select: { name: true } },
        items: { include: { product: { select: { name: true, unitsPerCarton: true } } } },
      },
    }),
    // Partner / walk-in orders are org-wide — excluded from a single rep's view.
    opts?.repId
      ? Promise.resolve([] as never[])
      : prisma.request.findMany({
          where: opts?.confirmedOnly
            ? { status: "FULFILLED" }
            : { status: { in: ["APPROVED", "IN_TRANSIT", "FULFILLED"] }, totalAmount: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 500,
          include: {
            requester: { select: { name: true, email: true } },
            items: { include: { product: { select: { name: true, unitsPerCarton: true } } } },
          },
        }),
  ]);

  const fieldRows: SalesHistoryRow[] = fieldSales.map((s) => {
    const items = s.items.map((i) => {
      const { cartons, pieces } = splitUnits(i.quantity, i.product.unitsPerCarton);
      return { name: i.product.name, quantity: i.quantity, cartons, pieces, unitPrice: i.unitPrice };
    });
    const totalPieces = s.items.reduce((a, i) => a + i.quantity, 0);
    const totalCartons = items.reduce((a, i) => a + i.cartons, 0);
    const isOffice = s.directSale || s.rep.role !== "SALES_REP";

    let status: string;
    let tone: SalesHistoryRow["statusTone"];
    if (s.financeStatus === "REJECTED") {
      status = "Rejected"; tone = "destructive";
    } else if (s.financeStatus === "PENDING") {
      status = "Awaiting confirmation"; tone = "warning";
    } else if (s.type === "CREDIT") {
      if (s.creditStatus === "PAID") { status = "Paid in full"; tone = "success"; }
      else if (s.creditStatus === "OVERDUE") { status = "Overdue"; tone = "destructive"; }
      else if (s.amountPaid > 0) { status = "Part-paid"; tone = "info"; }
      else { status = "Credit — unpaid"; tone = "info"; }
    } else {
      status = s.cashStatus === "DEPOSITED" ? "Confirmed · banked" : "Confirmed";
      tone = "success";
    }

    return {
      id: s.id,
      code: s.code,
      channel: "FIELD",
      channelLabel: isOffice ? "Office sale" : "Field sale",
      dateISO: s.createdAt.toISOString(),
      customer: s.customer?.businessName ?? s.customer?.name ?? s.customerName ?? "Walk-in customer",
      createdBy: s.rep.name,
      createdByRole: roleLabel(s.rep.role),
      paymentType: s.type,
      paymentMethod: s.paymentMethod,
      total: s.total,
      amountPaid: s.amountPaid,
      balance: Math.max(0, s.total - s.amountPaid),
      totalPieces,
      totalCartons,
      status,
      statusTone: tone,
      confirmed: s.financeStatus === "APPROVED",
      confirmedBy: s.financeReviewedBy?.name ?? null,
      items,
    };
  });

  const reqRows: SalesHistoryRow[] = requests.map((r) => {
    const isWalkin = r.requester.email === WALKIN_EMAIL;
    const items = r.items.map((i) => {
      const { cartons, pieces } = splitUnits(i.quantity, i.product.unitsPerCarton);
      return { name: i.product.name, quantity: i.quantity, cartons, pieces, unitPrice: i.unitPrice ?? 0 };
    });
    const totalPieces = r.items.reduce((a, i) => a + i.quantity, 0);
    const totalCartons = items.reduce((a, i) => a + i.cartons, 0);
    const fulfilled = r.status === "FULFILLED";
    return {
      id: r.id,
      code: r.code.replace("REQ", "SALE"),
      channel: "PARTNER",
      channelLabel: isWalkin ? "Direct sale" : "Partner order",
      dateISO: (r.fulfilledAt ?? r.createdAt).toISOString(),
      customer: isWalkin ? (r.deliverTo?.trim() || "Walk-in customer") : r.requester.name,
      createdBy: isWalkin ? "Office" : r.requester.name,
      createdByRole: isWalkin ? "Direct sale" : "Partner",
      paymentType: r.paymentType === "CREDIT" ? "CREDIT" : "CASH",
      paymentMethod: null,
      total: r.totalAmount ?? 0,
      amountPaid: 0,
      balance: 0,
      totalPieces,
      totalCartons,
      status: fulfilled ? "Fulfilled" : "In progress",
      statusTone: fulfilled ? "success" : "info",
      confirmed: fulfilled,
      confirmedBy: null,
      items,
    };
  });

  return [...fieldRows, ...reqRows].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

export type SalesLeader = { name: string; value: number; count: number };

/** Sales dashboard summary — today/week/month, cash/credit split, outstanding,
 *  and the top products / reps / customers. Everything is derived from the same
 *  unified rows, so it always agrees with the Sales History list. EAT (UTC+3). */
export async function getSalesDashboard() {
  const rows = await getSalesHistory();
  const confirmed = rows.filter((r) => r.confirmed);

  const EAT = 3 * 60 * 60 * 1000;
  const nowE = new Date(Date.now() + EAT);
  const y = nowE.getUTCFullYear();
  const mo = nowE.getUTCMonth();
  const day = nowE.getUTCDate();
  const dow = (nowE.getUTCDay() + 6) % 7; // 0 = Monday
  const todayStart = Date.UTC(y, mo, day);
  const weekStart = Date.UTC(y, mo, day - dow);
  const monthStart = Date.UTC(y, mo, 1);
  const eatMs = (iso: string) => new Date(iso).getTime() + EAT;

  const sum = (arr: SalesHistoryRow[]) => arr.reduce((s, r) => s + r.total, 0);
  const since = (start: number) => confirmed.filter((r) => eatMs(r.dateISO) >= start);

  const prod = new Map<string, { name: string; value: number; pieces: number }>();
  for (const r of confirmed)
    for (const i of r.items) {
      const cur = prod.get(i.name) ?? { name: i.name, value: 0, pieces: 0 };
      cur.value += i.quantity * i.unitPrice;
      cur.pieces += i.quantity;
      prod.set(i.name, cur);
    }

  const bump = (m: Map<string, SalesLeader>, key: string, total: number) => {
    const cur = m.get(key) ?? { name: key, value: 0, count: 0 };
    cur.value += total;
    cur.count += 1;
    m.set(key, cur);
  };
  const reps = new Map<string, SalesLeader>();
  const custs = new Map<string, SalesLeader>();
  for (const r of confirmed) {
    if (r.createdByRole === "Sales rep") bump(reps, r.createdBy, r.total);
    bump(custs, r.customer, r.total);
  }
  const top = <T extends { value: number }>(m: Map<string, T>) =>
    [...m.values()].sort((a, b) => b.value - a.value).slice(0, 5);

  return {
    counts: {
      total: rows.length,
      confirmed: confirmed.length,
      pending: rows.filter((r) => r.status === "Awaiting confirmation").length,
    },
    revenue: sum(confirmed),
    revenueToday: sum(since(todayStart)),
    revenueWeek: sum(since(weekStart)),
    revenueMonth: sum(since(monthStart)),
    cash: sum(confirmed.filter((r) => r.paymentType === "CASH")),
    credit: sum(confirmed.filter((r) => r.paymentType === "CREDIT")),
    // Owed on CONFIRMED credit only, so it reconciles with credit sales
    // (outstanding ≤ credit sales). Pending sales sit in `counts.pending`.
    outstanding: confirmed.filter((r) => r.paymentType === "CREDIT").reduce((s, r) => s + r.balance, 0),
    topProducts: [...prod.values()].sort((a, b) => b.value - a.value).slice(0, 5),
    topReps: top(reps),
    topCustomers: top(custs),
  };
}
