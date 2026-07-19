import { Undo2, PackageCheck } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FinanceReturnButton } from "@/components/finance/finance-return-form";
import { formatCurrency, formatDate, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Finance can take goods back to recover an outstanding credit debt. The
 *  warehouse receives the goods; the balance drops automatically on receipt. */
export default async function FinanceReturnsPage() {
  await requireRole("FINANCE");

  const [debtors, financeReturns] = await Promise.all([
    prisma.fieldSale.findMany({
      where: {
        type: "CREDIT",
        financeStatus: "APPROVED",
        voided: false,
        // Opening balances carry no goods — they're collected as cash, never
        // recovered via a return — so they don't belong in the debt-return list.
        isOpeningBalance: false,
      },
      orderBy: { createdAt: "asc" },
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    }),
    prisma.returnRequest.findMany({
      where: { financeInitiated: true },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        product: { select: { name: true } },
        fieldSale: { select: { code: true } },
        requester: { select: { name: true } },
      },
    }),
  ]);

  const owing = debtors
    .map((s) => ({ ...s, outstanding: s.total - s.amountPaid }))
    .filter((s) => s.outstanding > 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Returns"
        description="Recover an outstanding debt by taking goods back. The warehouse confirms receipt and the customer's balance drops automatically."
      />

      {/* Outstanding credit sales — candidates for a debt-recovery return */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Undo2 className="size-5 text-warning" /> Outstanding credit — recover via return
        </h2>
        {owing.length === 0 ? (
          <EmptyState icon={PackageCheck} title="No outstanding credit" description="Every approved credit sale is fully paid." />
        ) : (
          <div className="space-y-2">
            {owing.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {s.customer?.name ?? s.customerName ?? "Customer"}
                      <span className="text-xs font-normal text-muted-foreground">{s.code}</span>
                      {s.creditStatus && <StatusBadge status={s.creditStatus} />}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.items.map((i) => `${i.quantity} × ${i.product.name}`).join(" · ")}
                    </p>
                    <p className="mt-1.5 text-sm">
                      <span className="text-muted-foreground">Owes </span>
                      <span className="font-display text-lg font-bold text-warning">
                        {formatCurrency(s.outstanding)}
                      </span>
                      <span className="text-xs text-muted-foreground"> of {formatCurrency(s.total)}</span>
                    </p>
                  </div>
                  <FinanceReturnButton
                    saleId={s.id}
                    saleCode={s.code}
                    outstanding={s.outstanding}
                    items={s.items.map((i) => ({
                      productId: i.productId,
                      name: i.product.name,
                      quantity: i.quantity,
                      unitPrice: i.unitPrice,
                    }))}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Finance-initiated returns in flight */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <PackageCheck className="size-5 text-primary" /> Return requests
        </h2>
        {financeReturns.length === 0 ? (
          <EmptyState icon={Undo2} title="No returns yet" description="Debt-recovery returns you start appear here until the warehouse receives them." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <ul className="divide-y divide-border/60">
              {financeReturns.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.code}</span>
                      <StatusBadge status={r.status} />
                      {r.status === "COMPLETED" && r.creditValue ? (
                        <Badge variant="success" className="text-[10px]">
                          {formatCurrency(r.creditValue)} recovered
                        </Badge>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {r.quantity} × {r.product.name}
                      {r.fieldSale ? ` · against ${r.fieldSale.code}` : ""}
                      {r.creditValue ? ` · ${formatCurrency(r.creditValue)}` : ""} · rep {r.requester.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {r.receivedAt ? `received ${formatDate(r.receivedAt)}` : timeAgo(r.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
