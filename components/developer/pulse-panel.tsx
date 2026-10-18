import { Banknote, Boxes, CheckCircle2, Receipt, ShoppingCart } from "lucide-react";
import { getPulse } from "@/lib/developer/pulse";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Legend, StackedBars, type Series } from "@/components/developer/charts";
import { formatCompactCurrency, formatNumber, humanize, timeAgo } from "@/lib/utils";

const QUEUE_LABEL: Record<string, { label: string; who: string }> = {
  sales: { label: "Sales waiting for Finance to approve", who: "Finance" },
  collections: { label: "Payments waiting to be verified", who: "Finance" },
  orders: { label: "Partner orders waiting to be priced or approved", who: "Owner / Finance" },
  fund: { label: "Operational fund requests", who: "Owner" },
  expenses: { label: "Recorded expenses to review", who: "Owner" },
  partners: { label: "New partners waiting for approval", who: "Owner" },
};
const ROLE_LABEL: Record<string, string> = { ADMIN: "Owner", FINANCE: "Finance", WAREHOUSE: "Warehouse", SALES_REP: "Sales reps", PARTNER: "Partners" };
const SALES_SERIES: Series[] = [
  { key: "APPROVED", label: "Approved", color: "hsl(var(--success))" },
  { key: "PENDING", label: "Waiting for approval", color: "hsl(var(--warning))" },
  { key: "REJECTED", label: "Rejected", color: "hsl(var(--destructive))" },
];
const shortDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const eat = (d: Date) =>
  `${new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Dar_es_Salaam", dateStyle: "medium", timeStyle: "short" }).format(d)} EAT`;

/** What is really going on in the business — read-only, streamed in so Home never waits for it. */
export async function PulsePanel() {
  const p = await getPulse();
  const waiting = p.queues.filter((q) => q.n > 0);
  const DAY = 86_400_000;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        What is happening in the business over the last 14 days, and what is waiting on people. Read-only.
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sales recorded" value={formatNumber(p.salesCount)} icon={ShoppingCart} accent="primary" hint={`${formatCompactCurrency(p.salesValue)} in value`} />
        <StatCard label="Money collected" value={formatCompactCurrency(p.moneyIn)} icon={Banknote} accent="success" hint="payments Finance approved" />
        <StatCard label="Expenses recorded" value={formatCompactCurrency(p.expenses)} icon={Receipt} accent="warning" hint="money going out" />
        <StatCard label="Stock movements" value={formatNumber(p.movesCount)} icon={Boxes} accent="info" hint="in, out and transfers" />
      </div>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold">Sales per day</h2>
            <p className="mb-3 text-xs text-muted-foreground">Sales recorded by the sales team, coloured by whether Finance has approved them.</p>
            <StackedBars
              data={p.salesSeries.map((d) => ({ label: d.day, values: { APPROVED: d.APPROVED, PENDING: d.PENDING, REJECTED: d.REJECTED } }))}
              series={SALES_SERIES}
              labelEvery={2}
              formatLabel={shortDay}
              height={170}
              emptyText="No sales recorded in the last 14 days."
            />
            <Legend series={SALES_SERIES} className="mt-4" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold">Stock movements per day</h2>
            <p className="mb-3 text-xs text-muted-foreground">Everything received, issued or transferred in the warehouses.</p>
            <StackedBars
              data={p.movesSeries.map((d) => ({ label: d.day, values: { n: d.n } }))}
              series={[{ key: "n", label: "Movements", color: "hsl(var(--info))" }]}
              labelEvery={3}
              formatLabel={shortDay}
              height={170}
              emptyText="No stock moved in the last 14 days."
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-0">
            <div className="border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold">Work waiting on people</h2>
              <p className="text-xs text-muted-foreground">Things that cannot move until someone acts. The oldest one shows how long it has waited.</p>
            </div>
            {waiting.length === 0 ? (
              <p className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-success" /> Nothing is waiting. Everyone is up to date.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {waiting.map((q) => {
                  const info = QUEUE_LABEL[q.k] ?? { label: humanize(q.k), who: "" };
                  const old = q.oldest ? Date.now() - new Date(q.oldest).getTime() > 3 * DAY : false;
                  return (
                    <li key={q.k} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">{info.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {info.who && <>For {info.who} · </>}
                          {q.oldest ? `oldest waiting ${timeAgo(q.oldest)}` : ""}
                        </p>
                      </div>
                      <Badge variant={old ? "warning" : "secondary"}>{q.n}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold">Oldest open alerts</h2>
              <p className="text-xs text-muted-foreground">Alerts that ask someone to act and are still open. An old one may be stuck.</p>
            </div>
            {p.openAlerts.length === 0 ? (
              <p className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-success" /> No open alerts.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {p.openAlerts.map((a) => (
                  <li key={a.id} className="px-5 py-2.5">
                    <p className="text-sm font-medium leading-snug">{a.title}</p>
                    <p className="text-xs text-muted-foreground" title={eat(a.createdAt)}>
                      To {a.user?.name ?? (a.role ? ROLE_LABEL[a.role] ?? humanize(a.role) : "everyone")} · {timeAgo(a.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-0">
            <div className="border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold">Team activity (7 days)</h2>
              <p className="text-xs text-muted-foreground">How much each kind of account is actually using the system.</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Who</TableHead>
                    <TableHead className="text-right">Accounts</TableHead>
                    <TableHead className="text-right">Signed in</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.team.map((t) => (
                    <TableRow key={t.role}>
                      <TableCell className="text-sm font-medium">{ROLE_LABEL[t.role] ?? humanize(t.role)}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.active}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={t.seen7 === 0 ? "text-warning" : ""}>{t.seen7}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(t.actions7)}</TableCell>
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
              <h2 className="text-sm font-semibold">How big the data is</h2>
              <p className="text-xs text-muted-foreground">Records in the system, and how many were added in the last 7 days.</p>
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
                  {p.growth.map((g) => (
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
      </section>

      <Card>
        <CardContent className="p-0">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold">Owner reports</h2>
            <p className="text-xs text-muted-foreground">The daily and monthly reports the system builds for the owner, and whether they reached WhatsApp.</p>
          </div>
          {p.reports.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No reports have been built yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {p.reports.map((r) => (
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
  );
}

export function PulseSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-muted/40" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-border bg-muted/40" />
    </div>
  );
}
