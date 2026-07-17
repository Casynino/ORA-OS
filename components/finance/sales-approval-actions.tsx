"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Landmark } from "lucide-react";
import {
  approveFieldSale,
  rejectFieldSale,
  approveFieldCollection,
  rejectFieldCollection,
  type ConfirmDeposit,
} from "@/lib/actions/finance-approvals";
import { ActionButton } from "@/components/dashboard/action-button";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ProofUpload } from "@/components/ui/proof-upload";
import { toast } from "@/components/ui/use-toast";
import type { ActionResult } from "@/lib/types";

// Structured verification-failure reasons for direct/cash payments.
const REJECT_REASONS = [
  "Payment not received",
  "Incorrect amount",
  "Invalid receipt",
  "Duplicate receipt",
  "Other",
] as const;

export type DepositAccount = {
  id: string;
  name: string;
  type: string;
  accountNumber: string | null;
};

/** Verification-failure modal — finance picks a structured reason (+ optional
 * detail) so the rep knows exactly what to fix. */
function RejectModal({
  title,
  onReject,
  onClose,
}: {
  title: string;
  onReject: (note: string) => Promise<ActionResult>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState<string>(REJECT_REASONS[0]);
  const [detail, setDetail] = useState("");

  function submit() {
    const note = detail.trim() ? `${reason} — ${detail.trim()}` : reason;
    start(async () => {
      const res = await onReject(note);
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onClose();
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <Modal open onClose={onClose} title={title} description="The rep is notified to follow up with the customer.">
      <div className="space-y-4">
        <div>
          <Label>Reason</Label>
          <Select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1.5">
            {REJECT_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Detail (optional)</Label>
          <Input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="What the rep should check / correct…"
            className="mt-1.5"
          />
        </div>
        <Button
          className="w-full text-destructive-foreground"
          variant="destructive"
          onClick={submit}
          disabled={pending}
        >
          <X className="size-4" />
          {pending ? "Rejecting…" : "Reject — verification failed"}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Deposit-confirmation modal — finance records which official ORA account the
 * money was deposited into and attaches proof (deposit slip / receipt) before
 * confirming. This is how cash and collections become official money.
 */
function DepositModal({
  title,
  amount,
  accounts,
  suggestedAccountId,
  onConfirm,
  onClose,
}: {
  title: string;
  amount: string;
  accounts: DepositAccount[];
  suggestedAccountId?: string | null;
  onConfirm: (input: ConfirmDeposit) => Promise<ActionResult>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Prefer a bank account (that's where cash is banked), else the first.
  const defaultAcc =
    suggestedAccountId ??
    accounts.find((a) => a.type === "BANK")?.id ??
    accounts[0]?.id ??
    "";
  const [accountId, setAccountId] = useState(defaultAcc);
  const [proofRef, setProofRef] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    if (accounts.length > 0 && !accountId) {
      toast({ variant: "error", title: "Choose the account the money was deposited into." });
      return;
    }
    start(async () => {
      const res = await onConfirm({
        depositAccountId: accountId || undefined,
        proofRef: proofRef || undefined,
        proofUrl: proofUrl || undefined,
        note: note || undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onClose();
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description="Record where the money was deposited and attach the deposit slip or receipt. Only then does it become official company money."
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-muted/50 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">Amount</span>{" "}
          <span className="float-right font-display text-lg font-semibold">{amount}</span>
        </div>
        <div>
          <Label>Deposited into</Label>
          <Select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="mt-1.5"
          >
            <option value="">Select company account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.accountNumber ? ` · ${a.accountNumber}` : ""}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            The CEO owns these accounts — you record which one received the money.
          </p>
        </div>
        <div>
          <Label>Deposit slip / receipt reference</Label>
          <Input
            value={proofRef}
            onChange={(e) => setProofRef(e.target.value)}
            placeholder="Slip no., transaction ID, or a link to the proof"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label className="mb-1.5 block">Upload deposit slip / receipt</Label>
          <ProofUpload value={proofUrl} onChange={setProofUrl} label="Attach slip / receipt image" />
        </div>
        <div>
          <Label>Note (optional)</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything worth recording…"
            className="mt-1.5"
          />
        </div>
        <Button className="w-full" onClick={submit} disabled={pending}>
          <Landmark className="size-4" />
          {pending ? "Confirming…" : "Confirm deposit"}
        </Button>
      </div>
    </Modal>
  );
}

/** Approve / reject a rep-recorded sale. Cash requires a deposit + proof;
 * credit just validates the terms. */
export function SaleApprovalActions({
  saleId,
  kind,
  amount,
  accounts,
  suggestedAccountId,
}: {
  saleId: string;
  kind: "CASH" | "CREDIT";
  amount: string;
  accounts: DepositAccount[];
  suggestedAccountId?: string | null;
}) {
  const router = useRouter();
  const [depositOpen, setDepositOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {kind === "CASH" ? (
        <Button size="sm" variant="success" onClick={() => setDepositOpen(true)}>
          <Check className="size-3.5" /> Confirm deposit
        </Button>
      ) : (
        <ActionButton
          size="sm"
          variant="success"
          action={() => approveFieldSale(saleId, {})}
          onDone={() => router.refresh()}
          pendingText="…"
        >
          <Check className="size-3.5" /> Approve credit
        </ActionButton>
      )}
      <Button
        size="sm"
        variant="outline"
        className="text-destructive hover:bg-destructive/10"
        onClick={() => setRejectOpen(true)}
      >
        <X className="size-3.5" />
      </Button>
      {depositOpen && (
        <DepositModal
          title="Confirm cash deposit"
          amount={amount}
          accounts={accounts}
          suggestedAccountId={suggestedAccountId}
          onConfirm={(input) => approveFieldSale(saleId, input)}
          onClose={() => setDepositOpen(false)}
        />
      )}
      {rejectOpen && (
        <RejectModal
          title={kind === "CASH" ? "Payment verification failed" : "Reject credit sale"}
          onReject={(note) => rejectFieldSale(saleId, note)}
          onClose={() => setRejectOpen(false)}
        />
      )}
    </div>
  );
}

/** Approve / reject a rep-claimed credit collection — records the deposit. */
export function CollectionApprovalActions({
  paymentId,
  amount,
  accounts,
  suggestedAccountId,
}: {
  paymentId: string;
  amount: string;
  accounts: DepositAccount[];
  suggestedAccountId?: string | null;
}) {
  const [depositOpen, setDepositOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button size="sm" variant="success" onClick={() => setDepositOpen(true)}>
        <Check className="size-3.5" /> Confirm & post
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="text-destructive hover:bg-destructive/10"
        onClick={() => setRejectOpen(true)}
      >
        <X className="size-3.5" />
      </Button>
      {depositOpen && (
        <DepositModal
          title="Confirm collection deposit"
          amount={amount}
          accounts={accounts}
          suggestedAccountId={suggestedAccountId}
          onConfirm={(input) => approveFieldCollection(paymentId, input)}
          onClose={() => setDepositOpen(false)}
        />
      )}
      {rejectOpen && (
        <RejectModal
          title="Reject collection"
          onReject={(note) => rejectFieldCollection(paymentId, note)}
          onClose={() => setRejectOpen(false)}
        />
      )}
    </div>
  );
}
