import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Boxes,
  CheckCircle2,
  ChevronDown,
  Clock,
  Database,
  FileText,
  Gauge,
  Info,
  KeyRound,
  Monitor as Desktop,
  Send,
  ShieldCheck,
  Smartphone,
  Store,
  UserCog,
  UserX,
  Users,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { Monitor, Level } from "@/lib/developer/monitor";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { HealthCard, InfoCallout, SectionTitle, type Tone } from "@/components/developer/info";
import { HBars, Legend, SpeedBars, StackedBars, type Series } from "@/components/developer/charts";
import { EnableTrackingButton } from "@/components/developer/enable-tracking";
import { cn, formatNumber, humanize, timeAgo } from "@/lib/utils";

/* ───────────────────────── shared bits ───────────────────────── */

const ROLE_SERIES: Series[] = [
  { key: "ADMIN", label: "Owner", color: "hsl(var(--primary))" },
  { key: "FINANCE", label: "Finance", color: "hsl(217 91% 60%)" },
  { key: "WAREHOUSE", label: "Warehouse", color: "hsl(var(--success))" },
  { key: "SALES_REP", label: "Sales reps", color: "hsl(var(--warning))" },
  { key: "PARTNER", label: "Partners", color: "hsl(173 80% 38%)" },
  { key: "DEVELOPER", label: "Developer", color: "hsl(var(--muted-foreground))" },
];
const ACTIVITY_SERIES: Series[] = [
  { key: "staff", label: "Team & partners", color: "hsl(var(--primary))" },
  { key: "dev", label: "Developer", color: "hsl(var(--warning))" },
];
const ERROR_SERIES: Series[] = [
  { key: "errors", label: "Server errors", color: "hsl(var(--destructive))" },
  { key: "logins", label: "Failed sign-ins", color: "hsl(var(--warning))" },
];

const WA_SERIES: Series[] = [
  { key: "sent", label: "Sent", color: "hsl(var(--success))" },
  { key: "failed", label: "Failed", color: "hsl(var(--destructive))" },
  { key: "skipped", label: "Not sent (switched off)", color: "hsl(var(--muted-foreground))" },
];

const LEVEL: Record<Level, { icon: LucideIcon; box: string; chip: string; label: string }> = {
  critical: { icon: XCircle, box: "border-destructive/30 bg-destructive/10", chip: "bg-destructive/15 text-destructive", label: "Fix now" },
  warning: { icon: AlertTriangle, box: "border-warning/30 bg-warning/10", chip: "bg-warning/20 text-warning", label: "Look at it" },
  info: { icon: Info, box: "border-info/25 bg-info/10", chip: "bg-info/15 text-info", label: "Good to know" },
};

const ROLE_INFO: Record<string, { label: string; text: string; icon: LucideIcon }> = {
  ADMIN: { label: "Owner (Admin)", text: "The business owner. Full control of money, staff and reports.", icon: ShieldCheck },
  FINANCE: { label: "Finance", text: "Collects and checks payments, deposits cash, follows up debts.", icon: Wallet },
  WAREHOUSE: { label: "Warehouse", text: "Receives, stores and hands out stock. No money powers.", icon: Boxes },
  SALES_REP: { label: "Sales reps", text: "Sell in the field, collect payments and request stock.", icon: Banknote },
  PARTNER: { label: "Partners", text: "Customers and distributors who order products.", icon: Store },
  DEVELOPER: { label: "Developer (you)", text: "Technical account. Cannot approve money or stock by itself.", icon: UserCog },
};
const ROLE_ORDER = ["ADMIN", "FINANCE", "WAREHOUSE", "SALES_REP", "PARTNER", "DEVELOPER"];

const TONE_DOT: Record<Tone, string> = {
  good: "bg-success",
  warn: "bg-warning",
  bad: "bg-destructive",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};

const shortDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
/** Hover text for times: always Tanzania time, clearly labelled. */
const eat = (d: Date) =>
  `${new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Dar_es_Salaam", dateStyle: "medium", timeStyle: "short" }).format(d)} EAT`;
/** "2026-10-17" — the Tanzania calendar day of a moment. */
const eatKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const bytes = (n: number) =>
  n >= 1073741824 ? `${(n / 1073741824).toFixed(2)} GB` : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/** A slim bar that stays under the header while you scroll: one tap jumps to any section. */
export function JumpBar({ items }: { items: { id: string; label: string; badge?: string | null }[] }) {
  return (
    <nav
      aria-label="Jump to a section"
      className="sticky top-16 z-20 -mx-1 flex gap-1.5 overflow-x-auto border-b border-border bg-background/90 px-1 py-2.5 backdrop-blur"
    >
      {items.map((i) => (
        <a
          key={i.id}
          href={`#${i.id}`}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          {i.label}
          {i.badge && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums">{i.badge}</span>}
        </a>
      ))}
    </nav>
  );
}

/* ───────────────────────── one section of the Home page ───────────────────────── */

/** A titled block on the single Home page. `id` lets a problem card jump straight to it ("#errors"). */
export function HomeSection({
  id,
  title,
  icon: Icon,
  description,
  badge,
  tone = "neutral",
  children,
}: {
  id: string;
  title: string;
  icon?: LucideIcon;
  description?: string;
  badge?: string | null;
  tone?: "neutral" | "warn" | "bad";
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-32 border-t border-border pt-8">
      <div className={cn("flex items-center gap-3", description ? "mb-1.5" : "mb-5")}>
        {Icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-[18px]" />
          </span>
        )}
        <h2 className="min-w-0 font-display text-2xl font-bold tracking-tight">{title}</h2>
        {badge && (
          <span
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none tabular-nums",
              tone === "bad" ? "bg-destructive/15 text-destructive" : tone === "warn" ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground",
            )}
          >
            {badge}
          </span>
        )}
      </div>
      {description && <p className="mb-5 text-sm text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
}

