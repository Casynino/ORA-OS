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
  reserveWarehouseStock,
  releaseWarehouseReservation,
} from "@/lib/services/warehouse-stock";
import { resolveReceivingAccount, isCashMethod } from "@/lib/payment-methods";
import { notifyRepReport, notifyPaymentConfirmed } from "@/lib/notifications/ceo-alerts";
import { refCode } from "@/lib/utils";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";
import type { FieldCreditStatus, FinanceApproval, CashStatus } from "@prisma/client";

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
    "/admin/reps/customers",
    "/admin/customers",
    "/admin/credit",
    "/admin",
    "/finance",
    "/finance/customers",
    "/finance/credit",
    "/warehouse",
    "/warehouse/rep-requests",
  ])
    revalidatePath(p);
}

// Resolve which warehouse fulfils a rep request: warehouse staff always use
// their own assigned warehouse; admin may pass one explicitly, else the main
// (oldest) active warehouse is used.
async function resolveFulfillingWarehouse(
  actor: { id: string; role: string },
  explicitId?: string | null,
): Promise<{ id: string; name: string } | null> {
  if (actor.role === "WAREHOUSE") {
    const me = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { warehouse: { select: { id: true, name: true } } },
    });
    return me?.warehouse ?? null;
  }
  if (explicitId) {
    return prisma.warehouse.findUnique({
      where: { id: explicitId },
      select: { id: true, name: true },
    });
  }
  return prisma.warehouse.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
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
      // Customers are identified by their business/trading name only.
      businessName: z.string().trim().min(2, "Business name is required.").max(120),
      email: z.string().max(120).optional().or(z.literal("")),
      phone: z.string().max(30).optional().or(z.literal("")),
      location: z.string().max(160).optional().or(z.literal("")),
      region: z.string().max(60).optional().or(z.literal("")),
      district: z.string().max(60).optional().or(z.literal("")),
      customerType: z.string().max(40).optional().or(z.literal("")),
      expectedVolume: z.string().max(60).optional().or(z.literal("")),
      preferredPayment: z.string().max(20).optional().or(z.literal("")),
      businessLicense: z.string().max(60).optional().or(z.literal("")),
      taxId: z.string().max(60).optional().or(z.literal("")),
      gpsLat: z.number().min(-90).max(90).optional(),
      gpsLng: z.number().min(-180).max(180).optional(),
    })
    .optional(),
  customerName: z.string().max(120).optional().or(z.literal("")), // walk-in cash
  location: z.string().max(120).optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")), // ISO date for credit
  // CASH sales: how & where the money was received.
  paymentMethod: z.string().max(40).optional().or(z.literal("")),
  paymentAccountId: z.string().optional().or(z.literal("")),
  reference: z.string().max(80).optional().or(z.literal("")),
  // Direct bank/mobile payments: uploaded customer receipt image URL. Allows a
  // long inline data URL (used when object storage isn't configured).
  paymentProofUrl: z.string().max(15000000).optional().or(z.literal("")),
  // Cheque payments: the instrument details finance verifies before receipt.
  chequeBank: z.string().max(80).optional().or(z.literal("")),
  chequeNumber: z.string().max(40).optional().or(z.literal("")),
  chequeDate: z.string().optional().or(z.literal("")), // ISO date
});

