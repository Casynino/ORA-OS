"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelRepReturn, updateRepStockReturn } from "@/lib/actions/returns";
import { REP_RETURN_REASONS, type RepReturnReason } from "@/lib/rep-returns";
import { combineToPieces, splitQty } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "@/components/ui/use-toast";
import { formatNumber, timeAgo } from "@/lib/utils";

export type RepReturnRow = {
  id: string;
  code: string;
  productName: string;
  quantity: number;
  status: string;
  warehouseName: string | null;
  reason: string | null;
  adminNote: string | null;
  createdAt: string;
  unitsPerCarton: number;
  notForSale: boolean;
  /** Most pieces this return can be changed to (what you hold, minus your other waiting returns). */
  maxQty: number;
};

const STEP: Record<string, string> = {
  PENDING: "Waiting for the warehouse to accept",
  IN_TRANSIT: "Accepted — bring the goods to the warehouse",
  COMPLETED: "Received — out of your stock",
};

/** "Unsold stock — note" → { reason, note } (the reasons never contain " — "). */
function splitReason(text: string | null): { reason: RepReturnReason; note: string } {
  const t = text ?? "";
  const hit = REP_RETURN_REASONS.find((r) => t === r || t.startsWith(`${r} — `));
  if (!hit) return { reason: "Other", note: t };
  return { reason: hit, note: t.slice(hit.length).replace(/^ — /, "") };
}

function EditReturn({ row, onClose }: { row: RepReturnRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const perCarton = row.unitsPerCarton || 24;
  const init = splitQty(row.quantity, perCarton);
  const parsed = splitReason(row.reason);
  const [cartons, setCartons] = useState(String(row.notForSale ? 0 : init.cartons));
  const [pieces, setPieces] = useState(String(row.notForSale ? row.quantity : init.pieces));
  const [reason, setReason] = useState<RepReturnReason>(parsed.reason);
  const [note, setNote] = useState(parsed.note);

  const qty = row.notForSale
    ? Math.max(0, Math.floor(Number(pieces) || 0))
    : combineToPieces(Number(cartons), Number(pieces), perCarton);
  const over = qty > row.maxQty;

  function save() {
    start(async () => {
      const res = await updateRepStockReturn(row.id, { quantity: qty, reason, note: note.trim() || undefined });
      toast(res.ok ? { variant: "success", title: res.message } : { variant: "error", title: res.error });
      if (res.ok) onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit return ${row.code}`}
      description={`${row.productName}. You can change this until the warehouse accepts it.`}
    >
      <div className="space-y-4">
        <div className="flex items-end gap-3">
          {!row.notForSale && (
            <div className="min-w-0 flex-1">
              <Label className="text-xs">Cartons ({perCarton} pcs)</Label>
              <Input type="number" min={0} inputMode="numeric" value={cartons} onChange={(e) => setCartons(e.target.value)} className="mt-1" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <Label className="text-xs">{row.notForSale ? "Sample packs" : "Pieces"}</Label>
            <Input type="number" min={0} inputMode="numeric" value={pieces} onChange={(e) => setPieces(e.target.value)} className="mt-1" />
          </div>
        </div>
        <p className={`text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>
          Total {formatNumber(qty)} pcs · you can return up to {formatNumber(row.maxQty)} pcs
        </p>
        <div>
          <Label className="text-xs">Why are you returning it?</Label>
          <Select value={reason} onChange={(e) => setReason(e.target.value as RepReturnReason)} className="mt-1">
            {REP_RETURN_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label className="text-xs">Note (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" />
        </div>
        <Button className="w-full" onClick={save} disabled={pending || qty <= 0 || over}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </Modal>
  );
}

export function RepReturnHistory({ rows }: { rows: RepReturnRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<RepReturnRow | null>(null);

  function cancel(id: string) {
    start(async () => {
      const res = await cancelRepReturn(id);
      toast(res.ok ? { variant: "success", title: res.message } : { variant: "error", title: res.error });
      router.refresh();
    });
  }

  return (
    <>
      <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
        {rows.map((r) => {
          const cancelled = r.status === "REJECTED" && r.adminNote === "Cancelled by the rep";
          return (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.code}</span>
                  <StatusBadge status={cancelled ? "CANCELLED" : r.status} />
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatNumber(r.quantity)} × {r.productName}
                  {r.warehouseName ? ` → ${r.warehouseName}` : ""} · {timeAgo(r.createdAt)}
                </p>
                <p className="mt-0.5 text-xs">
                  {r.status === "REJECTED"
                    ? cancelled
                      ? "You cancelled this return."
                      : `Declined${r.adminNote ? `: ${r.adminNote}` : "."} The stock stays with you.`
                    : (STEP[r.status] ?? "")}
                </p>
                {r.status === "COMPLETED" && r.adminNote && (
                  <p className="mt-0.5 text-xs text-warning">Count note: {r.adminNote}</p>
                )}
              </div>
              {r.status === "PENDING" && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(r)} disabled={pending}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => cancel(r.id)} disabled={pending}>
                    Cancel
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {editing && <EditReturn key={editing.id} row={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
