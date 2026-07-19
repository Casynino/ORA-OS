import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import {
  DashboardShell,
  type NavGroup,
} from "@/components/dashboard/dashboard-shell";

const nav: NavGroup[] = [
  { items: [{ href: "/admin", label: "Dashboard", icon: "dashboard" }] },
  {
    label: "Operations",
    items: [
      { href: "/admin/products", label: "Products", icon: "products" },
      { href: "/admin/inventory", label: "Inventory", icon: "inventory" },
      { href: "/admin/warehouses", label: "Warehouses", icon: "warehouses" },
      { href: "/admin/transfers", label: "Transfers", icon: "transfers" },
      { href: "/admin/imports", label: "Imports & POs", icon: "imports" },
      { href: "/admin/returns", label: "Returns", icon: "returns" },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/admin/requests", label: "Orders", icon: "requests" },
      { href: "/admin/sales-approvals", label: "Sales approvals", icon: "approvals" },
      { href: "/admin/sales", label: "Sales", icon: "sales" },
      { href: "/admin/reps", label: "Sales Reps", icon: "reps" },
      { href: "/admin/customers", label: "Customers", icon: "customers" },
      { href: "/admin/invoices", label: "Invoices", icon: "invoices" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/admin/finance", label: "Finance", icon: "finance" },
      { href: "/admin/credit", label: "Settlements", icon: "settlements" },
      { href: "/admin/credit/extensions", label: "Credit Extensions", icon: "extensions" },
    ],
  },
  {
    label: "Partner Network",
    items: [
      { href: "/admin/applications", label: "Applications", icon: "applications" },
      { href: "/admin/users", label: "Users", icon: "users" },
      { href: "/admin/messages", label: "Messages", icon: "messages" },
    ],
  },
  {
    label: "Impact",
    items: [
      { href: "/admin/news", label: "News & Posts", icon: "news" },
      { href: "/admin/impact", label: "Impact Management", icon: "activities" },
      { href: "/admin/stockists", label: "Stockists & Coverage", icon: "fieldReports" },
      { href: "/admin/education", label: "Education Hub", icon: "education" },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/admin/reports", label: "Reports", icon: "reports" },
      { href: "/admin/activity", label: "Activity Log", icon: "activity" },
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
      nav={nav}
      user={{
        name: me?.name ?? session.name,
        email: me?.email ?? session.email,
        role: session.role,
        avatar: me?.avatar ?? null,
        preferredName: me?.preferredName ?? null,
      }}
      areaLabel="Admin Console"
      profileHref="/admin/profile"
    >
      {children}
    </DashboardShell>
  );
}
