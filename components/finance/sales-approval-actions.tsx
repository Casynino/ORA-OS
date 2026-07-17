"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import {
  approveFieldSale,
  rejectFieldSale,
  approveFieldCollection,
  rejectFieldCollection,
} from "@/lib/actions/finance-approvals";
import { ActionButton } from "@/components/dashboard/action-button";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import type { ActionResult } from "@/lib/types";

// A cash-type sale/collection paid DIRECTLY into an account (bank / mobile /
// cheque) rather than as physical cash — finance verifies the uploaded proof.
function isDirectPayment(method: string | null): boolean {
  return !!method && /bank|mobile|lipa|transfer|cheque|chek|m-?pesa|tigo|airtel|voda|halo|nmb/i.test(method);
}

const REJECT_REASONS = [
  "Payment not received",
  "Incorrect amount",
  "Invalid receipt",
  "Duplicate receipt",
  "Other",
] as const;

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
 * Confirm / reject a rep-recorded sale. There's no deposit capture here anymore:
 *  - physical CASH → "Confirm cash received" (money goes to Cash on Hand; it's
 *    banked later as a batch deposit).
 *  - BANK/MOBILE/CHEQUE → the rep's proof is shown on the card; finance verifies
 *    it and confirms (no re-upload).
 *  - CREDIT → validates the terms.
 */
export function SaleApprovalActions({
  saleId,
  kind,
  method,
}: {
  saleId: string;
  kind: "CASH" | "CREDIT";
  method?: string | null;
}) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = useState(false);

  const direct = kind === "CASH" && isDirectPayment(method ?? null);
  const label =
    kind === "CREDIT" ? "Approve credit" : direct ? "Confirm payment" : "Confirm cash received";

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <ActionButton
        size="sm"
        variant="success"
        action={() => approveFieldSale(saleId)}
        onDone={() => router.refresh()}
        pendingText="…"
      >
        <Check className="size-3.5" /> {label}
      </ActionButton>
      <Button
        size="sm"
        variant="outline"
        className="text-destructive hover:bg-destructive/10"
        onClick={() => setRejectOpen(true)}
      >
        <X className="size-3.5" />
      </Button>
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

/** Confirm / reject a rep-claimed credit collection. Cash goes to Cash on Hand;
 *  direct payments already landed in an account. No deposit capture here. */
export function CollectionApprovalActions({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = useState(false);
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <ActionButton
        size="sm"
        variant="success"
        action={() => approveFieldCollection(paymentId)}
        onDone={() => router.refresh()}
        pendingText="…"
      >
        <Check className="size-3.5" /> Confirm &amp; post
      </ActionButton>
      <Button
        size="sm"
        variant="outline"
        className="text-destructive hover:bg-destructive/10"
        onClick={() => setRejectOpen(true)}
      >
        <X className="size-3.5" />
      </Button>
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
