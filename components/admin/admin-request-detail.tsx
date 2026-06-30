"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  X,
  Truck,
  Building2,
  MapPin,
  Mail,
  Phone,
  CalendarClock,
  StickyNote,
  Save,
  Send,
  Search,
  ClipboardCheck,
  PackageCheck,
  Plus,
  Trash2,
  Receipt,
} from "lucide-react";
import {
  updateRequestOrder,
  approveRequest,
  rejectRequest,
  fulfillRequest,
  dispatchOrder,
  confirmOrderPayment,
  rejectOrderPayment,
} from "@/lib/actions/requests";
import { ActionButton } from "@/components/dashboard/action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "@/components/ui/use-toast";
import { cn, formatCurrency, formatDateTime, humanize } from "@/lib/utils";

type Item = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number | null;
};
type CatalogItem = { productId: string; name: string; sku: string; price: number };

export type DetailDTO = {
  id: string;
  code: string;
  type: string;
  status: string;
  paymentType: string;
  paymentStatus: string;
  paymentClaimedAt: string | null;
  invoiceNo: string | null;
  deliveredAt: string | null;
  discount: number;
  deliveryCharge: number;
  createdAt: string;
  note: string | null;
  adminNote: string | null;
  deliverTo: string | null;
  deliveryAddress: string | null;
  contactName: string | null;
  contactPhone: string | null;
  deliverBy: string | null;
  warehouseName: string | null;
  reviewedByName: string | null;
  totalAmount: number | null;
  items: Item[];
  catalog: CatalogItem[];
  partner: {
    name: string;
    org: string | null;
    role: string;
    status: string;
    location: string | null;
    email: string;
    phone: string | null;
    memberSince: string;
    creditLimit: number;
    outstanding: number;
    available: number;
  };
};

const STEPS = [
  { icon: Send, label: "Submitted" },
  { icon: Search, label: "Priced" },
  { icon: ClipboardCheck, label: "Approved" },
  { icon: Truck, label: "In transit" },
  { icon: PackageCheck, label: "Delivered" },
];

function stepIndex(status: string) {
  switch (status) {
    case "PENDING":
      return 0;
    case "PRICED":
      return 1;
    case "APPROVED":
      return 2;
    case "IN_TRANSIT":
      return 3;
    case "FULFILLED":
      return 4;
    default:
      return 0;
  }
}

type Line = { productId: string; name: string; sku: string; qty: string; price: string };

