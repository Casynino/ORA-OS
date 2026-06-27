import { Badge } from "./badge";
import { humanize } from "@/lib/utils";

type Variant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "accent";

// Maps every status enum value across the platform to a consistent colour.
const MAP: Record<string, Variant> = {
  // Requests / returns
  PENDING: "warning",
  PRICED: "info",
  APPROVED: "success",
  IN_TRANSIT: "accent",
  COMPLETED: "success",
  REJECTED: "destructive",
  FULFILLED: "default",
  CANCELLED: "secondary",
  // Payment status
  PAID: "success",
  UNPAID: "secondary",
  CONFIRMED: "success",
  // User / warehouse status
  ACTIVE: "success",
  SUSPENDED: "destructive",
  OFFLINE: "secondary",
  MAINTENANCE: "warning",
  // Credit
  OUTSTANDING: "warning",
  PARTIAL: "info",
  SETTLED: "success",
  OVERDUE: "destructive",
  // Donations
  RECEIVED: "info",
  ALLOCATED: "accent",
  DISTRIBUTED: "success",
  // Payment type
  IMMEDIATE: "secondary",
  CREDIT: "accent",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge variant={MAP[status] ?? "secondary"} className={className}>
      {humanize(status)}
    </Badge>
  );
}
