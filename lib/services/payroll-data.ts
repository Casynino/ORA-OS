import { prisma } from "@/lib/db";
import type {
  EmployeeDTO,
  PayrollRunDTO,
} from "@/components/finance/payroll-manager";

/** Shared assembly for the finance and admin payroll pages. */
export async function getPayrollData() {
  const [employees, runs, receivingAccounts] = await Promise.all([
    prisma.employee.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    prisma.payrollRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 24,
      include: {
        items: true,
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
    }),
    prisma.paymentAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, accountName: true, accountNumber: true },
    }),
  ]);

  const employeeDto: EmployeeDTO[] = employees.map((e) => ({
    id: e.id,
    name: e.name,
    position: e.position,
    phone: e.phone,
    baseSalary: e.baseSalary,
    isActive: e.isActive,
  }));

  const runDto: PayrollRunDTO[] = runs.map((r) => ({
    id: r.id,
    code: r.code,
    month: r.month,
    year: r.year,
    status: r.status,
    createdByName: r.createdBy.name,
    approvedByName: r.approvedBy?.name ?? null,
    paidAt: r.paidAt ? r.paidAt.toISOString() : null,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    items: r.items.map((i) => ({
      id: i.id,
      name: i.name,
      gross: i.gross,
      allowance: i.allowance,
      deduction: i.deduction,
      net: i.net,
    })),
  }));

  return { employees: employeeDto, runs: runDto, receivingAccounts };
}
