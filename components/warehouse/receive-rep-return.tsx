"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { completeReturn } from "@/lib/actions/returns";
import { combineToPieces, splitQty } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { formatNumber } from "@/lib/utils";

/** Confirm receipt of a rep's returned stock. The warehouse counts what actually
 *  arrived — if the rep said 10 but 9 came, they enter 9 and only those 9 leave
 *  the rep's stock (the missing one stays on the rep's account). */
export function ReceiveRepReturn({
  id,
  requested,
  requesterName,
  productName,
  unitsPerCarton,
  notForSale,
  size = "default",
  onDone,
}: {
  id: string;
  requested: number;
  requesterName: string;
  productName: string;
  unitsPerCarton: number;
  notForSale: boolean;
  size?: "default" | "sm";
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const perCarton = unitsPerCarton || 24;
  const init = splitQty(requested, perCarton);
  const [cartons, setCartons] = useState(String(notForSale ? 0 : init.cartons));
  const [pieces, setPieces] = useState(String(notForSale ? requested : init.pieces));

  const counted = notForSale
    ? Math.max(0, Math.floor(Number(pieces) || 0))
    : combineToPieces(Number(cartons), Number(pieces), perCarton);
  const diff = counted - requested;

  function openDialog() {
    setCartons(String(notForSale ? 0 : init.cartons));
    setPieces(String(notForSale ? requested : init.pieces));
    setOpen(true);
  }

  function submit() {
    start(async () => {
      const res = await completeReturn(id, counted);
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        onDone?.();
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <>
      <Button size={size} variant="success" onClick={openDialog}>
        <PackageCheck className={size === "sm" ? "size-3.5" : "size-4"} /> Confirm receipt
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Confirm what arrived"
          description={`${requesterName} says they are returning ${formatNumber(requested)} × ${productName}. Count the goods and enter what you actually received.`}
        >
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              {!notForSale && (
                <div className="min-w-0 flex-1">
                  <Label className="text-xs">Cartons ({perCarton} pcs)</Label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={cartons}
                    onChange={(e) => setCartons(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Label className="text-xs">{notForSale ? "Sample packs" : "Pieces"}</Label>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={pieces}
                  onChange={(e) => setPieces(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <p className="flex justify-between">
                <span className="text-muted-foreground">{requesterName} said</span>
                <span className="font-semibold">{formatNumber(requested)} pcs</span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground">You counted</span>
                <span className="font-semibold">{formatNumber(counted)} pcs</span>
              </p>
              {diff !== 0 && counted > 0 && (
                <p className={`mt-1.5 text-xs ${diff < 0 ? "text-warning" : "text-info"}`}>
                  {diff < 0
                    ? `${formatNumber(-diff)} pcs fewer than ${requesterName} said — those stay on ${requesterName}'s stock until sorted out.`
                    : `${formatNumber(diff)} pcs more than ${requesterName} said — all ${formatNumber(counted)} leave their stock.`}
                </p>
              )}
            </div>
            <Button className="w-full" onClick={submit} disabled={pending || counted <= 0}>
              <PackageCheck className="size-4" />
              {pending ? "Receiving…" : `Receive ${formatNumber(counted)} pcs`}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
