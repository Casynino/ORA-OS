import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import {
  DashboardShell,
  type NavGroup,
} from "@/components/dashboard/dashboard-shell";

const nav: NavGroup[] = [
  { items: [{ href: "/admin", label: "Home", icon: "dashboard" }] },
  {
    label: "Operations",
    icon: "inventory",
    items: [
      { href: "/admin/products", label: "Products", icon: "products" },
      { href: "/admin/inventory", label: "Inventory", icon: "inventory" },
      { href: "/admin/warehouses", label: "Warehouses", icon: "warehouses" },
      { href: "/admin/transfers", label: "Transfers", icon: "transfers" },
      { href: "/admin/imports", label: "Imports", icon: "imports" },
      { href: "/admin/returns", label: "Returns", icon: "returns" },
    ],
  },
  {
    label: "Sales",
    icon: "sales",
    items: [
      { href: "/admin/sales-dashboard", label: "Insights", icon: "profit" },
      { href: "/admin/requests", label: "Orders", icon: "requests" },
      { href: "/admin/sales-approvals", label: "Approvals", icon: "approvals" },
      { href: "/admin/sales", label: "History", icon: "sales" },
      { href: "/admin/sell", label: "Sell", icon: "newRequest" },
      { href: "/admin/reps", label: "Reps", icon: "reps" },
      { href: "/admin/customers", label: "Customers", icon: "customers" },
      { href: "/admin/invoices", label: "Invoices", icon: "invoices" },
    ],
  },
  {
    label: "Finance",
    icon: "finance",
    items: [
      { href: "/admin/finance", label: "Finance", icon: "finance" },
      { href: "/admin/finance/operational-fund", label: "Expenses", icon: "payments" },
      { href: "/admin/credit", label: "Settlements", icon: "settlements" },
      { href: "/admin/credit/extensions", label: "Extensions", icon: "extensions" },
    ],
  },
  {
    label: "Partners",
    icon: "users",
    items: [
      { href: "/admin/applications", label: "Applications", icon: "applications" },
      { href: "/admin/users", label: "Users", icon: "users" },
      { href: "/admin/messages", label: "Messages", icon: "messages" },
    ],
  },
  {
    label: "Impact",
    icon: "impact",
    items: [
      { href: "/admin/news", label: "News", icon: "news" },
      { href: "/admin/impact", label: "Activities", icon: "activities" },
      { href: "/admin/stockists", label: "Stockists", icon: "fieldReports" },
      { href: "/admin/education", label: "Education", icon: "education" },
    ],
  },
  {
    label: "Reports",
    icon: "reports",
    items: [
      { href: "/admin/reports", label: "Reports", icon: "reports" },
      { href: "/admin/activity", label: "Activity", icon: "activity" },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole("ADMIN");
  // Read the name fresh from the DB so renames show immediately (the session
  // JWT can hold a stale name until the next sign-in).
  const me = await prisma.user.findUnique({
    where: { id: session.id },
    select: { name: true, email: true, avatar: true, preferredName: true },
  });
  return (
    <DashboardShell
      mobileTabs={["/admin", "/admin/requests", "/admin/sales-approvals", "/admin/finance"]}
      nav={nav}
      user={{
        name: me?.name ?? session.name,
        email: me?.email ?? session.email,
        role: session.role,
        avatar: me?.avatar ?? null,
        preferredName: me?.preferredName ?? null,
      }}
      areaLabel="Admin"
      profileHref="/admin/profile"
    >
      {children}
    </DashboardShell>
  );
}
