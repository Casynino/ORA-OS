"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronRight, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate, humanize } from "@/lib/utils";

export type SaleRow = {
  id: string;
  code: string;
  buyer: string;
  isWalkin: boolean;
  paymentType: string;
  total: number;
  dateISO: string;
};

export function SalesTable({
  rows,
  detailBase = "/admin/sales",
}: {
  rows: SaleRow[];
  detailBase?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.buyer.toLowerCase().includes(q),
    );
  }, [rows, query]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="No confirmed sales yet"
        description="Fulfilled orders and recorded cash sales appear here."
      />
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border p-3">
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sale or customer…"
            className="h-9 pl-9"
          />
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          className="m-6"
          icon={ShoppingCart}
          title="No sales match"
          description="Try a different search term."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sale</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow
                  key={r.id}
                  onClick={() => router.push(`${detailBase}/${r.id}`)}
                  className="cursor-pointer transition-colors hover:bg-muted/40"
                >
                  <TableCell className="font-medium">{r.code}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      {r.buyer}
                      {r.isWalkin && (
                        <Badge variant="outline" className="text-[10px]">
                          Field
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={r.paymentType === "CREDIT" ? "accent" : "secondary"}
                    >
                      {humanize(r.paymentType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(r.total)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="success">Fulfilled</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(r.dateISO)}
                  </TableCell>
                  <TableCell className="text-right">
                    <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
