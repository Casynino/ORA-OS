"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Filter } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";

export type HistoryRow = {
  id: string;
  code: string;
  dateISO: string; // yyyy-mm-dd
  dateLabel: string;
  products: string;
  totalQty: number;
  totalAmount: number | null;
  payment: "Cash" | "Credit";
  status: string;
  approvedBy: string;
  dispatch: string;
};

const STATUSES = ["PENDING", "PRICED", "APPROVED", "IN_TRANSIT", "FULFILLED", "REJECTED"];

export function RequestHistoryTable({ rows }: { rows: HistoryRow[] }) {
  const router = useRouter();
  const [status, setStatus] = useState("ALL");
  const [payment, setPayment] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (status !== "ALL" && r.status !== status) return false;
        if (payment !== "ALL" && r.payment !== payment) return false;
        if (from && r.dateISO < from) return false;
        if (to && r.dateISO > to) return false;
        return true;
      }),
    [rows, status, payment, from, to],
  );

  return (
    <Card>
      <CardContent className="p-0">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Filter className="size-4" />
            Filters
          </span>
          <div className="w-36">
            <Label className="text-xs">Status</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 h-9">
              <option value="ALL">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-32">
            <Label className="text-xs">Payment</Label>
            <Select value={payment} onChange={(e) => setPayment(e.target.value)} className="mt-1 h-9">
              <option value="ALL">All</option>
              <option value="Cash">Cash</option>
              <option value="Credit">Credit</option>
            </Select>
          </div>
          <div className="w-36">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-9" />
          </div>
          <div className="w-36">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-9" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            className="m-6"
            icon={ClipboardList}
            title="No requests match"
            description="Try adjusting your filters, or submit a new request."
          />
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="md:hidden">
              {filtered.map((r) => (
                <button
                  key={r.id}
                  onClick={() => router.push(`/partner/requests/${r.id}`)}
                  className="flex w-full flex-col gap-2 border-b border-border p-4 text-left transition-colors last:border-0 active:bg-muted/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{r.code}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="truncate text-sm" title={r.products}>
                    {r.products}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">
                      {r.dateLabel} · Qty {formatNumber(r.totalQty)}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge
                        variant={r.payment === "Credit" ? "accent" : "secondary"}
                      >
                        {r.payment}
                      </Badge>
                      <span className="font-semibold">
                        {r.totalAmount != null
                          ? formatCurrency(r.totalAmount)
                          : "—"}
                      </span>
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop: full table */}
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approved by</TableHead>
                  <TableHead>Dispatch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    onClick={() => router.push(`/partner/requests/${r.id}`)}
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                  >
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {r.dateLabel}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm" title={r.products}>
                      {r.products}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(r.totalQty)}</TableCell>
                    <TableCell className="text-right">
                      {r.totalAmount != null ? formatCurrency(r.totalAmount) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.payment === "Credit" ? "accent" : "secondary"}>
                        {r.payment}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.approvedBy}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.dispatch}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
