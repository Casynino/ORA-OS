"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, ShoppingCart } from "lucide-react";
import { recordCashSale } from "@/lib/actions/sales";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ReceivingAccountPicker,
  METHOD_LABELS,
  type ReceivingAccount,
} from "@/components/ui/receiving-account-picker";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency, formatNumber } from "@/lib/utils";

export type SaleProduct = {
  id: string;
  name: string;
  size: string;
  price: number;
  stock: number;
};
export type SalePartner = { id: string; name: string };

export function RecordCashSale({
  partners,
  products,
  priceMap,
  receivingAccounts = [],
}: {
  partners: SalePartner[];
  products: SaleProduct[];
  // keyed `${partnerId}:${productId}` → agreed unit price
  priceMap: Record<string, number>;
  receivingAccounts?: ReceivingAccount[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [partnerId, setPartnerId] = useState("WALKIN");
  const [customerName, setCustomerName] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState(receivingAccounts[0]?.type ?? "CASH");
  const [accountId, setAccountId] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const isWalkin = partnerId === "WALKIN";

  const priceFor = (productId: string, base: number) =>
    priceMap[`${partnerId}:${productId}`] ?? base;

  const lines = useMemo(
    () =>
      products
        .map((p) => ({
          ...p,
          unit: priceFor(p.id, p.price),
          q: qty[p.id] ?? 0,
        }))
        .filter((l) => l.q > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, qty, partnerId, priceMap],
  );
  const total = lines.reduce((s, l) => s + l.unit * l.q, 0);
  const totalUnits = lines.reduce((s, l) => s + l.q, 0);
  const overstock = products.some((p) => (qty[p.id] ?? 0) > p.stock);

  function setQ(id: string, v: number) {
    setQty((m) => ({ ...m, [id]: Math.max(0, v) }));
  }

  function reset() {
    setQty({});
    setNote("");
    setMethod(receivingAccounts[0]?.type ?? "CASH");
    setAccountId("");
    setReference("");
    setCustomerName("");
  }

  function submit() {
    if (!partnerId) {
      toast({ variant: "error", title: "Choose a customer." });
      return;
    }
    if (totalUnits === 0) {
      toast({ variant: "error", title: "Add at least one product." });
      return;
    }
    if (receivingAccounts.length > 0 && !accountId) {
      toast({ variant: "error", title: "Choose the receiving account." });
      return;
    }
    start(async () => {
      const res = await recordCashSale({
        partnerId,
        customerName: isWalkin ? customerName || undefined : undefined,
        items: lines.map((l) => ({ productId: l.id, quantity: l.q })),
        method: METHOD_LABELS[method] ?? method,
        paymentAccountId: accountId || undefined,
        reference: reference || undefined,
        note: note || undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: `${res.data?.code} recorded` });
        setOpen(false);
        reset();
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <ShoppingCart className="size-4" />
        Record partner sale
      </Button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Record partner sale"
          description="Log a paid cash sale to a partner / agent (or a walk-in). Stock is deducted immediately. For a direct sale to a shop, use Record sale."
        >
          <div className="space-y-4">
            <div>
              <Label>Customer</Label>
              <Select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="mt-1.5"
              >
                <option value="WALKIN">Walk-in / field sale</option>
                {partners.length > 0 && (
                  <optgroup label="Registered partners">
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </Select>
              {isWalkin && (
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer or event name (e.g. Soko outreach)"
                  className="mt-2"
                />
              )}
            </div>

            {/* Product rows */}
            <div className="space-y-2">
              <Label>Products</Label>
              {products.map((p) => {
                const q = qty[p.id] ?? 0;
                const unit = priceFor(p.id, p.price);
                const over = q > p.stock;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(unit)} · {formatNumber(p.stock)} in stock
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQ(p.id, q - 1)}
                        className="grid size-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
                        disabled={q <= 0}
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <Input
                        type="number"
                        min={0}
                        max={p.stock}
                        value={q}
                        onChange={(e) => setQ(p.id, Number(e.target.value))}
                        className={`h-8 w-16 text-center ${
                          over ? "border-destructive text-destructive" : ""
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setQ(p.id, q + 1)}
                        className="grid size-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
                        disabled={q >= p.stock}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <div className="w-24 text-right text-sm font-medium">
                      {formatCurrency(unit * q)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <Label>Payment received</Label>
              <div className="mt-1.5">
                <ReceivingAccountPicker
                  accounts={receivingAccounts}
                  method={method}
                  accountId={accountId}
                  reference={reference}
                  onMethod={setMethod}
                  onAccount={setAccountId}
                  onReference={setReference}
                  compact
                />
              </div>
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything worth noting…"
                className="mt-1.5"
              />
            </div>

            {/* Total */}
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                {formatNumber(totalUnits)} unit{totalUnits === 1 ? "" : "s"}
              </span>
              <span className="font-display text-lg font-semibold">
                {formatCurrency(total)}
              </span>
            </div>
            {overstock && (
              <p className="text-xs text-destructive">
                One or more quantities exceed available stock.
              </p>
            )}

            <Button
              className="w-full"
              onClick={submit}
              disabled={pending || totalUnits === 0 || overstock}
            >
              {pending ? "Recording…" : `Record sale · ${formatCurrency(total)}`}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
