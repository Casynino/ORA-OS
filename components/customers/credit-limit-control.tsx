"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { setFieldCustomerCreditLimit, setFieldCustomerCredit } from "@/lib/actions/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";

/** ADMIN/FINANCE credit controls for a field customer: set/clear the credit
 * limit and suspend/restore credit. Never rendered on the rep's own view. */
export function CreditLimitControl({
  customerId,
  currentLimit,
  outstanding,
  suspended,
}: {
  customerId: string;
  currentLimit: number | null;
  outstanding: number;
  suspended: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentLimit != null ? String(currentLimit) : "");
  const [pending, start] = useTransition();
  const [busy, startToggle] = useTransition();

  function save(limit: number | null) {
    start(async () => {
      const res = await setFieldCustomerCreditLimit(customerId, limit);
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  function toggleSuspend() {
    startToggle(async () => {
      const res = await setFieldCustomerCredit(customerId, !suspended);
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  const available = currentLimit != null ? Math.max(0, currentLimit - outstanding) : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Credit control
        </p>
        {suspended && <Badge variant="destructive" className="ml-auto text-[10px]">credit suspended</Badge>}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {currentLimit == null ? (
          "No credit limit set — this customer can take credit without a cap."
        ) : (
          <>
            Limit <span className="font-medium text-foreground">{formatCurrency(currentLimit)}</span>
            {" · "}available{" "}
            <span className={`font-medium ${available === 0 ? "text-destructive" : "text-foreground"}`}>
              {formatCurrency(available ?? 0)}
            </span>
          </>
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[9rem] flex-1">
          <label className="text-xs text-muted-foreground">Credit limit (TSh)</label>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="e.g. 500000"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 h-9"
          />
        </div>
        <Button
          size="sm"
          className="rounded-full"
          disabled={pending || value.trim() === ""}
          onClick={() => save(Number(value))}
        >
          {pending ? "Saving…" : "Set limit"}
        </Button>
        {currentLimit != null && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            disabled={pending}
            onClick={() => {
              setValue("");
              save(null);
            }}
          >
            Remove
          </Button>
        )}
      </div>

      <div className="mt-3 border-t border-border/60 pt-3">
        <Button
          size="sm"
          variant={suspended ? "outline" : "ghost"}
          className="rounded-full"
          disabled={busy}
          onClick={toggleSuspend}
        >
          {busy ? "…" : suspended ? "Restore credit access" : "Suspend credit access"}
        </Button>
      </div>
    </div>
  );
}
