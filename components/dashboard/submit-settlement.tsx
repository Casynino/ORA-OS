"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import { submitSettlement } from "@/lib/actions/settlements";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  ReceivingAccountPicker,
  METHOD_LABELS,
  type ReceivingAccount,
} from "@/components/ui/receiving-account-picker";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";

export type SettlementAccount = { id: string; code: string; remaining: number };

export function SubmitSettlement({
  accounts,
  receivingAccounts = [],
}: {
  accounts: SettlementAccount[];
  receivingAccounts?: ReceivingAccount[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(
    receivingAccounts[0]?.type ?? "MOBILE_MONEY",
  );
  const [payAccountId, setPayAccountId] = useState("");
  const [reference, setReference] = useState("");

  const selected = accounts.find((a) => a.id === accountId);

  if (accounts.length === 0) return null;

  function submit() {
    const amt = Number(amount);
    if (!accountId) return toast({ variant: "error", title: "Choose a credit batch." });
    if (!amt || amt < 1) return toast({ variant: "error", title: "Enter an amount." });
    if (selected && amt > selected.remaining)
      return toast({ variant: "error", title: `Max ${formatCurrency(selected.remaining)} on this batch.` });
    if (receivingAccounts.length > 0 && !payAccountId)
      return toast({ variant: "error", title: "Choose where you paid." });
    start(async () => {
      const res = await submitSettlement({
        creditAccountId: accountId,
        amount: amt,
        method: METHOD_LABELS[method] ?? method,
        paymentAccountId: payAccountId || undefined,
        reference: reference || undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        setAmount("");
        setReference("");
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Banknote className="size-4" />
        Submit a payment
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Submit a payment"
          description="Tell the ORA team about a payment you've made. They confirm it and it posts to your balance."
        >
          <div className="space-y-4">
            <div>
              <Label>Credit batch</Label>
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-1.5">
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {formatCurrency(a.remaining)} left
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                min={1}
                max={selected?.remaining}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <ReceivingAccountPicker
              accounts={receivingAccounts}
              method={method}
              accountId={payAccountId}
              reference={reference}
              onMethod={setMethod}
              onAccount={setPayAccountId}
              onReference={setReference}
              payerView
            />
            <Button className="w-full" onClick={submit} disabled={pending}>
              {pending ? "Submitting…" : "Submit for confirmation"}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Your balance changes only once the ORA team confirms the payment.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
