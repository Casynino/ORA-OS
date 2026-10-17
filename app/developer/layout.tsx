import { requireRole } from "@/lib/rbac";
import {
  DashboardShell,
  type NavGroup,
} from "@/components/dashboard/dashboard-shell";

// The Developer console is its own area: it never shares routes, navigation or
// permissions with the business dashboards, and only the DEVELOPER role gets in.
const nav: NavGroup[] = [
  {
    // Ordered from the safest (just looking) to the most powerful (changing access).
    items: [
      { href: "/developer", label: "Home", icon: "dashboard" },
      { href: "/developer/records", label: "Business", icon: "reports" },
      { href: "/developer/audit", label: "Audit", icon: "audit" },
      { href: "/developer/users", label: "Access", icon: "roles" },
    ],
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
      {children}
    </DashboardShell>
  );
}
