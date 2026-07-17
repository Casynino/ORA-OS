"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { createFinanceReturn } from "@/lib/actions/returns";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";

export type ReturnableItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

/** Finance starts a debt-recovery return against one outstanding credit sale. */
export function FinanceReturnButton({
  saleId,
  saleCode,
  outstanding,
  items,
}: {
  saleId: string;
  saleCode: string;
  outstanding: number;
  items: ReturnableItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState(items[0]?.productId ?? "");
  const [qty, setQty] = useState("1");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  const line = items.find((i) => i.productId === productId);

  function submit() {
    start(async () => {
      const res = await createFinanceReturn({
        fieldSaleId: saleId,
        productId,
        quantity: Math.round(Number(qty) || 0),
        creditValue: Math.round(Number(value) || 0),
        reason: reason || undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Undo2 className="size-3.5" /> Initiate return
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={`Debt-recovery return · ${saleCode}`}
          description={`Take goods back to settle the outstanding ${formatCurrency(outstanding)}. The warehouse receives the goods and the balance drops on receipt.`}
        >
          <div className="space-y-4">
            <div>
              <Label>Product</Label>
              <Select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setQty("1");
                }}
                className="mt-1.5"
              >
                {items.map((i) => (
                  <option key={i.productId} value={i.productId}>
                    {i.name} (sold {i.quantity} @ {formatCurrency(i.unitPrice)})
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantity returned</Label>
                <Input
                  type="number"
                  min={1}
                  max={line?.quantity ?? 1}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="mt-1.5"
                />
                {line && (
                  <p className="mt-1 text-[11px] text-muted-foreground">max {line.quantity} sold</p>
                )}
              </div>
              <div>
                <Label>Credit recovered (TSh)</Label>
                <Input
                  type="number"
                  min={1}
                  max={outstanding}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={line ? String(line.unitPrice) : ""}
                  className="mt-1.5"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">≤ {formatCurrency(outstanding)} owed</p>
              </div>
            </div>
            <div>
              <Label>Reason / note (optional)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Agreed return to clear the balance…"
                className="mt-1.5"
              />
            </div>
            <Button
              className="w-full"
              onClick={submit}
              disabled={
                pending ||
                !productId ||
                !(Number(qty) > 0) ||
                !(Number(value) > 0) ||
                Number(value) > outstanding
              }
            >
              <Undo2 className="size-4" />
              {pending ? "Creating…" : "Create return"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
