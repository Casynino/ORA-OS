"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Eye, EyeOff, MapPin, Search } from "lucide-react";
import {
  createStockist,
  updateStockist,
  toggleStockist,
  deleteStockist,
} from "@/lib/actions/stockists";
import { STOCKIST_TYPES } from "@/components/public/coverage-map";
import { coordsFor } from "@/lib/tz-map";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export type StockistRow = {
  id: string;
  name: string;
  type: string;
  region: string;
  district: string;
  address: string | null;
  phone: string | null;
  hours: string | null;
  products: string | null;
  lat: number | null;
  lng: number | null;
  isActive: boolean;
};

const empty = {
  name: "",
  type: "PHARMACY",
  region: "",
  district: "",
  address: "",
  phone: "",
  hours: "",
  products: "",
  lat: "",
  lng: "",
};

function Editor({
  initial,
  id,
  regions,
  onClose,
}: {
  initial: typeof empty;
  id?: string;
  regions: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  function submit() {
    const hasLat = f.lat.trim() !== "";
    const hasLng = f.lng.trim() !== "";
    if (hasLat !== hasLng) {
      toast({
        variant: "error",
        title: "Enter both latitude and longitude, or leave both empty.",
      });
      return;
    }
    const payload = {
      name: f.name,
      type: f.type as never,
      region: f.region,
      district: f.district,
      address: f.address,
      phone: f.phone,
      hours: f.hours,
      products: f.products,
      lat: hasLat ? Number(f.lat) : null,
      lng: hasLng ? Number(f.lng) : null,
    };
    start(async () => {
      const res = id ? await updateStockist(id, payload) : await createStockist(payload);
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
      title={id ? "Edit stockist" : "Add stockist"}
      description="Saved changes appear on the public Find ORA map immediately."
    >
      <div className="space-y-3.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div>
            <Label>Store name</Label>
            <Input value={f.name} onChange={set("name")} className="mt-1.5" placeholder="e.g. Afya Pharmacy" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={f.type} onChange={set("type")} className="mt-1.5">
              {STOCKIST_TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Region</Label>
            <Input value={f.region} onChange={set("region")} className="mt-1.5" placeholder="e.g. Dar es Salaam" list="tz-regions" />
            <datalist id="tz-regions">
              {regions.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
          <div>
            <Label>District</Label>
            <Input value={f.district} onChange={set("district")} className="mt-1.5" placeholder="e.g. Kinondoni" />
          </div>
        </div>
        <div>
          <Label>Address (optional)</Label>
          <Input value={f.address} onChange={set("address")} className="mt-1.5" placeholder="Street / landmark" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Phone (optional)</Label>
            <Input value={f.phone} onChange={set("phone")} className="mt-1.5" placeholder="+255 …" />
          </div>
          <div>
            <Label>Opening hours (optional)</Label>
            <Input value={f.hours} onChange={set("hours")} className="mt-1.5" placeholder="Mon–Sat 8:00–20:00" />
          </div>
        </div>
        <div>
          <Label>ORA products available (optional)</Label>
          <Input value={f.products} onChange={set("products")} className="mt-1.5" placeholder="Night 360 · Day 290 · Liners" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Latitude (optional)</Label>
            <Input type="number" step="0.0001" min={-11.85} max={-0.85} value={f.lat} onChange={set("lat")} className="mt-1.5" placeholder="-6.8160" />
          </div>
          <div>
            <Label>Longitude (optional)</Label>
            <Input type="number" step="0.0001" min={29.2} max={40.6} value={f.lng} onChange={set("lng")} className="mt-1.5" placeholder="39.2800" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          No coordinates? The map pins it automatically from the district or region.
        </p>
        <Button
          className="w-full rounded-full"
          disabled={pending || f.name.trim().length < 2 || f.region.trim().length < 2 || f.district.trim().length < 2}
          onClick={submit}
        >
          {pending ? "Saving…" : id ? "Save changes" : "Add to the map"}
        </Button>
      </div>
    </Modal>
  );
}

export function StockistsManager({ rows }: { rows: StockistRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<StockistRow | null>(null);
  const [adding, setAdding] = useState(false);

  const regions = useMemo(
    () => [...new Set(rows.map((r) => r.region))].sort(),
    [rows],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.district.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const act = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast({ variant: "success", title: res.message });
      else toast({ variant: "error", title: res.error });
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stockists…"
            className="pl-9"
          />
        </div>
        <Button size="sm" className="rounded-full" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          Add stockist
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? "No stockists yet — add the first outlet and it appears on the public map instantly."
            : "No stockists match your search."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const meta = STOCKIST_TYPES.find((t) => t.key === r.type) ?? STOCKIST_TYPES[6];
            const located = coordsFor(r.lat, r.lng, r.district, r.region) != null;
            return (
              <div
                key={r.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-4",
                  r.isActive ? "border-border" : "border-border/60 opacity-60",
                )}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white">
                    <meta.icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{r.name}</p>
                      <Badge variant="secondary">{meta.label}</Badge>
                      {!r.isActive && <Badge variant="outline">Hidden</Badge>}
                      {!located && (
                        <Badge variant="warning">
                          Approximate pin — add coordinates or a known region
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">
                        {r.district}, {r.region}
                        {r.address ? ` · ${r.address}` : ""}
                        {r.products ? ` · ${r.products}` : ""}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-muted-foreground hover:text-foreground"
                    disabled={pending}
                    onClick={() => act(() => toggleStockist(r.id, !r.isActive))}
                    title={r.isActive ? "Hide from public map" : "Show on public map"}
                  >
                    {r.isActive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-muted-foreground hover:text-foreground"
                    onClick={() => setEditing(r)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-muted-foreground hover:text-destructive"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(`Remove ${r.name} from the map?`))
                        act(() => deleteStockist(r.id));
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <Editor initial={empty} regions={regions} onClose={() => setAdding(false)} />
      )}
      {editing && (
        <Editor
          id={editing.id}
          regions={regions}
          initial={{
            name: editing.name,
            type: editing.type,
            region: editing.region,
            district: editing.district,
            address: editing.address ?? "",
            phone: editing.phone ?? "",
            hours: editing.hours ?? "",
            products: editing.products ?? "",
            lat: editing.lat != null ? String(editing.lat) : "",
            lng: editing.lng != null ? String(editing.lng) : "",
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
