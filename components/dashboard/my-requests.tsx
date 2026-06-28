"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Pencil, Search, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { customerOrderStatus, type CustomerTone } from "@/lib/order-status";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatCurrency, formatDateTime, formatNumber, humanize } from "@/lib/utils";

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

type Item = {
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number | null;
};
export type MyRequestDTO = {
  id: string;
  code: string;
  status: string;
  paymentType: string;
  paymentStatus: string;
  paymentClaimedAt: string | null;
  note: string | null;
  adminNote: string | null;
  totalAmount: number | null;
  createdAt: string;
  items: Item[];
};

const TABS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "PRICED", label: "Priced" },
  { key: "APPROVED", label: "Approved" },
  { key: "IN_TRANSIT", label: "In transit" },
  { key: "FULFILLED", label: "Fulfilled" },
  { key: "REJECTED", label: "Rejected" },
] as const;

export function MyRequests({ requests }: { requests: MyRequestDTO[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<string>("ALL");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((r) => {
      if (tab !== "ALL" && r.status !== tab) return false;
      if (!q) return true;
      return (
        r.code.toLowerCase().includes(q) ||
        r.items.some((i) => i.name.toLowerCase().includes(q))
      );
    });
  }, [requests, tab, query]);

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No orders yet"
        description="Submit a stock request and track its approval here."
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Filter bar */}
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => {
              const n =
                t.key === "ALL"
                  ? requests.length
                  : requests.filter((r) => r.status === t.key).length;
              if (t.key !== "ALL" && n === 0) return null;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    tab === t.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t.label}
                  <span className="ml-1.5 opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order or product…"
              className="h-9 pl-9"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            className="m-6"
            icon={ClipboardList}
            title="No orders match"
            description="Try a different status or search term."
          />
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="md:hidden">
              {filtered.map((r) => {
                const editable = ["PENDING", "PRICED"].includes(r.status);
                const totalQty = r.items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <button
                    key={r.id}
                    onClick={() => router.push(`/partner/requests/${r.id}`)}
                    className="flex w-full flex-col gap-2 border-b border-border p-4 text-left transition-colors last:border-0 active:bg-muted/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-semibold">
                        {r.code}
                        {editable && (
                          <Pencil className="size-3.5 text-warning" />
                        )}
                      </span>
                      {(() => { const cs = customerOrderStatus(r); return <Badge variant={TONE_VARIANT[cs.tone]}>{cs.label}</Badge>; })()}
                    </div>
                    <p className="truncate text-sm">
                      {r.items[0]?.name}
                      {r.items.length > 1 && (
                        <span className="text-muted-foreground">
                          {" "}
                          +{r.items.length - 1} more
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                      <span className="text-muted-foreground">
                        {formatDateTime(r.createdAt)} · Qty{" "}
                        {formatNumber(totalQty)}
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge
                          variant={
                            r.paymentType === "CREDIT" ? "accent" : "secondary"
                          }
                        >
                          {humanize(r.paymentType)}
                        </Badge>
                        <span className="font-semibold">
                          {r.totalAmount != null
                            ? formatCurrency(r.totalAmount)
                            : "—"}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Desktop: full table */}
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const editable = ["PENDING", "PRICED"].includes(r.status);
                  const totalQty = r.items.reduce((s, i) => s + i.quantity, 0);
                  const summary = r.items
                    .map((i) => `${i.name} ×${i.quantity}`)
                    .join(", ");
                  return (
                    <TableRow
                      key={r.id}
                      onClick={() => router.push(`/partner/requests/${r.id}`)}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          {r.code}
                          {editable && (
                            <Pencil className="size-3.5 text-warning" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDateTime(r.createdAt)}
                      </TableCell>
                      <TableCell
                        className="max-w-[260px] truncate text-sm"
                        title={summary}
                      >
                        {r.items[0]?.name}
                        {r.items.length > 1 && (
                          <span className="text-muted-foreground">
                            {" "}
                            +{r.items.length - 1} more
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(totalQty)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.paymentType === "CREDIT" ? "accent" : "secondary"
                          }
                        >
                          {humanize(r.paymentType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {r.totalAmount != null
                          ? formatCurrency(r.totalAmount)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {(() => { const cs = customerOrderStatus(r); return <Badge variant={TONE_VARIANT[cs.tone]}>{cs.label}</Badge>; })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
