"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  logSampleDistribution,
  submitFieldReport,
  requestRepStock,
  recordFieldCollection,
  createFieldCustomer,
} from "@/lib/actions/field";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { combineToPieces } from "@/lib/units";

type ProductOpt = { id: string; name: string; inHand?: number };

type StockProduct = {
  id: string;
  name: string;
  unitsPerCarton: number;
  notForSale: boolean;
  available: number;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/** Log free-sample distribution — deducts sample stock. */
export function SampleForm({ products }: { products: ProductOpt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [location, setLocation] = useState("");
  const [reason, setReason] = useState("");

  function submit() {
    start(async () => {
      const res = await logSampleDistribution({
        productId,
        quantity: Number(quantity) || 0,
        location,
        reason,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setQuantity("");
        setLocation("");
        setReason("");
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Product">
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.inHand != null ? ` — ${p.inHand} samples in hand` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Quantity">
          <Input type="number" inputMode="numeric" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 20" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Where were they distributed?">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Mbezi Secondary School" />
        </Field>
        <Field label="Campaign / reason (optional)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Back-to-school drive" />
        </Field>
      </div>
      <Button className="w-full rounded-full sm:w-auto" disabled={pending} onClick={submit}>
        {pending ? "Recording…" : "Record sample distribution"}
      </Button>
    </div>
  );
}

/** Daily field report. */
export function ReportForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [location, setLocation] = useState("");
  const [salesAchieved, setSalesAchieved] = useState("");
  const [unitsSold, setUnitsSold] = useState("");
  const [creditCollected, setCreditCollected] = useState("");
  const [challenges, setChallenges] = useState("");
  const [marketFeedback, setMarketFeedback] = useState("");

  function submit() {
    start(async () => {
      const res = await submitFieldReport({
        location,
        salesAchieved: Number(salesAchieved) || 0,
        unitsSold: Number(unitsSold) || 0,
        creditCollected: Number(creditCollected) || 0,
        challenges,
        marketFeedback,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setLocation(""); setSalesAchieved(""); setUnitsSold("");
        setCreditCollected(""); setChallenges(""); setMarketFeedback("");
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <div className="space-y-3">
      <Field label="Today's location">
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Temeke, Dar es Salaam" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Sales achieved (TSh)">
          <Input type="number" inputMode="numeric" min={0} value={salesAchieved} onChange={(e) => setSalesAchieved(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Units sold">
          <Input type="number" inputMode="numeric" min={0} value={unitsSold} onChange={(e) => setUnitsSold(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Credit collected (TSh)">
          <Input type="number" inputMode="numeric" min={0} value={creditCollected} onChange={(e) => setCreditCollected(e.target.value)} placeholder="0" />
        </Field>
      </div>
      <Field label="Challenges (optional)">
        <Input value={challenges} onChange={(e) => setChallenges(e.target.value)} placeholder="What slowed you down?" />
      </Field>
      <Field label="Market feedback (optional)">
        <Input value={marketFeedback} onChange={(e) => setMarketFeedback(e.target.value)} placeholder="What are customers saying?" />
      </Field>
      <Button className="w-full rounded-full sm:w-auto" disabled={pending} onClick={submit}>
        {pending ? "Submitting…" : "Submit field report"}
      </Button>
    </div>
  );
}

/** Request more stock from the warehouse. */
// Multi-product stock request: every product on one page, each with cartons +
// pieces inputs that convert automatically. Leave a product blank to skip it.
export function StockRequestForm({ products }: { products: StockProduct[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [qty, setQty] = useState<Record<string, { cartons: string; pieces: string }>>({});

  const get = (id: string) => qty[id] ?? { cartons: "", pieces: "" };
  const setField = (id: string, k: "cartons" | "pieces", v: string) =>
    setQty((q) => ({ ...q, [id]: { ...get(id), [k]: v } }));

  const lines = products.map((p) => {
    const { cartons, pieces } = get(p.id);
    return {
      p,
      pieces: combineToPieces(Number(cartons), Number(pieces), p.unitsPerCarton),
    };
  });
  const totalPieces = lines.reduce((s, l) => s + l.pieces, 0);
  const anyPositive = lines.some((l) => l.pieces > 0);

  function submit() {
    start(async () => {
      const res = await requestRepStock({
        note,
        items: lines
          .filter((l) => l.pieces > 0)
          .map((l) => ({ productId: l.p.id, quantity: l.pieces })),
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setQty({});
        setNote("");
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        {products.map((p) => {
          const { cartons, pieces } = get(p.id);
          const line = combineToPieces(
            Number(cartons),
            Number(pieces),
            p.unitsPerCarton,
          );
          return (
            <div
              key={p.id}
              className={`rounded-xl border p-3 transition-colors ${
                line > 0 ? "border-primary/40 bg-primary/[0.03]" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {p.name}
                    {p.notForSale && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                        <Gift className="size-2.5" />
                        Free
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatNumber(p.available)} pcs in warehouse · 1 carton ={" "}
                    {formatNumber(p.unitsPerCarton)}
                  </p>
                </div>
                {line > 0 && (
                  <span className="shrink-0 text-xs font-semibold text-primary">
                    {formatNumber(line)} pcs
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Cartons</Label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={cartons}
                    onChange={(e) => setField(p.id, "cartons", e.target.value)}
                    placeholder="0"
                    className="mt-1 h-9"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Pieces</Label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={pieces}
                    onChange={(e) => setField(p.id, "pieces", e.target.value)}
                    placeholder="0"
                    className="mt-1 h-9"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Field label="Note (optional)">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why do you need it?"
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-sm text-muted-foreground">
          Total:{" "}
          <span className="font-semibold text-foreground">
            {formatNumber(totalPieces)} pcs
          </span>
        </p>
        <Button
          className="rounded-full"
          disabled={pending || !anyPositive}
          onClick={submit}
        >
          {pending ? "Sending…" : "Request stock"}
        </Button>
      </div>
    </div>
  );
}

/** Record a collection against a credit sale. */
export function CollectForm({
  saleId,
  balance,
}: {
  saleId: string;
  balance: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");

  function submit() {
    start(async () => {
      const res = await recordFieldCollection({
        saleId,
        amount: Number(amount) || 0,
        method,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        setAmount("");
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  if (!open)
    return (
      <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOpen(true)}>
        Record payment
      </Button>
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="number"
        inputMode="numeric"
        min={1}
        max={balance}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={`Up to ${formatCurrency(balance)}`}
        className="h-9 w-40"
      />
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
      >
        <option>Cash</option>
        <option>Mobile money</option>
        <option>Bank</option>
      </select>
      <Button size="sm" className="rounded-full" disabled={pending || !amount} onClick={submit}>
        {pending ? "Saving…" : "Save"}
      </Button>
      <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

/** Add a customer to the rep's book. */
export function NewCustomerForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");

  function submit() {
    start(async () => {
      const res = await createFieldCustomer({ name, phone, location, notes: "" });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        setName(""); setPhone(""); setLocation("");
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  if (!open)
    return (
      <Button size="sm" className="rounded-full" onClick={() => setOpen(true)}>
        Add customer
      </Button>
    );

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-full sm:w-44" />
      <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 w-full sm:w-36" />
      <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} className="h-9 w-full sm:w-40" />
      <div className="flex gap-2">
        <Button size="sm" className="rounded-full" disabled={pending || name.trim().length < 2} onClick={submit}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
