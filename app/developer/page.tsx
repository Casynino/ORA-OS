import { BarChart3, ScrollText } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getMonitor } from "@/lib/developer/monitor";
import { ensureErrorTracking } from "@/lib/developer/tracking";
import { DashboardHero } from "@/components/ui/dashboard-hero";
import { QuickLink } from "@/components/developer/info";
import { CreateAccountButton } from "@/components/developer/create-account";
import { WorkAsCard } from "@/components/developer/work-as-picker";
import { canWorkAs } from "@/lib/developer/acting";
import {
  ActivityPanel,
  ErrorsPanel,
  Attention,
  HomeSection,
  JumpBar,
  PeoplePanel,
  SettingsPanel,
  SpeedPanel,
  StatusStrip,
} from "@/components/developer/home-sections";

export const dynamic = "force-dynamic";

export default async function DeveloperHomePage() {
  const me = await requireRole("DEVELOPER");
  // The Developer's job is to see what is wrong, so crash recording must be on.
  await ensureErrorTracking({ id: me.id, name: me.name ?? "Developer" });
  const [m, warehouses, accounts] = await Promise.all([
    getMonitor(),
    prisma.warehouse.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { status: "ACTIVE", id: { not: me.id } },
      select: { id: true, name: true, role: true, status: true, avatar: true },
    }),
  ]);
  // Only the people the Developer is allowed to work as (active, not another Developer).
  const people = accounts
    .filter((u) => canWorkAs(u, me.id))
    .map((u) => ({ id: u.id, name: u.name, role: u.role as string, avatar: u.avatar }));
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



  return (
    <div className="space-y-10">
      <DashboardHero
        eyebrow={dateLabel}
        pill="Developer"
        title={<>{greeting}, {firstName}.</>}
        subtitle="Your control room for ORA — health, people and everything done, in one place."
      />

      {/* The things you do most: four plain tiles */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <WorkAsCard people={people} />
        <CreateAccountButton warehouses={warehouses} tone="tile" />
        <QuickLink href="/developer/audit" icon={ScrollText} title="Audit" text="Everything done" />
        <QuickLink href="/developer/records" icon={BarChart3} title="Business" text="Sales and stock" />
      </section>

      {/* Verdict + live numbers in one compact panel, then what needs attention */}
      <StatusStrip m={m} />
      <Attention m={m} />

      <JumpBar
        items={[
          { id: "activity", label: "Activity" },
          { id: "errors", label: "Crashes & sign-ins", badge: errorsBadge },
          { id: "speed", label: "Speed & size" },
          { id: "settings", label: "Settings", badge: missing > 0 ? String(missing) : null },
          { id: "people", label: "People" },
        ]}
      />

      {/* Everything else, on this one page: Activity right under the attention list, then crashes, speed, settings, people */}
      <HomeSection id="activity" title="Activity" description="Who is using the system, and what they are doing.">
        <ActivityPanel m={m} />
      </HomeSection>
      <HomeSection
        id="errors"
        title="Crashes & sign-ins"
        badge={errorsBadge}
        tone={!m.tracking ? "warn" : m.events.errors24 > 0 ? "bad" : "warn"}
      >
        <ErrorsPanel m={m} />
      </HomeSection>
      <HomeSection id="speed" title="Speed & size" badge={`${m.avgMs} ms`} tone={m.avgMs >= 400 ? "bad" : m.avgMs >= 150 ? "warn" : "neutral"}>
        <SpeedPanel m={m} />
      </HomeSection>
      <HomeSection id="settings" title="Settings" badge={missing > 0 ? `${missing} missing` : null} tone="bad">
        <SettingsPanel m={m} />
      </HomeSection>
      <HomeSection id="people" title="People & my actions">
        <PeoplePanel m={m} />
      </HomeSection>
    </div>
  );
}
