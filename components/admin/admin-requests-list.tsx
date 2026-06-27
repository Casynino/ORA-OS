"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronRight, Inbox } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatCurrency, formatDateTime, humanize } from "@/lib/utils";

type Item = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number | null;
};

export type RequestDTO = {
  id: string;
  code: string;
  type: string;
  status: string;
  paymentType: string;
  requesterName: string;
  requesterOrg: string | null;
  requesterRole: string;
  requesterStatus: string;
  requesterLocation: string | null;
  creditLimit: number;
  outstanding: number;
  note: string | null;
  adminNote: string | null;
  deliverTo: string | null;
  deliverBy: string | null;
  warehouseName: string | null;
  reviewedByName: string | null;
  totalAmount: number | null;
  createdAt: string;
  items: Item[];
};

const TABS = ["ALL", "PENDING", "PRICED", "APPROVED", "IN_TRANSIT", "FULFILLED", "REJECTED"];

export function AdminRequestsList({ requests }: { requests: RequestDTO[] }) {
  const router = useRouter();
  const [tab, setTab] = useState("ALL");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: requests.length };
    for (const t of TABS.slice(1))
      c[t] = requests.filter((r) => r.status === t).length;
    return c;
  }, [requests]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return requests.filter((r) => {
      if (tab !== "ALL" && r.status !== tab) return false;
      if (!term) return true;
      return (
        r.code.toLowerCase().includes(term) ||
        r.requesterName.toLowerCase().includes(term) ||
        (r.requesterOrg ?? "").toLowerCase().includes(term)
      );
    });
  }, [requests, tab, q]);

  return (
    <div>
      {/* Tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {humanize(t)}
              <span
                className={cn(
                  "ml-1.5 text-xs",
                  tab === t ? "text-primary" : "text-muted-foreground/70",
                )}
              >
                {counts[t] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code or partner…"
            className="pl-9"
          />
        </div>
      </div>

      {/* Dense list */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
        {filtered.length === 0 ? (
          <EmptyState
            className="m-6"
            icon={Inbox}
            title="Nothing here"
            description="No requests match this view."
          />
        ) : (
          <div className="overflow-x-auto table-stack">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Request</th>
                  <th className="px-4 py-3 font-medium">Partner</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const units = r.items.reduce((s, i) => s + i.quantity, 0);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/admin/requests/${r.id}`)}
                      className="cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td data-cardtitle className="px-4 py-3 font-semibold">{r.code}</td>
                      <td data-label="Partner" className="px-4 py-3">
                        <div className="font-medium">{r.requesterName}</div>
                        {r.requesterOrg && (
                          <div className="text-xs text-muted-foreground">
                            {r.requesterOrg}
                          </div>
                        )}
                      </td>
                      <td data-label="Items" className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {units} units · {r.items.length} line
                        {r.items.length === 1 ? "" : "s"}
                      </td>
                      <td data-label="Payment" className="px-4 py-3">
                        <Badge
                          variant={
                            r.paymentType === "CREDIT" ? "accent" : "secondary"
                          }
                        >
                          {humanize(r.paymentType)}
                        </Badge>
                      </td>
                      <td data-label="Total" className="whitespace-nowrap px-4 py-3 text-right font-medium">
                        {r.totalAmount != null
                          ? formatCurrency(r.totalAmount)
                          : "—"}
                      </td>
                      <td data-label="Status" className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td data-label="Date" className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(r.createdAt)}
                      </td>
                      <td data-label="" className="px-2 py-3 text-muted-foreground">
                        <ChevronRight className="size-4" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
