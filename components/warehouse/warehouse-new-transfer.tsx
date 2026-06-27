"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createTransfer } from "@/lib/actions/transfers";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { formatNumber } from "@/lib/utils";

export function WarehouseNewTransfer({
  fromId,
  destinations,
  sourceStock,
}: {
  fromId: string;
  destinations: { id: string; name: string }[];
  sourceStock: { productId: string; name: string; onHand: number }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [toId, setToId] = useState(destinations[0]?.id ?? "");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");

  const totalUnits = sourceStock.reduce((s, p) => s + (qty[p.productId] ?? 0), 0);
  const over = sourceStock.some((p) => (qty[p.productId] ?? 0) > p.onHand);

  function submit() {
    const items = sourceStock
      .filter((p) => (qty[p.productId] ?? 0) > 0)
      .map((p) => ({ productId: p.productId, quantity: qty[p.productId] }));
    if (!toId) return toast({ variant: "error", title: "Choose a destination." });
    if (items.length === 0) return toast({ variant: "error", title: "Add at least one product." });
    start(async () => {
      const res = await createTransfer({ fromId, toId, items, note: note || undefined });
      if (res.ok) {
        toast({ variant: "success", title: `${res.data?.code} created — awaiting approval` });
        setOpen(false);
        setQty({});
        setNote("");
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New transfer
      </Button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="New transfer" description="Send stock from your warehouse to another. Admin approval required.">
          <div className="space-y-4">
            <div>
              <Label>Destination</Label>
              <Select value={toId} onChange={(e) => setToId(e.target.value)} className="mt-1.5">
                {destinations.length === 0 && <option value="">No other warehouses</option>}
                {destinations.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Products (your stock)</Label>
              {sourceStock.length === 0 ? (
                <p className="text-sm text-muted-foreground">No stock to transfer.</p>
              ) : (
                sourceStock.map((p) => {
                  const q = qty[p.productId] ?? 0;
                  const overOne = q > p.onHand;
                  return (
                    <div key={p.productId} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{formatNumber(p.onHand)} on hand</p>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={p.onHand}
                        value={q}
                        onChange={(e) => setQty((m) => ({ ...m, [p.productId]: Math.max(0, Number(e.target.value)) }))}
                        className={`h-8 w-20 text-center ${overOne ? "border-destructive text-destructive" : ""}`}
                      />
                    </div>
                  );
                })
              )}
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">{formatNumber(totalUnits)} units</span>
            </div>
            <Button className="w-full" onClick={submit} disabled={pending || over || totalUnits === 0}>
              {pending ? "Creating…" : "Create transfer"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
