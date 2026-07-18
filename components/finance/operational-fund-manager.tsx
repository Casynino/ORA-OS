"use client";

import { useRef, useState, useTransition } from "react";
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
  Send,
} from "lucide-react";
import {
  requestOperationalFunds,
  approveOperationalFundRequest,
  rejectOperationalFundRequest,
  recordOperationalExpense,
  removeOperationalExpense,
  issueOperationalFunds,
  confirmOperationalFundReceipt,
  cancelIssuedFund,
} from "@/lib/actions/operational-fund";
import type { FundRequestRow, FundExpenseRow, FundItemRow } from "@/lib/services/operational-fund";
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
import { CompanyAccountSelect, type SelectableAccount } from "@/components/ui/account-select";
import { CategorySelect } from "@/components/ui/category-select";
import { toast } from "@/components/ui/use-toast";
import { cn, formatCurrency, formatDate, formatNumber, timeAgo } from "@/lib/utils";
import type { ExpenseCategory } from "@prisma/client";
import type { CategoryOption } from "@/lib/expense-categories";

type Fund = {
  balance: number;
  funded: number;
  spent: number;
  spentThisMonth: number;
  pendingTotal: number;
  pending: FundRequestRow[];
  issued: FundRequestRow[];
  issuedTotal: number;
  requests: FundRequestRow[];
  expenses: FundExpenseRow[];
  byCategory: { category: ExpenseCategory; amount: number }[];
};

