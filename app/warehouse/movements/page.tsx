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

// Warehouse-friendly names for the ledger movement types.
const WH_MOVE_LABEL: Record<string, string> = {
  INBOUND: "Received",
  ASSIGNED: "Issued",
  DISTRIBUTED: "Dispatched",
  RESTOCKED: "Returned",
  ADJUSTMENT: "Adjusted",
};

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
        description={`The complete audit trail for ${me.warehouse.name} — from opening stock through every issue, dispatch and return.`}
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
                  <TableHead>Details</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell data-label="Type">
                      <Badge variant="secondary">{WH_MOVE_LABEL[m.type] ?? humanize(m.type)}</Badge>
                    </TableCell>
                    <TableCell data-cardtitle className="font-medium">{m.product.name}</TableCell>
                    <TableCell data-label="Qty" className="text-right">
                      {formatNumber(m.quantity)}
                    </TableCell>
                    <TableCell data-label="Details" className="text-sm">
                      <span className="text-foreground">{m.note ?? m.reference ?? "—"}</span>
                      {m.note && m.reference && (
                        <span className="block text-xs text-muted-foreground">{m.reference}</span>
                      )}
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
