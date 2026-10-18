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
  Info,
  KeyRound,
  Monitor as Desktop,
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
import { HBars, Legend, ScoreRing, SpeedBars, StackedBars, type Series } from "@/components/developer/charts";
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
const bytes = (n: number) =>
  n >= 1073741824 ? `${(n / 1073741824).toFixed(2)} GB` : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/* ───────────────────── status strip (top of Home) ───────────────────── */

/** One compact panel: the verdict, the score, and the four live numbers — no wasted space. */
export function StatusStrip({ m }: { m: Monitor }) {
  const d = m.diag;
  const crit = m.problems.filter((p) => p.level === "critical").length;
  const warn = m.problems.filter((p) => p.level === "warning").length;
  const info = m.problems.length - crit - warn;
  const headline = crit
    ? "Needs attention now"
    : warn
      ? "Working, with a few things to look at"
      : "Everything is healthy";
  const summary = crit
    ? `${crit} thing${crit > 1 ? "s are" : " is"} broken and should be fixed now.`
    : warn
      ? `${warn} thing${warn > 1 ? "s" : ""} worth a look. Nothing is broken.`
      : "The database is fast, every required setting is in place and nothing has crashed.";
  const metrics = [
    { label: "Database", value: d.dbOk ? "Online" : "Down", hint: d.dbOk ? `${d.dbMs} ms · ${d.pooled ? "pooled" : "not pooled"}` : "cannot connect", tone: d.dbOk ? "text-success" : "text-destructive" },
    { label: "Signed in today", value: formatNumber(m.signedIn24), hint: "different people", tone: "" },
    { label: "Actions today", value: formatNumber(d.activity24h), hint: "saved in 24 hours", tone: "" },
    {
      label: "Crashes today",
      value: m.tracking ? formatNumber(m.events.errors24) : "—",
      hint: m.tracking ? (m.events.errors24 > 0 ? "pages that broke" : "nothing broke") : "tracking is off",
      tone: m.tracking && m.events.errors24 > 0 ? "text-destructive" : "",
    },
  ];
  return (
    <Card>
      <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-8">
        <div className="flex items-center gap-5">
          <ScoreRing score={m.score} size={112} />
          <div className="lg:hidden">
            <p className="font-display text-lg font-semibold leading-tight">{headline}</p>
            <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
          </div>
        </div>
        <div className="hidden lg:block">
          <p className="font-display text-xl font-semibold leading-tight">{headline}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{summary}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge variant={crit ? "destructive" : "secondary"}>{crit} to fix now</Badge>
            <Badge variant={warn ? "warning" : "secondary"}>{warn} to look at</Badge>
            <Badge variant="secondary">{info} for information</Badge>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 lg:grid-cols-2 lg:border-l lg:border-border lg:pl-8">
          {metrics.map((x) => (
            <div key={x.label} className="min-w-0">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{x.label}</dt>
              <dd className={cn("mt-1 font-display text-2xl font-bold leading-none tabular-nums", x.tone)}>{x.value}</dd>
              <p className="mt-1 truncate text-xs text-muted-foreground">{x.hint}</p>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/** A problem as a compact card; tap to see what it means and what to do. */
function ProblemCard({ p }: { p: Monitor["problems"][number] }) {
  const l = LEVEL[p.level];
  const Icon = l.icon;
  return (
    <details className={cn("group rounded-xl border open:shadow-soft", l.box)}>
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3.5 [&::-webkit-details-marker]:hidden">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", l.chip)}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{p.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{p.detail}</span>
        </span>
        <span className={cn("hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:inline", l.chip)}>
          {l.label}
        </span>
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

/** Problems, most urgent first. Things to act on are up front; "good to know" is quieter. */
export function Attention({ m }: { m: Monitor }) {
  const act = m.problems.filter((p) => p.level !== "info");
  const know = m.problems.filter((p) => p.level === "info");
  return (
    <section className="space-y-4">
      <div>
        <SectionTitle
          title={act.length ? `Needs your attention · ${act.length}` : "Needs your attention"}
          text="Checked just now. Tap a card to see what it means and what to do."
          className="mb-3"
        />
        {act.length === 0 ? (
          <InfoCallout icon={CheckCircle2} tone="good" title="Nothing needs your attention">
            Nothing is broken.
          </InfoCallout>
        ) : (
          <div className="grid items-start gap-3 md:grid-cols-2">
            {act.map((p) => (
              <ProblemCard key={p.title} p={p} />
            ))}
          </div>
        )}
      </div>
      {know.length > 0 && (
        <details className="group">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            Good to know · {know.length}
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 grid items-start gap-3 md:grid-cols-2">
            {know.map((p) => (
              <ProblemCard key={p.title} p={p} />
            ))}
          </div>
        </details>
      )}
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
          <CardContent className="p-5">
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
          <CardContent className="p-5">
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
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold">Busiest hours of the day</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              When the team works (Tanzania time, last 14 days).
              {peakHour.n > 0 && <> Peak is around <strong className="text-foreground">{hourLabel(peakHour.hour)}</strong>.</>}
            </p>
            <StackedBars
              data={m.hourSeries.map((h) => ({ label: String(h.hour), values: { n: h.n } }))}
              series={[{ key: "n", label: "Actions", color: "hsl(var(--primary))" }]}
              height={170}
              labelEvery={3}
              formatLabel={(h) => `${h}h`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold">Where the work happens</h2>
            <p className="mb-4 text-xs text-muted-foreground">Actions by area, last 7 days.</p>
            <HBars items={m.modules.map((x) => ({ label: humanize(x.name), value: x.n }))} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <div className="border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold">Recent sign-ins</h2>
              <p className="text-xs text-muted-foreground">The last 12 successful sign-ins: who, on what device, from where.</p>
            </div>
            {m.recentLogins.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No sign-ins recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead className="text-right">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {m.recentLogins.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
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
                        <TableCell className="whitespace-nowrap text-right text-sm text-muted-foreground" title={eat(l.createdAt)}>
                          {timeAgo(l.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <h2 className="text-sm font-semibold">Most active people</h2>
              <p className="mb-4 text-xs text-muted-foreground">Actions saved in the last 7 days.</p>
              <HBars items={m.topActors.map((x) => ({ label: x.name, value: x.n }))} color="hsl(var(--accent))" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <h2 className="text-sm font-semibold">Not using the system</h2>
              <p className="mb-3 text-xs text-muted-foreground">Active accounts that never signed in, or not for 30+ days.</p>
              {m.neverSignedIn.length + m.inactive.length === 0 ? (
                <p className="text-sm text-muted-foreground">Everyone has signed in recently.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {m.neverSignedIn.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">{u.name} <span className="text-xs text-muted-foreground">· {humanize(u.role)}</span></span>
                      <Badge variant="warning">Never</Badge>
                    </li>
                  ))}
                  {m.inactive.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-2">
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

/* ───────────────────────── tab: Speed & size ───────────────────────── */

export function SpeedPanel({ m }: { m: Monitor }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Real queries timed right now against the live database, and how big the database has grown.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Database speed</h2>
              <Badge variant={m.avgMs < 150 ? "success" : m.avgMs < 400 ? "warning" : "destructive"}>average {m.avgMs} ms</Badge>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">Each bar is one typical thing the app does. Shorter is faster.</p>
            <SpeedBars probes={m.probes} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Database size</h2>
              <Badge variant="secondary">{bytes(m.dbSize)} total</Badge>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">The biggest tables. Receipts and photos can make “Attachment” large when file storage is not set up.</p>
            <HBars
              items={m.tables.slice(0, 6).map((t) => ({ label: t.name, value: t.bytes, sub: t.rows > 0 ? `about ${formatNumber(t.rows)} rows` : undefined }))}
              color="hsl(var(--info))"
              format={bytes}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold">Data checks</h2>
            <p className="mb-4 text-xs text-muted-foreground">Rules that must always be true. If one fails, numbers on screen may be wrong.</p>
            <ul className="space-y-3">
              {m.checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2.5 text-sm">
                  {c.bad === null ? (
                    <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  ) : c.bad === 0 ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <span className="min-w-0">
                    {c.label}
                    <span
                      className={cn(
                        "ml-1.5 text-xs",
                        c.bad === null ? "text-muted-foreground" : c.bad === 0 ? "text-success" : "font-semibold text-destructive",
                      )}
                    >
                      {c.bad === null ? "could not check" : c.bad === 0 ? "OK" : `${c.bad} found`}
                    </span>
                  </span>
                </li>
              ))}
              <li className="flex items-start gap-2.5 text-sm">
                <Database className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {m.suspended} suspended account{m.suspended === 1 ? "" : "s"} · {m.diag.env.filter((e) => !e.set).length} setting
                  {m.diag.env.filter((e) => !e.set).length === 1 ? "" : "s"} not set
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-0">
            <div className="border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold">How big the data is</h2>
              <p className="text-xs text-muted-foreground">Records in the system, and how many were added in the last 7 days. A sudden jump can point to a bug.</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Records</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Added in 7 days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.growth.map((g) => (
                    <TableRow key={g.label}>
                      <TableCell className="text-sm">{g.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(g.total)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{g.recent > 0 ? `+${formatNumber(g.recent)}` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold">Scheduled reports</h2>
              <p className="text-xs text-muted-foreground">The owner reports the system builds by itself. If they stop, the schedule or WhatsApp link is broken.</p>
            </div>
            {m.reports.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No reports have been built yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {m.reports.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground" title={eat(r.createdAt)}>
                        {humanize(r.type)} · built {timeAgo(r.createdAt)}
                      </p>
                    </div>
                    <Badge variant={r.whatsappSent ? "success" : "warning"}>{r.whatsappSent ? "Sent on WhatsApp" : "Not sent"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ───────────────────── tab: Crashes & sign-ins ───────────────────── */

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
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Server errors (a page that crashed) and sign-ins that were refused. This is how you hear about a problem before
        staff complain.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold">Errors and failed sign-ins per day</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              {m.events.errors24 === 0
                ? "No crashes in the last 24 hours."
                : `${m.events.errors24} crash${m.events.errors24 === 1 ? "" : "es"} in the last 24 hours.`}
              {m.events.lastError && <> Last one {timeAgo(m.events.lastError)}.</>}
            </p>
            <StackedBars
              data={m.errorSeries.map((d) => ({ label: d.day, values: { errors: d.errors, logins: d.logins } }))}
              series={ERROR_SERIES}
              labelEvery={2}
              formatLabel={shortDay}
              height={160}
              emptyText="No errors or failed sign-ins in 14 days. Good."
            />
            <Legend series={ERROR_SERIES} className="mt-4" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0">
            <div className="border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold">Failed sign-ins</h2>
              <p className="text-xs text-muted-foreground">Latest refused attempts. Passwords are never stored. Repeats within a minute are merged into one line (×N).</p>
            </div>
            {m.events.recentFailed.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">None recorded.</p>
            ) : (
              <ul className="divide-y divide-border">
                {m.events.recentFailed.map((f) => (
                  <li key={f.id} className="px-5 py-2.5 text-sm">
                    <p className="leading-snug">
                      {f.message}
                      {f.count > 1 && <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">×{f.count}</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground" title={eat(f.createdAt)}>
                      {timeAgo(f.createdAt)}{f.ip ? ` · ${f.ip}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold">Crashes in the last 7 days</h2>
            <p className="text-xs text-muted-foreground">Same error on the same page is grouped. Newest first.</p>
          </div>
          {m.events.groupedErrors.length === 0 ? (
            <p className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success" /> No crashes recorded. Nothing to fix.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>What went wrong</TableHead>
                    <TableHead>Where</TableHead>
                    <TableHead className="text-right">Times</TableHead>
                    <TableHead className="text-right">Last seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.events.groupedErrors.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-md text-sm">
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
                      <TableCell className="whitespace-nowrap text-right text-sm text-muted-foreground" title={eat(e.last)}>
                        {timeAgo(e.last)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────────────── tab: Settings ───────────────────────── */

export function SettingsPanel({ m }: { m: Monitor }) {
  const d = m.diag;
  const missingRequired = d.env.filter((e) => e.required && !e.set);
  const missingOptional = d.env.filter((e) => !e.required && !e.set);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {missingRequired.length
          ? "Some required settings are missing — fix those first. Only whether a setting exists is shown, never its secret value."
          : "All required settings are in place. Only whether a setting exists is shown, never its secret value."}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {d.env.map((e) => {
          const tone: Tone = e.set ? "good" : e.required ? "bad" : "warn";
          return (
            <Card key={e.name}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg",
                        tone === "good" && "bg-success/12 text-success",
                        tone === "bad" && "bg-destructive/12 text-destructive",
                        tone === "warn" && "bg-warning/15 text-warning",
                      )}
                    >
                      <KeyRound className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{e.title}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{e.name}</p>
                    </div>
                  </div>
                  <Badge variant={e.set ? "success" : e.required ? "destructive" : "warning"}>
                    {e.set ? "Set" : e.required ? "Missing" : "Not set"}
                  </Badge>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{e.purpose}</p>
                {!e.set && (
                  <p
                    className={cn(
                      "mt-2.5 rounded-lg px-3 py-2 text-xs leading-relaxed",
                      e.required ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning",
                    )}
                  >
                    <span className="font-semibold">Because it is missing: </span>
                    {e.ifMissing}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {missingOptional.length > 0 && missingRequired.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {missingOptional.length} optional setting{missingOptional.length > 1 ? "s are" : " is"} not set. The system
          works without {missingOptional.length > 1 ? "them" : "it"}; the note on each card explains what you lose.
        </p>
      )}
    </div>
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
                <CardContent className="p-4">
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

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardContent className="p-0">
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
                        <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(log.createdAt)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3 lg:col-span-2">
          <InfoCallout icon={ShieldCheck} tone="good" title="Everything you do is on record">
            Your name is attached to every action, including when you work as someone else (it shows as “you as
            them”). The business owner is told, and these records cannot be edited or deleted — not even by you.
          </InfoCallout>
          <InfoCallout icon={KeyRound} tone="warn" title="What you cannot do while working as someone">
            Change passwords or login emails, create new accounts, or sign people out of all devices. This stops
            “work as” from being used to take over an account.
          </InfoCallout>
          <InfoCallout title="Good to know">
            Your session ends after 8 hours. Working as someone ends by itself after 4 hours. Build{" "}
            <span className="font-mono">{d.build.slice(0, 8)}</span> · Node {d.node} · {d.nodeEnv}.
          </InfoCallout>
        </div>
      </section>
    </div>
  );
}
