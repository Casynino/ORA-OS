import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import {
  EXPENSE_GROUPS,
  EXPENSE_LABELS,
  periodStart,
  type Period,
} from "@/lib/services/finance";
import { PageHeader } from "@/components/ui/page-header";
import { FinanceNav, PeriodTabs } from "@/components/admin/finance-nav";
import { AddExpenseButton, DeleteExpenseButton } from "@/components/admin/finance-forms";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Receipt } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireRole("ADMIN");
  const { period: raw = "month" } = await searchParams;
  const period = (["today", "week", "month", "all"].includes(raw) ? raw : "month") as Period;
  const start = periodStart(period);

  const expenses = await prisma.expense.findMany({
    where: start ? { expenseDate: { gte: start } } : {},
    orderBy: { expenseDate: "desc" },
    take: 200,
    include: { recordedBy: { select: { name: true } } },
  });

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byGroup = EXPENSE_GROUPS.map((g) => ({
    label: g.label,
    amount: expenses
      .filter((e) => (g.categories as string[]).includes(e.category))
      .reduce((s, e) => s + e.amount, 0),
  })).filter((g) => g.amount > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Every shilling ORA spends — categorised, dated and tied to who approved it."
      >
        <FinanceNav />
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodTabs period={period} basePath="/admin/finance/expenses" />
        <AddExpenseButton />
      </div>

      {/* Totals */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-border bg-card p-4 text-sm shadow-soft">
        <span>
          Total: <span className="font-display text-lg font-bold">{formatCurrency(total)}</span>
        </span>
        {byGroup.map((g) => (
          <span key={g.label} className="text-muted-foreground">
            {g.label}: <span className="font-semibold text-foreground">{formatCurrency(g.amount)}</span>
          </span>
        ))}
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          className="rounded-2xl border border-dashed border-border py-14"
          icon={Receipt}
          title="No expenses in this period"
          description="Record rent, salaries, transport, stock purchases — so profit reflects reality."
        />
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">{e.purpose}</p>
                  <Badge variant="secondary">{EXPENSE_LABELS[e.category]}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {e.code} · {formatDate(e.expenseDate)}
                  {e.paymentMethod ? ` · ${e.paymentMethod}` : ""} · by {e.recordedBy.name}
                  {e.note ? ` · ${e.note}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-sm font-bold text-destructive">
                  −{formatCurrency(e.amount)}
                </span>
                <DeleteExpenseButton id={e.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
