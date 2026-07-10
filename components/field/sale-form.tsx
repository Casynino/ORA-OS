"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CreditCard,
  Check,
  UserPlus,
  Search,
  X,
} from "lucide-react";
import { recordFieldSale, createFieldCustomer } from "@/lib/actions/field";
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
type CustomerRow = {
  id: string;
  name: string;
  businessName?: string | null;
  phone?: string | null;
  location?: string | null;
  creditSuspended: boolean;
};

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
  // Customers saved during this visit — visible & selectable immediately,
  // before the server refresh lands.
  const [added, setAdded] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [savingCustomer, startSaveCustomer] = useTransition();
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

  // Full book = server list + just-saved ones (deduped by id).
  const allCustomers = useMemo(() => {
    const seen = new Set(customers.map((c) => c.id));
    return [...customers, ...added.filter((c) => !seen.has(c.id))];
  }, [customers, added]);
  const selected = allCustomers.find((c) => c.id === customerId) ?? null;

  // Live search across name, business name, phone and location.
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = q
      ? allCustomers.filter((c) =>
          [c.name, c.businessName, c.phone, c.location]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        )
      : allCustomers;
    return pool.slice(0, 8);
  }, [allCustomers, search]);

  function saveNewCustomer() {
    if (ncName.trim().length < 2) {
      toast({ variant: "error", title: "Enter the customer's name." });
      return;
    }
    startSaveCustomer(async () => {
      const res = await createFieldCustomer({
        name: ncName,
        businessName: ncBusiness,
        phone: ncPhone,
        location: ncLocation,
        region: ncRegion,
        customerType: ncType,
        gpsLat: gps?.lat,
        gpsLng: gps?.lng,
        notes: "",
      });
      if (res.ok && res.data) {
        // Saved for real — confirm, show them in the book, and select them.
        const saved: CustomerRow = {
          id: res.data.id,
          name: ncName.trim(),
          businessName: ncBusiness.trim() || null,
          phone: ncPhone.trim() || null,
          location: ncLocation.trim() || null,
          creditSuspended: false,
        };
        setAdded((a) => [...a, saved]);
        setCustomerId(saved.id);
        setNewCustomer(false);
        setNcName(""); setNcBusiness(""); setNcPhone(""); setNcLocation("");
        setNcRegion(""); setNcType(""); setGps(null);
        toast({ variant: "success", title: `${saved.name} saved & selected.` });
        router.refresh();
      } else if (!res.ok) {
        toast({ variant: "error", title: res.error });
      }
    });
  }

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
    if (type === "CREDIT" && !customerId)
      return toast({
        variant: "error",
        title: "Credit sales need a customer — pick one or save a new customer first.",
      });
    if (newCustomer)
      return toast({
        variant: "error",
        title: "Save (or cancel) the new customer first.",
      });

    start(async () => {
      const res = await recordFieldSale({
        type,
        items,
        // A saved customer can be attached to ANY sale — cash included —
        // so the customer's history stays complete.
        customerId: customerId || undefined,
        customerName: type === "CASH" && !customerId ? customerName : "",
        location,
        note,
        dueDate: type === "CREDIT" ? dueDate : "",
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setQty({});
        setCustomerName("");
        setNote("");
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

      {/* Customer — search YOUR book, or save a new one first, then it's
          selected automatically (any sale type). */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {type === "CREDIT" ? "Credit customer" : "Customer"}
        </p>

        {/* Selected customer chip */}
        {selected && !newCustomer && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/[0.04] px-3 py-2.5">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                <Check className="size-4 shrink-0 text-success" />
                {selected.name}
                {selected.businessName && (
                  <span className="truncate font-normal text-muted-foreground">
                    · {selected.businessName}
                  </span>
                )}
              </p>
              {(selected.phone || selected.location) && (
                <p className="ml-[22px] text-xs text-muted-foreground">
                  {[selected.phone, selected.location].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setCustomerId(""); setSearch(""); }}
              className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear customer"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Search picker */}
        {!selected && !newCustomer && (
          <div className="relative">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setListOpen(true); }}
                onFocus={() => setListOpen(true)}
                placeholder={
                  allCustomers.length === 0
                    ? "No saved customers yet — add one below"
                    : "Search your customers — name, business, phone…"
                }
                className="pl-9"
              />
            </div>
            {listOpen && allCustomers.length > 0 && (
              <div className="mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-soft">
                {matches.length === 0 ? (
                  <p className="px-3 py-2.5 text-sm text-muted-foreground">
                    No customer matches “{search}” — add them below.
                  </p>
                ) : (
                  matches.map((c) => {
                    const blocked = type === "CREDIT" && c.creditSuspended;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={blocked}
                        onClick={() => {
                          setCustomerId(c.id);
                          setListOpen(false);
                          setSearch("");
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                          blocked
                            ? "cursor-not-allowed opacity-50"
                            : "hover:bg-muted/60",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {c.name}
                            {c.businessName ? (
                              <span className="font-normal text-muted-foreground">
                                {" "}· {c.businessName}
                              </span>
                            ) : null}
                          </span>
                          {(c.phone || c.location) && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {[c.phone, c.location].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </span>
                        {blocked && (
                          <span className="shrink-0 text-[10px] text-destructive">
                            credit suspended
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* Walk-in fallback (cash only, nothing selected) */}
        {!selected && !newCustomer && type === "CASH" && (
          <Input
            placeholder="Walk-in customer name (optional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        )}

        {/* New customer — SAVED FIRST, then auto-selected */}
        {newCustomer && (
          <div className="space-y-2.5 rounded-xl border border-primary/30 p-3">
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
            <div className="flex flex-wrap items-center gap-2">
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
              <div className="ml-auto flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full"
                  disabled={savingCustomer || ncName.trim().length < 2}
                  onClick={saveNewCustomer}
                >
                  {savingCustomer ? "Saving…" : "Save customer"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => setNewCustomer(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The customer is saved to your book first — then they're selected
              for this sale automatically.
            </p>
          </div>
        )}

        {!newCustomer && (
          <button
            type="button"
            onClick={() => { setNewCustomer(true); setListOpen(false); }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <UserPlus className="size-4" />
            Add new customer
          </button>
        )}

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
