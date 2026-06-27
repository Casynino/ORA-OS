"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  ArrowRight,
  Plus,
  Check,
  Truck,
  PackageCheck,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  createTransfer,
  approveTransfer,
  dispatchTransfer,
  receiveTransfer,
  rejectTransfer,
} from "@/lib/actions/transfers";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActionButton } from "@/components/dashboard/action-button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/use-toast";
import { formatDateTime, formatNumber } from "@/lib/utils";

export type WarehouseLite = { id: string; name: string };
export type TransferDTO = {
  id: string;
  code: string;
  from: string;
  to: string;
  status: string;
  note: string | null;
  createdBy: string;
  createdAt: string;
  items: { name: string; quantity: number }[];
};

export function TransfersManager({
  transfers,
  warehouses,
  stockByWarehouse,
}: {
  transfers: TransferDTO[];
  warehouses: WarehouseLite[];
  stockByWarehouse: Record<string, { productId: string; name: string; onHand: number }[]>;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reject(id: string) {
    const note = window.prompt("Reason (optional)") ?? undefined;
    start(async () => {
      const res = await rejectTransfer(id, note);
      if (res.ok) toast({ variant: "success", title: res.message });
      else toast({ variant: "error", title: res.error });
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New transfer
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {transfers.length === 0 ? (
          <EmptyState
            className="m-6"
            icon={ArrowLeftRight}
            title="No transfers yet"
            description="Create a transfer to move stock between warehouses."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6" />
                  <TableHead>Transfer</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t) => {
                  const isOpen = expanded === t.id;
                  const units = t.items.reduce((s, i) => s + i.quantity, 0);
                  return (
                    <Fragment key={t.id}>
                      <TableRow
                        className="cursor-pointer transition-colors hover:bg-muted/40"
                        onClick={() => setExpanded(isOpen ? null : t.id)}
                      >
                        <TableCell>
                          {isOpen ? (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{t.code}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            {t.from}
                            <ArrowRight className="size-3.5 text-muted-foreground" />
                            {t.to}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {t.items.length} · {formatNumber(units)}u
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={t.status} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDateTime(t.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div
                            className="flex justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t.status === "PENDING" && (
                              <>
                                <ActionButton
                                  size="sm"
                                  variant="success"
                                  action={() => approveTransfer(t.id)}
                                  onDone={() => router.refresh()}
                                  pendingText="…"
                                >
                                  <Check className="size-3.5" />
                                  Approve
                                </ActionButton>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:bg-destructive/10"
                                  disabled={pending}
                                  onClick={() => reject(t.id)}
                                >
                                  <X className="size-3.5" />
                                </Button>
                              </>
                            )}
                            {t.status === "APPROVED" && (
                              <ActionButton
                                size="sm"
                                action={() => dispatchTransfer(t.id)}
                                onDone={() => router.refresh()}
                                pendingText="…"
                              >
                                <Truck className="size-3.5" />
                                Dispatch
                              </ActionButton>
                            )}
                            {t.status === "IN_TRANSIT" && (
                              <ActionButton
                                size="sm"
                                variant="success"
                                action={() => receiveTransfer(t.id)}
                                onDone={() => router.refresh()}
                                pendingText="…"
                              >
                                <PackageCheck className="size-3.5" />
                                Confirm receipt
                              </ActionButton>
                            )}
                            {(t.status === "COMPLETED" || t.status === "REJECTED") && (
                              <span className="text-xs text-muted-foreground">
                                {t.status === "COMPLETED" ? "Done" : "Closed"}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={7} className="p-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Products
                                </p>
                                <ul className="space-y-1 text-sm">
                                  {t.items.map((i, idx) => (
                                    <li key={idx} className="flex justify-between">
                                      <span>{i.name}</span>
                                      <span className="text-muted-foreground">
                                        ×{formatNumber(i.quantity)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div className="text-sm">
                                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Details
                                </p>
                                <p className="text-muted-foreground">
                                  Created by {t.createdBy}
                                </p>
                                {t.note && (
                                  <p className="mt-1">
                                    <span className="text-muted-foreground">Note: </span>
                                    {t.note}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {creating && (
        <CreateTransfer
          warehouses={warehouses}
          stockByWarehouse={stockByWarehouse}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CreateTransfer({
  warehouses,
  stockByWarehouse,
  onClose,
  onDone,
}: {
  warehouses: WarehouseLite[];
  stockByWarehouse: Record<string, { productId: string; name: string; onHand: number }[]>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [fromId, setFromId] = useState(warehouses[0]?.id ?? "");
  const [toId, setToId] = useState(warehouses[1]?.id ?? warehouses[0]?.id ?? "");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");

  const sourceStock = useMemo(
    () => stockByWarehouse[fromId] ?? [],
    [stockByWarehouse, fromId],
  );
  const totalUnits = sourceStock.reduce((s, p) => s + (qty[p.productId] ?? 0), 0);
  const over = sourceStock.some((p) => (qty[p.productId] ?? 0) > p.onHand);
  const sameWh = fromId === toId;

  function submit() {
    if (sameWh) {
      toast({ variant: "error", title: "Source and destination must differ." });
      return;
    }
    const items = sourceStock
      .filter((p) => (qty[p.productId] ?? 0) > 0)
      .map((p) => ({ productId: p.productId, quantity: qty[p.productId] }));
    if (items.length === 0) {
      toast({ variant: "error", title: "Add at least one product." });
      return;
    }
    start(async () => {
      const res = await createTransfer({ fromId, toId, items, note: note || undefined });
      if (res.ok) {
        toast({ variant: "success", title: `${res.data?.code} created` });
        onDone();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <Modal open onClose={onClose} title="New transfer" description="Move stock between warehouses.">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>From</Label>
            <Select value={fromId} onChange={(e) => setFromId(e.target.value)} className="mt-1.5">
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>To</Label>
            <Select value={toId} onChange={(e) => setToId(e.target.value)} className="mt-1.5">
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
          </div>
        </div>
        {sameWh && (
          <p className="text-xs text-destructive">Choose two different warehouses.</p>
        )}

        <div>
          <Label>Products (available at source)</Label>
          <div className="mt-1.5 space-y-2">
            {sourceStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stock at this warehouse.</p>
            ) : (
              sourceStock.map((p) => {
                const q = qty[p.productId] ?? 0;
                const overOne = q > p.onHand;
                return (
                  <div key={p.productId} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{formatNumber(p.onHand)} on hand</p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={p.onHand}
                      value={q}
                      onChange={(e) =>
                        setQty((m) => ({ ...m, [p.productId]: Math.max(0, Number(e.target.value)) }))
                      }
                      className={`h-8 w-20 text-center ${overOne ? "border-destructive text-destructive" : ""}`}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div>
          <Label>Note (optional)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-medium">{formatNumber(totalUnits)} units</span>
        </div>

        <Button
          className="w-full"
          onClick={submit}
          disabled={pending || sameWh || over || totalUnits === 0}
        >
          {pending ? "Creating…" : "Create transfer"}
        </Button>
      </div>
    </Modal>
  );
}
