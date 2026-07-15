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

export const dynamic = "force-dynamic";

export default async function WarehouseMovementsPage() {
  const session = await requireRole("WAREHOUSE");
  const me = await prisma.user.findUnique({
    where: { id: session.id },
    include: { warehouse: true },
  });
  if (!me?.warehouse) {
    return (
      <EmptyState
        icon={Boxes}
        title="No warehouse assigned"
        description="Ask an ORA admin to assign you to a warehouse."
      />
    );
  }

  // Only movements that physically involved this warehouse. Select just the
  // operational fields — never ship product pricing into the warehouse payload.
  const movements = await prisma.stockMovement.findMany({
    where: { warehouseName: me.warehouse.name },
    take: 80,
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock movements"
        description={`Every stock change involving ${me.warehouse.name}.`}
      />
      {movements.length === 0 ? (
        <EmptyState icon={Boxes} title="No movements yet" />
      ) : (
        <Card className="glass-card">
          <CardContent className="p-0">
            <Table wrapperClassName="table-stack">
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
                    <TableCell data-label="Type">
                      <Badge variant="secondary">{humanize(m.type)}</Badge>
                    </TableCell>
                    <TableCell data-cardtitle className="font-medium">{m.product.name}</TableCell>
                    <TableCell data-label="Qty" className="text-right">
                      {formatNumber(m.quantity)}
                    </TableCell>
                    <TableCell data-label="Reference" className="text-sm text-muted-foreground">
                      {m.reference ?? "—"}
                    </TableCell>
                    <TableCell data-label="By" className="text-sm text-muted-foreground">
                      {m.createdBy.name}
                    </TableCell>
                    <TableCell data-label="When" className="text-sm text-muted-foreground">
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
