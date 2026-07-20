"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RejectStockRequestButton } from "@/components/admin/rep-controls";
import { cn, formatNumber, formatDateTime } from "@/lib/utils";

const STATUS: Record<string, { label: string; tone: "warning" | "info" | "success" | "destructive" | "secondary" }> = {
  PENDING: { label: "Awaiting review", tone: "warning" },
  READY: { label: "Prepared · awaiting pickup", tone: "info" },
  ISSUED: { label: "Collected", tone: "success" },
  REJECTED: { label: "Rejected", tone: "destructive" },
};

export type RepStockOrder = {
  id: string;
  code: string;
  repName: string;
  status: string;
  createdAt: string; // ISO
  warehouseName: string | null;
  items: { name: string; quantity: number }[];
};

/** Admin view of sales-rep stock requests — each opens like an order to show
 *  exactly what was requested, stamped with date & time. */
export function RepStockOrders({ orders }: { orders: RepStockOrder[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (orders.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No stock requests from sales reps.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="divide-y divide-border/60">
        {orders.map((r) => {
          const isOpen = open === r.id;
          const pieces = r.items.reduce((s, i) => s + i.quantity, 0);
          const st = STATUS[r.status] ?? { label: r.status, tone: "secondary" as const };
          return (
            <div key={r.id}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.id)}
                className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-muted/30"
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
    </div>
  );
}
