"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { applyMovement } from "@/lib/services/inventory";
import { deductWarehouseStock } from "@/lib/services/warehouse-stock";
import { refCode, formatCurrency } from "@/lib/utils";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/admin");
  revalidatePath("/admin/requests");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/inventory");
  revalidatePath("/warehouse");
  revalidatePath("/warehouse/orders");
  revalidatePath("/partner");
  revalidatePath("/partner/requests");
  revalidatePath("/agent");
  revalidatePath("/agent/requests");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/requests");
}

// ── Create (USER or AGENT) ─────────────────────────────────────────────────

const createSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(100000),
      }),
    )
    .min(1, "Add at least one product."),
  note: z.string().max(1000).optional(),
  paymentType: z.enum(["IMMEDIATE", "CREDIT"]).optional(),
  deliverTo: z.string().max(200).optional(),
  deliveryAddress: z.string().max(300).optional(),
  contactName: z.string().max(120).optional(),
  contactPhone: z.string().max(40).optional(),
  deliverBy: z.string().max(40).optional(), // ISO date string
  warehouseName: z.string().max(120).optional(),
});

export async function createRequest(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult<{ code: string; id: string }>> {
  try {
    const actor = await requireActor(["PARTNER"]);
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid request.");
    }

    // Merge duplicate product lines.
    const merged = new Map<string, number>();
    for (const it of parsed.data.items) {
      merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.quantity);
    }
    const productIds = [...merged.keys()];

    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, price: true },
    });
    if (products.length !== productIds.length) {
      return fail("One or more selected products are unavailable.");
    }

    // Apply this partner's agreed prices (fall back to the standard price).
    const partnerPrices = await prisma.partnerPrice.findMany({
      where: { partnerId: actor.id, productId: { in: productIds } },
    });
    const priceMap = new Map<string, number>();
    for (const p of products) priceMap.set(p.id, p.price);
    for (const pp of partnerPrices) priceMap.set(pp.productId, pp.price);

    const paymentType = parsed.data.paymentType ?? "IMMEDIATE";

    const itemData = [...merged.entries()].map(([productId, quantity]) => {
      const unitPrice = priceMap.get(productId) ?? 0;
      return { productId, quantity, unitPrice, lineTotal: unitPrice * quantity };
    });
    const totalAmount = itemData.reduce((s, i) => s + i.lineTotal, 0);

    // ── Credit-control rule: pay-later is a controlled loan tied to stock. ──
    // A partner cannot take new credit while a balance is overdue, and the new
    // order must fit inside their remaining credit availability.
    if (paymentType === "CREDIT") {
      const [me, openAccounts] = await Promise.all([
        prisma.user.findUnique({
          where: { id: actor.id },
          select: { creditLimit: true },
        }),
        prisma.creditAccount.findMany({
          where: { agentId: actor.id, status: { not: "SETTLED" } },
          select: { principal: true, amountPaid: true, status: true },
        }),
      ]);
      // One active credit at a time: a partner must finish (settle) their
      // current credit cycle before a new pay-later order is allowed.
      if (openAccounts.length > 0) {
        const overdue = openAccounts.some((a) => a.status === "OVERDUE");
        return fail(
          overdue
            ? "You have an overdue credit balance. Clear it before requesting new pay-later stock."
            : "You already have an active credit batch. Finish repaying it before taking new pay-later stock.",
        );
      }
      const available = me?.creditLimit ?? 0;
      if (totalAmount > available) {
        return fail(
          `This pay-later order (${formatCurrency(totalAmount)}) is over your credit limit of ${formatCurrency(available)}. Pay down to a lower amount or choose immediate payment.`,
        );
      }
    }

    const request = await prisma.request.create({
      data: {
        code: refCode("REQ"),
        type: "AGENT_STOCK",
        status: "PENDING",
        paymentType,
        requesterId: actor.id,
        note: parsed.data.note?.trim() || null,
        deliverTo: parsed.data.deliverTo?.trim() || null,
        deliveryAddress: parsed.data.deliveryAddress?.trim() || null,
        contactName: parsed.data.contactName?.trim() || null,
        contactPhone: parsed.data.contactPhone?.trim() || null,
        deliverBy: parsed.data.deliverBy ? new Date(parsed.data.deliverBy) : null,
        warehouseName: parsed.data.warehouseName?.trim() || null,
        totalAmount,
        items: {
          create: itemData,
        },
      },
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "REQUEST_SUBMITTED",
      entity: "Request",
      entityId: request.id,
      summary: `${actor.name} submitted request ${request.code} (${merged.size} item${merged.size > 1 ? "s" : ""}).`,
    });

    revalidateAll();
    return ok({ code: request.code, id: request.id }, "Request submitted for admin review.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Price (ADMIN) ──────────────────────────────────────────────────────────

const priceSchema = z.object({
  requestId: z.string().min(1),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        unitPrice: z.number().int().nonnegative().max(10000000),
      }),
    )
    .min(1),
  adminNote: z.string().max(1000).optional(),
});

