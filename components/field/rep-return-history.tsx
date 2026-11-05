"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelRepReturn } from "@/lib/actions/returns";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "@/components/ui/use-toast";
import { formatNumber, timeAgo } from "@/lib/utils";

export type RepReturnRow = {
  id: string;
  code: string;
  productName: string;
  quantity: number;
  status: string;
  warehouseName: string | null;
  reason: string | null;
  adminNote: string | null;
  createdAt: string;
};

const STEP: Record<string, string> = {
  PENDING: "Waiting for the warehouse to accept",
  IN_TRANSIT: "Accepted — bring the goods to the warehouse",
  COMPLETED: "Received — out of your stock",
};

export function RepReturnHistory({ rows }: { rows: RepReturnRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function cancel(id: string) {
    start(async () => {
      const res = await cancelRepReturn(id);
      toast(res.ok ? { variant: "success", title: res.message } : { variant: "error", title: res.error });
      router.refresh();
    });
  }

  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
      {rows.map((r) => {
        const cancelled = r.status === "REJECTED" && r.adminNote === "Cancelled by the rep";
        return (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.code}</span>
                <StatusBadge status={cancelled ? "CANCELLED" : r.status} />
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatNumber(r.quantity)} × {r.productName}
                {r.warehouseName ? ` → ${r.warehouseName}` : ""} · {timeAgo(r.createdAt)}
              </p>
              <p className="mt-0.5 text-xs">
                {r.status === "REJECTED"
                  ? cancelled
                    ? "You cancelled this return."
                    : `Declined${r.adminNote ? `: ${r.adminNote}` : "."} The stock stays with you.`
                  : (STEP[r.status] ?? "")}
              </p>
            </div>
            {r.status === "PENDING" && (
              <Button size="sm" variant="outline" onClick={() => cancel(r.id)} disabled={pending}>
                Cancel
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
