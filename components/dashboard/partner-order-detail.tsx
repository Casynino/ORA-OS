"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  X,
  Truck,
  Lock,
  Plus,
  Trash2,
  Send,
  ClipboardCheck,
  PackageCheck,
  StickyNote,
  Receipt,
  Smartphone,
  Building2,
  CreditCard,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  partnerUpdateOrder,
  cancelRequest,
  claimOrderPayment,
} from "@/lib/actions/requests";
import { ORA_PAYMENT } from "@/lib/constants";
import { customerOrderStatus, type CustomerTone } from "@/lib/order-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "@/components/ui/use-toast";
import { cn, formatCurrency, formatDateTime, humanize } from "@/lib/utils";

type Item = {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number | null;
};
type CatalogItem = { productId: string; name: string; sku: string; price: number };

export type POrderDTO = {
  id: string;
  code: string;
  status: string;
  paymentType: string;
  paymentStatus: string;
  paymentClaimedAt: string | null;
  invoiceNo: string | null;
  totalAmount: number | null;
  note: string | null;
  adminNote: string | null;
  deliveryAddress: string | null;
  contactPhone: string | null;
  reviewedByName: string | null;
  createdAt: string;
  items: Item[];
  catalog: CatalogItem[];
};

const TONE_VARIANT: Record<
  CustomerTone,
  "success" | "warning" | "destructive" | "accent" | "secondary"
> = {
  success: "success",
  warning: "warning",
  danger: "destructive",
  info: "accent",
  muted: "secondary",
};

type Line = { productId: string; name: string; sku: string; qty: string; price: number };

