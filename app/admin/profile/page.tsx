import { notFound } from "next/navigation";
import {
  ShieldCheck,
  Crown,
  Warehouse,
  Users,
  BadgeCheck,
  CalendarDays,
  Clock,
  Monitor,
  Smartphone,
  KeyRound,
  Activity as ActivityIcon,
  Palette,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  ProfileForm,
  PasswordForm,
  SignOutEverywhereButton,
} from "@/components/admin/profile-forms";
import { formatDate, formatDateTime, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

function deviceLabel(ua: string | null): { label: string; mobile: boolean } {
  if (!ua) return { label: "Unknown device", mobile: false };
  const mobile = /mobile|iphone|android/i.test(ua);
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /chrome\//i.test(ua)
      ? "Chrome"
      : /safari\//i.test(ua)
        ? "Safari"
        : /firefox\//i.test(ua)
          ? "Firefox"
          : "Browser";
  const os = /windows/i.test(ua)
    ? "Windows"
    : /mac os/i.test(ua)
      ? "macOS"
      : /android/i.test(ua)
        ? "Android"
        : /iphone|ipad|ios/i.test(ua)
          ? "iOS"
          : /linux/i.test(ua)
            ? "Linux"
            : "";
  return { label: [browser, os].filter(Boolean).join(" · "), mobile };
}

export default async function AdminProfilePage() {
  const session = await requireRole("ADMIN");

  const [me, warehouses, partners, reps, logins, activity] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.id } }),
    prisma.warehouse.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: "PARTNER", status: "ACTIVE" } }),
    prisma.user.count({ where: { role: "SALES_REP" } }),
    prisma.loginEvent.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.activityLog.findMany({
      where: { actorId: session.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);
  if (!me) notFound();

  const exec = [
    { label: "Managed warehouses", value: warehouses, icon: Warehouse },
    { label: "Managed partners", value: partners, icon: Users },
    { label: "Sales representatives", value: reps, icon: BadgeCheck },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My profile"
        description="Your executive profile — everything here reflects across the whole system instantly."
      />

      {/* Executive header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-accent to-primary p-5 text-white shadow-glow sm:p-7">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="relative flex flex-wrap items-center gap-4 sm:gap-5">
          <Avatar
            name={me.name}
            src={me.avatar}
            className="size-16 border-2 border-white/60 text-xl sm:size-20"
          />
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {me.name}
              {me.preferredName ? (
                <span className="font-normal text-white/80"> ({me.preferredName})</span>
              ) : null}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/85">
              <Crown className="size-4" />
              {me.position || "Chief Administrator"} · ORA Operating System
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Badge className="border-transparent bg-white/20 text-white">
                <ShieldCheck className="mr-1 size-3" />
                Full system access
              </Badge>
              <Badge className="border-transparent bg-white/20 text-white">
                Unlimited permissions
              </Badge>
              <Badge className="border-transparent bg-white/20 text-white">
                <CalendarDays className="mr-1 size-3" />
                Since {formatDate(me.createdAt)}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Executive numbers */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {exec.map((e) => (
          <div key={e.label} className="glass-card flex items-center gap-3.5 rounded-2xl p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white">
              <e.icon className="size-5" />
            </span>
            <div>
              <p className="font-display text-2xl font-bold leading-none">{e.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{e.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Personal information */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <h2 className="font-display text-lg font-semibold">Personal information</h2>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">
          Your name, photo and contacts — used in the greeting, navigation,
          approvals and activity logs.
        </p>
        <ProfileForm
          initial={{
            name: me.name,
            preferredName: me.preferredName ?? "",
            email: me.email,
            phone: me.phone ?? "",
            position: me.position ?? "",
            avatar: me.avatar ?? "",
          }}
        />
      </section>

      {/* Security */}
      <section
        id="security"
        className="scroll-mt-20 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6"
      >
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <KeyRound className="size-4 text-primary" />
          Security
        </h2>
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Change password
            </h3>
            <PasswordForm />
            <div className="mt-6 border-t border-border pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                All devices
              </h3>
              <p className="mb-3 text-sm text-muted-foreground">
                Lost a device or shared a laptop? End every active session at once.
              </p>
              <SignOutEverywhereButton />
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Login history
            </h3>
            {me.lastLoginAt && (
              <p className="mb-2.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-3.5" />
                Last login {timeAgo(me.lastLoginAt)}
              </p>
            )}
            <div className="space-y-2">
              {logins.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Sign-ins will appear here from now on.
                </p>
              ) : (
                logins.map((l) => {
                  const d = deviceLabel(l.userAgent);
                  return (
                    <div
                      key={l.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3"
                    >
                      <span className="flex min-w-0 items-center gap-2.5 text-sm">
                        {d.mobile ? (
                          <Smartphone className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <Monitor className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{d.label}</span>
                          {l.ip && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {l.ip}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDateTime(l.createdAt)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Preferences + recent activity */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Palette className="size-4 text-primary" />
            Preferences
          </h2>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border/60 p-3.5">
            <div>
              <p className="text-sm font-medium">Appearance</p>
              <p className="text-xs text-muted-foreground">Light or dark — your choice follows you.</p>
            </div>
            <ThemeToggle />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Times across the system are shown in Tanzania time (EAT).
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <ActivityIcon className="size-4 text-primary" />
            My recent activity
          </h2>
          <div className="mt-4 space-y-2">
            {activity.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Your actions across ORA will appear here.
              </p>
            ) : (
              activity.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/60 p-3">
                  <p className="min-w-0 text-sm">{a.summary}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {timeAgo(a.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
