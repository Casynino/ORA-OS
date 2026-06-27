"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Undo2, PackageCheck } from "lucide-react";
import { createReturn } from "@/lib/actions/returns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { formatNumber } from "@/lib/utils";

export type ReturnableProduct = {
  id: string;
  name: string;
  sku: string;
  available: number;
  image: string;
};

const REASONS = [
  "Damaged",
  "Expired",
  "Incorrect delivery",
  "Overstock",
  "Other",
] as const;

export function ReturnForm({
  products,
  warehouses,
}: {
  products: ReturnableProduct[];
  warehouses: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [reasonType, setReasonType] = useState<(typeof REASONS)[number]>(
    "Damaged",
  );
  const [reason, setReason] = useState("");
  const [warehouse, setWarehouse] = useState(warehouses[0] ?? "");

  const selected = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId],
  );
  const cap = selected?.available ?? 0;

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center">
        <PackageCheck className="mx-auto size-7 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Nothing to return</p>
        <p className="mt-1 text-xs text-muted-foreground">
          You can only return stock the ORA team has delivered to you. Once you
          receive an order, eligible products will appear here.
        </p>
      </div>
    );
  }

  function submit() {
    const qty = Number(quantity);
    if (!productId) {
      toast({ variant: "error", title: "Choose a product." });
      return;
    }
    if (!qty || qty < 1) {
      toast({ variant: "error", title: "Enter a quantity of at least 1." });
      return;
    }
    if (qty > cap) {
      toast({
        variant: "error",
        title: `You can only return up to ${cap} units of this product.`,
      });
      return;
    }
    start(async () => {
      const res = await createReturn({
        productId,
        quantity: qty,
        reasonType,
        reason: reason || undefined,
        warehouseName: warehouse || undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setReason("");
        setQuantity("1");
        router.push("/partner/returns");
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Product picker — only stock the partner actually holds */}
      <div>
        <Label>Product</Label>
        <div className="mt-1.5 flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2">
          {selected && (
            <span className="relative size-11 shrink-0 overflow-hidden rounded-md bg-background">
              <Image
                src={selected.image}
                alt={selected.name}
                fill
                className="object-cover"
                sizes="44px"
              />
            </span>
          )}
          <Select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setQuantity("1");
            }}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatNumber(p.available)} held
              </option>
            ))}
          </Select>
        </div>
        {selected && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            You currently hold{" "}
            <span className="font-medium text-foreground">
              {formatNumber(cap)} units
            </span>{" "}
            available to return.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Quantity</Label>
          <Input
            type="number"
            min={1}
            max={cap}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Send back to</Label>
          <Select
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
            className="mt-1.5"
          >
            {warehouses.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label>Reason</Label>
        <Select
          value={reasonType}
          onChange={(e) =>
            setReasonType(e.target.value as (typeof REASONS)[number])
          }
          className="mt-1.5"
        >
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Details (optional)</Label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Tell the ORA team what happened…"
          className="mt-1.5"
        />
      </div>

      <Button className="w-full" onClick={submit} disabled={pending}>
        <Undo2 className="size-4" />
        {pending ? "Submitting…" : "Submit return"}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        The ORA team reviews every return before stock is sent back.
      </p>
    </div>
  );
}
