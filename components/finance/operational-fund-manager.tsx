"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet,
  Clock,
  TrendingDown,
  Landmark,
  Plus,
  Receipt,
  Check,
  X,
  Trash2,
} from "lucide-react";
import {
  requestOperationalFunds,
  approveOperationalFundRequest,
  rejectOperationalFundRequest,
  recordOperationalExpense,
  removeOperationalExpense,
} from "@/lib/actions/operational-fund";
import type { FundRequestRow, FundExpenseRow } from "@/lib/services/operational-fund";
import { EXPENSE_LABELS, OFFICE_FUND_CATEGORIES } from "@/lib/expense-categories";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ProofUpload } from "@/components/ui/proof-upload";
import { ProofViewer } from "@/components/ui/proof-viewer";
import { toast } from "@/components/ui/use-toast";
import { cn, formatCurrency, formatDate, formatNumber, timeAgo } from "@/lib/utils";
import type { ExpenseCategory } from "@prisma/client";

type Fund = {
  balance: number;
  funded: number;
  spent: number;
  spentThisMonth: number;
  pendingTotal: number;
  pending: FundRequestRow[];
  requests: FundRequestRow[];
  expenses: FundExpenseRow[];
  byCategory: { category: ExpenseCategory; amount: number }[];
};

const STATUS_VARIANT: Record<string, "warning" | "success" | "destructive" | "secondary"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  RECONCILED: "secondary",
};

