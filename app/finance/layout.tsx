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
  {
    items: [
      { href: "/finance", label: "Home", icon: "dashboard" },
      { href: "/finance/sales-approvals", label: "Approvals", icon: "approvals" },
    ],
  },
  {
    label: "Customers",
    icon: "customers",
    items: [
      { href: "/finance/customers", label: "Customers", icon: "customers" },
      { href: "/finance/sell", label: "Sell", icon: "sales" },
      { href: "/finance/applications", label: "Applications", icon: "customers" },
      { href: "/finance/partners", label: "Partners", icon: "customers" },
    ],
  },
  {
    label: "Verify",
    icon: "approvals",
    items: [
      { href: "/finance/sales", label: "History", icon: "audit" },
      { href: "/finance/payments", label: "Payments", icon: "payments" },
      { href: "/finance/returns", label: "Returns", icon: "warehouses" },
    ],
  },
  {
    label: "Money",
    icon: "finance",
    items: [
      { href: "/finance/cash", label: "Cash", icon: "settlements" },
      { href: "/finance/operational-fund", label: "Expenses", icon: "finance" },
    ],
  },
  {
    label: "Credit",
    items: [{ href: "/finance/credit", label: "Debts", icon: "credit" }],
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
      mobileTabs={["/finance", "/finance/sales-approvals", "/finance/payments", "/finance/cash"]}
      nav={nav}
      user={{ name: user.name, email: user.email, role: user.role }}
      areaLabel="Finance"
      profileHref="/finance/profile"
    >
      {children}
    </DashboardShell>
  );
}
