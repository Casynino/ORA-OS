"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2, Check, X, Truck, PackageCheck } from "lucide-react";
import {
  approveReturn,
  completeReturn,
  rejectReturn,
} from "@/lib/actions/returns";
import { ActionButton } from "@/components/dashboard/action-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

type ReturnDTO = {
  id: string;
  code: string;
  productName: string;
  requesterName: string;
  quantity: number;
  reasonType: string | null;
  reason: string | null;
  warehouseName: string | null;
  value: number;
  status: string;
  createdAt: string;
};

const TABS = [
  { key: "OPEN", label: "Needs action" },
  { key: "PENDING", label: "Pending" },
  { key: "IN_TRANSIT", label: "In transit" },
  { key: "COMPLETED", label: "Completed" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
] as const;

export function ReturnsManager({
  returns,
  detailBase,
}: {
  returns: ReturnDTO[];
  detailBase?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("OPEN");

  const counts = useMemo(() => {
    const open = returns.filter(
      (r) => r.status === "PENDING" || r.status === "IN_TRANSIT",
    );
    const completed = returns.filter((r) => r.status === "COMPLETED");
    return {
      open: open.length,
      pending: returns.filter((r) => r.status === "PENDING").length,
      inTransit: returns.filter((r) => r.status === "IN_TRANSIT").length,
      completed: completed.length,
      rejected: returns.filter((r) => r.status === "REJECTED").length,
      restockedValue: completed.reduce((s, r) => s + r.value, 0),
    };
  }, [returns]);

  const filtered = useMemo(() => {
    if (tab === "ALL") return returns;
    if (tab === "OPEN")
      return returns.filter(
        (r) => r.status === "PENDING" || r.status === "IN_TRANSIT",
      );
    return returns.filter((r) => r.status === tab);
  }, [returns, tab]);

  function reject(id: string) {
    const reason =
      window.prompt("Reason shared with the partner (optional)") ?? undefined;
    start(async () => {
      const res = await rejectReturn(id, reason);
      if (res.ok) toast({ variant: "success", title: res.message });
      else toast({ variant: "error", title: res.error });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Insights */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Awaiting action"
          value={formatNumber(counts.open)}
          hint={`${counts.pending} pending · ${counts.inTransit} in transit`}
          icon={Undo2}
          accent="warning"
        />
        <StatCard
          label="Completed"
          value={formatNumber(counts.completed)}
          icon={PackageCheck}
          accent="success"
        />
        <StatCard
          label="Rejected"
          value={formatNumber(counts.rejected)}
          icon={X}
          accent="primary"
        />
        <StatCard
          label="Value restocked"
          value={formatCurrency(counts.restockedValue)}
          icon={Truck}
          accent="info"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1.5 border-b border-border p-3">
            {TABS.map((t) => {
              const n =
                t.key === "ALL"
                  ? returns.length
                  : t.key === "OPEN"
                    ? counts.open
                    : returns.filter((r) => r.status === t.key).length;
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

          {filtered.length === 0 ? (
            <EmptyState
              className="m-6"
              icon={Undo2}
              title="Nothing here"
              description="Returns awaiting your action will show up in this list."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table wrapperClassName="table-stack">
                <TableHeader>
                  <TableRow>
                    <TableHead>Return</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      onClick={
                        detailBase
                          ? () => router.push(`${detailBase}/${r.id}`)
                          : undefined
                      }
                      className={detailBase ? "cursor-pointer transition-colors hover:bg-muted/40" : ""}
                    >
                      <TableCell data-cardtitle>
                        <div className="font-medium">{r.code}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.requesterName}
                        </div>
                      </TableCell>
                      <TableCell data-label="Product" className="text-sm">{r.productName}</TableCell>
                      <TableCell data-label="Qty" className="text-right font-medium">
                        {formatNumber(r.quantity)}
                      </TableCell>
                      <TableCell data-label="Value" className="text-right text-sm">
                        {formatCurrency(r.value)}
                      </TableCell>
                      <TableCell data-label="Reason" className="text-sm">
                        {r.reasonType ?? "—"}
                        {r.reason ? (
                          <span className="block text-xs text-muted-foreground">
                            {r.reason}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell data-label="Destination" className="text-sm text-muted-foreground">
                        {r.warehouseName ?? "—"}
                      </TableCell>
                      <TableCell data-label="Status">
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell data-label="Date" className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(r.createdAt)}
                      </TableCell>
                      <TableCell
                        data-label="Action"
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.status === "PENDING" ? (
                          <div className="flex justify-end gap-1.5">
                            <ActionButton
                              size="sm"
                              variant="success"
                              action={() => approveReturn(r.id)}
                              onDone={() => router.refresh()}
                              pendingText="…"
                            >
                              <Check className="size-3.5" />
                              Authorise
                            </ActionButton>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => reject(r.id)}
                              disabled={pending}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        ) : r.status === "IN_TRANSIT" ? (
                          <div className="flex justify-end gap-1.5">
                            <ActionButton
                              size="sm"
                              variant="success"
                              action={() => completeReturn(r.id)}
                              onDone={() => router.refresh()}
                              pendingText="…"
                            >
                              <PackageCheck className="size-3.5" />
                              Confirm receipt
                            </ActionButton>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => reject(r.id)}
                              disabled={pending}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {r.status === "COMPLETED" ? "Reconciled" : "Closed"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
