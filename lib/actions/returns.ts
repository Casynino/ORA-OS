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
      include: { product: true },
    });
    if (!ret) return fail("Return not found.");
    const denied = await assertWarehouseReturnAccess(actor, ret.warehouseName);
    if (denied) return fail(denied);
    if (ret.status !== "IN_TRANSIT") {
      return fail("Only authorised returns in transit can be received.");
    }

    await prisma.$transaction(async (tx) => {
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
      await tx.returnRequest.update({
        where: { id: ret.id },
        data: { status: "COMPLETED", receivedAt: new Date() },
      });
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "RETURN_COMPLETED",
      entity: "ReturnRequest",
      entityId: ret.id,
      summary: `Return ${ret.code} received — ${ret.quantity} × ${ret.product.name} reconciled into the warehouse.`,
    });

    revalidateReturns();
    revalidatePath("/admin/inventory");
    return ok(undefined, `Return ${ret.code} received and reconciled.`);
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
