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
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_ICON = { CASH: Banknote, BANK: Landmark, MOBILE_MONEY: Smartphone } as const;
const TYPE_LABEL = { CASH: "Cash", BANK: "Bank", MOBILE_MONEY: "Mobile Money" } as const;

/** Full audit trail of one receiving account — every shilling that landed. */
export default async function AccountLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("FINANCE");
  const { id } = await params;

  const account = await prisma.paymentAccount.findUnique({ where: { id } });
  if (!account) notFound();

  const [cashSales, fieldPays, partnerPays, orderPays] = await Promise.all([
    prisma.fieldSale.findMany({
      where: { paymentAccountId: id, voided: false, financeStatus: "APPROVED" },
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
  ]);

  type Row = {
    id: string;
    at: Date;
    kind: string;
    customer: string;
    rep: string | null;
    method: string | null;
    amount: number;
    reference: string | null;
    saleCode: string;
    recordedBy: string;
  };
  const rows: Row[] = [
    ...cashSales.map((s) => ({
      id: `fs-${s.id}`,
      at: s.createdAt,
      kind: "Cash sale",
      customer: s.customer?.name ?? s.customerName ?? "Walk-in",
      rep: s.rep.name,
      method: s.paymentMethod,
      amount: s.total,
      reference: s.reference,
      saleCode: s.code,
      recordedBy: s.rep.name,
    })),
    ...fieldPays.map((p) => ({
      id: `fp-${p.id}`,
      at: p.createdAt,
      kind: "Credit collection",
      customer: p.sale.customer?.name ?? p.sale.customerName ?? "—",
      rep: p.sale.rep.name,
      method: p.method,
      amount: p.amount,
      reference: p.reference,
      saleCode: p.sale.code,
      recordedBy: p.recordedBy.name,
    })),
    ...partnerPays.map((p) => ({
      id: `pp-${p.id}`,
      at: p.createdAt,
      kind: "Partner repayment",
      customer: p.creditAccount.agent.name,
      rep: null,
      method: p.method,
      amount: p.amount,
      reference: p.reference,
      saleCode: p.creditAccount.request.code,
      recordedBy: p.recordedBy.name,
    })),
    ...orderPays.map((r) => ({
      id: `op-${r.id}`,
      at: r.paidAt ?? r.createdAt,
      kind: r.requester.email === WALKIN_EMAIL ? "Counter sale" : "Order payment",
      customer:
        r.requester.email === WALKIN_EMAIL
          ? r.deliverTo?.trim() || "Walk-in customer"
          : r.requester.name,
      rep: null,
      method: r.paymentMethod,
      amount: r.totalAmount ?? 0,
      reference: r.paymentReference,
      saleCode:
        r.requester.email === WALKIN_EMAIL ? r.code.replace("REQ", "SALE") : r.code,
      recordedBy: r.reviewedBy?.name ?? "—",
    })),
  ].sort((a, b) => +b.at - +a.at);

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthIn = rows.filter((r) => r.at >= startMonth).reduce((s, r) => s + r.amount, 0);
  const Icon = TYPE_ICON[account.type];

  return (
    <div className="space-y-6">
      <Link
        href="/finance/accounts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All accounts
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-6" />
        </span>
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {account.name}
            {!account.isActive && <Badge variant="secondary">inactive</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {TYPE_LABEL[account.type]}
            {account.accountName ? ` · ${account.accountName}` : ""}
            {account.accountNumber
              ? ` · ${account.type === "MOBILE_MONEY" ? "Lipa" : "A/C"} ${account.accountNumber}`
              : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Received (all time)" value={formatCurrency(total)} accent="success" hint={`${formatNumber(rows.length)} transactions`} />
        <StatCard label="Received this month" value={formatCurrency(monthIn)} accent="primary" />
        <StatCard label="Received today" value={formatCurrency(rows.filter((r) => r.at >= new Date(now.getFullYear(), now.getMonth(), now.getDate())).reduce((s, r) => s + r.amount, 0))} accent="info" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="No transactions yet"
          description="Payments received into this account will appear here with the full trail."
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card">
          <Table wrapperClassName="table-stack">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Sales rep</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Related sale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell data-cardtitle className="text-sm">{formatDateTime(r.at)}</TableCell>
                  <TableCell data-label="Type" className="text-sm">{r.kind}</TableCell>
                  <TableCell data-label="Customer" className="text-sm font-medium">{r.customer}</TableCell>
                  <TableCell data-label="Sales rep" className="text-sm text-muted-foreground">{r.rep ?? "—"}</TableCell>
                  <TableCell data-label="Amount" className="text-right font-semibold text-success">
                    +{formatCurrency(r.amount)}
                  </TableCell>
                  <TableCell data-label="Reference" className="text-sm text-muted-foreground">{r.reference ?? "—"}</TableCell>
                  <TableCell data-label="Related sale" className="text-sm text-muted-foreground">
                    {r.saleCode} · by {r.recordedBy}
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
