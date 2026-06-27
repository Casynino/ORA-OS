import { Users } from "lucide-react";
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
      <PageHeader title="Customers" description="Partners — agents, distributors, NGOs and schools, with credit status." />
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
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.organization ?? "—"} · {p.email}</div>
                      </TableCell>
                      <TableCell data-label="Location" className="text-sm text-muted-foreground">{p.location ?? "—"}</TableCell>
                      <TableCell data-label="Credit limit" className="text-right">{p.creditLimit != null ? formatCurrency(p.creditLimit) : "—"}</TableCell>
                      <TableCell data-label="Outstanding" className="text-right font-medium">{outstanding > 0 ? formatCurrency(outstanding) : "—"}</TableCell>
                      <TableCell data-label="Status"><StatusBadge status={p.status} /></TableCell>
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
