import { Ship } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber, formatDateTime } from "@/lib/utils";

export default async function AdminImportsPage() {
  const imports = await prisma.stockMovement.findMany({
    where: { type: "INBOUND" },
    orderBy: { createdAt: "desc" },
    include: { product: true, createdBy: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Imports & Purchase Orders" description="Every restock recorded into the warehouse." />
      <Card className="glass-card">
        <CardContent className="p-0">
          {imports.length === 0 ? (
            <EmptyState className="m-6" icon={Ship} title="No imports recorded yet" />
          ) : (
            <Table wrapperClassName="table-stack">
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Received by</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell data-cardtitle className="font-medium">{m.product.name}</TableCell>
                    <TableCell data-label="Quantity" className="text-right"><Badge variant="success">+{formatNumber(m.quantity)}</Badge></TableCell>
                    <TableCell data-label="Reference" className="text-sm text-muted-foreground">{m.reference ?? "—"}</TableCell>
                    <TableCell data-label="Received by" className="text-sm text-muted-foreground">{m.createdBy.name}</TableCell>
                    <TableCell data-label="Date" className="text-sm text-muted-foreground">{formatDateTime(m.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
