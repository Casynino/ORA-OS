"use client";

import { useRouter } from "next/navigation";
import { Check, X, Truck, PackageCheck } from "lucide-react";
import {
  approveTransfer,
  rejectTransfer,
  dispatchTransfer,
  receiveTransfer,
} from "@/lib/actions/transfers";
import { useTransition } from "react";
import { ActionButton } from "@/components/dashboard/action-button";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

export function TransferActions({
  id,
  status,
  isSource,
  isDest,
}: {
  id: string;
  status: string;
  isSource: boolean;
  isDest: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function decline() {
    const note = window.prompt("Reason for declining (optional)") ?? undefined;
    start(async () => {
      const res = await rejectTransfer(id, note);
      if (res.ok) toast({ variant: "success", title: res.message });
      else toast({ variant: "error", title: res.error });
      router.refresh();
    });
  }

  if (status === "PENDING") {
    return (
      <div className="flex gap-2">
        <ActionButton
          variant="success"
          action={() => approveTransfer(id)}
          onDone={() => router.refresh()}
          pendingText="Accepting…"
        >
          <Check className="size-4" /> Accept
        </ActionButton>
        <Button
          variant="outline"
          className="text-destructive hover:bg-destructive/10"
          onClick={decline}
          disabled={pending}
        >
          <X className="size-4" /> Decline
        </Button>
      </div>
    );
  }
  if (status === "APPROVED" && isSource) {
    return (
      <div className="flex gap-2">
        <ActionButton
          action={() => dispatchTransfer(id)}
          onDone={() => router.refresh()}
          pendingText="Dispatching…"
        >
          <Truck className="size-4" /> Dispatch
        </ActionButton>
        <Button
          variant="outline"
          className="text-destructive hover:bg-destructive/10"
          onClick={decline}
          disabled={pending}
        >
          <X className="size-4" /> Decline
        </Button>
      </div>
    );
  }
  if (status === "IN_TRANSIT" && isDest) {
    return (
      <ActionButton
        variant="success"
        action={() => receiveTransfer(id)}
        onDone={() => router.refresh()}
        pendingText="Receiving…"
      >
        <PackageCheck className="size-4" /> Confirm receipt
      </ActionButton>
    );
  }
  return (
    <span className="text-sm text-muted-foreground">
      {status === "COMPLETED"
        ? "Completed — stock reconciled"
        : status === "REJECTED"
          ? "Declined"
          : status === "IN_TRANSIT"
            ? "In transit — destination will receive"
            : "Awaiting the other warehouse"}
    </span>
  );
}
