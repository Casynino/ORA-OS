import { requireRole } from "@/lib/rbac";
import {
  DashboardShell,
  type NavGroup,
} from "@/components/dashboard/dashboard-shell";

const nav: NavGroup[] = [
  { items: [{ href: "/partner", label: "Overview", icon: "dashboard" }] },
  {
    label: "Ordering",
    items: [
      { href: "/partner/catalogue", label: "Catalogue", icon: "catalogue" },
      { href: "/partner/request", label: "New request", icon: "newRequest" },
      { href: "/partner/requests", label: "My orders", icon: "requests" },
    ],
  },
  {
    label: "Finance & support",
    items: [
      { href: "/partner/credit", label: "Credit & payments", icon: "credit" },
      { href: "/partner/returns", label: "Returns", icon: "returns" },
      { href: "/partner/profile", label: "My profile", icon: "profile" },
    ],
  },
];

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("PARTNER");
  return (
    <DashboardShell
      nav={nav}
      user={{ name: user.name, email: user.email, role: user.role }}
      areaLabel="Partner Portal"
      profileHref="/partner/profile"
    >
      {children}
    </DashboardShell>
  );
}
