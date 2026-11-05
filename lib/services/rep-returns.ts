import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { applyMovement } from "@/lib/services/inventory";
import { addWarehouseStock } from "@/lib/services/warehouse-stock";
import { REP_RETURN_TYPE } from "@/lib/rep-returns";

type Tx = Prisma.TransactionClient;

export type RepReturnableLine = {
  productId: string;
  inHand: number; // pieces the rep holds right now (sellable, or samples for sample packs)
  inReturn: number; // pieces already in an open (pending / in-transit) return
  available: number; // inHand − inReturn (never negative)
};

/** What a rep can still send back, per product. Sellable products read
 *  `sellableQty`; sample packs (notForSale) read `sampleQty`. Pieces already tied
 *  up in an open return are not offered twice. */
export async function getRepReturnableStock(
  repId: string,
  /** Leave one return out of the "already waiting" total (used when editing it). */
  excludeReturnId?: string,
): Promise<Map<string, RepReturnableLine>> {
  const [stock, open] = await Promise.all([
    prisma.repStock.findMany({
      where: { repId },
      select: {
        productId: true,
        sellableQty: true,
        sampleQty: true,
        product: { select: { notForSale: true } },
      },
    }),
    prisma.returnRequest.groupBy({
      by: ["productId"],
      where: {
        requesterId: repId,
        reasonType: REP_RETURN_TYPE,
        status: { in: ["PENDING", "IN_TRANSIT"] },
        ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}),
      },
      _sum: { quantity: true },
    }),
  ]);
  const inReturn = new Map(open.map((o) => [o.productId, o._sum.quantity ?? 0]));
  const map = new Map<string, RepReturnableLine>();
  for (const s of stock) {
    const inHand = s.product.notForSale ? s.sampleQty : s.sellableQty;
    if (inHand <= 0) continue;
    const held = inReturn.get(s.productId) ?? 0;
    map.set(s.productId, {
      productId: s.productId,
      inHand,
      inReturn: held,
      available: Math.max(0, inHand - held),
    });
  }
  return map;
}

/** Receive a rep's returned stock at a warehouse, inside the caller's
 *  transaction (the caller has already claimed the ReturnRequest). Takes the
 *  pieces out of the rep's hands — failing if they no longer hold that many —
 *  and puts them back in the warehouse ledger.
 *
 *  Movement ledger: the rep's stock sits in "assigned" (set at collection).
 *  Bringing it home is composed as DISTRIBUTED then RESTOCKED, which nets to
 *  assigned −qty / warehouse +qty / distributed 0 — the existing movement types
 *  already express this without a schema change. */
export async function receiveRepReturnInTx(
  tx: Tx,
  ret: {
    code: string;
    productId: string;
    requesterId: string;
    quantity: number;
    warehouseName: string | null;
    product: { name: string; notForSale: boolean };
    requester: { name: string };
  },
  actorId: string,
): Promise<void> {
  const field = ret.product.notForSale ? "sampleQty" : "sellableQty";
  // Guarded decrement: only succeeds while the rep still holds the pieces, so a
  // sale made after the return was requested can never push their stock negative.
  const taken = await tx.repStock.updateMany({
    where: {
      repId: ret.requesterId,
      productId: ret.productId,
      [field]: { gte: ret.quantity },
    },
    data: { [field]: { decrement: ret.quantity } },
  });
  if (taken.count === 0) {
    throw new Error(
      `${ret.requester.name} no longer holds ${ret.quantity} × ${ret.product.name} (they may have sold some since). Decline this return and ask for a new one.`,
    );
  }

  const where = ret.warehouseName ?? "Warehouse";
  await applyMovement(tx, {
    productId: ret.productId,
    type: "DISTRIBUTED",
    quantity: ret.quantity,
    createdById: actorId,
    reference: ret.code,
    note: `${ret.requester.name} → ${where} (unsold stock sent back)`,
    warehouseName: ret.warehouseName,
  });
  await applyMovement(tx, {
    productId: ret.productId,
    type: "RESTOCKED",
    quantity: ret.quantity,
    createdById: actorId,
    reference: ret.code,
    note: `${where} received stock returned by ${ret.requester.name}`,
    warehouseName: ret.warehouseName,
  });
  await addWarehouseStock(tx, {
    productId: ret.productId,
    quantity: ret.quantity,
    warehouseName: ret.warehouseName,
  });
}

/** Credit status of a sale after its paid amount changes. */
function creditStatusAfter(total: number, paid: number, dueDate: Date | null) {
  if (paid >= total) return "PAID" as const;
  if (dueDate && dueDate < new Date()) return "OVERDUE" as const;
  return paid > 0 ? ("PARTIAL" as const) : ("PENDING" as const);
}

/** Apply a customer's return inside the caller's transaction (the caller has
 *  just created the ReturnRequest). Puts the pieces back in the SELLING rep's
 *  hands and takes their value off what the customer still owes on that credit
 *  sale. Nothing moves unless every guard passes — the whole thing rolls back. */
