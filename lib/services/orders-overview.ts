import { prisma } from "@/lib/db";
import { WALKIN_EMAIL } from "@/lib/constants";

// ─────────────────────────────────────────────────────────────────────────────
//  Order Control Center — one normalized view of EVERY order across ORA:
//  partner/agent orders (Request) and sales-rep stock requests (RepStockRequest).
//  Each row carries its stage, a full status timeline, items, and (for rep
//  requests) the warehouse-availability needed to approve inline.
// ─────────────────────────────────────────────────────────────────────────────

export type OrderStage = "pending" | "ready" | "inprogress" | "completed" | "cancelled";

export type OrderTimelineStep = { label: string; at: string | null; done: boolean };

export type OrderFulfilItem = {
  productId: string;
  productName: string;
  unitsPerCarton: number;
  requested: number;
  available: number;
  isSample: boolean;
};

export type OrderRow = {
  id: string;
  code: string;
  kind: "PARTNER" | "REP_STOCK";
  kindLabel: string;
  who: string; // partner/customer OR the rep the stock is for
  requestedBy: string;
  role: string; // Partner · Sales rep
  warehouse: string | null;
  productCount: number;
  totalQty: number;
  dateISO: string;
  completedAtISO: string | null;
  stage: OrderStage;
  status: string;
  statusTone: "warning" | "info" | "success" | "destructive" | "secondary";
  total: number | null; // money — partner orders only
  paymentLabel: string | null;
  note: string | null;
  items: { name: string; quantity: number }[];
  timeline: OrderTimelineStep[];
  detailHref: string | null; // partner orders manage on their detail page
  fulfilItems: OrderFulfilItem[] | null; // rep PENDING → inline approve
};

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export async function getOrdersOverview(): Promise<OrderRow[]> {
  const [requests, repRequests, stock] = await Promise.all([
    prisma.request.findMany({
      orderBy: { createdAt: "desc" },
      take: 400,
      include: {
        requester: { select: { name: true, organization: true, role: true, email: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    }),
    prisma.repStockRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 400,
      include: {
        rep: { select: { name: true } },
        warehouse: { select: { name: true } },
        items: { include: { product: { select: { name: true, unitsPerCarton: true } } } },
      },
    }),
    prisma.warehouseStock.groupBy({ by: ["productId"], _sum: { onHand: true, reserved: true } }),
  ]);

  const availableById = new Map(
    stock.map((s) => [s.productId, Math.max(0, (s._sum.onHand ?? 0) - (s._sum.reserved ?? 0))]),
  );

  // ── Partner / agent orders ──────────────────────────────────────────────
  const partnerRows: OrderRow[] = requests.map((r) => {
    const isWalkin = r.requester.email === WALKIN_EMAIL;
    const stage: OrderStage =
      r.status === "PENDING" || r.status === "PRICED" ? "pending"
      : r.status === "APPROVED" ? "ready"
      : r.status === "IN_TRANSIT" ? "inprogress"
      : r.status === "FULFILLED" ? "completed"
      : "cancelled";
    const statusMap: Record<string, { label: string; tone: OrderRow["statusTone"] }> = {
      PENDING: { label: "Pending approval", tone: "warning" },
      PRICED: { label: "Priced · to approve", tone: "warning" },
      APPROVED: { label: "Approved · to dispatch", tone: "info" },
      IN_TRANSIT: { label: "In transit", tone: "info" },
      FULFILLED: { label: "Completed", tone: "success" },
      REJECTED: { label: "Rejected", tone: "destructive" },
      CANCELLED: { label: "Cancelled", tone: "destructive" },
    };
    const s = statusMap[r.status] ?? { label: r.status, tone: "secondary" as const };
    const totalQty = r.items.reduce((a, i) => a + i.quantity, 0);
    const cancelled = stage === "cancelled";
    const timeline: OrderTimelineStep[] = cancelled
      ? [
          { label: "Requested", at: iso(r.createdAt), done: true },
          { label: r.status === "REJECTED" ? "Rejected" : "Cancelled", at: iso(r.reviewedAt ?? r.updatedAt), done: true },
        ]
      : [
          { label: "Requested", at: iso(r.createdAt), done: true },
          { label: "Priced", at: iso(r.reviewedAt), done: ["PRICED", "APPROVED", "IN_TRANSIT", "FULFILLED"].includes(r.status) },
          { label: "Approved", at: iso(r.reviewedAt), done: ["APPROVED", "IN_TRANSIT", "FULFILLED"].includes(r.status) },
          { label: "In transit", at: null, done: ["IN_TRANSIT", "FULFILLED"].includes(r.status) },
          { label: "Delivered · completed", at: iso(r.deliveredAt ?? r.fulfilledAt), done: r.status === "FULFILLED" },
        ];
    return {
      id: r.id,
      code: r.code.replace("REQ", "ORD"),
      kind: "PARTNER",
      kindLabel: isWalkin ? "Direct order" : "Partner order",
      who: isWalkin ? (r.deliverTo?.trim() || "Walk-in") : (r.requester.organization ?? r.requester.name),
      requestedBy: r.requester.name,
      role: isWalkin ? "Direct" : "Partner",
      warehouse: r.warehouseName ?? null,
      productCount: r.items.length,
      totalQty,
      dateISO: r.createdAt.toISOString(),
      completedAtISO: iso(r.fulfilledAt),
      stage,
      status: s.label,
      statusTone: s.tone,
      total: r.totalAmount,
      paymentLabel: r.paymentType === "CREDIT" ? "Credit" : "Immediate",
      note: r.note,
      items: r.items.map((i) => ({ name: i.product.name, quantity: i.quantity })),
      timeline,
      detailHref: `/admin/requests/${r.id}`,
      fulfilItems: null,
    };
  });

  // ── Sales-rep stock requests ────────────────────────────────────────────
  const repRows: OrderRow[] = repRequests.map((r) => {
    const stage: OrderStage =
      r.status === "PENDING" ? "pending"
      : r.status === "READY" ? "ready"
      : r.status === "ISSUED" ? "completed"
      : "cancelled";
    const statusMap: Record<string, { label: string; tone: OrderRow["statusTone"] }> = {
      PENDING: { label: "Awaiting review", tone: "warning" },
      READY: { label: "Prepared · to collect", tone: "info" },
      ISSUED: { label: "Collected", tone: "success" },
      REJECTED: { label: "Rejected", tone: "destructive" },
    };
    const s = statusMap[r.status] ?? { label: r.status, tone: "secondary" as const };
    const totalQty = r.items.reduce((a, i) => a + i.quantity, 0);
    const timeline: OrderTimelineStep[] = r.status === "REJECTED"
      ? [
          { label: "Requested", at: iso(r.createdAt), done: true },
          { label: "Rejected", at: iso(r.reviewedAt), done: true },
        ]
      : [
          { label: "Requested", at: iso(r.createdAt), done: true },
          { label: "Prepared", at: iso(r.preparedAt ?? r.reviewedAt), done: ["READY", "ISSUED"].includes(r.status) },
          { label: "Collected", at: iso(r.collectedAt), done: r.status === "ISSUED" },
        ];
    return {
      id: r.id,
      code: r.code,
      kind: "REP_STOCK",
      kindLabel: "Rep stock request",
      who: r.rep.name,
      requestedBy: r.rep.name,
      role: "Sales rep",
      warehouse: r.warehouse?.name ?? null,
      productCount: r.items.length,
      totalQty,
      dateISO: r.createdAt.toISOString(),
      completedAtISO: iso(r.collectedAt),
      stage,
      status: s.label,
      statusTone: s.tone,
      total: null,
      paymentLabel: null,
      note: r.note,
      items: r.items.map((i) => ({ name: i.product.name, quantity: i.quantity })),
      timeline,
      detailHref: null,
      fulfilItems:
        r.status === "PENDING"
          ? r.items.map((it) => ({
              productId: it.productId,
              productName: it.product.name,
              unitsPerCarton: it.product.unitsPerCarton,
              requested: it.quantity,
              available: availableById.get(it.productId) ?? 0,
              isSample: it.kind === "SAMPLE",
            }))
          : null,
    };
  });

  return [...partnerRows, ...repRows].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}
