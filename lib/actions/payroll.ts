"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { resolveReceivingAccount } from "@/lib/payment-methods";
import { refCode, formatCurrency } from "@/lib/utils";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
//  Payroll is CEO-owned: the boss keeps the employee register and pays salaries
//  in one action on a chosen date. Paying books a SALARIES Expense so payroll
//  flows into every financial report and the cash figures automatically.
// ─────────────────────────────────────────────────────────────────────────────

function revalidatePayroll() {
  for (const p of ["/admin", "/admin/finance", "/admin/finance/payroll", "/admin/finance/ledger", "/finance", "/finance/reports"])
    revalidatePath(p);
}

// ── Employee register ────────────────────────────────────────────────────────

const employeeSchema = z.object({
  name: z.string().min(2, "Employee name is required.").max(120),
  position: z.string().max(120).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  baseSalary: z.number().int().nonnegative().max(1000000000),
  note: z.string().max(300).optional().or(z.literal("")),
});

export async function createEmployee(
  input: z.infer<typeof employeeSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const parsed = employeeSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid employee.");
    }
    const d = parsed.data;
    const emp = await prisma.employee.create({
      data: {
        name: d.name.trim(),
        position: d.position?.trim() || null,
        phone: d.phone?.trim() || null,
        baseSalary: d.baseSalary,
        note: d.note?.trim() || null,
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "EMPLOYEE_ADDED",
      entity: "Employee",
      entityId: emp.id,
      summary: `${emp.name} added to payroll${emp.position ? ` (${emp.position})` : ""}.`,
    });
    revalidatePayroll();
    return ok(undefined, `${emp.name} added to payroll.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const employeeUpdateSchema = employeeSchema.partial().extend({
  employeeId: z.string().min(1),
  isActive: z.boolean().optional(),
});

export async function updateEmployee(
  input: z.infer<typeof employeeUpdateSchema>,
): Promise<ActionResult> {
  try {
    await requireActor(["ADMIN"]);
    const parsed = employeeUpdateSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid update.");
    const { employeeId, ...rest } = parsed.data;
    const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) return fail("Employee not found.");
    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        name: rest.name?.trim() || emp.name,
        position: rest.position !== undefined ? rest.position.trim() || null : emp.position,
        phone: rest.phone !== undefined ? rest.phone.trim() || null : emp.phone,
        baseSalary: rest.baseSalary ?? emp.baseSalary,
        note: rest.note !== undefined ? rest.note.trim() || null : emp.note,
        isActive: rest.isActive ?? emp.isActive,
      },
    });
    revalidatePayroll();
    return ok(undefined, "Employee updated.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Run & pay payroll (one CEO action) ───────────────────────────────────────

const runSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2024).max(2100),
  payDate: z.string().min(1, "Pick the pay date."), // ISO date the boss pays
  paymentAccountId: z.string().optional().or(z.literal("")),
  lines: z
    .array(
      z.object({
        employeeId: z.string().min(1),
        gross: z.number().int().nonnegative().max(1000000000),
        allowance: z.number().int().nonnegative().max(1000000000).default(0),
        deduction: z.number().int().nonnegative().max(1000000000).default(0),
      }),
    )
    .min(1, "Add at least one employee."),
  note: z.string().max(300).optional().or(z.literal("")),
});

/** The boss runs payroll in ONE action: picks the pay date + account, pays all
 * the listed employees at once, and it's immediately recorded as a SALARIES
 * company expense on that date (money out of the company). */
export async function runPayroll(
  input: z.infer<typeof runSchema>,
): Promise<ActionResult<{ code: string }>> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = runSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payroll.");
    }
    const d = parsed.data;
    const payDate = new Date(d.payDate);
    if (Number.isNaN(payDate.getTime())) return fail("The pay date is invalid.");

    // Only people actually on the active payroll can be paid — the register is
    // the source of truth, never the amounts the browser happened to send.
    const employees = await prisma.employee.findMany({
      where: { id: { in: d.lines.map((l) => l.employeeId) }, isActive: true },
      select: { id: true, name: true },
    });
    const nameById = new Map(employees.map((e) => [e.id, e.name]));
    const items = d.lines
      .filter((l) => nameById.has(l.employeeId))
      .map((l) => ({
        employeeId: l.employeeId,
        name: nameById.get(l.employeeId)!,
        gross: l.gross,
        allowance: l.allowance,
        deduction: l.deduction,
        net: Math.max(0, l.gross + l.allowance - l.deduction),
      }));
    if (items.length === 0) return fail("No active employees on this run.");
    const total = items.reduce((s, i) => s + i.net, 0);
    if (total <= 0) return fail("The total pay must be greater than zero.");
    // Expense.amount is a 32-bit int; keep the whole run inside that ceiling.
    if (total > 2000000000)
      return fail("That total is too large to record in a single payroll run.");

    const code = refCode("PAY");
    await prisma.$transaction(async (tx) => {
      // Serialize payroll so the same month can't be paid twice concurrently.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll-${d.year}-${d.month}`}))`;
      const already = await tx.payrollRun.findFirst({
        where: { month: d.month, year: d.year, status: "PAID" },
        select: { code: true },
      });
      if (already)
        throw new Error(
          `Salaries for ${d.month}/${d.year} were already paid (${already.code}). Record any top-up as an Allowances expense instead.`,
        );

      const receiving = await resolveReceivingAccount(tx, d.paymentAccountId || null, "Bank Transfer");
      await tx.payrollRun.create({
        data: {
          code,
          month: d.month,
          year: d.year,
          status: "PAID",
          createdById: admin.id,
          approvedById: admin.id,
          approvedAt: new Date(),
          paidAt: payDate,
          paymentAccountId: receiving.paymentAccountId,
          note: d.note?.trim() || null,
          items: { create: items },
        },
      });
      // Booked as a company expense on the pay date — money leaves the company.
      await tx.expense.create({
        data: {
          code: refCode("EXP"),
          category: "SALARIES",
          amount: total,
          purpose: `Payroll ${code} — ${d.month}/${d.year}`,
          paymentMethod: receiving.method,
          paymentAccountId: receiving.paymentAccountId,
          source: "PAYROLL",
          expenseDate: payDate,
          recordedById: admin.id,
        },
      });
    });

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "PAYROLL_PAID",
      entity: "PayrollRun",
      entityId: code,
      summary: `${admin.name} paid payroll ${code} (${d.month}/${d.year}) — ${formatCurrency(total)} to ${items.length} employee${items.length === 1 ? "" : "s"}, recorded as a salaries expense.`,
    });
    revalidatePayroll();
    return ok({ code }, `Payroll ${code} paid — ${formatCurrency(total)} recorded as salaries.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}
