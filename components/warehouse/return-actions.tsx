"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, PackageCheck } from "lucide-react";
import {
  approveReturn,
  completeReturn,
  rejectReturn,
} from "@/lib/actions/returns";
import { ActionButton } from "@/components/dashboard/action-button";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { ReceiveRepReturn } from "@/components/warehouse/receive-rep-return";

export type RepReturnInfo = {
  quantity: number;
  requesterName: string;
  productName: string;
  unitsPerCarton: number;
  notForSale: boolean;
};

export function ReturnActions({
  id,
  status,
  repReturn,
}: {
  id: string;
  status: string;
  /** Set for a rep's stock return — receipt then asks for the counted quantity. */
  repReturn?: RepReturnInfo;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function decline() {
    const note = window.prompt("Reason shared with the requester (optional)") ?? undefined;
    start(async () => {
      const res = await rejectReturn(id, note);
      if (res.ok) toast({ variant: "success", title: res.message });
      else toast({ variant: "error", title: res.error });
      router.refresh();
    });
  }

  if (status === "PENDING") {
    return (
      <div className="flex flex-wrap gap-2">
        <ActionButton
          variant="success"
          action={() => approveReturn(id)}
          onDone={() => router.refresh()}
          pendingText="Authorising…"
        >
          <Check className="size-4" /> Accept &amp; authorise
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
  if (status === "IN_TRANSIT") {
    return (
      <div className="flex flex-wrap gap-2">
        {repReturn ? (
          <ReceiveRepReturn
            id={id}
            requested={repReturn.quantity}
            requesterName={repReturn.requesterName}
            productName={repReturn.productName}
            unitsPerCarton={repReturn.unitsPerCarton}
            notForSale={repReturn.notForSale}
          />
        ) : (
          <ActionButton
            variant="success"
            action={() => completeReturn(id)}
            onDone={() => router.refresh()}
            pendingText="Receiving…"
          >
            <PackageCheck className="size-4" /> Confirm receipt
          </ActionButton>
        )}
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
  return (
    <span className="text-sm text-muted-foreground">
      {status === "COMPLETED"
        ? "Received — stock reconciled"
        : status === "REJECTED"
          ? "Declined"
          : "—"}
    </span>
  );
}
