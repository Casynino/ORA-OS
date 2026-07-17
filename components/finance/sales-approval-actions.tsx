"use client";

import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import {
  approveFieldSale,
  rejectFieldSale,
  approveFieldCollection,
  rejectFieldCollection,
} from "@/lib/actions/finance-approvals";
import { ActionButton } from "@/components/dashboard/action-button";
import type { ActionResult } from "@/lib/types";

// Ask for a rejection reason; a Cancel (null) aborts the whole action so the
// record is NOT rejected. An empty string is a valid "reject, no comment".
function promptReject(
  run: (note?: string) => Promise<ActionResult>,
): () => Promise<ActionResult> {
  return () => {
    const note = window.prompt("Reason for rejecting (the rep will see this)");
    if (note === null) {
      return Promise.resolve({ ok: false, error: "Cancelled — nothing changed." });
    }
    return run(note.trim() || undefined);
  };
}

/** Approve / reject a rep-recorded sale (with an optional comment). */
export function SaleApprovalActions({
  saleId,
  kind,
}: {
  saleId: string;
  kind: "CASH" | "CREDIT";
}) {
  const router = useRouter();
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <ActionButton
        size="sm"
        variant="success"
        action={() => approveFieldSale(saleId)}
        onDone={() => router.refresh()}
        pendingText="…"
      >
        <Check className="size-3.5" />
        {kind === "CASH" ? "Confirm payment" : "Approve credit"}
      </ActionButton>
      <ActionButton
        size="sm"
        variant="outline"
        className="text-destructive hover:bg-destructive/10"
        action={promptReject((note) => rejectFieldSale(saleId, note))}
        onDone={() => router.refresh()}
        pendingText="…"
      >
        <X className="size-3.5" />
      </ActionButton>
    </div>
  );
}

/** Approve / reject a rep-claimed credit collection. */
export function CollectionApprovalActions({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <ActionButton
        size="sm"
        variant="success"
        action={() => approveFieldCollection(paymentId)}
        onDone={() => router.refresh()}
        pendingText="…"
      >
        <Check className="size-3.5" /> Confirm & post
      </ActionButton>
      <ActionButton
        size="sm"
        variant="outline"
        className="text-destructive hover:bg-destructive/10"
        action={promptReject((note) => rejectFieldCollection(paymentId, note))}
        onDone={() => router.refresh()}
        pendingText="…"
      >
        <X className="size-3.5" />
      </ActionButton>
    </div>
  );
}
