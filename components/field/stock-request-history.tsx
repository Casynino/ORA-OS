"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn, formatNumber, formatDateTime } from "@/lib/utils";

export type StockReqItem = { name: string; quantity: number };
export type StockReq = {
  id: string;
  code: string;
  status: string;
  createdAt: string; // ISO
  items: StockReqItem[];
};
export type StockIssue = {
  id: string;
  code: string;
  kind: string;
  quantity: number;
  name: string;
  createdAt: string; // ISO
};

/** The rep's full stock-request history — every request (expandable, like an
 *  order you can open) and every issue collected, each stamped with date & time. */
export function StockRequestHistory({
  requests,
  issues,
}: {
  requests: StockReq[];
  issues: StockIssue[];
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section>
        <h3 className="mb-3 font-display text-base font-semibold">My requests</h3>
        <div className="space-y-2">
          {requests.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
              No stock requests yet.
            </p>
          ) : (
            requests.map((r) => {
              const isOpen = open === r.id;
              const pieces = r.items.reduce((s, i) => s + i.quantity, 0);
              return (
                <div key={r.id} className="rounded-xl border border-border bg-card">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : r.id)}
                    className="flex w-full items-center justify-between gap-2 p-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block font-display text-sm font-semibold">{r.code}</span>
                      <span className="block text-xs text-muted-foreground">
                        {r.items.length} product{r.items.length === 1 ? "" : "s"} · {formatNumber(pieces)} pcs · {formatDateTime(new Date(r.createdAt))}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={r.status} />
                      <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                    </span>
                  </button>
                  {isOpen && (
                    <ul className="space-y-0.5 border-t border-border/60 px-3 py-2">
                      {r.items.map((it, idx) => (
                        <li key={idx} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate">{it.name}</span>
                          <span className="shrink-0 font-medium tabular-nums">{formatNumber(it.quantity)} pcs</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-display text-base font-semibold">Received from warehouse</h3>
        <div className="space-y-2">
          {issues.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
              Issued stock will appear here.
            </p>
          ) : (
            issues.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {formatNumber(i.quantity)} × {i.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{i.code} · {formatDateTime(new Date(i.createdAt))}</p>
                </div>
                <StatusBadge status={i.kind} />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
