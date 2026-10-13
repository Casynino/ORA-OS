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
      <div className="mb-5 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-xs text-warning">
        Developer session — every action here is recorded under your own
        identity and is visible to the business owner. Sessions last 8 hours.
      </div>
      {children}
    </DashboardShell>
  );
}
