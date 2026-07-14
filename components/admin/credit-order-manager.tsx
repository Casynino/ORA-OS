"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Bell,
  Flag,
  XCircle,
  CalendarClock,
  Check,
  Clock,
  Banknote,
} from "lucide-react";
import {
  recordPayment,
  markOverdue,
  closeCredit,
  sendCreditReminder,
  editCreditTerms,
} from "@/lib/actions/credit";
import { confirmSettlement, rejectSettlement } from "@/lib/actions/settlements";
import {
  ReceivingAccountPicker,
  METHOD_LABELS,
  type ReceivingAccount,
} from "@/components/ui/receiving-account-picker";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/dashboard/action-button";
import { toast } from "@/components/ui/use-toast";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export type CreditOrderDTO = {
  id: string;
  code: string;
  invoiceNo: string | null;
  status: string;
  createdAt: string;
  dueDate: string | null;
  partner: {
    id: string;
    name: string;
    organization: string | null;
    businessType: string | null;
    creditLimit: number;
  };
  principal: number;
  amountPaid: number;
  remaining: number;
  warehouse: string | null;
  deliveryStatus: string;
  issuedAt: string | null;
  deliveredAt: string | null;
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
  settlements: {
    id: string;
    code: string;
    amount: number;
    method: string | null;
    reference: string | null;
    note: string | null;
    status: string;
    createdAt: string;
  }[];
};

const SETTLE_VARIANT: Record<string, "warning" | "success" | "destructive"> = {
  PENDING: "warning",
  CONFIRMED: "success",
  REJECTED: "destructive",
};

