"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MapPin,
  Search,
  Phone,
  Clock,
  Navigation,
  X,
  Pill,
  ShoppingBasket,
  Store,
  Stethoscope,
  GraduationCap,
  HeartHandshake,
  Package,
} from "lucide-react";
import { TZ_PATH, TZ_VIEW, projectTz, coordsFor, REGION_COORDS } from "@/lib/tz-map";
import { cn } from "@/lib/utils";

export type StockistDTO = {
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
};

export const STOCKIST_TYPES: {
  key: string;
  label: string;
  plural: string;
  icon: typeof Pill;
}[] = [
  { key: "PHARMACY", label: "Pharmacy", plural: "Pharmacies", icon: Pill },
  { key: "SUPERMARKET", label: "Supermarket", plural: "Supermarkets", icon: ShoppingBasket },
  { key: "SHOP", label: "Shop", plural: "Shops", icon: Store },
  { key: "CLINIC", label: "Clinic", plural: "Clinics", icon: Stethoscope },
  { key: "SCHOOL", label: "School", plural: "Schools", icon: GraduationCap },
  { key: "NGO", label: "NGO point", plural: "NGO points", icon: HeartHandshake },
  { key: "OTHER", label: "Outlet", plural: "Other outlets", icon: Package },
];
const typeMeta = (key: string) =>
  STOCKIST_TYPES.find((t) => t.key === key) ?? STOCKIST_TYPES[6];

