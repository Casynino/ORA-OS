import Link from "next/link";
import { Users, ChevronRight } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";

export default async function AdminCustomersPage() {
  const partners = await prisma.user.findMany({
    where: { role: "PARTNER" },
    orderBy: { createdAt: "desc" },
    include: { creditAccounts: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Partners — agents, distributors, NGOs and schools. Open a profile to manage the full relationship." />
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
    </div>
  );
}