/** A problem as a compact card; tap to see what it means and what to do. */
function ProblemCard({ p, showLevel = false }: { p: Monitor["problems"][number]; showLevel?: boolean }) {
  const l = LEVEL[p.level];
  const Icon = l.icon;
  return (
    <details className={cn("group min-w-0 rounded-xl border open:shadow-soft md:[&:last-child:nth-child(odd)]:col-span-2", l.box)}>
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3.5 [&::-webkit-details-marker]:hidden">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", l.chip)}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm font-semibold leading-snug">{p.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{p.detail}</span>
        </span>
        {showLevel && (
          <span className={cn("hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:inline", l.chip)}>
            {l.label}
          </span>
        )}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-1.5 border-t border-border/60 px-3.5 py-3 text-sm leading-relaxed">
        <p className="text-muted-foreground">{p.detail}</p>
        <p className="text-foreground/90">
          <span className="font-semibold">What to do: </span>
          {p.hint}
        </p>
        {p.link && (
          <a
            href={p.link.href}
            {...(p.link.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="mt-1 inline-flex items-center gap-1 rounded-full bg-background px-3 py-1.5 text-xs font-semibold text-primary ring-1 ring-border transition-colors hover:bg-muted"
          >
            {p.link.label} <ArrowRight className="size-3.5" />
          </a>
        )}
      </div>
    </details>
  );
}

const CHECK_ORDER = { fix: 0, look: 1, unknown: 2, ok: 3 } as const;