function Tile({ icon: Icon, label, value, hint, accent }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={cn("size-4 shrink-0", accent)} />
      </div>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function OperationalFundManager({
  fund,
  canManage = false,
  canApprove = false,
}: {
  fund: Fund;
  /** Finance can request funds + record spending. */
  canManage?: boolean;
  /** CEO/admin can approve/reject funding requests. */
  canApprove?: boolean;
}) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [spendOpen, setSpendOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Wallet} label="Current balance" value={formatCurrency(fund.balance)} hint="available to spend" accent="text-success" />
        <Tile icon={Clock} label="Pending requests" value={formatNumber(fund.pending.length)} hint={fund.pendingTotal > 0 ? formatCurrency(fund.pendingTotal) : "none"} accent="text-warning" />
        <Tile icon={Landmark} label="Total allocated" value={formatCurrency(fund.funded)} hint="company expense (CEO-approved)" accent="text-info" />
        <Tile icon={TrendingDown} label="Spent this month" value={formatCurrency(fund.spentThisMonth)} accent="text-primary" />
      </div>

      {/* Actions (finance) */}
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setRequestOpen(true)}>
            <Plus className="size-4" /> Request funds
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSpendOpen(true)} disabled={fund.balance <= 0}>
            <Receipt className="size-4" /> Record expense
          </Button>
          {fund.balance <= 0 && (
            <span className="self-center text-xs text-muted-foreground">
              Fund is empty — request more to record spending.
            </span>
          )}
        </div>
      )}

      {/* Pending funding requests */}
      {fund.pending.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-lg font-semibold">
              {canApprove ? "Funding requests awaiting your approval" : "Pending funding requests"}
            </h2>
            {canApprove && (
              <p className="text-xs text-muted-foreground">
                Approving records the amount as a company expense immediately and adds it to the fund balance.
              </p>
            )}
          </div>
          <div className="space-y-2">
            {fund.pending.map((r) => (
              <div key={r.id} className="rounded-2xl border border-warning/30 bg-warning/[0.04] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-display font-semibold">
                      {formatCurrency(r.amount)}
                      <Badge variant="secondary" className="text-[10px]">{EXPENSE_LABELS[r.category]}</Badge>
                    </p>
                    <p className="mt-0.5 text-sm">{r.purpose}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.code} · by {r.requestedBy} · {timeAgo(r.createdAt)}
                    </p>
                    {r.note && <p className="mt-1 text-xs text-muted-foreground">Note: {r.note}</p>}
                  </div>
                  {canApprove ? (
                    <ApproveControls id={r.id} />
                  ) : (
                    <Badge variant="warning">Awaiting CEO</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent spending — one uniform row per expense, stays tidy when busy */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Spending history</h2>
          {fund.expenses.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {formatNumber(fund.expenses.length)} {fund.expenses.length === 1 ? "entry" : "entries"}
            </span>
          )}
        </div>
        {fund.expenses.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No expenses recorded yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <Table wrapperClassName="table-stack">
              <TableHeader>
                <TableRow>
                  <TableHead>Expense</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Recorded by</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {canManage && <TableHead className="text-right sr-only">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {fund.expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell data-cardtitle className="align-top">
                      <span className="font-medium">{e.description}</span>
                      <span className="mt-0.5 block max-w-[22rem] truncate text-[11px] text-muted-foreground">
                        {e.code}{e.note ? ` · ${e.note}` : ""}
                      </span>
                    </TableCell>
                    <TableCell data-label="Category" className="align-top">
                      <Badge variant="secondary" className="text-[10px]">{EXPENSE_LABELS[e.category]}</Badge>
                    </TableCell>
                    <TableCell data-label="Date" className="align-top whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(e.expenseDate)}
                    </TableCell>
                    <TableCell data-label="Recorded by" className="align-top text-sm text-muted-foreground">
                      {e.recordedBy}
                    </TableCell>
                    <TableCell data-label="Receipt" className="align-top">
                      {e.receiptUrl ? (
                        <ProofViewer url={e.receiptUrl} label="Receipt" compact />
                      ) : e.receiptRef ? (
                        <span className="text-xs text-muted-foreground">ref {e.receiptRef}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell data-label="Amount" className="align-top whitespace-nowrap text-right font-semibold text-destructive">
                      −{formatCurrency(e.amount)}
                    </TableCell>
                    {canManage && (
                      <TableCell className="align-top text-right">
                        <DeleteExpense id={e.id} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Spending by category + funding history */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Spending by category</h2>
          {fund.byCategory.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nothing spent yet.</p>
          ) : (
            <div className="rounded-2xl border border-border bg-card divide-y divide-border/60">
              {fund.byCategory.map((c) => (
                <div key={c.category} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span>{EXPENSE_LABELS[c.category]}</span>
                  <span className="font-medium">{formatCurrency(c.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Funding history</h2>
          {fund.requests.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No funding requests yet.</p>
          ) : (
            <div className="rounded-2xl border border-border bg-card divide-y divide-border/60">
              {fund.requests.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{r.code}</span>{" "}
                    <span className="text-muted-foreground">· {r.purpose}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-semibold">{formatCurrency(r.amount)}</span>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>{r.status.toLowerCase()}</Badge>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {requestOpen && <RequestModal onClose={() => setRequestOpen(false)} />}
      {spendOpen && <SpendModal balance={fund.balance} onClose={() => setSpendOpen(false)} />}
    </div>
  );
}

function ApproveControls({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  function decide(kind: "approve" | "reject") {
    start(async () => {
      const res = kind === "approve"
        ? await approveOperationalFundRequest(id)
        : await rejectOperationalFundRequest(id, note.trim() || undefined);
      if (res.ok) { toast({ variant: "success", title: res.message }); router.refresh(); }
      else toast({ variant: "error", title: res.error });
    });
  }
  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <div className="flex gap-1.5">
        <Button size="sm" variant="success" disabled={pending} onClick={() => decide("approve")}>
          <Check className="size-3.5" /> Approve
        </Button>
        <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" disabled={pending} onClick={() => setRejecting((v) => !v)}>
          <X className="size-3.5" />
        </Button>
      </div>
      {rejecting && (
        <div className="flex items-center gap-1.5">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason…" className="h-8 w-40" />
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => decide("reject")}>Reject</Button>
        </div>
      )}
    </div>
  );
}

function DeleteExpense({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="rounded-md p-1 text-muted-foreground hover:text-destructive" aria-label="Remove expense">
        <Trash2 className="size-4" />
      </button>
    );
  }
  return (
    <Button size="sm" variant="destructive" disabled={pending} onClick={() => start(async () => {
      const res = await removeOperationalExpense(id);
      if (res.ok) { toast({ variant: "success", title: res.message }); router.refresh(); }
      else { toast({ variant: "error", title: res.error }); setConfirm(false); }
    })}>
      {pending ? "…" : "Delete?"}
    </Button>
  );
}

function RequestModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [category, setCategory] = useState<string>("OFFICE");
  const [note, setNote] = useState("");
  function submit() {
    const amt = Math.round(Number(amount) || 0);
    if (amt <= 0) return toast({ variant: "error", title: "Enter an amount." });
    if (purpose.trim().length < 3) return toast({ variant: "error", title: "What are the funds for?" });
    start(async () => {
      const res = await requestOperationalFunds({ amount: amt, purpose: purpose.trim(), category: category as ExpenseCategory, note: note.trim() || undefined });
      if (res.ok) { toast({ variant: "success", title: res.message }); onClose(); router.refresh(); }
      else toast({ variant: "error", title: res.error });
    });
  }
  return (
    <Modal open onClose={onClose} title="Request operational funds" description="Ask the CEO to allocate money to the Operational Fund. Once approved, it's added to the balance.">
      <div className="space-y-4">
        <div>
          <Label>Amount (TSh) *</Label>
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5" placeholder="e.g. 500000" />
        </div>
        <div>
          <Label>Purpose *</Label>
          <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="mt-1.5" placeholder="What the funds are for" />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1.5">
            {OFFICE_FUND_CATEGORIES.map((c) => (
              <option key={c} value={c}>{EXPENSE_LABELS[c]}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Notes (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" placeholder="Anything the CEO should know" />
        </div>
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Sending…" : "Send to CEO for approval"}
        </Button>
      </div>
    </Modal>
  );
}

function SpendModal({ balance, onClose }: { balance: number; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("OFFICE");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [receiptRef, setReceiptRef] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [note, setNote] = useState("");
  function submit() {
    const amt = Math.round(Number(amount) || 0);
    if (amt <= 0) return toast({ variant: "error", title: "Enter the amount spent." });
    if (amt > balance) return toast({ variant: "error", title: `Only ${formatCurrency(balance)} left in the fund.` });
    if (description.trim().length < 3) return toast({ variant: "error", title: "What was this spent on?" });
    start(async () => {
      const res = await recordOperationalExpense({
        amount: amt, category: category as ExpenseCategory, description: description.trim(),
        vendor: vendor.trim() || undefined, expenseDate: date, receiptRef: receiptRef.trim() || undefined,
        receiptUrl: receiptUrl || undefined, note: note.trim() || undefined,
      });
      if (res.ok) { toast({ variant: "success", title: res.message }); onClose(); router.refresh(); }
      else toast({ variant: "error", title: res.error });
    });
  }
  return (
    <Modal open onClose={onClose} title="Record an expense" description={`Money spent from the Operational Fund. ${formatCurrency(balance)} available.`}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Amount (TSh) *</Label>
            <Input type="number" min={1} max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Category *</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1.5">
              {OFFICE_FUND_CATEGORIES.map((c) => (
                <option key={c} value={c}>{EXPENSE_LABELS[c]}</option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label>Description *</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1.5" placeholder="What was bought" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Vendor / recipient</Label>
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} className="mt-1.5" placeholder="Optional" />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5" />
          </div>
        </div>
        <div>
          <Label>Receipt / voucher reference</Label>
          <Input value={receiptRef} onChange={(e) => setReceiptRef(e.target.value)} className="mt-1.5" placeholder="Optional" />
        </div>
        <div>
          <Label className="mb-1.5 block">Supporting document (receipt / invoice / voucher)</Label>
          <ProofUpload value={receiptUrl} onChange={setReceiptUrl} label="Attach supporting document" />
        </div>
        <div>
          <Label>Notes (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
        </div>
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Recording…" : "Record expense"}
        </Button>
      </div>
    </Modal>
  );
}
