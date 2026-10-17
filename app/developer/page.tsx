import { Activity, AlertTriangle, BarChart3, Database, LogIn, ScrollText, Users } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { getMonitor } from "@/lib/developer/monitor";
import { DashboardHero } from "@/components/ui/dashboard-hero";
import { StatCard } from "@/components/ui/stat-card";
import { QuickLink } from "@/components/developer/info";
import { HomeTabs, type HomeTab } from "@/components/developer/home-tabs";
import {
  ActivityPanel,
  ErrorsPanel,
  PeoplePanel,
  ScoreAndProblems,
  SettingsPanel,
  SpeedPanel,
} from "@/components/developer/home-sections";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DeveloperHomePage() {
  const me = await requireRole("DEVELOPER");
  const m = await getMonitor();
  const d = m.diag;

  const firstName = me.preferredName || (me.name ?? "Developer").split(" ")[0];
  // Greeting + date (Tanzania time, EAT) — same as the Admin home.
  const eatHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Dar_es_Salaam", hour: "2-digit", hour12: false }).format(new Date()),
  );
  const greeting = eatHour >= 5 && eatHour < 12 ? "Good morning" : eatHour >= 12 && eatHour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Dar_es_Salaam", weekday: "long", month: "long", day: "numeric",
  }).format(new Date());

  const missing = d.env.filter((e) => !e.set && e.required).length;
  const errorsBadge = !m.tracking ? "Off" : m.events.errors24 + m.events.failed24 > 0 ? String(m.events.errors24 + m.events.failed24) : null;

  const tabs: HomeTab[] = [
    { id: "activity", label: "Activity" },
    { id: "speed", label: "Speed & size", badge: `${m.avgMs} ms`, tone: m.avgMs >= 400 ? "bad" : m.avgMs >= 150 ? "warn" : "neutral" },
    { id: "errors", label: "Crashes & sign-ins", badge: errorsBadge, tone: !m.tracking ? "warn" : m.events.errors24 > 0 ? "bad" : "warn" },
    { id: "settings", label: "Settings", badge: missing > 0 ? String(missing) : null, tone: "bad" },
    { id: "people", label: "People & my actions" },
  ];

  return (
    <div className="space-y-8">
      <DashboardHero
        eyebrow={dateLabel}
        pill="Developer"
        title={<>{greeting}, {firstName}.</>}
        subtitle="Your control room for ORA — health, people and everything done, in one place."
      />

      {/* The verdict first: is anything wrong? */}
      <ScoreAndProblems m={m} />

      {/* Live pulse */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Database"
          value={d.dbOk ? "Online" : "Down"}
          icon={Database}
          accent={d.dbOk ? "success" : "warning"}
          hint={d.dbOk ? `${d.dbMs} ms · ${d.pooled ? "pooled link" : "NOT pooled"}` : "Cannot reach the database"}
        />
        <StatCard label="Signed in today" value={formatNumber(m.signedIn24)} icon={Users} accent="info" hint="different people, 24 hours" />
        <StatCard label="Actions today" value={formatNumber(d.activity24h)} icon={Activity} accent="primary" hint="saved in the last 24 hours" />
        <StatCard
          label="Alerts waiting"
          value={formatNumber(d.openActions)}
          icon={AlertTriangle}
          accent={d.stuckAlerts > 0 ? "warning" : "success"}
          hint={d.stuckAlerts > 0 ? `${d.stuckAlerts} waiting over a day` : "none waiting too long"}
        />
      </section>

      {/* Where to go */}
      <section className="grid gap-3 md:grid-cols-3">
        <QuickLink
          href="/developer/users"
          icon={LogIn}
          title="Work as a team member"
          text="Open the dashboard of the owner, a team member or a partner to help them or to see what they see. Every click is recorded under your name."
        />
        <QuickLink
          href="/developer/audit"
          icon={ScrollText}
          title="Read the audit trail"
          text="The permanent diary of everything done in the system — by staff and by you. It can never be edited or deleted."
        />
        <QuickLink
          href="/developer/records"
          icon={BarChart3}
          title="Look at business records"
          text="See sales, payments, stock and customers in read-only tables. Good for checking a number without risking a change."
        />
      </section>

      {/* The detail, one tab at a time */}
      <HomeTabs
        tabs={tabs}
        initial="activity"
        panels={{
          activity: <ActivityPanel m={m} />,
          speed: <SpeedPanel m={m} />,
          errors: <ErrorsPanel m={m} />,
          settings: <SettingsPanel m={m} />,
          people: <PeoplePanel m={m} />,
        }}
      />
    </div>
  );
}
