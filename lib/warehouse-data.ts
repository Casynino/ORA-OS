import { prisma } from "@/lib/db";

export type WarehouseSummary = {
  id: string;
  name: string;
  location: string | null;
  status: string;
  capacity: number | null;
  manager: string | null;
  staffCount: number;
  onHand: number;
  inTransit: number;
  capacityPct: number;
  products: number;
  lowStock: number;
  transfersIn: number;
  transfersOut: number;
  pendingReturns: number;
  activeOrders: number;
};

const ACTIVE_TRANSFER = ["PENDING", "APPROVED", "IN_TRANSIT"] as const;
const ACTIVE_ORDER = ["PENDING", "PRICED", "APPROVED", "IN_TRANSIT"] as const;
const OPEN_RETURN = ["PENDING", "IN_TRANSIT"] as const;

export async function getWarehouseSummaries(): Promise<WarehouseSummary[]> {
  const [warehouses, stock, transfers, returns, orders] = await Promise.all([
    prisma.warehouse.findMany({
      include: { staff: { select: { name: true }, orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.warehouseStock.findMany({
      select: { warehouseId: true, onHand: true, inTransit: true, minLevel: true },
    }),
    prisma.warehouseTransfer.findMany({
      where: { status: { in: [...ACTIVE_TRANSFER] } },
      select: { fromId: true, toId: true },
    }),
    prisma.returnRequest.findMany({
      where: { status: { in: [...OPEN_RETURN] } },
      select: { warehouseName: true },
    }),
    prisma.request.findMany({
      where: { status: { in: [...ACTIVE_ORDER] } },
      select: { warehouseName: true },
    }),
  ]);

  return warehouses.map((w) => {
    const rows = stock.filter((s) => s.warehouseId === w.id);
    const onHand = rows.reduce((s, r) => s + r.onHand, 0);
    const inTransit = rows.reduce((s, r) => s + r.inTransit, 0);
    const lowStock = rows.filter((r) => r.onHand <= r.minLevel).length;
    return {
      id: w.id,
      name: w.name,
      location: w.location,
      status: w.status,
      capacity: w.capacity,
      manager: w.staff[0]?.name ?? null,
      staffCount: w.staff.length,
      onHand,
      inTransit,
      capacityPct: w.capacity && w.capacity > 0 ? Math.min(100, Math.round((onHand / w.capacity) * 100)) : 0,
      products: rows.length,
      lowStock,
      transfersIn: transfers.filter((t) => t.toId === w.id).length,
      transfersOut: transfers.filter((t) => t.fromId === w.id).length,
      pendingReturns: returns.filter((r) => r.warehouseName === w.name).length,
      activeOrders: orders.filter((o) => o.warehouseName === w.name).length,
    };
  });
}

export type StockMatrix = {
  warehouses: { id: string; name: string }[];
  rows: {
    productId: string;
    name: string;
    cells: Record<string, { onHand: number; low: boolean }>;
    total: number;
  }[];
  recommendations: {
    product: string;
    from: string;
    to: string;
    quantity: number;
  }[];
};

// Global view: which warehouse holds each product, plus rebalancing
// suggestions when one warehouse is below its minimum while another has surplus.
export async function getStockMatrix(): Promise<StockMatrix> {
  const [warehouses, products, stock] = await Promise.all([
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { price: "desc" },
      select: { id: true, name: true },
    }),
    prisma.warehouseStock.findMany({
      select: { warehouseId: true, productId: true, onHand: true, minLevel: true },
    }),
  ]);

  const byKey = new Map(stock.map((s) => [`${s.warehouseId}:${s.productId}`, s]));
  const nameById = new Map(warehouses.map((w) => [w.id, w.name]));

  const rows = products.map((p) => {
    const cells: Record<string, { onHand: number; low: boolean }> = {};
    let total = 0;
    for (const w of warehouses) {
      const s = byKey.get(`${w.id}:${p.id}`);
      const onHand = s?.onHand ?? 0;
      const min = s?.minLevel ?? 0;
      cells[w.id] = { onHand, low: onHand <= min && min > 0 };
      total += onHand;
    }
    return { productId: p.id, name: p.name, cells, total };
  });

  const recommendations: StockMatrix["recommendations"] = [];
  for (const p of products) {
    const deficits: { wid: string; need: number }[] = [];
    const surplus: { wid: string; spare: number }[] = [];
    for (const w of warehouses) {
      const s = byKey.get(`${w.id}:${p.id}`);
      if (!s) continue;
      if (s.onHand < s.minLevel) deficits.push({ wid: w.id, need: s.minLevel - s.onHand });
      else if (s.onHand - s.minLevel > 0) surplus.push({ wid: w.id, spare: s.onHand - s.minLevel });
    }
    surplus.sort((a, b) => b.spare - a.spare);
    for (const d of deficits) {
      const src = surplus.find((s) => s.spare > 0);
      if (!src) break;
      const qty = Math.min(d.need, src.spare);
      if (qty <= 0) continue;
      recommendations.push({
        product: p.name,
        from: nameById.get(src.wid) ?? "—",
        to: nameById.get(d.wid) ?? "—",
        quantity: qty,
      });
      src.spare -= qty;
    }
  }

  return { warehouses, rows, recommendations };
}