function directionsUrl(s: StockistDTO) {
  if (s.lat != null && s.lng != null)
    return `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;
  const q = encodeURIComponent(
    [s.name, s.address, s.district, s.region, "Tanzania"].filter(Boolean).join(", "),
  );
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

type Group = {
  key: string;
  region: string;
  district: string;
  x: number;
  y: number;
  items: StockistDTO[];
};

export function CoverageMap({ stockists }: { stockists: StockistDTO[] }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Group | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stockists.filter((s) => {
      if (typeFilter && s.type !== typeFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q) ||
        s.district.toLowerCase().includes(q)
      );
    });
  }, [stockists, query, typeFilter]);

  // Group by district → one glowing marker per place, count badge when many.
  // Every stockist ALWAYS lands in its group; the group anchors at the best
  // available point (any member's pin → district → region → country centre),
  // so nothing silently vanishes from the map.
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, { region: string; district: string; items: StockistDTO[] }>();
    for (const s of filtered) {
      const key = `${s.region}·${s.district}`.toLowerCase();
      const g = map.get(key);
      if (g) g.items.push(s);
      else map.set(key, { region: s.region, district: s.district, items: [s] });
    }
    const out: Group[] = [...map.entries()].map(([key, g]) => {
      let coords: [number, number] | null = null;
      for (const s of g.items) {
        coords = coordsFor(s.lat, s.lng, s.district, s.region);
        if (coords) break;
      }
      // Country centre — keeps an unrecognised place visible and clickable.
      const [lat, lng] = coords ?? [-6.3, 35.0];
      const { x, y } = projectTz(lat, lng);
      return { key, region: g.region, district: g.district, x, y, items: g.items };
    });
    // Spread groups that landed on the same point (region/centre fallback),
    // clamped inside the viewBox so no marker is ever clipped away.
    const seen = new Map<string, number>();
    for (const g of out) {
      const k = `${Math.round(g.x)},${Math.round(g.y)}`;
      const n = seen.get(k) ?? 0;
      seen.set(k, n + 1);
      if (n > 0) {
        const angle = n * 2.1;
        const r = 9 + 4 * Math.min(3, Math.floor((n - 1) / 3));
        g.x += Math.cos(angle) * r;
        g.y += Math.sin(angle) * r;
      }
      g.x = Math.min(TZ_VIEW.w - 14, Math.max(14, g.x));
      g.y = Math.min(TZ_VIEW.h - 14, Math.max(14, g.y));
    }
    return out;
  }, [filtered]);

  // Network lines: hub = Dar es Salaam → each covered region's anchor point.
  const network = useMemo(() => {
    const hub = projectTz(...(REGION_COORDS["dar es salaam"] as [number, number]));
    const regions = new Map<string, { x: number; y: number }>();
    for (const g of groups) {
      const key = g.region.toLowerCase();
      if (!regions.has(key)) {
        const rc = REGION_COORDS[key];
        regions.set(key, rc ? projectTz(rc[0], rc[1]) : { x: g.x, y: g.y });
      }
    }
    return [...regions.entries()]
      .filter(([k]) => k !== "dar es salaam")
      .map(([k, p]) => ({ key: k, x1: hub.x, y1: hub.y, x2: p.x, y2: p.y }));
  }, [groups]);

  // Gentle zoom towards the selected place. transform-origin is transitioned
  // too, so switching between markers glides instead of snapping.
  const zoomStyle = useMemo(() => {
    const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
    const base = {
      transition: `transform 0.7s ${ease}, transform-origin 0.7s ${ease}`,
    };
    if (!selected) return { ...base, transform: "scale(1)", transformOrigin: "50% 50%" };
    const ox = (selected.x / TZ_VIEW.w) * 100;
    const oy = (selected.y / TZ_VIEW.h) * 100;
    return { ...base, transform: "scale(1.9)", transformOrigin: `${ox}% ${oy}%` };
  }, [selected]);

  const select = (g: Group | null) => setSelected(g);

  return (
    <div className="space-y-5">
      {/* Search + filters */}
      <div className="flex flex-col gap-3">
        <div className="relative mx-auto w-full max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            placeholder="Search region, district or store…"
            className="h-11 w-full rounded-full border border-border bg-card/60 pl-10 pr-4 text-base outline-none backdrop-blur transition-colors placeholder:text-muted-foreground focus:border-primary/60 sm:text-sm"
          />
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {STOCKIST_TYPES.filter(
            (t) => t.key !== "OTHER" || stockists.some((s) => s.type === "OTHER"),
          ).map((t) => {
            const active = typeFilter === t.key;
            const count = stockists.filter((s) => s.type === t.key).length;
            if (count === 0) return null;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTypeFilter(active ? null : t.key);
                  setSelected(null);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                  active
                    ? "border-primary bg-primary/12 text-primary ring-1 ring-primary/40"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                <t.icon className="size-3.5" />
                {t.plural}
                <span className={cn("text-[10px]", active ? "text-primary/80" : "text-muted-foreground/70")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-to-b from-card/60 to-card/20 shadow-soft backdrop-blur-xl"
      >
        <div className="motion-reduce:!transition-none" style={zoomStyle}>
          <svg
            viewBox={`0 0 ${TZ_VIEW.w} ${TZ_VIEW.h}`}
            className="block h-auto w-full"
            aria-label="Map of Tanzania showing where ORA products are available"
            onClick={() => select(null)}
          >
            <defs>
              <linearGradient id="tzFill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.16" />
                <stop offset="55%" stopColor="hsl(var(--accent))" stopOpacity="0.10" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
              </linearGradient>
              <radialGradient id="dotGlow">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </radialGradient>
              <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="6" stdDeviation="12" floodColor="hsl(var(--primary))" floodOpacity="0.18" />
              </filter>
            </defs>

            {/* Country */}
            <path
              d={TZ_PATH}
              fill="url(#tzFill)"
              stroke="hsl(var(--primary))"
              strokeOpacity="0.45"
              strokeWidth="1.4"
              filter="url(#soft)"
            />

            {/* Distribution network */}
            <g>
              {network.map((l) => (
                <line
                  key={l.key}
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke="hsl(var(--accent))"
                  strokeOpacity="0.35"
                  strokeWidth="1.1"
                  strokeDasharray="3 7"
                  className="tz-flow"
                />
              ))}
            </g>

            {/* Markers */}
            {groups.map((g) => {
              const isSel = selected?.key === g.key;
              return (
                <g
                  key={g.key}
                  transform={`translate(${g.x}, ${g.y})`}
                  className="cursor-pointer outline-none"
                  role="button"
                  tabIndex={0}
                  aria-label={`${g.district}, ${g.region} — ${g.items.length} outlet${g.items.length === 1 ? "" : "s"}`}
                  aria-pressed={isSel}
                  onClick={(e) => {
                    e.stopPropagation();
                    select(isSel ? null : g);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      select(isSel ? null : g);
                    }
                  }}
                >
                  <circle r="16" fill="url(#dotGlow)" opacity={isSel ? 0.9 : 0.55} />
                  <circle r="9" fill="hsl(var(--primary))" opacity="0.25" className="tz-pulse" />
                  <circle
                    r={isSel ? 5.5 : 4}
                    fill="hsl(var(--primary))"
                    stroke="white"
                    strokeWidth="1.4"
                    className="transition-all"
                  />
                  {g.items.length > 1 && (
                    <>
                      <circle cx="9" cy="-9" r="7" fill="hsl(var(--accent))" />
                      <text
                        x="9"
                        y="-9"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="8.5"
                        fontWeight="700"
                        fill="white"
                      >
                        {g.items.length}
                      </text>
                    </>
                  )}
                  {/* Invisible larger hit area — stays ≥ 24px even at 320px wide */}
                  <circle r="30" fill="transparent" />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Empty / no-results state */}
        {groups.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-full border border-border bg-card/80 px-4 py-2 text-sm text-muted-foreground backdrop-blur">
              {stockists.length === 0
                ? "First outlets coming online — check back soon."
                : "No outlets match your search."}
            </p>
          </div>
        )}

        {/* Desktop info card */}
        <AnimatePresence>
          {selected && (
            <motion.div
              key={selected.key}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-3 bottom-3 z-10 max-h-[58%] overflow-y-auto rounded-3xl border border-border bg-card/95 p-4 shadow-glow backdrop-blur-xl sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-auto sm:max-h-[85%] sm:w-80"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                    <MapPin className="size-3.5" />
                    {selected.district}
                  </p>
                  <p className="text-xs text-muted-foreground">{selected.region} region</p>
                </div>
                <button
                  type="button"
                  onClick={() => select(null)}
                  aria-label="Close"
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {selected.items.map((s) => {
                  const meta = typeMeta(s.type);
                  return (
                    <div key={s.id} className="rounded-2xl border border-border/60 p-3">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white">
                          <meta.icon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-tight">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{meta.label}</p>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {s.address && <p className="break-words">{s.address}</p>}
                        {s.products && (
                          <p className="text-foreground/80">
                            <span className="text-muted-foreground">Stocked: </span>
                            {s.products}
                          </p>
                        )}
                        {s.phone && (
                          <p className="flex items-center gap-1.5">
                            <Phone className="size-3" /> {s.phone}
                          </p>
                        )}
                        {s.hours && (
                          <p className="flex items-center gap-1.5">
                            <Clock className="size-3" /> {s.hours}
                          </p>
                        )}
                      </div>
                      <a
                        href={directionsUrl(s)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-3.5 py-1.5 text-xs font-semibold text-white shadow-glow transition-transform hover:scale-[1.03]"
                      >
                        <Navigation className="size-3.5" />
                        Get directions
                      </a>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
        Tap a glowing point to see the outlets there
      </p>

    </div>
  );
}
