"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, X, Wallet, ClipboardCheck } from "lucide-react";
import {
  createPettyCashRequest,
  approvePettyCashRequest,
  rejectPettyCashRequest,
  recordPettyCashExpense,
  reconcilePettyCash,
} from "@/lib/actions/petty-cash";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionButton } from "@/components/dashboard/action-button";
import { toast } from "@/components/ui/use-toast";
import { cn, formatCurrency, formatDate, formatDateTime, timeAgo } from "@/lib/utils";

export type PettyCashExpenseDTO = {
  id: string;
  description: string;
  amount: number;
  receiptRef: string | null;
  recordedByName: string;
  createdAt: string; // ISO
};

export type PettyCashDTO = {
  id: string;
  code: string;
  amount: number;
  purpose: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RECONCILED";
  requestedByName: string;
  approvedByName: string | null;
  approvedAt: string | null; // ISO
  adminNote: string | null;
  reconciledAt: string | null; // ISO
  reconcileNote: string | null;
  createdAt: string; // ISO
  spent: number;
  remaining: number;
  expenses: PettyCashExpenseDTO[];
};

type ReceivingAccount = {
  id: string;
  name: string;
  type: string;
  accountName: string | null;
  accountNumber: string | null;
};

/** Petty cash accountability loop — finance requests, admin approves (money
 * issued), finance records every expenditure, then closes with a
 * reconciliation report. One component, two vantage points. */