export function AdminRequestDetail({ request }: { request: DetailDTO }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const editable = request.status === "PENDING" || request.status === "PRICED";
  const isCredit = request.paymentType === "CREDIT";
  // Credit orders are approved here (credit-approval step); prices are pre-agreed.
  const canApprove =
    (request.status === "PENDING" || request.status === "PRICED") && isCredit;
  const canReject = ["PENDING", "PRICED"].includes(request.status);
  // Cash order awaiting the admin's payment confirmation — confirmed right here.
  const canConfirmPayment =
    request.status === "APPROVED" &&
    request.paymentType === "IMMEDIATE" &&
    request.paymentStatus === "UNPAID";
  const customerClaimedPayment = !!request.paymentClaimedAt;
  // Dispatch only once payment is cleared (cash PAID or credit OUTSTANDING).
  const canDispatch =
    request.status === "APPROVED" && request.paymentStatus !== "UNPAID";
  const canDeliver = request.status === "IN_TRANSIT";

  const catalogById = useMemo(
    () => new Map(request.catalog.map((c) => [c.productId, c])),
    [request.catalog],
  );

  const [lines, setLines] = useState<Line[]>(
    request.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      sku: i.sku,
      qty: String(i.quantity),
      price: (i.unitPrice ?? catalogById.get(i.productId)?.price ?? 0).toString(),
    })),
  );
  const [discount, setDiscount] = useState(String(request.discount || 0));
  const [delivery, setDelivery] = useState(String(request.deliveryCharge || 0));
  const [addId, setAddId] = useState("");

  const setLine = (pid: string, k: "qty" | "price", v: string) =>
    setLines((p) => p.map((l) => (l.productId === pid ? { ...l, [k]: v } : l)));
  const removeLine = (pid: string) =>
    setLines((p) => p.filter((l) => l.productId !== pid));
  const addLine = () => {
    const c = catalogById.get(addId);
    if (!c) return;
    setLines((p) => [
      ...p,
      { productId: c.productId, name: c.name, sku: c.sku, qty: "1", price: String(c.price) },
    ]);
    setAddId("");
  };
  const addable = request.catalog.filter(
    (c) => !lines.some((l) => l.productId === c.productId),
  );

  const subtotal = lines.reduce(
    (s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0),
    0,
  );
  const liveTotal = Math.max(0, subtotal - (Number(discount) || 0) + (Number(delivery) || 0));

  function saveOrder() {
    if (lines.length === 0) {
      toast({ variant: "error", title: "Keep at least one product." });
      return;
    }
    start(async () => {
      const res = await updateRequestOrder({
        requestId: request.id,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: Math.max(1, Math.round(Number(l.qty) || 1)),
          unitPrice: Math.max(0, Math.round(Number(l.price) || 0)),
        })),
        discount: Math.max(0, Math.round(Number(discount) || 0)),
        deliveryCharge: Math.max(0, Math.round(Number(delivery) || 0)),
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  function reject() {
    const reason = window.prompt("Reason for rejection (optional)") ?? undefined;
    start(async () => {
      const res = await rejectRequest(request.id, reason);
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        router.push("/admin/requests");
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  const p = request.partner;
  const statusVariant =
    p.status === "ACTIVE" ? "success" : p.status === "PENDING" ? "warning" : "destructive";
  const active = stepIndex(request.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/requests"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All requests
        </Link>
        {request.reviewedByName && (
          <span className="text-xs text-muted-foreground">
            Last actioned by {request.reviewedByName}
          </span>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {request.code}
            </h1>
            <StatusBadge status={request.status} />
            <Badge variant={request.paymentType === "CREDIT" ? "accent" : "secondary"}>
              {humanize(request.paymentType)}
            </Badge>
            {request.paymentStatus !== "UNPAID" && (
              <StatusBadge status={request.paymentStatus} />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {humanize(request.type)} · {formatDateTime(request.createdAt)}
            {request.invoiceNo ? ` · Invoice ${request.invoiceNo}` : ""}
          </p>
        </div>
        {request.totalAmount != null && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Order total</p>
            <p className="font-display text-2xl font-bold text-primary">
              {formatCurrency(request.totalAmount)}
            </p>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <ol className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-2">
          {STEPS.map((s, i) => (
            <li key={s.label} className="flex items-center gap-3 sm:flex-1 sm:flex-col sm:text-center">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full",
                  i <= active
                    ? "bg-gradient-to-br from-primary to-accent text-white shadow-glow"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <s.icon className="size-5" />
              </span>
              <span className={cn("text-sm font-medium sm:mt-1", i <= active ? "" : "text-muted-foreground")}>
                {s.label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        {/* LEFT — order */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display text-lg font-semibold">Order items</h2>
              <span className="text-xs text-muted-foreground">
                {editable ? "Edit quantities, prices, lines & charges" : "Read-only"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Product</th>
                    <th className="px-3 py-3 font-medium">Qty</th>
                    <th className="px-3 py-3 font-medium">Unit price</th>
                    <th className="px-5 py-3 text-right font-medium">Line total</th>
                    {editable && <th className="px-2 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const qty = Number(l.qty) || 0;
                    const price = Number(l.price) || 0;
                    return (
                      <tr key={l.productId} className="border-b border-border last:border-0">
                        <td className="px-5 py-3">
                          <div className="font-medium">{l.name}</div>
                          <div className="text-xs text-muted-foreground">{l.sku}</div>
                        </td>
                        <td className="px-3 py-3">
                          {editable ? (
                            <Input
                              type="number"
                              min={1}
                              value={l.qty}
                              onChange={(e) => setLine(l.productId, "qty", e.target.value)}
                              className="h-9 w-20"
                            />
                          ) : (
                            <span>×{qty}</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {editable ? (
                            <Input
                              type="number"
                              min={0}
                              value={l.price}
                              onChange={(e) => setLine(l.productId, "price", e.target.value)}
                              className="h-9 w-28"
                            />
                          ) : (
                            formatCurrency(price)
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-medium">
                          {formatCurrency(qty * price)}
                        </td>
                        {editable && (
                          <td className="px-2 py-3">
                            <button
                              onClick={() => removeLine(l.productId)}
                              className="text-muted-foreground hover:text-destructive"
                              title="Remove line"
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

            {/* Charges + total */}
            <div className="space-y-2 border-t border-border px-5 py-4 text-sm">
              <Row label="Subtotal" value={formatCurrency(subtotal)} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Discount</span>
                {editable ? (
                  <Input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="h-8 w-28 text-right"
                  />
                ) : (
                  <span>− {formatCurrency(request.discount)}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Delivery charge</span>
                {editable ? (
                  <Input
                    type="number"
                    min={0}
                    value={delivery}
                    onChange={(e) => setDelivery(e.target.value)}
                    className="h-8 w-28 text-right"
                  />
                ) : (
                  <span>+ {formatCurrency(request.deliveryCharge)}</span>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="font-semibold">
                  {editable ? "Estimated total" : "Order total"}
                </span>
                <span className="font-display text-xl font-bold text-primary">
                  {formatCurrency(editable ? liveTotal : request.totalAmount ?? 0)}
                </span>
              </div>
            </div>

            {editable && (
              <div className="border-t border-border px-5 py-4">
                <Button onClick={saveOrder} disabled={pending} className="w-full sm:w-auto">
                  <Save className="size-4" />
                  {pending ? "Saving…" : "Save order & pricing"}
                </Button>
              </div>
            )}
          </section>

          {(request.note || request.adminNote) && (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              {request.note && (
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <StickyNote className="size-4 text-muted-foreground" />
                    Partner note
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{request.note}</p>
                </div>
              )}
              {request.adminNote && (
                <div className={request.note ? "mt-4" : ""}>
                  <div className="text-sm font-semibold">Admin note</div>
                  <p className="mt-1 text-sm text-muted-foreground">{request.adminNote}</p>
                </div>
              )}
            </section>
          )}
        </div>

        {/* RIGHT */}
        <div className="space-y-6 lg:sticky lg:top-24">
          {/* Customer */}
          <section className="rounded-2xl border border-border bg-card shadow-soft">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />
                  <h2 className="font-semibold">{p.org ?? p.name}</h2>
                </div>
                <Badge variant={statusVariant}>{humanize(p.status)}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {p.name} · {humanize(p.role)}
              </p>
            </div>
            <div className="space-y-2.5 px-5 py-4 text-sm">
              <Line2 icon={Mail} value={p.email} />
              {p.phone && <Line2 icon={Phone} value={p.phone} />}
              {p.location && <Line2 icon={MapPin} value={p.location} />}
              <Line2
                icon={CalendarClock}
                value={`Member since ${new Date(p.memberSince).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`}
              />
            </div>
            <div className="grid grid-cols-3 gap-3 border-t border-border bg-muted/30 px-5 py-4 text-sm">
              <KV label="Credit limit" value={formatCurrency(p.creditLimit)} />
              <KV label="Outstanding" value={formatCurrency(p.outstanding)} />
              <KV label="Available" value={formatCurrency(p.available)} accent="text-success" />
            </div>
          </section>

          {/* Payment & delivery */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Receipt className="size-4 text-muted-foreground" />
              Payment & delivery
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <KV label="Payment" value={humanize(request.paymentType)} />
              <div>
                <p className="text-xs text-muted-foreground">Payment status</p>
                <StatusBadge status={request.paymentStatus} className="mt-0.5" />
              </div>
              <KV label="Invoice" value={request.invoiceNo ?? "—"} />
              <KV
                label="Delivered"
                value={
                  request.deliveredAt
                    ? new Date(request.deliveredAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })
                    : "—"
                }
              />
              <KV label="Warehouse" value={request.warehouseName ?? "—"} />
              <KV label="Destination" value={request.deliverTo ?? "—"} />
              <KV label="Delivery address" value={request.deliveryAddress ?? "—"} />
              <KV
                label="Contact"
                value={
                  request.contactName
                    ? `${request.contactName}${request.contactPhone ? ` · ${request.contactPhone}` : ""}`
                    : (request.contactPhone ?? "—")
                }
              />
            </div>
          </section>

          {/* Actions */}
          {(canApprove || canReject || canConfirmPayment || canDispatch || canDeliver) && (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h2 className="font-semibold">Actions</h2>

              {canConfirmPayment && (
                <div
                  className={cn(
                    "mt-3 flex items-start gap-2.5 rounded-xl border p-3 text-sm",
                    customerClaimedPayment
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-warning/30 bg-warning/10 text-warning",
                  )}
                >
                  <Receipt className="mt-0.5 size-4 shrink-0" />
                  <p>
                    {customerClaimedPayment ? (
                      <>
                        <span className="font-semibold">Customer marked this paid</span>{" "}
                        {request.paymentClaimedAt
                          ? `on ${formatDateTime(request.paymentClaimedAt)}`
                          : ""}{" "}
                        — verify and confirm to release it to the warehouse.
                      </>
                    ) : (
                      <>
                        <span className="font-semibold">Awaiting the customer&apos;s payment.</span>{" "}
                        You can still confirm here once you&apos;ve received it.
                      </>
                    )}
                  </p>
                </div>
              )}

              <div className="mt-3 space-y-2">
                {canConfirmPayment && (
                  <>
                    <ActionButton
                      className="w-full"
                      variant="success"
                      action={() => confirmOrderPayment(request.id, "Cash collected")}
                      onDone={(res) => res.ok && router.refresh()}
                      pendingText="Confirming…"
                    >
                      <Check className="size-4" />
                      Confirm payment
                    </ActionButton>
                    <ActionButton
                      className="w-full text-destructive hover:bg-destructive/10"
                      variant="outline"
                      confirm={`Reject payment for ${request.code}? It returns to review.`}
                      action={() => rejectOrderPayment(request.id)}
                      onDone={(res) => res.ok && router.refresh()}
                      pendingText="Rejecting…"
                    >
                      <X className="size-4" />
                      Reject payment
                    </ActionButton>
                  </>
                )}
                {canApprove && (
                  <ActionButton
                    className="w-full"
                    variant="success"
                    action={() => approveRequest(request.id)}
                    onDone={(res) => res.ok && router.refresh()}
                    pendingText="Approving…"
                  >
                    <Check className="size-4" />
                    Approve credit &amp; release
                  </ActionButton>
                )}
                {canDispatch && (
                  <ActionButton
                    className="w-full"
                    action={() => dispatchOrder(request.id)}
                    onDone={(res) => res.ok && router.refresh()}
                    pendingText="Dispatching…"
                  >
                    <PackageCheck className="size-4" />
                    Dispatch order
                  </ActionButton>
                )}
                {canDeliver && (
                  <ActionButton
                    className="w-full"
                    action={() => fulfillRequest(request.id)}
                    onDone={(res) => res.ok && router.refresh()}
                    confirm="Confirm the partner has received this delivery? Stock will be deducted now."
                    pendingText="Confirming…"
                  >
                    <PackageCheck className="size-4" />
                    Confirm delivery
                  </ActionButton>
                )}
                {canReject && (
                  <Button
                    variant="outline"
                    onClick={reject}
                    disabled={pending}
                    className="w-full text-destructive hover:bg-destructive/10"
                  >
                    <X className="size-4" />
                    Reject order
                  </Button>
                )}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {canConfirmPayment
                  ? "Confirming payment releases this order to the warehouse for dispatch — no stock moves until delivery."
                  : canApprove
                    ? "Approving the credit releases this order to the warehouse — no stock moves yet."
                    : canDispatch
                      ? "The assigned warehouse normally accepts & dispatches; you can dispatch here too. No stock moves until delivery."
                      : canDeliver
                        ? "Confirming delivery deducts stock and records payment (cash = paid, credit = outstanding)."
                        : ""}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Line2({ icon: Icon, value }: { icon: typeof Mail; value: string }) {
  return (
    <p className="flex items-center gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{value}</span>
    </p>
  );
}

function KV({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-medium", accent)}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
