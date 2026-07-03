import { requireRole } from "@/lib/rbac";
import {
  DashboardShell,
  type NavGroup,
} from "@/components/dashboard/dashboard-shell";

const nav: NavGroup[] = [
  { items: [{ href: "/rep", label: "Overview", icon: "dashboard" }] },
  {
    label: "Field work",
    items: [
      { href: "/rep/sell", label: "Record sale", icon: "sales" },
      { href: "/rep/samples", label: "Samples", icon: "samples" },
      { href: "/rep/reports", label: "Field reports", icon: "fieldReports" },
    ],
  },
  {
    label: "My book",
    items: [
      { href: "/rep/stock", label: "My stock", icon: "inventory" },
      { href: "/rep/customers", label: "Customers & credit", icon: "customers" },
      { href: "/rep/targets", label: "My targets", icon: "targets" },
    ],
  },
];

export default async function RepLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("SALES_REP");
  return (
    <DashboardShell
      nav={nav}
      user={{ name: user.name, email: user.email, role: user.role }}
      areaLabel="Sales Rep"
    >
      {children}
    </DashboardShell>
  );
}