const STATUS_VARIANT: Record<string, "warning" | "success" | "destructive" | "secondary" | "info"> = {
  PENDING: "warning",
  ISSUED: "info",
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
  accounts = [],
  categories = [],
  canManage = false,
  canApprove = false,
}: {
  fund: Fund;
  /** Company accounts the CEO can issue funds FROM (approval only). */
  accounts?: SelectableAccount[];
  /** Pickable expense categories (presets + custom) for the request builder. */
  categories?: CategoryOption[];
  /** Finance can request funds + record spending. */
  canManage?: boolean;
  /** CEO/admin can approve/reject funding requests. */
  canApprove?: boolean;
}) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [spendOpen, setSpendOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Wallet} label="Current balance" value={formatCurrency(fund.balance)} hint="available to spend" accent="text-success" />
        {fund.issuedTotal > 0 ? (
          <Tile icon={Send} label="Sent — awaiting confirmation" value={formatCurrency(fund.issuedTotal)} hint={`${fund.issued.length} awaiting Finance receipt`} accent="text-info" />
        ) : (
          <Tile icon={Clock} label="Pending requests" value={formatNumber(fund.pending.length)} hint={fund.pendingTotal > 0 ? formatCurrency(fund.pendingTotal) : "none"} accent="text-warning" />
        )}
        <Tile icon={Landmark} label="Total allocated" value={formatCurrency(fund.funded)} hint="company expense, confirmed" accent="text-info" />
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

      {/* Action (CEO) — push funds to Finance without waiting for a request. */}
      {canApprove && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setIssueOpen(true)}>
            <Send className="size-4" /> Issue funds to Finance
          </Button>
          <span className="self-center text-xs text-muted-foreground">
            Finance confirms receipt before it&apos;s booked as an expense.
          </span>
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
                Approving funds the request from a company account now — the money leaves that account and is booked as company expenses. Finance then confirms receipt to unlock the spendable balance.
              </p>
            )}
          </div>
          <div className="space-y-2">
            {fund.pending.map((r) => (
              <div key={r.id} className="rounded-2xl border border-warning/30 bg-warning/[0.04] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-display font-semibold">
                      {formatCurrency(r.amount)}
                      <span className="text-sm font-normal text-muted-foreground">· {r.purpose}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.code} · by {r.requestedBy} · {timeAgo(r.createdAt)}
                    </p>
                    <ItemLines items={r.items} />
                    {r.note && <p className="mt-1 text-xs text-muted-foreground">Note: {r.note}</p>}
                  </div>
                  {canApprove ? (
                    <ApproveControls id={r.id} accounts={accounts} />
                  ) : (
                    <Badge variant="warning">Awaiting CEO</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CEO-issued funds awaiting Finance's receipt confirmation */}
      {fund.issued.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-lg font-semibold">
              {canManage ? "Funds sent to you — confirm receipt" : "Sent — awaiting Finance confirmation"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {canManage
                ? "The money has been sent to you (already booked as a company expense). Confirm once you've received the cash — that unlocks your spendable balance."
                : "The money has already left the account and is booked as an expense. Recall it to reverse the money-out if Finance didn't receive it."}
            </p>
          </div>
          <div className="space-y-2">
            {fund.issued.map((r) => (
              <div key={r.id} className="rounded-2xl border border-info/30 bg-info/[0.04] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-display font-semibold">
                      {formatCurrency(r.amount)}
                      <span className="text-sm font-normal text-muted-foreground">· {r.purpose}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.code} · sent {timeAgo(r.createdAt)}
                      {r.account ? ` · from ${r.account}` : ""}
                    </p>
                    <ItemLines items={r.items} />
                    {r.note && <p className="mt-1 text-xs text-muted-foreground">Note: {r.note}</p>}
                  </div>
                  {canManage ? (
                    <ConfirmReceiptControl id={r.id} amount={r.amount} />
                  ) : canApprove ? (
                    <CancelIssueControl id={r.id} />
                  ) : (
                    <Badge variant="info">Awaiting Finance</Badge>
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

      {requestOpen && <RequestModal categories={categories} onClose={() => setRequestOpen(false)} />}
      {spendOpen && <SpendModal balance={fund.balance} onClose={() => setSpendOpen(false)} />}
      {issueOpen && <IssueModal accounts={accounts} onClose={() => setIssueOpen(false)} />}
    </div>
  );
}

/** CEO pushes funds to Finance — one or more line items in a single allocation.
 *  Money-out is booked now (one Expense per line); Finance confirms receipt. */
type SimpleLine = { key: number; category: string; description: string; amount: string; vendor?: string };
function IssueModal({ accounts, onClose }: { accounts: SelectableAccount[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [purpose, setPurpose] = useState("");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");
  const nextKey = useRef(2);
  const [items, setItems] = useState<SimpleLine[]>([{ key: 1, category: "OFFICE", description: "", amount: "" }]);

  const total = items.reduce((s, it) => s + Math.round(Number(it.amount) || 0), 0);
  const addItem = () => setItems((p) => [...p, { key: nextKey.current++, category: "OFFICE", description: "", amount: "" }]);
  const removeItem = (key: number) => setItems((p) => (p.length > 1 ? p.filter((i) => i.key !== key) : p));
  const patch = (key: number, ch: Partial<SimpleLine>) => setItems((p) => p.map((i) => (i.key === key ? { ...i, ...ch } : i)));

  function submit() {
    if (purpose.trim().length < 3) return toast({ variant: "error", title: "What are the funds for?" });
    const parsed = items.map((it) => ({ category: it.category, description: it.description.trim() || undefined, amount: Math.round(Number(it.amount) || 0) }));
    if (parsed.some((it) => it.amount <= 0))
      return toast({ variant: "error", title: "Give every item an amount." });
    start(async () => {
      const res = await issueOperationalFunds({
        purpose: purpose.trim(), items: parsed as never,
        paymentAccountId: accountId || undefined, note: note.trim() || undefined,
      });
      if (res.ok) { toast({ variant: "success", title: res.message }); onClose(); router.refresh(); }
      else toast({ variant: "error", title: res.error });
    });
  }
  return (
    <Modal open onClose={onClose} title="Issue funds to Finance" description="Push money to the Operational Fund without waiting for a request — add one or more line items. Finance confirms receipt before it's booked as a company expense.">
      <div className="space-y-4">
        <div>
          <Label>Purpose *</Label>
          <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="mt-1.5" placeholder="e.g. Weekly operations float" />
        </div>
        <div className="space-y-2">
          <Label>Items *</Label>
          {items.map((it) => (
            <div key={it.key} className="flex items-center gap-2 rounded-xl border border-border p-2.5">
              <div className="min-w-0 flex-1">
                <Select value={it.category} onChange={(e) => patch(it.key, { category: e.target.value })}>
                  {OFFICE_FUND_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{EXPENSE_LABELS[c]}</option>
                  ))}
                </Select>
              </div>
              <Input type="number" min={1} value={it.amount} onChange={(e) => patch(it.key, { amount: e.target.value })} placeholder="Amount" className="w-28 shrink-0" />
              {items.length > 1 && (
                <button type="button" onClick={() => removeItem(it.key)} className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive" aria-label="Remove item">
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addItem}>
            <Plus className="size-4" /> Add item
          </Button>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">Total to issue</span>
          <span className="font-display text-lg font-bold">{formatCurrency(total)}</span>
        </div>
        <CompanyAccountSelect accounts={accounts} value={accountId} onChange={setAccountId} label="Issue from account" />
        <div>
          <Label>Note (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" placeholder="Anything Finance should know" />
        </div>
        <Button className="w-full" onClick={submit} disabled={pending || total <= 0}>
          {pending ? "Issuing…" : "Issue to Finance"}
        </Button>
      </div>
    </Modal>
  );
}

/** Finance confirms it received CEO-issued funds → books the expense. */
function ConfirmReceiptControl({ id, amount }: { id: string; amount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button size="sm" variant="success" className="shrink-0" disabled={pending} onClick={() => setConfirming(true)}>
        <Check className="size-3.5" /> Confirm receipt
      </Button>
    );
  }
  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <span className="text-xs text-muted-foreground">Confirm you received {formatCurrency(amount)}?</span>
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>Cancel</Button>
        <Button size="sm" variant="success" disabled={pending} onClick={() => start(async () => {
          const res = await confirmOperationalFundReceipt(id);
          if (res.ok) { toast({ variant: "success", title: res.message }); router.refresh(); }
          else { toast({ variant: "error", title: res.error }); setConfirming(false); }
        })}>{pending ? "Confirming…" : "Yes, received"}</Button>
      </div>
    </div>
  );
}

/** CEO recalls a not-yet-confirmed allocation — reverses the money-out. */
function CancelIssueControl({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <Badge variant="info">Awaiting Finance</Badge>
      {confirm ? (
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => start(async () => {
          const res = await cancelIssuedFund(id);
          if (res.ok) { toast({ variant: "success", title: res.message }); router.refresh(); }
          else { toast({ variant: "error", title: res.error }); setConfirm(false); }
        })}>{pending ? "…" : "Recall funds?"}</Button>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="text-xs text-muted-foreground hover:text-destructive">
          Recall
        </button>
      )}
    </div>
  );
}

/** Compact line-item list shown under a request's header. */
function ItemLines({ items }: { items: FundItemRow[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-2 space-y-0.5 rounded-lg border border-border/60 bg-background/50 px-3 py-2">
      {items.map((it) => (
        <div key={it.id} className="flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 truncate">
            <span className="text-muted-foreground">{it.label}</span> · {it.description}
          </span>
          <span className="shrink-0 font-medium">{formatCurrency(it.amount)}</span>
        </div>
      ))}
    </div>
  );
}

function ApproveControls({ id, accounts }: { id: string; accounts: SelectableAccount[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [accountId, setAccountId] = useState("");
  function decide(kind: "approve" | "reject") {
    start(async () => {
      const res = kind === "approve"
        ? await approveOperationalFundRequest(id, accountId || undefined)
        : await rejectOperationalFundRequest(id, note.trim() || undefined);
      if (res.ok) { toast({ variant: "success", title: res.message }); router.refresh(); }
      else toast({ variant: "error", title: res.error });
    });
  }
  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      {accounts.length > 0 && (
        <div className="w-52 text-left">
          <CompanyAccountSelect accounts={accounts} value={accountId} onChange={setAccountId} label="Issue from account" />
        </div>
      )}
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

type DraftItem = { key: number; category: string; customCategory: string | null; description: string; amount: string };

function RequestModal({ categories, onClose }: { categories: CategoryOption[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [purpose, setPurpose] = useState("");
  const [note, setNote] = useState("");
  const nextKey = useRef(2);
  const [items, setItems] = useState<DraftItem[]>([
    { key: 1, category: "OFFICE", customCategory: null, description: "", amount: "" },
  ]);

  const total = items.reduce((s, it) => s + Math.round(Number(it.amount) || 0), 0);
  const addItem = () =>
    setItems((prev) => [...prev, { key: nextKey.current++, category: "OFFICE", customCategory: null, description: "", amount: "" }]);
  const removeItem = (key: number) => setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.key !== key) : prev));
  const patch = (key: number, p: Partial<DraftItem>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...p } : i)));

  function submit() {
    if (purpose.trim().length < 3) return toast({ variant: "error", title: "What is this request for?" });
    const parsed = items.map((it) => ({
      category: it.category,
      customCategory: it.customCategory ?? undefined,
      description: it.description.trim() || undefined,
      amount: Math.round(Number(it.amount) || 0),
    }));
    if (parsed.some((it) => it.amount <= 0))
      return toast({ variant: "error", title: "Give every item an amount." });
    start(async () => {
      const res = await requestOperationalFunds({ purpose: purpose.trim(), items: parsed as never, note: note.trim() || undefined });
      if (res.ok) { toast({ variant: "success", title: res.message }); onClose(); router.refresh(); }
      else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <Modal open onClose={onClose} title="Request operational funds" description="Build a request with one or more line items — the CEO approves and funds the total from a company account.">
      <div className="space-y-4">
        <div>
          <Label>Purpose *</Label>
          <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="mt-1.5" placeholder="e.g. Weekly office operations" />
        </div>
        <div className="space-y-2">
          <Label>Items *</Label>
          {items.map((it) => (
            <div key={it.key} className="flex items-start gap-2 rounded-xl border border-border p-2.5">
              <div className="min-w-0 flex-1">
                <CategorySelect
                  categories={categories}
                  category={it.category}
                  customCategory={it.customCategory}
                  onChange={(v) => patch(it.key, v)}
                  label=""
                />
              </div>
              <Input type="number" min={1} value={it.amount} onChange={(e) => patch(it.key, { amount: e.target.value })} placeholder="Amount" className="w-28 shrink-0" />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(it.key)}
                  className="mt-1 shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Remove item"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addItem}>
            <Plus className="size-4" /> Add item
          </Button>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">Total requested</span>
          <span className="font-display text-lg font-bold">{formatCurrency(total)}</span>
        </div>
        <div>
          <Label>Notes (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" placeholder="Anything the CEO should know" />
        </div>
        <Button className="w-full" onClick={submit} disabled={pending || total <= 0}>
          {pending ? "Sending…" : "Send to CEO for approval"}
        </Button>
      </div>
    </Modal>
  );
}

function SpendModal({ balance, onClose }: { balance: number; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const nextKey = useRef(2);
  const [items, setItems] = useState<SimpleLine[]>([{ key: 1, category: "OFFICE", description: "", amount: "", vendor: "" }]);
  const [receiptRef, setReceiptRef] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [note, setNote] = useState("");

  const total = items.reduce((s, it) => s + Math.round(Number(it.amount) || 0), 0);
  const addItem = () => setItems((p) => [...p, { key: nextKey.current++, category: "OFFICE", description: "", amount: "", vendor: "" }]);
  const removeItem = (key: number) => setItems((p) => (p.length > 1 ? p.filter((i) => i.key !== key) : p));
  const patch = (key: number, ch: Partial<SimpleLine>) => setItems((p) => p.map((i) => (i.key === key ? { ...i, ...ch } : i)));

  function submit() {
    const parsed = items.map((it) => ({ category: it.category, amount: Math.round(Number(it.amount) || 0), vendor: it.vendor?.trim() || undefined }));
    if (parsed.some((it) => it.amount <= 0))
      return toast({ variant: "error", title: "Give every item an amount." });
    if (total > balance) return toast({ variant: "error", title: `Only ${formatCurrency(balance)} left in the fund.` });
    start(async () => {
      const res = await recordOperationalExpense({
        items: parsed as never,
        receiptRef: receiptRef.trim() || undefined,
        receiptUrl: receiptUrl || undefined, note: note.trim() || undefined,
      });
      if (res.ok) { toast({ variant: "success", title: res.message }); onClose(); router.refresh(); }
      else toast({ variant: "error", title: res.error });
    });
  }
  const over = total > balance;
  return (
    <Modal open onClose={onClose} title="Record an expense" description={`Money spent from the Operational Fund — add one or more items. ${formatCurrency(balance)} available.`}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Items *</Label>
          {items.map((it) => (
            <div key={it.key} className="space-y-2 rounded-xl border border-border p-2.5">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Select value={it.category} onChange={(e) => patch(it.key, { category: e.target.value })}>
                    {OFFICE_FUND_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{EXPENSE_LABELS[c]}</option>
                    ))}
                  </Select>
                </div>
                <Input type="number" min={1} value={it.amount} onChange={(e) => patch(it.key, { amount: e.target.value })} placeholder="Amount" className="w-28 shrink-0" />
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(it.key)} className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive" aria-label="Remove item">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              <Input value={it.vendor ?? ""} onChange={(e) => patch(it.key, { vendor: e.target.value })} placeholder="Vendor / payee — who was paid (optional)" className="h-9" />
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addItem}>
            <Plus className="size-4" /> Add item
          </Button>
        </div>
        <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${over ? "bg-destructive/10" : "bg-muted/40"}`}>
          <span className="text-sm font-medium">Total spent</span>
          <span className={`font-display text-lg font-bold ${over ? "text-destructive" : ""}`}>{formatCurrency(total)}</span>
        </div>
        {over && <p className="text-xs text-destructive">Exceeds the {formatCurrency(balance)} available in the fund.</p>}
        {/* Vendor is per line above; the spend date is stamped automatically. */}
        <div>
          <Label>Receipt / voucher reference</Label>
          <Input value={receiptRef} onChange={(e) => setReceiptRef(e.target.value)} className="mt-1.5" placeholder="Optional — shared across items" />
        </div>
        <div>
          <Label className="mb-1.5 block">Supporting document (receipt / invoice / voucher)</Label>
          <ProofUpload value={receiptUrl} onChange={setReceiptUrl} label="Attach supporting document" />
        </div>
        <div>
          <Label>Notes (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
        </div>
        <Button className="w-full" onClick={submit} disabled={pending || total <= 0 || over}>
          {pending ? "Recording…" : items.length > 1 ? `Record ${items.length} expenses · ${formatCurrency(total)}` : "Record expense"}
        </Button>
      </div>
    </Modal>
  );
}
