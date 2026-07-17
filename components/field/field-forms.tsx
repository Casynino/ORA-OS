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
import {
  ReceivingAccountPicker,
  METHOD_LABELS,
  type ReceivingAccount,
} from "@/components/ui/receiving-account-picker";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { combineToPieces } from "@/lib/units";

type ProductOpt = { id: string; name: string; inHand?: number };

type StockProduct = {
  id: string;
  name: string;
  unitsPerCarton: number;
  notForSale: boolean;
  stock: "IN" | "LOW" | "OUT"; // availability only — quantities stay confidential
};

const STOCK_BADGE: Record<StockProduct["stock"], { label: string; cls: string }> = {
  IN: { label: "In stock", cls: "bg-success/12 text-success" },
  LOW: { label: "Low stock", cls: "bg-warning/15 text-warning" },
  OUT: { label: "Out of stock", cls: "bg-destructive/12 text-destructive" },
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
// Multi-product stock request — compact: one row per product, cartons + pieces
// inputs inline (sample packs are pieces-only), availability shown as a status
// badge (never actual warehouse numbers). Leave a product blank to skip it.
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
      pieces: p.notForSale
        ? Math.max(0, Math.floor(Number(pieces) || 0)) // sample: packs only
        : combineToPieces(Number(cartons), Number(pieces), p.unitsPerCarton),
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
      <div className="space-y-2">
        {products.map((p) => {
          const { cartons, pieces } = get(p.id);
          const line = p.notForSale
            ? Math.max(0, Math.floor(Number(pieces) || 0))
            : combineToPieces(Number(cartons), Number(pieces), p.unitsPerCarton);
          const badge = STOCK_BADGE[p.stock];
          return (
            <div
              key={p.id}
              className={`rounded-xl border px-3 py-2.5 transition-colors ${
                line > 0 ? "border-primary/40 bg-primary/[0.03]" : "border-border"
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
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}
                >
                  {badge.label}
                </span>
              </div>
              <div className="mt-1.5 flex items-end gap-2">
                {p.notForSale ? (
                  <div className="min-w-0 flex-1">
                    <Label className="text-[10px] text-muted-foreground">
                      Sample packs
                    </Label>
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
                      <Label className="text-[10px] text-muted-foreground">
                        Cartons ({p.unitsPerCarton} pcs)
                      </Label>
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
                    line > 0 ? "text-primary" : "text-muted-foreground/50"
                  }`}
                >
                  {line > 0 ? `${formatNumber(line)}` : "—"}
                </span>
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
  accounts = [],
}: {
  saleId: string;
  balance: number;
  accounts?: ReceivingAccount[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const firstMethod = accounts[0]?.type ?? "CASH";
  const [method, setMethod] = useState(firstMethod);
  const [accountId, setAccountId] = useState(
    accounts.find((a) => a.type === firstMethod)?.id ?? "",
  );
  const [reference, setReference] = useState("");

  function submit() {
    if (accounts.length > 0 && !accountId) {
      toast({ variant: "error", title: "Select which account received the money." });
      return;
    }
    start(async () => {
      const res = await recordFieldCollection({
        saleId,
        amount: Number(amount) || 0,
        method: METHOD_LABELS[method] ?? method,
        paymentAccountId: accountId,
        reference,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        setAmount("");
        setReference("");
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
    <div className="w-full space-y-2.5 rounded-xl border border-border p-3">
      <div>
        <Label className="text-xs text-muted-foreground">Amount</Label>
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={balance}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Up to ${formatCurrency(balance)}`}
          className="mt-1 h-9 w-full sm:w-48"
        />
      </div>
      <ReceivingAccountPicker
        accounts={accounts}
        method={method}
        accountId={accountId}
        reference={reference}
        onMethod={setMethod}
        onAccount={setAccountId}
        onReference={setReference}
        compact
      />
      <div className="flex gap-2">
        <Button size="sm" className="rounded-full" disabled={pending || !amount} onClick={submit}>
          {pending ? "Saving…" : "Save payment"}
        </Button>
        <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Add a customer to the rep's book — full profile, auto-owned by this rep.
 * `startOpen` renders the form expanded (for the dedicated Register page). */
export function NewCustomerForm({ startOpen = false }: { startOpen?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(startOpen);
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");
  const [location, setLocation] = useState("");
  const [expectedVolume, setExpectedVolume] = useState("");
  const [preferredPayment, setPreferredPayment] = useState("");
  const [businessLicense, setBusinessLicense] = useState("");
  const [taxId, setTaxId] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);

  function captureGps() {
    if (!navigator.geolocation) {
      toast({ variant: "error", title: "GPS isn't available on this device." });
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsBusy(false);
        toast({ variant: "success", title: "GPS location captured." });
      },
      () => {
        setGpsBusy(false);
        toast({ variant: "error", title: "Couldn't get your location." });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function submit() {
    if (businessName.trim().length < 2) {
      toast({ variant: "error", title: "Enter the customer's business name." });
      return;
    }
    start(async () => {
      const res = await createFieldCustomer({
        businessName,
        email,
        phone,
        location,
        region,
        district,
        customerType,
        expectedVolume,
        preferredPayment,
        businessLicense,
        taxId,
        gpsLat: gps?.lat,
        gpsLng: gps?.lng,
        notes: "",
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        setBusinessName(""); setEmail(""); setPhone(""); setCustomerType("");
        setRegion(""); setDistrict(""); setLocation(""); setExpectedVolume("");
        setPreferredPayment(""); setBusinessLicense(""); setTaxId(""); setGps(null);
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
    <div className="w-full space-y-2.5 rounded-xl border border-border p-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Input placeholder="Business / organisation name *" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="h-9 sm:col-span-2" />
        <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" />
        <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9" />
        <select
          value={customerType}
          onChange={(e) => setCustomerType(e.target.value)}
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">Business type…</option>
          <option>Pharmacy</option>
          <option>Shop</option>
          <option>Supermarket</option>
          <option>Kiosk</option>
          <option>Clinic</option>
          <option>Wholesaler</option>
          <option>Other</option>
        </select>
        <select
          value={preferredPayment}
          onChange={(e) => setPreferredPayment(e.target.value)}
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">Preferred payment…</option>
          <option>Cash</option>
          <option>Credit</option>
        </select>
        <Input placeholder="Region" value={region} onChange={(e) => setRegion(e.target.value)} className="h-9" />
        <Input placeholder="District" value={district} onChange={(e) => setDistrict(e.target.value)} className="h-9" />
        <div className="sm:col-span-2">
          <Input placeholder="Street / physical address" value={location} onChange={(e) => setLocation(e.target.value)} className="h-9" />
          <p className="mt-1 text-[11px] text-muted-foreground">This becomes their default delivery address.</p>
        </div>
        <Input placeholder="Expected monthly volume — e.g. 500 packs" value={expectedVolume} onChange={(e) => setExpectedVolume(e.target.value)} className="h-9" />
        <Input placeholder="Business licence (optional)" value={businessLicense} onChange={(e) => setBusinessLicense(e.target.value)} className="h-9" />
        <Input placeholder="Tax ID / TIN (optional)" value={taxId} onChange={(e) => setTaxId(e.target.value)} className="h-9 sm:col-span-2" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={captureGps}
          disabled={gpsBusy}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            gps
              ? "border-success/40 bg-success/10 text-success"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {gpsBusy ? "Getting GPS…" : gps ? "✓ GPS captured" : "Capture GPS location"}
        </button>
        <div className="ml-auto flex gap-2">
          <Button size="sm" className="rounded-full" disabled={pending || businessName.trim().length < 2} onClick={submit}>
            {pending ? "Saving…" : "Save customer"}
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
