"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { applyMovement } from "@/lib/services/inventory";
import { addWarehouseStock } from "@/lib/services/warehouse-stock";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

const createSchema = z.object({
  sku: z.string().min(1, "Enter a SKU.").max(40),
  name: z.string().min(2, "Enter a product name.").max(120),
  description: z.string().max(500).optional(),
  category: z.enum(["PADS", "HYGIENE", "ACCESSORY", "OTHER"]),
  unitLabel: z.string().max(40).optional(),
  iconKey: z.string().max(40).optional(),
  unitsPerCarton: z.number().int().positive().max(100000).optional(),
  costPrice: z.number().int().nonnegative().max(100000000).optional(),
  price: z.number().int().nonnegative().max(100000000).optional(),
  notForSale: z.boolean().optional(),
  initialStock: z.number().int().nonnegative().max(100000000).optional(),
});

export async function createProduct(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid product.");
    }
    const sku = parsed.data.sku.trim().toUpperCase();
    const existing = await prisma.product.findUnique({ where: { sku } });
    if (existing) return fail("A product with this SKU already exists.");

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          sku,
          name: parsed.data.name.trim(),
          description: parsed.data.description?.trim() || null,
          category: parsed.data.category,
          unitLabel: parsed.data.unitLabel?.trim() || "pack",
          iconKey: parsed.data.iconKey?.trim() || "pads",
          unitsPerCarton: parsed.data.unitsPerCarton ?? 24,
          costPrice: parsed.data.costPrice ?? 0,
          price: parsed.data.notForSale ? 0 : parsed.data.price ?? 0,
          notForSale: parsed.data.notForSale ?? false,
          inventory: { create: {} },
        },
      });
      if (parsed.data.initialStock && parsed.data.initialStock > 0) {
        await applyMovement(tx, {
          productId: created.id,
          type: "INBOUND",
          quantity: parsed.data.initialStock,
          createdById: admin.id,
          reference: "Initial stock",
        });
        // Land the opening units in the Main warehouse so the per-warehouse
        // ledger stays in lock-step with the org-wide snapshot.
        await addWarehouseStock(tx, {
          productId: created.id,
          quantity: parsed.data.initialStock,
        });
      }
      return created;
    });

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "PRODUCT_CREATED",
      entity: "Product",
      entityId: product.id,
      summary: `Product "${product.name}" (${product.sku}) added.`,
    });

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/products");
    return ok(undefined, `${product.name} created.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const updateSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(500).optional(),
  category: z.enum(["PADS", "HYGIENE", "ACCESSORY", "OTHER"]).optional(),
  unitLabel: z.string().max(40).optional(),
  unitsPerCarton: z.number().int().positive().max(100000).optional(),
  costPrice: z.number().int().nonnegative().max(100000000).optional(),
  price: z.number().int().nonnegative().max(100000000).optional(),
  notForSale: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function updateProduct(
  input: z.infer<typeof updateSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid update.");
    const { productId, ...rest } = parsed.data;
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) return fail("Product not found.");

    const notForSale = rest.notForSale ?? product.notForSale;
    await prisma.product.update({
      where: { id: productId },
      data: {
        name: rest.name?.trim() ?? product.name,
        description:
          rest.description !== undefined
            ? rest.description.trim() || null
            : product.description,
        category: rest.category ?? product.category,
        unitLabel: rest.unitLabel?.trim() ?? product.unitLabel,
        unitsPerCarton: rest.unitsPerCarton ?? product.unitsPerCarton,
        costPrice: rest.costPrice ?? product.costPrice,
        // A not-for-sale product always has a zero selling price.
        price: notForSale ? 0 : rest.price ?? product.price,
        notForSale,
        isActive: rest.isActive ?? product.isActive,
      },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "PRODUCT_UPDATED",
      entity: "Product",
      entityId: product.id,
      summary: `Product "${product.name}" updated.`,
    });
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/products");
    return ok(undefined, "Product updated.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
