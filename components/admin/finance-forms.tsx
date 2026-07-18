"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Receipt, TrendingUp, TrendingDown, Send } from "lucide-react";
import {
  recordExpenses,
  removeExpense,
  recordCapital,
  removeCapital,
} from "@/lib/actions/finance";
import { issueOperationalFunds } from "@/lib/actions/operational-fund";
import { OFFICE_FUND_CATEGORIES, EXPENSE_LABELS } from "@/lib/expense-categories";
import type { CategoryOption } from "@/lib/expense-categories";
import { formatCurrency } from "@/lib/utils";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CategorySelect } from "@/components/ui/category-select";
import { ProofUpload } from "@/components/ui/proof-upload";
import { CompanyAccountSelect, type SelectableAccount } from "@/components/ui/account-select";
import { toast } from "@/components/ui/use-toast";

// Any Button look these action buttons may be styled with (kept in sync with
// the Button component's variants so the hero can vary them for visual rhythm).
type BtnVariant = "default" | "accent" | "secondary" | "outline" | "ghost" | "destructive" | "success";

// One editable expense line in the multi-item builder.
type DraftExpense = { key: number; category: string; customCategory: string | null; purpose: string; amount: string };

/**
 * CEO direct-expense form — record ONE or SEVERAL expenses at once, all paid from
 * the same company account/date/receipt. Each line carries its own category and
 * becomes its own booked expense. The CEO records AND approves in one step (final
 * authority), so it takes effect immediately and reduces Business Capital.
 */
