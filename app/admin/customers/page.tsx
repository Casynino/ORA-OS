import Link from "next/link";
import { Users, ChevronRight, BadgeCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** The company's master customer database: partners AND rep-acquired field
 *  customers. Reps manage the relationship; ORA owns the customer. */
export default async function AdminCustomersPage() {
  const [partners, fieldCustomers] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PARTNER" },
      orderBy: { createdAt: "desc" },
      include: { creditAccounts: true },
    }),
    prisma.fieldCustomer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        rep: { select: { id: true, name: true } },
        sales: {
          where: { voided: false },
          select: { total: true, amountPaid: true, type: true },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Customers"
        description="ORA's master customer database — partners and field customers acquired by the sales team, in one place."
      />

      {/* ── Partners ── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Users className="size-5 text-primary" />
          Partners
          <span className="text-sm font-normal text-muted-foreground">
            agents, distributors, NGOs & schools · {partners.length}
          </span>
        </h2>
        <Card className="glass-card">
          <CardContent className="p-0">
            {partners.length === 0 ? (
              <EmptyState className="m-6" icon={Users} title="No partners yet" />
            ) : (
              <Table wrapperClassName="table-stack">
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Credit limit</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((p) => {
                    const outstanding = p.creditAccounts
                      .filter((c) => c.status !== "SETTLED")
                      .reduce((s, c) => s + (c.principal - c.amountPaid), 0);
                    return (
                      <TableRow key={p.id}>
                        <TableCell data-cardtitle>
                          <Link href={`/admin/customers/${p.id}`} className="font-medium hover:text-primary">
                            {p.organization ?? p.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">{p.name} · {p.email}</div>
                        </TableCell>
                        <TableCell data-label="Location" className="text-sm text-muted-foreground">{p.location ?? "—"}</TableCell>
                        <TableCell data-label="Credit limit" className="text-right">{p.creditLimit != null ? formatCurrency(p.creditLimit) : "—"}</TableCell>
                        <TableCell data-label="Outstanding" className="text-right font-medium">{outstanding > 0 ? formatCurrency(outstanding) : "—"}</TableCell>
                        <TableCell data-label="Status"><StatusBadge status={p.status} /></TableCell>
                        <TableCell data-label="" className="text-right">
                          <Link href={`/admin/customers/${p.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                            Open <ChevronRight className="size-4" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Field customers — acquired & managed by sales reps ── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <BadgeCheck className="size-5 text-success" />
          Field customers
          <span className="text-sm font-normal text-muted-foreground">
            acquired by the sales team · {fieldCustomers.length}
          </span>
        </h2>
        <Card className="glass-card">
          <CardContent className="p-0">
            {fieldCustomers.length === 0 ? (
              <EmptyState
                className="m-6"
                icon={BadgeCheck}
                title="No field customers yet"
                description="Customers created by sales reps appear here automatically — with their owner."
              />
            ) : (
              <Table wrapperClassName="table-stack">
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Sales rep</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Lifetime sales</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fieldCustomers.map((c) => {
                    const revenue = c.sales.reduce((s, x) => s + x.total, 0);
                    const owed = c.sales
                      .filter((x) => x.type === "CREDIT")
                      .reduce((s, x) => s + Math.max(0, x.total - x.amountPaid), 0);
                    return (
                      <TableRow key={c.id}>
                        <TableCell data-cardtitle>
                          <Link href={`/admin/reps/customers/${c.id}`} className="font-medium hover:text-primary">
                            {c.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {[c.businessName, c.customerType, c.phone].filter(Boolean).join(" · ") || "—"}
                            {c.creditSuspended && (
                              <Badge variant="destructive" className="ml-2 text-[10px]">credit off</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell data-label="Sales rep">
                          <Link href={`/admin/reps/${c.rep.id}`} className="text-sm font-medium text-primary hover:underline">
                            {c.rep.name}
                          </Link>
                        </TableCell>
                        <TableCell data-label="Location" className="text-sm text-muted-foreground">
                          {[c.location, c.region].filter(Boolean).join(", ") || "—"}
                        </TableCell>
                        <TableCell data-label="Lifetime sales" className="text-right">
                          {revenue > 0 ? formatCurrency(revenue) : "—"}
                        </TableCell>
                        <TableCell data-label="Outstanding" className="text-right font-medium">
                          {owed > 0 ? (
                            <span className="text-warning">{formatCurrency(owed)}</span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell data-label="Registered" className="text-sm text-muted-foreground">
                          {formatDate(c.createdAt)}
                        </TableCell>
                        <TableCell data-label="" className="text-right">
                          <Link href={`/admin/reps/customers/${c.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                            Open <ChevronRight className="size-4" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
