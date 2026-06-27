import { FileText } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function AdminInvoicesPage() {
  const orders = await prisma.request.findMany({
    where: { status: { in: ["APPROVED", "IN_TRANSIT", "FULFILLED"] } },
    orderBy: { createdAt: "desc" },
    include: { requester: true, creditAccount: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Auto-generated from approved & fulfilled orders." />
      <Card className="glass-card">
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <EmptyState className="m-6" icon={FileText} title="No invoices yet" description="Approving an order generates its invoice." />
          ) : (
            <Table wrapperClassName="table-stack">
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((r) => {
                  const total = r.totalAmount ?? 0;
                  const balance = r.creditAccount
                    ? r.creditAccount.principal - r.creditAccount.amountPaid
                    : 0;
                  const paid = balance <= 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell data-cardtitle className="font-medium">{r.code.replace("REQ", "INV")}</TableCell>
                      <TableCell data-label="Partner">{r.requester.name}</TableCell>
                      <TableCell data-label="Total" className="text-right font-medium">{formatCurrency(total)}</TableCell>
                      <TableCell data-label="Balance" className="text-right">{balance > 0 ? formatCurrency(balance) : "—"}</TableCell>
                      <TableCell data-label="Status">
                        {paid ? <Badge variant="success">Paid</Badge> : <Badge variant="warning">Balance due</Badge>}
                      </TableCell>
                      <TableCell data-label="Date" className="text-sm text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
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
