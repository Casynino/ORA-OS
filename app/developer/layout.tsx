import { ShieldCheck } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import {
  DashboardShell,
  type NavGroup,
} from "@/components/dashboard/dashboard-shell";

// The Developer console is its own area: it never shares routes, navigation or
// permissions with the business dashboards, and only the DEVELOPER role gets in.
const nav: NavGroup[] = [
  { items: [{ href: "/developer", label: "Overview", icon: "dashboard" }] },
  {
    label: "Investigate",
    items: [
      { href: "/developer/monitor", label: "System monitor", icon: "activity" },
      { href: "/developer/records", label: "Records (read-only)", icon: "reports" },
      { href: "/developer/audit", label: "Audit log", icon: "audit" },
    ],
  },
  {
    label: "Access",
    items: [{ href: "/developer/users", label: "User access", icon: "users" }],
  },
];

export default async function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole("DEVELOPER");
  return (
    <DashboardShell
      nav={nav}
      user={{
        name: session.name,
        email: session.email,
        role: session.role,
        avatar: session.avatar ?? null,
      }}
      areaLabel="Developer Console"
    >
      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-xs leading-relaxed text-warning sm:items-center">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 sm:mt-0" />
        <span>
          <strong className="font-semibold">Developer session.</strong> Everything you do here is saved under your own
          name and the business owner can see it. Your session ends after 8 hours.
        </span>
      </div>
      {children}
    </DashboardShell>
  );
}
