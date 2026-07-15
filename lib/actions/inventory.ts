"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { applyMovement } from "@/lib/services/inventory";
import {
  addWarehouseStock,
  deductWarehouseStock,
} from "@/lib/services/warehouse-stock";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

const addSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(1000000),
  warehouseId: z.string().optional(),
  reference: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
});

export async function addStock(
  input: z.infer<typeof addSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN", "WAREHOUSE"]);
    const parsed = addSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid stock entry.");
    const product = await prisma.product.findUnique({
      where: { id: parsed.data.productId },
    });
    if (!product) return fail("Product not found.");

    // Where the delivery lands: a warehouse user always receives into their own
    // warehouse; an admin chooses the warehouse (falls back to Main).
    let warehouseId: string | null = parsed.data.warehouseId ?? null;
    if (admin.role === "WAREHOUSE") {
      const wu = await prisma.user.findUnique({
        where: { id: admin.id },
        select: { warehouseId: true },
      });
      warehouseId = wu?.warehouseId ?? null;
    }
    const wh = warehouseId
      ? await prisma.warehouse.findUnique({
          where: { id: warehouseId },
          select: { name: true },
        })
      : null;
    const whLabel = wh?.name ?? "the main warehouse";

    await prisma.$transaction(async (tx) => {
      await applyMovement(tx, {
        productId: parsed.data.productId,
        type: "INBOUND",
        quantity: parsed.data.quantity,
        createdById: admin.id,
        reference: parsed.data.reference?.trim() || "Stock received",
        note: parsed.data.note?.trim() || null,
        warehouseName: wh?.name ?? null,
      });
      // Land the units in the chosen warehouse's location ledger.
      await addWarehouseStock(tx, {
        productId: parsed.data.productId,
        quantity: parsed.data.quantity,
        warehouseId,
      });
    });

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "STOCK_INBOUND",
      entity: "Inventory",
      entityId: product.id,
      summary: `${parsed.data.quantity} × ${product.name} received into ${whLabel}.`,
    });

    revalidatePath("/admin/inventory");
    revalidatePath("/admin");
    revalidatePath("/admin/warehouses");
    revalidatePath("/warehouse");
    revalidatePath("/warehouse/receive");
    revalidatePath("/warehouse/inventory");
    return ok(undefined, `${parsed.data.quantity} units received into ${whLabel}.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const adjustSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().refine((n) => n !== 0, "Enter a non-zero amount."),
  warehouseId: z.string().optional(),
  note: z.string().max(500).optional(),
});

export async function adjustStock(
  input: z.infer<typeof adjustSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN", "WAREHOUSE"]);
    const parsed = adjustSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid adjustment.");
    }
    const inv = await prisma.inventory.findUnique({
      where: { productId: parsed.data.productId },
      include: { product: true },
    });
    if (!inv) return fail("Product not found.");

    // Resolve the warehouse being adjusted: a warehouse user adjusts their own
    // location; an admin picks one (falls back to Main).
    let warehouseId: string | null = parsed.data.warehouseId ?? null;
    if (admin.role === "WAREHOUSE") {
      const wu = await prisma.user.findUnique({
        where: { id: admin.id },
        select: { warehouseId: true },
      });
      warehouseId = wu?.warehouseId ?? null;
    }
    const wh = warehouseId
      ? await prisma.warehouse.findUnique({
          where: { id: warehouseId },
          select: { name: true },
        })
      : null;
    const whLabel = wh?.name ?? "the main warehouse";

    // Validate a removal against FREE stock (onHand − reserved) of the chosen
    // warehouse — never let an adjustment eat units reserved for a rep pickup.
    if (parsed.data.quantity < 0) {
      if (warehouseId) {
        const ws = await prisma.warehouseStock.findUnique({
          where: {
            warehouseId_productId: { warehouseId, productId: parsed.data.productId },
          },
        });
        const free = (ws?.onHand ?? 0) - (ws?.reserved ?? 0);
        if (free + parsed.data.quantity < 0) {
          return fail(
            `Only ${Math.max(0, free)} unreserved units of ${inv.product.name} in ${whLabel} — can't remove that many.`,
          );
        }
      } else if (inv.warehouseQty + parsed.data.quantity < 0) {
        return fail("Adjustment would take warehouse stock below zero.");
      }
    }

    await prisma.$transaction(async (tx) => {
      await applyMovement(tx, {
        productId: parsed.data.productId,
        type: "ADJUSTMENT",
        quantity: parsed.data.quantity,
        createdById: admin.id,
        note: parsed.data.note?.trim() || `Manual adjustment · ${whLabel}`,
        warehouseName: wh?.name ?? null,
      });
      // Keep the per-warehouse location ledger in lock-step so the two never
      // drift (invariant: Σ WarehouseStock.onHand == Inventory.warehouseQty).
      if (parsed.data.quantity > 0) {
        await addWarehouseStock(tx, {
          productId: parsed.data.productId,
          quantity: parsed.data.quantity,
          warehouseId,
        });
      } else {
        await deductWarehouseStock(tx, {
          productId: parsed.data.productId,
          quantity: -parsed.data.quantity,
          warehouseId,
        });
      }
    });

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "STOCK_ADJUSTED",
      entity: "Inventory",
      entityId: parsed.data.productId,
      summary: `Manual adjustment of ${parsed.data.quantity > 0 ? "+" : ""}${parsed.data.quantity} on ${inv.product.name} in ${whLabel}.`,
    });

    revalidatePath("/admin/inventory");
    revalidatePath("/admin");
    revalidatePath("/admin/warehouses");
    revalidatePath("/warehouse");
    revalidatePath("/warehouse/inventory");
    return ok(undefined, "Stock adjusted.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const thresholdSchema = z.object({
  productId: z.string().min(1),
  lowStockThreshold: z.number().int().nonnegative().max(1000000),
});

export async function setLowStockThreshold(
  input: z.infer<typeof thresholdSchema>,
): Promise<ActionResult> {
  try {
    await requireActor(["ADMIN"]);
    const parsed = thresholdSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid threshold.");
    await prisma.inventory.update({
      where: { productId: parsed.data.productId },
      data: { lowStockThreshold: parsed.data.lowStockThreshold },
    });
    revalidatePath("/admin/inventory");
    return ok(undefined, "Low-stock threshold updated.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
