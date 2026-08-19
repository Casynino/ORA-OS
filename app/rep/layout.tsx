import { requireRole } from "@/lib/rbac";
import {
  DashboardShell,
  type NavGroup,
} from "@/components/dashboard/dashboard-shell";

const nav: NavGroup[] = [
  { items: [{ href: "/rep", label: "Dashboard", icon: "dashboard" }] },
  {
    label: "Customers",
    items: [
      { href: "/rep/customers", label: "My customers", icon: "customers" },
      { href: "/rep/customers/new", label: "Register customer", icon: "newRequest" },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/rep/sell", label: "Record sale", icon: "sales" },
      { href: "/rep/sales", label: "Sales history", icon: "reports" },
      { href: "/rep/samples", label: "Samples", icon: "samples" },
    ],
  },
  {
    label: "Stock",
    items: [
      { href: "/rep/stock", label: "My stock", icon: "inventory" },
      { href: "/rep/stock/request", label: "Request stock", icon: "newRequest" },
      { href: "/rep/stock/requests", label: "Request history", icon: "requests" },
    ],
  },
  {
    label: "Collections",
    items: [
      { href: "/rep/collections", label: "Credit customers", icon: "credit" },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/rep/reports", label: "Daily reports", icon: "fieldReports" },
      { href: "/rep/targets", label: "My targets", icon: "targets" },
    ],
  },
  { items: [{ href: "/rep/profile", label: "Profile", icon: "profile" }] },
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
