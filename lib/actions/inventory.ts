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

    // Where the delivery lands: the warehouse user's own warehouse (else Main).
    let warehouseName: string | null = null;
    if (admin.role === "WAREHOUSE") {
      const wu = await prisma.user.findUnique({
        where: { id: admin.id },
        select: { warehouse: { select: { name: true } } },
      });
      warehouseName = wu?.warehouse?.name ?? null;
    }

    await prisma.$transaction(async (tx) => {
      await applyMovement(tx, {
        productId: parsed.data.productId,
        type: "INBOUND",
        quantity: parsed.data.quantity,
        createdById: admin.id,
        reference: parsed.data.reference?.trim() || "Stock received",
        note: parsed.data.note?.trim() || null,
      });
      // Land the units in the receiving warehouse's location ledger.
      await addWarehouseStock(tx, {
        productId: parsed.data.productId,
        quantity: parsed.data.quantity,
        warehouseName,
      });
    });

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "STOCK_INBOUND",
      entity: "Inventory",
      entityId: product.id,
      summary: `${parsed.data.quantity} × ${product.name} received into ${warehouseName ?? "the warehouse"}.`,
    });

    revalidatePath("/admin/inventory");
    revalidatePath("/admin");
    revalidatePath("/warehouse");
    revalidatePath("/warehouse/receive");
    revalidatePath("/warehouse/inventory");
    return ok(undefined, `${parsed.data.quantity} units received into ${warehouseName ?? "the warehouse"}.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const adjustSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().refine((n) => n !== 0, "Enter a non-zero amount."),
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
    if (inv.warehouseQty + parsed.data.quantity < 0) {
      return fail("Adjustment would take warehouse stock below zero.");
    }

    // A warehouse user adjusts their own location; an admin adjusts Main.
    let warehouseName: string | null = null;
    if (admin.role === "WAREHOUSE") {
      const wu = await prisma.user.findUnique({
        where: { id: admin.id },
        select: { warehouse: { select: { name: true } } },
      });
      warehouseName = wu?.warehouse?.name ?? null;
    }

    await prisma.$transaction(async (tx) => {
      await applyMovement(tx, {
        productId: parsed.data.productId,
        type: "ADJUSTMENT",
        quantity: parsed.data.quantity,
        createdById: admin.id,
        note: parsed.data.note?.trim() || "Manual adjustment",
      });
      // Keep the per-warehouse location ledger in lock-step so the two never
      // drift (invariant: Σ WarehouseStock.onHand == Inventory.warehouseQty).
      if (parsed.data.quantity > 0) {
        await addWarehouseStock(tx, {
          productId: parsed.data.productId,
          quantity: parsed.data.quantity,
          warehouseName,
        });
      } else {
        await deductWarehouseStock(tx, {
          productId: parsed.data.productId,
          quantity: -parsed.data.quantity,
          preferWarehouseName: warehouseName,
        });
      }
    });

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "STOCK_ADJUSTED",
      entity: "Inventory",
      entityId: parsed.data.productId,
      summary: `Manual adjustment of ${parsed.data.quantity > 0 ? "+" : ""}${parsed.data.quantity} on ${inv.product.name}.`,
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
