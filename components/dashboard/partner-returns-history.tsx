"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatDate, formatNumber } from "@/lib/utils";

export type PartnerReturnRow = {
  id: string;
  code: string;
  dateISO: string;
  productName: string;
  image: string;
  quantity: number;
  reasonType: string | null;
  reason: string | null;
  status: string;
  warehouseName: string | null;
  adminNote: string | null;
};

export function PartnerReturnsHistory({ returns }: { returns: PartnerReturnRow[] }) {
  const router = useRouter();
  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="md:hidden">
        {returns.map((r) => (
          <button
            key={r.id}
            onClick={() => router.push(`/partner/returns/${r.id}`)}
            className="flex w-full items-center gap-3 border-b border-border p-4 text-left transition-colors last:border-0 active:bg-muted/50"
          >
            <span className="relative size-11 shrink-0 overflow-hidden rounded-md bg-muted">
              <Image
                src={r.image}
                alt={r.productName}
                fill
                className="object-cover"
                sizes="44px"
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{r.code}</span>
                <StatusBadge status={r.status} />
              </div>
              <p className="truncate text-sm">{r.productName}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(r.dateISO)} · Qty {formatNumber(r.quantity)}
                {r.reasonType ? ` · ${r.reasonType}` : ""}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Desktop: full table */}
      <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Return</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Destination</TableHead>
            <TableHead>ORA team note</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {returns.map((r) => (
            <TableRow
              key={r.id}
              onClick={() => router.push(`/partner/returns/${r.id}`)}
              className="cursor-pointer transition-colors hover:bg-muted/40"
            >
              <TableCell className="font-medium">{r.code}</TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {formatDate(r.dateISO)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <span className="relative size-8 shrink-0 overflow-hidden rounded-md bg-muted">
                    <Image src={r.image} alt={r.productName} fill className="object-cover" sizes="32px" />
                  </span>
                  <span className="text-sm">{r.productName}</span>
                </div>
              </TableCell>
              <TableCell className="text-right font-medium">{formatNumber(r.quantity)}</TableCell>
              <TableCell className="text-sm">
                {r.reasonType ? (
                  <span>
                    {r.reasonType}
                    {r.reason ? (
                      <span className="block text-xs text-muted-foreground">{r.reason}</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{r.reason ?? "—"}</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={r.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.warehouseName ?? "—"}</TableCell>
              <TableCell className="max-w-[200px] text-sm text-muted-foreground">{r.adminNote ?? "—"}</TableCell>
              <TableCell className="text-right">
                <ChevronRight className="ml-auto size-4 text-muted-foreground" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </>
  );
}
