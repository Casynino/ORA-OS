import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StockRequestHistory } from "@/components/field/stock-request-history";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** The rep's own record of every stock request they made and exactly what they
 *  received from the warehouse against it — one merged view (asked → received). */
export default async function RepStockRequestsPage() {
  const me = await requireRole("SALES_REP");

  const [requests, issues] = await Promise.all([
    prisma.repStockRequest.findMany({
      where: { repId: me.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { items: { include: { product: { select: { name: true } } } } },
    }),
    // Only needed to surface any stock issued WITHOUT a request (rare) so nothing
    // is hidden — a request-linked issue carries the request code in `note`.
    prisma.repStockIssue.findMany({
      where: { repId: me.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { product: { select: { name: true } } },
    }),
  ]);

  const reqCodes = new Set(requests.map((r) => r.code));
  const reqDTO = requests.map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    items: r.items.map((it) => ({
      name: it.product.name,
      requested: it.quantity,
      received: it.issuedQty,
    })),
  }));
  const directIssues = issues
    .filter((i) => !i.note || !reqCodes.has(i.note))
    .map((i) => ({
      id: i.id,
      code: i.code,
      kind: i.kind,
      quantity: i.quantity,
      name: i.product.name,
      createdAt: i.createdAt.toISOString(),
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request history"
        description="Every stock request you've made and exactly what you received from the warehouse against it — your own copy of the record."
      >
        <Link href="/rep/stock/request" className={cn(buttonVariants({ size: "sm" }), "rounded-full")}>
          <PlusCircle className="size-4" /> Request stock
        </Link>
      </PageHeader>

      <StockRequestHistory requests={reqDTO} directIssues={directIssues} />
    </div>
  );
}