/** Every check that was made, passing or not, folded away until asked for. */
function CheckList({ checks }: { checks: Monitor["systemChecks"] }) {
  const okCount = checks.filter((c) => c.status === "ok").length;
  const unknown = checks.filter((c) => c.status === "unknown").length;
  const sorted = [...checks].sort((a, b) => CHECK_ORDER[a.status] - CHECK_ORDER[b.status]);
  return (
    <details className="group border-t border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span>
          What was checked · {okCount} of {checks.length} fine{unknown > 0 ? `, ${unknown} not checked yet` : ""}
        </span>
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="divide-y divide-border border-t border-border">
        {sorted.map((c) => (
          <li key={c.label} className="flex items-start gap-3 px-5 py-2.5">
            {c.status === "ok" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
            ) : c.status === "fix" ? (
              <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            ) : c.status === "look" ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.detail}</p>
            </div>
            <Badge
              className="shrink-0 whitespace-nowrap"
              variant={c.status === "ok" ? "success" : c.status === "fix" ? "destructive" : c.status === "look" ? "warning" : "secondary"}
            >
              {c.status === "ok" ? "Fine" : c.status === "fix" ? "Fix now" : c.status === "look" ? "Look at it" : "Not checked yet"}
            </Badge>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Problems, most urgent first, in one bounded panel. "Good to know" stays folded at the bottom. */
export function Attention({ m }: { m: Monitor }) {
  const act = m.problems.filter((p) => p.level !== "info");
  const know = m.problems.filter((p) => p.level === "info");
  const crit = act.filter((p) => p.level === "critical").length;
  const warn = act.length - crit;
  // Name the level on a card only when the list mixes levels, or the card is critical.
  const mixed = crit > 0 && warn > 0;
  return (
    <section>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">Needs your attention</h2>
            <p className="text-xs text-muted-foreground">Checked just now. Tap a card to see what it means and what to do.</p>
          </div>
          {act.length === 0 ? (
            <Badge variant="success">All clear</Badge>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {crit > 0 && <Badge variant="destructive">{crit} to fix now</Badge>}
              {warn > 0 && <Badge variant="warning">{warn} to look at</Badge>}
            </div>
          )}
        </div>
        <div className="p-4 sm:p-5">
          {act.length === 0 ? (
            <div className="flex items-center gap-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Nothing needs your attention</p>
                <p className="text-sm text-muted-foreground">Nothing is broken, and every required setting is in place.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
              {act.map((p) => (
                <ProblemCard key={p.title} p={p} showLevel={mixed || p.level === "critical"} />
              ))}
            </div>
          )}
        </div>
        <CheckList checks={m.systemChecks} />
        {know.length > 0 && (
          <details className="group border-t border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
              <span>Good to know · {know.length}</span>
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid grid-cols-1 items-start gap-3 px-4 pb-4 sm:px-5 sm:pb-5 md:grid-cols-2">
              {know.map((p) => (
                <ProblemCard key={p.title} p={p} />
              ))}
            </div>
          </details>
        )}
      </Card>
    </section>
  );
}

/* ───────────────────────── tab: Activity ───────────────────────── */

export function ActivityPanel({ m }: { m: Monitor }) {
  const peakHour = m.hourSeries.reduce((a, b) => (b.n > a.n ? b : a), m.hourSeries[0]);
  const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;
  const totalActions14 = m.activitySeries.reduce((s, d) => s + d.staff, 0);
  const totalLogins14 = m.loginSeries.reduce((s, d) => s + ROLE_SERIES.reduce((x, r) => x + (d[r.key as keyof typeof d] as number), 0), 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HealthCard
          label="Signed in today"
          value={formatNumber(m.signedIn24)}
          detail="different people in 24 hours"
          tone="info"
          statusText="Live"
          icon={Users}
          meaning={`${formatNumber(m.signedIn7)} different people signed in over the last 7 days. If this drops to zero on a working day, check that sign-in still works.`}
        />
        <HealthCard
          label="Actions in 14 days"
          value={formatNumber(totalActions14)}
          detail="by the team and partners"
          tone="info"
          statusText="Activity"
          icon={Clock}
          meaning={`Each thing a person does in the system is saved as one action. Busiest hour: ${peakHour.n > 0 ? `${hourLabel(peakHour.hour)} (Tanzania time)` : "not enough data yet"}.`}
        />
        <HealthCard
          label="Sign-ins in 14 days"
          value={formatNumber(totalLogins14)}
          detail="successful sign-ins"
          tone="info"
          statusText="Sign-ins"
          icon={Users}
          meaning="Each time someone signs in with the right password. The chart below shows which roles they were."
        />
        <HealthCard
          label="Failed sign-ins (24h)"
          value={m.tracking ? formatNumber(m.events.failed24) : "—"}
          detail={m.tracking ? "wrong password or blocked account" : "error tracking is off"}
          tone={!m.tracking ? "neutral" : m.events.failed24 >= 10 ? "warn" : "good"}
          statusText={!m.tracking ? "Not tracked" : m.events.failed24 >= 10 ? "Look at it" : "Normal"}
          icon={UserX}
          meaning="A few typing mistakes are normal. Many in a day can mean someone is guessing passwords. Details are in the “Crashes & sign-ins” tab."
        />
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5 sm:p-5">
            <h2 className="text-sm font-semibold">Sign-ins per day</h2>
            <p className="mb-3 text-xs text-muted-foreground">Last 14 days, coloured by who signed in. Hover a bar for exact numbers.</p>
            <StackedBars
              data={m.loginSeries.map((d) => ({ label: d.day, values: d as unknown as Record<string, number> }))}
              series={ROLE_SERIES}
              labelEvery={2}
              formatLabel={shortDay}
            />
            <Legend series={ROLE_SERIES} className="mt-4" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 sm:p-5">
            <h2 className="text-sm font-semibold">Actions per day</h2>
            <p className="mb-3 text-xs text-muted-foreground">Everything saved in the activity log, split between the team and you.</p>
            <StackedBars
              data={m.activitySeries.map((d) => ({ label: d.day, values: { staff: d.staff, dev: d.dev } }))}
              series={ACTIVITY_SERIES}
              labelEvery={2}
              formatLabel={shortDay}
            />
            <Legend series={ACTIVITY_SERIES} className="mt-4" />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5 sm:p-5">
            <h2 className="text-sm font-semibold">Busiest hours of the day</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              When the team works (Tanzania time, last 14 days).
              {peakHour.n > 0 && <> Peak is around <strong className="text-foreground">{hourLabel(peakHour.hour)}</strong>.</>}
            </p>
            <StackedBars
              data={m.hourSeries.map((h) => ({ label: String(h.hour), values: { n: h.n } }))}
              series={[{ key: "n", label: "Actions", color: "hsl(var(--primary))" }]}
              height={225}
              labelEvery={3}
              formatLabel={(h) => `${h}h`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 sm:p-5">
            <h2 className="text-sm font-semibold">Where the work happens</h2>
            <p className="mb-4 text-xs text-muted-foreground">Actions by area, last 7 days.</p>
            <HBars items={m.modules.slice(0, 6).map((x) => ({ label: humanize(x.name), value: x.n }))} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardContent className="p-0 sm:p-0">
            <div className="border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold">Recent sign-ins</h2>
              <p className="text-xs text-muted-foreground">The last {m.recentLogins.length || 8} successful sign-ins: who, on what device, from where.</p>
            </div>
            {m.recentLogins.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No sign-ins recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Person</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead className="pr-5 text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.recentLogins.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={l.user.name} src={l.user.avatar} className="size-8 text-[11px]" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{l.user.name}</p>
                            <p className="text-xs text-muted-foreground">{humanize(l.user.role)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          {l.agent.mobile ? <Smartphone className="size-3.5 text-muted-foreground" /> : <Desktop className="size-3.5 text-muted-foreground" />}
                          {l.agent.browser} · {l.agent.os}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{l.ip ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap pr-5 text-right text-sm text-muted-foreground" title={eat(l.createdAt)}>
                        {timeAgo(l.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid content-stretch gap-4">
          <Card>
            <CardContent className="p-5 sm:p-5">
              <h2 className="text-sm font-semibold">Most active people</h2>
              <p className="mb-4 text-xs text-muted-foreground">Actions saved in the last 7 days.</p>
              {m.topActors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No actions yet.</p>
              ) : (
                <HBars items={m.topActors.slice(0, 5).map((x) => ({ label: x.name, value: x.n }))} color="hsl(var(--accent))" />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0 sm:p-0">
              <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
                <div>
                  <h2 className="text-sm font-semibold">Not using the system</h2>
                  <p className="text-xs text-muted-foreground">Never signed in, or not for 30+ days.</p>
                </div>
                <Badge variant={m.neverSignedIn.length + m.inactive.length ? "warning" : "success"}>
                  {m.neverSignedIn.length + m.inactive.length}
                </Badge>
              </div>
              {m.neverSignedIn.length + m.inactive.length === 0 ? (
                <p className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4 text-success" /> Everyone has signed in recently.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {m.neverSignedIn.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                      <span className="min-w-0 truncate">{u.name} <span className="text-xs text-muted-foreground">· {humanize(u.role)}</span></span>
                      <Badge variant="warning">Never</Badge>
                    </li>
                  ))}
                  {m.inactive.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                      <span className="min-w-0 truncate">{u.name} <span className="text-xs text-muted-foreground">· {humanize(u.role)}</span></span>
                      <span className="shrink-0 text-xs text-muted-foreground">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

/* ───────────────────────── Speed & size ───────────────────────── */

export function SpeedPanel({ m }: { m: Monitor }) {
  const slowest = m.probes.reduce((x, p) => Math.max(x, p.ms), 0);
  const speedTone: Tone = m.avgMs < 150 ? "good" : m.avgMs < 400 ? "warn" : "bad";
  const failing = m.checks.filter((c) => c.bad !== null && c.bad > 0);
  const unchecked = m.checks.filter((c) => c.bad === null).length;
  const checksTone: Tone = failing.length ? "bad" : unchecked ? "warn" : "good";
  const biggest = m.tables[0];
  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <HealthCard
          label="Database speed"
          value={`${m.avgMs} ms`}
          detail={`average of ${m.probes.length} checks · slowest ${slowest} ms`}
          tone={speedTone}
          statusText={m.avgMs < 150 ? "Fast" : m.avgMs < 400 ? "A bit slow" : "Slow"}
          icon={Gauge}
          meaning="Real questions asked to the live database just now. Under 150 ms is fast; over 400 ms pages will feel slow."
        />
        <HealthCard
          label="Database size"
          value={bytes(m.dbSize)}
          detail={biggest ? `largest table: ${biggest.name}` : "all tables together"}
          tone="info"
          statusText="Size"
          icon={Database}
          meaning="Everything stored: records, receipts and photos kept in the database. It only grows, so watch the biggest table."
        />
        <HealthCard
          label="Data checks"
          value={failing.length ? `${failing.length} failing` : unchecked ? "Partly checked" : "All OK"}
          detail={`${m.checks.length} rules that must always be true`}
          tone={checksTone}
          statusText={failing.length ? "Fix now" : unchecked ? "Look at it" : "Healthy"}
          icon={ShieldCheck}
          meaning="If a rule fails, numbers on screen can be wrong (for example negative stock). The list is below."
        />
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5 sm:p-5">
            <h2 className="text-sm font-semibold">How long each check took</h2>
            <p className="mb-4 text-xs text-muted-foreground">Each bar is one typical thing the app does. Shorter is faster.</p>
            <SpeedBars probes={m.probes} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 sm:p-5">
            <h2 className="text-sm font-semibold">Biggest tables</h2>
            <p className="mb-4 text-xs text-muted-foreground">Where the space is used. Receipts and photos can make “Attachment” large when file storage is not set up.</p>
            <HBars
              items={m.tables.slice(0, 6).map((t) => ({ label: t.name, value: t.bytes, sub: t.rows > 0 ? `about ${formatNumber(t.rows)} rows` : undefined }))}
              color="hsl(var(--info))"
              format={bytes}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardContent className="p-0 sm:p-0">
            <div className="border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold">How big the data is</h2>
              <p className="text-xs text-muted-foreground">Records in the system and how many were added in the last 7 days. A sudden jump can point to a bug.</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Records</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="pr-5 text-right">Added in 7 days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.growth.map((g) => (
                  <TableRow key={g.label}>
                    <TableCell className="pl-5 text-sm">{g.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(g.total)}</TableCell>
                    <TableCell className="pr-5 text-right tabular-nums text-muted-foreground">{g.recent > 0 ? `+${formatNumber(g.recent)}` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid content-stretch gap-4">
          <Card>
            <CardContent className="p-0 sm:p-0">
              <div className="border-b border-border px-5 py-3.5">
                <h2 className="text-sm font-semibold">Data checks</h2>
                <p className="text-xs text-muted-foreground">Rules that must always be true.</p>
              </div>
              <ul className="divide-y divide-border">
                {m.checks.map((c) => (
                  <li key={c.label} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="min-w-0">{c.label}</span>
                    {c.bad === null ? (
                      <Badge className="shrink-0 whitespace-nowrap" variant="secondary">Could not check</Badge>
                    ) : c.bad === 0 ? (
                      <Badge className="shrink-0" variant="success">OK</Badge>
                    ) : (
                      <Badge className="shrink-0 whitespace-nowrap" variant="destructive">{c.bad} found</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0 sm:p-0">
              <div className="border-b border-border px-5 py-3.5">
                <h2 className="text-sm font-semibold">This deployment</h2>
                <p className="text-xs text-muted-foreground">The version that is live right now, and where it runs.</p>
              </div>
              <dl className="divide-y divide-border">
                {[
                  ["Version", [m.deployment.commit ?? m.deployment.build.slice(0, 8), m.deployment.branch].filter(Boolean).join(" · ")],
                  ["Last change", m.deployment.message],
                  ["Environment", m.deployment.env],
                  ["Server region", m.deployment.region],
                  [
                    "Database",
                    m.deployment.dbProvider
                      ? [m.deployment.dbProvider, m.deployment.dbRegion, m.deployment.pooled ? "pooled" : "direct link"].filter(Boolean).join(" · ")
                      : null,
                  ],
                  ["Node", m.deployment.node],
                ]
                  .filter((r): r is [string, string] => !!r[1])
                  .map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-4 px-5 py-2.5 text-sm">
                      <dt className="shrink-0 text-muted-foreground">{k}</dt>
                      <dd className="min-w-0 truncate text-right font-medium" title={v}>
                        {v}
                      </dd>
                    </div>
                  ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

/* ───────────────────── Messages & reports ───────────────────── */

const eatTime = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Dar_es_Salaam", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
const dayShort = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

type ReportState = Monitor["messages"]["reportDays"][number]["state"];
const STATE_UI: Record<ReportState, { label: string; icon: LucideIcon; pill: string; dot: string; note: string }> = {
  ok: { label: "Sent", icon: CheckCircle2, pill: "bg-success/15 text-success ring-success/30", dot: "bg-success", note: "Built and sent on WhatsApp" },
  unsent: { label: "Not sent", icon: AlertTriangle, pill: "bg-warning/15 text-warning ring-warning/30", dot: "bg-warning", note: "Built, but it did not reach WhatsApp" },
  built: { label: "Built", icon: FileText, pill: "bg-muted text-muted-foreground ring-border", dot: "bg-muted-foreground/40", note: "Built (WhatsApp is not set up)" },
  waiting: { label: "Not due yet", icon: Clock, pill: "bg-muted text-muted-foreground ring-border", dot: "bg-muted-foreground/25", note: "Today's report is built in the evening" },
  missing: { label: "Not built", icon: XCircle, pill: "bg-warning/15 text-warning ring-warning/30", dot: "bg-warning", note: "No report was made for this day" },
  off: { label: "Switched off", icon: Info, pill: "bg-muted text-muted-foreground ring-border", dot: "bg-muted-foreground/25", note: "Daily reports are off in the report settings" },
  before: { label: "No report yet", icon: Info, pill: "bg-muted text-muted-foreground ring-border", dot: "bg-muted-foreground/25", note: "Before the first report" },
  unknown: { label: "Could not read", icon: Info, pill: "bg-muted text-muted-foreground ring-border", dot: "bg-muted-foreground/25", note: "The report history could not be read just now" },
};

/**
 * The owner's daily report, front and centre: one row per day with whether it was built,
 * whether it reached WhatsApp, and at what time. The time shown is when the report was made;
 * it is sent in the same run, a few seconds later, so to the minute they are the same.
 */
export function DailyReportCard({ m }: { m: Monitor }) {
  const g = m.messages;
  const todayKey = g.reportDays[0]?.day;
  const yesterdayKey = g.reportDays[1]?.day;
  const due = g.reportDays.filter((d) => !["waiting", "before", "off", "unknown"].includes(d.state));
  const sentN = due.filter((d) => d.state === "ok").length;
  const allGood = due.length > 0 && sentN === due.length;
  const monthly = g.lastMonthly;
  return (
    <section>
      <Card className="overflow-hidden">
        <CardContent className="p-0 sm:p-0">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-soft">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold tracking-tight">Daily report to the owner</h2>
                <p className="text-xs text-muted-foreground">
                  Built at {String(g.dailyHour).padStart(2, "0")}:00 Tanzania time and sent on WhatsApp. The last 7 days.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1" aria-hidden>
                {[...g.reportDays].reverse().map((d) => (
                  <span key={d.day} title={`${dayShort(d.day)}: ${STATE_UI[d.state].label}`} className={cn("h-5 w-2 rounded-full", STATE_UI[d.state].dot)} />
                ))}
              </div>
              <Badge variant={due.length === 0 ? "secondary" : allGood ? "success" : "warning"} className="whitespace-nowrap">
                {due.length === 0 ? "No reports yet" : allGood ? `${sentN} of ${due.length} sent` : `${sentN} of ${due.length} sent · look at it`}
              </Badge>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Day</TableHead>
                <TableHead>Report</TableHead>
                <TableHead className="pr-5 text-right">Sent at (Tanzania time)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {g.reportDays.map((d) => {
                const ui = STATE_UI[d.state];
                const Icon = ui.icon;
                const dueLabel = d.state === "waiting" ? `Due ${String(g.dailyHour).padStart(2, "0")}:00` : null;
                return (
                  <TableRow key={d.day} title={ui.note}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-2">
                        <span className="whitespace-nowrap text-sm font-medium">{dayShort(d.day)}</span>
                        {d.day === todayKey && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">Today</span>}
                        {d.day === yesterdayKey && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Yesterday</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1", ui.pill)}>
                        <Icon className="size-3.5" />
                        {ui.label}
                      </span>
                    </TableCell>
                    <TableCell className="pr-5 text-right" title={d.builtAt ? `${ui.note} · ${eat(d.builtAt)}` : ui.note}>
                      {d.builtAt && d.state === "ok" ? (
                        <>
                          <span className="font-display text-base font-semibold tabular-nums">{eatTime(d.builtAt)}</span>
                          <span className="block text-xs text-muted-foreground">{timeAgo(d.builtAt)}</span>
                        </>
                      ) : d.builtAt ? (
                        <>
                          <span className="text-sm text-muted-foreground">Built {eatTime(d.builtAt)}</span>
                          <span className="block text-xs text-muted-foreground">{timeAgo(d.builtAt)}</span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">{dueLabel ?? "—"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/20 px-5 py-3 text-sm">
            <span className="text-muted-foreground">Month-end report</span>
            {monthly ? (
              <span className="flex items-center gap-2">
                <Badge variant={monthly.whatsappSent ? "success" : g.configured ? "warning" : "secondary"}>
                  {monthly.whatsappSent ? "Sent" : g.configured ? "Not sent" : "Built"}
                </Badge>
                <span className="text-xs text-muted-foreground" title={eat(monthly.createdAt)}>
                  {eatTime(monthly.createdAt)} · {timeAgo(monthly.createdAt)}
                </span>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">None yet. It is built on the last day of each month.</span>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

const took = (ms: number | null) => (ms === null ? "—" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

export function MessagesPanel({ m }: { m: Monitor }) {
  if (!m.tracking)
    return (
      <InfoCallout icon={AlertTriangle} tone="warn" title="Error tracking is not switched on yet">
        <p>
          Messages and scheduled jobs are written down in the same small technical table as crashes. Switch it on once
          (it never touches business data) and this section starts filling in.
        </p>
        <div className="mt-3">
          <EnableTrackingButton />
        </div>
      </InfoCallout>
    );
  const g = m.messages;
  const never = !g.since;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <HealthCard
          label="WhatsApp messages (24h)"
          value={never ? "—" : formatNumber(g.wa24.sent)}
          detail={
            never
              ? "recording starts with the next message"
              : g.wa24.failed
                ? `${g.wa24.failed} failed`
                : g.wa24.skipped
                  ? `${g.wa24.skipped} not sent (switched off)`
                  : g.wa24.sent
                    ? "none failed"
                    : "nothing sent in 24 hours"
          }
          tone={never || g.wa24.sent === 0 ? (g.wa24.failed ? "warn" : "neutral") : g.wa24.failed ? "warn" : "good"}
          statusText={
            never
              ? "Waiting for data"
              : g.wa24.failed
                ? "Look at it"
                : g.wa24.sent > 0
                  ? "Normal"
                  : g.wa24.skipped > 0
                    ? "Switched off"
                    : "Quiet"
          }
          icon={Send}
          meaning="Alerts and reports sent to the owner's WhatsApp through CallMeBot. A failed message means the owner did not get it. Only counted from the day this was switched on."
        />
        <HealthCard
          label="Month-end report"
          value={g.lastMonthly ? (g.lastMonthly.whatsappSent ? "Sent" : g.configured ? "Not sent" : "Built") : "None yet"}
          detail={g.lastMonthly ? `built ${timeAgo(g.lastMonthly.createdAt)}` : "built on the last day of each month"}
          tone={!g.lastMonthly ? "neutral" : g.lastMonthly.whatsappSent ? "good" : g.configured ? "warn" : "neutral"}
          statusText={!g.lastMonthly ? "Info" : g.lastMonthly.whatsappSent ? "OK" : g.configured ? "Look at it" : "Info"}
          icon={FileText}
          meaning="The monthly summary for the owner. It is built together with the daily report on the last day of the month."
        />
        <HealthCard
          label="Failed in 7 days"
          value={never ? "—" : formatNumber(g.wa7Failed)}
          detail={never ? "recording starts with the next message" : "WhatsApp messages not delivered"}
          tone={never ? "neutral" : g.wa7Failed ? "warn" : "good"}
          statusText={never ? "Waiting for data" : g.wa7Failed ? "Look at it" : "None failed"}
          icon={AlertTriangle}
          meaning="Each message is tried up to 3 times. Only a message that failed all its tries is counted here."
        />
      </div>

      <Card>
        <CardContent className="p-5 sm:p-5">
          <h2 className="text-sm font-semibold">Messages per day</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            WhatsApp messages by how they went, last 14 days.{g.since && <> Counted since {shortDay(eatKey(g.since))}.</>}
          </p>
          <StackedBars
            data={g.series.map((d) => ({ label: d.day, values: { sent: d.sent, failed: d.failed, skipped: d.skipped } }))}
            series={WA_SERIES}
            labelEvery={1}
            formatLabel={shortDay}
            height={170}
            emptyText="No messages recorded yet."
          />
          <Legend series={WA_SERIES} className="mt-4" />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0 sm:p-0">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold">Automatic jobs</h2>
            <p className="text-xs text-muted-foreground">
              What Vercel runs by itself on a timer. Late means no run for a day and a half. A run is written down from the day this was switched
              on, so a job shows “Not recorded yet” until its next scheduled time.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Job</TableHead>
                <TableHead>Runs</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead>Last went well</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="text-right">Took</TableHead>
                <TableHead className="pr-5 text-right">On time?</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {g.jobs.map((j) => (
                <TableRow key={j.key} className="align-top">
                  <TableCell className="pl-5">
                    <p className="text-sm font-medium">{j.title}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">/api/cron/{j.key}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{j.schedule}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm" title={j.last ? eat(j.last.at) : undefined}>
                    {j.last ? timeAgo(j.last.at) : <span className="text-muted-foreground">Not recorded yet</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm" title={j.lastOk ? eat(j.lastOk.at) : undefined}>
                    {j.lastOk ? timeAgo(j.lastOk.at) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {j.last ? (
                      <>
                        <Badge variant={j.last.ok ? "success" : "destructive"}>{j.last.ok ? "OK" : "Failed"}</Badge>
                        {j.last.note && <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground">{j.last.note}</p>}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right text-sm tabular-nums">{took(j.last?.ms ?? null)}</TableCell>
                  <TableCell className="pr-5 text-right">
                    <Badge
                      className="whitespace-nowrap"
                      variant={j.state === "ok" ? "success" : j.state === "none" ? "secondary" : j.state === "late" ? "warning" : "destructive"}
                    >
                      {j.state === "ok" ? "On time" : j.state === "none" ? "Not recorded yet" : j.state === "late" ? "Late" : "Failed"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0 sm:p-0">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold">Messages that did not arrive</h2>
            <p className="text-xs text-muted-foreground">The newest 15 that failed or were not sent. The message text is never stored, only what went wrong.</p>
          </div>
          {g.trouble.length === 0 ? (
            <p className="flex items-center justify-center gap-2 px-5 py-5 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success" /> None recorded.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">When</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead className="pr-5">Why</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.trouble.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap pl-5 text-sm text-muted-foreground" title={eat(t.createdAt)}>
                      {timeAgo(t.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge className="whitespace-nowrap" variant={t.status === "FAILED" ? "destructive" : "secondary"}>
                        {t.status === "FAILED" ? "Not delivered" : "Not sent"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-5 text-sm text-muted-foreground">{t.detail ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────────── Crashes & sign-ins ───────────────────── */

export function ErrorsPanel({ m }: { m: Monitor }) {
  if (!m.tracking)
    return (
      <InfoCallout icon={AlertTriangle} tone="warn" title="Error tracking is not switched on yet">
        <p>
          Right now a crash on someone&apos;s screen would leave no record here. Switching it on creates one small table
          for technical events. It never touches business data and can be done once, safely.
        </p>
        <div className="mt-3">
          <EnableTrackingButton />
        </div>
      </InfoCallout>
    );
  const crashes7 = m.events.groupedErrors.reduce((s, e) => s + e.n, 0);
  const crashTone: Tone = m.events.errors24 === 0 ? "good" : m.events.errors24 >= 10 ? "bad" : "warn";
  const failedTone: Tone = m.events.failed24 >= 10 ? "warn" : "good";
  const devFailed = m.diag.failedDevLogins24h;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HealthCard
          label="Crashes today"
          value={formatNumber(m.events.errors24)}
          detail={m.events.lastError ? `last one ${timeAgo(m.events.lastError)}` : "none recorded in 24 hours"}
          tone={crashTone}
          statusText={m.events.errors24 === 0 ? "None" : m.events.errors24 >= 10 ? "Fix now" : "Look at it"}
          icon={AlertTriangle}
          meaning="A crash is a page that failed on the server, so the person saw an error screen. Each one is saved below with where it broke."
        />
        <HealthCard
          label="Crashes in 7 days"
          value={formatNumber(crashes7)}
          detail={`${m.events.groupedErrors.length} different problem${m.events.groupedErrors.length === 1 ? "" : "s"}`}
          tone="info"
          statusText="7 days"
          icon={Clock}
          meaning="The same error on the same page is counted once as a problem, with how many times it happened."
        />
        <HealthCard
          label="Failed sign-ins today"
          value={formatNumber(m.events.failed24)}
          detail="wrong password or blocked account"
          tone={failedTone}
          statusText={m.events.failed24 >= 10 ? "Look at it" : "Normal"}
          icon={UserX}
          meaning="A few typing mistakes are normal. Many in a day can mean someone is guessing passwords."
        />
        <HealthCard
          label="Your Developer sign-in"
          value={formatNumber(devFailed)}
          detail="wrong tries on your account (24h)"
          tone={devFailed > 0 ? "warn" : "good"}
          statusText={devFailed > 0 ? "Look at it" : "Normal"}
          icon={KeyRound}
          meaning="After 5 wrong tries from one place your account locks for 15 minutes. If these were not you, change your password."
        />
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5 sm:p-5">
            <h2 className="text-sm font-semibold">Crashes and failed sign-ins per day</h2>
            <p className="mb-3 text-xs text-muted-foreground">Last 14 days. A tall bar on one day is worth opening.</p>
            <StackedBars
              data={m.errorSeries.map((d) => ({ label: d.day, values: { errors: d.errors, logins: d.logins } }))}
              series={ERROR_SERIES}
              labelEvery={2}
              formatLabel={shortDay}
              height={170}
              emptyText="No errors or failed sign-ins in 14 days. Good."
            />
            <Legend series={ERROR_SERIES} className="mt-4" />
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-0 sm:p-0">
            <div className="border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold">Failed tries by address</h2>
              <p className="text-xs text-muted-foreground">Last 7 days. One address trying many accounts, or many emails that do not exist, is a warning sign.</p>
            </div>
            {m.failedByIp.length === 0 ? (
              <p className="flex items-center justify-center gap-2 px-5 py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-success" /> No wrong tries from any address.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Address</TableHead>
                    <TableHead className="text-right">Tries</TableHead>
                    <TableHead className="text-right" title="Different real accounts this address tried">
                      Accounts
                    </TableHead>
                    <TableHead className="text-right" title="Tries with an email that has no account">
                      Unknown emails
                    </TableHead>
                    <TableHead className="pr-5 text-right">Last</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.failedByIp.map((r) => (
                    <TableRow key={r.ip}>
                      <TableCell className="pl-5 font-mono text-xs">{r.ip}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.tries}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", r.accounts >= 3 && "font-semibold text-warning")}>{r.accounts}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", r.unknown >= 10 && "font-semibold text-warning")}>{r.unknown}</TableCell>
                      <TableCell className="whitespace-nowrap pr-5 text-right text-sm text-muted-foreground" title={eat(r.last)}>
                        {timeAgo(r.last)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="overflow-hidden">
        <CardContent className="p-0 sm:p-0">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold">Latest failed tries</h2>
            <p className="text-xs text-muted-foreground">Latest refused attempts. Passwords are never stored. Repeats within a minute are merged.</p>
          </div>
          {m.events.recentFailed.length === 0 ? (
            <p className="flex items-center justify-center gap-2 px-5 py-5 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success" /> None recorded.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Attempt</TableHead>
                  <TableHead className="text-right">Tries</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead className="pr-5 text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.events.recentFailed.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="pl-5 text-sm">{f.message}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.count}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{f.ip ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap pr-5 text-right text-sm text-muted-foreground" title={eat(f.createdAt)}>
                      {timeAgo(f.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0 sm:p-0">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold">Crashes in the last 7 days</h2>
              <p className="text-xs text-muted-foreground">Same error on the same page is grouped. Newest first.</p>
            </div>
            <Badge variant={m.events.groupedErrors.length ? "warning" : "success"}>
              {m.events.groupedErrors.length ? `${m.events.groupedErrors.length} to look at` : "All clear"}
            </Badge>
          </div>
          {m.events.groupedErrors.length === 0 ? (
            <p className="flex items-center justify-center gap-2 px-5 py-5 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success" /> No crashes recorded. Nothing to fix.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">What went wrong</TableHead>
                  <TableHead>Where</TableHead>
                  <TableHead className="text-right">Times</TableHead>
                  <TableHead className="pr-5 text-right">Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.events.groupedErrors.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="max-w-md pl-5 text-sm">
                      <p>{e.message}</p>
                      {e.detail && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">Where it broke</summary>
                          <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                            {e.detail}
                          </pre>
                        </details>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{e.path ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{e.n}</TableCell>
                    <TableCell className="whitespace-nowrap pr-5 text-right text-sm text-muted-foreground" title={eat(e.last)}>
                      {timeAgo(e.last)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────────────── Settings ───────────────────────── */

export function SettingsPanel({ m }: { m: Monitor }) {
  const d = m.diag;
  const missingRequired = d.env.filter((e) => e.required && !e.set);
  const setCount = d.env.filter((e) => e.set).length;
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0 sm:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold">Settings the system needs</h2>
            <p className="text-xs text-muted-foreground">
              {missingRequired.length ? "Some required settings are missing — fix those first." : "All required settings are in place."} Only whether
              a setting exists is shown, never its secret value.
            </p>
          </div>
          <Badge variant={missingRequired.length ? "destructive" : "success"}>
            {setCount} of {d.env.length} set
          </Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Setting</TableHead>
              <TableHead>What it is for</TableHead>
              <TableHead className="pr-5 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.env.map((e) => (
              <TableRow key={e.name} className="align-top">
                <TableCell className="whitespace-nowrap pl-5">
                  <p className="text-sm font-medium">{e.title}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{e.name}</p>
                </TableCell>
                <TableCell className="min-w-[18rem] text-xs leading-relaxed text-muted-foreground">
                  <p>{e.purpose}</p>
                  {!e.set && (
                    <p className={cn("mt-1.5 font-medium", e.required ? "text-destructive" : "text-warning")}>
                      Because it is missing: <span className="font-normal">{e.ifMissing}</span>
                    </p>
                  )}
                </TableCell>
                <TableCell className="pr-5 text-right">
                  <Badge className="whitespace-nowrap" variant={e.set ? "success" : e.required ? "destructive" : "warning"}>
                    {e.set ? "Set" : e.required ? "Missing" : "Not set"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ───────────────────────── tab: People & your actions ───────────────────────── */

export function PeoplePanel({ m }: { m: Monitor }) {
  const d = m.diag;
  const totalUsers = d.usersByRole.reduce((s, r) => s + r._count._all, 0);
  const byRole = new Map<string, { active: number; pending: number; suspended: number; total: number }>();
  for (const r of d.usersByRole) {
    const cur = byRole.get(r.role) ?? { active: 0, pending: 0, suspended: 0, total: 0 };
    const n = r._count._all;
    cur.total += n;
    if (r.status === "ACTIVE") cur.active += n;
    else if (r.status === "PENDING") cur.pending += n;
    else cur.suspended += n;
    byRole.set(r.role, cur);
  }
  const roles = ROLE_ORDER.filter((r) => byRole.has(r));
  return (
    <div className="space-y-6">
      <section>
        <SectionTitle
          title={`${formatNumber(totalUsers)} accounts`}
          text="Who has an account, grouped by what they do. Open Access to work as any of them."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => {
            const info = ROLE_INFO[role] ?? { label: humanize(role), text: "", icon: Users };
            const c = byRole.get(role)!;
            const Icon = info.icon;
            return (
              <Card key={role}>
                <CardContent className="p-4 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </span>
                      <p className="text-sm font-semibold">{info.label}</p>
                    </div>
                    <span className="font-display text-2xl font-semibold tabular-nums">{c.total}</span>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{info.text}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge variant="success">{c.active} active</Badge>
                    {c.suspended > 0 && <Badge variant="destructive">{c.suspended} suspended</Badge>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <InfoCallout icon={ShieldCheck} tone="good" title="Everything you do is on record">
          Your name is attached to every action, including when you work as someone else (it shows as “you as them”).
          The business owner is told, and these records cannot be edited or deleted — not even by you.
        </InfoCallout>
        <InfoCallout icon={KeyRound} tone="warn" title="While working as someone">
          You can help with their profile, but you can’t change their password or sign them out of all devices from
          their screens — use Access for that, as yourself.
        </InfoCallout>
        <InfoCallout title="Good to know">
          Your session ends after 8 hours. Working as someone ends by itself after 4 hours. Build{" "}
          <span className="font-mono">{d.build.slice(0, 8)}</span> · Node {d.node} · {d.nodeEnv}.
        </InfoCallout>
      </section>

      <Card>
        <CardContent className="p-0 sm:p-0">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold">Your recent actions</h2>
              <p className="text-xs text-muted-foreground">The last things recorded under your name.</p>
            </div>
            <Link href="/developer/audit?scope=developer" className="text-xs font-medium text-primary hover:underline">
              See all
            </Link>
          </div>
          {d.recentDev.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Nothing yet. Your actions will appear here.</p>
          ) : (
            <ul className="divide-y divide-border">
              {d.recentDev.map((log) => {
                const meta = (log.meta ?? {}) as { outcome?: string };
                const tone: Tone = meta.outcome === "FAILED" ? "bad" : "info";
                return (
                  <li key={log.id} className="flex items-start gap-3 px-5 py-3">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE_DOT[tone])} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{log.summary}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(log.createdAt)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
