"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
const telHref = (phone: string) => `tel:${phone.split("/")[0].replace(/[^+\d]/g, "")}`;

type RegionGroup = {
  key: string; // lowercased region
  region: string;
  x: number;
  y: number;
  items: StockistDTO[];
  districts: { district: string; items: StockistDTO[] }[];
};

type FanPin = { s: StockistDTO; x: number; y: number };

const CENTER = { x: TZ_VIEW.w * 0.48, y: TZ_VIEW.h * 0.5 };
const clampX = (v: number) => Math.min(TZ_VIEW.w - 14, Math.max(14, v));
const clampY = (v: number) => Math.min(TZ_VIEW.h - 14, Math.max(14, v));

/** Fan a region's outlets into rings around its anchor, opening towards the
 *  middle of the country so coastal cities never spill into the ocean. */
function fanOut(group: RegionGroup): FanPin[] {
  const { x, y, items } = group;
  const toCenter = Math.atan2(CENTER.y - y, CENTER.x - x);
  const pins: FanPin[] = [];
  let i = 0;
  let ring = 0;
  while (i < items.length) {
    const capacity = ring === 0 ? Math.min(9, items.length) : 12;
    const radius = 42 + ring * 34;
    const arc = ring === 0 ? Math.PI * 1.25 : Math.PI * 1.6;
    const slice = items.slice(i, i + capacity);
    slice.forEach((s, j) => {
      const t = slice.length === 1 ? 0.5 : j / (slice.length - 1);
      const angle = toCenter - arc / 2 + t * arc;
      pins.push({
        s,
        x: clampX(x + Math.cos(angle) * radius),
        y: clampY(y + Math.sin(angle) * radius),
      });
    });
    i += capacity;
    ring++;
  }
  return pins;
}

