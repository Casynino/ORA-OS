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
import { formatCurrency } from "@/lib/utils";

type ProductOpt = { id: string; name: string; inHand?: number };

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
export function StockRequestForm({ products }: { products: ProductOpt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [kind, setKind] = useState<"SELLABLE" | "SAMPLE">("SELLABLE");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    start(async () => {
      const res = await requestRepStock({
        productId,
        quantity: Number(quantity) || 0,
        kind,
        note,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setQuantity(""); setNote("");
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Product">
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
        <Field label="For">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "SELLABLE" | "SAMPLE")}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="SELLABLE">Selling</option>
            <option value="SAMPLE">Free samples</option>
          </select>
        </Field>
        <Field label="Quantity">
          <Input type="number" inputMode="numeric" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 100" />
        </Field>
      </div>
      <Field label="Note (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why do you need it?" />
      </Field>
      <Button className="w-full rounded-full sm:w-auto" disabled={pending} onClick={submit}>
        {pending ? "Sending…" : "Request stock"}
      </Button>
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
