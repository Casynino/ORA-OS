"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { createCustomerReturn } from "@/lib/actions/returns";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency, formatNumber } from "@/lib/utils";

export type CustomerReturnItem = {
  productId: string;
  name: string;
  quantity: number; // sold on this sale
  unitPrice: number;
  returned: number; // already returned
};

/** Rep records goods a customer brought back on one credit sale. It takes effect
 *  at once: the pieces return to the rep's stock and their value comes off the
 *  balance. The value is worked out from the sale's prices, never typed. */
export function CustomerReturnButton({
  saleId,
  saleCode,
  owing,
  items,
}: {
  saleId: string;
  saleCode: string;
  owing: number;
  items: CustomerReturnItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const rows = items
    .map((i) => ({ ...i, left: Math.max(0, i.quantity - i.returned) }))
    .filter((i) => i.left > 0);
  const lines = rows
    .map((r) => ({ r, n: Math.max(0, Math.floor(Number(qty[r.productId]) || 0)) }))
    .filter((l) => l.n > 0);
  const value = lines.reduce((s, l) => s + l.n * l.r.unitPrice, 0);
  const tooMany = lines.some((l) => l.n > l.r.left);
  const tooMuch = value > owing;

  function submit() {
    start(async () => {
      const res = await createCustomerReturn({
        saleId,
        items: lines.map((l) => ({ productId: l.r.productId, quantity: l.n })),
        note: note.trim() || undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        setQty({});
        setNote("");
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  if (rows.length === 0) return null;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Undo2 className="size-3.5" /> Return goods
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={`Customer return · ${saleCode}`}
          description="Record the goods the customer brought back. They go straight back into your stock and come off what the customer owes."
        >
          <div className="space-y-4">
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.productId} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      sold {formatNumber(r.quantity)} @ {formatCurrency(r.unitPrice)}
                      {r.returned > 0 ? ` · ${formatNumber(r.returned)} already back` : ""}
                    </p>
                  </div>
                  <div className="w-24 shrink-0">
                    <Label className="text-[10px] text-muted-foreground">Pieces back</Label>
                    <Input
                      type="number"
                      min={0}
                      max={r.left}
                      inputMode="numeric"
                      value={qty[r.productId] ?? ""}
                      onChange={(e) => setQty((q) => ({ ...q, [r.productId]: e.target.value }))}
                      placeholder="0"
                      className="mt-0.5 h-8 text-sm"
                    />
                    <p className="mt-0.5 text-[10px] text-muted-foreground">max {formatNumber(r.left)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why is the customer returning them?"
                className="mt-1.5"
              />
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <p className="flex justify-between">
                <span className="text-muted-foreground">Comes off the balance</span>
                <span className="font-semibold">{formatCurrency(value)}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground">Customer owes now</span>
                <span className="font-semibold">{formatCurrency(owing)}</span>
              </p>
              {(tooMany || tooMuch) && (
                <p className="mt-1.5 text-xs text-destructive">
                  {tooMany
                    ? "You entered more than was sold on this sale."
                    : "That is worth more than the customer owes — speak to Finance about a refund."}
                </p>
              )}
            </div>
            <Button className="w-full" onClick={submit} disabled={pending || lines.length === 0 || tooMany || tooMuch}>
              <Undo2 className="size-4" />
              {pending ? "Recording…" : "Record return"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
