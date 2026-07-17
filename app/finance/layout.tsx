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
    label: "Customers & credit",
    items: [
      { href: "/finance/applications", label: "Partner applications", icon: "customers" },
      { href: "/finance/customers", label: "Customer database", icon: "customers" },
      { href: "/finance/partners", label: "Partner accounts", icon: "customers" },
      { href: "/finance/credit", label: "Debt & settlements", icon: "credit" },
    ],
  },
  {
    label: "Verification",
    items: [
      { href: "/finance/sales-approvals", label: "Sales approvals", icon: "sales" },
      { href: "/finance/payments", label: "Payment confirmations", icon: "payments" },
      { href: "/finance/returns", label: "Returns", icon: "warehouses" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/finance/accounts", label: "Company accounts", icon: "finance" },
      { href: "/finance/cash", label: "Cash on hand & deposits", icon: "settlements" },
      { href: "/finance/expenses", label: "Expenses", icon: "finance" },
      { href: "/finance/petty-cash", label: "Office expense fund", icon: "finance" },
    ],
  },
  {
    label: "Reporting",
    items: [{ href: "/finance/reports", label: "Financial reports", icon: "reports" }],
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
