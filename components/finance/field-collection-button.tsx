"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HandCoins } from "lucide-react";
import { recordFieldCollection } from "@/lib/actions/field";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ReceivingAccountPicker,
  METHOD_LABELS,
  type ReceivingAccount,
} from "@/components/ui/receiving-account-picker";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";

/**
 * Finance collects a payment against a field-customer credit sale. Records the
 * amount, how it was received (cash / bank / mobile) and into which official
 * account, and posts it to the customer's balance immediately.
 */
export function FieldCollectionButton({
  saleId,
  saleCode,
  owing,
  accounts,
}: {
  saleId: string;
  saleCode: string;
  owing: number;
  accounts: ReceivingAccount[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(owing));
  const firstMethod = accounts[0]?.type ?? "CASH";
  const [method, setMethod] = useState(firstMethod);
  const [accountId, setAccountId] = useState(
    accounts.find((a) => a.type === firstMethod)?.id ?? accounts[0]?.id ?? "",
  );
  const [reference, setReference] = useState("");

  const amt = Math.round(Number(amount) || 0);

  function submit() {
    if (amt <= 0) {
      toast({ variant: "error", title: "Enter the amount received." });
      return;
    }
    if (amt > owing) {
      toast({ variant: "error", title: `That's more than the ${formatCurrency(owing)} owed.` });
      return;
    }
    if (accounts.length > 0 && !accountId) {
      toast({ variant: "error", title: "Choose which account received the money." });
      return;
    }
    start(async () => {
      const res = await recordFieldCollection({
        saleId,
        amount: amt,
        method: METHOD_LABELS[method] ?? method,
        paymentAccountId: accountId || undefined,
        reference: reference || undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message ?? "Payment recorded." });
        setOpen(false);
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="success" onClick={() => setOpen(true)}>
        <HandCoins className="size-3.5" /> Record payment
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={`Record payment · ${saleCode}`}
          description={`Money the customer paid — it posts to their balance immediately (owing ${formatCurrency(owing)}).`}
        >
          <div className="space-y-4">
            <div>
              <Label>Amount received (TSh)</Label>
              <Input
                type="number"
                min={1}
                max={owing}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <ReceivingAccountPicker
              accounts={accounts}
              method={method}
              accountId={accountId}
              reference={reference}
              onMethod={setMethod}
              onAccount={setAccountId}
              onReference={setReference}
            />
            <Button className="w-full" onClick={submit} disabled={pending}>
              {pending ? "Recording…" : "Record payment"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
