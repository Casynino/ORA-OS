import type { MovementType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient;

type Delta = { warehouse: number; assigned: number; distributed: number };

/**
 * How each movement type shifts the three inventory buckets. This is the single
 * source of truth for stock maths — keeping warehouse + assigned + distributed
 * always reconciled with the immutable StockMovement ledger.
 */
export function movementDelta(type: MovementType, qty: number): Delta {
  switch (type) {
    case "INBOUND":
      return { warehouse: qty, assigned: 0, distributed: 0 };
    case "ASSIGNED": // reserve warehouse stock to an approved order
      return { warehouse: -qty, assigned: qty, distributed: 0 };
    case "DISTRIBUTED": // ship the reserved stock to the field
      return { warehouse: 0, assigned: -qty, distributed: qty };
    case "RETURNED": // item left the field (in transit back)
      return { warehouse: 0, assigned: 0, distributed: -qty };
    case "RESTOCKED": // approved return placed back in the warehouse
      return { warehouse: qty, assigned: 0, distributed: -qty };
    case "ADJUSTMENT": // manual correction; qty may be negative
      return { warehouse: qty, assigned: 0, distributed: 0 };
    default:
      return { warehouse: 0, assigned: 0, distributed: 0 };
  }
}

/**
 * Apply a stock movement and reconcile the Inventory snapshot atomically.
 * This is the ONLY sanctioned way stock ever changes.
 */
export async function applyMovement(
  tx: Tx,
  input: {
    productId: string;
    type: MovementType;
    quantity: number;
    createdById: string;
    requestId?: string | null;
    reference?: string | null;
    note?: string | null;
  },
) {
  const delta = movementDelta(input.type, input.quantity);

  await tx.inventory.upsert({
    where: { productId: input.productId },
    create: {
      productId: input.productId,
      warehouseQty: delta.warehouse,
      assignedQty: delta.assigned,
      distributedQty: delta.distributed,
    },
    update: {
      warehouseQty: { increment: delta.warehouse },
      assignedQty: { increment: delta.assigned },
      distributedQty: { increment: delta.distributed },
    },
  });

  await tx.stockMovement.create({
    data: {
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      requestId: input.requestId ?? null,
      reference: input.reference ?? null,
      note: input.note ?? null,
      createdById: input.createdById,
    },
  });
}

/** Aggregate totals across all products for dashboard headline figures. */
export async function getStockTotals() {
  const agg = await prisma.inventory.aggregate({
    _sum: { warehouseQty: true, assignedQty: true, distributedQty: true },
  });
  return {
    warehouse: agg._sum.warehouseQty ?? 0,
    assigned: agg._sum.assignedQty ?? 0,
    distributed: agg._sum.distributedQty ?? 0,
  };
}
