import { requireRole } from "@/lib/rbac";
import {
  DashboardShell,
  type NavGroup,
} from "@/components/dashboard/dashboard-shell";

// The Developer console is its own area: it never shares routes, navigation or
// permissions with the business dashboards, and only the DEVELOPER role gets in.
const nav: NavGroup[] = [
  {
    items: [
      { href: "/developer", label: "Home", icon: "dashboard" },
      { href: "/developer/audit", label: "Audit", icon: "audit" },
      { href: "/developer/users", label: "Access", icon: "roles" },
      { href: "/developer/records", label: "Business", icon: "reports" },
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
      profileHref="/developer/profile"
    >
      {children}
    </DashboardShell>
  );
}
