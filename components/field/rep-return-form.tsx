"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import { createRepStockReturn } from "@/lib/actions/returns";
import { REP_RETURN_REASONS, type RepReturnReason } from "@/lib/rep-returns";
import { combineToPieces } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { formatNumber } from "@/lib/utils";

export type ReturnableProduct = {
  id: string;
  name: string;
  unitsPerCarton: number;
  notForSale: boolean;
  available: number; // pieces the rep can still send back
};

/** Rep asks the warehouse to take back stock they hold. Same shape as the
 *  stock-request form: cartons + pieces per product (sample packs: pieces only). */
export function RepReturnForm({
  products,
  warehouses,
}: {
  products: ReturnableProduct[];
  warehouses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [qty, setQty] = useState<Record<string, { cartons: string; pieces: string }>>({});
  const [reason, setReason] = useState<RepReturnReason>("Unsold stock");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [note, setNote] = useState("");

  const get = (id: string) => qty[id] ?? { cartons: "", pieces: "" };
  const setField = (id: string, k: "cartons" | "pieces", v: string) =>
    setQty((q) => ({ ...q, [id]: { ...get(id), [k]: v } }));

  const lines = products.map((p) => {
    const { cartons, pieces } = get(p.id);
    const n = p.notForSale
      ? Math.max(0, Math.floor(Number(pieces) || 0))
      : combineToPieces(Number(cartons), Number(pieces), p.unitsPerCarton);
    return { p, n };
  });
  const chosen = lines.filter((l) => l.n > 0);
  const total = chosen.reduce((s, l) => s + l.n, 0);
  const tooMany = chosen.some((l) => l.n > l.p.available);

  function submit() {
    start(async () => {
      let sent = 0;
      for (const l of chosen) {
        const res = await createRepStockReturn({
          productId: l.p.id,
          quantity: l.n,
          reason,
          note: note.trim() || undefined,
          warehouseId: warehouseId || undefined,
        });
        if (!res.ok) {
          toast({ variant: "error", title: `${l.p.name}: ${res.error}` });
          router.refresh();
          return;
        }
        sent += 1;
      }
      toast({
        variant: "success",
        title: `${sent} return${sent === 1 ? "" : "s"} sent. The warehouse will accept it — then bring the goods in.`,
      });
      setQty({});
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {products.map((p) => {
          const { cartons, pieces } = get(p.id);
          const n = p.notForSale
            ? Math.max(0, Math.floor(Number(pieces) || 0))
            : combineToPieces(Number(cartons), Number(pieces), p.unitsPerCarton);
          const over = n > p.available;
          const perCarton = p.unitsPerCarton || 24;
          return (
            <div
              key={p.id}
              className={`rounded-xl border px-3 py-2.5 transition-colors ${
                over ? "border-destructive/50" : n > 0 ? "border-primary/40 bg-primary/[0.03]" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium">
                  <span className="truncate">{p.name}</span>
                  {p.notForSale && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                      <Gift className="size-2.5" />
                      Free
                    </span>
                  )}
                </p>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  you can return {formatNumber(p.available)} pcs
                  {!p.notForSale && p.available >= perCarton
                    ? ` (${formatNumber(Math.floor(p.available / perCarton))} ctn + ${formatNumber(p.available % perCarton)})`
                    : ""}
                </span>
              </div>
              <div className="mt-1.5 flex items-end gap-2">
                {p.notForSale ? (
                  <div className="min-w-0 flex-1">
                    <Label className="text-[10px] text-muted-foreground">Sample packs</Label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={pieces}
                      onChange={(e) => setField(p.id, "pieces", e.target.value)}
                      placeholder="0"
                      className="mt-0.5 h-8 text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <Label className="text-[10px] text-muted-foreground">Cartons ({perCarton} pcs)</Label>
                      <Input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={cartons}
                        onChange={(e) => setField(p.id, "cartons", e.target.value)}
                        placeholder="0"
                        className="mt-0.5 h-8 text-sm"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Label className="text-[10px] text-muted-foreground">Pieces</Label>
                      <Input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={pieces}
                        onChange={(e) => setField(p.id, "pieces", e.target.value)}
                        placeholder="0"
                        className="mt-0.5 h-8 text-sm"
                      />
                    </div>
                  </>
                )}
                <span
                  className={`w-16 shrink-0 pb-1.5 text-right text-xs font-semibold ${
                    over ? "text-destructive" : n > 0 ? "text-primary" : "text-muted-foreground/50"
                  }`}
                >
                  {n > 0 ? formatNumber(n) : "—"}
                </span>
              </div>
              {over && (
                <p className="mt-1 text-[11px] text-destructive">
                  More than you can return ({formatNumber(p.available)} pcs).
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Why are you returning it?</Label>
          <Select value={reason} onChange={(e) => setReason(e.target.value as RepReturnReason)} className="mt-1">
            {REP_RETURN_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        {warehouses.length > 1 && (
          <div>
            <Label className="text-xs">Return to</Label>
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="mt-1">
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <div>
        <Label className="text-xs">Note (optional)</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the warehouse should know" className="mt-1" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-sm text-muted-foreground">
          Total: <span className="font-semibold text-foreground">{formatNumber(total)} pcs</span>
        </p>
        <Button className="rounded-full" disabled={pending || chosen.length === 0 || tooMany} onClick={submit}>
          {pending ? "Sending…" : "Request return"}
        </Button>
      </div>
    </div>
  );
}
