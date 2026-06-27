"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { refCode } from "@/lib/utils";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

const createSchema = z.object({
  fromId: z.string().min(1, "Choose a source warehouse."),
  toId: z.string().min(1, "Choose a destination warehouse."),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(1000000),
      }),
    )
    .min(1, "Add at least one product."),
  note: z.string().max(500).optional(),
});

function revalidateTransfers() {
  revalidatePath("/admin/transfers");
  revalidatePath("/admin/warehouses");
  revalidatePath("/warehouse");
}

export async function createTransfer(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult<{ code: string }>> {
  try {
    const actor = await requireActor(["ADMIN", "WAREHOUSE"]);
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid transfer.");
    }
    const { fromId, toId, note } = parsed.data;
    if (fromId === toId) return fail("Source and destination must differ.");

    // Warehouse staff may create transfers only with permission, and only out
    // of their own warehouse.
    if (actor.role === "WAREHOUSE") {
      const wu = await prisma.user.findUnique({
        where: { id: actor.id },
        select: { canCreateTransfers: true, warehouseId: true },
      });
      if (!wu?.canCreateTransfers) {
        return fail("You don't have permission to create transfers.");
      }
      if (fromId !== wu.warehouseId) {
        return fail("You can only transfer stock out of your own warehouse.");
      }
    }

    const merged = new Map<string, number>();
    for (const it of parsed.data.items) {
      merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.quantity);
    }
    const productIds = [...merged.keys()];

    const sourceStock = await prisma.warehouseStock.findMany({
      where: { warehouseId: fromId, productId: { in: productIds } },
      include: { product: { select: { name: true } } },
    });
    const stockMap = new Map(sourceStock.map((s) => [s.productId, s]));
    const short = [...merged.entries()].filter(
      ([pid, q]) => (stockMap.get(pid)?.onHand ?? 0) < q,
    );
    if (short.length > 0) {
      const names = short
        .map(
          ([pid, q]) =>
            `${stockMap.get(pid)?.product.name ?? "Product"} (have ${stockMap.get(pid)?.onHand ?? 0}, need ${q})`,
        )
        .join(", ");
      return fail(`Source warehouse is short on: ${names}.`);
    }

    const transfer = await prisma.warehouseTransfer.create({
      data: {
        code: refCode("TRF"),
        fromId,
        toId,
        note: note?.trim() || null,
        createdById: actor.id,
        status: "PENDING",
        items: {
          create: [...merged.entries()].map(([productId, quantity]) => ({
            productId,
            quantity,
          })),
        },
      },
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "TRANSFER_CREATED",
      entity: "WarehouseTransfer",
      entityId: transfer.id,
      summary: `Transfer ${transfer.code} created (${merged.size} product${merged.size > 1 ? "s" : ""}).`,
    });

    revalidateTransfers();
    return ok({ code: transfer.code }, "Transfer created — awaiting approval.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// A warehouse manager may act on transfers involving their own warehouse.
async function assertCanAct(
  actor: { id: string; role: string },
  transfer: { fromId: string; toId: string },
): Promise<string | null> {
  if (actor.role === "ADMIN") return null;
  const wu = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { warehouseId: true },
  });
  if (!wu?.warehouseId) return "You aren't assigned to a warehouse.";
  if (transfer.fromId !== wu.warehouseId && transfer.toId !== wu.warehouseId) {
    return "This transfer doesn't involve your warehouse.";
  }
  return null;
}