export function CreditOrderManager({
  order: a,
  receivingAccounts = [],
}: {
  order: CreditOrderDTO;
  receivingAccounts?: ReceivingAccount[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [payOpen, setPayOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const settled = a.status === "SETTLED";
  const paidPct =
    a.principal > 0 ? Math.round((a.amountPaid / a.principal) * 100) : 100;
  const pendingSettlements = a.settlements.filter((s) => s.status === "PENDING");

  function run(
    fn: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ) {
    start(async () => {
      const res = await fn();
      if (res.ok) toast({ variant: "success", title: res.message });
      else toast({ variant: "error", title: res.error });
      router.refresh();
    });
  }

  function reject(id: string) {
    const note = window.prompt("Reason for rejecting (optional)") ?? undefined;
    run(() => rejectSettlement(id, note));
  }

  return (
    <div className="space-y-6">
      {/* Credit information */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-display text-lg font-semibold">Credit information</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat label="Credit limit" value={formatCurrency(a.partner.creditLimit)} />
          <Stat label="Credit used (this order)" value={formatCurrency(a.principal)} />
          <Stat label="Amount paid" value={formatCurrency(a.amountPaid)} accent="success" />
          <Stat
            label="Remaining balance"
            value={formatCurrency(a.remaining)}
            accent={a.remaining > 0 ? "warning" : "success"}
          />
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{paidPct}% repaid</span>
            <span>
              Due {a.dueDate ? formatDate(a.dueDate) : "—"}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${Math.min(100, paidPct)}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap gap-2">
          {!settled && (
            <Button size="sm" onClick={() => setPayOpen(true)}>
              <Plus className="size-3.5" /> Record payment
            </Button>
          )}
          {!settled && (
            <Button size="sm" variant="outline" onClick={() => setTermsOpen(true)}>
              <CalendarClock className="size-3.5" /> Edit terms
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => sendCreditReminder(a.id))}
          >
            <Bell className="size-3.5" /> Send reminder
          </Button>
          {!settled && a.status !== "OVERDUE" && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => markOverdue(a.id))}
            >
              <Flag className="size-3.5" /> Mark overdue
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
                    "Close this credit order? Any remaining balance is written off.",
                  )
                )
                  run(() => closeCredit(a.id));
              }}
            >
              <XCircle className="size-3.5" /> Close credit order
            </Button>
          )}
        </div>
      </section>

      {/* Payments linked to this order */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            Payments linked to this order
          </h2>
          {pendingSettlements.length > 0 && (
            <Badge variant="warning">
              {pendingSettlements.length} awaiting confirmation
            </Badge>
          )}
        </div>

        {/* Partner submissions (confirm / reject each) */}
        {a.settlements.length > 0 && (
          <div className="mt-3 space-y-2">
            {a.settlements.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "rounded-xl border p-3",
                  s.status === "PENDING"
                    ? "border-warning/40 bg-warning/5"
                    : "border-border bg-muted/20",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatCurrency(s.amount)}</span>
                    <Badge variant={SETTLE_VARIANT[s.status] ?? "secondary"}>
                      {s.status === "PENDING"
                        ? "Pending confirmation"
                        : s.status === "CONFIRMED"
                          ? "Confirmed"
                          : "Rejected"}
                    </Badge>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {s.code}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.method ?? "—"}
                  {s.reference ? ` · ${s.reference}` : ""} · submitted{" "}
                  {formatDateTime(s.createdAt)}
                  {s.note ? ` · ${s.note}` : ""}
                </p>
                {s.status === "PENDING" && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {receivingAccounts.length > 0 && (
                      <SettleAccountSelect
                        accounts={receivingAccounts}
                        settlementId={s.id}
                        onDone={() => router.refresh()}
                      />
                    )}
                    {receivingAccounts.length === 0 && (
                      <ActionButton
                        size="sm"
                        variant="success"
                        action={() => confirmSettlement(s.id)}
                        onDone={() => router.refresh()}
                        pendingText="…"
                      >
                        <Check className="size-3.5" /> Confirm payment
                      </ActionButton>
                    )}
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
                )}
              </div>
            ))}
          </div>
        )}

        {/* Confirmed payment timeline */}
        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Confirmed payment timeline
        </p>
        {a.payments.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" /> No confirmed repayments yet.
          </p>
        ) : (
          <ol className="space-y-2">
            {a.payments.map((p) => (
              <li
                key={p.id}
                className="flex justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm"
              >
                <span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-success">
                    <Banknote className="size-3.5" /> +{formatCurrency(p.amount)}
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
      </section>

      {/* Fulfilment reference */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-display text-lg font-semibold">Linked stock movement</h2>
        <dl className="mt-3 space-y-1.5 text-sm">
          <Row label="Invoice" value={a.invoiceNo ?? "—"} />
          <Row label="Warehouse" value={a.warehouse ?? "—"} />
          <Row label="Delivery status" value={a.deliveryStatus} />
          <Row label="Issued" value={a.issuedAt ? formatDate(a.issuedAt) : "—"} />
          <Row label="Delivered" value={a.deliveredAt ? formatDate(a.deliveredAt) : "—"} />
        </dl>
      </section>

      {payOpen && (
        <PaymentModal
          order={a}
          receivingAccounts={receivingAccounts}
          onClose={() => setPayOpen(false)}
          onDone={() => {
            setPayOpen(false);
            router.refresh();
          }}
        />
      )}
      {termsOpen && (
        <TermsModal
          order={a}
          onClose={() => setTermsOpen(false)}
          onDone={() => {
            setTermsOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function PaymentModal({
  order: a,
  receivingAccounts = [],
  onClose,
  onDone,
}: {
  order: CreditOrderDTO;
  receivingAccounts?: ReceivingAccount[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState(a.remaining.toString());
  const firstMethod = receivingAccounts[0]?.type ?? "MOBILE_MONEY";
  const [method, setMethod] = useState(firstMethod);
  const [accountId, setAccountId] = useState(
    receivingAccounts.find((x) => x.type === firstMethod)?.id ?? "",
  );
  const [reference, setReference] = useState("");
  const [collectedBy, setCollectedBy] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    if (receivingAccounts.length > 0 && !accountId) {
      toast({ variant: "error", title: "Select which account received the money." });
      return;
    }
    start(async () => {
      const res = await recordPayment({
        creditAccountId: a.id,
        amount: Number(amount),
        method: METHOD_LABELS[method] ?? method,
        paymentAccountId: accountId,
        reference,
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
      title={`Record payment · ${a.code}`}
      description={`${a.partner.name} · remaining ${formatCurrency(a.remaining)}`}
    >
      <div className="space-y-4">
        <div>
          <Label>Amount</Label>
          <Input
            type="number"
            min={1}
            max={a.remaining}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <ReceivingAccountPicker
          accounts={receivingAccounts}
          method={method}
          accountId={accountId}
          reference={reference}
          onMethod={setMethod}
          onAccount={setAccountId}
          onReference={setReference}
        />
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
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
        </div>
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Recording…" : "Record payment"}
        </Button>
      </div>
    </Modal>
  );
}

function TermsModal({
  order: a,
  onClose,
  onDone,
}: {
  order: CreditOrderDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [dueDate, setDueDate] = useState(a.dueDate ? a.dueDate.slice(0, 10) : "");

  function submit() {
    start(async () => {
      const res = await editCreditTerms({ accountId: a.id, dueDate });
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
      title={`Edit terms · ${a.code}`}
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

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "success" | "warning" | "destructive";
}) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-display text-lg font-semibold",
          accent === "success" && "text-success",
          accent === "warning" && "text-warning",
          accent === "destructive" && "text-destructive",
        )}
      >
        {value}
      </p>
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

/** Account select + confirm for a pending settlement on the order page. */
function SettleAccountSelect({
  accounts,
  settlementId,
  onDone,
}: {
  accounts: ReceivingAccount[];
  settlementId: string;
  onDone: () => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  return (
    <>
      <select
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        className="h-8 max-w-40 rounded-lg border border-input bg-background px-2 text-xs"
        title="Account that received the money"
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <ActionButton
        size="sm"
        variant="success"
        action={() => confirmSettlement(settlementId, accountId || undefined)}
        onDone={onDone}
        pendingText="…"
      >
        <Check className="size-3.5" /> Confirm payment
      </ActionButton>
    </>
  );
}