export function PettyCashManager({
  requests,
  receivingAccounts,
  mode,
}: {
  requests: PettyCashDTO[];
  receivingAccounts: ReceivingAccount[];
  mode: "finance" | "admin";
}) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const pending = requests.filter((r) => r.status === "PENDING");
  const open = requests.filter((r) => r.status === "APPROVED");
  const history = requests.filter(
    (r) => r.status === "RECONCILED" || r.status === "REJECTED",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">
            {mode === "finance" ? "Office fund allocations" : "Office fund requests"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {mode === "finance"
              ? "Request funds from the CEO, spend from the approved fund on office costs, then close each allocation with a reconciliation report."
              : "Approving issues the money immediately as an office expense from the chosen company account — finance accounts for every shilling after."}
          </p>
        </div>
        {mode === "finance" && <RequestPettyCashButton />}
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No office fund requests yet"
          description={
            mode === "finance"
              ? "Request an office fund to cover day-to-day spending — the CEO approves it and you account for every expenditure."
              : "When finance requests an office fund it lands here for your approval."
          }
        />
      ) : (
        <>
          {pending.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Awaiting approval
              </h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {pending.map((r) => (
                  <PendingCard
                    key={r.id}
                    req={r}
                    mode={mode}
                    accounts={receivingAccounts}
                    onDone={refresh}
                  />
                ))}
              </div>
            </section>
          )}

          {open.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Open allocations
              </h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {open.map((r) => (
                  <OpenAllocationCard key={r.id} req={r} mode={mode} onDone={refresh} />
                ))}
              </div>
            </section>
          )}

          {history.length > 0 && (
            <section className="space-y-2">
              <h3 className="font-display text-sm font-semibold text-muted-foreground">
                History — reconciled &amp; rejected
              </h3>
              <div className="rounded-2xl border border-border bg-card">
                <div className="divide-y divide-border/60">
                  {history.map((r) => (
                    <HistoryRow key={r.id} req={r} />
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** Finance asks the admin for a cash allocation. */
function RequestPettyCashButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");

  function submit() {
    start(async () => {
      const res = await createPettyCashRequest({
        amount: Math.round(Number(amount) || 0),
        purpose,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        setAmount("");
        setPurpose("");
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <>
      <Button className="rounded-full" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Request office fund
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Request office fund"
          description="Goes to the CEO for approval — the money is issued from a company account the moment it is approved."
        >
          <div className="space-y-4">
            <div>
              <Label>Amount (TSh)</Label>
              <Input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50000"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Purpose</Label>
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Office supplies & transport for the week"
                className="mt-1.5"
              />
            </div>
            <Button
              className="w-full"
              onClick={submit}
              disabled={pending || !(Number(amount) > 0) || purpose.trim().length < 3}
            >
              {pending ? "Sending…" : "Send request"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** A request still waiting on the admin. */
function PendingCard({
  req,
  mode,
  accounts,
  onDone,
}: {
  req: PettyCashDTO;
  mode: "finance" | "admin";
  accounts: ReceivingAccount[];
  onDone: () => void;
}) {
  return (
    <div className="rounded-2xl border border-warning/40 bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-display font-semibold">{req.code}</span>
            <StatusBadge status={req.status} />
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{req.purpose}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            requested by {req.requestedByName} · {timeAgo(req.createdAt)}
          </p>
        </div>
        <p className="shrink-0 font-display text-xl font-bold">
          {formatCurrency(req.amount)}
        </p>
      </div>
      {mode === "admin" ? (
        <div className="mt-3 border-t border-border/60 pt-3">
          <ApproveControls id={req.id} accounts={accounts} onDone={onDone} />
        </div>
      ) : (
        <p className="mt-3 border-t border-border/60 pt-2.5 text-xs text-warning">
          Awaiting admin approval — you can start spending the moment it is approved.
        </p>
      )}
    </div>
  );
}

/** Admin approves while recording which company account the cash leaves from.
 * Same select+ActionButton idiom as settlement confirmation. */
function ApproveControls({
  id,
  accounts,
  onDone,
}: {
  id: string;
  accounts: ReceivingAccount[];
  onDone: () => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {accounts.length > 0 && (
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="h-8 max-w-44 rounded-lg border border-input bg-background px-2 text-xs"
          title="Company account the cash is issued from"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.accountNumber ? ` · ${a.accountNumber}` : ""}
            </option>
          ))}
        </select>
      )}
      <ActionButton
        size="sm"
        variant="success"
        action={() => approvePettyCashRequest(id, accountId || undefined)}
        onDone={onDone}
        pendingText="…"
      >
        <Check className="size-3.5" /> Approve
      </ActionButton>
      <RejectButton id={id} onDone={onDone} />
    </div>
  );
}

function RejectButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  function run() {
    const note = window.prompt("Why is this request being rejected? (optional)");
    if (note === null) return;
    start(async () => {
      const res = await rejectPettyCashRequest(id, note.trim() || undefined);
      if (res.ok) {
        toast({ variant: "success", title: res.message ?? "Request rejected." });
      } else toast({ variant: "error", title: res.error });
      onDone();
    });
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={run}
    >
      <X className="size-3.5" /> Reject
    </Button>
  );
}

/** An approved allocation being spent down — progress, expenditure log, and
 * (for finance) the inline spend form + reconciliation. */
function OpenAllocationCard({
  req,
  mode,
  onDone,
}: {
  req: PettyCashDTO;
  mode: "finance" | "admin";
  onDone: () => void;
}) {
  const pct = req.amount > 0 ? (req.spent / req.amount) * 100 : 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-display font-semibold">{req.code}</span>
            <StatusBadge status={req.status} />
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{req.purpose}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            requested by {req.requestedByName}
            {req.approvedByName ? ` · approved by ${req.approvedByName}` : ""}
            {req.approvedAt ? ` ${timeAgo(req.approvedAt)}` : ""}
          </p>
        </div>
        <p className="shrink-0 font-display text-xl font-bold">
          {formatCurrency(req.amount)}
        </p>
      </div>

      <div className="mt-3 space-y-1.5">
        <Progress
          value={pct}
          indicatorClassName={req.remaining === 0 ? "bg-success" : undefined}
        />
        <p className="flex justify-between text-xs text-muted-foreground">
          <span>{formatCurrency(req.spent)} spent</span>
          <span>
            <span className="font-semibold text-foreground">
              {formatCurrency(req.remaining)}
            </span>{" "}
            remaining
          </span>
        </p>
      </div>

      <ExpensesList expenses={req.expenses} className="mt-2.5" />

      {mode === "finance" && (
        <div className="mt-3 space-y-2.5 border-t border-border/60 pt-3">
          {req.remaining > 0 && (
            <ExpenseForm requestId={req.id} remaining={req.remaining} onDone={onDone} />
          )}
          <ReconcileButton id={req.id} remaining={req.remaining} />
        </div>
      )}
    </div>
  );
}

function ExpensesList({
  expenses,
  className,
}: {
  expenses: PettyCashExpenseDTO[];
  className?: string;
}) {
  if (expenses.length === 0) return null;
  return (
    <div className={cn("space-y-1 border-t border-border/60 pt-2", className)}>
      {expenses.map((e) => (
        <p key={e.id} className="flex justify-between gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">
            {formatDateTime(e.createdAt)} · {e.description}
            {e.receiptRef ? ` · ref ${e.receiptRef}` : ""} · by {e.recordedByName}
          </span>
          <span className="shrink-0 font-medium text-destructive">
            −{formatCurrency(e.amount)}
          </span>
        </p>
      ))}
    </div>
  );
}

/** Finance logs one expenditure against the allocation. */
function ExpenseForm({
  requestId,
  remaining,
  onDone,
}: {
  requestId: string;
  remaining: number;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [receiptRef, setReceiptRef] = useState("");

  function submit() {
    start(async () => {
      const res = await recordPettyCashExpense({
        requestId,
        description,
        amount: Math.round(Number(amount) || 0),
        receiptRef,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message ?? "Expenditure recorded." });
        setDescription("");
        setAmount("");
        setReceiptRef("");
        onDone();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem_auto]">
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What was bought?"
        className="h-9 text-sm"
      />
      <Input
        type="number"
        min={1}
        max={remaining}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        className="h-9 text-sm"
      />
      <Input
        value={receiptRef}
        onChange={(e) => setReceiptRef(e.target.value)}
        placeholder="Receipt ref"
        className="h-9 text-sm"
      />
      <Button
        size="sm"
        onClick={submit}
        disabled={pending || description.trim().length < 2 || !(Number(amount) > 0)}
      >
        {pending ? "…" : "Record"}
      </Button>
    </div>
  );
}

/** Finance closes the allocation — unspent balance is marked as returned. */
function ReconcileButton({ id, remaining }: { id: string; remaining: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run() {
    const note = window.prompt(
      `Submit reconciliation? ${formatCurrency(remaining)} is unspent and will be recorded as returned. Optional note for the report:`,
      "",
    );
    if (note === null) return;
    start(async () => {
      const res = await reconcilePettyCash(id, note.trim() || undefined);
      if (res.ok) {
        toast({ variant: "success", title: res.message ?? "Reconciled." });
      } else toast({ variant: "error", title: res.error });
      router.refresh();
    });
  }
  return (
    <Button size="sm" variant="outline" onClick={run} disabled={pending}>
      <ClipboardCheck className="size-3.5" />
      {pending ? "Submitting…" : "Submit reconciliation"}
    </Button>
  );
}

/** Closed allocations collapse into one compact accountability line each. */
function HistoryRow({ req }: { req: PettyCashDTO }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{req.code}</span>
          <StatusBadge status={req.status} />
          <span className="truncate text-muted-foreground">{req.purpose}</span>
        </span>
        {req.status === "RECONCILED" && req.reconcileNote && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {req.reconcileNote}
          </span>
        )}
        {req.status === "REJECTED" && req.adminNote && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Rejected: {req.adminNote}
          </span>
        )}
      </span>
      <span className="shrink-0 text-right">
        <span className="font-semibold">{formatCurrency(req.amount)}</span>
        <span className="ml-2 text-xs text-muted-foreground">
          {formatDate(req.reconciledAt ?? req.approvedAt ?? req.createdAt)}
        </span>
      </span>
    </div>
  );
}
