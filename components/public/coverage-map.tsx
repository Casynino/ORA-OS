"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Search,
  Phone,
  Clock,
  ArrowUpRight,
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
import { Atmosphere, EASE, Rise } from "@/components/site/motion";
import { SectionHead } from "@/components/site/page-hero";
import { cn } from "@/lib/utils";

const PINK = "rgb(var(--s-pink))";
const NIGHT = "rgb(var(--s-night))";

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
 * Presentation (cinematic pass, 2026-11-09), in the night site's language: the page's section head (`intro`) opens it;
 * then the search, place filters and — on large screens — a numbered region index sit beside a sticky night map. The
 * country draws itself in ORA pink over a dot texture, distribution lines flow out of the biggest region, every region
 * marker breathes, and a tapped region glides into view with its outlets fanning out. Below, [02] lists every outlet
 * region by region as hairline rows with outlined numbers. Data, filtering and map logic are unchanged.
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
  const reduce = useReducedMotion();
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

  const typeCounts = STOCKIST_TYPES.map((t) => ({ t, count: stockists.filter((s) => s.type === t.key).length })).filter(
    (x) => x.count > 0,
  );
  // The three busiest regions get a name beside their marker on larger screens.
  const labelled = new Set(regions.slice(0, 3).map((g) => g.key));

  return (
    <div>
      {intro && <div className="mb-12 sm:mb-16">{intro}</div>}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-14">
        {/* ── Controls: search, place filters, region index ── */}
        <div className="min-w-0">
          <Rise>
            <p className="s-label">Search the network</p>
            <div className="relative mt-3">
              <Search
                className="pointer-events-none absolute left-0 top-1/2 size-5 -translate-y-1/2 text-white/45"
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
                className="peer h-14 w-full appearance-none rounded-none border-0 border-b border-white/15 bg-transparent pl-9 pr-2 text-[17px] text-white outline-none placeholder:text-white/35"
              />
              <span
                aria-hidden
                className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-[rgb(var(--s-pink))] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] peer-focus:scale-x-100"
              />
            </div>
          </Rise>

          {typeCounts.length > 0 && (
            <Rise delay={0.08} className="mt-9">
              <p className="s-label">Kind of place</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {typeCounts.map(({ t, count }) => {
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
                        "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition-[background-color,border-color,color,transform] duration-300 active:scale-[0.97]",
                        active
                          ? "border-[rgb(var(--s-pink))] bg-[rgb(var(--s-pink))] text-white shadow-[0_10px_30px_-12px_rgb(255_63_168/0.9)]"
                          : "border-white/15 text-white/70 hover:border-white/40 hover:text-white",
                      )}
                    >
                      <t.icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
                      {t.plural}
                      <span className={cn("font-site-mono text-[11px] tabular-nums", active ? "text-white/80" : "text-white/40")}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-5 text-[13px] text-white/50">Tap a region to see every outlet fan out</p>
            </Rise>
          )}

          {/* Region index — large screens; on phones the markers and the directory do this job */}
          {regions.length > 0 && (
            <Rise delay={0.14} className="mt-12 hidden lg:block">
              <div className="flex items-center justify-between">
                <p className="s-label">Regions</p>
                <p className="s-label">Outlets</p>
              </div>
              <ul className="mt-4 border-t border-white/10">
                {regions.map((g, i) => {
                  const isSel = selected?.key === g.key;
                  return (
                    <li key={g.key}>
                      <button
                        type="button"
                        aria-pressed={isSel}
                        onClick={() => selectRegion(isSel ? null : g.key)}
                        className="group/r relative isolate flex w-full items-center gap-5 overflow-hidden border-b border-white/10 py-3.5 pl-1 pr-3 text-left outline-none focus-visible:bg-white/[0.04]"
                      >
                        <span
                          aria-hidden
                          className="absolute inset-0 -z-10 origin-left scale-x-0 bg-white/[0.05] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/r:scale-x-100"
                        />
                        <span
                          aria-hidden
                          className={cn(
                            "absolute inset-0 -z-10 origin-left bg-[rgb(var(--s-pink))] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                            isSel ? "scale-x-100" : "scale-x-0",
                          )}
                        />
                        <span className={cn("w-6 font-site-mono text-[11px] tabular-nums", isSel ? "text-white/80" : "text-white/35")}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-site-display text-[17px] font-medium uppercase tracking-[-0.01em] text-white transition-transform duration-300 group-hover/r:translate-x-1.5">
                          {g.region}
                        </span>
                        <span className={cn("font-site-mono text-[13px] tabular-nums", isSel ? "text-white" : "text-white/60")}>
                          {String(g.items.length).padStart(2, "0")}
                        </span>
                        <ArrowUpRight
                          className={cn(
                            "size-4 shrink-0 transition-[transform,color] duration-300",
                            isSel ? "rotate-45 text-white" : "text-white/30 group-hover/r:rotate-45 group-hover/r:text-white",
                          )}
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Rise>
          )}
        </div>

        {/* ── The night map ── */}
        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <Rise>
            <div className="relative isolate -mx-5 aspect-[720/760] overflow-hidden border-y border-white/10 bg-[rgb(var(--s-deep))] sm:mx-0 sm:rounded-[28px] sm:border lg:aspect-auto lg:h-[min(calc(100svh-8rem),820px)]">
              <Atmosphere variant="b" className="opacity-60" />
              <svg
                viewBox={`0 0 ${TZ_VIEW.w} ${TZ_VIEW.h}`}
                className="absolute inset-0 block h-full w-full"
                aria-label="Map of Tanzania showing where ORA products are available"
                onClick={() => selectRegion(null)}
              >
                <defs>
                  <linearGradient id="ora-tz-fill" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="rgb(255 63 168)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="rgb(139 92 246)" stopOpacity="0.07" />
                  </linearGradient>
                  <pattern id="ora-tz-dots" width="9" height="9" patternUnits="userSpaceOnUse">
                    <circle cx="4.5" cy="4.5" r="1" fill="rgb(247 239 246)" fillOpacity="0.17" />
                  </pattern>
                </defs>
                <g className="motion-reduce:!transition-none" style={viewTransform}>
                  {/* Country: a soft wide edge, a pink-to-violet tint, a dot texture and a line that draws itself */}
                  <path d={TZ_PATH} fill="none" stroke={PINK} strokeOpacity="0.12" strokeWidth="12" strokeLinejoin="round" />
                  <path d={TZ_PATH} fill="url(#ora-tz-fill)" />
                  <path d={TZ_PATH} fill="url(#ora-tz-dots)" />
                  <motion.path
                    d={TZ_PATH}
                    fill="none"
                    stroke={PINK}
                    strokeOpacity="0.75"
                    strokeWidth="1.3"
                    strokeLinejoin="round"
                    initial={reduce ? false : { pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 2.4, ease: EASE }}
                  />

                  {/* Distribution network: dashes flowing out of the biggest region */}
                  {!selected && (
                    <g>
                      {network.map((l) => (
                        <line
                          key={l.key}
                          x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                          stroke={PINK}
                          strokeOpacity="0.4"
                          strokeWidth="1"
                          strokeDasharray="3 7"
                          strokeLinecap="round"
                          className="tz-flow"
                        />
                      ))}
                    </g>
                  )}

                  {/* Region markers */}
                  {regions.map((g, i) => {
                    const isSel = selected?.key === g.key;
                    const dim = selected && !isSel;
                    const r = isMobile
                      ? Math.min(23, 16 + Math.sqrt(g.items.length) * 1.6)
                      : Math.min(18, 10.5 + Math.sqrt(g.items.length) * 1.5);
                    // name beside the marker: below near the coast, left on the east side, right elsewhere
                    const labelAt = g.x > TZ_VIEW.w * 0.78 ? "below" : g.x > TZ_VIEW.w * 0.58 ? "left" : "right";
                    return (
                      <g
                        key={g.key}
                        transform={`translate(${g.x}, ${g.y})`}
                        className={cn("group/m cursor-pointer outline-none transition-opacity duration-300", dim && "opacity-25")}
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
                            <circle r="12" fill="none" stroke={PINK} strokeOpacity="0.5" strokeWidth="1" />
                            <circle r="4.5" fill={PINK} stroke={NIGHT} strokeWidth="1.5" />
                          </>
                        ) : (
                          <>
                            {!selected && (
                              <circle r={r} fill={PINK} className="tz-pulse" style={{ animationDelay: `${(i * 0.37) % 2.6}s` }} />
                            )}
                            <circle
                              r={r + 6}
                              fill="none"
                              stroke={PINK}
                              strokeOpacity="0.7"
                              strokeWidth="1"
                              className="opacity-0 transition-opacity duration-200 group-hover/m:opacity-100 group-focus-visible/m:opacity-100"
                            />
                            <circle r={r} fill={PINK} stroke={NIGHT} strokeWidth="2" />
                            <text
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={isMobile ? 16 : 11}
                              fontWeight="600"
                              fill="#fff"
                              className="font-site-display"
                              style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                              {g.items.length}
                            </text>
                            {!isMobile && !selected && labelled.has(g.key) && (
                              <text
                                x={labelAt === "left" ? -(r + 9) : labelAt === "right" ? r + 9 : 0}
                                y={labelAt === "below" ? r + 14 : 0}
                                textAnchor={labelAt === "left" ? "end" : labelAt === "right" ? "start" : "middle"}
                                dominantBaseline="central"
                                fontSize="10"
                                letterSpacing="1.6"
                                fill="rgb(247 239 246)"
                                fillOpacity="0.75"
                                className="pointer-events-none font-site-mono uppercase"
                              >
                                {g.region}
                              </text>
                            )}
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
                              stroke={PINK}
                              strokeOpacity="0.3"
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
                                <circle r="8.5" fill="none" stroke={PINK} strokeOpacity="0.6" strokeWidth="1" />
                              )}
                              <circle
                                r={isFocus ? 4.6 : 3.6}
                                fill={isFocus ? "#fff" : PINK}
                                stroke={NIGHT}
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

              {/* Corner marks */}
              <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-3 sm:right-6 sm:top-6">
                <span className="s-label !text-[rgb(var(--s-pink))]">[ Live map ]</span>
                <span className="s-label">Tanzania</span>
              </div>
              {!selected && regions.length > 0 && (
                <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2.5 sm:bottom-6 sm:left-6">
                  <span className="relative flex size-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-[rgb(var(--s-pink))] opacity-60 motion-reduce:animate-none" />
                    <span className="relative size-2 rounded-full bg-[rgb(var(--s-pink))]" />
                  </span>
                  <span className="s-label tabular-nums">
                    {regions.length} region{regions.length === 1 ? "" : "s"} · {outlets(filtered.length)}
                  </span>
                </div>
              )}

              {/* Empty / no-results state */}
              {regions.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                  <p className="rounded-full border border-white/15 bg-[rgb(var(--s-night)/0.8)] px-5 py-3 text-center text-sm text-white/70 backdrop-blur">
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
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.45, ease: EASE }}
                    className="absolute inset-x-3 bottom-3 z-10 max-h-[58%] overflow-y-auto scrollbar-thin rounded-[22px] border border-white/10 bg-[rgb(var(--s-night)/0.9)] p-4 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8)] backdrop-blur-xl sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:max-h-[88%] sm:w-80 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="s-label !text-[rgb(var(--s-pink))]">[ Region ]</p>
                        <p className="mt-3 font-site-display text-2xl font-semibold uppercase leading-none tracking-[-0.03em] text-white">
                          {selected.region}
                        </p>
                        <p className="mt-2 text-[13px] text-white/55">
                          {outlets(selected.items.length)} · tap a pin or scroll
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => selectRegion(null)}
                        aria-label="Close"
                        className="-mr-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 transition-[transform,color,border-color] duration-300 hover:rotate-90 hover:border-white/40 hover:text-white"
                      >
                        <X className="size-4" strokeWidth={1.5} />
                      </button>
                    </div>

                    <div className="mt-2">
                      {selected.districts.map((d) => (
                        <div key={d.district} className="mt-4">
                          <p className="s-label !text-[rgb(var(--s-pink))]">{d.district}</p>
                          <div className="mt-1 divide-y divide-white/10">
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
          </Rise>
        </div>
      </div>

      {/* ── [02] Outlet directory — every shop, always visible ── */}
      {regions.length > 0 && (
        <div id="outlets" className="mt-28 scroll-mt-24 sm:mt-40">
          <SectionHead
            index="02"
            label="The directory"
            aside={`${filtered.length} listed`}
            title="All outlets"
            accent={["outlets"]}
            note={
              <>
                {outlets(filtered.length)} in {regions.length} region{regions.length === 1 ? "" : "s"}, grouped by district,
                each with directions.
              </>
            }
          />

          <div className="mt-12 border-b border-white/10 sm:mt-16">
            {regions.map((g, i) => (
              <Rise key={g.key} y={20}>
                <section className="grid grid-cols-1 gap-x-12 gap-y-6 border-t border-white/10 py-10 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:py-14">
                  <div className="flex items-start gap-5 lg:sticky lg:top-24 lg:block lg:self-start">
                    <span className="s-outline font-site-display text-[3.2rem] font-semibold leading-[0.8] tracking-[-0.05em] [-webkit-text-stroke-width:1.2px] lg:text-[5.5rem]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 lg:mt-6">
                      <h3 className="break-words font-site-display text-[1.65rem] font-semibold uppercase leading-[0.95] tracking-[-0.03em] text-white sm:text-[2rem]">
                        {g.region}
                      </h3>
                      <p className="mt-3 s-label !leading-[1.6]">
                        {outlets(g.items.length)} · {g.districts.length} district{g.districts.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <div className="min-w-0 space-y-9">
                    {g.districts.map((d) => (
                      <div key={d.district}>
                        <div className="flex items-center gap-3">
                          <p className="s-label !text-[rgb(var(--s-pink))]">{d.district}</p>
                          <span aria-hidden className="h-px flex-1 bg-white/[0.07]" />
                        </div>
                        <ul className="mt-2 grid grid-cols-1 gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
                          {d.items.map((s) => (
                            <li key={s.id} className="border-t border-white/10 first:border-t-0 sm:[&:nth-child(2)]:border-t-0 xl:[&:nth-child(3)]:border-t-0">
                              <OutletRow s={s} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              </Rise>
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
        "group/o min-w-0 transition-colors duration-300",
        compact ? "py-3" : "py-5",
        highlighted && "-mx-2 rounded-xl bg-[rgb(var(--s-pink)/0.12)] px-2",
      )}
    >
      <p
        className={cn(
          "font-medium leading-snug text-white transition-colors duration-300 group-hover/o:text-[rgb(var(--s-pink))]",
          compact ? "text-sm" : "text-base",
          highlighted && "text-[rgb(var(--s-pink))]",
        )}
      >
        {s.name}
      </p>
      <p className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-white/55">
        <meta.icon className="mt-px size-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <span className="min-w-0 break-words">
          {meta.label}
          {s.address && <> · {s.address}</>}
        </span>
      </p>
      {s.products && (
        <p className="mt-1 text-[13px] leading-snug text-white/80">
          <span className="text-white/45">Stocked: </span>
          {s.products}
        </p>
      )}
      {s.hours && (
        <p className="mt-1 flex items-start gap-1.5 text-[13px] leading-snug text-white/55">
          <Clock className="mt-px size-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span className="min-w-0">{s.hours}</span>
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-5">
        <a
          href={directionsUrl(s)}
          target="_blank"
          rel="noopener noreferrer"
          className="group/d inline-flex h-9 items-center gap-1.5 text-[13px] font-medium text-[rgb(var(--s-pink))]"
        >
          Directions
          <ArrowUpRight
            className="size-3.5 transition-transform duration-300 group-hover/d:-translate-y-0.5 group-hover/d:translate-x-0.5 group-hover/d:rotate-45"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </a>
        {s.phone && (
          <a
            href={telHref(s.phone)}
            className="inline-flex min-h-9 min-w-0 items-center gap-1.5 font-site-mono text-[12px] tabular-nums text-white/60 transition-colors hover:text-white"
          >
            <Phone className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <span className="min-w-0 break-words">{s.phone}</span>
          </a>
        )}
      </div>
    </div>
  );
}
