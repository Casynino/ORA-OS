"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { applyMovement } from "@/lib/services/inventory";
import { addWarehouseStock } from "@/lib/services/warehouse-stock";
import { getReturnableStock } from "@/lib/returns-stock";
import {
  CUSTOMER_RETURN_TYPE,
  REP_RETURN_REASONS,
  REP_RETURN_TYPE,
  isRepStockReturn,
} from "@/lib/rep-returns";
import {
  getRepReturnableStock,
  receiveRepReturnInTx,
  takeCustomerReturnInTx,
} from "@/lib/services/rep-returns";
import { refCode } from "@/lib/utils";
import { notifyInApp, resolveInApp } from "@/lib/notifications/in-app";
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
  revalidatePath("/rep/stock");
  revalidatePath("/rep/stock/return");
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
    await notifyInApp({
      toRoles: ["WAREHOUSE", "ADMIN"],
      category: "ACTION",
      type: "RETURN_HANDLE",
      title: "Return to handle",
      body: `${actor.name} requested to return ${quantity} × ${product.name} (${ret.code}).`,
      actorName: actor.name,
      entityType: "ReturnRequest",
      entityId: ret.id,
      actionUrl: "/warehouse/returns",
      actionLabel: "Review return",
    });
    return ok({ code: ret.code }, "Return submitted to the ORA team for review.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Sales rep sends unsold stock back to a warehouse ────────────────────────
//  The rep submits; the warehouse (or admin) physically receives it. Nothing
//  leaves the rep's stock until the receipt is confirmed — see completeReturn.
const repReturnSchema = z.object({
  productId: z.string().min(1, "Choose a product."),
  quantity: z.number().int().positive("Enter how many pieces you are returning.").max(1000000),
  reason: z.enum(REP_RETURN_REASONS),
  note: z.string().max(500).optional(),
  warehouseId: z.string().optional(),
});

export async function createRepStockReturn(
  input: z.infer<typeof repReturnSchema>,
): Promise<ActionResult<{ code: string }>> {
  try {
    const actor = await requireActor(["SALES_REP"]);
    const parsed = repReturnSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid return.");
    }
    const { productId, quantity, reason } = parsed.data;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, notForSale: true },
    });
    if (!product) return fail("Product not found.");

    // The rep can only send back what they actually hold, minus anything
    // already waiting in an open return.
    const line = (await getRepReturnableStock(actor.id)).get(productId);
    if (!line) return fail(`You don't hold any ${product.name} to return.`);
    if (quantity > line.available) {
      return fail(
        line.available <= 0
          ? `All of your ${product.name} is already in a return waiting for the warehouse.`
          : `You can return at most ${line.available.toLocaleString("en-US")} pcs of ${product.name} (that's what you hold now${line.inReturn > 0 ? ", after the return already waiting" : ""}).`,
      );
    }

    // Warehouse that will receive it: the one chosen, else the main (oldest) one.
    const warehouse = parsed.data.warehouseId
      ? await prisma.warehouse.findFirst({
          where: { id: parsed.data.warehouseId, isActive: true },
          select: { name: true },
        })
      : await prisma.warehouse.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
          select: { name: true },
        });
    if (!warehouse) return fail("No active warehouse found to return the stock to.");

    const note = parsed.data.note?.trim();
    const ret = await prisma.returnRequest.create({
      data: {
        code: refCode("RET"),
        productId,
        requesterId: actor.id,
        quantity,
        reasonType: REP_RETURN_TYPE,
        reason: note ? `${reason} — ${note}` : reason,
        warehouseName: warehouse.name,
        status: "PENDING",
      },
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "RETURN_REQUESTED",
      entity: "ReturnRequest",
      entityId: ret.id,
      summary: `${actor.name} will return ${quantity} × ${product.name} to ${warehouse.name} (${ret.code}) — ${reason}.`,
    });

    revalidateReturns();
    await notifyInApp({
      toRoles: ["WAREHOUSE", "ADMIN"],
      category: "ACTION",
      type: "RETURN_HANDLE",
      title: "Rep is returning stock",
      body: `${actor.name} is bringing back ${quantity.toLocaleString("en-US")} × ${product.name} to ${warehouse.name} (${ret.code}).`,
      actorName: actor.name,
      entityType: "ReturnRequest",
      entityId: ret.id,
      actionUrl: "/warehouse/returns",
      actionLabel: "Receive return",
    });
    return ok({ code: ret.code }, `Return ${ret.code} sent. Take the goods to ${warehouse.name} — your stock drops once they confirm receipt.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** A rep can withdraw their own stock return while the warehouse hasn't accepted it. */
export async function cancelRepReturn(returnId: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(["SALES_REP"]);
    const ret = await prisma.returnRequest.findUnique({ where: { id: returnId } });
    if (!ret || ret.requesterId !== actor.id || !isRepStockReturn(ret)) {
      return fail("Return not found.");
    }
    const claimed = await prisma.returnRequest.updateMany({
      where: { id: ret.id, status: "PENDING" },
      data: { status: "REJECTED", adminNote: "Cancelled by the rep" },
    });
    if (claimed.count === 0) {
      return fail("This return can no longer be cancelled — it was already handled.");
    }
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "RETURN_REJECTED",
      entity: "ReturnRequest",
      entityId: ret.id,
      summary: `${actor.name} cancelled return ${ret.code}.`,
    });
    revalidateReturns();
    await resolveInApp("ReturnRequest", ret.id); // stop the warehouse ring
    return ok(undefined, `Return ${ret.code} cancelled.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Customer sends goods back to the rep ───────────────────────────────────
//  The rep has already taken the goods back from the customer, so this is a
//  plain RECORD — no approval step. It happens in one transaction: the pieces go
//  back into the rep's stock and their value comes off the customer's balance on
//  that credit sale. The value is worked out here from the sale's own prices —
//  never typed in — and quantities are capped by what was actually sold.
const customerReturnSchema = z.object({
  saleId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(1000000),
      }),
    )
    .min(1, "Choose at least one product to return.")
    .max(20),
  note: z.string().max(500).optional(),
});

