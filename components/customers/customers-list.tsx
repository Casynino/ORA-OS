"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import type { CustomerRow } from "@/lib/services/customer-profile";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Filter = "all" | "balance" | "overdue" | "suspended" | "inactive";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "balance", label: "With balance" },
  { key: "overdue", label: "Overdue" },
  { key: "suspended", label: "Credit suspended" },
  { key: "inactive", label: "Inactive" },
];

/** Searchable / filterable customer book — the rep's (or any role's) customer
 * database. Each row opens the full customer profile at `basePath`/[id]. */
export function CustomersList({
  rows,
  basePath,
}: {
  rows: CustomerRow[];
  basePath: string;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (query) {
        const hay = [r.businessName, r.phone, r.region].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (filter === "balance" && r.outstanding <= 0) return false;
      if (filter === "overdue" && !r.overdue) return false;
      if (filter === "suspended" && !r.creditSuspended) return false;
      if (filter === "inactive" && r.active) return false;
      return true;
    });
  }, [rows, q, filter]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by business name, phone or region…"
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={Users}
          title={rows.length === 0 ? "No customers yet" : "No matches"}
          description={
            rows.length === 0
              ? "Add customers here, or they'll be created automatically when you record a sale."
              : "Try a different search or filter."
          }
          className="rounded-2xl border border-dashed border-border py-12"
        />
      ) : (
        <div className="space-y-2">
          {shown.map((r) => (
            <Link
              key={r.id}
              href={`${basePath}/${r.id}`}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{r.businessName}</p>
                  <Badge variant={r.active ? "success" : "secondary"} className="text-[10px]">
                    {r.active ? "Active" : "Inactive"}
                  </Badge>
                  {r.overdue && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
                  {r.creditSuspended && <Badge variant="secondary" className="text-[10px]">Credit off</Badge>}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[r.phone, r.region].filter(Boolean).join(" · ") || "—"}
                  {r.lastPurchase && ` · last order ${formatDate(r.lastPurchase)}`}
                  {r.lastPayment && ` · last paid ${formatDate(r.lastPayment)}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-5 text-sm">
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Outstanding</p>
                  <p className={cn("font-semibold", r.outstanding > 0 ? "text-warning" : "")}>
                    {formatCurrency(r.outstanding)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Available credit</p>
                  <p className="font-semibold">
                    {r.availableCredit == null ? "—" : formatCurrency(r.availableCredit)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
