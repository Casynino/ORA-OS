/** Full business profile captured for a field customer — shown identically on
 * the rep, admin and finance customer-detail pages so the data reads the same
 * everywhere. Renders nothing when no profile fields are filled in. */
export type CustomerProfile = {
  email?: string | null;
  phone?: string | null;
  customerType?: string | null;
  region?: string | null;
  district?: string | null;
  location?: string | null;
  expectedVolume?: string | null;
  preferredPayment?: string | null;
  businessLicense?: string | null;
  taxId?: string | null;
};

export function CustomerProfileCard({ c }: { c: CustomerProfile }) {
  const rows: [string, string | null | undefined][] = [
    ["Email", c.email],
    ["Phone", c.phone],
    ["Business type", c.customerType],
    ["Preferred payment", c.preferredPayment],
    ["Region", c.region],
    ["District", c.district],
    ["Street / physical address", c.location],
    ["Expected monthly volume", c.expectedVolume],
    ["Business licence", c.businessLicense],
    ["Tax ID / TIN", c.taxId],
  ];
  const shown = rows.filter(([, v]) => v && String(v).trim());
  if (shown.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Business details
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="break-words text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
