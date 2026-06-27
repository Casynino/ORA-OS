"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus } from "lucide-react";
import { addStock } from "@/lib/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

export function ReceiveForm({
  products,
}: {
  products: { id: string; name: string; sku: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("100");
  const [reference, setReference] = useState("");

  function submit() {
    if (!productId) {
      toast({ variant: "error", title: "Choose a product." });
      return;
    }
    start(async () => {
      const res = await addStock({
        productId,
        quantity: Number(quantity),
        reference: reference || undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setReference("");
        setQuantity("100");
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Product</Label>
        <Select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="mt-1.5"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Quantity received</Label>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Reference (optional)</Label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Delivery note #"
            className="mt-1.5"
          />
        </div>
      </div>
      <Button className="w-full" onClick={submit} disabled={pending}>
        <PackagePlus className="size-4" />
        {pending ? "Recording…" : "Receive into warehouse"}
      </Button>
    </div>
  );
}
