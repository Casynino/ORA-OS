import type { CustomerProfile } from "@/lib/services/customer-profile";
import { formatNumber } from "@/lib/utils";

/** What the customer holds and has moved: products still on credit, lifetime
 * units bought, and total returns. */
export function CustomerInventorySummary({ inv }: { inv: CustomerProfile["inventory"] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Inventory
      </p>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Total units purchased</p>
          <p className="font-display text-lg font-semibold">{formatNumber(inv.totalUnitsPurchased)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total returns</p>
          <p className="font-display text-lg font-semibold">{formatNumber(inv.totalReturns)}</p>
        </div>
      </div>
      <div className="mt-3 border-t border-border/60 pt-3">
        <p className="text-xs text-muted-foreground">Products currently on credit</p>
        {inv.onCredit.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">None — nothing owed.</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {inv.onCredit.map((p) => (
              <li key={p.name} className="flex items-center justify-between text-sm">
                <span className="truncate">{p.name}</span>
                <span className="font-medium">{formatNumber(p.quantity)} units</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
