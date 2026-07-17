import Link from "next/link";
import {
  Landmark,
  Smartphone,
  Banknote,
  ChevronRight,
  Wallet,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { FinanceNav } from "@/components/admin/finance-nav";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AddAccountButton,
  AccountActions,
} from "@/components/admin/payment-account-manager";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_META = {
  CASH: { label: "Cash accounts", icon: Banknote, accent: "text-success" },
  BANK: { label: "Bank accounts", icon: Landmark, accent: "text-info" },
  MOBILE_MONEY: { label: "Mobile money accounts", icon: Smartphone, accent: "text-primary" },
} as const;

/** Balances by receiving account — where ORA's money physically sits. */
export default async function FinanceAccountsPage() {
  await requireRole("ADMIN");

  const [accounts, cashSales, fieldPays, partnerPays, orderPays] = await Promise.all([
    prisma.paymentAccount.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.fieldSale.findMany({
      where: { voided: false, financeStatus: "APPROVED", type: "CASH", paymentAccountId: { not: null } },
      select: { paymentAccountId: true, total: true, createdAt: true },
    }),
    prisma.fieldPayment.findMany({
      where: { financeStatus: "APPROVED", paymentAccountId: { not: null }, sale: { voided: false } },
      select: { paymentAccountId: true, amount: true, createdAt: true },
    }),
    prisma.payment.findMany({
      where: { paymentAccountId: { not: null } },
      select: { paymentAccountId: true, amount: true, createdAt: true },
    }),
    // Paid orders: counter/walk-in sales and confirmed partner order payments.
    prisma.request.findMany({
      where: { paymentAccountId: { not: null }, paymentStatus: "PAID" },
      select: {
        paymentAccountId: true,
        totalAmount: true,
        paidAt: true,
        createdAt: true,
      },
    }),
  ]);

  // Bucket every receipt per account: all-time / today / this month / count.
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const stats = new Map<
    string,
    { total: number; today: number; month: number; count: number }
  >();
  const add = (accountId: string | null, amount: number, at: Date) => {
    if (!accountId) return;
    const s = stats.get(accountId) ?? { total: 0, today: 0, month: 0, count: 0 };
    s.total += amount;
    s.count += 1;
    if (at >= startToday) s.today += amount;
    if (at >= startMonth) s.month += amount;
    stats.set(accountId, s);
  };
  for (const r of cashSales) add(r.paymentAccountId, r.total, r.createdAt);
  for (const r of fieldPays) add(r.paymentAccountId, r.amount, r.createdAt);
  for (const r of partnerPays) add(r.paymentAccountId, r.amount, r.createdAt);
  for (const r of orderPays)
    add(r.paymentAccountId, r.totalAmount ?? 0, r.paidAt ?? r.createdAt);

  const grandTotal = [...stats.values()].reduce((s, x) => s + x.total, 0);
  const groups = (Object.keys(TYPE_META) as (keyof typeof TYPE_META)[]).map((t) => ({
    type: t,
    ...TYPE_META[t],
    accounts: accounts.filter((a) => a.type === t),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Where ORA money comes from and where it goes — live, categorised, traceable."
      >
        <FinanceNav />
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Receiving accounts</h2>
          <p className="text-sm text-muted-foreground">
            Every payment is traced to the exact account that received it —{" "}
            <span className="font-medium text-foreground">
              {formatCurrency(grandTotal)}
            </span>{" "}
            received across {accounts.length} account{accounts.length === 1 ? "" : "s"}.
          </p>
        </div>
        <AddAccountButton />
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No receiving accounts yet"
          description='Add your cash office, bank accounts and Lipa numbers — they appear instantly in every sale and payment form.'
        />
      ) : (
        groups.map(
          (g) =>
            g.accounts.length > 0 && (
              <section key={g.type} className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <g.icon className={`size-4 ${g.accent}`} />
                  {g.label}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {g.accounts.map((a) => {
                    const s = stats.get(a.id) ?? { total: 0, today: 0, month: 0, count: 0 };
                    return (
                      <Link
                        key={a.id}
                        href={`/admin/finance/accounts/${a.id}`}
                        className={`group rounded-2xl border bg-card p-4 shadow-soft transition-colors hover:border-primary/40 ${
                          a.isActive ? "border-border" : "border-border opacity-60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-display font-semibold">
                              <span className="truncate">{a.name}</span>
                              {!a.isActive && <Badge variant="secondary">inactive</Badge>}
                            </p>
                            {a.accountName && (
                              <p className="truncate text-xs text-muted-foreground">
                                {a.accountName}
                              </p>
                            )}
                            {a.accountNumber && (
                              <p className="text-xs text-muted-foreground">
                                {a.type === "MOBILE_MONEY" ? "Lipa" : "A/C"}:{" "}
                                <span className="font-medium text-foreground">
                                  {a.accountNumber}
                                </span>
                              </p>
                            )}
                          </div>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </div>
                        <p className="mt-3 font-display text-2xl font-bold">
                          {formatCurrency(s.total)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          received all-time · {formatNumber(s.count)} transaction{s.count === 1 ? "" : "s"}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-2.5 text-sm">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Today</p>
                            <p className="font-semibold">{formatCurrency(s.today)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">This month</p>
                            <p className="font-semibold">{formatCurrency(s.month)}</p>
                          </div>
                        </div>
                        <div className="mt-2.5 border-t border-border/60 pt-2">
                          <AccountActions account={a} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ),
        )
      )}
    </div>
  );
}
