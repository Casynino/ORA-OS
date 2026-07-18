import Link from "next/link";
import {
  Landmark,
  Smartphone,
  Banknote,
  ChevronRight,
  Wallet,
  Layers,
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
import { cn, formatCurrency, formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_META = {
  CASH: { label: "Cash accounts", short: "Cash", icon: Banknote, accent: "text-success", ring: "from-success/15", chip: "bg-success/10 text-success" },
  BANK: { label: "Bank accounts", short: "Bank", icon: Landmark, accent: "text-info", ring: "from-info/15", chip: "bg-info/10 text-info" },
  MOBILE_MONEY: { label: "Mobile money accounts", short: "Mobile money", icon: Smartphone, accent: "text-primary", ring: "from-primary/15", chip: "bg-primary/10 text-primary" },
} as const;

const EXPENSE_KIND: Record<string, string> = {
  DIRECT: "Expense",
  OPERATIONAL_FUND: "Fund allocation",
  PAYROLL: "Payroll",
};

type Move = { kind: string; amount: number; at: Date; out: boolean };

/** Company accounts as a true bank view — each account's balance = money in −
 *  money out, so allocations, withdrawals and expenses draw it down. */
export default async function FinanceAccountsPage() {
  await requireRole("ADMIN");

  const [accounts, cashSales, fieldPays, partnerPays, orderPays, capital, expenses] =
    await Promise.all([
      prisma.paymentAccount.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] }),
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
      prisma.request.findMany({
        where: { paymentAccountId: { not: null }, paymentStatus: "PAID" },
        select: { paymentAccountId: true, totalAmount: true, paidAt: true, createdAt: true },
      }),
      prisma.capitalEntry.findMany({
        where: { paymentAccountId: { not: null } },
        select: { paymentAccountId: true, amount: true, entryDate: true },
      }),
      prisma.expense.findMany({
        where: { paymentAccountId: { not: null } },
        select: { paymentAccountId: true, amount: true, expenseDate: true, source: true },
      }),
    ]);

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const stats = new Map<
    string,
    { in: number; out: number; today: number; month: number; count: number; lastAt: Date | null; recent: Move[] }
  >();
  const add = (accountId: string | null, amount: number, at: Date, kind: string, out: boolean) => {
    if (!accountId) return;
    const s = stats.get(accountId) ?? { in: 0, out: 0, today: 0, month: 0, count: 0, lastAt: null, recent: [] };
    const signed = out ? -amount : amount;
    if (out) s.out += amount; else s.in += amount;
    s.count += 1;
    if (at >= startToday) s.today += signed;
    if (at >= startMonth) s.month += signed;
    if (!s.lastAt || at > s.lastAt) s.lastAt = at;
    s.recent.push({ kind, amount, at, out });
    stats.set(accountId, s);
  };
  for (const r of cashSales) add(r.paymentAccountId, r.total, r.createdAt, "Cash sale", false);
  for (const r of fieldPays) add(r.paymentAccountId, r.amount, r.createdAt, "Credit collection", false);
  for (const r of partnerPays) add(r.paymentAccountId, r.amount, r.createdAt, "Partner repayment", false);
  for (const r of orderPays) add(r.paymentAccountId, r.totalAmount ?? 0, r.paidAt ?? r.createdAt, "Order payment", false);
  for (const r of capital) {
    const isOut = r.amount < 0;
    add(r.paymentAccountId, Math.abs(r.amount), r.entryDate, isOut ? "Withdrawal" : "Investment", isOut);
  }
  for (const r of expenses) add(r.paymentAccountId, r.amount, r.expenseDate, EXPENSE_KIND[r.source] ?? "Expense", true);

  const balanceOf = (id: string) => {
    const s = stats.get(id);
    return s ? s.in - s.out : 0;
  };
  const grandTotal = accounts.reduce((s, a) => s + balanceOf(a.id), 0);
  const typeTotal = (t: keyof typeof TYPE_META) =>
    accounts.filter((a) => a.type === t).reduce((s, a) => s + balanceOf(a.id), 0);

  const groups = (Object.keys(TYPE_META) as (keyof typeof TYPE_META)[]).map((t) => ({
    type: t,
    ...TYPE_META[t],
    accounts: accounts.filter((a) => a.type === t),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company accounts"
        description="A banking-style view of where ORA's money sits — each account's balance is money received into it minus money paid, withdrawn or allocated out of it."
      />
      <FinanceNav />

      {/* Money by location — live balances */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <LocationTile icon={Layers} accent="text-foreground" label="Total balance" value={grandTotal} hint={`across ${accounts.length} account${accounts.length === 1 ? "" : "s"}`} strong />
        <LocationTile icon={Banknote} accent="text-success" label="Cash" value={typeTotal("CASH")} />
        <LocationTile icon={Landmark} accent="text-info" label="Bank" value={typeTotal("BANK")} />
        <LocationTile icon={Smartphone} accent="text-primary" label="Mobile money" value={typeTotal("MOBILE_MONEY")} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Receiving accounts</h2>
        <AddAccountButton />
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No receiving accounts yet"
          description="Add your cash office, bank accounts and Lipa numbers — they appear instantly in every sale and payment form."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          {groups.map(
            (g) =>
              g.accounts.length > 0 && (
                <section key={g.type} className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <g.icon className={cn("size-4", g.accent)} />
                    {g.label}
                  </h3>
                  <div className="space-y-3">
                    {g.accounts.map((a) => {
                      const s = stats.get(a.id) ?? { in: 0, out: 0, today: 0, month: 0, count: 0, lastAt: null, recent: [] as Move[] };
                      const balance = s.in - s.out;
                      const recent = [...s.recent].sort((x, y) => +y.at - +x.at).slice(0, 2);
                      return (
                        <Link
                          key={a.id}
                          href={`/admin/finance/accounts/${a.id}`}
                          className={cn(
                            "group block overflow-hidden rounded-2xl border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40",
                            a.isActive ? "border-border" : "border-border opacity-60",
                          )}
                        >
                          {/* Card top — banking style */}
                          <div className={cn("relative bg-gradient-to-br to-transparent p-4", g.ring)}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="flex items-center gap-2 font-display font-semibold">
                                  <span className="truncate">{a.name}</span>
                                  {!a.isActive && <Badge variant="secondary">inactive</Badge>}
                                </p>
                                {a.accountName && <p className="truncate text-xs text-muted-foreground">{a.accountName}</p>}
                                {a.accountNumber && (
                                  <p className="mt-0.5 font-mono text-xs tracking-wider text-muted-foreground">
                                    {a.type === "MOBILE_MONEY" ? "Lipa" : "A/C"} ···· {a.accountNumber.slice(-4)}
                                  </p>
                                )}
                              </div>
                              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                            </div>
                            <p className={cn("mt-3 font-display text-2xl font-bold", balance < 0 && "text-destructive")}>
                              {formatCurrency(balance)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              balance · in {formatCurrency(s.in)} · out {formatCurrency(s.out)}
                              {s.lastAt ? ` · last ${timeAgo(s.lastAt)}` : ""}
                            </p>
                          </div>

                          <div className="px-4 pb-3">
                            <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-2.5 text-sm">
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Net today</p>
                                <p className={cn("font-semibold", s.today < 0 && "text-destructive")}>{formatCurrency(s.today)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Net this month</p>
                                <p className={cn("font-semibold", s.month < 0 && "text-destructive")}>{formatCurrency(s.month)}</p>
                              </div>
                            </div>
                            {recent.length > 0 && (
                              <div className="mt-2.5 space-y-1 border-t border-border/60 pt-2">
                                {recent.map((r, i) => (
                                  <div key={i} className="flex items-center justify-between gap-2 text-xs">
                                    <span className="min-w-0 truncate text-muted-foreground">{r.kind} · {timeAgo(r.at)}</span>
                                    <span className={cn("shrink-0 font-medium", r.out ? "text-destructive" : "text-success")}>
                                      {r.out ? "−" : "+"}{formatCurrency(r.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="mt-2.5 border-t border-border/60 pt-2">
                              <AccountActions account={a} />
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ),
          )}
        </div>
      )}
    </div>
  );
}

function LocationTile({
  icon: Icon,
  accent,
  label,
  value,
  hint,
  strong,
}: {
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  label: string;
  value: number;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-soft", strong ? "border-primary/30" : "border-border")}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={cn("size-4 shrink-0", accent)} />
      </div>
      <p className={cn("mt-2 font-display text-xl font-bold tracking-tight sm:text-2xl", value < 0 && "text-destructive")}>{formatCurrency(value)}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
