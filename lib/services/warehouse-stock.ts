import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

// Keeps the per-warehouse location ledger (WarehouseStock) in sync with the
// org-wide inventory engine. Invariant preserved: Σ WarehouseStock.onHand per
// product == org-wide Inventory.warehouseQty.

async function resolveWarehouseId(
  tx: Tx,
  warehouseName?: string | null,
): Promise<string | null> {
  if (warehouseName) {
    const w = await tx.warehouse.findFirst({
      where: { name: warehouseName },
      select: { id: true },
    });
    if (w) return w.id;
  }
  const main = await tx.warehouse.findFirst({
    where: { name: { contains: "Main" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (main) return main.id;
  const any = await tx.warehouse.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return any?.id ?? null;
}

// Deduct `quantity` of a product across warehouses — preferring the fulfilling
// warehouse, then those holding the most — so the total drops by exactly
// `quantity` and no warehouse goes negative (org-wide already guaranteed ≥ qty).
export async function deductWarehouseStock(
  tx: Tx,
  {
    productId,
    quantity,
    preferWarehouseName,
    warehouseId,
  }: {
    productId: string;
    quantity: number;
    preferWarehouseName?: string | null;
    warehouseId?: string | null;
  },
): Promise<void> {
  if (quantity <= 0) return;

  // Exact-warehouse deduction (used by targeted admin adjustments).
  if (warehouseId) {
    const row = await tx.warehouseStock.findUnique({
      where: { warehouseId_productId: { warehouseId, productId } },
    });
    if (!row) return;
    const take = Math.min(row.onHand, quantity);
    if (take > 0) {
      await tx.warehouseStock.update({
        where: { id: row.id },
        data: { onHand: { decrement: take }, lastMoveAt: new Date() },
      });
    }
    return;
  }

  const rows = await tx.warehouseStock.findMany({ where: { productId } });
  if (rows.length === 0) return;

  let preferredId: string | null = null;
  if (preferWarehouseName) {
    const w = await tx.warehouse.findFirst({
      where: { name: preferWarehouseName },
      select: { id: true },
    });
    preferredId = w?.id ?? null;
  }
  const ordered = [...rows].sort((a, b) => {
    if (a.warehouseId === preferredId) return -1;
    if (b.warehouseId === preferredId) return 1;
    return b.onHand - a.onHand;
  });

  let remaining = quantity;
  for (const r of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(r.onHand, remaining);
    if (take <= 0) continue;
    await tx.warehouseStock.update({
      where: { id: r.id },
      data: { onHand: { decrement: take }, lastMoveAt: new Date() },
    });
    remaining -= take;
  }
}

// Add `quantity` of a product to a warehouse (the named one, else Main).
export async function addWarehouseStock(
  tx: Tx,
  {
    productId,
    quantity,
    warehouseName,
    warehouseId,
  }: {
    productId: string;
    quantity: number;
    warehouseName?: string | null;
    warehouseId?: string | null;
  },
): Promise<void> {
  if (quantity <= 0) return;
  const wid = warehouseId ?? (await resolveWarehouseId(tx, warehouseName));
  if (!wid) return;
  await tx.warehouseStock.upsert({
    where: { warehouseId_productId: { warehouseId: wid, productId } },
    update: { onHand: { increment: quantity }, lastMoveAt: new Date() },
    create: { warehouseId: wid, productId, onHand: quantity, lastMoveAt: new Date() },
  });
}
