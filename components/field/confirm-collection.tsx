"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { confirmRepStockCollection } from "@/lib/actions/field";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

/** The rep taps this at the warehouse counter, products in hand — the stock
 * transfers from the warehouse into their inventory at that moment. */
export function ConfirmCollectionButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      className="rounded-full"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Confirm you've received these products from the warehouse?")) return;
        start(async () => {
          const res = await confirmRepStockCollection(requestId);
          if (res.ok) toast({ variant: "success", title: res.message });
          else toast({ variant: "error", title: res.error });
          router.refresh();
        });
      }}
    >
      <PackageCheck className="size-4" />
      {pending ? "Confirming…" : "Confirm receipt"}
    </Button>
  );
}
