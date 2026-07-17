import { CalendarClock, ArrowRight } from "lucide-react";
import type { ExtensionEntry } from "@/lib/services/customer-profile";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "warning" | "success" | "destructive"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Awaiting admin",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/**
 * The customer's full credit-extension record — every request finance raised,
 * with the original vs. requested dates, reason, finance recommendation and the
 * admin's decision. Kept permanently so a customer's payment-delay history is
 * always visible.
 */
export function CustomerExtensionHistory({ extensions }: { extensions: ExtensionEntry[] }) {
  if (extensions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No credit extensions requested for this customer.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {extensions.map((x) => {
        const variant = STATUS_VARIANT[x.status] ?? "secondary";
        return (
          <div key={x.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 font-display font-semibold">
                  <CalendarClock className="size-4 text-muted-foreground" /> {x.saleCode}
                </span>
                <Badge variant={variant as "warning" | "success" | "destructive"}>
                  {STATUS_LABEL[x.status] ?? x.status}
                </Badge>
              </div>
              <span className="font-display text-sm font-semibold">
                {formatCurrency(x.outstanding)} outstanding
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {x.originalDueDate ? `Due ${formatDate(x.originalDueDate)}` : "No original due date"}
              </span>
              <ArrowRight className="size-3.5 text-muted-foreground" />
              <span className="font-medium">Requested {formatDate(x.requestedDueDate)}</span>
            </div>

            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Reason:</dt>
                <dd>{x.reason}</dd>
              </div>
              {x.financeNotes && (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">Finance note:</dt>
                  <dd>{x.financeNotes}</dd>
                </div>
              )}
              {x.adminNote && (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">Admin note:</dt>
                  <dd>{x.adminNote}</dd>
                </div>
              )}
            </dl>

            <p className="mt-2 text-xs text-muted-foreground">
              Requested by {x.requestedByName} · {formatDateTime(x.createdAt)}
              {x.reviewedByName && x.reviewedAt
                ? ` · ${x.status === "APPROVED" ? "approved" : "rejected"} by ${x.reviewedByName} · ${formatDateTime(x.reviewedAt)}`
                : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
