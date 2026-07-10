import Link from "next/link";
import {
  CreditCard,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  ArrowDownToLine,
  CalendarClock,
  ShieldCheck,
  Banknote,
  ChevronRight,
} from "lucide-react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  SubmitSettlement,
  type SettlementAccount,
} from "@/components/dashboard/submit-settlement";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export default async function AgentCreditPage() {
  const session = await requireRole("PARTNER");
  const me = await prisma.user.findUnique({ where: { id: session.id } });
  if (!me) notFound();

  const [accounts, settlements, creditEvents] = await Promise.all([
    prisma.creditAccount.findMany({
      where: { agentId: me.id },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      include: {
        request: { select: { code: true, invoiceNo: true } },
        payments: { select: { amount: true, createdAt: true } },
      },
    }),
    prisma.settlementRequest.findMany({
      where: { partnerId: me.id },
      orderBy: { createdAt: "desc" },
      include: { creditAccount: { include: { request: { select: { code: true } } } } },
    }),
    prisma.partnerCreditEvent.findMany({
      where: { partnerId: me.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const openAccounts: SettlementAccount[] = accounts
    .filter((a) => a.status !== "SETTLED")
    .map((a) => ({
      id: a.id,
      code: a.request.code,
      remaining: Math.max(0, a.principal - a.amountPaid),
    }));

  // ── Aggregates ──
  const limit = me.creditLimit ?? 0;
  const totalIssued = accounts.reduce((s, a) => s + a.principal, 0);
  const totalRepaid = accounts.reduce((s, a) => s + a.amountPaid, 0);
  const outstanding = accounts.reduce(
    (s, a) => s + Math.max(0, a.principal - a.amountPaid),
    0,
  );
  const overdue = accounts
    .filter((a) => a.status === "OVERDUE")
    .reduce((s, a) => s + Math.max(0, a.principal - a.amountPaid), 0);
  const available = Math.max(0, limit - outstanding);
  const usedPct = limit > 0 ? Math.min(100, (outstanding / limit) * 100) : 0;
  const repaymentRate =
    totalIssued > 0 ? Math.round((totalRepaid / totalIssued) * 100) : 100;

  const now = new Date();
  const repaidThisMonth = accounts.reduce(
    (s, a) =>
      s +
      a.payments
        .filter(
          (p) =>
            p.createdAt.getMonth() === now.getMonth() &&
            p.createdAt.getFullYear() === now.getFullYear(),
        )
        .reduce((ps, p) => ps + p.amount, 0),
    0,
  );

  const active = accounts.filter((a) => a.status !== "SETTLED");
  const history = accounts.filter((a) => a.status === "SETTLED");
  const nextDue = active
    .filter((a) => a.dueDate)
    .sort((x, y) => x.dueDate!.getTime() - y.dueDate!.getTime())[0];

  const blocked = me.status === "SUSPENDED";
  const standing = blocked
    ? { label: "Blocked", tone: "destructive" as const }
    : overdue > 0
      ? { label: "Restricted", tone: "warning" as const }
      : active.length > 0
        ? { label: "Credit in use", tone: "info" as const }
        : { label: "Active", tone: "success" as const };
  const reliability =
    overdue > 0
      ? { label: "Needs attention", tone: "text-warning" }
      : outstanding > 0
        ? { label: "On track", tone: "text-info" }
        : { label: "Excellent", tone: "text-success" };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit & payments"
        description="Your revolving credit facility with ORA — every repayment restores your available credit instantly, and full on-time repayment grows your limit automatically."
      >
        <SubmitSettlement accounts={openAccounts} />
      </PageHeader>

      {/* Standing banner */}
      {(blocked || overdue > 0) && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/[0.06] p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              {blocked
                ? "Your account is blocked for new credit."
                : "New pay-later orders are paused until your overdue balance is cleared."}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {overdue > 0
                ? `Settle ${formatCurrency(overdue)} overdue to continue. The ORA team records every repayment.`
                : "Reach out to the ORA team to restore your account."}
            </p>
          </div>
        </div>
      )}

      {/* Standing card */}
      <Card>
        <CardContent className="grid gap-6 p-5 grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Credit standing
              </span>
              <Badge variant={standing.tone}>{standing.label}</Badge>
            </div>
            <p className="mt-2 font-display text-3xl font-semibold">
              {formatCurrency(outstanding)}{" "}
              <span className="text-base font-normal text-muted-foreground">
                outstanding of {formatCurrency(limit)}
              </span>
            </p>
            <Progress value={usedPct} className="mt-3" />
            <p className="mt-2 text-xs text-muted-foreground">
              {formatCurrency(available)} available · {Math.round(usedPct)}% of
              limit used
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <Insight
              icon={ArrowDownToLine}
              label="Repaid this month"
              value={formatCurrency(repaidThisMonth)}
            />
            <Insight
              icon={CalendarClock}
              label="Next due"
              value={nextDue?.dueDate ? formatDate(nextDue.dueDate) : "—"}
            />
            <Insight
              icon={ShieldCheck}
              label="Reliability"
              value={reliability.label}
              valueClass={reliability.tone}
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total credit issued"
          value={formatCurrency(totalIssued)}
          icon={CreditCard}
          accent="primary"
        />
        <StatCard
          label="Total repaid"
          value={formatCurrency(totalRepaid)}
          hint={`${repaymentRate}% of credit cleared`}
          icon={Banknote}
          accent="success"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(outstanding)}
          icon={Wallet}
          accent="warning"
        />
        <StatCard
          label="Overdue"
          value={formatCurrency(overdue)}
          hint={overdue > 0 ? "Action needed" : "Nothing overdue"}
          icon={AlertTriangle}
          accent={overdue > 0 ? "warning" : "info"}
        />
      </div>

      {/* Credit score & automatic growth */}
      <Card>
        <CardContent className="grid gap-5 p-5 grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent font-display text-2xl font-bold text-white">
              {me.creditScore}
            </span>
            <div>
              <p className="font-display font-semibold">Credit score</p>
              <p className="text-xs text-muted-foreground">
                {me.creditCycles} credit cycle{me.creditCycles === 1 ? "" : "s"} completed
              </p>
            </div>
          </div>
          <div className="border-t border-border pt-4 text-sm text-muted-foreground sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
            <p className="font-medium text-foreground">How your limit grows</p>
            <p className="mt-1">
              Repay your full outstanding balance on time and your credit limit
              automatically grows by <span className="font-semibold text-success">10%</span>{" "}
              — from {formatCurrency(limit)} to {formatCurrency(Math.round(limit * 1.1))} on
              your next completed cycle.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Facility history — limit changes & completed cycles */}
      {creditEvents.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Facility history</h2>
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {creditEvents.map((e) => (
                <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {e.type === "LIMIT_INCREASE"
                        ? "Limit increased automatically"
                        : e.type === "CYCLE_COMPLETED"
                          ? "Credit cycle completed"
                          : "Credit limit updated"}
                    </p>
                    {e.note && (
                      <p className="text-xs text-muted-foreground">{e.note}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {e.type !== "CYCLE_COMPLETED" &&
                      e.prevLimit != null &&
                      e.newLimit != null && (
                        <p className="text-sm font-semibold">
                          {formatCurrency(e.prevLimit)} →{" "}
                          <span className={e.newLimit >= e.prevLimit ? "text-success" : ""}>
                            {formatCurrency(e.newLimit)}
                          </span>
                        </p>
                      )}
                    <p className="text-xs text-muted-foreground">{formatDate(e.createdAt)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Active credit */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Active credit</h2>
        {active.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-5 text-sm">
              <CheckCircle2 className="size-5 text-success" />
              <div>
                <p className="font-medium">No active credit</p>
                <p className="text-muted-foreground">
                  You're all clear — you can request a new pay-later order any
                  time.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          active.map((a) => <CreditRow key={a.id} account={a} highlight />)
        )}
      </section>

      {/* History */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Credit history</h2>
        {history.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No past credit yet"
            description="Settled credit batches will be listed here for your records."
          />
        ) : (
          history.map((a) => <CreditRow key={a.id} account={a} />)
        )}
      </section>

      {/* Payment submissions */}
      {settlements.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Payment submissions</h2>
          <div className="space-y-2">
            {settlements.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{formatCurrency(s.amount)}</span>
                      <StatusBadge status={s.status} />
                      <span className="text-xs text-muted-foreground">
                        {s.creditAccount.request.code}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {s.method ?? "Payment"}
                      {s.reference ? ` · ${s.reference}` : ""} · {formatDateTime(s.createdAt)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {s.status === "PENDING"
                      ? "Awaiting ORA confirmation"
                      : s.status === "CONFIRMED"
                        ? "Confirmed & posted"
                        : "Not accepted"}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Submit a payment above when you pay down a balance — the ORA team
        confirms it and it posts to your ledger.
      </p>
    </div>
  );
}

function CreditRow({
  account: a,
  highlight = false,
}: {
  account: {
    id: string;
    principal: number;
    amountPaid: number;
    status: string;
    dueDate: Date | null;
    createdAt: Date;
    request: { code: string; invoiceNo: string | null };
  };
  highlight?: boolean;
}) {
  const left = Math.max(0, a.principal - a.amountPaid);
  const pct = a.principal > 0 ? (a.amountPaid / a.principal) * 100 : 0;
  const settled = a.status === "SETTLED";
  const isOverdue = a.status === "OVERDUE";

  return (
    <Link href={`/partner/credit/${a.id}`} className="block">
      <Card
        className={`transition hover:-translate-y-0.5 hover:shadow-glow ${
          highlight ? "border-primary/40" : ""
        } ${isOverdue ? "border-warning/40" : ""}`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display font-semibold">
                  {a.request.code}
                </span>
                <StatusBadge status={a.status} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Issued {formatDate(a.createdAt)}
                {a.dueDate
                  ? ` · ${settled ? "was due" : "due"} ${formatDate(a.dueDate)}`
                  : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-muted-foreground">
                {settled ? "Repaid" : "Remaining"}
              </p>
              <p
                className={`font-semibold ${isOverdue ? "text-warning" : ""}`}
              >
                {formatCurrency(settled ? a.principal : left)}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Progress value={pct} className="flex-1" />
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {formatCurrency(a.amountPaid)} / {formatCurrency(a.principal)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Insight({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <Icon className="size-4 text-muted-foreground" />
      <p className="mt-1.5 text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}