export async function recordFieldSale(
  input: z.infer<typeof saleSchema>,
): Promise<ActionResult<{ code: string }>> {
  try {
    const actor = await requireActor(["SALES_REP", "ADMIN", "FINANCE"]);
    // Admin/Finance record head-office sales: stock is drawn from the WAREHOUSE
    // (not a rep's carried stock) and the sale is confirmed on the spot — they
    // are the finance authority, so it never sits in the approval queue.
    const isOffice = actor.role !== "SALES_REP";
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
      // Every credit sale carries a payment due date so the debt is trackable.
      if (!d.dueDate) return fail("Credit sales need a payment due date.");
    }

    // Cheque payments carry structured instrument details for finance to verify.
    const isCheque = d.type === "CASH" && d.paymentMethod === "Cheque";
    if (isCheque && (!d.chequeBank?.trim() || !d.chequeNumber?.trim() || !d.chequeDate))
      return fail("Enter the cheque bank, number and date.");
    if (isCheque && Number.isNaN(new Date(d.chequeDate!).getTime()))
      return fail("The cheque date is invalid.");
    // A cheque can't be verified without a picture of it — the photo is required.
    if (isCheque && !d.paymentProofUrl?.trim())
      return fail("Attach a photo of the cheque.");
    if (d.dueDate && Number.isNaN(new Date(d.dueDate).getTime()))
      return fail("The payment due date is invalid.");

    const code = refCode("FS");
    const dueDate = d.dueDate ? new Date(d.dueDate) : null;
    // Hoisted out of the transaction so the post-commit activity log and CEO
    // alert can still name the buyer and the resolved payment method.
    let soldTo = d.customerName?.trim() || "walk-in customer";
    let resolvedMethod: string | null = null;

    await prisma.$transaction(async (tx) => {
      if (!customerId && d.newCustomer) {
        const biz = d.newCustomer.businessName.trim();
        const c = await tx.fieldCustomer.create({
          data: {
            // Business name is the sole identity; `name` mirrors it because the
            // column is NOT NULL and every display reads `.name`.
            name: biz,
            businessName: biz,
            email: d.newCustomer.email || null,
            phone: d.newCustomer.phone || null,
            location: d.newCustomer.location || null,
            region: d.newCustomer.region || null,
            district: d.newCustomer.district || null,
            customerType: d.newCustomer.customerType || null,
            expectedVolume: d.newCustomer.expectedVolume || null,
            preferredPayment: d.newCustomer.preferredPayment || null,
            businessLicense: d.newCustomer.businessLicense || null,
            taxId: d.newCustomer.taxId || null,
            gpsLat: d.newCustomer.gpsLat ?? null,
            gpsLng: d.newCustomer.gpsLng ?? null,
            // A rep owns the customers they create; an office-recorded customer
            // starts Unassigned (managed by Finance/Admin) until a rep is set.
            repId: isOffice ? null : actor.id,
            registeredById: actor.id,
          },
        });
        customerId = c.id;
      }

      if (customerId) {
        const cust = await tx.fieldCustomer.findUnique({ where: { id: customerId } });
        if (!cust) throw new Error("That customer no longer exists.");
        // A rep can only sell to customers in their own book; Admin/Finance may
        // record a sale for any customer.
        if (!isOffice && cust.repId !== actor.id)
          throw new Error("That customer isn't in your book.");
        if (d.type === "CREDIT" && cust.creditSuspended)
          throw new Error(`${cust.name}'s credit access is suspended.`);
        // Admin/Finance-set credit cap: a rep can't push a customer past it.
        if (d.type === "CREDIT" && cust.creditLimit != null) {
          // Lock the customer row so two concurrent credit sales can't both read
          // the same outstanding and both slip under the cap (released at commit).
          await tx.$executeRaw`SELECT id FROM "FieldCustomer" WHERE id = ${customerId} FOR UPDATE`;
          const openCredit = await tx.fieldSale.findMany({
            where: {
              customerId,
              type: "CREDIT",
              voided: false,
              financeStatus: { not: "REJECTED" },
            },
            select: { total: true, amountPaid: true },
          });
          const owed = openCredit.reduce(
            (a, s) => a + Math.max(0, s.total - s.amountPaid),
            0,
          );
          if (owed + total > cust.creditLimit) {
            const available = Math.max(0, cust.creditLimit - owed);
            throw new Error(
              `${cust.businessName ?? cust.name}'s credit limit is TSh ${cust.creditLimit.toLocaleString()} — only TSh ${available.toLocaleString()} available. Collect a payment or ask admin/finance to raise the limit.`,
            );
          }
        }
        soldTo = cust.name;
      }

      // Office sales aren't bounded by a rep's sellable RepStock, so guard the
      // product status server-side: never sell a discontinued (isActive:false)
      // or not-for-sale (e.g. free sample) product, even if a crafted payload or
      // a stale form supplies its id.
      if (isOffice) {
        const prods = await tx.product.findMany({
          where: { id: { in: d.items.map((i) => i.productId) } },
          select: { id: true, name: true, isActive: true, notForSale: true },
        });
        const byId = new Map(prods.map((p) => [p.id, p]));
        for (const it of d.items) {
          const pr = byId.get(it.productId);
          if (!pr) throw new Error("That product no longer exists.");
          if (!pr.isActive) throw new Error(`${pr.name} is no longer active and can't be sold.`);
          if (pr.notForSale) throw new Error(`${pr.name} is not for sale.`);
        }
      }

      // Deduct stock atomically — a sale can never exceed stock on hand.
      for (const item of d.items) {
        if (isOffice) {
          // Head-office sale: draw from the WAREHOUSE. deductWarehouseStock keeps
          // the per-location ledger (Σ onHand) reconciled and throws on shortfall
          // (respecting units reserved for rep pickups). The org buckets move
          // warehouse → distributed, composed as ASSIGNED then DISTRIBUTED (net
          // warehouse −qty / distributed +qty) — nobody carries this stock.
          try {
            await deductWarehouseStock(tx, {
              productId: item.productId,
              quantity: item.quantity,
            });
          } catch (e) {
            // Finance never sees raw warehouse counts (only Admin/Warehouse do),
            // so a shortfall on a Finance sale is reported without the number.
            if (actor.role === "FINANCE")
              throw new Error("Not enough stock available in the warehouse for that quantity.");
            throw e;
          }
          await applyMovement(tx, {
            productId: item.productId,
            type: "ASSIGNED",
            quantity: item.quantity,
            createdById: actor.id,
            reference: code,
            note: `Warehouse → ${soldTo} (head-office ${d.type.toLowerCase()} sale)`,
          });
          await applyMovement(tx, {
            productId: item.productId,
            type: "DISTRIBUTED",
            quantity: item.quantity,
            createdById: actor.id,
            reference: code,
            note: `${actor.name} → ${soldTo} (head-office ${d.type.toLowerCase()} sale)`,
          });
          continue;
        }
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
          note: `${actor.name} → ${soldTo} (${d.type.toLowerCase()} sale)`,
        });
      }

      // Capture each product's standard selling price NOW (server-side, not from
      // the client) so reporting can compare the actual price charged vs the
      // default — reps/finance may adjust per customer.
      const defaultPrices = new Map(
        (
          await tx.product.findMany({
            where: { id: { in: d.items.map((i) => i.productId) } },
            select: { id: true, price: true },
          })
        ).map((p) => [p.id, p.price]),
      );

      // CASH sales record how & where the money landed — the receiving
      // account is the anchor for finance reconciliation.
      const receiving =
        d.type === "CASH"
          ? await resolveReceivingAccount(tx, d.paymentAccountId || null, d.paymentMethod)
          : { paymentAccountId: null, method: null };
      resolvedMethod = receiving.method;
      // A head-office CASH sale in physical cash lands in Cash on Hand at once;
      // bank / mobile / cheque money already sits in its account (cashStatus null).
      const officePhysicalCash =
        isOffice && d.type === "CASH" && isCashMethod(receiving.method);
      // Admin/Finance are the finance authority, so their sale is confirmed on
      // the spot rather than queued for approval.
      const officeConfirmation: {
        financeStatus?: FinanceApproval;
        financeReviewedById?: string;
        financeReviewedAt?: Date;
        financeNote?: string;
        cashStatus?: CashStatus;
        cashReceivedAt?: Date;
      } = isOffice
        ? {
            financeStatus: "APPROVED",
            financeReviewedById: actor.id,
            financeReviewedAt: new Date(),
            financeNote: `Recorded & confirmed by ${actor.name}`,
            ...(officePhysicalCash
              ? { cashStatus: "RECEIVED", cashReceivedAt: new Date() }
              : {}),
          }
        : {};

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
          paymentMethod: receiving.method,
          paymentAccountId: receiving.paymentAccountId,
          reference: d.reference?.trim() || null,
          paymentProofUrl: d.paymentProofUrl?.trim() || null,
          chequeBank: isCheque ? d.chequeBank!.trim() : null,
          chequeNumber: isCheque ? d.chequeNumber!.trim() : null,
          chequeDate: isCheque ? new Date(d.chequeDate!) : null,
          dueDate,
          note: d.note || null,
          directSale: isOffice,
          ...officeConfirmation,
          items: {
            create: d.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              defaultPrice: defaultPrices.get(i.productId) ?? null,
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
      summary: isOffice
        ? `${actor.name} recorded & confirmed a ${d.type.toLowerCase()} sale ${code} of TSh ${total.toLocaleString()}${customerId ? ` for ${soldTo}` : ""}.`
        : `${actor.name} recorded a ${d.type.toLowerCase()} sale ${code} of TSh ${total.toLocaleString()} — awaiting finance confirmation.`,
    });
    revalidateField();
    revalidatePath("/finance/sales-approvals");
    // A head-office cash sale is money-in the instant it's recorded — alert the
    // CEO, exactly as when finance confirms a rep's cash sale.
    if (isOffice && d.type === "CASH") {
      await notifyPaymentConfirmed({
        customer: soldTo,
        amount: total,
        method: resolvedMethod,
        verifiedBy: actor.name,
      });
    }
    return ok(
      { code },
      isOffice
        ? `Sale ${code} recorded${d.type === "CASH" ? " — payment received and now official." : " — credit terms confirmed."}`
        : `Sale ${code} submitted — finance will ${d.type === "CASH" ? "verify the payment" : "review the credit terms"} and confirm it.`,
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Collections (credit payments) ───────────────────────────────────────────

const collectSchema = z.object({
  saleId: z.string().min(1),
  amount: z.number().int().positive().max(100000000),
  method: z.string().max(40).optional().or(z.literal("")),
  paymentAccountId: z.string().optional().or(z.literal("")),
  reference: z.string().max(80).optional().or(z.literal("")),
  note: z.string().max(300).optional().or(z.literal("")),
  // Uploaded proof of the payment (receipt / screenshot) — long data URLs ok.
  paymentProofUrl: z.string().max(15000000).optional().or(z.literal("")),
  // Cheque collections carry the instrument details finance verifies.
  chequeBank: z.string().max(80).optional().or(z.literal("")),
  chequeNumber: z.string().max(40).optional().or(z.literal("")),
  chequeDate: z.string().optional().or(z.literal("")), // ISO date
});

export async function recordFieldCollection(
  input: z.infer<typeof collectSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["SALES_REP", "ADMIN", "FINANCE"]);
    const parsed = collectSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid payment.");
    const d = parsed.data;

    const sale = await prisma.fieldSale.findUnique({
      where: { id: d.saleId },
      include: { customer: { select: { name: true, repId: true } } },
    });
    if (!sale || sale.type !== "CREDIT") return fail("Credit sale not found.");
    // A rep may only collect while the customer is still in THEIR book. Owning
    // the historical sale isn't enough: once Admin/Finance reassigns a customer
    // the whole ledger moves with them, so the previous rep must not be able to
    // keep posting claims onto another rep's customer.
    if (actor.role === "SALES_REP") {
      const ownsSale = sale.repId === actor.id;
      const ownsCustomer = !sale.customerId || sale.customer?.repId === actor.id;
      if (!ownsSale || !ownsCustomer)
        return fail("That customer is managed by another rep.");
    }
    if (sale.voided) return fail("This sale was voided.");
    if (sale.financeStatus === "REJECTED")
      return fail("This sale was rejected by finance — record a corrected sale instead of collecting on it.");
    const balance = sale.total - sale.amountPaid;
    if (balance <= 0) return fail("This sale is already fully paid.");

    // Finance is the control point: a rep's collection is a CLAIM until
    // finance verifies the money — it doesn't touch the sale balance yet.
    // Finance/admin recording it themselves IS the verification.
    const isRepClaim = actor.role === "SALES_REP";

    // A rep's PENDING claims don't reduce amountPaid, so validate against the
    // balance NET of what they've already claimed — otherwise several pending
    // claims could sum past the outstanding total and over-post on approval.
    let claimable = balance;
    if (isRepClaim) {
      const pending = await prisma.fieldPayment.aggregate({
        _sum: { amount: true },
        where: { saleId: sale.id, financeStatus: "PENDING" },
      });
      claimable = balance - (pending._sum.amount ?? 0);
      if (claimable <= 0) {
        return fail(
          "You've already submitted collections covering this sale's outstanding balance — awaiting finance confirmation.",
        );
      }
    }
    if (d.amount > claimable)
      return fail(`Amount exceeds the outstanding balance (TSh ${claimable.toLocaleString()}).`);

    const isCheque = d.method === "Cheque";
    if (isCheque && (!d.chequeBank?.trim() || !d.chequeNumber?.trim() || !d.chequeDate))
      return fail("Enter the cheque bank, number and date.");
    if (isCheque && Number.isNaN(new Date(d.chequeDate!).getTime()))
      return fail("The cheque date is invalid.");
    // A cheque can't be verified without a picture of it — the photo is required.
    if (isCheque && !d.paymentProofUrl?.trim())
      return fail("Attach a photo of the cheque.");

    const newPaid = sale.amountPaid + d.amount;
    await prisma.$transaction(async (tx) => {
      const receiving = await resolveReceivingAccount(
        tx,
        d.paymentAccountId || null,
        d.method,
      );
      if (!isRepClaim) {
        // Atomic claim on the exact balance we validated — a concurrent
        // collection makes this match 0 rows and abort instead of losing an
        // update (payment rows and amountPaid must never drift apart).
        const claimed = await tx.fieldSale.updateMany({
          where: { id: sale.id, amountPaid: sale.amountPaid, voided: false },
          data: {
            amountPaid: newPaid,
            creditStatus: creditStatusFor(sale.total, newPaid, sale.dueDate),
          },
        });
        if (claimed.count === 0) {
          throw new Error("This sale changed while recording — refresh and try again.");
        }
      }
      // A finance/admin-recorded CASH collection is physical cash in hand the
      // moment it's auto-approved → Cash on Hand (RECEIVED) until it's banked.
      const autoApprovedCash = !isRepClaim && isCashMethod(receiving.method);
      await tx.fieldPayment.create({
        data: {
          saleId: sale.id,
          amount: d.amount,
          method: receiving.method,
          paymentAccountId: receiving.paymentAccountId,
          reference: d.reference?.trim() || null,
          paymentProofUrl: d.paymentProofUrl?.trim() || null,
          chequeBank: isCheque ? d.chequeBank!.trim() : null,
          chequeNumber: isCheque ? d.chequeNumber!.trim() : null,
          chequeDate: isCheque ? new Date(d.chequeDate!) : null,
          note: d.note || null,
          recordedById: actor.id,
          financeStatus: isRepClaim ? "PENDING" : "APPROVED",
          ...(isRepClaim
            ? {}
            : { financeReviewedById: actor.id, financeReviewedAt: new Date() }),
          ...(autoApprovedCash ? { cashStatus: "RECEIVED", cashReceivedAt: new Date() } : {}),
        },
      });
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: isRepClaim ? "FIELD_COLLECTION_SUBMITTED" : "FIELD_CREDIT_COLLECTED",
      entity: "FieldSale",
      entityId: sale.code,
      summary: isRepClaim
        ? `${actor.name} submitted a TSh ${d.amount.toLocaleString()} collection on ${sale.code}${sale.customer ? ` (${sale.customer.name})` : ""} — awaiting finance verification.`
        : `${actor.name} collected TSh ${d.amount.toLocaleString()} on ${sale.code}${sale.customer ? ` (${sale.customer.name})` : ""}.`,
    });
    revalidateField();
    revalidatePath(`/rep/customers`);
    return ok(
      undefined,
      isRepClaim
        ? "Collection submitted — finance will verify the money and post it."
        : "Payment recorded.",
    );
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
        note: `${actor.name} → community samples · ${d.location}`,
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
    await notifyRepReport(actor.name, d.location); // WhatsApp the CEO
    return ok(undefined, "Report submitted — the ORA team can see it now.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Customers ───────────────────────────────────────────────────────────────

const MAX_TSH = 2_147_483_647; // int4 ceiling — TSh amounts are whole ints

const customerSchema = z.object({
  // Customers are identified by their business/trading name only — we never
  // capture a personal contact name (it can compromise the customer).
  businessName: z.string().trim().min(2, "Business name is required.").max(120),
  email: z.string().max(120).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  location: z.string().max(160).optional().or(z.literal("")),
  region: z.string().max(60).optional().or(z.literal("")),
  district: z.string().max(60).optional().or(z.literal("")),
  customerType: z.string().max(40).optional().or(z.literal("")),
  expectedVolume: z.string().max(60).optional().or(z.literal("")),
  preferredPayment: z.string().max(20).optional().or(z.literal("")),
  businessLicense: z.string().max(60).optional().or(z.literal("")),
  taxId: z.string().max(60).optional().or(z.literal("")),
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
  notes: z.string().max(500).optional().or(z.literal("")),
  // ── ADMIN/FINANCE-only extras (ignored/forced for reps) ──
  repId: z.string().trim().optional().or(z.literal("")), // managing rep to assign
  creditLimit: z.number().int().min(0).max(MAX_TSH).optional(), // per-customer cap
  openingBalance: z.number().int().positive().max(MAX_TSH).optional(), // migrated debt
  creditStartDate: z.string().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
});

function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Shape a migrated opening-balance FieldSale — an APPROVED CREDIT receivable
// with NO line items (so it deducts no stock and never counts as a sale). Shared
// by createFieldCustomer (at registration) and recordOpeningBalance (from the
// profile later). Reuses creditStatusFor so overdue/partial math matches sales.
function openingBalanceSaleData(opts: {
  customerId: string;
  repId: string; // managing rep, or the registering user when unassigned
  reviewerId: string; // the ADMIN/FINANCE user recording it
  amount: number;
  createdAt: Date;
  dueDate: Date;
}) {
  return {
    code: refCode("OB"),
    type: "CREDIT" as const,
    isOpeningBalance: true,
    repId: opts.repId,
    customerId: opts.customerId,
    total: opts.amount,
    amountPaid: 0,
    creditStatus: creditStatusFor(opts.amount, 0, opts.dueDate),
    dueDate: opts.dueDate,
    financeStatus: "APPROVED" as const,
    financeReviewedById: opts.reviewerId,
    financeReviewedAt: new Date(),
    financeNote: "Opening balance (migrated)",
    note: "Opening balance migration",
    createdAt: opts.createdAt,
  };
}

export async function createFieldCustomer(
  input: z.infer<typeof customerSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActor(["SALES_REP", "ADMIN", "FINANCE"]);
    const parsed = customerSchema.safeParse(input);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Invalid customer.");
    const d = parsed.data;
    const biz = d.businessName.trim();

    // A rep only ever creates in their own book; ADMIN/FINANCE may assign a
    // managing rep (or leave it unassigned) and record migration extras.
    const isPrivileged = actor.role !== "SALES_REP";
    let managingRepId: string | null = isPrivileged ? d.repId?.trim() || null : actor.id;
    const creditLimit = isPrivileged ? (d.creditLimit ?? null) : null;

    // Validate an assigned managing rep is actually a sales rep.
    if (managingRepId) {
      const rep = await prisma.user.findUnique({ where: { id: managingRepId }, select: { role: true } });
      if (!rep || rep.role !== "SALES_REP") return fail("Assigned rep must be a sales representative.");
    }

    // Opening balance (migration) — privileged only.
    const wantsOB = isPrivileged && !!d.openingBalance && d.openingBalance > 0;
    const obDue = parseDate(d.dueDate);
    const obStart = parseDate(d.creditStartDate) ?? new Date();
    if (wantsOB && !obDue) return fail("An opening balance needs a payment due date.");

    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.fieldCustomer.create({
        data: {
          // Business name is the sole identity; `name` mirrors it (NOT NULL column
          // that every display reads).
          name: biz,
          businessName: biz,
          email: d.email || null,
          phone: d.phone || null,
          location: d.location || null,
          region: d.region || null,
          district: d.district || null,
          customerType: d.customerType || null,
          expectedVolume: d.expectedVolume || null,
          preferredPayment: d.preferredPayment || null,
          businessLicense: d.businessLicense || null,
          taxId: d.taxId || null,
          gpsLat: d.gpsLat ?? null,
          gpsLng: d.gpsLng ?? null,
          notes: d.notes || null,
          repId: managingRepId, // null = unassigned (managed by Finance/Admin)
          registeredById: actor.id, // accountability: who created the profile
          creditLimit,
        },
      });
      if (wantsOB && obDue) {
        await tx.fieldSale.create({
          data: openingBalanceSaleData({
            customerId: c.id,
            repId: managingRepId ?? actor.id,
            reviewerId: actor.id,
            amount: d.openingBalance!,
            createdAt: obStart,
            dueDate: obDue,
          }),
        });
      }
      return c;
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "FIELD_CUSTOMER_REGISTERED",
      entity: "FieldCustomer",
      entityId: created.id,
      summary: wantsOB
        ? `${actor.name} registered ${biz} with an opening balance of TSh ${d.openingBalance!.toLocaleString()}.`
        : `${actor.name} registered ${biz}.`,
    });
    revalidateField();
    return ok(
      { id: created.id },
      isPrivileged ? `${biz} registered.` : `${biz} added to your customers.`,
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Stock requests (rep → admin) ────────────────────────────────────────────

// One request can span several products. Quantities arrive in PIECES (the rep
// UI does the carton→piece conversion). Each line's "kind" is derived from the
// product itself — the free sample product becomes SAMPLE stock, the rest sell.
const stockRequestSchema = z.object({
  note: z.string().max(300).optional().or(z.literal("")),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().nonnegative().max(1000000),
      }),
    )
    .min(1, "Add at least one product."),
});

