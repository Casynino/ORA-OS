import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Banknote,
  Boxes,
  CheckCircle2,
  Database,
  KeyRound,
  LogIn,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Store,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { getDiagnostics } from "@/lib/developer/diagnostics";
import { DashboardHero } from "@/components/ui/dashboard-hero";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HealthCard, InfoCallout, QuickLink, SectionTitle, type Tone } from "@/components/developer/info";
import { cn, formatDateTime, formatNumber, humanize, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

export default async function DeveloperOverviewPage() {
  const me = await requireRole("DEVELOPER");
  const d = await getDiagnostics();

  const missingRequired = d.env.filter((e) => e.required && !e.set);
  const missingOptional = d.env.filter((e) => !e.required && !e.set);
  const totalUsers = d.usersByRole.reduce((s, r) => s + r._count._all, 0);

  // Group the (role, status) counts into one card per role.
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

  // One honest sentence about overall health.
  const attention: string[] = [];
  if (!d.dbOk) attention.push("the database cannot be reached");
  if (missingRequired.length)
    attention.push(`${missingRequired.length} required setting${missingRequired.length > 1 ? "s are" : " is"} missing`);
  if (d.dbOk && !d.pooled) attention.push("the database link is not the pooled one");
  if (d.failedDevLogins24h > 0)
    attention.push(`${d.failedDevLogins24h} failed Developer sign-in${d.failedDevLogins24h > 1 ? "s" : ""} in the last 24 hours`);
  if (d.stuckAlerts > 0)
    attention.push(`${d.stuckAlerts} alert${d.stuckAlerts > 1 ? "s have" : " has"} waited over a day`);
  const overall: Tone = !d.dbOk || missingRequired.length ? "bad" : attention.length ? "warn" : "good";
  const firstName = me.preferredName || (me.name ?? "Developer").split(" ")[0];

  // Greeting + date (Tanzania time, EAT) — same as the Admin dashboard.
  const eatHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Dar_es_Salaam", hour: "2-digit", hour12: false }).format(new Date()),
  );
  const greeting = eatHour >= 5 && eatHour < 12 ? "Good morning" : eatHour >= 12 && eatHour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Dar_es_Salaam", weekday: "long", month: "long", day: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-8">
      <DashboardHero
        eyebrow={dateLabel}
        pill="Developer"
        title={<>{greeting}, {firstName}.</>}
        subtitle="Your control room for ORA — health, people and everything done, in one place."
      />

      {/* Overall status */}
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border p-4",
          overall === "good" && "border-success/25 bg-success/10",
          overall === "warn" && "border-warning/30 bg-warning/10",
          overall === "bad" && "border-destructive/30 bg-destructive/10",
        )}
      >
        <span
          className={cn(
            "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl",
            overall === "good" && "bg-success/15 text-success",
            overall === "warn" && "bg-warning/20 text-warning",
            overall === "bad" && "bg-destructive/15 text-destructive",
          )}
        >
          {overall === "good" ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
        </span>
        <div className="min-w-0 text-sm">
          <p className="font-semibold">
            {overall === "good"
              ? "Everything looks healthy"
              : overall === "warn"
                ? "Working, but a few things need a look"
                : "Needs attention now"}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {attention.length
              ? `Reason: ${attention.join("; ")}. Details are in the cards below.`
              : "The database is reachable, every required setting is in place, and nothing is waiting too long."}{" "}
            <Link href="/developer/monitor" className="font-medium text-primary hover:underline">
              See the full report
            </Link>
          </p>
        </div>
      </div>

      {/* Where to go */}
      <section>
        <SectionTitle title="What do you want to do?" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <QuickLink
            href="/developer/monitor"
            icon={Activity}
            title="Open system health"
            text="Charts of who signs in and how busy it is, how fast the system is, and a plain list of any problems found."
          />
          <QuickLink
            href="/developer/users"
            icon={LogIn}
            title="Work as a team member"
            text="Open the dashboard of the owner, a team member or a partner to help them or to see exactly what they see. Every click is recorded under your name."
          />
          <QuickLink
            href="/developer/audit"
            icon={ScrollText}
            title="Read the audit trail"
            text="The permanent diary of everything done in the system — by staff and by you. Records here can never be edited or deleted."
          />
          <QuickLink
            href="/developer/records"
            icon={BarChart3}
            title="Look at business records"
            text="See sales, payments, stock and customers in read-only tables. Good for checking a number without risking a change."
          />
        </div>
      </section>

      {/* Health */}
      <section>
        <SectionTitle
          title="System health"
          text="Four quick checks. Each card says what the number is and what to do about it."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HealthCard
            label="Database"
            value={d.dbOk ? "Online" : "Down"}
            detail={
              d.dbOk
                ? `Answers in ${d.dbMs} ms · ${d.pooled ? "pooled link" : "NOT the pooled link"}`
                : "Cannot reach the database"
            }
            tone={!d.dbOk ? "bad" : d.pooled ? "good" : "warn"}
            statusText={!d.dbOk ? "Down" : d.pooled ? "Healthy" : "Check link"}
            icon={Database}
            meaning={
              d.dbOk
                ? "The website can reach its database right now. Under about 100 ms is healthy. “Pooled” means it uses the shared link made for many people at once."
                : "People cannot sign in or load pages. Check the database provider (Neon) and the DATABASE_URL setting below."
            }
          />
          <HealthCard
            label="Activity (24h)"
            value={formatNumber(d.activity24h)}
            detail="actions saved in the last 24 hours"
            tone="info"
            statusText="For information"
            icon={Activity}
            meaning="Each sale, payment, approval or stock move is saved as one line in the audit log. A very low number on a working day can mean the team cannot sign in."
          />
          <HealthCard
            label="Failed Developer sign-ins"
            value={formatNumber(d.failedDevLogins24h)}
            detail={d.lastDevLogin ? `Last good sign-in ${formatDateTime(d.lastDevLogin)}` : "No sign-ins yet"}
            tone={d.failedDevLogins24h > 0 ? "warn" : "good"}
            statusText={d.failedDevLogins24h > 0 ? "Look at it" : "None"}
            icon={ShieldAlert}
            meaning="Wrong-password tries on your Developer account in the last 24 hours. One or two typos are normal. Many means someone may be guessing — after 5 wrong tries from one place the account locks for 15 minutes."
          />
          <HealthCard
            label="Alerts waiting too long"
            value={formatNumber(d.stuckAlerts)}
            detail={`${formatNumber(d.openActions)} waiting for someone in total`}
            tone={d.stuckAlerts > 0 ? "warn" : "good"}
            statusText={d.stuckAlerts > 0 ? "Look at it" : "All clear"}
            icon={AlertTriangle}
            meaning="Alerts that ask a person to act (approve a sale, receive stock) and have waited more than a day. Zero is good. A high number means work is stuck — or an alert that never cleared."
          />
        </div>
      </section>

      {/* Settings */}
      <section>
        <SectionTitle
          title="Settings the system depends on"
          text={
            missingRequired.length
              ? "Some required settings are missing — fix those first. Only whether a setting exists is shown, never its secret value."
              : "All required settings are in place. Only whether a setting exists is shown, never its secret value."
          }
        />
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
          <p className="mt-2 text-xs text-muted-foreground">
            {missingOptional.length} optional setting{missingOptional.length > 1 ? "s are" : " is"} not set. The system
            works without {missingOptional.length > 1 ? "them" : "it"}; the note on each card explains what you lose.
          </p>
        )}
      </section>

      {/* People */}
      <section>
        <SectionTitle
          title={`People · ${formatNumber(totalUsers)} accounts`}
          text="Who has an account, grouped by what they do. Open People & access to work as any of them."
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
                    {c.pending > 0 && <Badge variant="warning">{c.pending} waiting for approval</Badge>}
                    {c.suspended > 0 && <Badge variant="destructive">{c.suspended} suspended</Badge>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Recent developer activity + how it works */}
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
                  const m = (log.meta ?? {}) as { outcome?: string };
                  const tone: Tone = m.outcome === "FAILED" ? "bad" : "info";
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
