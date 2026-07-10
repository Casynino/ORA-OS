"use client";

import { Boxes, Package } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { combineToPieces, splitQty } from "@/lib/units";
import { formatNumber } from "@/lib/utils";

// A single quantity entry that accepts CARTONS and/or PIECES and reports the
// combined total in pieces — so no one ever does the carton maths by hand.
// Fully controlled: the parent owns the two string fields and the derived total.
export function QuantityInput({
  unitsPerCarton,
  cartons,
  pieces,
  onCartons,
  onPieces,
  unitNoun = "pieces",
  disabled,
  autoFocus,
}: {
  unitsPerCarton: number;
  cartons: string;
  pieces: string;
  onCartons: (v: string) => void;
  onPieces: (v: string) => void;
  unitNoun?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const total = combineToPieces(Number(cartons), Number(pieces), unitsPerCarton);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="flex items-center gap-1.5 text-xs">
            <Boxes className="size-3.5 text-muted-foreground" />
            Cartons
          </Label>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={cartons}
            disabled={disabled}
            autoFocus={autoFocus}
            onChange={(e) => onCartons(e.target.value)}
            className="mt-1.5"
            placeholder="0"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            1 carton = {formatNumber(unitsPerCarton)} {unitNoun}
          </p>
        </div>
        <div>
          <Label className="flex items-center gap-1.5 text-xs">
            <Package className="size-3.5 text-muted-foreground" />
            Loose {unitNoun}
          </Label>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={pieces}
            disabled={disabled}
            onChange={(e) => onPieces(e.target.value)}
            className="mt-1.5"
            placeholder="0"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">extra units</p>
        </div>
      </div>
      <div className="rounded-xl bg-primary/5 px-3 py-2.5 text-sm">
        <span className="text-muted-foreground">Total: </span>
        <span className="font-semibold text-primary">
          {formatNumber(total)} {unitNoun}
        </span>
        {total > 0 && (
          <span className="text-muted-foreground">
            {" "}
            {breakdown(total, unitsPerCarton, unitNoun)}
          </span>
        )}
      </div>
    </div>
  );
}

function breakdown(total: number, upc: number, unitNoun: string) {
  const { cartons, pieces } = splitQty(total, upc);
  if (cartons === 0) return "";
  const parts = [`${formatNumber(cartons)} carton${cartons === 1 ? "" : "s"}`];
  if (pieces > 0) parts.push(`${formatNumber(pieces)} ${unitNoun}`);
  return `( ${parts.join(" + ")} )`;
}
