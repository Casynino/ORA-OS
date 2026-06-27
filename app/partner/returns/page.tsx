import Link from "next/link";
import { notFound } from "next/navigation";
import { Undo2, Clock, Truck, CheckCircle2, XCircle, Plus } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { productMeta } from "@/lib/product-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  PartnerReturnsHistory,
  type PartnerReturnRow,
} from "@/components/dashboard/partner-returns-history";
import { formatCurrency, formatNumber } from "@/lib/utils";

export default async function PartnerReturnsPage() {
  const session = await requireRole("PARTNER");
  const me = await prisma.user.findUnique({ where: { id: session.id } });
  if (!me) notFound();

  const [partnerPrices, returns] = await Promise.all([
    prisma.partnerPrice.findMany({ where: { partnerId: me.id } }),
    prisma.returnRequest.findMany({
      where: { requesterId: me.id },
      orderBy: { createdAt: "desc" },
      include: { product: { select: { name: true, sku: true } } },
    }),
  ]);

  const priceById = new Map(partnerPrices.map((p) => [p.productId, p.price]));

  // Insights
  const open = returns.filter(
    (r) => r.status === "PENDING" || r.status === "IN_TRANSIT",
  ).length;
  const completed = returns.filter((r) => r.status === "COMPLETED");
  const rejected = returns.filter((r) => r.status === "REJECTED").length;
  const returnedUnits = completed.reduce((s, r) => s + r.quantity, 0);
  const returnedValue = completed.reduce((s, r) => {
    const price = priceById.get(r.productId) ?? 0;
    return s + r.quantity * price;
  }, 0);

  const rows: PartnerReturnRow[] = returns.map((r) => ({
    id: r.id,
    code: r.code,
    dateISO: r.createdAt.toISOString(),
    productName: r.product.name,
    image: productMeta(r.product.sku).image,
    quantity: r.quantity,
    reasonType: r.reasonType,
    reason: r.reason,
    status: r.status,
    warehouseName: r.warehouseName,
    adminNote: r.adminNote,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Returns"
        description="Send eligible stock back to ORA. You can only return what you currently hold, and the ORA team reviews every request."
      >
        <Button asChild>
          <Link href="/partner/returns/new">
            <Plus className="size-4" />
            Request a return
          </Link>
        </Button>
      </PageHeader>

      {/* Insights */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total returns"
          value={formatNumber(returns.length)}
          icon={Undo2}
          accent="primary"
        />
        <StatCard
          label="Open"
          value={formatNumber(open)}
          hint="Pending or in transit"
          icon={Clock}
          accent="warning"
        />
        <StatCard
          label="Units returned"
          value={formatNumber(returnedUnits)}
          hint="Reconciled to warehouse"
          icon={CheckCircle2}
          accent="success"
        />
        <StatCard
          label="Value returned"
          value={formatCurrency(returnedValue)}
          icon={CheckCircle2}
          accent="info"
        />
      </div>

      {/* Lifecycle legend */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">How a return flows</span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4 text-amber-500" /> Submitted
          </span>
          <span className="text-muted-foreground/50">→</span>
          <span className="inline-flex items-center gap-1.5">
            <Truck className="size-4 text-violet-500" /> Authorised — send to
            warehouse
          </span>
          <span className="text-muted-foreground/50">→</span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-emerald-500" /> Received &
            reconciled
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <XCircle className="size-4 text-rose-500" /> Rejected
          </span>
        </CardContent>
      </Card>

      {/* History FIRST */}
      <Card>
        <CardHeader>
          <CardTitle>Return history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {returns.length === 0 ? (
            <div className="m-6">
              <EmptyState
                icon={Undo2}
                title="No returns yet"
                description="When you send stock back, every request is tracked here end-to-end."
              />
              <div className="mt-4 flex justify-center">
                <Button asChild variant="outline">
                  <Link href="/partner/returns/new">
                    <Plus className="size-4" />
                    Request a return
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <PartnerReturnsHistory returns={rows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
