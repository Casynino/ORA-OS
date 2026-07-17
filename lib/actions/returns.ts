"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { applyMovement } from "@/lib/services/inventory";
import { addWarehouseStock } from "@/lib/services/warehouse-stock";
import { getReturnableStock } from "@/lib/returns-stock";
import { refCode } from "@/lib/utils";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

const REASON_TYPES = [
  "Damaged",
  "Expired",
  "Incorrect delivery",
  "Overstock",
  "Other",
] as const;

/** Credit status of a field sale after a balance change (mirrors field.ts). */
function fieldCreditStatusFor(total: number, paid: number, dueDate: Date | null) {
  if (paid >= total) return "PAID" as const;
  if (dueDate && dueDate < new Date()) return "OVERDUE" as const;
  return paid > 0 ? ("PARTIAL" as const) : ("PENDING" as const);
}

const createSchema = z.object({
  productId: z.string().min(1, "Choose a product."),
  quantity: z.number().int().positive().max(100000),
  reasonType: z.enum(REASON_TYPES),
  reason: z.string().max(500).optional(),
  warehouseName: z.string().max(120).optional(),
  requestId: z.string().optional(),
});

function revalidateReturns() {
  revalidatePath("/partner/returns");
  revalidatePath("/admin/returns");
  revalidatePath("/warehouse/returns");
}

// Warehouse staff may only act on returns routed to their own warehouse;
// admin is unrestricted. Returns a fail-message string or null.
async function assertWarehouseReturnAccess(
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
    return "This return isn't routed to your warehouse.";
  }
  return null;
}

