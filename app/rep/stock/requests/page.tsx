import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepStockRequestsPage() {
  const me = await requireRole("SALES_REP");

  const [requests, issues] = await Promise.all([
    prisma.repStockRequest.findMany({
      where: { repId: me.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { items: { include: { product: { select: { name: true } } } } },
    }),
    prisma.repStockIssue.findMany({
      where: { repId: me.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { product: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock request history"
        description="Every request you've made and every issue you've collected."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">My requests</h2>
          <div className="space-y-2">
            {requests.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                No stock requests yet.
              </p>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {r.code} · {r.items.length} product{r.items.length === 1 ? "" : "s"} · {timeAgo(r.createdAt)}
                    </p>
                    <StatusBadge status={r.status} />
                  </div>
                  <ul className="mt-1.5 space-y-0.5">
                    {r.items.map((it) => (
                      <li key={it.id} className="flex items-center justify-between text-sm">
                        <span className="min-w-0 truncate">{it.product.name}</span>
                        <span className="shrink-0 font-medium">{formatNumber(it.quantity)} pcs</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Received from warehouse</h2>
          <div className="space-y-2">
            {issues.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                Issued stock will appear here.
              </p>
            ) : (
              issues.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {formatNumber(i.quantity)} × {i.product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{i.code} · {timeAgo(i.createdAt)}</p>
                  </div>
                  <StatusBadge status={i.kind} />
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
