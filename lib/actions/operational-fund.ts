"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { refCode, formatCurrency } from "@/lib/utils";
import { EXPENSE_CATEGORY_VALUES, EXPENSE_LABELS, OFFICE_FUND_CATEGORIES } from "@/lib/expense-categories";
import { resolveReceivingAccount, METHOD_LABEL } from "@/lib/payment-methods";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";
import type { ExpenseCategory } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
//  Operational Fund — the single pool the CEO allocates to Finance for daily
//  operations. Finance builds a multi-item request → CEO approves & funds it
//  from a company account (money-out booked NOW — one Expense per line, account
//  debited) → status ISSUED (awaiting receipt) → Finance confirms receipt (flips
//  to APPROVED, unlocking the spendable balance) → Finance records spending
//  (an OperationalSpend accountability record that draws the balance down but is
//  NOT additional money-out — the allocation already expensed it). A recalled/
//  rejected ISSUED request deletes exactly its allocation Expense rows to
//  reverse the money-out. Money-out invariant preserved: Σ Expense.amount, once.
// ─────────────────────────────────────────────────────────────────────────────

function revalidateFund() {
  for (const p of [
    "/finance",
    "/finance/operational-fund",
    "/finance/reports",
    "/admin",
    "/admin/finance",
    "/admin/finance/operational-fund",
    "/admin/finance/ledger",
  ])
    revalidatePath(p);
}


// ── Funding requests ────────────────────────────────────────────────────────

// The Operational Fund is petty cash — it covers day-to-day office spending only,
// never capitalised stock, salaries or imports. Enforcing this at the action
// keeps a fund allocation from ever being filed as STOCK_PURCHASE (which the P&L
// treats as inventory), regardless of what a client might submit.
const OFFICE_FUND_SET = new Set<ExpenseCategory>(OFFICE_FUND_CATEGORIES);
const fundCategory = z
  .enum(EXPENSE_CATEGORY_VALUES)
  .default("OFFICE")
  .refine((c) => OFFICE_FUND_SET.has(c), "That category isn't available for the Operational Fund.");

const itemSchema = z.object({
  category: fundCategory,
  customCategory: z.string().max(60).optional().or(z.literal("")),
  description: z.string().trim().min(2, "Describe the item.").max(200),
  amount: z.number().int().positive("Enter an amount.").max(1000000000),
});
const requestSchema = z.object({
  purpose: z.string().trim().min(3, "What is this request for?").max(300),
  items: z.array(itemSchema).min(1, "Add at least one item.").max(50),
  note: z.string().max(500).optional().or(z.literal("")),
});

/** Finance builds a multi-item allocation request → goes to the CEO. The request
 *  total is the sum of its line items; each line carries its own category so the
 *  eventual allocation expense is filed correctly per line. */
