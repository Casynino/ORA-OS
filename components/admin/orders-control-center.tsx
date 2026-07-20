"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search, X, Clock, CheckCircle2, CircleDashed, ArrowRight, Truck, Package,
  ClipboardList, AlertCircle, ChevronRight,
} from "lucide-react";
import type { OrderRow, OrderStage } from "@/lib/services/orders-overview";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FulfillRequestButton, RejectStockRequestButton } from "@/components/admin/rep-controls";
import { cn, formatCurrency, formatNumber, formatDate, formatDateTime } from "@/lib/utils";

const STAGES: { key: "all" | OrderStage; label: string }[] = [
  { key: "all", label: "All orders" },
  { key: "pending", label: "Pending" },
  { key: "ready", label: "Ready for dispatch" },
  { key: "inprogress", label: "In progress" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];
const KINDS: { key: "all" | "PARTNER" | "REP_STOCK"; label: string }[] = [
  { key: "all", label: "All types" },
  { key: "PARTNER", label: "Partner orders" },
  { key: "REP_STOCK", label: "Rep requests" },
];

function isToday(iso: string | null) {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

export function OrdersControlCenter({ orders }: { orders: OrderRow[] }) {
  const [stage, setStage] = useState<"all" | OrderStage>("all");
  const [kind, setKind] = useState<"all" | "PARTNER" | "REP_STOCK">("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const stats = useMemo(() => ({
    pending: orders.filter((o) => o.stage === "pending").length,
    today: orders.filter((o) => isToday(o.dateISO)).length,
    completedToday: orders.filter((o) => o.stage === "completed" && isToday(o.completedAtISO)).length,
    inProgress: orders.filter((o) => o.stage === "ready" || o.stage === "inprogress").length,
    cancelled: orders.filter((o) => o.stage === "cancelled").length,
  }), [orders]);

  const stageCounts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const o of orders) c[o.stage] = (c[o.stage] ?? 0) + 1;
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (stage !== "all" && o.stage !== stage) return false;
      if (kind !== "all" && o.kind !== kind) return false;
      if (needle) {
        const hay = `${o.code} ${o.who} ${o.requestedBy} ${o.role} ${o.warehouse ?? ""} ${o.items.map((i) => i.name).join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [orders, stage, kind, q]);

  const active = orders.find((o) => o.id === openId) ?? null;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat icon={AlertCircle} tone="warning" label="Pending approval" value={stats.pending} />
        <Stat icon={ClipboardList} tone="primary" label="Orders today" value={stats.today} />
        <Stat icon={Truck} tone="info" label="In progress" value={stats.inProgress} />
        <Stat icon={CheckCircle2} tone="success" label="Completed today" value={stats.completedToday} />
        <Stat icon={X} tone="destructive" label="Cancelled" value={stats.cancelled} />
      </div>

      {/* Toolbar */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-3 sm:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order, customer, rep, partner, warehouse or product…" className="pl-9" />
        </div>
        <div className="flex flex-col gap-2.5">
          <Pills options={STAGES} value={stage} counts={stageCounts} onChange={setStage} />
          <Pills options={KINDS} value={kind} onChange={setKind} />
        </div>
      </div>

      {/* Count line */}
      <p className="px-1 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{formatNumber(filtered.length)}</span> {filtered.length === 1 ? "order" : "orders"}
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No orders match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[54rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Order</th>
                <th className="px-3 py-2.5 font-medium">Customer</th>
                <th className="px-3 py-2.5 font-medium">Requested by</th>
                <th className="px-3 py-2.5 font-medium">Warehouse</th>
                <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => setOpenId(o.id)}
                  className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/30"
                >
                  <td className="px-3 py-2.5 align-middle">
                    <p className="whitespace-nowrap font-display font-semibold">{o.code}</p>
                    <p className="whitespace-nowrap text-[11px] text-muted-foreground">{o.kindLabel}</p>
                  </td>
                  <td className="px-3 py-2.5 align-middle"><p className="max-w-[12rem] truncate">{o.who}</p></td>
                  <td className="px-3 py-2.5 align-middle">
                    <p className="max-w-[10rem] truncate">{o.requestedBy}</p>
                    <p className="text-[11px] text-muted-foreground">{o.role}</p>
                  </td>
                  <td className="px-3 py-2.5 align-middle text-muted-foreground">{o.warehouse ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right align-middle tabular-nums">
                    <p className="whitespace-nowrap">{formatNumber(o.totalQty)}</p>
                    <p className="text-[11px] text-muted-foreground">{o.productCount} line{o.productCount === 1 ? "" : "s"}</p>
                  </td>
                  <td className="px-3 py-2.5 align-middle whitespace-nowrap text-muted-foreground">{formatDate(new Date(o.dateISO))}</td>
                  <td className="px-3 py-2.5 align-middle"><Badge variant={o.statusTone}>{o.status}</Badge></td>
                  <td className="px-3 py-2.5 align-middle text-muted-foreground"><ChevronRight className="size-4" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {active && <OrderDrawer order={active} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Pills<T extends string>({
  options,
  value,
  counts,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  counts?: Record<string, number>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            value === o.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
          {counts && <span className="ml-1 opacity-60">{counts[o.key] ?? 0}</span>}
        </button>
      ))}
    </div>
  );
}

const STAT_TONE: Record<string, string> = {
  warning: "bg-warning/15 text-warning",
  primary: "bg-primary/10 text-primary",
  info: "bg-info/12 text-info",
  success: "bg-success/12 text-success",
  destructive: "bg-destructive/12 text-destructive",
};
function Stat({ icon: Icon, tone, label, value }: { icon: React.ComponentType<{ className?: string }>; tone: string; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", STAT_TONE[tone])}><Icon className="size-3.5" /></span>
      </div>
      <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">{formatNumber(value)}</p>
    </div>
  );
}

function OrderDrawer({ order, onClose }: { order: OrderRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-bold">{order.code}</h2>
              <Badge variant={order.statusTone}>{order.status}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{order.kindLabel} · {formatDateTime(new Date(order.dateISO))}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {/* Key facts */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Fact label="Customer" value={order.who} />
            <Fact label="Requested by" value={`${order.requestedBy} · ${order.role}`} />
            <Fact label="Warehouse" value={order.warehouse ?? "—"} />
            <Fact label="Quantity" value={`${formatNumber(order.totalQty)} pcs · ${order.productCount} line${order.productCount === 1 ? "" : "s"}`} />
            {order.total != null && <Fact label="Total" value={formatCurrency(order.total)} />}
            {order.paymentLabel && <Fact label="Payment" value={order.paymentLabel} />}
          </dl>

          {/* Products */}
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Package className="size-3.5" /> Products
            </p>
            <div className="space-y-1">
              {order.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No line items.</p>
              ) : order.items.map((i, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate">{i.name}</span>
                  <span className="shrink-0 font-medium tabular-nums">{formatNumber(i.quantity)} pcs</span>
                </div>
              ))}
            </div>
          </section>

          {/* Timeline */}
          <section>
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock className="size-3.5" /> Timeline
            </p>
            <ol className="space-y-0">
              {order.timeline.map((step, idx) => {
                const last = idx === order.timeline.length - 1;
                return (
                  <li key={idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      {step.done ? (
                        <CheckCircle2 className="size-5 text-success" />
                      ) : (
                        <CircleDashed className="size-5 text-muted-foreground/50" />
                      )}
                      {!last && <span className={cn("my-0.5 w-px flex-1", step.done ? "bg-success/40" : "bg-border")} style={{ minHeight: 18 }} />}
                    </div>
                    <div className={cn("pb-4", last && "pb-0")}>
                      <p className={cn("text-sm font-medium", !step.done && "text-muted-foreground")}>{step.label}</p>
                      {step.at && <p className="text-xs text-muted-foreground">{formatDateTime(new Date(step.at))}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {order.note && (
            <section>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Note</p>
              <p className="rounded-lg bg-muted/40 p-3 text-sm">{order.note}</p>
            </section>
          )}
        </div>

        {/* Actions footer */}
        {order.stage !== "completed" && order.stage !== "cancelled" && (
          <div className="flex items-center justify-end gap-2 border-t border-border p-4">
            {order.kind === "REP_STOCK" && order.fulfilItems ? (
              <>
                <FulfillRequestButton requestId={order.id} repName={order.requestedBy} items={order.fulfilItems} />
                <RejectStockRequestButton id={order.id} />
              </>
            ) : order.kind === "REP_STOCK" ? (
              <RejectStockRequestButton id={order.id} />
            ) : order.detailHref ? (
              <Link
                href={order.detailHref}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Manage order <ArrowRight className="size-4" />
              </Link>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
