"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
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
const outlets = (n: number) => `${n} outlet${n === 1 ? "" : "s"}`;

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

/*
 * Presentation (unslop pass, 2026-11-09): the map is a quiet line drawing — a flat tint of ORA magenta for the country,
 * one solid marker per region with its outlet count inside (bigger where there are more outlets), no glows, gradients
 * or looping pulses. The directory below is a hairline list grouped by region and district, not a wall of cards.
 * `intro` lets the page put its heading and figures beside the map on large screens.
 */
export function CoverageMap({
  stockists,
  intro,
}: {
  stockists: StockistDTO[];
  intro?: React.ReactNode;
}) {
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
    <div>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
        <div>
          {intro}

          {/* Search + filters */}
          <div className={cn("ora-rise ora-rise-4", intro && "mt-10")}>
            <div className="relative w-full max-w-md">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  selectRegion(null);
                }}
                placeholder="Search region, district or store…"
                aria-label="Search outlets by region, district or store"
                className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-base outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15 sm:text-[15px]"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {STOCKIST_TYPES.map((t) => {
                const count = stockists.filter((s) => s.type === t.key).length;
                if (count === 0) return null;
                const active = typeFilter === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setTypeFilter(active ? null : t.key);
                      selectRegion(null);
                    }}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                    )}
                  >
                    <t.icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    {t.plural}
                    <span className={cn("tabular-nums", active ? "text-primary-foreground/75" : "text-muted-foreground/70")}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-[13px] text-muted-foreground">Tap a region to see every outlet fan out</p>
          </div>
        </div>

        {/* Map */}
        <div className="ora-rise ora-rise-2 relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card lg:max-w-none">
          <svg
            viewBox={`0 0 ${TZ_VIEW.w} ${TZ_VIEW.h}`}
            className="block h-auto w-full"
            aria-label="Map of Tanzania showing where ORA products are available"
            onClick={() => selectRegion(null)}
          >
            <g className="motion-reduce:!transition-none" style={viewTransform}>
              <path
                d={TZ_PATH}
                fill="hsl(var(--primary))"
                fillOpacity="0.06"
                stroke="hsl(var(--primary))"
                strokeOpacity="0.4"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />

              {/* Distribution network */}
              {!selected && (
                <g>
                  {network.map((l) => (
                    <line
                      key={l.key}
                      x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                      stroke="hsl(var(--primary))"
                      strokeOpacity="0.2"
                      strokeWidth="1"
                      strokeDasharray="2 6"
                      strokeLinecap="round"
                    />
                  ))}
                </g>
              )}

              {/* Region markers */}
              {regions.map((g) => {
                const isSel = selected?.key === g.key;
                const dim = selected && !isSel;
                const r = isMobile
                  ? Math.min(21, 14 + Math.sqrt(g.items.length) * 1.5)
                  : Math.min(18, 10.5 + Math.sqrt(g.items.length) * 1.5);
                return (
                  <g
                    key={g.key}
                    transform={`translate(${g.x}, ${g.y})`}
                    className={cn("cursor-pointer outline-none transition-opacity duration-300", dim && "opacity-30")}
                    role="button"
                    tabIndex={0}
                    aria-label={`${g.region} — ${outlets(g.items.length)}`}
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
                    <title>{`${g.region} · ${outlets(g.items.length)}`}</title>
                    {isSel ? (
                      <>
                        <circle r="9" fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.45" strokeWidth="1" />
                        <circle r="4" fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth="1.5" />
                      </>
                    ) : (
                      <>
                        <circle r={r} fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth="2" />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={isMobile ? 14 : 11}
                          fontWeight="600"
                          fill="hsl(var(--primary-foreground))"
                          style={{ fontVariantNumeric: "tabular-nums" }}
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
                          <title>{p.s.name}</title>
                          {isFocus && (
                            <circle r="8.5" fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.5" strokeWidth="1" />
                          )}
                          <circle
                            r={isFocus ? 4.6 : 3.6}
                            fill="hsl(var(--primary))"
                            stroke="hsl(var(--card))"
                            strokeWidth="1.2"
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
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <p className="rounded-xl border border-border bg-card px-4 py-2.5 text-center text-sm text-muted-foreground">
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
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-x-3 bottom-3 z-10 max-h-[58%] overflow-y-auto scrollbar-thin rounded-2xl border border-border bg-card p-4 shadow-[0_12px_32px_-16px_rgba(13,0,22,0.35)] sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:max-h-[88%] sm:w-80 sm:p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold leading-tight tracking-[-0.01em]">{selected.region}</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {outlets(selected.items.length)} · tap a pin or scroll
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectRegion(null)}
                    aria-label="Close"
                    className="-mr-2 -mt-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-4" strokeWidth={1.5} />
                  </button>
                </div>

                <div className="mt-2">
                  {selected.districts.map((d) => (
                    <div key={d.district} className="mt-3">
                      <p className="text-[13px] font-medium text-primary">{d.district}</p>
                      <div className="divide-y divide-border">
                        {d.items.map((s) => (
                          <OutletRow
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
      </div>

      {/* ── Outlet directory — every shop, always visible ── */}
      {regions.length > 0 && (
        <div className="mt-20 sm:mt-28">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
            <h2 className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">All outlets</h2>
            <p className="text-[15px] tabular-nums text-muted-foreground">
              {outlets(filtered.length)} in {regions.length} region{regions.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="mt-8 border-b border-border">
            {regions.map((g) => (
              <section
                key={g.key}
                className="grid grid-cols-1 gap-x-12 gap-y-4 border-t border-border py-8 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:py-10"
              >
                <div className="lg:sticky lg:top-24 lg:self-start">
                  <h3 className="font-display text-2xl font-semibold tracking-[-0.02em]">{g.region}</h3>
                  <p className="mt-1 text-[15px] tabular-nums text-muted-foreground">{outlets(g.items.length)}</p>
                </div>
                <div className="space-y-8">
                  {g.districts.map((d) => (
                    <div key={d.district}>
                      <p className="text-sm font-medium text-primary">{d.district}</p>
                      <ul className="mt-2 grid grid-cols-1 gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
                        {d.items.map((s) => (
                          <li key={s.id} className="border-t border-border first:border-t-0 sm:[&:nth-child(2)]:border-t-0 xl:[&:nth-child(3)]:border-t-0">
                            <OutletRow s={s} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OutletRow({
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
        "min-w-0 transition-colors duration-200",
        compact ? "py-3" : "py-4",
        highlighted && "-mx-2 rounded-xl bg-primary/[0.07] px-2",
      )}
    >
      <p className={cn("font-medium leading-snug", compact ? "text-sm" : "text-[15px]", highlighted && "text-primary")}>
        {s.name}
      </p>
      <p className="mt-1 flex items-start gap-1.5 text-[13px] leading-snug text-muted-foreground">
        <meta.icon className="mt-px size-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <span className="min-w-0 break-words">
          {meta.label}
          {s.address && <> · {s.address}</>}
        </span>
      </p>
      {s.products && (
        <p className="mt-1 text-[13px] leading-snug text-foreground/80">
          <span className="text-muted-foreground">Stocked: </span>
          {s.products}
        </p>
      )}
      {s.hours && (
        <p className="mt-1 flex items-start gap-1.5 text-[13px] leading-snug text-muted-foreground">
          <Clock className="mt-px size-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span className="min-w-0">{s.hours}</span>
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-5">
        <a
          href={directionsUrl(s)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1.5 text-[13px] font-medium text-primary underline-offset-4 hover:underline"
        >
          <Navigation className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
          Directions
        </a>
        {s.phone && (
          <a
            href={telHref(s.phone)}
            className="inline-flex min-h-9 min-w-0 items-center gap-1.5 text-[13px] tabular-nums text-muted-foreground transition-colors hover:text-foreground"
          >
            <Phone className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <span className="min-w-0 break-words">{s.phone}</span>
          </a>
        )}
      </div>
    </div>
  );
}