export async function priceRequest(
  input: z.infer<typeof priceSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = priceSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid pricing data.");

    const request = await prisma.request.findUnique({
      where: { id: parsed.data.requestId },
      include: { items: true },
    });
    if (!request) return fail("Request not found.");
    if (request.status !== "PENDING" && request.status !== "PRICED") {
      return fail("This request can no longer be priced.");
    }

    const priceById = new Map(
      parsed.data.items.map((i) => [i.itemId, i.unitPrice]),
    );
    let total = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of request.items) {
        const unitPrice = priceById.get(item.id);
        if (unitPrice == null) continue;
        const lineTotal = unitPrice * item.quantity;
        total += lineTotal;
        await tx.requestItem.update({
          where: { id: item.id },
          data: { unitPrice, lineTotal },
        });
      }
      await tx.request.update({
        where: { id: request.id },
        data: {
          status: "PRICED",
          totalAmount: total,
          adminNote: parsed.data.adminNote?.trim() || request.adminNote,
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });
    });

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "REQUEST_PRICED",
      entity: "Request",
      entityId: request.id,
      summary: `Pricing assigned to request ${request.code} (total ${total}).`,
      meta: { total },
    });

    revalidateAll();
    return ok(undefined, "Pricing saved. The request is ready for approval.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Edit order: quantities + prices (ADMIN) ────────────────────────────────

const editSchema = z.object({
  requestId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(100000),
        unitPrice: z.number().int().nonnegative().max(10000000).optional(),
      }),
    )
    .min(1, "Keep at least one product."),
  discount: z.number().int().nonnegative().max(10000000).optional(),
  deliveryCharge: z.number().int().nonnegative().max(10000000).optional(),
  adminNote: z.string().max(1000).optional(),
});