export async function approveTransfer(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "WAREHOUSE"]);
    const t = await prisma.warehouseTransfer.findUnique({ where: { id } });
    if (!t) return fail("Transfer not found.");
    const denied = await assertCanAct(actor, t);
    if (denied) return fail(denied);
    if (t.status !== "PENDING") return fail("Only pending transfers can be approved.");
    await prisma.warehouseTransfer.update({
      where: { id },
      data: { status: "APPROVED", approvedById: actor.id },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "TRANSFER_APPROVED",
      entity: "WarehouseTransfer",
      entityId: t.id,
      summary: `Transfer ${t.code} approved.`,
    });
    revalidateTransfers();
    return ok(undefined, "Transfer approved.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// Source warehouse dispatches: on-hand → in-transit at the source.
export async function dispatchTransfer(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "WAREHOUSE"]);
    const t = await prisma.warehouseTransfer.findUnique({
      where: { id },
      include: { items: { include: { product: { select: { name: true } } } } },
    });
    if (!t) return fail("Transfer not found.");
    const denied = await assertCanAct(actor, t);
    if (denied) return fail(denied);
    if (actor.role === "WAREHOUSE") {
      const wu = await prisma.user.findUnique({ where: { id: actor.id }, select: { warehouseId: true } });
      if (t.fromId !== wu?.warehouseId) return fail("Only the source warehouse can dispatch this transfer.");
    }
    if (t.status !== "APPROVED") return fail("Only approved transfers can be dispatched.");

    const sourceStock = await prisma.warehouseStock.findMany({
      where: { warehouseId: t.fromId, productId: { in: t.items.map((i) => i.productId) } },
    });
    const map = new Map(sourceStock.map((s) => [s.productId, s]));
    const short = t.items.filter((i) => (map.get(i.productId)?.onHand ?? 0) < i.quantity);
    if (short.length > 0) {
      return fail(
        `Source no longer has enough stock for ${short.map((i) => i.product.name).join(", ")}.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const i of t.items) {
        await tx.warehouseStock.update({
          where: { warehouseId_productId: { warehouseId: t.fromId, productId: i.productId } },
          data: {
            onHand: { decrement: i.quantity },
            inTransit: { increment: i.quantity },
            lastMoveAt: new Date(),
          },
        });
      }
      await tx.warehouseTransfer.update({
        where: { id },
        data: { status: "IN_TRANSIT", dispatchedAt: new Date() },
      });
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "TRANSFER_DISPATCHED",
      entity: "WarehouseTransfer",
      entityId: t.id,
      summary: `Transfer ${t.code} dispatched — in transit.`,
    });
    revalidateTransfers();
    return ok(undefined, "Dispatched. Stock is in transit.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// Destination confirms receipt: in-transit (source) cleared → on-hand at destination.
export async function receiveTransfer(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "WAREHOUSE"]);
    const t = await prisma.warehouseTransfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!t) return fail("Transfer not found.");
    const denied = await assertCanAct(actor, t);
    if (denied) return fail(denied);
    if (actor.role === "WAREHOUSE") {
      const wu = await prisma.user.findUnique({ where: { id: actor.id }, select: { warehouseId: true } });
      if (t.toId !== wu?.warehouseId) return fail("Only the destination warehouse can receive this transfer.");
    }
    if (t.status !== "IN_TRANSIT") return fail("Only in-transit transfers can be received.");

    await prisma.$transaction(async (tx) => {
      for (const i of t.items) {
        await tx.warehouseStock.update({
          where: { warehouseId_productId: { warehouseId: t.fromId, productId: i.productId } },
          data: { inTransit: { decrement: i.quantity } },
        });
        await tx.warehouseStock.upsert({
          where: { warehouseId_productId: { warehouseId: t.toId, productId: i.productId } },
          update: { onHand: { increment: i.quantity }, lastMoveAt: new Date() },
          create: {
            warehouseId: t.toId,
            productId: i.productId,
            onHand: i.quantity,
            lastMoveAt: new Date(),
          },
        });
      }
      await tx.warehouseTransfer.update({
        where: { id },
        data: { status: "COMPLETED", receivedAt: new Date() },
      });
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "TRANSFER_COMPLETED",
      entity: "WarehouseTransfer",
      entityId: t.id,
      summary: `Transfer ${t.code} received & reconciled at destination.`,
    });
    revalidateTransfers();
    return ok(undefined, "Received. Destination stock updated.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function rejectTransfer(id: string, note?: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "WAREHOUSE"]);
    const t = await prisma.warehouseTransfer.findUnique({ where: { id } });
    if (!t) return fail("Transfer not found.");
    const denied = await assertCanAct(actor, t);
    if (denied) return fail(denied);
    if (t.status !== "PENDING" && t.status !== "APPROVED") {
      return fail("This transfer can no longer be rejected.");
    }
    await prisma.warehouseTransfer.update({
      where: { id },
      data: { status: "REJECTED", note: note?.trim() || t.note },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "TRANSFER_REJECTED",
      entity: "WarehouseTransfer",
      entityId: t.id,
      summary: `Transfer ${t.code} rejected.`,
    });
    revalidateTransfers();
    return ok(undefined, "Transfer rejected.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
