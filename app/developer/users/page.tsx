import { Banknote, Boxes, Lock, LogIn, LogOut, ShieldCheck, Store, UserX, Wallet, type LucideIcon } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { writeDevAuditSafe } from "@/lib/developer/audit";
import { devActivatableIds } from "@/lib/developer/eligibility";
import { canWorkAs } from "@/lib/developer/acting";
import { DevUserActions } from "@/components/developer/user-actions";
import { CreateAccountButton } from "@/components/developer/create-account";
import { InfoCallout, SectionTitle } from "@/components/developer/info";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { formatDateTime, formatNumber, humanize, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  ACTIVE: "success",
  PENDING: "warning",
  SUSPENDED: "destructive",
};

const GROUPS: { role: string; title: string; text: string; icon: LucideIcon }[] = [
  { role: "ADMIN", title: "Owner", text: "The business owner's account. Full control of money, staff and reports.", icon: ShieldCheck },
  { role: "FINANCE", title: "Finance", text: "Collects and checks payments, deposits cash and follows up debts.", icon: Wallet },
  { role: "WAREHOUSE", title: "Warehouse", text: "Receives, stores and hands out stock. No money powers.", icon: Boxes },
  { role: "SALES_REP", title: "Sales reps", text: "Sell in the field, collect payments and request stock.", icon: Banknote },
  { role: "PARTNER", title: "Partners", text: "Customers and distributors who order products.", icon: Store },
];

export default async function DeveloperUsersPage() {
  const me = await requireRole("DEVELOPER");
  const users = await prisma.user.findMany({
    where: { id: { not: me.id } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true, avatar: true },
  });
  const visible = users.filter((u) => u.role !== "DEVELOPER");
  const warehouses = await prisma.warehouse.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  // Only accounts the Developer console itself suspended can be re-activated here.
  const activatable = await devActivatableIds(
    visible.filter((u) => u.status === "SUSPENDED").map((u) => u.id),
  );

  await writeDevAuditSafe({
    actor: { id: me.id, name: me.name ?? "Developer" },
    action: "DEV_VIEW",
    entity: "User",
    summary: "Developer viewed the user access list.",
    outcome: "SUCCESS",
  });

  const groups = GROUPS.map((g) => ({ ...g, people: visible.filter((u) => u.role === g.role) })).filter(
    (g) => g.people.length > 0,
  );

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Access"
        description={`${formatNumber(visible.length)} accounts. Create a new login with “New account”, or pick a person and press “Work as” to open their dashboard exactly as they see it — without their password. Everything you do is recorded under your name.`}
      >
        <CreateAccountButton warehouses={warehouses} />
      </PageHeader>

      {/* What each button does, in plain words (after the people list on phones) */}
      <section className="order-last md:order-none">
        <SectionTitle title="What the buttons do" />
        <div className="grid gap-3 md:grid-cols-3">
          <InfoCallout icon={LogIn} tone="info" title="Work as">
            Opens that person&apos;s dashboard with their real permissions and data. A small pill in the corner shows who
            you are working as; press <strong className="text-foreground">Stop</strong> on it to come back here. It
            ends by itself after 4 hours.
          </InfoCallout>
          <InfoCallout icon={UserX} tone="warn" title="Suspend">
            Blocks the account and signs the person out until it is re-activated. You must write a reason and type
            CONFIRM. You can only re-activate accounts you suspended yourself.
          </InfoCallout>
          <InfoCallout icon={LogOut} tone="neutral" title="Sign out everywhere">
            Ends every open session on every phone and computer. The person can sign straight back in — useful if a
            phone was lost.
          </InfoCallout>
        </div>
        <InfoCallout icon={ShieldCheck} tone="good" className="mt-3" title="Safety rules while working as someone">
          You can&apos;t change passwords or login emails, create new accounts, or sign people out of all devices
          while working as them — so “Work as” can never be used to take over an account. The owner is told every
          time you start.
        </InfoCallout>
      </section>

      {/* People, grouped by what they do */}
      {groups.map((g) => {
        const Icon = g.icon;
        return (
          <section key={g.role}>
            <div className="mb-3 flex items-start gap-3">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold tracking-tight">
                  {g.title} <span className="font-sans text-sm font-normal text-muted-foreground">· {g.people.length}</span>
                </h2>
                <p className="text-sm text-muted-foreground">{g.text}</p>
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {g.people.map((u) => {
                    const isOwner = u.role === "ADMIN";
                    return (
                      <li
                        key={u.id}
                        className="flex flex-col gap-3 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="flex min-w-0 items-center gap-3.5">
                          <Avatar name={u.name} src={u.avatar} className="size-11 text-sm" />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold">{u.name}</p>
                              <Badge variant={STATUS_VARIANT[u.status] ?? "secondary"}>{humanize(u.status)}</Badge>
                              {isOwner && (
                                <Badge variant="default">
                                  <Lock className="mr-1 size-3" /> Owner
                                </Badge>
                              )}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                            <p
                              className="mt-0.5 text-xs text-muted-foreground"
                              title={u.lastLoginAt ? formatDateTime(u.lastLoginAt) : undefined}
                            >
                              {u.lastLoginAt ? `Last signed in ${timeAgo(u.lastLoginAt)}` : "Has never signed in"}
                            </p>
                          </div>
                        </div>
                        <div className="lg:shrink-0">
                          <DevUserActions
                            userId={u.id}
                            name={u.name}
                            role={u.role}
                            status={u.status}
                            canActivate={activatable.has(u.id)}
                            canWorkAs={canWorkAs(u, me.id)}
                            isOwner={isOwner}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </section>
        );
      })}
    </div>
  );
}