export function AddExpenseButton({
  accounts = [],
  categories = [],
  label = "Record direct expense",
  variant = "default",
  className = "rounded-full",
}: {
  accounts?: SelectableAccount[];
  categories?: CategoryOption[];
  label?: string;
  variant?: BtnVariant;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const keyRef = useRef(2);
  const [items, setItems] = useState<DraftExpense[]>([
    { key: 1, category: "RENT", customCategory: null, purpose: "", amount: "" },
  ]);
  const [vendor, setVendor] = useState("");
  // Default to the first company account; the CEO can switch to "Other / cheque".
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [method, setMethod] = useState("Cheque"); // only used when no account
  const [receiptUrl, setReceiptUrl] = useState("");
  const [note, setNote] = useState("");

  const total = items.reduce((s, it) => s + Math.max(0, Math.round(Number(it.amount) || 0)), 0);
  // Only an amount is required — the category names the expense; the date is the
  // moment it's recorded (stamped automatically).
  const valid = items.every((it) => Number(it.amount) > 0);

  function addItem() {
    setItems((prev) => [
      ...prev,
      { key: keyRef.current++, category: "RENT", customCategory: null, purpose: "", amount: "" },
    ]);
  }
  function removeItem(key: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((it) => it.key !== key)));
  }
  function patch(key: number, changes: Partial<DraftExpense>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...changes } : it)));
  }
  function reset() {
    setItems([{ key: keyRef.current++, category: "RENT", customCategory: null, purpose: "", amount: "" }]);
    setVendor(""); setNote(""); setReceiptUrl("");
  }

  function submit() {
    if (!valid) return toast({ variant: "error", title: "Give every line an amount." });
    start(async () => {
      const res = await recordExpenses({
        items: items.map((it) => ({
          category: it.category as never,
          customCategory: it.customCategory || undefined,
          amount: Math.round(Number(it.amount) || 0),
          purpose: it.purpose.trim() || undefined,
        })),
        vendor: vendor.trim() || undefined,
        paymentAccountId: accountId || undefined,
        paymentMethod: accountId ? undefined : method,
        receiptUrl: receiptUrl || undefined,
        note: note.trim() || undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        reset();
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <>
      <Button size="sm" variant={variant} className={className} onClick={() => setOpen(true)}>
        <Receipt className="size-4" />
        {label}
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Record a direct expense"
          description="Paid straight from the company (supplier, rent, marketing…). Add one line or several — they take effect immediately and reduce Business Capital. No approval needed."
        >
          <div className="space-y-3.5">
            {/* Line items — each filed under its own category */}
            <div className="space-y-2.5">
              {items.map((it, i) => (
                <div key={it.key} className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Item {i + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(it.key)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        aria-label="Remove item"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-[1fr_8rem] items-start gap-2">
                    <CategorySelect
                      categories={categories}
                      category={it.category}
                      customCategory={it.customCategory}
                      onChange={(v) => patch(it.key, v)}
                      label=""
                    />
                    <Input
                      type="number"
                      min={1}
                      value={it.amount}
                      onChange={(e) => patch(it.key, { amount: e.target.value })}
                      placeholder="Amount"
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <Button size="sm" variant="ghost" className="rounded-full" onClick={addItem}>
                  <Plus className="size-3.5" /> Add item
                </Button>
                <div className="text-sm">
                  <span className="text-muted-foreground">Total </span>
                  <span className="font-display font-semibold">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Shared payment envelope — one account / receipt for all lines. The
                date is stamped automatically when the expense is recorded. */}
            <div>
              <Label>Vendor / payee <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} className="mt-1.5" placeholder="Who was paid" />
            </div>
            <CompanyAccountSelect
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
              label="Paid from account"
              allowNone
              noneLabel="Other / cheque (no account)"
            />
            {!accountId && (
              <div>
                <Label>Payment method</Label>
                <Select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1.5">
                  <option>Cheque</option>
                  <option>Bank</option>
                  <option>Mobile money</option>
                  <option>Cash</option>
                </Select>
              </div>
            )}
            <div>
              <Label className="mb-1.5 block">Supporting document (receipt / invoice)</Label>
              <ProofUpload value={receiptUrl} onChange={setReceiptUrl} label="Attach supporting document" />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
            </div>
            <Button className="w-full rounded-full" disabled={pending || !valid} onClick={submit}>
              {pending
                ? "Recording…"
                : items.length > 1
                  ? `Record ${items.length} expenses · ${formatCurrency(total)}`
                  : "Record & pay from company"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function DeleteExpenseButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="rounded-full text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Remove this expense? This is logged.")) return;
        start(async () => {
          const res = await removeExpense(id);
          if (res.ok) toast({ variant: "success", title: res.message });
          else toast({ variant: "error", title: res.error });
          router.refresh();
        });
      }}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

const CAPITAL_OPTIONS = [
  { value: "FOUNDER_INVESTMENT", label: "Founder investment" },
  { value: "INVESTMENT", label: "Investment" },
  { value: "PROFIT_REINVESTED", label: "Profit reinvested" },
  { value: "GRANT", label: "Grant" },
  { value: "OTHER", label: "Other" },
];

/** Owner puts money INTO the business — adds to Business Capital. */
export function AddCapitalButton({
  accounts = [],
  label = "Record investment",
  variant = "default",
  className = "rounded-full",
}: {
  accounts?: SelectableAccount[];
  label?: string;
  variant?: BtnVariant;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("FOUNDER_INVESTMENT");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    start(async () => {
      const res = await recordCapital({
        type: type as never,
        amount: Math.round(Number(amount) || 0),
        source,
        paymentAccountId: accountId || undefined,
        entryDate: date,
        receiptUrl: receiptUrl || undefined,
        note,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        setAmount(""); setSource(""); setNote(""); setDate(""); setReceiptUrl("");
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <>
      <Button size="sm" variant={variant} className={className} onClick={() => setOpen(true)}>
        <TrendingUp className="size-4" />
        {label}
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Record investment"
          description="Money put into ORA — founder investment, reinvested profit, grants. Adds to Business Capital."
        >
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={type} onChange={(e) => setType(e.target.value)} className="mt-1.5">
                  {CAPITAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Amount (TSh)</Label>
                <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Source</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} className="mt-1.5" placeholder="e.g. Founder — Nino" />
            </div>
            <CompanyAccountSelect
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
              label="Deposit into account"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date (optional)</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Supporting document (optional)</Label>
              <ProofUpload value={receiptUrl} onChange={setReceiptUrl} label="Attach document" />
            </div>
            <Button className="w-full rounded-full" disabled={pending || !amount || source.trim().length < 2} onClick={submit}>
              {pending ? "Recording…" : "Record investment"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Owner takes money OUT of the business — reduces Business Capital (recorded as
 *  a negative capital movement; can't exceed what's available). */
export function RecordWithdrawalButton({
  accounts = [],
  label = "Record withdrawal",
  variant = "outline",
  className = "rounded-full",
}: {
  accounts?: SelectableAccount[];
  label?: string;
  variant?: BtnVariant;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    start(async () => {
      const res = await recordCapital({
        type: "WITHDRAWAL" as never,
        amount: Math.round(Number(amount) || 0),
        source,
        paymentAccountId: accountId || undefined,
        entryDate: date,
        receiptUrl: receiptUrl || undefined,
        note,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        setAmount(""); setSource(""); setNote(""); setDate(""); setReceiptUrl("");
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <>
      <Button size="sm" variant={variant} className={className} onClick={() => setOpen(true)}>
        <TrendingDown className="size-4" />
        {label}
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Record owner withdrawal"
          description="Money the owner takes out of the business. Reduces Business Capital — can't exceed what's available."
        >
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (TSh)</Label>
                <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Date (optional)</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Paid to / reason</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} className="mt-1.5" placeholder="e.g. Owner drawings — Nino" />
            </div>
            <CompanyAccountSelect
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
              label="From account"
            />
            <div>
              <Label className="mb-1.5 block">Supporting document (optional)</Label>
              <ProofUpload value={receiptUrl} onChange={setReceiptUrl} label="Attach document" />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
            </div>
            <Button className="w-full rounded-full" variant="destructive" disabled={pending || !amount || source.trim().length < 2} onClick={submit}>
              {pending ? "Recording…" : "Record withdrawal"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function DeleteCapitalButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="rounded-full text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Remove this capital movement? This is logged.")) return;
        start(async () => {
          const res = await removeCapital(id);
          if (res.ok) toast({ variant: "success", title: res.message });
          else toast({ variant: "error", title: res.error });
          router.refresh();
        });
      }}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

// One line of a multi-item fund issue: office-fund category + description + amount.
type IssueLine = { key: number; category: string; description: string; amount: string };

/** CEO pushes funds to Finance from anywhere (e.g. the Finance overview) — one or
 *  more line items. The money isn't spendable until Finance confirms receipt.
 *  Mirrors the multi-item modal on the Operational Fund page. */
export function IssueFundsButton({
  accounts = [],
  label = "Issue funds to Finance",
  variant = "default",
  className = "rounded-full",
}: {
  accounts?: SelectableAccount[];
  label?: string;
  variant?: BtnVariant;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const keyRef = useRef(2);
  const [items, setItems] = useState<IssueLine[]>([{ key: 1, category: "OFFICE", description: "", amount: "" }]);
  const [purpose, setPurpose] = useState("");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");

  const total = items.reduce((s, it) => s + Math.round(Number(it.amount) || 0), 0);
  const addItem = () => setItems((p) => [...p, { key: keyRef.current++, category: "OFFICE", description: "", amount: "" }]);
  const removeItem = (key: number) => setItems((p) => (p.length > 1 ? p.filter((i) => i.key !== key) : p));
  const patch = (key: number, ch: Partial<IssueLine>) => setItems((p) => p.map((i) => (i.key === key ? { ...i, ...ch } : i)));
  function reset() {
    setItems([{ key: keyRef.current++, category: "OFFICE", description: "", amount: "" }]);
    setPurpose(""); setNote("");
  }

  function submit() {
    if (purpose.trim().length < 3) return toast({ variant: "error", title: "What are the funds for?" });
    const parsed = items.map((it) => ({ category: it.category, description: it.description.trim() || undefined, amount: Math.round(Number(it.amount) || 0) }));
    if (parsed.some((it) => it.amount <= 0))
      return toast({ variant: "error", title: "Give every item an amount." });
    start(async () => {
      const res = await issueOperationalFunds({
        purpose: purpose.trim(),
        items: parsed as never,
        paymentAccountId: accountId || undefined,
        note: note.trim() || undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        reset();
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <>
      <Button size="sm" variant={variant} className={className} onClick={() => setOpen(true)}>
        <Send className="size-4" />
        {label}
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Issue funds to Finance"
          description="Push money to the Operational Fund — add one or more line items. Finance confirms receipt before it's booked as a company expense."
        >
          <div className="space-y-3.5">
            <div>
              <Label>Purpose</Label>
              <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="mt-1.5" placeholder="e.g. Weekly operations float" />
            </div>
            <div className="space-y-2">
              <Label>Items</Label>
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
              <Button size="sm" variant="outline" className="rounded-full" onClick={addItem}>
                <Plus className="size-3.5" /> Add item
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
              <span className="text-sm font-medium">Total to issue</span>
              <span className="font-display text-lg font-bold">{formatCurrency(total)}</span>
            </div>
            <CompanyAccountSelect accounts={accounts} value={accountId} onChange={setAccountId} label="Issue from account" />
            <div>
              <Label>Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
            </div>
            <Button className="w-full rounded-full" disabled={pending || total <= 0} onClick={submit}>
              {pending ? "Issuing…" : items.length > 1 ? `Issue ${items.length} items · ${formatCurrency(total)}` : "Issue to Finance"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
