"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { applyMovement } from "@/lib/services/inventory";
import { refCode } from "@/lib/utils";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";
import type { FieldCreditStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
//  Field sales actions — Warehouse → Sales Rep → Customer.
//  Strict rules enforced here: no sale without stock deduction, no credit
//  without a customer record, no sample without tracking, everything logged.
// ─────────────────────────────────────────────────────────────────────────────

function creditStatusFor(
  total: number,
  paid: number,
  dueDate: Date | null,
): FieldCreditStatus {
  if (paid >= total) return "PAID";
  if (dueDate && dueDate < new Date()) return "OVERDUE";
  return paid > 0 ? "PARTIAL" : "PENDING";
}

function revalidateField() {
  for (const p of [
    "/rep",
    "/rep/sell",
    "/rep/stock",
    "/rep/samples",
    "/rep/customers",
    "/rep/reports",
    "/rep/targets",
    "/admin/reps",
    "/admin",
  ])
    revalidatePath(p);
}

// ── Selling ─────────────────────────────────────────────────────────────────

const saleSchema = z.object({
  type: z.enum(["CASH", "CREDIT"]),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(100000),
        unitPrice: z.number().int().nonnegative().max(10000000),
      }),
    )
    .min(1, "Add at least one product."),
  customerId: z.string().optional(),
  newCustomer: z
    .object({
      name: z.string().min(2),
      phone: z.string().max(30).optional().or(z.literal("")),
      location: z.string().max(120).optional().or(z.literal("")),
    })
    .optional(),
  customerName: z.string().max(120).optional().or(z.literal("")), // walk-in cash
  location: z.string().max(120).optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")), // ISO date for credit
});

