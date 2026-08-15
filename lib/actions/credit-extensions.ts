"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";
import { notifyCreditSelfExtended } from "@/lib/notifications/ceo-alerts";
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
    "/rep",
    "/rep/customers",
  ])
    revalidatePath(p);
}

/** Move a credit sale's due date NOW: row-lock it, record a self-approved
 *  extension row (so history stays complete) and recompute its credit status.
 *  Shared by the admin's direct extend and a rep/finance's first (no-approval)
 *  self-extension. Returns the outstanding + the date it moved FROM. */
async function applyDueDateMove(p: {
  saleId: string;
  customerId: string | null;
  actorId: string;
  newDueDate: Date;
  reason: string;
  note: string | null;
}): Promise<{ outstanding: number; originalDueDate: Date | null }> {
  let outstanding = 0;
  let originalDueDate: Date | null = null;
  await prisma.$transaction(async (tx) => {
    // Lock the sale so the deadline move + status recompute use current values.
    await tx.$executeRaw`SELECT id FROM "FieldSale" WHERE id = ${p.saleId} FOR UPDATE`;
    const fresh = await tx.fieldSale.findUnique({
      where: { id: p.saleId },
      select: { total: true, amountPaid: true, voided: true, financeStatus: true, dueDate: true },
    });
    if (!fresh || fresh.voided || fresh.financeStatus === "REJECTED")
      throw new Error("This sale can no longer be extended — refresh and try again.");
    outstanding = Math.max(0, fresh.total - fresh.amountPaid);
    originalDueDate = fresh.dueDate;
    await tx.creditExtensionRequest.create({
      data: {
        saleId: p.saleId,
        customerId: p.customerId,
        originalDueDate: fresh.dueDate,
        outstanding,
        reason: p.reason,
        requestedDueDate: p.newDueDate,
        status: "APPROVED",
        requestedById: p.actorId,
        reviewedById: p.actorId,
        reviewedAt: new Date(),
        adminNote: p.note,
      },
    });
    await tx.fieldSale.update({
      where: { id: p.saleId },
      data: {
        dueDate: p.newDueDate,
        creditStatus: creditStatusFor(fresh.total, fresh.amountPaid, p.newDueDate),
      },
    });
  });
  return { outstanding, originalDueDate };
}

const createSchema = z.object({
  saleId: z.string().min(1),
  reason: z.string().trim().min(3, "Add the reason for the extension.").max(500),
  requestedDueDate: z.string().min(1, "Pick the requested new payment date."),
  financeNotes: z.string().max(500).optional().or(z.literal("")),
});

/** A SALES_REP, FINANCE or ADMIN extends a credit sale's due date.
 *
 *  The FIRST extension on a sale is self-service — it applies immediately (no
 *  approval) and the boss gets a WhatsApp with the full credit detail + new
 *  date. A SECOND (or later) extension on the same sale needs the boss's
 *  approval and goes to the pending queue. A rep may only act on their OWN
 *  customers' sales. */