export async function takeCustomerReturnInTx(
  tx: Tx,
  ret: {
    code: string;
    productId: string;
    requesterId: string;
    quantity: number;
    creditValue: number | null;
    fieldSaleId: string | null;
    product: { name: string };
    requester: { name: string };
  },
  actorId: string,
): Promise<{ credited: number; saleCode: string }> {
  if (!ret.fieldSaleId || !ret.creditValue || ret.creditValue <= 0) {
    throw new Error("This return isn't linked to a sale.");
  }
  const sale = await tx.fieldSale.findUnique({ where: { id: ret.fieldSaleId } });
  if (!sale || sale.voided || sale.financeStatus !== "APPROVED" || sale.type !== "CREDIT") {
    throw new Error("The sale was voided or changed — speak to Finance.");
  }
  if (sale.repId !== ret.requesterId) {
    throw new Error("This sale belongs to another rep — speak to Finance.");
  }
  const outstanding = sale.total - sale.amountPaid;
  if (ret.creditValue > outstanding) {
    throw new Error(
      `The customer now owes TSh ${outstanding.toLocaleString("en-US")}, less than these goods are worth (TSh ${ret.creditValue.toLocaleString("en-US")}). Return less, or speak to Finance about a refund.`,
    );
  }
  // Guarded compare-and-swap on amountPaid so a payment landing at the same
  // moment can't be double-applied.
  const newPaid = sale.amountPaid + ret.creditValue;
  const status = creditStatusAfter(sale.total, newPaid, sale.dueDate);
  const swapped = await tx.fieldSale.updateMany({
    where: { id: sale.id, amountPaid: sale.amountPaid, voided: false },
    data: { amountPaid: newPaid, creditStatus: status },
  });
  if (swapped.count === 0) {
    throw new Error("The sale balance changed while recording — try again.");
  }

  // Back into the rep's hands: sellable up, sold down (only while they have that
  // many recorded as sold).
  const back = await tx.repStock.updateMany({
    where: { repId: ret.requesterId, productId: ret.productId, soldQty: { gte: ret.quantity } },
    data: { sellableQty: { increment: ret.quantity }, soldQty: { decrement: ret.quantity } },
  });
  if (back.count === 0) {
    throw new Error(`${ret.requester.name}'s sales record doesn't have ${ret.quantity} × ${ret.product.name} to take back.`);
  }
  // Org ledger — the reverse of the original sale (same pair a voided sale uses).
  await applyMovement(tx, {
    productId: ret.productId,
    type: "RESTOCKED",
    quantity: ret.quantity,
    createdById: actorId,
    reference: ret.code,
    note: `Customer → ${ret.requester.name} (goods returned by customer · ${sale.code})`,
  });
  await applyMovement(tx, {
    productId: ret.productId,
    type: "ASSIGNED",
    quantity: ret.quantity,
    createdById: actorId,
    reference: ret.code,
    note: `Stock back in ${ret.requester.name}'s hands`,
  });
  return { credited: ret.creditValue, saleCode: sale.code };
}

/** Undo a customer return inside the caller's transaction (the caller has already
 *  claimed the ReturnRequest). The exact reverse of {@link takeCustomerReturnInTx}:
 *  the pieces leave the rep's stock again and the value goes back onto what the
 *  customer owes. Refuses — rolling everything back — if the rep no longer holds
 *  the pieces, or the sale was voided / its payments changed underneath. */
export async function undoCustomerReturnInTx(
  tx: Tx,
  ret: {
    code: string;
    productId: string;
    requesterId: string;
    quantity: number;
    creditValue: number | null;
    fieldSaleId: string | null;
    product: { name: string };
    requester: { name: string };
  },
  actorId: string,
): Promise<{ restored: number; saleCode: string }> {
  if (!ret.fieldSaleId || !ret.creditValue || ret.creditValue <= 0) {
    throw new Error("This return isn't linked to a sale.");
  }
  const sale = await tx.fieldSale.findUnique({ where: { id: ret.fieldSaleId } });
  if (!sale) throw new Error("Sale not found.");
  if (sale.voided) {
    throw new Error("This sale was voided, so the return can't be undone.");
  }
  if (sale.repId !== ret.requesterId) throw new Error("This sale belongs to another rep.");
  if (sale.amountPaid < ret.creditValue) {
    throw new Error(
      "Payments on this sale changed after the return, so it can't be undone here. Ask Finance.",
    );
  }
  const newPaid = sale.amountPaid - ret.creditValue;
  const swapped = await tx.fieldSale.updateMany({
    where: { id: sale.id, amountPaid: sale.amountPaid, voided: false },
    data: { amountPaid: newPaid, creditStatus: creditStatusAfter(sale.total, newPaid, sale.dueDate) },
  });
  if (swapped.count === 0) throw new Error("The sale balance changed — try again.");

  // The pieces must still be in the rep's hands to take them out again.
  const out = await tx.repStock.updateMany({
    where: { repId: ret.requesterId, productId: ret.productId, sellableQty: { gte: ret.quantity } },
    data: { sellableQty: { decrement: ret.quantity }, soldQty: { increment: ret.quantity } },
  });
  if (out.count === 0) {
    throw new Error(
      `${ret.requester.name} no longer holds ${ret.quantity} × ${ret.product.name} (already sold or sent back), so this return can't be undone.`,
    );
  }
  // Org ledger: back out to the field — reverses the RESTOCKED + ASSIGNED pair.
  await applyMovement(tx, {
    productId: ret.productId,
    type: "DISTRIBUTED",
    quantity: ret.quantity,
    createdById: actorId,
    reference: ret.code,
    note: `Undo customer return: ${ret.requester.name} → customer (${sale.code})`,
  });
  return { restored: ret.creditValue, saleCode: sale.code };
}