export async function recordFieldSale(
  input: z.infer<typeof saleSchema>,
): Promise<ActionResult<{ code: string }>> {
  try {
    const actor = await requireActor(["SALES_REP"]);
    const parsed = saleSchema.safeParse(input);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Invalid sale.");
    const d = parsed.data;

    const total = d.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    if (total <= 0) return fail("The sale total must be greater than zero.");

    // Credit sales must always be tied to a customer record.
    let customerId = d.customerId || null;
    if (d.type === "CREDIT") {
      if (!customerId && !d.newCustomer)
        return fail("Credit sales need a customer — pick or create one.");
    }

    const code = refCode("FS");
    const dueDate = d.dueDate ? new Date(d.dueDate) : null;

    await prisma.$transaction(async (tx) => {
      if (!customerId && d.newCustomer) {
        const c = await tx.fieldCustomer.create({
          data: {
            name: d.newCustomer.name,
            phone: d.newCustomer.phone || null,
            location: d.newCustomer.location || null,
            repId: actor.id,
          },
        });
        customerId = c.id;
      }

      if (customerId) {
        const cust = await tx.fieldCustomer.findUnique({ where: { id: customerId } });
        if (!cust || cust.repId !== actor.id)
          throw new Error("That customer isn't in your book.");
        if (d.type === "CREDIT" && cust.creditSuspended)
          throw new Error(`${cust.name}'s credit access is suspended.`);
      }

      // Deduct rep stock atomically — a sale can never exceed stock in hand.
      for (const item of d.items) {
        const stock = await tx.repStock.findUnique({
          where: { repId_productId: { repId: actor.id, productId: item.productId } },
          include: { product: { select: { name: true } } },
        });
        if (!stock || stock.sellableQty < item.quantity)
          throw new Error(
            `Not enough stock in hand for ${stock?.product.name ?? "that product"} — you have ${stock?.sellableQty ?? 0}.`,
          );
        await tx.repStock.update({
          where: { id: stock.id },
          data: {
            sellableQty: { decrement: item.quantity },
            soldQty: { increment: item.quantity },
          },
        });
        // Org-wide ledger: rep stock lives in "assigned"; a sale distributes it.
        await applyMovement(tx, {
          productId: item.productId,
          type: "DISTRIBUTED",
          quantity: item.quantity,
          createdById: actor.id,
          reference: code,
          note: `Field ${d.type.toLowerCase()} sale by ${actor.name}`,
        });
      }

      await tx.fieldSale.create({
        data: {
          code,
          type: d.type,
          repId: actor.id,
          customerId,
          customerName: d.customerName || null,
          location: d.location || null,
          total,
          amountPaid: d.type === "CASH" ? total : 0,
          creditStatus:
            d.type === "CREDIT" ? creditStatusFor(total, 0, dueDate) : null,
          dueDate,
          note: d.note || null,
          items: {
            create: d.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              lineTotal: i.quantity * i.unitPrice,
            })),
          },
        },
      });
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: d.type === "CASH" ? "FIELD_SALE_CASH" : "FIELD_SALE_CREDIT",
      entity: "FieldSale",
      entityId: code,
      summary: `${actor.name} recorded a ${d.type.toLowerCase()} sale ${code} of TSh ${total.toLocaleString()}.`,
    });
    revalidateField();
    return ok({ code }, `Sale ${code} recorded.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Collections (credit payments) ───────────────────────────────────────────

const collectSchema = z.object({
  saleId: z.string().min(1),
  amount: z.number().int().positive().max(100000000),
  method: z.string().max(40).optional().or(z.literal("")),
  note: z.string().max(300).optional().or(z.literal("")),
});

export async function recordFieldCollection(
  input: z.infer<typeof collectSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["SALES_REP", "ADMIN"]);
    const parsed = collectSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid payment.");
    const d = parsed.data;

    const sale = await prisma.fieldSale.findUnique({
      where: { id: d.saleId },
      include: { customer: { select: { name: true } } },
    });
    if (!sale || sale.type !== "CREDIT") return fail("Credit sale not found.");
    if (actor.role === "SALES_REP" && sale.repId !== actor.id)
      return fail("That sale belongs to another rep.");
    if (sale.voided) return fail("This sale was voided.");
    const balance = sale.total - sale.amountPaid;
    if (balance <= 0) return fail("This sale is already fully paid.");
    if (d.amount > balance)
      return fail(`Amount exceeds the outstanding balance (TSh ${balance.toLocaleString()}).`);

    const newPaid = sale.amountPaid + d.amount;
    await prisma.$transaction([
      prisma.fieldPayment.create({
        data: {
          saleId: sale.id,
          amount: d.amount,
          method: d.method || null,
          note: d.note || null,
          recordedById: actor.id,
        },
      }),
      prisma.fieldSale.update({
        where: { id: sale.id },
        data: {
          amountPaid: newPaid,
          creditStatus: creditStatusFor(sale.total, newPaid, sale.dueDate),
        },
      }),
    ]);

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "FIELD_CREDIT_COLLECTED",
      entity: "FieldSale",
      entityId: sale.code,
      summary: `${actor.name} collected TSh ${d.amount.toLocaleString()} on ${sale.code}${sale.customer ? ` (${sale.customer.name})` : ""}.`,
    });
    revalidateField();
    revalidatePath(`/rep/customers`);
    return ok(undefined, "Payment recorded.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Samples ─────────────────────────────────────────────────────────────────

const sampleSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(100000),
  location: z.string().min(2, "Where were these distributed?").max(120),
  reason: z.string().max(200).optional().or(z.literal("")),
});

export async function logSampleDistribution(
  input: z.infer<typeof sampleSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["SALES_REP"]);
    const parsed = sampleSchema.safeParse(input);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Invalid sample record.");
    const d = parsed.data;

    await prisma.$transaction(async (tx) => {
      const stock = await tx.repStock.findUnique({
        where: { repId_productId: { repId: actor.id, productId: d.productId } },
        include: { product: { select: { name: true } } },
      });
      if (!stock || stock.sampleQty < d.quantity)
        throw new Error(
          `Not enough sample stock — you have ${stock?.sampleQty ?? 0}.`,
        );
      await tx.repStock.update({
        where: { id: stock.id },
        data: {
          sampleQty: { decrement: d.quantity },
          sampledQty: { increment: d.quantity },
        },
      });
      await applyMovement(tx, {
        productId: d.productId,
        type: "DISTRIBUTED",
        quantity: d.quantity,
        createdById: actor.id,
        reference: "SAMPLE",
        note: `Samples at ${d.location} by ${actor.name}`,
      });
      await tx.sampleLog.create({
        data: {
          repId: actor.id,
          productId: d.productId,
          quantity: d.quantity,
          location: d.location,
          reason: d.reason || null,
        },
      });
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "FIELD_SAMPLE",
      entity: "SampleLog",
      summary: `${actor.name} distributed ${d.quantity} samples at ${d.location}.`,
    });
    revalidateField();
    return ok(undefined, "Sample distribution recorded.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Field reports ───────────────────────────────────────────────────────────

const reportSchema = z.object({
  location: z.string().min(2, "Where did you work today?").max(120),
  salesAchieved: z.number().int().nonnegative().max(100000000),
  unitsSold: z.number().int().nonnegative().max(1000000),
  creditCollected: z.number().int().nonnegative().max(100000000),
  challenges: z.string().max(1000).optional().or(z.literal("")),
  marketFeedback: z.string().max(1000).optional().or(z.literal("")),
});

export async function submitFieldReport(
  input: z.infer<typeof reportSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["SALES_REP"]);
    const parsed = reportSchema.safeParse(input);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Invalid report.");
    const d = parsed.data;

    await prisma.fieldReport.create({
      data: {
        repId: actor.id,
        location: d.location,
        salesAchieved: d.salesAchieved,
        unitsSold: d.unitsSold,
        creditCollected: d.creditCollected,
        challenges: d.challenges || null,
        marketFeedback: d.marketFeedback || null,
      },
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "FIELD_REPORT",
      entity: "FieldReport",
      summary: `${actor.name} filed a field report from ${d.location}.`,
    });
    revalidateField();
    return ok(undefined, "Report submitted — the ORA team can see it now.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Customers ───────────────────────────────────────────────────────────────

const customerSchema = z.object({
  name: z.string().min(2, "Customer name is required.").max(120),
  phone: z.string().max(30).optional().or(z.literal("")),
  location: z.string().max(120).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export async function createFieldCustomer(
  input: z.infer<typeof customerSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActor(["SALES_REP"]);
    const parsed = customerSchema.safeParse(input);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Invalid customer.");
    const d = parsed.data;
    const c = await prisma.fieldCustomer.create({
      data: {
        name: d.name,
        phone: d.phone || null,
        location: d.location || null,
        notes: d.notes || null,
        repId: actor.id,
      },
    });
    revalidateField();
    return ok({ id: c.id }, `${d.name} added to your customers.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Stock requests (rep → admin) ────────────────────────────────────────────

const stockRequestSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(100000),
  kind: z.enum(["SELLABLE", "SAMPLE"]),
  note: z.string().max(300).optional().or(z.literal("")),
});

