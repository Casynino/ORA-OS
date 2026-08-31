import Link from "next/link";
import { ArrowLeft, Phone, MapPin, BadgeCheck, ShoppingCart, Wallet } from "lucide-react";
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
import { AssignRepControl } from "@/components/customers/customer-ownership-controls";
import { CustomerNoteForm } from "@/components/customers/customer-note-form";
import { FieldCollectionButton } from "@/components/finance/field-collection-button";
import { RequestExtensionButton } from "@/components/finance/request-extension-button";
import { CustomerExtensionHistory } from "@/components/customers/customer-extension-history";
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
  reps = [],
}: {
  profile: CustomerProfile;
  role: "SALES_REP" | "ADMIN" | "FINANCE";
  backHref: string;
  backLabel: string;
  accounts: ReceivingAccount[];
  repHref?: string;
  reps?: { id: string; name: string }[];
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
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>
              <span className="text-muted-foreground">Managed by: </span>
              {profile.rep == null ? (
                <span className="font-medium text-muted-foreground">Unassigned</span>
              ) : repHref ? (
                <Link href={repHref} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                  <BadgeCheck className="size-3.5" /> {profile.rep.name}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium">
                  <BadgeCheck className="size-3.5 text-primary" /> {profile.rep.name}
                </span>
              )}
            </span>
            {profile.registeredBy && (
              <span className="text-muted-foreground">
                Registered by <span className="font-medium text-foreground">{profile.registeredBy}</span>
              </span>
            )}
          </p>
        </div>
        {/* Record a sale for this customer. Reps sell from their carried stock;
            Admin/Finance record a head-office sale drawn from the warehouse,
            pre-scoped to this customer. */}
        <Link
          href={
            role === "SALES_REP"
              ? "/rep/sell"
              : role === "FINANCE"
                ? `/finance/sell?customer=${profile.id}`
                : `/admin/sell?customer=${profile.id}`
          }
          className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
        >
          <ShoppingCart className="mr-1.5 size-4" /> Record sale
        </Link>
      </div>

      {/* Quick actions — pay off or extend an OPEN credit order right at the top,
          as easy as Record sale (these used to be buried in the order history). */}
      {(() => {
        const openCredit = profile.sales.filter((s) => s.type === "CREDIT" && s.balance > 0);
        if (openCredit.length === 0) return null;
        return (
          <section className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-4 shadow-soft">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Wallet className="size-4 text-primary" /> Outstanding credit · quick actions
            </h2>
            <div className="space-y-2">
              {openCredit.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                    <span>{s.code}</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      owes {formatCurrency(s.balance)}
                      {s.dueDate ? ` · due ${formatDate(s.dueDate)}` : ""}
                    </span>
                    {s.creditStatus && <StatusBadge status={s.creditStatus} />}
                    {s.financeStatus === "PENDING" && <Badge variant="warning">awaiting finance</Badge>}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <RequestExtensionButton
                      saleId={s.id}
                      saleCode={s.code}
                      owing={s.balance}
                      currentDueDate={s.dueDate ? s.dueDate.toISOString().slice(0, 10) : null}
                      hasPendingExtension={s.hasPendingExtension}
                      isAdmin={role === "ADMIN"}
                      extendedBefore={s.extendedBefore}
                    />
                    <FieldCollectionButton
                      saleId={s.id}
                      saleCode={s.code}
                      owing={s.balance}
                      accounts={accounts}
                      claim={role === "SALES_REP"}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      <CustomerFinancialSummary f={profile.finance} />

      <div className="grid gap-4 lg:grid-cols-2">
        <CustomerProfileCard c={profile} />
        <CustomerInventorySummary inv={profile.inventory} />
      </div>

      {/* Reps, Finance and Admin can all edit + delete a customer they can see
          (a rep only their own — enforced server-side, mainly to clear
          duplicates). Credit-limit and rep-assignment stay Admin/Finance only.
          Deletes are blocked once a customer has sales and are recorded in the
          activity log for the boss. */}
      <div className="grid gap-4 lg:grid-cols-2">
        {canManageCredit && (
          <CreditLimitControl
            customerId={profile.id}
            currentLimit={profile.creditLimit}
            outstanding={profile.finance.outstanding}
            suspended={profile.creditSuspended}
          />
        )}
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
          hasSales={profile.hasAnySales}
          canDelete={role === "SALES_REP" || role === "FINANCE" || role === "ADMIN"}
        />
        {canManageCredit && (
          <AssignRepControl
            customerId={profile.id}
            currentRepId={profile.rep?.id ?? null}
            reps={reps}
          />
        )}
      </div>

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
                    {s.isOpeningBalance ? (
                      <Badge variant="secondary">opening balance</Badge>
                    ) : (
                      <StatusBadge status={s.type} />
                    )}
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
                  <p className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                    Pay or extend this order from <span className="font-medium text-foreground">Outstanding credit · quick actions</span> at the top.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Credit extension history */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Credit extension history</h2>
        <CustomerExtensionHistory extensions={profile.extensions} />
      </section>

      {/* Activity timeline */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Activity timeline</h2>
        <CustomerTimeline entries={profile.timeline} />
      </section>
    </div>
  );
}
