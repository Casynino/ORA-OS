"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Wallet,
  AlertTriangle,
  Banknote,
  Layers,
  Users,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Search,
  Bell,
  Flag,
  XCircle,
  CalendarClock,
  PackageCheck,
  Plus,
  Clock,
  ExternalLink,
} from "lucide-react";
import {
  recordPayment,
  markOverdue,
  closeCredit,
  sendCreditReminder,
  editCreditTerms,
} from "@/lib/actions/credit";
import { confirmSettlement, rejectSettlement } from "@/lib/actions/settlements";
import { Check } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActionButton } from "@/components/dashboard/action-button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export type CreditAccountDTO = {
  id: string;
  code: string;
  invoiceNo: string | null;
  partnerName: string;
  partnerType: string | null;
  partnerOrg: string | null;
  principal: number;
  amountPaid: number;
  status: string;
  createdAt: string;
  dueDate: string | null;
  lastPaymentDate: string | null;
  warehouse: string | null;
  issuedAt: string | null;
  deliveredAt: string | null;
  deliveryStatus: string;
  items: {
    name: string;
    size: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  payments: {
    id: string;
    amount: number;
    method: string | null;
    note: string | null;
    recordedBy: string;
    createdAt: string;
    balanceAfter: number;
  }[];
};

export type SettlementDTO = {
  id: string;
  code: string;
  accountId: string;
  partner: string;
  batchCode: string;
  amount: number;
  method: string | null;
  reference: string | null;
  status: string;
  createdAt: string;
};

/** A rep-recorded credit sale — an official ORA credit record. */
export type FieldCreditDTO = {
  id: string;
  code: string;
  repId: string;
  repName: string;
  customerId: string | null;
  customerName: string;
  customerBusiness: string | null;
  customerLocation: string | null;
  customerPhone: string | null;
  total: number;
  amountPaid: number;
  status: string; // PENDING | PARTIAL | OVERDUE | PAID
  createdAt: string;
  dueDate: string | null;
  items: { name: string; quantity: number; unitPrice: number }[];
  payments: {
    amount: number;
    method: string | null;
    recordedBy: string;
    createdAt: string;
  }[];
};

const DAY = 24 * 60 * 60 * 1000;
const HIGH_VALUE = 50000;

function daysOverdue(a: CreditAccountDTO): number {
  if (a.status === "SETTLED" || !a.dueDate) return 0;
  const d = Math.floor((Date.now() - new Date(a.dueDate).getTime()) / DAY);
  return d > 0 ? d : 0;
}
function riskOf(a: CreditAccountDTO): "High" | "Medium" | "Low" {
  const d = daysOverdue(a);
  const remaining = a.principal - a.amountPaid;
  if (d > 30 || remaining > 80000) return "High";
  if (d > 7) return "Medium";
  return "Low";
}

const fieldOwing = (f: FieldCreditDTO) => Math.max(0, f.total - f.amountPaid);
const fieldOpen = (f: FieldCreditDTO) =>
  f.status !== "PAID" && fieldOwing(f) > 0;

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getDate() === n.getDate() &&
    d.getMonth() === n.getMonth() &&
    d.getFullYear() === n.getFullYear()
  );
}

