"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HandCoins } from "lucide-react";
import { recordFieldCollection } from "@/lib/actions/field";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ReceivingAccountPicker,
  METHOD_LABELS,
  type ReceivingAccount,
} from "@/components/ui/receiving-account-picker";
import { ProofUpload } from "@/components/ui/proof-upload";
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
  claim = false,
}: {
  saleId: string;
  saleCode: string;
  owing: number;
  accounts: ReceivingAccount[];
  /** A rep's collection is a CLAIM — it only reduces the balance once finance
   * verifies it. Admin/Finance collections post immediately. */
  claim?: boolean;
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
  const [note, setNote] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const isCheque = method === "CHEQUE";

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
    if (!isCheque && accounts.length > 0 && !accountId) {
      toast({ variant: "error", title: "Choose which account received the money." });
      return;
    }
    if (isCheque && (!chequeBank.trim() || !chequeNumber.trim() || !chequeDate)) {
      toast({ variant: "error", title: "Enter the cheque bank, number and date." });
      return;
    }
    if (isCheque && !proofUrl) {
      toast({ variant: "error", title: "Attach a photo of the cheque." });
      return;
    }
    start(async () => {
      const res = await recordFieldCollection({
        saleId,
        amount: amt,
        method: METHOD_LABELS[method] ?? method,
        paymentAccountId: isCheque ? undefined : accountId || undefined,
        reference: reference || undefined,
        note: note.trim() || undefined,
        paymentProofUrl: proofUrl || undefined,
        chequeBank: isCheque ? chequeBank : undefined,
        chequeNumber: isCheque ? chequeNumber : undefined,
        chequeDate: isCheque ? chequeDate : undefined,
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
          description={
            claim
              ? `Money the customer paid — finance verifies it, then it reduces the balance (owing ${formatCurrency(owing)}).`
              : `Money the customer paid — it posts to their balance immediately (owing ${formatCurrency(owing)}).`
          }
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
            {isCheque && (
              <div className="grid gap-2.5 rounded-xl border border-primary/30 bg-primary/[0.03] p-3 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <p className="text-xs font-medium text-foreground">Cheque details</p>
                  <p className="text-[11px] text-muted-foreground">
                    Finance verifies the cheque before it clears the balance.
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Bank name *</Label>
                  <Input value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} placeholder="e.g. NMB Bank" className="mt-1 h-9" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cheque number *</Label>
                  <Input value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} placeholder="e.g. 001234" className="mt-1 h-9" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cheque date *</Label>
                  <Input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} className="mt-1 h-9" />
                </div>
              </div>
            )}
            <div>
              <Label className="mb-1.5 block">
                {isCheque ? "Cheque photo *" : "Payment proof (optional)"}
              </Label>
              <ProofUpload value={proofUrl} onChange={setProofUrl} label={isCheque ? "Attach cheque photo" : "Attach receipt / screenshot"} />
            </div>
            <div>
              <Label className="mb-1.5 block">Note (optional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Anything worth saying about this payment — e.g. part payment, promised the rest on Friday, paid by the shop owner's brother."
              />
            </div>
            <Button className="w-full" onClick={submit} disabled={pending}>
              {pending ? "Recording…" : "Record payment"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
