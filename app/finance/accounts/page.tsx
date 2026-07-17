import { Landmark, Smartphone, Banknote, Wallet } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

const TYPE_META = {
  CASH: { label: "Cash accounts", icon: Banknote, accent: "text-success" },
  BANK: { label: "Bank accounts", icon: Landmark, accent: "text-info" },
  MOBILE_MONEY: { label: "Mobile money accounts", icon: Smartphone, accent: "text-primary" },
} as const;

/**
 * Finance's reference list of ORA's receiving accounts — the destinations they
 * deposit collected money into. The CEO owns the accounts and sees the
 * balances; Finance only needs to know which account received a payment, so
 * NO balances / totals are shown here (Finance never sees account balances).
 */
export default async function FinanceAccountsPage() {
  await requireRole("FINANCE");

  const accounts = await prisma.paymentAccount.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  const groups = (Object.keys(TYPE_META) as (keyof typeof TYPE_META)[]).map((t) => ({
    type: t,
    ...TYPE_META[t],
    accounts: accounts.filter((a) => a.type === t),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company accounts"
        description="The accounts you deposit collected money into. The CEO owns them and sees the balances — you just record which account received each payment."
      />

      <div>
        <h2 className="font-display text-lg font-semibold">Receiving accounts</h2>
        <p className="text-sm text-muted-foreground">
          Deposit cash and confirm direct payments into these official ORA accounts. Adding or
          editing accounts — and viewing balances — is a CEO responsibility.
        </p>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No receiving accounts yet"
          description="The CEO adds ORA's cash office, bank accounts and Lipa numbers — they appear here and in every payment form."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          {groups.map(
            (g) =>
              g.accounts.length > 0 && (
                <section key={g.type} className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <g.icon className={`size-4 ${g.accent}`} />
                    {g.label}
                  </h3>
                  <div className="space-y-3">
                    {g.accounts.map((a) => (
                      <div
                        key={a.id}
                        className={`rounded-2xl border bg-card p-4 shadow-soft ${
                          a.isActive ? "border-border" : "border-border opacity-60"
                        }`}
                      >
                        <p className="flex items-center gap-2 font-display font-semibold">
                          <span className="truncate">{a.name}</span>
                          {!a.isActive && <Badge variant="secondary">inactive</Badge>}
                        </p>
                        {a.accountName && (
                          <p className="truncate text-xs text-muted-foreground">{a.accountName}</p>
                        )}
                        {a.accountNumber && (
                          <p className="mt-1 text-sm">
                            <span className="text-muted-foreground">
                              {a.type === "MOBILE_MONEY" ? "Lipa" : "A/C"}:{" "}
                            </span>
                            <span className="font-medium">{a.accountNumber}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ),
          )}
        </div>
      )}
    </div>
  );
}