export async function createReturn(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult<{ code: string }>> {
  try {
    const actor = await requireActor(["PARTNER"]);
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid return.");
    }
    const { productId, quantity, reasonType, warehouseName } = parsed.data;

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) return fail("Product not found.");

    // ── Critical rule: a partner can only return stock they actually hold. ──
    const returnable = await getReturnableStock(actor.id);
    const line = returnable.get(productId);
    if (!line || line.held <= 0) {
      return fail(
        `You have never received ${product.name} from ORA, so it can't be returned.`,
      );
    }
    if (quantity > line.available) {
      return fail(
        line.available <= 0
          ? `All of your ${product.name} stock is already in an open return.`
          : `You can return at most ${line.available} units of ${product.name} (that's what you currently hold).`,
      );
    }

    const ret = await prisma.returnRequest.create({
      data: {
        code: refCode("RET"),
        productId,
        requesterId: actor.id,
        quantity,
        reasonType,
        reason: parsed.data.reason?.trim() || null,
        warehouseName: warehouseName?.trim() || null,
        requestId: parsed.data.requestId || null,
        status: "PENDING",
      },
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "RETURN_REQUESTED",
      entity: "ReturnRequest",
      entityId: ret.id,
      summary: `${actor.name} requested to return ${quantity} × ${product.name} (${ret.code}) — ${reasonType}.`,
    });

    revalidateReturns();
    return ok({ code: ret.code }, "Return submitted to the ORA team for review.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Finance-initiated debt-recovery return ──────────────────────────────────
//  Finance takes goods back from a field customer to settle an outstanding
//  credit sale. The return goes through the same authorise → receive lifecycle;
//  on receipt the credit value is applied to the sale's balance.
const financeReturnSchema = z.object({
  fieldSaleId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(100000),
  creditValue: z.number().int().positive().max(1000000000),
  reason: z.string().max(500).optional().or(z.literal("")),
});

export async function createFinanceReturn(
  input: z.infer<typeof financeReturnSchema>,
): Promise<ActionResult<{ code: string }>> {
  try {
    const actor = await requireActor(["ADMIN", "FINANCE"]);
    const parsed = financeReturnSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid return.");
    }
    const d = parsed.data;

    const sale = await prisma.fieldSale.findUnique({
      where: { id: d.fieldSaleId },
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    });
    if (!sale) return fail("Sale not found.");
    if (sale.voided) return fail("This sale was voided.");
    if (sale.type !== "CREDIT" || sale.financeStatus !== "APPROVED") {
      return fail("Returns for debt recovery apply to approved credit sales only.");
    }
    const outstanding = sale.total - sale.amountPaid;
    if (outstanding <= 0) return fail("This sale is already fully paid.");
    if (d.creditValue > outstanding) {
      return fail(
        `Credit value can't exceed the outstanding balance (TSh ${outstanding.toLocaleString()}).`,
      );
    }
    const line = sale.items.find((i) => i.productId === d.productId);
    if (!line) return fail("That product isn't on this sale.");
    if (d.quantity > line.quantity) {
      return fail(`At most ${line.quantity} unit(s) of ${line.product.name} were sold on this order.`);
    }

    const ret = await prisma.returnRequest.create({
      data: {
        code: refCode("RET"),
        productId: d.productId,
        requesterId: sale.repId, // the rep who owns the customer relationship
        quantity: d.quantity,
        reasonType: "Other",
        reason: d.reason?.trim() || `Debt recovery on ${sale.code}`,
        warehouseName: null,
        financeInitiated: true,
        fieldSaleId: sale.id,
        creditValue: d.creditValue,
        status: "PENDING",
      },
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "FINANCE_RETURN_INITIATED",
      entity: "ReturnRequest",
      entityId: ret.id,
      summary: `${actor.name} initiated a debt-recovery return (${ret.code}) — ${d.quantity} × ${line.product.name} from ${sale.customer?.name ?? "customer"} to recover TSh ${d.creditValue.toLocaleString()} on ${sale.code}.`,
    });

    revalidateReturns();
    revalidatePath("/finance/returns");
    revalidatePath("/finance/credit");
    return ok({ code: ret.code }, `${ret.code} created — awaiting receipt at the warehouse.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Step 2: ORA team authorises the return. No stock moves yet — the partner
// ships the units back and the warehouse confirms receipt before reconciling. ──
const authorizeSchema = z.object({
  quantity: z.number().int().positive().optional(),
  note: z.string().max(500).optional(),
});

export async function approveReturn(
  returnId: string,
  input?: z.infer<typeof authorizeSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "WAREHOUSE"]);
    const ret = await prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: { product: true },
    });
    if (!ret) return fail("Return not found.");
    const denied = await assertWarehouseReturnAccess(actor, ret.warehouseName);
    if (denied) return fail(denied);
    if (ret.status !== "PENDING") {
      return fail("Only pending returns can be authorised.");
    }
    const parsed = authorizeSchema.safeParse(input ?? {});
    const approvedQty =
      parsed.success && parsed.data.quantity
        ? Math.min(parsed.data.quantity, ret.quantity)
        : ret.quantity;
    const note = parsed.success ? parsed.data.note?.trim() : undefined;

    await prisma.returnRequest.update({
      where: { id: ret.id },
      data: {
        status: "IN_TRANSIT",
        quantity: approvedQty,
        adminNote: note || ret.adminNote,
        reviewedById: actor.id,
        reviewedAt: new Date(),
      },
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "RETURN_AUTHORISED",
      entity: "ReturnRequest",
      entityId: ret.id,
      summary: `Return ${ret.code} authorised — ${approvedQty} × ${ret.product.name} expected back at the warehouse.`,
    });

    revalidateReturns();
    return ok(
      undefined,
      `Return ${ret.code} authorised. Awaiting delivery to the warehouse.`,
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Step 3: warehouse confirms the physical units arrived → reconcile stock. ──
export async function completeReturn(returnId: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "WAREHOUSE"]);
    const ret = await prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: { product: true, fieldSale: { select: { code: true } } },
    });
    if (!ret) return fail("Return not found.");
    const denied = await assertWarehouseReturnAccess(actor, ret.warehouseName);
    if (denied) return fail(denied);
    if (ret.status !== "IN_TRANSIT") {
      return fail("Only authorised returns in transit can be received.");
    }

    let recovered = 0;
    await prisma.$transaction(async (tx) => {
      // Atomically claim the receipt FIRST — two concurrent completions (a
      // double-click, or a return reachable from both the admin and warehouse
      // queues) must not both restock the goods or both recover the debt.
      const claimed = await tx.returnRequest.updateMany({
        where: { id: ret.id, status: "IN_TRANSIT" },
        data: { status: "COMPLETED", receivedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new Error("This return has already been received.");
      }
      await applyMovement(tx, {
        productId: ret.productId,
        type: "RESTOCKED",
        quantity: ret.quantity,
        createdById: actor.id,
        reference: ret.code,
        note: "Return received & reconciled",
        warehouseName: ret.warehouseName,
      });
      // Land the returned units in the receiving warehouse's location ledger.
      await addWarehouseStock(tx, {
        productId: ret.productId,
        quantity: ret.quantity,
        warehouseName: ret.warehouseName,
      });

      // Debt-recovery return: apply the returned goods' value to the linked
      // credit sale, reducing accounts receivable. Guarded compare-and-swap on
      // amountPaid so a concurrent collection can't double-apply.
      if (ret.financeInitiated && ret.fieldSaleId && ret.creditValue) {
        const fs = await tx.fieldSale.findUnique({ where: { id: ret.fieldSaleId } });
        if (fs && !fs.voided) {
          recovered = Math.min(ret.creditValue, Math.max(0, fs.total - fs.amountPaid));
          if (recovered > 0) {
            const newPaid = fs.amountPaid + recovered;
            const claimed = await tx.fieldSale.updateMany({
              where: { id: fs.id, amountPaid: fs.amountPaid, voided: false },
              data: {
                amountPaid: newPaid,
                creditStatus: fieldCreditStatusFor(fs.total, newPaid, fs.dueDate),
              },
            });
            if (claimed.count === 0) {
              throw new Error("The sale balance changed while receiving — retry.");
            }
          }
        }
      }
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: recovered > 0 ? "RETURN_DEBT_RECOVERED" : "RETURN_COMPLETED",
      entity: "ReturnRequest",
      entityId: ret.id,
      summary:
        recovered > 0
          ? `Return ${ret.code} received — ${ret.quantity} × ${ret.product.name} restocked and TSh ${recovered.toLocaleString()} recovered off ${ret.fieldSale?.code ?? "the debt"}.`
          : `Return ${ret.code} received — ${ret.quantity} × ${ret.product.name} reconciled into the warehouse.`,
    });

    revalidateReturns();
    revalidatePath("/admin/inventory");
    revalidatePath("/finance/returns");
    revalidatePath("/finance/credit");
    return ok(
      undefined,
      recovered > 0
        ? `Return ${ret.code} received — TSh ${recovered.toLocaleString()} recovered off the debt.`
        : `Return ${ret.code} received and reconciled.`,
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function rejectReturn(
  returnId: string,
  note?: string,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "WAREHOUSE"]);
    const ret = await prisma.returnRequest.findUnique({
      where: { id: returnId },
    });
    if (!ret) return fail("Return not found.");
    const denied = await assertWarehouseReturnAccess(actor, ret.warehouseName);
    if (denied) return fail(denied);
    if (ret.status !== "PENDING" && ret.status !== "IN_TRANSIT") {
      return fail("This return can no longer be rejected.");
    }
    await prisma.returnRequest.update({
      where: { id: ret.id },
      data: {
        status: "REJECTED",
        adminNote: note?.trim() || null,
        reviewedById: actor.id,
        reviewedAt: new Date(),
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "RETURN_REJECTED",
      entity: "ReturnRequest",
      entityId: ret.id,
      summary: `Return ${ret.code} rejected.`,
    });
    revalidateReturns();
    return ok(undefined, `Return ${ret.code} rejected.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}
