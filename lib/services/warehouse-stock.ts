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
// Units reserved for prepared rep collections are never taken (reserved is a
// sub-bucket of onHand); pass `consumeReserved` to hand over a reservation.
export async function deductWarehouseStock(
  tx: Tx,
  {
    productId,
    quantity,
    preferWarehouseName,
    warehouseId,
    consumeReserved = false,
  }: {
    productId: string;
    quantity: number;
    preferWarehouseName?: string | null;
    warehouseId?: string | null;
    consumeReserved?: boolean;
  },
): Promise<void> {
  if (quantity <= 0) return;

  // Exact-warehouse deduction (targeted adjustments / rep collections).
  if (warehouseId) {
    const row = await tx.warehouseStock.findUnique({
      where: { warehouseId_productId: { warehouseId, productId } },
    });
    const usable = consumeReserved
      ? (row?.onHand ?? 0)
      : (row?.onHand ?? 0) - (row?.reserved ?? 0);
    if (!row || usable < quantity) {
      // Never clamp silently — a shortfall here means the units aren't
      // physically on hand (in transit, reserved for a pickup, or a
      // concurrent deduction won). Throwing rolls the transaction back.
      throw new Error(
        `Only ${Math.max(0, usable)} units available in that warehouse — cannot deduct ${quantity}.`,
      );
    }
    await tx.warehouseStock.update({
      where: { id: row.id },
      data: {
        onHand: { decrement: quantity },
        ...(consumeReserved
          ? { reserved: { decrement: Math.min(row.reserved, quantity) } }
          : {}),
        lastMoveAt: new Date(),
      },
    });
    return;
  }

  const rows = await tx.warehouseStock.findMany({ where: { productId } });

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
    // Never dip into units reserved for a prepared rep collection.
    const take = Math.min(r.onHand - r.reserved, remaining);
    if (take <= 0) continue;
    await tx.warehouseStock.update({
      where: { id: r.id },
      data: { onHand: { decrement: take }, lastMoveAt: new Date() },
    });
    remaining -= take;
  }
  if (remaining > 0) {
    // Org-wide count said yes but the location ledger can't cover it — the
    // difference is in transit, reserved, or taken by a concurrent operation.
    // Abort loudly rather than corrupt Σ onHand == Inventory.warehouseQty.
    throw new Error(
      `Only ${quantity - remaining} of ${quantity} units are available across warehouses (the rest may be in transit or reserved for pickups). Try again later.`,
    );
  }
}

// Reserve units in one warehouse for a prepared rep collection. onHand is
// unchanged (the pieces are still on the shelf) — they just can't be promised
// to anything else until collected or released.
export async function reserveWarehouseStock(
  tx: Tx,
  {
    productId,
    quantity,
    warehouseId,
    productName,
  }: {
    productId: string;
    quantity: number;
    warehouseId: string;
    productName?: string;
  },
): Promise<void> {
  if (quantity <= 0) return;
  const row = await tx.warehouseStock.findUnique({
    where: { warehouseId_productId: { warehouseId, productId } },
  });
  const free = (row?.onHand ?? 0) - (row?.reserved ?? 0);
  if (!row || free < quantity) {
    throw new Error(
      `Not enough ${productName ?? "stock"} in this warehouse — only ${Math.max(0, free)} pieces free to promise.`,
    );
  }
  await tx.warehouseStock.update({
    where: { id: row.id },
    data: { reserved: { increment: quantity } },
  });
}

// Release a reservation (request rejected/cancelled before pickup).
export async function releaseWarehouseReservation(
  tx: Tx,
  {
    productId,
    quantity,
    warehouseId,
  }: {
    productId: string;
    quantity: number;
    warehouseId: string;
  },
): Promise<void> {
  if (quantity <= 0) return;
  const row = await tx.warehouseStock.findUnique({
    where: { warehouseId_productId: { warehouseId, productId } },
  });
  if (!row) return;
  await tx.warehouseStock.update({
    where: { id: row.id },
    data: { reserved: { decrement: Math.min(row.reserved, quantity) } },
  });
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
