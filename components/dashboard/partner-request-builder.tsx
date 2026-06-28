"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Minus,
  Plus,
  Send,
  Wallet,
  CreditCard,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Info,
  PackageCheck,
  ShieldAlert,
  Pencil,
  MapPin,
  Phone,
} from "lucide-react";
import { createRequest } from "@/lib/actions/requests";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

export type BuilderProduct = {
  id: string;
  name: string;
  sku: string;
  unitLabel: string;
  price: number;
  available: number;
  reserved: number;
  lowStock: boolean;
  image: string;
  size: string;
  color: string;
  use: string;
  accent: string;
};

export function PartnerRequestBuilder({
  products,
  credit,
  customer,
}: {
  products: BuilderProduct[];
  credit: { limit: number; outstanding: number; available: number };
  customer: {
    name?: string | null;
    phone?: string | null;
    organization?: string | null;
    location?: string | null;
    preferredPayment?: string | null;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // The customer explicitly chooses how they want to pay — we never auto-assign.
  // Their usual method is pre-selected as a convenience, but stays changeable.
  const hasActiveCredit = credit.outstanding > 0;
  const canUseCredit = credit.limit > 0 && !hasActiveCredit;
  const prefersCredit =
    (customer.preferredPayment ?? "").toLowerCase() === "credit";
  const [paymentType, setPaymentType] = useState<"IMMEDIATE" | "CREDIT">(
    prefersCredit && canUseCredit ? "CREDIT" : "IMMEDIATE",
  );
  const isCredit = paymentType === "CREDIT";

  const [qty, setQty] = useState<Record<string, number>>({});
  const [editDelivery, setEditDelivery] = useState(false);
  const [address, setAddress] = useState(customer.location ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [saveDefault, setSaveDefault] = useState(true);
  const [note, setNote] = useState("");

  const set = (id: string, v: number) =>
    setQty((p) => ({ ...p, [id]: Math.max(0, Math.min(v, 100000)) }));

  const lines = useMemo(
    () => products.filter((p) => (qty[p.id] ?? 0) > 0),
    [products, qty],
  );
  const totalQty = lines.reduce((s, p) => s + (qty[p.id] ?? 0), 0);
  const estValue = lines.reduce((s, p) => s + (qty[p.id] ?? 0) * p.price, 0);
  const stockIssues = lines.filter((p) => (qty[p.id] ?? 0) > p.available);
  const creditRemaining = credit.available - estValue;
  const creditExceeded = isCredit && estValue > credit.available;
  const blocked =
    lines.length === 0 || stockIssues.length > 0 || creditExceeded || pending;

  function submit() {
    if (lines.length === 0) {
      toast({ variant: "error", title: "Add at least one product." });
      return;
    }
    start(async () => {
      const res = await createRequest({
        items: lines.map((p) => ({ productId: p.id, quantity: qty[p.id] })),
        paymentType: isCredit ? "CREDIT" : "IMMEDIATE",
        deliveryAddress: address || undefined,
        contactPhone: phone || undefined,
        contactName: customer.name || undefined,
        deliverTo: customer.organization || undefined,
        note: note || undefined,
        saveDelivery: editDelivery && saveDefault,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        router.push(
          res.data ? `/partner/requests/${res.data.id}` : "/partner/requests",
        );
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
      {/* LEFT — products, delivery, payment, notes */}
      <div className="space-y-6">
        {/* Products */}
        <section>
          <SectionTitle
            icon={PackageCheck}
            title="Choose your products"
            sub="Live stock — enter the quantity you need for each size."
          />
          <div className="mt-4 space-y-3">
            {products.map((p) => {
              const q = qty[p.id] ?? 0;
              const over = q > p.available;
              return (
                <div
                  key={p.id}
                  className={cn(
                    "rounded-2xl border bg-card p-4 transition-colors",
                    over
                      ? "border-destructive/60"
                      : q > 0
                        ? "border-primary/50"
                        : "border-border",
                  )}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div
                      className="relative size-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-border"
                      style={{ background: `${p.accent}14` }}
                    >
                      <Image src={p.image} alt={p.name} fill sizes="80px" className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                          style={{ background: p.accent }}
                        >
                          {p.size}
                        </span>
                        <h3 className="font-semibold">{p.color}</h3>
                        <span className="text-xs text-muted-foreground">{p.use}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {p.unitLabel} · {formatCurrency(p.price)}/unit
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-success" />
                          <span className="font-medium text-foreground">{formatNumber(p.available)}</span>
                          <span className="text-muted-foreground">available</span>
                        </span>
                        {p.lowStock && (
                          <Badge variant="warning" className="gap-1">
                            <AlertTriangle className="size-3" />
                            Low stock
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
                      <div className="flex items-center gap-1.5">
                        <Button type="button" size="icon" variant="outline" className="size-9" onClick={() => set(p.id, q - 1)} disabled={q <= 0}>
                          <Minus className="size-3.5" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          value={q}
                          onChange={(e) => set(p.id, Number(e.target.value))}
                          className="h-9 w-20 text-center font-semibold"
                        />
                        <Button type="button" size="icon" variant="outline" className="size-9" onClick={() => set(p.id, q + 1)}>
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                      {q > 0 && !over && (
                        <span className="text-xs font-medium text-muted-foreground">= {formatCurrency(q * p.price)}</span>
                      )}
                      {over && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                          <AlertTriangle className="size-3" />
                          Only {formatNumber(p.available)} available
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Delivery — saved info, editable */}
        <section>
          <div className="flex items-center justify-between">
            <SectionTitle icon={Truck} title="Delivery information" sub="We'll deliver to your saved details." />
            {!editDelivery && (
              <Button size="sm" variant="outline" onClick={() => setEditDelivery(true)}>
                <Pencil className="size-3.5" /> Edit
              </Button>
            )}
          </div>
          <div className="mt-4 rounded-2xl border border-border bg-card p-4">
            {editDelivery ? (
              <div className="space-y-3">
                <div>
                  <Label>Delivery address</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, area, city / region…" className="mt-1.5" />
                </div>
                <div>
                  <Label>Contact phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +255…" className="mt-1.5" />
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" checked={saveDefault} onChange={(e) => setSaveDefault(e.target.checked)} className="size-4 rounded border-input" />
                  Save these as my default delivery details
                </label>
              </div>
            ) : (
              <div className="space-y-2.5 text-sm">
                <p className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    <span className="block text-xs uppercase tracking-wide text-muted-foreground">Delivery address</span>
                    <span className="font-medium">{address || "Not set — tap Edit to add"}</span>
                  </span>
                </p>
                <p className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    <span className="block text-xs uppercase tracking-wide text-muted-foreground">Phone number</span>
                    <span className="font-medium">{phone || "Not set — tap Edit to add"}</span>
                  </span>
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Payment method — the customer chooses */}
        <section>
          <SectionTitle icon={Wallet} title="Payment method" sub="Choose how you'd like to pay for this order." />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PayChoice
              active={!isCredit}
              icon={Wallet}
              title="Cash"
              desc="Pay after you submit your order."
              onClick={() => setPaymentType("IMMEDIATE")}
            />
            <PayChoice
              active={isCredit}
              disabled={!canUseCredit}
              icon={CreditCard}
              title="Credit"
              desc={
                canUseCredit
                  ? "Place this order on your credit account."
                  : hasActiveCredit
                    ? "Settle your current balance first."
                    : "No credit limit on your account yet."
              }
              onClick={() => canUseCredit && setPaymentType("CREDIT")}
            />
          </div>

          {isCredit ? (
            <div
              className={cn(
                "mt-3 rounded-2xl border p-4",
                creditExceeded ? "border-destructive/50 bg-destructive/5" : "border-border bg-card",
              )}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniStat label="Credit limit" value={formatCurrency(credit.limit)} />
                <MiniStat label="Available credit" value={formatCurrency(credit.available)} accent="success" />
                <MiniStat label="This order" value={formatCurrency(estValue)} />
                <MiniStat
                  label="Remaining after"
                  value={formatCurrency(Math.max(0, creditRemaining))}
                  accent={creditExceeded ? "destructive" : undefined}
                />
              </div>
              {creditExceeded ? (
                <div className="mt-3 space-y-2">
                  <p className="inline-flex items-start gap-1.5 text-sm font-medium text-destructive">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                    Your order exceeds your available credit limit by {formatCurrency(Math.abs(creditRemaining))}. Reduce the order quantity or switch to Cash payment.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setPaymentType("IMMEDIATE")}>
                    <Wallet className="size-3.5" /> Switch to Cash payment
                  </Button>
                </div>
              ) : (
                <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Info className="size-4" />
                  Within your limit — your order will be sent for credit approval.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-info/10 p-3 text-xs text-info">
              <Info className="mt-0.5 size-4 shrink-0" />
              Payment instructions will be shown right after you submit your order.
            </p>
          )}
        </section>

        {/* Notes */}
        <section>
          <SectionTitle icon={Info} title="Order notes (optional)" sub="Delivery timing, contact instructions, special requests…" />
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything we should know about this order?" className="mt-4" />
        </section>
      </div>

      {/* RIGHT — live order summary */}
      <div className="lg:sticky lg:top-24">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="border-b border-border bg-muted/40 px-5 py-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Order summary</h3>
              <Badge variant={isCredit ? "accent" : "secondary"}>{isCredit ? "Credit" : "Cash"}</Badge>
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div className="space-y-2">
              {lines.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Add products to build your order.
                </p>
              ) : (
                lines.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{p.size} {p.color}</span>
                    <span className="text-muted-foreground">×{qty[p.id]}</span>
                    <span className="w-24 text-right font-medium">{formatCurrency(qty[p.id] * p.price)}</span>
                  </div>
                ))
              )}
            </div>

            <dl className="space-y-2 border-t border-border pt-4 text-sm">
              <Row label="Total quantity" value={`${formatNumber(totalQty)} units`} />
              <Row label="Payment" value={isCredit ? "Credit" : "Cash"} />
              <div className="flex items-center justify-between border-t border-border pt-3">
                <dt className="font-semibold">Order total</dt>
                <dd className="font-display text-xl font-bold text-primary">{formatCurrency(estValue)}</dd>
              </div>
            </dl>

            {stockIssues.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                Some quantities exceed available stock. Adjust them to continue.
              </p>
            )}

            <Button className="w-full" onClick={submit} disabled={blocked}>
              <Send className="size-4" />
              {pending ? "Submitting…" : "Submit order"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, sub }: { icon: typeof Wallet; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function PayChoice({
  active,
  disabled,
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: typeof Wallet;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
        disabled
          ? "cursor-not-allowed border-border bg-muted/30 opacity-60"
          : active
            ? "border-primary bg-primary/5 ring-1 ring-primary"
            : "border-border bg-card hover:border-primary/50",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-primary text-white" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-semibold">
          {title}
          {active && <CheckCircle2 className="size-4 text-primary" />}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: "success" | "destructive" }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-semibold", accent === "success" && "text-success", accent === "destructive" && "text-destructive")}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