export function CoverageMap({ stockists }: { stockists: StockistDTO[] }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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

  // One marker per REGION — dense cities stay readable at national zoom.
  const regions = useMemo<RegionGroup[]>(() => {
    const map = new Map<string, RegionGroup>();
    for (const s of filtered) {
      const key = s.region.trim().toLowerCase();
      let g = map.get(key);
      if (!g) {
        const rc = REGION_COORDS[key];
        const coords = rc ?? coordsFor(s.lat, s.lng, s.district, s.region) ?? [-6.3, 35.0];
        const { x, y } = projectTz(coords[0], coords[1]);
        g = { key, region: s.region, x: clampX(x), y: clampY(y), items: [], districts: [] };
        map.set(key, g);
      }
      g.items.push(s);
    }
    const out = [...map.values()];
    // Spread identical anchors (unknown regions falling to country centre).
    const seen = new Map<string, number>();
    for (const g of out) {
      const k = `${Math.round(g.x)},${Math.round(g.y)}`;
      const n = seen.get(k) ?? 0;
      seen.set(k, n + 1);
      if (n > 0) {
        g.x = clampX(g.x + Math.cos(n * 2.1) * 16);
        g.y = clampY(g.y + Math.sin(n * 2.1) * 16);
      }
      // District sub-groups, largest first.
      const dmap = new Map<string, StockistDTO[]>();
      for (const s of g.items) {
        const dk = s.district.trim();
        dmap.set(dk, [...(dmap.get(dk) ?? []), s]);
      }
      g.districts = [...dmap.entries()]
        .map(([district, items]) => ({ district, items }))
        .sort((a, b) => b.items.length - a.items.length);
    }
    return out.sort((a, b) => b.items.length - a.items.length);
  }, [filtered]);

  const selected = regions.find((r) => r.key === selectedKey) ?? null;
  const fan = useMemo(() => (selected ? fanOut(selected) : []), [selected]);

  // Distribution network between covered regions (hub = biggest region).
  const network = useMemo(() => {
    if (regions.length < 2) return [];
    const hub = regions[0];
    return regions.slice(1).map((r) => ({
      key: r.key,
      x1: hub.x,
      y1: hub.y,
      x2: r.x,
      y2: r.y,
    }));
  }, [regions]);

  // Pan + zoom applied inside the SVG: the selected region glides to the
  // area NOT covered by the info panel (left of it on desktop, above the
  // bottom sheet on mobile), so the fanned-out pins are always in view.
  const viewTransform = useMemo(() => {
    const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
    const base: React.CSSProperties = {
      transition: `transform 0.85s ${ease}`,
      transformOrigin: "0px 0px",
    };
    if (!selected) return { ...base, transform: "translate(0px, 0px) scale(1)" };
    const s = selected.items.length > 6 ? 2.3 : 1.9;
    const target = isMobile
      ? { x: TZ_VIEW.w * 0.5, y: TZ_VIEW.h * 0.22 }
      : { x: TZ_VIEW.w * 0.34, y: TZ_VIEW.h * 0.48 };
    const tx = target.x - s * selected.x;
    const ty = target.y - s * selected.y;
    return { ...base, transform: `translate(${tx}px, ${ty}px) scale(${s})` };
  }, [selected, isMobile]);

  function selectRegion(key: string | null) {
    setSelectedKey(key);
    setFocusId(null);
  }
  function focusOutlet(id: string) {
    setFocusId(id);
    const el = cardRefs.current[id];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

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
              selectRegion(null);
            }}
            placeholder="Search region, district or store…"
            className="h-11 w-full rounded-full border border-border bg-card/60 pl-10 pr-4 text-base outline-none backdrop-blur transition-colors placeholder:text-muted-foreground focus:border-primary/60 sm:text-sm"
          />
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {STOCKIST_TYPES.map((t) => {
            const count = stockists.filter((s) => s.type === t.key).length;
            if (count === 0) return null;
            const active = typeFilter === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTypeFilter(active ? null : t.key);
                  selectRegion(null);
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
      <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-to-b from-card/60 to-card/20 shadow-soft backdrop-blur-xl">
        <svg
          viewBox={`0 0 ${TZ_VIEW.w} ${TZ_VIEW.h}`}
          className="block h-auto w-full"
          aria-label="Map of Tanzania showing where ORA products are available"
          onClick={() => selectRegion(null)}
        >
          <g className="motion-reduce:!transition-none" style={viewTransform}>
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

            <path
              d={TZ_PATH}
              fill="url(#tzFill)"
              stroke="hsl(var(--primary))"
              strokeOpacity="0.45"
              strokeWidth="1.4"
              filter="url(#soft)"
            />

            {/* Distribution network */}
            {!selected && (
              <g>
                {network.map((l) => (
                  <line
                    key={l.key}
                    x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                    stroke="hsl(var(--accent))"
                    strokeOpacity="0.35"
                    strokeWidth="1.1"
                    strokeDasharray="3 7"
                    className="tz-flow"
                  />
                ))}
              </g>
            )}

            {/* Region markers */}
            {regions.map((g) => {
              const isSel = selected?.key === g.key;
              const dim = selected && !isSel;
              return (
                <g
                  key={g.key}
                  transform={`translate(${g.x}, ${g.y})`}
                  className={cn("cursor-pointer outline-none transition-opacity", dim && "opacity-30")}
                  role="button"
                  tabIndex={0}
                  aria-label={`${g.region} — ${g.items.length} outlet${g.items.length === 1 ? "" : "s"}`}
                  aria-pressed={isSel}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectRegion(isSel ? null : g.key);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectRegion(isSel ? null : g.key);
                    }
                  }}
                >
                  <circle r="18" fill="url(#dotGlow)" opacity={isSel ? 0.9 : 0.6} />
                  {!isSel && (
                    <circle r="10" fill="hsl(var(--primary))" opacity="0.25" className="tz-pulse" />
                  )}
                  <circle
                    r={isSel ? 4 : 5.5}
                    fill="hsl(var(--primary))"
                    stroke="white"
                    strokeWidth="1.5"
                    className="transition-all"
                  />
                  {!isSel && (
                    <>
                      <circle cx="11" cy="-11" r="8" fill="hsl(var(--accent))" />
                      <text
                        x="11" y="-11"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="9"
                        fontWeight="700"
                        fill="white"
                      >
                        {g.items.length}
                      </text>
                    </>
                  )}
                  <circle r="30" fill="transparent" />
                </g>
              );
            })}

            {/* Fanned-out outlets of the selected region */}
            {selected && (
              <g>
                {fan.map((p, i) => {
                  const isFocus = focusId === p.s.id;
                  return (
                    <g key={p.s.id}>
                      <line
                        x1={selected.x} y1={selected.y} x2={p.x} y2={p.y}
                        stroke="hsl(var(--primary))"
                        strokeOpacity="0.22"
                        strokeWidth="0.8"
                      />
                      <g
                        transform={`translate(${p.x}, ${p.y})`}
                        className="cursor-pointer outline-none tz-bloom"
                        style={{ animationDelay: `${i * 35}ms` }}
                        role="button"
                        tabIndex={0}
                        aria-label={p.s.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          focusOutlet(p.s.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            focusOutlet(p.s.id);
                          }
                        }}
                      >
                        <circle r="11" fill="url(#dotGlow)" opacity={isFocus ? 1 : 0.5} />
                        <circle
                          r={isFocus ? 4.5 : 3.4}
                          fill={isFocus ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                          stroke="white"
                          strokeWidth="1.1"
                          className="transition-all"
                        />
                        <circle r="14" fill="transparent" />
                      </g>
                    </g>
                  );
                })}
              </g>
            )}
          </g>
        </svg>

        {/* Empty / no-results state */}
        {regions.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-full border border-border bg-card/80 px-4 py-2 text-sm text-muted-foreground backdrop-blur">
              {stockists.length === 0
                ? "First outlets coming online — check back soon."
                : "No outlets match your search."}
            </p>
          </div>
        )}

        {/* Region panel */}
        <AnimatePresence>
          {selected && (
            <motion.div
              key={selected.key}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-3 bottom-3 z-10 max-h-[58%] overflow-y-auto scrollbar-thin rounded-3xl border border-border bg-card/95 p-4 shadow-glow backdrop-blur-xl sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-auto sm:max-h-[88%] sm:w-80"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                    <MapPin className="size-3.5" />
                    {selected.region}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selected.items.length} outlet{selected.items.length === 1 ? "" : "s"} · tap a pin or scroll
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => selectRegion(null)}
                  aria-label="Close"
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-3 space-y-4">
                {selected.districts.map((d) => (
                  <div key={d.district}>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {d.district}
                    </p>
                    <div className="space-y-2">
                      {d.items.map((s) => (
                        <OutletCard
                          key={s.id}
                          s={s}
                          compact
                          highlighted={focusId === s.id}
                          refCb={(el) => {
                            cardRefs.current[s.id] = el;
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
        Tap a region to see every outlet fan out
      </p>

      {/* ── Outlet directory — every shop, always visible ── */}
      <div className="pt-8">
        {regions.map((g) => (
          <section key={g.key} className="mb-10 last:mb-0">
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
                {g.region}
              </h3>
              <span className="text-sm text-muted-foreground">
                {g.items.length} outlet{g.items.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="space-y-5">
              {g.districts.map((d) => (
                <div key={d.district}>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                    <MapPin className="size-3.5" />
                    {d.district}
                  </p>
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {d.items.map((s) => (
                      <OutletCard key={s.id} s={s} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function OutletCard({
  s,
  compact,
  highlighted,
  refCb,
}: {
  s: StockistDTO;
  compact?: boolean;
  highlighted?: boolean;
  refCb?: (el: HTMLDivElement | null) => void;
}) {
  const meta = typeMeta(s.type);
  return (
    <div
      ref={refCb}
      className={cn(
        "rounded-2xl border bg-card/60 p-3.5 transition-all",
        highlighted
          ? "border-primary ring-1 ring-primary/50 shadow-glow"
          : "border-border/60",
        !compact && "glow-hover backdrop-blur",
      )}
    >
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
        {s.hours && (
          <p className="flex items-center gap-1.5">
            <Clock className="size-3 shrink-0" /> {s.hours}
          </p>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <a
          href={directionsUrl(s)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-3.5 py-1.5 text-xs font-semibold text-white shadow-glow transition-transform hover:scale-[1.03]"
        >
          <Navigation className="size-3.5" />
          Directions
        </a>
        {s.phone && (
          <a
            href={telHref(s.phone)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Phone className="size-3" />
            {s.phone}
          </a>
        )}
      </div>
    </div>
  );
}
