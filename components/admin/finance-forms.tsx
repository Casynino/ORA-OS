"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Receipt, TrendingUp, TrendingDown, Send } from "lucide-react";
import {
  recordExpense,
  removeExpense,
  recordCapital,
  removeCapital,
} from "@/lib/actions/finance";
import { issueOperationalFunds } from "@/lib/actions/operational-fund";
import { OFFICE_FUND_CATEGORIES } from "@/lib/expense-categories";
import { EXPENSE_LABELS } from "@/lib/expense-categories";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ProofUpload } from "@/components/ui/proof-upload";
import { CompanyAccountSelect, type SelectableAccount } from "@/components/ui/account-select";
import { toast } from "@/components/ui/use-toast";

// Any Button look these action buttons may be styled with (kept in sync with
// the Button component's variants so the hero can vary them for visual rhythm).
type BtnVariant = "default" | "accent" | "secondary" | "outline" | "ghost" | "destructive" | "success";

const EXPENSE_OPTIONS: { group: string; items: { value: string; label: string }[] }[] = [
  {
    group: "Operational",
    items: [
      { value: "RENT", label: "Office rent" },
      { value: "UTILITIES", label: "Utilities (electricity, internet)" },
      { value: "STATIONERY", label: "Stationery" },
      { value: "OFFICE", label: "Office expenses" },
    ],
  },
  {
    group: "Staff",
    items: [
      { value: "SALARIES", label: "Salaries" },
      { value: "ALLOWANCES", label: "Sales rep allowances" },
      { value: "TRANSPORT_REIMBURSEMENT", label: "Transport reimbursement" },
    ],
  },
  {
    group: "Logistics",
    items: [
      { value: "DELIVERY", label: "Delivery costs" },
      { value: "WAREHOUSE_HANDLING", label: "Warehouse handling" },
      { value: "TRANSPORT_OF_GOODS", label: "Transport of goods" },
    ],
  },
  {
    group: "Business",
    items: [
      { value: "STOCK_PURCHASE", label: "Stock purchase (supplier)" },
      { value: "IMPORT_COSTS", label: "Import costs" },
      { value: "PACKAGING", label: "Packaging materials" },
      { value: "MARKETING", label: "Marketing" },
    ],
  },
  {
    group: "Statutory & tech",
    items: [
      { value: "TAXES", label: "Taxes" },
      { value: "INTERNET", label: "Internet" },
      { value: "EQUIPMENT", label: "Equipment" },
    ],
  },
  { group: "Other", items: [{ value: "OTHER", label: "Custom / other" }] },
];

/**
 * CEO direct-expense form — the same fields Finance uses, but the CEO records
 * AND approves in one step (final authority), so it takes effect immediately
 * and reduces Business Capital automatically.
 */
export function AddExpenseButton({
  accounts = [],
  label = "Record direct expense",
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
  const [category, setCategory] = useState("RENT");
  const [customCategory, setCustomCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [vendor, setVendor] = useState("");
  // Default to the first company account; the CEO can switch to "Other / cheque".
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [method, setMethod] = useState("Cheque"); // only used when no account
  const [date, setDate] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [note, setNote] = useState("");

  function reset() {
    setAmount(""); setPurpose(""); setVendor(""); setNote(""); setDate("");
    setReceiptUrl(""); setCustomCategory(""); setCategory("RENT");
  }

  function submit() {
    if (Number(amount) <= 0) return toast({ variant: "error", title: "Enter the amount." });
    if (purpose.trim().length < 3) return toast({ variant: "error", title: "What was this expense for?" });
    start(async () => {
      const res = await recordExpense({
        category: category as never,
        customCategory: category === "OTHER" ? customCategory.trim() || undefined : undefined,
        amount: Math.round(Number(amount) || 0),
        purpose: purpose.trim(),
        vendor: vendor.trim() || undefined,
        paymentAccountId: accountId || undefined,
        paymentMethod: accountId ? undefined : method,
        expenseDate: date,
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
          description="Paid straight from the company (supplier, rent, marketing…). It takes effect immediately and reduces Business Capital — no approval needed."
        >
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1.5">
                  {EXPENSE_OPTIONS.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.items.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Amount (TSh)</Label>
                <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5" placeholder="e.g. 500000" />
              </div>
            </div>
            {category === "OTHER" && (
              <div>
                <Label>Custom category</Label>
                <Input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} className="mt-1.5" placeholder="e.g. Influencer campaign" />
              </div>
            )}
            <div>
              <Label>Description</Label>
              <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="mt-1.5" placeholder="What it was for" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vendor / payee</Label>
                <Input value={vendor} onChange={(e) => setVendor(e.target.value)} className="mt-1.5" placeholder="Optional — who was paid" />
              </div>
              <div>
                <Label>Date (optional)</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5" />
              </div>
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
            <Button className="w-full rounded-full" disabled={pending || !amount || purpose.trim().length < 3} onClick={submit}>
              {pending ? "Recording…" : "Record & pay from company"}
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

/** CEO pushes funds to Finance from anywhere (e.g. the Finance overview). The
 *  money isn't an expense until Finance confirms receipt. Mirrors the modal on
 *  the Operational Fund page. */
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
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [category, setCategory] = useState("OFFICE");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    if (Number(amount) <= 0) return toast({ variant: "error", title: "Enter an amount." });
    if (purpose.trim().length < 3) return toast({ variant: "error", title: "What are the funds for?" });
    start(async () => {
      const res = await issueOperationalFunds({
        amount: Math.round(Number(amount) || 0),
        purpose: purpose.trim(),
        category: category as never,
        paymentAccountId: accountId || undefined,
        note: note.trim() || undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        setAmount(""); setPurpose(""); setNote(""); setCategory("OFFICE");
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
          description="Push money to the Operational Fund. Finance confirms receipt before it's booked as a company expense."
        >
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (TSh)</Label>
                <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5" placeholder="e.g. 500000" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1.5">
                  {OFFICE_FUND_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{EXPENSE_LABELS[c]}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label>Purpose</Label>
              <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="mt-1.5" placeholder="What the funds are for" />
            </div>
            <CompanyAccountSelect accounts={accounts} value={accountId} onChange={setAccountId} label="Issue from account" />
            <div>
              <Label>Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
            </div>
            <Button className="w-full rounded-full" disabled={pending || !amount || purpose.trim().length < 3} onClick={submit}>
              {pending ? "Issuing…" : "Issue to Finance"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