function revalidateCustomerReturns(customerId?: string | null, repId?: string) {
  revalidateReturns();
  revalidatePath("/rep");
  revalidatePath("/rep/customers");
  if (customerId) revalidatePath(`/rep/customers/${customerId}`);
  revalidatePath("/finance/returns");
  revalidatePath("/finance/credit");
  revalidatePath("/admin/credit");
  revalidatePath("/admin/reps");
  if (repId) revalidatePath(`/admin/reps/${repId}`);
}

export async function createCustomerReturn(
  input: z.infer<typeof customerReturnSchema>,
): Promise<ActionResult<{ codes: string[] }>> {
  try {
    const actor = await requireActor(["SALES_REP"]);
    const parsed = customerReturnSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid return.");
    }
    const d = parsed.data;

    const sale = await prisma.fieldSale.findUnique({
      where: { id: d.saleId },
      include: {
        customer: { select: { businessName: true, name: true } },
        items: { include: { product: { select: { name: true } } } },
        returns: { select: { productId: true, quantity: true, status: true } },
      },
    });
    if (!sale || sale.repId !== actor.id) return fail("Sale not found.");
    if (sale.voided) return fail("This sale was voided.");
    if (sale.isOpeningBalance || sale.directSale) {
      return fail("Returns can't be recorded on this kind of sale.");
    }
    if (sale.financeStatus !== "APPROVED") {
      return fail("Finance hasn't approved this sale yet — void or fix the sale instead of returning goods.");
    }
    if (sale.type !== "CREDIT") {
      return fail("Returns here apply to credit sales. For a refund on a cash sale, speak to Finance.");
    }
    const outstanding = sale.total - sale.amountPaid;
    if (outstanding <= 0) {
      return fail("This sale is already fully paid, so there's no balance to take the goods off. Speak to Finance about a refund.");
    }

    // Merge duplicate product lines, then validate each against what was sold.
    const wanted = new Map<string, number>();
    for (const it of d.items) wanted.set(it.productId, (wanted.get(it.productId) ?? 0) + it.quantity);

    const lines: { productId: string; name: string; quantity: number; value: number }[] = [];
    for (const [productId, quantity] of wanted) {
      const soldLines = sale.items.filter((i) => i.productId === productId);
      if (soldLines.length === 0) return fail("That product isn't on this sale.");
      const name = soldLines[0].product.name;
      const sold = soldLines.reduce((s, i) => s + i.quantity, 0);
      const alreadyBack = sale.returns
        .filter((r) => r.productId === productId && r.status !== "REJECTED")
        .reduce((s, r) => s + r.quantity, 0);
      const left = sold - alreadyBack;
      if (quantity > left) {
        return fail(
          left <= 0
            ? `All ${sold.toLocaleString("en-US")} pcs of ${name} on this sale are already returned.`
            : `You can return at most ${left.toLocaleString("en-US")} pcs of ${name} on this sale.`,
        );
      }
      lines.push({ productId, name, quantity, value: quantity * soldLines[0].unitPrice });
    }
    const totalValue = lines.reduce((s, l) => s + l.value, 0);
    if (totalValue > outstanding) {
      return fail(
        `These goods are worth TSh ${totalValue.toLocaleString("en-US")} but the customer only owes TSh ${outstanding.toLocaleString("en-US")} on ${sale.code}. Return less, or speak to Finance about a refund.`,
      );
    }

    const customerName = sale.customer?.businessName ?? sale.customer?.name ?? sale.customerName ?? "customer";
    const note = d.note?.trim();
    const codes: string[] = [];
    await prisma.$transaction(async (tx) => {
      for (const l of lines) {
        const ret = await tx.returnRequest.create({
          data: {
            code: refCode("RET"),
            productId: l.productId,
            requesterId: actor.id,
            quantity: l.quantity,
            reasonType: CUSTOMER_RETURN_TYPE,
            reason: note || `Returned by ${customerName}`,
            warehouseName: null, // goods go back to the rep, not a warehouse
            fieldSaleId: sale.id,
            creditValue: l.value,
            status: "COMPLETED",
            receivedAt: new Date(),
          },
        });
        codes.push(ret.code);
        // Stock back to the rep + value off the balance — all-or-nothing.
        await takeCustomerReturnInTx(
          tx,
          { ...ret, product: { name: l.name }, requester: { name: actor.name ?? "Rep" } },
          actor.id,
        );
      }
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "RETURN_COMPLETED",
      entity: "ReturnRequest",
      entityId: sale.id,
      summary: `${actor.name} recorded goods returned by ${customerName} on ${sale.code}: ${lines.map((l) => `${l.quantity} × ${l.name}`).join(", ")} back in their stock; TSh ${totalValue.toLocaleString("en-US")} taken off the balance (${codes.join(", ")}).`,
    });
    revalidateCustomerReturns(sale.customerId, actor.id);
    // Heads-up only (no ringing): Finance sees every customer return as it happens.
    await notifyInApp({
      toRoles: ["FINANCE", "ADMIN"],
      category: "INFO",
      type: "CUSTOMER_RETURN",
      title: "Customer return recorded",
      body: `${actor.name} took back ${lines.map((l) => `${l.quantity.toLocaleString("en-US")} × ${l.name}`).join(", ")} from ${customerName}; TSh ${totalValue.toLocaleString("en-US")} off ${sale.code}.`,
      actorName: actor.name,
      entityType: "FieldSale",
      entityId: sale.id,
      actionUrl: "/finance/returns",
      actionLabel: "View returns",
    });
    return ok(
      { codes },
      `Return recorded — goods are back in your stock and TSh ${totalValue.toLocaleString("en-US")} came off ${sale.code}.`,
    );
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
    await notifyInApp({
      toRoles: ["WAREHOUSE", "ADMIN"],
      category: "ACTION",
      type: "RETURN_HANDLE",
      title: "Return to receive",
      body: `${actor.name} initiated a debt-recovery return (${ret.code}) — ${d.quantity} × ${line.product.name}.`,
      actorName: actor.name,
      entityType: "ReturnRequest",
      entityId: ret.id,
      actionUrl: "/warehouse/returns",
      actionLabel: "Review return",
    });
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
    if (isRepStockReturn(ret)) {
      // Like a stock request turning READY: tell the rep to bring the goods in.
      await notifyInApp({
        toUserId: ret.requesterId,
        category: "ACTION",
        type: "RETURN_ACCEPTED",
        title: "Return accepted — bring the stock",
        body: `${ret.warehouseName ?? "The warehouse"} accepted your return ${ret.code}. Take ${approvedQty.toLocaleString("en-US")} × ${ret.product.name} to the warehouse; your stock drops once they confirm receipt.`,
        actorName: actor.name,
        entityType: "ReturnRequest",
        entityId: ret.id,
        actionUrl: "/rep/stock/return",
        actionLabel: "View return",
      });
    }
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
      include: {
        product: true,
        requester: { select: { name: true } },
        fieldSale: { select: { code: true } },
      },
    });
    if (!ret) return fail("Return not found.");
    const denied = await assertWarehouseReturnAccess(actor, ret.warehouseName);
    if (denied) return fail(denied);
    // Same two steps as a stock request: the warehouse accepts the return first,
    // then confirms receipt when the rep actually brings the goods in.
    if (ret.status !== "IN_TRANSIT") {
      return fail("Only authorised returns in transit can be received.");
    }
    const repReturn = isRepStockReturn(ret);

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
      if (repReturn) {
        // Rep → warehouse: take it out of the rep's hands, put it back on the shelf.
        await receiveRepReturnInTx(tx, ret, actor.id);
        return;
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
      summary: repReturn
        ? `Return ${ret.code} received — ${ret.requester.name} sent back ${ret.quantity} × ${ret.product.name} to ${ret.warehouseName ?? "the warehouse"}; it left their stock and is back on the shelf.`
        : recovered > 0
          ? `Return ${ret.code} received — ${ret.quantity} × ${ret.product.name} restocked and TSh ${recovered.toLocaleString()} recovered off ${ret.fieldSale?.code ?? "the debt"}.`
          : `Return ${ret.code} received — ${ret.quantity} × ${ret.product.name} reconciled into the warehouse.`,
    });

    revalidateReturns();
    revalidatePath("/rep");
    revalidatePath("/admin/reps");
    revalidatePath(`/admin/reps/${ret.requesterId}`);
    revalidatePath("/admin/inventory");
    revalidatePath("/finance/returns");
    revalidatePath("/finance/credit");
    await resolveInApp("ReturnRequest", returnId); // stop the warehouse ring
    if (repReturn) {
      await notifyInApp({
        toUserId: ret.requesterId,
        category: "INFO",
        type: "RETURN_RECEIVED",
        title: "Return received",
        body: `${ret.warehouseName ?? "The warehouse"} received your ${ret.quantity.toLocaleString("en-US")} × ${ret.product.name} (${ret.code}). It is out of your stock now.`,
        actorName: actor.name,
        entityType: "ReturnRequest",
        entityId: ret.id,
        actionUrl: "/rep/stock/return",
        actionLabel: "View returns",
      });
    }
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
    await resolveInApp("ReturnRequest", returnId); // stop the warehouse ring
    if (isRepStockReturn(ret)) {
      // The rep keeps the stock — tell them it was declined and why.
      await notifyInApp({
        toUserId: ret.requesterId,
        category: "INFO",
        type: "RETURN_DECLINED",
        title: "Return declined",
        body: `Your return ${ret.code} was declined${note?.trim() ? `: ${note.trim()}` : "."} The stock stays with you.`,
        actorName: actor.name,
        entityType: "ReturnRequest",
        entityId: ret.id,
        actionUrl: "/rep/stock/return",
        actionLabel: "View returns",
      });
    }
    return ok(undefined, `Return ${ret.code} rejected.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}
