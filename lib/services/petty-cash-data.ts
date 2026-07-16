import { prisma } from "@/lib/db";
import type {
  PettyCashDTO,
  PettyCashExpenseDTO,
} from "@/components/finance/petty-cash-manager";

/** Shared assembly for the finance and admin petty-cash pages. */
export async function getPettyCashData() {
  const [requests, receivingAccounts] = await Promise.all([
    prisma.pettyCashRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        requestedBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        expenses: {
          orderBy: { createdAt: "desc" },
          include: { recordedBy: { select: { name: true } } },
        },
      },
    }),
    prisma.paymentAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, accountName: true, accountNumber: true },
    }),
  ]);

  const dto: PettyCashDTO[] = requests.map((r) => {
    const expenses: PettyCashExpenseDTO[] = r.expenses.map((e) => ({
      id: e.id,
      description: e.description,
      amount: e.amount,
      receiptRef: e.receiptRef,
      recordedByName: e.recordedBy.name,
      createdAt: e.createdAt.toISOString(),
    }));
    const spent = expenses.reduce((s, e) => s + e.amount, 0);
    return {
      id: r.id,
      code: r.code,
      amount: r.amount,
      purpose: r.purpose,
      status: r.status,
      requestedByName: r.requestedBy.name,
      approvedByName: r.approvedBy?.name ?? null,
      approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
      adminNote: r.adminNote,
      reconciledAt: r.reconciledAt ? r.reconciledAt.toISOString() : null,
      reconcileNote: r.reconcileNote,
      createdAt: r.createdAt.toISOString(),
      spent,
      remaining: Math.max(0, r.amount - spent),
      expenses,
    };
  });

  return { requests: dto, receivingAccounts };
}
