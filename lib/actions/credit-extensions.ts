"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";
import type { FieldCreditStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
//  Credit Extension Requests — Finance raises them, Admin approves/rejects.
//  A customer asks for more time on a credit sale → Finance reviews and files a
//  request → Admin decides. On approval the sale's due date moves and its credit
//  status is recomputed. Every request is kept permanently as history.
// ─────────────────────────────────────────────────────────────────────────────

/** Mirror of the field-sale credit-status rule (kept local — field.ts is a
 * "use server" module and can't export sync helpers). */
function creditStatusFor(
  total: number,
  paid: number,
  dueDate: Date | null,
): FieldCreditStatus {
  if (paid >= total) return "PAID";
  if (dueDate && dueDate < new Date()) return "OVERDUE";
  return paid > 0 ? "PARTIAL" : "PENDING";
}

function revalidateExtensions() {
  for (const p of [
    "/admin/credit",
    "/admin/credit/extensions",
    "/admin/customers",
    "/finance/credit",
    "/finance/customers",
    "/admin",
  ])
    revalidatePath(p);
}

const createSchema = z.object({
  saleId: z.string().min(1),
  reason: z.string().trim().min(3, "Add the reason for the extension.").max(500),
  requestedDueDate: z.string().min(1, "Pick the requested new payment date."),
  financeNotes: z.string().max(500).optional().or(z.literal("")),
});

/** FINANCE (or ADMIN) files an extension request against a credit sale. */
export async function createCreditExtension(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const parsed = createSchema.safeParse(input);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Invalid request.");
    const d = parsed.data;

    const sale = await prisma.fieldSale.findUnique({
      where: { id: d.saleId },
      include: { customer: { select: { id: true, name: true, businessName: true } } },
    });
    if (!sale || sale.type !== "CREDIT") return fail("Credit sale not found.");
    if (sale.voided) return fail("This sale was voided.");
    if (sale.financeStatus === "REJECTED")
      return fail("This sale was rejected by finance — it can't be extended.");
    const outstanding = Math.max(0, sale.total - sale.amountPaid);
    if (outstanding <= 0)
      return fail("This sale is already fully paid — nothing to extend.");

    const requestedDueDate = new Date(d.requestedDueDate);
    if (Number.isNaN(requestedDueDate.getTime()))
      return fail("The requested new payment date is invalid.");
    // An extension only makes sense as a LATER deadline than the current one.
    if (sale.dueDate && requestedDueDate <= sale.dueDate)
      return fail("The new payment date must be after the current due date.");

    // Only one open request per sale — Admin clears it before another is filed.
    const openReq = await prisma.creditExtensionRequest.findFirst({
      where: { saleId: sale.id, status: "PENDING" },
      select: { id: true },
    });
    if (openReq)
      return fail("There's already a pending extension request on this sale.");

    await prisma.creditExtensionRequest.create({
      data: {
        saleId: sale.id,
        customerId: sale.customerId,
        originalDueDate: sale.dueDate,
        outstanding,
        reason: d.reason.trim(),
        requestedDueDate,
        financeNotes: d.financeNotes?.trim() || null,
        requestedById: actor.id,
      },
    });

    const who = sale.customer?.businessName ?? sale.customer?.name ?? "customer";
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "CREDIT_EXTENSION_REQUESTED",
      entity: "FieldCustomer",
      entityId: sale.customerId,
      summary: `${actor.name} requested a credit extension on ${sale.code} (${who}) — new date ${requestedDueDate.toLocaleDateString()}, TSh ${outstanding.toLocaleString()} outstanding.`,
    });
    revalidateExtensions();
    return ok(undefined, "Extension request sent to Admin for approval.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const decideSchema = z.object({
  id: z.string().min(1),
  adminNote: z.string().max(500).optional().or(z.literal("")),
});

/** ADMIN approves an extension: the sale's due date moves to the requested date
 * and its credit status is recomputed. */
export async function approveCreditExtension(
  input: z.infer<typeof decideSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const parsed = decideSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid request.");
    const d = parsed.data;

    const req = await prisma.creditExtensionRequest.findUnique({
      where: { id: d.id },
      include: { sale: { include: { customer: { select: { name: true, businessName: true } } } } },
    });
    if (!req) return fail("Extension request not found.");
    if (req.status !== "PENDING")
      return fail("This request has already been decided.");

    await prisma.$transaction(async (tx) => {
      // Atomic claim: only the first approver of a still-PENDING request wins.
      const claimed = await tx.creditExtensionRequest.updateMany({
        where: { id: req.id, status: "PENDING" },
        data: {
          status: "APPROVED",
          reviewedById: actor.id,
          reviewedAt: new Date(),
          adminNote: d.adminNote?.trim() || null,
        },
      });
      if (claimed.count === 0)
        throw new Error("This request was just decided — refresh and try again.");

      // Re-read the sale INSIDE the tx (locked) so the deadline move + status
      // recompute use CURRENT values — between the finance request and this
      // approval the sale may have been paid off, voided or finance-rejected.
      await tx.$executeRaw`SELECT id FROM "FieldSale" WHERE id = ${req.saleId} FOR UPDATE`;
      const sale = await tx.fieldSale.findUnique({
        where: { id: req.saleId },
        select: { total: true, amountPaid: true, voided: true, financeStatus: true },
      });
      if (sale && !sale.voided && sale.financeStatus !== "REJECTED") {
        await tx.fieldSale.update({
          where: { id: req.saleId },
          data: {
            dueDate: req.requestedDueDate,
            creditStatus: creditStatusFor(
              sale.total,
              sale.amountPaid,
              req.requestedDueDate,
            ),
          },
        });
      }
    });

    const who = req.sale.customer?.businessName ?? req.sale.customer?.name ?? "customer";
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "CREDIT_EXTENSION_APPROVED",
      entity: "FieldCustomer",
      entityId: req.customerId,
      summary: `${actor.name} approved a credit extension on ${req.sale.code} (${who}) — new due date ${req.requestedDueDate.toLocaleDateString()}.`,
    });
    revalidateExtensions();
    return ok(undefined, "Extension approved — the due date has been updated.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** ADMIN rejects an extension — the sale's due date is unchanged. */
export async function rejectCreditExtension(
  input: z.infer<typeof decideSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const parsed = decideSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid request.");
    const d = parsed.data;

    const req = await prisma.creditExtensionRequest.findUnique({
      where: { id: d.id },
      include: { sale: { include: { customer: { select: { name: true, businessName: true } } } } },
    });
    if (!req) return fail("Extension request not found.");
    if (req.status !== "PENDING")
      return fail("This request has already been decided.");

    const claimed = await prisma.creditExtensionRequest.updateMany({
      where: { id: req.id, status: "PENDING" },
      data: {
        status: "REJECTED",
        reviewedById: actor.id,
        reviewedAt: new Date(),
        adminNote: d.adminNote?.trim() || null,
      },
    });
    if (claimed.count === 0)
      return fail("This request was just decided — refresh and try again.");

    const who = req.sale.customer?.businessName ?? req.sale.customer?.name ?? "customer";
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "CREDIT_EXTENSION_REJECTED",
      entity: "FieldCustomer",
      entityId: req.customerId,
      summary: `${actor.name} rejected the credit extension on ${req.sale.code} (${who}).`,
    });
    revalidateExtensions();
    return ok(undefined, "Extension rejected — the due date stays as it was.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
