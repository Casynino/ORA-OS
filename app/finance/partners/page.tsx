import { Users, CreditCard, AlertTriangle, TrendingUp } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getPartnerCredit } from "@/lib/services/credit";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  PartnerFinanceControls,
  type PartnerProductDTO,
} from "@/components/finance/partner-finance-controls";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Finance's partner book — limits, utilisation, scores and agreed pricing.
 * Strictly the financial view: account management stays with the admin. */
export default async function FinancePartnersPage() {
  await requireRole("FINANCE");

  const [partners, products, partnerPrices] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PARTNER", status: { in: ["ACTIVE", "SUSPENDED"] } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        organization: true,
        businessType: true,
        status: true,
        creditLimit: true,
        creditScore: true,
        creditCycles: true,
      },
    }),
    prisma.product.findMany({
      where: { isActive: true, notForSale: false },
      orderBy: { price: "desc" },
      select: { id: true, name: true, price: true },
    }),
    prisma.partnerPrice.findMany(),
  ]);

  const facilities = await Promise.all(
    partners.map((p) => getPartnerCredit(p.id)),
  );
  const rows = partners.map((p, i) => ({ partner: p, facility: facilities[i] }));

  const priceByPartner = new Map<string, Record<string, number>>();
  for (const pp of partnerPrices) {
    const m = priceByPartner.get(pp.partnerId) ?? {};
    m[pp.productId] = pp.price;
    priceByPartner.set(pp.partnerId, m);
  }

  const totals = {
    limit: rows.reduce((s, r) => s + r.facility.limit, 0),
    used: rows.reduce((s, r) => s + r.facility.used, 0),
    overdue: rows.filter((r) => r.facility.hasOverdue).length,
  };
  const productDto: PartnerProductDTO[] = products;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partner accounts"
        description="Every partner's financial standing — credit limits, utilisation, scores and agreed pricing. The admin can override any decision."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Partners" value={formatNumber(rows.length)} icon={Users} accent="primary" />
        <StatCard label="Total credit extended" value={formatCurrency(totals.limit)} icon={CreditCard} accent="info" />
        <StatCard
          label="Credit in use"
          value={formatCurrency(totals.used)}
          hint={totals.limit > 0 ? `${Math.round((totals.used / totals.limit) * 100)}% utilisation` : undefined}
          icon={TrendingUp}
          accent="warning"
        />
        <StatCard
          label="Overdue partners"
          value={formatNumber(totals.overdue)}
          icon={AlertTriangle}
          accent={totals.overdue > 0 ? "warning" : "success"}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No partners yet" description="Approved partners appear here with their credit facilities." />
      ) : (
        <div className="rounded-2xl border border-border bg-card">
          <Table wrapperClassName="table-stack">
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead className="text-right">Limit</TableHead>
                <TableHead className="text-right">In use</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Standing</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ partner: p, facility: f }) => {
                const util = f.limit > 0 ? Math.round((f.used / f.limit) * 100) : 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell data-cardtitle>
                      <div className="font-medium">{p.organization ?? p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.name}
                        {p.businessType ? ` · ${p.businessType}` : ""}
                      </div>
                    </TableCell>
                    <TableCell data-label="Limit" className="text-right font-medium">
                      {formatCurrency(f.limit)}
                    </TableCell>
                    <TableCell data-label="In use" className="text-right text-sm">
                      {formatCurrency(f.used)}
                      {f.limit > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">({util}%)</span>
                      )}
                    </TableCell>
                    <TableCell data-label="Available" className="text-right text-sm text-success">
                      {formatCurrency(f.available)}
                    </TableCell>
                    <TableCell data-label="Score">
                      <span className="text-sm font-medium">{f.score}</span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        · {f.cycles} cycle{f.cycles === 1 ? "" : "s"}
                      </span>
                    </TableCell>
                    <TableCell data-label="Standing">
                      {p.status === "SUSPENDED" ? (
                        <Badge variant="destructive">Account suspended</Badge>
                      ) : f.hasOverdue ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : f.limit === 0 ? (
                        <Badge variant="secondary">Credit suspended</Badge>
                      ) : (
                        <Badge variant="success">Good standing</Badge>
                      )}
                    </TableCell>
                    <TableCell data-label="Actions">
                      <PartnerFinanceControls
                        partnerId={p.id}
                        partnerName={p.organization ?? p.name}
                        creditLimit={f.limit}
                        products={productDto}
                        prices={priceByPartner.get(p.id) ?? {}}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
