"use client";

import { useRouter } from "next/navigation";
import { ClipboardList, PackageCheck, Truck, ChevronRight } from "lucide-react";
import { fulfillRequest, dispatchOrder } from "@/lib/actions/requests";
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
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

export type WhOrderDTO = {
  id: string;
  code: string;
  partner: string;
  products: string;
  totalQty: number;
  total: number | null;
  payment: string;
  status: string;
  date: string;
};

export function WarehouseOrders({ orders }: { orders: WhOrderDTO[] }) {
  const router = useRouter();

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No orders assigned"
        description="Approved orders routed to your warehouse will appear here to prepare and dispatch."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Partner</TableHead>
            <TableHead>Products</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow
              key={o.id}
              onClick={() => router.push(`/warehouse/orders/${o.id}`)}
              className="cursor-pointer transition-colors hover:bg-muted/40"
            >
              <TableCell className="font-medium">{o.code}</TableCell>
              <TableCell>{o.partner}</TableCell>
              <TableCell className="max-w-[220px] truncate text-sm" title={o.products}>
                {o.products}
              </TableCell>
              <TableCell className="text-right">{formatNumber(o.totalQty)}</TableCell>
              <TableCell>
                <Badge variant={o.payment === "CREDIT" ? "accent" : "secondary"}>
                  {o.payment}
                </Badge>
              </TableCell>
              <TableCell>
                <StatusBadge status={o.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {formatDate(o.date)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  {o.status === "IN_TRANSIT" ? (
                    <ActionButton
                      size="sm"
                      variant="success"
                      action={() => fulfillRequest(o.id)}
                      onDone={() => router.refresh()}
                      pendingText="…"
                    >
                      <PackageCheck className="size-3.5" />
                      Confirm delivery
                    </ActionButton>
                  ) : o.status === "APPROVED" ? (
                    <ActionButton
                      size="sm"
                      action={() => dispatchOrder(o.id)}
                      onDone={() => router.refresh()}
                      pendingText="…"
                    >
                      <Truck className="size-3.5" />
                      Accept &amp; dispatch
                    </ActionButton>
                  ) : (
                    <span className="text-xs text-muted-foreground">Delivered</span>
                  )}
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
