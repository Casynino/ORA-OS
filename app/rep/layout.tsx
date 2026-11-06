import { requireRole } from "@/lib/rbac";
import {
  DashboardShell,
  type NavGroup,
} from "@/components/dashboard/dashboard-shell";

const nav: NavGroup[] = [
  {
    items: [
      { href: "/rep", label: "Home", icon: "dashboard" },
      { href: "/rep/sell", label: "Sell", icon: "sales" },
      { href: "/rep/stock", label: "Stock", icon: "inventory" },
    ],
  },
  {
    label: "Customers",
    icon: "customers",
    items: [
      { href: "/rep/customers", label: "Customers", icon: "customers" },
      { href: "/rep/customers/new", label: "Register", icon: "newRequest" },
    ],
  },
  {
    label: "Sales",
    icon: "reports",
    items: [
      { href: "/rep/sales", label: "History", icon: "reports" },
      { href: "/rep/samples", label: "Samples", icon: "samples" },
    ],
  },
  {
    label: "Stock",
    icon: "inventory",
    items: [
      { href: "/rep/stock/request", label: "Request", icon: "newRequest" },
      { href: "/rep/stock/requests", label: "History", icon: "requests" },
    ],
  },
  {
    label: "Collections",
    items: [
      { href: "/rep/collections", label: "Collections", icon: "credit" },
    ],
  },
  {
    label: "Reports",
    icon: "fieldReports",
    items: [
      { href: "/rep/reports", label: "Daily", icon: "fieldReports" },
      { href: "/rep/targets", label: "Targets", icon: "targets" },
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
      areaLabel="Rep"
    >
      {children}
    </DashboardShell>
  );
}
