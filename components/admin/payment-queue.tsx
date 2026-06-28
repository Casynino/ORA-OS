"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { confirmOrderPayment, rejectOrderPayment } from "@/lib/actions/requests";
import { ActionButton } from "@/components/dashboard/action-button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export type PaymentRow = {
  id: string;
  code: string;
  customer: string;
  org: string | null;
  amount: number;
  warehouse: string | null;
  whenISO: string;
  claimedISO: string | null;
};

export function PaymentQueue({ orders }: { orders: PaymentRow[] }) {
  const router = useRouter();
  const refresh = () => router.refresh();

  if (orders.length === 0) {
    return (
      <EmptyState
        className="glass-card rounded-2xl py-12"
        icon={CheckCircle2}
        title="No payments pending"
        description="Cash orders awaiting confirmation will appear here. Confirming one releases it to the warehouse."
      />
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <div
          key={o.id}
          className="glass-card flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{o.code}</span>
              <Badge variant="secondary">Cash</Badge>
              {o.claimedISO ? (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="size-3" /> Customer marked paid
                </Badge>
              ) : (
                <Badge variant="warning" className="gap-1">
                  <Clock className="size-3" /> Awaiting customer payment
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm">
              {o.customer}
              {o.org ? ` · ${o.org}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              Expected {formatCurrency(o.amount)} · {o.warehouse ?? "warehouse TBD"} ·{" "}
              {o.claimedISO
                ? `customer confirmed ${formatDateTime(o.claimedISO)}`
                : `approved ${formatDateTime(o.whenISO)}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden font-display text-lg font-bold sm:block">
              {formatCurrency(o.amount)}
            </span>
            <ActionButton
              size="sm"
              variant="success"
              confirm={`Confirm payment of ${formatCurrency(o.amount)} for ${o.code}? This releases the order to the warehouse.`}
              action={() => confirmOrderPayment(o.id, "Cash collected")}
              onDone={refresh}
              pendingText="…"
            >
              <CheckCircle2 className="size-4" /> Confirm
            </ActionButton>
            <ActionButton
              size="sm"
              variant="outline"
              confirm={`Reject payment for ${o.code}? It returns to review until payment is sorted.`}
              action={() => rejectOrderPayment(o.id)}
              onDone={refresh}
              pendingText="…"
            >
              <XCircle className="size-4" /> Reject
            </ActionButton>
          </div>
        </div>
      ))}
    </div>
  );
}
