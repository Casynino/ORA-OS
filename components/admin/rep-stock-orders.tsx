"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RejectStockRequestButton } from "@/components/admin/rep-controls";
import { cn, formatNumber, formatDateTime } from "@/lib/utils";

const STATUS: Record<string, { label: string; tone: "warning" | "info" | "success" | "destructive" | "secondary" }> = {
  PENDING: { label: "Awaiting review", tone: "warning" },
  READY: { label: "Prepared · awaiting pickup", tone: "info" },
  ISSUED: { label: "Collected", tone: "success" },
  REJECTED: { label: "Rejected", tone: "destructive" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "PENDING", label: "To review" },
  { key: "READY", label: "Prepared" },
  { key: "ISSUED", label: "Collected" },
  { key: "REJECTED", label: "Rejected" },
] as const;

export type RepStockOrder = {
  id: string;
  code: string;
  repName: string;
  status: string;
  createdAt: string; // ISO
  warehouseName: string | null;
  items: { name: string; quantity: number }[];
};

/** Admin view of sales-rep stock requests — filterable + searchable + bounded
 *  (scrolls internally so the page never grows without limit). Actionable
 *  requests surface first; each opens to show exactly what was requested. */
export function RepStockOrders({ orders }: { orders: RepStockOrder[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [open, setOpen] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (needle) {
        const hay = `${o.code} ${o.repName} ${o.items.map((i) => i.name).join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    // Actionable (pending) first, then newest.
    return rows.sort((a, b) => {
      const ap = a.status === "PENDING" ? 0 : 1;
      const bp = b.status === "PENDING" ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [orders, q, filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const n = counts[f.key] ?? 0;
            if (f.key !== "all" && n === 0) return null;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filter === f.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label} <span className="opacity-60">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, rep, product…" className="pl-9" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {orders.length === 0 ? "No stock requests from sales reps." : "No requests match these filters."}
        </p>
      ) : (
        <div className="max-h-[30rem] space-y-2 overflow-y-auto rounded-2xl border border-border p-2">
          {filtered.map((r) => {
            const isOpen = open === r.id;
            const pieces = r.items.reduce((s, i) => s + i.quantity, 0);
            const st = STATUS[r.status] ?? { label: r.status, tone: "secondary" as const };
            return (
              <div key={r.id} className="rounded-xl border border-border/70 bg-card">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : r.id)}
                  className="flex w-full items-center justify-between gap-3 p-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span className="font-display font-semibold">{r.code}</span>
                      <span className="text-sm text-muted-foreground">· {r.repName}</span>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {r.items.length} product{r.items.length === 1 ? "" : "s"} · {formatNumber(pieces)} pcs · {formatDateTime(new Date(r.createdAt))}
                      {r.warehouseName ? ` · ${r.warehouseName}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant={st.tone}>{st.label}</Badge>
                    <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-border/60 bg-muted/20 px-3 py-2.5">
                    <ul className="space-y-1">
                      {r.items.map((it, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate">{it.name}</span>
                          <span className="shrink-0 font-medium tabular-nums">{formatNumber(it.quantity)} pcs</span>
                        </li>
                      ))}
                    </ul>
                    {r.status === "PENDING" && (
                      <div className="mt-2.5 flex justify-end">
                        <RejectStockRequestButton id={r.id} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