export function PartnerOrderDetail({ order }: { order: POrderDTO }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const editable = order.status === "PENDING" || order.status === "PRICED";

  const catalogById = new Map(order.catalog.map((c) => [c.productId, c]));
  const [lines, setLines] = useState<Line[]>(
    order.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      sku: i.sku,
      qty: String(i.quantity),
      price: i.unitPrice ?? catalogById.get(i.productId)?.price ?? 0,
    })),
  );
  const [addId, setAddId] = useState("");

  const setQty = (pid: string, v: string) =>
    setLines((p) => p.map((l) => (l.productId === pid ? { ...l, qty: v } : l)));
  const removeLine = (pid: string) =>
    setLines((p) => p.filter((l) => l.productId !== pid));
  const addLine = () => {
    const c = catalogById.get(addId);
    if (!c) return;
    setLines((p) => [
      ...p,
      { productId: c.productId, name: c.name, sku: c.sku, qty: "1", price: c.price },
    ]);
    setAddId("");
  };
  const addable = order.catalog.filter(
    (c) => !lines.some((l) => l.productId === c.productId),
  );
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * l.price, 0);

  function save() {
    if (lines.length === 0) {
      toast({ variant: "error", title: "Keep at least one product." });
      return;
    }
    start(async () => {
      const res = await partnerUpdateOrder({
        requestId: order.id,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: Math.max(1, Math.round(Number(l.qty) || 1)),
        })),
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  function cancel() {
    start(async () => {
      const res = await cancelRequest(order.id);
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        router.push("/partner/requests");
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  const cs = customerOrderStatus(order);
  // The payment panel carries its own messaging for awaiting/verifying cash.
  const showStatusMessage = !(
    order.status === "APPROVED" &&
    order.paymentType === "IMMEDIATE" &&
    order.paymentStatus === "UNPAID"
  );

  // Customer journey — only stages that are actually complete are filled in.
  const isCredit = order.paymentType === "CREDIT";
  const journey = [
    { icon: Send, label: "Submitted" },
    {
      icon: isCredit ? CreditCard : Receipt,
      label: isCredit ? "Credit approval" : "Payment",
    },
    { icon: ClipboardCheck, label: "Confirmed" },
    { icon: Truck, label: "In transit" },
    { icon: PackageCheck, label: "Delivered" },
  ];
  // How far the order has genuinely progressed (last *completed* stage).
  const doneThrough =
    cs.key === "delivered"
      ? 4
      : cs.key === "transit"
        ? 3
        : cs.key === "confirmed"
          ? 2
          : 0; // submitted / awaiting payment / awaiting credit → only "Submitted"
  // The stage currently in progress (pulses); -1 when nothing is pending.
  const currentStage =
    cs.key === "awaiting_payment" ||
    cs.key === "verifying" ||
    cs.key === "credit_review"
      ? 1
      : -1;

  return (
    <div className="space-y-6">
      <Link
        href="/partner/requests"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        My orders
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {order.code}
            </h1>
            <Badge variant={TONE_VARIANT[cs.tone]}>{cs.label}</Badge>
            <Badge variant={order.paymentType === "CREDIT" ? "accent" : "secondary"}>
              {humanize(order.paymentType)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed {formatDateTime(order.createdAt)}
            {order.invoiceNo ? ` · Invoice ${order.invoiceNo}` : ""}
          </p>
        </div>
        {order.totalAmount != null && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Order total</p>
            <p className="font-display text-2xl font-bold text-primary">
              {formatCurrency(order.totalAmount)}
            </p>
          </div>
        )}
      </div>

      {/* Payment panel (cash orders awaiting / under payment) */}
      {order.status === "APPROVED" &&
        order.paymentType === "IMMEDIATE" &&
        order.paymentStatus === "UNPAID" && <PaymentPanel order={order} />}

      {/* Friendly status message for every other stage */}
      {showStatusMessage && (
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-xl border p-3 text-sm",
            cs.tone === "success" && "border-success/30 bg-success/10 text-success",
            cs.tone === "warning" && "border-warning/30 bg-warning/10 text-warning",
            cs.tone === "danger" && "border-destructive/30 bg-destructive/10 text-destructive",
            cs.tone === "info" && "border-accent/30 bg-accent/10 text-accent",
            cs.tone === "muted" && "border-border bg-muted/40 text-muted-foreground",
          )}
        >
          {cs.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : (
            <Clock className="mt-0.5 size-4 shrink-0" />
          )}
          <p>{cs.message}</p>
        </div>
      )}

      {/* Timeline — only completed stages are filled; the pending one pulses */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <ol className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-2">
          {journey.map((s, i) => {
            const done = i <= doneThrough;
            const current = i === currentStage;
            return (
              <li key={s.label} className="flex items-center gap-3 sm:flex-1 sm:flex-col sm:text-center">
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                    done
                      ? "bg-gradient-to-br from-primary to-accent text-white shadow-glow"
                      : current
                        ? "animate-pulse bg-warning/15 text-warning ring-2 ring-warning/40"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  <s.icon className="size-5" />
                </span>
                <span
                  className={cn(
                    "text-sm font-medium sm:mt-1",
                    done ? "" : current ? "text-warning" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {!editable && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <Lock className="size-4 text-muted-foreground" />
          This order is now with the ORA team and can no longer be edited.
          Contact us if something needs to change.
        </div>
      )}

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        {/* Order */}
        <section className="rounded-2xl border border-border bg-card shadow-soft">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Order items</h2>
            <span className="text-xs text-muted-foreground">
              {editable ? "Edit quantities or lines" : "Read-only"}
            </span>
          </div>
          <div className="overflow-x-auto table-stack">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-3 py-3 font-medium">Qty</th>
                  <th className="px-3 py-3 font-medium">Your price</th>
                  <th className="px-5 py-3 text-right font-medium">Line total</th>
                  {editable && <th className="px-2 py-3" />}
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const qty = Number(l.qty) || 0;
                  return (
                    <tr key={l.productId} className="border-b border-border last:border-0">
                      <td data-cardtitle className="px-5 py-3">
                        <div className="font-medium">{l.name}</div>
                        <div className="text-xs text-muted-foreground">{l.sku}</div>
                      </td>
                      <td data-label="Qty" className="px-3 py-3">
                        {editable ? (
                          <Input
                            type="number"
                            min={1}
                            value={l.qty}
                            onChange={(e) => setQty(l.productId, e.target.value)}
                            className="h-9 w-20"
                          />
                        ) : (
                          <span>×{qty}</span>
                        )}
                      </td>
                      <td data-label="Your price" className="px-3 py-3 text-muted-foreground">
                        {formatCurrency(l.price)}
                      </td>
                      <td data-label="Line total" className="px-5 py-3 text-right font-medium">
                        {formatCurrency(qty * l.price)}
                      </td>
                      {editable && (
                        <td data-label="" className="px-2 py-3">
                          <button
                            onClick={() => removeLine(l.productId)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Remove"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {editable && addable.length > 0 && (
            <div className="flex items-center gap-2 border-t border-border px-5 py-3">
              <Select
                value={addId}
                onChange={(e) => setAddId(e.target.value)}
                className="h-9 max-w-xs"
              >
                <option value="">Add a product…</option>
                {addable.map((c) => (
                  <option key={c.productId} value={c.productId}>
                    {c.name} · {formatCurrency(c.price)}
                  </option>
                ))}
              </Select>
              <Button variant="outline" size="sm" onClick={addLine} disabled={!addId}>
                <Plus className="size-4" />
                Add
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border px-5 py-4">
            <span className="text-sm text-muted-foreground">
              {editable ? "Estimated total" : "Order total"}
            </span>
            <span className="font-display text-xl font-bold text-primary">
              {formatCurrency(editable ? total : order.totalAmount ?? 0)}
            </span>
          </div>

          {order.adminNote && (
            <div className="border-t border-border px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <StickyNote className="size-4 text-muted-foreground" />
                Note from the ORA team
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{order.adminNote}</p>
            </div>
          )}
        </section>

        {/* Delivery + actions */}
        <div className="space-y-6 lg:sticky lg:top-24">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Truck className="size-4 text-muted-foreground" />
              Delivery details
            </div>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Delivery address
                </dt>
                <dd className="mt-0.5 font-medium">
                  {order.deliveryAddress || "On file with the ORA team"}
                </dd>
              </div>
              {order.contactPhone && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Contact phone
                  </dt>
                  <dd className="mt-0.5 font-medium">{order.contactPhone}</dd>
                </div>
              )}
              {order.note && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Your note
                  </dt>
                  <dd className="mt-0.5 text-muted-foreground">{order.note}</dd>
                </div>
              )}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Need to change your delivery details? Contact the ORA team.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Receipt className="size-4 text-muted-foreground" />
              Payment
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Method</span>
              <span className="font-medium">{humanize(order.paymentType)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={order.paymentStatus} />
            </div>
          </section>

          {editable && (
            <div className="space-y-2">
              <Button onClick={save} disabled={pending} className="w-full">
                <Save className="size-4" />
                {pending ? "Saving…" : "Save changes"}
              </Button>
              <Button
                onClick={cancel}
                disabled={pending}
                variant="outline"
                className="w-full text-destructive hover:bg-destructive/10"
              >
                <X className="size-4" />
                Cancel order
              </Button>
              <p className="text-xs text-muted-foreground">
                Editing resubmits your order for ORA team review.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Order confirmation + payment panel for an approved cash order. */
function PaymentPanel({ order }: { order: POrderDTO }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const claimed = !!order.paymentClaimedAt;
  const amount =
    order.totalAmount != null ? formatCurrency(order.totalAmount) : "the invoice total";

  function claim() {
    start(async () => {
      const res = await claimOrderPayment(order.id);
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 shadow-soft",
        claimed
          ? "border-info/30 bg-info/5"
          : "border-warning/30 bg-warning/5",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Receipt className="size-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">
            {claimed ? "Payment under review" : "Complete your payment"}
          </h2>
        </div>
        {order.totalAmount != null && (
          <span className="font-display text-xl font-bold text-primary">
            {formatCurrency(order.totalAmount)}
          </span>
        )}
      </div>

      {claimed ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-info">
          <Clock className="size-4 shrink-0" />
          We&apos;ve received your confirmation — the ORA team is verifying your
          payment. Once confirmed, your order is released for fulfilment.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Pay {amount} using any option below, then tap{" "}
            <span className="font-medium text-foreground">
              &ldquo;I have made payment&rdquo;
            </span>
            . The ORA team confirms it and your order moves into fulfilment.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-3.5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Smartphone className="size-4 text-primary" /> Mobile money
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {ORA_PAYMENT.mobileMoney.label}
              </p>
              <p className="mt-1 text-sm">
                {ORA_PAYMENT.mobileMoney.name} ·{" "}
                <span className="font-medium">
                  {ORA_PAYMENT.mobileMoney.number}
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="size-4 text-primary" /> Bank transfer
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {ORA_PAYMENT.bank.bank}
              </p>
              <p className="mt-1 text-sm">
                {ORA_PAYMENT.bank.name} ·{" "}
                <span className="font-medium">{ORA_PAYMENT.bank.account}</span>
              </p>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {ORA_PAYMENT.note.replace("REQ-XXXX", order.code)}
          </p>

          <Button className="mt-4 w-full" onClick={claim} disabled={pending}>
            <CheckCircle2 className="size-4" />
            {pending ? "Submitting…" : "I have made payment"}
          </Button>
        </>
      )}
    </div>
  );
}