export function CreditLedger({
  accounts,
  settlements = [],
  fieldCredits = [],
}: {
  accounts: CreditAccountDTO[];
  settlements?: SettlementDTO[];
  fieldCredits?: FieldCreditDTO[];
}) {
  const router = useRouter();
  const pendingSettlements = settlements.filter((s) => s.status === "PENDING").length;
  const [tab, setTab] = useState<"CREDITS" | "FIELD" | "SETTLEMENTS" | "OVERDUE">(
    "CREDITS",
  );
  const [payTarget, setPayTarget] = useState<CreditAccountDTO | null>(null);
  const [termsTarget, setTermsTarget] = useState<CreditAccountDTO | null>(null);

  // KPIs — the whole company's credit: partner batches AND rep-customer sales.
  const kpi = useMemo(() => {
    const now = new Date();
    const inMonth = (iso: string) => {
      const d = new Date(iso);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    };
    const open = accounts.filter((a) => a.status !== "SETTLED");
    const overdue = accounts.filter((a) => a.status === "OVERDUE");
    const partnerRepaidMo = accounts.reduce(
      (s, a) => s + a.payments.filter((p) => inMonth(p.createdAt)).reduce((ps, p) => ps + p.amount, 0),
      0,
    );
    const openField = fieldCredits.filter(fieldOpen);
    const overdueField = fieldCredits.filter((f) => f.status === "OVERDUE");
    const fieldRepaidMo = fieldCredits.reduce(
      (s, f) => s + f.payments.filter((p) => inMonth(p.createdAt)).reduce((ps, p) => ps + p.amount, 0),
      0,
    );
    const partnerOut = open.reduce((s, a) => s + Math.max(0, a.principal - a.amountPaid), 0);
    const fieldOut = openField.reduce((s, f) => s + fieldOwing(f), 0);
    const dueToday =
      open.filter((a) => isToday(a.dueDate)).reduce((s, a) => s + Math.max(0, a.principal - a.amountPaid), 0) +
      openField.filter((f) => isToday(f.dueDate)).reduce((s, f) => s + fieldOwing(f), 0);
    return {
      outstanding: partnerOut + fieldOut,
      partnerOut,
      fieldOut,
      activeBatches: open.length,
      activeField: openField.length,
      overdue:
        overdue.reduce((s, a) => s + Math.max(0, a.principal - a.amountPaid), 0) +
        overdueField.reduce((s, f) => s + fieldOwing(f), 0),
      dueToday,
      repaidThisMonth: partnerRepaidMo + fieldRepaidMo,
      settled:
        accounts.filter((a) => a.status === "SETTLED").length +
        fieldCredits.filter((f) => !fieldOpen(f)).length,
      partners: new Set(open.map((a) => a.partnerName)).size,
      fieldCustomers: new Set(openField.map((f) => f.customerName)).size,
    };
  }, [accounts, fieldCredits]);

  const overdueAccounts = accounts.filter(
    (a) => a.status === "OVERDUE" || (daysOverdue(a) > 0 && a.status !== "SETTLED"),
  );
  const overdueField = fieldCredits.filter((f) => f.status === "OVERDUE");

  return (
    <div className="space-y-5">
      {/* KPI bar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Kpi
          icon={Wallet}
          label="Outstanding"
          value={formatCurrency(kpi.outstanding)}
          tone="text-warning"
          hint={`partners ${formatCurrency(kpi.partnerOut)} · field ${formatCurrency(kpi.fieldOut)}`}
        />
        <Kpi
          icon={AlertTriangle}
          label="Overdue"
          value={formatCurrency(kpi.overdue)}
          tone="text-destructive"
        />
        <Kpi
          icon={Layers}
          label="Due today"
          value={formatCurrency(kpi.dueToday)}
          tone={kpi.dueToday > 0 ? "text-warning" : undefined}
        />
        <Kpi
          icon={Banknote}
          label="Repaid (mo)"
          value={formatCurrency(kpi.repaidThisMonth)}
          tone="text-success"
        />
        <Kpi
          icon={Layers}
          label="Active credits"
          value={String(kpi.activeBatches + kpi.activeField)}
          hint={`${kpi.activeBatches} partner · ${kpi.activeField} field`}
        />
        <Kpi
          icon={CheckCircle2}
          label="Settled"
          value={String(kpi.settled)}
          tone="text-success"
        />
        <Kpi
          icon={Users}
          label="On credit"
          value={String(kpi.partners + kpi.fieldCustomers)}
          hint={`${kpi.partners} partner · ${kpi.fieldCustomers} field customer${kpi.fieldCustomers === 1 ? "" : "s"}`}
        />
      </div>

      {/* Pending payments — the action queue, always on top */}
      <PendingPayments
        settlements={settlements.filter((s) => s.status === "PENDING")}
        onRefresh={() => router.refresh()}
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { k: "CREDITS", label: "Partner credits", n: accounts.length },
          { k: "FIELD", label: "Field credit", n: fieldCredits.length },
          {
            k: "SETTLEMENTS",
            label: "Settlements",
            n:
              settlements.length +
              accounts.reduce((s, a) => s + a.payments.length, 0) +
              fieldCredits.reduce((s, f) => s + f.payments.length, 0),
          },
          { k: "OVERDUE", label: "Overdue", n: overdueAccounts.length + overdueField.length },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as typeof tab)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tab === t.k
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label}
            <span className="ml-1.5 opacity-70">{t.n}</span>
          </button>
        ))}
      </div>

      {tab === "CREDITS" && (
        <CreditsTable
          accounts={accounts}
          onPay={setPayTarget}
          onTerms={setTermsTarget}
          onRefresh={() => router.refresh()}
        />
      )}
      {tab === "FIELD" && <FieldCreditPanel credits={fieldCredits} />}
      {tab === "SETTLEMENTS" && (
        <>
          <SettlementsTable accounts={accounts} settlements={settlements} />
          <FieldCollections credits={fieldCredits} />
        </>
      )}
      {tab === "OVERDUE" && (
        <>
          <OverduePanel
            accounts={overdueAccounts}
            onPay={setPayTarget}
            onRefresh={() => router.refresh()}
          />
          {overdueField.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-display text-sm font-semibold text-muted-foreground">
                Overdue field credit (rep customers)
              </h3>
              <FieldCreditPanel credits={overdueField} compact />
            </div>
          )}
        </>
      )}

      {payTarget && (
        <PaymentModal
          account={payTarget}
          onClose={() => setPayTarget(null)}
          onDone={() => {
            setPayTarget(null);
            router.refresh();
          }}
        />
      )}
      {termsTarget && (
        <TermsModal
          account={termsTarget}
          onClose={() => setTermsTarget(null)}
          onDone={() => {
            setTermsTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <p className={`mt-1 font-display text-lg font-semibold ${tone ?? ""}`}>
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground" title={hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

// ── Pending payments (top action queue) ───────────────────────────────────
function PendingPayments({
  settlements,
  onRefresh,
}: {
  settlements: SettlementDTO[];
  onRefresh: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function reject(id: string) {
    const note = window.prompt("Reason for rejecting (optional)") ?? undefined;
    start(async () => {
      const res = await rejectSettlement(id, note);
      if (res.ok) toast({ variant: "success", title: res.message });
      else toast({ variant: "error", title: res.error });
      onRefresh();
    });
  }

  if (settlements.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 text-success" />
        No payments awaiting confirmation — every submitted credit payment is reviewed.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-warning/40 bg-warning/5">
      <div className="flex items-center gap-2 border-b border-warning/30 px-4 py-3">
        <Clock className="size-4 text-warning" />
        <h2 className="text-sm font-semibold">
          Pending payments — confirm or reject
        </h2>
        <Badge variant="warning" className="ml-1">
          {settlements.length}
        </Badge>
      </div>
      <div className="divide-y divide-border">
        {settlements.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{formatCurrency(s.amount)}</span>
                <span className="text-sm text-muted-foreground">
                  {s.partner}
                </span>
                <button
                  onClick={() => router.push(`/admin/credit/${s.accountId}`)}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {s.batchCode} <ExternalLink className="size-3" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {s.method ?? "—"}
                {s.reference ? ` · ${s.reference}` : ""} · {formatDateTime(s.createdAt)} · {s.code}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <ActionButton
                size="sm"
                variant="success"
                action={() => confirmSettlement(s.id)}
                onDone={onRefresh}
                pendingText="…"
              >
                <Check className="size-3.5" /> Confirm
              </ActionButton>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:bg-destructive/10"
                disabled={pending}
                onClick={() => reject(s.id)}
              >
                <XCircle className="size-3.5" /> Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Credits table ─────────────────────────────────────────────────────────
function CreditsTable({
  accounts,
  onPay,
  onTerms,
  onRefresh,
}: {
  accounts: CreditAccountDTO[];
  onPay: (a: CreditAccountDTO) => void;
  onTerms: (a: CreditAccountDTO) => void;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [highValue, setHighValue] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts.filter((a) => {
      if (status !== "ALL" && a.status !== status) return false;
      if (overdueOnly && a.status !== "OVERDUE" && daysOverdue(a) <= 0)
        return false;
      if (highValue && a.principal - a.amountPaid < HIGH_VALUE) return false;
      if (from && a.createdAt.slice(0, 10) < from) return false;
      if (to && a.createdAt.slice(0, 10) > to) return false;
      if (!q) return true;
      return (
        a.partnerName.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        (a.partnerOrg ?? "").toLowerCase().includes(q)
      );
    });
  }, [accounts, query, status, overdueOnly, highValue, from, to]);

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 border-b border-border p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search partner, credit ID…"
            className="h-9 pl-9"
          />
        </div>
        <div className="w-36">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9"
          >
            <option value="ALL">All statuses</option>
            <option value="OUTSTANDING">Outstanding</option>
            <option value="PARTIAL">Partial</option>
            <option value="OVERDUE">Overdue</option>
            <option value="SETTLED">Settled</option>
          </Select>
        </div>
        <div className="w-36">
          <Label className="text-[11px]">From</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="w-36">
          <Label className="text-[11px]">To</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9"
          />
        </div>
        <button
          onClick={() => setOverdueOnly((v) => !v)}
          className={`h-9 rounded-lg border px-3 text-xs font-medium ${
            overdueOnly
              ? "border-destructive/50 bg-destructive/10 text-destructive"
              : "border-border text-muted-foreground"
          }`}
        >
          Overdue only
        </button>
        <button
          onClick={() => setHighValue((v) => !v)}
          className={`h-9 rounded-lg border px-3 text-xs font-medium ${
            highValue
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border text-muted-foreground"
          }`}
        >
          High value
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          className="m-6"
          icon={Wallet}
          title="No credit matches"
          description="Adjust the filters or search term."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-6" />
                <TableHead>Credit ID</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Products</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last payment</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => {
                const remaining = Math.max(0, a.principal - a.amountPaid);
                const isOpen = expanded === a.id;
                const settled = a.status === "SETTLED";
                const od = daysOverdue(a);
                const totalQty = a.items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <Fragment key={a.id}>
                    <TableRow
                      onClick={() => setExpanded(isOpen ? null : a.id)}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <TableCell>
                        {isOpen ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{a.code}</TableCell>
                      <TableCell>
                        <div className="font-medium">{a.partnerName}</div>
                        <div className="text-xs text-muted-foreground">
                          {a.partnerType ?? a.partnerOrg ?? "Partner"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.items.length} line{a.items.length === 1 ? "" : "s"} ·{" "}
                        {totalQty} u
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(a.principal)}
                      </TableCell>
                      <TableCell className="text-right text-success">
                        {formatCurrency(a.amountPaid)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(remaining)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {a.dueDate ? (
                          <span className={od > 0 ? "text-destructive" : ""}>
                            {formatDate(a.dueDate)}
                            {od > 0 ? ` · ${od}d` : ""}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {a.lastPaymentDate
                          ? formatDate(a.lastPaymentDate)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {!settled && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPay(a);
                              }}
                            >
                              <Plus className="size-3.5" />
                              Payment
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/admin/credit/${a.id}`);
                            }}
                          >
                            <ExternalLink className="size-3.5" />
                            Open
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={11} className="p-0">
                          <ExpandedDetail
                            account={a}
                            onPay={onPay}
                            onTerms={onTerms}
                            onRefresh={onRefresh}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ExpandedDetail({
  account: a,
  onPay,
  onTerms,
  onRefresh,
}: {
  account: CreditAccountDTO;
  onPay: (a: CreditAccountDTO) => void;
  onTerms: (a: CreditAccountDTO) => void;
  onRefresh: () => void;
}) {
  const [pending, start] = useTransition();
  const settled = a.status === "SETTLED";

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => {
      const res = await fn();
      if (res.ok) toast({ variant: "success", title: res.message });
      else toast({ variant: "error", title: res.error });
      onRefresh();
    });
  }

  return (
    <div className="grid gap-6 p-5 lg:grid-cols-3">
      {/* Credit breakdown */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Credit breakdown
        </p>
        <div className="space-y-1.5">
          {a.items.map((i, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-lg bg-card px-3 py-2 text-sm"
            >
              <span className="inline-flex items-center gap-1.5">
                <PackageCheck className="size-3.5 text-muted-foreground" />
                {i.name}
                <span className="text-muted-foreground">×{i.quantity}</span>
              </span>
              <span className="text-muted-foreground">
                {formatCurrency(i.unitPrice)} ea ·{" "}
                <span className="text-foreground">
                  {formatCurrency(i.lineTotal)}
                </span>
              </span>
            </div>
          ))}
          <div className="flex justify-between px-3 pt-1 text-sm font-medium">
            <span>Total value</span>
            <span>{formatCurrency(a.principal)}</span>
          </div>
        </div>
      </div>

      {/* Payment timeline */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Payment timeline
        </p>
        {a.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No repayments recorded yet.
          </p>
        ) : (
          <ol className="space-y-2">
            {a.payments.map((p) => (
              <li
                key={p.id}
                className="flex justify-between gap-2 rounded-lg bg-card px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium text-success">
                    +{formatCurrency(p.amount)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDate(p.createdAt)}
                    {p.method ? ` · ${p.method}` : ""} · by {p.recordedBy}
                    {p.note ? ` · ${p.note}` : ""}
                  </span>
                </span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  bal {formatCurrency(p.balanceAfter)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Stock movement + actions */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Linked stock movement
        </p>
        <dl className="space-y-1.5 text-sm">
          <Row label="Invoice" value={a.invoiceNo ?? "—"} />
          <Row label="Warehouse" value={a.warehouse ?? "—"} />
          <Row
            label="Issued"
            value={a.issuedAt ? formatDate(a.issuedAt) : "—"}
          />
          <Row
            label="Delivered"
            value={a.deliveredAt ? formatDate(a.deliveredAt) : "—"}
          />
          <Row label="Allocation" value="Credit (pay-later)" />
        </dl>

        <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Quick actions
        </p>
        <div className="flex flex-wrap gap-2">
          {!settled && (
            <Button size="sm" onClick={() => onPay(a)}>
              <Plus className="size-3.5" />
              Record payment
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => sendCreditReminder(a.id))}
          >
            <Bell className="size-3.5" />
            Send reminder
          </Button>
          {!settled && a.status !== "OVERDUE" && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => markOverdue(a.id))}
            >
              <Flag className="size-3.5" />
              Mark overdue
            </Button>
          )}
          {!settled && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onTerms(a)}
            >
              <CalendarClock className="size-3.5" />
              Edit terms
            </Button>
          )}
          {!settled && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              disabled={pending}
              onClick={() => {
                if (
                  window.confirm(
                    "Close this credit? Any remaining balance is written off.",
                  )
                )
                  run(() => closeCredit(a.id));
              }}
            >
              <XCircle className="size-3.5" />
              Close credit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

// ── Settlements tab ───────────────────────────────────────────────────────
function SettlementsTable({
  accounts,
  settlements,
}: {
  accounts: CreditAccountDTO[];
  settlements: SettlementDTO[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");

  function reject(id: string) {
    const note = window.prompt("Reason for rejecting (optional)") ?? undefined;
    start(async () => {
      const res = await rejectSettlement(id, note);
      if (res.ok) toast({ variant: "success", title: res.message });
      else toast({ variant: "error", title: res.error });
      router.refresh();
    });
  }

  const rows = useMemo(() => {
    const all = accounts.flatMap((a) =>
      a.payments.map((p) => ({
        ...p,
        partner: a.partnerName,
        code: a.code,
      })),
    );
    all.sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1));
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (r) =>
        r.partner.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q),
    );
  }, [accounts, query]);

  return (
    <div className="space-y-5">
      {/* Partner payment submissions */}
      {settlements.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-3 text-sm font-medium">
            Partner payment submissions
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Credit batch</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlements.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.code}</TableCell>
                    <TableCell>{s.partner}</TableCell>
                    <TableCell className="text-sm">{s.batchCode}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(s.amount)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.method ?? "—"}
                      {s.reference ? ` · ${s.reference}` : ""}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(s.createdAt)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {s.status === "PENDING" ? (
                        <div className="flex justify-end gap-1.5">
                          <ActionButton
                            size="sm"
                            variant="success"
                            action={() => confirmSettlement(s.id)}
                            onDone={() => router.refresh()}
                            pendingText="…"
                          >
                            <Check className="size-3.5" />
                            Confirm
                          </ActionButton>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10"
                            disabled={pending}
                            onClick={() => reject(s.id)}
                          >
                            <XCircle className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {s.status === "CONFIRMED" ? "Posted" : "Rejected"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Confirmed ledger */}
      <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border p-3">
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search settlements…"
            className="h-9 pl-9"
          />
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          className="m-6"
          icon={Banknote}
          title="No settlements yet"
          description="Recorded repayments will appear here as a confirmed ledger."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Settlement ID</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Credit batch</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Recorded by</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">
                    STL-{r.id.slice(-6).toUpperCase()}
                  </TableCell>
                  <TableCell className="font-medium">{r.partner}</TableCell>
                  <TableCell className="text-sm">{r.code}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(r.amount)}
                  </TableCell>
                  <TableCell className="text-sm">{r.method ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDateTime(r.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">{r.recordedBy}</TableCell>
                  <TableCell>
                    <Badge variant="success">Confirmed</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      </div>
    </div>
  );
}

// ── Overdue panel ─────────────────────────────────────────────────────────
function OverduePanel({
  accounts,
  onPay,
  onRefresh,
}: {
  accounts: CreditAccountDTO[];
  onPay: (a: CreditAccountDTO) => void;
  onRefresh: () => void;
}) {
  const [pending, start] = useTransition();
  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => {
      const res = await fn();
      if (res.ok) toast({ variant: "success", title: res.message });
      else toast({ variant: "error", title: res.error });
      onRefresh();
    });
  }
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="No overdue accounts"
        description="Every active credit is within its agreed terms."
      />
    );
  }
  const riskTone: Record<string, string> = {
    High: "destructive",
    Medium: "warning",
    Low: "secondary",
  };
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partner</TableHead>
              <TableHead>Credit ID</TableHead>
              <TableHead className="text-right">Days overdue</TableHead>
              <TableHead className="text-right">Amount overdue</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => {
              const remaining = Math.max(0, a.principal - a.amountPaid);
              const risk = riskOf(a);
              return (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.partnerName}</TableCell>
                  <TableCell className="text-sm">{a.code}</TableCell>
                  <TableCell className="text-right font-medium text-destructive">
                    {daysOverdue(a)}d
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(remaining)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={riskTone[risk] as "destructive"}>
                      {risk}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" onClick={() => onPay(a)}>
                        <Plus className="size-3.5" />
                        Payment
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => run(() => sendCreditReminder(a.id))}
                      >
                        <Bell className="size-3.5" />
                        Remind
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────
function PaymentModal({
  account,
  onClose,
  onDone,
}: {
  account: CreditAccountDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const remaining = account.principal - account.amountPaid;
  const [amount, setAmount] = useState(remaining.toString());
  const [method, setMethod] = useState("Mobile money");
  const [collectedBy, setCollectedBy] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    start(async () => {
      const res = await recordPayment({
        creditAccountId: account.id,
        amount: Number(amount),
        method,
        collectedBy: collectedBy || undefined,
        note: note || undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onDone();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Record payment · ${account.code}`}
      description={`${account.partnerName} · remaining ${formatCurrency(remaining)}`}
    >
      <div className="space-y-4">
        <div>
          <Label>Amount</Label>
          <Input
            type="number"
            min={1}
            max={remaining}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Payment type</Label>
          <Select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="mt-1.5"
          >
            <option>Cash collection</option>
            <option>Bank transfer</option>
            <option>Mobile money</option>
          </Select>
        </div>
        <div>
          <Label>Collected by (optional)</Label>
          <Input
            value={collectedBy}
            onChange={(e) => setCollectedBy(e.target.value)}
            placeholder="Field agent / ORA staff"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Note (optional)</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Recording…" : "Record payment"}
        </Button>
      </div>
    </Modal>
  );
}

function TermsModal({
  account,
  onClose,
  onDone,
}: {
  account: CreditAccountDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [dueDate, setDueDate] = useState(
    account.dueDate ? account.dueDate.slice(0, 10) : "",
  );

  function submit() {
    start(async () => {
      const res = await editCreditTerms({ accountId: account.id, dueDate });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onDone();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit terms · ${account.code}`}
      description="Adjust the agreed due date for this credit cycle."
    >
      <div className="space-y-4">
        <div>
          <Label>Due date</Label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save terms"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Field credit (rep customers) ─────────────────────────────────────────────

/** Every rep-recorded credit sale — filterable by rep, customer, status. */
function FieldCreditPanel({
  credits,
  compact = false,
}: {
  credits: FieldCreditDTO[];
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [rep, setRep] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const reps = useMemo(
    () => [...new Set(credits.map((c) => c.repName))].sort(),
    [credits],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return credits.filter((c) => {
      if (rep !== "ALL" && c.repName !== rep) return false;
      if (status !== "ALL" && c.status !== status) return false;
      if (overdueOnly && c.status !== "OVERDUE") return false;
      if (
        needle &&
        ![c.customerName, c.customerBusiness, c.customerLocation, c.repName, c.code]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle))
      )
        return false;
      return true;
    });
  }, [credits, q, rep, status, overdueOnly]);

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customer, rep, code…"
            className="h-9 w-full sm:max-w-64"
          />
          <Select value={rep} onChange={(e) => setRep(e.target.value)} className="h-9 w-auto">
            <option value="ALL">All reps</option>
            {reps.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-auto">
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PARTIAL">Partial</option>
            <option value="OVERDUE">Overdue</option>
            <option value="PAID">Paid</option>
          </Select>
          <button
            type="button"
            onClick={() => setOverdueOnly((v) => !v)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              overdueOnly
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Overdue only
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          className="rounded-2xl border border-dashed border-border py-10"
          icon={Wallet}
          title="No field credit matches"
          description="Credit sales recorded by sales reps appear here the moment they're saved."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((c) => {
            const owing = Math.max(0, c.total - c.amountPaid);
            return (
              <div
                key={c.id}
                className={`rounded-2xl border bg-card p-4 ${
                  c.status === "OVERDUE" ? "border-destructive/40" : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display font-semibold">{c.customerName}</span>
                      {c.customerBusiness && (
                        <span className="text-sm text-muted-foreground">· {c.customerBusiness}</span>
                      )}
                      <StatusBadge status={c.status} />
                      <Badge variant="secondary">rep: {c.repName}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.code} · {formatDate(c.createdAt)}
                      {c.dueDate ? ` · due ${formatDate(c.dueDate)}` : ""}
                      {c.customerLocation ? ` · ${c.customerLocation}` : ""}
                      {c.customerPhone ? ` · ${c.customerPhone}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {c.items.map((i) => `${i.quantity} × ${i.name}`).join(" · ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display font-bold">{formatCurrency(c.total)}</p>
                    <p className="text-xs text-muted-foreground">
                      paid {formatCurrency(c.amountPaid)}
                      {owing > 0 ? (
                        <span className="text-warning"> · owing {formatCurrency(owing)}</span>
                      ) : (
                        <span className="text-success"> · settled</span>
                      )}
                    </p>
                    {c.customerId && (
                      <Link
                        href={`/admin/reps/customers/${c.customerId}`}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        Customer profile <ExternalLink className="size-3" />
                      </Link>
                    )}
                  </div>
                </div>
                {c.payments.length > 0 && (
                  <div className="mt-2.5 space-y-1 border-t border-border/60 pt-2">
                    {c.payments.map((p, i) => (
                      <p key={i} className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {formatDateTime(p.createdAt)} · {p.method ?? "payment"} · by {p.recordedBy}
                        </span>
                        <span className="font-medium text-success">+{formatCurrency(p.amount)}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Payments collected against field credit — part of the settlements picture. */
function FieldCollections({ credits }: { credits: FieldCreditDTO[] }) {
  const payments = useMemo(
    () =>
      credits
        .flatMap((c) =>
          c.payments.map((p) => ({
            ...p,
            customer: c.customerName,
            rep: c.repName,
            code: c.code,
          })),
        )
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [credits],
  );
  if (payments.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="font-display text-sm font-semibold text-muted-foreground">
        Field collections — rep-customer credit repayments
      </h3>
      <div className="rounded-2xl border border-border bg-card">
        <div className="divide-y divide-border/60">
          {payments.map((p, i) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-medium">{p.customer}</span>
                <span className="text-muted-foreground"> · {p.code} · rep {p.rep} · {p.method ?? "payment"}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="font-semibold text-success">+{formatCurrency(p.amount)}</span>
                <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
