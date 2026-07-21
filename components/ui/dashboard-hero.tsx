import { Reveal } from "@/components/ui/reveal";

export type DashboardHeroStat = { label: string; value: string; sub?: string };

/**
 * The shared dashboard banner used across every role (Admin, Finance,
 * Warehouse, Sales Rep). Compact by design — tuned to sit lightly at the top
 * of the page (especially on phones) while staying premium: gradient, subtle
 * grid + glow, and optional frosted-glass KPI chips.
 */
export function DashboardHero({
  eyebrow,
  pill,
  title,
  subtitle,
  stats,
}: {
  /** Small top line — a date, warehouse name, etc. */
  eyebrow: string;
  /** Optional role/label chip shown after the eyebrow. */
  pill?: string;
  /** The greeting headline (already includes name + any emoji). */
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Optional KPI chips (2-up on phones, 4-up on desktop). */
  stats?: DashboardHeroStat[];
}) {
  return (
    <Reveal>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-accent to-primary p-4 text-white shadow-glow ring-1 ring-white/10 sm:rounded-3xl sm:p-6">
        <div className="absolute inset-0 bg-grid opacity-15" />
        <div className="pointer-events-none absolute -right-10 -top-14 size-44 rounded-full bg-white/15 blur-3xl animate-float-slow" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 size-40 rounded-full bg-white/10 blur-3xl animate-float-slow-rev" />
        <div className="relative min-w-0">
          <p className="flex items-center gap-2 text-[11px] text-white/80 sm:text-xs">
            <span className="inline-block size-1.5 shrink-0 animate-pulse rounded-full bg-white" />
            <span className="min-w-0 truncate">{eyebrow}</span>
            {pill && (
              <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">
                {pill}
              </span>
            )}
          </p>
          <h1 className="mt-1 text-balance font-display text-xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 line-clamp-2 max-w-2xl text-xs text-white/85 sm:text-sm">
              {subtitle}
            </p>
          )}
          {stats && stats.length > 0 && (
            <div className="mt-3.5 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-2.5">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="min-w-0 rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm"
                >
                  <p className="truncate text-[10px] font-medium uppercase tracking-wide text-white/70">
                    {s.label}
                  </p>
                  <p className="mt-0.5 truncate font-display text-[15px] font-bold leading-tight sm:text-lg">
                    {s.value}
                  </p>
                  {s.sub && <p className="mt-0.5 truncate text-[10px] text-white/65">{s.sub}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Reveal>
  );
}
