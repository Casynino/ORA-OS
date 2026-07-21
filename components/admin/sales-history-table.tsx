"use client";

import { Fragment, useMemo, useState } from "react";
import { Search, ChevronDown, Package, Paperclip } from "lucide-react";
import type { SalesHistoryRow } from "@/lib/services/sales-history";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ProofViewer } from "@/components/ui/proof-viewer";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";

type ChannelFilter = "all" | "FIELD" | "PARTNER";
type TypeFilter = "all" | "CASH" | "CREDIT";
type StatusFilter = "all" | "confirmed" | "pending" | "owing";

const CHANNELS: { key: ChannelFilter; label: string }[] = [
  { key: "all", label: "All channels" },
  { key: "FIELD", label: "Field & office" },
  { key: "PARTNER", label: "Partner & direct" },
];
const TYPES: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "CASH", label: "Cash" },
  { key: "CREDIT", label: "Credit" },
];
const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Any status" },
  { key: "confirmed", label: "Confirmed" },
  { key: "pending", label: "Awaiting confirmation" },
  { key: "owing", label: "Credit owing" },
];

export function SalesHistoryTable({ rows }: { rows: SalesHistoryRow[] }) {
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (channel !== "all" && r.channel !== channel) return false;
      if (type !== "all" && r.paymentType !== type) return false;
      if (status === "confirmed" && !r.confirmed) return false;
      if (status === "pending" && r.status !== "Awaiting confirmation") return false;
      if (status === "owing" && r.balance <= 0) return false;
      if (needle) {
        const hay = `${r.code} ${r.customer} ${r.createdBy} ${r.createdByRole} ${r.channelLabel} ${r.items.map((i) => i.name).join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, channel, type, status]);

  const totalValue = filtered.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search sale ID, customer, seller or product…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <FilterGroup value={channel} onChange={setChannel} options={CHANNELS} />
          <FilterGroup value={type} onChange={setType} options={TYPES} />
          <FilterGroup value={status} onChange={setStatus} options={STATUSES} />
        </div>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{formatNumber(filtered.length)}</span>{" "}
          {filtered.length === 1 ? "sale" : "sales"}
        </span>
        <span>
          Total <span className="font-semibold text-foreground">{formatCurrency(totalValue)}</span>
        </span>
      </div>

      {/* Table (scrolls horizontally on small screens) */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No sales match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Sale</th>
                <th className="px-3 py-2.5 font-medium">Customer</th>
                <th className="px-3 py-2.5 font-medium">Sold by</th>
                <th className="px-3 py-2.5 text-right font-medium">Units</th>
                <th className="px-3 py-2.5 font-medium">Payment</th>
                <th className="px-3 py-2.5 text-right font-medium">Total</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isOpen = open === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr
                      className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/30"
                      onClick={() => setOpen(isOpen ? null : r.id)}
                    >
                      <td className="px-3 py-2.5 align-top">
                        <p className="font-display font-semibold">{r.code}</p>
                        <p className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(new Date(r.dateISO))}</p>
                        <Badge variant="secondary" className="mt-1 text-[10px]">{r.channelLabel}</Badge>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <p className="max-w-[12rem] truncate font-medium">{r.customer}</p>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <p className="max-w-[10rem] truncate">{r.createdBy}</p>
                        <p className="text-xs text-muted-foreground">{r.createdByRole}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right align-top tabular-nums">
                        <p className="whitespace-nowrap">{formatNumber(r.totalCartons)} ctn</p>
                        <p className="whitespace-nowrap text-xs text-muted-foreground">{formatNumber(r.totalPieces)} pcs</p>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <Badge variant={r.paymentType === "CASH" ? "success" : "accent"} className="text-[10px]">
                          {r.paymentType === "CASH" ? "Cash" : "Credit"}
                        </Badge>
                        {r.paymentMethod && (
                          <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">{r.paymentMethod}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right align-top">
                        <p className="whitespace-nowrap font-semibold tabular-nums">{formatCurrency(r.total)}</p>
                        {r.paymentType === "CREDIT" && r.balance > 0 && (
                          <p className="whitespace-nowrap text-xs text-warning">owes {formatCurrency(r.balance)}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <Badge variant={r.statusTone}>{r.status}</Badge>
                        {r.confirmedBy && (
                          <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">by {r.confirmedBy}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top text-muted-foreground">
                        <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-border/60 bg-muted/20">
                        <td colSpan={8} className="px-3 py-3">
                          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <Package className="size-3.5" /> Items
                          </div>
                          <div className="mt-2 space-y-1">
                            {r.items.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No line items (opening balance / migrated).</p>
                            ) : r.items.map((i, idx) => (
                              <div key={idx} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-sm">
                                <span className="font-medium">{i.name}</span>
                                <span className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-muted-foreground">
                                  <span className="tabular-nums">{formatNumber(i.quantity)} pcs ({formatNumber(i.cartons)} ctn{i.pieces ? ` + ${i.pieces}` : ""})</span>
                                  <span className="tabular-nums">@ {formatCurrency(i.unitPrice)}</span>
                                  <span className="font-medium text-foreground tabular-nums">{formatCurrency(i.quantity * i.unitPrice)}</span>
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Payment proof — so the admin can verify the money went in. */}
                          {(r.paymentProofUrl || r.paymentProofRef) && (
                            <div className="mt-3 border-t border-border/60 pt-3">
                              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                <Paperclip className="size-3.5" /> Payment proof
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
                                {r.paymentProofUrl ? (
                                  <ProofViewer url={r.paymentProofUrl} label="View payment proof" />
                                ) : (
                                  <span className="text-muted-foreground">No image attached</span>
                                )}
                                {r.paymentProofRef && (
                                  <span className="text-muted-foreground">
                                    Reference:{" "}
                                    <span className="font-medium text-foreground">{r.paymentProofRef}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
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
            value === o.key
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