export async function updateRequestOrder(
  input: z.infer<typeof editSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = editSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid order data.");
    }

    const request = await prisma.request.findUnique({
      where: { id: parsed.data.requestId },
      include: { items: true },
    });
    if (!request) return fail("Request not found.");
    if (request.status !== "PENDING" && request.status !== "PRICED") {
      return fail("This request can no longer be edited.");
    }

    // Validate products exist & are active.
    const desired = new Map(parsed.data.items.map((i) => [i.productId, i]));
    const productIds = [...desired.keys()];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      return fail("One or more products are unavailable.");
    }

    const discount = parsed.data.discount ?? request.discount ?? 0;
    const deliveryCharge =
      parsed.data.deliveryCharge ?? request.deliveryCharge ?? 0;

    let subtotal = 0;
    let allPriced = true;

    await prisma.$transaction(async (tx) => {
      const existingByProduct = new Map(
        request.items.map((it) => [it.productId, it]),
      );

      // Remove lines that are no longer in the desired set.
      for (const it of request.items) {
        if (!desired.has(it.productId)) {
          await tx.requestItem.delete({ where: { id: it.id } });
        }
      }

      // Upsert each desired line.
      for (const [productId, line] of desired) {
        const quantity = line.quantity;
        const unitPrice =
          line.unitPrice != null && line.unitPrice > 0 ? line.unitPrice : null;
        if (unitPrice == null) allPriced = false;
        else subtotal += unitPrice * quantity;
        const lineTotal = unitPrice != null ? unitPrice * quantity : null;
        const existing = existingByProduct.get(productId);
        if (existing) {
          await tx.requestItem.update({
            where: { id: existing.id },
            data: { quantity, unitPrice, lineTotal },
          });
        } else {
          await tx.requestItem.create({
            data: { requestId: request.id, productId, quantity, unitPrice, lineTotal },
          });
        }
      }

      const total = Math.max(0, subtotal - discount + deliveryCharge);
      await tx.request.update({
        where: { id: request.id },
        data: {
          status: allPriced ? "PRICED" : "PENDING",
          totalAmount: allPriced ? total : null,
          discount,
          deliveryCharge,
          adminNote: parsed.data.adminNote?.trim() || request.adminNote,
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });
    });

    const total = Math.max(0, subtotal - discount + deliveryCharge);

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "REQUEST_EDITED",
      entity: "Request",
      entityId: request.id,
      summary: `Order ${request.code} updated by ${admin.name}${allPriced ? ` (total ${total})` : ""}.`,
    });

    revalidateAll();
    return ok(undefined, allPriced ? "Order updated and priced." : "Order updated.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Approve (ADMIN) ────────────────────────────────────────────────────────

export async function approveRequest(
  requestId: string,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { items: { include: { product: true } }, requester: true },
    });
    if (!request) return fail("Request not found.");
    if (request.status !== "PRICED") {
      return fail("Only priced requests can be approved.");
    }
    if (request.items.some((i) => i.unitPrice == null)) {
      return fail("Assign a price to every item before approving.");
    }

    // Verify warehouse availability — no invisible stock.
    const inventories = await prisma.inventory.findMany({
      where: { productId: { in: request.items.map((i) => i.productId) } },
    });
    const stockByProduct = new Map(
      inventories.map((inv) => [inv.productId, inv.warehouseQty]),
    );
    const shortfalls = request.items.filter(
      (i) => (stockByProduct.get(i.productId) ?? 0) < i.quantity,
    );
    if (shortfalls.length > 0) {
      const names = shortfalls
        .map((i) => `${i.product.name} (need ${i.quantity})`)
        .join(", ");
      return fail(`Not enough warehouse stock for: ${names}. Add stock first.`);
    }

    // Approve & invoice — NO inventory movement yet. Payment gate: a CREDIT
    // order is released to the warehouse on approval (credit IS the approval);
    // a CASH order stays UNPAID and is held back until an admin confirms payment
    // — only then does it become visible to warehouse staff.
    const isCredit = request.paymentType === "CREDIT";
    const invoiceNo = refCode("INV");
    await prisma.request.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        invoiceNo,
        reviewedById: admin.id,
        reviewedAt: new Date(),
        paymentStatus: isCredit ? "OUTSTANDING" : "UNPAID",
      },
    });

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "REQUEST_APPROVED",
      entity: "Request",
      entityId: request.id,
      summary: isCredit
        ? `Request ${request.code} approved on credit & invoiced (${invoiceNo}) for ${request.requester.name} — released to ${request.warehouseName ?? "warehouse"}.`
        : `Request ${request.code} approved & invoiced (${invoiceNo}) for ${request.requester.name} — awaiting payment confirmation.`,
    });

    revalidateAll();
    return ok(
      undefined,
      isCredit
        ? `Approved on credit & invoiced (${invoiceNo}). Released to the warehouse for dispatch.`
        : `Approved & invoiced (${invoiceNo}). Awaiting payment confirmation before it reaches the warehouse.`,
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Reject (ADMIN) ─────────────────────────────────────────────────────────

export async function rejectRequest(
  requestId: string,
  note?: string,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const request = await prisma.request.findUnique({
      where: { id: requestId },
    });
    if (!request) return fail("Request not found.");
    if (["APPROVED", "FULFILLED", "REJECTED", "CANCELLED"].includes(request.status)) {
      return fail("This request can no longer be rejected.");
    }
    await prisma.request.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        adminNote: note?.trim() || request.adminNote,
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "REQUEST_REJECTED",
      entity: "Request",
      entityId: request.id,
      summary: `Request ${request.code} rejected.`,
    });
    revalidateAll();
    return ok(undefined, `Request ${request.code} rejected.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Warehouse fulfillment steps (ADMIN or the assigned WAREHOUSE) ──────────

async function assertWarehouseOrderAccess(
  actor: { id: string; role: string },
  warehouseName: string | null,
): Promise<string | null> {
  if (actor.role === "ADMIN") return null;
  const wu = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { warehouse: { select: { name: true } } },
  });
  if (!wu?.warehouse) return "You aren't assigned to a warehouse.";
  if (warehouseName && wu.warehouse.name !== warehouseName) {
    return "This order isn't routed to your warehouse.";
  }
  return null;
}

// Warehouse accepts & dispatches an approved order → in transit (no inventory).
export async function dispatchOrder(requestId: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "WAREHOUSE"]);
    const request = await prisma.request.findUnique({ where: { id: requestId } });
    if (!request) return fail("Order not found.");
    const denied = await assertWarehouseOrderAccess(actor, request.warehouseName);
    if (denied) return fail(denied);
    if (request.status !== "APPROVED") {
      return fail("Only approved orders can be dispatched.");
    }
    // Payment gate: nothing leaves the warehouse until cash payment is
    // confirmed (PAID) or the order is on approved credit (OUTSTANDING).
    if (request.paymentStatus === "UNPAID") {
      return fail("Payment must be confirmed before this order can be dispatched.");
    }
    await prisma.request.update({
      where: { id: requestId },
      data: { status: "IN_TRANSIT" },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "ORDER_DISPATCHED",
      entity: "Request",
      entityId: request.id,
      summary: `Order ${request.code} accepted & dispatched — in transit.`,
    });
    revalidateAll();
    return ok(undefined, "Accepted & dispatched — now in transit.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// Warehouse (or admin) declines an approved order.
export async function declineOrder(
  requestId: string,
  note?: string,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "WAREHOUSE"]);
    const request = await prisma.request.findUnique({ where: { id: requestId } });
    if (!request) return fail("Order not found.");
    const denied = await assertWarehouseOrderAccess(actor, request.warehouseName);
    if (denied) return fail(denied);
    if (request.status !== "APPROVED") {
      return fail("Only approved orders can be declined.");
    }
    await prisma.request.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        adminNote: note?.trim() || request.adminNote,
        reviewedById: actor.id,
        reviewedAt: new Date(),
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "ORDER_DECLINED",
      entity: "Request",
      entityId: request.id,
      summary: `Order ${request.code} declined${note ? ` — ${note}` : ""}.`,
    });
    revalidateAll();
    return ok(undefined, "Order declined.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// Warehouse adjusts quantities on an approved order (cannot change prices).
const adjustSchema = z.object({
  requestId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(0).max(100000),
      }),
    )
    .min(1),
});

export async function warehouseAdjustOrder(
  input: z.infer<typeof adjustSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "WAREHOUSE"]);
    const parsed = adjustSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid adjustment.");
    const request = await prisma.request.findUnique({
      where: { id: parsed.data.requestId },
      include: { items: true },
    });
    if (!request) return fail("Order not found.");
    const denied = await assertWarehouseOrderAccess(actor, request.warehouseName);
    if (denied) return fail(denied);
    if (request.status !== "APPROVED") {
      return fail("Only approved orders can be edited. Once dispatched, contact the ORA team.");
    }

    const qtyMap = new Map(parsed.data.items.map((i) => [i.productId, i.quantity]));
    const resulting = request.items
      .map((it) => ({ it, qty: qtyMap.get(it.productId) ?? it.quantity }))
      .filter((x) => x.qty > 0);
    if (resulting.length === 0) {
      return fail("An order must keep at least one item.");
    }
    const subtotal = resulting.reduce((s, x) => s + (x.it.unitPrice ?? 0) * x.qty, 0);
    const newTotal = subtotal + request.deliveryCharge - request.discount;

    await prisma.$transaction(async (tx) => {
      for (const it of request.items) {
        const newQty = qtyMap.get(it.productId);
        if (newQty === undefined) continue;
        if (newQty <= 0) {
          await tx.requestItem.delete({ where: { id: it.id } });
          continue;
        }
        await tx.requestItem.update({
          where: { id: it.id },
          data: { quantity: newQty, lineTotal: (it.unitPrice ?? 0) * newQty },
        });
      }
      await tx.request.update({
        where: { id: request.id },
        data: { totalAmount: newTotal },
      });
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "ORDER_ADJUSTED",
      entity: "Request",
      entityId: request.id,
      summary: `Order ${request.code} quantities adjusted by ${actor.name}.`,
    });
    revalidateAll();
    return ok(undefined, "Order updated.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Confirm delivery / fulfil (ADMIN or WAREHOUSE) ─────────────────────────
// This is the ONLY point inventory decreases. Cash → Paid + revenue; Credit →
// Outstanding balance + debt ledger (stock now "held" by the partner).

export async function fulfillRequest(
  requestId: string,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN", "WAREHOUSE"]);
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { items: { include: { product: true } } },
    });
    if (!request) return fail("Request not found.");
    if (request.status !== "IN_TRANSIT" && request.status !== "APPROVED") {
      return fail("Only in-transit orders can be marked delivered.");
    }
    // Payment gate: stock never moves on an unpaid cash order.
    if (request.paymentStatus === "UNPAID") {
      return fail("Payment must be confirmed before this order can be delivered.");
    }

    // Re-verify physical stock at the moment of delivery.
    const inventories = await prisma.inventory.findMany({
      where: { productId: { in: request.items.map((i) => i.productId) } },
    });
    const stockByProduct = new Map(
      inventories.map((inv) => [inv.productId, inv.warehouseQty]),
    );
    const shortfalls = request.items.filter(
      (i) => (stockByProduct.get(i.productId) ?? 0) < i.quantity,
    );
    if (shortfalls.length > 0) {
      const names = shortfalls
        .map((i) => `${i.product.name} (need ${i.quantity})`)
        .join(", ");
      return fail(`Not enough warehouse stock to deliver: ${names}.`);
    }

    const isCredit = request.paymentType === "CREDIT";

    await prisma.$transaction(async (tx) => {
      // ASSIGNED then DISTRIBUTED → net: warehouse −qty, distributed +qty.
      for (const item of request.items) {
        await applyMovement(tx, {
          productId: item.productId,
          type: "ASSIGNED",
          quantity: item.quantity,
          createdById: admin.id,
          requestId: request.id,
          reference: request.code,
        });
        await applyMovement(tx, {
          productId: item.productId,
          type: "DISTRIBUTED",
          quantity: item.quantity,
          createdById: admin.id,
          requestId: request.id,
          reference: request.code,
        });
        // Draw the units down from the fulfilling warehouse's location ledger.
        await deductWarehouseStock(tx, {
          productId: item.productId,
          quantity: item.quantity,
          preferWarehouseName: request.warehouseName,
        });
      }

      await tx.request.update({
        where: { id: request.id },
        data: {
          status: "FULFILLED",
          fulfilledAt: new Date(),
          deliveredAt: new Date(),
          paymentStatus: isCredit ? "OUTSTANDING" : "PAID",
        },
      });

      // Credit order → open the debt ledger now that goods are delivered.
      if (isCredit) {
        const exists = await tx.creditAccount.findUnique({
          where: { requestId: request.id },
        });
        if (!exists) {
          await tx.creditAccount.create({
            data: {
              requestId: request.id,
              agentId: request.requesterId,
              principal: request.totalAmount ?? 0,
              status: "OUTSTANDING",
              approvedById: admin.id,
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });
        }
      }
    });

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "REQUEST_FULFILLED",
      entity: "Request",
      entityId: request.id,
      summary: `Request ${request.code} delivered & confirmed (${isCredit ? "credit — outstanding" : "cash — paid"}).`,
    });

    revalidateAll();
    return ok(
      undefined,
      isCredit
        ? `Delivered. Outstanding balance recorded on the partner's account.`
        : `Delivered & paid. Inventory updated.`,
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Cancel (requester or ADMIN) ────────────────────────────────────────────

export async function cancelRequest(
  requestId: string,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["PARTNER", "ADMIN"]);
    const request = await prisma.request.findUnique({
      where: { id: requestId },
    });
    if (!request) return fail("Request not found.");
    if (actor.role !== "ADMIN" && request.requesterId !== actor.id) {
      return fail("You can only cancel your own requests.");
    }
    if (!["PENDING", "PRICED"].includes(request.status)) {
      return fail("Only pending requests can be cancelled.");
    }
    await prisma.request.update({
      where: { id: requestId },
      data: { status: "CANCELLED" },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "REQUEST_CANCELLED",
      entity: "Request",
      entityId: request.id,
      summary: `Request ${request.code} cancelled.`,
    });
    revalidateAll();
    return ok(undefined, `Request ${request.code} cancelled.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Partner edits own order (only before approval) ─────────────────────────

const partnerEditSchema = z.object({
  requestId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(100000),
      }),
    )
    .min(1, "Keep at least one product."),
  deliverTo: z.string().max(200).optional(),
  deliverBy: z.string().max(40).optional(),
  warehouseName: z.string().max(120).optional(),
  note: z.string().max(1000).optional(),
});

export async function partnerUpdateOrder(
  input: z.infer<typeof partnerEditSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["PARTNER"]);
    const parsed = partnerEditSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid order data.");
    }

    const request = await prisma.request.findUnique({
      where: { id: parsed.data.requestId },
      include: { items: true },
    });
    if (!request) return fail("Order not found.");
    if (request.requesterId !== actor.id) {
      return fail("You can only edit your own orders.");
    }
    if (request.status !== "PENDING" && request.status !== "PRICED") {
      return fail("This order has been approved and can no longer be edited.");
    }

    const desired = new Map(
      parsed.data.items.map((i) => [i.productId, i.quantity]),
    );
    const productIds = [...desired.keys()];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, price: true },
    });
    if (products.length !== productIds.length) {
      return fail("One or more products are unavailable.");
    }

    // Re-apply the partner's agreed prices (partners never set prices).
    const partnerPrices = await prisma.partnerPrice.findMany({
      where: { partnerId: actor.id, productId: { in: productIds } },
    });
    const priceMap = new Map<string, number>();
    for (const p of products) priceMap.set(p.id, p.price);
    for (const pp of partnerPrices) priceMap.set(pp.productId, pp.price);

    let total = 0;
    await prisma.$transaction(async (tx) => {
      const existingByProduct = new Map(
        request.items.map((it) => [it.productId, it]),
      );
      for (const it of request.items) {
        if (!desired.has(it.productId)) {
          await tx.requestItem.delete({ where: { id: it.id } });
        }
      }
      for (const [productId, quantity] of desired) {
        const unitPrice = priceMap.get(productId) ?? 0;
        const lineTotal = unitPrice * quantity;
        total += lineTotal;
        const ex = existingByProduct.get(productId);
        if (ex) {
          await tx.requestItem.update({
            where: { id: ex.id },
            data: { quantity, unitPrice, lineTotal },
          });
        } else {
          await tx.requestItem.create({
            data: { requestId: request.id, productId, quantity, unitPrice, lineTotal },
          });
        }
      }
      await tx.request.update({
        where: { id: request.id },
        data: {
          status: "PENDING", // an edit sends it back for ORA team review
          totalAmount: total,
          deliverTo: parsed.data.deliverTo?.trim() || null,
          deliverBy: parsed.data.deliverBy ? new Date(parsed.data.deliverBy) : null,
          warehouseName: parsed.data.warehouseName?.trim() || null,
          note: parsed.data.note?.trim() || null,
        },
      });
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "REQUEST_EDITED",
      entity: "Request",
      entityId: request.id,
      summary: `${actor.name} updated order ${request.code} before approval.`,
    });
    revalidateAll();
    return ok(undefined, "Order updated and resubmitted for review.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Payment confirmation (ADMIN) ────────────────────────────────────────────

// Confirm a CASH order's payment ("cash collected" / bank / mobile money).
// This releases the order to the warehouse — it's the only way an unpaid cash
// order becomes visible to warehouse staff.
export async function confirmOrderPayment(
  requestId: string,
  method?: string,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { requester: { select: { name: true } } },
    });
    if (!request) return fail("Order not found.");
    if (request.paymentType === "CREDIT") {
      return fail("Credit orders are released on approval, not payment confirmation.");
    }
    if (request.status !== "APPROVED" || request.paymentStatus !== "UNPAID") {
      return fail("This order is not awaiting payment confirmation.");
    }

    await prisma.request.update({
      where: { id: request.id },
      data: { paymentStatus: "PAID" },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "PAYMENT_CONFIRMED",
      entity: "Request",
      entityId: request.id,
      summary: `Payment confirmed for ${request.code} (${request.requester.name})${method ? ` · ${method}` : ""} — released to ${request.warehouseName ?? "warehouse"}.`,
    });
    revalidateAll();
    revalidatePath("/admin/payments");
    return ok(undefined, `Payment confirmed — ${request.code} released to the warehouse.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// Reject a cash payment — sends the order back to PRICED for review so it
// leaves the warehouse-eligible pool until payment is sorted out.
export async function rejectOrderPayment(
  requestId: string,
  reason?: string,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { requester: { select: { name: true } } },
    });
    if (!request) return fail("Order not found.");
    if (request.status !== "APPROVED" || request.paymentStatus !== "UNPAID") {
      return fail("This order is not awaiting payment confirmation.");
    }

    await prisma.request.update({
      where: { id: request.id },
      data: {
        status: "PRICED",
        adminNote: reason?.trim() || "Payment not received / rejected.",
      },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "PAYMENT_REJECTED",
      entity: "Request",
      entityId: request.id,
      summary: `Payment rejected for ${request.code} (${request.requester.name})${reason ? ` · ${reason.trim()}` : ""} — returned for review.`,
    });
    revalidateAll();
    revalidatePath("/admin/payments");
    return ok(undefined, `Payment rejected — ${request.code} returned for review.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// Partner presses "I have made payment" on an approved cash order. This records
// the claim (awaiting admin verification) — it does NOT release the order; an
// admin must still confirm the payment.
export async function claimOrderPayment(
  requestId: string,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["PARTNER"]);
    const request = await prisma.request.findUnique({
      where: { id: requestId },
    });
    if (!request || request.requesterId !== actor.id) {
      return fail("Order not found.");
    }
    if (request.paymentType !== "IMMEDIATE") {
      return fail("This is a credit order — no payment is due upfront.");
    }
    if (request.status !== "APPROVED" || request.paymentStatus !== "UNPAID") {
      return fail("This order isn't awaiting your payment right now.");
    }

    await prisma.request.update({
      where: { id: request.id },
      data: { paymentClaimedAt: new Date() },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "PAYMENT_CLAIMED",
      entity: "Request",
      entityId: request.id,
      summary: `${actor.name} marked ${request.code} as paid — awaiting ORA verification.`,
    });
    revalidateAll();
    revalidatePath("/admin/payments");
    return ok(undefined, "Thanks — we'll confirm your payment shortly.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
