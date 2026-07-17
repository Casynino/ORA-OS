import type { CustomerProfile } from "@/lib/services/customer-profile";
import { formatCurrency, formatDate } from "@/lib/utils";

/** The one-glance money picture for a customer — shared by rep, admin and
 * finance profiles. */
export function CustomerFinancialSummary({ f }: { f: CustomerProfile["finance"] }) {
  const scoreTone =
    f.creditScore == null
      ? "text-muted-foreground"
      : f.creditScore >= 70
        ? "text-success"
        : f.creditScore >= 40
          ? "text-warning"
          : "text-destructive";

  const rows: { label: string; value: string; tone?: string }[] = [
    { label: "Total purchases", value: formatCurrency(f.totalPurchases) },
    { label: "Cash sales", value: formatCurrency(f.totalCash) },
    { label: "Credit sales", value: formatCurrency(f.totalCredit) },
    { label: "Payments received", value: formatCurrency(f.totalPayments), tone: "text-success" },
    {
      label: "Outstanding balance",
      value: formatCurrency(f.outstanding),
      tone: f.outstanding > 0 ? "text-warning" : undefined,
    },
    {
      label: "Overdue",
      value: formatCurrency(f.overdue),
      tone: f.overdue > 0 ? "text-destructive" : undefined,
    },
    {
      label: "Credit limit",
      value: f.creditLimit == null ? "No limit set" : formatCurrency(f.creditLimit),
    },
    {
      label: "Available credit",
      value: f.availableCredit == null ? "—" : formatCurrency(f.availableCredit),
      tone: f.availableCredit === 0 ? "text-destructive" : undefined,
    },
    {
      label: "Credit score",
      value: f.creditScore == null ? "New customer" : `${f.creditScore}/100`,
      tone: scoreTone,
    },
    {
      label: "Last purchase",
      value: f.lastPurchaseDate ? formatDate(f.lastPurchaseDate) : "—",
    },
    {
      label: "Last payment",
      value: f.lastPaymentDate ? formatDate(f.lastPaymentDate) : "—",
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Financial summary
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((r) => (
          <div key={r.label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd className={`truncate font-display text-lg font-semibold ${r.tone ?? ""}`}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
