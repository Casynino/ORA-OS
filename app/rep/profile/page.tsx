import { Phone, MapPin, Mail, BadgeCheck } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { PasswordForm, SignOutEverywhereButton } from "@/components/admin/profile-forms";

export const dynamic = "force-dynamic";

export default async function RepProfilePage() {
  const session = await requireRole("SALES_REP");
  const me = await prisma.user.findUnique({
    where: { id: session.id },
    select: { name: true, email: true, phone: true, region: true },
  });

  const rows = [
    { icon: BadgeCheck, label: "Name", value: me?.name },
    { icon: Mail, label: "Email", value: me?.email },
    { icon: Phone, label: "Phone", value: me?.phone },
    { icon: MapPin, label: "Territory", value: me?.region },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="My profile" description="Your account and security." />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</p>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <r.icon className="size-4" />
              </span>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{r.label}</dt>
                <dd className="truncate text-sm font-medium">{r.value || "—"}</dd>
              </div>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Need to change your name, phone or territory? Ask the ORA admin.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Change password</p>
        <div className="mt-3">
          <PasswordForm />
        </div>
        <div className="mt-4 border-t border-border/60 pt-4">
          <SignOutEverywhereButton />
        </div>
      </div>
    </div>
  );
}
