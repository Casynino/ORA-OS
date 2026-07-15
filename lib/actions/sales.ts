"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { applyMovement } from "@/lib/services/inventory";
import { deductWarehouseStock } from "@/lib/services/warehouse-stock";
import { resolveReceivingAccount } from "@/lib/payment-methods";
import { refCode } from "@/lib/utils";
import { WALKIN_EMAIL } from "@/lib/constants";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

const saleSchema = z.object({
  // a real partner id, or the literal "WALKIN" for a field / over-the-counter sale
  partnerId: z.string().min(1, "Choose a customer."),
  customerName: z.string().max(120).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(100000),
      }),
    )
    .min(1, "Add at least one product."),
  method: z.string().max(40).optional(),
  paymentAccountId: z.string().max(60).optional(),
  reference: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
});

// Lazily ensure the system "Walk-in / Field Sales" buyer exists. Field and
// over-the-counter cash sales attach here so they never touch a real partner's
// account, owned-stock or credit.
async function getWalkinBuyer() {
  return prisma.user.upsert({
    where: { email: WALKIN_EMAIL },
    update: {},
    create: {
      email: WALKIN_EMAIL,
      name: "Walk-in / Field Sales",
      passwordHash: "!disabled",
      role: "PARTNER",
      status: "ACTIVE",
    },
    select: { id: true, name: true },
  });
}

// Records an immediate cash sale: a paid, already-fulfilled order that
// deducts warehouse stock on the spot (no request/approval cycle).
export async function recordCashSale(
  input: z.infer<typeof saleSchema>,
): Promise<ActionResult<{ code: string }>> {
  try {
    const admin = await requireActor(["ADMIN", "WAREHOUSE"]);
    const parsed = saleSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid sale.");
    }

    // Warehouse staff may record sales only with permission, scoped to their
    // own warehouse. Prices always come from the admin-set price list.
    let preferWarehouseName: string | null | undefined;
    if (admin.role === "WAREHOUSE") {
      const wu = await prisma.user.findUnique({
        where: { id: admin.id },
        select: { canRecordSales: true, warehouse: { select: { name: true } } },
      });
      if (!wu?.canRecordSales) {
        return fail("You don't have permission to record sales.");
      }
      preferWarehouseName = wu.warehouse?.name ?? null;
    }

    // Merge duplicate lines.
    const merged = new Map<string, number>();
    for (const it of parsed.data.items) {
      merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.quantity);
    }
    const productIds = [...merged.keys()];

    const isWalkin = parsed.data.partnerId === "WALKIN";
    const partner = isWalkin
      ? await getWalkinBuyer()
      : await prisma.user.findUnique({
          where: { id: parsed.data.partnerId },
          select: { id: true, name: true },
        });
    if (!partner) return fail("Customer not found.");

    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { inventory: true },
    });
    if (products.length !== productIds.length) {
      return fail("One or more selected products are unavailable.");
    }

    // Pricing: standard prices for walk-in/field sales; a registered partner's
    // agreed prices override (fall back to standard).
    const priceMap = new Map<string, number>();
    for (const p of products) priceMap.set(p.id, p.price);
    if (!isWalkin) {
      const partnerPrices = await prisma.partnerPrice.findMany({
        where: { partnerId: partner.id, productId: { in: productIds } },
      });
      for (const pp of partnerPrices) priceMap.set(pp.productId, pp.price);
    }

    // Stock check.
    const shortfalls = products.filter(
      (p) => (p.inventory?.warehouseQty ?? 0) < (merged.get(p.id) ?? 0),
    );
    if (shortfalls.length > 0) {
      const names = shortfalls
        .map((p) => `${p.name} (have ${p.inventory?.warehouseQty ?? 0})`)
        .join(", ");
      return fail(`Not enough stock for: ${names}.`);
    }

    const itemData = [...merged.entries()].map(([productId, quantity]) => {
      const unitPrice = priceMap.get(productId) ?? 0;
      return { productId, quantity, unitPrice, lineTotal: unitPrice * quantity };
    });
    const totalAmount = itemData.reduce((s, i) => s + i.lineTotal, 0);
    const now = new Date();
    const customerName = parsed.data.customerName?.trim() || null;
    const saleKind = isWalkin ? "Field/walk-in sale" : "Cash sale";
    const note = [
      parsed.data.method?.trim() ? `${saleKind} · ${parsed.data.method.trim()}` : saleKind,
      customerName ? `Customer: ${customerName}` : "",
      parsed.data.note?.trim() ?? "",
    ]
      .filter(Boolean)
      .join(" — ");
    const buyerLabel = isWalkin ? customerName ?? "Walk-in customer" : partner.name;

    const sale = await prisma.$transaction(async (tx) => {
      // Trace the money: which company account received this sale.
      const receiving = await resolveReceivingAccount(
        tx,
        parsed.data.paymentAccountId || null,
        parsed.data.method,
      );
      const created = await tx.request.create({
        data: {
          code: refCode("REQ"),
          type: "AGENT_STOCK",
          status: "FULFILLED",
          paymentType: "IMMEDIATE",
          paymentStatus: "PAID",
          requesterId: partner.id,
          reviewedById: admin.id,
          reviewedAt: now,
          fulfilledAt: now,
          deliveredAt: now,
          invoiceNo: refCode("INV"),
          totalAmount,
          note,
          paymentMethod: receiving.method,
          paymentAccountId: receiving.paymentAccountId,
          paymentReference: parsed.data.reference?.trim() || null,
          paidAt: now,
          deliverTo: isWalkin ? customerName : null,
          warehouseName: preferWarehouseName ?? null,
          items: { create: itemData },
        },
      });
      // Deliver-only inventory: ASSIGNED then DISTRIBUTED (net warehouse −qty).
      for (const i of itemData) {
        await applyMovement(tx, {
          productId: i.productId,
          type: "ASSIGNED",
          quantity: i.quantity,
          createdById: admin.id,
          requestId: created.id,
          reference: created.code,
        });
        await applyMovement(tx, {
          productId: i.productId,
          type: "DISTRIBUTED",
          quantity: i.quantity,
          createdById: admin.id,
          requestId: created.id,
          reference: created.code,
        });
        await deductWarehouseStock(tx, {
          productId: i.productId,
          quantity: i.quantity,
          preferWarehouseName,
        });
      }
      return created;
    });

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "CASH_SALE_RECORDED",
      entity: "Request",
      entityId: sale.id,
      summary: `${saleKind} ${sale.code.replace("REQ", "SALE")} to ${buyerLabel} — ${totalAmount}.`,
      meta: { amount: totalAmount, walkin: isWalkin },
    });

    revalidatePath("/admin/sales");
    revalidatePath("/admin/inventory");
    revalidatePath("/admin");
    revalidatePath("/admin/invoices");
    return ok(
      { code: sale.code.replace("REQ", "SALE") },
      "Cash sale recorded. Inventory updated.",
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}
