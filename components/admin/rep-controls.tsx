"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus, Target, Ban, RotateCcw, MapPin, Undo2, PackageCheck } from "lucide-react";
import {
  issueRepStock,
  approveRepStockRequest,
  rejectRepStockRequest,
  setRepTarget,
  setRepStatus,
  setRepTerritory,
  setFieldCustomerCredit,
  voidFieldSale,
} from "@/lib/actions/field";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { combineToPieces } from "@/lib/units";
import { formatNumber } from "@/lib/utils";

type ProductOpt = { id: string; name: string; available: number };

/** Ad-hoc: issue a single product to a rep (used from the rep's profile). */
export function IssueStockButton({
  repId,
  repName,
  products,
}: {
  repId: string;
  repName: string;
  products: ProductOpt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [kind, setKind] = useState<"SELLABLE" | "SAMPLE">("SELLABLE");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const selected = products.find((p) => p.id === productId);

  function submit() {
    start(async () => {
      const res = await issueRepStock({
        repId,
        productId,
        quantity: Number(quantity) || 0,
        kind,
        note,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        setQuantity("");
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <>
      <Button size="sm" className="rounded-full" variant="outline" onClick={() => setOpen(true)}>
        <PackagePlus className="size-4" />
        Issue stock
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={`Issue stock to ${repName}`}
          description="Deducts warehouse stock and puts it in the rep's hands — fully traceable."
        >
          <div className="space-y-4">
            <div>
              <Label>Product</Label>
              <Select value={productId} onChange={(e) => setProductId(e.target.value)} className="mt-1.5">
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.available} in warehouse
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>For</Label>
                <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="mt-1.5">
                  <option value="SELLABLE">Selling</option>
                  <option value="SAMPLE">Free samples</option>
                </Select>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  max={selected?.available}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
            </div>
            <Button className="w-full rounded-full" disabled={pending || !quantity} onClick={submit}>
              {pending ? "Issuing…" : "Issue stock"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

type FulfillItem = {
  productId: string;
  productName: string;
  unitsPerCarton: number;
  requested: number; // pieces
  available: number; // pieces in warehouse
  isSample: boolean;
};

/** Approve a whole multi-product request — reserves the pieces for pickup;
 * stock moves only when the rep collects and confirms at the warehouse. */
export function FulfillRequestButton({
  requestId,
  repName,
  items,
}: {
  requestId: string;
  repName: string;
  items: FulfillItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  // Each line defaults to the requested amount — split into cartons + loose pcs
  // for sellable products; samples stay in packs (pieces) only.
  const [q, setQ] = useState<Record<string, { cartons: string; pieces: string }>>(
    () =>
      Object.fromEntries(
        items.map((it) => {
          if (it.isSample) {
            return [it.productId, { cartons: "", pieces: it.requested ? String(it.requested) : "" }];
          }
          const c = Math.floor(it.requested / it.unitsPerCarton);
          const p = it.requested % it.unitsPerCarton;
          return [it.productId, { cartons: c ? String(c) : "", pieces: p ? String(p) : "" }];
        }),
      ),
  );
  const get = (id: string) => q[id] ?? { cartons: "", pieces: "" };
  const setField = (id: string, k: "cartons" | "pieces", v: string) =>
    setQ((s) => ({ ...s, [id]: { ...get(id), [k]: v } }));

  // Samples are counted in packs only — never cartons.
  const lineTotal = (it: FulfillItem) => {
    const { cartons, pieces } = get(it.productId);
    return it.isSample
      ? Math.max(0, Math.floor(Number(pieces) || 0))
      : combineToPieces(Number(cartons), Number(pieces), it.unitsPerCarton);
  };

  const lines = items.map((it) => {
    const total = lineTotal(it);
    return { it, total, over: total > it.available };
  });
  const anyPositive = lines.some((l) => l.total > 0);
  const anyOver = lines.some((l) => l.over);

  function submit() {
    start(async () => {
      const res = await approveRepStockRequest({
        requestId,
        lines: lines.map((l) => ({ productId: l.it.productId, quantity: l.total })),
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <>
      <Button size="sm" className="rounded-full" onClick={() => setOpen(true)}>
        <PackageCheck className="size-4" />
        Approve
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={`Approve stock for ${repName}`}
          description="Confirm or adjust each product. The pieces are reserved for pickup — stock moves when the rep collects and confirms at the warehouse."
        >
          <div className="space-y-3">
            {items.map((it) => {
              const { cartons, pieces } = get(it.productId);
              const total = lineTotal(it);
              const over = total > it.available;
              return (
                <div key={it.productId} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                    <p className="text-sm font-medium">
                      {it.productName}
                      {it.isSample && (
                        <span className="ml-1.5 text-xs text-muted-foreground">(free samples)</span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      requested {formatNumber(it.requested)} · {formatNumber(it.available)} in stock
                    </p>
                  </div>
                  <div
                    className={`mt-2 grid items-end gap-2 ${
                      it.isSample ? "grid-cols-[1fr_auto]" : "grid-cols-[1fr_1fr_auto]"
                    }`}
                  >
                    {it.isSample ? (
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Sample packs</Label>
                        <Input
                          type="number"
                          min={0}
                          value={pieces}
                          onChange={(e) => setField(it.productId, "pieces", e.target.value)}
                          className="mt-1 h-9"
                          placeholder="0"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Cartons</Label>
                          <Input
                            type="number"
                            min={0}
                            value={cartons}
                            onChange={(e) => setField(it.productId, "cartons", e.target.value)}
                            className="mt-1 h-9"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Pieces</Label>
                          <Input
                            type="number"
                            min={0}
                            value={pieces}
                            onChange={(e) => setField(it.productId, "pieces", e.target.value)}
                            className="mt-1 h-9"
                            placeholder="0"
                          />
                        </div>
                      </>
                    )}
                    <p
                      className={`pb-2 text-right text-xs font-semibold ${
                        over ? "text-destructive" : "text-primary"
                      }`}
                    >
                      {formatNumber(total)} pcs
                    </p>
                  </div>
                  {over && (
                    <p className="mt-1 text-xs text-destructive">
                      Only {formatNumber(it.available)} in the warehouse.
                    </p>
                  )}
                </div>
              );
            })}
            <Button
              className="w-full rounded-full"
              disabled={pending || !anyPositive || anyOver}
              onClick={submit}
            >
              {pending ? "Approving…" : "Approve for collection"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function RejectStockRequestButton({
  id,
  label = "Reject",
}: {
  id: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="rounded-full text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await rejectRepStockRequest(id);
          if (res.ok) toast({ variant: "success", title: res.message });
          else toast({ variant: "error", title: res.error });
          router.refresh();
        })
      }
    >
      {label}
    </Button>
  );
}

/** Set / edit a rep's monthly targets. */
export function SetTargetsButton({
  repId,
  repName,
  current,
}: {
  repId: string;
  repName: string;
  current?: {
    salesTarget: number;
    unitsTarget: number;
    cashTarget: number;
    creditRecoveryTarget: number;
  } | null;
}) {
  const router = useRouter();
  const now = new Date();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [sales, setSales] = useState(String(current?.salesTarget ?? ""));
  const [units, setUnits] = useState(String(current?.unitsTarget ?? ""));
  const [cash, setCash] = useState(String(current?.cashTarget ?? ""));
  const [recovery, setRecovery] = useState(String(current?.creditRecoveryTarget ?? ""));

  function submit() {
    start(async () => {
      const res = await setRepTarget({
        repId,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        salesTarget: Number(sales) || 0,
        unitsTarget: Number(units) || 0,
        cashTarget: Number(cash) || 0,
        creditRecoveryTarget: Number(recovery) || 0,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOpen(true)}>
        <Target className="size-4" />
        {current ? "Edit targets" : "Set targets"}
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={`${repName} — targets for ${now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`}
          description="The rep sees live progress bars against these goals."
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sales target (TSh)</Label>
                <Input type="number" min={0} value={sales} onChange={(e) => setSales(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Units target</Label>
                <Input type="number" min={0} value={units} onChange={(e) => setUnits(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Cash collection (TSh)</Label>
                <Input type="number" min={0} value={cash} onChange={(e) => setCash(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Credit recovery (TSh)</Label>
                <Input type="number" min={0} value={recovery} onChange={(e) => setRecovery(e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <Button className="w-full rounded-full" disabled={pending} onClick={submit}>
              {pending ? "Saving…" : "Save targets"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Suspend / reactivate a rep. */
export function RepStatusButton({
  repId,
  status,
}: {
  repId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const suspended = status === "SUSPENDED";
  return (
    <Button
      size="sm"
      variant={suspended ? "outline" : "ghost"}
      className={suspended ? "rounded-full" : "rounded-full text-muted-foreground hover:text-destructive"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setRepStatus(repId, suspended ? "ACTIVE" : "SUSPENDED");
          if (res.ok) toast({ variant: "success", title: res.message });
          else toast({ variant: "error", title: res.error });
          router.refresh();
        })
      }
    >
      {suspended ? <RotateCcw className="size-4" /> : <Ban className="size-4" />}
      {suspended ? "Reactivate" : "Suspend"}
    </Button>
  );
}

/** Reassign the rep's territory. */
export function TerritoryButton({
  repId,
  current,
}: {
  repId: string;
  current: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState(current ?? "");

  function submit() {
    start(async () => {
      const res = await setRepTerritory(repId, region.trim());
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  if (!open)
    return (
      <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOpen(true)}>
        <MapPin className="size-4" />
        {current ? "Territory" : "Assign territory"}
      </Button>
    );
  return (
    <div className="flex items-center gap-2">
      <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Dar es Salaam" className="h-9 w-44" />
      <Button size="sm" className="rounded-full" disabled={pending} onClick={submit}>
        {pending ? "…" : "Save"}
      </Button>
      <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

/** Toggle a field customer's credit access. */
export function CustomerCreditToggle({
  customerId,
  suspended,
}: {
  customerId: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="rounded-full text-xs text-muted-foreground hover:text-foreground"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setFieldCustomerCredit(customerId, !suspended);
          if (res.ok) toast({ variant: "success", title: res.message });
          else toast({ variant: "error", title: res.error });
          router.refresh();
        })
      }
    >
      {suspended ? "Restore credit" : "Suspend credit"}
    </Button>
  );
}

/** Void a sale (admin correction — restores the rep's stock). */
export function VoidSaleButton({ saleId }: { saleId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="rounded-full text-xs text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() => {
        const reason = window.prompt("Why is this sale being voided?") ?? "";
        if (!reason.trim()) return;
        start(async () => {
          const res = await voidFieldSale(saleId, reason.trim());
          if (res.ok) toast({ variant: "success", title: res.message });
          else toast({ variant: "error", title: res.error });
          router.refresh();
        });
      }}
    >
      <Undo2 className="size-3.5" />
      Void
    </Button>
  );
}
