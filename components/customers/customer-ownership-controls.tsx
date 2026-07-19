"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, HandCoins } from "lucide-react";
import { setFieldCustomerRep, recordOpeningBalance } from "@/lib/actions/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

/** ADMIN/FINANCE assign (or clear) the sales rep who manages this customer. */
export function AssignRepControl({
  customerId,
  currentRepId,
  reps,
}: {
  customerId: string;
  currentRepId: string | null;
  reps: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [repId, setRepId] = useState(currentRepId ?? "");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await setFieldCustomerRep(customerId, repId || null);
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <BadgeCheck className="size-4 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Managing sales rep
        </p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        The rep who owns this relationship. Leave unassigned to keep it under Finance/Admin.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <select
          value={repId}
          onChange={(e) => setRepId(e.target.value)}
          className="h-9 min-w-[12rem] flex-1 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">Unassigned — managed by Finance/Admin</option>
          {reps.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <Button
          size="sm"
          className="rounded-full"
          disabled={pending || repId === (currentRepId ?? "")}
          onClick={save}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

/** ADMIN/FINANCE record a pre-ORA-OS debt (opening balance) for this customer —
 * a migrated credit receivable with a fresh due date. Not a new sale. */
export function RecordOpeningBalanceButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ variant: "error", title: "Enter the outstanding amount." });
      return;
    }
    if (!dueDate) {
      toast({ variant: "error", title: "Set a payment due date." });
      return;
    }
    start(async () => {
      const res = await recordOpeningBalance(customerId, {
        amount: Math.round(amt),
        creditStartDate: startDate || "",
        dueDate,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        setAmount(""); setStartDate(""); setDueDate("");
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  if (!open)
    return (
      <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOpen(true)}>
        <HandCoins className="mr-1.5 size-4" /> Record opening balance
      </Button>
    );

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <HandCoins className="size-4 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Opening balance (existing debt)
        </p>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        A debt this customer already owed before ORA OS. It becomes an outstanding credit
        balance you can collect against — it is not counted as a new sale.
      </p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        <div>
          <label className="text-xs text-muted-foreground">Outstanding (TSh)</label>
          <Input type="number" inputMode="numeric" min={1} placeholder="e.g. 850000" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-9" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Credit start date</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 h-9" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Due date *</label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 h-9" />
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" className="rounded-full" disabled={pending} onClick={submit}>
          {pending ? "Recording…" : "Record balance"}
        </Button>
      </div>
    </div>
  );
}
