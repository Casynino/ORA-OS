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
import {
  ReceivingAccountPicker,
  METHOD_LABELS,
  type ReceivingAccount,
} from "@/components/ui/receiving-account-picker";
import { ProofUpload } from "@/components/ui/proof-upload";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { CUSTOMER_TYPES } from "@/lib/customer-types";

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
  creditLimit?: number | null;
};

export function FieldSaleForm({
  products,
  customers,
  accounts = [],
  initialCustomerId,
  warehouse = false,
  hideStockCount = false,
}: {
  products: ProductRow[];
  customers: CustomerRow[];
  accounts?: ReceivingAccount[];
  // Preselect a customer (e.g. launched from that customer's profile).
  initialCustomerId?: string;
  // Office (Admin/Finance) sale: stock is drawn from the warehouse, so the copy
  // says "available" / "the warehouse" instead of "in hand" / "your book".
  warehouse?: boolean;
  // Show only "In stock" / "Out of stock" instead of the exact quantity. Warehouse
  // counts are visible only to Admin & Warehouse; Finance (and reps) see status.
  hideStockCount?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [type, setType] = useState<"CASH" | "CREDIT">("CASH");
  // Where the money lands (CASH sales).
  const firstMethod = accounts[0]?.type ?? "CASH";
  const [payMethod, setPayMethod] = useState(firstMethod);
  const [payAccountId, setPayAccountId] = useState(
    accounts.find((a) => a.type === firstMethod)?.id ?? "",
  );
  const [payReference, setPayReference] = useState("");
  // Direct bank/mobile payments: the rep attaches the customer's receipt so
  // finance can verify the money actually reached ORA's account.
  const [payProofUrl, setPayProofUrl] = useState("");
  // Cheque payments capture the instrument details for finance to verify.
  const [chequeBank, setChequeBank] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const isDirectPay = type === "CASH" && payMethod !== "CASH";
  const isCheque = type === "CASH" && payMethod === "CHEQUE";
  const [qty, setQty] = useState<Record<string, string>>({});
  const [price, setPrice] = useState<Record<string, string>>(
    Object.fromEntries(products.map((p) => [p.id, String(p.price)])),
  );
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [newCustomer, setNewCustomer] = useState(false);
  // Customers saved during this visit — visible & selectable immediately,
  // before the server refresh lands.
  const [added, setAdded] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [savingCustomer, startSaveCustomer] = useTransition();
  const [ncBusiness, setNcBusiness] = useState("");
  const [ncEmail, setNcEmail] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [ncType, setNcType] = useState("");
  const [ncRegion, setNcRegion] = useState("");
  const [ncDistrict, setNcDistrict] = useState("");
  const [ncLocation, setNcLocation] = useState("");
  const [ncVolume, setNcVolume] = useState("");
  const [ncPayment, setNcPayment] = useState("");
  const [ncLicense, setNcLicense] = useState("");
  const [ncTax, setNcTax] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [customerName, setCustomerName] = useState(""); // cash walk-in
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");

  // Full book = server list + just-saved ones (deduped by id).
  const allCustomers = useMemo(() => {
    const seen = new Set(customers.map((c) => c.id));
    return [...customers, ...added.filter((c) => !seen.has(c.id))];
  }, [customers, added]);
  const selected = allCustomers.find((c) => c.id === customerId) ?? null;

  // Live search across name, business name, phone and location. With no search
  // the rep can scroll the whole book — every customer, sorted A→Z — for when
  // they can't remember the exact name.
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = q
      ? allCustomers.filter((c) =>
          [c.name, c.businessName, c.phone, c.location]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        )
      : allCustomers;
    const label = (c: CustomerRow) => (c.businessName ?? c.name ?? "").toLowerCase();
    return [...pool].sort((a, b) => label(a).localeCompare(label(b)));
  }, [allCustomers, search]);

  function saveNewCustomer() {
    const biz = ncBusiness.trim();
    if (biz.length < 2) {
      toast({ variant: "error", title: "Enter the customer's business name." });
      return;
    }
    startSaveCustomer(async () => {
      const res = await createFieldCustomer({
        businessName: biz,
        email: ncEmail,
        phone: ncPhone,
        location: ncLocation,
        region: ncRegion,
        district: ncDistrict,
        customerType: ncType,
        expectedVolume: ncVolume,
        preferredPayment: ncPayment,
        businessLicense: ncLicense,
        taxId: ncTax,
        gpsLat: gps?.lat,
        gpsLng: gps?.lng,
        notes: "",
      });
      if (res.ok && res.data) {
        // Saved for real — confirm, show them in the book, and select them.
        const saved: CustomerRow = {
          id: res.data.id,
          name: biz,
          businessName: biz,
          phone: ncPhone.trim() || null,
          location: ncLocation.trim() || null,
          creditSuspended: false,
        };
        setAdded((a) => [...a, saved]);
        setCustomerId(saved.id);
        setNewCustomer(false);
        setNcBusiness(""); setNcEmail(""); setNcPhone(""); setNcType("");
        setNcRegion(""); setNcDistrict(""); setNcLocation(""); setNcVolume("");
        setNcPayment(""); setNcLicense(""); setNcTax(""); setGps(null);
        toast({ variant: "success", title: `${biz} saved & selected.` });
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
          title: hideStockCount
            ? `Not enough ${p.name} in stock for that quantity.`
            : warehouse
              ? `Only ${p.inHand} of ${p.name} available in the warehouse.`
              : `You only have ${p.inHand} of ${p.name} in hand.`,
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
    if (type === "CREDIT" && !dueDate)
      return toast({
        variant: "error",
        title: "Credit sales need a payment due date.",
      });
    if (type === "CASH" && !isCheque && accounts.length > 0 && !payAccountId)
      return toast({
        variant: "error",
        title: "Select which account received the money.",
      });
    if (isCheque && (!chequeBank.trim() || !chequeNumber.trim() || !chequeDate))
      return toast({
        variant: "error",
        title: "Enter the cheque bank, number and date.",
      });
    if (isCheque && !payProofUrl)
      return toast({
        variant: "error",
        title: "Attach a photo of the cheque.",
      });

    start(async () => {
      const res = await recordFieldSale({
        type,
        items,
        paymentMethod:
          type === "CASH" ? METHOD_LABELS[payMethod] ?? payMethod : "",
        paymentAccountId: type === "CASH" && !isCheque ? payAccountId : "",
        reference: type === "CASH" ? payReference : "",
        paymentProofUrl: isDirectPay ? payProofUrl : "",
        chequeBank: isCheque ? chequeBank : "",
        chequeNumber: isCheque ? chequeNumber : "",
        chequeDate: isCheque ? chequeDate : "",
        // A saved customer can be attached to ANY sale — cash included —
        // so the customer's history stays complete.
        customerId: customerId || undefined,
        customerName: type === "CASH" && !customerId ? customerName : "",
        note,
        dueDate: type === "CREDIT" ? dueDate : "",
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        // Full reset so the rep can immediately start a fresh sale — clear the
        // cart, the selected/typed customer, and EVERY payment detail (method,
        // account, reference, cheque bank/number/date and the attached photo).
        setType("CASH");
        setQty({});
        setPrice(Object.fromEntries(products.map((p) => [p.id, String(p.price)])));
        setCustomerId("");
        setCustomerName("");
        setSearch("");
        setListOpen(false);
        setNewCustomer(false);
        setDueDate("");
        setPayMethod(firstMethod);
        setPayAccountId(accounts.find((a) => a.type === firstMethod)?.id ?? "");
        setPayReference("");
        setPayProofUrl("");
        setChequeBank("");
        setChequeNumber("");
        setChequeDate("");
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
              {warehouse
                ? "No stock available in the warehouse right now."
                : "You have no sellable stock in hand — request stock first."}
            </p>
          )}
          {products.map((p) => {
            const out = p.inHand <= 0;
            return (
            <div
              key={p.id}
              className={cn(
                "rounded-2xl border p-3 transition-colors",
                Number(qty[p.id]) > 0 ? "border-primary/50 bg-primary/[0.04]" : "border-border",
                out && "opacity-60",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {hideStockCount ? (
                      <span className={out ? "text-muted-foreground" : "text-success"}>
                        {out ? "Out of stock" : "In stock"}
                      </span>
                    ) : (
                      `${formatNumber(p.inHand)} ${warehouse ? "available" : "in hand"}`
                    )}
                    {" · "}
                    {p.unitLabel}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={hideStockCount ? undefined : p.inHand}
                    disabled={out}
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
                      disabled={out}
                      value={price[p.id] ?? ""}
                      onChange={(e) => setPrice((s) => ({ ...s, [p.id]: e.target.value }))}
                      className="h-9 w-24"
                    />
                  </div>
                </div>
              </div>
            </div>
            );
          })}
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
                {selected.businessName ?? selected.name}
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
                    : "Search or scroll your customers (A–Z)…"
                }
                className="pl-9"
              />
            </div>
            {listOpen && allCustomers.length > 0 && (
              <div className="mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-border bg-card shadow-soft">
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
                            {c.businessName ?? c.name}
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
            placeholder="Walk-in business name (optional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        )}

        {/* New customer — SAVED FIRST, then auto-selected */}
        {newCustomer && (
          <div className="space-y-2.5 rounded-xl border border-primary/30 p-3">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Input placeholder="Business / organisation name *" value={ncBusiness} onChange={(e) => setNcBusiness(e.target.value)} className="sm:col-span-2" />
              <Input type="email" placeholder="Email" value={ncEmail} onChange={(e) => setNcEmail(e.target.value)} />
              <Input placeholder="Phone" value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} />
              <select
                value={ncType}
                onChange={(e) => setNcType(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">Business type…</option>
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <select
                value={ncPayment}
                onChange={(e) => setNcPayment(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">Preferred payment…</option>
                <option>Cash</option>
                <option>Credit</option>
              </select>
              <Input placeholder="Region" value={ncRegion} onChange={(e) => setNcRegion(e.target.value)} />
              <Input placeholder="District" value={ncDistrict} onChange={(e) => setNcDistrict(e.target.value)} />
              <div className="sm:col-span-2">
                <Input placeholder="Street / physical address" value={ncLocation} onChange={(e) => setNcLocation(e.target.value)} />
                <p className="mt-1 text-[11px] text-muted-foreground">This becomes their default delivery address.</p>
              </div>
              <Input placeholder="Expected monthly volume — e.g. 500 packs" value={ncVolume} onChange={(e) => setNcVolume(e.target.value)} />
              <Input placeholder="Business licence (optional)" value={ncLicense} onChange={(e) => setNcLicense(e.target.value)} />
              <Input placeholder="Tax ID / TIN (optional)" value={ncTax} onChange={(e) => setNcTax(e.target.value)} className="sm:col-span-2" />
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
                  disabled={savingCustomer || ncBusiness.trim().length < 2}
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
          <div className="space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">Payment due date *</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1.5 sm:max-w-52" />
            </div>
            {selected?.creditLimit != null && (
              <p className="text-xs text-muted-foreground">
                {selected.businessName ?? selected.name}&apos;s credit limit:{" "}
                <span className="font-medium text-foreground">
                  TSh {selected.creditLimit.toLocaleString()}
                </span>{" "}
                — the sale is blocked if it goes past what&apos;s available.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Payment — how & where the money was received (cash sales) */}
      {type === "CASH" && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Payment received
          </p>
          <ReceivingAccountPicker
            accounts={accounts}
            method={payMethod}
            accountId={payAccountId}
            reference={payReference}
            onMethod={setPayMethod}
            onAccount={setPayAccountId}
            onReference={setPayReference}
          />
          {isCheque && (
            <div className="grid gap-2.5 rounded-xl border border-primary/30 bg-primary/[0.03] p-3 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <p className="text-xs font-medium text-foreground">Cheque details</p>
                <p className="text-[11px] text-muted-foreground">
                  Finance verifies the cheque and confirms receipt before the sale is official.
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Bank name *</Label>
                <Input value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} placeholder="e.g. NMB Bank" className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Cheque number *</Label>
                <Input value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} placeholder="e.g. 001234" className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Cheque date *</Label>
                <Input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} className="mt-1 h-9" />
              </div>
            </div>
          )}
          {isDirectPay && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {isCheque
                  ? "Cheque photo * — attach a picture of the cheque"
                  : "Proof of payment — attach the customer's receipt / screenshot"}
              </Label>
              <ProofUpload
                value={payProofUrl}
                onChange={setPayProofUrl}
                label={isCheque ? "Attach cheque photo" : "Attach payment proof"}
              />
              <p className="text-[11px] text-muted-foreground">
                Finance verifies this against ORA&apos;s account before the sale becomes official.
              </p>
            </div>
          )}
        </div>
      )}

      <div>
        <Label className="text-xs text-muted-foreground">Note (optional)</Label>
        <Input placeholder="Anything worth noting…" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
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
        {warehouse
          ? "Stock is deducted from the warehouse the moment the sale is recorded."
          : "Stock is deducted from your hand the moment the sale is recorded."}
      </p>
    </div>
  );
}
