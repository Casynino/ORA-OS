import { requireRole } from "@/lib/rbac";
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
import { Boxes } from "lucide-react";
import { formatNumber, formatDateTime, humanize } from "@/lib/utils";

export default async function WarehouseMovementsPage() {
  await requireRole("WAREHOUSE");
  const movements = await prisma.stockMovement.findMany({
    take: 80,
    orderBy: { createdAt: "desc" },
    include: { product: true, createdBy: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock movements"
        description="The immutable ledger of every stock change."
      />
      {movements.length === 0 ? (
        <EmptyState icon={Boxes} title="No movements yet" />
      ) : (
        <Card className="glass-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Badge variant="secondary">{humanize(m.type)}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{m.product.name}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(m.quantity)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.reference ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.createdBy.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(m.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
