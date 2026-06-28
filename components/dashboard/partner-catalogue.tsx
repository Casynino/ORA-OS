"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Search,
  Minus,
  Plus,
  Send,
  Star,
  History,
  Info,
  AlertTriangle,
  Layers,
  Package,
  Truck,
  ShieldCheck,
  Check,
  X,
} from "lucide-react";
import { createRequest } from "@/lib/actions/requests";
import { toast } from "@/components/ui/use-toast";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

export type CatalogProduct = {
  id: string;
  sku: string;
  name: string;
  description: string;
  unitLabel: string;
  image: string;
  size: string;
  color: string;
  use: string;
  accent: string;
  price: number;
  available: number;
  reserved: number;
  status: "IN" | "LIMITED" | "OUT";
  features: string[];
  packsPerCarton: number;
  moq: number;
  leadTime: string;
  padsPerPack: number;
  length: string;
  topSheet: string;
  bestFor: string;
  recent: boolean;
  bestSeller: boolean;
};

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "NIGHT", label: "Night" },
  { key: "DAY", label: "Day" },
  { key: "LINER", label: "Liners" },
  { key: "INSTOCK", label: "In stock" },
  { key: "LOW", label: "Low stock" },
] as const;

const STATUS = {
  IN: { label: "In stock", variant: "success" as const },
  LIMITED: { label: "Limited", variant: "warning" as const },
  OUT: { label: "Out of stock", variant: "destructive" as const },
};