export async function requestRepStock(
  input: z.infer<typeof stockRequestSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["SALES_REP"]);
    const parsed = stockRequestSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid stock request.");
    const d = parsed.data;
    const code = refCode("RSR");
    await prisma.repStockRequest.create({
      data: {
        code,
        repId: actor.id,
        productId: d.productId,
        quantity: d.quantity,
        kind: d.kind,
        note: d.note || null,
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "REP_STOCK_REQUESTED",
      entity: "RepStockRequest",
      entityId: code,
      summary: `${actor.name} requested ${d.quantity} units (${d.kind.toLowerCase()}).`,
    });
    revalidateField();
    return ok(undefined, `Stock request ${code} sent to the ORA team.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Admin: issue stock to a rep ─────────────────────────────────────────────

const issueSchema = z.object({
  repId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(100000),
  kind: z.enum(["SELLABLE", "SAMPLE"]),
  note: z.string().max(300).optional().or(z.literal("")),
  requestId: z.string().optional(), // fulfilling a rep's request
});

export async function issueRepStock(
  input: z.infer<typeof issueSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "WAREHOUSE"]);
    const parsed = issueSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid stock issue.");
    const d = parsed.data;

    const rep = await prisma.user.findUnique({ where: { id: d.repId } });
    if (!rep || rep.role !== "SALES_REP") return fail("Sales rep not found.");
    if (rep.status !== "ACTIVE") return fail(`${rep.name} is not active.`);

    const code = refCode("ISS");
    await prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.findUnique({ where: { productId: d.productId } });
      if (!inv || inv.warehouseQty < d.quantity)
        throw new Error(
          `Not enough warehouse stock — ${inv?.warehouseQty ?? 0} available.`,
        );
      // Warehouse → rep: the units are now committed to the field ("assigned").
      await applyMovement(tx, {
        productId: d.productId,
        type: "ASSIGNED",
        quantity: d.quantity,
        createdById: actor.id,
        reference: code,
        note: `Issued to sales rep ${rep.name} (${d.kind.toLowerCase()})`,
      });
      await tx.repStock.upsert({
        where: { repId_productId: { repId: d.repId, productId: d.productId } },
        create: {
          repId: d.repId,
          productId: d.productId,
          sellableQty: d.kind === "SELLABLE" ? d.quantity : 0,
          sampleQty: d.kind === "SAMPLE" ? d.quantity : 0,
          receivedQty: d.quantity,
        },
        update: {
          ...(d.kind === "SELLABLE"
            ? { sellableQty: { increment: d.quantity } }
            : { sampleQty: { increment: d.quantity } }),
          receivedQty: { increment: d.quantity },
        },
      });
      await tx.repStockIssue.create({
        data: {
          code,
          repId: d.repId,
          productId: d.productId,
          kind: d.kind,
          quantity: d.quantity,
          note: d.note || null,
          issuedById: actor.id,
        },
      });
      if (d.requestId) {
        await tx.repStockRequest.update({
          where: { id: d.requestId },
          data: { status: "ISSUED", reviewedById: actor.id, reviewedAt: new Date() },
        });
      }
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "REP_STOCK_ISSUED",
      entity: "RepStockIssue",
      entityId: code,
      summary: `${actor.name} issued ${d.quantity} units (${d.kind.toLowerCase()}) to ${rep.name}.`,
    });
    revalidateField();
    revalidatePath(`/admin/reps/${d.repId}`);
    return ok(undefined, `Stock issued to ${rep.name}.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function rejectRepStockRequest(
  id: string,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "WAREHOUSE"]);
    const req = await prisma.repStockRequest.findUnique({
      where: { id },
      include: { rep: { select: { name: true } } },
    });
    if (!req || req.status !== "PENDING") return fail("Request not found.");
    await prisma.repStockRequest.update({
      where: { id },
      data: { status: "REJECTED", reviewedById: actor.id, reviewedAt: new Date() },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "REP_STOCK_REJECTED",
      entity: "RepStockRequest",
      entityId: req.code,
      summary: `${actor.name} rejected stock request ${req.code} from ${req.rep.name}.`,
    });
    revalidateField();
    return ok(undefined, "Request rejected.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Admin: targets, suspension, corrections ─────────────────────────────────

const targetSchema = z.object({
  repId: z.string().min(1),
  year: z.number().int().min(2024).max(2100),
  month: z.number().int().min(1).max(12),
  salesTarget: z.number().int().nonnegative().max(1000000000),
  unitsTarget: z.number().int().nonnegative().max(10000000),
  cashTarget: z.number().int().nonnegative().max(1000000000),
  creditRecoveryTarget: z.number().int().nonnegative().max(1000000000),
});

export async function setRepTarget(
  input: z.infer<typeof targetSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const parsed = targetSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid target.");
    const d = parsed.data;
    await prisma.repTarget.upsert({
      where: { repId_year_month: { repId: d.repId, year: d.year, month: d.month } },
      create: { ...d },
      update: {
        salesTarget: d.salesTarget,
        unitsTarget: d.unitsTarget,
        cashTarget: d.cashTarget,
        creditRecoveryTarget: d.creditRecoveryTarget,
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "REP_TARGET_SET",
      entity: "RepTarget",
      entityId: d.repId,
      summary: `${actor.name} set ${d.month}/${d.year} targets for a sales rep.`,
    });
    revalidateField();
    revalidatePath(`/admin/reps/${d.repId}`);
    return ok(undefined, "Targets saved.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function setRepStatus(
  repId: string,
  status: "ACTIVE" | "SUSPENDED",
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const rep = await prisma.user.findUnique({ where: { id: repId } });
    if (!rep || rep.role !== "SALES_REP") return fail("Sales rep not found.");
    await prisma.user.update({ where: { id: repId }, data: { status } });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: status === "SUSPENDED" ? "REP_SUSPENDED" : "REP_REACTIVATED",
      entity: "User",
      entityId: repId,
      summary: `${actor.name} ${status === "SUSPENDED" ? "suspended" : "reactivated"} sales rep ${rep.name}.`,
    });
    revalidateField();
    revalidatePath(`/admin/reps/${repId}`);
    return ok(undefined, `${rep.name} is now ${status.toLowerCase()}.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function setRepTerritory(
  repId: string,
  region: string,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const rep = await prisma.user.findUnique({ where: { id: repId } });
    if (!rep || rep.role !== "SALES_REP") return fail("Sales rep not found.");
    await prisma.user.update({ where: { id: repId }, data: { region: region || null } });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "REP_TERRITORY_SET",
      entity: "User",
      entityId: repId,
      summary: `${actor.name} assigned ${rep.name} to ${region || "no territory"}.`,
    });
    revalidateField();
    revalidatePath(`/admin/reps/${repId}`);
    return ok(undefined, "Territory updated.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function setFieldCustomerCredit(
  customerId: string,
  suspended: boolean,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const cust = await prisma.fieldCustomer.findUnique({ where: { id: customerId } });
    if (!cust) return fail("Customer not found.");
    await prisma.fieldCustomer.update({
      where: { id: customerId },
      data: { creditSuspended: suspended },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: suspended ? "FIELD_CREDIT_SUSPENDED" : "FIELD_CREDIT_RESTORED",
      entity: "FieldCustomer",
      entityId: customerId,
      summary: `${actor.name} ${suspended ? "suspended" : "restored"} credit for ${cust.name}.`,
    });
    revalidateField();
    return ok(undefined, `Credit ${suspended ? "suspended" : "restored"} for ${cust.name}.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function voidFieldSale(
  saleId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const sale = await prisma.fieldSale.findUnique({
      where: { id: saleId },
      include: { items: true, rep: { select: { id: true, name: true } } },
    });
    if (!sale) return fail("Sale not found.");
    if (sale.voided) return fail("This sale is already voided.");

    await prisma.$transaction(async (tx) => {
      for (const item of sale.items) {
        // Put the units back in the rep's hands and reconcile the org ledger:
        // RESTOCKED (+warehouse, -distributed) then ASSIGNED (-warehouse, +assigned)
        // nets to assigned +qty / distributed -qty with a clean audit trail.
        await applyMovement(tx, {
          productId: item.productId,
          type: "RESTOCKED",
          quantity: item.quantity,
          createdById: actor.id,
          reference: `VOID ${sale.code}`,
          note: reason,
        });
        await applyMovement(tx, {
          productId: item.productId,
          type: "ASSIGNED",
          quantity: item.quantity,
          createdById: actor.id,
          reference: `VOID ${sale.code}`,
          note: `Stock back with ${sale.rep.name}`,
        });
        await tx.repStock.update({
          where: {
            repId_productId: { repId: sale.repId, productId: item.productId },
          },
          data: {
            sellableQty: { increment: item.quantity },
            soldQty: { decrement: item.quantity },
          },
        });
      }
      await tx.fieldSale.update({
        where: { id: sale.id },
        data: { voided: true, voidReason: reason || null },
      });
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "FIELD_SALE_VOIDED",
      entity: "FieldSale",
      entityId: sale.code,
      summary: `${actor.name} voided sale ${sale.code} (${reason || "no reason given"}). Stock restored to ${sale.rep.name}.`,
    });
    revalidateField();
    return ok(undefined, `Sale ${sale.code} voided and stock restored.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}
