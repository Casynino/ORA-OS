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
//  Payroll: finance keeps the employee register and builds monthly runs;
//  admin approves; finance pays — paying creates a SALARIES Expense so
//  payroll flows into every financial report automatically.
// ─────────────────────────────────────────────────────────────────────────────

function revalidatePayroll() {
  for (const p of ["/finance", "/finance/payroll", "/admin", "/admin/finance", "/admin/finance/payroll", "/admin/finance/expenses", "/finance/expenses", "/finance/reports"])
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
    const actor = await requireActor(["FINANCE", "ADMIN"]);
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
    await requireActor(["FINANCE", "ADMIN"]);
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

// ── Payroll runs ─────────────────────────────────────────────────────────────

const runSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2024).max(2100),
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

/** Finance builds a run and submits it straight to admin for approval. */
export async function createPayrollRun(
  input: z.infer<typeof runSchema>,
): Promise<ActionResult<{ code: string }>> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const parsed = runSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid payroll run.");
    }
    const d = parsed.data;

    const existing = await prisma.payrollRun.findFirst({
      where: {
        month: d.month,
        year: d.year,
        status: { in: ["PENDING_APPROVAL", "APPROVED", "PAID"] },
      },
    });
    if (existing) {
      return fail(
        existing.status === "PAID"
          ? `Salaries for ${d.month}/${d.year} were already paid (${existing.code}). Record any top-up as an Allowances expense instead.`
          : `A payroll run for ${d.month}/${d.year} is already awaiting approval or payment (${existing.code}).`,
      );
    }

    const employees = await prisma.employee.findMany({
      where: { id: { in: d.lines.map((l) => l.employeeId) } },
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
    if (items.length === 0) return fail("No valid employees on this run.");
    const total = items.reduce((s, i) => s + i.net, 0);

    const run = await prisma.payrollRun.create({
      data: {
        code: refCode("PAY"),
        month: d.month,
        year: d.year,
        status: "PENDING_APPROVAL",
        createdById: actor.id,
        note: d.note?.trim() || null,
        items: { create: items },
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "PAYROLL_SUBMITTED",
      entity: "PayrollRun",
      entityId: run.id,
      summary: `Payroll ${run.code} (${d.month}/${d.year}) submitted — ${items.length} employee${items.length === 1 ? "" : "s"}, ${formatCurrency(total)} net. Awaiting admin approval.`,
    });
    revalidatePayroll();
    return ok({ code: run.code }, `${run.code} submitted for admin approval.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Admin approves a run — finance can then pay it out. */
export async function approvePayrollRun(id: string): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const run = await prisma.payrollRun.findUnique({
      where: { id },
      include: { items: { select: { net: true } } },
    });
    if (!run) return fail("Payroll run not found.");
    const approved = await prisma.payrollRun.updateMany({
      where: { id, status: "PENDING_APPROVAL" },
      data: { status: "APPROVED", approvedById: admin.id, approvedAt: new Date() },
    });
    if (approved.count === 0) return fail("This run was already reviewed.");
    const total = run.items.reduce((s, i) => s + i.net, 0);
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "PAYROLL_APPROVED",
      entity: "PayrollRun",
      entityId: run.id,
      summary: `Payroll ${run.code} approved — ${formatCurrency(total)} ready to pay.`,
    });
    revalidatePayroll();
    return ok(undefined, `${run.code} approved — finance can now pay it.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function rejectPayrollRun(
  id: string,
  note?: string,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run) return fail("Payroll run not found.");
    const rejected = await prisma.payrollRun.updateMany({
      where: { id, status: "PENDING_APPROVAL" },
      data: {
        status: "REJECTED",
        approvedById: admin.id,
        approvedAt: new Date(),
        note: note?.trim() || run.note,
      },
    });
    if (rejected.count === 0) return fail("This run was already reviewed.");
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "PAYROLL_REJECTED",
      entity: "PayrollRun",
      entityId: run.id,
      summary: `Payroll ${run.code} rejected.`,
    });
    revalidatePayroll();
    return ok(undefined, "Payroll run rejected — finance can rebuild it.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Finance pays an approved run — records the SALARIES expense from the
 * chosen company account and locks the run as PAID. */
export async function payPayrollRun(
  id: string,
  paymentAccountId?: string,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const run = await prisma.payrollRun.findUnique({
      where: { id },
      include: { items: { select: { net: true } } },
    });
    if (!run) return fail("Payroll run not found.");
    const total = run.items.reduce((s, i) => s + i.net, 0);

    await prisma.$transaction(async (tx) => {
      // Atomic claim — a double click can't pay salaries twice.
      const paid = await tx.payrollRun.updateMany({
        where: { id, status: "APPROVED" },
        data: { status: "PAID", paidAt: new Date() },
      });
      if (paid.count === 0) {
        throw new Error("Only an admin-approved run can be paid (and only once).");
      }
      const receiving = await resolveReceivingAccount(
        tx,
        paymentAccountId || null,
        "Bank Transfer",
      );
      if (receiving.paymentAccountId) {
        await tx.payrollRun.update({
          where: { id },
          data: { paymentAccountId: receiving.paymentAccountId },
        });
      }
      await tx.expense.create({
        data: {
          code: refCode("EXP"),
          category: "SALARIES",
          amount: total,
          purpose: `Payroll ${run.code} — ${run.month}/${run.year}`,
          paymentMethod: receiving.method,
          recordedById: actor.id,
        },
      });
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "PAYROLL_PAID",
      entity: "PayrollRun",
      entityId: run.id,
      summary: `Payroll ${run.code} paid — ${formatCurrency(total)} in salaries.`,
    });
    revalidatePayroll();
    return ok(undefined, `${run.code} paid — ${formatCurrency(total)} recorded as salaries.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}
