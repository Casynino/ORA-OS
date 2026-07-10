"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CreditCard, Check, UserPlus } from "lucide-react";
import { recordFieldSale } from "@/lib/actions/field";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  unitLabel: string;
  price: number;
  inHand: number;
};
type CustomerRow = { id: string; name: string; creditSuspended: boolean };

export function FieldSaleForm({
  products,
  customers,
}: {
  products: ProductRow[];
  customers: CustomerRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [type, setType] = useState<"CASH" | "CREDIT">("CASH");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [price, setPrice] = useState<Record<string, string>>(
    Object.fromEntries(products.map((p) => [p.id, String(p.price)])),
  );
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState(false);
  const [ncName, setNcName] = useState("");
  const [ncBusiness, setNcBusiness] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [ncLocation, setNcLocation] = useState("");
  const [ncRegion, setNcRegion] = useState("");
  const [ncType, setNcType] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [customerName, setCustomerName] = useState(""); // cash walk-in
  const [location, setLocation] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");

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

  const items = useMemo(
    () =>
      products
        .map((p) => ({
          productId: p.id,
          quantity: Number(qty[p.id]) || 0,
          unitPrice: Number(price[p.id]) || 0,
        }))
        .filter((i) => i.quantity > 0),
    [products, qty, price],
  );
  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  function submit() {
    if (items.length === 0)
      return toast({ variant: "error", title: "Enter a quantity for at least one product." });
    for (const i of items) {
      const p = products.find((x) => x.id === i.productId)!;
      if (i.quantity > p.inHand)
        return toast({
          variant: "error",
          title: `You only have ${p.inHand} of ${p.name} in hand.`,
        });
    }
    if (type === "CREDIT" && !customerId && !newCustomer)
      return toast({ variant: "error", title: "Credit sales need a customer." });
    if (newCustomer && ncName.trim().length < 2)
      return toast({ variant: "error", title: "Enter the customer's name." });

    start(async () => {
      const res = await recordFieldSale({
        type,
        items,
        // A saved customer (or a brand-new one) can be attached to ANY sale —
        // cash included — so the customer's history stays complete.
        customerId: !newCustomer && customerId ? customerId : undefined,
        newCustomer: newCustomer
          ? {
              name: ncName,
              businessName: ncBusiness,
              phone: ncPhone,
              location: ncLocation,
              region: ncRegion,
              customerType: ncType,
              gpsLat: gps?.lat,
              gpsLng: gps?.lng,
            }
          : undefined,
        customerName:
          type === "CASH" && !customerId && !newCustomer ? customerName : "",
        location,
        note,
        dueDate: type === "CREDIT" ? dueDate : "",
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setQty({});
        setCustomerName("");
        setNote("");
        setNewCustomer(false);
        setNcName(""); setNcBusiness(""); setNcPhone(""); setNcLocation("");
        setNcRegion(""); setNcType(""); setGps(null);
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Sale type */}
      <div className="grid grid-cols-2 gap-2.5">
        {(
          [
            { t: "CASH" as const, icon: Banknote, label: "Cash sale", hint: "Paid on the spot" },
            { t: "CREDIT" as const, icon: CreditCard, label: "Credit sale", hint: "Pay later — tracked" },
          ]
        ).map((o) => (
          <button
            key={o.t}
            type="button"
            onClick={() => setType(o.t)}
            className={cn(
              "relative flex flex-col items-start gap-1 rounded-2xl border p-3.5 text-left transition-all",
              type === o.t
                ? "border-primary bg-primary/[0.07] ring-1 ring-primary/40"
                : "border-border hover:border-primary/40",
            )}
          >
            <o.icon className={cn("size-5", type === o.t ? "text-primary" : "text-muted-foreground")} />
            <span className="text-sm font-semibold">{o.label}</span>
            <span className="text-xs text-muted-foreground">{o.hint}</span>
            {type === o.t && (
              <span className="absolute right-2.5 top-2.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-2.5" />
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Products */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Products
        </p>
        <div className="space-y-2">
          {products.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              You have no sellable stock in hand — request stock first.
            </p>
          )}
          {products.map((p) => (
            <div
              key={p.id}
              className={cn(
                "rounded-2xl border p-3 transition-colors",
                Number(qty[p.id]) > 0 ? "border-primary/50 bg-primary/[0.04]" : "border-border",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(p.inHand)} in hand · {p.unitLabel}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={p.inHand}
                    placeholder="Qty"
                    value={qty[p.id] ?? ""}
                    onChange={(e) => setQty((s) => ({ ...s, [p.id]: e.target.value }))}
                    className="h-9 w-20"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">@</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={price[p.id] ?? ""}
                      onChange={(e) => setPrice((s) => ({ ...s, [p.id]: e.target.value }))}
                      className="h-9 w-24"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Customer — pick from YOUR book or add a new one (any sale type) */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {type === "CREDIT" ? "Credit customer" : "Customer"}
        </p>
        {!newCustomer && (
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">
              {type === "CREDIT"
                ? "Select a customer…"
                : "Walk-in — no saved customer"}
            </option>
            {customers.map((c) => (
              <option
                key={c.id}
                value={c.id}
                disabled={type === "CREDIT" && c.creditSuspended}
              >
                {c.name}
                {type === "CREDIT" && c.creditSuspended ? " (credit suspended)" : ""}
              </option>
            ))}
          </select>
        )}
        {!newCustomer && type === "CASH" && !customerId && (
          <Input
            placeholder="Walk-in customer name (optional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        )}
        {newCustomer && (
          <div className="space-y-2.5 rounded-xl border border-border p-3">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Input placeholder="Customer name *" value={ncName} onChange={(e) => setNcName(e.target.value)} />
              <Input placeholder="Business name (optional)" value={ncBusiness} onChange={(e) => setNcBusiness(e.target.value)} />
              <Input placeholder="Phone" value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} />
              <select
                value={ncType}
                onChange={(e) => setNcType(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">Customer type…</option>
                <option>Pharmacy</option>
                <option>Shop</option>
                <option>Supermarket</option>
                <option>Kiosk</option>
                <option>Clinic</option>
                <option>Other</option>
              </select>
              <Input placeholder="Location / street" value={ncLocation} onChange={(e) => setNcLocation(e.target.value)} />
              <Input placeholder="Region" value={ncRegion} onChange={(e) => setNcRegion(e.target.value)} />
            </div>
            <button
              type="button"
              onClick={captureGps}
              disabled={gpsBusy}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                gps
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Check className={cn("size-3.5", !gps && "opacity-0")} />
              {gpsBusy ? "Getting GPS…" : gps ? "GPS captured" : "Capture GPS location"}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setNewCustomer((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <UserPlus className="size-4" />
          {newCustomer ? "Pick an existing customer instead" : "Add new customer"}
        </button>
        {type === "CREDIT" && (
          <div>
            <Label className="text-xs text-muted-foreground">Due date (optional)</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1.5 sm:max-w-52" />
          </div>
        )}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <div>
          <Label className="text-xs text-muted-foreground">Location (optional)</Label>
          <Input placeholder="e.g. Kariakoo market" value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Note (optional)</Label>
          <Input placeholder="Anything worth noting…" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
        </div>
      </div>

      <Button
        size="lg"
        className="h-12 w-full rounded-full text-base shadow-glow"
        disabled={pending || items.length === 0}
        onClick={submit}
      >
        {pending
          ? "Recording…"
          : total > 0
            ? `Record ${type === "CASH" ? "cash" : "credit"} sale · ${formatCurrency(total)}`
            : "Record sale"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Stock is deducted from your hand the moment the sale is recorded.
      </p>
    </div>
  );
}
