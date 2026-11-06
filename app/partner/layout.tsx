import { requireRole } from "@/lib/rbac";
import {
  DashboardShell,
  type NavGroup,
} from "@/components/dashboard/dashboard-shell";

const nav: NavGroup[] = [
  {
    items: [
      { href: "/partner", label: "Home", icon: "dashboard" },
      { href: "/partner/catalogue", label: "Catalogue", icon: "catalogue" },
    ],
  },
  {
    label: "Ordering",
    icon: "requests",
    items: [
      { href: "/partner/request", label: "Request", icon: "newRequest" },
      { href: "/partner/requests", label: "Orders", icon: "requests" },
    ],
  },
  {
    label: "Account",
    icon: "credit",
    items: [
      { href: "/partner/credit", label: "Credit", icon: "credit" },
      { href: "/partner/returns", label: "Returns", icon: "returns" },
      { href: "/partner/profile", label: "Profile", icon: "profile" },
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
      areaLabel="Partner"
      profileHref="/partner/profile"
    >
      {children}
    </DashboardShell>
  );
}
