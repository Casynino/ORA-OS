import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Landmark, Smartphone, Banknote } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { WALKIN_EMAIL } from "@/lib/constants";
import { cn, formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_ICON = { CASH: Banknote, BANK: Landmark, MOBILE_MONEY: Smartphone } as const;
const TYPE_LABEL = { CASH: "Cash", BANK: "Bank", MOBILE_MONEY: "Mobile Money" } as const;
const EXPENSE_KIND: Record<string, string> = {
  DIRECT: "Expense",
  OPERATIONAL_FUND: "Fund allocation",
  PAYROLL: "Payroll",
};

/** Full audit trail of one account — every shilling in AND out, netting to a
 *  true bank balance. */
export default async function AccountLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;

  const account = await prisma.paymentAccount.findUnique({ where: { id } });
  if (!account) notFound();

  const [cashSales, fieldPays, partnerPays, orderPays, capital, expenses] = await Promise.all([
    prisma.fieldSale.findMany({
      // type CASH mirrors the list page + accounts service so all three balance
      // computations stay byte-for-byte aligned (credit field sales are never
      // account-tagged today, but this keeps them out if that ever changes).
      where: { paymentAccountId: id, voided: false, financeStatus: "APPROVED", type: "CASH" },
      include: {
        rep: { select: { name: true } },
        customer: { select: { name: true } },
      },
    }),
    prisma.fieldPayment.findMany({
      where: { paymentAccountId: id, financeStatus: "APPROVED", sale: { voided: false } },
      include: {
        recordedBy: { select: { name: true } },
        sale: {
          select: {
            code: true,
            rep: { select: { name: true } },
            customer: { select: { name: true } },
            customerName: true,
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: { paymentAccountId: id },
      include: {
        recordedBy: { select: { name: true } },
        creditAccount: {
          select: {
            request: { select: { code: true } },
            agent: { select: { name: true } },
          },
        },
      },
    }),
    // Paid orders: counter/walk-in sales and confirmed partner order payments.
    prisma.request.findMany({
      where: { paymentAccountId: id, paymentStatus: "PAID" },
      include: {
        requester: { select: { name: true, email: true } },
        reviewedBy: { select: { name: true } },
      },
    }),
    // Money out / capital in — attributed to this account.
    prisma.capitalEntry.findMany({
      where: { paymentAccountId: id },
      include: { recordedBy: { select: { name: true } } },
    }),
    prisma.expense.findMany({
      where: { paymentAccountId: id },
      include: { recordedBy: { select: { name: true } } },
    }),
  ]);

  type Row = {
    id: string;
    at: Date;
    kind: string;
    detail: string;
    rep: string | null;
    method: string | null;
    amount: number;
    out: boolean;
    reference: string | null;
    ref: string;
    recordedBy: string;
  };
  const rows: Row[] = [
    ...cashSales.map((s) => ({
      id: `fs-${s.id}`,
      at: s.createdAt,
      kind: "Cash sale",
      detail: s.customer?.name ?? s.customerName ?? "Walk-in",
      rep: s.rep.name,
      method: s.paymentMethod,
      amount: s.total,
      out: false,
      reference: s.reference,
      ref: s.code,
      recordedBy: s.rep.name,
    })),
    ...fieldPays.map((p) => ({
      id: `fp-${p.id}`,
      at: p.createdAt,
      kind: "Credit collection",
      detail: p.sale.customer?.name ?? p.sale.customerName ?? "—",
      rep: p.sale.rep.name,
      method: p.method,
      amount: p.amount,
      out: false,
      reference: p.reference,
      ref: p.sale.code,
      recordedBy: p.recordedBy.name,
    })),
    ...partnerPays.map((p) => ({
      id: `pp-${p.id}`,
      at: p.createdAt,
      kind: "Partner repayment",
      detail: p.creditAccount.agent.name,
      rep: null,
      method: p.method,
      amount: p.amount,
      out: false,
      reference: p.reference,
      ref: p.creditAccount.request.code,
      recordedBy: p.recordedBy.name,
    })),
    ...orderPays.map((r) => ({
      id: `op-${r.id}`,
      at: r.paidAt ?? r.createdAt,
      kind: r.requester.email === WALKIN_EMAIL ? "Counter sale" : "Order payment",
      detail:
        r.requester.email === WALKIN_EMAIL
          ? r.deliverTo?.trim() || "Walk-in customer"
          : r.requester.name,
      rep: null,
      method: r.paymentMethod,
      amount: r.totalAmount ?? 0,
      out: false,
      reference: r.paymentReference,
      ref: r.requester.email === WALKIN_EMAIL ? r.code.replace("REQ", "SALE") : r.code,
      recordedBy: r.reviewedBy?.name ?? "—",
    })),
    ...capital.map((c) => {
      const out = c.amount < 0;
      return {
        id: `cap-${c.id}`,
        at: c.entryDate,
        kind: out ? "Withdrawal" : "Investment",
        detail: c.source,
        rep: null,
        method: null,
        amount: Math.abs(c.amount),
        out,
        reference: null,
        ref: c.code,
        recordedBy: c.recordedBy.name,
      };
    }),
    ...expenses.map((e) => ({
      id: `exp-${e.id}`,
      at: e.expenseDate,
      kind: EXPENSE_KIND[e.source] ?? "Expense",
      detail: e.vendor?.trim() || e.purpose,
      rep: null,
      method: e.paymentMethod,
      amount: e.amount,
      out: true,
      reference: e.receiptRef,
      ref: e.code,
      recordedBy: e.recordedBy.name,
    })),
  ].sort((a, b) => +b.at - +a.at);

  const inTotal = rows.filter((r) => !r.out).reduce((s, r) => s + r.amount, 0);
  const outTotal = rows.filter((r) => r.out).reduce((s, r) => s + r.amount, 0);
  const balance = inTotal - outTotal;
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthNet = rows
    .filter((r) => r.at >= startMonth)
    .reduce((s, r) => s + (r.out ? -r.amount : r.amount), 0);
  const Icon = TYPE_ICON[account.type];

  return (
    <div className="space-y-6">
      <Link
        href="/admin/finance/accounts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All accounts
      </Link>

      {/* Banking-style account card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-accent to-primary p-5 text-white shadow-glow sm:p-6">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="pointer-events-none absolute -right-10 -top-14 size-44 rounded-full bg-white/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">
              <Icon className="size-3.5" /> {TYPE_LABEL[account.type]}
            </span>
            <h1 className="mt-2 flex flex-wrap items-center gap-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {account.name}
              {!account.isActive && <Badge variant="secondary">inactive</Badge>}
            </h1>
            {account.accountName && <p className="text-sm text-white/80">{account.accountName}</p>}
            {account.accountNumber && (
              <p className="mt-1 font-mono text-sm tracking-[0.2em] text-white/90">
                {account.type === "MOBILE_MONEY" ? "LIPA" : "A/C"} ···· ···· {account.accountNumber.slice(-4)}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Balance</p>
            <p className="font-display text-3xl font-extrabold tracking-tight">{formatCurrency(balance)}</p>
            <p className="text-xs text-white/70">in {formatCurrency(inTotal)} · out {formatCurrency(outTotal)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Balance" value={formatCurrency(balance)} accent={balance < 0 ? "warning" : "success"} hint={`${formatNumber(rows.length)} movements`} />
        <StatCard label="Received (all time)" value={formatCurrency(inTotal)} accent="primary" />
        <StatCard label="Paid / withdrawn (all time)" value={formatCurrency(outTotal)} accent="warning" hint={`net this month ${formatCurrency(monthNet)}`} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="No movements yet"
          description="Money received into and paid out of this account will appear here with the full trail."
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card">
          <Table wrapperClassName="table-stack">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Sales rep</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Related</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell data-cardtitle className="text-sm">{formatDateTime(r.at)}</TableCell>
                  <TableCell data-label="Type"><Badge variant={r.out ? "warning" : "secondary"} className="text-[11px]">{r.kind}</Badge></TableCell>
                  <TableCell data-label="Detail" className="text-sm font-medium">{r.detail}</TableCell>
                  <TableCell data-label="Sales rep" className="text-sm text-muted-foreground">{r.rep ?? "—"}</TableCell>
                  <TableCell data-label="Amount" className={cn("text-right font-semibold", r.out ? "text-destructive" : "text-success")}>
                    {r.out ? "−" : "+"}{formatCurrency(r.amount)}
                  </TableCell>
                  <TableCell data-label="Reference" className="text-sm text-muted-foreground">{r.reference ?? "—"}</TableCell>
                  <TableCell data-label="Related" className="text-sm text-muted-foreground">
                    {r.ref} · by {r.recordedBy}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
