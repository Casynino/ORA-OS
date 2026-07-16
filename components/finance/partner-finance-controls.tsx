"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Coins } from "lucide-react";
import { setCreditLimit } from "@/lib/actions/users";
import { setPartnerPrices } from "@/lib/actions/partner-pricing";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";

export type PartnerProductDTO = { id: string; name: string; price: number };

/**
 * Finance's partner controls — strictly financial: credit limit and agreed
 * pricing. No profile editing, password resets or account suspension (those
 * are admin/user-management powers).
 */
export function PartnerFinanceControls({
  partnerId,
  partnerName,
  creditLimit,
  products,
  prices,
}: {
  partnerId: string;
  partnerName: string;
  creditLimit: number;
  products: PartnerProductDTO[];
  prices: Record<string, number>; // productId → agreed price
}) {
  const [modal, setModal] = useState<"limit" | "prices" | null>(null);
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Button size="sm" variant="ghost" onClick={() => setModal("limit")}>
        <CreditCard className="size-3.5" /> Limit
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setModal("prices")}>
        <Coins className="size-3.5" /> Prices
      </Button>
      {modal === "limit" && (
        <LimitModal
          partnerId={partnerId}
          partnerName={partnerName}
          current={creditLimit}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "prices" && (
        <PricesModal
          partnerId={partnerId}
          partnerName={partnerName}
          products={products}
          prices={prices}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function LimitModal({
  partnerId,
  partnerName,
  current,
  onClose,
}: {
  partnerId: string;
  partnerName: string;
  current: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(String(current));

  function submit() {
    const creditLimit = Math.max(0, Math.round(Number(value) || 0));
    start(async () => {
      const res = await setCreditLimit({ userId: partnerId, creditLimit });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onClose();
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Credit limit · ${partnerName}`}
      description="Setting the limit to 0 suspends new credit — repayments keep restoring availability up to this ceiling."
    >
      <div className="space-y-4">
        <div>
          <Label>Credit limit (TSh)</Label>
          <Input
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Current: {formatCurrency(current)}
          </p>
        </div>
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save credit limit"}
        </Button>
      </div>
    </Modal>
  );
}

function PricesModal({
  partnerId,
  partnerName,
  products,
  prices,
  onClose,
}: {
  partnerId: string;
  partnerName: string;
  products: PartnerProductDTO[];
  prices: Record<string, number>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      products.map((p) => [p.id, String(prices[p.id] ?? p.price)]),
    ),
  );

  function submit() {
    start(async () => {
      const res = await setPartnerPrices({
        partnerId,
        prices: products.map((p) => ({
          productId: p.id,
          price: Math.max(0, Math.round(Number(values[p.id]) || 0)),
        })),
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        onClose();
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Agreed prices · ${partnerName}`}
      description="Per-product commercial terms — used automatically on every order this partner places."
    >
      <div className="space-y-3">
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                standard {formatCurrency(p.price)}
              </p>
            </div>
            <Input
              type="number"
              min={0}
              value={values[p.id] ?? ""}
              onChange={(e) =>
                setValues((s) => ({ ...s, [p.id]: e.target.value }))
              }
              className="h-9 w-32 text-right"
            />
          </div>
        ))}
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save prices"}
        </Button>
      </div>
    </Modal>
  );
}
