"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn, formatNumber, formatDateTime } from "@/lib/utils";

export type StockReqItem = { name: string; requested: number; received: number };
export type StockReq = {
  id: string;
  code: string;
  status: string; // PENDING | READY | ISSUED | REJECTED
  createdAt: string; // ISO
  items: StockReqItem[];
};
export type DirectIssue = {
  id: string;
  code: string;
  kind: string;
  quantity: number;
  name: string;
  createdAt: string; // ISO
};

/**
 * The rep's single stock-request history: one card per request, showing what was
 * requested and — once collected — exactly what was RECEIVED per product. This
 * merges the old "requests" + "received from warehouse" lists into one clear
 * story (asked → received) so there's no doubled-up view. Any stock issued
 * WITHOUT a request (rare) still shows in its own small section so nothing is
 * hidden.
 */
export function StockRequestHistory({
  requests,
  directIssues = [],
}: {
  requests: StockReq[];
  directIssues?: DirectIssue[];
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (requests.length === 0 && directIssues.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No stock requests yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {requests.map((r) => {
          const isOpen = open === r.id;
          const requested = r.items.reduce((s, i) => s + i.requested, 0);
          const received = r.items.reduce((s, i) => s + i.received, 0);
          const collected = r.status === "ISSUED";
          const summary = collected
            ? `${formatNumber(received)} pcs collected`
            : `${formatNumber(requested)} pcs requested`;
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
                    {r.items.length} product{r.items.length === 1 ? "" : "s"} · {summary} · {formatDateTime(new Date(r.createdAt))}
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
                      <span className="shrink-0 tabular-nums">
                        {collected ? (
                          <>
                            <span className="font-medium text-success">received {formatNumber(it.received)}</span>
                            {it.received !== it.requested && (
                              <span className="text-muted-foreground"> of {formatNumber(it.requested)} asked</span>
                            )}
                          </>
                        ) : (
                          <span className="font-medium">requested {formatNumber(it.requested)}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {directIssues.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Received directly (no request)
          </h3>
          <div className="space-y-2">
            {directIssues.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{formatNumber(i.quantity)} × {i.name}</p>
                  <p className="text-xs text-muted-foreground">{i.code} · {formatDateTime(new Date(i.createdAt))}</p>
                </div>
                <StatusBadge status={i.kind} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
