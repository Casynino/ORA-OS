"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { confirmOrderPayment, rejectOrderPayment } from "@/lib/actions/requests";
import {
  METHOD_LABELS,
  type ReceivingAccount,
} from "@/components/ui/receiving-account-picker";
import { ActionButton } from "@/components/dashboard/action-button";
import { Select } from "@/components/ui/select";

/** Finance verifies where the customer's money landed, then confirms —
 * the order is released to the warehouse automatically. */
export function OrderPaymentConfirm({
  requestId,
  accounts,
}: {
  requestId: string;
  accounts: ReceivingAccount[];
}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {accounts.length > 0 && (
        <Select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="h-9 max-w-56 text-xs"
          title="Account that received the money"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {METHOD_LABELS[a.type] ?? a.type} — {a.name}
              {a.accountNumber ? ` · ${a.accountNumber}` : ""}
            </option>
          ))}
        </Select>
      )}
      <ActionButton
        size="sm"
        variant="success"
        action={() =>
          confirmOrderPayment(
            requestId,
            accountId ? undefined : "Cash collected",
            accountId || undefined,
          )
        }
        onDone={() => router.refresh()}
        pendingText="…"
      >
        <Check className="size-3.5" /> Confirm payment
      </ActionButton>
      <ActionButton
        size="sm"
        variant="outline"
        className="text-destructive hover:bg-destructive/10"
        confirm="Reject this payment? The order returns to review."
        action={() => rejectOrderPayment(requestId)}
        onDone={() => router.refresh()}
        pendingText="…"
      >
        <X className="size-3.5" />
      </ActionButton>
    </div>
  );
}
