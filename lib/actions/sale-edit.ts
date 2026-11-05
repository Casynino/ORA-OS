"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { applyMovement } from "@/lib/services/inventory";
import { resolveReceivingAccount } from "@/lib/payment-methods";
import { saleEditBlocker } from "@/lib/services/sale-edit";
import {
  attachAfterCommit,
  attachmentsInputSchema,
  filesFromInput,
  getAttachmentsFor,
} from "@/lib/services/attachments";
import { notifyInApp } from "@/lib/notifications/in-app";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";
import type { FieldCreditStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
//  A rep corrects a sale they recorded. Everything that depends on the sale is
//  recomputed in ONE transaction: stock (only the difference moves), the total,
//  the amount paid, the credit status — and if Finance had already confirmed it,
//  that confirmation is withdrawn (cash leaves Cash on Hand) until Finance
//  confirms the corrected numbers again. Nothing is counted as official money
//  while the sale is waiting for that confirmation.
// ─────────────────────────────────────────────────────────────────────────────

const editSchema = z.object({
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
  customerName: z.string().max(120).optional().or(z.literal("")),
  location: z.string().max(120).optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  paymentMethod: z.string().max(40).optional().or(z.literal("")),
  paymentAccountId: z.string().optional().or(z.literal("")),
  reference: z.string().max(80).optional().or(z.literal("")),
  attachments: attachmentsInputSchema, // NEW proofs — existing ones stay attached
  chequeBank: z.string().max(80).optional().or(z.literal("")),
  chequeNumber: z.string().max(40).optional().or(z.literal("")),
  chequeDate: z.string().optional().or(z.literal("")),
});

function creditStatusFor(total: number, paid: number, dueDate: Date | null): FieldCreditStatus {
  if (paid >= total) return "PAID";
  if (dueDate && dueDate < new Date()) return "OVERDUE";
  return paid > 0 ? "PARTIAL" : "PENDING";
}

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const tsh = (n: number) => `TSh ${n.toLocaleString("en-US")}`;

export async function editFieldSale(
  saleId: string,
  input: z.infer<typeof editSchema>,
): Promise<ActionResult<{ code: string; reconfirm: boolean; changed: boolean }>> {
  try {
    const actor = await requireActor(["SALES_REP"]);
    const parsed = editSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid sale.");
    const d = parsed.data;

    const total = d.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    if (total <= 0) return fail("The sale total must be greater than zero.");
    if (d.type === "CREDIT") {
      if (!d.customerId) return fail("Credit sales need a customer — pick or create one.");
      if (!d.dueDate) return fail("Credit sales need a payment due date.");
    }
    if (d.dueDate && Number.isNaN(new Date(d.dueDate).getTime())) {
      return fail("The payment due date is invalid.");
    }
    const isCheque = d.type === "CASH" && d.paymentMethod === "Cheque";
    if (isCheque && (!d.chequeBank?.trim() || !d.chequeNumber?.trim() || !d.chequeDate)) {
      return fail("Enter the cheque bank, number and date.");
    }
    if (isCheque && Number.isNaN(new Date(d.chequeDate!).getTime())) {
      return fail("The cheque date is invalid.");
    }
    const newFiles = filesFromInput(d.attachments, null);
    const dueDate = d.type === "CREDIT" && d.dueDate ? new Date(d.dueDate) : null;

    let result = { code: "", reconfirm: false, changed: false };
    let summary = "";
    let notifyBody = "";
    let soldTo = "walk-in customer";
    let customerIdForPaths: string | null = null;
    let saleIdForNotify = saleId;

    await prisma.$transaction(
      async (tx) => {
        // Lock the sale so a deposit, collection, confirmation or second edit can't
        // slip in between the checks below and the writes.
        await tx.$executeRaw`SELECT id FROM "FieldSale" WHERE id = ${saleId} FOR UPDATE`;
        const sale = await tx.fieldSale.findUnique({
          where: { id: saleId },
          include: {
            items: { include: { product: { select: { id: true, name: true, price: true } } } },
            customer: { select: { name: true } },
          },
        });
        if (!sale || sale.repId !== actor.id) throw new Error("Sale not found.");
        const blocked = await saleEditBlocker(tx, sale);
        if (blocked) throw new Error(blocked);
        const wasApproved = sale.financeStatus === "APPROVED";

        // ── Customer ──────────────────────────────────────────────────────────
        let customerName: string | null = null;
        if (d.customerId) {
          const cust = await tx.fieldCustomer.findUnique({ where: { id: d.customerId } });
          if (!cust) throw new Error("That customer no longer exists.");
          if (cust.repId !== actor.id) throw new Error("That customer isn't in your book.");
          customerName = cust.name;
          if (d.type === "CREDIT" && cust.creditSuspended) {
            throw new Error(`${cust.name}'s credit access is suspended.`);
          }
          if (d.type === "CREDIT" && cust.creditLimit != null) {
            // Same cap as recording a sale, counting every OTHER open credit sale.
            await tx.$executeRaw`SELECT id FROM "FieldCustomer" WHERE id = ${d.customerId} FOR UPDATE`;
            const open = await tx.fieldSale.findMany({
              where: {
                customerId: d.customerId,
                type: "CREDIT",
                voided: false,
                financeStatus: { not: "REJECTED" },
                id: { not: sale.id },
              },
              select: { total: true, amountPaid: true },
            });
            const owed = open.reduce((a, s) => a + Math.max(0, s.total - s.amountPaid), 0);
            if (owed + total > cust.creditLimit) {
              const available = Math.max(0, cust.creditLimit - owed);
              throw new Error(
                `${cust.businessName ?? cust.name}'s credit limit is ${tsh(cust.creditLimit)} — only ${tsh(available)} available. Collect a payment or ask admin/finance to raise the limit.`,
              );
            }
          }
        }
        soldTo = customerName ?? (d.customerName?.trim() || "walk-in customer");
        customerIdForPaths = d.customerId ?? sale.customerId ?? null;

        // ── Payment details ───────────────────────────────────────────────────
        const receiving =
          d.type === "CASH"
            ? await resolveReceivingAccount(tx, d.paymentAccountId || null, d.paymentMethod)
            : { paymentAccountId: null, method: null };
        if (isCheque) {
          const wasCheque = sale.paymentMethod === "Cheque";
          if (!wasCheque && newFiles.length === 0) throw new Error("Attach a photo of the cheque.");
        }

        // ── Stock: only the DIFFERENCE moves ──────────────────────────────────
        const oldQty = new Map<string, number>();
        for (const i of sale.items) oldQty.set(i.productId, (oldQty.get(i.productId) ?? 0) + i.quantity);
        const newQty = new Map<string, number>();
        for (const i of d.items) newQty.set(i.productId, (newQty.get(i.productId) ?? 0) + i.quantity);
        const names = new Map<string, string>(sale.items.map((i) => [i.productId, i.product.name]));
        const extraIds = [...newQty.keys()].filter((id) => !names.has(id));
        const extra = extraIds.length
          ? await tx.product.findMany({ where: { id: { in: extraIds } }, select: { id: true, name: true, price: true } })
          : [];
        for (const p of extra) names.set(p.id, p.name);
        const currentPrice = new Map<string, number>([
          ...sale.items.map((i) => [i.productId, i.product.price] as [string, number]),
          ...extra.map((p) => [p.id, p.price] as [string, number]),
        ]);
        for (const id of extraIds) if (!names.has(id)) throw new Error("That product no longer exists.");

        for (const pid of new Set([...oldQty.keys(), ...newQty.keys()])) {
          const delta = (newQty.get(pid) ?? 0) - (oldQty.get(pid) ?? 0);
          if (delta === 0) continue;
          const pname = names.get(pid) ?? "product";
          if (delta > 0) {
            // Selling more: it must be in hand.
            const took = await tx.repStock.updateMany({
              where: { repId: actor.id, productId: pid, sellableQty: { gte: delta } },
              data: { sellableQty: { decrement: delta }, soldQty: { increment: delta } },
            });
            if (took.count === 0) {
              const have = await tx.repStock.findUnique({
                where: { repId_productId: { repId: actor.id, productId: pid } },
                select: { sellableQty: true },
              });
              throw new Error(
                `Not enough ${pname} in hand to add ${delta} more — you have ${have?.sellableQty ?? 0}.`,
              );
            }
            await applyMovement(tx, {
              productId: pid,
              type: "DISTRIBUTED",
              quantity: delta,
              createdById: actor.id,
              reference: sale.code,
              note: `${actor.name} → ${soldTo} (sale ${sale.code} edited: ${delta} more)`,
            });
          } else {
            // Selling less: those pieces are back in the rep's hands.
            const back = -delta;
            const gave = await tx.repStock.updateMany({
              where: { repId: actor.id, productId: pid, soldQty: { gte: back } },
              data: { sellableQty: { increment: back }, soldQty: { decrement: back } },
            });
            if (gave.count === 0) throw new Error(`Your sales record for ${pname} doesn't have ${back} to give back.`);
            await applyMovement(tx, {
              productId: pid,
              type: "RESTOCKED",
              quantity: back,
              createdById: actor.id,
              reference: sale.code,
              note: `Customer → ${actor.name} (sale ${sale.code} edited: ${back} fewer)`,
            });
            await applyMovement(tx, {
              productId: pid,
              type: "ASSIGNED",
              quantity: back,
              createdById: actor.id,
              reference: sale.code,
              note: `Stock back in ${actor.name}'s hands`,
            });
          }
        }

        // ── Did anything actually change? ─────────────────────────────────────
        const oldPrice = new Map<string, number>();
        for (const i of sale.items) if (!oldPrice.has(i.productId)) oldPrice.set(i.productId, i.unitPrice);
        const sameItems =
          oldQty.size === newQty.size &&
          [...newQty].every(([pid, q]) => oldQty.get(pid) === q) &&
          d.items.every((i) => oldPrice.get(i.productId) === i.unitPrice) &&
          new Set(sale.items.map((i) => i.productId)).size === sale.items.length; // no duplicate lines before
        const same =
          sameItems &&
          sale.type === d.type &&
          (sale.customerId ?? "") === (d.customerId ?? "") &&
          (sale.customerName ?? "") === (d.type === "CASH" && !d.customerId ? (d.customerName ?? "") : "") &&
          (sale.location ?? "") === (d.location ?? "") &&
          (sale.note ?? "") === (d.note ?? "") &&
          day(sale.dueDate) === day(dueDate) &&
          (sale.paymentMethod ?? "") === (receiving.method ?? "") &&
          (sale.paymentAccountId ?? "") === (receiving.paymentAccountId ?? "") &&
          (sale.reference ?? "") === (d.type === "CASH" ? (d.reference?.trim() ?? "") : "") &&
          (isCheque
            ? (sale.chequeBank ?? "") === d.chequeBank!.trim() &&
              (sale.chequeNumber ?? "") === d.chequeNumber!.trim() &&
              day(sale.chequeDate) === day(new Date(d.chequeDate!))
            : !sale.chequeBank && !sale.chequeNumber && !sale.chequeDate) &&
          newFiles.length === 0;
        if (same) {
          result = { code: sale.code, reconfirm: false, changed: false };
          return;
        }

        // ── Rewrite the sale. CASH is paid in full by definition; a CREDIT sale
        //    can only be edited while nothing has been paid or returned on it
        //    (saleEditBlocker), so its amountPaid is 0 here. ────────────────────
        const amountPaid = d.type === "CASH" ? total : 0;
        const defaultFor = new Map<string, number | null>(sale.items.map((i) => [i.productId, i.defaultPrice]));
        await tx.fieldSaleItem.deleteMany({ where: { saleId: sale.id } });
        await tx.fieldSale.update({
          where: { id: sale.id },
          data: {
            type: d.type,
            customerId: d.customerId || null,
            customerName: d.type === "CASH" && !d.customerId ? d.customerName?.trim() || null : null,
            location: d.location?.trim() || null,
            total,
            amountPaid,
            creditStatus: d.type === "CREDIT" ? creditStatusFor(total, 0, dueDate) : null,
            paymentMethod: receiving.method,
            paymentAccountId: receiving.paymentAccountId,
            reference: d.type === "CASH" ? d.reference?.trim() || null : null,
            chequeBank: isCheque ? d.chequeBank!.trim() : null,
            chequeNumber: isCheque ? d.chequeNumber!.trim() : null,
            chequeDate: isCheque ? new Date(d.chequeDate!) : null,
            dueDate,
            note: d.note?.trim() || null,
            ...(newFiles.length > 0 && !sale.paymentProofUrl ? { paymentProofUrl: newFiles[0].url } : {}),
            // A confirmed sale goes back to Finance with the NEW numbers: the
            // confirmation is withdrawn and any physical cash leaves Cash on Hand
            // until they confirm again (same effect as "send back to pending").
            ...(wasApproved
              ? {
                  financeStatus: "PENDING",
                  financeReviewedById: null,
                  financeReviewedAt: null,
                  financeNote: null,
                  cashStatus: null,
                  cashReceivedAt: null,
                }
              : {}),
            items: {
              create: d.items.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                defaultPrice: defaultFor.get(i.productId) ?? currentPrice.get(i.productId) ?? null,
                lineTotal: i.quantity * i.unitPrice,
              })),
            },
          },
        });

        const lines = (rows: { productId: string; quantity: number; unitPrice: number }[]) =>
          rows.map((r) => `${r.quantity} × ${names.get(r.productId) ?? "product"} @ ${r.unitPrice.toLocaleString("en-US")}`).join(", ");
        summary =
          `${actor.name} edited sale ${sale.code}: ` +
          `${sale.type.toLowerCase()} ${tsh(sale.total)} [${lines(sale.items)}] → ${d.type.toLowerCase()} ${tsh(total)} [${lines(d.items)}]` +
          (soldTo ? ` for ${soldTo}` : "") +
          `. ${wasApproved ? "Finance's confirmation was withdrawn — it needs confirming again." : "Still waiting for Finance to confirm."}`;
        notifyBody = `${actor.name} edited ${sale.code} (${soldTo}): ${tsh(sale.total)} → ${tsh(total)}${d.type !== sale.type ? `, now ${d.type.toLowerCase()}` : ""}.`;
        saleIdForNotify = sale.id;
        result = { code: sale.code, reconfirm: wasApproved, changed: true };
      },
      { timeout: 20000 },
    );

    if (!result.changed) return ok(result, "No changes to save.");

    if (newFiles.length > 0) await attachAfterCommit("FieldSale", saleId, newFiles, actor.id);
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "FIELD_SALE_EDITED",
      entity: "FieldSale",
      entityId: result.code,
      summary,
    });
    for (const p of [
      "/rep",
      "/rep/sales",
      "/rep/sell",
      "/rep/stock",
      "/rep/customers",
      "/finance",
      "/finance/sales-approvals",
      "/finance/cash",
      "/finance/credit",
      "/admin",
      "/admin/credit",
      "/admin/reps",
      "/admin/finance",
      "/admin/finance/cash",
    ]) {
      revalidatePath(p);
    }
    if (customerIdForPaths) revalidatePath(`/rep/customers/${customerIdForPaths}`);
    // Finance: a confirmed sale is back in their queue (rings); a still-waiting one
    // just carries new numbers (quiet heads-up).
    await notifyInApp({
      toRoles: ["FINANCE", "ADMIN"],
      category: result.reconfirm ? "ACTION" : "INFO",
      type: result.reconfirm ? "SALE_VERIFY" : "SALE_EDITED",
      title: result.reconfirm ? "Edited sale to confirm again" : "Sale edited",
      body: notifyBody,
      actorName: actor.name,
      entityType: "FieldSale",
      entityId: saleIdForNotify,
      actionUrl: "/finance/sales-approvals",
      actionLabel: "Verify sale",
    });
    return ok(
      result,
      result.reconfirm
        ? `Sale ${result.code} updated. Finance must confirm the new numbers again.`
        : `Sale ${result.code} updated.`,
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}
