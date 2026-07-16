import { requireRole } from "@/lib/rbac";
import {
  DashboardShell,
  type NavGroup,
} from "@/components/dashboard/dashboard-shell";

// Finance & Accounting — daily financial operations. Reports to the admin:
// money in, money out, credit, accounts and financial reporting. No user
// management, system settings or warehouse operations.
const nav: NavGroup[] = [
  { items: [{ href: "/finance", label: "Dashboard", icon: "dashboard" }] },
  {
    label: "Money",
    items: [
      { href: "/finance/payments", label: "Payment confirmations", icon: "payments" },
      { href: "/finance/accounts", label: "Company accounts", icon: "finance" },
      { href: "/finance/expenses", label: "Expenses", icon: "finance" },
      { href: "/finance/petty-cash", label: "Petty cash", icon: "finance" },
      { href: "/finance/payroll", label: "Payroll", icon: "users" },
    ],
  },
  {
    label: "Credit",
    items: [
      { href: "/finance/credit", label: "Credit & settlements", icon: "credit" },
      { href: "/finance/partners", label: "Partner accounts", icon: "customers" },
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