export async function createCreditExtension(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["SALES_REP", "FINANCE", "ADMIN"]);
    const parsed = createSchema.safeParse(input);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Invalid request.");
    const d = parsed.data;

    const sale = await prisma.fieldSale.findUnique({
      where: { id: d.saleId },
      include: { customer: { select: { id: true, name: true, businessName: true, repId: true } } },
    });
    if (!sale || sale.type !== "CREDIT") return fail("Credit sale not found.");
    // A rep can raise extensions on any credit sale of a customer they CURRENTLY
    // manage — including sales recorded by Finance or by a prior rep before the
    // customer was assigned to them. Ownership is judged on the customer's
    // current repId ALONE: having recorded the sale is not enough, or a rep whose
    // customer was reassigned away could keep filing against another rep's book.
    if (actor.role === "SALES_REP" && sale.customer?.repId !== actor.id)
      return fail("You can only request extensions for your own customers.");
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

    const who = sale.customer?.businessName ?? sale.customer?.name ?? "customer";

    // The self-service-vs-approval DECISION and the write must both happen under
    // the sale's row lock. Otherwise two concurrent "first" extensions (double
    // click, two tabs, double POST) both read zero prior approvals outside the
    // lock and both self-apply — bypassing the boss-approval control on the
    // second one. Locking the sale, then re-counting inside the transaction,
    // serializes them: the loser sees the winner's committed APPROVED row and
    // correctly routes to a PENDING request. (A unique index is NOT usable here —
    // a sale legitimately accrues several approved extensions over its life.)
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "FieldSale" WHERE id = ${sale.id} FOR UPDATE`;
      const fresh = await tx.fieldSale.findUnique({
        where: { id: sale.id },
        select: { total: true, amountPaid: true, voided: true, financeStatus: true, dueDate: true },
      });
      if (!fresh || fresh.voided || fresh.financeStatus === "REJECTED")
        throw new Error("This sale can no longer be extended — refresh and try again.");
      const owe = Math.max(0, fresh.total - fresh.amountPaid);
      if (owe <= 0) throw new Error("This sale is already fully paid — nothing to extend.");
      if (fresh.dueDate && requestedDueDate <= fresh.dueDate)
        throw new Error("The new payment date must be after the current due date.");

      // Serialized by the lock above, so these counts are authoritative.
      const openPending = await tx.creditExtensionRequest.count({
        where: { saleId: sale.id, status: "PENDING" },
      });
      if (openPending > 0)
        throw new Error("There's already a pending extension request on this sale.");
      const priorApproved = await tx.creditExtensionRequest.count({
        where: { saleId: sale.id, status: "APPROVED" },
      });

      // First extension is self-service (admins always are); a second needs the boss.
      const selfService = actor.role === "ADMIN" || priorApproved === 0;
      if (selfService) {
        await tx.creditExtensionRequest.create({
          data: {
            saleId: sale.id,
            customerId: sale.customerId,
            originalDueDate: fresh.dueDate,
            outstanding: owe,
            reason: d.reason.trim(),
            requestedDueDate,
            status: "APPROVED",
            requestedById: actor.id,
            reviewedById: actor.id,
            reviewedAt: new Date(),
            adminNote: d.financeNotes?.trim() || null,
          },
        });
        await tx.fieldSale.update({
          where: { id: sale.id },
          data: {
            dueDate: requestedDueDate,
            creditStatus: creditStatusFor(fresh.total, fresh.amountPaid, requestedDueDate),
          },
        });
      } else {
        await tx.creditExtensionRequest.create({
          data: {
            saleId: sale.id,
            customerId: sale.customerId,
            originalDueDate: fresh.dueDate,
            outstanding: owe,
            reason: d.reason.trim(),
            requestedDueDate,
            financeNotes: d.financeNotes?.trim() || null,
            requestedById: actor.id,
          },
        });
      }
      return { selfService, outstanding: owe, originalDueDate: fresh.dueDate };
    });

    // Post-commit side effects (logging + boss WhatsApp run after the DB commit).
    if (result.selfService) {
      await logActivity({
        actorId: actor.id,
        actorName: actor.name,
        action: "CREDIT_EXTENSION_APPROVED",
        entity: "FieldCustomer",
        entityId: sale.customerId,
        summary: `${actor.name} extended the credit due date on ${sale.code} (${who}) to ${requestedDueDate.toLocaleDateString()} — first extension, no approval needed.`,
      });
      if (actor.role !== "ADMIN") {
        await notifyCreditSelfExtended({
          actorName: actor.name,
          customer: who,
          saleCode: sale.code,
          outstanding: result.outstanding,
          oldDueDate: result.originalDueDate,
          newDueDate: requestedDueDate,
        });
      }
      revalidateExtensions();
      return ok(undefined, "Due date extended — the boss has been notified.");
    }

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "CREDIT_EXTENSION_REQUESTED",
      entity: "FieldCustomer",
      entityId: sale.customerId,
      summary: `${actor.name} requested a 2nd credit extension on ${sale.code} (${who}) — new date ${requestedDueDate.toLocaleDateString()}, TSh ${result.outstanding.toLocaleString()} outstanding.`,
    });
    revalidateExtensions();
    return ok(undefined, "This sale was already extended once — your request was sent to the boss for approval.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const directSchema = z.object({
  saleId: z.string().min(1),
  reason: z.string().trim().min(3, "Add the reason for the extension.").max(500),
  newDueDate: z.string().min(1, "Pick the new payment date."),
  adminNote: z.string().max(500).optional().or(z.literal("")),
});

/** ADMIN extends a credit sale's due date DIRECTLY — no request/approval round
 *  trip, because the admin IS the approver. Moves the due date immediately and
 *  records the extension as a self-approved entry so the history stays complete. */
export async function applyCreditExtensionDirect(
  input: z.infer<typeof directSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const parsed = directSchema.safeParse(input);
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

    const newDueDate = new Date(d.newDueDate);
    if (Number.isNaN(newDueDate.getTime()))
      return fail("The new payment date is invalid.");
    if (sale.dueDate && newDueDate <= sale.dueDate)
      return fail("The new payment date must be after the current due date.");

    // If someone (a rep/finance) already filed a pending request, the admin
    // should decide THAT one rather than silently opening a second track.
    const openReq = await prisma.creditExtensionRequest.findFirst({
      where: { saleId: sale.id, status: "PENDING" },
      select: { id: true },
    });
    if (openReq)
      return fail("There's a pending extension request on this sale — approve or reject it in Credit Extensions.");

    await applyDueDateMove({
      saleId: sale.id,
      customerId: sale.customerId,
      actorId: actor.id,
      newDueDate,
      reason: d.reason.trim(),
      note: d.adminNote?.trim() || null,
    });

    const who = sale.customer?.businessName ?? sale.customer?.name ?? "customer";
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "CREDIT_EXTENSION_APPROVED",
      entity: "FieldCustomer",
      entityId: sale.customerId,
      summary: `${actor.name} extended the credit due date on ${sale.code} (${who}) to ${newDueDate.toLocaleDateString()}.`,
    });
    revalidateExtensions();
    return ok(undefined, "Due date extended — the sale is updated.");
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
