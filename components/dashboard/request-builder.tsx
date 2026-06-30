"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Minus,
  Plus,
  Search,
  Send,
  Trash2,
  Droplets,
  Sparkles,
  Package,
  Boxes,
  Info,
} from "lucide-react";
import { createRequest } from "@/lib/actions/requests";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, humanize } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitLabel: string;
};

const categoryIcon: Record<string, typeof Droplets> = {
  PADS: Droplets,
  HYGIENE: Sparkles,
  ACCESSORY: Package,
  OTHER: Boxes,
};

export function RequestBuilder({
  products,
  allowCredit = false,
  redirectTo,
}: {
  products: Product[];
  allowCredit?: boolean;
  redirectTo: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [paymentType, setPaymentType] = useState<"IMMEDIATE" | "CREDIT">(
    "IMMEDIATE",
  );

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase()),
  );
  const selected = Object.entries(lines).filter(([, q]) => q > 0);
  const totalItems = selected.reduce((s, [, q]) => s + q, 0);

  const setQty = (id: string, qty: number) =>
    setLines((prev) => ({ ...prev, [id]: Math.max(0, Math.min(qty, 100000)) }));

  function submit() {
    if (selected.length === 0) {
      toast({ variant: "error", title: "Add at least one product." });
      return;
    }
    start(async () => {
      const res = await createRequest({
        items: selected.map(([productId, quantity]) => ({
          productId,
          quantity,
        })),
        note: note || undefined,
        paymentType: allowCredit ? paymentType : undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setLines({});
        setNote("");
        router.push(redirectTo);
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      {/* Catalogue */}
      <div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="pl-9"
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {filtered.map((p) => {
            const Icon = categoryIcon[p.category] ?? Boxes;
            const qty = lines[p.id] ?? 0;
            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-xl border bg-card p-4 transition-colors",
                  qty > 0 ? "border-primary/50" : "border-border",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.sku} · {p.unitLabel}
                    </p>
                    <Badge variant="secondary" className="mt-1">
                      {humanize(p.category)}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-8"
                      onClick={() => setQty(p.id, qty - 1)}
                      disabled={qty <= 0}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      value={qty}
                      onChange={(e) => setQty(p.id, Number(e.target.value))}
                      className="h-8 w-16 text-center"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-8"
                      onClick={() => setQty(p.id, qty + 1)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
              No products match your search.
            </p>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardContent className="p-5">
            <h3 className="font-display text-lg font-semibold">Your request</h3>
            <p className="text-sm text-muted-foreground">
              {totalItems} unit{totalItems === 1 ? "" : "s"} ·{" "}
              {selected.length} product{selected.length === 1 ? "" : "s"}
            </p>

            <div className="mt-4 space-y-2">
              {selected.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Add products from the catalogue.
                </p>
              )}
              {selected.map(([id, qty]) => {
                const p = products.find((x) => x.id === id)!;
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="font-medium">×{qty}</span>
                    <button
                      onClick={() => setQty(id, 0)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {allowCredit && (
              <div className="mt-4">
                <Label>Payment</Label>
                <div className="mt-1.5 inline-flex w-full rounded-lg bg-muted p-1">
                  {(["IMMEDIATE", "CREDIT"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPaymentType(t)}
                      className={cn(
                        "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                        paymentType === t
                          ? "bg-card shadow-sm"
                          : "text-muted-foreground",
                      )}
                    >
                      {t === "IMMEDIATE" ? "Pay on approval" : "Request credit"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <Label htmlFor="note">Note to the ORA team (optional)</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Delivery details, timing, etc."
                className="mt-1.5"
              />
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-lg bg-info/10 p-3 text-xs text-info">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>
                Pricing is confirmed by the ORA team after review. You&apos;ll
                see the price once your request is approved.
              </span>
            </div>

            <Button
              className="mt-4 w-full"
              onClick={submit}
              disabled={pending || selected.length === 0}
            >
              <Send className="size-4" />
              {pending ? "Submitting…" : "Submit request"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
