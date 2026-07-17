import Link from "next/link";
import { ArrowLeft, Phone, MapPin, BadgeCheck, ShoppingCart } from "lucide-react";
import type { CustomerProfile } from "@/lib/services/customer-profile";
import type { ReceivingAccount } from "@/components/ui/receiving-account-picker";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { CustomerProfileCard } from "@/components/field/customer-profile-card";
import { CustomerFinancialSummary } from "@/components/customers/customer-financial-summary";
import { CustomerInventorySummary } from "@/components/customers/customer-inventory-summary";
import { CustomerTimeline } from "@/components/customers/customer-timeline";
import { CreditLimitControl } from "@/components/customers/credit-limit-control";
import { CustomerEditControls } from "@/components/customers/customer-edit-controls";
import { CustomerNoteForm } from "@/components/customers/customer-note-form";
import { FieldCollectionButton } from "@/components/finance/field-collection-button";
import { cn, formatCurrency, formatDate, timeAgo } from "@/lib/utils";

/**
 * The single, complete customer record — one profile every department works
 * from. Rep / Admin / Finance all render this; the role only changes which
 * controls appear (credit limit + suspend are Admin/Finance only; "Record
 * sale" is the rep's).
 */
export function CustomerProfileView({
  profile,
  role,
  backHref,
  backLabel,
  accounts,
  repHref,
}: {
  profile: CustomerProfile;
  role: "SALES_REP" | "ADMIN" | "FINANCE";
  backHref: string;
  backLabel: string;
  accounts: ReceivingAccount[];
  repHref?: string;
}) {
  const canManageCredit = role === "ADMIN" || role === "FINANCE";

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {backLabel}
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {profile.businessName}
            </h1>
            <Badge variant={profile.active ? "success" : "secondary"}>
              {profile.active ? "Active" : "Inactive"}
            </Badge>
            {profile.customerType && <Badge variant="secondary">{profile.customerType}</Badge>}
            {profile.creditSuspended && <Badge variant="destructive">credit suspended</Badge>}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {profile.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5" /> {profile.phone}
              </span>
            )}
            {(profile.location || profile.region) && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {[profile.location, profile.region].filter(Boolean).join(", ")}
              </span>
            )}
            <span>customer since {formatDate(profile.createdAt)}</span>
          </div>
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">Assigned sales rep: </span>
            {repHref ? (
              <Link href={repHref} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                <BadgeCheck className="size-3.5" /> {profile.rep.name}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium">
                <BadgeCheck className="size-3.5 text-primary" /> {profile.rep.name}
              </span>
            )}
          </p>
        </div>
        {role === "SALES_REP" && (
          <Link href="/rep/sell" className={cn(buttonVariants({ size: "sm" }), "rounded-full")}>
            <ShoppingCart className="mr-1.5 size-4" /> Record sale
          </Link>
        )}
      </div>

      <CustomerFinancialSummary f={profile.finance} />

      <div className="grid gap-4 lg:grid-cols-2">
        <CustomerProfileCard c={profile} />
        <CustomerInventorySummary inv={profile.inventory} />
      </div>

      {canManageCredit && (
        <div className="grid gap-4 lg:grid-cols-2">
          <CreditLimitControl
            customerId={profile.id}
            currentLimit={profile.creditLimit}
            outstanding={profile.finance.outstanding}
            suspended={profile.creditSuspended}
          />
          <CustomerEditControls
            customer={{
              id: profile.id,
              businessName: profile.businessName,
              email: profile.email,
              phone: profile.phone,
              location: profile.location,
              region: profile.region,
              district: profile.district,
              customerType: profile.customerType,
              expectedVolume: profile.expectedVolume,
              preferredPayment: profile.preferredPayment,
              businessLicense: profile.businessLicense,
              taxId: profile.taxId,
            }}
            listHref={backHref}
            hasSales={profile.sales.length > 0}
          />
        </div>
      )}

      <CustomerNoteForm customerId={profile.id} />

      {/* Orders / credit / payment history */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Order &amp; credit history</h2>
        {profile.sales.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No orders yet.
          </p>
        ) : (
          <div className="space-y-2">
            {profile.sales.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-semibold">{s.code}</span>
                    <StatusBadge status={s.type} />
                    {s.creditStatus && <StatusBadge status={s.creditStatus} />}
                    {s.financeStatus === "PENDING" && (
                      <Badge variant="warning">awaiting finance</Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(s.total)}</p>
                    {s.type === "CREDIT" && (
                      <p className="text-xs text-muted-foreground">
                        paid {formatCurrency(s.amountPaid)}
                        {s.balance > 0 ? ` · owes ${formatCurrency(s.balance)}` : " · settled"}
                      </p>
                    )}
                  </div>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {s.items.map((i) => `${i.name} ×${i.quantity}`).join(" · ")} · {timeAgo(s.createdAt)}
                  {s.dueDate ? ` · due ${formatDate(s.dueDate)}` : ""}
                </p>
                {s.type === "CREDIT" && s.balance > 0 && (
                  <div className="mt-3 flex justify-end border-t border-border/60 pt-3">
                    <FieldCollectionButton
                      saleId={s.id}
                      saleCode={s.code}
                      owing={s.balance}
                      accounts={accounts}
                      claim={role === "SALES_REP"}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Activity timeline */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Activity timeline</h2>
        <CustomerTimeline entries={profile.timeline} />
      </section>
    </div>
  );
}
