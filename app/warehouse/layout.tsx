import { requireRole } from "@/lib/rbac";
import {
  DashboardShell,
  type NavGroup,
} from "@/components/dashboard/dashboard-shell";

// Inventory operations only — no sales, pricing, finance or customer
// management. Warehouse staff receive, prepare, dispatch and count stock.
const nav: NavGroup[] = [
  { items: [{ href: "/warehouse", label: "Overview", icon: "dashboard" }] },
  {
    label: "Operations",
    items: [
      { href: "/warehouse/orders", label: "Partner orders", icon: "requests" },
      { href: "/warehouse/rep-requests", label: "Rep requests", icon: "reps" },
      { href: "/warehouse/transfers", label: "Transfers", icon: "transfers" },
      { href: "/warehouse/returns", label: "Returns", icon: "returns" },
      { href: "/warehouse/receive", label: "Receive stock", icon: "receive" },
    ],
  },
  {
    label: "Stock",
    items: [
      { href: "/warehouse/inventory", label: "Inventory", icon: "inventory" },
      { href: "/warehouse/movements", label: "Movements", icon: "transfers" },
    ],
  },
];

export default async function WarehouseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("WAREHOUSE");
  return (
    <DashboardShell
      nav={nav}
      user={{ name: user.name, email: user.email, role: user.role }}
      areaLabel="Warehouse"
    >
      {children}
    </DashboardShell>
  );
}
