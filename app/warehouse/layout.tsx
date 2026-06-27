import { requireRole } from "@/lib/rbac";
import {
  DashboardShell,
  type NavGroup,
} from "@/components/dashboard/dashboard-shell";

const nav: NavGroup[] = [
  { items: [{ href: "/warehouse", label: "Overview", icon: "dashboard" }] },
  {
    label: "Operations",
    items: [
      { href: "/warehouse/orders", label: "Order fulfillment", icon: "requests" },
      { href: "/warehouse/transfers", label: "Transfers", icon: "transfers" },
      { href: "/warehouse/returns", label: "Returns", icon: "returns" },
      { href: "/warehouse/receive", label: "Receive stock", icon: "receive" },
      { href: "/warehouse/sales", label: "Record sale", icon: "sales" },
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
