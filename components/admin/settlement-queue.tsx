"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { confirmSettlement, rejectSettlement } from "@/lib/actions/settlements";
import { ActionButton } from "@/components/dashboard/action-button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export type SettlementRow = {
  id: string;
  code: string;
  partner: string;
  batchCode: string;
  amount: number;
  method: string | null;
  reference: string | null;
  whenISO: string;
};

export function SettlementQueue({ rows }: { rows: SettlementRow[] }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div
          key={r.id}
          className="glass-card flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{r.partner}</span>
              <Badge variant="accent">Credit repayment</Badge>
              <Badge variant="warning" className="gap-1">
                <Clock className="size-3" /> Awaiting confirmation
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Against {r.batchCode} · {r.method ?? "—"}
              {r.reference ? ` · ref ${r.reference}` : ""} · {formatDateTime(r.whenISO)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden font-display text-lg font-bold sm:block">
              {formatCurrency(r.amount)}
            </span>
            <ActionButton
              size="sm"
              variant="success"
              confirm={`Confirm ${r.partner}'s payment of ${formatCurrency(r.amount)} against ${r.batchCode}? It posts to their credit ledger.`}
              action={() => confirmSettlement(r.id)}
              onDone={refresh}
              pendingText="…"
            >
              <CheckCircle2 className="size-4" /> Confirm
            </ActionButton>
            <ActionButton
              size="sm"
              variant="outline"
              confirm={`Reject this ${formatCurrency(r.amount)} payment from ${r.partner}?`}
              action={() => rejectSettlement(r.id)}
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
