import { AlertTriangle, CheckCircle2, Clock, Database, Info, Smartphone, Monitor as Desktop, UserX, Users, XCircle, type LucideIcon } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { getMonitor, type Level } from "@/lib/developer/monitor";
import { writeDevAuditSafe } from "@/lib/developer/audit";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { HealthCard, InfoCallout, SectionTitle } from "@/components/developer/info";
import { HBars, Legend, ScoreRing, SpeedBars, StackedBars, type Series } from "@/components/developer/charts";
import { EnableTrackingButton } from "@/components/developer/enable-tracking";
import { cn, formatNumber, humanize, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

const shortDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
/** Hover text for times: always Tanzania time, clearly labelled. */
const eat = (d: Date) =>
  `${new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Dar_es_Salaam", dateStyle: "medium", timeStyle: "short" }).format(d)} EAT`;
const bytes = (n: number) =>
  n >= 1073741824 ? `${(n / 1073741824).toFixed(2)} GB` : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export default async function MonitorPage() {
  const me = await requireRole("DEVELOPER");
  const m = await getMonitor();

  await writeDevAuditSafe({
    actor: { id: me.id, name: me.name ?? "Developer" },
    action: "DEV_VIEW",
    entity: "System",
    summary: "Developer viewed the system monitor.",
    outcome: "SUCCESS",
  });

  const crit = m.problems.filter((p) => p.level === "critical").length;
  const warn = m.problems.filter((p) => p.level === "warning").length;
  const headline = crit ? "Needs attention now" : warn ? "Working, but a few things need a look" : m.problems.length ? "Healthy" : "Everything is healthy";
  const peakHour = m.hourSeries.reduce((a, b) => (b.n > a.n ? b : a), m.hourSeries[0]);
  const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;
  const totalActions14 = m.activitySeries.reduce((s, d) => s + d.staff, 0);
  const totalLogins14 = m.loginSeries.reduce((s, d) => s + ROLE_SERIES.reduce((x, r) => x + (d[r.key as keyof typeof d] as number), 0), 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="System monitor"
        description="Is the system healthy, how fast is it, and who is using it? Everything here is read live from the system and explained in plain words."
      />

      {/* 1 · Score + problems */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <ScoreRing score={m.score} />
            <div>
              <p className="font-display text-lg font-semibold">{headline}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                The score starts at 100 and drops for each problem found: a lot for something broken, a little for
                something to keep an eye on.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              <Badge variant={crit ? "destructive" : "secondary"}>{crit} to fix now</Badge>
              <Badge variant={warn ? "warning" : "secondary"}>{warn} to look at</Badge>
              <Badge variant="secondary">{m.problems.length - crit - warn} for information</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3 lg:col-span-2">
          <SectionTitle title="Problems found" className="mb-0" text="Checked just now. Each one says what it means and what to do." />
          {m.problems.length === 0 ? (
            <InfoCallout icon={CheckCircle2} tone="good" title="No problems found">
              The database answers quickly, every required setting is in place, nothing has crashed, and no sign-in
              looks suspicious.
            </InfoCallout>
          ) : (
            m.problems.map((p) => {
              const l = LEVEL[p.level];
              const Icon = l.icon;
              return (
                <div key={p.title} className={cn("flex items-start gap-3 rounded-xl border p-4", l.box)}>
                  <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", l.chip)}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 text-sm leading-relaxed">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{p.title}</p>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", l.chip)}>{l.label}</span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">{p.detail}</p>
                    <p className="mt-1 text-xs text-foreground/80">
                      <span className="font-semibold">What to do: </span>
                      {p.hint}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 2 · Usage at a glance */}
      <section>
        <SectionTitle title="Who is using the system" text="Counts of different people who signed in, and what they did." />
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
            meaning={`Every sale, payment, approval or stock move counts as one action. Busiest hour: ${peakHour.n > 0 ? `${hourLabel(peakHour.hour)} (Tanzania time)` : "not enough data yet"}.`}
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
            meaning="A few typing mistakes are normal. Many in a day can mean someone is guessing passwords. Details are in the table further down."
          />
        </div>
      </section>

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

      {/* 3 · Performance */}
      <section>
        <SectionTitle
          title="Speed and size"
          text="Real queries timed right now against the live database, and how big the database has grown."
        />
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
      </section>

      {/* 4 · Errors */}
      <section>
        <SectionTitle
          title="Crashes and failed sign-ins"
          text="Server errors (a page that crashed) and sign-ins that were refused. This is how you hear about a problem before staff complain."
        />
        {!m.tracking ? (
          <InfoCallout icon={AlertTriangle} tone="warn" title="Error tracking is not switched on yet">
            <p>
              Right now a crash on someone&apos;s screen would leave no record here. Switching it on creates one small table
              for technical events. It never touches business data and can be done once, safely.
            </p>
            <div className="mt-3">
              <EnableTrackingButton />
            </div>
          </InfoCallout>
        ) : (
          <div className="space-y-4">
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
                            <TableCell className="max-w-md text-sm">{e.message}</TableCell>
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
        )}
      </section>
    </div>
  );
}