export async function requestOperationalFunds(
  input: z.infer<typeof requestSchema>,
): Promise<ActionResult<{ code: string }>> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid request.");
    const d = parsed.data;
    const total = d.items.reduce((s, it) => s + it.amount, 0);
    const req = await prisma.pettyCashRequest.create({
      data: {
        code: refCode("OF"),
        amount: total,
        purpose: d.purpose,
        category: d.items[0].category, // representative; each item carries its own
        note: d.note?.trim() || null,
        requestedById: actor.id,
        items: {
          create: d.items.map((it) => ({
            category: it.category,
            customCategory: it.customCategory?.trim() || null,
            description: it.description,
            amount: it.amount,
          })),
        },
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "OPERATIONAL_FUND_REQUESTED",
      entity: "PettyCashRequest",
      entityId: req.code,
      summary: `${actor.name} requested ${formatCurrency(total)} for the Operational Fund (${req.code}, ${d.items.length} item${d.items.length === 1 ? "" : "s"}) — awaiting CEO approval.`,
    });
    revalidateFund();
    return ok({ code: req.code }, `${req.code} sent to the CEO for approval.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// The allocation lines to expense for a request: its line items, or a single
// line for a legacy (itemless) request. Each becomes one OPERATIONAL_FUND Expense.
type AllocLine = { category: ExpenseCategory; customCategory: string | null; description: string; amount: number };
function requestLines(req: {
  category: ExpenseCategory; purpose: string; amount: number;
  items?: { category: ExpenseCategory; customCategory: string | null; description: string; amount: number }[];
}): AllocLine[] {
  if (req.items && req.items.length > 0)
    return req.items.map((it) => ({ category: it.category, customCategory: it.customCategory, description: it.description, amount: it.amount }));
  return [{ category: req.category, customCategory: null, description: req.purpose, amount: req.amount }];
}

/** CEO approves & FUNDS the request from a chosen company account. The money
 *  leaves the account NOW — one Company Expense per line (money-out booked
 *  immediately). The request goes to ISSUED (awaiting Finance's receipt
 *  confirmation) and is NOT yet spendable; Finance confirms to unlock it. */
export async function approveOperationalFundRequest(
  id: string,
  paymentAccountId?: string | null,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const req = await prisma.pettyCashRequest.findUnique({
      where: { id },
      include: { requestedBy: { select: { name: true } }, items: true },
    });
    if (!req) return fail("Request not found.");

    await prisma.$transaction(async (tx) => {
      // Validate the source account first so a bad account rolls the whole
      // approval back (rejects unknown/deactivated).
      const account = await resolveReceivingAccount(tx, paymentAccountId || null, null);
      // Atomic claim — a request can only be approved once, so the allocation
      // expenses are booked exactly once.
      const claimed = await tx.pettyCashRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "ISSUED", approvedById: admin.id, approvedAt: new Date(), paymentAccountId: account.paymentAccountId },
      });
      if (claimed.count === 0) throw new Error("This request was already reviewed.");
      // Money leaves the company account now — one Expense per line, linked to
      // the request so a recall can reverse exactly these rows.
      for (const line of requestLines(req)) {
        await tx.expense.create({
          data: {
            code: refCode("EXP"),
            source: "OPERATIONAL_FUND",
            category: line.category,
            customCategory: line.customCategory,
            amount: line.amount,
            purpose: `Operational Fund ${req.code} — ${line.description}`,
            note: `Allocated to ${req.requestedBy.name}`,
            paymentMethod: account.method,
            paymentAccountId: account.paymentAccountId,
            pettyCashRequestId: req.id,
            recordedById: admin.id,
          },
        });
      }
    });

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "OPERATIONAL_FUND_APPROVED",
      entity: "PettyCashRequest",
      entityId: req.code,
      summary: `CEO approved & funded ${formatCurrency(req.amount)} for ${req.requestedBy.name} (${req.code}) — money-out booked; awaiting Finance's receipt confirmation.`,
    });
    revalidateFund();
    return ok(undefined, `${req.code} approved — ${formatCurrency(req.amount)} sent; awaiting Finance confirmation.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function rejectOperationalFundRequest(id: string, note?: string): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const req = await prisma.pettyCashRequest.findUnique({ where: { id } });
    if (!req) return fail("Request not found.");
    const rejected = await prisma.pettyCashRequest.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "REJECTED", approvedById: admin.id, approvedAt: new Date(), adminNote: note?.trim() || null },
    });
    if (rejected.count === 0) return fail("This request was already reviewed.");
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "OPERATIONAL_FUND_REJECTED",
      entity: "PettyCashRequest",
      entityId: req.code,
      summary: `CEO rejected Operational Fund request ${req.code}${note?.trim() ? ` — ${note.trim()}` : ""}.`,
    });
    revalidateFund();
    return ok(undefined, "Request rejected.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── CEO-initiated issue → Finance confirms receipt ──────────────────────────

const issueSchema = z.object({
  amount: z.number().int().positive("Enter an amount.").max(1000000000),
  purpose: z.string().trim().min(3, "What are the funds for?").max(300),
  category: fundCategory,
  paymentAccountId: z.string().optional().or(z.literal("")), // account the money is issued FROM
  note: z.string().max(500).optional().or(z.literal("")),
});

/** CEO pushes funds to Finance without waiting for a request. Money leaves the
 *  chosen account NOW (Expense booked), status ISSUED — Finance confirms receipt
 *  to unlock the spendable balance. Same money-out timing as an approval. */
export async function issueOperationalFunds(
  input: z.infer<typeof issueSchema>,
): Promise<ActionResult<{ code: string }>> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = issueSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid amount.");
    const d = parsed.data;
    let code = "";
    await prisma.$transaction(async (tx) => {
      const account = await resolveReceivingAccount(tx, d.paymentAccountId || null, null);
      const req = await tx.pettyCashRequest.create({
        data: {
          code: refCode("OF"),
          amount: d.amount,
          purpose: d.purpose,
          category: d.category,
          status: "ISSUED",
          note: d.note?.trim() || null,
          requestedById: admin.id,
          approvedById: admin.id,
          approvedAt: new Date(),
          paymentAccountId: account.paymentAccountId,
        },
      });
      code = req.code;
      // Money-out now — drawing down the chosen account.
      await tx.expense.create({
        data: {
          code: refCode("EXP"),
          source: "OPERATIONAL_FUND",
          category: d.category,
          amount: d.amount,
          purpose: `Operational Fund ${req.code} — ${d.purpose}`,
          note: `Issued by CEO — awaiting Finance confirmation`,
          paymentMethod: account.method,
          paymentAccountId: account.paymentAccountId,
          pettyCashRequestId: req.id,
          recordedById: admin.id,
        },
      });
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "OPERATIONAL_FUND_ISSUED",
      entity: "PettyCashRequest",
      entityId: code,
      summary: `CEO issued ${formatCurrency(d.amount)} to the Operational Fund (${code}) — money-out booked; awaiting Finance's receipt confirmation.`,
    });
    revalidateFund();
    return ok({ code }, `${formatCurrency(d.amount)} issued — Finance will confirm receipt.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Finance confirms it received the funds — flips ISSUED → APPROVED, unlocking
 *  the spendable balance. The allocation expense was already booked at approval/
 *  issue, so nothing new is booked (except for legacy ISSUED rows created before
 *  debit-at-approval, which have no expense yet — booked here as a fallback). */
export async function confirmOperationalFundReceipt(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const req = await prisma.pettyCashRequest.findUnique({
      where: { id },
      include: {
        items: true,
        paymentAccount: { select: { type: true } },
        allocationExpenses: { select: { id: true } },
      },
    });
    if (!req) return fail("Funding record not found.");
    if (req.status !== "ISSUED")
      return fail("These funds were already confirmed or cancelled.");

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.pettyCashRequest.updateMany({
        where: { id, status: "ISSUED" },
        data: { status: "APPROVED" },
      });
      if (claimed.count === 0) throw new Error("These funds were already confirmed.");
      // Backward-compat only: a legacy ISSUED row (pre debit-at-approval) has no
      // allocation expense — book it now so money-out is recorded exactly once.
      if (req.allocationExpenses.length === 0) {
        const method = req.paymentAccount ? METHOD_LABEL[req.paymentAccount.type] ?? req.paymentAccount.type : null;
        for (const line of requestLines(req)) {
          await tx.expense.create({
            data: {
              code: refCode("EXP"),
              source: "OPERATIONAL_FUND",
              category: line.category,
              customCategory: line.customCategory,
              amount: line.amount,
              purpose: `Operational Fund ${req.code} — ${line.description}`,
              note: `Receipt confirmed by ${actor.name}`,
              paymentMethod: method,
              paymentAccountId: req.paymentAccountId,
              pettyCashRequestId: req.id,
              recordedById: actor.id,
            },
          });
        }
      }
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "OPERATIONAL_FUND_CONFIRMED",
      entity: "PettyCashRequest",
      entityId: req.code,
      summary: `${actor.name} confirmed receipt of ${formatCurrency(req.amount)} (${req.code}) — the fund is now spendable.`,
    });
    revalidateFund();
    return ok(undefined, `Receipt confirmed — ${formatCurrency(req.amount)} added to the fund.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** CEO recalls a not-yet-confirmed allocation (mistake / Finance didn't receive
 *  it). The money-out was booked at approval/issue, so this DELETES exactly the
 *  linked allocation expenses to return the funds to the account, then rejects. */
export async function cancelIssuedFund(id: string): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const req = await prisma.pettyCashRequest.findUnique({ where: { id } });
    if (!req) return fail("Funding record not found.");
    let amount = 0;
    await prisma.$transaction(async (tx) => {
      const cancelled = await tx.pettyCashRequest.updateMany({
        where: { id, status: "ISSUED" },
        data: { status: "REJECTED", adminNote: "Recalled by CEO before confirmation." },
      });
      if (cancelled.count === 0) throw new Error("These funds were already confirmed or cancelled.");
      // Reverse the money-out: delete exactly this request's allocation expenses.
      await tx.expense.deleteMany({ where: { pettyCashRequestId: id } });
      amount = req.amount;
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "OPERATIONAL_FUND_ISSUE_CANCELLED",
      entity: "PettyCashRequest",
      entityId: req.code,
      summary: `CEO recalled ${formatCurrency(amount)} (${req.code}) before confirmation — money-out reversed, funds returned to the account.`,
    });
    revalidateFund();
    return ok(undefined, "Allocation recalled — funds returned to the account.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Spending ────────────────────────────────────────────────────────────────

const spendSchema = z.object({
  amount: z.number().int().positive("Enter the amount spent.").max(1000000000),
  category: z.enum(EXPENSE_CATEGORY_VALUES).default("OFFICE"),
  description: z.string().trim().min(3, "What was this spent on?").max(300),
  vendor: z.string().max(160).optional().or(z.literal("")),
  expenseDate: z.string().optional().or(z.literal("")), // ISO date
  receiptRef: z.string().max(120).optional().or(z.literal("")),
  receiptUrl: z.string().max(15000000).optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
});

/** Finance records money spent from the Operational Fund — one Expense
 *  (source OPERATIONAL_FUND) that auto-reduces the balance. */
export async function recordOperationalExpense(
  input: z.infer<typeof spendSchema>,
): Promise<ActionResult<{ code: string }>> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const parsed = spendSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid expense.");
    const d = parsed.data;
    if (d.expenseDate && Number.isNaN(new Date(d.expenseDate).getTime()))
      return fail("The expense date is invalid.");

    const code = refCode("OS");
    let remaining = 0;
    await prisma.$transaction(async (tx) => {
      // Serialize every fund spend so two concurrent expenses can't each slip
      // under the balance and overspend the CEO's allocation.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('operational_fund'))`;
      const [funded, spent] = await Promise.all([
        tx.pettyCashRequest.aggregate({ _sum: { amount: true }, where: { status: "APPROVED" } }),
        tx.operationalSpend.aggregate({ _sum: { amount: true } }),
      ]);
      const balance = (funded._sum.amount ?? 0) - (spent._sum.amount ?? 0);
      // Can't spend money the fund doesn't have.
      if (d.amount > balance)
        throw new Error(
          `The Operational Fund only has ${formatCurrency(Math.max(0, balance))} left — request more funds before recording this.`,
        );
      remaining = balance - d.amount;
      // An accountability record — NOT a company Expense (the allocation was
      // already expensed at approval), so the P&L is never double-counted.
      await tx.operationalSpend.create({
        data: {
          code,
          category: d.category,
          amount: d.amount,
          description: d.description,
          note: [d.vendor?.trim() ? `Vendor: ${d.vendor.trim()}` : "", d.note?.trim() ?? ""].filter(Boolean).join(" · ") || null,
          receiptRef: d.receiptRef?.trim() || null,
          receiptUrl: d.receiptUrl?.trim() || null,
          expenseDate: d.expenseDate ? new Date(d.expenseDate) : new Date(),
          recordedById: actor.id,
        },
      });
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "OPERATIONAL_EXPENSE_RECORDED",
      entity: "Expense",
      entityId: code,
      summary: `${actor.name} spent ${formatCurrency(d.amount)} from the Operational Fund — ${d.description} (${EXPENSE_LABELS[d.category]})${d.vendor?.trim() ? ` · ${d.vendor.trim()}` : ""}.`,
    });
    revalidateFund();
    return ok({ code }, `Expense ${code} recorded — ${formatCurrency(remaining)} left in the fund.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Delete an operational-fund spending record (a correction) — returns that
 *  amount to the fund balance. Doesn't touch the P&L (spends aren't expenses). */
export async function removeOperationalExpense(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const spend = await prisma.operationalSpend.findUnique({ where: { id } });
    if (!spend) return fail("Spending record not found.");
    await prisma.operationalSpend.delete({ where: { id } });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "OPERATIONAL_EXPENSE_REMOVED",
      entity: "OperationalSpend",
      entityId: spend.code,
      summary: `${actor.name} removed operational spend ${spend.code} (${formatCurrency(spend.amount)} — ${spend.description}).`,
    });
    revalidateFund();
    return ok(undefined, `Spending record ${spend.code} removed — ${formatCurrency(spend.amount)} returned to the fund.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}
