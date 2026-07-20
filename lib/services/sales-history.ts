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
