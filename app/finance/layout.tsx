import { requireRole } from "@/lib/rbac";
import {
  DashboardShell,
  type NavGroup,
} from "@/components/dashboard/dashboard-shell";

// Finance & Accounting — the CEO's financial operations team. Finance
// collects, verifies, deposits and documents money and manages customer
// debt; the CEO owns all company accounts. No account management, no
// payroll (handled by the CEO), no user/system/warehouse control.
const nav: NavGroup[] = [
  { items: [{ href: "/finance", label: "Dashboard", icon: "dashboard" }] },
  {
    label: "Customers",
    items: [
      { href: "/finance/customers", label: "Customers", icon: "customers" },
      { href: "/finance/applications", label: "Applications", icon: "customers" },
      { href: "/finance/partners", label: "Partners", icon: "customers" },
    ],
  },
  {
    label: "Verify",
    items: [
      { href: "/finance/sales-approvals", label: "Sales approvals", icon: "sales" },
      { href: "/finance/payments", label: "Payments", icon: "payments" },
      { href: "/finance/returns", label: "Returns", icon: "warehouses" },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/finance/cash", label: "Cash & deposits", icon: "settlements" },
      { href: "/finance/operational-fund", label: "Operational Fund", icon: "finance" },
    ],
  },
  {
    label: "Credit",
    items: [{ href: "/finance/credit", label: "Debts & settlements", icon: "credit" }],
  },
  {
    label: "Reports",
    items: [{ href: "/finance/reports", label: "Reports", icon: "reports" }],
  },
];

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("FINANCE");
  return (
    <DashboardShell
      nav={nav}
      user={{ name: user.name, email: user.email, role: user.role }}
      areaLabel="Finance & Accounting"
    >
      {children}
    </DashboardShell>
  );
}
