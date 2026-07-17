import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatCurrency, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepSalesHistoryPage() {
  const me = await requireRole("SALES_REP");

  const sales = await prisma.fieldSale.findMany({
    where: { repId: me.id },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: {
      customer: { select: { name: true, businessName: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Sales history" description="Every sale you've recorded.">
        <Link href="/rep/sell" className={cn(buttonVariants({ size: "sm" }), "rounded-full")}>
          <ShoppingCart className="size-4" /> Record sale
        </Link>
      </PageHeader>

      {sales.length === 0 ? (
        <EmptyState
          className="rounded-2xl border border-dashed border-border py-12"
          icon={ShoppingCart}
          title="No sales yet"
          description="Record your first sale to see it here."
        />
      ) : (
        <div className="space-y-2">
          {sales.map((s) => (
            <div
              key={s.id}
              className={cn(
                "rounded-2xl border border-border bg-card p-4",
                (s.voided || s.financeStatus === "REJECTED") && "opacity-60",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{s.code}</span>
                  <StatusBadge status={s.type} />
                  {s.creditStatus && s.financeStatus !== "REJECTED" && <StatusBadge status={s.creditStatus} />}
                  {s.voided && <Badge variant="destructive">Voided</Badge>}
                  {!s.voided && s.financeStatus === "PENDING" && <Badge variant="warning">Awaiting finance</Badge>}
                  {!s.voided && s.financeStatus === "REJECTED" && <Badge variant="destructive">Rejected by finance</Badge>}
                </div>
                <span className="text-sm font-semibold">{formatCurrency(s.total)}</span>
              </div>
              {s.financeStatus === "REJECTED" && s.financeNote && (
                <p className="mt-1 text-xs text-destructive">Finance: &ldquo;{s.financeNote}&rdquo;</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {s.customer?.businessName ?? s.customer?.name ?? s.customerName ?? "Walk-in"}
                {" · "}
                {s.items.map((i) => `${i.product.name} ×${i.quantity}`).join(" · ")}
                {" · "}
                {timeAgo(s.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
