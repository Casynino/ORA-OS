import type { Monitor } from "@/lib/developer/monitor";
import { MiniBars, Sparkline } from "@/components/developer/charts";
import { cn, formatNumber } from "@/lib/utils";

/**
 * The top of the Developer Home in one card: who is looking, the verdict, the health
 * score, and the four numbers that matter, each with its recent trend. The colours are
 * fixed (a dark plum card in both themes) so the numbers always read clearly.
 */

const GOOD = "#34d399";
const WARN = "#fbbf24";
const BAD = "#f87171";

const sum = (row: Record<string, unknown>) =>
  Object.entries(row).reduce((s, [k, v]) => (k === "day" ? s : s + (Number(v) || 0)), 0);

function Dial({ score, color }: { score: number; color: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative size-[96px] sm:size-[148px]" role="img" aria-label={`Health score ${score} out of 100`}>
        <svg viewBox="0 0 120 120" className="size-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#ffffff" strokeOpacity={0.14} strokeWidth={9} />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={`${(Math.max(0, Math.min(100, score)) / 100) * c} ${c}`}
            style={{ filter: `drop-shadow(0 0 6px ${color}99)` }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-3xl font-bold leading-none tabular-nums sm:text-5xl">{score}</p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-white/60">out of 100</p>
          </div>
        </div>
      </div>
      <p className="hidden text-[11px] font-semibold uppercase tracking-wider text-white/60 sm:block">Health score</p>
    </div>
  );
}

function Chip({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90 ring-1 ring-white/10">
      <span className="size-1.5 rounded-full" style={{ background: n > 0 ? color : "rgba(255,255,255,0.4)" }} />
      <span className="tabular-nums">{n}</span> {label}
    </span>
  );
}

function Metric({
  label,
  value,
  hint,
  valueColor,
  visual,
}: {
  label: string;
  value: string;
  hint: string;
  valueColor?: string;
  visual: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl bg-white/[0.06] p-3.5 ring-1 ring-white/10 backdrop-blur-sm sm:p-4">
      <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-white/60">{label}</p>
      <p
        className="mt-2 whitespace-nowrap font-display text-2xl font-bold leading-none tabular-nums sm:text-3xl"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </p>
      <p className="mt-1.5 truncate text-xs text-white/65">{hint}</p>
      <div className="mt-auto pt-3">{visual}</div>
    </div>
  );
}

export function CommandDeck({
  m,
  eyebrow,
  pill,
  title,
}: {
  m: Monitor;
  eyebrow: string;
  pill: string;
  title: React.ReactNode;
}) {
  const d = m.diag;
  const crit = m.problems.filter((p) => p.level === "critical").length;
  const warn = m.problems.filter((p) => p.level === "warning").length;
  const info = m.problems.length - crit - warn;
  const color = crit ? BAD : warn ? WARN : GOOD;
  const headline = crit ? "Needs attention now" : warn ? "Working, with a few things to look at" : "Everything is healthy";
  const summary = crit
    ? `${crit} thing${crit > 1 ? "s are" : " is"} broken and should be fixed now.`
    : warn
      ? `${warn} thing${warn > 1 ? "s" : ""} worth a look. Nothing is broken.`
      : "The database is fast, every required setting is in place and nothing has crashed.";

  const dbColor = !d.dbOk ? BAD : m.avgMs >= 400 ? BAD : m.avgMs >= 150 ? WARN : GOOD;
  const crashes = m.tracking ? m.events.errors24 : null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 text-white shadow-glow ring-1 ring-white/10 sm:rounded-3xl sm:p-7"
      style={{
        backgroundImage:
          "radial-gradient(60% 130% at 100% 0%, hsl(var(--primary) / 0.5), transparent 62%), radial-gradient(55% 120% at 0% 110%, hsl(var(--accent) / 0.45), transparent 60%), linear-gradient(135deg, #1b0b2f 0%, #2b1048 100%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "linear-gradient(to bottom, black, transparent 85%)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 85%)",
        }}
      />

      <div className="relative">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-12">
          <div className="col-span-2 min-w-0 lg:col-span-1 lg:row-start-1">
            <p className="flex items-center gap-2 text-xs text-white/75">
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping" style={{ background: color }} />
                <span className="relative inline-flex size-2 rounded-full" style={{ background: color }} />
              </span>
              <span className="min-w-0 truncate">{eyebrow}</span>
              <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">{pill}</span>
            </p>
            <h1 className="mt-2 text-balance font-display text-2xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          </div>

          <div className="self-center lg:col-start-2 lg:row-span-3 lg:row-start-1">
            <Dial score={m.score} color={color} />
          </div>

          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <p className="font-display text-lg font-semibold leading-tight sm:text-xl" style={{ color }}>
              {headline}
            </p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/75">{summary}</p>
          </div>

          <div className="col-span-2 flex flex-wrap gap-2 lg:col-span-1 lg:col-start-1 lg:row-start-3">
            <Chip n={crit} label="to fix now" color={BAD} />
            <Chip n={warn} label="to look at" color={WARN} />
            <Chip n={info} label="for information" color="#93c5fd" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            label="Database"
            value={d.dbOk ? "Online" : "Down"}
            valueColor={dbColor}
            hint={d.dbOk ? `${d.dbMs} ms · ${d.pooled ? "pooled" : "not pooled"}` : "cannot connect"}
            visual={
              <MiniBars
                className="h-8 w-full"
                floor={60}
                values={m.probes.map((p) => p.ms)}
                colors={m.probes.map((p) => (!p.ok || p.ms >= 400 ? BAD : p.ms >= 150 ? WARN : GOOD))}
              />
            }
          />
          <Metric
            label="Signed in today"
            value={formatNumber(m.signedIn24)}
            hint="different people"
            visual={<Sparkline className="h-8 w-full" id="deck-signins" values={m.loginSeries.map((r) => sum(r as unknown as Record<string, unknown>))} />}
          />
          <Metric
            label="Actions today"
            value={formatNumber(d.activity24h)}
            hint="saved in 24 hours"
            visual={<Sparkline className="h-8 w-full" id="deck-actions" values={m.activitySeries.map((r) => r.staff + r.dev)} />}
          />
          <Metric
            label="Crashes today"
            value={crashes === null ? "—" : formatNumber(crashes)}
            valueColor={crashes ? BAD : undefined}
            hint={crashes === null ? "tracking is off" : crashes > 0 ? "pages that broke" : "nothing broke"}
            visual={<Sparkline className="h-8 w-full" id="deck-crashes" values={m.errorSeries.map((r) => r.errors)} color={crashes ? BAD : "#ffffff"} />}
          />
        </div>
      </div>
    </div>
  );
}
