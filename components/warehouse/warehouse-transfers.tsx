"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Truck, PackageCheck, ArrowLeftRight, ChevronRight } from "lucide-react";
import { dispatchTransfer, receiveTransfer } from "@/lib/actions/transfers";
import { ActionButton } from "@/components/dashboard/action-button";
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
import { formatDateTime, formatNumber } from "@/lib/utils";

export type WhTransferDTO = {
  id: string;
  code: string;
  from: string;
  to: string;
  direction: "IN" | "OUT";
  status: string;
  items: { name: string; quantity: number }[];
  createdAt: string;
};

export function WarehouseTransfers({ transfers }: { transfers: WhTransferDTO[] }) {
  const router = useRouter();

  if (transfers.length === 0) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title="No transfers"
        description="Transfers involving your warehouse will appear here."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Transfer</TableHead>
            <TableHead>Direction</TableHead>
            <TableHead>Route</TableHead>
            <TableHead className="text-right">Items</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transfers.map((t) => {
            const units = t.items.reduce((s, i) => s + i.quantity, 0);
            return (
              <TableRow
                key={t.id}
                onClick={() => router.push(`/warehouse/transfers/${t.id}`)}
                className="cursor-pointer transition-colors hover:bg-muted/40"
              >
                <TableCell className="font-medium">{t.code}</TableCell>
                <TableCell>
                  <Badge variant={t.direction === "IN" ? "success" : "accent"}>
                    {t.direction === "IN" ? "Incoming" : "Outgoing"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    {t.from}
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                    {t.to}
                  </span>
                </TableCell>
                <TableCell className="text-right text-sm">
                  {t.items.length} · {formatNumber(units)}u
                </TableCell>
                <TableCell>
                  <StatusBadge status={t.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDateTime(t.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  {t.direction === "OUT" && t.status === "APPROVED" ? (
                    <ActionButton
                      size="sm"
                      action={() => dispatchTransfer(t.id)}
                      onDone={() => router.refresh()}
                      pendingText="…"
                    >
                      <Truck className="size-3.5" />
                      Dispatch
                    </ActionButton>
                  ) : t.direction === "IN" && t.status === "IN_TRANSIT" ? (
                    <ActionButton
                      size="sm"
                      variant="success"
                      action={() => receiveTransfer(t.id)}
                      onDone={() => router.refresh()}
                      pendingText="…"
                    >
                      <PackageCheck className="size-3.5" />
                      Confirm receipt
                    </ActionButton>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t.status === "COMPLETED" ? "Done" : t.status === "PENDING" ? "Open to act" : "—"}
                    </span>
                  )}
                  <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
