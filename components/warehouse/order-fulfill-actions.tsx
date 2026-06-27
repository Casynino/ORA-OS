"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, Truck, CheckCircle2, X, Pencil, Check } from "lucide-react";
import {
  fulfillRequest,
  dispatchOrder,
  declineOrder,
  warehouseAdjustOrder,
} from "@/lib/actions/requests";
import { ActionButton } from "@/components/dashboard/action-button";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency, formatNumber } from "@/lib/utils";

type Item = { productId: string; name: string; quantity: number; unitPrice: number };

export function OrderFulfillActions({
  id,
  status,
  items,
}: {
  id: string;
  status: string;
  items: Item[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);

  function decline() {
    const note = window.prompt("Reason for declining (optional)") ?? undefined;
    start(async () => {
      const res = await declineOrder(id, note);
      if (res.ok) toast({ variant: "success", title: res.message });
      else toast({ variant: "error", title: res.error });
      router.refresh();
    });
  }

  if (status === "APPROVED") {
    return (
      <>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            variant="success"
            action={() => dispatchOrder(id)}
            onDone={() => router.refresh()}
            pendingText="Accepting…"
          >
            <Check className="size-4" /> Accept &amp; dispatch
          </ActionButton>
          <Button variant="outline" onClick={() => setEditing(true)} disabled={pending}>
            <Pencil className="size-4" /> Edit
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:bg-destructive/10"
            onClick={decline}
            disabled={pending}
          >
            <X className="size-4" /> Decline
          </Button>
        </div>
        {editing && (
          <EditOrderModal
            id={id}
            items={items}
            onClose={() => setEditing(false)}
            onDone={() => {
              setEditing(false);
              router.refresh();
            }}
          />
        )}
      </>
    );
  }
  if (status === "IN_TRANSIT") {
    return (
      <ActionButton
        action={() => fulfillRequest(id)}
        onDone={() => router.refresh()}
        pendingText="Confirming…"
      >
        <PackageCheck className="size-4" />
        Confirm delivery
      </ActionButton>
    );
  }
  if (status === "PRICED" || status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
        <Truck className="size-4" /> Awaiting ORA approval
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
      <CheckCircle2 className="size-4" /> Delivered &amp; reconciled
    </span>
  );
}

function EditOrderModal({
  id,
  items,
  onClose,
  onDone,
}: {
  id: string;
  items: Item[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [qty, setQty] = useState<Record<string, number>>(
    Object.fromEntries(items.map((i) => [i.productId, i.quantity])),
  );

  const total = items.reduce((s, i) => s + i.unitPrice * (qty[i.productId] ?? 0), 0);
  const totalUnits = items.reduce((s, i) => s + (qty[i.productId] ?? 0), 0);

  function submit() {
    if (totalUnits <= 0) {
      toast({ variant: "error", title: "Keep at least one item." });
      return;
    }
    start(async () => {
      const res = await warehouseAdjustOrder({
        requestId: id,
        items: items.map((i) => ({ productId: i.productId, quantity: qty[i.productId] ?? 0 })),
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onDone();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <Modal open onClose={onClose} title="Edit order quantities" description="Adjust quantities before dispatch. Prices are set by the ORA team and can't be changed.">
      <div className="space-y-3">
        {items.map((i) => (
          <div key={i.productId} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{i.name}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(i.unitPrice)} each</p>
            </div>
            <Input
              type="number"
              min={0}
              value={qty[i.productId] ?? 0}
              onChange={(e) =>
                setQty((m) => ({ ...m, [i.productId]: Math.max(0, Number(e.target.value)) }))
              }
              className="h-8 w-20 text-center"
            />
            <span className="w-24 text-right text-sm font-medium">
              {formatCurrency(i.unitPrice * (qty[i.productId] ?? 0))}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">{formatNumber(totalUnits)} units</span>
          <span className="font-semibold">{formatCurrency(total)}</span>
        </div>
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </Modal>
  );
}