export function PartnerCatalogue({
  products,
  warehouse,
}: {
  products: CatalogProduct[];
  warehouse: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("ALL");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState<"IMMEDIATE" | "CREDIT">("IMMEDIATE");
  const [detail, setDetail] = useState<CatalogProduct | null>(null);

  const setQ = (id: string, v: number) =>
    setQty((p) => ({ ...p, [id]: Math.max(0, Math.min(v, 100000)) }));

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((p) => {
      if (filter === "NIGHT" && !/night/i.test(p.use)) return false;
      if (filter === "DAY" && !/day/i.test(p.use)) return false;
      if (filter === "LINER" && !/liner|daily/i.test(p.use)) return false;
      if (filter === "INSTOCK" && p.status === "OUT") return false;
      if (filter === "LOW" && p.status !== "LIMITED") return false;
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        p.color.toLowerCase().includes(term) ||
        p.size.toLowerCase().includes(term) ||
        p.use.toLowerCase().includes(term)
      );
    });
  }, [products, query, filter]);

  const selected = products.filter((p) => (qty[p.id] ?? 0) > 0);
  const totalUnits = selected.reduce((s, p) => s + (qty[p.id] ?? 0), 0);
  const totalValue = selected.reduce((s, p) => s + (qty[p.id] ?? 0) * p.price, 0);

  function submit() {
    if (selected.length === 0) return;
    start(async () => {
      const res = await createRequest({
        items: selected.map((p) => ({ productId: p.id, quantity: qty[p.id] })),
        paymentType: payment,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        // Land on the order's confirmation page (with payment instructions).
        router.push(
          res.data ? `/partner/requests/${res.data.id}` : "/partner/requests",
        );
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <div className="pb-28">
      {/* Search + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, size, colour, use…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => {
          const q = qty[p.id] ?? 0;
          const st = STATUS[p.status];
          return (
            <div
              key={p.id}
              className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:shadow-glow"
            >
              <button
                type="button"
                onClick={() => setDetail(p)}
                className="relative aspect-[4/3] overflow-hidden text-left"
                style={{ background: `${p.accent}12` }}
              >
                <Image
                  src={p.image}
                  alt={p.name}
                  fill
                  sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                  <Badge variant={st.variant}>{st.label}</Badge>
                  {p.bestSeller && (
                    <Badge variant="accent" className="gap-1">
                      <Star className="size-3" />
                      Best seller
                    </Badge>
                  )}
                  {p.recent && !p.bestSeller && (
                    <Badge variant="secondary" className="gap-1">
                      <History className="size-3" />
                      Ordered before
                    </Badge>
                  )}
                </div>
                <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                  Details
                </span>
              </button>

              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                    style={{ background: p.accent }}
                  >
                    {p.size}
                  </span>
                  <h3 className="font-display text-lg font-bold">{p.color}</h3>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.use}</p>
                <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">
                  {p.description}
                </p>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-success" />
                    {formatNumber(p.available)} available
                  </span>
                  {p.status === "LIMITED" && (
                    <span className="inline-flex items-center gap-1 text-warning">
                      <AlertTriangle className="size-3" />
                      Low
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Your price
                    </p>
                    <p className="font-display text-xl font-bold text-primary">
                      {formatCurrency(p.price)}
                    </p>
                  </div>
                  {q > 0 && (
                    <p className="text-sm font-medium">
                      = {formatCurrency(q * p.price)}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-9"
                    onClick={() => setQ(p.id, q - 1)}
                    disabled={q <= 0 || p.status === "OUT"}
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    value={q}
                    onChange={(e) => setQ(p.id, Number(e.target.value))}
                    disabled={p.status === "OUT"}
                    className="h-9 flex-1 text-center font-semibold"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-9"
                    onClick={() => setQ(p.id, q > 0 ? q + 1 : p.moq)}
                    disabled={p.status === "OUT"}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            No products match your search.
          </p>
        )}
      </div>

      {/* Sticky request bar */}
      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:left-64">
          <div className="container flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  {selected.length} product{selected.length === 1 ? "" : "s"} ·{" "}
                  {formatNumber(totalUnits)} units
                </p>
                <p className="font-display text-lg font-bold text-primary">
                  {formatCurrency(totalValue)}
                </p>
              </div>
              <div className="hidden items-center rounded-lg bg-muted p-1 sm:flex">
                {(["IMMEDIATE", "CREDIT"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setPayment(t)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                      payment === t ? "bg-card shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {t === "IMMEDIATE" ? "Cash" : "Credit"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setQty({})}
                className="text-muted-foreground"
              >
                Clear
              </Button>
              <Button onClick={submit} disabled={pending}>
                <Send className="size-4" />
                {pending ? "Submitting…" : "Submit request"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <Modal open onClose={() => setDetail(null)} title={`${detail.size} ${detail.color}`}>
          <div className="space-y-4">
            <div
              className="relative aspect-[16/10] overflow-hidden rounded-2xl"
              style={{ background: `${detail.accent}12` }}
            >
              <Image
                src={detail.image}
                alt={detail.name}
                fill
                sizes="500px"
                className="object-cover"
              />
              <Badge
                variant={STATUS[detail.status].variant}
                className="absolute left-3 top-3"
              >
                {STATUS[detail.status].label}
              </Badge>
            </div>

            <div>
              <h3 className="font-display text-lg font-bold">{detail.name}</h3>
              <p className="text-sm text-muted-foreground">{detail.description}</p>
            </div>

            {detail.features.length > 0 && (
              <ul className="grid grid-cols-2 gap-2 text-sm">
                {detail.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="size-3.5 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-4 text-sm">
              <Spec icon={Package} label="Packs / carton" value={`${detail.packsPerCarton}`} />
              <Spec icon={Layers} label="Min order" value={`${detail.moq} packs`} />
              <Spec icon={Truck} label="Lead time" value={detail.leadTime} />
              <Spec icon={ShieldCheck} label="From" value={warehouse} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Your price
                </p>
                <p className="font-display text-2xl font-bold text-primary">
                  {formatCurrency(detail.price)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="icon"
                  variant="outline"
                  className="size-9"
                  onClick={() => setQ(detail.id, (qty[detail.id] ?? 0) - 1)}
                  disabled={(qty[detail.id] ?? 0) <= 0}
                >
                  <Minus className="size-3.5" />
                </Button>
                <Input
                  type="number"
                  min={0}
                  value={qty[detail.id] ?? 0}
                  onChange={(e) => setQ(detail.id, Number(e.target.value))}
                  className="h-9 w-20 text-center font-semibold"
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="size-9"
                  onClick={() => setQ(detail.id, (qty[detail.id] ?? 0) + 1)}
                  disabled={detail.status === "OUT"}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </div>

            <p className="flex items-start gap-2 rounded-lg bg-info/10 p-3 text-xs text-info">
              <Info className="mt-0.5 size-4 shrink-0" />
              Add quantities, then submit your request from the bar below. The ORA
              team confirms final pricing &amp; delivery.
            </p>

            <Button className="w-full" onClick={() => setDetail(null)}>
              {(qty[detail.id] ?? 0) > 0 ? "Done" : "Close"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Spec({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