export async function requestRepStock(
  input: z.infer<typeof stockRequestSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["SALES_REP"]);
    const parsed = stockRequestSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid stock request.");
    }
    const d = parsed.data;

    // Drop empty/zero lines and merge any duplicate product lines (the UI never
    // sends dupes, but a crafted payload would otherwise hit the item unique key).
    const merged = new Map<string, number>();
    for (const i of d.items) {
      if (i.quantity > 0) merged.set(i.productId, (merged.get(i.productId) ?? 0) + i.quantity);
    }
    const wanted = [...merged].map(([productId, quantity]) => ({ productId, quantity }));
    if (wanted.length === 0) {
      return fail("Enter a quantity for at least one product.");
    }

    // Look the products up to derive kind (sample vs sellable) and drop unknowns.
    const products = await prisma.product.findMany({
      where: { id: { in: wanted.map((i) => i.productId) }, isActive: true },
      select: { id: true, notForSale: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const lines = wanted
      .filter((i) => byId.has(i.productId))
      .map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        kind: byId.get(i.productId)!.notForSale
          ? ("SAMPLE" as const)
          : ("SELLABLE" as const),
      }));
    if (lines.length === 0) return fail("None of those products are available.");

    const code = refCode("RSR");
    await prisma.repStockRequest.create({
      data: {
        code,
        repId: actor.id,
        note: d.note || null,
        items: { create: lines },
      },
    });

    const totalUnits = lines.reduce((s, l) => s + l.quantity, 0);
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "REP_STOCK_REQUESTED",
      entity: "RepStockRequest",
      entityId: code,
      summary: `${actor.name} requested ${lines.length} product${lines.length === 1 ? "" : "s"} (${totalUnits} pcs) — ${code}.`,
    });
    revalidateField();
    return ok(undefined, `Stock request ${code} sent to the ORA team.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Warehouse/Admin: approve & prepare a request for rep collection ─────────

const approveSchema = z.object({
  requestId: z.string().min(1),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().nonnegative().max(1000000),
      }),
    )
    .min(1),
  warehouseId: z.string().optional(), // admin override; staff always use their own
});

/**
 * Approve a rep's stock request and prepare it for collection: quantities are
 * fixed, the pieces are reserved in the fulfilling warehouse, and the request
 * goes READY. Nothing leaves the shelf until the rep collects and confirms.
 */
export async function approveRepStockRequest(
  input: z.infer<typeof approveSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "WAREHOUSE"]);
    const parsed = approveSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid approval.");
    const d = parsed.data;

    const wh = await resolveFulfillingWarehouse(actor, d.warehouseId);
    if (!wh) {
      return fail(
        actor.role === "WAREHOUSE"
          ? "Your account isn't linked to a warehouse — ask an admin to assign you."
          : "No active warehouse found.",
      );
    }

    const req = await prisma.repStockRequest.findUnique({
      where: { id: d.requestId },
      include: { rep: true, items: { include: { product: true } } },
    });
    if (!req || req.status !== "PENDING") {
      return fail("Request not found or already handled.");
    }
    const rep = req.rep;
    if (rep.role !== "SALES_REP") return fail("Sales rep not found.");
    if (rep.status !== "ACTIVE") return fail(`${rep.name} is not active.`);

    // Only approve quantities against lines that are actually on the request.
    const approveLines = req.items
      .map((item) => {
        const override = d.lines.find((l) => l.productId === item.productId);
        const qty = override ? override.quantity : item.quantity;
        return { item, qty: Math.max(0, qty) };
      })
      .filter((x) => x.qty > 0);
    if (approveLines.length === 0) {
      return fail("Nothing to approve — every quantity is zero.");
    }

    await prisma.$transaction(async (tx) => {
      // Claim the request atomically — a concurrent approve/reject aborts here.
      const claimed = await tx.repStockRequest.updateMany({
        where: { id: req.id, status: "PENDING" },
        data: {
          status: "READY",
          reviewedById: actor.id,
          reviewedAt: new Date(),
          warehouseId: wh.id,
          preparedById: actor.id,
          preparedAt: new Date(),
        },
      });
      if (claimed.count === 0) {
        throw new Error("This request was already handled.");
      }
      for (const { item, qty } of approveLines) {
        // Hold the pieces in this warehouse until the rep collects them.
        await reserveWarehouseStock(tx, {
          productId: item.productId,
          quantity: qty,
          warehouseId: wh.id,
          productName: item.product.name,
        });
        await tx.repStockRequestItem.update({
          where: { id: item.id },
          data: { issuedQty: qty },
        });
      }
      // Zero out lines the reviewer chose not to send.
      for (const item of req.items) {
        if (!approveLines.some((l) => l.item.id === item.id)) {
          await tx.repStockRequestItem.update({
            where: { id: item.id },
            data: { issuedQty: 0 },
          });
        }
      }
    });

    const totalUnits = approveLines.reduce((s, l) => s + l.qty, 0);
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "REP_STOCK_PREPARED",
      entity: "RepStockRequest",
      entityId: req.code,
      summary: `${actor.name} approved ${req.code} for ${rep.name} — ${totalUnits} pcs reserved at ${wh.name}, awaiting collection.`,
    });
    revalidateField();
    revalidatePath(`/admin/reps/${rep.id}`);
    return ok(
      undefined,
      `Approved — ${rep.name} can now collect at ${wh.name}.`,
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Rep: confirm collection at the warehouse — stock actually moves here ────

export async function confirmRepStockCollection(
  requestId: string,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["SALES_REP"]);
    const req = await prisma.repStockRequest.findUnique({
      where: { id: requestId },
      include: {
        rep: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        preparedBy: { select: { id: true, name: true } },
        items: { include: { product: true } },
      },
    });
    if (!req || req.repId !== actor.id) return fail("Request not found.");
    if (req.status !== "READY") {
      return fail("This request isn't ready for collection.");
    }
    // A READY request is always pinned to the warehouse that reserved it — the
    // collection must consume that exact reservation, never spread org-wide.
    if (!req.warehouseId) {
      return fail("This request has no collection warehouse — ask the ORA team to re-prepare it.");
    }

    const lines = req.items.filter((i) => i.issuedQty > 0);
    if (lines.length === 0) return fail("Nothing to collect on this request.");
    const issuerId = req.preparedById ?? actor.id;

    const base = refCode("ISS");
    await prisma.$transaction(async (tx) => {
      // Claim atomically — double taps can't double-issue.
      const claimed = await tx.repStockRequest.updateMany({
        where: { id: req.id, status: "READY" },
        data: { status: "ISSUED", collectedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new Error("This collection was already confirmed.");
      }

      let i = 0;
      for (const item of lines) {
        i += 1;
        const qty = item.issuedQty;
        const inv = await tx.inventory.findUnique({
          where: { productId: item.productId },
        });
        if (!inv || inv.warehouseQty < qty) {
          throw new Error(
            `Not enough ${item.product.name} — only ${inv?.warehouseQty ?? 0} in the warehouse.`,
          );
        }
        // Warehouse → Sales Rep: units become committed to the field ("assigned").
        await applyMovement(tx, {
          productId: item.productId,
          type: "ASSIGNED",
          quantity: qty,
          createdById: issuerId,
          reference: `${base}-${i}`,
          note: `${req.warehouse?.name ?? "Warehouse"} → ${req.rep.name} (${item.kind === "SAMPLE" ? "samples" : "selling"}) · ${req.code}`,
          warehouseName: req.warehouse?.name ?? null,
        });
        // Hand over the reservation: onHand and reserved both drop here,
        // keeping Σ WarehouseStock.onHand == Inventory.warehouseQty.
        await deductWarehouseStock(tx, {
          productId: item.productId,
          quantity: qty,
          warehouseId: req.warehouseId,
          consumeReserved: true,
        });
        await tx.repStock.upsert({
          where: { repId_productId: { repId: req.repId, productId: item.productId } },
          create: {
            repId: req.repId,
            productId: item.productId,
            sellableQty: item.kind === "SELLABLE" ? qty : 0,
            sampleQty: item.kind === "SAMPLE" ? qty : 0,
            receivedQty: qty,
          },
          update: {
            ...(item.kind === "SELLABLE"
              ? { sellableQty: { increment: qty } }
              : { sampleQty: { increment: qty } }),
            receivedQty: { increment: qty },
          },
        });
        await tx.repStockIssue.create({
          data: {
            code: `${base}-${i}`,
            repId: req.repId,
            productId: item.productId,
            kind: item.kind,
            quantity: qty,
            note: req.code,
            issuedById: issuerId,
            warehouseName: req.warehouse?.name ?? null,
          },
        });
      }
    });

    const totalUnits = lines.reduce((s, l) => s + l.issuedQty, 0);
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "REP_STOCK_COLLECTED",
      entity: "RepStockRequest",
      entityId: req.code,
      summary: `${actor.name} collected ${totalUnits} pcs from ${req.warehouse?.name ?? "the warehouse"} (${req.code}) — issued by ${req.preparedBy?.name ?? "ORA team"}.`,
    });
    revalidateField();
    revalidatePath(`/admin/reps/${req.repId}`);
    return ok(undefined, "Collection confirmed — the stock is now in your hand.");
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

    // Every issue leaves a named warehouse for full traceability.
    const wh = await resolveFulfillingWarehouse(actor);
    const code = refCode("ISS");
    await prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.findUnique({ where: { productId: d.productId } });
      if (!inv || inv.warehouseQty < d.quantity)
        throw new Error(
          `Not enough warehouse stock — ${inv?.warehouseQty ?? 0} available.`,
        );
      // Warehouse → Sales Rep: the units are now committed to the field ("assigned").
      await applyMovement(tx, {
        productId: d.productId,
        type: "ASSIGNED",
        quantity: d.quantity,
        createdById: actor.id,
        reference: code,
        note: `${wh?.name ?? "Warehouse"} → ${rep.name} (${d.kind === "SAMPLE" ? "samples" : "selling"})`,
        warehouseName: wh?.name ?? null,
      });
      // Keep the per-warehouse location ledger in lock-step (invariant:
      // Σ WarehouseStock.onHand == Inventory.warehouseQty).
      await deductWarehouseStock(tx, {
        productId: d.productId,
        quantity: d.quantity,
        preferWarehouseName: wh?.name,
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
          warehouseName: wh?.name ?? null,
        },
      });
      if (d.requestId) {
        // Atomic: only a still-PENDING request can be closed by this issue —
        // an already-handled request aborts instead of double-issuing.
        const claimed = await tx.repStockRequest.updateMany({
          where: { id: d.requestId, status: "PENDING" },
          data: { status: "ISSUED", reviewedById: actor.id, reviewedAt: new Date() },
        });
        if (claimed.count === 0) {
          throw new Error("That stock request was already handled.");
        }
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
    // Warehouse staff's own warehouse, resolved once for the READY-scope check.
    const myWarehouseId =
      actor.role === "WAREHOUSE"
        ? (
            await prisma.user.findUnique({
              where: { id: actor.id },
              select: { warehouseId: true },
            })
          )?.warehouseId ?? null
        : null;

    let wasReady = false;
    const repName = await prisma.$transaction(async (tx) => {
      // Read the CURRENT state inside the tx so a concurrent approve can't
      // slip a now-READY request past a stale pre-tx snapshot (TOCTOU).
      const req = await tx.repStockRequest.findUnique({
        where: { id },
        include: { rep: { select: { name: true } }, items: true },
      });
      if (!req) throw new Error("Request not found.");
      wasReady = req.status === "READY";
      // A READY request is pinned to a warehouse — a warehouse actor may only
      // cancel their own. PENDING is the shared intake queue (any warehouse).
      if (wasReady && myWarehouseId && req.warehouseId !== myWarehouseId) {
        throw new Error("This prepared request belongs to another warehouse.");
      }
      // Atomic guard: a collection that lands first can't be overwritten by a
      // stale reject — only PENDING or still-uncollected READY can be rejected.
      const rejected = await tx.repStockRequest.updateMany({
        where: { id, status: { in: ["PENDING", "READY"] } },
        data: { status: "REJECTED", reviewedById: actor.id, reviewedAt: new Date() },
      });
      if (rejected.count === 0) {
        throw new Error("This request was already handled.");
      }
      // A prepared request holds reservations — put the pieces back on offer.
      // Both the status check and the release use the same in-tx snapshot, so
      // a request that became READY concurrently is released, never leaked.
      if (wasReady && req.warehouseId) {
        for (const item of req.items) {
          if (item.issuedQty > 0) {
            await releaseWarehouseReservation(tx, {
              productId: item.productId,
              quantity: item.issuedQty,
              warehouseId: req.warehouseId,
            });
          }
        }
      }
      return req.rep.name;
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "REP_STOCK_REJECTED",
      entity: "RepStockRequest",
      entityId: id,
      summary: `${actor.name} ${wasReady ? "cancelled the prepared" : "rejected"} stock request from ${repName}.`,
    });
    revalidateField();
    return ok(undefined, wasReady ? "Collection cancelled — reserved stock released." : "Request rejected.");
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
    const actor = await requireActor(["ADMIN", "FINANCE"]);
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

/** ADMIN/FINANCE set the per-customer credit cap — the rep can never set it.
 * Pass null (or a blank) to remove the cap. */
export async function setFieldCustomerCreditLimit(
  customerId: string,
  limit: number | null,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "FINANCE"]);
    const cust = await prisma.fieldCustomer.findUnique({ where: { id: customerId } });
    if (!cust) return fail("Customer not found.");
    const clean =
      limit == null || Number.isNaN(limit) || limit < 0 ? null : Math.round(limit);
    await prisma.fieldCustomer.update({
      where: { id: customerId },
      data: { creditLimit: clean },
    });
    const who = cust.businessName ?? cust.name;
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "FIELD_CREDIT_LIMIT_SET",
      entity: "FieldCustomer",
      entityId: customerId,
      summary:
        clean == null
          ? `${actor.name} removed the credit limit for ${who}.`
          : `${actor.name} set ${who}'s credit limit to TSh ${clean.toLocaleString()}.`,
    });
    revalidateField();
    revalidatePath("/admin/reps/customers");
    revalidatePath("/finance/customers");
    return ok(
      undefined,
      clean == null
        ? `Credit limit removed for ${who}.`
        : `Credit limit set to TSh ${clean.toLocaleString()} for ${who}.`,
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** ADMIN/FINANCE assign (or clear) the sales rep who manages this customer.
 * null = unassigned (stays under Finance/Admin). Historical sales keep their
 * original repId — only the customer's managing rep changes going forward. */
export async function setFieldCustomerRep(
  customerId: string,
  repId: string | null,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "FINANCE"]);
    const cust = await prisma.fieldCustomer.findUnique({
      where: { id: customerId },
      // The OUTGOING rep — so the audit trail can say who the customer moved from.
      include: { rep: { select: { name: true } } },
    });
    if (!cust) return fail("Customer not found.");
    const clean = repId?.trim() || null;
    const who = cust.businessName ?? cust.name;
    // A no-op save shouldn't write a misleading "reassigned" row into the history.
    if (clean === (cust.repId ?? null))
      return ok(undefined, clean ? `${who} is already managed by that rep.` : `${who} is already unassigned.`);

    let newRepName: string | null = null;
    if (clean) {
      const rep = await prisma.user.findUnique({ where: { id: clean }, select: { role: true, name: true } });
      if (!rep || rep.role !== "SALES_REP") return fail("Assigned rep must be a sales representative.");
      newRepName = rep.name;
    }
    await prisma.fieldCustomer.update({ where: { id: customerId }, data: { repId: clean } });
    const oldRepName = cust.rep?.name ?? null;
    // Name both sides of the move — a transfer audit is useless without them.
    const summary =
      clean && oldRepName
        ? `${actor.name} moved ${who} from ${oldRepName} to ${newRepName}.`
        : clean
          ? `${actor.name} assigned ${who} to ${newRepName}.`
          : `${actor.name} unassigned ${who}${oldRepName ? ` from ${oldRepName}` : ""}.`;
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "FIELD_CUSTOMER_REP_SET",
      entity: "FieldCustomer",
      entityId: customerId,
      summary,
    });
    revalidateField();
    return ok(undefined, clean ? `Managing rep assigned for ${who}.` : `${who} set to unassigned.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const openingBalanceInputSchema = z.object({
  amount: z.number().int().positive().max(MAX_TSH),
  creditStartDate: z.string().optional().or(z.literal("")),
  dueDate: z.string().min(1, "A due date is required."),
});

/** ADMIN/FINANCE record a pre-ORA-OS debt (opening balance) for an EXISTING
 * customer — a migrated CREDIT receivable that behaves like an approved credit
 * sale but is not a new sale (no stock, excluded from revenue). */
export async function recordOpeningBalance(
  customerId: string,
  input: z.infer<typeof openingBalanceInputSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActor(["ADMIN", "FINANCE"]);
    const parsed = openingBalanceInputSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid opening balance.");
    const d = parsed.data;
    const cust = await prisma.fieldCustomer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, businessName: true, repId: true },
    });
    if (!cust) return fail("Customer not found.");
    const due = parseDate(d.dueDate);
    if (!due) return fail("Enter a valid due date.");
    const start = parseDate(d.creditStartDate) ?? new Date();

    const sale = await prisma.fieldSale.create({
      data: openingBalanceSaleData({
        customerId: cust.id,
        repId: cust.repId ?? actor.id, // managing rep, else the recorder
        reviewerId: actor.id,
        amount: d.amount,
        createdAt: start,
        dueDate: due,
      }),
    });
    const who = cust.businessName ?? cust.name;
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "FIELD_OPENING_BALANCE_RECORDED",
      entity: "FieldSale",
      entityId: sale.code,
      summary: `${actor.name} recorded a TSh ${d.amount.toLocaleString()} opening balance for ${who}.`,
    });
    revalidateField();
    return ok({ id: sale.id }, `Opening balance of TSh ${d.amount.toLocaleString()} recorded for ${who}.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** A dated note on the customer — visible to rep, admin and finance, and it
 * lands on the customer's activity timeline. */
export async function addFieldCustomerNote(
  customerId: string,
  note: string,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["SALES_REP", "ADMIN", "FINANCE"]);
    const text = note.trim();
    if (text.length < 2) return fail("Write a note first.");
    if (text.length > 500) return fail("Notes must be 500 characters or fewer.");
    const cust = await prisma.fieldCustomer.findUnique({ where: { id: customerId } });
    if (!cust) return fail("Customer not found.");
    if (actor.role === "SALES_REP" && cust.repId !== actor.id)
      return fail("That customer isn't in your book.");
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "FIELD_CUSTOMER_NOTE",
      entity: "FieldCustomer",
      entityId: customerId,
      summary: `${actor.name}: ${text}`,
    });
    revalidateField();
    return ok(undefined, "Note added.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Edit / delete a customer — ADMIN/FINANCE only (never the rep) ────────────

const editCustomerSchema = z.object({
  businessName: z.string().trim().min(2, "Business name is required.").max(120),
  email: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  location: z.string().trim().max(160).optional().or(z.literal("")),
  region: z.string().trim().max(60).optional().or(z.literal("")),
  district: z.string().trim().max(60).optional().or(z.literal("")),
  customerType: z.string().trim().max(40).optional().or(z.literal("")),
  expectedVolume: z.string().trim().max(60).optional().or(z.literal("")),
  preferredPayment: z.string().trim().max(20).optional().or(z.literal("")),
  businessLicense: z.string().trim().max(60).optional().or(z.literal("")),
  taxId: z.string().trim().max(60).optional().or(z.literal("")),
});

/** ADMIN/FINANCE edit a field customer's details — including the address, which
 * is the customer's single delivery address. Reps can never edit customers. */
export async function updateFieldCustomer(
  id: string,
  input: z.infer<typeof editCustomerSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "FINANCE"]);
    const parsed = editCustomerSchema.safeParse(input);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Invalid details.");
    const d = parsed.data;
    const cust = await prisma.fieldCustomer.findUnique({ where: { id } });
    if (!cust) return fail("Customer not found.");
    const biz = d.businessName.trim();
    await prisma.fieldCustomer.update({
      where: { id },
      data: {
        // Business name stays the sole identity — `name` mirrors it.
        name: biz,
        businessName: biz,
        email: d.email || null,
        phone: d.phone || null,
        location: d.location || null,
        region: d.region || null,
        district: d.district || null,
        customerType: d.customerType || null,
        expectedVolume: d.expectedVolume || null,
        preferredPayment: d.preferredPayment || null,
        businessLicense: d.businessLicense || null,
        taxId: d.taxId || null,
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "FIELD_CUSTOMER_UPDATED",
      entity: "FieldCustomer",
      entityId: id,
      summary: `${actor.name} updated ${biz}'s details.`,
    });
    revalidateField();
    revalidatePath("/admin/reps/customers");
    revalidatePath("/finance/customers");
    return ok(undefined, `${biz} updated.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** ADMIN deletes a field customer — only when they have no sales, so we never
 * destroy financial history. Customers belong to ORA, so only the CEO/Admin may
 * permanently remove one; Finance and reps never can. */
export async function deleteFieldCustomer(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const cust = await prisma.fieldCustomer.findUnique({ where: { id } });
    if (!cust) return fail("Customer not found.");
    const sales = await prisma.fieldSale.count({ where: { customerId: id } });
    if (sales > 0)
      return fail(
        "This customer has sales history and can't be deleted — suspend their credit instead.",
      );
    const who = cust.businessName ?? cust.name;
    await prisma.$transaction([
      prisma.activityLog.deleteMany({ where: { entity: "FieldCustomer", entityId: id } }),
      prisma.fieldCustomer.delete({ where: { id } }),
    ]);
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "FIELD_CUSTOMER_DELETED",
      entity: "FieldCustomer",
      entityId: id,
      summary: `${actor.name} deleted customer ${who}.`,
    });
    revalidateField();
    revalidatePath("/admin/reps/customers");
    revalidatePath("/finance/customers");
    return ok(undefined, `${who} deleted.`);
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
    if (sale.financeStatus === "REJECTED")
      return fail("This sale was already rejected by finance — its stock is back with the rep.");
    if (sale.cashStatus === "DEPOSITED")
      return fail("This cash sale has already been banked in a deposit — it can't be voided. Reverse the deposit first.");
    // The sale's own cashStatus only covers a CASH sale's money. A CREDIT sale
    // can carry cash COLLECTIONS that were already banked — voiding the sale
    // would drop them from account inflow while the bank deposit still counts
    // them, so the deposit stops reconciling. Block it until the deposit is
    // reversed (mirrors the sale-level guard above for collections).
    const bankedCollection = await prisma.fieldPayment.findFirst({
      where: { saleId, cashStatus: "DEPOSITED" },
      select: { id: true },
    });
    if (bankedCollection)
      return fail("A collection on this sale has already been banked in a deposit — reverse the deposit first, then void.");

    await prisma.$transaction(async (tx) => {
      // Atomic claim: a sale can only be voided once, and never after finance
      // rejected it (rejection already returned its stock — a second restore
      // would corrupt inventory). This guards against concurrent void/reject.
      const claimed = await tx.fieldSale.updateMany({
        where: { id: sale.id, voided: false, financeStatus: { not: "REJECTED" } },
        data: { voided: true, voidReason: reason || null },
      });
      if (claimed.count === 0)
        throw new Error("This sale was already voided or rejected.");

      for (const item of sale.items) {
        if (sale.directSale) {
          // A head-office sale drew its stock from the WAREHOUSE, so a void puts
          // it back there — not into a rep's hands (there is no RepStock row).
          // RESTOCKED nets warehouse +qty / distributed −qty; addWarehouseStock
          // restores the per-location ledger so Σ onHand stays reconciled.
          await applyMovement(tx, {
            productId: item.productId,
            type: "RESTOCKED",
            quantity: item.quantity,
            createdById: actor.id,
            reference: `VOID ${sale.code}`,
            note: `Customer → warehouse (head-office sale voided: ${reason})`,
          });
          await addWarehouseStock(tx, {
            productId: item.productId,
            quantity: item.quantity,
          });
          continue;
        }
        // Put the units back in the rep's hands and reconcile the org ledger:
        // RESTOCKED (+warehouse, -distributed) then ASSIGNED (-warehouse, +assigned)
        // nets to assigned +qty / distributed -qty with a clean audit trail.
        await applyMovement(tx, {
          productId: item.productId,
          type: "RESTOCKED",
          quantity: item.quantity,
          createdById: actor.id,
          reference: `VOID ${sale.code}`,
          note: `Customer → ${sale.rep.name} (sale voided: ${reason})`,
        });
        await applyMovement(tx, {
          productId: item.productId,
          type: "ASSIGNED",
          quantity: item.quantity,
          createdById: actor.id,
          reference: `VOID ${sale.code}`,
          note: `Stock back in ${sale.rep.name}'s hands`,
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
      // Any collections a rep claimed against this sale are now moot — reject
      // the still-pending ones so they don't linger in the finance queue.
      // (Approved payments are already excluded from money math by the
      // sale.voided filter, so PENDING is enough here.)
      await tx.fieldPayment.updateMany({
        where: { saleId: sale.id, financeStatus: "PENDING" },
        data: {
          financeStatus: "REJECTED",
          financeReviewedById: actor.id,
          financeReviewedAt: new Date(),
          financeNote: `Sale voided: ${reason || "no reason given"}`,
        },
      });
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "FIELD_SALE_VOIDED",
      entity: "FieldSale",
      entityId: sale.code,
      summary: `${actor.name} voided sale ${sale.code} (${reason || "no reason given"}). Stock restored to ${sale.directSale ? "the warehouse" : sale.rep.name}.`,
    });
    revalidateField();
    return ok(undefined, `Sale ${sale.code} voided and stock restored.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}
