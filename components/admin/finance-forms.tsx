"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  recordExpense,
  removeExpense,
  recordCapital,
  removeCapital,
} from "@/lib/actions/finance";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

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
  { group: "Other", items: [{ value: "OTHER", label: "Miscellaneous" }] },
];

export function AddExpenseButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("RENT");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [method, setMethod] = useState("Cash");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    start(async () => {
      const res = await recordExpense({
        category: category as never,
        amount: Number(amount) || 0,
        purpose,
        paymentMethod: method,
        expenseDate: date,
        note,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        setAmount(""); setPurpose(""); setNote(""); setDate("");
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <>
      <Button size="sm" className="rounded-full" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Record expense
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Record an expense"
          description="Every shilling leaving ORA gets a category and a record."
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
                <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5" placeholder="e.g. 50000" />
              </div>
            </div>
            <div>
              <Label>Purpose</Label>
              <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="mt-1.5" placeholder="e.g. June office rent" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Payment method</Label>
                <Select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1.5">
                  <option>Cash</option>
                  <option>Mobile money</option>
                  <option>Bank</option>
                </Select>
              </div>
              <div>
                <Label>Date (optional)</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
            </div>
            <Button className="w-full rounded-full" disabled={pending || !amount || purpose.trim().length < 3} onClick={submit}>
              {pending ? "Recording…" : "Record expense"}
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

export function AddCapitalButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("FOUNDER_INVESTMENT");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    start(async () => {
      const res = await recordCapital({
        type: type as never,
        amount: Number(amount) || 0,
        source,
        entryDate: date,
        note,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        setAmount(""); setSource(""); setNote(""); setDate("");
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <>
      <Button size="sm" className="rounded-full" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Record capital
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Record capital"
          description="Money injected into ORA — founder investment, reinvested profit, grants."
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
            <Button className="w-full rounded-full" disabled={pending || !amount || source.trim().length < 2} onClick={submit}>
              {pending ? "Recording…" : "Record capital"}
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
        if (!window.confirm("Remove this capital entry? This is logged.")) return;
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
